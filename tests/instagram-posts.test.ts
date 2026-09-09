import assert from 'node:assert/strict'
import test from 'node:test'
import {
  contentType,
  getInstagramPosts,
  normalizePost,
  safeMediaUrl,
} from '../server/integrations/instagram/posts.js'
import { metricNames } from '../server/integrations/instagram/types.js'
import { summarizePosts } from '../server/integrations/instagram/summary.js'

test('normalização, timezone explícito, opcionais, URLs e resumo sem inferências', () => {
  assert.equal(contentType('VIDEO', 'REELS'), 'reel')
  assert.equal(contentType('VIDEO', 'FEED'), 'video')
  assert.equal(contentType('IMAGE', 'FEED'), 'image')
  assert.equal(contentType('CAROUSEL_ALBUM', 'FEED'), 'carousel')
  assert.equal(contentType('OTHER', undefined), 'unknown')
  const post = normalizePost({
    id: '1',
    timestamp: '2026-09-06T01:28:06+0000',
    media_type: 'VIDEO',
    media_product_type: 'REELS',
  })!
  assert.equal(post.publishedAt, '2026-09-06T01:28:06+0000')
  assert.equal(post.publishedDate, '2026-09-05')
  assert.equal(post.publishedHour, 22)
  assert.equal(post.dayOfWeek, 6)
  assert.equal(
    normalizePost({ id: '2', timestamp: '2026-01-01T01:00:00Z' })!
      .publishedDate,
    '2025-12-31',
  )
  assert.equal(
    normalizePost({ id: '2', timestamp: 'bad' })!.publishedDate,
    null,
  )
  assert.equal(
    normalizePost({ id: '2', timestamp: '2026-09-01T12:00:00' })!.publishedDate,
    null,
  )
  assert.equal(post.caption, undefined)
  assert.equal(
    normalizePost({ id: '2', timestamp: '2026-02-30T12:00:00Z' })!
      .publishedDate,
    null,
  )
  assert.equal(post.metrics.views, null)
  assert.equal(post.metricStatus.views, 'not_tested')
  assert.equal(normalizePost({ id: '../bad' }), null)
  assert.equal(safeMediaUrl('http://cdninstagram.com/a'), undefined)
  assert.equal(safeMediaUrl('https://cdninstagram.com.evil.test/a'), undefined)
  assert.equal(safeMediaUrl('https://u:p@cdninstagram.com/a'), undefined)
  assert.equal(
    safeMediaUrl('https://cdninstagram.com/a?access_token=secret'),
    undefined,
  )
  assert.equal(
    safeMediaUrl('https://www.instagram.com/p/abc/?utm_source=test', true),
    'https://www.instagram.com/p/abc/',
  )
  assert.equal(
    safeMediaUrl(
      'https://scontent.cdninstagram.com/a.jpg?oh=public-cdn-expiry',
    ),
    'https://scontent.cdninstagram.com/a.jpg?oh=public-cdn-expiry',
  )
  post.metrics.reach = 0
  post.metricStatus.reach = 'available'
  const second = { ...post, id: '2' }
  const summary = summarizePosts([post, second])
  assert.equal(summary.leaders.reach?.value, 0)
  assert.equal(summary.leaders.reach?.posts.length, 2)
  assert.equal(summary.leaders.views, null)
  assert.equal(summary.byDayOfWeek[6], 2)
  assert.equal(summary.byHour[22], 2)
  assert.equal(summary.byType.reel.count, 2)
})

