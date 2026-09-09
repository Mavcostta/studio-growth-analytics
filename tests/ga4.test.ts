import assert from 'node:assert/strict'
import { buildSiteInsights } from '../src/utils/siteInsights.js'
import type { GA4Report } from '../src/services/analytics/ga4.js'

test('granularidade: denominadores sem filtro, parâmetros registrados e metadados compartilhados', async () => {
  let metadataCalls = 0
  const calls: {
    dimensions: { name: string }[]
    metrics: { name: string }[]
    dimensionFilter?: unknown
  }[] = []
  const result = await collectDetails(
    async (body) => {
      const r = body as (typeof calls)[number]
      calls.push(r)
      return {
        dimensionHeaders: r.dimensions.map((d) => ({ name: d.name })),
        metricHeaders: r.metrics.map((m) => ({ name: m.name })),
        rows: [
          {
            dimensionValues: r.dimensions.map((d) => ({
              value:
                d.name === 'date'
                  ? '20260907'
                  : d.name === 'customEvent:service'
                    ? 'extensao_cilios'
                    : d.name === 'customEvent:cta_location'
                      ? '(not set)'
                      : '/pagina',
            })),
            metricValues: r.metrics.map(() => ({ value: '0' })),
          },
        ],
      }
    },
    async () => {
      metadataCalls++
      return {
        dimensions: [
          { apiName: 'customEvent:service' },
          { apiName: 'customEvent:cta_location' },
        ],
      }
    },
  )
  assert.equal(metadataCalls, 1)
  assert.equal(result.services.registered, true)
  assert.equal(result.services.identifiedValues, true)
  assert.equal(result.services.rows[0].service, 'extensao_cilios')
  assert.equal(result.ctaLocations.registered, true)
  assert.equal(result.ctaLocations.identifiedValues, false)
  assert.equal(result.ctaLocations.rows[0].cta_location, null)
  assert.equal(result.ctaLocations.status, 'partial')
  const pages = calls.find(
    (r) =>
      r.dimensions.some((d) => d.name === 'pagePath') &&
      r.metrics.some((m) => m.name === 'screenPageViews'),
  )!
  assert.equal(pages.dimensionFilter, undefined)
  const origins = calls.filter((r) =>
    r.dimensions.some((d) => d.name === 'sessionSource'),
  )
  assert.equal(origins.length, 2)
  assert.ok(
    origins.every((r) => r.dimensions.some((d) => d.name === 'sessionMedium')),
  )
  assert.equal(
    origins.find((r) => r.metrics[0].name === 'sessions')!.dimensionFilter,
    undefined,
  )
  assert.deepEqual(
    origins.find((r) => r.metrics[0].name === 'eventCount')!.dimensionFilter,
    {
      filter: {
        fieldName: 'eventName',
        stringFilter: {
          matchType: 'EXACT',
          value: 'whatsapp_click',
          caseSensitive: true,
        },
      },
    },
  )
  const absent = await collectDetails(
    async () => ({ kind: 'analyticsData#runReport' }),
    async () => ({ dimensions: [] }),
  )
  assert.equal(absent.services.registered, false)
  assert.equal(absent.ctaLocations.identifiedValues, null)
  const failed = await collectDetails(
    async () => ({ kind: 'analyticsData#runReport' }),
    async () => {
      throw new Error('PRIVATE')
    },
  )
  assert.equal(failed.services.registered, null)
  assert.ok(!JSON.stringify(failed).includes('PRIVATE'))
  const parsed = parseGA4({
    status: 'partial',
    dateRange: { startDate: '7daysAgo', endDate: 'yesterday' },
    metrics: {
      activeUsers: '0',
      sessions: '0',
      screenPageViews: '0',
      eventCount: '0',
    },
    events: { whatsapp_click: '0', select_service: '0', scroll_depth: '0' },
    details: result,
  })
  assert.equal(parsed.details!.pageViews.rows[0].screenPageViews, '0')
  assert.equal(parsed.details!.sourceWhatsapp.rows[0].eventCount, '0')
  assert.equal(parsed.details!.services.registered, true)
  assert.equal(parsed.details!.ctaLocations.rows[0].cta_location, null)
})

