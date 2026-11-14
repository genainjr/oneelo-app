# Plano - Unificação Visual do Tenant (Tema Padrão Obsidiana + Âmbar via Tokens Semânticos)

Status geral: concluido  
Data de criação: 2026-11-13  
Branch sugerida para implementação: `feature/unificacao-tema-tenant`

## Planos e Referências Relacionados

- [Backlog FT-012: Identidade, Conteúdo e Engajamento por Tenant](../backlog/tenant-branded-experience.md)
- [Plano Site Institucional Público do Tenant (FT-019)](site-institucional-tenant-plan.md)
- [Relatório Fase 8 ODS: Sidebar / Navegação](ods-phase-8-sidebar-report.md)
- [Status Atual do OneElo Design System (ODS)](ods-current-status.md)
- [Design System do OneElo (ODS)](../../ai-core/skills/oneelo-design-system/README.md)

---

## 1. Objetivo da Entrega

Eliminar a quebra visual enfrentada pelos usuários ao navegar entre o **site público da igreja (`/[slug]`)**, a **tela de login da igreja (`/login?igreja=[slug]`)** e o **sistema interno autenticado (`(dashboard)` + fluxos relacionados ao tenant)**, mantendo simultaneamente a identidade oficial **Índigo do One Elo** nas superfícies sem igreja vinculada (landing `/`, painel `/admin/*` e `/login` global).

Resultados esperados desta entrega (**Plano A — Unificação via Tokens Semânticos**):
1. **Continuidade visual imediata:** Portal público, login da igreja, ativação de convite, onboarding, PWA da igreja e painel interno compartilham a mesma paleta padrão **Obsidiana (`#09090b` / `#18181b`) + Âmbar (`#fbbf24`)** na moldura, barra de status (`theme_color`) e ações principais, preservando o miolo de trabalho em fundo claro neutro (`#f9fafb` / `#ffffff`) para conforto diário em tabelas, formulários e escalas.
2. **Contraste WCAG garantido:** Uso de tokens separados para botões sólidos (`--theme-brand: #fbbf24` com `--theme-brand-foreground: #09090b`) e para links/abas/foco sobre fundo claro (`--theme-accent-ink: #b45309`, `--theme-accent-soft: #fef3c7`).
3. **Preservação da marca One Elo:** Áreas sem contexto de igreja (`/`, `/admin/*`, `/login` sem `?igreja=`, `/login/social-link`, fallback sem tenant em `/activate/[token]` e manifesto padrão One Elo) continuam automaticamente em **Índigo / Azul One Elo** sem duplicação de código nos componentes compartilhados.
4. **Zero retrabalho para o Plano B (`FT-012`):** Toda classe `indigo-*` e cor hexadecimal de marca mapeada (exceto áreas exclusivamente One Elo) passa a consumir tokens CSS semânticos em `globals.css` (`@theme inline`), permitindo que na futura entrega de temas configuráveis por igreja bastará injetar a paleta salva do tenant nessas mesmas variáveis CSS.

---

## 2. Contexto e Diagnóstico

1. **Origem da dissonância visual atual:**
   - O portal público (`apps/web/src/app/[slug]/page.tsx`) e o login identificado (`/login?igreja=[slug]` em `apps/web/src/app/(auth)/login/login-client.tsx`) usam `.public-site-root` definida em `apps/web/src/app/globals.css`, com fundo escuro obsidiana (`--site-bg: #09090b`, `--site-surface: #121216`) e acento dourado/âmbar (`--site-accent: #fbbf24`, `--site-accent-foreground: #09090b`).
   - Entretanto, `apps/web/src/app/[slug]/layout.tsx` não aplica `.public-site-root` nem `data-brand-theme="church"`, deixando subpáginas claras do portal como `[slug]/noticias/[noticiaSlug]/page.tsx` sem tokens de tema e ainda com classes `indigo-*` fixas.
   - Em `apps/web/src/app/globals.css`, `:root` já declara `--color-primary`, `--color-primary-hover`, `--color-sidebar-bg`, `--color-sidebar-text` e `--color-sidebar-active` (sem uso em componentes), que precisam ser removidas/substituídas para não colidir com os nomes gerados por `@theme inline` no Tailwind CSS v4.
   - Além disso, existem vazamentos em hexadecimal e PWA fora de `indigo-*`: card Open Graph fallback de `[slug]/og/route.tsx` (`#4f46e5 -> #312e81`) e `theme_color: '#0f2f73'` herdado no manifesto PWA da igreja (`apps/api/src/modules/pwa/pwa.service.ts`) além da ausência de sincronização de `<meta name="theme-color">` em `apps/web/src/lib/pwa-branding.ts`.

