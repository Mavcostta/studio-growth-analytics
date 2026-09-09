import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer, get } from 'node:http'
import { once } from 'node:events'
import { GoogleAuth } from 'google-auth-library'
import analytics from '../api/dev/analytics/test.js'
import instagram from '../api/dev/instagram/posts.js'
import { testAnalytics } from '../server/integrations/analytics/index.js'
import { functionHandler } from '../server/function-handler.js'

test('Vercel: rotas reais aceitam domínio de produção, somente GET, sem detalhes secretos', async () => {
  const previous = {
    GA4_PROPERTY_ID: process.env.GA4_PROPERTY_ID,
    INSTAGRAM_ACCESS_TOKEN: process.env.INSTAGRAM_ACCESS_TOKEN,
  }
  delete process.env.GA4_PROPERTY_ID
  delete process.env.INSTAGRAM_ACCESS_TOKEN
  const server = createServer((req, res) =>
    (req.url === '/api/dev/analytics/test' ? analytics : instagram)(req, res),
  )
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  assert.ok(address && typeof address === 'object')
  const base = `http://127.0.0.1:${address.port}`
  try {
    for (const path of [
      '/api/dev/analytics/test',
      '/api/dev/instagram/posts',
    ]) {
      const response = await fetch(base + path)
      const productionStatus = await new Promise<number | undefined>(
        (resolve, reject) => {
          get(
            base + path,
            {
              headers: {
                Host: 'studio.vercel.app',
                Origin: 'https://studio.vercel.app',
              },
            },
            (response) => {
              response.resume()
              resolve(response.statusCode)
            },
          ).on('error', reject)
        },
      )
      assert.equal(productionStatus, 503)
      assert.equal(response.status, 503)
      assert.equal(response.headers.get('cache-control'), 'private, no-store')
      assert.equal((await fetch(base + path, { method: 'POST' })).status, 405)
      assert.equal(
        (await fetch(base + path, { headers: { Origin: base } })).status,
        503,
      )
      assert.equal(
        (
          await fetch(base + path, {
            headers: { Origin: 'https://outside.example' },
          })
        ).status,
        403,
      )
      assert.equal(
        (await fetch(base + path, { headers: { Origin: 'null' } })).status,
        403,
      )
    }
  } finally {
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})

test('GA4 produção: JSON de ambiente, arquivo local proibido e erros sanitizados', async (context) => {
  const keys = [
    'NODE_ENV',
    'VERCEL',
    'GA4_PROPERTY_ID',
    'GA4_SERVICE_ACCOUNT_JSON',
    'GOOGLE_APPLICATION_CREDENTIALS',
  ]
  const previous = keys.map((key) => process.env[key])
  let authenticated = false
  context.mock.method(GoogleAuth.prototype, 'getClient', async () => {
    authenticated = true
    return {
      getAccessToken: async () => ({ token: 'PRIVATE_TEST' }),
      request: async () => ({
        data: { kind: 'analyticsData#runReport', dimensions: [] },
      }),
    }
  })
  try {
    process.env.NODE_ENV = 'production'
    process.env.GA4_PROPERTY_ID = '123'
    process.env.GOOGLE_APPLICATION_CREDENTIALS =
      'credentials/must-not-read.json'
    delete process.env.GA4_SERVICE_ACCOUNT_JSON
    assert.equal((await testAnalytics()).httpStatus, 503)
    assert.equal(authenticated, false)
    process.env.GA4_SERVICE_ACCOUNT_JSON = 'PRIVATE_TEST'
    const invalid = await testAnalytics()
    assert.equal(invalid.httpStatus, 503)
    assert.ok(!invalid.body.includes('PRIVATE_TEST'))
    process.env.GA4_SERVICE_ACCOUNT_JSON = JSON.stringify({
      type: 'service_account',
      client_email: 'test@example.invalid',
      private_key: 'PRIVATE_TEST',
    })
    const result = await testAnalytics()
    assert.equal(result.httpStatus, 200)
    assert.equal(authenticated, true)
    assert.ok(!result.body.includes('PRIVATE_TEST'))
    process.env.NODE_ENV = 'development'
    process.env.VERCEL = '1'
    delete process.env.GA4_SERVICE_ACCOUNT_JSON
    assert.equal((await testAnalytics()).httpStatus, 503)
  } finally {
    keys.forEach((key, i) => {
      if (previous[i] === undefined) delete process.env[key]
      else process.env[key] = previous[i]
    })
  }
})

test('handler: preserva HTTP/JSON e oculta exceções', async () => {
  let fail = false
  const server = createServer(
    functionHandler(async () => {
      if (fail) throw new Error('PRIVATE_TEST')
      return { httpStatus: 200, body: '{"status":"partial","value":null}' }
    }),
  )
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  assert.ok(address && typeof address === 'object')
  try {
    const url = `http://127.0.0.1:${address.port}`
    assert.deepEqual(await (await fetch(url)).json(), {
      status: 'partial',
      value: null,
    })
    fail = true
    const error = await fetch(url)
    assert.equal(error.status, 500)
    assert.ok(!(await error.text()).includes('PRIVATE_TEST'))
  } finally {
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})
