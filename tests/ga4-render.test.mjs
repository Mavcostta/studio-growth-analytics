import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer as httpServer } from 'node:http'
import { once } from 'node:events'

test('GA4: renderização de sucesso, loading, erro, vazio e parcial sem mock', async () => {
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
  })
  const server = httpServer(vite.middlewares)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  try {
    const base = `http://127.0.0.1:${server.address().port}`
    for (const path of [
      '/.env',
      '/credentials/ga4-service-account.json',
      '/credentials/ga4-service-account.json?raw',
    ]) {
      const response = await globalThis.fetch(base + path)
      assert.equal(response.status, 403)
      await response.body.cancel()
    }
    const { Analytics } = await vite.ssrLoadModule(
      '/src/components/Analytics.tsx',
    )
    const render = (state) =>
      renderToStaticMarkup(createElement(Analytics, { state, retry: () => {} }))
    assert.match(render({ status: 'loading' }), /Consultando dados reais/)
    const error = render({ status: 'error', message: 'Falha na consulta' })
    assert.match(error, /role="alert"/)
    assert.match(error, /Tentar novamente/)
    assert.doesNotMatch(error, /simulad|fictíci/)
    assert.match(error, /Insights indisponíveis/)
    assert.doesNotMatch(error, /Maior intenção/)
    const data = {
      status: 'success',
      metrics: {
        activeUsers: '3',
        sessions: '3',
        screenPageViews: '13',
        eventCount: '50',
      },
      events: { whatsapp_click: '3', select_service: '2', scroll_depth: '10' },
    }
    const success = render({ status: 'ready', data })
    assert.match(success, /O que os dados do site estão nos contando/)
    for (const title of [
      'Maior intenção',
      'Origem mais qualificada',
      'Oportunidade de melhoria',
      'O que ainda não sabemos',
    ])
      assert.equal(success.split(`<h3>${title}</h3>`).length - 1, 1)
    assert.match(success, /23,1%/)
    assert.match(success, /Amostra pequena/)
    for (const value of ['13', '50', '10'])
      assert.ok(success.includes(`>${value}</strong>`))
    assert.match(success, /Série diária indisponível/)
    assert.doesNotMatch(success, /simulad|fictíci/)
    assert.match(
      render({
        status: 'ready',
        data: {
          ...data,
          status: 'partial',
          events: { ...data.events, whatsapp_click: null },
        },
      }),
      /Resposta parcial/,
    )
    const empty = render({
      status: 'ready',
      data: {
        status: 'empty',
        metrics: Object.fromEntries(
          Object.keys(data.metrics).map((key) => [key, null]),
        ),
        events: Object.fromEntries(
          Object.keys(data.events).map((key) => [key, null]),
        ),
      },
    })
    assert.match(empty, /não retornou dados/)
    assert.match(empty, /Sem dados/)
    assert.doesNotMatch(empty, />0<\/strong>/)
  } finally {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
    await vite.close()
  }
})
