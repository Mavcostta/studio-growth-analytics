// Filtro de consulta, sem alterar filtros ou coleta da propriedade GA4.
export function withoutLocalTraffic(body: unknown) {
  const data = body as Record<string, unknown>
  const production = {
    notExpression: {
      filter: {
        fieldName: 'hostName',
        stringFilter: {
          matchType: 'FULL_REGEXP',
          value:
            '(localhost|.*\\.localhost|127\\.[0-9]+\\.[0-9]+\\.[0-9]+|\\[?::1\\]?)(:[0-9]+)?',
          caseSensitive: false,
        },
      },
    },
  }
  return {
    ...data,
    dimensionFilter: data.dimensionFilter
      ? { andGroup: { expressions: [production, data.dimensionFilter] } }
      : production,
  }
}
