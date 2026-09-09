import { useState } from 'react'
import type { InstagramState } from '../../hooks/useInstagram'
import type {
  InstagramAccountSummary,
  InstagramMetricName,
  InstagramPerformanceDimension,
} from '../../types/instagram'
import { instagramMetricNames } from '../../types/instagram'
import {
  InstagramArea,
  InstagramGroups,
  InstagramHighlights,
  InstagramInsights,
  InstagramPeriod,
  InstagramPostLink,
  InstagramThumbnail,
} from '../../components/Instagram'
import {
  derived,
  dimensionLabel,
  dimensions,
  displayNumber,
  displayRate,
  evaluateDimensions,
  formatLabels,
  groups,
  metricLabels,
} from '../../utils/instagram'
import styles from '../../styles/dashboard.module.css'

function RealContent({ data }: { data: InstagramAccountSummary }) {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<InstagramMetricName>('reach')
  // A classificação sempre usa a amostra inteira, independente do filtro visual.
  const evaluations = evaluateDimensions(data.posts)
  const selected = data.posts
    .filter(
      (p) =>
        (filter === 'all' || p.contentType === filter) &&
        (p.caption ?? '')
          .toLocaleLowerCase('pt-BR')
          .includes(search.toLocaleLowerCase('pt-BR')),
    )
    .sort((a, b) => (b.metrics[sort] ?? -1) - (a.metrics[sort] ?? -1))
  return (
    <>
      <InstagramPeriod posts={data.posts} />
      <section className={styles.panel}>
        <div className={styles.panelHeading}>
          <div>
            <h2>Seus conteúdos, de perto</h2>
            <p>
              Dados reais · Nenhuma nota geral: cada objetivo tem sua própria
              comparação.
            </p>
          </div>
        </div>
        <div className={styles.contentControls}>
          <div className={styles.segmented} aria-label="Filtrar formato">
            {[['all', 'Todos'], ...Object.entries(formatLabels)].map(
              ([key, label]) => (
                <button
                  key={key}
                  aria-pressed={filter === key}
                  onClick={() => setFilter(key)}
                >
                  {label}
                </button>
              ),
            )}
          </div>
          <div className={styles.fields}>
            <label>
              <span className="sr-only">Buscar legenda</span>
              <input
                type="search"
                placeholder="Buscar legenda…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <label>
              <span className="sr-only">Ordenar publicações</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as InstagramMetricName)}
              >
                {instagramMetricNames.map((key) => (
                  <option key={key} value={key}>
                    Mais {metricLabels[key].toLowerCase()}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <p className={styles.resultCount} role="status">
          {selected.length} publicações encontradas · “—” indica dado
          indisponível.
        </p>
        <div className={styles.contentRows}>
          {selected.map((post) => {
            const rates = derived(post)
            const evaluation = evaluations.get(post.id)!
            return (
              <article key={post.id} className={styles.contentRow}>
                <div className={styles.postIntro}>
                  <InstagramThumbnail
                    key={post.thumbnailUrl ?? post.id}
                    post={post}
                  />
                  <div>
                    <h3>
                      {post.caption?.slice(0, 150) || 'Publicação sem legenda'}
                      {post.caption && post.caption.length > 150 ? '…' : ''}
                    </h3>
                    <p>
                      {formatLabels[post.contentType]} ·{' '}
                      {post.publishedAt
                        ? new Date(post.publishedAt).toLocaleString('pt-BR', {
                            timeZone: 'America/Sao_Paulo',
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })
                        : 'Data indisponível'}{' '}
                      · São Paulo
                    </p>
                    <InstagramPostLink post={post} />
                  </div>
                </div>
                <dl className={styles.postNumbers}>
                  {(['reach', 'views', 'totalInteractions'] as const).map(
                    (key) => (
                      <div key={key}>
                        <dt>{metricLabels[key]}</dt>
                        <dd>{displayNumber(post.metrics[key])}</dd>
                      </div>
                    ),
                  )}
                </dl>
                <details className={styles.postDetails}>
                  <summary>Ver métricas e dimensões</summary>
                  <dl className={styles.postNumbers}>
                    {(['likes', 'comments', 'saved', 'shares'] as const).map(
                      (key) => (
                        <div key={key}>
                          <dt>{metricLabels[key]}</dt>
                          <dd>{displayNumber(post.metrics[key])}</dd>
                        </div>
                      ),
                    )}
                  </dl>
                  <dl className={styles.postNumbers}>
                    {(
                      [
                        ['interactionRate', 'Interações / alcance'],
                        ['saveRate', 'Salvamentos / alcance'],
                        ['shareRate', 'Compartilhamentos / alcance'],
                        ['commentRate', 'Comentários / alcance'],
                      ] as const
                    ).map(([key, label]) => (
                      <div key={key}>
                        <dt>{label}</dt>
                        <dd>{displayRate(rates[key])}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className={styles.dimensionList}>
                    {Object.entries(dimensions).map(([key, label]) => {
                      const rating = dimensionLabel(
                        evaluation[key as InstagramPerformanceDimension],
                      )
                      return (
                        <div key={key}>
                          <span>{label}</span>
                          <span
                            className={`${styles.badge} ${styles[rating.tone]}`}
                          >
                            {rating.symbol} {rating.label}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  <p className={styles.footnote}>
                    Comparação relativa com a amostra inteira; não mede
                    clientes. “Sem comparação” indica dado ausente ou menos de 3
                    observações válidas.
                  </p>
                </details>
              </article>
            )
          })}
        </div>
        {!selected.length && (
          <div className={styles.empty}>
            Nenhuma publicação corresponde à busca.
            <button
              onClick={() => {
                setFilter('all')
                setSearch('')
              }}
            >
              Limpar filtros
            </button>
          </div>
        )}
        <details className={styles.dataDetails}>
          <summary>Como as dimensões são avaliadas?</summary>
          <p>
            Descoberta compara alcance e visualizações. Engajamento, valor,
            compartilhamento e conversa comparam, respectivamente, interações,
            salvamentos, compartilhamentos e comentários divididos pelo alcance.
            Cada dimensão usa a posição relativa na amostra; empates recebem a
            mesma classificação. Não existe nota geral. Alcance zero ou ausente
            impede calcular proporções.
          </p>
        </details>
      </section>
      <div className={styles.insightsSection}>
        <InstagramGroups
          title="O que observamos em cada formato"
          groups={groups(data.posts, 'format')}
          format
        />
      </div>
      <div className={styles.equalGrid}>
        <InstagramGroups
          title="Desempenho observado por dia"
          groups={groups(data.posts, 'day')}
        />
        <InstagramGroups
          title="Desempenho observado por horário"
          groups={groups(data.posts, 'hour')}
        />
      </div>
      <InstagramHighlights posts={data.posts} />
      <InstagramInsights posts={data.posts} />
    </>
  )
}

export default function ContentAnalytics({
  instagram,
  retry,
}: {
  instagram: InstagramState
  retry: () => void
}) {
  return (
    <>
      <div className={styles.welcome}>
        <div>
          <span className={styles.eyebrow}>CONTEÚDO COM PROPÓSITO</span>
          <h1>O que está funcionando no Instagram?</h1>
          <p>
            Descoberta, reação e interesse. Conversas comerciais e agendamentos
            ainda não são medidos.
          </p>
        </div>
      </div>
      <InstagramArea state={instagram} retry={retry}>
        {(data) => <RealContent data={data} />}
      </InstagramArea>
    </>
  )
}
