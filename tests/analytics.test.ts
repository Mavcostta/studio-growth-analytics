import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildInsights,
  change,
  classifyPost,
  hourRange,
  rankGroups,
  rate,
  scorePost,
  weekDay,
} from '../src/utils/analytics.js'
import { dashboardMetrics } from '../src/mocks/dashboardMetrics.js'
import { dailyMetrics } from '../src/mocks/dailyMetrics.js'
import { posts } from '../src/mocks/posts.js'
import { trafficSources } from '../src/mocks/trafficSources.js'

test('totais, classificação, fuso, médias e insights consistentes', () => {
  assert.equal(dailyMetrics.length, 30)
  assert.equal(new Set(dailyMetrics.map((day) => day.date)).size, 30)
  for (const key of [
    'views',
    'reach',
    'newFollowers',
    'websiteVisits',
    'whatsappClicks',
  ] as const) {
    assert.equal(
      dailyMetrics.reduce((sum, day) => sum + day[key], 0),
      dashboardMetrics[key],
    )
  }
  assert.equal(
    trafficSources.reduce((sum, source) => sum + source.visits, 0),
    dashboardMetrics.websiteVisits,
  )
  assert.equal(
    trafficSources.reduce((sum, source) => sum + source.whatsappClicks, 0),
    dashboardMetrics.whatsappClicks,
  )
  assert.equal(rate(10, 0), 0)
  assert.equal(change(10, 0), null)
  assert.equal(change(80, 100), -20)
  assert.equal(rate(25, 100), 25)
  const empty = {
    ...posts[0],
    reach: 100,
    saves: 0,
    shares: 0,
    profileVisits: 0,
    websiteClicks: 0,
    whatsappClicks: 0,
  }
  for (const [score, label] of [
    [0, 'Fraco'],
    [8, 'Médio'],
    [20, 'Bom'],
    [40, 'Excelente'],
  ] as const) {
    assert.equal(classifyPost({ ...empty, profileVisits: score }).label, label)
  }
  assert.equal(scorePost({ ...empty, likes: 10000 }), 0)
  assert.equal(scorePost({ ...empty, reach: 0, whatsappClicks: 10 }), 0)
  assert.equal(
    scorePost({
      ...empty,
      saves: 2,
      shares: 3,
      profileVisits: 4,
      websiteClicks: 5,
      whatsappClicks: 6,
    }),
    73,
  )
  assert.equal(
    hourRange({ ...empty, publishedAt: '2026-08-21T01:00:00Z' }),
    '21h – 24h',
  )
  assert.equal(
    weekDay({ ...empty, publishedAt: '2026-08-21T01:00:00Z' }),
    'quinta-feira',
  )
  assert.equal(
    hourRange({ ...empty, publishedAt: '2026-08-20T21:00:00-03:00' }),
    '21h – 24h',
  )
  const ranks = rankGroups(
    [
      { ...empty, type: 'Post', reach: 100 },
      { ...empty, type: 'Post', reach: 100 },
      { ...empty, type: 'Reel', reach: 150 },
    ],
    (post) => post.type,
  )
  assert.equal(ranks[0].label, 'Reel')
  assert.equal(ranks[0].average, 150)
  assert.deepEqual(rankGroups([], hourRange), [])
  assert.deepEqual(
    buildInsights([], { ...dashboardMetrics, websiteVisits: 0 }),
    [],
  )
  assert.equal(buildInsights(posts, dashboardMetrics).length, 5)
  assert.notDeepEqual(
    buildInsights(posts, dashboardMetrics),
    buildInsights(posts, { ...dashboardMetrics, whatsappClicks: 0 }),
  )
  assert.ok(
    buildInsights(posts, dashboardMetrics).every(
      (insight) => !/NaN|Infinity|undefined/.test(insight.description),
    ),
  )
})
