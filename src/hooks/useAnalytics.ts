import { useState } from 'react'
import { getAnalytics } from '../services/analytics'

// Ponto único para acrescentar carregamento/erro quando houver chamadas assíncronas.
export function useAnalytics() {
  const [data] = useState(getAnalytics)
  return data
}
