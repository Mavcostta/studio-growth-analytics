import type { GA4State } from '../hooks/useGA4'
import {
  ga4Number,
  ga4Comparison,
  type GA4Section,
} from '../services/analytics/ga4'
import { GA4Chart } from './GA4Chart'
import { MetricCard } from './MetricCard'
import { InsightCard } from './InsightCard'
import { buildSiteInsights } from '../utils/siteInsights'
import styles from '../styles/dashboard.module.css'

function Comparison({
  current,
  previous,
}: {
  current: string | null
  previous: string | null | undefined
}) {
  const delta = ga4Comparison(current, previous)
  return (
    <small>
      {delta === null
        ? 'Sem base de comparação'
        : `${delta > 0 ? '+' : ''}${delta.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% vs. 7 dias anteriores`}
    </small>
  )
}

function WhatsappPages({
  section,
  cta = false,
}: {
  section?: GA4Section
  cta?: boolean
}) {
  return (
    <details className={styles.dataDetails}>
      <summary>
        {cta ? 'CTAs associados ao WhatsApp' : 'Páginas associadas ao WhatsApp'}
      </summary>
      {section?.dimension && (
        <p className={styles.footnote}>
          Dimensão registrada: {section.dimension}
        </p>
      )}
      {section?.message && <p className={styles.footnote}>{section.message}</p>}
      {section?.rows.length ? (
        <div className={styles.dailyTable}>
          <table>
            <caption>
              Eventos whatsapp_click por {cta ? 'página e CTA' : 'página'}
            </caption>
            <thead>
              <tr>
                <th scope="col">Página</th>
                {cta && <th scope="col">CTA</th>}
                <th scope="col">Cliques</th>
              </tr>
            </thead>
            <tbody>
              {section.rows.map((row, i) => (
                <tr key={i}>
                  <td>{row.page ?? 'Não informada'}</td>
                  {cta && <td>{row.cta ?? 'Não informado'}</td>}
                  <td>{ga4Number(row.eventCount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>
          {section?.status === 'empty'
            ? 'Nenhuma linha retornada no período.'
            : 'Dados indisponíveis.'}
        </p>
      )}
    </details>
  )
}

export function Analytics({
  state,
  retry,
}: {
  state: GA4State
  retry: () => void
}) {
  const data = state.status === 'ready' ? state.data : null
  const previous =
    data?.details?.previousMetrics.status === 'ready'
      ? data.details.previousMetrics.rows[0]
      : undefined
  const previousEvents =
    data?.details?.previousEvents.status === 'ready'
      ? data.details.previousEvents.rows
      : []
  return (
    <section
      className={styles.simulatedSection}
      aria-label="Google Analytics real"
      aria-busy={state.status === 'loading'}
    >
      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.eyebrow}>SITE · GOOGLE ANALYTICS 4</span>
          <h2>Site e cliques no WhatsApp</h2>
        </div>
        <span className={styles.demoBadge}>7 dias completos · até ontem</span>
      </div>
      <p className={styles.periodNote}>
        Dados do GA4 no fuso da propriedade. Cliques são eventos do site, não
        conversas nem agendamentos.
        {data?.timezone && ` Fuso: ${data.timezone}.`}
      </p>
      {state.status === 'loading' && (
        <p role="status">Consultando dados reais do GA4…</p>
      )}
      {state.status === 'error' && (
        <div role="alert">
          <p>{state.message}</p>
          <button onClick={retry}>Tentar novamente</button>
        </div>
      )}
      {data?.status === 'empty' && (
        <p role="status">O GA4 não retornou dados para este período.</p>
      )}
      {data?.status === 'partial' && (
        <p role="status">
          Resposta parcial: alguns campos ou relatórios estão indisponíveis ou
          limitados pelo GA4. Ausência não significa zero.
        </p>
      )}
      <section className={styles.metricsGrid} aria-label="Métricas do GA4">
        {(
          [
            ['activeUsers', 'Usuários ativos'],
            ['sessions', 'Sessões'],
            ['screenPageViews', 'Visualizações de páginas'],
          ] as const
        ).map(([key, label]) => (
          <MetricCard
            key={key}
            label={label}
            value={data ? ga4Number(data.metrics[key]) : '—'}
            delta={ga4Comparison(data?.metrics[key], previous?.[key])}
            icon="globe"
          />
        ))}
      </section>
      <div className={styles.chartGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHeading}>
            <div>
              <h2>Eventos no site</h2>
              <p>
                Total de eventos registrados no período:{' '}
                <strong>
                  {data ? ga4Number(data.metrics.eventCount) : '—'}
                </strong>
              </p>
              {data && (
                <Comparison
                  current={data.metrics.eventCount}
                  previous={previous?.eventCount}
                />
              )}
            </div>
          </div>
          <GA4Chart data={data} />
        </section>
        <section className={styles.panel}>
          <div className={styles.panelHeading}>
            <div>
              <h2>Ações no site</h2>
              <p>Contagem de eventos, sem atribuição entre etapas.</p>
            </div>
          </div>
          <ul className={styles.funnel}>
            {(
              [
                ['whatsapp_click', 'Cliques no WhatsApp'],
                ['select_service', 'Seleções de serviço'],
                ['scroll_depth', 'Eventos de rolagem'],
              ] as const
            ).map(([key, label]) => (
              <li key={key}>
                <div className={styles.funnelStep}>
                  <span>{label}</span>
                  <strong>{data ? ga4Number(data.events[key]) : '—'}</strong>
                </div>
                {data && (
                  <Comparison
                    current={data.events[key]}
                    previous={
                      previousEvents.find((row) => row.event === key)
                        ?.eventCount
                    }
                  />
                )}
              </li>
            ))}
          </ul>
          <p className={styles.footnote}>
            Um usuário pode gerar vários eventos. Sem dados significa que
            nenhuma linha foi retornada.
          </p>
          <WhatsappPages section={data?.details?.pages} />
          <WhatsappPages section={data?.details?.ctas} cta />
        </section>
      </div>
      <div className={styles.insightsSection}>
        <section className={styles.panel}>
          <div className={styles.panelHeading}>
            <div>
              <h2>De onde vêm as visitas?</h2>
              <p>Origem / mídia da sessão · últimos 7 dias completos.</p>
            </div>
          </div>
          {data?.details?.sources.message && (
            <p className={styles.footnote}>{data.details.sources.message}</p>
          )}
          {data?.details?.sources.rows.length ? (
            <ul className={styles.sourceList}>
              {data.details.sources.rows.map((row, i) => (
                <li key={i}>
                  <div>
                    <span>{row.source ?? 'Origem não informada'}</span>
                    <strong>{ga4Number(row.sessions)} sessões</strong>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              {data?.details?.sources.status === 'empty'
                ? 'Nenhuma origem retornada no período.'
                : 'Origens de tráfego indisponíveis nesta consulta.'}
            </p>
          )}
        </section>
      </div>
      <section
        className={styles.insightsSection}
        aria-labelledby="site-insights-title"
      >
        <div className={styles.sectionHeading}>
          <h2 id="site-insights-title">
            O que os dados do site estão nos contando?
          </h2>
        </div>
        {data ? (
          <div className={styles.insightsGrid}>
            {buildSiteInsights(data).map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        ) : (
          <p>
            {state.status === 'loading'
              ? 'Aguardando os dados do GA4 para analisar o site…'
              : 'Insights indisponíveis enquanto a consulta ao GA4 não puder ser concluída.'}
          </p>
        )}
      </section>
    </section>
  )
}
