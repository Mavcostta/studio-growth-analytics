import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'node:http'
import { once } from 'node:events'
import {
  change,
  normalizeSnapshot,
  summarizeHistory,
} from '../server/history-model.js'
import { getHistory, historyStorage } from '../server/history.js'
import handler from '../api/history.js'
import { loadHistory } from '../src/hooks/useHistory.js'

test('frontend: StrictMode compartilha leitura em andamento e permite retry após falha', async (t) => {
  let calls = 0
  const source = {
    status: 'empty',
    points: [],
    comparison: null,
    message: 'Histórico sendo construído',
  }
  const mock = t.mock.method(globalThis, 'fetch', async (url: string) => {
    assert.equal(url, '/api/history')
    calls++
    return Response.json({ schemaVersion: 1, instagram: source, ga4: source })
  })
  const [a, b] = await Promise.all([loadHistory(), loadHistory()])
  assert.equal(calls, 1)
  assert.equal(a, b)
  mock.mock.mockImplementation(async () => new Response('', { status: 503 }))
  await assert.rejects(loadHistory(), /history_unavailable/)
  mock.mock.mockImplementation(async () => Response.json({ schemaVersion: 1 }))
  await assert.rejects(loadHistory(), /invalid_history/)
})

function fixture(
  source: 'instagram' | 'ga4',
  date = '2026-09-10',
  followers: number | null = 100,
) {
  const until = new Date(`${date}T00:00:00.000Z`)
  const since = new Date(+until - 86400000).toISOString()
  const days = Array.from({ length: 7 }, (_, i) =>
    new Date(+until - (7 - i) * 86400000)
      .toISOString()
      .slice(0, 10)
      .replaceAll('-', ''),
  )
  const measurement = (value: number | null) => ({
    value,
    status: value === null ? 'unavailable' : 'available',
  })
  const section = (rows: unknown[]) => ({ status: 'ready', rows })
  return {
    schemaVersion: 1,
    source,
    subjectId: '123',
    observedDate: date,
    collectedAt: `${date}T12:00:00.000Z`,
    timezone: 'UTC',
    secret: 'DO_NOT_RETURN',
    data:
      source === 'instagram'
        ? {
            status: 'partial',
            accountId: '123',
            followers: measurement(followers),
            period: { since, until: until.toISOString(), timezone: 'UTC' },
            metrics: {
              reach: measurement(30),
              views: measurement(0),
              profile_views: measurement(null),
              accounts_engaged: measurement(5),
              total_interactions: measurement(8),
              profile_links_taps: measurement(1),
            },
            followsAndUnfollows: {
              status: 'partial',
              follows: 4,
              unfollows: null,
            },
          }
        : {
            status: 'partial',
            propertyId: '123',
            dateRange: { startDate: '7daysAgo', endDate: 'yesterday' },
            days,
            timezone: 'America/Sao_Paulo',
            metrics: {
              activeUsers: '8',
              sessions: '10',
              screenPageViews: '20',
            },
            events: { whatsapp_click: '2' },
            details: {
              pageViews: section([
                { page: '/', screenPageViews: '10' },
                { page: '/empty', screenPageViews: '10' },
                { page: '/zero', screenPageViews: '0' },
              ]),
              pages: section([
                { page: '/', eventCount: '2' },
                { page: '/zero', eventCount: '0' },
              ]),
              sourceSessions: section([
                { source: 'google', medium: 'organic', sessions: '5' },
              ]),
              sourceWhatsapp: section([
                { source: 'google', medium: 'organic', eventCount: '2' },
              ]),
            },
          },
  }
}
const path = (source: string, date = '2026-09-10') =>
  `snapshots/${source}/123/${date}.json`
const point = (
  source: 'instagram' | 'ga4',
  date = '2026-09-10',
  followers?: number | null,
) => normalizeSnapshot(fixture(source, date, followers), path(source, date))!

test('normalização: allowlist, identificação, nulos, zero e taxas com denominadores pareados', () => {
  const ig = point('instagram')
  assert.equal(ig.metrics.followers_count, 100)
  assert.equal(ig.metrics.views, 0)
  assert.equal(ig.metrics.profile_views, null)
  assert.equal(ig.metrics.follows, 4)
  assert.equal(ig.metrics.unfollows, null)
  assert.ok(!JSON.stringify(ig).includes('DO_NOT_RETURN'))
  assert.equal(
    normalizeSnapshot(
      fixture('instagram'),
      'snapshots/instagram/456/2026-09-10.json',
    ),
    null,
  )
  assert.equal(normalizeSnapshot(fixture('instagram'), '../escape'), null)
  const ga = point('ga4')
  assert.equal(ga.pages[0].rate, 20)
  assert.equal(ga.pages[1].clicks, null)
  assert.equal(ga.pages[1].rate, null)
  assert.equal(ga.pages[2].clicks, 0)
  assert.equal(ga.pages[2].rate, null)
  assert.equal(ga.sources[0].rate, 40)
  const partial = fixture('ga4')
  partial.data.details!.pages.status = 'partial'
  assert.equal(normalizeSnapshot(partial, path('ga4'))!.pages[0].rate, null)
  const absent = fixture('ga4')
  absent.data.days = ['20260909']
  assert.equal(normalizeSnapshot(absent, path('ga4'))!.metrics.sessions, null)
})

