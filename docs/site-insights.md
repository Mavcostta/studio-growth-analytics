# Site Insights

A seção usa somente o contrato GA4 já conectado, sem novas consultas, tracking
ou cruzamento com Instagram. Usa os componentes e estilos existentes.

## Taxa e limites

`whatsappRate = whatsapp_click / screenPageViews × 100`, para o mesmo período
de sete dias completos. Se visualizações estiverem ausentes, usa sessões e
identifica a unidade no texto. Denominador zero não produz taxa nem aciona
fallback. Ausência, números inválidos e contagens acima da precisão segura não
são tratados como zero. Zero explicitamente retornado em cliques é válido.

A taxa mede eventos por visualização/sessão, não pessoas convertidas. Pode
ultrapassar 100% por repetição de eventos; não é limitada artificialmente.
Clique no WhatsApp indica intenção, não conversa ou agendamento.

Menos de 30 observações no denominador gera aviso de amostra pequena. Esse é
um limiar editorial de cautela, não significância estatística. Mesmo acima
dele, o texto não afirma causalidade nem confiança estatística.

## Por que alguns insights permanecem pendentes

- Página de maior intenção: faltam visualizações por página. Não dividir os
  cliques de uma página pelas visualizações de todo o site.
- Origem mais qualificada: faltam cliques por origem/mídia de sessão. Não
  distribuir cliques totais proporcionalmente às sessões.
- Muita visita/pouco clique e pouca visita/alta taxa: faltam os denominadores
  por página e uma lista de todas as páginas visitadas. A consulta filtrada por
  `whatsapp_click` não prova zero clique nas páginas ausentes.
- Serviço de maior interesse: `select_service` está agregado, sem dimensão
  `service`. Não inferir serviço a partir do nome ou caminho de uma página.
- CTA de maior taxa: requer `cta_location` identificado e uma base de exposições
  correspondente. `linkText` não substitui localização; apenas cliques não
  medem taxa. A indisponibilidade descreve os relatórios conectados, não prova
  que um parâmetro inexista no tracking.

Os quatro cards apresentam a taxa geral descritiva e essas pendências. Não há
rankings simulados, preenchimento de ausências nem afirmação de vencedores
sem dados comparáveis. Erro e loading não reutilizam insights anteriores.
