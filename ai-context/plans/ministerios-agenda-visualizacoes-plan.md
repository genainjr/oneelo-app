# Plano - Visualizacoes read-only de ministerios e agenda

Status: pendente

## Objetivo

Criar visualizacoes read-only para `ministerios` e `agenda`, seguindo o ODS, separando consulta de gestao e reaproveitando ao maximo os componentes e hooks ja existentes no projeto.

## Contexto

- Hoje `ministerios` e `agenda` existem apenas como telas de gestao.
- O sistema ja possui visualizacoes dedicadas para `membros` e `escalas`, que servem como referencia de navegacao e leitura.
- A matriz ODS classifica `/ministerios` e `/agenda` como telas parciais e com espaco para consolidacao estrutural.
- A intencao desta entrega nao e redesenhar o CRUD, e sim oferecer uma experiencia de consulta limpa, consistente e sem controles de edicao.

## Decisoes iniciais

- Nao substituir as telas de gestao existentes.
- Criar rotas de visualizacao dedicadas:
  - `/ministerios/visualizacao`
  - `/agenda/visualizacao`
- Reaproveitar `PageHeader`, `FilterShell`, `FilterActions`, `EntityCard`, `EmptyState`, `StatusBadge` e hooks existentes sempre que possivel.
- Evitar criar componentes genericos novos se a necessidade for atendida com composicao local.
- Preservar o comportamento atual das rotas de gestao.
- No mobile, priorizar cards ou listas empilhadas; no desktop, manter densidade organizada e leitura rapida.

## Hipotese inicial

- A maior parte do trabalho deve ser de composicao de UI e roteamento, nao de nova modelagem.
- O backend pode nao precisar de novos endpoints se os dados atuais ja cobrirem a leitura.
- Se faltar algum campo, a preferencia e estender endpoint existente em vez de duplicar contratos.
- O risco principal e criar uma segunda interface pesada, parecida com o CRUD, em vez de uma visualizacao clara.

## Diretriz ODS

- Visualizacao nao deve parecer landing page.
- Nao usar cards dentro de cards.
- Nao introduzir contornos, sombras ou separacoes decorativas sem necessidade funcional.
- Desktop deve permitir escaneamento rapido por grupos, status e resumos.
- Mobile deve reduzir tabela horizontal e priorizar blocos verticais legiveis.
- Acoes de edicao nao devem aparecer na visualizacao.
- Se houver navegacao interna, ela deve ser clara e sem duplicar o fluxo de gestao.

## Etapas

### Etapa 1 - Fechamento de escopo e rota

- [x] Confirmar nome final das rotas e entrada de sidebar.
- [x] Definir quais informacoes cada visualizacao precisa mostrar.
- [x] Fechar o que sera leitura pura e o que ficara no CRUD.
- [x] Validar se algum endpoint existente ja cobre os dados necessarios.

Resultado esperado:

- Escopo fechado antes da implementacao.
- Rotas confirmadas:
  - `/agenda/visualizacao`
  - `/ministerios/visualizacao`
- A tela de gestao continua em:
  - `/agenda`
  - `/ministerios`
- A leitura vai priorizar:
  - Agenda: listagem de eventos com leitura rapida por periodo/status, sem acoes de edicao.
  - Ministerios: resumo dos ministerios, membros relevantes, funcoes e contagem util para consulta.
- O backend atual ja entrega base suficiente para a primeira versao da leitura:
  - `GET /api/eventos` atende a visualizacao de agenda.
  - `GET /api/ministerios` atende a visualizacao de ministerios.
- Se faltar algum dado no meio da implementacao, a preferencia continua sendo estender o endpoint existente, sem criar contrato paralelo.

### Etapa 2 - Auditoria de reaproveitamento

- [x] Mapear componentes ja existentes que podem ser usados nas duas telas.
- [x] Mapear hooks e endpoints ja existentes que podem ser reaproveitados.
- [x] Identificar apenas os gaps reais de dados, sem criar contratos paralelos.
- [x] Registrar onde uma composicao local resolve melhor que um componente novo.

Resultado esperado:

- Inventario de reuso fechado para evitar duplicacao desnecessaria.
- Componentes reaproveitaveis confirmados:
  - `PageHeader`
  - `FilterShell`
  - `FilterActions`
  - `FilterInput`
  - `FilterSelect`
  - `EntityCard`
  - `EmptyState`
  - `StatusBadge`
- Hooks e rotas reaproveitaveis confirmados:
  - `useEventos` + `GET /api/eventos`
  - `useMinisterios` + `GET /api/ministerios`
  - `useFilterState`
  - `formatDate`
- Referencias de UX que ja seguem o ODS:
  - `membros/visualizacao`
  - `escalas/visualizacao`
