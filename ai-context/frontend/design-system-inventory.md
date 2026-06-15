# Inventario do Design System Atual do OneElo

Escopo auditado: `apps/web/src/app`, `apps/web/src/components/app`, `apps/web/src/hooks`, `apps/web/src/lib`, `apps/web/src/middleware.ts`, `apps/web/src/types`.

Objetivo: criar um inventario do Design System e dos padroes atuais do frontend do OneElo.

Observacao: este documento inventaria a implementacao atual (branch `refactor/ods-phase-7`). Ele nao propoe alteracoes obrigatorias.

Stack: Next.js 16 (App Router + route groups), React 19, Tailwind CSS v4, `next-intl` (pt-BR / pt-PT / en-US), `lucide-react`. Util `cn()` (clsx + tailwind-merge). Cliente HTTP em `lib/api.ts`. Nao existe diretorio `components/ui` (primitivos shadcn); todo o DS vive em `components/app` como "shells" reutilizaveis.

---

## 1. Paginas do Sistema

| Rota | Arquivo | Responsabilidade | Modulo | Possiveis duplicacoes |
|---|---|---|---|---|
| `/` | `apps/web/src/app/page.tsx` | Landing comercial (Navbar, Hero, Modulos, Beneficios, Planos, formulario de lead, Footer). | Publico / Marketing | Isolada do DS interno: icones SVG e inputs proprios; nao usa `form-field` nem `PageHeader`. Sem i18n (texto hardcoded). |
| `/` | `apps/web/src/app/(dashboard)/page.tsx` | `redirect('/dashboard')`. | Dashboard | Convive com a landing `/`; resolucao depende do route group. |
| `/login` | `apps/web/src/app/(auth)/login/page.tsx` | Login tenant; redireciona BASIC para `/minhas-escalas` e demais para `/dashboard`. | Autenticacao | Form/inputs glassmorphism e spinner SVG duplicados com `/admin/login`. |
| `/admin/login` | `apps/web/src/app/(admin)/admin/login/page.tsx` | Login de Super Admin. | Super Admin | Duplica estrutura do login tenant; sem i18n; replica o gradiente do `AuthLayout` inline. |
| `/admin` | `apps/web/src/app/(admin)/admin/page.tsx` | Gestao de tenants + criacao de usuario de tenant. | Super Admin | Tabela HTML e 3 modais inline; nao usa `DataTable`. |
| `/dashboard` | `apps/web/src/app/(dashboard)/dashboard/page.tsx` | KPIs do tenant via `StatCard` + atalhos rapidos. | Dashboard | Icones SVG inline; refetch de `/api/auth/me`. |
| `/membros` | `apps/web/src/app/(dashboard)/membros/page.tsx` | CRUD de membros: filtros, tabela, modal, bulk-tag, criar tag. (~616 linhas) | Membros | Filtros usam `<input>`/`<select>` manuais (nao `form-field`); banner de feedback/erro repetido; mapa de cores de status inline duplica `lib/utils`. |
| `/membros/visualizacao` | `apps/web/src/app/(dashboard)/membros/visualizacao/page.tsx` | Consulta read-only + `StatCard` + `MemberProfileDrawer`. | Membros / Visualizacao | Tabela HTML (desktop + lista mobile) duplica `DataTable`; array `MESES` duplicado com escalas/visualizacao; filtros `<select>` manuais. |
| `/membros/exportacao` | `apps/web/src/app/(dashboard)/membros/exportacao/page.tsx` | Exportacao CSV via `ExportShell` + `useExport`. | Membros / Exportacao | Padrao identico as outras 3 exportacoes. |
| `/ministerios` | `apps/web/src/app/(dashboard)/ministerios/page.tsx` | CRUD em cards + modal com tabs (info/membros/funcoes). (~730 linhas) | Ministerios | Form de criar duplica o de editar; RBAC e gestao de funcoes/roles inline; icones inline. |
| `/ministerios/exportacao` | `apps/web/src/app/(dashboard)/ministerios/exportacao/page.tsx` | Exportacao CSV de ministerios. | Ministerios / Exportacao | Padrao de exportacao repetido. |
| `/ministerios/louvor` | `apps/web/src/app/(dashboard)/ministerios/louvor/page.tsx` | Tela "em breve". | Ministerios / Futuro | `ComingSoon` (1 de 6). |
| `/ministerios/infantil` | `apps/web/src/app/(dashboard)/ministerios/infantil/page.tsx` | Tela "em breve". | Ministerios / Futuro | `ComingSoon`. |
| `/ministerios/midia` | `apps/web/src/app/(dashboard)/ministerios/midia/page.tsx` | Tela "em breve". | Ministerios / Futuro | `ComingSoon`. |
| `/escalas` | `apps/web/src/app/(dashboard)/escalas/page.tsx` | CRUD mestre-detalhe: grade mensal editavel, drag&drop de dias, status, modal criar, modal "IA em breve". (~999 linhas, maior arquivo) | Escalas | Sub-componentes locais `EscalaGrid`/`CellMemberSelect` (deveriam estar em `components/app`); `STATUS_COLORS`/`CONFIRMACAO_COLORS`/`formatDayDate` locais duplicam `lib/utils`; usa toast proprio (≠ banner das outras paginas). |
| `/escalas/visualizacao` | `apps/web/src/app/(dashboard)/escalas/visualizacao/page.tsx` | Read-only/printavel + `StatCard` + `EscalaReadonlyGrid`. | Escalas / Visualizacao | Array `MESES` duplicado; filtros `<select>` manuais. |
| `/escalas/exportacao` | `apps/web/src/app/(dashboard)/escalas/exportacao/page.tsx` | Exportacao CSV de escalas. | Escalas / Exportacao | Padrao de exportacao repetido. |
| `/minhas-escalas` | `apps/web/src/app/(dashboard)/minhas-escalas/page.tsx` | Portal do membro BASIC: confirma/recusa presenca; cards por periodo. | Portal do Membro | `renderItem` local; `api.patch` direto (nao usa `useEscalas`). |
| `/agenda` | `apps/web/src/app/(dashboard)/agenda/page.tsx` | CRUD de eventos: filtros, lista de cards, modal. (~435 linhas) | Agenda | Mapa `colors` de status inline duplica `STATUS_EVENTO_COLOR`; banner de feedback/erro repetido; `toLocalDatetimeString` local. |
| `/agenda/exportacao` | `apps/web/src/app/(dashboard)/agenda/exportacao/page.tsx` | Exportacao CSV de eventos. | Agenda / Exportacao | Padrao de exportacao repetido. |
| `/meu-perfil` | `apps/web/src/app/(dashboard)/meu-perfil/page.tsx` | Perfil + troca de senha + dados de membro vinculado. | Perfil | Iniciais do nome calculadas inline (existe `getInitials` em utils). Usa `InfoItem`/`PasswordField` compartilhados. |
| `/configuracoes` | `apps/web/src/app/(dashboard)/configuracoes/page.tsx` | Admin: usuarios + audit logs, 2 abas, 2 `DataTable`, `UsuarioModal`. (~397 linhas) | Configuracoes | Tabs feitas a mao (nao `TabsShell`); modal de desativacao inline reimplementa `ConfirmDialog`. |
| `/grupos` | `apps/web/src/app/(dashboard)/grupos/page.tsx` | Tela "em breve". | Futuro | `ComingSoon`. |
| `/financeiro` | `apps/web/src/app/(dashboard)/financeiro/page.tsx` | Tela "em breve". | Futuro | `ComingSoon`. |
| `/integracoes` | `apps/web/src/app/(dashboard)/integracoes/page.tsx` | Tela "em breve". | Futuro | `ComingSoon`. |