test('Site Insights: taxas honestas, amostra, ausência, zero e pendências', () => {
  const data: GA4Report = {
    status: 'partial',
    metrics: {
      activeUsers: '3',
      sessions: '3',
      screenPageViews: '13',
      eventCount: '50',
    },
    events: { whatsapp_click: '3', select_service: '2', scroll_depth: '10' },
  }
  const cards = buildSiteInsights(data)
  assert.equal(cards.length, 4)
  assert.match(cards[0].description, /23,1%/)
  assert.match(cards[0].description, /Amostra pequena/)
  assert.match(cards[0].description, /não agendamento/)
  assert.match(cards[1].description, /faltam os cliques/)
  assert.match(cards[2].description, /Ausência nessa lista não significa zero/)
  assert.match(cards[3].description, /dimensão service não está disponível/)
  assert.match(cards[3].description, /cta_location não está disponível/)
  data.events.whatsapp_click = null
  assert.match(
    buildSiteInsights(data)[0].description,
    /taxa geral está indisponível/,
  )
  data.events.whatsapp_click = '0'
  assert.match(buildSiteInsights(data)[0].description, /0%/)
  data.metrics.screenPageViews = '0'
  assert.match(
    buildSiteInsights(data)[0].description,
    /taxa geral está indisponível/,
  )
  data.metrics.screenPageViews = null
  data.events.whatsapp_click = '6'
  assert.match(buildSiteInsights(data)[0].description, /200%.*sessões/)
  data.metrics.sessions = null
  assert.match(
    buildSiteInsights(data)[0].description,
    /taxa geral está indisponível/,
  )
  data.metrics.screenPageViews = '30'
  assert.doesNotMatch(buildSiteInsights(data)[0].description, /Amostra pequena/)
  data.events.whatsapp_click = '9007199254740993'
  assert.match(
    buildSiteInsights(data)[0].description,
    /taxa geral está indisponível/,
  )
})
import test from 'node:test'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { GoogleAuth } from 'google-auth-library'
import { testAnalytics } from '../server/integrations/analytics/index.js'
import { createDevServer } from '../server/app.js'
import { loadGA4, parseGA4, ga4Number } from '../src/services/analytics/ga4.js'
import { ga4Daily, ga4Comparison } from '../src/services/analytics/ga4.js'
import {
  collectDetails,
  parseRows,
} from '../server/integrations/analytics/details.js'

