import { useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DailyMetrics } from '../../types/analytics'
import { number, postDate } from '../../utils/analytics'
import styles from '../../styles/dashboard.module.css'

const options = {
  websiteVisits: 'Visitas ao site',
  whatsappClicks: 'Cliques no WhatsApp',
} as const
export function GrowthChart({ daily }: { daily: DailyMetrics[] }) {
  const [metric, setMetric] = useState<keyof typeof options>('websiteVisits')
  return (
    <section className={styles.panel} aria-labelledby="growth-title">
      <div className={styles.panelHeading}>
        <div>
          <h2 id="growth-title">Site e WhatsApp · dados simulados</h2>
          <p>Exemplo visual de evolução diária, ainda sem integração.</p>
        </div>
        <span className={styles.subtle}>30 dias</span>
      </div>
      <div className={styles.segmented} aria-label="Métrica do gráfico">
        {Object.entries(options).map(([key, label]) => (
          <button
            key={key}
            aria-pressed={metric === key}
            onClick={() => setMetric(key as keyof typeof options)}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        className={styles.chart}
        role="img"
        aria-label={`${options[metric]} por dia. Os valores também estão na tabela abaixo.`}
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <AreaChart
            data={daily}
            margin={{ top: 15, right: 10, bottom: 0, left: -20 }}
          >
            <defs>
              <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#c46fa4" stopOpacity={0.26} />
                <stop offset="100%" stopColor="#c46fa4" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 5"
              vertical={false}
              stroke="#eee7ea"
            />
            <XAxis
              dataKey="date"
              tickFormatter={(date) => String(date).slice(8)}
              tickLine={false}
              axisLine={false}
              minTickGap={28}
              tick={{ fill: '#756c72', fontSize: 11 }}
              dy={8}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              tick={{ fill: '#756c72', fontSize: 11 }}
            />
            <Tooltip
              labelFormatter={(date) =>
                postDate(`${String(date)}T12:00:00-03:00`)
              }
              formatter={(value) => [number(Number(value)), options[metric]]}
              contentStyle={{
                border: '1px solid #e8e0e4',
                borderRadius: 8,
                fontSize: 13,
              }}
            />
            <Area
              type="monotone"
              dataKey={metric}
              stroke="#ab5485"
              strokeWidth={2.5}
              fill="url(#growthFill)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <details className={styles.dataDetails}>
        <summary>Ver valores por dia</summary>
        <div className={styles.dailyTable}>
          <table>
            <caption>{options[metric]} · agosto de 2026</caption>
            <thead>
              <tr>
                <th scope="col">Dia</th>
                <th scope="col">{options[metric]}</th>
              </tr>
            </thead>
            <tbody>
              {daily.map((day) => (
                <tr key={day.date}>
                  <td>{postDate(`${day.date}T12:00:00-03:00`)}</td>
                  <td>{number(day[metric])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  )
}
