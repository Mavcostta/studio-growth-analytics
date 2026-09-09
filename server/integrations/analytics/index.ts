import { readFile } from 'node:fs/promises'
import { GoogleAuth } from 'google-auth-library'
import { collectDetails } from './details.js'

const metrics = ['activeUsers', 'sessions', 'screenPageViews', 'eventCount']
const events = ['whatsapp_click', 'select_service', 'scroll_depth']
const dateRanges = [{ startDate: '7daysAgo', endDate: 'yesterday' }]
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {}

function failure(httpStatus: number, kind: string, message: string) {
  return {
    httpStatus,
    body: JSON.stringify({ status: 'error', error: { kind, message } }),
  }
}

// Contagens int64 continuam strings: não arredondar nem transformar ausência em zero.
function values(report: unknown, expected: string[], eventReport = false) {
  const data = object(report)
  const rows = data.rows === undefined ? [] : data.rows
  if (!Array.isArray(rows)) throw new Error('invalid_response')
  const result: Record<string, string | null> = Object.fromEntries(
    expected.map((name) => [name, null]),
  )
  if (!rows.length) return result
  const headers = data.metricHeaders
  if (!Array.isArray(headers)) throw new Error('invalid_response')
  if (eventReport) {
    if (
      !Array.isArray(data.dimensionHeaders) ||
      object(data.dimensionHeaders[0]).name !== 'eventName'
    )
      throw new Error('invalid_response')
  } else if (rows.length !== 1) throw new Error('invalid_response')
  for (const row of rows) {
    const entry = object(row)
    const cells = entry.metricValues
    if (!Array.isArray(cells)) throw new Error('invalid_response')
    const dimensions = entry.dimensionValues
    const event = Array.isArray(dimensions)
      ? object(dimensions[0]).value
      : undefined
    for (const name of eventReport ? ['eventCount'] : expected) {
      const index = headers.findIndex((header) => object(header).name === name)
      const value = object(cells[index]).value
      if (typeof value !== 'string' || !/^\d+$/.test(value))
        throw new Error('invalid_response')
      if (eventReport) {
        if (typeof event !== 'string' || !expected.includes(event))
          throw new Error('invalid_response')
        result[event] = value
      } else result[name] = value
    }
  }
  return result
}

export async function testAnalytics() {
  const propertyId = process.env.GA4_PROPERTY_ID?.trim()
  if (!propertyId || !/^[1-9]\d*$/.test(propertyId))
    return failure(
      503,
      'property_configuration',
      'Configure GA4_PROPERTY_ID com o ID numérico da propriedade, não o Measurement ID.',
    )
  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS
  const keyJson = process.env.GA4_SERVICE_ACCOUNT_JSON
  const production =
    process.env.NODE_ENV === 'production' || process.env.VERCEL === '1'
  if (!keyJson && (production || !keyFile))
    return failure(
      503,
      'credential_configuration',
      'Configure GA4_SERVICE_ACCOUNT_JSON no servidor; em desenvolvimento também é permitido GOOGLE_APPLICATION_CREDENTIALS com o caminho local da chave.',
    )

  let auth: GoogleAuth
  try {
    const key = object(
      JSON.parse(keyJson ?? (await readFile(keyFile!, 'utf8'))),
    )
    if (
      key.type !== 'service_account' ||
      typeof key.client_email !== 'string' ||
      typeof key.private_key !== 'string'
    )
      throw new Error('invalid_credentials')
    auth = new GoogleAuth({
      credentials: {
        client_email: key.client_email,
        private_key: key.private_key,
      },
      scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    })
  } catch {
    return failure(
      503,
      'credential_configuration',
      'Não foi possível ler uma chave JSON válida de service account.',
    )
  }

  let stage: 'credential' | 'api' = 'credential'
  try {
    const client = await auth.getClient()
    await client.getAccessToken()
    stage = 'api'
    const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`
    const request = async (data: unknown) =>
      (
        await client.request({
          url,
          method: 'POST',
          data,
          timeout: 20_000,
          retry: false,
        })
      ).data
    const rawTotals = await request({
      dateRanges,
      metrics: metrics.map((name) => ({ name })),
    })
    const totals = values(rawTotals, metrics)
    const counts = values(
      await request({
        dateRanges,
        dimensions: [{ name: 'eventName' }],
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: {
          filter: {
            fieldName: 'eventName',
            inListFilter: { values: events, caseSensitive: true },
          },
        },
        limit: 3,
      }),
      events,
      true,
    )
    const all = [...Object.values(totals), ...Object.values(counts)]
    const details = await collectDetails(
      request,
      async () =>
        (
          await client.request({
            url: `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}/metadata`,
            method: 'GET',
            timeout: 20_000,
            retry: false,
          })
        ).data,
    )
    const timezone = object(object(rawTotals).metadata).timeZone
    let days: string[] = []
    if (typeof timezone === 'string') {
      try {
        const today = new Intl.DateTimeFormat('en-CA', {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date())
        const midnight = Date.parse(`${today}T00:00:00Z`)
        days = Array.from({ length: 7 }, (_, i) =>
          new Date(midnight - (7 - i) * 86400000)
            .toISOString()
            .slice(0, 10)
            .replaceAll('-', ''),
        )
      } catch {
        /* Dias ausentes permanecem sem preenchimento quando o fuso não é válido. */
      }
    }
    const status = all.every((value) => value === null)
      ? 'empty'
      : all.some((value) => value === null) ||
          Object.values(details).some(
            (section) => 'status' in section && section.status !== 'ready',
          )
        ? 'partial'
        : 'success'
    return {
      httpStatus: 200,
      body: JSON.stringify({
        status,
        propertyId,
        dateRange: dateRanges[0],
        metrics: totals,
        events: counts,
        details,
        days,
        timezone: typeof timezone === 'string' ? timezone : null,
        ...(status !== 'success'
          ? {
              message:
                'null indica ausência de linha no relatório; não significa zero nem confirma que o evento não existe.',
            }
          : {}),
      }),
    }
  } catch (error) {
    const response = object(object(error).response)
    const status = response.status
    if (stage === 'credential' || status === 401)
      return failure(
        401,
        'credential_error',
        'Falha ao autenticar a service account. Verifique a chave e se a conta está ativa.',
      )
    if (status === 403)
      return failure(
        403,
        'permission_denied',
        'Verifique o acesso de Leitor à propriedade, o ID numérico e se Google Analytics Data API está ativada no Google Cloud.',
      )
    if (status === 404)
      return failure(
        404,
        'property_not_found',
        'Propriedade não encontrada ou inacessível para esta service account.',
      )
    if (status === 429)
      return failure(
        429,
        'rate_limit',
        'Limite da Google Analytics Data API atingido. Tente mais tarde.',
      )
    return failure(
      502,
      'api_error',
      'A Google Analytics Data API falhou ou devolveu uma resposta inesperada. Nenhum dado substituto foi gerado.',
    )
  }
}