Rotas utilitarias: `app/locale/route.ts` (troca cookie `NEXT_LOCALE`), `middleware.ts` (auth + RBAC + deteccao de locale).

---

## 2. Tabelas Existentes

| Tabela | Arquivo | Responsabilidade | Modulo | Possiveis duplicacoes |
|---|---|---|---|---|
| `DataTable<T>` | `apps/web/src/components/app/data-table.tsx` | Tabela generica: colunas, selecao, paginacao, loading skeleton, empty state. | Compartilhado | Padrao oficial, mas usado so por membros e configuracoes. Nao tem variante mobile. |
| Tenants | `apps/web/src/app/(admin)/admin/page.tsx` | Lista tenants (plano/status/usuarios/acoes). | Super Admin | `<table>` manual; duplica `DataTable`. |
| Membros | `apps/web/src/app/(dashboard)/membros/page.tsx` | Colunas de membro via `DataTable`. | Membros | Usa `DataTable`; badges/cores de status inline. |
| Usuarios | `apps/web/src/app/(dashboard)/configuracoes/page.tsx` | Lista usuarios via `DataTable`. | Configuracoes | Usa `DataTable`; badges de role inline. |
| Auditoria | `apps/web/src/app/(dashboard)/configuracoes/page.tsx` | Lista logs via `DataTable`. | Configuracoes | Usa `DataTable`; badges de acao inline. |
| Visualizacao de membros | `apps/web/src/app/(dashboard)/membros/visualizacao/page.tsx` | Tabela read-only desktop + lista mobile. | Membros / Visualizacao | `<table>` manual; duplica `DataTable` e adiciona variante mobile inexistente nele. |
| Grade interativa de escala | `apps/web/src/app/(dashboard)/escalas/page.tsx` (`EscalaGrid`) | Matriz dias x funcoes com alocacao/remocao/drag&drop. | Escalas | Duplica layout de matriz com a grade read-only (helpers compartilhados via `escala-shared`, render nao). |
| Grade read-only de escala | `apps/web/src/components/app/escala-readonly-grid.tsx` | Matriz dias x funcoes sem edicao (desktop + cards mobile). | Escalas / Compartilhado | Duplica estrutura da grade interativa. |

