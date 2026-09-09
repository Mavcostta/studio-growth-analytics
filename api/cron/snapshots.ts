import type { IncomingMessage, ServerResponse } from 'node:http'
import { timingSafeEqual } from 'node:crypto'
import { collectSnapshots } from '../../server/snapshots.js'
import { functionHandler } from '../../server/function-handler.js'

const run = functionHandler(collectSnapshots)
export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  const secret = process.env.CRON_SECRET
  const received = Buffer.from(req.headers.authorization ?? '')
  const expected = Buffer.from(`Bearer ${secret ?? ''}`)
  if (
    !secret ||
    received.length !== expected.length ||
    !timingSafeEqual(received, expected)
  ) {
    res.writeHead(401, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    })
    res.end('{"error":"unauthorized"}')
    return
  }
  await run(req, res)
}
