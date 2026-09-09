# Backend — teste de leitura do Instagram

Fase 2: `GET /api/dev/instagram/posts` normaliza até 25 publicações e gera um resumo exploratório. Ver [dados reais e limites](../docs/instagram-data.md).

Agora existe um servidor local Node/TypeScript para `GET /api/dev/instagram/test`. Execute `npm run server:dev`. Configuração e segurança em [teste Instagram](../docs/instagram-test.md). Não conecta o dashboard nem persiste dados.

## Estrutura futura, fora deste teste

Nenhum Express, banco, OAuth ou job nesta fase. Na etapa autorizada:

| Pasta        | Responsabilidade                       |
| ------------ | -------------------------------------- |
| controllers  | Validar solicitações e responder       |
| routes       | Rotas e callbacks OAuth                |
| services     | Regras e consultas                     |
| integrations | Instagram, GA4 e Business Profile      |
| database     | Migrações SQL e acesso ao PostgreSQL   |
| jobs         | Coleta periódica e reprocessamento     |
| utils        | Utilitários compartilhados necessários |

Credenciais exclusivamente no servidor. Ver [arquitetura](../docs/architecture.md).