- Reuso que deve ser evitado:
  - `ModalShell`, `ConfirmDialog`, tabs e formularios de edicao.
  - `MembroSearchCombobox` e a logica de manutencao do CRUD de ministerios.
  - `DataTable` como base principal, porque a nova experiencia precisa ser mais de leitura por cards/blocos.
- Gap real identificado:
  - a navegacao ainda nao expoe explicitamente `/agenda/visualizacao` e `/ministerios/visualizacao` nas regras de sidebar/documentacao.
  - esse ajuste entra na etapa 5, junto com permissao e exibicao do menu.

### Etapa 3 - Visualizacao de Agenda

- [x] Criar `/agenda/visualizacao` como tela de leitura.
- [x] Reaproveitar filtros e cards existentes quando fizer sentido.
- [x] Remover acoes de criar/editar/excluir da experiencia de leitura.
- [x] Garantir comportamento ODS consistente no desktop e no mobile.

Resultado esperado:

- Agenda com experiencia de consulta separada da gestao.
- A nova tela ficou baseada em:
  - `useEventos`
  - `FilterShell` e `FilterActions`
  - `StatCard`
  - `EntityCard`
  - `StatusBadge`
  - `formatDate`
- O contrato atual de eventos foi suficiente para a primeira versao.
- A visualizacao entra com:
  - filtro por status
  - filtro por periodo
  - cards de leitura
  - metricas resumidas
- Nao foram adicionados modais, botoes de edicao ou fluxo de criacao.

### Etapa 4 - Visualizacao de Ministerios

- [x] Criar `/ministerios/visualizacao` como tela de leitura.
- [x] Exibir resumo util de cada ministerio sem abrir fluxo de edicao.
- [x] Reusar a estrutura visual ja existente na pagina de ministerios quando possivel.
- [x] Evitar modal complexo ou tabs se a visualizacao nao precisar disso.

Resultado esperado:

- Ministérios com leitura limpa, leve e coerente com o ODS.
- A nova tela ficou baseada em:
  - `useMinisterios`
  - `PageHeader`
  - `StatCard`
  - `EntityCard`
  - `StatusBadge`
- A listagem prioriza:
  - nome
  - descricao
  - liderancas
  - funcoes cadastradas
  - contagem resumida
- Nao foram adicionados modais, tabs, buscador de membro ou fluxo de manutencao.
- O contrato atual de ministérios foi suficiente para a primeira versao.

### Etapa 5 - Navegacao, permissao e ajuste fino

- [x] Atualizar sidebar para expor as novas visualizacoes.
- [x] Garantir que as rotas respeitem RBAC e nao exponham acao de edicao.
- [x] Ajustar textos, labels e empty states.
- [x] Validar responsividade e consistencia visual.

Resultado esperado:

- Fluxo de acesso claro para leitura e sem regressao no CRUD.
- Sidebar atualizada:
  - `ADMIN/STAFF` passam a ver `Ministerios > Visualizacao` e `Agenda > Visualizacao`.
  - `BASIC` com lideranca real passa a ver `Ministerios > Gerenciar` e `Ministerios > Visualizacao`.
  - `BASIC` comum usa `Agenda` apontando para a visualizacao read-only.
- Titulos de rota atualizados no header para:
  - `/agenda/visualizacao`
  - `/ministerios/visualizacao`
- Regra de exibicao do menu BASIC de ministerios agora depende da presenca de papel `LEADER` ou `ASSISTANT_LEADER` no payload do usuario, nao apenas da existencia de ministerios.
- A documentacao de navegacao foi alinhada com as novas rotas.

### Etapa 6 - Validacao

- [ ] Rodar build da web.
- [ ] Validar comportamento das rotas novas em desktop.
- [ ] Validar comportamento das rotas novas em mobile.
- [ ] Revisar se o reuso evitou duplicacao inutil.
- [ ] Registrar riscos residuais.

Resultado esperado:

- visualizacoes prontas com baixo acoplamento e sem inventar camada nova desnecessaria.

## Riscos

- Criar visualizacao muito parecida com o CRUD e acabar duplicando manutencao.
- Introduzir componentes novos quando uma composicao simples resolveria.
- Precisar de ajustes de contrato se os dados atuais nao forem suficientes para a leitura.
- A visualizacao de ministerios pode tentar herdar complexidade do modal atual; isso deve ser evitado.

## Criterios de aceite

- `agenda` possui uma visualizacao read-only separada da tela de gestao.
- `ministerios` possui uma visualizacao read-only separada da tela de gestao.
- A sidebar expõe as visualizacoes sem quebrar o comportamento atual.
- O ODS e respeitado, com reaproveitamento dos componentes existentes.
- Nenhuma acao de edicao aparece nas novas visualizacoes.
- O CRUD atual continua intacto.

## Status atual

- Etapa 1 concluida.
- Etapa 2 concluida.
- Etapa 3 concluida.
- Etapa 4 concluida.
- Etapa 5 concluida.
- Etapa 6 pendente.
