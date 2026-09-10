# Fase 2 — histórico armazenado

`GET /api/history` lê os snapshots do Vercel Blob privado exclusivamente no backend. Usa o SDK e as variáveis existentes; não chama Instagram/GA4, não escreve arquivos e não aciona coleta. O frontend só recebe o contrato normalizado (`schemaVersion: 1`), nunca URLs privadas, tokens ou objetos brutos do armazenamento.

Em desenvolvimento, o proxy do Vite encaminha `/api/history` para o backend local. Na Vercel, a Function atende no mesmo domínio. Sem acesso ao Blob, o histórico informa indisponibilidade: não há fallback para mocks, arquivos locais ou consultas ao vivo. A validação desta fase usa mocks de teste do SDK, conforme autorizado; não confirma quantos snapshots existem em produção.

## Leitura e integridade

- Pagina a listagem por fonte e lê até os 100 snapshots mais recentes, em lotes de cinco, com timeout de 60 segundos por fonte e limite de 2 MB por arquivo. Isso prepara observações para futuras análises de 7/30/90 dias, sem implementar essas recomendações.
- Seleciona GA4 pelo `GA4_PROPERTY_ID` existente. Para Instagram, exige uma única conta no prefixo do projeto; múltiplas contas geram indisponibilidade, nunca mistura de totais.
- Valida versão, fonte, identificador e data contra o pathname, timestamps, período, fuso e valores. Contagens fora da precisão segura ou ausentes ficam `null`. Zero explícito permanece zero.
- Falhas de listagem deixam a fonte indisponível. Arquivos inválidos/ausentes geram leitura parcial, com comparações suspensas para não apresentar uma coleta antiga como sendo o snapshot anterior imediato. Uma fonte pode funcionar mesmo quando a outra falha.
- Observações normalizadas preservam data, período, métricas e cobertura. Os detalhes de páginas/origens são enviados apenas para o snapshot mais recente, reduzindo o tamanho da resposta. Nenhuma soma de snapshots sobrepostos é feita.

## Instagram

O dashboard mostra seguidores no instante da última coleta (com timestamp), visitas ao perfil, alcance, contas engajadas, visualizações, interações e toques em links do período registrado. Entradas e saídas informadas pela Meta são campos separados.

A diferença de seguidores usa os dois snapshots armazenados mais recentes. Pode haver intervalo maior que um dia; os dois timestamps ficam explícitos. Percentual = `(atual − anterior) / anterior × 100`, apenas com ambos os valores presentes e base anterior maior que zero. Base zero permite diferença absoluta e direção, mas não percentual. Saldo do total não é confundido com ganhos brutos ou perdas brutas.

## GA4

Usuários ativos, sessões, visualizações e cliques WhatsApp são os totais da janela de sete dias do snapshot, no fuso registrado. Os sete dias precisam ser válidos e consecutivos. Usuários únicos nunca são reconstruídos somando dias.

A comparação busca outro snapshot que represente exatamente a semana imediatamente anterior, sem sobreposição e no mesmo fuso. A coleta de ontem normalmente contém seis dias em comum com a de hoje: não é usada como “período anterior”. Os intervalos comparados são exibidos. Uma única coleta ou ausência da semana comparável mostra **Histórico sendo construído**. Não se usa o bloco `previousMetrics` para contornar essa regra.

Páginas e origens são ordenadas pelos denominadores reais no último snapshot. Taxas são calculadas apenas com linhas identificadas e pareadas no mesmo relatório/período:

- Página: `whatsapp_click / screenPageViews × 100`.
- Origem/mídia: `whatsapp_click / sessions × 100`.
- Denominador zero, falta de linha de cliques, duplicidade ou relatório parcial não produzem taxa. Ausência não significa zero.
- Os rankings exibem até cinco linhas com valores disponíveis. Amostras com menos de 30 visualizações/sessões recebem aviso descritivo; esse limiar não comprova significância estatística.
- Um visitante pode clicar várias vezes; a razão pode ultrapassar 100%. Cliques representam eventos de intenção, não pessoas convertidas, conversas ou agendamentos. Não há afirmação causal ou recomendação.

## Interface e segurança

As seções de histórico usam os cards, tabelas, grids, estados e responsividade existentes. O layout geral e as consultas ao vivo permanecem. O histórico tem atualização própria e estados de loading, erro, vazio, parcial e dados disponíveis.

Coleta de snapshots, cron, tracking, integrações e estilos não foram modificados. Nenhuma nova variável é necessária. O endpoint preserva GET, bloqueio de origem cruzada, resposta `no-store` e erros sanitizados do handler existente. Assim como os endpoints atuais, não adiciona autenticação de usuário nesta fase.

## Validação

`npm run test:history` cobre normalização, nulos/zero, taxas, saldo vs. fluxos, datas, semana sem sobreposição, fuso, paginação e acesso privado via SDK mockado, falhas isoladas, conta ambígua, segurança da rota e renderização dos estados. As demais suítes, lint, TypeScript e build continuam obrigatórios.

Referência do SDK utilizado: [leitura e listagem do Vercel Blob](https://vercel.com/docs/vercel-blob/using-blob-sdk).
