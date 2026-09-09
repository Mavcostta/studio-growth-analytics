import { useState, type ReactNode } from 'react'
import type { InstagramState } from '../../hooks/useInstagram'
import type {
  InstagramAccountSummary,
  InstagramFormatSummary,
  InstagramPostAnalytics,
} from '../../types/instagram'
import {
  buildInstagramInsights,
  displayNumber,
  displayRate,
  formatLabels,
  highlights,
  summarize,
} from '../../utils/instagram'
import styles from '../../styles/dashboard.module.css'

export function InstagramArea({
  state,
  retry,
  children,
}: {
  state: InstagramState
  retry: () => void
  children: (data: InstagramAccountSummary) => ReactNode
}) {
  if (state.status === 'loading')
    return (
      <section className={styles.panel} role="status">
        <h2>Instagram — carregando dados reais…</h2>
        <p className={styles.footnote}>
          A consulta das publicações pode levar alguns instantes.
        </p>
      </section>
    )
  if (state.status === 'error')
    return (
      <section className={styles.panel} role="alert">
        <h2>Não foi possível carregar os dados do Instagram.</h2>
        <p className={styles.footnote}>{state.message}</p>
        <button className={styles.actionButton} onClick={retry}>
          Tentar novamente
        </button>
      </section>
    )
  return (
    <>
      <div className={styles.realHeading}>
        <div>
          <h2>
            Instagram <span className={styles.realBadge}>● Dados reais</span>
          </h2>
          <p>
            @{state.data.username ?? 'conta autorizada'} · Consultado em{' '}
            {new Date(state.data.collectedAt).toLocaleString('pt-BR', {
              timeZone: 'America/Sao_Paulo',
            })}
          </p>
        </div>
        <button className={styles.actionButton} onClick={retry}>
          Atualizar dados
        </button>
      </div>
      {state.data.status === 'partial' && (
        <p className={styles.notice} role="status">
          Consulta parcial: algumas métricas ou publicações não puderam ser
          obtidas. “—” significa dado indisponível.
        </p>
      )}
      {state.data.posts.length ? (
        children(state.data)
      ) : (
        <section className={styles.panel}>
          <h2>Nenhuma publicação foi retornada pelo Instagram.</h2>
          <p className={styles.footnote}>
            Não foram inseridos dados simulados nesta área.
          </p>
        </section>
      )}
    </>
  )
}

export function InstagramPeriod({
  posts,
}: {
  posts: InstagramPostAnalytics[]
}) {
  const dates = posts
    .map((p) => p.publishedDate)
    .filter((d): d is string => d !== null)
    .sort()
  const date = (s: string) => s.split('-').reverse().join('/')
  return (
    <p className={styles.periodNote}>
      {posts.length} posts na amostra
      {dates.length
        ? ` · Publicados de ${date(dates[0])} a ${date(dates.at(-1)!)}`
        : ' · Datas indisponíveis'}{' '}
      · Horários de São Paulo.
      <br />
      Valores acumulados por publicação até a coleta; não representam
      crescimento mensal. Não há filtro de período ativo.
    </p>
  )
}

