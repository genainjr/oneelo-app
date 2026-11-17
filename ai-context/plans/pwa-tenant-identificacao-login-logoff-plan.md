# Plano - Correção de Identificação do Tenant no PWA, Manifesto, Login e Logoff

Status geral: concluido  
Data de criação: 2026-11-17  
Branch sugerida para implementação: fix/pwa-tenant-identificacao-login-logoff  

## Planos e Referências Relacionados

- [tenant-pwa-identity-plan.md](tenant-pwa-identity-plan.md)
- [unificacao-tema-tenant-plan.md](unificacao-tema-tenant-plan.md)
- [README.md](README.md)

---

## 1. Objetivo da Entrega

Garantir que o PWA instalado para uma igreja mantenha permanentemente a identificação e o tema visual do tenant (Obsidiana + Âmbar) em todo o ciclo de vida no iPhone, Android e Desktop: abertura do app (`start_url`), redirecionamento do middleware quando deslogado, login, navegação interna e logoff — eliminando a regressão em que a tela ficava azul (tema padrão One Elo) após fazer login e logoff.

---

## 2. Contexto e Diagnóstico

1. **Manifesto PWA sem identificação do tenant na `start_url` (`apps/api/src/modules/pwa/pwa.service.ts`):**
   - O manifesto personalizado (`/api/pwa/:slug/manifest.webmanifest`) herdava `start_url: '/dashboard?source=pwa'` sem o parâmetro `?igreja=${slug}`.
2. **Middleware descartando `?igreja=` ao redirecionar para `/login` (`apps/web/src/middleware.ts`):**
   - Ao interceptar `/dashboard` sem cookie `access_token`, o middleware redirecionava para `/login?redirect=%2Fdashboard` sem repassar `?igreja=`, levando o PWA para a tela azul genérica do One Elo.
   - Em domínios customizados (`ccrv.org.br`), acessos diretos a `/login` ou `/dashboard` também redirecionavam para a origem canônica sem anexar `?igreja=${slug}`.
3. **Deleção acidental do cache do tenant no Login e no Logoff (`apps/api/src/modules/auth/auth.service.ts`, `apps/web/src/app/(auth)/login/login-client.tsx` e `apps/web/src/components/app/sidebar.tsx`):**
   - O endpoint `POST /api/auth/login` (`createSessionForUser`) retornava `user` apenas com `tenantId` e `tenantNome`, sem o objeto `user.tenant`.
   - Em seguida, `login-client.tsx` chamava `saveCachedTenantPwa(response.user?.tenant)` passando `undefined`, o que executava `localStorage.removeItem('oneelo:tenant-pwa-meta')` e apagava o cache do tenant no exato momento do login.
   - Ao fazer logoff logo em seguida (ou se `handleLogout` rodasse antes/depois), `clearCachedTenantPwa()` removia qualquer rastro do tenant no aparelho, fazendo a tela de login perder a referência da igreja e ficar azul.
4. **Ausência de fallback client-side e metadados PWA em `/login?igreja=...` (`apps/web/src/app/(auth)/login/page.tsx` e `login-client.tsx`):**
   - `LoginClient` dependia exclusivamente de `initialChurch` vindo do SSR para ativar `isChurchBranded`. Se o PWA abrisse `/login` sem query string (mas com tenant salvo no cache local do PWA) ou se o SSR oscilasse, a tela caía no tema azul.
   - A página `/login?igreja=...` não incluía `manifest` nem `appleWebApp` da igreja no `<head>`.

---

## 3. Decisões de Arquitetura, Riscos e Engenharia

1. **URL Inicial Identificada no Manifesto PWA:**
   - Em `PwaService.getManifest`, incluir `slug: true` na consulta do tenant e emitir `start_url: '/dashboard?source=pwa&igreja=${encodeURIComponent(tenant.slug)}'`.
   - Incrementar `TENANT_MANIFEST_REVISION` de `'4'` para `'5'` no backend e no frontend para atualizar instalações existentes.
2. **Preservação do Contexto da Igreja no Middleware:**
   - Quando `!token` em rotas protegidas, se houver `igreja` ou `church` na query string da requisição, preservá-la no redirect para `/login?igreja=...&redirect=...`.
   - Em domínios customizados (`!isSystemHost`), ao redirecionar `/login`, `/dashboard` ou `/configuracoes` para o host canônico, resolver o `slug` do domínio e anexar `?igreja=${slug}` caso ainda não esteja presente.
3. **Retorno Completo de `user.tenant` na Sessão e Persistência Segura no Cache PWA:**
   - Incluir o objeto `tenant` (`nome`, `slug`, `logoUrl`, `pwaShortName`, `pwaIconUrl`, `pwaIconKey`, `pwaUpdatedAt`) no retorno de `createSessionForUser` em `auth.service.ts` e `social-auth.service.ts`.
   - Em `saveCachedTenantPwa`, nunca apagar o cache existente quando receber `undefined`; limpar apenas quando explicitamente chamado para `SUPER_ADMIN`.
   - Em `handleLogout` (`sidebar.tsx`), preservar o cache do tenant para usuários de igreja e garantir que o redirect de logoff sempre leve para `/login?igreja=${tenantSlug}`.
