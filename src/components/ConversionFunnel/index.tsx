import type { ConversionMetric } from '../../types/analytics'
import { number, percent, rate } from '../../utils/analytics'
import styles from '../../styles/dashboard.module.css'

export function ConversionFunnel({ steps }: { steps: ConversionMetric[] }) {
  return (
    <section className={styles.panel} aria-labelledby="funnel-title">
      <div className={styles.panelHeading}>
        <div>
          <h2 id="funnel-title">Do site ao WhatsApp · Simulação</h2>
          <p>Etapas ilustrativas com dados fictícios.</p>
        </div>
      </div>
      <ol className={styles.funnel}>
        {steps.map((step, index) => (
          <li key={step.id}>
            {index > 0 && (
              <div className={styles.funnelRate}>
                ↓ {percent(rate(step.value, steps[index - 1].value))} da etapa
                anterior
              </div>
            )}
            <div
              className={styles.funnelStep}
              style={{ width: `${100 - index * 12}%` }}
            >
              <span>{step.label}</span>
              <strong>{number(step.value)}</strong>
            </div>
          </li>
        ))}
      </ol>
      <p className={styles.footnote}>
        Visão indicativa: públicos podem se repetir entre canais. Cliques não
        são agendamentos.
      </p>
    </section>
  )
}
