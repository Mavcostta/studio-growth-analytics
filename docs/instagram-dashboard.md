# Fase 3 — Instagram real no dashboard

## Fechamento e resultados da validação — 07/09/2026

Validação das duas páginas por renderização no servidor concluída nos cinco estados: sucesso, loading, erro, resposta vazia e resposta parcial. Conferidos identificação das fontes, mensagens específicas, detalhes das dimensões e links seguros. O teste usa a amostra real já coletada; nenhuma nova coleta foi necessária neste fechamento.

Lint, TypeScript, build e formatação passaram. Testes: 5 de frontend/cálculos e 4 de backend/normalização, todos aprovados. Nenhuma regra de qualidade foi desabilitada.

Revisão estrutural preserva sidebar, tipografia, paleta e organização. A lista utiliza miniaturas pequenas e detalhes expansíveis; os grupos usam barras simples e medidas textuais. Instagram real aparece primeiro; a área simulada de site/Google/WhatsApp fica separada e rotulada. Não houve redesign. **Não foi possível realizar inspeção visual em navegador ou screenshots: nenhum navegador estava conectado.** Renderização no servidor não comprova layout em pixels nem interações visuais.

Na amostra de 25 posts usada na validação (13 Reels, 11 carrosséis, 1 imagem; coleta de 06/09/2026 às 17:36 UTC), os achados gerados foram:

- Reels: maior alcance médio entre formatos elegíveis, aproximadamente 776,3, com mediana 695 (n=13).
- Carrosséis: maior média de interações proporcionais, aproximadamente 8,23%, com mediana 8,61% (n=11).
- 19h: maior média de interações proporcionais entre horários elegíveis, com quatro publicações.
- Uma imagem: amostra insuficiente para comparação. Não há dados reais de clientes/agendamentos.

Média e mediana sustentaram as mesmas lideranças segundo as regras do produto. Hipóteses: explorar Reels para descoberta, carrosséis para envolvimento e 19h como horário a testar. Próximos testes: comparar novas publicações com outro formato/horário, mantendo assunto e tempo de observação semelhantes, pelo menos três por grupo, e reavaliar média/mediana. São hipóteses observacionais, não garantias nem relações causais.

Resumo dessa coleta: alcance somado 14.910 (não pessoas únicas), visualizações somadas 30.069, interações 1.160; alcance médio 596,4 e mediano 527; visualizações médias 1.202,76; interações médias 46,4; razão global interações/alcance de aproximadamente 7,78%. Valores podem mudar em uma nova consulta.

## Escopo e arquivos

A identidade visual foi preservada: sidebar, fontes, cores, cards e organização das duas páginas. Sem nova dependência, banco, autenticação ou nova integração. A Meta continua acessada exclusivamente pelo backend já existente.

Criados:

- src/types/instagram.ts: contrato da UI, métricas, dimensões, estatísticas, formatos, horários e insights.
- src/services/instagram/client.ts: consulta e validação da resposta HTTP.
- src/hooks/useInstagram.ts: estados de carregamento, erro e sucesso, compartilhados pelas páginas.
- src/utils/instagram.ts: estatísticas, proporções, dimensões, destaques e insights puros.
- src/components/Instagram/index.tsx: área real, resumo, período, miniatura, link, destaques, insights e comparação de grupos.
- tests/instagram-frontend.test.ts: verificações de matemática, amostra, outliers, sanitização, erros e requisições compartilhadas.
- docs/instagram-dashboard.md: este relatório.

Alterados: App.tsx; pages/Dashboard e ContentAnalytics; components/Chart, TrafficSources e ConversionFunnel (identificação da simulação e retirada do alcance fictício do gráfico); styles/dashboard.module.css; vite.config.ts (proxy); package.json (testes adicionais); README e documentos de arquitetura/métricas com referências desta fase.

## Caminho dos dados

UI → useInstagram → loadInstagramPosts → GET /api/dev/instagram/posts → backend → Meta.

Vite encaminha somente esse prefixo para 127.0.0.1:3001 com changeOrigin. O backend mantém a proteção de Host e Origin; não foi habilitado CORS nem envio de token ao navegador. Service aceita no máximo 25 posts, IDs únicos, métricas não negativas finitas, URLs HTTPS nos domínios permitidos e datas com timezone. Copia apenas os campos usados pela UI; não importa código do servidor.

