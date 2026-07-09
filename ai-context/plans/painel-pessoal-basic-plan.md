# Plano - Painel Pessoal do Usuario BASIC

Status: concluido
Ultima atualizacao: 2026-07-09

## Objetivo

Criar uma visao pessoal para o usuario `BASIC` que concentre, em uma unica entrada, as informacoes mais relevantes de sua rotina no sistema:

- proximas escalas;
- eventos relevantes do periodo;
- pendencias que exigem acao;
- acesso rapido para aprofundar a leitura.

O foco e oferecer uma experiencia pessoal, diferente do dashboard geral de `ADMIN` e `STAFF`, sem renomear a area administrativa existente.

## Problema

Hoje o usuario BASIC encontra informacao util em telas separadas, o que aumenta o numero de cliques para entender o que precisa fazer agora.

O que falta:

- uma entrada pessoal clara para BASIC;
- reuniao das informacoes de escala e agenda em um so lugar;
- leitura rapida, objetiva e sem poluicao visual;
- continuidade do padrao ODS ja adotado no sistema.

## Decisao de Produto

- Nao renomear o dashboard geral de ADMIN/STAFF.
- Nao substituir `Minhas Escalas`.
- Criar uma nova entrada pessoal para BASIC, com foco operacional.
- O BASIC deve cair inicialmente nessa entrada pessoal apos o login.
- Exibir apenas informacoes acionaveis e resumidas.
- Manter a linguagem visual consistente com os cards e componentes ja existentes.

## Escopo

Incluido:

- tela/painel pessoal para BASIC;
- resumo de proximas escalas;
- resumo de eventos relevantes do periodo;
- destaque de pendencias;
- links para `Minhas Escalas` e para a visualizacao de agenda;
- adaptacao de i18n e rótulos, se necessario;
- validacao de permissao para BASIC.

Fora do escopo:

- dashboard administrativo;
- relatorios avancados;
- nova logica de permissao;
- mudanca na regra de visibilidade de escalas ou eventos;
- alteracao da impressao de escalas ou agenda.

## Plano de Execucao

### Etapa 1 - Definicao do painel

- [x] Fechar o nome da tela/entrada pessoal.
- [x] Definir a rota inicial do BASIC apos o login.
- [x] Definir quais blocos entram no painel: escalas, eventos e pendencias.
- [x] Definir a ordem visual dos blocos.
- [x] Confirmar os destinos dos cards e chamadas de acao.

Resultado parcial:

- O nome definido para a entrada pessoal e `Painel Pessoal`.
- O BASIC deve ser redirecionado para a nova entrada pessoal como primeira tela apos o login.
- A rota inicial definida para esta nova tela e `/personal-panel`.
- As rotas novas deste fluxo devem seguir nomenclatura em ingles.

Proposta de composicao:

- `Next Schedule`: mostra a proxima participacao do BASIC.
- `Upcoming Events`: mostra o proximo evento relevante do periodo.
- `Pending Actions`: mostra o que ainda depende de confirmacao ou leitura.
- Acoes rapidas: entrada para `Minhas Escalas` e para `Agenda`.

Destinos definidos:

- `Next Schedule` -> `/minhas-escalas`
- `Pending Actions` -> `/minhas-escalas`
- `Upcoming Events` -> `/agenda/visualizacao`
- Acoes rapidas -> `/minhas-escalas` e `/agenda`

Racional:

- o usuario BASIC precisa enxergar o que deve fazer agora;
- escalas continuam sendo o foco operacional principal;
- eventos entram como contexto util, nao como ruido;
- pendencias ficam visiveis para reduzir atraso de acao.

Ordem visual definida:

1. `Next Schedule`
2. `Pending Actions`
3. `Upcoming Events`
4. Acoes rapidas (`Minhas Escalas` e `Agenda`)

Justificativa:

- `Next Schedule` abre o painel com a informacao mais acionavel;
- `Pending Actions` vem em seguida porque exige resposta do usuario;
- `Upcoming Events` fica logo depois para dar contexto do periodo sem competir com a acao principal;
- as acoes rapidas fecham o painel como ponto de navegacao, nao como informacao principal.

### Etapa 2 - Dados

- [x] Mapear quais dados ja existem em `Minhas Escalas` e na agenda.
- [x] Definir o menor conjunto de consultas necessario para montar o painel.
- [x] Garantir que os dados sejam pessoais e/ou relevantes para o usuario BASIC.
- [x] Evitar duplicacao desnecessaria de regras e consultas.

Resultado da etapa:

- `Minhas Escalas` continua sendo a base principal para a parte operacional do BASIC.
- A agenda entra como contexto complementar por periodo, sem competir com a acao principal.
- Pendencias podem ser reaproveitadas por meio da contagem ja existente no sistema.
- O painel deve evitar consultar listas completas quando um resumo ja resolve a leitura inicial.

### Etapa 3 - Interface

- [x] Montar a tela com os mesmos padroes visuais do projeto.
- [x] Manter leitura rapida em desktop e mobile.
- [x] Priorizar blocos resumidos e cards clicaveis.
- [x] Evitar poluicao visual ou excesso de informacao.

Regra visual fechada:

- O `Painel Pessoal` deve seguir o padrao ODS e usar a mesma estrutura visual da tela de dashboard de `ADMIN` e `STAFF`.
- A diferenca deve ficar nos dados e nos blocos exibidos para o `BASIC`, nao na linguagem visual.
- A hierarquia visual precisa continuar enxuta, com cards resumidos e leitura rapida.
- Desktop e mobile devem preservar a mesma identidade da interface do sistema.

Resultado da etapa:

- O painel pessoal do BASIC vai reaproveitar o mesmo vocabulario visual da tela de dashboard existente.
- A experiencia visual deve parecer parte da mesma familia de telas do sistema.
- A personalizacao sera por conteudo e ordem de informacao, nao por um layout novo.

### Etapa 4 - Validacao

- [x] Validar o redirecionamento inicial do BASIC para `/personal-panel`.
- [x] Validar a leitura do painel com BASIC sem lideranca.
- [x] Validar a leitura do painel com BASIC com lideranca.
- [x] Garantir que ADMIN e STAFF continuem no dashboard atual.
- [x] Validar desktop e mobile com o mesmo padrao visual do dashboard atual.
- [x] Rodar checagem de tipagem/build no front afetado.

Resultado esperado:

- o BASIC entra direto no Painel Pessoal;
- o painel mostra apenas informacoes resumidas e acionaveis;
- o layout continua idêntico ao padrão ODS do dashboard administrativo;
- as rotas de apoio seguem funcionando sem alterar a experiencia dos perfis ADMIN e STAFF.

## Riscos

- Misturar painel pessoal com dashboard administrativo pode gerar confusao de navegacao.
- Expor dados demais pode reduzir a utilidade da visao resumida.
- Reaproveitar consultas sem separar bem o contexto pode duplicar regras e custo de manutencao.

## Criterios de Aceite

- O BASIC passa a ter uma visao pessoal unica para escalas e eventos.
- A tela mostra informacoes resumidas e acionaveis.
- O fluxo nao substitui o dashboard geral.
- `Minhas Escalas` continua existindo como pagina operacional.
- A solucao segue o ODS e o padrao visual do sistema.

## Status Atual

- Plano criado.
- Etapa 1 concluida.
- Etapa 2 concluida.
- Etapa 3 concluida.
- Etapa 4 concluida.
- Mobile validado manualmente.
- Nome do painel fechado como `Painel Pessoal`.
