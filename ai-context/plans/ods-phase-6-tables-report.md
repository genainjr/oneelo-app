# Fase 6 — Relatório de Implementação: Tabelas e Listagens (ODS)

> Data: 2026-06-15 · Branch: `refactor/ods-phase-7` (branch atual, conforme solicitado).
> Escopo executado: apenas o aprovado no design (`ods-phase-6-tables-design.md`). Sem alteração de APIs, permissões, multitenancy ou regras de negócio. Sem novas branches. Próximas fases não iniciadas.

## Componentes alterados

| Componente | Arquivo | Mudança |
|---|---|---|
| `DataTable<T>` | `components/app/data-table.tsx` | **Estendido** (não recriado): ordenação controlada (`Column.sortable`/`sortKey`, props `sort`/`onSortChange` + caret no header), responsividade (`renderMobileCard` + `mobileBreakpoint`), `Column.hideOnMobile`. Mantido **presentation-only e controlado** (não ordena nem fatia dados; só emite eventos). Consumidores existentes preservados. |
| `StatusBadge` | `components/app/status-badge.tsx` | **Criado.** Pill de status presentation-only; cores/labels vêm de `lib/utils` ou do módulo via `className`. |
| `EntityCard` | `components/app/entity-card.tsx` | **Criado.** Container de card para grids e fallback mobile do `DataTable`; suporta `href`/`onClick`/`loading` (skeleton). |
| `EmptyState` | `components/app/empty-state.tsx` | **Reutilizado** (sem alteração). |

**Não criados (conforme design):** `TableToolbar`, `LoadingState` genérico, `Pagination` pública, `SortHeader` público (virou detalhe interno do `DataTable`), `TableActions`, `ResourcePage`.

## Telas migradas

| Ordem | Tela | Arquivo | O que mudou |
|---|---|---|---|
| 1 | **Admin (tenants)** | `app/(admin)/admin/page.tsx` | `<table>` manual → `DataTable`; `Badge` local agora delega a `StatusBadge`; ordenação por Igreja e Criado em; `hideOnMobile` em Usuários/Criado em (estratégia A). |
| 2 | **Configurações** | `app/(dashboard)/configuracoes/page.tsx` | **Paginação corrigida** (antes `itemsPerPage` não tinha efeito): agora fatia + conecta `currentPage`/`onPageChange` (15/pág) em Usuários e Auditoria; `StatusBadge` para role/status/ação; ordenação por Nome/Criado em; `hideOnMobile` em colunas acessórias; reset de página ao trocar de aba. |
| 3 | **Membros / visualização** | `app/(dashboard)/membros/visualizacao/page.tsx` | Tabela desktop + lista mobile duplicadas → **um único `DataTable` com `renderMobileCard`** (`EntityCard`); `StatusBadge`; ordenação por Nome/Nascimento. |
| 4 | **Agenda** | `app/(dashboard)/agenda/page.tsx` | Card de evento manual → `EntityCard`; status → `StatusBadge`; skeleton de loading via `EntityCard loading`. |
| 5 | **Ministérios** | `app/(dashboard)/ministerios/page.tsx` | Card de ministério manual → `EntityCard`; status ativo/arquivado → `StatusBadge`; skeleton de loading via `EntityCard loading`. |

**Não migradas (conforme design):** matriz de **Escalas** (`EscalaGrid`/`EscalaReadonlyGrid`), drag and drop e fluxo de IA — permanecem independentes.

## Responsividade

Padrão oficial **B (tabela desktop + `EntityCard` mobile)** aplicado via `renderMobileCard`, seguindo a regra aprovada:
- **≤ 4 colunas / telas administrativas** → tabela responsiva (estratégia A) com `hideOnMobile` nas colunas acessórias: **Admin** e **Configurações**.
- **> 4 colunas / tela de usuário final** → `renderMobileCard`: **Membros/visualização** (5 colunas) — eliminou o bloco `md:hidden` duplicado.
- Grids card-primários (Agenda, Ministérios) permanecem cards em todas as larguras via `EntityCard`.

## Ordenação

Implementada **local e controlada**: a coluna declara `sortable`; o `DataTable` reflete `sort` e emite `onSortChange`; a página aplica a comparação (`localeCompare pt-BR` para texto, timestamp para datas) via `useMemo`. Ativada em Admin (Igreja/Criado em), Configurações (Nome/Criado em) e Membros/visualização (Nome/Nascimento). Contrato pronto para backend futuro sem mudança de UI. Nenhuma chamada de API alterada.

## Redução de código

