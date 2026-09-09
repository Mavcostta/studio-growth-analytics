# Teste local do GA4 — Fase 4B

Endpoint: `GET http://127.0.0.1:3001/api/dev/analytics/test`.
Inicie com `npm run server:dev`. A rota exige desenvolvimento, host local e GET;
não aceita chamadas cross-origin. O dashboard consulta essa rota pelo proxy local
do Vite. Inicie também `npm run dev` para visualizar os resultados.

## Configuração

1. No Google Cloud, ative **Google Analytics Data API** no projeto da service account.
2. Crie uma service account e uma chave JSON. Não é necessário conceder papéis de
   administrador do projeto para consultar relatórios do GA4.
3. Salve a chave em `credentials/ga4-service-account.json` (diretório ignorado pelo Git).
4. No GA4, abra **Administrador → Gerenciamento de acesso à propriedade** de Studio
   Anna Costa e adicione o `client_email` da chave com papel **Leitor**.
5. Em **Detalhes da propriedade**, copie o ID numérico. `G-EMDNPLS1H3` identifica
   o fluxo de medição e não pode substituir o ID da propriedade na Data API.
6. Configure apenas no `.env` local e reinicie o backend:

```dotenv
GA4_PROPERTY_ID=ID_NUMERICO_DA_PROPRIEDADE
GOOGLE_APPLICATION_CREDENTIALS=credentials/ga4-service-account.json
```

O caminho relativo é resolvido a partir da raiz do projeto ao executar o script.
Não coloque a chave no frontend, em `public/`, em variáveis `VITE_*` nem no Git.
`.env.example` contém somente nomes sem valores. A autenticação usa
`google-auth-library` e o escopo `analytics.readonly`, sem OAuth interativo.

## Consulta e resposta

Uma chamada local executa dois POSTs para
`https://analyticsdata.googleapis.com/v1beta/properties/{ID}:runReport`:

- Totais: `activeUsers`, `sessions`, `screenPageViews`, `eventCount`.
- Dimensão `eventName`, métrica `eventCount`, filtro exato para `whatsapp_click`,
  `select_service`, `scroll_depth`.

Período: `7daysAgo` até `yesterday`, inclusivo — sete dias completos no fuso
da propriedade. Não inclui o dia em andamento. Os dados dependem do processamento
do GA4; eventos ainda não coletados/processados podem não aparecer.

As contagens permanecem strings como na API (inclusive `"0"`), evitando perda de
precisão de inteiros grandes. `null` significa ausência de linha, nunca zero
inventado. HTTP 200 pode ter `status: success`, `partial` ou `empty`. Ausência de
um evento no relatório não comprova que ele não esteja configurado no site.
Não há fallback, armazenamento ou exposição de tokens, chaves e erros brutos.

Erros sanitizados: HTTP 503 para configuração de propriedade/credencial ausente
ou inválida; 401 para autenticação; 403 para permissão/API desativada (também pode
indicar propriedade inacessível); 404 para propriedade não encontrada/inacessível;
429 para quota; 502 para falha da API, rede ou resposta inesperada.

Validação automatizada: `npm run test:ga4`. Os dados simulados existem somente nos
testes automatizados; não são resultado de consulta real nem fallback da rota.

## Integração no dashboard e teste real

Consulta real executada em 08/09/2026: HTTP 200, propriedade `553016827`,
`status: success`. Retorno: `activeUsers: "3"`, `sessions: "3"`,
`screenPageViews: "13"`, `eventCount: "50"`, `whatsapp_click: "3"`,
`select_service: "2"`, `scroll_depth: "10"`. Esses valores registram o teste,
não são fixados no frontend; cada carregamento consulta novamente o backend.

A seção do site usa os cards e painéis existentes, sem alterações no CSS.
Carregamento e falha mostram travessões, com mensagem e nova tentativa no erro;
respostas vazias/parciais mostram aviso e preservam `null` como “Sem dados”.
Não há comparação com período anterior, série diária, origem de tráfego ou
funil atribuído na consulta atual. Os painéis indicam essas limitações e não
mostram números simulados. Os eventos são contagens, não usuários únicos.

As consultas de GA4 e Instagram têm bloqueios independentes no servidor para
carregarem juntas, mantendo a integração Instagram existente. Chamadas GA4
simultâneas no mesmo frontend compartilham a requisição em andamento.
O Vite bloqueia acesso HTTP à pasta `credentials/`, `.env` e arquivos de chave.
Credenciais são lidas exclusivamente no backend e nunca importadas no frontend.

A rota é local e de desenvolvimento. O build estático sozinho não disponibiliza
a API: implantação permanece fora do escopo.

Referências oficiais: [quickstart](https://developers.google.com/analytics/devguides/reporting/data/v1/quickstart-client-libraries)
e [relatórios](https://developers.google.com/analytics/devguides/reporting/data/v1/basics).
