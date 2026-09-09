import {
  identifier,
  localStatus,
  numeric,
  object,
  request,
  safeError,
  type SafeError,
} from './index.js'
import {
  metricNames,
  type InstagramContentType,
  type InstagramPostAnalytics,
  type MetricName,
} from './types.js'
import { summarizePosts } from './summary.js'

export const timezone = 'America/Sao_Paulo'
const mediaFields = [
  'id',
  'caption',
  'media_type',
  'media_product_type',
  'timestamp',
  'permalink',
  'thumbnail_url',
  'media_url',
  'username',
]
const apiMetric = (metric: MetricName) =>
  metric === 'totalInteractions' ? 'total_interactions' : metric
const calendar = new Intl.DateTimeFormat('en-CA', {
  timeZone: timezone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
})

export function contentType(
  type: unknown,
  product: unknown,
): InstagramContentType {
  if (product === 'REELS' || type === 'REEL') return 'reel'
  return type === 'IMAGE'
    ? 'image'
    : type === 'CAROUSEL_ALBUM'
      ? 'carousel'
      : type === 'VIDEO'
        ? 'video'
        : 'unknown'
}

function safeText(value: unknown, max: number) {
  if (typeof value !== 'string') return undefined
  let text = value
  const token = process.env.INSTAGRAM_ACCESS_TOKEN?.trim()
  if (token) text = text.split(token).join('[REDACTED]')
  return text
    .replace(
      /(?:access_token|app_secret|client_secret|authorization)\s*[:=]\s*[^\s&,]+/gi,
      '[REDACTED]',
    )
    .slice(0, max)
}

export function safeMediaUrl(value: unknown, permalink = false) {
  if (typeof value !== 'string' || value.length > 8000) return undefined
  try {
    const url = new URL(value)
    const domains = permalink
      ? ['instagram.com']
      : ['cdninstagram.com', 'fbcdn.net']
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      !domains.some(
        (domain) =>
          url.hostname === domain || url.hostname.endsWith(`.${domain}`),
      )
    )
      return undefined
    if (
      [...url.searchParams.keys()].some((key) =>
        /token|secret|credential|authorization|signature/i.test(key),
      )
    )
      return undefined
    const token = process.env.INSTAGRAM_ACCESS_TOKEN?.trim()
    if (
      token &&
      (value.includes(token) || decodeURIComponent(value).includes(token))
    )
      return undefined
    // CDN links são públicos/temporários; nenhum download ou proxy nesta fase.
    if (permalink) url.search = ''
    url.hash = ''
    return url.toString()
  } catch {
    return undefined
  }
}

