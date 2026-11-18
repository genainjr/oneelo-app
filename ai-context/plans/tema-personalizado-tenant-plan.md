# Plano - Personalização de Cores e Identidade Visual da Igreja (FT-022)

Status geral: concluido  
Data de criação: 2026-11-18  
Branch sugerida para implementação: feature/tema-personalizado-tenant  

## Planos e Referências Relacionados

- [Template Oficial de Planos](PLAN_TEMPLATE.md)
- [Backlog FT-022: Personalização de Cores e Identidade Visual](../backlog/tema-personalizado-tenant.md)
- [Plano Anterior: Unificação Visual do Tenant (Plano A)](unificacao-tema-tenant-plan.md)
- [Regras de Migrations](../database/migration-rules.md)
- [Design System do OneElo (ODS)](../../ai-core/skills/oneelo-design-system/README.md)
- [Padrão de Formulários ODS](../../ai-core/skills/oneelo-design-system/FORM_STANDARD.md)
- [Decisões Arquiteturais](../architecture/decisions.md)
- [Decisões de RBAC e Autorização](../architecture/rbac-decisions.md)

---

## 1. Objetivo da Entrega

Permitir que administradores (`Role.ADMIN`) escolham a paleta oficial ou uma cor primária customizada (HEX) para representar a identidade visual de sua igreja em `/configuracoes`, propagando o tema dinamicamente — sem FOUC, sem Hydration Mismatch no React 19 e com contraste WCAG AA garantido — por todas as superfícies vinculadas ao tenant:
1. **Painel interno (`DashboardShell`):** sidebar escura em Obsidiana (`#09090b`) com destaques ativos na cor da igreja, botões primários (`bg-brand`), badges, abas, foco e `StatCard`s no miolo claro neutro (`#f9fafb` / `#ffffff`).
2. **Fluxos autenticados/contextuais da igreja:** `/login?igreja=[slug]`, `/activate/[token]`, `/onboarding` (incluindo `IOSInstallGuide`) e `/validar-carteirinha/[id]`.
3. **Portal público da igreja (`/[slug]` e domínio customizado):** home institucional, `/[slug]/cadastro` (`/join`), notícias e fallback Open Graph (`/og`), substituindo as classes `amber-*` de identidade visual por tokens semânticos dinâmicos (preservando avisos semânticos de alerta).
4. **Preservação absoluta da marca One Elo:** `/`, `/admin/*`, `/login` global e `/login/social-link` permanecem sempre em Índigo One Elo (`:root`), e a barra de status/navegador (`theme_color` do PWA e `<meta name="theme-color">`) permanece em Obsidiana (`#09090b`) para consistência visual em fundo escuro.

---

## 2. Contexto e Diagnóstico

1. **Infraestrutura semântica já concluída (`apps/web/src/app/globals.css`):**
   - A interface interna consome `--theme-brand*`, `--theme-accent-*`, `--theme-stat-brand-*` e `--theme-sidebar-*` via `[data-brand-theme="church"]` e `@theme inline`.
   - Em `globals.css:166-168`, `html:has(.public-site-root)::-webkit-scrollbar-thumb:hover` usa `#f59e0b` diretamente no `<html>`, acima do container `.public-site-root`.
2. **Lacunas no banco e endpoints (`apps/api`):**
   - `model Tenant` em `apps/api/prisma/schema.prisma` (`@@map("tb_tenant")`) ainda não possui `themePalette` (`theme_palette`) nem `primaryColor` (`primary_color`).
   - Seguindo o padrão de `apps/api/src/modules/auth/auth.controller.ts` (`POST /tenant/logo`, `PATCH /tenant/pwa-settings`), a rota protegida pelo `tenantId` do JWT com `@Roles(Role.ADMIN)` é `PATCH /api/auth/tenant/theme`.
   - Além de `AuthService.me` e `SolicitacoesCadastroService.getPublicTenantInfo` (`GET /api/public/tenants/:slug`), também precisam retornar `themePalette` e `primaryColor`:
     - `AuthService.createSessionForUser` e `SocialAuthService.createSessionForUser` (senão login/ativação/OAuth gravam cache PWA sem tema);
     - `AuthService.validateActivationToken` (para `/activate/[token]`);
     - `WebsiteService.getPublicSiteData` e `WebsiteService.getPublicNewsBySlug` (`website.service.ts` remonta `tenant` manualmente);
     - `DocumentsController.validateCarteirinha` (`igreja` em `/api/documents/validar/carteirinha/:id`);
     - `TenantMediaService` (`tenantLogoSelect`) e `AuthService.updateTenantPwaSettings` para payload uniforme em `/configuracoes`.
