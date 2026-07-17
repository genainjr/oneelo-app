# Inventario do Design System Atual do OneElo

Escopo auditado: `apps/web/src/app`, `apps/web/src/components/app`, `apps/web/src/hooks`, `apps/web/src/lib`, `apps/web/src/types`.

Objetivo: criar um inventario do Design System e dos padroes atuais do frontend do OneElo.

Observacao: este documento inventaria a implementacao atual. Ele nao propoe alteracoes obrigatorias.

---

## 1. Paginas do Sistema

| Rota | Arquivo | Responsabilidade | Modulo | Possiveis duplicacoes |
|---|---|---|---|---|
| `/` | `apps/web/src/app/page.tsx` | Landing page comercial com hero, modulos, beneficios, planos e formulario de lead. | Publico / Marketing | Conflita conceitualmente com `apps/web/src/app/(dashboard)/page.tsx`, que tambem resolve para `/` no App Router. |
| `/` | `apps/web/src/app/(dashboard)/page.tsx` | Redirect para `/dashboard`. | Dashboard | Possivel conflito de rota com landing page `/`. |
| `/login` | `apps/web/src/app/(auth)/login/page.tsx` | Login tenant, redirecionando BASIC para `/minhas-escalas` e demais para `/dashboard`. | Autenticacao | Estrutura visual/form duplicada com `/admin/login`. |
| `/admin/login` | `apps/web/src/app/(admin)/admin/login/page.tsx` | Login de Super Admin. | Super Admin | Duplica layout e campos do login tenant. |
| `/admin` | `apps/web/src/app/(admin)/admin/page.tsx` | Gestao de tenants e criacao de usuarios por tenant. | Super Admin | Tabela e modal proprios em vez de `DataTable`/modal compartilhado. |
| `/dashboard` | `apps/web/src/app/(dashboard)/dashboard/page.tsx` | KPIs operacionais do tenant. | Dashboard | Usa `StatCard`; stats locais tambem aparecem em visualizacoes com componentes proprios. |
| `/membros` | `apps/web/src/app/(dashboard)/membros/page.tsx` | CRUD de membros, filtros, tags, selecao em massa e paginacao. | Membros | Usa `DataTable`, mas filtro/tag modal seguem padrao proprio; labels/status duplicam `utils`. |
| `/membros/visualizacao` | `apps/web/src/app/(dashboard)/membros/visualizacao/page.tsx` | Consulta read-only de membros com filtros, estatisticas e drawer de perfil. | Membros / Visualizacao | Tabela HTML propria duplica `DataTable`; `StatBox` local duplica `StatCard`. |
| `/membros/exportacao` | `apps/web/src/app/(dashboard)/membros/exportacao/page.tsx` | Exportacao CSV de membros com selecao de campos. | Membros / Exportacao | Quase identica as exportacoes de escalas, ministerios e agenda. |
| `/ministerios` | `apps/web/src/app/(dashboard)/ministerios/page.tsx` | Gestao de ministerios, membros, papeis e funcoes. | Ministerios | Modal/tab/form proprio; `MembroSearchCombobox` reutilizado; cards substituem tabela. |
| `/ministerios/exportacao` | `apps/web/src/app/(dashboard)/ministerios/exportacao/page.tsx` | Exportacao CSV de ministerios. | Ministerios / Exportacao | Duplica layout e logica das demais exportacoes. |
| `/ministerios/louvor` | `apps/web/src/app/(dashboard)/ministerios/louvor/page.tsx` | Tela "em breve" para modulo de louvor. | Ministerios / Futuro | Usa `ComingSoon`; icones inline duplicados. |
| `/ministerios/infantil` | `apps/web/src/app/(dashboard)/ministerios/infantil/page.tsx` | Tela "em breve" para modulo infantil. | Ministerios / Futuro | Mesmo padrao de `ComingSoon`. |
| `/ministerios/midia` | `apps/web/src/app/(dashboard)/ministerios/midia/page.tsx` | Tela "em breve" para modulo de midia. | Ministerios / Futuro | Mesmo padrao de `ComingSoon`. |
| `/escalas` | `apps/web/src/app/(dashboard)/escalas/page.tsx` | Gestao de escalas, grade interativa, dias, membros, status e publicacao. | Escalas | `EscalaGrid` local duplica parcialmente `EscalaReadonlyGrid`. |
| `/escalas/visualizacao` | `apps/web/src/app/(dashboard)/escalas/visualizacao/page.tsx` | Visualizacao read-only/printavel de escalas. | Escalas / Visualizacao | Form de filtros duplica outros filtros; grade usa componente compartilhado. |
| `/escalas/exportacao` | `apps/web/src/app/(dashboard)/escalas/exportacao/page.tsx` | Exportacao CSV de escalas. | Escalas / Exportacao | Duplica paginas de exportacao. |
| `/agenda` | `apps/web/src/app/(dashboard)/agenda/page.tsx` | CRUD de eventos com filtros por status/data. | Agenda | Modal CRUD proprio; filtros similares aos demais modulos. |
| `/agenda/exportacao` | `apps/web/src/app/(dashboard)/agenda/exportacao/page.tsx` | Exportacao CSV de eventos. | Agenda / Exportacao | Duplica exportacoes. |
| `/minhas-escalas` | `apps/web/src/app/(dashboard)/minhas-escalas/page.tsx` | Area do membro para consultar escalas e confirmar/recusar presenca. | Portal do Membro | Cards e stats locais duplicam padroes de visualizacao. |
| `/meu-perfil` | `apps/web/src/app/(dashboard)/meu-perfil/page.tsx` | Consulta de perfil, membro vinculado e troca de senha. | Perfil | `Info` e `PasswordField` locais poderiam virar componentes compartilhados. |
| `/configuracoes` | `apps/web/src/app/(dashboard)/configuracoes/page.tsx` | Gestao de usuarios e auditoria. | Configuracoes | Usa `DataTable` e `UsuarioModal`; modal de desativacao proprio. |
| `/grupos` | `apps/web/src/app/(dashboard)/grupos/page.tsx` | Tela "em breve" para grupos. | Futuro | Mesmo padrao `ComingSoon`. |
| `/financeiro` | `apps/web/src/app/(dashboard)/financeiro/page.tsx` | Tela "em breve" financeiro/patrimonial. | Futuro | Mesmo padrao `ComingSoon`. |
| `/integracoes` | `apps/web/src/app/(dashboard)/integracoes/page.tsx` | Tela "em breve" integracoes. | Futuro | Mesmo padrao `ComingSoon`. |

