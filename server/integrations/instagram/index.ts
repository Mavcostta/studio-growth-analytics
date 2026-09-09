const baseUrl = 'https://graph.instagram.com/v25.0'
const metrics = ['reach', 'views', 'saved', 'shares'] as const
type Metric = (typeof metrics)[number]
export type JsonObject = Record<string, unknown>
export const object = (value: unknown): JsonObject =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : {}
export const numeric = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined
export const identifier = (value: unknown) =>
  typeof value === 'string' && /^\d+$/.test(value) ? value : undefined

type ErrorKind =
  | 'missing_token'
  | 'invalid_token'
  | 'insufficient_permission'
  | 'metric_unavailable'
  | 'rate_limit'
  | 'api_error'
const messages: Record<ErrorKind, string> = {
  missing_token:
    'Configure INSTAGRAM_ACCESS_TOKEN no ambiente do backend e reinicie o servidor.',
  invalid_token:
    'Token inválido ou expirado. Renove a autorização da conta no fluxo Instagram Login.',
  insufficient_permission:
    'Permissão insuficiente. Confira instagram_business_basic e instagram_business_manage_insights e o acesso da conta ao aplicativo.',
  metric_unavailable:
    'A Meta rejeitou esta métrica para a mídia consultada. A disponibilidade depende do tipo, data e versão da API.',
  rate_limit:
    'Limite de consultas atingido. Aguarde antes de tentar novamente.',
  api_error:
    'Falha ao consultar a Meta ou resposta inesperada. Confira conectividade, versão e configuração do aplicativo.',
}
export interface SafeError {
  kind: ErrorKind
  message: string
  metaCode?: number
  metaSubcode?: number
}
interface CallResult {
  endpoint: string
  httpStatus: number | null
  data?: JsonObject
  error?: SafeError
}
interface MetricResult {
  metric: Metric
  status: 'available' | 'no_data' | 'unavailable' | 'error' | 'not_tested'
  endpoint?: string
  httpStatus?: number | null
  value?: number
  fields?: string[]
  error?: SafeError
}

export function safeError(
  kind: ErrorKind,
  metaCode?: number,
  metaSubcode?: number,
): SafeError {
  return { kind, message: messages[kind], metaCode, metaSubcode }
}

// Nunca retornar mensagens, headers, paginação ou objetos brutos recebidos da Meta.
function metaError(
  status: number,
  payload: JsonObject,
  metric?: string,
): SafeError {
  const error = object(payload.error)
  const code = numeric(error.code)
  const subcode = numeric(error.error_subcode)
  let kind: ErrorKind = 'api_error'
  if (status === 429 || [4, 17, 32, 341, 613, 80002].includes(code ?? -1))
    kind = 'rate_limit'
  else if (code === 190 || code === 102 || status === 401)
    kind = 'invalid_token'
  else if (
    code === 10 ||
    (code !== undefined && code >= 200 && code <= 299) ||
    status === 403
  )
    kind = 'insufficient_permission'
  // Código 100 também significa parâmetro/objeto inválido: não confundir todos esses erros com métrica indisponível.
  else if (
    metric &&
    code === 100 &&
    typeof error.message === 'string' &&
    /metric|insights.*(not supported|not available|unavailable)|media.*(before|professional|business)/i.test(
      error.message,
    )
  )
    kind = 'metric_unavailable'
  return safeError(kind, code, subcode)
}

export async function request(
  path: string,
  params: Record<string, string>,
  metric?: string,
): Promise<CallResult> {
  const url = new URL(`${baseUrl}/${path}`)
  url.search = new URLSearchParams(params).toString()
  const endpoint = url.toString()
  let httpStatus: number | null = null
  try {
    const response = await fetch(url, {
      method: 'GET',
      // Única origem da credencial. Nunca incluir o token na URL.
      headers: {
        Authorization: `Bearer ${process.env.INSTAGRAM_ACCESS_TOKEN!.trim()}`,
      },
      signal: AbortSignal.timeout(15_000),
      redirect: 'error',
    })
    httpStatus = response.status
    const payload = object(await response.json())
    if (!response.ok || payload.error)
      return {
        endpoint,
        httpStatus,
        error: metaError(httpStatus, payload, metric),
      }
    return { endpoint, httpStatus, data: payload }
  } catch {
    // Erros de fetch podem conter detalhes da requisição. Não registrar nem refletir.
    return { endpoint, httpStatus, error: safeError('api_error') }
  }
}

function mediaFields(value: unknown) {
  const row = object(value)
  const id = identifier(row.id)
  if (!id) return null
  const allowed = ['IMAGE', 'VIDEO', 'CAROUSEL_ALBUM']
  return {
    id,
    ...(typeof row.media_type === 'string' && allowed.includes(row.media_type)
      ? { media_type: row.media_type }
      : {}),
    ...(typeof row.media_product_type === 'string' &&
    ['FEED', 'REELS', 'STORY', 'AD'].includes(row.media_product_type)
      ? { media_product_type: row.media_product_type }
      : {}),
    ...(typeof row.timestamp === 'string' &&
    /^\d{4}-\d{2}-\d{2}T[\d:+Z.-]+$/.test(row.timestamp)
      ? { timestamp: row.timestamp }
      : {}),
  }
}

