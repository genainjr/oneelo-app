# Plano de Desenvolvimento - Refatoracao para OneElo Design System

Fonte:

- `ai-context/frontend/ods-compliance-matrix.md`
- `ai-context/frontend/design-system-inventory.md`
- `ai-context/frontend/design-system-pattern-analysis.md`
- `ai-context/plans/ods-current-status.md`
- `ai-core/skills/oneelo-design-system/` (README, CRUD_STANDARD, TABLE_STANDARD, FORM_STANDARD, VIEW_STANDARD, EXPORT_STANDARD, PERMISSIONS_STANDARD)

Objetivo: refatorar gradualmente o frontend para aderir ao OneElo Design System (ODS), eliminando duplicidades sem alterar regras de negocio.

Atualizacao: 2026-06-15 · branch `refactor/ods-phase-7`. Esta revisao corrige a numeracao das fases (Filtros = Fase 4 entregue; Tabelas = Fase 6 em design), marca o que ja foi implantado e detalha apenas o trabalho restante, alinhado aos padroes canonicos da ai-core.

---

## Status Das Fases

| Fase | Tema | Status | Evidencia |
|---|---|---|---|
| Fase 0 | Preparacao e Baseline | Concluida | `ods-phase-0-baseline.md` |
| Fase 1 | Fundacoes Compartilhadas | Concluida | `ods-phase-1-foundations-report.md` |
| Fase 2 | Confirmacoes e Feedback | Concluida | `ods-phase-2-feedback-report.md` |
| Fase 3 | Exportacoes | Concluida | `ods-phase-3-export-report.md` |
| Fase 4 | Filtros | Concluida | `ods-phase-4-filters-report.md` |
| Fase 5 | Modais CRUD | Concluida | `ods-phase-5-crud-modals-report.md` |
| Fase 7 | Visualizacoes e Metricas | Concluida | `ods-current-status.md` |
| **Fase 6** | **Tabelas e Listagens** | **Em design (nao implementada)** | `ods-phase-6-tables-design.md`, `ods-phase-6-tables-pre-analysis.md` |
| **Fase 8** | **Permissoes e Navegacao** | **Nao iniciada** | — |
| **Fase 9** | **Validacao Final** | **Nao iniciada** | — |

> Nota de numeracao: a ordem de execucao real foi 0 → 1 → 2 → 3 → 4 (Filtros) → 5 (Modais CRUD) → 7 (Visualizacoes). A Fase 6 (Tabelas) foi desenhada apos a Fase 7 e ainda nao foi implementada — e a proxima prioridade.

### Aderencia ODS atual

| Area | Aderencia | Padrao unico existe? |
|---|---:|---|
| Exportacoes | ~100% | Sim (`ExportShell`/`useExport`) |
| Filtros (container) | ~100% | Sim (`FilterShell`/`useFilterState`) |
| Feedback / Confirmacao | ~85% | Sim (`ConfirmDialog`; 1 excecao inline) |
| Formularios | ~50% | Parcial (`form-field`) |
| Modais | ~50% | Parcial (`ModalShell`; footer inconsistente) |
| Tabelas / Listagens | ~20% | Nao (foco da Fase 6) |
| CRUDs | ~20% | Nao (5 padroes; alvo: `ResourcePage`) |
| Navegacao | 0% | Nao (Fase 8) |
| Permissoes | 0% (sem abstracao) | Nao (Fase 8) |

---

## Principios

- Nao mudar comportamento de negocio durante refatoracao visual/estrutural.
- Refatorar primeiro componentes compartilhados, depois telas.
- Preservar rotas existentes e contratos atuais de API.
- Manter backend como fonte de verdade de autorizacao.
- Evitar big bang: cada fase deve ser testavel isoladamente.
- Usar os documentos da ai-core (`oneelo-design-system`) como especificacao-alvo de cada padrao.

---

## Resumo das Fases Concluidas

