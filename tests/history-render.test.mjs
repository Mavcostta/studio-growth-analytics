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
    assert.match(overview(), /aria-label="Aumento"/)
    assert.match(
      overview().replace(/<[^>]+>/g, ''),
      /1 seguidor desde a última atualização/,
    )
    assert.match(overview(), /Sem mudança desde a última atualização/)
    assert.doesNotMatch(
      overview().replace(/<details[\s\S]*<\/details>/g, ''),
      /%|07\/09\/2026/,
    )
    assert.match(overview(), /07\/09\/2026, 09:00/)
    assert.doesNotMatch(overview(), /desde ontem/i)
    history.comparison.changes.followers_count = {
      difference: -1,
      percent: null,
      direction: 'decrease',
    }
    assert.match(overview(), /aria-label="Queda"/)
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

    const { SiteOverview } = await vite.ssrLoadModule(
      '/src/components/SiteOverview.tsx',
    )
    const { pageName, sourceName, updatedLabel } = await vite.ssrLoadModule(
      '/src/utils/presentation.ts',
    )
    assert.equal(
      updatedLabel('2026-09-10T02:36:00Z', new Date('2026-09-10T02:59:00Z')),
      'Atualizado hoje às 23:36',
    )
    assert.match(
      updatedLabel('2026-09-10T02:36:00Z', new Date('2026-09-10T03:01:00Z')),
      /09\/09\/2026/,
    )
    assert.equal(pageName('/index.html'), 'Página inicial')
    assert.equal(pageName('/'), 'Página inicial')
    assert.equal(
      pageName('/extensao-cilios-guarulhos.html'),
      'Extensão de cílios',
    )
    assert.equal(
      pageName('/design-sobrancelhas-guarulhos.html'),
      'Design de sobrancelhas',
    )
    assert.equal(pageName('/unknown?private'), 'Outra página')
    assert.equal(sourceName('google / organic'), 'Google')
    assert.equal(sourceName('ig / social'), 'Instagram')
    assert.equal(sourceName('(direct) / (none)'), 'Acesso direto')
    assert.equal(sourceName('unknown'), 'Outra origem')
    history.points[0].metrics = {
      activeUsers: 3,
      sessions: 5,
      screenPageViews: 10,
      whatsapp_click: 8,
    }
    history.points[0].sources = [
      {
        label: 'ig / social',
        denominator: 2,
        clicks: 8,
        rate: 400,
        partial: false,
      },
    ]
    history.points[0].pages = [
      {
        label: '/index.html',
        denominator: 3,
        clicks: 8,
        rate: 266,
        partial: false,
      },
      { label: '/', denominator: 7, clicks: null, rate: null, partial: false },
    ]
    const site = () =>
      renderToStaticMarkup(
        createElement(SiteOverview, { state, retry: () => {} }),
      )
    const visible = site().replace(/<details[\s\S]*<\/details>/g, '')
    assert.match(visible, /Seu site/)
    assert.match(visible, /De onde vieram seus visitantes/)
    assert.match(visible, /O que as pessoas mais visitaram/)
    assert.match(visible, /Interesse em agendar/)
    assert.match(visible, /acessos ao WhatsApp/)
    assert.equal((visible.match(/Página inicial/g) ?? []).length, 2)
    assert.match(visible, /Instagram/)
    assert.doesNotMatch(
      visible.replace(/<[^>]+>/g, ''),
      /GA4|source|medium|ig \/ social|index.html|whatsapp_click|amostra pequena|%|taxa de clique/i,
    )
    history.points[0].metrics.whatsapp_click = null
    assert.match(site(), /Indisponível/)
    history.points[0].metrics.whatsapp_click = 0
    assert.match(site(), />0<\/strong>/)
    const { default: Dashboard } = await vite.ssrLoadModule(
      '/src/pages/Dashboard/index.tsx',
    )
    const dashboard = renderToStaticMarkup(
      createElement(Dashboard, {
        analytics: { status: 'loading' },
        retryAnalytics: () => {},
        instagram: { status: 'error', message: 'POSTS_DETAIL_ONLY' },
        retry: () => {},
      }),
    )
    let detailDepth = 0
    const primaryText = dashboard
      .split(/(<[^>]+>)/)
      .filter((part) => {
        if (/^<details\b/.test(part)) {
          detailDepth++
          return false
        }
        if (/^<\/details>/.test(part)) {
          detailDepth--
          return false
        }
        return detailDepth === 0 && !part.startsWith('<')
      })
      .join(' ')
    assert.equal((primaryText.match(/Seu Instagram hoje/g) ?? []).length, 1)
    assert.equal((primaryText.match(/Seu site/g) ?? []).length, 1)
    assert.doesNotMatch(
      primaryText,
      /POSTS_DETAIL_ONLY|Google Analytics|Histórico do site|Posts analisados/,
    )
  } finally {
    await vite.close()
  }
})