test('GA4 expandido: períodos, filtros, vazios, CTA alternativo e falhas isoladas', async () => {
  const requests: Record<string, unknown>[] = []
  const report = (
    dimensions: string[],
    metrics: string[],
    values: string[],
    counts: string[],
  ) => ({
    dimensionHeaders: dimensions.map((name) => ({ name })),
    metricHeaders: metrics.map((name) => ({ name })),
    rows: [
      {
        dimensionValues: values.map((value) => ({ value })),
        metricValues: counts.map((value) => ({ value })),
      },
    ],
  })
  const details = await collectDetails(
    async (body) => {
      const request = body as {
        dimensions: { name: string }[]
        metrics: { name: string }[]
        dateRanges: { startDate: string; endDate: string }[]
        dimensionFilter?: unknown
      }
      requests.push(request)
      const dims = request.dimensions.map((d) => d.name)
      const metrics = request.metrics.map((m) => m.name)
      if (request.dateRanges[0].startDate === '14daysAgo') {
        assert.equal(request.dateRanges[0].endDate, '8daysAgo')
        return { kind: 'analyticsData#runReport', metadata: {} }
      }
      assert.deepEqual(request.dateRanges, [
        { startDate: '7daysAgo', endDate: 'yesterday' },
      ])
      if (dims.includes('sessionSourceMedium'))
        throw { response: { status: 403 }, secret: 'PRIVATE' }
      if (
        (dims.includes('pagePath') && metrics.includes('eventCount')) ||
        (dims.includes('date') && metrics.length === 1)
      )
        assert.deepEqual(request.dimensionFilter, {
          filter: {
            fieldName: 'eventName',
            stringFilter: {
              matchType: 'EXACT',
              value: 'whatsapp_click',
              caseSensitive: true,
            },
          },
        })
      return report(
        dims,
        metrics,
        dims.map((dim) =>
          dim === 'date'
            ? '20260907'
            : dim === 'linkText'
              ? '(not set)'
              : dim === 'linkId'
                ? 'header-whatsapp'
                : '/servicos',
        ),
        metrics.map(() => '0'),
      )
    },
    async () => ({
      dimensions: [{ apiName: 'linkText' }, { apiName: 'linkId' }],
    }),
  )
  assert.equal(details.previousMetrics.status, 'empty')
  assert.equal(details.previousEvents.status, 'empty')
  assert.equal(details.sources.status, 'unavailable')
  assert.equal(details.pages.rows[0].eventCount, '0')
  assert.equal(details.ctas.dimension, 'linkId')
  assert.equal(details.ctas.rows[0].cta, 'header-whatsapp')
  assert.ok(!JSON.stringify(details).includes('PRIVATE'))
  assert.equal(requests.length, 11)
  const unknown = await collectDetails(
    async (body) => {
      const r = body as {
        dimensions: { name: string }[]
        metrics: { name: string }[]
      }
      return report(
        r.dimensions.map((d) => d.name),
        r.metrics.map((m) => m.name),
        r.dimensions.map((d) => (d.name === 'date' ? '20260907' : '(not set)')),
        r.metrics.map(() => '1'),
      )
    },
    async () => ({ dimensions: [{ apiName: 'linkText' }] }),
  )
  assert.equal(unknown.ctas.status, 'partial')
  assert.equal(unknown.ctas.rows[0].cta, null)
  const noCTA = await collectDetails(
    async () => ({ kind: 'analyticsData#runReport' }),
    async () => ({ dimensions: [] }),
  )
  assert.equal(noCTA.ctas.status, 'unavailable')
  const limited = parseRows(
    {
      ...report(['date'], ['eventCount'], ['20260907'], ['9007199254740993']),
      rowCount: 2,
    },
    { date: 'date' },
    ['eventCount'],
  )
  assert.equal(limited.status, 'partial')
  assert.equal(limited.rows[0].eventCount, '9007199254740993')
  assert.throws(() => parseRows({ rows: [{}] }, {}, ['eventCount']))
  assert.throws(() => parseRows(null, {}, ['eventCount']))
  assert.equal(ga4Comparison('0', '5'), -100)
  assert.equal(ga4Comparison('3', '2'), 50)
  for (const value of ['0', null, undefined])
    assert.equal(ga4Comparison('3', value), null)
  assert.equal(ga4Comparison('9007199254740993', '2'), null)
  const parsed = parseGA4({
    status: 'partial',
    dateRange: { startDate: '7daysAgo', endDate: 'yesterday' },
    metrics: {
      activeUsers: '0',
      sessions: '0',
      screenPageViews: '0',
      eventCount: '0',
    },
    events: { whatsapp_click: '0', select_service: null, scroll_depth: null },
    details,
    days: [
      '20260901',
      '20260902',
      '20260903',
      '20260904',
      '20260905',
      '20260906',
      '20260907',
    ],
  })
  const days = ga4Daily(parsed)
  assert.equal(days.length, 7)
  assert.equal(days[0].sessions, null)
  assert.equal(days[6].sessions, '0')
  assert.equal(days[6].whatsapp_click, '0')
})

