# Plano - Agenda, Tipos de Evento e Visibilidade

Status geral: revisado - escopo reduzido para tipo/visibilidade
Ultima atualizacao: 2026-07-09

## Objetivo

Evoluir o modulo de Agenda para classificar eventos e controlar a visibilidade de reunioes internas sem criar, neste momento, controles de publico, visitantes ou presenca.

A feature deve permitir:

- classificar eventos como `GERAL`, `MINISTERIO` ou `REUNIAO_INTERNA`;
- vincular eventos a nenhum, um ou varios ministerios;
- manter eventos gerais visiveis para todos os usuarios autenticados;
- manter eventos de ministerio visiveis para todos os usuarios autenticados, usando ministerios apenas como organizacao/filtro;
- restringir reunioes internas conforme perfil e lideranca ministerial;
- evoluir as telas de gerenciamento, visualizacao e impressao da Agenda com tipo e ministerios relacionados.

## Decisoes Fechadas

### 1. Publico e visitantes fora do MVP

Removido do escopo desta entrega:

- `temPessoasExternas`;
- publico interno previsto;
- publico externo previsto;
- publico interno presente;
- publico externo presente;
- totais de publico previsto/presente;
- check-in ou presenca nominal.

Motivo:

- igrejas e eventos gerais sao abertos por natureza;
- a dor principal atual e visibilidade de reunioes internas;
- reduzir o escopo evita complexidade de formulario, banco e relatorios antes da necessidade estar consolidada.

### 2. Tipo do evento

Adicionar enum:

```prisma
enum EventoTipo {
  GERAL
  MINISTERIO
  REUNIAO_INTERNA
}
```

Regras:

- `GERAL`: evento geral da igreja, visivel para todos.
- `MINISTERIO`: evento associado a ministerios, mas visivel para todos.
- `REUNIAO_INTERNA`: evento restrito, visivel conforme regra de permissao.

### 3. Relacao com ministerios

Usar relacao N:N entre eventos e ministerios.

Motivo:

- uma reuniao interna pode nao ter ministerio;
- pode envolver um unico ministerio;
- pode envolver varios ministerios;
- eventos de ministerio tambem podem envolver mais de um ministerio.

Modelo proposto:

```prisma
model EventoMinisterio {
  eventoId     String @map("event_id")
  ministerioId String @map("ministry_id")

  evento     Evento     @relation(fields: [eventoId], references: [id], onDelete: Cascade)
  ministerio Ministerio @relation(fields: [ministerioId], references: [id], onDelete: Cascade)

  @@id([eventoId, ministerioId])
  @@map("tb_event_ministry")
}
```

### 4. Visibilidade

Eventos `GERAL`:

- todos os usuarios autenticados veem.

Eventos `MINISTERIO`:

- todos os usuarios autenticados veem;
- ministerios vinculados servem para organizacao, filtro e exibicao, nao para restringir acesso.

Eventos `REUNIAO_INTERNA` sem ministerio vinculado:

- `ADMIN` e `STAFF` veem;
- `BASIC` nao ve.

Eventos `REUNIAO_INTERNA` com um ou mais ministerios vinculados:

- `ADMIN` e `STAFF` veem;
- `BASIC` ve apenas se o membro vinculado for `LEADER` ou `ASSISTANT_LEADER` de pelo menos um ministerio relacionado ao evento.

O backend deve aplicar esta regra. O frontend apenas reflete a UI.

## Estado Atual do Codigo

Ja existe:

- modulo de eventos no backend;
- tela de gerenciamento `/agenda`;
- tela de visualizacao `/agenda/visualizacao`;
- filtro padrao por mes atual em gerenciamento e visualizacao;
- cards de resumo na visualizacao;
- impressao dedicada da visualizacao de agenda;
- cabecalho/rodape compartilhado de impressao;
- acoes rapidas de status para eventos `AGENDADO`;
- regras ODS atualizadas para visualizacoes, cards e acoes rapidas.

Ainda falta:

- tipo de evento no banco/API;
- relacao N:N evento-ministerio;
- filtros por tipo e ministerios;
- regra de visibilidade de `REUNIAO_INTERNA`;
- UI de selecao de tipo e ministerios no modal;
- exibicao de tipo/ministerios nos cards e impressao.

## Escopo

Incluido:

- migration Prisma para `Evento.tipo`;
- migration Prisma para tabela N:N `EventoMinisterio`;
- atualizacao do Prisma Client;
- atualizacao dos DTOs de eventos;
- validacoes backend;
- retorno de eventos com ministerios relacionados;
- filtro backend por tipo e ministerio;
- regra de visibilidade para `REUNIAO_INTERNA`;
- atualizacao de tipos frontend;
- atualizacao do hook `useEventos`;
- atualizacao da tela `/agenda`;
- evolucao da tela `/agenda/visualizacao`;
- evolucao da impressao da Agenda;
- atualizacao de i18n;
- atualizacao de documentacao de modelos.

