import { createServer } from 'node:http'
import { testInstagram } from './integrations/instagram/index.js'
import { getInstagramPosts } from './integrations/instagram/posts.js'
import { testAnalytics } from './integrations/analytics/index.js'

export function createDevServer(enabled: boolean) {
  // ponytail: uma consulta por vez neste teste manual; fila por conta se virar serviço multiusuário.
  let busy = false
  let analyticsBusy = false
  return createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    const send = (status: number, body: string) => {
      res.writeHead(status)
      res.end(body)
    }
    if (
      !enabled ||
      ![
        '/api/dev/instagram/test',
        '/api/dev/instagram/posts',
        '/api/dev/analytics/test',
      ].includes(req.url ?? '')
    )
      return send(404, '{"error":"not_found"}')
    // Rota local, sem CORS. Bloqueia origens externas e DNS rebinding.
    if (
      !/^127\.0\.0\.1:\d+$/.test(req.headers.host ?? '') ||
      req.headers.origin ||
      req.headers['sec-fetch-site'] === 'cross-site'
    )
      return send(403, '{"error":"local_only"}')
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET')
      return send(405, '{"error":"method_not_allowed"}')
    }
    const analytics = req.url === '/api/dev/analytics/test'
    if (analytics ? analyticsBusy : busy)
      return send(429, '{"error":"test_in_progress"}')
    if (analytics) analyticsBusy = true
    else busy = true
    try {
      const result = await (req.url === '/api/dev/analytics/test'
        ? testAnalytics()
        : req.url === '/api/dev/instagram/posts'
          ? getInstagramPosts()
          : testInstagram())
      send(result.httpStatus, result.body)
    } catch {
      send(
        500,
        '{"error":"internal_error","message":"Falha interna no teste; nenhum detalhe sensível foi registrado."}',
      )
    } finally {
      if (analytics) analyticsBusy = false
      else busy = false
    }
  })
}
