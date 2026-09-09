# Instagram — normalização e análise exploratória (fase 2)

Somente backend. Dashboard React e mocks intactos; sem banco, webhooks, publicação, mensagens, comentários ou nova dependência. A métrica `comments` é apenas uma contagem agregada; nenhum texto de comentário foi consultado.

## Coleta observada

06/09/2026, 17:36:42 UTC (14:36:42 São Paulo), conta **@annamrdesigner**. Endpoint local `GET http://127.0.0.1:3001/api/dev/instagram/posts`, HTTP 200, status `ok`. Foram 27 chamadas à Meta, todas HTTP 200: perfil, uma página de mídias e 25 consultas de insights.

**25 publicações** entre 26/02/2026 e 05/09/2026 no fuso brasileiro. Não é uma janela de 30 dias. A API indicou mais publicações; a coleta parou no limite solicitado. Nenhuma mídia descartada por ID inválido e nenhuma data ausente.

| Tipo interno | Quantidade | Sete métricas disponíveis | Indisponíveis/sem dados/erros |
| ------------ | ---------: | ------------------------- | ----------------------------- |
| reel         |         13 | Todas, em 13/13           | Nenhuma                       |
| image        |          1 | Todas, em 1/1             | Nenhuma                       |
| carousel     |         11 | Todas, em 11/11           | Nenhuma                       |
| video        |          0 | Não observado             | Não testado                   |
| unknown      |          0 | Não observado             | Não testado                   |

As sete métricas são `reach`, `views`, `saved`, `shares`, `likes`, `comments` e `total_interactions` (normalizada para `totalInteractions`). Foram retornados 175 valores numéricos, incluindo zeros legítimos. A disponibilidade está confirmada somente para essa amostra/versão, não para qualquer mídia ou conta.

## Endpoints e limites

Host fixo `https://graph.instagram.com/v25.0`, mesma versão validada na fase anterior:

1. `GET /me?fields=user_id,username`.
2. `GET /{user_id}/media?fields=id,caption,media_type,media_product_type,timestamp,permalink,thumbnail_url,media_url,username&limit=25`.
3. `GET /{media_id}/insights?metric=reach,views,saved,shares,likes,comments,total_interactions`, uma chamada por mídia quando aceita.

Se um conjunto for rejeitado por incompatibilidade de métrica, consultar as sete separadamente para aquela mídia. Não assumir que rejeição em um post se aplica a todo o tipo. Nesta coleta não houve fallback: todas as consultas conjuntas foram aceitas.

Paginação usa somente `paging.cursors.after` em nova URL montada para o host fixo. Nunca segue/retorna `paging.next`, que pode conter credencial. Deduplicação por ID, limite de 25 posts e cinco páginas; cursor repetido/ausente interrompe paginação com resultado parcial. Máximo de 206 chamadas (perfil + cinco páginas + oito chamadas por post no pior caso de fallback). Sem retries automáticos; chamadas sequenciais, timeout de 15s por chamada e interrupção por token, permissão, rate limit ou falha de rede.

## Campos observados

ID, caption, media_type, media_product_type, timestamp, permalink e username vieram nos 25 posts.

| Campo opcional | Reels (13) | Imagem (1) | Carrosséis (11) |
| -------------- | ---------: | ---------: | --------------: |
| thumbnail_url  |         13 |          0 |               0 |
| media_url      |          3 |          1 |              11 |

Logo, `media_url` faltou em 10 Reels; não foi inventada nem substituída por thumbnail. `thumbnail_url` não veio em imagens/carrosséis. Nenhuma URL recebida precisou ser removida pelo filtro de segurança nesta coleta. URLs de CDN são temporárias, não são identificadores permanentes e não foram baixadas. Carrossel representa a mídia pai: não consultamos os filhos nem métricas individuais dos slides.

## Modelo interno

Tipos em `server/integrations/instagram/types.ts`. `contentType`: REELS (ou REEL) → reel; IMAGE → image; CAROUSEL_ALBUM → carousel; VIDEO sem REELS → video; outros/ausentes → unknown. Os tipos originais seguros são preservados em mediaType/mediaProductType.

