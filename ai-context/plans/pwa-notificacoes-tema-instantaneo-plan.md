# Plano - Eliminação do Delay e Flash de Cores Padrão na Tela de Autorização de Notificações do PWA

Status geral: concluido  
Data de criação: 2026-11-19  
Branch sugerida para implementação: fix/pwa-notificacoes-tema-instantaneo  

## Planos e Referências Relacionados

- [Template Oficial de Planos](PLAN_TEMPLATE.md)
- [Plano: Personalização de Cores e Identidade Visual da Igreja (FT-022)](tema-personalizado-tenant-plan.md)
- [Plano: Correção de Identificação do Tenant no PWA, Manifesto, Login e Logoff](pwa-tenant-identificacao-login-logoff-plan.md)
- [Decisões Arquiteturais](../architecture/decisions.md)

---

## 1. Objetivo da Entrega

Eliminar o atraso visual (*delay*) e a exibição temporária de cores padrão (Âmbar `#fbbf24` ou Índigo `#4f46e5`) quando o usuário abre o PWA recém-instalado e visualiza a tela/modal para autorizar notificações, garantindo que a interface e o modal de permissão já nasçam desde o primeiro frame com as cores, paleta e identidade visual exatas do tenant.

---

## 2. Contexto e Diagnóstico

1. **Modal de permissão push disparando antes do usuário e tema carregarem (`apps/web/src/components/app/notification-bell-inbox.tsx`):**
   - `NotificationBellInbox` é renderizado dentro de `Header` -> `DashboardShell` e executa `checkPush()` (`getPushStatus()`) imediatamente no mount, sem observar `user` ou `loadingUser` de `useAuthUser()`.
   - Como `getPushStatus()` lê apenas APIs locais do navegador (`Notification.permission`, `navigator.serviceWorker.register('/sw.js')`, `getSubscription()`), ele resolve em poucos milissegundos e abre o modal `"Ativar notificações no celular?"` enquanto `/api/auth/me` ainda está em andamento.
2. **Ausência de tema do tenant no SSR (`apps/web/src/app/(dashboard)/layout.tsx` e `apps/web/src/app/onboarding/page.tsx`):**
   - O `DashboardLayout` instancia `<DashboardShell initialUser={null}>` sem passar variáveis iniciais de tema no SSR.
   - O cache `oneelo:tenant-pwa-meta` fica apenas em `localStorage`, inacessível ao servidor Next.js e vazio quando o PWA standalone é recém-instalado no iOS (que isola o `localStorage` do Safari) ou quando a autenticação ocorre via OAuth Google.
   - Sem cache disponível durante o carregamento de `/api/auth/me`, `DashboardShell` injeta `AMBER_DEFAULT_THEME` (`#fbbf24`) e só atualiza para as cores reais do tenant segundos depois (quando `/api/auth/me` retorna do backend).
   - Em `/onboarding`, `cachedTenant` inicia como `null` (atualizado de forma assíncrona via `Promise.resolve().then(...)`) e deixa `brandTheme` como `undefined` (`:root` Índigo One Elo `#4f46e5`) até `user` carregar.
3. **Latência evitável em `AuthService.me` e redirecionamento do Middleware:**
   - `AuthService.me` (`apps/api/src/modules/auth/auth.service.ts`) executava `prisma.user.findFirst` e `prisma.financePermission.count` sequencialmente em vez de paralelo.
   - O `middleware.ts` não propagava `?igreja=<slug>` do `start_url` do PWA via header interno para o SSR resolver o tema no primeiro acesso sem cookie, nem preservava `?igreja=` ao redirecionar usuário `BASIC` para `/personal-panel`.

---

## 3. Decisões de Arquitetura, Riscos e Engenharia