> Mantido como registro historico. O que foi entregue (confirmado por auditoria do codigo atual):

### Fase 0 - Baseline (Concluida)
Rotas criticas mapeadas, estados (loading/vazio/erro/dados/sem-edicao) registrados, lint/build como baseline. Nenhuma alteracao funcional.

### Fase 1 - Fundacoes (Concluida)
Criados os shells base: `ModalShell` + `ModalError` + `ModalFooter`; `InputField` / `SelectField` / `TextareaField` / `PasswordField`. `lib/utils` confirmado como fonte de labels/cores de status.

### Fase 2 - Confirmacoes e Feedback (Concluida)
`ConfirmDialog` implantado. `confirm()`/`alert()` nativos expurgados de membros, ministerios, agenda e escalas. Excecao remanescente: modal de desativacao inline em `/configuracoes` (a migrar na Fase 6/CRUD).

### Fase 3 - Exportacoes (Concluida)
`ExportShell` + `useExport` + `downloadCsv` unificam as 4 paginas `*/exportacao`. Codigo reduzido ~60%. Pendencia menor: labels de status locais (mover para `lib/utils`); XLSX ainda como "em breve".

### Fase 4 - Filtros (Concluida)
`FilterShell` + `FilterActions` + `useFilterState` padronizados em membros, agenda, membros/visualizacao, escalas/visualizacao e escalas. Pendencia menor: campos internos ainda usam `<input>`/`<select>` manuais (alvo futuro `FilterInput`/`FilterSelect`).

### Fase 5 - Modais CRUD (Concluida)
Modais inline migrados para `ModalShell` (agenda, escalas, ministerios com `TabsShell`, admin, tag). Pendencia: `MembroModal` e `UsuarioModal` ainda escrevem o rodape a mao (nao usam `ModalFooter`).

### Fase 7 - Visualizacoes e Metricas (Concluida)
`StatCard` padronizado (sem mais `StatBox` local) em dashboard e todas as visualizacoes. `InfoItem` extraido (perfil, drawer). `MemberProfileDrawer` consolidado. Pendencia: falta `DrawerShell` generico; `EscalaGrid` ainda duplica `EscalaReadonlyGrid`.

---

## Fases Pendentes (detalhadas)

## Fase 6 - Tabelas e Listagens

Spec-alvo: `ai-core/skills/oneelo-design-system/TABLE_STANDARD.md`.

### Objetivo
Adotar `DataTable<T>` como padrao unico para entidades tabulares; eliminar tabelas artesanais; introduzir ordenacao e paginacao consistentes.

### Modulos alvo
- `/admin` (tenants) — `<table>` manual → `DataTable`.
- `/membros/visualizacao` — `<table>` + lista mobile → `DataTable` com slot mobile.
- `/configuracoes` — corrigir paginacao (passa `itemsPerPage` mas nao conecta `currentPage`/`onPageChange`).
- `/membros` — ja usa `DataTable`; alinhar badges/cores ao `lib/utils`.

### Tarefas
1. Adaptar a tabela de tenants para `DataTable` (colunas + coluna de acoes ao final).
2. Adaptar a visualizacao de membros para `DataTable` no desktop, mantendo cards mobile via slot/`renderMobile`.
3. Introduzir **ordenacao por coluna** no `DataTable` (hoje inexistente em todo o app).
4. Corrigir/uniformizar **paginacao** (client-side); avaliar contrato para server-side futuro.
5. Centralizar badges de status/role via `lib/utils` (criar `StatusBadge` — transversal).
6. Garantir `EmptyState`/loading skeleton consistentes (ja providos pelo `DataTable`).
7. Manter grades de escala (`EscalaGrid`/`EscalaReadonlyGrid`) como excecao de dominio; reduzir duplicacao entre elas onde seguro.

### Criterios de aceite
- Toda tabela de entidade simples usa `DataTable`.
- Tabelas read-only usam `DataTable` (com slot mobile) ou justificam excecao.
- Ordenacao e paginacao previsiveis; nenhuma regressao de acoes por linha.

