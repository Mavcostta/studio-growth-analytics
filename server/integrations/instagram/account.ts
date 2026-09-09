import {
  identifier,
  localStatus,
  numeric,
  object,
  request,
  safeError,
  type SafeError,
} from './index.js'

const names = [
  'profile_views',
  'reach',
  'accounts_engaged',
  'views',
  'total_interactions',
  'profile_links_taps',
] as const
type Measurement = {
  status: 'available' | 'unavailable'
  value: number | null
  error?: SafeError
}
const count = (value: unknown) => {
  const n = numeric(value)
  return n !== undefined && Number.isSafeInteger(n) && n >= 0 ? n : null
}

export async function getInstagramAccount(now = new Date()) {
  const until = Math.floor(now.getTime() / 86400000) * 86400
  const since = until - 86400
  const period = {
    since: new Date(since * 1000).toISOString(),
    until: new Date(until * 1000).toISOString(),
    timezone: 'UTC',
  }
  const unavailable = (error?: SafeError): Measurement => ({
    status: 'unavailable',
    value: null,
    ...(error ? { error } : {}),
  })
  const report = {
    schemaVersion: 1,
    status: 'partial' as 'ok' | 'partial' | 'error',
    apiVersion: 'v25.0',
    collectedAt: now.toISOString(),
    accountId: null as string | null,
    period,
    followers: unavailable(),
    metrics: Object.fromEntries(
      names.map((name) => [name, unavailable()]),
    ) as Record<(typeof names)[number], Measurement>,
    followsAndUnfollows: {
      status: 'unavailable' as 'available' | 'partial' | 'unavailable',
      follows: null as number | null,
      unfollows: null as number | null,
      net: null as number | null,
      error: undefined as SafeError | undefined,
    },
    dailyNewFollowers: {
      status: 'unavailable' as 'available' | 'unavailable',
      since: new Date((until - 7 * 86400) * 1000).toISOString(),
      until: period.until,
      values: [] as { value: number; endTime: string }[],
      error: undefined as SafeError | undefined,
    },
    error: undefined as SafeError | undefined,
  }
  const finish = (httpStatus: number) => ({
    httpStatus,
    body: JSON.stringify(report),
  })
  if (!process.env.INSTAGRAM_ACCESS_TOKEN?.trim()) {
    report.status = 'error'
    report.error = safeError('missing_token')
    return finish(503)
  }
  const profile = await request('me', { fields: 'user_id,followers_count' })
  if (profile.error) {
    report.status = 'error'
    report.error = profile.error
    return finish(localStatus(profile.error))
  }
  report.accountId = identifier(profile.data?.user_id) ?? null
  if (!report.accountId) {
    report.status = 'error'
    report.error = safeError('api_error')
    return finish(502)
  }
  const followers = count(profile.data?.followers_count)
  if (followers !== null)
    report.followers = { status: 'available', value: followers }
  const params = {
    period: 'day',
    metric_type: 'total_value',
    since: String(since),
    until: String(until),
  }
  // Métricas isoladas: indisponibilidade de uma não apaga as demais.
  for (const name of names) {
    const response = await request(
      `${report.accountId}/insights`,
      { ...params, metric: name },
      name,
    )
    const data = response.data?.data
    const row = Array.isArray(data)
      ? data.map(object).find((row) => row.name === name)
      : undefined
    const value = count(object(row?.total_value).value)
    report.metrics[name] =
      value !== null && !response.error
        ? { status: 'available', value }
        : unavailable(response.error)
    if (
      response.error &&
      ['invalid_token', 'insufficient_permission', 'rate_limit'].includes(
        response.error.kind,
      )
    ) {
      report.error = response.error
      return finish(200)
    }
  }
  const flow = await request(
    `${report.accountId}/insights`,
    { ...params, metric: 'follows_and_unfollows', breakdown: 'follow_type' },
    'follows_and_unfollows',
  )
  report.followsAndUnfollows.error = flow.error
  const flowData = flow.data?.data
  const flowRow = Array.isArray(flowData)
    ? flowData.map(object).find((row) => row.name === 'follows_and_unfollows')
    : undefined
  const breakdowns = object(flowRow?.total_value).breakdowns
  if (!flow.error && Array.isArray(breakdowns)) {
    for (const raw of breakdowns) {
      const breakdown = object(raw)
      if (
        !Array.isArray(breakdown.dimension_keys) ||
        !Array.isArray(breakdown.results)
      )
        continue
      const index = breakdown.dimension_keys.indexOf('follow_type')
      if (index < 0) continue
      for (const rawResult of breakdown.results) {
        const result = object(rawResult)
        const type = Array.isArray(result.dimension_values)
          ? result.dimension_values[index]
          : undefined
        if (type === 'FOLLOWER')
          report.followsAndUnfollows.follows = count(result.value)
        if (type === 'NON_FOLLOWER')
          report.followsAndUnfollows.unfollows = count(result.value)
      }
    }
  }
  const flowValues = report.followsAndUnfollows
  if (flowValues.follows !== null && flowValues.unfollows !== null) {
    flowValues.status = 'available'
    flowValues.net = flowValues.follows - flowValues.unfollows
  } else if (flowValues.follows !== null || flowValues.unfollows !== null)
    flowValues.status = 'partial'
  const daily = await request(
    `${report.accountId}/insights`,
    {
      ...params,
      since: String(until - 7 * 86400),
      metric: 'follower_count',
      metric_type: 'time_series',
    },
    'follower_count',
  )
  report.dailyNewFollowers.error = daily.error
  const dailyData = daily.data?.data
  const dailyRow = Array.isArray(dailyData)
    ? dailyData.map(object).find((row) => row.name === 'follower_count')
    : undefined
  if (!daily.error && Array.isArray(dailyRow?.values)) {
    for (const raw of dailyRow.values) {
      const row = object(raw),
        value = count(row.value)
      if (
        value !== null &&
        typeof row.end_time === 'string' &&
        /^\d{4}-\d{2}-\d{2}T[\d:+Z.-]+$/.test(row.end_time) &&
        Number.isFinite(Date.parse(row.end_time))
      )
        report.dailyNewFollowers.values.push({ value, endTime: row.end_time })
    }
    if (report.dailyNewFollowers.values.length)
      report.dailyNewFollowers.status = 'available'
  }
  if (
    report.followers.status === 'available' &&
    Object.values(report.metrics).every((m) => m.status === 'available') &&
    flowValues.status === 'available' &&
    report.dailyNewFollowers.status === 'available'
  )
    report.status = 'ok'
  return finish(200)
}
