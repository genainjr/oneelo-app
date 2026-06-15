# Fase 6 — Design de Tabelas e Listagens (ODS)

> Fase de **Design** (arquitetura). Nenhum código foi alterado, nenhum componente criado, nenhuma branch criada. Este documento define o padrão oficial de tabelas, listagens e exibição de dados do OneElo, alinhado ao ODS e aos padrões da `ai-core/skills/oneelo-design-system/` (`TABLE_STANDARD`, `FORM_STANDARD`, `CRUD_STANDARD`).
>
> Fontes: `ods-current-status.md`, `ods-refactoring-plan.md`, `ods-phase-6-tables-pre-analysis.md`, `TABLE_STANDARD.md`, `FORM_STANDARD.md`, `CRUD_STANDARD.md` + auditoria direta do código (`apps/web/src`), 2026-06-15.

## Ponto de partida (estado real do código)

O `DataTable<T>` **já existe** (`components/app/data-table.tsx`) e hoje suporta:

- ✅ colunas (`Column<T>`: `key`, `header`, `render`, `className`)
- ✅ render customizado por célula (`render`)
- ✅ ações de linha (via coluna com `render`)
- ✅ loading (skeleton de linhas embutido)
- ✅ empty state (delegado ao `EmptyState`)
- ✅ paginação client-side (`currentPage`/`totalItems`/`itemsPerPage`/`onPageChange`; footer só com `totalPages > 1`)
- ✅ seleção (com select-all e estado indeterminado)
- ❌ **ordenação** (não existe em nenhuma tabela do app)
- ❌ **responsividade mobile** (sem fallback de card; só overflow horizontal)

**Conclusão estrutural:** a Fase 6 **não cria** o `DataTable` do zero — ela o **estende** (ordenação + responsividade), cria poucos auxiliares (`EntityCard`, `StatusBadge`, skeleton de grid) e **migra** as tabelas artesanais (`<table>` cru em Admin e `/membros/visualizacao`) para ele.

---

## DECISÃO 1 — DataTable

**Deve existir?** Sim — e já existe. A decisão é **mantê-lo como padrão único** e **estendê-lo**, não recriá-lo.

**Responsabilidades (o que pertence ao DataTable):**
- Renderizar a marcação tabular (`<table>/<thead>/<tbody>/<tr>/<th>/<td>`) com a tipografia/cores ODS.
- Iterar `data` e aplicar `columns[].render`.
- Exibir estados de **loading** (skeleton de linhas) e **empty** (via `EmptyState`).
- Exibir o **chrome** de seleção (checkbox + select-all) quando habilitado.
- Exibir os controles de **paginação** e os **indicadores de ordenação**, emitindo callbacks.
- Alternar para **render mobile** (cards) quando configurado.

**O que NÃO pertence ao DataTable (mantê-lo "burro"/controlado):**
- Buscar dados / chamar API (responsabilidade do hook do módulo).
- Lógica de negócio, regras de permissão (`canManage`), filtros.
- Estado de filtro (é do `FilterShell`/`useFilterState`).
- Decidir o que ordenar/paginar no servidor — o DataTable apenas **emite** `onSortChange`/`onPageChange`; quem decide é a página/hook.
- Exportação (é do `ExportShell`).

> Manter o DataTable **presentation-only e controlado** é o que garante a compatibilidade com a futura `ResourcePage` (Decisão 6).

**Suporte avaliado:**