test('GA4 frontend: contrato, zero, null, precisão, deduplicação e falhas', async (context) => {
  const payload = {
    status: 'partial',
    dateRange: { startDate: '7daysAgo', endDate: 'yesterday' },
    metrics: {
      activeUsers: '0',
      sessions: '3',
      screenPageViews: '13',
      eventCount: '9007199254740993',
    },
    events: { whatsapp_click: null, select_service: '2', scroll_depth: '10' },
    secret: 'PRIVATE',
  }
  assert.equal(parseGA4(payload).metrics.activeUsers, '0')
  assert.equal(parseGA4(payload).events.whatsapp_click, null)
  assert.ok(!JSON.stringify(parseGA4(payload)).includes('PRIVATE'))
  assert.equal(ga4Number('9007199254740993'), '9.007.199.254.740.993')
  assert.equal(ga4Number(null), 'Sem dados')
  assert.throws(() => parseGA4({ ...payload, metrics: {} }))
  assert.throws(() => parseGA4({ ...payload, dateRange: {} }))
  let calls = 0
  const mock = context.mock.method(globalThis, 'fetch', async (url: string) => {
    assert.equal(url, '/api/dev/analytics/test')
    calls++
    return Response.json(payload)
  })
  const [a, b] = await Promise.all([loadGA4(), loadGA4()])
  assert.equal(a, b)
  assert.equal(calls, 1)
  for (const status of [401, 403, 429, 500, 503]) {
    mock.mock.mockImplementation(async () => new Response('', { status }))
    await assert.rejects(loadGA4(), /GA4/)
  }
  mock.mock.mockImplementation(async () => {
    throw new Error('PRIVATE')
  })
  await assert.rejects(loadGA4(), /GA4 indisponível/)
})

