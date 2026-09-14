import type { GA4State } from '../../hooks/useGA4'
import { Analytics } from '../../components/Analytics'
import type { InstagramState } from '../../hooks/useInstagram'
import {
  InstagramArea,
  InstagramHighlights,
  InstagramSummary,
} from '../../components/Instagram'
import styles from '../../styles/dashboard.module.css'
import { useHistory } from '../../hooks/useHistory'
import { SnapshotHistory } from '../../components/SnapshotHistory'
import { SiteOverview } from '../../components/SiteOverview'
import { InstagramOverview } from '../../components/InstagramOverview'

export default function Dashboard({
  analytics,
  retryAnalytics,
  instagram,
  retry,
}: {
  analytics: GA4State
  retryAnalytics: () => void
  instagram: InstagramState
  retry: () => void
}) {
  const history = useHistory()
  return (
    <>
      <div className={styles.welcome}>
        <div>
          <span className={styles.eyebrow}>UM OLHAR PARA O SEU NEGÓCIO</span>
          <h1>Como o Studio está crescendo?</h1>
          <p>
            Acompanhe sua comunidade, o desempenho da conta e seus conteúdos.
          </p>
        </div>
      </div>
      <InstagramOverview state={history.state} retry={history.retry} />
      <SiteOverview state={history.state} retry={history.retry}>
        <SnapshotHistory
          source="ga4"
          state={history.state}
          retry={history.retry}
        />
        <Analytics state={analytics} retry={retryAnalytics} />
      </SiteOverview>
      <details className={styles.overviewDetails}>
        <summary>Sobre estes dados · conteúdo do Instagram</summary>
        <InstagramArea state={instagram} retry={retry}>
          {(real) => (
            <>
              <InstagramHighlights posts={real.posts} />
              <InstagramSummary posts={real.posts} />
            </>
          )}
        </InstagramArea>
      </details>
      <section className={styles.panel}>
        <h2>O que fazer agora</h2>
        <p className={styles.footnote}>
          Estamos construindo seu histórico. Futuramente, esta área ajudará a
          identificar oportunidades para o Studio.
        </p>
      </section>
    </>
  )
}
