import {
  instagramMetricNames,
  type InstagramDerivedMetrics,
  type InstagramFormatSummary,
  type InstagramInsight,
  type InstagramMetricName,
  type InstagramPerformanceDimension,
  type InstagramPostAnalytics,
  type Statistic,
} from '../types/instagram.js'

export const MIN_SAMPLE = 3
export const formatLabels = {
  reel: 'Reels',
  carousel: 'Carrosséis',
  image: 'Imagens',
  video: 'Vídeos',
  unknown: 'Outros',
}
export const dayLabels = [
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
  'Domingo',
]
export const metricLabels: Record<InstagramMetricName, string> = {
  reach: 'Alcance',
  views: 'Visualizações',
  saved: 'Salvamentos',
  shares: 'Compartilhamentos',
  likes: 'Curtidas',
  comments: 'Comentários',
  totalInteractions: 'Interações totais',
}
export const dimensions: Record<InstagramPerformanceDimension, string> = {
  discovery: 'Descoberta',
  engagement: 'Engajamento',
  value: 'Valor',
  sharing: 'Compartilhamento',
  conversation: 'Conversa',
}
export const displayNumber = (value: number | null) =>
  value === null
    ? '—'
    : value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
export const displayRate = (value: number | null) =>
  value === null ? '—' : `${displayNumber(value * 100)}%`
export const divide = (
  value: number | null | undefined,
  reach: number | null | undefined,
) =>
  value != null &&
  reach != null &&
  Number.isFinite(value) &&
  Number.isFinite(reach) &&
  value >= 0 &&
  reach > 0 &&
  Number.isFinite(value / reach)
    ? value / reach
    : null
export function derived(post: InstagramPostAnalytics): InstagramDerivedMetrics {
  const m = post.metrics
  return {
    interactionRate: divide(m.totalInteractions, m.reach),
    saveRate: divide(m.saved, m.reach),
    shareRate: divide(m.shares, m.reach),
    commentRate: divide(m.comments, m.reach),
  }
}
export function statistic(values: (number | null)[]): Statistic {
  const valid = values
    .filter(
      (value): value is number => value !== null && Number.isFinite(value),
    )
    .sort((a, b) => a - b)
  const n = valid.length
  if (!n) return { n, sum: null, mean: null, median: null, divergent: false }
  const sum = valid.reduce((a, b) => a + b, 0)
  const mean = sum / n
  const median = (valid[Math.floor((n - 1) / 2)] + valid[Math.floor(n / 2)]) / 2
  return {
    n,
    sum,
    mean,
    median,
    divergent: Math.abs(mean - median) > Math.abs(median) * 0.5,
  }
}
export function summarize(
  posts: InstagramPostAnalytics[],
  key = 'all',
  label = 'Amostra',
): InstagramFormatSummary {
  const pairs = posts.filter((post) => derived(post).interactionRate !== null)
  return {
    key,
    label,
    count: posts.length,
    metrics: Object.fromEntries(
      instagramMetricNames.map((metric) => [
        metric,
        statistic(posts.map((post) => post.metrics[metric])),
      ]),
    ) as Record<InstagramMetricName, Statistic>,
    interactionRate: statistic(
      posts.map((post) => derived(post).interactionRate),
    ),
    globalInteractionRate: divide(
      statistic(pairs.map((post) => post.metrics.totalInteractions)).sum,
      statistic(pairs.map((post) => post.metrics.reach)).sum,
    ),
    rateSample: pairs.length,
  }
}
export function groups(
  posts: InstagramPostAnalytics[],
  kind: 'format' | 'day' | 'hour',
) {
  const entries: [string, string][] =
    kind === 'format'
      ? Object.entries(formatLabels)
      : kind === 'day'
        ? dayLabels.map((label, i) => [String(i + 1), label])
        : Array.from({ length: 24 }, (_, i) => [
            String(i),
            `${String(i).padStart(2, '0')}h`,
          ])
  return entries.map(([key, label]) =>
    summarize(
      posts.filter(
        (post) =>
          String(
            kind === 'format'
              ? post.contentType
              : kind === 'day'
                ? post.dayOfWeek
                : post.publishedHour,
          ) === key,
      ),
      key,
      label,
    ),
  )
}

// Percentil por postos médios: empates recebem a mesma posição; todos iguais => 50.
export function percentile(value: number | null, sample: (number | null)[]) {
  const valid = sample.filter((v): v is number => v !== null)
  if (value === null || valid.length < MIN_SAMPLE) return null
  const less = valid.filter((v) => v < value).length
  const equal = valid.filter((v) => v === value).length
  return (100 * (less + (equal - 1) / 2)) / (valid.length - 1)
}
export function evaluateDimensions(posts: InstagramPostAnalytics[]) {
  const completeDiscovery = posts.filter(
    (post) => post.metrics.reach !== null && post.metrics.views !== null,
  )
  const rates = posts.map(derived)
  const discovery = posts.map((post) => {
    if (post.metrics.reach === null || post.metrics.views === null) return null
    const reach = percentile(
      post.metrics.reach,
      completeDiscovery.map((p) => p.metrics.reach),
    )
    const views = percentile(
      post.metrics.views,
      completeDiscovery.map((p) => p.metrics.views),
    )
    return reach === null || views === null ? null : (reach + views) / 2
  })
  return new Map(
    posts.map((post, i) => [
      post.id,
      {
        discovery: percentile(discovery[i], discovery),
        engagement: percentile(
          rates[i].interactionRate,
          rates.map((r) => r.interactionRate),
        ),
        value: percentile(
          rates[i].saveRate,
          rates.map((r) => r.saveRate),
        ),
        sharing: percentile(
          rates[i].shareRate,
          rates.map((r) => r.shareRate),
        ),
        conversation: percentile(
          rates[i].commentRate,
          rates.map((r) => r.commentRate),
        ),
      } satisfies Record<InstagramPerformanceDimension, number | null>,
    ]),
  )
}
export function dimensionLabel(value: number | null) {
  return value === null
    ? { label: 'Sem comparação', tone: 'medium', symbol: '—' }
    : value >= 75
      ? { label: 'Excelente', tone: 'excellent', symbol: '🔥' }
      : value > 50
        ? { label: 'Alto', tone: 'good', symbol: '●' }
        : value >= 25
          ? { label: 'Médio', tone: 'medium', symbol: '●' }
          : { label: 'Baixo', tone: 'weak', symbol: '●' }
}