| Métrica | Valor |
|---|---|
| Linhas de JSX/boilerplate removidas (telas migradas) | **201** |
| Linhas adicionadas (total) | 401 |
| — destas, capacidades novas do `DataTable` | ~+125 (ordenação + mobile + hideOnMobile) |
| — destas, componentes reutilizáveis novos | +77 (`StatusBadge` 27 + `EntityCard` 50) |
| — destas, configuração de colunas/sort nas telas | restante |

Observação honesta: o **net** é positivo (+200) porque o `DataTable` ganhou recursos e os componentes reutilizáveis foram criados uma única vez. O **boilerplate repetido** (tabelas `<table>` manuais, lista mobile duplicada, skeletons `[1,2,3].map`, mapas de cor inline) foi **removido** (~201 linhas) e centralizado. Migrações futuras passam a ser **net-negativas** ao reusar `DataTable`/`EntityCard`/`StatusBadge`. A estimativa do design (300–450) referia-se ao potencial total incluindo telas ainda não migradas e a remoção de skeletons remanescentes (pendência abaixo).

## Validações

| Validação | Resultado |
|---|---|
| **TypeScript** (`tsc --noEmit`) | ✅ **Exit 0** — sem erros de tipo. |
| **ESLint** (arquivos alterados) | ⚠️ Apenas erros **pré-existentes** de baseline (`no-explicit-any`, `react-hooks/set-state-in-effect`, imports não usados `ModalError`/`FormEvent`). Confirmado idêntico em arquivos **não tocados** (`membros/page.tsx`, `escalas/page.tsx`) e no `git HEAD` de `agenda`. **Nenhum erro novo introduzido**; `any` foi inclusive **reduzido** (`badges: any`→`Record<string,string>`, `as any`→`as keyof User`/`React.ReactNode`). |
| **Build** (`next build`) | Barrado no estágio de lint pelo débito pré-existente do repo (config não usa `eslint.ignoreDuringBuilds`); condição anterior à Fase 6, não causada por ela. |
| **Estados validados (revisão de código)** | loading (skeleton de linha + `EntityCard loading`), empty (`EmptyState` via `DataTable`), ordenação (caret + `useMemo`), paginação (Configurações agora funcional; Membros já client), mobile (`renderMobileCard` < `md`), desktop (tabela). |

## Pendências

- **Build verde** depende de quitar o débito pré-existente de lint (`no-explicit-any`, `set-state-in-effect`) — fora do escopo da Fase 6.
- **Ações de linha** seguem via coluna `render` (helper `TableActions` adiado, conforme design).
- **Paginação server-side** não ativada (contrato pronto; decisão de hook/endpoint futura).
- **Skeletons manuais remanescentes** em telas não listadas (ex.: `minhas-escalas`) ainda podem migrar para `EntityCard loading` — varredura final não obrigatória nesta fase.
- **`DrawerShell` genérico** e dedup `EscalaGrid`/`EscalaReadonlyGrid** continuam fora de escopo (não-tabela).
- Pequenas diferenças visuais aceitáveis: pills agora `StatusBadge` (raio/peso padronizados); cards usam `border-gray-100`/`shadow-sm` do `EntityCard`.

## Impacto ODS

| Métrica | Antes | Depois |
|---|---:|---:|
| Tabelas / Listagens | ~20% | **~90%** |
| Aderência global ODS | ~50% | **~62–65%** |

Gap remanescente em Tabelas/Listagens (~10%): matriz de Escalas (exceção de domínio, intencional) e skeletons pontuais não migrados. Tabelas deixam de ser o maior buraco; Navegação e Permissões seguem em 0% (Fase 8).

---

## Resumo Final

**Arquivos alterados (6 código) + 2 criados:**
- `apps/web/src/components/app/data-table.tsx` (estendido)
- `apps/web/src/components/app/status-badge.tsx` (novo)
- `apps/web/src/components/app/entity-card.tsx` (novo)
- `apps/web/src/app/(admin)/admin/page.tsx`
- `apps/web/src/app/(dashboard)/configuracoes/page.tsx`
- `apps/web/src/app/(dashboard)/membros/visualizacao/page.tsx`
- `apps/web/src/app/(dashboard)/agenda/page.tsx`
- `apps/web/src/app/(dashboard)/ministerios/page.tsx`

**Linhas removidas:** 201 (boilerplate de exibição) · **adicionadas:** 401 (sendo ~202 de novos recursos do `DataTable` + 2 componentes reutilizáveis).

**Aderência ODS atualizada:** Tabelas/Listagens **~20% → ~90%**; global **~50% → ~62–65%**.

**Validação:** TypeScript exit 0; lint sem erros novos (apenas baseline pré-existente); nenhuma API/permissão/multitenancy/regra de negócio alterada.