Resumo: 5 implementacoes de tabela, so 1 generica. Consolidar admin + visualizacao no `DataTable` (com slot mobile) eliminaria 2 duplicacoes.

---

## 3. Formularios Existentes

Primitivos centralizados em `apps/web/src/components/app/form-field.tsx`: `InputField`, `SelectField`, `TextareaField`, `PasswordField` (todos via `FieldWrapper` interno, label uppercase, estado de erro). `MembroSearchCombobox` e o campo de busca a parte.

| Formulario | Arquivo | Responsabilidade | Modulo | Usa `form-field`? | Possiveis duplicacoes |
|---|---|---|---|---|---|
| Lead demo | `apps/web/src/app/page.tsx` | Nome/e-mail/telefone/mensagem → `/api/leads`. | Publico | Nao | Inputs reescritos do zero. |
| Login tenant | `apps/web/src/app/(auth)/login/page.tsx` | Auth e-mail/senha. | Autenticacao | Nao | Duplica admin login. |
| Login Super Admin | `apps/web/src/app/(admin)/admin/login/page.tsx` | Auth da plataforma. | Super Admin | Nao | Duplica login tenant. |
| Criar tenant | `apps/web/src/app/(admin)/admin/page.tsx` | Igreja + plano + idioma + contato + admin inicial. | Super Admin | Sim | Estrutura `form/set/handleSubmit` ≈ editar tenant / criar usuario. |
| Editar tenant | `apps/web/src/app/(admin)/admin/page.tsx` | Nome/plano/idioma/contato/ativo. | Super Admin | Sim | Duplica criar tenant. |
| Criar usuario do tenant | `apps/web/src/app/(admin)/admin/page.tsx` | Nome/e-mail/senha/role. | Super Admin | Sim | Similar a `UsuarioModal`, porem separado. |
| Criar/editar membro | `apps/web/src/components/app/membro-modal.tsx` | Nome, e-mail, WhatsApp, nascimento, status, observacoes. | Membros | Sim | Footer de botoes manual (nao usa `ModalFooter`). |
| Criar/editar usuario | `apps/web/src/components/app/usuario-modal.tsx` | Membro vinculado, nome, e-mail, senha, role, ativo. | Configuracoes | Sim | Footer manual (nao usa `ModalFooter`); ≈ criar usuario Super Admin. |
| Ministerio info | `apps/web/src/app/(dashboard)/ministerios/page.tsx` | Criar/editar nome, descricao, funcoes. | Ministerios | Sim | Form duplicado entre modo criar e editar. |
| Funcoes do ministerio | `apps/web/src/app/(dashboard)/ministerios/page.tsx` | Adicionar/remover funcoes. | Ministerios | Parcial | Input "nova funcao" repetido em 2 lugares na mesma pagina. |
| Adicionar membro ao ministerio | `apps/web/src/app/(dashboard)/ministerios/page.tsx` | Buscar membro + papel ministerial. | Ministerios | Combobox | Estrutura inline. |
| Criar escala | `apps/web/src/app/(dashboard)/escalas/page.tsx` | Mes, ano, ministerio, dias da semana, observacoes. | Escalas | Sim | — |
| Adicionar dia a escala | `apps/web/src/app/(dashboard)/escalas/page.tsx` | Data + titulo do dia. | Escalas | Nao | Inputs inline dentro de `EscalaGrid`. |
| Criar/editar evento | `apps/web/src/app/(dashboard)/agenda/page.tsx` | Titulo, inicio, fim, local, status, descricao. | Agenda | Sim | — |
| Criar tag | `apps/web/src/app/(dashboard)/membros/page.tsx` | Nome + cor. | Membros / Tags | Parcial | Input de cor manual. |
| Troca de senha | `apps/web/src/app/(dashboard)/meu-perfil/page.tsx` | Senha atual, nova, confirmacao. | Perfil | Sim (PasswordField) | — |
| Filtros (membros/agenda/visualizacoes) | varias paginas | Filtrar listagens. | Varios | Nao | Mesma string de classe de `<input>`/`<select>` repetida ~15x. |
| Exportacoes (4) | `*/exportacao/page.tsx` | Formato CSV + selecao de campos. | Exportacao | via `ExportShell` | Padrao reutilizado (bom). |

