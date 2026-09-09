import type { IncomingMessage, ServerResponse } from 'node:http'

export function functionHandler(
  run: () => Promise<{ httpStatus: number; body: string }>,
) {
  // ponytail: bloqueio por instância aquecida; não é rate limit distribuído.
  let busy = false
  return async (req: IncomingMessage, res: ServerResponse) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'private, no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    const send = (status: number, body: string) => {
      res.writeHead(status)
      res.end(body)
    }
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET')
      return send(405, '{"error":"method_not_allowed"}')
    }
    if (req.headers['sec-fetch-site'] === 'cross-site')
      return send(403, '{"error":"cross_origin_denied"}')
    if (req.headers.origin) {
      try {
        const origin = new URL(req.headers.origin)
        if (
          !['http:', 'https:'].includes(origin.protocol) ||
          origin.host !== req.headers.host
        )
          return send(403, '{"error":"cross_origin_denied"}')
      } catch {
        return send(403, '{"error":"cross_origin_denied"}')
      }
    }
    if (busy) return send(429, '{"error":"test_in_progress"}')
    busy = true
    try {
      const result = await run()
      send(result.httpStatus, result.body)
    } catch {
      send(
        500,
        '{"error":"internal_error","message":"Consulta indisponível. Nenhum detalhe sensível foi registrado."}',
      )
    } finally {
      busy = false
    }
  }
}
