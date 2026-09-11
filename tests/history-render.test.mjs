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

    const { InstagramOverview } = await vite.ssrLoadModule(
      '/src/components/InstagramOverview.tsx',
    )
    const overview = () =>
      renderToStaticMarkup(
        createElement(InstagramOverview, { state, retry: () => {} }),
      )
    history.comparison = null
    history.points[0].collectedAt = '2026-09-10T02:00:00Z'
    const onlyOne = overview()
    assert.match(onlyOne, /Seu Instagram hoje/)
    assert.match(onlyOne, />100<\/strong>/)
    assert.match(onlyOne, /Histórico sendo construído/)
    assert.match(onlyOne, /09\/09\/2026, 23:00/)
    assert.match(onlyOne, /Sobre estes dados/)
    const primary = onlyOne.replace(/<details[\s\S]*<\/details>/g, '')
    assert.doesNotMatch(
      primary,
      /snapshots|UTC|observação armazenada|valor do período informado pela Meta|<svg|<canvas/i,
    )
    assert.match(primary, /Indisponível/)
    assert.match(primary, />0<\/strong>/)
    history.comparison = {
      previous: '2026-09-07T12:00:00Z',
      current: '2026-09-10T02:00:00Z',
      previousPeriod: {
        start: '2026-09-06T00:00:00Z',
        end: '2026-09-07T00:00:00Z',
        timezone: 'UTC',
      },
      changes: {
        followers_count: {
          difference: 1,
          percent: 0.05,
          direction: 'increase',
        },
        views: { difference: 0, percent: null, direction: 'stable' },
      },
    }
    assert.match(overview(), /Aumento de 1/)
    assert.match(overview(), /\+0,05/)
    assert.match(overview(), /Estabilidade/)
    assert.match(overview(), /07\/09\/2026, 09:00/)
    assert.doesNotMatch(overview(), /desde ontem/i)
    history.comparison.changes.followers_count = {
      difference: -1,
      percent: null,
      direction: 'decrease',
    }
    assert.match(overview(), /Queda de 1/)
    assert.doesNotMatch(overview(), /%/)
    history.status = 'partial'
    history.comparison = null
    assert.match(overview(), /Alguns dados não puderam/)
    assert.match(overview(), />100<\/strong>/)
    for (const status of ['loading', 'error']) {
      const html = renderToStaticMarkup(
        createElement(InstagramOverview, {
          state: { status },
          retry: () => {},
        }),
      )
      assert.match(
        html,
        status === 'loading' ? /Carregando os dados/ : /role="alert"/,
      )
    }
  } finally {
    await vite.close()
  }
})
