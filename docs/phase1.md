# Fase 1: coleta de crescimento

O layout e as consultas de mídias do Instagram permanecem iguais. Nenhuma recomendação nova foi implementada.

## Instagram

`GET /api/dev/instagram/account` funciona no backend local (porta 3001) e como Vercel Function. Usa exclusivamente `process.env.INSTAGRAM_ACCESS_TOKEN`, com o cliente existente e Graph Instagram v25.0.

- `me?fields=user_id,followers_count`: total de seguidores no instante de coleta, em `followers.value`.
- `/{id}/insights`: `profile_views`, `reach`, `accounts_engaged`, `views`, `total_interactions`, `profile_links_taps`, individualmente, `period=day`, `metric_type=total_value`, último dia completo delimitado em UTC.
- `follows_and_unfollows`: mesmo período e `breakdown=follow_type`; FOLLOWER corresponde a entradas e NON_FOLLOWER a saídas. `net` só existe quando ambos retornam números.
- `follower_count`: últimos sete dias, `period=day`, `metric_type=time_series`, em `dailyNewFollowers`. É a série de novos seguidores, não o total histórico. O `end_time` original da Meta é preservado; não deslocar os pontos para o fuso do snapshot.

Cada medida possui status e valor; ausência ou falha permanece `null`, enquanto zero explícito é preservado. Uma métrica rejeitada não remove as outras. Autenticação, permissão e limite interrompem a sequência principal de consultas.

Validação real em 09/09/2026: HTTP 200, seguidores 2.194. Período 08/09 00:00 até 09/09 00:00 UTC: profile_views 10, reach 165, accounts_engaged 6, views 950, total_interactions 7, profile_links_taps 0. `follower_count` retornou sete pontos. `follows_and_unfollows` não trouxe valores nesse dia: entradas, saídas e saldo permanecem indisponíveis.

## Snapshots

`npm run snapshots:collect` carrega `.env` somente no processo backend e coleta as duas fontes. Cada fonte tem um arquivo independente, versionado (`schemaVersion`), identificado por conta/propriedade, data UTC de observação e timestamp da coleta. A primeira coleta válida de cada fonte/dia é imutável; repetir retorna `already_exists`. Falhas não viram zero e uma fonte pode persistir mesmo se a outra falhar. Falha parcial retorna HTTP 503/código de saída 1 para permitir nova tentativa.

- Desenvolvimento: `.snapshots/snapshots/{instagram|ga4}/{id}/YYYY-MM-DD.json`, com publicação atômica via arquivo temporário e hard link exclusivo. Executar diariamente pelo agendador local se precisar histórico local contínuo.
- Produção: mesmos caminhos `snapshots/...` em **Vercel Blob privado**. Configure um store privado e `BLOB_READ_WRITE_TOKEN` no ambiente do backend. Sem token ou com erro de armazenamento, a coleta informa indisponibilidade; nunca usa disco efêmero como fallback.
- Cron preparado em `vercel.json`, diariamente às 12:00 UTC (09:00 de São Paulo), `GET /api/cron/snapshots`. Configure `CRON_SECRET` aleatório e forte no ambiente de produção. O handler exige `Authorization: Bearer <CRON_SECRET>`; a Vercel envia esse header. Configuração efetiva após deploy. Nenhum deploy ou criação de store foi feito nesta fase.
- `.env`, `credentials/` e `.snapshots/` ficam fora do Git, dos arquivos servidos pelo Vite e dos artefatos enviados às Functions. Os dados não são importados pelo frontend.

Os primeiros snapshots locais foram coletados em 09/09/2026. Não há total histórico de seguidores anterior a essa data. O snapshot GA4 conserva os relatórios sanitizados existentes: período de sete dias, dias explícitos, fuso da propriedade, série diária, eventos, páginas, origens e dimensões personalizadas. Séries anteriores que o GA4 efetivamente retorna não são confundidas com snapshots anteriores.

Para tendências futuras de 7/30/90 dias, usar datas e cobertura reais, manter lacunas e exigir pontos comparáveis. Não somar alcance, contas engajadas ou usuários únicos de dias distintos como se fossem únicos no período. Cliques WhatsApp medem intenção, não agendamentos. A Fase 1 não calcula recomendações nem altera cards.

Limitação: o primeiro snapshot diário pode conter insights parciais devido ao processamento da fonte. Ele não é reescrito; uma futura política de reconciliação deve guardar revisões separadas, sem substituir silenciosamente a observação original. O Blob real ainda depende de configuração e teste em produção.

## GA4 e tráfego local

Todas as chamadas `runReport` passam por `withoutLocalTraffic`: NOT hostName FULL_REGEXP para localhost, subdomínios `.localhost`, loopback 127.x.x.x e ::1, incluindo porta quando presente. O filtro é combinado com AND aos filtros existentes de evento. Totais e denominadores usam a mesma exclusão; produção e domínios Vercel continuam incluídos. Não altera tracking nem filtros da propriedade.

Validação real com filtro, últimos sete dias completos: HTTP 200, 4 usuários ativos, 5 sessões, 13 visualizações, 62 eventos; 6 whatsapp_click, 2 select_service e 14 scroll_depth.

`customEvent:service` e `customEvent:cta_location` existem no metadata. Os seis cliques WhatsApp continuam sem valores identificados para ambas; as duas seleções também não identificam service. `(not set)` é normalizado como `null`, com status parcial. Não criar novas dimensões.

A inspeção do código público do site mostrou o envio de `service` a partir de `data-service` (com fallback do serviço da página), e `cta_location` a partir de `data-location`, para `whatsapp_click`/`select_service`, após consentimento. Os links inspecionados possuem esses atributos. Não foi demonstrado defeito de código que justificasse alteração. A Data API não permite distinguir, nesses registros, eventos anteriores ao registro das dimensões, processamento pendente ou ausência de parâmetros em clientes antigos. Para fechar a causa, observar eventos genuínos novos no DebugView e seu processamento; esta fase não gerou eventos de teste nem alterou site/GA4.

Referências: [Vercel Blob privado](https://vercel.com/docs/vercel-blob/private-storage), [segurança e configuração de Cron](https://vercel.com/docs/cron-jobs/manage-cron-jobs).
