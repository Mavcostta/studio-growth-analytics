import type { SafeError } from './index.js'

export type InstagramContentType =
  'reel' | 'image' | 'carousel' | 'video' | 'unknown'
export const metricNames = [
  'reach',
  'views',
  'saved',
  'shares',
  'likes',
  'comments',
  'totalInteractions',
] as const
export type MetricName = (typeof metricNames)[number]
export type MetricState =
  'available' | 'unavailable' | 'no_data' | 'error' | 'not_tested'
export interface InstagramPostAnalytics {
  id: string
  caption?: string
  username?: string
  contentType: InstagramContentType
  mediaType?: string
  mediaProductType?: string
  // Timestamp original, sem reescrita. Ausência/valor inválido não vira data inventada.
  publishedAt?: string
  publishedDate: string | null
  publishedHour: number | null
  dayOfWeek: number | null // ISO: segunda=1, domingo=7, em America/Sao_Paulo.
  permalink?: string
  thumbnailUrl?: string
  mediaUrl?: string
  fieldsReceived: string[]
  omittedUrlFields: string[]
  metrics: Record<MetricName, number | null>
  metricStatus: Record<MetricName, MetricState>
  metricErrors: Partial<Record<MetricName, SafeError>>
  issues: string[]
}