2. **Inventário completo levantado (`apps/web/src` + `apps/api` PWA):**
   - **458 ocorrências de `indigo-*` em 72 arquivos** de `apps/web/src`:
     - `components/app/`: **41 arquivos** (destaque para `sidebar.tsx` com 38 ocorrências, e componentes ODS base como `data-table.tsx`, `tabs-shell.tsx`, `form-field.tsx`, `filter-shell.tsx`, `filter-field.tsx`, `modal-shell.tsx`, `export-shell.tsx`, `entity-card.tsx`, `stat-card.tsx`, `primary-action-button.tsx`).
     - `app/(dashboard)/`: **19 páginas** de módulos operacionais e configurações.
     - `app/(auth)/`: **4 arquivos** (`layout.tsx`, `login/login-client.tsx`, `login/social-link/page.tsx`, `activate/[token]/page.tsx`).
     - `app/[slug]/`: **2 arquivos** com `indigo-*` (`not-found.tsx`, `noticias/[noticiaSlug]/page.tsx`).
     - Outros fluxos: **3 arquivos** (`app/page.tsx`, `app/onboarding/page.tsx`, `app/validar-carteirinha/[id]/page.tsx`).
     - `app/(admin)/`: **3 arquivos** (`layout.tsx`, `admin/login/page.tsx`, `admin/page.tsx`) — devem **permanecer Índigo One Elo**.
   - **Pontos adicionais fora da busca `indigo-*`:** `apps/web/src/app/[slug]/layout.tsx`, `apps/web/src/app/[slug]/og/route.tsx`, `apps/web/src/lib/pwa-branding.ts` e `apps/api/src/modules/pwa/pwa.service.ts` (+ `pwa.service.spec.ts`).
   - **Verificação técnica:** não há uso de `createPortal` em `apps/web/src` (modais e drawers herdam normalmente atributos aplicados nos wrappers); não existe `tsconfig.json` na raiz do monorepo (typecheck deve mirar `apps/web`).

3. **Capacidade técnica do projeto:**
   - `apps/web` utiliza **Tailwind CSS v4** (`@import "tailwindcss";` em `globals.css`), suportando `@theme inline` para mapear variáveis CSS diretamente para classes utilitárias semânticas (`bg-brand`, `text-brand-foreground`, `text-accent-ink`, `bg-sidebar-bg`, etc.).

---

## 3. Decisões de Arquitetura, Riscos e Engenharia

### 3.1. Arquitetura de Tokens em Duas Camadas (`:root` vs `[data-brand-theme="church"]`)
Em `apps/web/src/app/globals.css`:
- **Remoção das variáveis legadas sem uso:** remover `--color-primary`, `--color-primary-hover`, `--color-sidebar-bg`, `--color-sidebar-text` e `--color-sidebar-active` declaradas diretamente no `:root` atual para evitar conflito com os utilitários gerados por `@theme inline` no Tailwind v4.
- **`:root` (Fallback / Identidade One Elo Global):**
  Define valores padrão em **Índigo One Elo** para todos os tokens semânticos (`--theme-brand: #4f46e5`, `--theme-brand-hover: #4338ca`, `--theme-brand-foreground: #ffffff`, `--theme-accent-ink: #4338ca`, `--theme-accent-soft: #eef2ff`, `--theme-accent-soft-border: #c7d2fe`, `--theme-accent-ring: #6366f1`, `--theme-stat-brand-bg: #eef2ff`, `--theme-stat-brand-text: #4f46e5`, `--theme-sidebar-bg: #1e1b4b`, `--theme-sidebar-surface: #312e81`, `--theme-sidebar-border: #312e81`, `--theme-sidebar-hover: #312e81`, `--theme-sidebar-active-bg: #6366f1`, `--theme-sidebar-active-text: #ffffff`, `--theme-sidebar-text: #a5b4fc`, `--theme-sidebar-muted: #818cf8`, `--theme-sidebar-ring: #818cf8`).