| Recurso | Hoje | Decisão Fase 6 | Justificativa |
|---|---|---|---|
| Colunas | ✅ | Manter | `Column<T>` já é o contrato. |
| Render customizado | ✅ | Manter | Cobre badges, avatares, links. |
| Ações | ✅ (via `render`) | Manter (sem prop dedicada) | Coluna `actions` com `render` é flexível; evita acoplar API de ações. |
| Loading | ✅ | Manter | Skeleton de linha já embutido. |
| Empty state | ✅ | Manter (reusar `EmptyState`) | Já delega; só padronizar `emptyAction`. |
| Paginação | ✅ client | **Estender contrato** (controlada, pronta p/ server) | Ver Decisão 4. |
| Ordenação | ❌ | **Adicionar** (`sort` + `onSortChange` + `sortable` na coluna) | Ver Decisão 5. |
| Seleção | ✅ | Manter | Usada em massa (membros). |
| Responsividade | ❌ | **Adicionar** (`renderMobileCard`) | Ver Decisão 2. |

**Interface conceitual (ilustrativa — não é implementação):**

```text
Column<T> {
  key: string
  header: ReactNode
  render?: (item: T) => ReactNode
  className?: string
  // NOVOS (Fase 6)
  sortable?: boolean          // habilita o header clicável
  sortKey?: string            // chave lógica de ordenação (default = key)
  hideOnMobile?: boolean      // suporte ao fallback A (tabela estreita)
}

DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  rowKey?: keyof T | (item) => string
  loading?: boolean
  emptyTitle?: string; emptyDescription?: string; emptyAction?: ReactNode
  // seleção
  selectedIds?: string[]; onSelectChange?: (ids) => void
  // paginação (controlada)
  currentPage?; totalItems?; itemsPerPage?; onPageChange?
  // ordenação (NOVO — controlada)
  sort?: { key: string; direction: 'asc' | 'desc' }
  onSortChange?: (next: { key; direction }) => void
  // responsividade (NOVO)
  renderMobileCard?: (item: T) => ReactNode
  mobileBreakpoint?: 'sm' | 'md' | 'lg'   // default: 'md'
}
```

---

## DECISÃO 2 — Responsividade

**Padrão oficial: B (Tabela desktop + EntityCard mobile)**, exposto de forma **híbrida controlada** — ou seja, o mecanismo B é o default recomendado, mas o `DataTable` o oferece como **opcional** (`renderMobileCard`), o que torna o sistema como um todo um **C governado por regra**.

Regra oficial:
- **Tabela de entidade com > 3 colunas significativas** → usar B: desktop = tabela; mobile = `renderMobileCard` (EntityCard). É o caso de `/membros` e `/membros/visualizacao`.
- **Tabela estreita (≤ 3–4 colunas) ou administrativa densa** → permitido A: tabela única com overflow horizontal contido + `hideOnMobile` em colunas acessórias (ex.: Admin/Tenants).
- **Listagens já card-primárias** (Agenda, Ministérios, Minhas Escalas) → permanecem cards em todas as larguras via `EntityCard` (não viram tabela).

**Onde usar exceções:**
- Matriz de escalas (Decisão 7) — não é tabela ODS; mantém seu próprio responsivo (já tem desktop table + cards mobile próprios em `EscalaReadonlyGrid`).
- Tabela de auditoria (`/configuracoes`) — densa e read-only: aceitável overflow horizontal (A) por ser tela administrativa de baixa frequência mobile.

**Justificativa:** tabelas de 5 colunas (membros) quebram em smartphone; overflow horizontal faz o usuário perder a primeira coluna (contexto). Hoje o problema é resolvido **duplicando** a iteração (`hidden md:block` + `md:hidden`), dobrando o DOM e o custo de manutenção. Centralizar isso em `renderMobileCard` elimina a duplicação sem reescrever lógica por página.

---

## DECISÃO 3 — Componentes Compartilhados

