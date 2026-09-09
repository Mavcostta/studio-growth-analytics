# Métricas

Atualização: as áreas reais do Instagram utilizam [dimensões, proporções e estatísticas da fase 3](instagram-dashboard.md). A classificação ponderada abaixo é histórica do MVP e não aparece nos posts reais. Site/WhatsApp continuam simulados.

MOCK: 02–31/08/2026. Comparação: 03/07–01/08/2026. Fuso: America/Sao_Paulo.

| Métrica            | Definição                                                           |
| ------------------ | ------------------------------------------------------------------- |
| Visualizações      | Exibições, incluindo repetições pela mesma pessoa.                  |
| Pessoas alcançadas | Contas únicas no período do Instagram; não somar alcance dos posts. |
| Novos seguidores   | Adquiridos, sem descontar perdas; não crescimento líquido.          |
| Visitas ao site    | Visitas/sessões, não pessoas únicas.                                |
| Cliques WhatsApp   | Eventos de clique no site, não conversas/clientes/agendamentos.     |
| Site → WhatsApp    | Cliques / visitas × 100; eventos por sessão, pode superar 100%.     |
| Curtidas           | Reações; não entram na classificação.                               |
| Salvos             | Salvamentos do post.                                                |
| Compartilhamentos  | Compartilhamentos do post.                                          |
| Visitas ao perfil  | Ações atribuídas ao conteúdo, quando disponíveis.                   |
| Cliques por post   | Atribuição fictícia; validar UTMs/eventos antes da integração.      |
| Origem             | Instagram/Google/direto/outros; visitas da fonte / total × 100.     |

Contagens: variação `(atual − anterior) / anterior × 100`; anterior zero = “Sem base”. Conversão: diferença em pontos percentuais (p.p.). Percentuais são calculados, não copiados do exemplo.

## Série e funil

Mock diário usa pesos determinísticos e arredondamento acumulado para preservar totais. Alcance diário simula conjuntos disjuntos; **em dados reais o alcance único do período vem da fonte, não da soma diária**.

Taxas do funil = etapa / anterior × 100; denominador zero resulta em zero. Larguras indicam ordem, não escala proporcional. O funil agrega fontes, não acompanha a mesma coorte de pessoas.

## Classificação

```text
pontuação = 100 × (2 × salvos + 3 × compartilhamentos + visitas ao perfil
                  + 4 × cliques no site + 6 × cliques WhatsApp) / alcance
```

Excelente ≥ 40; Bom ≥ 20; Médio ≥ 8; Fraco < 8. Alcance zero = zero. Pesos priorizam interesse; limiares experimentais, não benchmarks. Pontuação pode superar 100; não é taxa de pessoas convertidas. Calibrar com histórico e tamanho da amostra. Empates mantêm ordem original.

## Insights e rankings

- Dias/horários: alcance médio por post, mostrando número de publicações. Faixa inclui início e exclui fim. Ranking no fuso de São Paulo.
- Categorias: médias de compartilhamentos/salvos. Razão compara líder à segunda categoria, nomeada no texto.
- Reels versus estáticos: diferença relativa das médias de alcance; carrosséis separados.
- Conversão: cliques / visitas. Ausência de grupo/denominador suprime a comparação.
- Top conteúdos: mais cliques WhatsApp. Melhor/pior: pontuação ponderada.

Amostra pequena, idade dos posts e dias sem publicação limitam conclusões. Não inferir causalidade.

## Futuro

Campaign: id, name (utm_campaign), source (utm_source), medium (utm_medium), content opcional (utm_content). UTMSource normaliza instagram/google/direct/other no MVP; banco preservará valores originais. Sem gerador UTM.

Eventos previstos, não coletados: page_view, scroll_50, scroll_90, click_whatsapp, click_instagram, click_agendamento, click_curso, click_servico, form_start, form_submit. Sanitizar URLs e minimizar dados pessoais antes da coleta real.