---

## 2. Tabelas Existentes

| Tabela | Arquivo | Responsabilidade | Modulo | Possiveis duplicacoes |
|---|---|---|---|---|
| `DataTable<T>` | `apps/web/src/components/app/data-table.tsx` | Tabela generica com loading, empty state, selecao e paginacao. | Compartilhado | Nao e usada por tabelas HTML customizadas. |
| Tenants | `apps/web/src/app/(admin)/admin/page.tsx` | Lista tenants com plano, status, usuarios e acoes. | Super Admin | Poderia usar `DataTable`. |
| Membros | `apps/web/src/app/(dashboard)/membros/page.tsx` | Lista membros com contato, status, tags, datas e acoes. | Membros | Usa `DataTable`; renderizacao de badges/status duplicada. |
| Usuarios | `apps/web/src/app/(dashboard)/configuracoes/page.tsx` | Lista usuarios, roles, vinculo com membro, status e acoes. | Configuracoes | Usa `DataTable`; badges duplicam `utils`. |
| Auditoria | `apps/web/src/app/(dashboard)/configuracoes/page.tsx` | Lista logs com data, operador, acao, entidade e IP. | Configuracoes | Usa `DataTable`; badges de acao locais. |
| Visualizacao de membros | `apps/web/src/app/(dashboard)/membros/visualizacao/page.tsx` | Tabela read-only de membros, ministerios e contato. | Membros / Visualizacao | Duplica `DataTable` e parte das colunas de `/membros`. |
| Grade interativa de escala | `apps/web/src/app/(dashboard)/escalas/page.tsx` | Matriz dias x funcoes com alocacao/remocao de membros. | Escalas | Duplica logica de ordenacao/grade da read-only. |
| Grade read-only de escala | `apps/web/src/components/app/escala-readonly-grid.tsx` | Matriz dias x funcoes sem controles de edicao. | Escalas / Compartilhado | Duplica parte da estrutura da grade interativa. |

