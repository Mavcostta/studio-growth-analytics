import { useEffect, useState } from 'react'
import { loadInstagramPosts } from '../services/instagram/client'
import type { InstagramAccountSummary } from '../types/instagram'

export type InstagramState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: InstagramAccountSummary }
export function useInstagram() {
  const [state, setState] = useState<InstagramState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    loadInstagramPosts().then(
      (data) => {
        if (active) setState({ status: 'ready', data })
      },
      (error) => {
        if (active)
          setState({
            status: 'error',
            message:
              error instanceof Error ? error.message : 'Consulta indisponível.',
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
