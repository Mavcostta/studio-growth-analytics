import { get, list } from '@vercel/blob'
import {
  normalizeSnapshot,
  summarizeHistory,
  type Source,
  type SourceHistory,
  type HistoryReport,
} from './history-model.js'

// SDK isolado para validar paginação e falhas sem credenciais nos testes.
export const historyStorage = { get, list }
const unavailable = (): SourceHistory => ({
  status: 'unavailable',
  message:
    'Histórico indisponível. Não foi possível ler os snapshots armazenados.',
  points: [],
  comparison: null,
})

async function readSource(source: Source): Promise<SourceHistory> {
  const property = process.env.GA4_PROPERTY_ID?.trim()
  if (source === 'ga4' && (!property || !/^\d+$/.test(property)))
    return unavailable()
  const prefix =
    source === 'ga4' ? `snapshots/ga4/${property}/` : 'snapshots/instagram/'
  const signal = AbortSignal.timeout(60_000)
  try {
    let cursor: string | undefined
    const paths = new Set<string>(),
      cursors = new Set<string>()
    do {
      const result = await historyStorage.list({
        prefix,
        cursor,
        limit: 1000,
        abortSignal: signal,
      })
      for (const blob of result.blobs)
        if (
          blob.pathname.startsWith(prefix) &&
          /^snapshots\/(instagram|ga4)\/\d+\/\d{4}-\d{2}-\d{2}\.json$/.test(
            blob.pathname,
          )
        )
          paths.add(blob.pathname)
      if (paths.size > 10000) throw new Error('history_limit')
      cursor = result.hasMore ? result.cursor : undefined
      if (result.hasMore && (!cursor || cursors.has(cursor)))
        throw new Error('invalid_cursor')
      if (cursor) cursors.add(cursor)
    } while (cursor)
    // O projeto é de uma conta. Nunca misturar contas num store compartilhado.
    if (new Set([...paths].map((p) => p.split('/')[2])).size > 1)
      return unavailable()
    // ponytail: até 100 snapshots recentes por fonte; paginação de histórico na UI se precisar explorar anos.
    const selected = [...paths].sort().slice(-100)
    const points = []
    let partial = false
    for (let offset = 0; offset < selected.length; offset += 5) {
      const batch = await Promise.all(
        selected.slice(offset, offset + 5).map(async (path) => {
          try {
            const blob = await historyStorage.get(path, {
              access: 'private',
              useCache: false,
              abortSignal: signal,
            })
            if (!blob || blob.statusCode !== 200) return null
            const reader = blob.stream.getReader(),
              chunks: Uint8Array[] = []
            let size = 0
            try {
              while (true) {
                const chunk = await reader.read()
                if (chunk.done) break
                size += chunk.value.length
                if (size > 2_000_000) throw new Error('snapshot_size')
                chunks.push(chunk.value)
              }
            } finally {
              await reader.cancel().catch(() => {})
            }
            return normalizeSnapshot(
              JSON.parse(Buffer.concat(chunks).toString('utf8')),
              path,
            )
          } catch {
            return null
          }
        }),
      )
      for (const point of batch) {
        if (point) points.push(point)
        else partial = true
      }
    }
    return summarizeHistory(source, points, partial)
  } catch {
    return unavailable()
  }
}

export async function getHistory() {
  const configured =
    !!process.env.BLOB_READ_WRITE_TOKEN ||
    !!(process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN)
  const [instagram, ga4] = configured
    ? await Promise.all([readSource('instagram'), readSource('ga4')])
    : [unavailable(), unavailable()]
  const report: HistoryReport = { schemaVersion: 1, instagram, ga4 }
  let body = JSON.stringify(report)
  // Não refletir credenciais se um campo de dimensão tiver sido contaminado na origem.
  for (const key of [
    'BLOB_READ_WRITE_TOKEN',
    'VERCEL_OIDC_TOKEN',
    'INSTAGRAM_ACCESS_TOKEN',
    'GA4_SERVICE_ACCOUNT_JSON',
    'CRON_SECRET',
  ]) {
    const secret = process.env[key]
    if (secret)
      body = body.split(JSON.stringify(secret).slice(1, -1)).join('[REDACTED]')
  }
  return {
    httpStatus:
      instagram.status === 'unavailable' && ga4.status === 'unavailable'
        ? 503
        : 200,
    body,
  }
}