---

## 3. Formularios Existentes

| Formulario | Arquivo | Responsabilidade | Modulo | Possiveis duplicacoes |
|---|---|---|---|---|
| Lead demo | `apps/web/src/app/page.tsx` | Enviar nome, e-mail, telefone e mensagem para `/api/leads`. | Publico | Padrao visual isolado da UI interna. |
| Login tenant | `apps/web/src/app/(auth)/login/page.tsx` | Autenticacao por e-mail/senha, telefone/senha e Google. | Autenticacao | Duplica admin login. |
| Login Super Admin | `apps/web/src/app/(admin)/admin/login/page.tsx` | Autenticacao de plataforma. | Super Admin | Duplica login tenant. |
| Criar tenant | `apps/web/src/app/(admin)/admin/page.tsx` | Dados da igreja, plano, idioma, contato e admin inicial. | Super Admin | Usa modal/form inline proprio. |
| Editar tenant | `apps/web/src/app/(admin)/admin/page.tsx` | Nome, plano, idioma, contato e ativo/inativo. | Super Admin | Duplica campos do criar tenant. |
| Criar usuario do tenant | `apps/web/src/app/(admin)/admin/page.tsx` | Nome, e-mail, senha e role. | Super Admin | Similar a `UsuarioModal`, mas separado. |
| Filtro de membros | `apps/web/src/app/(dashboard)/membros/page.tsx` | Filtrar por nome, WhatsApp, status e tags. | Membros | Similar aos filtros de visualizacao. |
| Criar tag | `apps/web/src/app/(dashboard)/membros/page.tsx` | Nome e cor da tag. | Membros / Tags | Modal proprio pequeno. |
| Criar/editar membro | `apps/web/src/components/app/membro-modal.tsx` | Nome, e-mail, WhatsApp, nascimento, status e observacoes. | Membros | Modal compartilhado so para membros. |
| Ministerio info | `apps/web/src/app/(dashboard)/ministerios/page.tsx` | Criar/editar nome, descricao e funcoes iniciais. | Ministerios | Modal/tab inline proprio. |
| Adicionar membro ao ministerio | `apps/web/src/app/(dashboard)/ministerios/page.tsx` | Buscar membro e definir papel ministerial. | Ministerios | Usa combobox compartilhado; estrutura inline. |
| Gerenciar funcoes do ministerio | `apps/web/src/app/(dashboard)/ministerios/page.tsx` | Criar/remover funcoes e salvar lista. | Ministerios | Controles inline sem componente comum. |
| Filtro de agenda | `apps/web/src/app/(dashboard)/agenda/page.tsx` | Filtrar eventos por status e intervalo de datas. | Agenda | Similar a outros filtros. |
| Criar/editar evento | `apps/web/src/app/(dashboard)/agenda/page.tsx` | Titulo, inicio, fim, local, status e descricao. | Agenda | Modal proprio. |
| Criar escala | `apps/web/src/app/(dashboard)/escalas/page.tsx` | Mes, ano, ministerio, dias da semana e observacoes. | Escalas | Modal proprio. |
| Adicionar dia a escala | `apps/web/src/app/(dashboard)/escalas/page.tsx` | Data e titulo do dia na grade. | Escalas | Inline dentro de `EscalaGrid`. |
| Filtro visualizacao membros | `apps/web/src/app/(dashboard)/membros/visualizacao/page.tsx` | Nome, status, ministerio, aniversario e sem telefone. | Membros / Visualizacao | Duplica filtro de membros. |
| Filtro visualizacao escalas | `apps/web/src/app/(dashboard)/escalas/visualizacao/page.tsx` | Ministerio, status, mes, ano e pendentes. | Escalas / Visualizacao | Similar filtro de `/escalas`. |
| Troca de senha | `apps/web/src/app/(dashboard)/meu-perfil/page.tsx` | Senha atual, nova senha e confirmacao. | Perfil | `PasswordField` local reutilizavel. |
| Criar/editar usuario | `apps/web/src/components/app/usuario-modal.tsx` | Membro vinculado, nome, e-mail, senha, role e ativo. | Configuracoes | Similar ao criar usuario Super Admin. |
| Exportar membros | `apps/web/src/app/(dashboard)/membros/exportacao/page.tsx` | Formato CSV e selecao de campos. | Exportacao | Duplica demais exportacoes. |
| Exportar ministerios | `apps/web/src/app/(dashboard)/ministerios/exportacao/page.tsx` | Formato CSV e selecao de campos. | Exportacao | Duplica demais exportacoes. |
| Exportar escalas | `apps/web/src/app/(dashboard)/escalas/exportacao/page.tsx` | Formato CSV e selecao de campos. | Exportacao | Duplica demais exportacoes. |
| Exportar agenda | `apps/web/src/app/(dashboard)/agenda/exportacao/page.tsx` | Formato CSV e selecao de campos. | Exportacao | Duplica demais exportacoes. |

