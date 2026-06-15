# Analise de Padroes do Design System Atual do OneElo

Fonte analisada: codigo de `apps/web/src` (auditoria direta) + `ai-context/frontend/design-system-inventory.md`.

Data: 2026-06-15 · Branch: `refactor/ods-phase-7`.

Objetivo: identificar quantos padroes de CRUD, tabela, formulario, filtro, acao, visualizacao, exportacao, navegacao e permissao existem no frontend atual; marcar o que ja foi padronizado pelo ODS e recomendar um padrao unico por area.

Observacao: documento analitico, somente-leitura. Nenhuma implementacao foi realizada.

---

## Estado do ODS (Fases concluidas)

As Fases 0-7 ja implantaram nucleos reutilizaveis. Cada secao abaixo marca o que e PADRAO ODS (implantado) vs FRAGMENTADO (legado).

| Fase | Entrega | Reflexo no codigo atual |
|---|---|---|
| 1 (Fundacoes) | `ModalShell`/`ModalError`/`ModalFooter`, `InputField`/`SelectField`/`TextareaField`/`PasswordField` | Modais e inputs base disponiveis. |
| 2 (Feedback) | `ConfirmDialog`; expurgo de `alert()`/`confirm()` | Membros, ministerios, agenda e escalas usam `ConfirmDialog`. |
| 3 (Exportacoes) | `ExportShell` + `useExport` + `lib/csv` | 4 paginas `*/exportacao` identicas. |
| 4 (Filtros) | `FilterShell` + `FilterActions` + `useFilterState` | 5 paginas com filtros padronizados. |
| 7 (Visualizacoes/Metricas) | `StatCard` padronizado, `InfoItem` extraido | Metricas unificadas; drawers e perfil consolidados. |

> Correcao de docs anteriores: versoes passadas citavam `confirm()`/`alert()` nos CRUDs e um `StatBox` local nas visualizacoes. Isso esta desatualizado. A auditoria do codigo atual confirma `ConfirmDialog` (Fase 2) e `StatCard` (Fase 7) em uso. Este documento reflete o codigo atual.

### Aderencia ODS por area

| Area | Aderencia | Padrao unico existe? |
|---|---:|---|
| Exportacoes | ~100% | Sim (`ExportShell`/`useExport`) |
| Filtros (container) | ~100% | Sim (`FilterShell`/`useFilterState`) |
| Feedback / Confirmacao | ~85% | Sim (`ConfirmDialog`; 1 excecao inline) |
| Formularios | ~50% | Parcial (`form-field`; filtros/login ignoram) |
| Modais | ~50% | Parcial (`ModalShell`; footer inconsistente) |
| Tabelas / Listagens | ~20% | Nao (`DataTable` subutilizado) |
| CRUDs | ~20% | Nao (5 padroes distintos) |
| Navegacao | 0% | Nao (sem breadcrumb, icones inline) |
| Permissoes | 0% (sem abstracao) | Nao (regras espalhadas, refetch `/me`) |

---

## Resumo Quantitativo

| Categoria | Padroes identificados | Padrao ODS unico? |
|---|---:|---|
| Padroes de CRUD | 5 | Nao |
| Padroes de tabela | 5 impl. (1 generica) | Parcial |
| Padroes de formulario | 8 | Parcial |
| Padroes de filtro | 4 | Sim (container) |
| Padroes de acao | 9 | Parcial |
| Padroes de visualizacao | 6 | Parcial |
| Padroes de exportacao | 1 | Sim |
| Padroes de confirmacao | 2 | Sim (1 excecao) |

---

## 1. Padroes de CRUD

### Total: 5 padroes