4. **Resiliência e Metadados PWA na Tela de Login:**
   - Em `login-client.tsx`, usar estado `church` com fallback automático para `churchSlug` da URL e para `readCachedTenantPwa()`, buscando `/api/public/tenants/:slug` no cliente quando necessário e mantendo `isChurchBranded = true` (tema amarelo/obsidiana) desde o primeiro frame.
   - Em `login/page.tsx` e `[slug]/layout.tsx`, expor `manifest` e ícones Apple da igreja no `generateMetadata`.

---

## 4. Etapas de Desenvolvimento

> **Regra de Execução:** O desenvolvimento deve avançar estritamente etapa por etapa. Ao concluir uma tarefa ou etapa, atualize imediatamente seu checkbox para `[x]`, apresente o resumo das validações e aguarde a autorização explícita do usuário antes de iniciar a etapa seguinte.

### Etapa 0 - Preparação e Isolamento da Branch
Status: concluido

- [x] Confirmar branch `fix/pwa-tenant-identificacao-login-logoff` criada a partir de `development`.
- [x] Registrar plano de desenvolvimento segundo o template oficial.
- [x] Critério de validação da etapa: Branch criada e plano documentado.

### Etapa 1 - Backend: Manifesto PWA com `igreja` na `start_url` e `user.tenant` no Login
Status: concluido

- [x] Atualizar `apps/api/src/modules/pwa/pwa.service.ts`:
  - [x] Incluir `slug: true` na consulta do tenant e definir `start_url: '/dashboard?source=pwa&igreja=' + encodeURIComponent(tenant.slug)`.
  - [x] Atualizar `TENANT_MANIFEST_REVISION` para `'5'`.
- [x] Atualizar `apps/api/src/modules/pwa/pwa.service.spec.ts`:
  - [x] Validar `start_url` com `?igreja=comunidade` e revisão `'5'`.
- [x] Atualizar `apps/api/src/modules/auth/auth.service.ts` e `apps/api/src/modules/auth/social-auth.service.ts`:
  - [x] Incluir dados de `tenant` (`nome`, `slug`, `logoUrl`, `pwaShortName`, `pwaIconUrl`, `pwaIconKey`, `pwaUpdatedAt`) no retorno de `createSessionForUser`.
- [x] Critério de validação da etapa: Testes unitários de `pwa.service.spec.ts` e `auth.service.spec.ts` passando com código 0.

### Etapa 2 - Frontend: Preservação do Tenant no Middleware, Cache PWA, Login e Logoff
Status: concluido

- [x] Atualizar `apps/web/src/middleware.ts`:
  - [x] Preservar parâmetro `igreja` / `church` ao redirecionar usuários não autenticados para `/login`.
  - [x] Anexar `igreja=${slug}` ao redirecionar `/login`, `/dashboard` ou `/configuracoes` a partir de um domínio customizado.
- [x] Atualizar `apps/web/src/lib/pwa-branding.ts`:
  - [x] Atualizar `TENANT_MANIFEST_REVISION` para `'5'`.
  - [x] Incluir `logoUrl` no cache `oneelo:tenant-pwa-meta` e evitar remoção acidental quando `tenant` for `undefined`.
- [x] Atualizar `apps/web/src/components/app/sidebar.tsx`:
  - [x] Preservar o cache do tenant no logoff de usuários de igreja (limpando apenas para `SUPER_ADMIN`) e garantir redirecionamento para `/login?igreja=${slug}`.
- [x] Atualizar `apps/web/src/app/(auth)/login/page.tsx`, `apps/web/src/app/(auth)/login/login-client.tsx` e `apps/web/src/app/[slug]/layout.tsx`:
  - [x] Adicionar `manifest` e ícones Apple da igreja em `generateMetadata` de `login/page.tsx` e `[slug]/layout.tsx`.
  - [x] Adicionar fallback em `LoginClient` para `churchSlug` e `readCachedTenantPwa()`, mantendo o tema amarelo/obsidiana (`isChurchBranded`) e sincronizando o head do PWA.
- [x] Critério de validação da etapa: Fluxos de abertura do PWA, login e logoff mantendo 100% a identificação e o tema amarelo da igreja.

### Etapa 3 - Testes, Build e Publicação
Status: concluido

- [x] Executar testes unitários do backend (`pwa.service.spec.ts`, `auth.service.spec.ts`) e frontend (`auth-redirect.spec.ts`).
- [x] Executar build de produção do frontend (`npm run build --prefix apps/web`).
- [x] Realizar commit, merge e push para `development` e `main`.
- [x] Critério de validação da etapa: Build e testes concluídos sem erros e alterações publicadas em `development` e `main`.

---

## 5. Critérios de Aceite Gerais

- [x] O manifesto `/api/pwa/:slug/manifest.webmanifest` retorna `start_url: "/dashboard?source=pwa&igreja=<slug>"`.
- [x] Ao abrir o PWA sem sessão ativa, o middleware redireciona para `/login?igreja=<slug>&redirect=%2Fdashboard` (tema amarelo da igreja).
- [x] Ao fazer login, o cache do tenant no PWA é atualizado com `slug` e dados do tenant, nunca apagado.
- [x] Ao fazer logoff no PWA ou no navegador, o usuário retorna para `/login?igreja=<slug>` mantendo o tema amarelo/obsidiana da igreja.
- [x] Testes automatizados e build de produção passando com código 0.