Chamadas simultâneas no mesmo frontend compartilham a promessa em andamento, inclusive no StrictMode. Não há polling, localStorage, cache persistente ou fallback para snapshot. Ao mudar de página, App mantém a consulta atual; o botão Atualizar inicia uma nova consulta explícita. Recarregar a página consulta novamente. Timeout de quatro minutos no cliente. HMR durante desenvolvimento pode reiniciar a camada; 429 informa consulta em andamento/limite e exige nova tentativa manual.

## Real versus simulado

| Área                                     | Fonte                                                                |
| ---------------------------------------- | -------------------------------------------------------------------- |
| InstagramSummary, InstagramPeriod        | API real: somas, médias, medianas, proporção global e formatos       |
| Conteúdo & Conversão / lista / dimensões | Posts reais, busca e ordenação locais                                |
| InstagramGroups                          | Formatos, dias e horas dos posts reais                               |
| InstagramHighlights, InstagramInsights   | Regras sobre a amostra real                                          |
| MetricCard de site/WhatsApp              | MOCK, em seção separada com rótulo explícito                         |
| GrowthChart                              | Apenas visitas ao site e cliques WhatsApp simulados                  |
| TrafficSources                           | Origens de visitas simuladas, inclusive as linhas Google e Instagram |
| ConversionFunnel                         | Somente site → WhatsApp, totalmente simulado                         |

Os mocks antigos foram preservados no repositório. TopContent antigo e insights/classificação antiga de Instagram não são mais exibidos pelas páginas. Não mostramos novos seguidores fictícios nem somamos públicos reais com etapas simuladas. O cabeçalho informa Instagram real/carregando/indisponível e demais fontes simuladas. Os componentes simulados continuam funcionais mesmo se Instagram falhar.

## Métricas e dados ausentes

Campos da Meta: reach, views, saved, shares, likes, comments e total_interactions, este último normalizado como totalInteractions. Não recalculamos interações totais como soma dos demais campos. Comments é uma contagem, não coleta de textos de comentários.

Proporções armazenadas como frações e formatadas como percentual na UI:

```text
interactionRate = totalInteractions / reach
saveRate        = saved / reach
shareRate       = shares / reach
commentRate     = comments / reach
```

Numerador ausente, denominador zero/ausente, número inválido ou resultado não finito → null. Numerador zero com alcance positivo → zero. Nada de substituir null por zero; a UI usa “—”. Proporções podem superar 100% pois ações não são pessoas únicas.

Somas/médias/medianas usam somente valores disponíveis e mostram cobertura n/total. Se nada disponível: null. Não dividir a soma pelo total de posts quando alguns não têm a métrica.

Razão global = soma das interações / soma do alcance **nos mesmos posts com ambos disponíveis e alcance > 0**; exibe número de pares válidos. É diferente da média aritmética das razões individuais, também calculada e disponível nos detalhes dos grupos.

Alcance somado é a soma do alcance de publicações, **não pessoas únicas da conta**. Os mesmos usuários podem aparecer em vários posts. Não é alcance mensal nem crescimento da conta.

## Dimensões independentes, sem nota geral

Comparação usa toda a amostra recebida, sem mudar quando a usuária filtra ou busca na lista. Não há score geral nem classe “Post excelente”.

Para valor x em n observações válidas, com L menores e E iguais:

```text
P(x) = 100 × (L + (E − 1) / 2) / (n − 1)
```

Percentil por posição média dos empates; mínimo n=3. Valores iguais recebem exatamente o mesmo resultado; amostra inteiramente igual fica em 50 (Médio).

| Dimensão         | Comparação                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| Descoberta       | Média dos percentis de reach e views usando apenas posts com ambos; depois percentil dessa média dentro da dimensão |
| Engajamento      | Percentil de interactionRate                                                                                        |
| Valor            | Percentil de saveRate                                                                                               |
| Compartilhamento | Percentil de shareRate                                                                                              |
| Conversa         | Percentil de commentRate                                                                                            |

Classificação por dimensão: P ≥ 75 Excelente; 50 < P < 75 Alto; 25 ≤ P ≤ 50 Médio; P < 25 Baixo. São faixas da distribuição relativa, não limites absolutos de métricas ou benchmarks externos. Dado ausente ou n<3 → Sem comparação. Curtidas não recebem peso independente.

