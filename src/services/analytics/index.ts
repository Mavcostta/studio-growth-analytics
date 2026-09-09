import { dashboardMetrics, previousMetrics } from '../../mocks/dashboardMetrics'
import { dailyMetrics } from '../../mocks/dailyMetrics'
import { trafficSources } from '../../mocks/trafficSources'
import { campaigns } from '../../mocks/campaigns'
import { getPosts } from '../instagram'
import type { AnalyticsData } from '../../types/analytics'

export function getAnalytics(): AnalyticsData {
  return {
    current: dashboardMetrics,
    previous: previousMetrics,
    daily: dailyMetrics,
    posts: getPosts(),
    sources: trafficSources,
    campaigns,
  }
}