3. **Portal público e fluxos auth com `amber-*` residuais:**
   - `.public-site-root` em `globals.css` define `--site-accent`, porém 10 componentes em `components/public-site/*`, `app/[slug]/layout.tsx`, `app/(auth)/login/login-client.tsx` e `app/(auth)/activate/[token]/page.tsx` ainda possuem classes `amber-*` fixas.
   - O portal público alterna fundos escuros (`#09090b`) e fundos claros (`#faf9f6` / `#ffffff`): textos/ícones sobre fundo claro precisam usar `--theme-accent-ink*`, enquanto sobre `#09090b` precisam usar `--site-accent-text`.
   - Em `validar-carteirinha/[id]/page.tsx:118`, o subtítulo `"Igreja Emissora"` usa `text-sidebar-active-text` (`#09090b`) sobre `bg-sidebar-bg` (`#09090b`), devendo ser corrigido para `text-sidebar-badge-text`.
4. **Prevenção de FOUC, Hydration e Cache ISR:**
   - `DashboardLayout` instancia `<DashboardShell initialUser={null}>` no SSR; ler `localStorage` durante o render inicial causaria Hydration Mismatch no React 19, sendo necessário aplicar em `useLayoutEffect`/pós-mount ou pré-hidratação controlada no DOM sem divergência de árvore.
   - `pwa-branding.ts` precisa diferenciar `undefined` (campo omitido) de `null` explícito ao salvar no `localStorage`, permitindo restaurar o padrão sem ficar preso no tema anterior.
   - O portal público utiliza ISR `revalidate = 60` e tag `site-${slug}`; ao salvar o tema em `/configuracoes`, o frontend deve chamar `/api/site/revalidate` para atualização imediata.

---

## 3. Decisões de Arquitetura, Riscos e Engenharia

### 3.1. Modelagem de Dados (`schema.prisma`) e Paletas Curadas
- Adicionar ao `model Tenant` em `apps/api/prisma/schema.prisma`:
  - `themePalette`: `String? @map("theme_palette")` (`'amber-gold'`, `'royal-blue'`, `'emerald-green'`, `'burgundy-wine'`, `'royal-purple'`, `'terracotta'`, `'slate-graphite'`, `'custom'`; nulo significa padrão `'amber-gold'`).
  - `primaryColor`: `String? @map("primary_color")` (HEX `#rrggbb`, nulo significa padrão `#fbbf24`).
- Migration em inglês seguindo `ai-context/database/migration-rules.md`: `--name add_tenant_theme_fields`.
- Paletas curadas oficiais (compartilhadas entre frontend e backend):
  - `amber-gold` (`#fbbf24`), `royal-blue` (`#1d4ed8`), `emerald-green` (`#059669`), `burgundy-wine` (`#9f1239`), `royal-purple` (`#7c3aed`), `terracotta` (`#c2410c`), `slate-graphite` (`#475569`).

