import type { TrafficSource } from '../types/analytics'
import { number, percent, rate } from '../utils/analytics'
import styles from '../styles/dashboard.module.css'

export function TrafficSources({ sources }: { sources: TrafficSource[] }) {
  const total = sources.reduce((sum, source) => sum + source.visits, 0)
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeading}>
        <div>
          <h2>De onde vêm as visitas? · Simulação</h2>
          <p>
            Origens fictícias do site, incluindo Google e Instagram. Ainda não
            conectadas.
          </p>
        </div>
      </div>
      <ul className={styles.sourceList}>
        {sources.map((source) => (
          <li key={source.source}>
            <div>
              <span>{source.label}</span>
              <strong>{percent(rate(source.visits, total), 0)}</strong>
            </div>
            <meter
              min={0}
              max={total || 1}
              value={source.visits}
              aria-label={`${source.label}: ${number(source.visits)} visitas`}
            />
            <small>
              {source.visits} visitas · {source.whatsappClicks} cliques no
              WhatsApp
            </small>
          </li>
        ))}
      </ul>
    </section>
  )
}
