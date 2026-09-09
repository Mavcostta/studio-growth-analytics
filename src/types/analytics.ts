export type UTMSource = 'instagram' | 'google' | 'direct' | 'other'

export interface Campaign {
  id: string
  name: string
  source: UTMSource
  medium: string
  content?: string
}

export interface SocialPost {
  id: string
  title: string
  type: 'Reel' | 'Carrossel' | 'Post'
  category: 'Antes e depois' | 'Educativo' | 'Bastidores' | 'Serviços'
  publishedAt: string
  reach: number
  likes: number
  saves: number
  shares: number
  profileVisits: number
  websiteClicks: number
  whatsappClicks: number
}

export interface DailyMetrics {
  date: string
  views: number
  reach: number
  newFollowers: number
  websiteVisits: number
  whatsappClicks: number
}

export interface TrafficSource {
  source: UTMSource
  label: string
  visits: number
  whatsappClicks: number
}

export interface ConversionMetric {
  id: string
  label: string
  value: number
}

export interface BusinessInsight {
  id: string
  symbol: string
  title: string
  description: string
}

export interface DashboardMetrics {
  views: number
  reach: number
  newFollowers: number
  websiteVisits: number
  whatsappClicks: number
}

export interface AnalyticsData {
  current: DashboardMetrics
  previous: DashboardMetrics
  daily: DailyMetrics[]
  posts: SocialPost[]
  sources: TrafficSource[]
  campaigns: Campaign[]
}
