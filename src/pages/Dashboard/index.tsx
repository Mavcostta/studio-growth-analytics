import type { GA4State } from '../../hooks/useGA4'
import { Analytics } from '../../components/Analytics'
import type { InstagramState } from '../../hooks/useInstagram'
import {
  InstagramArea,
  InstagramHighlights,
  InstagramInsights,
  InstagramSummary,
} from '../../components/Instagram'
import styles from '../../styles/dashboard.module.css'

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
  return (
    <>
      <div className={styles.welcome}>
        <div>
          <span className={styles.eyebrow}>UM OLHAR PARA O SEU NEGÓCIO</span>
          <h1>Como o Studio está crescendo?</h1>
          <p>Entenda o Instagram e acompanhe o que ainda falta conectar.</p>
        </div>
      </div>
      <InstagramArea state={instagram} retry={retry}>
        {(real) => (
          <>
            <InstagramSummary posts={real.posts} />
            <InstagramInsights posts={real.posts} />
            <InstagramHighlights posts={real.posts} />
          </>
        )}
      </InstagramArea>
      <Analytics state={analytics} retry={retryAnalytics} />
    </>
  )
}
