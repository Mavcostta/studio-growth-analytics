import { useEffect, useState } from 'react'
import type { HistoryReport } from '../../server/history-model.js'

export type HistoryState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; data: HistoryReport }

let pending: Promise<HistoryReport> | null = null
export function loadHistory(): Promise<HistoryReport> {
  if (pending) return pending
  pending = (async () => {
    const response = await fetch('/api/history', {
      cache: 'no-store',
      signal: AbortSignal.timeout(75_000),
    })
    if (!response.ok) throw new Error('history_unavailable')
    const data = (await response.json()) as HistoryReport
    if (
      data.schemaVersion !== 1 ||
      ![data.instagram, data.ga4].every(
        (s) =>
          s &&
          ['ready', 'partial', 'empty', 'unavailable'].includes(s.status) &&
          Array.isArray(s.points),
      )
    )
      throw new Error('invalid_history')
    return data
  })().finally(() => {
    pending = null
  })
  return pending
}

export function useHistory() {
  const [state, setState] = useState<HistoryState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    loadHistory().then(
      (data) => {
        if (active) setState({ status: 'ready', data })
      },
      () => {
        if (active) setState({ status: 'error' })
      },
    )
    return () => {
      active = false
    }
  }, [attempt])
  return {
    state,
    retry: () => {
      setState({ status: 'loading' })
      setAttempt((n) => n + 1)
    },
  }
}