| Componente | Decisão | Justificativa |
|---|---|---|
| **DataTable** | **Estender** (já existe) | Adicionar ordenação + `renderMobileCard`. Núcleo do padrão. |
| **TableToolbar** | **Não criar** | `FilterShell` (Fase 4) e `ExportShell` (Fase 3) já cobrem busca/ações acima da lista; um toolbar acoplado conflitaria e engessaria telas de grid sem tabela. Ações soltas via flex. |
| **EmptyState** | **Não criar** (reusar) | Já existe e é consumido pelo `DataTable`; só padronizar `emptyAction`. |
| **LoadingState (genérico)** | **Não criar** | Skeleton de tabela já vive dentro do `DataTable`. Um "LoadingState" genérico seria abstração vazia. |
| **SkeletonList / CardSkeleton** | **Criar (enxuto)** | Para os **grids de cards** (agenda, ministérios, membros, minhas-escalas) que hoje repetem `[1,2,3].map(animate-pulse)` em ~4 telas. Pode nascer como variante do `EntityCard` (`<EntityCard loading />`) em vez de componente separado. |
| **EntityCard** | **Criar** | Duplo uso: (1) fallback mobile do `DataTable`; (2) container padrão de grids de entidade, substituindo `div`s sombreadas manuais. |
| **StatusBadge** | **Criar** | Consome `lib/utils` (`STATUS_*_LABEL`/`COLOR`); elimina mapas de cor inline em membros/agenda/escalas/exports. Transversal — beneficia tabela e card. |
| **TableActions / RowActions** | **Adiar** | Ações de linha continuam via coluna `render`. Avaliar um helper fino (`RowActions`) só se a repetição de botões editar/excluir justificar; não bloqueia a fase. |
| **Pagination** | **Não extrair agora** (embutido) | A paginação já vive no `DataTable`. Extrair como componente público só faria sentido se houvesse paginação fora de tabela — não há. |
| **SortHeader** | **Criar como interno do DataTable** | O header ordenável é detalhe de implementação do `DataTable` (a coluna ganha `sortable`), **não** um componente público. Evita superfície de API desnecessária. |

**Resumo:** criar **`EntityCard`** e **`StatusBadge`** (+ skeleton de card, idealmente como `EntityCard loading`); **estender** `DataTable`; **reusar** `EmptyState`; **não criar** `TableToolbar`/`LoadingState`/`Pagination`/`SortHeader` públicos; **adiar** `TableActions`.

---

## DECISÃO 4 — Paginação

**Estado atual:**
- `DataTable` tem paginação **client-side** (slice), efetiva apenas em `/membros` (10/pág).
- `/configuracoes` passa `itemsPerPage=15` mas **não conecta** `currentPage`/`onPageChange` → footer não renderiza (paginação sem efeito).
- Demais listas (cards de agenda/ministérios, visualizações, grade) **não paginam**.
- Não há paginação **server-side** em lugar nenhum.

**Padrão oficial:** **client-side como default agora**, com **contrato pronto para server-side** (híbrido por configuração).
- O `DataTable` permanece **controlado** (`currentPage`/`onPageChange`); quem mantém o estado é a página/hook.
- Default imediato: paginação client (volumes atuais por tenant são pequenos; não exige mudar API — respeita o princípio "não alterar contratos de API" da fase).
- Futuro server-side: o **mesmo contrato** de props é reutilizado; o hook (`useResource`) passa a buscar por `offset/limit` e a alimentar `data`/`totalItems`. A UI do `DataTable` **não muda**.

**Impactos futuros:**
- Migrar para server-side é decisão de **hook/endpoint**, não de UI — isolada e de baixo risco visual.
- Corrigir `/configuracoes` (conectar `onPageChange`) é item desta fase.
- Quando o volume crescer (tenants grandes), ativar server-side por módulo sem refatorar telas.

---

## DECISÃO 5 — Ordenação

**Estado atual:** nenhuma tabela tem ordenação por coluna. Existem apenas ordenações fixas implícitas (dias de escala por `ordem`/data; membros por nome em alguns selects).

**Padrão oficial:** **ordenação local (client) controlada**, com contrato pronto para backend.
- A coluna declara `sortable: true` (e `sortKey` opcional).
- O `DataTable` é **controlado**: recebe `sort` e emite `onSortChange`; **não** ordena sozinho por padrão. A página/hook aplica a ordenação (local) sobre `data`.
- Backend opcional futuro: o mesmo `onSortChange` vira parâmetro de query no hook; nada muda na UI.

