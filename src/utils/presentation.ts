const zone = 'America/Sao_Paulo'
export const localDateTime = (value: string) =>
  new Date(value).toLocaleString('pt-BR', {
    timeZone: zone,
    dateStyle: 'short',
    timeStyle: 'short',
  })
export function updatedLabel(value: string, now = new Date()) {
  const date = new Date(value)
  const calendar = (d: Date) =>
    d.toLocaleDateString('pt-BR', { timeZone: zone })
  return calendar(date) === calendar(now)
    ? `Atualizado hoje às ${date.toLocaleTimeString('pt-BR', { timeZone: zone, hour: '2-digit', minute: '2-digit' })}`
    : `Atualizado em ${localDateTime(value)}`
}
export const pageName = (path: string) =>
  ({
    '/': 'Página inicial',
    '/index.html': 'Página inicial',
    '/extensao-cilios-guarulhos.html': 'Extensão de cílios',
    '/design-sobrancelhas-guarulhos.html': 'Design de sobrancelhas',
    '/lash-lifting-guarulhos.html': 'Lash lifting',
    '/brow-lamination-guarulhos.html': 'Brow lamination',
    '/blog.html': 'Blog',
  })[path] ?? 'Outra página'
export const sourceName = (source: string) =>
  ({
    'google / organic': 'Google',
    'ig / social': 'Instagram',
    '(direct) / (none)': 'Acesso direto',
  })[source] ?? 'Outra origem'