- **`[data-brand-theme="church"]` (Tema Padrão Unificado da Igreja — Plano A):**
  Sobrescreve apenas as variáveis CSS para **Obsidiana + Âmbar** (Opção A1):
  - Sidebar escura: `--theme-sidebar-bg: #09090b`, `--theme-sidebar-surface: #18181b`, `--theme-sidebar-border: #27272a`, `--theme-sidebar-hover: #27272a`, `--theme-sidebar-active-bg: #fbbf24`, `--theme-sidebar-active-text: #09090b`, `--theme-sidebar-text: #d4d4d8`, `--theme-sidebar-muted: #a1a1aa`, `--theme-sidebar-ring: #fbbf24`, `--theme-sidebar-badge-bg: rgba(251, 191, 36, 0.16)`, `--theme-sidebar-badge-text: #fcd34d`.
  - Botão primário / ação forte: `--theme-brand: #fbbf24`, `--theme-brand-hover: #f59e0b`, `--theme-brand-foreground: #09090b`, `--theme-brand-shadow: rgba(245, 158, 11, 0.2)`.
  - Destaques em fundo claro (`#ffffff` / `#f9fafb` / `#faf9f6`): `--theme-accent-ink: #b45309`, `--theme-accent-ink-hover: #92400e`, `--theme-accent-soft: #fef3c7`, `--theme-accent-soft-hover: #fde68a`, `--theme-accent-soft-border: #fcd34d`, `--theme-accent-ring: #d97706`, `--theme-stat-brand-bg: #18181b`, `--theme-stat-brand-text: #fbbf24`.
- **`@theme inline` (Tailwind v4):**
  Expõe os tokens como cores utilitárias nativas (`brand`, `brand-hover`, `brand-foreground`, `accent-ink`, `accent-ink-hover`, `accent-soft`, `accent-soft-hover`, `accent-soft-border`, `accent-ring`, `stat-brand-bg`, `stat-brand-text`, `sidebar-bg`, `sidebar-surface`, `sidebar-border`, `sidebar-hover`, `sidebar-active-bg`, `sidebar-active-text`, `sidebar-text`, `sidebar-muted`, `sidebar-ring`).

### 3.2. Fronteira Estrita entre Contexto da Igreja, PWA e Contexto One Elo
- **Com tema `church` (`data-brand-theme="church"`):**
  - Portal público completo via `apps/web/src/app/[slug]/layout.tsx` (sem aplicar `.public-site-root` no layout pai, preservando `#faf9f6` nas notícias e `#09090b` na home `page.tsx` + `/cadastro`) e imagem Open Graph fallback em `apps/web/src/app/[slug]/og/route.tsx`.
  - `apps/web/src/app/(auth)/login/login-client.tsx` quando `isChurchBranded === true` (incluindo `<meta name="theme-color" content="#09090b">`).
  - `apps/web/src/app/(auth)/activate/[token]/page.tsx` quando `details?.tenant` existir.
  - `apps/web/src/app/onboarding/page.tsx` quando `user?.tenant` existir (ou cache PWA antes do fetch, sem FOUC).
  - `apps/web/src/app/validar-carteirinha/[id]/page.tsx` após carregar `data.igreja`.
  - `apps/web/src/components/app/dashboard-shell.tsx` para usuários de tenant (inicia com `'church'` no dashboard para evitar flash de índigo antes de `/api/auth/me`, alternando para `'oneelo'` somente se `user && !user.tenant`, p.ex. `SUPER_ADMIN` sem tenant).
  - **PWA da igreja:**
    - `apps/api/src/modules/pwa/pwa.service.ts`: quando o tenant possuir PWA customizado válido, emitir `theme_color: '#09090b'` (mantendo `background_color: '#ffffff'` para abertura limpa do dashboard/splash ou `#09090b` consistente no navegador) e atualizar `TENANT_MANIFEST_REVISION` de `'3'` para `'4'` (sincronizado com `apps/web/src/lib/pwa-branding.ts` e `apps/api/src/modules/pwa/pwa.service.spec.ts`) para invalidar cache de manifestos antigos.
    - `apps/web/src/lib/pwa-branding.ts` (`syncTenantPwaHead`): sincronizar dinamicamente `<meta name="theme-color">` para `#09090b` sempre que houver `tenant` (mesmo antes de upload de ícone PWA customizado), retornando para `#0f2f73` quando `!tenant`.
- **Sempre em Índigo / Azul One Elo (`:root` / sem `data-brand-theme="church"`):**
  - Landing institucional `apps/web/src/app/page.tsx`.
  - Área global `apps/web/src/app/(admin)/**`.
  - Login global `/login` sem `?igreja=...` e `apps/web/src/app/(auth)/login/social-link/page.tsx` (enquanto não houver tenant vinculado no payload).
  - Ativação `/activate/[token]` quando `!details?.tenant`.
  - Manifesto padrão One Elo (`apps/web/src/app/manifest.webmanifest/route.ts` e fallback `ONEELO_MANIFEST` em `pwa.service.ts`) mantém `theme_color: '#0f2f73'`.

