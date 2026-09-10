import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

test('histórico: loading, erro, vazio, uma coleta, comparação e taxas sem redesign', async () => {
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
  })
  try {
    const { SnapshotHistory } = await vite.ssrLoadModule(
      '/src/components/SnapshotHistory.tsx',
    )
    const render = (state, source = 'instagram') =>
      renderToStaticMarkup(
        createElement(SnapshotHistory, { state, source, retry: () => {} }),
      )
    assert.match(render({ status: 'loading' }), /Carregando histórico/)
    assert.match(render({ status: 'error' }), /role="alert"/)
    const history = {
      status: 'empty',
      message: 'Histórico sendo construído',
      points: [],
      comparison: null,
    }
    const state = {
      status: 'ready',
      data: { schemaVersion: 1, instagram: history, ga4: history },
    }
    assert.match(render(state), /Histórico sendo construído/)
    history.status = 'ready'
    history.points = [
      {
        collectedAt: '2026-09-10T12:00:00Z',
        period: { start: '2026-09-03', end: '2026-09-09', timezone: 'UTC' },
        metrics: { followers_count: 100, views: 0, profile_views: null },
        pages: [],
        sources: [],
      },
    ]
    const single = render(state)
    assert.match(single, />100<\/strong>/)
    assert.match(single, />0<\/strong>/)
    assert.match(single, /Indisponível/)
    assert.doesNotMatch(single, /Aumento:|Queda:|Estabilidade:/)
    history.message = null
    history.comparison = {
      previous: '2026-09-09T12:00:00Z',
      current: '2026-09-10T12:00:00Z',
      previousPeriod: {
        start: '2026-08-27',
        end: '2026-09-02',
        timezone: 'UTC',
      },
      currentPeriod: history.points[0].period,
      changes: {
        followers_count: {
          difference: 10,
          percent: 11.11,
          direction: 'increase',
        },
      },
    }
    assert.match(render(state), /Aumento: 10/)
    assert.match(render(state), /09\/09\/2026/)
    history.points[0].pages = [
      { label: '/', clicks: 2, denominator: 10, rate: 20, partial: false },
    ]
    const ga = render(state, 'ga4')
    assert.match(ga, /20%/)
    assert.match(ga, /Amostra pequena/)
    assert.match(ga, /27\/08\/2026/)
    assert.match(ga, /não pessoas, conversas ou agendamentos/)
  } finally {
    await vite.close()
  }
})
