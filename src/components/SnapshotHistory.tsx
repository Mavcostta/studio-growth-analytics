import type {
  Change,
  Period,
  Ranking,
  Source,
} from '../../server/history-model'
import type { HistoryState } from '../hooks/useHistory'
import styles from '../styles/dashboard.module.css'

const number = (n: number | null | undefined) =>
  n == null
    ? 'Indisponível'
    : n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
const date = (s: string) => s.slice(0, 10).split('-').reverse().join('/')
const time = (s: string) =>
  new Date(s).toLocaleString('pt-BR', { timeZone: 'UTC' }) + ' UTC'
const period = (p: Period | null) =>
  p
    ? `${date(p.start)} a ${date(p.end)} (${p.timezone}${p.start.includes('T') ? '; término exclusivo' : ''})`
    : 'Período indisponível'
function variation(c?: Change) {
  if (!c || c.difference === null)
    return 'Histórico sendo construído — sem base comparável'
  return `${c.direction === 'increase' ? 'Aumento' : c.direction === 'decrease' ? 'Queda' : 'Estabilidade'}: ${number(c.difference)} · ${c.percent === null ? '% indisponível (base zero)' : `${number(c.percent)}%`}`
}
const labels: Record<Source, [string, string][]> = {
  instagram: [
    ['followers_count', 'Seguidores atuais na última coleta'],
    ['profile_views', 'Visitas ao perfil'],
    ['reach', 'Contas alcançadas'],
    ['accounts_engaged', 'Contas engajadas'],
    ['views', 'Visualizações'],
    ['total_interactions', 'Interações'],
    ['profile_links_taps', 'Toques em links'],
    ['follows', 'Novos seguidores informados pela Meta'],
    ['unfollows', 'Saídas informadas pela Meta'],
  ],
  ga4: [
    ['activeUsers', 'Usuários ativos'],
    ['sessions', 'Sessões'],
    ['screenPageViews', 'Visualizações de páginas'],
    ['whatsapp_click', 'Cliques no WhatsApp'],
  ],
}