| # | Padrao | Onde | Listagem | Adicao | Edicao | Exclusao |
|---|---|---|---|---|---|---|
| 1 | Tabela + modal dedicado | `membros/page.tsx` (`MembroModal`) | `DataTable` | `MembroModal` | mesmo modal (`editingMembro`) | `ConfirmDialog` |
| 2 | Cards + modal com tabs | `ministerios/page.tsx` | grid de cards | `ModalShell` | `ModalShell` + `TabsShell` | `ConfirmDialog` (warning=arquivar) |
| 3 | Lista de cards + modal | `agenda/page.tsx` | lista de cards | `ModalShell` inline | mesmo modal (`selectedEvento`) | `ConfirmDialog` |
| 4 | Mestre-detalhe + grade editavel | `escalas/page.tsx` | lista lateral + `EscalaGrid` | `ModalShell` | edicao in-place (status/dias/membros/drag&drop) | `ConfirmDialog` |
| 5 | Tabela + modais inline | `admin/page.tsx` | `<table>` manual | 3 modais inline | modais inline | sem exclusao |
| (config) | Tabela + modal compartilhado | `configuracoes/page.tsx` (`UsuarioModal`) | `DataTable` | `UsuarioModal` | `UsuarioModal` | modal inline proprio (nao `ConfirmDialog`) |

Por operacao:
- Listagem: 4 estilos (tabela generica, tabela artesanal, cards/grid, mestre-detalhe matricial).
- Adicao: 2 estilos (modal dedicado em `components/app` vs modal inline na pagina). Footer ora usa `ModalFooter`, ora botoes manuais (`MembroModal`/`UsuarioModal`).
- Edicao: 3 estilos (mesmo modal com `editing*`; in-place na grade de escalas; sub-recursos inline em ministerios).
- Exclusao: `ConfirmDialog` (padrao) em 4 modulos; modal inline em configuracoes; sem exclusao em admin.

---

## 2. Padroes de Tabela

### Total: 5 implementacoes (1 generica + 4 artesanais)

| Tabela | Arquivo | Tipo | Filtros | Paginacao | Ordenacao |
|---|---|---|---|---|---|
| `DataTable<T>` | `components/app/data-table.tsx` | generica | externos | client-side | nenhuma |
| Membros | `membros/page.tsx` | usa `DataTable` | `FilterShell` | client (`itemsPerPage=10`) | nenhuma |
| Usuarios/Auditoria | `configuracoes/page.tsx` | usa `DataTable` | sem filtro | `itemsPerPage=15` sem `onPageChange` (sem efeito) | nenhuma |
| Tenants | `admin/page.tsx` | `<table>` manual | sem filtro | nenhuma | nenhuma |
| Visualizacao membros | `membros/visualizacao/page.tsx` | `<table>` + lista mobile | `FilterShell` (5 campos) | nenhuma | nenhuma |
| Grade escala editavel | `escalas/page.tsx` (`EscalaGrid`) | matriz dias x funcoes | toolbar (mes/ano/ministerio) | nenhuma | dias por `ordem`/data |
| Grade escala read-only | `escala-readonly-grid.tsx` | matriz dias x funcoes | — | nenhuma | dias e membros por nome |

Variacoes: tabular generica (2), tabular artesanal (2), matricial (2, compartilham helpers via `escala-shared` mas duplicam render).

Filtros: padrao ODS `FilterShell`+`FilterActions`+`useFilterState` (membros, agenda, membros/visualizacao, escalas/visualizacao). Os campos internos ainda sao `<input>`/`<select>` manuais (nao `form-field`); mesma classe repetida ~15x. Variantes: card com submit, toolbar compacta, chips/tags AND-OR, filtro + metricas.

Paginacao: so o `DataTable` pagina (client-side, slice), efetiva apenas em membros. Configuracoes nao conecta `onPageChange`. Cards/visualizacoes/grades nao paginam. Sem paginacao server-side.

Ordenacao: nenhuma tabela tem ordenacao por coluna. Ha ordenacoes fixas implicitas (dias por ordem/data; membros por nome).

---

## 3. Padroes de Formulario

### Total: 8 padroes

| Padrao | Onde | Usa `form-field`? |
|---|---|---|
| Auth (e-mail/senha, card) | `/login`, `/admin/login` | Nao |
| Publico/comercial (lead) | `app/page.tsx` | Nao |
| CRUD modal simples | `MembroModal`, `UsuarioModal`, agenda, escala (criar) | Sim |
| CRUD modal composto (tabs/secoes) | ministerios, admin | Sim |
| Sub-recurso inline | ministerios (funcoes/membros), escalas (dia) | Parcial |
| Seguranca/perfil | `meu-perfil` | Sim (`PasswordField`) |
| Exportacao | `*/exportacao` | via `ExportShell` |
| Tag/cor | `membros` | Parcial |
| (filtros) | todas as listagens | Nao (manuais) |