Fora do escopo:

- visitantes;
- publico previsto/presente;
- presenca nominal;
- check-in;
- capacidade da igreja;
- cadastro de ambientes/locais;
- relatorios avancados;
- exportacao especifica de publico;
- PDF server-side;
- integracao com WhatsApp ou Google Agenda.

## Modelo de Dados Proposto

Adicionar em `Evento`:

```prisma
tipo EventoTipo @default(GERAL) @map("type")
ministerios EventoMinisterio[]
```

Adicionar em `Ministerio`:

```prisma
eventos EventoMinisterio[]
```

Adicionar enum e tabela N:N conforme decisoes acima.

Indices recomendados:

```prisma
@@index([tenantId, tipo])
@@index([ministerioId])
```

Eventos existentes devem receber `GERAL` por default.

## Regras de Negocio

### Criacao e Edicao

- `titulo` e `dataInicio` continuam obrigatorios;
- `tipo` defaulta para `GERAL`;
- `ministerioIds` e opcional;
- ministerios informados devem existir, estar ativos e pertencer ao tenant;
- `dataFim`, quando informada, nao pode ser anterior a `dataInicio`;
- eventos `GERAL` podem ser criados sem ministerios;
- eventos `MINISTERIO` podem ter um ou mais ministerios;
- eventos `REUNIAO_INTERNA` podem ter nenhum, um ou varios ministerios.

### Visibilidade

Aplicar a regra definida em "Decisoes Fechadas".

Observacao:

- Para `BASIC`, a regra depende do membro vinculado ao usuario.
- Se o usuario `BASIC` nao tiver membro vinculado, ele ve apenas eventos `GERAL` e `MINISTERIO`, nunca `REUNIAO_INTERNA`.

### Permissao de criacao

Eventos `GERAL`:

- podem ser criados por `ADMIN` e `STAFF`;
- `BASIC` nao cria eventos gerais.

Eventos `MINISTERIO`:

- podem ser criados por `ADMIN` e `STAFF`;
- `BASIC` pode criar apenas se o membro vinculado for `LEADER` ou `ASSISTANT_LEADER` de pelo menos um dos ministerios relacionados ao evento;
- para `BASIC`, o backend deve rejeitar qualquer ministerio relacionado no qual ele nao seja lider ou assistente.

Eventos `REUNIAO_INTERNA`:

- podem ser criados por `ADMIN` e `STAFF`;
- `BASIC` pode criar apenas se o membro vinculado for `LEADER` ou `ASSISTANT_LEADER`;
- quando criada por `BASIC`, a reuniao interna deve estar vinculada a um ou mais ministerios liderados/assistidos por ele;
- `BASIC` nao pode criar `REUNIAO_INTERNA` sem ministerio vinculado;
- para `BASIC`, o backend deve rejeitar qualquer ministerio relacionado no qual ele nao seja lider ou assistente.

Observacoes:

- A regra de criacao deve ser aplicada no backend.
- O frontend deve ocultar opcoes indisponiveis para reduzir erro, mas nao deve ser fonte de verdade.
- `ADMIN` e `STAFF` podem criar reunioes internas sem ministerio vinculado.

## Impacto no Backend

### Prisma e Migration

- atualizar `schema.prisma`;
- criar migration retrocompativel;
- regenerar Prisma Client;
- atualizar `ai-context/database/models.md`.

### DTOs

Atualizar:

- `CreateEventoDto`;
- `UpdateEventoDto`;
- `FilterEventosDto`.

Campos novos:

- `tipo?: EventoTipo`;
- `ministerioIds?: string[]`.

Filtros novos:

- `tipo?: EventoTipo`;
- `ministerioId?: string`.

### Eventos Service

Atualizar:

- `create` para gravar tipo e relacoes com ministerios;
- `create` validando permissao por tipo, perfil e ministerios relacionados;
- `update` para sincronizar relacoes N:N;
- `update` validando permissao quando tipo ou ministerios forem alterados;
- `findAll` com include de ministerios;
- `findAll` com filtro por tipo;
- `findAll` com filtro por ministerio;
- `findAll` recebendo usuario autenticado para aplicar visibilidade;
- validacao de datas;
- validacao de ministerios do tenant.

## Impacto no Frontend

### Tipos

Atualizar `Evento`:

- `tipo: 'GERAL' | 'MINISTERIO' | 'REUNIAO_INTERNA'`;
- `ministerios?: Pick<Ministerio, 'id' | 'nome'>[]`.

Atualizar payloads de create/update:

- `tipo?: EventoTipo`;
- `ministerioIds?: string[]`.

### Hook de Eventos

Atualizar `FilterEventos`:

- `tipo?: string`;
- `ministerioId?: string`.

### Tela de Agenda

Atualizar:

