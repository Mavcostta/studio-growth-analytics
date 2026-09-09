import {
  metricNames,
  type InstagramContentType,
  type InstagramPostAnalytics,
  type MetricName,
  type MetricState,
} from './types.js'

export function summarizePosts(posts: InstagramPostAnalytics[]) {
  const types: InstagramContentType[] = [
    'reel',
    'image',
    'carousel',
    'video',
    'unknown',
  ]
  const states: MetricState[] = [
    'available',
    'unavailable',
    'no_data',
    'error',
    'not_tested',
  ]
  const byType = Object.fromEntries(
    types.map((type) => {
      const group = posts.filter((post) => post.contentType === type)
      return [
        type,
        {
          count: group.length,
          metrics: Object.fromEntries(
            metricNames.map((metric) => [
              metric,
              Object.fromEntries(
                states.map((state) => [
                  state,
                  group.filter((post) => post.metricStatus[metric] === state)
                    .length,
                ]),
              ),
            ]),
          ),
        },
      ]
    }),
  )
  const winners = (metric: MetricName) => {
    const available = posts.filter(
      (post) =>
        post.metricStatus[metric] === 'available' &&
        post.metrics[metric] !== null,
    )
    if (!available.length) return null
    const value = Math.max(...available.map((post) => post.metrics[metric]!))
    return {
      value,
      posts: available
        .filter((post) => post.metrics[metric] === value)
        .map((post) => ({
          id: post.id,
          contentType: post.contentType,
          permalink: post.permalink,
        })),
    }
  }
  const dated = posts
    .filter((post) => post.publishedDate !== null && post.publishedAt)
    .sort((a, b) => Date.parse(b.publishedAt!) - Date.parse(a.publishedAt!))
  return {
    byType,
    leaders: Object.fromEntries(
      (['reach', 'views', 'saved', 'shares'] as const).map((metric) => [
        metric,
        winners(metric),
      ]),
    ),
    mostRecent: dated[0]
      ? {
          id: dated[0].id,
          publishedAt: dated[0].publishedAt,
          publishedDate: dated[0].publishedDate,
          publishedHour: dated[0].publishedHour,
          permalink: dated[0].permalink,
        }
      : null,
    byDayOfWeek: Object.fromEntries(
      Array.from({ length: 7 }, (_, i) => [
        i + 1,
        posts.filter((post) => post.dayOfWeek === i + 1).length,
      ]),
    ),
    byHour: Object.fromEntries(
      Array.from({ length: 24 }, (_, hour) => [
        hour,
        posts.filter((post) => post.publishedHour === hour).length,
      ]),
    ),
    missingDateCount: posts.filter((post) => post.publishedDate === null)
      .length,
  }
}
