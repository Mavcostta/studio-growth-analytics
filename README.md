# Studio Growth Analytics

**Fase 3:** as áreas de Instagram do dashboard agora usam o backend real. Site, Google e WhatsApp continuam simulados e identificados. Inicie `npm run server:dev` e `npm run dev` em terminais separados. Metodologia, limites e estados da interface em [Instagram no dashboard](docs/instagram-dashboard.md). As seções abaixo registram também a base original do MVP.

**Teste real separado disponível:** backend local de leitura do Instagram em `npm run server:dev`. Veja [instruções e limites](docs/instagram-test.md). O dashboard abaixo continua na fase MOCK, sem conexão com esse backend.

Dashboard do Studio Anna Costa para entender crescimento, conteúdo e interesse em serviços sem jargão técnico.

**Fase 1: MVP visual com dados inteiramente fictícios.** Sem integrações, autenticação, banco ou deploy. Período fixo: 02–31/08/2026, comparado a 03/07–01/08/2026. A data é um indicador; ainda não há seletor de períodos.

## Executar

Node.js 22.12+ e npm. Verificado nesta máquina com Node 22.15 e npm 10.9.2.

```sh
npm install
npm run dev
```

Abra o endereço informado pelo Vite, normalmente http://127.0.0.1:5173. No PowerShell, use `npm.cmd` se a política de scripts impedir `npm`. Nenhuma variável de ambiente é necessária.

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run format:check
npm run preview
```

`preview` serve o build local; não publica o projeto. Ctrl+C para parar. `npm ci` reproduz as versões do lockfile. `npm run format` aplica a formatação.

## O que funciona

- Visão Geral: seis indicadores, comparações, gráfico alternável de 30 dias, funil, origens, top conteúdos e insights.
- Conteúdo & Conversão: oito posts, busca, filtros de formato, ordenação por pontuação/alcance/cliques/salvos/compartilhamentos, classificação, melhores dias e horários.
- Navegação por hash e histórico do navegador. Tabela vira cards em telas menores. Controles rotulados, foco visível e tabela alternativa ao gráfico.
- Regras automáticas sobre dados separados da interface; sem IA.

## Dependências

React/React DOM para UI; TypeScript para tipos; Vite e plugin React para desenvolvimento/build; Recharts como única biblioteca de gráficos, com react-is compatível com React; CSS Modules sem dependência de estilo.

ESLint, typescript-eslint, plugins React Hooks/Refresh e globals para análise; Prettier e eslint-config-prettier para formatação; tipos de React/DOM/Node. Testes usam node:test e node:assert, sem framework novo. Versões exatas em package-lock.json.

Extensões opcionais do VS Code: ESLint e Prettier. Nenhuma extensão instalada.

## Estrutura

```text
src/
  components/       MetricCard, Chart, InsightCard, ConversionFunnel, TopContent
  pages/            Dashboard, ContentAnalytics
  services/         analytics, instagram, googleBusiness (documentado)
  mocks/            métricas, série diária, posts, origens, campanhas
  hooks/            useAnalytics
  utils/            cálculos, classificação, rankings e insights
  types/            contratos TypeScript
  styles/           CSS global e módulo compartilhado
server/             plano do backend, sem servidor nesta fase
docs/               arquitetura, banco e métricas
tests/              teste executável das regras
```

A pasta atual é a raiz; não criamos uma pasta duplicada dentro dela. Subpastas vazias do backend foram substituídas pelo plano em server/README.md, para criar junto do código real.

## Arquitetura

UI → hook → service → MOCK. Futuramente: APIs → backend Node/TypeScript → PostgreSQL → processamento → services → UI.

Leia [arquitetura](docs/architecture.md), [modelo proposto](docs/database-model.md) e [métricas](docs/metrics.md).

Próximo passo: aprovar a interface em desktop e celular. Depois definir instrumentação do site e validar permissões/métricas das APIs antes de iniciar integrações.

## Segurança

Git inicializado, sem commit automático. .gitignore exclui .env, tokens, credenciais, chaves e nomes comuns de contas de serviço. Revisar arquivos com outros nomes antes de commit. .env.example contém somente nomes futuros comentados.

Nenhum segredo no frontend: VITE_* é público no bundle. Futuro OAuth, tokens, Client Secrets e banco ficam no backend. Nenhum dado é enviado nesta fase.

Referências: [Vite](https://vite.dev/guide/) e [Recharts](https://recharts.github.io/en-US/guide/installation/).