### 3.2. Motor Determinístico de Escala e Contraste WCAG AA (`apps/web/src/lib/brand-theme.ts`)
- Módulo puro de cálculo de cores (HEX ↔ RGB ↔ HSL + luminância relativa WCAG 2.1):
  - **Botão primário e item ativo da sidebar:** `--theme-brand`, `--theme-brand-hover`, `--theme-brand-foreground` (`#09090b` ou `#ffffff` pelo maior contraste WCAG), `--theme-brand-shadow`, `--theme-sidebar-active-bg` e `--theme-sidebar-active-text`.
  - **Superfícies claras (`#ffffff` / `#f9fafb` / `#faf9f6`):** derivar `--theme-accent-ink` e `--theme-accent-ink-hover` garantindo razão **≥ 4.5:1** contra branco (`#ffffff`), além de `--theme-accent-soft`, `--theme-accent-soft-hover`, `--theme-accent-soft-border`, `--theme-accent-ring`, `--theme-stat-brand-bg` e `--theme-stat-brand-text`. Inputs nativos claros (`checkbox`/`accent-*`) usam `--theme-accent-ink` para preservar contraste do checkmark.
  - **Superfícies escuras (`#09090b` da Sidebar e `.public-site-root`):**
    - Sidebar permanece em Obsidiana (`#09090b`), alterando apenas os tokens de destaque (`--theme-sidebar-active-bg`, `--theme-sidebar-active-text`, `--theme-sidebar-ring`, `--theme-sidebar-badge-bg`, `--theme-sidebar-badge-text`).
    - Derivar `--theme-sidebar-badge-text` e `--site-accent-text` clareando `L` automaticamente com piso de contraste **≥ 4.5:1** sobre `#09090b`.
    - Derivar `--site-accent`, `--site-accent-hover`, `--site-accent-foreground`, `--site-accent-tint`, `--site-accent-glow`, `--site-accent-border`, `--site-accent-border-strong` e `--site-accent-ring` (com piso de luminância para evitar bordas/tints invisíveis caso `custom` seja muito escuro como `#000000` ou quase branco como `#ffffff`).
    - Botões/ícones WhatsApp preservam `#25D366` oficial alterando apenas borda e anel de foco externos.

### 3.3. Contrato de API, RBAC e PWA (`apps/api`)
- **Endpoint protegido (`apps/api/src/modules/auth/auth.controller.ts`):**
  - `PATCH /api/auth/tenant/theme` com `@UseGuards(JwtAuthGuard)` e `@Roles(Role.ADMIN)` (`RolesGuard` ativo globalmente em `AppModule`).
  - DTO `UpdateTenantThemeDto` (`apps/api/src/modules/auth/dto/update-tenant-theme.dto.ts`):
    - `themePalette`: obrigatório dentro da lista permitida (`amber-gold`, `royal-blue`, `emerald-green`, `burgundy-wine`, `royal-purple`, `terracotta`, `slate-graphite`, `custom`).
    - `primaryColor`: obrigatório apenas/livre quando `themePalette === 'custom'` (ou opcional normalizado em `#rrggbb` `^#[0-9a-fA-F]{6}$`). Quando `themePalette !== 'custom'`, o backend **força/normaliza** a cor oficial da paleta correspondente para impedir inconsistência.
  - Grava alteração em `tb_tenant` filtrando pelo `user.tenantId` do token (ou `null` / valor explícito conforme padrão escolhido; persistir `'amber-gold'` / `'#fbbf24'` ao restaurar ou limpar para `null` com normalização explícita no cache) e registra `AuditLog` com `entidade: 'Tenant'` (padrão existente em `updateTenantPwaSettings`, `TenantMediaService` e `configuracoes/page.tsx`) e `acao: AcaoAuditoria.ATUALIZAR`.
- **Propagação nos endpoints existentes:**
  - `AuthService.me`, `AuthService.createSessionForUser`, `SocialAuthService.createSessionForUser`, `AuthService.validateActivationToken`, `SolicitacoesCadastroService.getPublicTenantInfo`, `WebsiteService.getPublicSiteData`, `WebsiteService.getPublicNewsBySlug`, `DocumentsController.validateCarteirinha`, `TenantMediaService` e `AuthService.updateTenantPwaSettings`.
- **PWA e `theme_color`:**
  - `apps/api/src/modules/pwa/pwa.service.ts` e `apps/web/src/lib/pwa-branding.ts` mantêm `theme_color: '#09090b'`.
  - `pwa-branding.ts` amplia `TenantPwaBranding` e `saveCachedTenantPwa` usando verificação explícita de chave definida (`!== undefined`) para suportar reset ao padrão sem sobrescrita pelo cache antigo.