1. **Cookie Leve de Identidade Visual (`oneelo_tenant_brand`):**
   - Sincronizar um cookie não-`httpOnly` leve (`slug`, `nome`, `logoUrl`, `pwaIconUrl`, `themePalette`, `primaryColor`) com `Path=/; Max-Age=2592000; SameSite=Lax`:
     - No cliente via `saveCachedTenantPwa` / `clearCachedTenantPwa` (`apps/web/src/lib/pwa-branding.ts`);
     - No backend (`apps/api/src/modules/auth/auth.controller.ts` em `login`, `activateWithPassword`, `handleGoogleCallback`, `confirmGoogleLink`, `me`, `logout`, e `super-admin.controller.ts` no login admin).
   - Permite leitura instantânea (0ms, zero chamadas de rede adicionais na navegação) pelo SSR em `(dashboard)/layout.tsx` e `/onboarding/page.tsx`, mantendo intacta a otimização do commit `087f757`.
2. **Fallback SSR para `?igreja=` no Primeiro Acesso do PWA (`middleware.ts` + Layouts):**
   - Encaminhar `x-oneelo-church-slug` em `middleware.ts` quando `?igreja=` / `?church=` estiver presente na query (ex.: `start_url` do PWA) e preservar `?igreja=` no redirect `BASIC` -> `/personal-panel`.
   - Caso o cookie `oneelo_tenant_brand` ainda não exista (ou seja de outro slug) e `x-oneelo-church-slug` esteja presente, o layout SSR consulta `getPublicTenantInfoServer(slug)` apenas nessa primeira carga.
3. **Sincronização Pré-Render e Bloqueio Seguro do Modal em `NotificationBellInbox`:**
   - `DashboardShell` e `OnboardingClient` aplicam `style={buildTenantBrandThemeStyle(effectiveTenant)}` diretamente na renderização SSR/CSR inicial usando `initialTenantBrand` (sem Hydration Mismatch no React 19).
   - `NotificationBellInbox` aguarda `!loadingUser && Boolean(user)` antes de abrir o modal automático `"Ativar notificações no celular?"`, impedindo abertura prematura sobre skeleton ou troca repentina de cores.
4. **Paralelização de Queries em `AuthService.me`:**
   - Executar `user.findFirst` e `financePermission.count` em paralelo via `Promise.all` para reduzir a latência do carregamento inicial do usuário autenticado.

---

## Etapas de Desenvolvimento

### Etapa 0 - Preparação e Criação da Branch
Status: concluido

- [x] Confirmar estado limpo na branch `development` e atualizar com `origin/development`.
- [x] Criar a branch `fix/pwa-notificacoes-tema-instantaneo` a partir de `development`.
- [x] Critério de validação da etapa: Branch criada e plano estruturado conforme `PLAN_TEMPLATE.md`.

### Etapa 1 - Cookie de Tema no Backend e Otimização de `AuthService.me`
Status: concluido

- [x] Atualizar `apps/api/src/modules/auth/auth.service.ts`:
  - [x] Paralelizar consultas de `user.findFirst` e `financePermission.count` em `me()`.
- [x] Atualizar `apps/api/src/modules/auth/auth.controller.ts`:
  - [x] Criar helpers para gravar e limpar o cookie leve `oneelo_tenant_brand` nas respostas autenticadas (`login`, `activateWithPassword`, `handleGoogleCallback`, `confirmGoogleLink`, `me`) e limpar em `logout` apenas para `SUPER_ADMIN`.
- [x] Atualizar `apps/api/src/modules/super-admin/super-admin.controller.ts`:
  - [x] Limpar cookie `oneelo_tenant_brand` no login de `SUPER_ADMIN`.
- [x] Critério de validação da etapa: Testes unitários de `auth.service.spec.ts` e `auth.controller.pwa.spec.ts` passando sem regressão.

### Etapa 2 - Persistência Dual (`localStorage` + Cookie) e Resolução SSR do Tema
Status: concluido

- [x] Criar módulo compartilhado de parsing/serialização do cookie de marca do tenant (`apps/web/src/lib/tenant-brand-cookie.ts`) com testes unitários (`apps/web/src/lib/tenant-brand-cookie.spec.ts`).
- [x] Atualizar `apps/web/src/lib/pwa-branding.ts`:
  - [x] Sincronizar `oneelo_tenant_brand` no `document.cookie` dentro de `saveCachedTenantPwa` e remover dentro de `clearCachedTenantPwa`.
