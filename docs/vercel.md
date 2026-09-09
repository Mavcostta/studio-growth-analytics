# Vercel

Importe o projeto como Vite, Node.js 22.x, build `npm run build`, saída `dist`.
O vercel.json habilita Fluid Compute e configura duração de 240 segundos.
As duas funções em `api/` importam os serviços existentes, sem abrir porta ou
carregar dotenv. O frontend continua usando URLs relativas, no mesmo domínio:

- `/api/dev/analytics/test`
- `/api/dev/instagram/posts`

O segmento `dev` foi preservado para compatibilidade com o frontend. O servidor
local e seu proxy Vite continuam exclusivos do desenvolvimento: a saída estática
de produção não depende de localhost. Não há rewrite geral para index.html,
que poderia capturar `/api`; a navegação atual do app usa hash.

## Variáveis do projeto na Vercel

- `INSTAGRAM_ACCESS_TOKEN`: token existente da conta profissional.
- `GA4_PROPERTY_ID`: ID numérico da propriedade.
- `GA4_SERVICE_ACCOUNT_JSON`: conteúdo JSON completo da chave da service account,
  como valor da variável, sem aspas externas adicionais. O JSON deve preservar
  os escapes `\n` de private_key. Use a conta com acesso de Leitor no GA4.

Cadastre as variáveis nos ambientes Production e Preview desejados e faça um novo
deploy após mudanças. Não use prefixo VITE_. Não cadastre
GOOGLE_APPLICATION_CREDENTIALS na Vercel: o arquivo só é aceito no desenvolvimento.
JSON de ambiente inválido nunca aciona fallback para arquivo.

`.gitignore`, `.vercelignore` e exclusões do bundle protegem arquivos locais de
credenciais. A autenticação do Google e o token Instagram ficam no servidor.
As respostas não usam cache compartilhado. GET é o único método aceito, e
requisições cross-origin do navegador são rejeitadas.

As funções não adicionam login: URLs publicamente acessíveis permitem consultar
os dados agregados do dashboard. Para acesso restrito, configure Deployment
Protection na Vercel. O bloqueio de consultas simultâneas vale por instância,
não constitui limitação distribuída de requisições.

## Validação

`npm run test:vercel` testa os handlers via HTTP local e a configuração de
credenciais em produção, sem consultar serviços reais. `npm run typecheck` e
`npm run build` incluem as funções. O build Vite local não equivale a um deploy
validado na infraestrutura Vercel. Após deploy, abra os dois endpoints acima
no domínio publicado e confirme as respostas e a renderização do dashboard.

Referências: [runtime Node.js](https://vercel.com/docs/functions/runtimes/node-js)
e [duração das funções](https://vercel.com/docs/functions/configuring-functions/duration).
