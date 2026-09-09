export interface GA4Section {
  status: 'ready' | 'partial' | 'empty' | 'unavailable'
  rows: Record<string, string | null>[]
  message?: string
  dimension?: string
  registered?: boolean | null
  identifiedValues?: boolean | null
}
export type GA4Details = Record<
  | 'previousMetrics'
  | 'previousEvents'
  | 'daily'
  | 'dailyWhatsapp'
  | 'sources'
  | 'pages'
  | 'ctas'
  | 'pageViews'
  | 'sourceSessions'
  | 'sourceWhatsapp'
  | 'services'
  | 'serviceSelections'
  | 'ctaLocations',
  GA4Section
>
export interface GA4Report {
  details?: GA4Details
  days?: string[]
  timezone?: string | null
  status: 'success' | 'partial' | 'empty'
  metrics: Record<
    'activeUsers' | 'sessions' | 'screenPageViews' | 'eventCount',
    string | null
  >
  events: Record<
    'whatsapp_click' | 'select_service' | 'scroll_depth',
    string | null
  >
}

export function parseGA4(payload: unknown): GA4Report {
  const invalid = () =>
    new Error('Resposta do GA4 inválida. Nenhum dado simulado foi utilizado.')
  if (!payload || typeof payload !== 'object') throw invalid()
  const data = payload as Record<string, unknown>
  if (!['success', 'partial', 'empty'].includes(String(data.status)))
    throw invalid()
  const date = data.dateRange as Record<string, unknown> | undefined
  if (date?.startDate !== '7daysAgo' || date?.endDate !== 'yesterday')
    throw invalid()
  function counts(keys: string[], raw: unknown) {
    if (!raw || typeof raw !== 'object') throw invalid()
    return Object.fromEntries(
      keys.map((key) => {
        const value = (raw as Record<string, unknown>)[key]
        if (
          value !== null &&
          (typeof value !== 'string' || !/^\d+$/.test(value))
        )
          throw invalid()
        return [key, value]
      }),
    )
  }
  return {
    details: parseDetails(data.details),
    days:
      Array.isArray(data.days) &&
      data.days.length === 7 &&
      data.days.every((v) => typeof v === 'string' && /^\d{8}$/.test(v))
        ? data.days
        : [],
    timezone: typeof data.timezone === 'string' ? data.timezone : null,
    status: data.status as GA4Report['status'],
    metrics: counts(
      ['activeUsers', 'sessions', 'screenPageViews', 'eventCount'],
      data.metrics,
    ) as GA4Report['metrics'],
    events: counts(
      ['whatsapp_click', 'select_service', 'scroll_depth'],
      data.events,
    ) as GA4Report['events'],
  }
}