- [x] Criar helper server-side `apps/web/src/lib/server-tenant-brand.ts` para ler `oneelo_tenant_brand` via `cookies()` (0ms) com fallback opcional para `x-oneelo-church-slug` / `searchParams.igreja`.
- [x] Atualizar `apps/web/src/middleware.ts`:
  - [x] Encaminhar header `x-oneelo-church-slug` quando `?igreja=` ou `?church=` estiver presente e preservar `?igreja=` ao redirecionar usuário `BASIC` para `/personal-panel`.
- [x] Atualizar `apps/web/src/app/(auth)/activate/[token]/page.tsx`:
  - [x] Salvar `details.tenant` no cache PWA antes do redirect para OAuth Google.
- [x] Critério de validação da etapa: Helpers validados via testes unitários e contratos tipados sem erros.

### Etapa 3 - Renderização Instantânea no SSR e Atraso Zero nas Telas de Notificações
Status: concluido

- [x] Atualizar `apps/web/src/app/(dashboard)/layout.tsx`:
  - [x] Exportar `viewport` com `themeColor: '#09090b'` para evitar barra azul inicial em `/dashboard`.
  - [x] Ler `resolveServerTenantBrand()` e passar `initialTenantBrand` para `<DashboardShell />`.
- [x] Atualizar `apps/web/src/components/app/dashboard-shell.tsx`:
  - [x] Aceitar `initialTenantBrand` e aplicar `style={buildTenantBrandThemeStyle(effectiveTenant)}` diretamente na renderização inicial SSR/CSR mantendo reconciliação em `useIsomorphicLayoutEffect`.
  - [x] Repassar `fallbackTenant` ao `<Sidebar />`.
- [x] Atualizar `apps/web/src/components/app/sidebar.tsx`:
  - [x] Aceitar `fallbackTenant` para exibir nome e ícone da igreja sem flash genérico durante carregamento.
- [x] Atualizar `apps/web/src/components/app/notification-bell-inbox.tsx`:
  - [x] Consumir `useAuthUser()` e aguardar `!loadingUser && Boolean(user)` antes de abrir o modal automático de autorização push.
- [x] Refatorar `apps/web/src/app/onboarding/page.tsx` + criar `apps/web/src/app/onboarding/onboarding-client.tsx`:
  - [x] Resolver `initialTenantBrand`, `generateViewport` e `generateMetadata` no servidor, aplicar tema/logo do tenant imediatamente sem renderização prévia em Índigo One Elo.
- [x] Critério de validação da etapa: Typecheck e build de produção de `apps/web` concluídos com código 0 e zero flash de cores padrão ao abrir o PWA.

### Etapa 4 - Validação Integrada, Testes e Publicação
Status: concluido

- [x] Executar testes unitários do backend (`npm test --prefix apps/api`) e frontend (`node --test`).
- [x] Executar build completo de `apps/api` e `apps/web`.
- [x] Atualizar checkboxes deste plano e registrar status `Concluído` no índice `ai-context/plans/README.md`.
- [x] Realizar commit organizado na branch e integrar em `development`.
- [x] Critério de validação da etapa: Todos os testes e builds verdes com código 0 e branch publicada em `origin/development`.

---

## Critérios de Aceite Gerais

- [x] Ao abrir o PWA recém-instalado (em `/dashboard`, `/personal-panel` ou `/onboarding`), o HTML inicial já aplica as cores exatas do tenant sem exibir Azul One Elo nem Amarelo padrão temporariamente.
- [x] O modal `"Ativar notificações no celular?"` em `NotificationBellInbox` nunca abre antes do tema e do usuário autenticado estarem resolvidos.
- [x] Navegações subsequentes dentro do `(dashboard)` não adicionam requisições bloqueantes de SSR (leitura apenas de cookie em 0ms).
- [x] Super Admin (`/admin/*`) e páginas públicas globais (`/`, `/login` sem `?igreja=`) mantêm a identidade visual Índigo One Elo intacta.
- [x] Testes automatizados e builds de produção passando sem erros.