### 3.4. Matriz de Riscos e Mitigações
| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Cor customizada muito clara ou muito escura tornar texto/borda ilegível | Alta | Alto | Motor WCAG ajusta luminosidade separadamente para fundo claro (`--theme-accent-ink`), botão (`--theme-brand-foreground`), fundo escuro (`--site-accent-text` / `--theme-sidebar-badge-text`) e limita piso de tints/bordas. |
| Contraste quebrado nas seções claras do site público ao migrar `amber-*` | Alta | Alto | Usar `--theme-accent-ink*` sobre `#faf9f6`/`#ffffff`, `--site-accent-text` sobre `#09090b`, e `selection:bg-[var(--site-accent)] selection:text-[var(--site-accent-foreground)]`. |
| Hydration Mismatch no React 19 / FOUC em `DashboardShell` | Alta | Médio | Atualizar estilo dinâmico no cliente pós-mount com `useLayoutEffect` / atribuição direta segura de CSS custom properties, preservando árvores SSR/CSR idênticas. |
| Cache ISR de 60s (`/[slug]`) exibir cor antiga após salvar | Alta | Médio | Acionar `POST /api/site/revalidate` após salvar tema em `/configuracoes`. |
| Reset de tema ficar preso no `localStorage` | Média | Médio | Checar `!== undefined` em `saveCachedTenantPwa` em vez de `??` para campos de tema. |
| Sobrescrita acidental de `amber-*` semântico de avisos/badges | Média | Baixo | Preservar caixas informativas/status semânticos (`amber-50/100/200/700` de alerta) em `public-join-client.tsx:293` e `onboarding/page.tsx:534`. |
| Vazamento do tema para rotas globais One Elo | Baixa | Alto | Tokens aplicados estritamente nos wrappers `data-brand-theme="church"` / `.public-site-root`; `:root`, `/` e `/admin/*` permanecem isolados em Índigo. |

---

## 4. Etapas de Desenvolvimento

> **Regra de Execução:** Atualizar cada checkbox imediatamente após sua conclusão, validando build/testes conforme especificado em cada etapa.

### Etapa 0 - Preparação, Branch e Baseline
Status: concluido

- [x] Confirmar estado da branch `development` alinhada com `origin/development`
- [x] Criar a branch `feature/tema-personalizado-tenant` a partir de `development`
- [x] Registrar baseline de tipos e build:
  - [x] Executar `npx.cmd -w apps/web tsc --noEmit`
  - [x] Executar `npm.cmd run build -w apps/api`
- [x] Critério de validação da etapa: Branch `feature/tema-personalizado-tenant` ativa sobre `development` e baseline verde (`tsc` e `nest build` sem erros).

### Etapa 1 - Schema Prisma, Migration e Endpoints de Tema (Backend)
Status: concluido

- [x] Atualizar `apps/api/prisma/schema.prisma`:
  - [x] Adicionar campos opcionais `themePalette` (`@map("theme_palette")`) e `primaryColor` (`@map("primary_color")`) ao model `Tenant`
- [x] Gerar e aplicar migration Prisma com nome em inglês (`npx.cmd prisma migrate dev --name add_tenant_theme_fields` e `npx.cmd prisma generate` em `apps/api`)
- [x] Criar utilitário compartilhado de paletas no backend (`apps/api/src/modules/auth/tenant-theme.constants.ts`) e DTO `apps/api/src/modules/auth/dto/update-tenant-theme.dto.ts` validando `themePalette` e `primaryColor` (`^#[0-9a-fA-F]{6}$`)
- [x] Atualizar `apps/api/src/modules/auth/auth.service.ts`:
  - [x] Incluir `themePalette` e `primaryColor` em `me`, `createSessionForUser`, `validateActivationToken` e `updateTenantPwaSettings`
  - [x] Implementar método `updateTenantTheme` isolado por `tenantId` normalizando presets oficiais e registrando `AuditLog` com `entidade: 'Tenant'`
- [x] Adicionar rota `PATCH /api/auth/tenant/theme` (`@Roles(Role.ADMIN)`) em `apps/api/src/modules/auth/auth.controller.ts`
- [x] Atualizar `apps/api/src/modules/auth/social-auth.service.ts` (`createSessionForUser`) para incluir `themePalette` e `primaryColor` em `user.tenant`
- [x] Atualizar `apps/api/src/common/storage/tenant-media.service.ts` (`tenantLogoSelect`) para incluir `themePalette` e `primaryColor`
- [x] Atualizar `apps/api/src/modules/membros/solicitacoes-cadastro.service.ts` (`getPublicTenantInfo`) com `themePalette` e `primaryColor`
- [x] Atualizar `apps/api/src/modules/website/website.service.ts` (`PUBLIC_TENANT_SELECT`, `getPublicSiteData` e `getPublicNewsBySlug`) com `themePalette` e `primaryColor`
- [x] Atualizar `apps/api/src/modules/documents/documents.controller.ts` (`validateCarteirinha`) para incluir `themePalette` e `primaryColor` em `igreja`
- [x] Criar/atualizar testes unitários em `apps/api/src/modules/auth/auth.service.spec.ts`, `apps/api/src/modules/website/website.service.spec.ts` e `apps/api/src/modules/membros/solicitacoes-cadastro.service.spec.ts` cobrindo validação/normalização de paleta/HEX, retorno nos endpoints, RBAC e `AuditLog` (`entidade: 'Tenant'`)
- [x] Critério de validação da etapa: `npx.cmd jest` nos specs afetados em `apps/api` e `npm.cmd run build -w apps/api` passando sem erros.

