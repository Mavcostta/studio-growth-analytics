export type Source = 'instagram' | 'ga4'
const object = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {}
export const count = (v: unknown): number | null => {
  if (typeof v !== 'number' && !(typeof v === 'string' && /^\d+$/.test(v)))
    return null
  const n = Number(v)
  return Number.isSafeInteger(n) && n >= 0 ? n : null
}
const iso = (v: unknown): string | null =>
  typeof v === 'string' &&
  /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(v) &&
  Number.isFinite(Date.parse(v))
    ? v
    : null
const day = (v: unknown): string | null =>
  typeof v === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  Number.isFinite(Date.parse(v)) &&
  new Date(v).toISOString().slice(0, 10) === v
    ? v
    : null
export interface Period {
  start: string
  end: string
  timezone: string
}
export interface Ranking {
  label: string
  denominator: number | null
  clicks: number | null
  rate: number | null
  partial: boolean
}
export interface HistoryPoint {
  collectedAt: string
  observedDate: string
  period: Period | null
  metrics: Record<string, number | null>
  pages: Ranking[]
  sources: Ranking[]
}
export interface Change {
  difference: number | null
  percent: number | null
  direction: 'increase' | 'decrease' | 'stable' | null
}
export interface SourceHistory {
  status: 'ready' | 'partial' | 'empty' | 'unavailable'
  message: string | null
  points: HistoryPoint[]
  comparison: {
    previous: string
    current: string
    previousPeriod: Period | null
    currentPeriod: Period | null
    changes: Record<string, Change>
  } | null
}
export interface HistoryReport {
  schemaVersion: 1
  instagram: SourceHistory
  ga4: SourceHistory
}

function rankings(
  raw: unknown,
  denominatorName: string,
  clicksRaw: unknown,
  keys: string[],
): Ranking[] {
  const denominator = object(raw),
    clicks = object(clicksRaw)
  if (
    !['ready', 'partial'].includes(String(denominator.status)) ||
    !Array.isArray(denominator.rows) ||
    denominator.rows.length > 1000
  )
    return []
  const clickRows =
    ['ready', 'partial'].includes(String(clicks.status)) &&
    Array.isArray(clicks.rows) &&
    clicks.rows.length <= 1000
      ? clicks.rows.map(object)
      : []
  const label = (row: Record<string, unknown>) =>
    keys.every(
      (k) =>
        typeof row[k] === 'string' &&
        row[k] !== '(not set)' &&
        (row[k] as string).length <= 512,
    )
      ? keys.map((k) => row[k]).join(' / ')
      : null
  const rows = denominator.rows.map(object)
  return rows.flatMap((row) => {
    const name = label(row)
    if (name === null || rows.filter((r) => label(r) === name).length !== 1)
      return []
    const matches = clickRows.filter((r) => keys.every((k) => r[k] === row[k]))
    const n = count(row[denominatorName]),
      c = matches.length === 1 ? count(matches[0].eventCount) : null
    const partial = denominator.status !== 'ready' || clicks.status !== 'ready'
    return [
      {
        label: name,
        denominator: n,
        clicks: c,
        rate:
          !partial && n !== null && n > 0 && c !== null ? (c / n) * 100 : null,
        partial,
      },
    ]
  })
}