function Ranks({
  rows,
  title,
  rates,
  unit,
}: {
  rows: Ranking[]
  title: string
  rates?: boolean
  unit: string
}) {
  const values = rows
    .filter((r) => (rates ? r.rate !== null : r.denominator !== null))
    .sort((a, b) =>
      rates ? b.rate! - a.rate! : b.denominator! - a.denominator!,
    )
    .slice(0, 5)
  return (
    <section className={styles.panel}>
      <h3>{title}</h3>
      {values.length ? (
        <ul className={styles.sourceList}>
          {values.map((r) => (
            <li key={r.label}>
              <div>
                <span>{r.label}</span>
                <strong>
                  {rates
                    ? `${number(r.rate)}%`
                    : `${number(r.denominator)} ${unit}`}
                </strong>
              </div>
              <p className={styles.footnote}>
                {r.clicks === null
                  ? 'Cliques indisponíveis'
                  : `${number(r.clicks)} cliques no WhatsApp`}{' '}
                · {number(r.denominator)} {unit}
                {r.partial ? ' · Relatório parcial; taxa indisponível.' : ''}
                {r.denominator !== null && r.denominator < 30
                  ? ' · Amostra pequena.'
                  : ''}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p>Dados insuficientes para esta lista.</p>
      )}
    </section>
  )
}

export function SnapshotHistory({
  source,
  state,
  retry,
}: {
  source: Source
  state: HistoryState
  retry: () => void
}) {
  const title =
    source === 'instagram'
      ? 'Histórico da conta Instagram'
      : 'Histórico do site'
  const history = state.status === 'ready' ? state.data[source] : null
  const current = history?.points.at(-1)
  const comparison = history?.comparison
  return (
    <section
      className={styles.insightsSection}
      aria-label={title}
      aria-busy={state.status === 'loading'}
    >
      <div className={styles.sectionHeading}>
        <h2>{title}</h2>
        <button className={styles.actionButton} onClick={retry}>
          Atualizar histórico
        </button>
      </div>
      {state.status === 'loading' && (
        <p role="status">Carregando histórico armazenado…</p>
      )}
      {(state.status === 'error' || history?.status === 'unavailable') && (
        <p role="alert">Histórico indisponível. Tente atualizar novamente.</p>
      )}
      {history?.message && history.status !== 'unavailable' && (
        <p role="status" className={styles.notice}>
          {history.message}
        </p>
      )}
      {current && (
        <>
          <p className={styles.periodNote}>
            Última coleta armazenada: {time(current.collectedAt)}.{' '}
            {history!.points.length} snapshots disponíveis nesta leitura.
            <br />
            Período das métricas: {period(current.period)}.
          </p>
          {comparison && (
            <p className={styles.periodNote}>
              {source === 'instagram'
                ? `Seguidores: ${time(comparison.previous)} → ${time(comparison.current)}. A diferença é o saldo do total, não a quantidade de entradas e saídas.`
                : `Comparação: ${period(comparison.currentPeriod)} vs. ${period(comparison.previousPeriod)}.`}
            </p>
          )}
          <div className={styles.metricsGrid}>
            {labels[source].map(([key, label]) => (
              <article className={styles.metricCard} key={key}>
                <div className={styles.metricLabel}>{label}</div>
                <strong className={styles.metricValue}>
                  {number(current.metrics[key])}
                </strong>
                <p className={styles.metricComparison}>
                  {source === 'instagram' && key !== 'followers_count'
                    ? 'Valor do período informado pela Meta'
                    : comparison
                      ? variation(comparison.changes[key])
                      : 'Histórico sendo construído'}
                </p>
              </article>
            ))}
          </div>
          <p className={styles.footnote}>
            {source === 'instagram'
              ? 'Alcance e contas engajadas não são somados entre dias. Visualizações e interações não representam pessoas únicas. Seguidores mostram a observação armazenada, não uma consulta ao vivo.'
              : 'Usuários e sessões são os totais da janela retornada pelo GA4, sem somar snapshots sobrepostos. Cliques são eventos de intenção, não pessoas, conversas ou agendamentos.'}
          </p>
          {source === 'ga4' && (
            <>
              <div className={styles.chartGrid}>
                <Ranks
                  rows={current.pages}
                  title="Páginas com mais visualizações"
                  unit="visualizações"
                />
                <Ranks
                  rows={current.pages}
                  title="Páginas com maior taxa de clique no WhatsApp"
                  unit="visualizações"
                  rates
                />
              </div>
              <div className={styles.chartGrid}>
                <Ranks
                  rows={current.sources}
                  title="Origens com mais sessões"
                  unit="sessões"
                />
                <Ranks
                  rows={current.sources}
                  title="Origens com maior taxa de clique no WhatsApp"
                  unit="sessões"
                  rates
                />
              </div>
              <p className={styles.footnote}>
                Taxa por página = eventos whatsapp_click / visualizações. Por
                origem = eventos whatsapp_click / sessões. Eventos repetidos
                podem produzir mais de 100%; não é taxa de pessoas convertidas.
                Ausência de cliques não vira zero. Listas mostram até 5 linhas
                identificadas; relatórios parciais não geram taxas.
              </p>
            </>
          )}
          <details className={styles.dataDetails}>
            <summary>Ver observações armazenadas</summary>
            <div className={styles.dailyTable}>
              <table>
                <caption>
                  {title} — cada linha é uma coleta, sem soma entre linhas
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Coleta (UTC)</th>
                    <th scope="col">Período</th>
                    {labels[source].map(([key, label]) => (
                      <th scope="col" key={key}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history!.points.map((p) => (
                    <tr key={p.collectedAt}>
                      <td>{time(p.collectedAt)}</td>
                      <td>{period(p.period)}</td>
                      {labels[source].map(([key]) => (
                        <td key={key}>{number(p.metrics[key])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  )
}