Campos textuais e URLs são opcionais; publicado sem data válida recebe derivados null e um aviso em issues. caption limitada a 2.200 caracteres depois da remoção de credenciais; username validado. `fieldsReceived` lista somente nomes permitidos que vieram da API; `omittedUrlFields` registra URLs recebidas mas recusadas pelo filtro.

Todas as sete chaves de metrics existem: número quando recebido, null nos demais casos. metricStatus distingue:

| Status      | Significado                                                       |
| ----------- | ----------------------------------------------------------------- |
| available   | Valor numérico recebido; zero preservado                          |
| unavailable | Meta rejeitou explicitamente a métrica                            |
| no_data     | Resposta aceita sem valor numérico para a métrica                 |
| error       | Erro de API ou formato inesperado; não comprova incompatibilidade |
| not_tested  | Consulta não realizada, por exemplo após interrupção              |

metricErrors contém apenas categoria, mensagem interna fixa e código/subcódigo numéricos. Nada de mensagens brutas da Meta. Um erro isolado de mídia não descarta as outras. Falhas globais retornam HTTP apropriado e preservam posts/resultados já obtidos com status parcial. Lista vazia é uma coleta válida com count zero.

## Datas e timezone

Na amostra, timestamps da Meta vieram com `+0000` (UTC). `publishedAt` preserva exatamente esse texto. `publishedDate`, `publishedHour` (0–23) e `dayOfWeek` (ISO: segunda=1, domingo=7) usam explicitamente `America/Sao_Paulo` via Intl. Não usamos o timezone do computador nem subtração fixa de três horas: Intl respeita regras históricas de horário de verão. Timestamp inválido, data civil impossível ou sem offset não recebe derivados.

Exemplo real: `2026-09-06T01:28:06+0000` → **05/09/2026, sábado, 22:28:06 em São Paulo**. As futuras análises do dashboard brasileiro deverão usar os derivados, preservando o original para auditoria.

## Valores máximos observados

Não são recomendações de postagem. Valores da vida da mídia observados agora, com idades/exposição diferentes.