function parseDetails(raw: unknown): GA4Details {
  const data =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const specs = {
    previousMetrics: [
      [],
      ['activeUsers', 'sessions', 'screenPageViews', 'eventCount'],
    ],
    previousEvents: [['event'], ['eventCount']],
    daily: [
      ['date'],
      ['activeUsers', 'sessions', 'screenPageViews', 'eventCount'],
    ],
    dailyWhatsapp: [['date'], ['eventCount']],
    sources: [['source'], ['sessions']],
    pages: [['page'], ['eventCount']],
    ctas: [['page', 'cta'], ['eventCount']],
    pageViews: [['page'], ['screenPageViews']],
    sourceSessions: [['source', 'medium'], ['sessions']],
    sourceWhatsapp: [['source', 'medium'], ['eventCount']],
    services: [['service'], ['eventCount']],
    serviceSelections: [['service'], ['eventCount']],
    ctaLocations: [['cta_location'], ['eventCount']],
  } as const
  return Object.fromEntries(
    Object.entries(specs).map(([key, [dimensions, metrics]]) => {
      const unavailable: GA4Section = {
        status: 'unavailable',
        rows: [],
        message: 'Relatório indisponível. Tente atualizar os dados.',
      }
      try {
        const section = data[key] as GA4Section
        if (
          !section ||
          !['ready', 'partial', 'empty', 'unavailable'].includes(
            section.status,
          ) ||
          !Array.isArray(section.rows) ||
          section.rows.length > 1000
        )
          throw new Error()
        if (
          ['empty', 'unavailable'].includes(section.status) &&
          section.rows.length
        )
          throw new Error()
        const rows = section.rows.map((row) => {
          if (!row || typeof row !== 'object') throw new Error()
          const out: Record<string, string | null> = {}
          for (const field of dimensions) {
            const value = row[field]
            if (
              value !== null &&
              (typeof value !== 'string' || value.length > 4096)
            )
              throw new Error()
            if (
              field === 'date' &&
              (typeof value !== 'string' || !/^\d{8}$/.test(value))
            )
              throw new Error()
            out[field] = value
          }
          for (const field of metrics) {
            const value = row[field]
            if (typeof value !== 'string' || !/^\d+$/.test(value))
              throw new Error()
            out[field] = value
          }
          return out
        })
        if (key === 'previousMetrics' && rows.length > 1) throw new Error()
        if (
          (key === 'daily' || key === 'dailyWhatsapp') &&
          new Set(rows.map((r) => r.date)).size !== rows.length
        )
          throw new Error()
        return [
          key,
          {
            status: section.status,
            rows,
            ...(['services', 'serviceSelections', 'ctaLocations'].includes(key)
              ? {
                  registered:
                    typeof section.registered === 'boolean'
                      ? section.registered
                      : null,
                  identifiedValues:
                    typeof section.identifiedValues === 'boolean'
                      ? section.identifiedValues
                      : null,
                }
              : {}),
            ...(typeof section.message === 'string' &&
            section.message.length <= 500
              ? { message: section.message }
              : {}),
            ...([
              'ctas',
              'services',
              'serviceSelections',
              'ctaLocations',
            ].includes(key) &&
            typeof section.dimension === 'string' &&
            /^(customEvent:[a-z_]+|linkText|linkId)$/.test(section.dimension)
              ? { dimension: section.dimension }
              : {}),
          },
        ]
      } catch {
        return [key, unavailable]
      }
    }),
  ) as GA4Details
}

export function ga4Comparison(
  current: string | null | undefined,
  previous: string | null | undefined,
) {
  if (current == null || previous == null) return null
  const a = Number(current),
    b = Number(previous)
  return Number.isSafeInteger(a) && Number.isSafeInteger(b) && b > 0
    ? ((a - b) / b) * 100
    : null
}

export function ga4Daily(data: GA4Report) {
  const daily = data.details?.daily.rows ?? []
  const whatsapp = data.details?.dailyWhatsapp.rows ?? []
  const days = data.days?.length
    ? data.days
    : [
        ...new Set(
          [...daily, ...whatsapp]
            .map((row) => row.date)
            .filter((date): date is string => date !== null),
        ),
      ].sort()
  return days.map((date) => {
    const row = daily.find((r) => r.date === date)
    return {
      date,
      activeUsers: row?.activeUsers ?? null,
      sessions: row?.sessions ?? null,
      screenPageViews: row?.screenPageViews ?? null,
      eventCount: row?.eventCount ?? null,
      whatsapp_click: whatsapp.find((r) => r.date === date)?.eventCount ?? null,
    }
  })
}

let pending: Promise<GA4Report> | null = null
export function loadGA4(): Promise<GA4Report> {
  if (pending) return pending
  pending = (async () => {
    let response: Response
    try {
      response = await fetch('/api/dev/analytics/test', {
        cache: 'no-store',
        signal: AbortSignal.timeout(90_000),
      })
    } catch {
      throw new Error(
        'GA4 indisponível. Verifique o backend local e tente novamente.',
      )
    }
    if (!response.ok) {
      if ([401, 403, 503].includes(response.status))
        throw new Error(
          'GA4 indisponível. Verifique a configuração, a credencial e a permissão no backend.',
        )
      if (response.status === 429)
        throw new Error(
          'GA4 ocupado ou limite de consultas atingido. Tente novamente mais tarde.',
        )
      throw new Error(
        'A consulta ao GA4 falhou. Verifique o backend local e tente novamente.',
      )
    }
    let payload: unknown
    try {
      payload = await response.json()
    } catch {
      throw new Error('Resposta do GA4 inválida.')
    }
    return parseGA4(payload)
  })().finally(() => {
    pending = null
  })
  return pending
}

export function ga4Number(value: string | null) {
  return value === null ? 'Sem dados' : BigInt(value).toLocaleString('pt-BR')
}