### 3.3. Preservação de Cores Semânticas Operacionais, Dados de Usuário e Riscos
- **Regra de ouro de contraste (`brand` vs `accent-ink`):** `bg-brand` (`#fbbf24` no tema da igreja) e `text-brand-foreground` (`#09090b`) são exclusivos para **botões sólidos de ação** (preservando contraste também em ícones internos, spinners e estado `disabled`) e para **destaques em superfície escura** (`Sidebar`). Sobre fundos claros (`#ffffff` / `#f9fafb` / `#faf9f6`), textos, links, ícones e bordas **nunca** devem usar `text-brand`, devendo utilizar obrigatoriamente `text-accent-ink` (`#b45309`), `bg-accent-soft` (`#fef3c7`) e `border-accent-soft-border` (`#fcd34d`).
- **Semântica fixa intacta:** Estados de sucesso/confirmação (`emerald-*` / `green-*`), erro/destrutivo (`red-*` / `rose-*`) e alerta (`amber-*` / `yellow-*` em toasts/avisos de atenção) permanecem independentes da marca. Em `stat-card.tsx`, a variante de marca (`brand`) usa tokens dedicados (`--theme-stat-brand-bg` / `--theme-stat-brand-text`: caixa obsidiana `#18181b` com ícone âmbar `#fbbf24` no modo `church`) para não ficar igual a cards `amber` vizinhos (como *Aniversariantes* em `/dashboard` ou métricas em `/personal-panel`). O mesmo cuidado vale para badges categóricos em `documentos/page.tsx` e `notification-automation-rules-panel.tsx`.
- **Dados/etiquetas escolhidos pelo usuário:** Valores hexadecimais de etiquetas de membros (`newTagColor` inicial `#4f46e5` em `membros/page.tsx` e `membroTag.tag.cor || '#6366f1'` em `member-profile-drawer.tsx`) representam cores cadastráveis de tags e devem usar fallback neutro (`#71717a`) ou permanecer isolados dos tokens globais de tema do tenant.
- **Preservação de impressão (`@media print`):** Garantir que `.print-document` em `globals.css` e componentes de impressão/PDF mantenham variáveis neutras de alto contraste sobre papel branco, sem herdar fundos obsidiana ou acento âmbar.
- **Contraste em checkboxes/radios nativos (`accent-*`):** Em fundos claros, usar `accent-accent-ring` (`#d97706` no modo igreja / `#6366f1` no modo One Elo) ou `text-accent-ink` garantindo visibilidade clara de checkboxes selecionados.
- **Compatibilidade com Plano B (`FT-012`):** Como todos os componentes passam a referenciar apenas nomes semânticos (`bg-brand`, `text-accent-ink`, `bg-sidebar-bg`, etc.), a futura adição de `themePreset` / `primaryColor` em `TenantWebsiteConfig` exigirá apenas um helper que aplique os CSS custom properties no container raiz do tenant e no `PwaService`, sem reabrir os arquivos de UI.

---

## 4. Etapas de Desenvolvimento

> **Regra de Execução:** O desenvolvimento deve avançar estritamente etapa por etapa. Ao concluir uma tarefa ou etapa, atualize imediatamente seu checkbox para `[x]`, apresente o resumo das validações e **aguarde a autorização explícita do usuário antes de iniciar a etapa seguinte**.

### Etapa 0 - Preparação, Branch e Baseline
Status: concluido

- [x] Confirmar repositório limpo na branch `development` e atualizar com `git pull`
- [x] Criar a branch de implementação `feature/unificacao-tema-tenant` a partir de `development`
- [x] Auditar warnings e baseline de build/typecheck (`npx -w apps/web tsc --noEmit`, `npm.cmd run build -w apps/web`) antes da primeira edição
- [x] Critério de validação da etapa: Branch `feature/unificacao-tema-tenant` ativa sobre `development` atualizada e baseline de build verde registrado.

### Etapa 1 - Fundação de Tokens CSS (`globals.css`) e Layout Shell
Status: concluido

- [x] Atualizar `apps/web/src/app/globals.css`:
  - [x] Remover as variáveis legadas sem uso em `:root` (`--color-primary`, `--color-primary-hover`, `--color-sidebar-bg`, `--color-sidebar-text`, `--color-sidebar-active`) para evitar colisão com `@theme inline` no Tailwind v4
  - [x] Definir tokens semânticos `--theme-*` em `:root` (One Elo Índigo default) e bloco `[data-brand-theme="church"]` (Obsidiana + Âmbar com contraste WCAG, incluindo `--theme-stat-brand-*`)
  - [x] Expor utilitários Tailwind v4 via `@theme inline` (`brand*`, `accent-*`, `stat-brand-*`, `sidebar-*`)