---

## 4. Modais Existentes

| Modal | Arquivo | Responsabilidade | Modulo | Possiveis duplicacoes |
|---|---|---|---|---|
| Modal base local | `apps/web/src/app/(admin)/admin/page.tsx` | Wrapper generico para modais do Super Admin. | Super Admin | Duplica estrutura de `MembroModal`, `UsuarioModal` e modais inline. |
| Criar tenant | `apps/web/src/app/(admin)/admin/page.tsx` | Criar tenant e admin inicial. | Super Admin | Form/modal inline. |
| Editar tenant | `apps/web/src/app/(admin)/admin/page.tsx` | Editar tenant. | Super Admin | Form/modal inline. |
| Criar usuario tenant | `apps/web/src/app/(admin)/admin/page.tsx` | Criar usuario dentro de tenant. | Super Admin | Similar a `UsuarioModal`. |
| `MembroModal` | `apps/web/src/components/app/membro-modal.tsx` | Criar/editar membro. | Membros | Padrao de shell duplicado em outros modais. |
| Criar tag | `apps/web/src/app/(dashboard)/membros/page.tsx` | Criar tag com nome/cor. | Membros | Modal pequeno inline. |
| Ministerio | `apps/web/src/app/(dashboard)/ministerios/page.tsx` | Criar/editar ministerio; tabs info/membros/funcoes. | Ministerios | Modal grande inline; shell duplicado. |
| Evento | `apps/web/src/app/(dashboard)/agenda/page.tsx` | Criar/editar evento. | Agenda | Shell duplicado. |
| Criar escala | `apps/web/src/app/(dashboard)/escalas/page.tsx` | Criar escala. | Escalas | Shell duplicado. |
| `UsuarioModal` | `apps/web/src/components/app/usuario-modal.tsx` | Criar/editar usuario tenant. | Configuracoes | Similar ao modal de usuario do Super Admin. |
| Desativar usuario | `apps/web/src/app/(dashboard)/configuracoes/page.tsx` | Confirmacao de desativacao/exclusao logica. | Configuracoes | Confirmacao custom enquanto outros CRUDs usam `confirm()`. |
| Chatbot popover/dialog | `apps/web/src/components/app/chatbot-button.tsx` | Painel flutuante "Assistente IA em breve". | App Shell | Usa overlay proprio; nao compartilha modal base. |