test('tendências: uma coleta, saldo vs fluxos, base zero, ausência e leitura parcial', () => {
  const before = point('instagram', '2026-09-08', 100),
    after = point('instagram', '2026-09-10', 90)
  assert.equal(
    summarizeHistory('instagram', []).message,
    'Histórico sendo construído',
  )
  assert.equal(summarizeHistory('instagram', [after]).comparison, null)
  const comparison = summarizeHistory('instagram', [after, before]).comparison!
  assert.deepEqual(comparison.changes.followers_count, {
    difference: -10,
    percent: -10,
    direction: 'decrease',
  })
  assert.equal(comparison.previous, before.collectedAt)
  assert.equal(comparison.changes.unfollows.difference, null)
  assert.equal(
    summarizeHistory('instagram', [before, after], true).comparison,
    null,
  )
  assert.equal(change(10, 0).percent, null)
  assert.equal(change(10, 0).direction, 'increase')
  assert.equal(change(0, 0).direction, 'stable')
  assert.equal(change(null, 5).difference, null)
  assert.equal(
    summarizeHistory('instagram', [
      before,
      point('instagram', '2026-09-10', null),
    ]).comparison!.changes.followers_count.direction,
    null,
  )
})

test('GA4: nunca soma usuários ou janelas sobrepostas; exige semana anterior armazenada e mesmo fuso', () => {
  const current = point('ga4', '2026-09-10'),
    yesterday = point('ga4', '2026-09-09'),
    previous = point('ga4', '2026-09-03')
  assert.equal(summarizeHistory('ga4', [yesterday, current]).comparison, null)
  const summary = summarizeHistory('ga4', [current, previous, yesterday])
  assert.equal(summary.comparison!.previous, previous.collectedAt)
  assert.equal(summary.comparison!.changes.activeUsers.direction, 'stable')
  assert.equal(summary.points.at(-1)!.metrics.activeUsers, 8)
  assert.equal(summary.points[0].pages.length, 0)
  previous.period!.timezone = 'UTC'
  assert.equal(summarizeHistory('ga4', [previous, current]).comparison, null)
})

test('Blob privado: paginação, leitura por pathname, fontes isoladas, erros e conta ambígua', async (t) => {
  const token = process.env.BLOB_READ_WRITE_TOKEN,
    property = process.env.GA4_PROPERTY_ID
  process.env.BLOB_READ_WRITE_TOKEN = 'TEST_ONLY_TOKEN'
  process.env.GA4_PROPERTY_ID = '123'
  let failGA = false,
    ambiguous = false,
    corrupt = false
  const cursors: (string | undefined)[] = []
  t.mock.method(
    historyStorage,
    'list',
    async (options: { prefix: string; cursor?: string }) => {
      const source = options.prefix.includes('ga4') ? 'ga4' : 'instagram'
      if (failGA && source === 'ga4') throw new Error('TEST_ONLY_TOKEN')
      cursors.push(options.cursor)
      if (ambiguous && source === 'instagram')
        return {
          blobs: [
            { pathname: path(source) },
            { pathname: path(source).replace('/123/', '/456/') },
          ],
          hasMore: false,
        }
      return {
        blobs: [
          {
            pathname: path(
              source,
              options.cursor ? '2026-09-10' : '2026-09-09',
            ),
          },
          { pathname: 'https://evil.invalid/credentials' },
        ],
        hasMore: !options.cursor,
        cursor: options.cursor ? undefined : 'next',
      }
    },
  )
  t.mock.method(
    historyStorage,
    'get',
    async (pathname: string, options: { access: string }) => {
      assert.equal(options.access, 'private')
      assert.match(pathname, /^snapshots\/(instagram|ga4)\/123\//)
      if (corrupt && pathname.includes('2026-09-10')) return null
      const [, source, , filename] = pathname.split('/')
      return {
        statusCode: 200,
        stream: new Response(
          JSON.stringify(
            fixture(source as 'instagram' | 'ga4', filename.slice(0, 10)),
          ),
        ).body!,
      }
    },
  )
  try {
    const result = await getHistory(),
      report = JSON.parse(result.body)
    assert.equal(result.httpStatus, 200)
    assert.equal(report.instagram.points.length, 2)
    assert.ok(report.instagram.comparison)
    assert.equal(report.ga4.comparison, null)
    assert.ok(cursors.includes('next'))
    assert.ok(!result.body.includes('TEST_ONLY_TOKEN'))
    assert.ok(!result.body.includes('DO_NOT_RETURN'))
    corrupt = true
    const partial = JSON.parse((await getHistory()).body)
    assert.equal(partial.instagram.status, 'partial')
    assert.equal(partial.instagram.comparison, null)
    failGA = true
    assert.equal(
      JSON.parse((await getHistory()).body).ga4.status,
      'unavailable',
    )
    ambiguous = true
    assert.equal((await getHistory()).httpStatus, 503)
  } finally {
    if (token === undefined) delete process.env.BLOB_READ_WRITE_TOKEN
    else process.env.BLOB_READ_WRITE_TOKEN = token
    if (property === undefined) delete process.env.GA4_PROPERTY_ID
    else process.env.GA4_PROPERTY_ID = property
  }
})

test('endpoint: sem configuração não faz fallback; somente GET e mesma origem', async () => {
  const old = Object.fromEntries(
    ['BLOB_READ_WRITE_TOKEN', 'BLOB_STORE_ID', 'VERCEL_OIDC_TOKEN'].map((k) => [
      k,
      process.env[k],
    ]),
  )
  for (const key of Object.keys(old)) delete process.env[key]
  const server = createServer(handler).listen(0, '127.0.0.1')
  await once(server, 'listening')
  try {
    const address = server.address()
    assert.ok(address && typeof address === 'object')
    const url = `http://127.0.0.1:${address.port}/api/history`
    assert.equal((await fetch(url)).status, 503)
    assert.equal((await fetch(url, { method: 'POST' })).status, 405)
    assert.equal(
      (await fetch(url, { headers: { Origin: 'https://evil.invalid' } }))
        .status,
      403,
    )
  } finally {
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
    for (const [key, value] of Object.entries(old)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})