- [x] Atualizar wrapper `apps/web/src/components/app/dashboard-shell.tsx` para aplicar `data-brand-theme="church"` para usuários com tenant (sem flash de índigo no carregamento) e fallback `oneelo` quando `user && !user.tenant`
- [x] Migrar todas as classes de cor de navegação da `apps/web/src/components/app/sidebar.tsx` para tokens `--theme-sidebar-*` e `--theme-brand*`:
  - [x] Container `<aside>`, divisor de header, título/subtítulo `"por One Elo"` e botão collapse/expand
  - [x] Skeleton de loading, `groupHeader`, botões de seção pai (expandido e colapsado), popover/flyout de modo colapsado e links folhas
  - [x] `SOON_BADGE_CLASS` (badge "Em breve" via `StatusBadge` com contraste alto sobre fundo obsidiana), `focus-visible:ring-*`, avatar fallback, seletor de idioma e rodapé/logout
- [x] Atualizar botão primário padrão em `apps/web/src/components/app/primary-action-button.tsx` para usar `bg-brand text-brand-foreground hover:bg-brand-hover`
- [x] Revisar `apps/web/src/components/app/header.tsx` para garantir foco e tokens neutros consistentes com a nova moldura
- [x] Critério de validação da etapa: `npx -w apps/web tsc --noEmit` e `npm.cmd run build -w apps/web` passando sem erros ou warnings de CSS (confirmando a geração das novas classes `@theme inline` no Tailwind v4), além de inspeção visual da `Sidebar` + `Header` + `PrimaryActionButton` em modo igreja (`Obsidiana + Âmbar`) e fallback `oneelo` (`Índigo`).

### Etapa 2 - Componentes Base Compartilhados do ODS (`components/app/`)
Status: concluido

- [x] Migrar seletores/ordenação/linha selecionada/checkboxes para tokens semânticos em `apps/web/src/components/app/data-table.tsx`
- [x] Migrar foco/outline interativo em `apps/web/src/components/app/entity-card.tsx`
- [x] Adicionar variante de marca `brand` (via `--theme-stat-brand-bg` / `--theme-stat-brand-text`: Índigo em `:root` e caixa Obsidiana `#18181b` + ícone Âmbar `#fbbf24` em `church`, evitando colisão visual com cards `'amber'` adjacentes) em `apps/web/src/components/app/stat-card.tsx`
- [x] Migrar ícone e botão de ação principal em `apps/web/src/components/app/modal-shell.tsx`
- [x] Migrar aba ativa e badge de contagem em `apps/web/src/components/app/tabs-shell.tsx`
- [x] Migrar botão `FilterActions` em `apps/web/src/components/app/filter-shell.tsx`
- [x] Migrar foco dos filtros em `apps/web/src/components/app/filter-field.tsx`
- [x] Migrar foco de inputs/selects/checkboxes em `apps/web/src/components/app/form-field.tsx`
- [x] Migrar rádios, checkboxes, banner informativo e botão exportar em `apps/web/src/components/app/export-shell.tsx`
- [x] Migrar modal de compartilhamento de exportação em `apps/web/src/components/app/export-share-dialog.tsx`
- [x] Migrar foco de busca em `apps/web/src/components/app/search-input.tsx`
- [x] Migrar foco e item selecionado em `apps/web/src/components/app/search-combobox.tsx`
- [x] Migrar fallback de avatar padrão para token de marca em `apps/web/src/components/app/initials-avatar.tsx`
- [x] Migrar tela de módulo em breve em `apps/web/src/components/app/coming-soon.tsx`
- [x] Migrar botões de dias selecionados em `apps/web/src/components/app/weekday-selector.tsx`
- [x] Migrar cards de seleção de modo de criação em `apps/web/src/components/app/creation-mode-selector.tsx`
- [x] Migrar dropzone e botões de ação em `apps/web/src/components/app/image-upload-panel.tsx`
- [x] Migrar foco e lista selecionada em `apps/web/src/components/app/international-phone-input.tsx`
- [x] Critério de validação da etapa: `npx -w apps/web tsc --noEmit` e `npm.cmd run lint -w apps/web` nos arquivos alterados sem erros; zero `indigo-` nos 18 componentes base listados.

