const current = [{ startDate: '7daysAgo', endDate: 'yesterday' }]
const previous = [{ startDate: '14daysAgo', endDate: '8daysAgo' }]
const metrics = ['activeUsers', 'sessions', 'screenPageViews', 'eventCount']
const whatsapp = {
  filter: {
    fieldName: 'eventName',
    stringFilter: {
      matchType: 'EXACT',
      value: 'whatsapp_click',
      caseSensitive: true,
    },
  },
}
const object = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' ? (v as Record<string, unknown>) : {}
export interface ReportSection {
  status: 'ready' | 'empty' | 'partial' | 'unavailable'
  rows: Record<string, string | null>[]
  message?: string
}
export function parseRows(
  raw: unknown,
  dimensions: Record<string, string>,
  names: string[],
): ReportSection {
  const data = object(raw)
  // O GA4 pode omitir cabeçalhos e linhas em um relatório vazio válido.
  if (
    data.kind === 'analyticsData#runReport' &&
    data.rows === undefined &&
    !data.rowCount
  )
    return { status: 'empty', rows: [] }
  if (
    !Array.isArray(data.metricHeaders) ||
    !Array.isArray(data.dimensionHeaders ?? [])
  )
    throw new Error('invalid_report')
  const metricHeaders = data.metricHeaders.map((h) => object(h).name)
  const dimensionHeaders = ((data.dimensionHeaders ?? []) as unknown[]).map(
    (h) => object(h).name,
  )
  if (
    names.some((n) => !metricHeaders.includes(n)) ||
    Object.keys(dimensions).some((n) => !dimensionHeaders.includes(n))
  )
    throw new Error('invalid_headers')
  const input = data.rows ?? []
  if (!Array.isArray(input)) throw new Error('invalid_rows')
  const rows = input.map((rawRow) => {
    const row = object(rawRow)
    if (
      !Array.isArray(row.metricValues) ||
      !Array.isArray(row.dimensionValues ?? [])
    )
      throw new Error('invalid_row')
    const out: Record<string, string | null> = {}
    for (const name of names) {
      const value = object(row.metricValues[metricHeaders.indexOf(name)]).value
      if (typeof value !== 'string' || !/^\d+$/.test(value))
        throw new Error('invalid_count')
      out[name] = value
    }
    for (const [name, key] of Object.entries(dimensions)) {
      const value = object(
        (row.dimensionValues as unknown[])[dimensionHeaders.indexOf(name)],
      ).value
      if (typeof value !== 'string' || value.length > 4096)
        throw new Error('invalid_dimension')
      if (key === 'date' && !/^\d{8}$/.test(value))
        throw new Error('invalid_date')
      out[key] = value === '(not set)' || value === '' ? null : value
    }
    return out
  })
  const meta = object(data.metadata)
  const limited =
    Number(data.rowCount ?? rows.length) > rows.length ||
    meta.subjectToThresholding === true ||
    meta.dataLossFromOtherRow === true ||
    (Array.isArray(meta.samplingMetadatas) && meta.samplingMetadatas.length > 0)
  return {
    status: limited ? 'partial' : rows.length ? 'ready' : 'empty',
    rows,
    ...(limited
      ? {
          message:
            'Relatório limitado por quota de linhas, agrupamento, amostragem ou limiar de privacidade do GA4.',
        }
      : {}),
  }
}