---

## Fase CRUD - Padrao Unico `ResourcePage` (transversal, apos Fase 6)

Spec-alvo: `CRUD_STANDARD.md` + `FORM_STANDARD.md`. Depende do `DataTable` completo (Fase 6) e de `usePermissions` (Fase 8).

### Objetivo
Consolidar os 5 padroes de CRUD num contrato unico, reaproveitando os nucleos ja entregues.

### Contrato
`PageHeader` (acao primaria condicionada) → `FilterShell`/`useFilterState` → `DataTable<T>` (acoes de linha + slot mobile) → modal unico `ModalShell` + `ModalFooter` → `ConfirmDialog` → hook generico `useResource<T>(endpoint)`.

### Tarefas
1. Extrair `useResource<T>` a partir do esqueleto repetido em `useMembros`, `useMembrosVisualizacao`, `useEscalas`, `useEscalasVisualizacao`, `useEventos`.
2. Migrar `MembroModal`/`UsuarioModal` para `ModalFooter`.
3. Migrar `/configuracoes` (modal de desativacao inline → `ConfirmDialog`; tabs a mao → `TabsShell`).
4. Encaixar admin, agenda, ministerios e configuracoes no contrato `ResourcePage`.

### Criterios de aceite
- Um unico contrato CRUD documentado e aplicado.
- Sem modais inline com shell proprio; footer consistente.
- Sem refetch de `/me` por pagina (usa `usePermissions`).

---

## Fase 8 - Permissoes e Navegacao

Spec-alvo: `PERMISSIONS_STANDARD.md` + `ai-context/frontend/navigation-rules.md`.

### Objetivo
Centralizar permissoes visuais e padronizar a navegacao, sem alterar autorizacao no backend.

### Modulos alvo
- `DashboardLayout`, `Sidebar`, todas as paginas que buscam `/api/auth/me`.

### Tarefas
1. Criar `UserContext` no `(dashboard)/layout` carregando `/api/auth/me` uma vez.
2. Criar `usePermissions()` expondo `canManage`, `canCreate`, `isAdmin`, `leads(ministerioId)` / `canManageSelected...`.
3. Substituir os ~9 refetches de `/me` espalhados por consumo do contexto.
4. Centralizar a lista de rotas bloqueadas para BASIC (hoje duplicada em `middleware.ts` e na sidebar).
5. Unificar o decode de JWT (`lib/auth.ts` e `middleware.ts`).
6. Migrar icones SVG inline da sidebar para `lucide`/`IconRegistry`.
7. Revisar visibilidade de exportacao por perfil; revisar BASIC comum vs BASIC lider/co-lider.
8. Adicionar breadcrumbs onde houver hierarquia; mover `PAGE_TITLES` do header para i18n.

### Criterios de aceite
- Regras de visibilidade previsiveis e centralizadas.
- Sidebar alinhada ao documento de navegacao e aos perfis do `PERMISSIONS_STANDARD`.
- Nenhuma acao bloqueada aparece para usuario sem permissao visual.

---

## Fase 9 - Validacao Final

### Objetivo
Garantir que a refatoracao ODS nao alterou comportamento esperado.

### Tarefas
1. Rodar lint/build/testes disponiveis.
2. Validar rotas criticas em desktop e mobile.
3. Validar perfis: ADMIN, STAFF, BASIC comum, BASIC lider/co-lider, SUPER_ADMIN.
4. Validar CRUDs principais: membros, ministerios, escalas, agenda, usuarios, tenants.
5. Validar exportacoes CSV.

### Criterios de aceite
- Nenhuma regressao funcional conhecida.
- Matriz de conformidade atualizada.
- ODS passa a ser referencia para novas telas.

---

## Recomendacoes de Padrao Unico (por impacto)