### Etapa 3 - Componentes de Domínio e Engajamento (`components/app/`)
Status: concluido

- [x] Migrar fluxo de importação em `apps/web/src/components/app/member-import-modal.tsx`
- [x] Migrar controles, slots e destaques de escala em `apps/web/src/components/app/escala-grid.tsx`
- [x] Migrar destaques de escala read-only em `apps/web/src/components/app/escala-readonly-grid.tsx`
- [x] Migrar sino e dropdown de notificações em `apps/web/src/components/app/notification-bell-inbox.tsx`
- [x] Migrar painel de regras automáticas de notificação (separando badges categóricos de cor de marca) em `apps/web/src/components/app/notification-automation-rules-panel.tsx`
- [x] Migrar preferências de notificação do perfil em `apps/web/src/components/app/profile-notification-settings.tsx`
- [x] Migrar botão/status de push notifications em `apps/web/src/components/app/push-notification-button.tsx`
- [x] Migrar setup de domínio personalizado em `apps/web/src/components/app/site/domain-setup-card.tsx`
- [x] Migrar configurações de liturgia/escalas em `apps/web/src/components/app/liturgia-escalas-settings.tsx`
- [x] Migrar visualização e botões da carteirinha em `apps/web/src/components/app/carteirinha-modal.tsx`
- [x] Migrar botão de calendário em `apps/web/src/components/app/add-to-calendar-button.tsx`
- [x] Migrar triagem de visitantes/novos membros em `apps/web/src/components/app/solicitacoes-triagem-tab.tsx`
- [x] Migrar prompt de instalação PWA em `apps/web/src/components/app/install-app-prompt.tsx`
- [x] Migrar card de link de convite/auto-cadastro em `apps/web/src/components/app/join-link-card.tsx`
- [x] Migrar configurações de identidade PWA do tenant em `apps/web/src/components/app/tenant-pwa-settings.tsx`
- [x] Migrar botão flutuante/interface de assistente em `apps/web/src/components/app/chatbot-button.tsx`
- [x] Migrar destaques do modal de usuário em `apps/web/src/components/app/usuario-modal.tsx`
- [x] Migrar destaques do modal de membro em `apps/web/src/components/app/membro-modal.tsx`
- [x] Migrar modal de promoção de visitante em `apps/web/src/components/app/promote-visitante-modal.tsx`
- [x] Migrar modal de completar cadastro em `apps/web/src/components/app/completar-cadastro-modal.tsx`
- [x] Migrar drawer de perfil do membro em `apps/web/src/components/app/member-profile-drawer.tsx` (incluindo fallback neutro para tag sem cor cadastrada)
- [x] Critério de validação da etapa: `npx -w apps/web tsc --noEmit` e `npm.cmd run build -w apps/web` passando; zero `indigo-` nos 21 componentes listados.

### Etapa 4 - Fluxos Públicos da Igreja, PWA, Autenticação Contextual e Preservação One Elo
Status: concluido

- [x] Aplicar `data-brand-theme="church"` no container raiz de `apps/web/src/app/[slug]/layout.tsx` (sem `.public-site-root`, mantendo fundo `#faf9f6` nas notícias)
- [x] Alinhar `apps/web/src/app/[slug]/noticias/[noticiaSlug]/page.tsx`: usar `text-accent-ink` e `bg-accent-soft`/`border-accent-soft-border` no link "Voltar" e card CTA sobre papel claro `#faf9f6`, e `bg-brand text-brand-foreground` no botão "Fazer Cadastro"
- [x] Alinhar página de portal não encontrado mantendo coerência visual e CTA para `/` em `apps/web/src/app/[slug]/not-found.tsx`
- [x] Alinhar o gradiente fallback Open Graph da igreja (Obsidiana + Âmbar) em `apps/web/src/app/[slug]/og/route.tsx`
- [x] Atualizar tema do PWA para refletir a identidade da igreja mantendo fallback One Elo:
  - [x] Atualizar `apps/api/src/modules/pwa/pwa.service.ts` para emitir `theme_color: '#09090b'` no manifesto customizado do tenant e incrementar `TENANT_MANIFEST_REVISION` para `'4'` (preservando `theme_color: '#0f2f73'` em `ONEELO_MANIFEST`)
  - [x] Atualizar teste unitário `apps/api/src/modules/pwa/pwa.service.spec.ts` cobrindo `theme_color` do tenant vs fallback One Elo e revisão `'4'`
  - [x] Atualizar `apps/web/src/lib/pwa-branding.ts` (`TENANT_MANIFEST_REVISION = '4'` e sincronização de `<meta name="theme-color">` para `#09090b` quando houver tenant e `#0f2f73` quando `!tenant`)
