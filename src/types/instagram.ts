export type InstagramContentType =
  'reel' | 'image' | 'carousel' | 'video' | 'unknown'
export const instagramMetricNames = [
  'reach',
  'views',
  'saved',
  'shares',
  'likes',
  'comments',
  'totalInteractions',
] as const
export type InstagramMetricName = (typeof instagramMetricNames)[number]
export type InstagramMetrics = Record<InstagramMetricName, number | null>
export interface InstagramPostAnalytics {
  id: string
  caption?: string
  contentType: InstagramContentType
  publishedAt?: string
  publishedDate: string | null
  publishedHour: number | null
  dayOfWeek: number | null
  permalink?: string
  thumbnailUrl?: string
  metrics: InstagramMetrics
}
export interface InstagramAccountSummary {
  status: 'ok' | 'partial'
  username?: string
  collectedAt: string
  timezone: 'America/Sao_Paulo'
  posts: InstagramPostAnalytics[]
}
export interface InstagramDerivedMetrics {
  interactionRate: number | null
  saveRate: number | null
  shareRate: number | null
  commentRate: number | null
}
export type InstagramPerformanceDimension =
  'discovery' | 'engagement' | 'value' | 'sharing' | 'conversation'
export interface Statistic {
  n: number
  sum: number | null
  mean: number | null
  median: number | null
  divergent: boolean
}
export interface InstagramFormatSummary {
  key: string
  label: string
  count: number
  metrics: Record<InstagramMetricName, Statistic>
  interactionRate: Statistic
  globalInteractionRate: number | null
  rateSample: number
}
export type InstagramTimeSummary = InstagramFormatSummary
export interface InstagramInsight {
  id: string
  title: string
  finding: string
  hypothesis?: string
  nextTest?: string
}
