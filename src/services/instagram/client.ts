import {
  instagramMetricNames,
  type InstagramAccountSummary,
  type InstagramContentType,
  type InstagramMetrics,
  type InstagramPostAnalytics,
} from '../../types/instagram.js'

const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
const optionalText = (value: unknown) =>
  typeof value === 'string' ? value : undefined
const invalid = () =>
  new Error('O backend retornou dados inesperados. Tente novamente.')
function safeUrl(value: unknown, image = false) {
  if (typeof value !== 'string') return undefined
  try {
    const url = new URL(value)
    const domains = image
      ? ['cdninstagram.com', 'fbcdn.net']
      : ['instagram.com']
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      !domains.some(
        (domain) =>
          url.hostname === domain || url.hostname.endsWith(`.${domain}`),
      ) ||
      [...url.searchParams.keys()].some((key) =>
        /token|secret|credential|authorization/i.test(key),
      )
    )
      return undefined
    return url.toString()
  } catch {
    return undefined
  }
}

// Valida a fronteira HTTP e copia apenas campos usados pela UI; não importa código do servidor.
export function parseInstagramResponse(
  value: unknown,
): InstagramAccountSummary {
  const data = record(value)
  if (
    !['ok', 'partial'].includes(String(data.status)) ||
    !Array.isArray(data.posts) ||
    data.posts.length > 25 ||
    data.timezone !== 'America/Sao_Paulo' ||
    typeof data.collectedAt !== 'string' ||
    !Number.isFinite(Date.parse(data.collectedAt))
  )
    throw invalid()
  const seen = new Set<string>()
  const posts: InstagramPostAnalytics[] = data.posts.map((value) => {
    const post = record(value)
    if (
      typeof post.id !== 'string' ||
      !/^\d+$/.test(post.id) ||
      seen.has(post.id) ||
      !['reel', 'image', 'carousel', 'video', 'unknown'].includes(
        String(post.contentType),
      )
    )
      throw invalid()
    seen.add(post.id)
    const raw = record(post.metrics)
    const metrics: InstagramMetrics = {
      reach: null,
      views: null,
      saved: null,
      shares: null,
      likes: null,
      comments: null,
      totalInteractions: null,
    }
    for (const key of instagramMetricNames) {
      const value = raw[key]
      if (
        value !== null &&
        value !== undefined &&
        (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
      )
        throw invalid()
      metrics[key] = typeof value === 'number' ? value : null
    }
    const publishedAt = optionalText(post.publishedAt)
    const dated =
      publishedAt !== undefined &&
      Number.isFinite(Date.parse(publishedAt)) &&
      /(?:Z|[+-]\d{2}:?\d{2})$/.test(publishedAt)
    const publishedDate =
      typeof post.publishedDate === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(post.publishedDate)
        ? post.publishedDate
        : null
    return {
      id: post.id,
      caption: optionalText(post.caption)?.slice(0, 2200),
      contentType: post.contentType as InstagramContentType,
      publishedAt: dated ? publishedAt : undefined,
      publishedDate: dated ? publishedDate : null,
      publishedHour:
        dated &&
        Number.isInteger(post.publishedHour) &&
        Number(post.publishedHour) >= 0 &&
        Number(post.publishedHour) <= 23
          ? Number(post.publishedHour)
          : null,
      dayOfWeek:
        dated &&
        Number.isInteger(post.dayOfWeek) &&
        Number(post.dayOfWeek) >= 1 &&
        Number(post.dayOfWeek) <= 7
          ? Number(post.dayOfWeek)
          : null,
      permalink: safeUrl(post.permalink),
      thumbnailUrl: safeUrl(post.thumbnailUrl, true),
      metrics,
    }
  })
  return {
    status: data.status as 'ok' | 'partial',
    username: optionalText(record(data.account).username),
    collectedAt: data.collectedAt,
    timezone: 'America/Sao_Paulo',
    posts,
  }
}

let pending: Promise<InstagramAccountSummary> | null = null
// Compartilha somente chamadas em andamento (inclusive StrictMode). Sem cache persistente ou polling.
export function loadInstagramPosts(): Promise<InstagramAccountSummary> {
  if (pending) return pending
  pending = (async () => {
    let response: Response
    try {
      response = await fetch('/api/dev/instagram/posts', {
        signal: AbortSignal.timeout(240_000),
        cache: 'no-store',
      })
    } catch {
      throw new Error(
        'Backend indisponível ou consulta demorou demais. Tente novamente e verifique se a API está ativa no endereço do dashboard.',
      )
    }
    if (!response.ok) {
      let kind: unknown
      try {
        const payload: unknown = await response.json()
        kind = record(record(payload).error).kind
      } catch {
        /* A plataforma também pode devolver uma página de erro, sem JSON. */
      }
      if (kind === 'missing_token')
        throw new Error(
          'O backend está sem INSTAGRAM_ACCESS_TOKEN. Configure a variável no ambiente em execução e reinicie o servidor ou faça um novo deploy na Vercel.',
        )
      if (response.status === 404)
        throw new Error(
          'A rota /api/dev/instagram/posts não foi encontrada. Verifique se o deploy inclui as funções do backend.',
        )
      if (response.status === 429)
        throw new Error(
          'Consulta em andamento ou limite de consultas atingido. Aguarde antes de tentar novamente.',
        )
      if ([401, 403].includes(response.status))
        throw new Error(
          'A autorização do Instagram precisa ser verificada no backend.',
        )
      throw new Error(
        `Backend indisponível ou consulta ao Instagram falhou (HTTP ${response.status}). Verifique os logs da API no ambiente em execução.`,
      )
    }
    let payload: unknown
    try {
      payload = await response.json()
    } catch {
      throw invalid()
    }
    return parseInstagramResponse(payload)
  })().finally(() => {
    pending = null
  })
  return pending
}
