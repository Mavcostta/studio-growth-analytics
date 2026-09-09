import type { DashboardMetrics } from '../types/analytics.js'

// MOCK: dados fictícios de 02 a 31/08/2026. Não representam o negócio real.
export const dashboardMetrics: DashboardMetrics = {
  views: 8420,
  reach: 2130,
  newFollowers: 184,
  websiteVisits: 326,
  whatsappClicks: 71,
}

// Comparação fictícia com os 30 dias anteriores (03/07 a 01/08/2026).
export const previousMetrics: DashboardMetrics = {
  views: 7136,
  reach: 1902,
  newFollowers: 170,
  websiteVisits: 265,
  whatsappClicks: 58,
}
