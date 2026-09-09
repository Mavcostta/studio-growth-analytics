import type { BusinessInsight } from '../../types/analytics'
import styles from '../../styles/dashboard.module.css'

export function InsightCard({ insight }: { insight: BusinessInsight }) {
  return (
    <article className={styles.insightCard}>
      <span className={styles.insightSymbol} aria-hidden="true">
        {insight.symbol}
      </span>
      <div>
        <h3>{insight.title}</h3>
        <p>{insight.description}</p>
      </div>
    </article>
  )
}