export async function collectDetails(
  request: (body: unknown) => Promise<unknown>,
  metadata: () => Promise<unknown>,
) {
  let metadataNames: Promise<unknown[]> | undefined
  const getNames = () =>
    (metadataNames ??= metadata().then((raw) => {
      const data = object(raw)
      if (!Array.isArray(data.dimensions)) throw new Error('invalid_metadata')
      return data.dimensions.map((d) => object(d).apiName)
    }))
  async function report(
    dimensions: Record<string, string>,
    names: string[],
    options: Record<string, unknown> = {},
  ): Promise<ReportSection> {
    try {
      return parseRows(
        await request({
          dateRanges: current,
          dimensions: Object.keys(dimensions).map((name) => ({ name })),
          metrics: names.map((name) => ({ name })),
          limit: 1000,
          ...options,
        }),
        dimensions,
        names,
      )
    } catch (error) {
      const status = object(object(error).response).status
      const message =
        status === 429
          ? 'Limite de consultas do GA4 atingido.'
          : status === 403
            ? 'Permissão insuficiente para este relatório.'
            : status === 400
              ? 'Dimensões ou métricas indisponíveis ou incompatíveis neste relatório.'
              : 'Não foi possível consultar este relatório do GA4.'
      return { status: 'unavailable', rows: [], message }
    }
  }
  async function ctas(): Promise<ReportSection & { dimension?: string }> {
    let names: unknown[]
    try {
      names = await getNames()
    } catch {
      return {
        status: 'unavailable',
        rows: [],
        message:
          'Não foi possível verificar as dimensões de CTA registradas no GA4.',
      }
    }
    const dimensions = [
      'customEvent:cta_name',
      'customEvent:cta_text',
      'customEvent:cta_id',
      'customEvent:cta',
      'customEvent:cta_location',
      'customEvent:button_name',
      'customEvent:button_text',
      'customEvent:button_id',
      'customEvent:link_text',
      'customEvent:link_id',
      'linkText',
      'linkId',
    ].filter((name) => names.includes(name))
    if (!dimensions.length)
      return {
        status: 'unavailable',
        rows: [],
        message:
          'Nenhuma dimensão reconhecida de CTA está registrada na propriedade. O evento sozinho não identifica o botão.',
      }
    const results = await Promise.all(
      dimensions.map(async (dimension) => ({
        ...(await report(
          { pagePath: 'page', [dimension]: 'cta' },
          ['eventCount'],
          {
            dimensionFilter: whatsapp,
            orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
          },
        )),
        dimension,
      })),
    )
    const result =
      results.find((result) => result.rows.some((row) => row.cta !== null)) ??
      results.find((result) => result.rows.length > 0) ??
      results[0]
    return {
      ...result,
      ...(result.rows.some((row) => row.cta === null)
        ? {
            status: 'partial' as const,
            message:
              'O GA4 retornou cliques sem identificar o CTA. Não é possível atribuir esses cliques a um botão específico.',
          }
        : {}),
    }
  }
  async function custom(
    parameter: 'service' | 'cta_location',
    event = 'whatsapp_click',
  ) {
    const dimension = `customEvent:${parameter}`
    let registered: boolean
    try {
      registered = (await getNames()).includes(dimension)
    } catch {
      return {
        status: 'unavailable' as const,
        rows: [],
        registered: null,
        identifiedValues: null,
        dimension,
        message:
          'Metadados indisponíveis: não foi possível verificar o registro da dimensão.',
      }
    }
    if (!registered)
      return {
        status: 'unavailable' as const,
        rows: [],
        registered: false,
        identifiedValues: null,
        dimension,
        message: `Dimensão ${parameter} não registrada no escopo de evento. A Data API não permite confirmar se o parâmetro está sendo enviado; verifique DebugView/Tempo real antes de concluir que há falha no tracking.`,
      }
    const result = await report({ [dimension]: parameter }, ['eventCount'], {
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          stringFilter: {
            matchType: 'EXACT',
            value: event,
            caseSensitive: true,
          },
        },
      },
    })
    const identifiedValues =
      result.status === 'unavailable'
        ? null
        : result.rows.some((row) => row[parameter] !== null)
    return {
      ...result,
      registered: true,
      identifiedValues,
      dimension,
      ...(result.rows.some((row) => row[parameter] === null)
        ? {
            status: 'partial' as const,
            message: `Há eventos sem ${parameter} identificado. Isso não comprova falha no tracking: confira coleta, data do registro e processamento do GA4.`,
          }
        : {}),
    }
  }
  const [
    previousMetrics,
    previousEvents,
    daily,
    dailyWhatsapp,
    sources,
    pages,
    cta,
    pageViews,
    sourceSessions,
    sourceWhatsapp,
    services,
    serviceSelections,
    ctaLocations,
  ] = await Promise.all([
    report({}, metrics, { dateRanges: previous }),
    report({ eventName: 'event' }, ['eventCount'], {
      dateRanges: previous,
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          inListFilter: {
            values: ['whatsapp_click', 'select_service', 'scroll_depth'],
            caseSensitive: true,
          },
        },
      },
    }),
    report({ date: 'date' }, metrics, {
      limit: 7,
      orderBys: [{ dimension: { dimensionName: 'date' } }],
    }),
    report({ date: 'date' }, ['eventCount'], {
      limit: 7,
      dimensionFilter: whatsapp,
      orderBys: [{ dimension: { dimensionName: 'date' } }],
    }),
    report({ sessionSourceMedium: 'source' }, ['sessions'], {
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    }),
    report({ pagePath: 'page' }, ['eventCount'], {
      dimensionFilter: whatsapp,
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
    }),
    ctas(),
    report({ pagePath: 'page' }, ['screenPageViews']),
    report({ sessionSource: 'source', sessionMedium: 'medium' }, ['sessions']),
    report(
      { sessionSource: 'source', sessionMedium: 'medium' },
      ['eventCount'],
      { dimensionFilter: whatsapp },
    ),
    custom('service'),
    custom('service', 'select_service'),
    custom('cta_location'),
  ])
  return {
    previousDateRange: previous[0],
    previousMetrics,
    previousEvents,
    daily,
    dailyWhatsapp,
    sources,
    pages,
    ctas: cta,
    pageViews,
    sourceSessions,
    sourceWhatsapp,
    services,
    serviceSelections,
    ctaLocations,
  }
}