### Etapa 2 - Motor de Paletas, Contraste WCAG e Tokens CSS (Frontend)
Status: concluido

- [x] Atualizar `apps/web/src/types/index.ts` com `themePalette` e `primaryColor` em `Tenant` e `AuthUser['tenant']`
- [x] Atualizar `apps/web/src/components/public-site/join/tenant-public.ts` com `themePalette` e `primaryColor` em `PublicTenantInfo`
- [x] Atualizar `apps/web/src/lib/api-website.ts` com `themePalette` e `primaryColor` em `PublicSiteTenant` e `PublicNewsDetailResponse['tenant']`
- [x] Criar `apps/web/src/lib/brand-theme.ts`:
  - [x] Definir as 7 paletas curadas oficiais (`THEME_PALETTES`) e preset padrão `amber-gold` (`#fbbf24`)
  - [x] Implementar calculadora de escala e contraste WCAG AA (`--theme-brand*`, `--theme-accent-ink*`, `--theme-sidebar-*`, `--site-accent`, `--site-accent-hover`, `--site-accent-foreground`, `--site-accent-text`, `--site-accent-tint`, `--site-accent-glow`, `--site-accent-border`, `--site-accent-border-strong`, `--site-accent-ring`)
  - [x] Expor `buildTenantBrandThemeStyle(tenant)` e helper de cores inline para OG/Canvas garantindo contraste ≥ 4.5:1 e limites seguros em cores extremas
- [x] Criar testes unitários em `apps/web/src/lib/brand-theme.spec.ts` usando `node:test` validando contraste WCAG AA (≥ 4.5:1) para todas as paletas e casos extremos (`#000000`, `#ffffff`, `#fbbf24`, `#1d4ed8`, `#9f1239`)
- [x] Atualizar `apps/web/src/app/globals.css`:
  - [x] Adicionar defaults dos novos tokens `--site-accent-*` em `.public-site-root` e ajustar hover da scrollbar em `html:has(.public-site-root)` sem `#f59e0b` fixo
- [x] Atualizar `apps/web/src/lib/pwa-branding.ts`:
  - [x] Persistir e restaurar `themePalette` e `primaryColor` em `TenantPwaBranding` / `saveCachedTenantPwa` usando verificação `!== undefined` (mantendo `theme_color: '#09090b'`)
- [x] Critério de validação da etapa: `tsx --test src/lib/brand-theme.spec.ts` e `npx.cmd -w apps/web tsc --noEmit` passando sem erros.

### Etapa 3 - Injeção Dinâmica no Painel Interno e Fluxos Contextuais da Igreja (`apps/web`)
Status: concluido

- [x] Atualizar `apps/web/src/components/app/dashboard-shell.tsx`:
  - [x] Aplicar variáveis dinâmicas do tema da igreja de forma segura contra Hydration Mismatch (lendo cache em `useLayoutEffect` e atualizando imediatamente com `user.tenant`)
- [x] Atualizar `apps/web/src/app/(auth)/login/login-client.tsx`:
  - [x] Injetar `buildTenantBrandThemeStyle(church)` quando `isChurchBranded` e substituir as classes `amber-*` fixas por tokens dinâmicos (`--site-accent*`), preservando `/login` global em Índigo
- [x] Atualizar `apps/web/src/app/(auth)/activate/[token]/page.tsx`:
  - [x] Incluir `themePalette`/`primaryColor` em `ActivationDetails['tenant']`, injetar `buildTenantBrandThemeStyle(details?.tenant)` e substituir as classes `amber-*` fixas por tokens `--site-accent*`