Layouts: card centralizado (auth/lead); modal `ModalShell` com corpo `space-y-4 p-6` + `ModalFooter`; modal com `TabsShell` (ministerio); secoes com `<section>`/`InfoItem` (perfil); grid `sm:grid-cols-2` para pares de campos.

Validacoes: client-side manual em cada `handleSubmit` (`trim`, `length<6`, confirmacao de senha, `required`). Sem biblioteca (zod/react-hook-form). Erros de API via `HttpError` exibidos em `ModalError`/banner. O `form-field` tem prop `error` por-campo, mas quase nenhum form a usa (erros agregados no topo).

Organizacao dos campos: label uppercase pequena (`FieldWrapper`), input `bg-gray-50` -> `bg-white` no focus, borda `rounded-xl`, obrigatoriedade com `*`. Campos relacionados em grid de 2 colunas; formularios longos usam separadores `border-t`. Sem steps/wizard.

---

## 4. Padroes de Filtro

### Total: 4 padroes

| Padrao | Onde | Caracteristica |
|---|---|---|
| Filtro em card com submit | `membros`, `agenda` | bloco branco + Aplicar/Limpar (`FilterShell`/`FilterActions`) |
| Filtro compacto em toolbar | `escalas` | filtros horizontais mes/ano/ministerio dentro de `FilterShell` |
| Filtro de visualizacao + metricas | `membros/visualizacao`, `escalas/visualizacao` | filtros combinados com `StatCard`/resumo |
| Filtro por chips/tags | `membros` | selecao por tags com operador AND/OR |

Padrao ODS: container e estado padronizados (`FilterShell` + `useFilterState`). Pendente: campos internos ainda manuais (sem `FilterInput`/`FilterSelect`).

---

## 5. Padroes de Acao

### Total: 9 padroes

| Padrao | Onde | Caracteristica |
|---|---|---|
| Acao primaria no `PageHeader` | membros, ministerios, agenda, escalas | botao de criacao/comando |
| Acao de linha/tabela | membros, configuracoes, admin | editar/excluir/desativar por registro |
| Acao de card/lista | ministerios, agenda, escalas | botoes em cards/listas |
| Acao modal footer | modais de membro, usuario, evento, tenant, escala | `ModalFooter` (parcial) ou botoes manuais |
| Acao destrutiva via `ConfirmDialog` | membros, ministerios, agenda, escalas | confirmacao ODS (Fase 2) |
| Acao destrutiva custom modal | `configuracoes` | modal proprio (reimplementa `ConfirmDialog`) |
| Acao em massa | `membros` | banner fixo inferior para tags em selecionados |
| Acao contextual em grade | `escalas` | add/remover membro, ocultar celula, remover/reordenar dia |
| Acao de exportacao/download | `*/exportacao` | exportar CSV apos selecao de campos |

Observacao: confirmacao ja unificada em `ConfirmDialog`, exceto o modal inline de configuracoes. O footer de modal ainda diverge (`ModalFooter` vs botoes manuais em `MembroModal`/`UsuarioModal`).

---

## 6. Padroes de Visualizacao

### Total: 6 padroes

| Padrao | Onde | Cards | Tabs | Secoes |
|---|---|---|---|---|
| Dashboard KPI | `dashboard` | `StatCard` x5 + atalhos | nao | grid + bloco de atalhos |
| Listagem tabular | membros, configuracoes | nao | config (tabs a mao) | tabela |
| Listagem em cards | ministerios, agenda, minhas-escalas | sim | nao | grupos por periodo |
| Read-only + drawer | `membros/visualizacao` | `StatCard` x4 | nao | tabela + `MemberProfileDrawer` |
| Read-only imprimivel | `escalas/visualizacao` | `StatCard` x3 | nao | secoes + `EscalaReadonlyGrid` |
| Perfil/detalhe | `meu-perfil` | `InfoItem` | nao | `<section>` (dados/seguranca/membro) |