- carregar ministerios ativos;
- adicionar select de tipo no modal;
- adicionar seletor multi-ministerio quando fizer sentido;
- restringir opcoes do modal conforme permissao do usuario;
- para `BASIC` lider/assistente, permitir criacao apenas de eventos de ministerio e reunioes internas dos ministerios onde ele lidera/assiste;
- exibir ministerios vinculados no card;
- exibir tipo no card;
- adicionar filtros por tipo e ministerio;
- manter acoes rapidas de status apenas para eventos `AGENDADO`.

### Visualizacao da Agenda

Evoluir a tela existente:

- manter cards de resumo;
- adicionar filtros por tipo e ministerio;
- exibir tipo e ministerios nos cards;
- aplicar dados retornados ja filtrados pelo backend conforme permissao.

### Impressao da Agenda

Evoluir a impressao existente:

- incluir tipo;
- incluir ministerios vinculados;
- manter cabecalho, periodo, tabela e rodape atuais.

## I18n

Adicionar chaves para:

- tipo do evento;
- geral;
- ministerio;
- reuniao interna;
- ministerios relacionados;
- todos os tipos;
- todos os ministerios.

Arquivos:

- `apps/web/messages/pt-BR.json`;
- `apps/web/messages/pt-PT.json`;
- `apps/web/messages/en-US.json`.

## Plano de Execucao

### Etapa 1 - Contrato Final e Banco/API

Status: pendente

Objetivo:

- atualizar Prisma schema;
- criar migration;
- atualizar DTOs;
- atualizar service/controller;
- aplicar regra de visibilidade;
- validar backend.

Saida esperada:

- API pronta para criar, editar, listar e filtrar eventos por tipo e ministerios.

### Etapa 2 - Gerenciamento da Agenda

Status: pendente

Objetivo:

- atualizar tipos e hook;
- carregar ministerios;
- atualizar modal de evento;
- atualizar filtros;
- atualizar cards de gerenciamento.

Saida esperada:

- admin/staff conseguem classificar eventos e vincular ministerios.

### Etapa 3 - Visualizacao e Impressao

Status: pendente

Objetivo:

- evoluir `/agenda/visualizacao`;
- adicionar filtros de tipo/ministerio;
- exibir tipo/ministerios;
- evoluir tabela de impressao.

Saida esperada:

- usuarios veem apenas eventos permitidos e conseguem imprimir agenda com tipo e ministerios.

### Etapa 4 - Documentacao e Fechamento

Status: pendente

Objetivo:

- atualizar plano com status real;
- atualizar `ai-context/database/models.md`;
- registrar validacoes executadas;
- revisar riscos residuais.

## Criterios de Aceite

- Evento pode ser criado como `GERAL`.
- Evento pode ser criado como `MINISTERIO`.
- Evento pode ser criado como `REUNIAO_INTERNA`.
- Evento pode ser vinculado a nenhum, um ou varios ministerios.
- `BASIC` nao consegue criar evento `GERAL`.
- `BASIC` lider/assistente consegue criar evento `MINISTERIO` apenas para seus ministerios.
- `BASIC` lider/assistente consegue criar `REUNIAO_INTERNA` apenas para seus ministerios.
- `BASIC` nao consegue criar `REUNIAO_INTERNA` sem ministerio vinculado.
- `BASIC` nao consegue criar evento de ministerio ou reuniao interna para ministerio em que nao lidera/assiste.
- Ministerios de outro tenant sao rejeitados.
- Evento com `dataFim` anterior a `dataInicio` e rejeitado.
- Eventos existentes continuam como `GERAL`.
- `ADMIN` e `STAFF` veem todos os eventos.
- `BASIC` ve eventos `GERAL`.
- `BASIC` ve eventos `MINISTERIO`.
- `BASIC` nao ve `REUNIAO_INTERNA` sem ministerio.
- `BASIC` ve `REUNIAO_INTERNA` vinculada a ministerio apenas se for `LEADER` ou `ASSISTANT_LEADER` de algum ministerio relacionado.
- Agenda permite filtrar por tipo.
- Agenda permite filtrar por ministerio.
- Visualizacao permite filtrar por tipo e ministerio.
- Impressao mostra tipo e ministerios.
- Typecheck/build relevantes passam ou falhas preexistentes sao registradas.

## Riscos e Cuidados

- A relacao N:N aumenta o cuidado na sincronizacao de update.
- A regra de visibilidade de `BASIC` deve ficar no backend.
- Usuario `BASIC` sem membro vinculado precisa ter comportamento previsivel.
- Eventos antigos nao podem desaparecer apos a migration.
- UI de multi-ministerio deve ser simples para nao pesar o modal.
- A impressao deve continuar limpa mesmo com varios ministerios vinculados.

## Recomendacao Final

Seguir com o escopo reduzido.

Motivo:

- resolve a dor real de visibilidade de reunioes internas;
- preserva eventos gerais e de ministerio como agenda aberta da igreja;
- evita premature optimization com visitantes e publico;
- cria base consistente para filtros, impressao e evolucoes futuras.
