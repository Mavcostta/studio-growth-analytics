import type { DailyMetrics } from '../types/analytics.js'
import { dashboardMetrics } from './dashboardMetrics.js'

// MOCK determinístico. Distribuição por diferenças acumuladas preserva os totais.
const weights = [
  7, 8, 6, 10, 11, 9, 8, 10, 12, 11, 9, 14, 12, 11, 10, 13, 16, 12, 14, 13, 16,
  18, 14, 16, 15, 18, 20, 17, 19, 21,
]
const totalWeight = weights.reduce((sum, value) => sum + value, 0)
let accumulated = 0

export const dailyMetrics: DailyMetrics[] = weights.map((weight, index) => {
  const before = accumulated
  accumulated += weight
  const portion = (total: number) =>
    Math.round((total * accumulated) / totalWeight) -
    Math.round((total * before) / totalWeight)
  return {
    date: `2026-08-${String(index + 2).padStart(2, '0')}`,
    views: portion(dashboardMetrics.views),
    reach: portion(dashboardMetrics.reach),
    newFollowers: portion(dashboardMetrics.newFollowers),
    websiteVisits: portion(dashboardMetrics.websiteVisits),
    whatsappClicks: portion(dashboardMetrics.whatsappClicks),
  }
})
