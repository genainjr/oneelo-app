# Matriz de Conformidade com o OneElo Design System

Fonte:

- `ai-context/frontend/design-system-inventory.md`
- `ai-context/frontend/design-system-pattern-analysis.md`
- `ai-context/plans/ods-current-status.md`
- `ai-core/skills/oneelo-design-system/`
- Auditoria direta do codigo (`apps/web/src`), 2026-06-15, branch `refactor/ods-phase-7`.

Objetivo: comparar todas as telas atuais com o ODS e identificar nivel de conformidade, gaps e prioridades de refatoracao.

Legenda:

- `Alta`: ja segue majoritariamente o ODS.
- `Parcial`: usa parte dos padroes, mas mantem duplicacoes ou anti-padroes.
- `Baixa`: diverge do padrao escolhido.
- `N/A`: rota tecnica ou fora do escopo principal do ODS interno.

> Atualizacao 2026-06-15: revisada contra o codigo atual. Fases 2 (Feedback), 7 (Visualizacoes) e **6 (Tabelas e Listagens)** concluidas — CRUDs usam `ConfirmDialog` (nao `confirm()`/`alert()`); visualizacoes usam `StatCard` (nao `StatBox`); **`/admin` e `/membros/visualizacao` agora usam `DataTable`** (tabelas artesanais eliminadas); `StatusBadge` e `EntityCard` adotados. Ver `ods-phase-6-tables-report.md`.

---

## Matriz por Tela