Limitações: amostra de no máximo 25 posts, diferenças de idade/exposição, formatos e oportunidades de distribuição; não é ajuste estatístico por idade nem avaliação de vendas. Dimensões de valor/compartilhamento são sinais de interesse, não prova de intenção comercial.

## Grupos, amostra e outliers

Formato, dia e hora possuem contagem de posts e, por métrica, n válido, soma, média e mediana. Horários agrupados pela hora inteira (0–23); dias ISO segunda=1 a domingo=7, no fuso America/Sao_Paulo. Grupos sem posts não aparecem. Datas ausentes não entram nos agrupamentos temporais.

Mediana é o valor central ordenado; com quantidade par, média dos dois centrais. UI mostra alcance médio/mediano, interações médias, razão global e cobertura. Detalhes incluem mediana das interações, média/mediana das razões e médias específicas dos formatos.

- n<3 na métrica analisada: amostra insuficiente; não produzir hipótese comparativa.
- n≥3: observação possível, sem significância estatística garantida.
- Comparações automáticas exigem pelo menos dois grupos elegíveis.
- Divergência: |média − mediana| > 50% de |mediana|. Mediana zero com média positiva também é divergente.
- Hipótese específica somente se o mesmo grupo lidera de forma única na média e na mediana e não apresenta divergência.
- Caso contrário, texto enfraquecido, sem hipótese específica nem recomendação de priorizar o grupo.

O limite de 50% é uma regra conservadora explícita do produto, não teste de significância. Não removemos ou alteramos outliers; mostramos seu efeito e testamos o caso de um post extremo no teste automatizado. Não garantimos causalidade ou ausência de outros vieses.

## Achado → hipótese → próximo teste

No máximo quatro cards na Visão Geral:

1. Alcance por formato.
2. Envolvimento proporcional por formato.
3. Oportunidade de horário, pela interação proporcional.
4. Limitações: formatos com pouca amostra e ausência de dados de clientes/agendamentos.

Achado relata a estatística observada e n. Hipótese é condicional e só aparece com evidência estável segundo as regras acima. Próximo teste propõe comparar novas publicações em condições semelhantes, com pelo menos três por grupo e tempo de exposição comparável. Não classifica assuntos de legendas: nenhuma inferência automática de “bastidores”, “rotina” ou intenção sem dados estruturados.

Destaques agrupam conquistas por ID, preservando empates: maior alcance/visualizações, interação proporcional, salvamentos absolutos/proporcionais, compartilhamentos absolutos/proporcionais e conversa proporcional. Não criam nota geral. Não declaram destaque quando todos têm o mesmo valor ou máximo zero; são máximos descritivos, não conclusões estatísticas.

## Período e apresentação

Mostra a data mínima e máxima de publicação na amostra e horário da coleta, em São Paulo. Nenhum seletor falso. Dados são acumulados dos posts até a consulta; não delimitam atividade dentro desse período. A seção simulada preserva sua janela fictícia 02–31/08/2026, visualmente separada.

Miniaturas de 48×58 px, carregamento preguiçoso, sem referrer; fallback visual também se imagem expirar/falhar. Não usamos mediaUrl para montar galeria ou tornar a imagem obrigatória. Links abrem com target=_blank e rel=noopener noreferrer. Legendas são texto escapado pelo React.

## Estados de erro

Carregando: mensagem específica sem preencher com mocks. HTTP/network error: “Não foi possível carregar os dados do Instagram.”, motivo interno seguro e botão Tentar novamente. Falha de autorização não exibe conteúdo bruto da Meta. Resposta vazia: mensagem própria. Resposta parcial HTTP 200: aviso e valores disponíveis, sem inventar ausências. Atualização remove a amostra anterior enquanto consulta; erro não apresenta dados antigos como atuais.

## Execução

```sh
# Terminal 1
npm run server:dev
# Terminal 2
npm run dev
```

Abra o endereço do Vite. Tokens somente no .env do backend. Não é deploy nem autenticação de produção; rota continua local/de desenvolvimento.

Verificar: npm run lint; npm run typecheck; npm test; npm run test:instagram; npm run build; npm run format:check. Nenhuma configuração de qualidade foi afrouxada. A checagem local adicional .qa/check-instagram-ui.mjs usa a amostra real anterior para renderizar as duas páginas em cinco estados sem chamar a Meta; não é teste de navegador nem fonte de dados da aplicação.