Maior duplicacao: campos de filtro nunca usam `form-field`; reescrevem `<input>`/`<select>` com a mesma classe. Um `FilterInput`/`FilterSelect` resolveria.

---

## 4. Modais Existentes

Base em `apps/web/src/components/app/modal-shell.tsx`: `ModalShell` (container), `ModalError` (faixa de erro), `ModalFooter` (rodape cancelar+salvar). `ModalShell` ainda aceita um slot `footer` legacy alem do `ModalFooter` novo — dois caminhos de rodape coexistem.

| Modal | Arquivo | Responsabilidade | Modulo | Usa `ModalFooter`? | Possiveis duplicacoes |
|---|---|---|---|---|---|
| `ConfirmDialog` | `apps/web/src/components/app/confirm-dialog.tsx` | Confirmacao danger/warning sobre `ModalShell`. | Compartilhado | Nao (slot `footer`) | Reimplementado inline em `configuracoes`. |
| `MembroModal` | `apps/web/src/components/app/membro-modal.tsx` | Criar/editar membro. | Membros | Nao | Botoes duplicam `ModalFooter`. |
| `UsuarioModal` | `apps/web/src/components/app/usuario-modal.tsx` | Criar/editar usuario. | Configuracoes | Nao | Botoes duplicam `ModalFooter`; ≈ modal de usuario do admin. |
| Criar tag | `apps/web/src/app/(dashboard)/membros/page.tsx` | Tag com nome/cor. | Membros | Sim | Modal pequeno inline. |
| Ministerio | `apps/web/src/app/(dashboard)/ministerios/page.tsx` | Criar/editar; tabs info/membros/funcoes. | Ministerios | Sim | Modal grande inline. |
| Escala (criar) | `apps/web/src/app/(dashboard)/escalas/page.tsx` | Criar escala mensal. | Escalas | Sim | — |
| Escala com IA | `apps/web/src/app/(dashboard)/escalas/page.tsx` | Aviso "em breve". | Escalas | Sim | Padrao "em breve" ≈ `ComingSoon`/`ChatbotButton`. |
| Evento | `apps/web/src/app/(dashboard)/agenda/page.tsx` | Criar/editar evento. | Agenda | Sim | — |
| Criar tenant | `apps/web/src/app/(admin)/admin/page.tsx` | Criar tenant + admin. | Super Admin | Sim | ≈ Editar tenant / Criar usuario. |
| Editar tenant | `apps/web/src/app/(admin)/admin/page.tsx` | Editar tenant. | Super Admin | Sim | Duplica criar tenant. |
| Criar usuario tenant | `apps/web/src/app/(admin)/admin/page.tsx` | Criar usuario do tenant. | Super Admin | Sim | Duplica criar tenant; ≈ `UsuarioModal`. |
| Desativar usuario | `apps/web/src/app/(dashboard)/configuracoes/page.tsx` | Confirmar desativacao. | Configuracoes | Nao usa `ModalShell` | Reimplementa `ConfirmDialog` do zero (overlay + card + botoes). |
| Chatbot popover | `apps/web/src/components/app/chatbot-button.tsx` | Painel flutuante "Assistente IA em breve". | App Shell | — | Overlay proprio; gradiente/badge "em breve" duplicado com `ComingSoon`. |

