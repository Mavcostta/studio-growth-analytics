import type { Campaign } from '../types/analytics.js'

// MOCK: modelo de campanha preparado para futura atribuição por UTM.
export const campaigns: Campaign[] = [
  {
    id: 'c1',
    name: 'volume_brasileiro',
    source: 'instagram',
    medium: 'story',
    content: 'antes_depois',
  },
  {
    id: 'c2',
    name: 'cuidados_cilios',
    source: 'instagram',
    medium: 'social',
    content: 'educativo',
  },
]
