import { useEffect, useState } from 'react'
import { loadGA4, type GA4Report } from '../services/analytics/ga4'

export type GA4State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: GA4Report }
export function useGA4() {
  const [state, setState] = useState<GA4State>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    loadGA4().then(
      (data) => {
        if (active) setState({ status: 'ready', data })
      },
      (error) => {
        if (active)
          setState({
            status: 'error',
            message:
              error instanceof Error ? error.message : 'GA4 indisponível.',
          })
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
      setAttempt((value) => value + 1)
    },
  }
}