Duplicacoes-chave: `MembroModal`/`UsuarioModal` nao usam `ModalFooter` apesar de existir; `configuracoes` reimplementa `ConfirmDialog`; os 3 modais de admin compartilham a mesma estrutura.

---

## 5. Drawers Existentes

| Drawer | Arquivo | Responsabilidade | Modulo | Possiveis duplicacoes |
|---|---|---|---|---|
| `MemberProfileDrawer` | `apps/web/src/components/app/member-profile-drawer.tsx` | Perfil lateral read-only do membro (overlay + header sticky + secoes). | Membros / Visualizacao | Unico drawer "de conteudo". Nao ha `DrawerShell` generico; novos drawers reescreverao o padrao. Icone de fechar SVG inline (ModalShell usa `lucide` `X`). |
| Sidebar mobile | `apps/web/src/components/app/sidebar.tsx` | Menu lateral responsivo (translate-x + overlay). | App Shell | Comportamento de drawer implementado dentro da propria sidebar. |
| Submenu flutuante (sidebar colapsada) | `apps/web/src/components/app/sidebar.tsx` | Popover de itens filhos quando colapsada. | App Shell | Overlay/dropdown especifico, sem componente comum. |

---

## 6. Componentes Compartilhados (`components/app`)

| Componente | Arquivo | Responsabilidade | Modulo | Possiveis duplicacoes |
|---|---|---|---|---|
| `Sidebar` | `apps/web/src/components/app/sidebar.tsx` | Navegacao, RBAC visual, idioma, logout, estado colapsado. (~655 linhas) | App Shell | Todos os icones de nav sao SVG inline (objeto `ICONS`); badge "coming soon" repetido em 3 ramos de render. |
| `Header` | `apps/web/src/components/app/header.tsx` | Topbar + titulo por rota + hamburguer. | App Shell | `PAGE_TITLES` hardcoded, sem i18n, separado dos titulos das paginas. |
| `ChatbotButton` | `apps/web/src/components/app/chatbot-button.tsx` | FAB de IA "em breve". | App Shell | Gradiente/badge "em breve" duplicado com `ComingSoon`. |
| `PageHeader` | `apps/web/src/components/app/page-header.tsx` | Titulo/descricao/acao de pagina. | Layout / UI | Bem reutilizado; admin e landing nao usam. |
| `DataTable` | `apps/web/src/components/app/data-table.tsx` | Tabela generica (ver secao 2). | UI / Dados | Concorre com 2 tabelas HTML inline. |
| `EmptyState` | `apps/web/src/components/app/empty-state.tsx` | Estado vazio com icone default. | UI | Alguns vazios ainda sao inline. |
| `StatCard` | `apps/web/src/components/app/stat-card.tsx` | Card de metrica (cor, loading, href). | Dashboard / UI | Bem reutilizado (dashboard + 3 visualizacoes). |
| `ComingSoon` | `apps/web/src/components/app/coming-soon.tsx` | Pagina padrao de modulo futuro. | UI / Futuro | Usado por 6 paginas (bom); icones/features definidos inline em cada pagina. |
| `ModalShell` / `ModalError` / `ModalFooter` | `apps/web/src/components/app/modal-shell.tsx` | Shell de modal + erro + rodape. | UI | 2 caminhos de footer (legacy vs `ModalFooter`). |
| `ConfirmDialog` | `apps/web/src/components/app/confirm-dialog.tsx` | Confirmacao destrutiva. | UI | Reimplementado inline em `configuracoes`. |
| `form-field` (`Input/Select/Textarea/Password`) | `apps/web/src/components/app/form-field.tsx` | Inputs padronizados. | UI | Ignorado por filtros e telas de login. |
| `FilterShell` / `FilterActions` | `apps/web/src/components/app/filter-shell.tsx` | Container de filtros + botoes aplicar/limpar/recarregar. | UI | Paginas colocam `<input>`/`<select>` manuais dentro dele. |
| `TabsShell` / `TabPanel` | `apps/web/src/components/app/tabs-shell.tsx` | Abas reutilizaveis. | UI | `configuracoes` faz abas a mao. |
| `ExportShell` | `apps/web/src/components/app/export-shell.tsx` | UI completa de exportacao CSV. | UI / Exportacao | Bem reutilizado por 4 paginas. |
| `InfoItem` | `apps/web/src/components/app/info-item.tsx` | Item rotulo/valor (div ou dl). | UI | Bem reutilizado (perfil, drawer). |
| `MembroModal` | `apps/web/src/components/app/membro-modal.tsx` | Modal de membro. | Membros | Footer manual. |
| `UsuarioModal` | `apps/web/src/components/app/usuario-modal.tsx` | Modal de usuario. | Configuracoes | Footer manual; ≈ admin. |
| `MembroSearchCombobox` | `apps/web/src/components/app/membro-search-combobox.tsx` | Busca/selecao de membro. | Membros / Ministerios / Usuarios | Icones de busca/limpar SVG inline; poderia ser combobox generico. |
| `MemberProfileDrawer` | `apps/web/src/components/app/member-profile-drawer.tsx` | Drawer read-only de membro. | Membros | Padrao de drawer unico (ver secao 5). |
| `escala-shared` | `apps/web/src/components/app/escala-shared.tsx` | Helpers de escala + `MemberChip`. | Escalas | Bom exemplo de extracao; compartilhado entre os 2 grids. |
| `EscalaReadonlyGrid` | `apps/web/src/components/app/escala-readonly-grid.tsx` | Grade read-only de escala. | Escalas | Duplica matriz com `EscalaGrid` inline. |
| `FlagIcon` | `apps/web/src/components/app/locale-flags.tsx` | Bandeiras SVG (BR/PT/US). | i18n | SVGs inline; usado pela sidebar. |