---

## 5. Drawers Existentes

| Drawer | Arquivo | Responsabilidade | Modulo | Possiveis duplicacoes |
|---|---|---|---|---|
| `MemberProfileDrawer` | `apps/web/src/components/app/member-profile-drawer.tsx` | Perfil lateral read-only do membro. | Membros / Visualizacao | Poderia compartilhar padrao com futuros drawers. |
| Sidebar mobile | `apps/web/src/components/app/sidebar.tsx` | Menu lateral responsivo, colapsavel e por perfil. | App Shell | Drawer lateral implementado dentro do proprio sidebar. |
| Submenu flutuante da sidebar colapsada | `apps/web/src/components/app/sidebar.tsx` | Menu lateral flutuante para itens filhos quando sidebar esta colapsada. | App Shell | Overlay/dropdown especifico, sem componente comum. |

---

## 6. Componentes Compartilhados

| Componente | Arquivo | Responsabilidade | Modulo | Possiveis duplicacoes |
|---|---|---|---|---|
| `Sidebar` | `apps/web/src/components/app/sidebar.tsx` | Navegacao, RBAC visual, idioma, logout e estado colapsado. | App Shell | Icones inline; regras de menu duplicam parte do contexto de navegacao. |
| `Header` | `apps/web/src/components/app/header.tsx` | Barra superior e titulo por rota. | App Shell | Mapeamento de titulos limitado e separado da sidebar. |
| `ChatbotButton` | `apps/web/src/components/app/chatbot-button.tsx` | Botao flutuante de IA "em breve". | App Shell | Overlay proprio. |
| `PageHeader` | `apps/web/src/components/app/page-header.tsx` | Titulo, descricao e acao de pagina. | Layout / UI | Bem reutilizado, mas nem todas as paginas usam. |
| `DataTable` | `apps/web/src/components/app/data-table.tsx` | Tabela generica com selecao, loading, empty e paginacao. | UI / Dados | Nao cobre tabelas customizadas de visualizacao/admin/escala. |
| `EmptyState` | `apps/web/src/components/app/empty-state.tsx` | Estado vazio com titulo, descricao, acao e icone. | UI | Alguns vazios sao inline. |
| `StatCard` | `apps/web/src/components/app/stat-card.tsx` | Card de metrica com icone, cor, loading e link. | Dashboard / UI | `StatBox` local em visualizacoes duplica conceito. |
| `ComingSoon` | `apps/web/src/components/app/coming-soon.tsx` | Pagina padrao para modulos futuros. | UI / Futuro | Icones/features definidos inline em cada pagina. |
| `MembroModal` | `apps/web/src/components/app/membro-modal.tsx` | Modal de criar/editar membro. | Membros | Shell de modal duplicado em outros arquivos. |
| `UsuarioModal` | `apps/web/src/components/app/usuario-modal.tsx` | Modal de criar/editar usuario. | Configuracoes | Similar ao criar usuario do Super Admin. |
| `MembroSearchCombobox` | `apps/web/src/components/app/membro-search-combobox.tsx` | Busca/selecao de membro. | Membros / Ministerios / Usuarios | Poderia ser combobox generico. |
| `MemberProfileDrawer` | `apps/web/src/components/app/member-profile-drawer.tsx` | Drawer read-only de perfil de membro. | Membros | Padrao de drawer unico. |
| `EscalaReadonlyGrid` | `apps/web/src/components/app/escala-readonly-grid.tsx` | Grade read-only de escala. | Escalas | Duplica parte da grade interativa. |
| `FlagIcon` | `apps/web/src/components/app/locale-flags.tsx` | Icones SVG de idioma. | Internacionalizacao | SVGs inline; usado pela sidebar. |