export function normalizeSnapshot(
  raw: unknown,
  path: string,
): HistoryPoint | null {
  const match =
    /^snapshots\/(instagram|ga4)\/(\d+)\/(\d{4}-\d{2}-\d{2})\.json$/.exec(path)
  const s = object(raw),
    data = object(s.data),
    collectedAt = iso(s.collectedAt)
  if (
    !match ||
    s.schemaVersion !== 1 ||
    s.source !== match[1] ||
    s.subjectId !== match[2] ||
    s.observedDate !== match[3] ||
    !day(s.observedDate) ||
    !collectedAt ||
    collectedAt.slice(0, 10) !== s.observedDate ||
    s.timezone !== 'UTC'
  )
    return null
  const source = match[1]
  if (
    (source === 'instagram' ? data.accountId : data.propertyId) !== s.subjectId
  )
    return null
  const point: HistoryPoint = {
    collectedAt,
    observedDate: match[3],
    period: null,
    metrics: {},
    pages: [],
    sources: [],
  }
  if (source === 'instagram') {
    if (!['ok', 'partial'].includes(String(data.status))) return null
    const period = object(data.period),
      start = iso(period.since),
      end = iso(period.until)
    if (
      start &&
      end &&
      Date.parse(end) - Date.parse(start) === 86400000 &&
      period.timezone === 'UTC'
    )
      point.period = { start, end, timezone: 'UTC' }
    const measurement = (raw: unknown) => {
      const v = object(raw)
      return v.status === 'available' ? count(v.value) : null
    }
    point.metrics.followers_count = measurement(data.followers)
    for (const name of [
      'profile_views',
      'reach',
      'accounts_engaged',
      'views',
      'total_interactions',
      'profile_links_taps',
    ])
      point.metrics[name] = point.period
        ? measurement(object(data.metrics)[name])
        : null
    const flow = object(data.followsAndUnfollows)
    point.metrics.follows =
      point.period && ['available', 'partial'].includes(String(flow.status))
        ? count(flow.follows)
        : null
    point.metrics.unfollows =
      point.period && ['available', 'partial'].includes(String(flow.status))
        ? count(flow.unfollows)
        : null
  } else {
    if (!['success', 'partial', 'empty'].includes(String(data.status)))
      return null
    const days = Array.isArray(data.days)
      ? data.days.map((d) =>
          typeof d === 'string' && /^\d{8}$/.test(d)
            ? day(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`)
            : null,
        )
      : []
    if (
      object(data.dateRange).startDate === '7daysAgo' &&
      object(data.dateRange).endDate === 'yesterday' &&
      days.length === 7 &&
      days.every(
        (d, i) =>
          d && (!i || Date.parse(d) - Date.parse(days[i - 1]!) === 86400000),
      ) &&
      typeof data.timezone === 'string'
    ) {
      try {
        new Intl.DateTimeFormat('en', { timeZone: data.timezone })
        point.period = {
          start: days[0]!,
          end: days[6]!,
          timezone: data.timezone,
        }
      } catch {
        /* Fuso inválido impede comparação. */
      }
    }
    for (const name of ['activeUsers', 'sessions', 'screenPageViews'])
      point.metrics[name] = point.period
        ? count(object(data.metrics)[name])
        : null
    point.metrics.whatsapp_click = point.period
      ? count(object(data.events).whatsapp_click)
      : null
    if (point.period) {
      const details = object(data.details)
      point.pages = rankings(
        details.pageViews,
        'screenPageViews',
        details.pages,
        ['page'],
      )
      point.sources = rankings(
        details.sourceSessions,
        'sessions',
        details.sourceWhatsapp,
        ['source', 'medium'],
      )
    }
  }
  return point
}

export function change(
  current: number | null | undefined,
  previous: number | null | undefined,
): Change {
  if (current == null || previous == null)
    return { difference: null, percent: null, direction: null }
  const difference = current - previous
  return {
    difference,
    percent: previous > 0 ? (difference / previous) * 100 : null,
    direction:
      difference > 0 ? 'increase' : difference < 0 ? 'decrease' : 'stable',
  }
}

export function summarizeHistory(
  source: Source,
  points: HistoryPoint[],
  partial = false,
): SourceHistory {
  points = [...points].sort((a, b) =>
    a.collectedAt.localeCompare(b.collectedAt),
  )
  const current = points.at(-1)
  const previous =
    source === 'instagram'
      ? points.at(-2)
      : points
          .slice(0, -1)
          .reverse()
          .find(
            (p) =>
              p.period &&
              current?.period &&
              p.period.timezone === current.period.timezone &&
              Date.parse(current.period.start) - Date.parse(p.period.end) ===
                86400000,
          )
  const comparable = current && previous && !partial
  return {
    status: partial ? 'partial' : points.length ? 'ready' : 'empty',
    message: partial
      ? 'Leitura parcial do histórico. Comparações suspensas; podem faltar registros recentes.'
      : !comparable
        ? 'Histórico sendo construído'
        : null,
    points: points.map((p) =>
      p === current ? p : { ...p, pages: [], sources: [] },
    ),
    comparison: comparable
      ? {
          previous: previous.collectedAt,
          current: current.collectedAt,
          previousPeriod: previous.period,
          currentPeriod: current.period,
          changes: Object.fromEntries(
            Object.keys(current.metrics).map((key) => [
              key,
              change(
                current.metrics[key],
                source === 'instagram' &&
                  key !== 'followers_count' &&
                  (!current.period ||
                    !previous.period ||
                    current.period.start === previous.period.start)
                  ? null
                  : previous.metrics[key],
              ),
            ]),
          ),
        }
      : null,
  }
}