export function InstagramSummary({
  posts,
}: {
  posts: InstagramPostAnalytics[]
}) {
  const s = summarize(posts)
  const values: [string, string, string][] = [
    ['Posts analisados', String(s.count), 'Publicações recentes retornadas'],
    [
      'Alcance somado',
      displayNumber(s.metrics.reach.sum),
      `${s.metrics.reach.n}/${s.count} posts com dado · não são pessoas únicas`,
    ],
    [
      'Visualizações somadas',
      displayNumber(s.metrics.views.sum),
      `${s.metrics.views.n}/${s.count} posts com dado`,
    ],
    [
      'Interações totais',
      displayNumber(s.metrics.totalInteractions.sum),
      `${s.metrics.totalInteractions.n}/${s.count} posts com dado`,
    ],
    [
      'Alcance médio por post',
      displayNumber(s.metrics.reach.mean),
      `Mediana: ${displayNumber(s.metrics.reach.median)}`,
    ],
    [
      'Visualizações médias',
      displayNumber(s.metrics.views.mean),
      `Mediana: ${displayNumber(s.metrics.views.median)}`,
    ],
    [
      'Interações médias',
      displayNumber(s.metrics.totalInteractions.mean),
      `Mediana: ${displayNumber(s.metrics.totalInteractions.median)}`,
    ],
    [
      'Interações / alcance',
      displayRate(s.globalInteractionRate),
      `${s.rateSample}/${s.count} posts com dados válidos · não mede clientes`,
    ],
  ]
  return (
    <>
      <InstagramPeriod posts={posts} />
      <section
        className={styles.metricsGrid}
        aria-label="Resumo real do Instagram"
      >
        {values.map(([label, value, note]) => (
          <article key={label} className={styles.metricCard}>
            <div className={styles.metricLabel}>{label}</div>
            <strong className={styles.metricValue}>{value}</strong>
            <p className={styles.metricComparison}>{note}</p>
          </article>
        ))}
      </section>
      <p className={styles.periodNote}>
        {Object.entries(formatLabels)
          .map(
            ([type, label]) =>
              `${label}: ${posts.filter((p) => p.contentType === type).length}`,
          )
          .join(' · ')}
      </p>
    </>
  )
}