| Métrica           | Maior valor | Publicação                                                                                 |
| ----------------- | ----------: | ------------------------------------------------------------------------------------------ |
| Alcance           |       1.835 | [Reel “Quando os pensamentos estão a milhão”](https://www.instagram.com/reel/DbgRVMcxxF_/) |
| Visualizações     |       2.943 | Mesmo Reel acima                                                                           |
| Compartilhamentos |           6 | [Carrossel sobre o processo de Lash Lifting](https://www.instagram.com/p/DVwhzUzkfN1/)     |

Salvamentos: **3**, com empate entre quatro publicações, sem escolher um vencedor arbitrário:

- [Reel de 15/08 — “O que realmente custa caro…”](https://www.instagram.com/reel/DcE2mltxE6N/).
- [Carrossel de 01/08 — cílios com fio 4D](https://www.instagram.com/p/DbhBcHCDdIt/).
- [Reel de 28/04 — Volume Aisha](https://www.instagram.com/reel/DXsGCQEEfTh/).
- [Carrossel de 14/04 — Efeito Fox e design](https://www.instagram.com/p/DXH7Vn7EXqw/).

Mais recente: [Reel “Sabadinho com 4 atendimentos”](https://www.instagram.com/reel/Dc7WSG8B6Pd/), publicado em **05/09/2026 às 22:28:06**, São Paulo.

## Distribuição por dia e hora de publicação

| Dia em São Paulo | Posts |
| ---------------- | ----: |
| Segunda          |     4 |
| Terça            |     5 |
| Quarta           |     2 |
| Quinta           |     4 |
| Sexta            |     2 |
| Sábado           |     6 |
| Domingo          |     2 |

| Hora em São Paulo | Posts |
| ----------------- | ----: |
| 10h               |     1 |
| 11h               |     1 |
| 12h               |     1 |
| 13h               |     2 |
| 14h               |     1 |
| 15h               |     1 |
| 16h               |     1 |
| 17h               |     5 |
| 18h               |     2 |
| 19h               |     4 |
| 20h               |     2 |
| 21h               |     2 |
| 22h               |     2 |

00h–09h e 23h: zero publicações nesta amostra. As distribuições somam 25 e descrevem quando houve postagem; **não medem o melhor horário**.

## Exemplos sanitizados

Projeções do modelo, com legendas abreviadas e URLs temporárias de CDN omitidas apenas nesta documentação. IDs/permalinks são identificadores públicos, não credenciais.

```json
[
  {
    "id": "17899463169373292",
    "caption": "Não julguem minha voz gripada…",
    "contentType": "reel",
    "publishedAt": "2026-09-06T01:28:06+0000",
    "publishedDate": "2026-09-05",
    "publishedHour": 22,
    "dayOfWeek": 6,
    "permalink": "https://www.instagram.com/reel/Dc7WSG8B6Pd/",
    "metrics": {
      "reach": 443,
      "views": 893,
      "saved": 0,
      "shares": 2,
      "likes": 44,
      "comments": 12,
      "totalInteractions": 62
    }
  },
  {
    "id": "17893690800350106",
    "caption": "OLHAR DE CAMPEÃ…",
    "contentType": "image",
    "publishedAt": "2026-06-09T00:32:46+0000",
    "publishedDate": "2026-06-08",
    "publishedHour": 21,
    "dayOfWeek": 1,
    "permalink": "https://www.instagram.com/p/DZWFa2jteMB/",
    "metrics": {
      "reach": 386,
      "views": 851,
      "saved": 0,
      "shares": 0,
      "likes": 16,
      "comments": 1,
      "totalInteractions": 17
    }
  },
  {
    "id": "18094521332639843",
    "caption": "Design com aplicação de henna…",
    "contentType": "carousel",
    "publishedAt": "2026-08-31T17:24:40+0000",
    "publishedDate": "2026-08-31",
    "publishedHour": 14,
    "dayOfWeek": 1,
    "permalink": "https://www.instagram.com/p/DctnfpAEU_N/",
    "metrics": {
      "reach": 209,
      "views": 609,
      "saved": 0,
      "shares": 0,
      "likes": 14,
      "comments": 3,
      "totalInteractions": 18
    }
  }
]
```

Nos três exemplos todos os metricStatus são available. `totalInteractions` é o valor retornado pela Meta, não a soma calculada dos campos visíveis. Há diferenças observadas (ex.: Reel 62 versus soma 58); preservamos a resposta sem atribuir uma causa não verificada.

## Segurança, execução e validação

Token exclusivamente de process.env.INSTAGRAM_ACCESS_TOKEN, carregado por dotenv; .env continua ignorado. URLs permitidas somente HTTPS, sem usuário/senha/porta não padrão, domínio Instagram para permalink e CDN Instagram/Facebook para mídias; URLs com parâmetros de credenciais são omitidas. Não há download, scraping ou acesso às URLs de mídia. Não registrar credenciais nem respostas brutas.

```sh
npm run server:dev
# Em outro terminal:
curl.exe http://127.0.0.1:3001/api/dev/instagram/posts
```

A rota tem as mesmas proteções locais da primeira fase (sem CORS, modo dev, Host/Origin), e compartilha o limite de uma execução por vez com /test. Dados são coletados a cada chamada manual; não há cache ou persistência de produção. O artefato local de conferência `.qa/instagram-posts.json` contém apenas a resposta filtrada, fica ignorado pelo Git e não é consumido pelo dashboard.

Testes: `npm run test:instagram` (normalização, campos opcionais, paginação, teto 25, segredo, fallback, null/zero, rate limit, timezone e empates), `npm test` (regras MOCK), `npm run typecheck`, `npm run lint`, `npm run build`.

Referência de métricas candidatas: [coleção oficial da Meta — Insights](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api?entity=request-23987686-1ff01566-3509-48bd-a0f4-8571a91ccfdf). A disponibilidade relatada aqui foi confirmada pelas chamadas reais, não inferida da lista de métricas.
