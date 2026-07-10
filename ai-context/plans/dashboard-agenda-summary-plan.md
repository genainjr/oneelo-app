# Plano - Resumo de Agenda no Dashboard

Status: planejado
Ultima atualizacao: 2026-07-09

## Objetivo

Incluir a agenda no dashboard como um card de resumo unico, no mesmo padrao dos demais KPIs do sistema, para que o usuario veja rapidamente o volume de eventos do periodo sem precisar entrar na tela de agenda.

## Problema

Hoje a agenda ja existe como modulo completo, mas a entrada do dashboard ainda nao expoe esse dado de forma direta.

O que falta:

- uma leitura rapida de agenda no dashboard;
- um numero unico e resumido, como nos cards existentes;
- um atalho coerente para a visualizacao da agenda;
- consistencia visual com `Membros Ativos`, `Ministérios Ativos`, `Escalas do Mês`, `Aniversariantes` e `Pendências`.

## Decisao de Produto

- Nao criar nova tela.
- Nao duplicar a visualizacao de agenda no dashboard.
- Expor apenas um card sintetico, com um unico numero principal.
- Manter o mesmo padrão de cards usado hoje no dashboard.
- O card deve levar o usuario para a visualizacao da agenda.

## Escopo

Incluido:

- card de agenda no dashboard;
- definicao da metrica principal do card;
- integracao com os dados de agenda ja existentes;
- ajustes de i18n e rotulo de interface, se necessario;
- validacao de permissao de acesso ao destino do card.

Fora do escopo:

- nova tela de agenda;
- grafico ou serie temporal de eventos;
- alteracao da regra de visibilidade da agenda;
- resumo por tipo de evento;
- resumo por ministerio;
- notificacoes ou alertas.

## Plano de Execucao

### Etapa 1 - Definicao do card

- [ ] Fechar a metrica principal do card: `Eventos do Mês`.
- [ ] Confirmar que o card sera um KPI unico, sem quebrar em subtotais.
- [ ] Definir a rota de destino do card: `/agenda/visualizacao`.
- [ ] Confirmar se o texto do card deve ser orientado a volume ou a proximidade de eventos.

### Etapa 2 - Dados

- [ ] Revisar o resumo do dashboard para garantir que a contagem de eventos esteja disponivel.
- [ ] Reutilizar a base de dados e hooks existentes de agenda, sem criar consulta paralela desnecessaria.
- [ ] Garantir que a contagem respeite o mesmo recorte temporal do dashboard.
- [ ] Validar comportamento com eventos visiveis para o usuario logado.

### Etapa 3 - Interface

- [ ] Inserir o card no grid do dashboard no mesmo padrão visual dos outros KPIs.
- [ ] Ajustar ordem visual para nao competir com os cards de operacao principal.
- [ ] Garantir que o card funcione bem em desktop e mobile.
- [ ] Preservar a consistencia de tipografia, cor e densidade.

### Etapa 4 - Validacao

- [ ] Validar o card no dashboard com perfis ADMIN, STAFF e BASIC.
- [ ] Verificar se o clique leva para a area correta da agenda.
- [ ] Confirmar que o dashboard continua com leitura rapida e sem poluicao visual.
- [ ] Rodar checagem de tipos/build no front afetado.

## Riscos

- Se a metricapprincipal for ampla demais, o card pode virar so mais um numero sem utilidade real.
- Se a agenda for contada sem criterio temporal claro, o dashboard pode transmitir informacao enganosa.
- Se a integracao criar consulta nova desnecessaria, o dashboard pode ficar mais pesado sem ganho real.

## Criterios de Aceite

- O dashboard passa a exibir um card de agenda com um unico numero.
- O card segue o mesmo padrao dos KPIs existentes.
- O clique leva para a visualizacao de agenda.
- A implementacao nao quebra os demais cards nem altera a logica de permissao.

## Status Atual

- Plano criado.
- Aguardando inicio da Etapa 1.
