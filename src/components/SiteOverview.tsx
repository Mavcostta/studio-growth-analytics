import type { ReactNode } from 'react'
import type { Ranking } from '../../server/history-model'
import type { HistoryState } from '../hooks/useHistory'
import {
  pageName,
  sourceName,
  updatedLabel,
  localDateTime,
} from '../utils/presentation'
import styles from '../styles/dashboard.module.css'

const number = (n: number | null | undefined) =>
  n == null ? 'Indisponível' : n.toLocaleString('pt-BR')
function Visits({ rows, pages = false }: { rows: Ranking[]; pages?: boolean }) {
  const available = rows
    .filter((r) => r.denominator !== null)
    .sort((a, b) => b.denominator! - a.denominator!)
    .slice(0, 5)
  return (
    <section className={styles.panel}>
      <h3>
        {pages
          ? 'O que as pessoas mais visitaram?'
          : 'De onde vieram seus visitantes?'}
      </h3>
      {available.length ? (
        <ul className={styles.sourceList}>
          {available.map((r) => (
            <li key={r.label}>
              <div>
                <span>{pages ? pageName(r.label) : sourceName(r.label)}</span>
                <strong>
                  {number(r.denominator)}{' '}
                  {pages
                    ? r.denominator === 1
                      ? 'visualização'
                      : 'visualizações'
                    : r.denominator === 1
                      ? 'visita'
                      : 'visitas'}
                </strong>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p>Essas informações ainda estão indisponíveis.</p>
      )}
    </section>
  )
}
export function SiteOverview({
  state,
  retry,
  children,
}: {
  state: HistoryState
  retry: () => void
  children?: ReactNode
}) {
  const history = state.status === 'ready' ? state.data.ga4 : null
  const current = history?.points.at(-1)
  return (
    <section
      className={styles.accountOverview}
      aria-label="Seu site"
      aria-busy={state.status === 'loading'}
    >
      <div className={styles.accountHeading}>
        <h2>Seu site</h2>
        <button className={styles.actionButton} onClick={retry}>
          Atualizar dados
        </button>
      </div>
      {state.status === 'loading' && (
        <p role="status">Carregando as visitas ao seu site…</p>
      )}
      {(state.status === 'error' || history?.status === 'unavailable') && (
        <p role="alert">
          Não foi possível carregar os dados do site. Tente atualizar.
        </p>
      )}
      {history?.status === 'partial' && (
        <p role="status">Algumas informações ainda estão indisponíveis.</p>
      )}
      {current ? (
        <>
          <p className={styles.periodNote}>
            {updatedLabel(current.collectedAt)} · Resumo de 7 dias.
          </p>
          <div className={styles.accountMetrics}>
            {[
              ['activeUsers', 'Visitantes'],
              ['sessions', 'Visitas'],
              ['screenPageViews', 'Visualizações'],
            ].map(([key, label]) => (
              <article className={styles.metricCard} key={key}>
                <div className={styles.metricLabel}>{label}</div>
                <strong className={styles.metricValue}>
                  {number(current.metrics[key])}
                </strong>
              </article>
            ))}
          </div>
          <div className={styles.businessLists}>
            <Visits rows={current.sources} />
            <Visits rows={current.pages} pages />
          </div>
          <section
            className={styles.followersHero}
            aria-label="Interesse em agendar"
          >
            <div>
              <h3>Interesse em agendar</h3>
              <strong className={styles.metricValue}>
                {number(current.metrics.whatsapp_click)}
              </strong>
              <span>
                {current.metrics.whatsapp_click === 1
                  ? 'acesso ao WhatsApp'
                  : 'acessos ao WhatsApp'}
              </span>
            </div>
            <p>Mostra quantas vezes o botão do WhatsApp foi acionado.</p>
          </section>
        </>
      ) : (
        history &&
        history.status !== 'unavailable' && (
          <p role="status">Histórico sendo construído</p>
        )
      )}
      <details className={styles.dataDetails}>
        <summary>Sobre estes dados</summary>
        {current && (
          <>
            <p>
              Atualização: {localDateTime(current.collectedAt)} (São Paulo).
              Período: {current.period?.start} a {current.period?.end}, no fuso{' '}
              {current.period?.timezone}. Visitantes representam usuários
              ativos; visitas representam sessões. Os acessos ao WhatsApp são
              eventos whatsapp_click, não pessoas ou clientes.
            </p>
            <p>
              Os nomes das páginas e origens foram simplificados somente na
              apresentação. Endereços diferentes continuam em linhas separadas,
              mesmo quando possuem o mesmo nome. Nenhum valor foi somado. As
              listas mostram até cinco linhas disponíveis, inclusive quando o
              relatório original é parcial.
            </p>
            <p>
              Eventos divididos por visitas ou visualizações não representam uma
              taxa de conversão de pessoas. Essa razão não é apresentada no
              resumo.
            </p>
          </>
        )}
        {children}
      </details>
    </section>
  )
}
