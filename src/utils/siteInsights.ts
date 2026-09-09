import type { GA4Report } from '../services/analytics/ga4.js'
import type { BusinessInsight } from '../types/analytics.js'

// Limiar editorial de cautela, não teste de significância estatística.
const minimumSample = 30

function count(value: string | null | undefined) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null
  const n = Number(value)
  return Number.isSafeInteger(n) ? n : null
}

export function buildSiteInsights(data: GA4Report): BusinessInsight[] {
  const clicks = count(data.events.whatsapp_click)
  const views = count(data.metrics.screenPageViews)
  const sessions = count(data.metrics.sessions)
  // Só usa sessões quando as visualizações estão ausentes, nunca para ocultar zero.
  const denominator = views === null ? sessions : views
  const unit = views === null ? 'sessões' : 'visualizações'
  const rate =
    clicks !== null && denominator !== null && denominator > 0
      ? (clicks / denominator) * 100
      : null
  const small = denominator !== null && denominator < minimumSample
  const overall =
    rate === null
      ? 'A taxa geral está indisponível: faltam cliques ou uma base positiva de visualizações/sessões.'
      : `No site, ${clicks!.toLocaleString('pt-BR')} cliques em ${denominator!.toLocaleString('pt-BR')} ${unit}: ${rate.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% (eventos de clique por ${unit}, não percentual de pessoas).`
  const selected = count(data.events.select_service)
  const ctaLocation =
    data.details?.ctas.dimension === 'customEvent:cta_location' &&
    data.details.ctas.rows.some((row) => row.cta !== null)
  return [
    {
      id: 'site-intention',
      symbol: '↗',
      title: 'Maior intenção',
      description: `${overall} ${small ? `Amostra pequena: menos de ${minimumSample} ${unit}; leitura exploratória. ` : ''}Ainda não é possível eleger a página com maior taxa: faltam visualizações por página. Clique no WhatsApp indica intenção, não agendamento.`,
    },
    {
      id: 'site-source',
      symbol: '◎',
      title: 'Origem mais qualificada',
      description:
        'Ainda não podemos comparar a intenção por origem: o relatório de origem/mídia tem sessões, mas faltam os cliques no WhatsApp por essa mesma origem. Volume de sessões sozinho não indica maior qualidade.',
    },
    {
      id: 'site-opportunity',
      symbol: '◇',
      title: 'Oportunidade de melhoria',
      description:
        'Ainda não podemos identificar páginas com muita visita e pouco clique, nem páginas com pouca visita e alta taxa. Faltam visualizações de todas as páginas no mesmo período; a lista atual inclui apenas páginas com eventos de clique retornados. Ausência nessa lista não significa zero clique.',
    },
    {
      id: 'site-unknown',
      symbol: '?',
      title: 'O que ainda não sabemos',
      description: `${selected === null ? 'Seleções de serviço indisponíveis.' : `O GA4 registrou ${selected.toLocaleString('pt-BR')} eventos de seleção de serviço.`} A dimensão service não está disponível nos relatórios conectados; não é possível eleger o serviço com maior interesse. ${ctaLocation ? 'cta_location foi retornado, mas faltam exposições por localização para calcular a taxa de cada CTA.' : 'cta_location não está disponível com valores identificados no relatório atual; também faltam exposições por localização para comparar taxas de CTA.'} Esses dados não demonstram causalidade.`,
    },
  ]
}