test('GA4: configuração, relatórios reais sem fallback, precisão e erros sanitizados', async (context) => {
  const previousId = process.env.GA4_PROPERTY_ID
  const previousKey = process.env.GOOGLE_APPLICATION_CREDENTIALS
  const folder = await mkdtemp(join(tmpdir(), 'studio-ga4-test-'))
  const calls: Record<string, unknown>[] = []
  let responses: unknown[] = []
  let apiError: unknown
  let credentialError = false
  context.mock.method(GoogleAuth.prototype, 'getClient', async () => ({
    getAccessToken: async () => {
      if (credentialError) throw new Error('PRIVATE_TEST_SECRET')
      return { token: 'PRIVATE_TEST_SECRET' }
    },
    request: async (options: Record<string, unknown>) => {
      calls.push(options)
      if (apiError) throw apiError
      if (!responses.length)
        return {
          data:
            options.method === 'GET'
              ? { dimensions: [] }
              : { kind: 'analyticsData#runReport', metadata: {} },
        }
      return { data: responses.shift() }
    },
  }))
  const totals = {
    metricHeaders: [
      'activeUsers',
      'sessions',
      'screenPageViews',
      'eventCount',
    ].map((name) => ({ name })),
    rows: [
      {
        metricValues: ['5', '7', '0', '9007199254740993'].map((value) => ({
          value,
        })),
      },
    ],
    secret: 'PRIVATE_TEST_SECRET',
  }
  const events = {
    dimensionHeaders: [{ name: 'eventName' }],
    metricHeaders: [{ name: 'eventCount' }],
    rows: [
      {
        dimensionValues: [{ value: 'whatsapp_click' }],
        metricValues: [{ value: '0' }],
      },
    ],
  }
  try {
    delete process.env.GA4_PROPERTY_ID
    assert.equal((await testAnalytics()).httpStatus, 503)
    process.env.GA4_PROPERTY_ID = 'G-EMDNPLS1H3'
    assert.equal((await testAnalytics()).httpStatus, 503)
    process.env.GA4_PROPERTY_ID = '123456'
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS
    assert.equal(
      JSON.parse((await testAnalytics()).body).error.kind,
      'credential_configuration',
    )
    process.env.GOOGLE_APPLICATION_CREDENTIALS = join(folder, 'key.json')
    await writeFile(process.env.GOOGLE_APPLICATION_CREDENTIALS, '{}')
    assert.equal((await testAnalytics()).httpStatus, 503)
    assert.equal(calls.length, 0)
    await writeFile(
      process.env.GOOGLE_APPLICATION_CREDENTIALS,
      JSON.stringify({
        type: 'service_account',
        client_email: 'test@example.invalid',
        private_key: 'PRIVATE_TEST_SECRET',
      }),
    )
    responses = [totals, events]
    const result = await testAnalytics()
    assert.equal(result.httpStatus, 200)
    assert.ok(!result.body.includes('PRIVATE_TEST_SECRET'))
    const report = JSON.parse(result.body)
    assert.equal(report.status, 'partial')
    assert.equal(report.metrics.eventCount, '9007199254740993')
    assert.equal(report.metrics.screenPageViews, '0')
    assert.deepEqual(report.events, {
      whatsapp_click: '0',
      select_service: null,
      scroll_depth: null,
    })
    assert.equal(calls.length, 12)
    assert.equal(
      calls[0].url,
      'https://analyticsdata.googleapis.com/v1beta/properties/123456:runReport',
    )
    assert.equal(calls[0].method, 'POST')
    assert.equal(calls[0].retry, false)
    assert.deepEqual(calls[1].data, {
      dateRanges: [{ startDate: '7daysAgo', endDate: 'yesterday' }],
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          inListFilter: {
            values: ['whatsapp_click', 'select_service', 'scroll_depth'],
            caseSensitive: true,
          },
        },
      },
      limit: 3,
    })
    responses = [{}, {}]
    const empty = JSON.parse((await testAnalytics()).body)
    assert.equal(empty.status, 'empty')
    assert.ok(Object.values(empty.metrics).every((value) => value === null))
    responses = [
      totals,
      {
        ...events,
        rows: ['whatsapp_click', 'select_service', 'scroll_depth'].map(
          (value) => ({
            dimensionValues: [{ value }],
            metricValues: [{ value: '1' }],
          }),
        ),
      },
    ]
    assert.equal(JSON.parse((await testAnalytics()).body).status, 'partial')
    responses = [{ rows: [{}] }]
    assert.equal((await testAnalytics()).httpStatus, 502)
    for (const [status, expected, kind] of [
      [401, 401, 'credential_error'],
      [403, 403, 'permission_denied'],
      [404, 404, 'property_not_found'],
      [429, 429, 'rate_limit'],
      [400, 502, 'api_error'],
      [500, 502, 'api_error'],
    ] as const) {
      apiError = {
        response: { status, data: { secret: 'PRIVATE_TEST_SECRET' } },
      }
      const error = await testAnalytics()
      assert.equal(error.httpStatus, expected)
      assert.equal(JSON.parse(error.body).error.kind, kind)
      assert.ok(!error.body.includes('PRIVATE_TEST_SECRET'))
    }
    credentialError = true
    assert.equal((await testAnalytics()).httpStatus, 401)
  } finally {
    if (previousId === undefined) delete process.env.GA4_PROPERTY_ID
    else process.env.GA4_PROPERTY_ID = previousId
    if (previousKey === undefined)
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS
    else process.env.GOOGLE_APPLICATION_CREDENTIALS = previousKey
    await rm(folder, { recursive: true, force: true })
  }
})

test('GA4: rota de desenvolvimento local e GET', async () => {
  const previous = process.env.GA4_PROPERTY_ID
  delete process.env.GA4_PROPERTY_ID
  try {
    for (const enabled of [false, true]) {
      const server = createDevServer(enabled)
      server.listen(0, '127.0.0.1')
      await once(server, 'listening')
      const address = server.address()
      assert.ok(address && typeof address === 'object')
      const url = `http://127.0.0.1:${address.port}/api/dev/analytics/test`
      try {
        assert.equal((await fetch(url)).status, enabled ? 503 : 404)
        if (enabled) {
          assert.equal((await fetch(url, { method: 'POST' })).status, 405)
          assert.equal(
            (await fetch(url, { headers: { Origin: 'https://example.com' } }))
              .status,
            403,
          )
          assert.equal((await fetch(`${url}?anything=1`)).status, 404)
        }
      } finally {
        server.closeAllConnections()
        await new Promise<void>((resolve) => server.close(() => resolve()))
      }
    }
  } finally {
    if (previous === undefined) delete process.env.GA4_PROPERTY_ID
    else process.env.GA4_PROPERTY_ID = previous
  }
})