Cards: metricas padronizadas em `StatCard` (Fase 7, sem mais `StatBox` local); cards de entidade ainda artesanais por modulo; `InfoItem` para pares rotulo/valor.
Tabs: `TabsShell`/`TabPanel` so no modal de ministerio; configuracoes faz tabs a mao.
Secoes: padrao `<section className="rounded-2xl border ...">` com `<h2>/<h3>` em perfil, drawer e escalas/visualizacao.

---

## 7. Padroes de Exportacao

### Total: 1 padrao (padrao ODS, Fase 3)

4 paginas identicas: `membros/exportacao`, `ministerios/exportacao`, `escalas/exportacao`, `agenda/exportacao`.

Fluxo: hook de listagem -> `useExport(ALL_FIELDS, data, prefix, rowMapper)` -> `ExportShell` (formato, selecao de campos, resumo, botao) -> `downloadCsv` (`lib/csv.ts`, BOM UTF-8, escape de aspas, CRLF).

Formatos: CSV (unico funcional); XLSX presente na UI como "em breve" (desabilitado); sem PDF/JSON. Residuo: `ALL_FIELDS`/`STATUS_LABEL`/`rowMapper` locais por pagina (labels duplicam `lib/utils`).

---

## 8. Padroes de Navegacao

Menus: `Sidebar` (colapsavel, secoes expansiveis com filhos, badges "em breve", troca de idioma, perfil+logout) montada por role (`navItems` ADMIN/STAFF vs `basicNavItems`); icones de nav SVG inline. `Header` com titulo por rota (`PAGE_TITLES` hardcoded, sem i18n) + hamburguer. Admin tem header proprio.

Breadcrumbs: nao existem. Hierarquia so aparece como secoes na sidebar.

Fluxos: login redireciona por role (BASIC->`/minhas-escalas`, ADMIN/STAFF->`/dashboard`, SUPER_ADMIN->`/admin`). `middleware.ts` decodifica JWT e guarda rotas (nao autenticado->`/login?redirect=`; SUPER_ADMIN preso em `/admin`; BASIC bloqueado de rotas administrativas). `StatCard` com `href` e atalhos do dashboard. Redundancia: landing `/` vs `redirect('/dashboard')`.

---

## 9. Padroes de Permissao

Roles: `SUPER_ADMIN`, `ADMIN`, `STAFF` (Colaborador), `BASIC` (Membro). JWT decodificado em dois lugares: `lib/auth.ts` (client) e `middleware.ts` (`decodeJwtRole`).

- Admin (ADMIN): shell completo; `canManage = ADMIN || STAFF` em membros/ministerios/agenda/escalas; exclusivo de `/configuracoes` (usuarios + auditoria); ve item `adminOnly` na sidebar.
- Colaborador (STAFF): mesmo `canManage` operacional; sem `/configuracoes`; sidebar igual exceto itens `adminOnly`.
- Membro (BASIC): middleware bloqueia `/dashboard`, `/membros`, `/configuracoes`, `/financeiro`, `/grupos`, `/integracoes` -> `/minhas-escalas`; sidebar reduzida (Minhas Escalas, Agenda, Meu Perfil); liderança condicional (`basicHasLeadership`) libera Ministerios/Escalas apenas do que lidera; nao atribui role `LEADER`; confirma/recusa presenca.
- Super Admin: forcado para `/admin`; gerencia tenants e usuarios de tenant.

Gaps: sem `UserContext`/`usePermissions` (`/api/auth/me` refeito em ~9 paginas); cada pagina reimplementa `canManage`; rotas bloqueadas para BASIC hardcoded no middleware e duplicadas na sidebar.

---

## Agrupamento por Similaridade