export function normalizePost(value: unknown): InstagramPostAnalytics | null {
  const row = object(value)
  const id = identifier(row.id)
  if (!id) return null
  const publishedAt =
    typeof row.timestamp === 'string' &&
    /^\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:?\d{2})$/.test(row.timestamp)
      ? row.timestamp
      : undefined
  const validDate =
    publishedAt !== undefined &&
    Number.isFinite(Date.parse(publishedAt)) &&
    new Date(`${publishedAt.slice(0, 10)}T00:00:00Z`)
      .toISOString()
      .slice(0, 10) === publishedAt.slice(0, 10)
  const parts = validDate
    ? Object.fromEntries(
        calendar
          .formatToParts(new Date(publishedAt))
          .map((part) => [part.type, part.value]),
      )
    : null
  const publishedDate = parts
    ? `${parts.year}-${parts.month}-${parts.day}`
    : null
  const urls = {
    permalink: safeMediaUrl(row.permalink, true),
    thumbnailUrl: safeMediaUrl(row.thumbnail_url),
    mediaUrl: safeMediaUrl(row.media_url),
  }
  const username =
    typeof row.username === 'string' &&
    /^[a-zA-Z0-9_.]{1,30}$/.test(row.username)
      ? safeText(row.username, 30)
      : undefined
  return {
    id,
    caption: safeText(row.caption, 2200),
    username,
    contentType: contentType(row.media_type, row.media_product_type),
    mediaType:
      typeof row.media_type === 'string' &&
      /^[A-Z_]{1,30}$/.test(row.media_type)
        ? row.media_type
        : undefined,
    mediaProductType:
      typeof row.media_product_type === 'string' &&
      /^[A-Z_]{1,30}$/.test(row.media_product_type)
        ? row.media_product_type
        : undefined,
    publishedAt,
    publishedDate,
    publishedHour: parts ? Number(parts.hour) : null,
    dayOfWeek: publishedDate
      ? new Date(`${publishedDate}T12:00:00Z`).getUTCDay() || 7
      : null,
    ...urls,
    fieldsReceived: mediaFields.filter((field) => Object.hasOwn(row, field)),
    omittedUrlFields: [
      ['permalink', urls.permalink],
      ['thumbnail_url', urls.thumbnailUrl],
      ['media_url', urls.mediaUrl],
    ]
      .filter(([field, url]) => typeof row[field!] === 'string' && !url)
      .map(([field]) => field!),
    metrics: {
      reach: null,
      views: null,
      saved: null,
      shares: null,
      likes: null,
      comments: null,
      totalInteractions: null,
    },
    metricStatus: {
      reach: 'not_tested',
      views: 'not_tested',
      saved: 'not_tested',
      shares: 'not_tested',
      likes: 'not_tested',
      comments: 'not_tested',
      totalInteractions: 'not_tested',
    },
    metricErrors: {},
    issues: validDate ? [] : ['missing_or_invalid_timestamp'],
  }
}