export function InstagramThumbnail({ post }: { post: InstagramPostAnalytics }) {
  const [failed, setFailed] = useState(false)
  return (
    <span className={styles.thumbnail}>
      {post.thumbnailUrl && !failed ? (
        <img
          src={post.thumbnailUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-label="Prévia indisponível">
          {post.contentType === 'reel' || post.contentType === 'video'
            ? '▷'
            : '◇'}
        </span>
      )}
    </span>
  )
}
export function InstagramPostLink({ post }: { post: InstagramPostAnalytics }) {
  return post.permalink ? (
    <a
      className={styles.textLink}
      href={post.permalink}
      target="_blank"
      rel="noopener noreferrer"
    >
      Abrir no Instagram ↗
    </a>
  ) : (
    <span className={styles.subtle}>Link indisponível</span>
  )
}
export function InstagramHighlights({
  posts,
}: {
  posts: InstagramPostAnalytics[]
}) {
  const winners = highlights(posts)
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeading}>
        <div>
          <h2>Destaques do período</h2>
          <p>
            Cada publicação pode se destacar de uma maneira. Empates são
            preservados.
          </p>
        </div>
      </div>
      {winners.length ? (
        <div className={styles.topList}>
          {winners.map(({ post, achievements }) => (
            <article className={styles.topItem} key={post.id}>
              <InstagramThumbnail post={post} />
              <div className={styles.topTitle}>
                <h3>
                  {post.caption?.slice(0, 110) || 'Publicação sem legenda'}
                </h3>
                <p className={styles.achievement}>{achievements.join(' · ')}</p>
                <span>
                  {formatLabels[post.contentType]} · Alcance:{' '}
                  {displayNumber(post.metrics.reach)} · Visualizações:{' '}
                  {displayNumber(post.metrics.views)}
                </span>
                <InstagramPostLink post={post} />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className={styles.footnote}>
          Não há valores distintos e positivos suficientes para destacar
          publicações.
        </p>
      )}
      <p className={styles.footnote}>
        Destaques descrevem a amostra. Não representam vendas ou uma nota geral
        de qualidade.
      </p>
    </section>
  )
}
export function InstagramInsights({
  posts,
}: {
  posts: InstagramPostAnalytics[]
}) {
  return (
    <section className={styles.insightsSection}>
      <div className={styles.sectionHeading}>
        <h2>O que os dados estão nos contando?</h2>
      </div>
      <div className={styles.insightsGrid}>
        {buildInstagramInsights(posts).map((insight) => (
          <article className={styles.insightCard} key={insight.id}>
            <div>
              <h3>{insight.title}</h3>
              <p>
                <strong>Achado · </strong>
                {insight.finding}
              </p>
              {insight.hypothesis && (
                <p>
                  <strong>Hipótese · </strong>
                  {insight.hypothesis}
                </p>
              )}
              {insight.nextTest && (
                <details className={styles.dataDetails}>
                  <summary>Próximo teste</summary>
                  <p>{insight.nextTest}</p>
                </details>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export function InstagramGroups({
  title,
  groups,
  format = false,
}: {
  title: string
  groups: InstagramFormatSummary[]
  format?: boolean
}) {
  const [metric, setMetric] = useState<'count' | 'reach' | 'totalInteractions'>(
    'count',
  )
  const observed = groups.filter((g) => g.count > 0)
  const barValue = (g: InstagramFormatSummary) =>
    metric === 'count' ? g.count : g.metrics[metric].mean
  const max = Math.max(1, ...observed.map((g) => barValue(g) ?? 0))
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeading}>
        <div>
          <h2>{title}</h2>
          <p>
            Média, mediana e quantidade de observações; sem promessa de
            resultado.
          </p>
        </div>
      </div>
      <div className={styles.segmented} aria-label={`Métrica: ${title}`}>
        {(
          [
            ['count', 'Publicações'],
            ['reach', 'Alcance médio'],
            ['totalInteractions', 'Interações médias'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            aria-pressed={metric === key}
            onClick={() => setMetric(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <ul className={styles.groupList}>
        {observed.map((g) => (
          <li key={g.key}>
            <div className={styles.rankLabel}>
              <strong>{g.label}</strong>
              <span>{g.count} posts</span>
            </div>
            {barValue(g) !== null ? (
              <meter
                min={0}
                max={max}
                value={barValue(g)!}
                aria-label={`${g.label}: ${displayNumber(barValue(g))}`}
              />
            ) : (
              <span>Sem dado para esta métrica</span>
            )}
            <p className={styles.groupValues}>
              Alcance médio{' '}
              <strong>{displayNumber(g.metrics.reach.mean)}</strong> · mediana{' '}
              <strong>{displayNumber(g.metrics.reach.median)}</strong>
              <br />
              Interações médias{' '}
              <strong>
                {displayNumber(g.metrics.totalInteractions.mean)}
              </strong>{' '}
              · Interações / alcance{' '}
              <strong>{displayRate(g.globalInteractionRate)}</strong>
            </p>
            <small>
              {g.metrics.reach.n < 3 || g.interactionRate.n < 3
                ? 'Amostra insuficiente para conclusão.'
                : 'Tendência observável nesta amostra; não é uma certeza.'}
              {g.metrics.reach.divergent || g.interactionRate.divergent
                ? ' Média e mediana divergem: cautela com publicações excepcionais.'
                : ''}
            </small>
            <details className={styles.dataDetails}>
              <summary>Ver medidas e amostra</summary>
              <p>
                Alcance: {g.metrics.reach.n} observações válidas. Interações:{' '}
                {g.metrics.totalInteractions.n}. Razão de interações:{' '}
                {g.rateSample} pares válidos. Média das razões:{' '}
                {displayRate(g.interactionRate.mean)}; mediana:{' '}
                {displayRate(g.interactionRate.median)}. Mediana das interações:{' '}
                {displayNumber(g.metrics.totalInteractions.median)}.
              </p>
              {format && (
                <p>
                  Visualizações médias: {displayNumber(g.metrics.views.mean)}{' '}
                  (n={g.metrics.views.n}). Salvamentos médios:{' '}
                  {displayNumber(g.metrics.saved.mean)} (n={g.metrics.saved.n}).
                  Compartilhamentos médios:{' '}
                  {displayNumber(g.metrics.shares.mean)} (n={g.metrics.shares.n}
                  ). Comentários médios:{' '}
                  {displayNumber(g.metrics.comments.mean)} (n=
                  {g.metrics.comments.n}).
                </p>
              )}
            </details>
          </li>
        ))}
      </ul>
      <p className={styles.footnote}>
        Grupos sem publicações não aparecem. Mediana é o valor central: ajuda a
        perceber quando poucos posts puxam a média. “—” significa dado
        indisponível.
      </p>
    </section>
  )
}
