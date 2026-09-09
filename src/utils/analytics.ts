import type {
  BusinessInsight,
  DashboardMetrics,
  SocialPost,
} from '../types/analytics.js'

export const number = (value: number) =>
  new Intl.NumberFormat('pt-BR').format(value)
export const percent = (value: number, digits = 1) =>
  `${value.toLocaleString('pt-BR', { maximumFractionDigits: digits })}%`
export const rate = (value: number, total: number) =>
  total > 0 ? (value / total) * 100 : 0
export const change = (current: number, previous: number) =>
  previous > 0 ? ((current - previous) / previous) * 100 : null

// Heurística inicial: ações ponderadas / alcance * 100. Curtidas não entram.
// Salvos=2, compartilhamentos=3, perfil=1, site=4, WhatsApp=6.
// ponytail: limiares experimentais; calibrar com histórico real e tamanho da amostra.
export function scorePost(post: SocialPost) {
  return rate(
    2 * post.saves +
      3 * post.shares +
      post.profileVisits +
      4 * post.websiteClicks +
      6 * post.whatsappClicks,
    post.reach,
  )
}

export function classifyPost(post: SocialPost) {
  const score = scorePost(post)
  if (score >= 40)
    return { label: 'Excelente', symbol: '🔥', tone: 'excellent' }
  if (score >= 20) return { label: 'Bom', symbol: '●', tone: 'good' }
  if (score >= 8) return { label: 'Médio', symbol: '●', tone: 'medium' }
  return { label: 'Fraco', symbol: '●', tone: 'weak' }
}

export const postDate = (value: string) =>
  new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    timeZone: 'America/Sao_Paulo',
  })

export function postHour(post: SocialPost) {
  return Number(
    new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      hourCycle: 'h23',
      timeZone: 'America/Sao_Paulo',
    }).format(new Date(post.publishedAt)),
  )
}

export function hourRange(post: SocialPost) {
  const hour = postHour(post)
  if (hour < 9) return '00h – 09h'
  if (hour < 12) return '09h – 12h'
  if (hour < 15) return '12h – 15h'
  if (hour < 18) return '15h – 18h'
  if (hour < 21) return '18h – 21h'
  return '21h – 24h'
}

export function rankGroups(
  posts: SocialPost[],
  group: (post: SocialPost) => string,
  metric: 'reach' | 'saves' | 'shares' = 'reach',
) {
  const groups = new Map<string, { total: number; count: number }>()
  for (const post of posts) {
    const key = group(post)
    const entry = groups.get(key) ?? { total: 0, count: 0 }
    groups.set(key, {
      total: entry.total + post[metric],
      count: entry.count + 1,
    })
  }
  return [...groups]
    .map(([label, { total, count }]) => ({
      label,
      average: total / count,
      count,
    }))
    .sort(
      (a, b) =>
        b.average - a.average || a.label.localeCompare(b.label, 'pt-BR'),
    )
}

export const weekDay = (post: SocialPost) =>
  new Date(post.publishedAt).toLocaleDateString('pt-BR', {
    weekday: 'long',
    timeZone: 'America/Sao_Paulo',
  })

export function buildInsights(
  posts: SocialPost[],
  metrics: DashboardMetrics,
): BusinessInsight[] {
  const insights: BusinessInsight[] = []
  const shares = rankGroups(posts, (post) => post.category, 'shares')
  const saves = rankGroups(posts, (post) => post.category, 'saves')
  const hours = rankGroups(posts, hourRange)
  const formats = rankGroups(posts, (post) => post.type)
  if (shares.length > 1 && shares[1].average > 0)
    insights.push({
      id: 'shares',
      symbol: '↗',
      title: `${shares[0].label} se destaca`,
      description: `${(shares[0].average / shares[1].average).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}× mais compartilhamentos por publicação que ${shares[1].label.toLowerCase()}, a segunda categoria.`,
    })
  if (hours.length)
    insights.push({
      id: 'hours',
      symbol: '◷',
      title: `Experimente postar às ${hours[0].label}`,
      description: `Essa faixa teve o maior alcance médio: ${number(Math.round(hours[0].average))} por publicação (${hours[0].count} publicações).`,
    })
  const reels = formats.find((format) => format.label === 'Reel')
  const staticPosts = formats.find((format) => format.label === 'Post')
  if (reels && staticPosts && staticPosts.average > 0) {
    const difference = change(reels.average, staticPosts.average) ?? 0
    insights.push({
      id: 'formats',
      symbol: '▷',
      title: `Reels alcançaram ${percent(Math.abs(difference), 0)} ${difference >= 0 ? 'mais' : 'menos'}`,
      description:
        'Comparação do alcance médio por publicação com posts estáticos neste período.',
    })
  }
  if (saves.length)
    insights.push({
      id: 'saves',
      symbol: '◇',
      title: `${saves[0].label} lidera em salvamentos`,
      description: `${number(Math.round(saves[0].average))} salvamentos por publicação, em média. Vale explorar novos conteúdos dessa categoria.`,
    })
  if (metrics.websiteVisits > 0)
    insights.push({
      id: 'conversion',
      symbol: '↗',
      title: `${percent(rate(metrics.whatsappClicks, metrics.websiteVisits))} de cliques por visita`,
      description: `${number(metrics.whatsappClicks)} cliques no WhatsApp em ${number(metrics.websiteVisits)} visitas ao site. Cliques não confirmam conversas ou agendamentos.`,
    })
  return insights
}
