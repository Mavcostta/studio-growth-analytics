# Teste mínimo de leitura do Instagram

A segunda fase adicionou `/api/dev/instagram/posts` sem modificar o teste abaixo. Resultados e modelo em [instagram-data.md](instagram-data.md).

## Resultado observado em 06/09/2026

Teste real concluído: rota local HTTP 200, perfil @annamrdesigner e três mídias. Todas as seis consultas à Meta retornaram HTTP 200. Apenas a primeira mídia (Reel publicado em 06/09/2026 UTC) foi usada nos insights.

| Métrica testada | Valor retornado | Disponibilidade                        |
| --------------- | --------------- | -------------------------------------- |
| reach           | 440             | Disponível                             |
| views           | 891             | Disponível                             |
| saved           | 0               | Disponível; zero é um resultado válido |
| shares          | 2               | Disponível                             |

Nenhuma das quatro métricas testadas foi rejeitada. Outras métricas, mídias e insights da conta não foram testados. Valores são um retrato do momento da consulta, sem garantia de disponibilidade em outras mídias.

Campos preservados: perfil user_id/username; mídias id/media_type/media_product_type/timestamp; insights name e values.value. Credenciais, paginação e respostas brutas não foram gravadas. Exemplo resumido e sanitizado (IDs omitidos):

```json
{
  "status": "ok",
  "profile": { "username": "annamrdesigner" },
  "mediaCount": 3,
  "testedMediaType": "REELS",
  "insights": { "reach": 440, "views": 891, "saved": 0, "shares": 2 }
}
```

O formato completo da rota contém também endpoints, status HTTP por chamada, campos retornados e disponibilidade individual; o exemplo acima é apenas um resumo.

Backend Node/TypeScript com HTTP e fetch nativos. Única dependência nova: dotenv. Dashboard e mocks independentes, sem CORS ou proxy Vite.

## Executar

Crie `.env` na raiz (ignorado pelo Git) com `INSTAGRAM_ACCESS_TOKEN=` preenchido **localmente**. Não envie o valor ao chat. O service lê apenas `process.env.INSTAGRAM_ACCESS_TOKEN`. dotenv carrega o arquivo sem logs. Variável de ambiente existente tem precedência. Reinicie após alterar `.env`.

```sh
npm run server:dev
```

Em outro terminal, sem credenciais no comando:

```sh
curl.exe -i http://127.0.0.1:3001/api/dev/instagram/test
```

Somente GET, bind 127.0.0.1:3001, flag explícita --dev, bloqueado com NODE_ENV=production. Requisições com Origin, Host externo e navegação cross-site são rejeitadas. Use 127.0.0.1, não localhost. Ctrl+C encerra.

## Consultas

Fluxo esperado: Instagram Login, não Facebook Login. Host fixo graph.instagram.com; versão fixada v25.0 (não pretende ser a mais recente). Sem detecção automática ou envio de token a outro host.

1. GET /v25.0/me?fields=user_id,username
2. GET /v25.0/{user_id}/media?fields=id,media_type,media_product_type,timestamp&limit=3
3. Para a primeira mídia apenas: GET /v25.0/{media_id}/insights?metric=reach, depois views, saved e shares em chamadas separadas.

Até seis chamadas por execução. Sem paginação, retries, agendamento ou gravação de respostas. Token no header Authorization, nunca na URL. Timeout de 15 segundos por chamada, redirecionamentos bloqueados. Uma execução por vez.

Permissões esperadas: instagram_business_basic e instagram_business_manage_insights. Disponibilidade depende de tipo, idade da mídia, versão e autorização.

## Resposta e erros

Somente endpoint sem credencial, status HTTP da Meta, IDs, username, tipos/data da mídia e valores numéricos. Exclui legendas, URLs de mídia, paginação, headers e erros brutos. Sem logs de requisições/respostas ou erros brutos. Defesa adicional remove eventual eco do token em campos permitidos.

Status geral: ok (quatro métricas), partial (sem mídias/dados ou métrica incompatível), error (falha). Preserva resultados seguros anteriores em caso de falha posterior.

| Erro                    | HTTP local  | Significado                                                 |
| ----------------------- | ----------- | ----------------------------------------------------------- |
| missing_token           | 503         | Token ausente; nenhuma chamada à Meta                       |
| invalid_token           | 401         | Token inválido/expirado                                     |
| insufficient_permission | 403         | Permissão/acesso insuficiente                               |
| metric_unavailable      | 200 parcial | Erro isolado em insights.results, continua outras métricas  |
| rate_limit              | 429         | Interrompe consultas restantes                              |
| api_error               | 502         | Rede, timeout, resposta inesperada ou erro não classificado |

Código/subcódigo numérico da Meta preservados, mensagem original nunca. Código 100 sem indicação de métrica continua genérico. no_data significa consulta sem valor; não é zero nem incompatibilidade comprovada. not_tested significa não consultada. Testa quatro métricas, não enumera todas as métricas existentes.

## Verificar sem credenciais reais

```sh
npm run test:instagram
npm run typecheck
npm run lint
npm run build
```

Testes usam fetch simulado e token fictício; nunca chamam a Meta. Cobrem sanitização, erros, zero, ausência de dados, parada por rate limit, falha de rede e rota protegida.

Referências: [Instagram Login — Meta](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/), [Insights — coleção oficial](https://www.postman.com/meta/instagram/folder/23987686-f659d7d1-d74c-44e4-9192-9b1e8694c511).

Sem webhooks, publicação, comentários, mensagens, OAuth próprio, banco ou conexão com dashboard. Pare após avaliar o resultado.