| Grupo | Componentes / Paginas | Similaridade |
|---|---|---|
| A. Estrutura de pagina | `PageHeader`, CRUDs, views, exports; `ComingSoon`; shell (`DashboardLayout`/`Sidebar`/`Header`/`ChatbotButton`); `AuthLayout` | cabecalho/placeholder/shell/auth |
| B. Dados tabulares | `DataTable` (membros, usuarios, auditoria); tenants (manual); visualizacao membros (manual); escala matricial | tabela de entidade / matriz |
| C. CRUD modal | `MembroModal`, `UsuarioModal` (simples); evento, escala, admin (inline); ministerio (tabs) | shell de modal repetido |
| D. Busca/filtro/selecao | filtros (`FilterShell`); toolbar escalas; tags membros; `MembroSearchCombobox` | aplicar/limpar/recarregar |
| E. Feedback e estados | `EmptyState`; skeletons inline; banners inline; `ConfirmDialog`; modal inline de config | estados e confirmacao |
| F. Metricas e resumos | `StatCard` (dashboard e todas as visualizacoes) | metrica unificada (Fase 7) |
| G. Exportacao | `*/exportacao` + `useExport` + `downloadCsv` | selecao de campos + CSV |

---

## Recomendacoes — Padrao Unico por Area (classificado por impacto)

### ALTO IMPACTO

1. CRUD unico — `ResourcePage`: `PageHeader` (acao primaria) + `FilterShell`/`useFilterState` + `DataTable<T>` (acoes de linha + variante mobile) + modal unico `ModalShell`/`ModalFooter` + `ConfirmDialog` + hook generico `useResource<T>(endpoint)`. Migrar admin, agenda, ministerios, configuracoes e membros. Resolve a maior fragmentacao (CRUD/Tabelas ~20%) e os 5 hooks de listagem repetidos.
2. Tabela unica — adocao total do `DataTable`: migrar tabelas artesanais (admin, membros/visualizacao) com slot mobile e ordenacao por coluna (inexistente hoje); corrigir paginacao de configuracoes; avaliar server-side. Desbloqueia o CRUD unico.
3. Permissoes — `UserContext` + `usePermissions`: provider no `(dashboard)/layout` carrega `/me` uma vez; expoe `canManage`, `isAdmin`, `leads(ministerioId)`; centraliza a lista de rotas BASIC. Remove ~9 refetches e regras espalhadas.

### MEDIO IMPACTO

4. View unica — `ViewPage`: `PageHeader` + linha de `StatCard` + `FilterShell` + corpo (`DataTable` read-only ou grade) + `Drawer`. Criar `DrawerShell` generico. Metricas ja padronizadas (Fase 7).
5. Configuracao unica: migrar `configuracoes` para `TabsShell` e trocar o modal de desativacao inline por `ConfirmDialog`; encaixar no CRUD unico. Remove a ultima reimplementacao de `ConfirmDialog` e de tabs.
6. Dashboard unico: formalizar `StatCard` (grid) + atalhos como `DashboardSection`; substituir SVGs inline por `lucide`/`IconRegistry`.

### BAIXO IMPACTO

7. Export unico — concluir o existente: implementar XLSX (UI ja preve) e mover labels de status para `lib/utils`. Padrao ja consolidado (~100%).
8. Navegacao — cosmeticos: breadcrumbs onde houver hierarquia; `PAGE_TITLES` -> i18n; icones inline da sidebar -> `lucide`.

### Transversais

| Item | Impacto | Observacao |
|---|---|---|
| `IconRegistry`/wrapper `lucide` | MEDIO | remove centenas de SVGs inline |
| `StatusBadge` consumindo `lib/utils` | MEDIO | elimina mapas de cor inline (membros/agenda/escalas/exports) |
| `FeedbackBanner` + `useToast` | MEDIO | unifica banner inline vs toast (escalas) |
| `FilterInput`/`FilterSelect` | BAIXO | faz filtros usarem `form-field` |
| Decode JWT unico | BAIXO | unifica `lib/auth.ts` e `middleware.ts` |
| Validacao por-campo (`error` do `form-field`) | BAIXO | padronizar prop ja existente |

---

## Conclusao

O ODS ja consolidou tres areas: Exportacao, Filtros (container) e Feedback/Confirmacao. As frentes abertas de maior impacto sao CRUD, Tabelas e Permissoes, que se reforcam mutuamente: um `ResourcePage` apoiado em `DataTable` completo e `usePermissions` resolveria as tres simultaneamente. A fragmentacao restante esta concentrada em: shell/footer de modal, campos de filtro, tabelas artesanais, navegacao (icones inline, sem breadcrumb) e ausencia de abstracao de permissoes.
