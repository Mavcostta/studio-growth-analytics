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
import { ga4Daily, ga4Number, type GA4Report } from '../services/analytics/ga4'
import styles from '../styles/dashboard.module.css'

const options = {
  sessions: 'Sessões',
  activeUsers: 'Usuários ativos',
  screenPageViews: 'Visualizações',
  eventCount: 'Eventos',
  whatsapp_click: 'Cliques no WhatsApp',
}
export function GA4Chart({ data }: { data: GA4Report | null }) {
  const [metric, setMetric] = useState<keyof typeof options>('sessions')
  const rows = data ? ga4Daily(data) : []
  const chart = rows.map((row) => ({
    date: row.date,
    value:
      row[metric] !== null && Number.isSafeInteger(Number(row[metric]))
        ? Number(row[metric])
        : null,
  }))
  const available = chart.some((row) => row.value !== null)
  const section =
    metric === 'whatsapp_click'
      ? data?.details?.dailyWhatsapp
      : data?.details?.daily
  return (
    <>
      <div className={styles.segmented} aria-label="Métrica diária">
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
        aria-label={`${options[metric]} por dia; valores na tabela abaixo.`}
      >
        {available ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <AreaChart
              data={chart}
              margin={{ top: 15, right: 10, bottom: 0, left: -20 }}
            >
              <CartesianGrid
                strokeDasharray="3 5"
                vertical={false}
                stroke="#eee7ea"
              />
              <XAxis
                dataKey="date"
                tickFormatter={(v) =>
                  `${String(v).slice(6)}/${String(v).slice(4, 6)}`
                }
                tickLine={false}
                axisLine={false}
              />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <Tooltip
                labelFormatter={(v) =>
                  `${String(v).slice(6)}/${String(v).slice(4, 6)}/${String(v).slice(0, 4)}`
                }
                formatter={(v) => [
                  Number(v).toLocaleString('pt-BR'),
                  options[metric],
                ]}
              />
              <Area
                dataKey="value"
                type="linear"
                stroke="#ab5485"
                fill="#c46fa4"
                fillOpacity={0.15}
                connectNulls={false}
                dot
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p>Série diária indisponível para esta métrica.</p>
        )}
      </div>
      {section?.message && <p className={styles.footnote}>{section.message}</p>}
      <details className={styles.dataDetails}>
        <summary>Ver valores por dia</summary>
        <div className={styles.dailyTable}>
          <table>
            <caption>{options[metric]} · últimos 7 dias completos</caption>
            <thead>
              <tr>
                <th scope="col">Dia</th>
                <th scope="col">{options[metric]}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.date}>
                  <td>
                    {row.date.slice(6)}/{row.date.slice(4, 6)}
                  </td>
                  <td>{ga4Number(row[metric])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <p className={styles.footnote}>
        Dias sem linha permanecem sem dados. Valores acima da precisão do
        gráfico aparecem somente na tabela. Usuários diários não devem ser
        somados para obter usuários únicos do período.
      </p>
    </>
  )
}