- [x] Atualizar `apps/web/src/app/onboarding/page.tsx`:
  - [x] Injetar `buildTenantBrandThemeStyle(user?.tenant ?? cachedTenant)` no `<main>` principal e no `<IOSInstallGuide>` quando em tema da igreja
- [x] Atualizar `apps/web/src/app/validar-carteirinha/[id]/page.tsx`:
  - [x] Incluir `themePalette`/`primaryColor` em `ValidacaoResponse['igreja']`, injetar `buildTenantBrandThemeStyle(data?.igreja)` e corrigir `text-sidebar-active-text` para `text-sidebar-badge-text` no cabeçalho
- [x] Critério de validação da etapa: `npx.cmd -w apps/web tsc --noEmit` verde; rotas `/`, `/login` (sem igreja) e `/admin/*` intactas em Índigo One Elo e fluxos vinculados à igreja assumindo a paleta configurada sem Hydration Warning.

### Etapa 4 - Portal Público Dinâmico (`/[slug]`, `/cadastro`, `public-site/*` e Open Graph)
Status: concluido

- [x] Atualizar `apps/web/src/app/[slug]/layout.tsx`:
  - [x] Injetar `style={buildTenantBrandThemeStyle(site.tenant)}` diretamente no wrapper SSR com `data-brand-theme="church"` e trocar `selection:bg-amber-400 selection:text-zinc-950` por `selection:bg-[var(--site-accent)] selection:text-[var(--site-accent-foreground)]`
- [x] Atualizar `apps/web/src/app/[slug]/og/route.tsx` para usar a cor da igreja com contraste calculado no card fallback quando não houver logo
- [x] Migrar `amber-*` de identidade visual (preservando avisos semânticos de alerta na caixa de próximo passo e `#25D366` do WhatsApp) em `apps/web/src/components/public-site/join/public-join-client.tsx` (usando `--theme-accent-ink*` nos campos/abas claros e `--site-accent*` no cabeçalho/botão)
- [x] Migrar classes `amber-*` para `--site-accent*` em `apps/web/src/components/public-site/site-header.tsx`
- [x] Migrar classes `amber-*` para `--site-accent*` em `apps/web/src/components/public-site/site-hero.tsx`
- [x] Migrar classes `amber-*` para `--site-accent*` em `apps/web/src/components/public-site/site-schedules-section.tsx`
- [x] Migrar classes `amber-*` para `--theme-accent-ink*` (seção clara) e `--site-accent*` (badges escuros) em `apps/web/src/components/public-site/site-news-section.tsx`
- [x] Migrar classes `amber-*` para `--theme-accent-ink*` (seção clara) e `--site-accent*` (destaques escuros) em `apps/web/src/components/public-site/site-about-section.tsx`
- [x] Migrar classes `amber-*` para `--theme-accent-ink*` (seção clara) e `--site-accent*` (botão escuro) em `apps/web/src/components/public-site/site-welcome-section.tsx`
- [x] Migrar classes `amber-*` para `--theme-accent-ink*` (textos claros) e `--site-accent*` (cards escuros) em `apps/web/src/components/public-site/site-location-section.tsx`
- [x] Migrar classes `amber-*` para `--site-accent*` em `apps/web/src/components/public-site/site-footer.tsx`
- [x] Migrar classes `amber-*` de borda/foco para `--site-accent*` mantendo ícone `#25D366` em `apps/web/src/components/public-site/site-whatsapp-float.tsx`
- [x] Critério de validação da etapa: Zero classes `amber-*` de marca residuais em `apps/web/src/components/public-site/`, `apps/web/src/app/[slug]/`, `login-client.tsx` e `activate/[token]/page.tsx`; `npx.cmd -w apps/web tsc --noEmit` verde.

### Etapa 5 - Seletor de Identidade Visual, Preview e Revalidação em `/configuracoes` (Frontend ODS)
Status: concluido

