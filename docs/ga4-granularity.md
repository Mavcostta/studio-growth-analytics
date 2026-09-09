# Granularidade GA4

Endpoint existente: `GET /api/dev/analytics/test`. Todos os relatórios usam os
mesmos sete dias completos, `7daysAgo` até `yesterday`, no fuso da propriedade.
Nenhuma mudança no layout ou Instagram.

O objeto `details` acrescenta:

- `pageViews`: `page` (pagePath), `screenPageViews`, sem filtro de evento.
- `sourceSessions`: `source` (sessionSource), `medium` (sessionMedium), `sessions`, sem filtro de evento.
- `sourceWhatsapp`: mesma chave composta de origem/mídia, `eventCount`, filtrado por `whatsapp_click`.
- `services`: `service`, `eventCount`, filtrado por `whatsapp_click`.
- `serviceSelections`: `service`, `eventCount`, filtrado por `select_service`.
- `ctaLocations`: `cta_location`, `eventCount`, filtrado por `whatsapp_click`.

`pages` continua trazendo cliques por `page`. Valores numéricos permanecem strings
para preservar precisão. `(not set)` e dimensões vazias viram `null`. Relatórios
sem linhas são `empty`; falhas ou dimensões não registradas são `unavailable`.
`registered` e `identifiedValues` distinguem registro e presença de valores no
período; `null` significa que não foi possível verificar.

Para calcular taxas, relacione `pages` e `pageViews` pela página exata e divida
eventCount por screenPageViews. Para origens, relacione `sourceWhatsapp` e
`sourceSessions` pela tupla (source, medium) e divida eventCount por sessions.
Não use sessões do relatório filtrado como denominador. Preserve linhas sem
par correspondente e taxas sem denominador como `null`, nunca zero. Dimensões
desconhecidas não permitem atribuição confiável. Não agrupe `/` e `/index.html`
sem decisão explícita. Eventos podem se repetir, então taxas podem exceder 100%.

Serviço e CTA permitem contagens identificadas, não taxas de exposição: não há
impressões de CTA nem exposições por serviço nesta integração. Cada seção tem
limite de 1000 linhas e sinaliza `partial` quando truncada ou limitada pelo GA4;
não tratar essa situação como um ranking completo.

## Diagnóstico verificado

A consulta real confirmou ausência de `customEvent:service` e
`customEvent:cta_location` nos metadados. O código público de
`https://www.studioannacosta.com.br/js/analytics.js` prepara ambos os parâmetros
nos cliques, com valores extraídos de atributos HTML e envio condicionado ao
consentimento. A inspeção foi somente de leitura, sem executar cliques.

Isso comprova uma pendência de registro, mas a leitura do código não comprova
recepção efetiva dos parâmetros pelo Google. Para confirmar coleta, verifique
um evento consentido em DebugView/Tempo real. Não há evidência suficiente para
afirmar que exista falha no tracking nem para garantir que só o registro resolva.

Em GA4 → Administrador → Definições personalizadas, crie dimensões de escopo
Evento com parâmetros exatos `service` e `cta_location`. Após registro e coleta,
a disponibilização dos valores pode levar 24–48 horas. Nada foi criado
automaticamente na propriedade.

O relatório de hostname também retornou `127.0.0.1` junto ao domínio público:
os dados da propriedade incluem tráfego local. Não foi aplicado filtro novo.

Referências: [dimensões personalizadas](https://support.google.com/analytics/answer/14239696)
e [esquema da Data API](https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema).