---

## 7. Hooks Compartilhados

| Hook | Arquivo | Responsabilidade | Modulo | Possiveis duplicacoes |
|---|---|---|---|---|
| `useAdmin` | `apps/web/src/hooks/use-admin.ts` | Listar/criar/atualizar tenants e criar usuario de tenant. | Super Admin | Nao segue padrao de estado/loading/error usado em outros hooks. |
| `useDashboard` | `apps/web/src/hooks/use-dashboard.ts` | Montar KPIs via multiplas chamadas API. | Dashboard | Agregacao no frontend pode duplicar backend futuramente. |
| `useDateFormatter` | `apps/web/src/hooks/use-date-formatter.ts` | Formatar datas conforme locale. | i18n / UI | Complementa `utils`; uso parcial. |
| `useMembros` | `apps/web/src/hooks/use-membros.ts` | Listar, filtrar, criar, atualizar, excluir e aplicar tags em massa. | Membros | Padrao CRUD semelhante a eventos/escalas. |
| `useMembrosVisualizacao` | `apps/web/src/hooks/use-membros-visualizacao.ts` | Consulta read-only filtrada de membros. | Membros / Visualizacao | Filtros sobrepoem `useMembros`. |
| `useMinisterios` | `apps/web/src/hooks/use-ministerios.ts` | CRUD de ministerios e gestao de membros/funcoes. | Ministerios | Algumas chamadas detalhadas ficam direto na pagina. |
| `useEscalas` | `apps/web/src/hooks/use-escalas.ts` | CRUD de escalas, dias, itens, confirmacao e celulas ocultas. | Escalas | Parte do detalhe ainda fica na pagina. |
| `useEscalasVisualizacao` | `apps/web/src/hooks/use-escalas-visualizacao.ts` | Consulta read-only filtrada de escalas. | Escalas / Visualizacao | Filtros semelhantes a `useEscalas`. |
| `useMinhasEscalas` | `apps/web/src/hooks/use-escalas-visualizacao.ts` | Consulta das escalas do membro logado. | Portal do Membro | Compartilha arquivo com visualizacao, mas responsabilidade diferente. |
| `useEventos` | `apps/web/src/hooks/use-eventos.ts` | Listar, filtrar, criar, atualizar e excluir eventos. | Agenda | Padrao CRUD semelhante a membros/escalas. |

---

## 8. Layouts Existentes

| Layout | Arquivo | Responsabilidade | Modulo | Possiveis duplicacoes |
|---|---|---|---|---|
| `RootLayout` | `apps/web/src/app/layout.tsx` | HTML/body global, fonte Inter e provider `next-intl`. | Global | Sem duplicacao relevante. |
| `AuthLayout` | `apps/web/src/app/(auth)/layout.tsx` | Centralizar telas auth em fundo gradiente. | Autenticacao | Visual duplicado no admin login, que nao usa este layout. |
| `DashboardLayout` | `apps/web/src/app/(dashboard)/layout.tsx` | Shell autenticado com sidebar, header, main scroll e chatbot. | App Shell | Busca `/api/auth/me` aqui e em varias paginas. |
| `AdminLayout` | `apps/web/src/app/(admin)/layout.tsx` | Shell Super Admin com header e logout. | Super Admin | Logout usa `/api/auth/logout`, enquanto login usa `/api/admin/auth/login`; atencao ao acoplamento. |

---

## 9. Variacoes de CRUD Existentes