- [x] Criar componente `apps/web/src/components/app/tenant-theme-settings.tsx` seguindo `FORM_STANDARD.md` / ODS:
  - [x] Exibir as 7 paletas curadas em cards selecionáveis com `aria-pressed`, amostra (`forced-color-adjust: none`), nome e descrição
  - [x] Oferecer modo **Cor customizada** com `<input type="color">` + campo HEX (`#RRGGBB`) controlado e validado em tempo real
  - [x] Exibir **Preview em Tempo Real** (mini sidebar escura com item ativo, botão primário, badge sobre claro e destaque sobre fundo escuro) usando `buildTenantBrandThemeStyle` antes mesmo de salvar
  - [x] Incluir ação **"Restaurar padrão (Âmbar)"**, estados de loading/erro inline e persistência via `PATCH /api/auth/tenant/theme`
- [x] Integrar `TenantThemeSettings` em `apps/web/src/app/(dashboard)/configuracoes/page.tsx`:
  - [x] Exibir apenas para `Role.ADMIN` junto aos blocos de identidade visual (Logo / PWA)
  - [x] Atualizar estado do shell imediatamente via `setShellUser` + `saveCachedTenantPwa` + revalidação ISR (`POST /api/site/revalidate`) + `router.refresh()` ao salvar
- [x] Critério de validação da etapa: `npx.cmd -w apps/web tsc --noEmit` e `npm.cmd run build -w apps/web` verdes.

### Etapa 6 - Documentação, Testes Integrados, Merge em `development` e Validação Final
Status: concluido

- [x] Atualizar `ai-context/backlog/tema-personalizado-tenant.md` marcando status concluído e alinhando as decisões técnicas implementadas
- [x] Atualizar todos os checkboxes de `ai-context/plans/tema-personalizado-tenant-plan.md` para `[x]` e `Status geral: concluido`
- [x] Atualizar entrada do plano no índice `ai-context/plans/README.md`
- [x] Executar bateria de testes (`npm.cmd test -w apps/api` e `npx.cmd tsx --test src/lib/brand-theme.spec.ts src/lib/auth-redirect.spec.ts src/lib/calendar-url-builder.spec.ts`) e ESLint nos arquivos implementados
- [x] Executar verificação de tipos e build de produção (`npx.cmd -w apps/web tsc --noEmit`, `npm.cmd run build -w apps/web`, `npm.cmd run build -w apps/api`)
- [x] Validar fluxo completo ponta a ponta em navegador (desktop e mobile `390x844`): trocar tema em `/configuracoes`, validar painel + sidebar + `/[slug]` + `/[slug]/cadastro` + `/login?igreja=[slug]` + `/validar-carteirinha/[id]` com contraste legível e confirmar `/` e `/admin` preservados em Índigo One Elo
- [x] Commitar alterações na branch `feature/tema-personalizado-tenant` e atualizar a branch `development` com o trabalho concluído
- [x] Critério de validação da etapa: Builds, testes unitários e validação ponta a ponta no navegador aprovados e `development` atualizada.

---

## 5. Critérios de Aceite Gerais

- [x] Administradores da igreja (`ADMIN`) podem escolher uma das 7 paletas curadas ou informar um código HEX customizado em `/configuracoes`, visualizar o preview antes de salvar e restaurar o padrão a qualquer momento.
- [x] A alteração é persistida via `PATCH /api/auth/tenant/theme` isolada ao `tenantId` do usuário autenticado, com normalização de presets no servidor e registrada em `AuditLog` (`entidade: 'Tenant'`).
- [x] Todas as combinações de cor escolhidas mantêm contraste legível (**WCAG AA ≥ 4.5:1**) tanto em fundos claros (`--theme-accent-ink*`) quanto em botões (`--theme-brand-foreground` / `--site-accent-foreground`) e superfícies escuras (`--site-accent-text` e `--theme-sidebar-badge-text`).
- [x] A Sidebar do painel permanece em Obsidiana (`#09090b`) com destaques ativos na cor da igreja, e o `theme_color` do PWA / `<meta name="theme-color">` permanece `#09090b`.
- [x] O portal público (`/[slug]`), `/[slug]/cadastro`, `/login?igreja=[slug]`, `/activate/[token]`, `/onboarding` e `/validar-carteirinha/[id]` refletem fielmente a cor configurada pela igreja sem Hydration Mismatch no React 19, com cache ISR revalidado imediatamente após salvar.
- [x] Rotas sem vínculo de igreja (`/`, `/admin/*`, `/login` global, `/login/social-link`) permanecem integralmente em Índigo One Elo.