test('coleta paginada, limite 25, métricas parciais, segredo e interrupção por rate limit', async (context) => {
  const before = process.env.INSTAGRAM_ACCESS_TOKEN
  const token = 'FAKE_PRIVATE_TOKEN_FOR_TEST'
  let mode: 'pages' | 'fallback' | 'limit' | 'stop' = 'pages'
  let mediaCalls = 0
  let insightsCalls = 0
  let calls = 0
  const metricEntry = (name: string) => ({
    name,
    values: [{ value: name === 'saved' ? 0 : 12 }],
  })
  context.mock.method(
    globalThis,
    'fetch',
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input))
      calls++
      assert.equal(url.hostname, 'graph.instagram.com')
      assert.ok(!url.toString().includes(token))
      assert.equal(
        new Headers(init?.headers).get('authorization'),
        `Bearer ${token}`,
      )
      if (url.pathname.endsWith('/me'))
        return Response.json({
          user_id: '123',
          username: 'studio.test',
          access_token: token,
        })
      if (url.pathname.endsWith('/media')) {
        mediaCalls++
        const raw = (id: string) => ({
          id,
          caption: token,
          timestamp: '2026-09-06T01:00:00+0000',
          media_type: 'IMAGE',
          media_url: `https://cdninstagram.com/a?access_token=${token}`,
        })
        if (mode === 'limit')
          return Response.json({
            data: Array.from({ length: 30 }, (_, i) => raw(String(i + 1))),
            paging: { next: 'https://evil.test' },
          })
        if (mode === 'pages' && mediaCalls === 1)
          return Response.json({
            data: [raw('1')],
            paging: {
              next: `https://evil.test/?access_token=${token}`,
              cursors: { after: 'safe-cursor' },
            },
          })
        if (mode === 'pages') {
          assert.equal(url.searchParams.get('after'), 'safe-cursor')
          return Response.json({ data: [raw('1'), raw('2')] })
        }
        return Response.json({ data: [raw('1'), raw('2')] })
      }
      insightsCalls++
      if (mode === 'stop')
        return Response.json(
          { error: { code: 4, message: token } },
          { status: 429 },
        )
      const metric = url.searchParams.get('metric')!
      if (mode === 'fallback') {
        if (metric.includes(',') || metric === 'shares')
          return Response.json(
            { error: { code: 100, message: 'Metric shares is not supported' } },
            { status: 400 },
          )
        if (metric === 'views') return Response.json({ data: [] })
        if (metric === 'likes')
          return Response.json({
            data: [{ name: metric, total_value: { value: 3 } }],
          })
      }
      return Response.json({ data: metric.split(',').map(metricEntry) })
    },
  )
  const reset = (value: typeof mode) => {
    mode = value
    calls = 0
    mediaCalls = 0
    insightsCalls = 0
  }
  try {
    delete process.env.INSTAGRAM_ACCESS_TOKEN
    assert.equal((await getInstagramPosts()).httpStatus, 503)
    assert.equal(calls, 0)
    process.env.INSTAGRAM_ACCESS_TOKEN = token
    const result = await getInstagramPosts()
    const data = JSON.parse(result.body)
    assert.equal(result.httpStatus, 200)
    assert.equal(data.count, 2)
    assert.equal(data.status, 'ok')
    assert.equal(mediaCalls, 2)
    assert.equal(insightsCalls, 2)
    assert.equal(data.posts[0].metrics.totalInteractions, 12)
    assert.ok(!result.body.includes(token))
    assert.ok(!result.body.includes('evil.test'))
    assert.equal(data.posts[0].mediaUrl, undefined)
    assert.equal(data.posts[0].caption, '[REDACTED]')
    reset('fallback')
    const partial = JSON.parse((await getInstagramPosts()).body)
    assert.equal(partial.status, 'partial')
    assert.equal(partial.posts[0].metrics.saved, 0)
    assert.equal(partial.posts[0].metrics.views, null)
    assert.equal(partial.posts[0].metricStatus.views, 'no_data')
    assert.equal(partial.posts[0].metrics.shares, null)
    assert.equal(partial.posts[0].metricStatus.shares, 'unavailable')
    assert.equal(partial.posts[0].metrics.likes, 3)
    assert.equal(insightsCalls, 16)
    reset('limit')
    assert.equal(JSON.parse((await getInstagramPosts()).body).count, 25)
    assert.equal(insightsCalls, 25)
    assert.equal(mediaCalls, 1)
    reset('stop')
    const stopped = await getInstagramPosts()
    assert.equal(stopped.httpStatus, 429)
    const stoppedData = JSON.parse(stopped.body)
    assert.equal(insightsCalls, 1)
    assert.ok(
      metricNames.every(
        (metric) => stoppedData.posts[1].metricStatus[metric] === 'not_tested',
      ),
    )
  } finally {
    if (before === undefined) delete process.env.INSTAGRAM_ACCESS_TOKEN
    else process.env.INSTAGRAM_ACCESS_TOKEN = before
  }
})