export function localStatus(error: SafeError) {
  return {
    missing_token: 503,
    invalid_token: 401,
    insufficient_permission: 403,
    metric_unavailable: 422,
    rate_limit: 429,
    api_error: 502,
  }[error.kind]
}

export async function testInstagram() {
  const report: {
    status: 'ok' | 'partial' | 'error'
    apiVersion: string
    profile?: {
      endpoint: string
      httpStatus: number | null
      fields: string[]
      data: JsonObject
    }
    media?: {
      endpoint: string
      httpStatus: number | null
      fields: string[]
      data: NonNullable<ReturnType<typeof mediaFields>>[]
    }
    insights: { mediaId: string | null; results: MetricResult[] }
    failedRequest?: { endpoint: string; httpStatus: number | null }
    error?: SafeError
  } = {
    status: 'error',
    apiVersion: 'v25.0',
    insights: {
      mediaId: null,
      results: metrics.map((metric) => ({ metric, status: 'not_tested' })),
    },
  }

  // Defesa adicional se a fonte ecoar a credencial em um campo permitido.
  const finish = (httpStatus: number) => {
    let body = JSON.stringify(report)
    const token = process.env.INSTAGRAM_ACCESS_TOKEN?.trim()
    if (token)
      body = body.split(JSON.stringify(token).slice(1, -1)).join('[REDACTED]')
    return { httpStatus, body }
  }
  const fail = (error: SafeError, call?: CallResult) => {
    report.status = 'error'
    report.error = error
    if (call)
      report.failedRequest = {
        endpoint: call.endpoint,
        httpStatus: call.httpStatus,
      }
    return finish(localStatus(error))
  }
  if (!process.env.INSTAGRAM_ACCESS_TOKEN?.trim())
    return fail(safeError('missing_token'))

  const profile = await request('me', { fields: 'user_id,username' })
  if (profile.error) return fail(profile.error, profile)
  const id = identifier(profile.data?.user_id) ?? identifier(profile.data?.id)
  if (!id) return fail(safeError('api_error'), profile)
  const username = profile.data?.username
  const account = {
    user_id: id,
    ...(typeof username === 'string' && /^[a-zA-Z0-9_.]{1,30}$/.test(username)
      ? { username }
      : {}),
  }
  report.profile = {
    endpoint: profile.endpoint,
    httpStatus: profile.httpStatus,
    fields: Object.keys(account),
    data: account,
  }

  const media = await request(`${id}/media`, {
    fields: 'id,media_type,media_product_type,timestamp',
    limit: '3',
  })
  if (media.error) return fail(media.error, media)
  if (!Array.isArray(media.data?.data))
    return fail(safeError('api_error'), media)
  const posts = media.data.data.slice(0, 3).map(mediaFields)
  if (posts.some((post) => post === null))
    return fail(safeError('api_error'), media)
  const safePosts = posts.filter((post) => post !== null)
  report.media = {
    endpoint: media.endpoint,
    httpStatus: media.httpStatus,
    fields: [...new Set(safePosts.flatMap((post) => Object.keys(post)))],
    data: safePosts,
  }
  report.status = 'partial'
  if (!safePosts.length) return finish(200)
  report.insights.mediaId = safePosts[0].id
  // Uma mídia, quatro métricas isoladas: uma incompatível não invalida as demais.
  for (const [index, metric] of metrics.entries()) {
    const call = await request(
      `${safePosts[0].id}/insights`,
      { metric },
      metric,
    )
    const result: MetricResult = {
      metric,
      status: 'error',
      endpoint: call.endpoint,
      httpStatus: call.httpStatus,
    }
    report.insights.results[index] = result
    if (call.error) {
      result.error = call.error
      if (call.error.kind === 'metric_unavailable') {
        result.status = 'unavailable'
        continue
      }
      return fail(call.error, call)
    }
    if (!Array.isArray(call.data?.data))
      return fail(safeError('api_error'), call)
    const row = call.data.data.map(object).find((item) => item.name === metric)
    if (!row) {
      result.status = 'no_data'
      continue
    }
    const values = Array.isArray(row.values) ? row.values : []
    const value =
      numeric(object(row.total_value).value) ?? numeric(object(values[0]).value)
    result.fields = [
      'name',
      ...(Array.isArray(row.values) ? ['values.value'] : []),
      ...(numeric(object(row.total_value).value) !== undefined
        ? ['total_value.value']
        : []),
    ]
    if (value === undefined) {
      result.status = 'no_data'
      continue
    }
    result.status = 'available'
    result.value = value
  }
  report.status = report.insights.results.every(
    (result) => result.status === 'available',
  )
    ? 'ok'
    : 'partial'
  return finish(200)
}