- [x] Implementar alternância condicional em `apps/web/src/app/(auth)/activate/[token]/page.tsx`: usar wrapper de tela inteira com `data-brand-theme="church"` (Obsidiana + Âmbar + logo/nome da igreja) cobrindo o fundo de `(auth)/layout.tsx` quando `details?.tenant` existir, estado neutro durante loading inicial (sem flash índigo indevido) e **Índigo One Elo** quando não houver igreja vinculada
- [x] Aplicar tema contextual em `apps/web/src/app/onboarding/page.tsx`: `data-brand-theme="church"` quando `user?.tenant` existir (ou cache PWA válido durante loading) e fallback Índigo One Elo sem tenant
- [x] Alinhar `apps/web/src/app/validar-carteirinha/[id]/page.tsx` ao tema unificado da igreja quando `data?.igreja` carregar, mantendo fallback neutro em loading/erro
- [x] Revisar `apps/web/src/app/(auth)/layout.tsx`, `apps/web/src/app/(auth)/login/login-client.tsx` e `apps/web/src/app/(auth)/login/social-link/page.tsx` garantindo:
  - [x] Login com `?igreja=...` usa integralmente Obsidiana + Âmbar (e `meta theme-color` `#09090b`) sem interferência do fundo índigo de `(auth)/layout.tsx`
  - [x] Login global sem `?igreja=...` e `/login/social-link` permanecem **Índigo One Elo** (Ponto 2)
- [x] Auditar explicitamente `apps/web/src/app/page.tsx`, `apps/web/src/app/(admin)/layout.tsx`, `apps/web/src/app/(admin)/admin/login/page.tsx`, `apps/web/src/app/(admin)/admin/page.tsx` e `apps/web/src/app/manifest.webmanifest/route.ts` confirmando que permanecem integralmente em **Índigo / Azul One Elo** e seus componentes ODS herdam `:root` One Elo
- [x] Critério de validação da etapa: `npx -w apps/web tsc --noEmit`, `npm.cmd test -w apps/api -- src/modules/pwa/pwa.service.spec.ts`, e teste manual/Playwright nos pares `/ccrv` + `/ccrv/noticias/...` + `/login?igreja=ccrv` (Obsidiana + Âmbar) vs `/`, `/login` e `/admin/login` (Índigo One Elo), conferindo também `/api/pwa/[slug]/manifest.webmanifest` e `<meta name="theme-color">`.

### Etapa 5 - Telas do Dashboard Operacional (Parte 1: Painéis, Membros, Ministérios e Escalas)
Status: concluido

- [x] Migrar destaque de `StatCard` (variante `brand`) e atalhos em `apps/web/src/app/(dashboard)/dashboard/page.tsx`
- [x] Migrar painel pessoal (garantindo contraste entre card `brand` e cards `amber` vizinhos) em `apps/web/src/app/(dashboard)/personal-panel/page.tsx`
- [x] Migrar gestão de membros em `apps/web/src/app/(dashboard)/membros/page.tsx` (incluindo definição de cor default inicial de nova tag neutra/independente do tema)
- [x] Migrar visualização de membros em `apps/web/src/app/(dashboard)/membros/visualizacao/page.tsx`
- [x] Migrar gestão de ministérios em `apps/web/src/app/(dashboard)/ministerios/page.tsx`
- [x] Migrar visualização de ministérios em `apps/web/src/app/(dashboard)/ministerios/visualizacao/page.tsx`
- [x] Migrar gestão de escalas em `apps/web/src/app/(dashboard)/escalas/page.tsx`
- [x] Migrar visualização de escalas em `apps/web/src/app/(dashboard)/escalas/visualizacao/page.tsx`
- [x] Migrar minhas escalas em `apps/web/src/app/(dashboard)/minhas-escalas/page.tsx`
- [x] Critério de validação da etapa: Zero ocorrências `indigo-*` de marca nessas 9 páginas, `npx -w apps/web tsc --noEmit` passando e validação visual das principais listagens/grids.

### Etapa 6 - Telas do Dashboard Operacional (Parte 2: Agenda, Financeiro, Documentos, Perfil e Configurações)
Status: concluido