| Tela / rota | Padrao ODS esperado | Conformidade | Principais conformidades | Gaps / ajustes futuros |
|---|---|---:|---|---|
| `/` landing | Form publico / marketing | Parcial | Formulario de lead claro | Conflito com redirect `/`; fora do shell interno; inputs/icones proprios; sem i18n |
| `/` redirect dashboard | Navegacao tecnica | N/A | Redireciona para `/dashboard` | Conflita conceitualmente com landing |
| `/login` | Auth form | Alta | Card central, e-mail/senha, loading, erro inline | Inputs manuais (nao `form-field`); duplicado com admin login |
| `/admin/login` | Auth form admin | Parcial | Mesmo padrao visual de login | Nao usa `AuthLayout`; duplica `/login`; sem i18n |
| `/admin` | CRUD Super Admin | Parcial | `DataTable` (Fase 6) com ordenacao + `hideOnMobile`, `StatusBadge`, modais (`ModalShell`/`ModalFooter`) | 3 modais inline duplicados; `useAdmin` sem padrao loading/error; sem exclusao |
| `/dashboard` | View KPI | Alta | Usa `StatCard`, view de metricas, atalhos | Icones SVG inline; busca `/api/auth/me` propria |
| `/membros` | CRUD tabular | Parcial alta | `PageHeader`, `DataTable`, `MembroModal`, hook, selecao em massa, `ConfirmDialog`, `FilterShell` | Campos de filtro manuais; status/cores locais; refetch `/me` |
| `/membros/visualizacao` | View read-only | Alta | `PageHeader`, `DataTable` + `renderMobileCard` (`EntityCard`), `StatusBadge`, ordenacao, `MemberProfileDrawer`, `FilterShell`, `StatCard` | Campos de filtro manuais; `MESES` duplicado |
| `/membros/exportacao` | Export standard | Alta | `ExportShell`, `useExport`, `downloadCsv` | `ALL_FIELDS`/`STATUS_LABEL` locais (labels duplicam `utils`) |
| `/ministerios` | CRUD em cards + modal complexo | Parcial | `PageHeader`, `EntityCard` + `StatusBadge` (Fase 6), `MembroSearchCombobox`, `ModalShell`+`TabsShell`, `ModalFooter`, `ConfirmDialog` | Form criar duplica editar; muita logica inline; icones inline; refetch `/me` |
| `/ministerios/exportacao` | Export standard | Alta | `ExportShell`, `useExport`, `downloadCsv` | Labels/mapeamento locais |
| `/ministerios/louvor` | ComingSoon | Alta | Usa `ComingSoon` | Icone/features inline |
| `/ministerios/infantil` | ComingSoon | Alta | Usa `ComingSoon` | Icone/features inline |
| `/ministerios/midia` | ComingSoon | Alta | Usa `ComingSoon` | Icone/features inline |
| `/escalas` | CRUD mestre-detalhe + grade | Parcial | `PageHeader`, hook, grade interativa, `ModalShell`+`ModalFooter`, `ConfirmDialog`, permissoes por contexto, `FilterShell` | `EscalaGrid`/`CellMemberSelect` locais (deveriam ser compartilhados); `STATUS_COLORS`/`CONFIRMACAO_COLORS`/`formatDayDate` duplicam `utils`; toast proprio (≠ banner); grade duplica read-only |
| `/escalas/visualizacao` | View read-only imprimivel | Alta | `PageHeader`, `EscalaReadonlyGrid`, `FilterShell`, `StatCard`, print | Campos de filtro manuais; `MESES` duplicado |
| `/escalas/exportacao` | Export standard | Alta | `ExportShell`, `useExport`, `downloadCsv` | Labels locais |
| `/agenda` | CRUD card/lista | Parcial alta | `PageHeader`, hook, `FilterShell`, `ModalShell`+`ModalFooter`, `ConfirmDialog`, `EntityCard`, `StatusBadge` (Fase 6) | Mapa de cores de status local; `toLocalDatetimeString` local; refetch `/me` |
| `/agenda/exportacao` | Export standard | Alta | `ExportShell`, `useExport`, `downloadCsv` | Labels locais |
| `/minhas-escalas` | View do membro | Parcial alta | `PageHeader`, `EmptyState`, `StatCard`, cards read-only, acao de confirmacao | Mutacao `api.patch` direta na pagina (sem hook); `renderItem` local |
| `/meu-perfil` | View perfil + form seguranca | Parcial alta | `PageHeader`, `EmptyState`, `InfoItem`, `PasswordField`, form de senha, cards de dados | Iniciais calculadas inline (existe `getInitials`); refetch `/me` |
| `/configuracoes` | CRUD tabular + auditoria | Parcial alta | `PageHeader`, `DataTable` (paginacao corrigida + ordenacao + `hideOnMobile`), `StatusBadge`, `UsuarioModal` | Tabs feitas a mao (nao `TabsShell`); modal de desativacao inline reimplementa `ConfirmDialog`; refetch `/me` |
| `/grupos` | ComingSoon | Alta | Usa `ComingSoon` | Icone/features inline |
| `/financeiro` | ComingSoon | Alta | Usa `ComingSoon` | Icone/features inline |
| `/integracoes` | ComingSoon | Alta | Usa `ComingSoon` | Icone/features inline |

---

## Resumo por Padrao ODS