export function highlights(posts: InstagramPostAnalytics[]) {
  const result = new Map<
    string,
    { post: InstagramPostAnalytics; achievements: string[] }
  >()
  const criteria: [string, (post: InstagramPostAnalytics) => number | null][] =
    [
      ['Maior alcance', (p) => p.metrics.reach],
      ['Mais visualizações', (p) => p.metrics.views],
      ['Maior engajamento proporcional', (p) => derived(p).interactionRate],
      ['Mais salvo', (p) => p.metrics.saved],
      ['Maior proporção de salvamentos', (p) => derived(p).saveRate],
      ['Mais compartilhado', (p) => p.metrics.shares],
      ['Maior proporção de compartilhamentos', (p) => derived(p).shareRate],
      ['Maior conversa proporcional', (p) => derived(p).commentRate],
    ]
  for (const [label, get] of criteria) {
    const values = posts.map(get).filter((v): v is number => v !== null)
    if (!values.length) continue
    const max = Math.max(...values)
    if (max <= 0 || values.every((v) => v === max)) continue
    for (const post of posts.filter((p) => get(p) === max)) {
      const item = result.get(post.id) ?? { post, achievements: [] }
      item.achievements.push(label)
      result.set(post.id, item)
    }
  }
  return [...result.values()]
}

// Só propõe hipótese se a liderança for única, concordar em média/mediana e não tiver divergência >50%.
export function evidence(
  group: InstagramFormatSummary[],
  get: (g: InstagramFormatSummary) => Statistic,
) {
  const eligible = group.filter((g) => get(g).n >= MIN_SAMPLE)
  const sorted = [...eligible].sort((a, b) => get(b).mean! - get(a).mean!)
  if (sorted.length < 2) return null
  const best = sorted[0]
  const stable =
    !get(best).divergent &&
    get(best).mean! > get(sorted[1]).mean! &&
    eligible.every((g) => g === best || get(best).median! > get(g).median!)
  return {
    best,
    stable,
    sample: get(best).n,
    excluded: group.filter((g) => g.count > 0 && get(g).n < MIN_SAMPLE).length,
  }
}
export function buildInstagramInsights(
  posts: InstagramPostAnalytics[],
): InstagramInsight[] {
  const formats = groups(posts, 'format')
  const hours = groups(posts, 'hour')
  const insights: InstagramInsight[] = []
  for (const [id, title, grouped, get, description] of [
    [
      'discovery',
      'O que está trazendo alcance',
      formats,
      (g: InstagramFormatSummary) => g.metrics.reach,
      'pessoas alcançadas por publicação',
    ],
    [
      'engagement',
      'O que está envolvendo o público',
      formats,
      (g: InstagramFormatSummary) => g.interactionRate,
      'interações em relação ao alcance',
    ],
    [
      'time',
      'Uma oportunidade para testar',
      hours,
      (g: InstagramFormatSummary) => g.interactionRate,
      'interações em relação ao alcance',
    ],
  ] as const) {
    const observation = evidence(grouped, get)
    if (!observation) {
      insights.push({
        id,
        title,
        finding: `Ainda não há dois grupos com pelo menos ${MIN_SAMPLE} publicações válidas para comparar ${description}.`,
        nextTest:
          'Reúna mais publicações comparáveis antes de escolher um formato ou horário.',
      })
      continue
    }
    const { best, stable, sample } = observation
    insights.push({
      id,
      title,
      finding: `${best.label}: ${stable ? 'maior média' : 'uma das maiores médias'} de ${description} entre grupos com pelo menos ${MIN_SAMPLE} publicações válidas (${sample} neste grupo).${stable ? '' : ' O resultado não se confirma de forma consistente nos valores centrais; algumas publicações podem influenciar a média.'}`,
      hypothesis: stable
        ? `${id === 'time' ? 'Publicar às' : 'Explorar o formato'} ${best.label} pode ser uma possibilidade; esta associação não demonstra a causa do resultado.`
        : undefined,
      nextTest: stable
        ? `Compare novas publicações ${id === 'time' ? 'às' : 'no formato'} ${best.label.toLowerCase()} com outro ${id === 'time' ? 'horário' : 'formato'}, mantendo assunto e tempo de observação semelhantes. Reúna pelo menos 3 em cada grupo e confira se o padrão se repete.`
        : 'Amplie os grupos e compare publicações com tempo de exposição semelhante antes de priorizar uma opção.',
    })
  }
  const small = formats
    .filter((g) => g.count > 0 && g.count < MIN_SAMPLE)
    .map((g) => `${g.label}: ${g.count}`)
  insights.push({
    id: 'unknown',
    title: 'O que ainda não sabemos',
    finding: `Analisamos ${posts.length} publicações.${small.length ? ` Amostra insuficiente por formato: ${small.join('; ')}.` : ''} Esses dados não mostram quais conteúdos geraram clientes ou agendamentos.`,
  })
  return insights
}
