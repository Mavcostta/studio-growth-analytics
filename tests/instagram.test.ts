import assert from 'node:assert/strict'
import test from 'node:test'
import { once } from 'node:events'
import { get } from 'node:http'
import { testInstagram } from '../server/integrations/instagram/index.js'
import { createDevServer } from '../server/app.js'

test('Instagram: allowlist, token privado, métricas isoladas e erros', async (context) => {
  const previous = process.env.INSTAGRAM_ACCESS_TOKEN
  const fakeToken = 'TEST_ONLY_PRIVATE_CREDENTIAL'
  const calls: string[] = []
  let responses: { status: number; body: unknown }[] = []
  const fetchMock = context.mock.method(
    globalThis,
    'fetch',
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      calls.push(url)
      assert.ok(!url.includes(fakeToken))
      assert.ok(!url.includes('access_token'))
      assert.equal(
        new Headers(init?.headers).get('authorization'),
        `Bearer ${fakeToken}`,
      )
      assert.equal(init?.method, 'GET')
      assert.equal(init?.redirect, 'error')
      const response = responses.shift()
      assert.ok(response, 'Chamada extra inesperada')
      return new Response(JSON.stringify(response.body), {
        status: response.status,
      })
    },
  )
  const profile = {
    status: 200,
    body: {
      user_id: '123',
      username: 'studio.test',
      access_token: fakeToken,
      secret: fakeToken,
    },
  }
  const media = {
    status: 200,
    body: {
      data: [
        {
          id: '456',
          media_type: 'IMAGE',
          media_product_type: 'FEED',
          timestamp: '2026-08-20T12:00:00+0000',
          caption: fakeToken,
        },
      ],
      paging: { next: `https://example.com/?access_token=${fakeToken}` },
    },
  }
  const metric = (name: string, value: number) => ({
    status: 200,
    body: {
      data: [
        { name, values: [{ value }], title: fakeToken, secret: fakeToken },
      ],
    },
  })
  const error = (code: number, message = fakeToken, status = 400) => ({
    status,
    body: {
      error: { code, message, error_subcode: 463, access_token: fakeToken },
    },
  })
  try {
    delete process.env.INSTAGRAM_ACCESS_TOKEN
    assert.equal((await testInstagram()).httpStatus, 503)
    assert.equal(calls.length, 0)
    process.env.INSTAGRAM_ACCESS_TOKEN = fakeToken
    responses = [
      profile,
      media,
      metric('reach', 10),
      metric('views', 0),
      error(100, 'Metric saved is not supported'),
      metric('shares', 3),
    ]
    const success = await testInstagram()
    assert.equal(success.httpStatus, 200)
    assert.ok(!success.body.includes(fakeToken))
    assert.ok(!/access_token|paging|caption|secret/.test(success.body))
    const report = JSON.parse(success.body)
    assert.equal(report.status, 'partial')
    assert.deepEqual(
      report.insights.results.map((row: { status: string }) => row.status),
      ['available', 'available', 'unavailable', 'available'],
    )
    assert.equal(report.insights.results[1].value, 0)
    assert.equal(calls.length, 6)
    assert.ok(
      calls.slice(2).every((url) => url.includes('/456/insights?metric=')),
    )
    for (const [code, status, kind] of [
      [190, 401, 'invalid_token'],
      [10, 403, 'insufficient_permission'],
      [200, 403, 'insufficient_permission'],
      [4, 429, 'rate_limit'],
      [100, 502, 'api_error'],
      [2, 502, 'api_error'],
    ] as const) {
      responses = [error(code)]
      const result = await testInstagram()
      assert.equal(result.httpStatus, status)
      assert.equal(JSON.parse(result.body).error.kind, kind)
      assert.ok(!result.body.includes(fakeToken))
    }
    responses = [profile, media, error(4)]
    const limited = JSON.parse((await testInstagram()).body)
    assert.equal(limited.insights.results[1].status, 'not_tested')
    assert.equal(responses.length, 0)
    responses = [profile, { status: 200, body: { data: [] } }]
    const empty = JSON.parse((await testInstagram()).body)
    assert.equal(empty.insights.mediaId, null)
    assert.equal(empty.status, 'partial')
    responses = [
      profile,
      media,
      { status: 200, body: { data: [] } },
      metric('views', 3),
      metric('saved', 2),
      metric('shares', 1),
    ]
    assert.equal(
      JSON.parse((await testInstagram()).body).insights.results[0].status,
      'no_data',
    )
    responses = [
      { status: 200, body: { user_id: '../unsafe', username: fakeToken } },
    ]
    assert.equal((await testInstagram()).httpStatus, 502)
    fetchMock.mock.mockImplementation(async () => {
      throw new Error(fakeToken)
    })
    const network = await testInstagram()
    assert.equal(network.httpStatus, 502)
    assert.ok(!network.body.includes(fakeToken))
  } finally {
    if (previous === undefined) delete process.env.INSTAGRAM_ACCESS_TOKEN
    else process.env.INSTAGRAM_ACCESS_TOKEN = previous
  }
})

test('rota: somente desenvolvimento/local/GET e resposta sem token', async () => {
  const previous = process.env.INSTAGRAM_ACCESS_TOKEN
  delete process.env.INSTAGRAM_ACCESS_TOKEN
  try {
    for (const enabled of [false, true]) {
      const server = createDevServer(enabled)
      server.listen(0, '127.0.0.1')
      await once(server, 'listening')
      const address = server.address()
      assert.ok(address && typeof address === 'object')
      const url = `http://127.0.0.1:${address.port}/api/dev/instagram/test`
      try {
        const response = await fetch(url)
        assert.equal(response.status, enabled ? 503 : 404)
        assert.equal(response.headers.get('cache-control'), 'no-store')
        if (enabled) {
          const postsResponse = await fetch(url.replace('/test', '/posts'))
          assert.equal(postsResponse.status, 503)
          assert.equal((await postsResponse.json()).error.kind, 'missing_token')
          assert.equal((await response.json()).error.kind, 'missing_token')
          assert.equal((await fetch(url, { method: 'POST' })).status, 405)
          assert.equal(
            (await fetch(url, { headers: { Origin: 'https://example.com' } }))
              .status,
            403,
          )
          const externalHostStatus = await new Promise<number | undefined>(
            (resolve, reject) => {
              get(url, { headers: { Host: 'example.com' } }, (response) => {
                response.resume()
                resolve(response.statusCode)
              }).on('error', reject)
            },
          )
          assert.equal(externalHostStatus, 403)
          assert.equal((await fetch(`${url}?access_token=ignored`)).status, 404)
        }
      } finally {
        server.closeAllConnections()
        await new Promise<void>((resolve) => server.close(() => resolve()))
      }
    }
  } finally {
    if (previous === undefined) delete process.env.INSTAGRAM_ACCESS_TOKEN
    else process.env.INSTAGRAM_ACCESS_TOKEN = previous
  }
})
