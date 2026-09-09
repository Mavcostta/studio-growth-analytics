import type { ComponentProps } from 'react'
import { Icon } from '../Icon'
import { percent } from '../../utils/analytics'
import styles from '../../styles/dashboard.module.css'

export function MetricCard({
  label,
  value,
  delta,
  icon,
  percentagePoints = false,
}: {
  label: string
  value: string
  delta: number | null
  icon: ComponentProps<typeof Icon>['name']
  percentagePoints?: boolean
}) {
  return (
    <article className={styles.metricCard}>
      <div className={styles.metricLabel}>
        <span>{label}</span>
        <Icon name={icon} size={18} />
      </div>
      <strong className={styles.metricValue}>{value}</strong>
      <div className={styles.metricComparison}>
        <span
          className={
            delta !== null && delta < 0 ? styles.negative : styles.positive
          }
        >
          {delta === null
            ? 'Sem base'
            : `${delta > 0 ? '↗' : delta < 0 ? '↘' : '→'} ${percentagePoints ? `${Math.abs(delta).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} p.p.` : percent(Math.abs(delta), 0)}`}
        </span>
        <span>vs. período anterior</span>
      </div>
    </article>
  )
}
