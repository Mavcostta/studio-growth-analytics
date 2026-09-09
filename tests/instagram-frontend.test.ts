import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildInstagramInsights,
  derived,
  dimensionLabel,
  divide,
  evaluateDimensions,
  evidence,
  groups,
  highlights,
  percentile,
  statistic,
  summarize,
} from '../src/utils/instagram.js'
import {
  loadInstagramPosts,
  parseInstagramResponse,
} from '../src/services/instagram/client.js'
import type { InstagramPostAnalytics } from '../src/types/instagram.js'

const makePost = (
  id: number,
  reach: number | null = 100,
): InstagramPostAnalytics => ({
  id: String(id),
  contentType: 'reel',
  publishedAt: '2026-09-06T01:00:00+0000',
  publishedDate: '2026-09-05',
  publishedHour: 22,
  dayOfWeek: 6,
  metrics: {
    reach,
    views: reach,
    likes: 4,
    comments: 2,
    saved: 0,
    shares: 1,
    totalInteractions: 10,
  },
})
const payload = (posts: InstagramPostAnalytics[]) => ({
  status: 'ok',
  timezone: 'America/Sao_Paulo',
  collectedAt: '2026-09-06T17:00:00Z',
  account: { username: 'test' },
  posts,
})

test('proporções, cobertura, estatísticas, percentis e dimensões independentes', () => {
  assert.equal(divide(0, 100), 0)
  for (const denominator of [0, null, undefined])
    assert.equal(divide(3, denominator), null)
  assert.equal(divide(null, 100), null)
  assert.equal(derived(makePost(1)).interactionRate, 0.1)
  assert.equal(derived(makePost(1, 0)).saveRate, null)
  assert.deepEqual(statistic([null]), {
    n: 0,
    sum: null,
    mean: null,
    median: null,
    divergent: false,
  })
  assert.equal(statistic([0, null]).mean, 0)
  assert.equal(statistic([1, 2, 3, 100]).median, 2.5)
  assert.equal(statistic([1, 2, 3, 100]).divergent, true)
  assert.equal(percentile(0, [0, 0, 0]), 50)
  assert.equal(dimensionLabel(50).label, 'Médio')
  assert.equal(percentile(1, [1, 2]), null)
  const posts = [makePost(1, 10), makePost(2, 100), makePost(3, 1000)]
  const evaluated = evaluateDimensions(posts)
  assert.equal(evaluated.get('3')!.discovery, 100)
  assert.equal(evaluated.get('3')!.engagement, 0)
  assert.equal(evaluated.get('1')!.engagement, 100)
  const summary = summarize([
    makePost(1, 0),
    makePost(2, null),
    makePost(3, 100),
  ])
  assert.equal(summary.metrics.reach.mean, 50)
  assert.equal(summary.metrics.reach.n, 2)
  assert.equal(summary.rateSample, 1)
  assert.equal(summary.globalInteractionRate, 0.1)
  const winners = highlights(posts)
  assert.equal(winners.filter((w) => w.post.id === '3').length, 1)
  assert.ok(
    winners
      .find((w) => w.post.id === '3')!
      .achievements.includes('Mais visualizações'),
  )
  assert.ok(
    !highlights([makePost(1), makePost(2), makePost(3)]).some((w) =>
      w.achievements.includes('Mais salvo'),
    ),
  )
})

test('amostra mínima e outlier impedem hipótese; formatos sem inventar assuntos', () => {
  const posts = [
    makePost(1, 10),
    makePost(2, 10),
    makePost(3, 10000),
    ...[4, 5, 6].map((id) => ({
      ...makePost(id, 100),
      contentType: 'carousel' as const,
    })),
    { ...makePost(7, 99999), contentType: 'image' as const },
  ]
  const byFormat = groups(posts, 'format')
  const observation = evidence(byFormat, (g) => g.metrics.reach)!
  assert.equal(observation.best.key, 'reel')
  assert.equal(observation.stable, false)
  const insights = buildInstagramInsights(posts)
  assert.equal(insights.length, 4)
  assert.equal(
    insights.find((i) => i.id === 'discovery')!.hypothesis,
    undefined,
  )
  assert.match(insights.find((i) => i.id === 'unknown')!.finding, /Imagens: 1/)
  assert.ok(!JSON.stringify(insights).includes('bastidores'))
  assert.equal(
    evidence(
      groups([makePost(1), makePost(2)], 'hour'),
      (g) => g.interactionRate,
    ),
    null,
  )
})

test('contrato HTTP mantém null/zero e exclui campos/URLs inseguros', () => {
  const raw = {
    ...makePost(1),
    access_token: 'private',
    thumbnailUrl: 'https://evil.test/a',
    permalink: 'javascript:alert(1)',
    metrics: { ...makePost(1).metrics, views: null },
  }
  const result = parseInstagramResponse(payload([raw]))
  assert.equal(result.posts[0].metrics.saved, 0)
  assert.equal(result.posts[0].metrics.views, null)
  assert.equal(result.posts[0].thumbnailUrl, undefined)
  assert.ok(!JSON.stringify(result).includes('private'))
  assert.equal(parseInstagramResponse(payload([])).posts.length, 0)
  assert.throws(() =>
    parseInstagramResponse(payload([makePost(1), makePost(1)])),
  )
  assert.throws(() => parseInstagramResponse({ status: 'error' }))
  assert.throws(() =>
    parseInstagramResponse(
      payload([
        { ...makePost(1), metrics: { ...makePost(1).metrics, views: -1 } },
      ]),
    ),
  )
})

test('service compartilha requisições em andamento e permite retry sem fallback mock', async (context) => {
  let calls = 0
  context.mock.method(globalThis, 'fetch', async (url: string) => {
    assert.equal(url, '/api/dev/instagram/posts')
    calls++
    return Response.json(payload([makePost(1)]))
  })
  const [a, b] = await Promise.all([loadInstagramPosts(), loadInstagramPosts()])
  assert.equal(calls, 1)
  assert.equal(a, b)
  context.mock.method(
    globalThis,
    'fetch',
    async () => new Response('', { status: 503 }),
  )
  await assert.rejects(loadInstagramPosts(), /Backend indisponível/)
  context.mock.method(globalThis, 'fetch', async () =>
    Response.json(
      { error: { kind: 'missing_token', message: 'PRIVATE' } },
      { status: 503 },
    ),
  )
  await assert.rejects(
    loadInstagramPosts(),
    (error) =>
      error instanceof Error &&
      error.message.includes('INSTAGRAM_ACCESS_TOKEN') &&
      !error.message.includes('PRIVATE'),
  )
  context.mock.method(
    globalThis,
    'fetch',
    async () => new Response('<html>not found</html>', { status: 404 }),
  )
  await assert.rejects(loadInstagramPosts(), /rota.*não foi encontrada/)
  context.mock.method(globalThis, 'fetch', async () => {
    throw new Error('network')
  })
  await assert.rejects(loadInstagramPosts(), /Backend indisponível/)
  context.mock.method(globalThis, 'fetch', async () =>
    Response.json(payload([])),
  )
  assert.equal((await loadInstagramPosts()).posts.length, 0)
})
