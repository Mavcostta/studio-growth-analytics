import { mkdir, writeFile, link, unlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { head, put, BlobNotFoundError } from '@vercel/blob'
import { getInstagramAccount } from './integrations/instagram/account.js'
import { testAnalytics } from './integrations/analytics/index.js'

// Somente relatórios sanitizados produzidos no backend; nenhum payload de cliente.
export async function saveSnapshot(
  source: 'instagram' | 'ga4',
  id: string,
  collectedAt: string,
  data: unknown,
) {
  if (
    !['instagram', 'ga4'].includes(source) ||
    !/^\d+$/.test(id) ||
    !/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(collectedAt) ||
    !Number.isFinite(Date.parse(collectedAt))
  )
    throw new Error('invalid_snapshot')
  const day = collectedAt.slice(0, 10)
  const key = `snapshots/${source}/${id}/${day}.json`
  const body = JSON.stringify({
    schemaVersion: 1,
    source,
    subjectId: id,
    observedDate: day,
    collectedAt,
    timezone: 'UTC',
    data,
  })
  const production =
    process.env.NODE_ENV === 'production' || process.env.VERCEL === '1'
  try {
    if (production) {
      if (!process.env.BLOB_READ_WRITE_TOKEN) return 'storage_unavailable'
      try {
        await head(key)
        return 'already_exists'
      } catch (error) {
        if (!(error instanceof BlobNotFoundError)) throw error
      }
      try {
        await put(key, body, {
          access: 'private',
          addRandomSuffix: false,
          allowOverwrite: false,
          contentType: 'application/json',
        })
      } catch {
        // Uma execução concorrente pode ter gravado o mesmo dia. Nunca sobrescrever.
        await head(key)
        return 'already_exists'
      }
    } else {
      const target = join(process.cwd(), '.snapshots', key)
      await mkdir(dirname(target), { recursive: true })
      const temporary = `${target}.${randomUUID()}.tmp`
      try {
        await writeFile(temporary, body, { flag: 'wx', mode: 0o600 })
        try {
          await link(temporary, target)
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'EEXIST')
            return 'already_exists'
          throw error
        }
      } finally {
        await unlink(temporary).catch(() => {})
      }
    }
    return 'saved'
  } catch {
    return 'storage_error'
  }
}

export async function collectSnapshots() {
  const collectedAt = new Date().toISOString()
  const [instagram, analytics] = await Promise.all([
    getInstagramAccount(new Date(collectedAt)),
    testAnalytics(),
  ])
  const ig = JSON.parse(instagram.body),
    ga = JSON.parse(analytics.body)
  // Uma fonte indisponível não impede a coleta da outra. Não congelar erros como dados.
  const results = {
    instagram:
      instagram.httpStatus === 200 && ig.followers.value !== null
        ? await saveSnapshot('instagram', ig.accountId, collectedAt, ig)
        : 'source_unavailable',
    ga4:
      analytics.httpStatus === 200 && ['success', 'partial'].includes(ga.status)
        ? await saveSnapshot('ga4', ga.propertyId, collectedAt, ga)
        : 'source_unavailable',
  }
  const complete = Object.values(results).every((value) =>
    ['saved', 'already_exists'].includes(value),
  )
  return {
    httpStatus: complete ? 200 : 503,
    body: JSON.stringify({
      status: complete ? 'ok' : 'partial',
      collectedAt,
      results,
    }),
  }
}
