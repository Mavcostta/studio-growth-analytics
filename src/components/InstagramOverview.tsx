import type { Change, Period, SourceHistory } from '../../server/history-model'
import type { HistoryState } from '../hooks/useHistory'
import { updatedLabel } from '../utils/presentation'
import styles from '../styles/dashboard.module.css'

const formatNumber = (value: number | null | undefined) =>
  value == null ? 'Indisponível' : value.toLocaleString('pt-BR')
const localTime = (value: string) =>
  new Date(value).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  })
const periodLabel = (value: Period | null) => {
  if (!value) return 'Período indisponível'
  const format = (s: string) =>
    s.includes('T') ? localTime(s) : s.split('-').reverse().join('/')
  return `${format(value.start)} a ${format(value.end)}`
}
const metrics = [
  ['profile_views', 'Visitas ao perfil'],
  ['reach', 'Contas alcançadas'],
  ['accounts_engaged', 'Contas engajadas'],
  ['views', 'Visualizações'],
  ['total_interactions', 'Interações'],
  ['profile_links_taps', 'Toques em links'],
] as const

function Comparison({
  change,
  followers = false,
}: {
  change?: Change
  followers?: boolean
}) {
  if (!change || change.difference === null || change.direction === null)
    return <span>Histórico sendo construído</span>
  if (change.direction === 'stable')
    return <span>Sem mudança desde a última atualização</span>
  const up = change.direction === 'increase'
  return (
    <span className={styles.accountChange}>
      <span aria-label={up ? 'Aumento' : 'Queda'}>{up ? '↑' : '↓'}</span>{' '}
      {formatNumber(Math.abs(change.difference))}
      {followers
        ? Math.abs(change.difference) === 1
          ? ' seguidor'
          : ' seguidores'
        : ''}{' '}
      desde a última atualização
    </span>
  )
}

function AccountData({ history }: { history: SourceHistory }) {
  // A série continua disponível no contrato; nenhuma curva é inferida entre coletas.
  const current = history.points.at(-1)!
  const comparison = history.comparison
  return (
    <>
      <p className={styles.periodNote}>{updatedLabel(current.collectedAt)}</p>
      <article
        className={styles.followersHero}
        aria-label="Resumo de seguidores"
      >
        <div>
          <span className={styles.eyebrow}>SUA COMUNIDADE</span>
          <strong className={styles.followersValue}>
            {formatNumber(current.metrics.followers_count)}
          </strong>
          <span>seguidores</span>
        </div>
        <div className={styles.followersComparison}>
          {current.metrics.followers_count != null && comparison ? (
            <>
              <Comparison
                change={comparison.changes.followers_count}
                followers
              />
            </>
          ) : (
            <p>Histórico sendo construído</p>
          )}
        </div>
      </article>
      <div className={styles.sectionHeading}>
        <div>
          <h3>Desempenho recente</h3>
        </div>
      </div>
      <div className={styles.accountMetrics}>
        {metrics.map(([key, label]) => (
          <article className={styles.metricCard} key={key}>
            <div className={styles.metricLabel}>{label}</div>
            <strong className={styles.metricValue}>
              {formatNumber(current.metrics[key])}
            </strong>
            {current.metrics[key] != null &&
              comparison?.changes[key]?.difference != null && (
                <p className={styles.metricComparison}>
                  <Comparison change={comparison.changes[key]} />
                </p>
              )}
          </article>
        ))}
      </div>
      <details className={styles.dataDetails}>
        <summary>Sobre estes dados</summary>
        {comparison && (
          <p>
            Comparação de seguidores: {localTime(comparison.previous)} a{' '}
            {localTime(comparison.current)}. Período anterior das demais
            métricas: {periodLabel(comparison.previousPeriod)}. Variação
            percentual de seguidores:{' '}
            {comparison.changes.followers_count?.percent == null
              ? 'Indisponível'
              : comparison.changes.followers_count.percent.toLocaleString(
                  'pt-BR',
                  { maximumFractionDigits: 2 },
                ) + '%'}
            .
          </p>
        )}
        <p>
          {history.points.length} snapshots disponíveis. Horários convertidos
          para São Paulo. Os seguidores representam o total na última coleta,
          não uma leitura em tempo real.
        </p>
        <p>
          As outras métricas representam o período informado pela Meta:{' '}
          {periodLabel(current.period)}. O instante final é exclusivo. Alcance e
          contas engajadas não são somados entre dias. Visualizações e
          interações podem incluir repetições.
        </p>
        <p>
          A variação de seguidores é a diferença entre totais; não representa
          separadamente entradas e saídas. Novos seguidores informados pela
          Meta: {formatNumber(current.metrics.follows)}. Saídas:{' '}
          {formatNumber(current.metrics.unfollows)}.
        </p>
        {history.message && <p>{history.message}</p>}
        <div className={styles.dailyTable}>
          <table>
            <caption>Histórico da conta — sem somar coletas</caption>
            <thead>
              <tr>
                <th scope="col">Coleta (São Paulo)</th>
                <th scope="col">Período</th>
                <th scope="col">Seguidores</th>
                {metrics.map(([key, label]) => (
                  <th key={key} scope="col">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.points.map((point) => (
                <tr key={point.collectedAt}>
                  <td>{localTime(point.collectedAt)}</td>
                  <td>{periodLabel(point.period)}</td>
                  <td>{formatNumber(point.metrics.followers_count)}</td>
                  {metrics.map(([key]) => (
                    <td key={key}>{formatNumber(point.metrics[key])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  )
}

export function InstagramOverview({
  state,
  retry,
}: {
  state: HistoryState
  retry: () => void
}) {
  const history = state.status === 'ready' ? state.data.instagram : null
  return (
    <section
      className={styles.accountOverview}
      aria-label="Seu Instagram hoje"
      aria-busy={state.status === 'loading'}
    >
      <div className={styles.accountHeading}>
        <h2>Seu Instagram hoje</h2>
        <button className={styles.actionButton} onClick={retry}>
          Atualizar dados
        </button>
      </div>
      {state.status === 'loading' && (
        <p role="status">Carregando os dados da sua conta…</p>
      )}
      {(state.status === 'error' || history?.status === 'unavailable') && (
        <p role="alert">
          Não foi possível carregar sua conta. Tente atualizar os dados.
        </p>
      )}
      {history?.status === 'partial' && (
        <p role="status" className={styles.notice}>
          Alguns dados não puderam ser carregados. As comparações ficam
          indisponíveis por enquanto.
        </p>
      )}
      {history && history.points.length > 0 ? (
        <AccountData history={history} />
      ) : (
        history &&
        history.status !== 'unavailable' && (
          <p role="status">Histórico sendo construído</p>
        )
      )}
    </section>
  )
}