| Variacao | Arquivo(s) | Responsabilidade | Modulo | Possiveis duplicacoes |
|---|---|---|---|---|
| CRUD completo com tabela compartilhada | `membros/page.tsx`, `use-membros.ts`, `membro-modal.tsx` | Criar, listar, editar, excluir membros; selecao e tags em massa. | Membros | Confirmacao via `confirm()`; modal proprio so de membro. |
| CRUD em cards + modal com tabs | `ministerios/page.tsx`, `use-ministerios.ts` | Criar/editar/arquivar ministerios, gerenciar membros e funcoes. | Ministerios | Logica de associacao e tabs concentrada na pagina. |
| CRUD mestre-detalhe com grade interativa | `escalas/page.tsx`, `use-escalas.ts` | Criar/excluir escala, publicar/encerrar, gerir dias, ordem, celulas e membros. | Escalas | Grade local duplica read-only; muita responsabilidade na pagina. |
| CRUD em cards/lista | `agenda/page.tsx`, `use-eventos.ts` | Criar, editar, excluir e filtrar eventos. | Agenda | Modal e filtros proprios; nao usa `DataTable`. |
| CRUD de usuarios com auditoria | `configuracoes/page.tsx`, `usuario-modal.tsx` | Criar/editar/desativar usuarios e consultar logs. | Configuracoes | Usa `DataTable`, mas confirmacao custom isolada. |
| CRUD parcial de tenants | `admin/page.tsx`, `use-admin.ts` | Listar, criar e editar tenants; criar usuarios. | Super Admin | Nao ha exclusao; tabela/modal proprios duplicam padroes internos. |
| Atualizacao propria do usuario | `meu-perfil/page.tsx` | Ler perfil e trocar senha. | Perfil | Form local reaproveitavel. |
| Atualizacao de confirmacao | `minhas-escalas/page.tsx`, `useMinhasEscalas` | Confirmar ou recusar presenca em escala. | Portal do Membro | Chamada PATCH direta na pagina em vez de hook dedicado de mutacao. |
| Read-only com filtros e drawer | `membros/visualizacao/page.tsx` | Consultar membros e abrir perfil lateral. | Visualizacao | Duplica filtros/tabela de membros. |
| Read-only com filtros e impressao | `escalas/visualizacao/page.tsx`, `escala-readonly-grid.tsx` | Consultar escalas e imprimir. | Visualizacao | Duplica filtro de escalas. |
| Exportacao CSV configuravel | `*/exportacao/page.tsx`, `lib/csv.ts` | Selecao de campos e download CSV. | Exportacao | Quatro paginas praticamente iguais com `ALL_FIELDS`, resumo e botao. |
| Criacao de lead publico | `app/page.tsx` | Enviar formulario comercial. | Publico | Padrao visual separado do DS interno. |

---

## Principais Duplicacoes Candidatas a Consolidacao

| Tema | Locais |
|---|---|
| Shell de modal | `MembroModal`, `UsuarioModal`, `admin/page.tsx`, `agenda/page.tsx`, `ministerios/page.tsx`, `escalas/page.tsx`, `configuracoes/page.tsx`, `membros/page.tsx` |
| Exportacao CSV configuravel | `membros/exportacao`, `ministerios/exportacao`, `escalas/exportacao`, `agenda/exportacao` |
| Filtros de listagem | `membros`, `membros/visualizacao`, `agenda`, `escalas`, `escalas/visualizacao` |
| Status labels/cores | `lib/utils.ts`, paginas de exportacao, `membros/page.tsx`, `configuracoes/page.tsx`, `agenda/page.tsx`, `escalas/page.tsx` |
| Tabelas customizadas | `admin/page.tsx`, `membros/visualizacao/page.tsx`, `escalas/page.tsx`, `escala-readonly-grid.tsx` |
| Cards de estatistica | `StatCard`, `StatBox` local, blocos de metricas em `minhas-escalas` e `escalas/visualizacao` |
| Login visual | `/login` e `/admin/login` |
| Busca de usuario atual | `DashboardLayout`, `dashboard/page.tsx`, `membros/page.tsx`, `agenda/page.tsx`, `configuracoes/page.tsx`, `ministerios/page.tsx`, `escalas/page.tsx`, `meu-perfil/page.tsx`, `minhas-escalas/page.tsx` |