Consolidado de `design-system-pattern-analysis.md` e `ods-compliance-matrix.md`.

### ALTO IMPACTO
- **CRUD unico (`ResourcePage`)** — resolve a maior fragmentacao; depende de Fase 6 + Fase 8.
- **Tabela unica (`DataTable` total)** — Fase 6; introduz ordenacao/paginacao e slot mobile.
- **Permissoes (`UserContext` + `usePermissions`)** — Fase 8; remove ~9 refetches de `/me`.

### MEDIO IMPACTO
- **View unica (`ViewPage` + `DrawerShell`)** — metricas ja padronizadas (Fase 7); falta consolidar tabelas read-only e drawer.
- **Configuracao unica** — `TabsShell` + `ConfirmDialog` em `/configuracoes`.
- **Dashboard unico** — `DashboardSection` (`StatCard` grid + atalhos) + icones via `lucide`.

### BAIXO IMPACTO
- **Export** — implementar XLSX (UI ja preve) e mover labels para `lib/utils`.
- **Navegacao** — breadcrumbs, `PAGE_TITLES` em i18n, icones inline → `lucide`.

### Transversais (apoiam multiplas fases)
| Item | Impacto | Fase |
|---|---|---|
| `IconRegistry`/wrapper `lucide` | MEDIO | 6/8 |
| `StatusBadge` consumindo `lib/utils` | MEDIO | 6 |
| `FeedbackBanner` + `useToast` | MEDIO | CRUD |
| `FilterInput`/`FilterSelect` | BAIXO | CRUD |
| Decode JWT unico | BAIXO | 8 |
| Validacao por-campo (`error` do `form-field`) | BAIXO | CRUD |

---

## Mapeamento Fase → Documento ai-core

| Fase / frente | Documento canonico |
|---|---|
| CRUD unico (`ResourcePage`) | `CRUD_STANDARD.md` |
| Fase 6 - Tabelas | `TABLE_STANDARD.md` |
| Formularios/modais | `FORM_STANDARD.md` |
| View unica | `VIEW_STANDARD.md` |
| Exportacao | `EXPORT_STANDARD.md` |
| Fase 8 - Permissoes/Navegacao | `PERMISSIONS_STANDARD.md` |
| Visao geral / estrutura | `README.md` |

---

## Ordem Recomendada de Execucao (restante)

1. **Fase 6 - Tabelas e Listagens** (proxima prioridade; ja desenhada).
2. Transversais habilitadores: `StatusBadge`, `IconRegistry`.
3. **Fase 8 - Permissoes e Navegacao** (`UserContext`/`usePermissions`).
4. **Fase CRUD - `ResourcePage`** (consolida tabelas + modais + permissoes).
5. View unica / Configuracao / Dashboard (medio impacto).
6. Export XLSX + cosmeticos de navegacao (baixo impacto).
7. **Fase 9 - Validacao Final**.

---

## Priorizacao por Modulo

| Prioridade | Modulos | Motivo |
|---|---|---|
| Alta | Super Admin, `/membros/visualizacao`, `/configuracoes` | Tabelas artesanais / paginacao quebrada / confirmacao e tabs inline |
| Alta | `DashboardLayout` + paginas com `/api/auth/me` | Permissoes sem abstracao (refetch espalhado) |
| Media | Agenda, Ministerios, Escalas, Membros | Ja usam parte do ODS; consolidar no `ResourcePage` |
| Media | `/minhas-escalas`, `/meu-perfil`, Dashboard | Componentes locais residuais; falta `DrawerShell`/`DashboardSection` |
| Baixa | Exportacoes, ComingSoon, Navegacao cosmetica | UX consistente; ganho estrutural/visual pontual |

---

## Fora de Escopo Inicial

- Alterar contratos de API.
- Alterar regras de negocio.
- Reescrever layouts globais.
- Criar novo design visual sem base no inventario.
- Trocar biblioteca de UI.
- Alterar autorizacao backend.