**Justificativa:** manter o `DataTable` controlado evita acoplar regra de comparação (locale `pt-BR`, datas, números) dentro do componente e mantém a porta aberta para server-side sem retrabalho — coerente com a decisão de paginação.

---

## DECISÃO 6 — Compatibilidade com ResourcePage

**DataTable será compatível com a futura `ResourcePage`? Sim.**

`ResourcePage` (alvo do `CRUD_STANDARD`) = `PageHeader` + `FilterShell`/`useFilterState` + **`DataTable`** + modal (`ModalShell`+`ModalFooter`) + `ConfirmDialog` + hook `useResource<T>`.

O `DataTable` é exatamente o **slot de listagem** desse contrato. As extensões da Fase 6 reforçam a compatibilidade **porque mantêm o componente controlado**:
- `data`/`loading`/`error` vêm do `useResource`.
- Ordenação/paginação são estados que o `useResource` pode possuir (local hoje, server amanhã) — o `DataTable` só reflete e emite eventos.
- Ações de linha (editar/excluir) são injetadas via coluna `render`, acionando o modal/`ConfirmDialog` da `ResourcePage`.
- `renderMobileCard` reaproveita o `EntityCard` da própria `ResourcePage`.

**Conclusão:** a Fase 6 deve tratar o `DataTable` como peça da `ResourcePage`. Pré-requisito explícito: **não** colocar fetch, permissão ou filtro dentro do `DataTable`. Se isso for respeitado, a `ResourcePage` (fase posterior) apenas **compõe** os blocos já prontos.

---

## DECISÃO 7 — Escalas

**A matriz/grade de escalas NÃO entra no DataTable. Permanece independente.**

Analisado:
- **Matriz/Grade** (`EscalaGrid` editável, `EscalaReadonlyGrid`): estrutura dias × funções com células de membros — semântica matricial, não tabular de entidade.
- **Drag and drop** (reordenar dias) e edição in-place (atribuir/remover membro, ocultar célula): estado denso e específico de domínio.
- **IA** ("gerar escala" — hoje modal "em breve"): fluxo futuro de geração, ortogonal à exibição.

**Justificativa:** forçar a matriz no `DataTable` genérico amarraria o layout e quebraria a UX de montagem. O `TABLE_STANDARD` já reconhece a grade de escala como **exceção de domínio** (`EscalaGrid`/`EscalaReadonlyGrid`).

**Porém — o que ENTRA no padrão Fase 6 no módulo de escalas:**
- A **lista lateral de escalas** (cards) e **Minhas Escalas** (cards por período) → migram para `EntityCard` + `EmptyState` + skeleton.
- `StatusBadge` para status de escala/confirmação (usa `lib/utils`).
- Redução de duplicação entre `EscalaGrid` e `EscalaReadonlyGrid` continua sendo trabalho à parte (não é o DataTable).

---

## RELATÓRIO FINAL

## Arquitetura Recomendada

Padrão único de exibição de dados em três camadas:

1. **Tabela de entidade** → `DataTable<T>` (estendido) — listagens CRUD e read-only tabulares.
2. **Card de entidade** → `EntityCard` — grids card-primários e fallback mobile do `DataTable`.
3. **Matriz de domínio** → `EscalaGrid`/`EscalaReadonlyGrid` — exceção, fora do `DataTable`.

Transversais de apoio: `StatusBadge` (status via `lib/utils`), `EmptyState` (reuso) e skeletons (tabela embutida no `DataTable`; card via `EntityCard loading`). `DataTable` permanece **controlado e presentation-only**, pronto para compor a `ResourcePage`.

## Componentes Necessários

