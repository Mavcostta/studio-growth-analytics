# Arquitetura — fase 1

Atualização da fase 3: Instagram segue UI → useInstagram → service HTTP → backend existente → Meta. Fontes restantes continuam MOCK, separadas. Ver [arquitetura atual e metodologia](instagram-dashboard.md).

React/TypeScript/Vite para duas telas. Navegação por hash usa o navegador, dispensando router. CSS Modules evita dependência de estilo. Recharts atende ao gráfico interativo; barras simples usam HTML meter.

`App → useAnalytics → getAnalytics → mocks`. Componentes não importam mocks nem acessam APIs. O contrato AnalyticsData mantém o formato da UI; quando houver HTTP, o hook ganhará estados de carregamento/erro/retentativa. A camada assíncrona não foi implementada agora.

services/instagram retorna posts fictícios. services/googleBusiness documenta a integração futura sem inventar métricas que a UI não usa. utils/analytics.ts concentra regras testadas com npm test.

## Backend futuro

Node.js/TypeScript, com Express somente quando houver rotas. OAuth, tokens, coleta com paginação e limites, normalização e persistência ficam no servidor.

```text
Instagram / Google Business Profile / GA4 / eventos do site
                         ↓
             Backend Node.js / TypeScript
                         ↓
                   PostgreSQL
                         ↓
            Processamento de métricas
                         ↓
                Services → React
```

Guardar fonte, conta, período, granularidade e instante da coleta. Reprocessar com chaves únicas para evitar duplicações. Não somar usuários únicos entre datas/canais.

## Banco proposto, sem instalação

| Opção                 | Adequação                                                                                                                              |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| PostgreSQL / Supabase | Preferido: SQL, relações, restrições e agregações explícitas. Supabase pode hospedar PostgreSQL. Alinhado ao aprendizado de modelagem. |
| Firebase / Firestore  | Modelo documental exigiria mais desnormalização para relatórios relacionais; menos alinhado ao objetivo de SQL.                        |

Não há impeditivo conhecido para PostgreSQL. Custos/região/permissões serão avaliados quando houver autorização. Nenhum SDK ou banco instalado.

## Limites

Período único, mocks locais, sem persistência. Insights descritivos, sem IA ou causalidade. Cliques por post são hipótese simulada de atribuição, não promessa de métrica disponível na API. Cliques não são pessoas únicas nem clientes.

## Próxima etapa

1. Aprovar interface e linguagem em desktop/tablet/celular.
2. Definir eventos do site, UTMs e minimização de dados.
3. Validar acesso e disponibilidade das APIs.
4. Só com nova autorização, implementar backend e banco, uma fonte por vez.