Padroes ausentes que gerariam mais reuso: `IconRegistry`/wrapper de `lucide` (elimina centenas de SVGs inline), `FeedbackBanner`/`useToast` (unifica feedback inline vs toast), `StatusBadge` (consome `lib/utils`, elimina mapas de cor inline), `DrawerShell`.

---

## 7. Hooks Compartilhados (`hooks`)

| Hook | Arquivo | Responsabilidade | Modulo | Possiveis duplicacoes |
|---|---|---|---|---|
| `useMembros` | `apps/web/src/hooks/use-membros.ts` | Listar/filtrar/criar/atualizar/excluir + bulk-tag. | Membros | Esqueleto `state/loading/error/filter/applyFilter/refetch` repetido em 5 hooks. |
| `useMembrosVisualizacao` | `apps/web/src/hooks/use-membros-visualizacao.ts` | Listagem read-only filtrada. | Membros / Visualizacao | Duplica esqueleto de `useMembros`. |
| `useEscalas` | `apps/web/src/hooks/use-escalas.ts` | CRUD de escalas + dias + itens + confirmacao + celulas ocultas. | Escalas | Mesmo esqueleto de fetch/filter. |
| `useEscalasVisualizacao` | `apps/web/src/hooks/use-escalas-visualizacao.ts` | Listagem read-only filtrada de escalas. | Escalas / Visualizacao | Duplica esqueleto. |
| `useMinhasEscalas` | `apps/web/src/hooks/use-escalas-visualizacao.ts` | Escalas do membro logado. | Portal do Membro | Quase igual a `useEscalasVisualizacao`. |
| `useEventos` | `apps/web/src/hooks/use-eventos.ts` | CRUD de eventos. | Agenda | Mesmo esqueleto de fetch/filter. |
| `useMinisterios` | `apps/web/src/hooks/use-ministerios.ts` | CRUD de ministerios + membros + roles + funcoes. | Ministerios | Mesmo esqueleto (sem filtro); parte do detalhe fica na pagina. |
| `useDashboard` | `apps/web/src/hooks/use-dashboard.ts` | KPIs via `Promise.allSettled`. | Dashboard | Agregacao no frontend. |
| `useAdmin` | `apps/web/src/hooks/use-admin.ts` | Endpoints de tenant (sem estado). | Super Admin | Nao segue o esqueleto dos demais. |
| `useFilterState` | `apps/web/src/hooks/use-filter-state.ts` | Estado de form de filtro (`formState/setField/handleClear/handleSubmit`). | UI | Bom; paginas ainda chamam `applyFilter` manualmente alem dele. |
| `useExport` | `apps/web/src/hooks/use-export.ts` | Selecao de campos + download CSV. | Exportacao | Bem reutilizado. |
| `useDateFormatter` | `apps/web/src/hooks/use-date-formatter.ts` | `formatDate`/`formatDateTime` com locale i18n. | i18n / UI | Coexiste com `formatDate` "puro" de `lib/utils` chamado direto — duas formas de formatar data. |