- **`DataTable`** — estender com **ordenação** (`sortable`/`sort`/`onSortChange`) e **responsividade** (`renderMobileCard`/`mobileBreakpoint`).
- **`EntityCard`** — criar (grids + fallback mobile + estado `loading`).
- **`StatusBadge`** — criar (consome `lib/utils`).

## Componentes Adiados

- **`TableActions`/`RowActions`** — adiado (ações via coluna `render`; criar helper só se a repetição justificar).
- **`Pagination`** público — adiado (permanece embutido no `DataTable`).
- **`SortHeader`** público — não vira componente público (interno do `DataTable`).
- **`TableToolbar`** — rejeitado (coberto por `FilterShell`/`ExportShell`).
- **`LoadingState` genérico** — não criar (skeleton já no `DataTable`; card via `EntityCard`).

## Responsividade Oficial

Padrão **B (tabela desktop + EntityCard mobile)** como default, exposto via prop opcional `renderMobileCard` (mecanismo **híbrido C** por regra). Exceções: tabelas estreitas/administrativas podem usar **A** (tabela única + overflow + `hideOnMobile`).

## Estratégia Mobile

Abaixo do breakpoint (`md` default), o `DataTable` oculta a tabela e renderiza `renderMobileCard(item)` (um `EntityCard`) iterando os **mesmos dados** — sem duplicar a iteração na página. Grids card-primários já são mobile-first.

## Estratégia Desktop

Tabela ODS via `DataTable`: cabeçalhos com tipografia/cores padronizadas, colunas configuráveis, coluna de ações ao final (discreta), seleção opcional, paginação no rodapé e headers ordenáveis quando `sortable`.

## Estratégia de Paginação

Client-side controlada como default (sem mudar API); contrato idêntico pronto para server-side futuro (hook troca de slice para `offset/limit` sem alterar a UI). Corrigir `/configuracoes` (conectar `onPageChange`).

## Estratégia de Ordenação

Ordenação local controlada: coluna marca `sortable`; `DataTable` reflete `sort` e emite `onSortChange`; a página/hook aplica a comparação (`pt-BR`/datas/números). Backend opcional futuro pelo mesmo contrato.

## Compatibilidade ResourcePage

Total. `DataTable` é o slot de listagem da `ResourcePage`. Requisito: mantê-lo controlado e sem fetch/permissão/filtro internos. As extensões da fase preservam isso.

## Estratégia de Migração

Classificação de risco e ordem recomendada (alinhada à ordem solicitada):

| Ordem | Módulo | Risco | Por quê |
|---|---|---|---|
| 1 | **Admin** (tenants/usuários) | **Baixo** | Tabela `<table>` crua, simples, sem dualidade mobile profunda; homologa o `DataTable`. |
| 2 | **Configurações** | **Baixo** | Já usa `DataTable`; só **corrigir paginação** e aplicar `StatusBadge`. (Migrar tabs→`TabsShell` e modal de desativação→`ConfirmDialog` é trabalho de CRUD/config, não bloqueia.) |
| 3 | **Membros** (visualização) | **Médio** | Valida a **responsividade oficial** (B): elimina o bloco `md:hidden` duplicado via `renderMobileCard`. |
| 4 | **Agenda** | **Baixo/Médio** | Grid de cards → `EntityCard` + `EmptyState` + skeleton; baixa lógica de negócio. |
| 5 | **Ministérios** | **Médio** | Cards ricos (lideranças/métricas) → `EntityCard` com slots; cuidado com o conteúdo do card. |
| 6 | **Escalas** | **Alto** | **NÃO migrar a matriz.** Só listas secundárias (lista lateral, Minhas Escalas) para `EntityCard`/`StatusBadge`. |

## Complexidade

**Média.** Não toca hooks de mutação nem regras de negócio (resolvidos na Fase 5). É majoritariamente transformação de JSX estático em composição de componentes + extensão controlada do `DataTable` (ordenação/mobile). O ponto sensível é o breakpoint do fallback mobile.