- [x] Migrar gestão de agenda em `apps/web/src/app/(dashboard)/agenda/page.tsx`
- [x] Migrar visualização de agenda em `apps/web/src/app/(dashboard)/agenda/visualizacao/page.tsx`
- [x] Migrar gestão financeira em `apps/web/src/app/(dashboard)/financeiro/page.tsx`
- [x] Migrar visualização financeira em `apps/web/src/app/(dashboard)/financeiro/visualizacao/page.tsx`
- [x] Migrar modais financeiros em `apps/web/src/app/(dashboard)/financeiro/financeiro-modals.tsx`
- [x] Migrar central de documentos (preservando badges categóricos quando semânticos) em `apps/web/src/app/(dashboard)/documentos/page.tsx`
- [x] Migrar meu perfil em `apps/web/src/app/(dashboard)/meu-perfil/page.tsx`
- [x] Migrar configurações gerais em `apps/web/src/app/(dashboard)/configuracoes/page.tsx`
- [x] Migrar central de notificações em `apps/web/src/app/(dashboard)/configuracoes/notificacoes/page.tsx`
- [x] Migrar CMS do site institucional em `apps/web/src/app/(dashboard)/configuracoes/site/page.tsx`
- [x] Critério de validação da etapa: Zero ocorrências `indigo-*` de marca nessas 10 páginas, `npx -w apps/web tsc --noEmit` passando e conferência visual de `/configuracoes/site`, `/financeiro` e `/meu-perfil`.

### Etapa 7 - Auditoria Global, Testes, Contraste WCAG e Documentação Final
Status: concluido

- [x] Executar varredura em `apps/web/src` confirmando que `indigo-*` e hex de marca remanescentes existem apenas nas superfícies sem igreja (`/`, `/admin/*`, `/login` global, `/login/social-link`, manifesto One Elo e fallbacks explícitos sem tenant)
- [x] Validar em navegador (desktop e mobile) o fluxo ponta a ponta `/ccrv` -> `/ccrv/noticias/...` -> `/login?igreja=ccrv` -> `/dashboard` -> `/membros` -> `/configuracoes/site` -> logoff -> `/login?igreja=ccrv`, verificando continuidade Obsidiana + Âmbar, `<meta name="theme-color">` e contraste WCAG em botões, links, abas e inputs
- [x] Validar fluxo One Elo sem igreja (`/`, `/login`, `/admin/login`) garantindo preservação integral da identidade Índigo One Elo
- [x] Validar modo de impressão (`@media print`) em `/escalas/visualizacao` e `/agenda/visualizacao` confirmando fundo branco e contraste neutro sem herança escura/âmbar
- [x] Atualizar documentação em `ai-context/plans/ods-current-status.md` (aderência de Navegação/Tokens no ODS) e `ai-context/plans/README.md`
- [x] Executar suíte de testes e builds finais (`npx --prefix apps/web tsx --test src/lib/auth-redirect.spec.ts src/lib/calendar-url-builder.spec.ts`, `npm.cmd test -w apps/api -- src/modules/pwa/pwa.service.spec.ts`, `npx -w apps/web tsc --noEmit`, `npm.cmd run build -w apps/web` e `npm.cmd run build -w apps/api`) após última alteração
- [x] Critério de validação da etapa: Builds de produção limpos (`exit 0`), testes passando, zero regressão visual nas telas desktop/mobile e checklist 100% concluído.

---

## 5. Critérios de Aceite Gerais

- [x] O usuário que navega entre `/[slug]`, `/[slug]/noticias/...`, `/login?igreja=[slug]`, PWA instalado da igreja e todo o painel interno percebe a mesma família visual (**Obsidiana + Âmbar**), sem quebra abrupta para Índigo/Azul.
- [x] Todas as rotas, manifestos e estados **sem** igreja vinculada (`/`, `/admin/*`, `/login` sem igreja, `/login/social-link`, `/activate` sem tenant e manifesto One Elo) mantêm a identidade **Índigo / Azul One Elo**.
- [x] O miolo operacional do sistema (tabelas, formulários, cards e modais) mantém fundo claro neutro e contraste WCAG AA em todos os botões primários, abas ativas, links e bordas de foco.
- [x] Cores semânticas de status (verde = confirmado/sucesso, vermelho = erro/exclusão, amarelo = alerta) permanecem intactas e distinguíveis da cor de marca.
- [x] Todos os arquivos mapeados (`apps/web/src` e módulo PWA em `apps/api`) foram auditados/migrados para tokens semânticos `--theme-*` prontos para receber configuração dinâmica por igreja no futuro **Plano B** (`FT-012`) sem refatoração estrutural.
- [x] Typecheck, testes automatizados (`apps/web` e `apps/api`) e builds de produção passam sem erros após a última edição.
