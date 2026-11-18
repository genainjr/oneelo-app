# Backlog - Personalização de Cores e Identidade Visual por Igreja

### FT-022 Personalização de Cores e Identidade Visual da Igreja (Tema Customizado por Tenant)

- **Prioridade**: alta (identidade da marca e experiência personalizada da igreja)
- **Status**: concluído (Etapas 0–6 — branch `feature/tema-personalizado-tenant`)
- **Fase**: identidade visual e experiência da marca
- **Categoria**: produto / UX / frontend / design system
- **Esforço estimado**: baixo a médio (facilitado pela base de tokens semânticos já implementada)
- **Contexto**: com a entrega da infraestrutura de tokens semânticos (Plano A da unificação visual), todas as superfícies vinculadas à igreja (portal público `/[slug]`, login identificado `/login?igreja=[slug]`, PWA e painel interno) passaram a consumir variáveis CSS semânticas padronizadas em Obsidiana + Âmbar (`#09090b` + `#fbbf24`). No entanto, cada igreja possui sua própria identidade visual (ex: logotipo em azul marinho, verde esmeralda, vinho/bordô, terracota, etc.). A liderança desejava poder escolher a cor primária da sua igreja no painel administrativo, garantindo que o sistema espelhe perfeitamente a identidade visual da sua comunidade sem perder legibilidade ou consistência.

- **Entrega realizada**:

  1. **Modelagem de Dados e Backend (Prisma & API):**
     - Campos opcionais `themePalette` (`theme_palette`) e `primaryColor` (`primary_color`) adicionados ao modelo `Tenant` em `apps/api/prisma/schema.prisma` com migration `20261118183700_add_tenant_theme_fields`.
     - Endpoint protegido `PATCH /api/auth/tenant/theme` (`@Roles(Role.ADMIN)`, isolado pelo `tenantId` do JWT) com normalização de presets oficiais e registro em `AuditLog` (`entidade: 'Tenant'`).
     - Exposição de `themePalette` e `primaryColor` em `/api/auth/me`, sessão (`login`/`oauth`/`activate`), prévia de ativação, `/api/public/tenants/:slug`, `/api/public/site/:slug`, `/api/public/site/:slug/news/:noticiaSlug` e `/api/documents/validar/carteirinha/:id`.
     - Mantido `theme_color: '#09090b'` no manifesto PWA (`pwa.service.ts`) e `<meta name="theme-color">` para consistência visual com o cabeçalho/sidebar Obsidiana, estendendo o cache local (`pwa-branding.ts`) com `themePalette` e `primaryColor`.

  2. **Interface do Seletor de Cores (`apps/web/src/components/app/tenant-theme-settings.tsx` + `configuracoes/page.tsx`):**
     - Card **"Identidade Visual & Cores da Igreja"** visível apenas para `Role.ADMIN`:
       - **7 Paletas Curadas (Presets Oficiais ODS):** *Âmbar / Dourado* (padrão), *Azul Real / Marinho*, *Verde Esmeralda*, *Vinho / Bordô*, *Roxo / Púrpura*, *Terracota / Cobre* e *Grafite / Ardósia*.
       - **Color Picker Customizado (HEX):** `<input type="color">` + campo `#RRGGBB` controlado com validação em tempo real.
       - **Calculadora Automática de Contraste e Escala (WCAG AA — `brand-theme.ts`):** garante ≥ 4.5:1 separadamente em superfícies claras (`--theme-accent-ink*`), botões (`--theme-brand-foreground` / `--site-accent-foreground`) e superfícies escuras (`--site-accent-text` e `--theme-sidebar-badge-text`).
       - **Preview em Tempo Real** + ação **"Restaurar padrão (Âmbar)"** + revalidação imediata do cache ISR do portal público (`/api/site/revalidate`).

  3. **Injeção Dinâmica e Portal Público:**
     - `DashboardShell`, `/login?igreja=[slug]`, `/activate/[token]`, `/onboarding` (`IOSInstallGuide` incluso), `/validar-carteirinha/[id]`, `/[slug]` e `/[slug]/og` consomem dinamicamente as cores do tenant sem FOUC nem Hydration Mismatch no React 19, preservando `/`, `/admin/*`, `/login` global e `/login/social-link` em Índigo One Elo.