export async function getInstagramPosts() {
  const posts: InstagramPostAnalytics[] = []
  const report: {
    status: 'ok' | 'partial' | 'error'
    apiVersion: string
    timezone: string
    collectedAt: string
    account: { id?: string; username?: string }
    count: number
    posts: InstagramPostAnalytics[]
    requests: { count: number; httpStatuses: Record<string, number> }
    collection: {
      limit: number
      pages: number
      hasMore: boolean
      skippedInvalid: number
    }
    error?: SafeError
    summary?: ReturnType<typeof summarizePosts>
  } = {
    status: 'ok',
    apiVersion: 'v25.0',
    timezone,
    collectedAt: '',
    account: {},
    count: 0,
    posts,
    requests: { count: 0, httpStatuses: {} },
    collection: { limit: 25, pages: 0, hasMore: false, skippedInvalid: 0 },
  }
  const finish = (httpStatus = 200) => {
    report.count = posts.length
    report.collectedAt = new Date().toISOString()
    report.summary = summarizePosts(posts)
    if (
      !report.error &&
      (report.collection.skippedInvalid ||
        posts.some(
          (post) =>
            post.issues.length ||
            metricNames.some(
              (metric) => post.metricStatus[metric] !== 'available',
            ),
        ))
    )
      report.status = 'partial'
    let body = JSON.stringify(report)
    const token = process.env.INSTAGRAM_ACCESS_TOKEN?.trim()
    if (token)
      body = body.split(JSON.stringify(token).slice(1, -1)).join('[REDACTED]')
    return { httpStatus, body }
  }
  const stop = (error: SafeError) => {
    report.error = error
    report.status = posts.length ? 'partial' : 'error'
    return finish(localStatus(error))
  }
  const call = async (...args: Parameters<typeof request>) => {
    const result = await request(...args)
    report.requests.count++
    const status = String(result.httpStatus ?? 'network_error')
    report.requests.httpStatuses[status] =
      (report.requests.httpStatuses[status] ?? 0) + 1
    return result
  }
  if (!process.env.INSTAGRAM_ACCESS_TOKEN?.trim())
    return stop(safeError('missing_token'))
  const profile = await call('me', { fields: 'user_id,username' })
  if (profile.error) return stop(profile.error)
  const id = identifier(profile.data?.user_id) ?? identifier(profile.data?.id)
  if (!id) return stop(safeError('api_error'))
  report.account = {
    id,
    username:
      typeof profile.data?.username === 'string' &&
      /^[a-zA-Z0-9_.]{1,30}$/.test(profile.data.username)
        ? profile.data.username
        : undefined,
  }
  let after: string | undefined
  const seen = new Set<string>()
  const cursors = new Set<string>()
  // Limite de cinco páginas evita loops de paginação; nunca seguir paging.next (pode conter token).
  while (posts.length < 25 && report.collection.pages < 5) {
    const page = await call(`${id}/media`, {
      fields: mediaFields.join(','),
      limit: String(25 - posts.length),
      ...(after ? { after } : {}),
    })
    if (page.error) return stop(page.error)
    if (!Array.isArray(page.data?.data)) return stop(safeError('api_error'))
    report.collection.pages++
    for (const raw of page.data.data) {
      if (posts.length >= 25) break
      const post = normalizePost(raw)
      if (!post) {
        report.collection.skippedInvalid++
        continue
      }
      if (!seen.has(post.id)) {
        seen.add(post.id)
        posts.push(post)
      }
    }
    const paging = object(page.data.paging)
    report.collection.hasMore = typeof paging.next === 'string'
    const cursor = object(paging.cursors).after
    if (!report.collection.hasMore || posts.length >= 25) break
    if (
      typeof cursor !== 'string' ||
      !cursor.length ||
      cursor.length > 4096 ||
      cursors.has(cursor) ||
      !page.data.data.length
    ) {
      report.status = 'partial'
      break
    }
    cursors.add(cursor)
    after = cursor
  }
  if (posts.length < 25 && report.collection.hasMore) report.status = 'partial'

  const setMetric = (
    post: InstagramPostAnalytics,
    metric: MetricName,
    data: unknown,
  ) => {
    const entries = object(data).data
    if (!Array.isArray(entries)) {
      post.metricStatus[metric] = 'error'
      post.metricErrors[metric] = safeError('api_error')
      return
    }
    const row = entries
      .map(object)
      .find((item) => item.name === apiMetric(metric))
    const values = Array.isArray(row?.values) ? row.values : []
    const value =
      numeric(object(row?.total_value).value) ??
      numeric(object(values[0]).value)
    post.metrics[metric] = value !== undefined && value >= 0 ? value : null
    post.metricStatus[metric] =
      post.metrics[metric] === null ? 'no_data' : 'available'
  }
  const setError = (
    post: InstagramPostAnalytics,
    metric: MetricName,
    error: SafeError,
  ) => {
    post.metricStatus[metric] =
      error.kind === 'metric_unavailable' ? 'unavailable' : 'error'
    post.metricErrors[metric] = error
  }
  for (const post of posts) {
    const batch = await call(
      `${post.id}/insights`,
      { metric: metricNames.map(apiMetric).join(',') },
      'batch',
    )
    if (!batch.error) {
      for (const metric of metricNames) setMetric(post, metric, batch.data)
      continue
    }
    if (batch.error.kind !== 'metric_unavailable') {
      for (const metric of metricNames) setError(post, metric, batch.error)
      if (
        ['invalid_token', 'insufficient_permission', 'rate_limit'].includes(
          batch.error.kind,
        ) ||
        batch.httpStatus === null
      )
        return stop(batch.error)
      continue
    }
    for (const metric of metricNames) {
      const result = await call(
        `${post.id}/insights`,
        { metric: apiMetric(metric) },
        apiMetric(metric),
      )
      if (!result.error) setMetric(post, metric, result.data)
      else {
        setError(post, metric, result.error)
        if (
          ['invalid_token', 'insufficient_permission', 'rate_limit'].includes(
            result.error.kind,
          ) ||
          result.httpStatus === null
        )
          return stop(result.error)
      }
    }
  }
  return finish()
}