## Riscos

- **Quebra em tablets** (colunas comprimidas) — mitigar com breakpoint configurável e `hideOnMobile`.
- **Regressão de ações de linha** ao mover `<table>` cru do Admin para o `DataTable` — validar editar/excluir por linha.
- **Escalas:** risco alto se alguém tentar enquadrar a matriz no `DataTable` — explicitamente fora de escopo.
- **Ordenação local vs dados paginados** — definir se ordena antes ou depois do slice (ordenar o conjunto completo antes de paginar).

## Ganho Esperado

Consistência visual final no núcleo de dados; tabelas que não quebram em mobile; eliminação de skeletons/headers/badges duplicados; base pronta para a `ResourcePage`.

## Estimativa de Redução de Código

**~300 a 450 linhas** de JSX redundante removidas (tabelas `<table>` manuais, blocos mobile duplicados `md:hidden`, skeletons `[1,2,3].map`, mapas de cor de status inline).

## Plano de Implementação

1. Estender `DataTable`: ordenação (`sortable`/`sort`/`onSortChange`) + responsividade (`renderMobileCard`/`mobileBreakpoint`/`hideOnMobile`).
2. Criar `StatusBadge` (consome `lib/utils`) e `EntityCard` (com `loading`).
3. Migrar **Admin** (tenants/usuários) para `DataTable`.
4. Corrigir paginação de **Configurações** + aplicar `StatusBadge`.
5. Migrar **Membros/visualização** validando o fallback mobile (B).
6. Migrar grids de **Agenda** e **Ministérios** para `EntityCard` + `EmptyState` + skeleton.
7. Aplicar `EntityCard`/`StatusBadge` nas listas secundárias de **Escalas** (sem tocar a matriz).
8. Varredura final: substituir skeletons manuais e mapas de status inline remanescentes.
9. Validar (lint/build + perfis ADMIN/STAFF/BASIC) — sem mudança de contratos de API.

---

## ODS Compliance

| Métrica | Atual | Projetada pós-Fase 6 |
|---|---:|---:|
| Tabelas / Listagens | ~20% | **~90–95%** |

Gap remanescente (~5–10%): matriz de escalas (exceção de domínio, intencional) e eventuais cards de entidade ainda não componentizados. A aderência global do ODS sobe de **~50%** para **~65–70%** após esta fase (Tabelas deixa de ser o maior buraco; Permissões/Navegação seguem em 0%).

---

## Respostas Objetivas

1. **Quais componentes devem ser criados?**
   **`EntityCard`** e **`StatusBadge`** (+ skeleton de card, idealmente como `EntityCard loading`). O **`DataTable`** já existe e deve ser **estendido** (ordenação + responsividade), não recriado. `EmptyState` é reusado. Não criar `TableToolbar`, `LoadingState`, `Pagination` ou `SortHeader` públicos; adiar `TableActions`.

2. **Qual padrão oficial de responsividade?**
   **B — tabela desktop + `EntityCard` mobile**, via prop opcional `renderMobileCard` (mecanismo híbrido por regra; exceção A para tabelas estreitas/administrativas).

3. **Escalas entram ou não no DataTable?**
   **Não.** A matriz/grade (com drag&drop e IA futura) permanece independente (`EscalaGrid`/`EscalaReadonlyGrid`). Apenas as **listas secundárias** de escalas adotam `EntityCard`/`StatusBadge`.

4. **Vale criar `ResourcePage` depois?**
   **Sim.** O `DataTable` controlado é peça central dela. A Fase 6 deve preservá-lo presentation-only para que a `ResourcePage` (fase posterior) apenas componha `PageHeader` + `FilterShell` + `DataTable` + modal + `ConfirmDialog` + `useResource`.

5. **Qual aderência ODS esperada?**
   Tabelas/Listagens de **~20% → ~90–95%**; aderência global do ODS de **~50% → ~65–70%**.