| Padrao ODS | Telas conformes | Telas parciais / divergentes |
|---|---|---|
| `PageHeader` | Dashboard internas principais, CRUDs, views, exports | Landing, logins, admin seguem estruturas proprias justificaveis |
| `DataTable` (estendido na Fase 6: ordenacao + `renderMobileCard` + `hideOnMobile`) | `/membros`, `/configuracoes`, `/admin`, `/membros/visualizacao` | Matriz de Escalas permanece fora (excecao de dominio) |
| `StatusBadge` / `EntityCard` (Fase 6) | Admin, configuracoes, membros/visualizacao, agenda, ministerios | Cards de entidade restantes podem adotar `EntityCard` |
| Modal CRUD (`ModalShell`) | Admin, agenda, ministerios, escalas, tag, `MembroModal`, `UsuarioModal` | `MembroModal`/`UsuarioModal` nao usam `ModalFooter`; modal de desativacao em config nao usa `ModalShell` |
| Confirmacao (`ConfirmDialog`, Fase 2) | `/membros`, `/ministerios`, `/agenda`, `/escalas` | `/configuracoes` reimplementa confirmacao inline |
| Filtros (`FilterShell`/`useFilterState`, Fase 4) | `/membros`, `/agenda`, `/membros/visualizacao`, `/escalas/visualizacao`, `/escalas` | Campos internos ainda `<input>`/`<select>` manuais |
| Exportacao (`ExportShell`/`useExport`, Fase 3) | Todas as rotas `*/exportacao` | Labels/status locais repetidos; XLSX so como "em breve" |
| Metricas (`StatCard`, Fase 7) | Dashboard, `/membros/visualizacao`, `/escalas/visualizacao`, `/minhas-escalas` | Cards de entidade ainda artesanais |
| View read-only | `/escalas/visualizacao`, `/membros/visualizacao`, `/minhas-escalas`, `/meu-perfil` | Tabelas read-only e layouts ainda variam; falta `DrawerShell` |
| Tabs (`TabsShell`) | Modal de ministerio | `/configuracoes` faz tabs a mao |
| Detalhe (`InfoItem`, Fase 7) | `/meu-perfil`, `MemberProfileDrawer` | — |
| Permissoes visuais | Sidebar e acoes condicionadas por role | Busca de usuario e regras espalhadas por paginas (sem `UserContext`) |

---

## Aderencia Geral (pos Fases 0-7)

| Area | Aderencia ODS |
|---|---:|
| Exportacoes | ~100% |
| Filtros (container) | ~100% |
| Tabelas / Listagens | ~90% |
| Feedback / Confirmacao | ~85% |
| Formularios | ~50% |
| Modais | ~50% |
| CRUDs | ~20% |
| Navegacao | 0% |
| Permissoes | 0% (sem abstracao) |

**Estimativa global: ~62-65%.**

---

## Prioridade de Refatoracao

> ✅ Tabelas / Listagens — concluido na Fase 6 (`DataTable` adotado; tabelas artesanais eliminadas).

### Alta prioridade

- Permissoes (`UserContext` + `usePermissions`; eliminar refetch `/me` em ~9 paginas) — **proxima prioridade (Fase 8)**
- CRUDs (`/admin`, `/agenda`, `/ministerios`, `/escalas`, `/configuracoes` → contrato unico `ResourcePage`, reusando o `DataTable`)

Motivo: maior duplicacao estrutural restante (modais inline, regras de permissao espalhadas). As duas frentes se reforcam e destravam o `ResourcePage`.

### Media prioridade

- `/membros`, `/minhas-escalas`, `/meu-perfil` (consolidar componentes locais restantes)
- `/configuracoes` (migrar para `TabsShell` e `ConfirmDialog`)
- Dashboard / View unica (`DashboardSection`, `DrawerShell`)

Motivo: ja seguem boa parte do ODS, mas mantem componentes locais duplicaveis.

### Baixa prioridade

- Paginas `*/exportacao` (concluir XLSX; mover labels para `utils`)
- Paginas `ComingSoon`
- Navegacao cosmetica (breadcrumbs, `PAGE_TITLES` em i18n, icones inline → `lucide`)

Motivo: visualmente consistentes; precisam mais de consolidacao estrutural do que correcao de UX.

---

## Conclusao

O frontend ja consolidou quatro areas via ODS: Exportacao, Filtros (container), Feedback/Confirmacao (`ConfirmDialog`) e **Tabelas/Listagens** (`DataTable` + `StatusBadge`/`EntityCard`, Fase 6). As Fases 2, 6 e 7 eliminaram `confirm()`/`alert()`, tabelas artesanais e metricas locais (`StatBox`).

A principal lacuna restante e estrutural: CRUDs com 5 padroes distintos, modais com footer inconsistente, campos de filtro manuais e ausencia de abstracao de permissoes (refetch de `/api/auth/me` espalhado).

As refatoracoes devem priorizar Permissoes (Fase 8) + CRUD (`ResourcePage`), que reusam o `DataTable` ja pronto, antes de alterar a aparencia geral do produto.
