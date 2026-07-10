# Plano - Resumo de Escalas para Usuario BASIC

Status: concluido
Ultima atualizacao: 2026-07-09

## Objetivo

Melhorar a experiencia inicial do usuario `BASIC` para que a informacao de escalas fique mais clara e acionavel logo na entrada do sistema, sem criar tela nova e sem fugir do padrao visual do ODS.

## Problema

Hoje o usuario BASIC ja tem acesso a `Minhas Escalas`, mas a entrada inicial ainda e pouco orientada para a acao imediata.

O que precisa melhorar:

- destacar a proxima escala com contexto util;
- tornar pendencias e proximas escalas mais visiveis;
- evitar uma visao apenas de lista, que exige clique extra para entender o que importa;
- manter a experiencia consistente com os cards resumidos que ja existem no dashboard.

## Decisao de Produto

- Nao criar nova tela para o BASIC nesta etapa.
- Nao substituir a pagina `Minhas Escalas`.
- Reorganizar a entrada inicial do dashboard para privilegiar informacao operacional pessoal.
- Manter tudo em um unico numero/resumo por card, seguindo o padrao do dashboard atual.
- Quando houver lideranca ministerial, ampliar apenas o contexto exibido, sem alterar o fluxo principal.

## Proposta de UX

O dashboard do BASIC deve responder rapidamente:

- qual e a minha proxima escala;
- se existe pendencia de confirmacao;
- quantas escalas eu tenho no mes;
- onde eu devo clicar para agir agora.

Formato esperado:

- um card principal com dado resumido de escalas;
- leitura prioritaria de `Proxima Escala` ou `Escalas do Mês`, conforme a disponibilidade dos dados;
- atalho consistente para `Minhas Escalas`;
- destaque visual de pendencias quando existirem.

## Escopo

Incluido:

- resumo pessoal de escalas para usuario BASIC;
- destaque do proximo compromisso;
- atalho para `Minhas Escalas`;
- integracao com o dashboard existente;
- ajuste de texto e i18n para a nova leitura do card, se necessario;
- validacao de permissao para BASIC com ou sem lideranca ministerial.

Fora do escopo:

- nova tela de escalas;
- alteracao da regra de visibilidade das escalas;
- alteracao da impressao de escalas;
- relatorios ou exportacoes novas.

## Plano de Execucao

### Etapa 1 - Definicao do comportamento

- [x] Fechar qual informacao sera o numero principal do card: `Proxima Escala`.
- [x] Definir a regra de exibicao para BASIC sem lideranca e BASIC com lideranca.
- [x] Confirmar se o card abre `Minhas Escalas` ou uma visao filtrada da mesma pagina.
- [x] Registrar a ordem visual do bloco no dashboard.

Decisoes fechadas:

- O card principal de escalas no dashboard sera `Proxima Escala`.
- O card vai abrir `Minhas Escalas`, preservando o fluxo existente.
- BASIC com lideranca continua usando o mesmo ponto de entrada, sem nova tela.
- O objetivo e diminuir a friccao para o que o usuario precisa fazer agora.

### Etapa 2 - Resumo de dados

- [x] Revisar o hook de dashboard ou criar um resumo especifico para escalas pessoais.
- [x] Expor a informacao minima necessaria para o card sem carregar dados desnecessarios.
- [x] Garantir que o resumo considere apenas escalas do usuario autenticado.
- [x] Preservar o comportamento atual dos demais cards.

Resultado da etapa:

- A fonte de dados deve permanecer no dashboard existente, mas a leitura de escalas precisa ser pessoal.
- A contagem geral do mes nao e suficiente para esse caso; o card precisa representar a proxima escala do usuario autenticado.
- O comportamento dos demais cards nao deve mudar.
- A implementacao deve reutilizar o fluxo atual do dashboard, evitando uma consulta paralela que replique lista completa.

### Etapa 3 - Interface

- [x] Ajustar o dashboard para exibir o card no mesmo padrao visual dos KPI cards existentes.
- [x] Manter um unico numero resumido no card.
- [x] Garantir texto curto, leitura rapida e clique coerente com a acao esperada.
- [x] Se necessario, adaptar a pagina `Minhas Escalas` para facilitar a transicao a partir do dashboard.

Resultado da etapa:

- O dashboard passou a exibir o card `Próxima Escala` apenas para usuario BASIC.
- O card usa o mesmo componente `StatCard` dos demais KPIs.
- O valor mostrado e a data da proxima participacao, com link direto para `Minhas Escalas`.
- A interface continua enxuta e focada na acao imediata, sem criar tela nova.

### Etapa 4 - Validacao

- [x] Validar o comportamento em desktop e mobile.
- [x] Verificar se BASIC comum e BASIC com lideranca enxergam o mesmo ponto de entrada inicial.
- [x] Confirmar que nao houve impacto em ADMIN e STAFF.
- [x] Rodar checagem de tipagem/build no front afetado.

Resultado da etapa:

- O comportamento foi validado em desktop e mobile.
- BASIC comum e BASIC com lideranca mantiveram o mesmo ponto de entrada inicial.
- ADMIN e STAFF nao sofreram impacto funcional.
- A checagem de tipagem/build do front afetado permaneceu consistente com a entrega.

## Riscos

- Se o resumo tentar mostrar informacao demais, o card deixa de cumprir o papel de leitura rapida.
- Se a metrica principal for escolhida mal, o dashboard pode continuar util, mas nao resolver a decisao imediata do usuario BASIC.
- Se o card reutilizar muita logica da pagina de listagem, o custo de manutencao cresce sem ganho real de UX.

## Critérios de Aceite

- O dashboard do BASIC passa a destacar escalas de forma objetiva.
- O card mostra apenas um numero principal, sem poluir a tela.
- O fluxo continua coerente com o ODS e com os cards existentes.
- A entrada inicial do usuario BASIC fica mais util para acao imediata.

## Status Atual

- Plano em andamento.
- Etapa 1 concluida.
- Etapa 2 concluida.
- Etapa 3 concluida.
- Plano concluido.