Maior duplicacao: 5 hooks de listagem repetem `useState + useCallback(fetch) + useEffect + applyFilter + refetch`. Um `useResource<T>(endpoint)` generico cobriria todos.

---

## 8. Layouts Existentes

| Layout | Arquivo | Responsabilidade | Modulo | Possiveis duplicacoes |
|---|---|---|---|---|
| `RootLayout` | `apps/web/src/app/layout.tsx` | HTML/body, fonte Inter, provider `next-intl`, metadata. | Global | — |
| `AuthLayout` | `apps/web/src/app/(auth)/layout.tsx` | Centraliza telas auth em gradiente indigo→purple. | Autenticacao | Mesmo gradiente replicado inline em `admin/login` (que nao usa este layout). |
| `AdminLayout` | `apps/web/src/app/(admin)/layout.tsx` | Shell Super Admin: topbar + logout. | Super Admin | Header proprio (≠ `header.tsx`); login admin nao usa este layout. |
| `DashboardLayout` | `apps/web/src/app/(dashboard)/layout.tsx` | Shell autenticado: `Sidebar` + `Header` + `ChatbotButton` + fetch de `/api/auth/me`. | App Shell | Refetch de `/api/auth/me` aqui e em ~8 paginas filhas; nao ha `UserContext`. |

---

## 9. Variacoes de CRUD Existentes

5 padroes de CRUD distintos, sem modelo unico:

| # | Variacao | Arquivo(s) | Caracteristicas | Possiveis duplicacoes |
|---|---|---|---|---|
| 1 | Tabela + modal dedicado | `membros/page.tsx`, `use-membros.ts`, `membro-modal.tsx`, `ConfirmDialog` | `DataTable` + modal + confirmacao + bulk-tag. | Modelo mais limpo; deveria ser o padrao unico. |
| 2 | Cards + modal com tabs | `ministerios/page.tsx`, `use-ministerios.ts` | CRUD aninhado (membros/funcoes/roles) em tabs. | Form criar duplica editar; ~730 linhas. |
| 3 | Lista de cards + modal | `agenda/page.tsx`, `use-eventos.ts`, `ConfirmDialog` | Cards verticais + modal inline + confirmacao. | Cores de status inline duplicam utils. |
| 4 | Mestre-detalhe + grade editavel | `escalas/page.tsx`, `use-escalas.ts`, `ConfirmDialog` | Lista lateral + grade in-place (drag&drop, selects). Toast proprio. | Sub-componentes que deveriam ser compartilhados; cores duplicadas; toast ≠ banner. |
| 5 | Tabela + modais inline | `admin/page.tsx`, `use-admin.ts` | `<table>` manual + 3 modais no proprio arquivo; sem exclusao. | Nao usa `DataTable`; 3 modais quase identicos. |

Variacoes de leitura/escrita pontual:

| Variacao | Arquivo(s) | Modulo | Possiveis duplicacoes |
|---|---|---|---|
| Read-only com filtros + drawer | `membros/visualizacao/page.tsx` | Membros / Visualizacao | Duplica filtros/tabela de `/membros`. |
| Read-only com filtros + impressao | `escalas/visualizacao/page.tsx`, `escala-readonly-grid.tsx` | Escalas / Visualizacao | Duplica filtro de `/escalas`. |
| Confirmacao de presenca | `minhas-escalas/page.tsx`, `useMinhasEscalas` | Portal do Membro | `api.patch` direto na pagina (sem hook de mutacao). |
| Atualizacao do proprio usuario | `meu-perfil/page.tsx` | Perfil | Form reaproveitavel. |
| Exportacao CSV configuravel | `*/exportacao/page.tsx`, `useExport`, `lib/csv.ts` | Exportacao | 4 paginas quase iguais (bem fatoradas via `ExportShell`). |
| Criacao de lead publico | `app/page.tsx` | Publico | Padrao visual separado do DS interno. |

### Mecanismos transversais que divergem

| Mecanismo | Variacoes | Consolidacao sugerida |
|---|---|---|
| Feedback sucesso/erro | Banner inline (membros/ministerios/agenda/config) vs toast (escalas) | `useToast` + `FeedbackBanner` unicos |
| Confirmacao destrutiva | `ConfirmDialog` (membros/ministerios/agenda/escalas) vs modal inline (configuracoes) | Sempre `ConfirmDialog` |
| Rodape de modal | `ModalFooter` vs botoes manuais (`MembroModal`/`UsuarioModal`) | Sempre `ModalFooter` |
| Cores de status | `lib/utils` vs mapas inline (membros/agenda/escalas) | `StatusBadge` consumindo utils |
| Formatacao de data | `useDateFormatter` (i18n) vs `formatDate` direto | Padronizar no hook i18n |
| Usuario atual | `/api/auth/me` refetch por pagina | `UserContext` no `(dashboard)/layout` |
| Icones | `lucide-react` vs SVG inline (maioria) | `IconRegistry` / migrar para lucide |
| Decode JWT | `lib/auth.ts` (client) vs `middleware.ts` (`decodeJwtRole`) | Funcao unica compartilhada |

---

## Principais Duplicacoes Candidatas a Consolidacao

| # | Tema | Locais / Impacto |
|---|---|---|
| 1 | Icones SVG inline | Sidebar, dashboard, membros, agenda, escalas, drawers — `IconRegistry`/wrapper lucide remove centenas de SVGs. |
| 2 | Esqueleto de hook de listagem | `useMembros`, `useMembrosVisualizacao`, `useEscalas`, `useEscalasVisualizacao`, `useEventos` → `useResource<T>`. |
| 3 | Feedback | Banner inline vs toast (escalas) → `FeedbackBanner` + `useToast`. |
| 4 | Status labels/cores | `lib/utils` vs inline (membros/agenda/escalas, exportacoes) → `StatusBadge`. |
| 5 | Confirmacao destrutiva | `configuracoes` reimplementa `ConfirmDialog`. |
| 6 | Rodape de modal | `MembroModal`/`UsuarioModal` ignoram `ModalFooter`. |
| 7 | Filtros | Classe de `<input>`/`<select>` repetida ~15x → `FilterInput`/`FilterSelect`. |
| 8 | Usuario atual | Refetch de `/api/auth/me` em ~9 lugares → `UserContext`. |
| 9 | Tabelas customizadas | `admin` e `membros/visualizacao` vs `DataTable` (com slot mobile). |
| 10 | Telas de login | `/login` e `/admin/login` duplicadas; i18n inconsistente. |
| 11 | Grades de escala | `EscalaGrid` (inline) vs `EscalaReadonlyGrid` duplicam a matriz. |
| 12 | Exportacao CSV | 4 paginas iguais (ja fatoradas via `ExportShell`; baixa prioridade). |

### Observacoes de cobertura

- **i18n inconsistente:** dashboard/membros/ministerios/escalas/agenda usam `useTranslations`; visualizacoes, `meu-perfil`, `minhas-escalas`, admin e landing tem texto hardcoded em portugues.
- **`lucide-react` subutilizado:** instalado, mas a maioria dos icones e SVG inline.
- **Sem camada de primitivos (`components/ui`):** o DS e composto por "shells" em `components/app`; falta uma base de tokens/atoms.
