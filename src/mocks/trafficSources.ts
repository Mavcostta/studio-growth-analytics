import type { TrafficSource } from '../types/analytics.js'

// MOCK: 326 visitas e 71 cliques no total.
export const trafficSources: TrafficSource[] = [
  { source: 'instagram', label: 'Instagram', visits: 156, whatsappClicks: 48 },
  { source: 'google', label: 'Google', visits: 104, whatsappClicks: 16 },
  { source: 'direct', label: 'Acesso direto', visits: 39, whatsappClicks: 5 },
  { source: 'other', label: 'Outros', visits: 27, whatsappClicks: 2 },
]
