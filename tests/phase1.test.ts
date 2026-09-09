import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { getInstagramAccount } from '../server/integrations/instagram/account.js'
import { withoutLocalTraffic } from '../server/integrations/analytics/filters.js'
import { saveSnapshot } from '../server/snapshots.js'
import cron from '../api/cron/snapshots.js'

test('conta Instagram: seguidores, zero real, ausência, fluxos e erro isolado', async (t) => {
  const old = process.env.INSTAGRAM_ACCESS_TOKEN
  try {
    delete process.env.INSTAGRAM_ACCESS_TOKEN
    assert.equal((await getInstagramAccount()).httpStatus, 503)
    process.env.INSTAGRAM_ACCESS_TOKEN = 'PRIVATE_TOKEN'
    t.mock.method(globalThis, 'fetch', async (input: URL) => {
      assert.ok(!input.toString().includes('PRIVATE_TOKEN'))
      if (input.pathname.endsWith('/me'))
        return Response.json({
          user_id: '123',
          followers_count: 2194,
          secret: 'PRIVATE_TOKEN',
        })
      const metric = input.searchParams.get('metric')
      assert.equal(input.searchParams.get('period'), 'day')
      if (metric === 'profile_views')
        return Response.json(
          { error: { code: 100, message: 'metric unavailable PRIVATE_TOKEN' } },
          { status: 400 },
        )
      if (metric === 'views') return Response.json({ data: [] })
      if (metric === 'follows_and_unfollows')
        return Response.json({
          data: [
            {
              name: metric,
              total_value: {
                breakdowns: [
                  {
                    dimension_keys: ['follow_type'],
                    results: [
                      { dimension_values: ['FOLLOWER'], value: 2 },
                      { dimension_values: ['NON_FOLLOWER'], value: 0 },
                    ],
                  },
                ],
              },
            },
          ],
        })
      if (metric === 'follower_count')
        return Response.json({
          data: [
            {
              name: metric,
              values: [{ value: 0, end_time: '2026-09-08T07:00:00+0000' }],
            },
          ],
        })
      return Response.json({
        data: [{ name: metric, total_value: { value: 0 } }],
      })
    })
    const result = await getInstagramAccount(new Date('2026-09-09T12:00:00Z'))
    const report = JSON.parse(result.body)
    assert.equal(result.httpStatus, 200)
    assert.equal(report.followers.value, 2194)
    assert.equal(report.metrics.reach.value, 0)
    assert.equal(report.metrics.views.value, null)
    assert.equal(report.metrics.profile_views.error.kind, 'metric_unavailable')
    assert.equal(report.followsAndUnfollows.net, 2)
    assert.equal(report.dailyNewFollowers.values[0].value, 0)
    assert.equal(report.period.since, '2026-09-08T00:00:00.000Z')
    assert.ok(!result.body.includes('PRIVATE_TOKEN'))
  } finally {
    if (old === undefined) delete process.env.INSTAGRAM_ACCESS_TOKEN
    else process.env.INSTAGRAM_ACCESS_TOKEN = old
  }
})

test('GA4: exclusão local preserva filtro de evento e produção', () => {
  const event = {
    filter: {
      fieldName: 'eventName',
      stringFilter: { value: 'whatsapp_click' },
    },
  }
  const data = withoutLocalTraffic({ dimensionFilter: event })
  const filter = data.dimensionFilter as {
    andGroup: { expressions: unknown[] }
  }
  assert.deepEqual(filter.andGroup.expressions[1], event)
  const local = withoutLocalTraffic({}).dimensionFilter as {
    notExpression: { filter: { stringFilter: { value: string } } }
  }
  const regex = new RegExp(
    `^${local.notExpression.filter.stringFilter.value}$`,
    'i',
  )
  for (const host of [
    'localhost',
    'localhost:5173',
    '127.0.0.1',
    '127.0.0.1:3000',
    '::1',
  ])
    assert.ok(regex.test(host))
  for (const host of [
    'www.studioannacosta.com.br',
    'studioannacosta.com.br',
    'example.vercel.app',
  ])
    assert.ok(!regex.test(host))
})

test('snapshots: criação atômica, dia idempotente, fonte separada, produção sem fallback', async () => {
  const cwd = process.cwd(),
    env = process.env.NODE_ENV,
    vercel = process.env.VERCEL,
    token = process.env.BLOB_READ_WRITE_TOKEN
  const folder = await mkdtemp(join(tmpdir(), 'studio-snapshot-'))
  try {
    process.chdir(folder)
    process.env.NODE_ENV = 'development'
    delete process.env.VERCEL
    const date = '2026-09-09T12:00:00.000Z'
    const results = await Promise.all([
      saveSnapshot('instagram', '123', date, { followers: 10 }),
      saveSnapshot('instagram', '123', date, { followers: 10 }),
    ])
    assert.deepEqual(results.sort(), ['already_exists', 'saved'])
    assert.equal(
      await saveSnapshot('instagram', '123', date, { followers: 11 }),
      'already_exists',
    )
    const saved = JSON.parse(
      await readFile(
        join(folder, '.snapshots/snapshots/instagram/123/2026-09-09.json'),
        'utf8',
      ),
    )
    assert.equal(saved.data.followers, 10)
    assert.equal(saved.observedDate, '2026-09-09')
    assert.equal(await saveSnapshot('ga4', '123', date, {}), 'saved')
    await assert.rejects(saveSnapshot('instagram', '../escape', date, {}))
    process.env.NODE_ENV = 'production'
    delete process.env.BLOB_READ_WRITE_TOKEN
    assert.equal(
      await saveSnapshot('instagram', '123', date, {}),
      'storage_unavailable',
    )
  } finally {
    process.chdir(cwd)
    for (const [key, value] of Object.entries({
      NODE_ENV: env,
      VERCEL: vercel,
      BLOB_READ_WRITE_TOKEN: token,
    })) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    await rm(folder, { recursive: true, force: true })
  }
})

test('cron recusa chamadas sem segredo antes de consultar APIs', async () => {
  const old = process.env.CRON_SECRET
  delete process.env.CRON_SECRET
  const server = createServer(cron).listen(0, '127.0.0.1')
  await once(server, 'listening')
  try {
    const address = server.address()
    assert.ok(address && typeof address !== 'string')
    assert.equal((await fetch(`http://127.0.0.1:${address.port}`)).status, 401)
  } finally {
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
    if (old !== undefined) process.env.CRON_SECRET = old
  }
})
