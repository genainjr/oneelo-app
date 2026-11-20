# Plano - Acesso ao Painel Pessoal para Administradores e Liderança Geral (FT-020)

Status geral: concluido  
Data de criação: 2026-11-19  
Branch sugerida para implementação: feature/painel-pessoal-administrador  

## Planos e Referências Relacionados

- [Template Oficial de Planos](PLAN_TEMPLATE.md)
- [Backlog FT-020: Painel Pessoal para Administradores](../backlog/painel-pessoal-administrador.md)
- [Plano Base: Painel Pessoal do Usuário BASIC](painel-pessoal-basic-plan.md)
- [Decisões Arquiteturais](../architecture/decisions.md)
- [Decisões de RBAC e Autorização](../architecture/rbac-decisions.md)
- [Design System do OneElo (ODS)](../../ai-core/skills/oneelo-design-system/README.md)

---

## 1. Objetivo da Entrega

Disponibilizar o acesso completo ao **Painel Pessoal (`/personal-panel`)** para administradores e liderança geral (`ADMIN` e `STAFF`) que possuam `Membro` vinculado, mantendo o **Dashboard Geral (`/dashboard`) sempre em 1º lugar** na navegação lateral e na entrada pós-login/PWA.

Com esta entrega:
1. **Dashboard sempre primeiro para `ADMIN`/`STAFF`:** O redirecionamento padrão pós-login (tradicional, OAuth Google e `start_url` do PWA) mantém `ADMIN` e `STAFF` entrando sempre em `/dashboard`, preservando `/personal-panel` para `BASIC`, `/admin` para `SUPER_ADMIN` e links diretos (`?redirect=`, exceto `/personal-panel` para quem não tem membro vinculado).
2. **Sidebar clara com hierarquia consistente (`apps/web/src/components/app/sidebar.tsx`):**
   - No topo do menu administrativo (`ADMIN`/`STAFF`), **Dashboard** ocupa sempre a **1ª posição** e **Painel Pessoal** aparece logo abaixo em **2ª posição** (apenas quando o usuário possui `Membro` ativo vinculado) antes do grupo `Gestão`.
   - A habilitação de **Minhas Escalas** na sidebar também passa a considerar `user.memberId` para `ADMIN`/`STAFF` que possuam escalas vinculadas.
   - O grupo `Conta` permanece dedicado a `Minhas Escalas` (condicional), `Meu Perfil`, `Notificações`, `Site` e `Configurações`.
3. **Dados pessoais fiéis em `/personal-panel` para `ADMIN`/`STAFF`:**
   - O resumo de liderança no Painel Pessoal passa a refletir estritamente os ministérios em que o administrador/staff atua como `LEADER` ou `ASSISTANT_LEADER` (sem vazar números globais da igreja para os cards pessoais).
   - O administrador com membro vinculado visualiza sua **Carteirinha Digital**, **Próxima Escala**, **Pendências**, **Exportação para Agenda** e **Liderança**.
   - Quando um `ADMIN`/`STAFF` não possuir `Membro` vinculado (`!user?.membro?.id`), o item `Painel Pessoal` fica oculto na Sidebar e qualquer acesso direto a `/personal-panel` redireciona para `/dashboard`.

---

## 2. Contexto e Diagnóstico

1. **Bloqueio de navegação na Sidebar (`apps/web/src/components/app/sidebar.tsx`):**
   - Hoje `navItems` (`ADMIN`/`STAFF`) exibe apenas `/dashboard` no topo e `/meu-perfil` em `groupAccount`; `/personal-panel` e `/minhas-escalas` existem somente em `basicNavItems`.
   - `useMinhasEscalas` e `useEscalasVisualizacao` na sidebar possuem `enabled: user?.role === 'BASIC'`, impedindo `ADMIN`/`STAFF` de ver `Minhas Escalas` quando participam como voluntários.
2. **Travas por `role === 'BASIC'` em `/personal-panel` (`apps/web/src/app/(dashboard)/personal-panel/page.tsx`):**
   - Linhas 151 e 163 abortam o fetch de `/api/ministerios/resumo` e `/api/escalas` quando `user?.role !== 'BASIC'`.
   - Linha 198 lê `user.membro?.ministerios` apenas quando `user?.role === 'BASIC'`, zerando `leadershipMinisterios` para `ADMIN`/`STAFF` que lideram ministérios.
   - Linha 50 em `apps/web/src/app/(dashboard)/minhas-escalas/page.tsx` redireciona apenas `BASIC` quando sem escalas (`ADMIN`/`STAFF` pode acessar direto ou sem travar).
3. **Semântica global em `GET /api/ministerios/resumo` (`apps/api/src/modules/ministerios/ministerios.service.ts`):**
   - Em `buildVisibleWhere`, apenas `Role.BASIC` recebe filtro por `membroId: user.memberId` e `role: { in: [LEADER, ASSISTANT_LEADER] }`. Para `ADMIN`/`STAFF`, o endpoint retorna **todos os ministérios da igreja**.
   - Se o Painel Pessoal apenas liberar a chamada sem escopo explícito, os cards pessoais do administrador exibiriam o total da igreja em vez dos ministérios que ele lidera pessoalmente.
4. **Redirecionamentos pós-login e PWA hardcoded para `/dashboard`:**
   - `getPostLoginTarget` (`apps/web/src/lib/auth-redirect.ts` linha 53) e `SocialAuthService.getPostAuthRedirect` / `normalizeRedirectPath` (`apps/api/src/modules/auth/social-auth.service.ts` linhas 1083 e 1162) enviam não-`BASIC` para `/dashboard`.
   - `handleGoogleLogin` (`apps/web/src/app/(auth)/login/login-client.tsx` linha 197) envia `redirect=/dashboard` como fallback explícito — o que sobrescreveria a nova tela inicial mesmo após ajustar `getPostAuthRedirect`.
   - `middleware.ts` (linhas 167 e 216), `apps/api/src/modules/pwa/pwa.service.ts` (`start_url: '/dashboard?source=pwa'`) e `apps/web/src/app/manifest.webmanifest/route.ts` também apontam para `/dashboard`.

---

## 3. Decisões de Arquitetura, Riscos e Engenharia

### 3.1. Escopo Pessoal Explícito no Backend (`MinisteriosService` e `SocialAuthService`)
- **`apps/api/src/modules/ministerios/ministerios.controller.ts` e `ministerios.service.ts`:**
  - Adicionar query param opcional `@Query('scope') scope?: 'personal'` em `GET /api/ministerios/resumo` (`findResumo`).
  - Em `buildVisibleWhere(tenantId, user, personalScope = false)`: quando `user.role === Role.BASIC || personalScope`, exigir `user.memberId` e filtrar `membros: { some: { membroId: user.memberId, role: { in: [MinistryRole.LEADER, MinistryRole.ASSISTANT_LEADER] } } }` (retornando `{ ministerios: 0, membros: 0, aniversariantes: 0 }` se `!user.memberId`).
  - Preserva 100% do comportamento administrativo padrão quando `scope` não for enviado.
- **`apps/api/src/modules/auth/social-auth.service.ts`:**
  - Atualizar `getPostAuthRedirect` e `normalizeRedirectPath` para usar `/personal-panel` como destino padrão quando não houver `redirectPath` válido explícito (respeitando `user.role === Role.SUPER_ADMIN` → `/admin` caso aplicável, e mantendo bloqueio de `/dashboard` para `BASIC`).
- **PWA (`apps/api/src/modules/pwa/pwa.service.ts` e `apps/web/src/app/manifest.webmanifest/route.ts`):**
  - Atualizar `start_url` para `/personal-panel?source=pwa` (e `/personal-panel?source=pwa&igreja=${slug}` para tenant customizado), **mantendo inalterado o campo `id`** (`'/dashboard'` no fallback e `'/pwa/tenant/${tenant.id}'` no tenant) para preservar a identidade dos PWAs já instalados nos dispositivos.

### 3.2. Roteamento, Pós-Login e Proteção de Rotas (`apps/web`)
- **`apps/web/src/lib/auth-redirect.ts`:**
  - Atualizar `getPostLoginTarget`:
    - Onboarding pendente (quando habilitado) → `'/onboarding'`.
    - Sem `redirect` explícito → `user.role === 'SUPER_ADMIN' ? '/admin' : '/personal-panel'`.
    - `redirect` explícito seguro segue preservado (mantendo bloqueio para `BASIC` acessar `/dashboard`).
- **`apps/web/src/app/(auth)/login/login-client.tsx`:**
  - Em `handleGoogleLogin`, usar `'/personal-panel'` como fallback quando não existir query param `redirect` válido, permitindo que o fluxo OAuth siga a nova tela inicial padrão para todos os perfis de tenant.
- **`apps/web/src/middleware.ts`:**
  - Incluir `pathname.startsWith('/personal-panel')` na preservação do query param `igreja` em redirect de domínio customizado.
  - Quando `!isSuperAdmin && pathname.startsWith('/admin')`, redirecionar para `'/personal-panel'`.
  - Manter `isBasic` bloqueado nas rotas gerenciais (`/dashboard`, `/membros` exceto `/membros/visualizacao`, `/configuracoes` exceto `/configuracoes/notificacoes`, `/grupos`, `/integracoes`).

### 3.3. Navegação na Sidebar e Experiência em `/personal-panel` (ODS Frontend)
- **Sidebar (`apps/web/src/components/app/sidebar.tsx`):**
  - Adicionar um ícone distinto `ICONS.personalPanel` (crachá/visão pessoal) para diferenciar visualmente **Painel Pessoal** (`/personal-panel`) de **Dashboard** (`/dashboard`, ícone institucional) quando exibidos lado a lado no topo.
  - No array `navItems` (`ADMIN`/`STAFF`):
    - Colocar **`{ href: '/personal-panel', label: t('personalPanel'), icon: ICONS.personalPanel }`** no topo ao lado de **`{ href: '/dashboard', label: t('dashboard'), icon: ICONS.dashboard }`** antes do grupo `Gestão` (com `Painel Pessoal` em primeiro para coincidir com a entrada pós-login).
    - Alterar o hook `useMinhasEscalas` na sidebar para `enabled: Boolean(user && (user.role === 'BASIC' || user.memberId))` e exibir **Minhas Escalas** no grupo `Conta` (antes de `Meu Perfil`) quando `ADMIN`/`STAFF` tiver itens em `minhasEscalas` (evitando consulta desnecessária se não houver `memberId`).
- **Painel Pessoal (`apps/web/src/app/(dashboard)/personal-panel/page.tsx`):**
  - Remover as restrições `user?.role !== 'BASIC'` e ler `user?.membro?.ministerios` para qualquer perfil que possua vínculo de membro e liderança (`LEADER` / `ASSISTANT_LEADER`).
  - Passar `?scope=personal` ao consultar `/api/ministerios/resumo` (somente quando `hasLeadership` for verdadeiro, economizando chamadas para admins sem liderança).
  - Na apuração de `nextMonthPendingCount`, considerar apenas escalas cujo `ministerioId` pertença a `leadershipScheduleMinistries`.
  - **UX específica para `ADMIN`/`STAFF` e Internacionalização (`pt-BR`, `pt-PT`, `en-US`):**
    - Incluir atalho claro para **`Dashboard da Igreja`** (`/dashboard`) no bloco `Acesso Rápido` para `ADMIN`/`STAFF` (sem competir com `Minha Carteirinha`).
    - Caso `!user?.membro`, exibir banner informativo ODS internacionalizado explicando que a conta administrativa ainda não possui cadastro de membro vinculado (com link direto para `/dashboard` e `/membros`), preservando a renderização limpa de Próximos Eventos e atalhos administrativos.
    - Adicionar as chaves correspondentes em `dashboardPersonal` nos 3 arquivos de idioma (`apps/web/messages/pt-BR.json`, `apps/web/messages/pt-PT.json` e `apps/web/messages/en-US.json`).

### 3.4. Matriz de Riscos e Mitigações
| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Cards de liderança no Painel Pessoal mostrarem totais da igreja inteira para `ADMIN`/`STAFF` | Alta (se não filtrado) | Alto | Adicionar `scope=personal` em `GET /api/ministerios/resumo` e filtrar `escalasProximoMes` pelos `leadershipScheduleMinistries`. |
| Login Google continuar caindo em `/dashboard` por fallback hardcoded | Alta | Médio | Atualizar fallback de `handleGoogleLogin` em `login-client.tsx` e `normalizeRedirectPath` + `getPostAuthRedirect` em `SocialAuthService` para `/personal-panel`. |
| `ADMIN` recém-criado sem `memberId` ver tela vazia ou erro ao entrar em `/personal-panel` | Média | Médio | Só consultar `/api/ministerios/resumo` se `hasLeadership`, manter cards de eventos/atalhos e exibir aviso amigável orientando vínculo com `Membro`. |
| Mudar `id` do manifesto PWA invalidar instalações existentes | Baixa | Alto | Alterar apenas `start_url` para `/personal-panel?source=pwa`, mantendo `id` original intacto em `pwa.service.ts` e `manifest.webmanifest/route.ts`. |
| `ADMIN`/`STAFF` perder acesso rápido ao Dashboard administrativo | Baixa | Médio | Manter **Dashboard** no bloco superior da Sidebar junto a **Painel Pessoal** com ícones distintos e incluir atalho de navegação rápida dentro do Painel Pessoal. |

---

## 4. Etapas de Desenvolvimento

> **Regra de Execução:** O desenvolvimento deve avançar estritamente etapa por etapa. Ao concluir uma tarefa ou etapa, atualize imediatamente seu checkbox para `[x]`, apresente o resumo das validações e **aguarde a autorização explícita do usuário antes de iniciar a etapa seguinte**.

### Etapa 0 - Preparação, Branch e Baseline
Status: concluido

- [x] Confirmar repositório limpo na branch `development` e atualizar com `git pull`
- [x] Criar a branch `feature/painel-pessoal-administrador` a partir de `development`
- [x] Registrar baseline dos testes e tipos afetados:
  - [x] Executar `npx.cmd jest src/modules/ministerios src/modules/pwa` em `apps/api`
  - [x] Executar `npx.cmd -w apps/web tsc --noEmit` na raiz e `npx.cmd tsx --test src/lib/auth-redirect.spec.ts` em `apps/web`
- [x] Critério de validação da etapa: Branch `feature/painel-pessoal-administrador` ativa sobre `development` atualizada e baseline verde.

### Etapa 1 - Escopo Pessoal em Ministérios, Redirecionamento OAuth e PWA (Backend)
Status: concluido

- [x] Atualizar `apps/api/src/modules/ministerios/ministerios.controller.ts`:
  - [x] Adicionar `@Query('scope') scope?: string` em `GET /api/ministerios/resumo` e repassar `scope === 'personal'` para `ministeriosService.findResumo`
- [x] Atualizar `apps/api/src/modules/ministerios/ministerios.service.ts`:
  - [x] Estender `buildVisibleWhere(tenantId, user, personalScope = false)` e `findResumo(tenantId, user, personalScope = false)` para aplicar filtro por `user.memberId` + `LEADER`/`ASSISTANT_LEADER` quando `personalScope === true` mesmo para `ADMIN`/`STAFF` (retornando zeros quando `!user.memberId` e preservando chamadas administrativas sem `scope`)
- [x] Atualizar `apps/api/src/modules/auth/social-auth.service.ts`:
  - [x] Alterar destino padrão de `getPostAuthRedirect` e `normalizeRedirectPath` para `/personal-panel` (preservando `redirectPath` explícito, bloqueio de `/dashboard` para `BASIC` e fluxo de `onboarding`)
- [x] Atualizar `apps/api/src/modules/pwa/pwa.service.ts`:
  - [x] Ajustar `start_url` de `ONEELO_MANIFEST` para `'/personal-panel?source=pwa'` e do manifesto do tenant para `` `/personal-panel?source=pwa&igreja=${encodeURIComponent(tenant.slug)}` ``, mantendo `id` inalterado
- [x] Atualizar testes unitários em `apps/api/src/modules/ministerios/ministerios.service.spec.ts`:
  - [x] Cobrir `findResumo` com `personalScope = true` para `ADMIN`/`STAFF` (com e sem `memberId`) versus escopo administrativo padrão
- [x] Atualizar testes unitários em `apps/api/src/modules/pwa/pwa.service.spec.ts`:
  - [x] Validar o novo `start_url: '/personal-panel?source=pwa&igreja=comunidade'` mantendo `id: '/pwa/tenant/tenant-1'`
- [x] Critério de validação da etapa: Testes unitários em `apps/api` (`npx.cmd jest src/modules/ministerios src/modules/pwa`) e `npm.cmd run build -w apps/api` passando sem erros.

### Etapa 2 - Pós-Login Unificado, Middleware e Manifesto Web (`apps/web`)
Status: concluido

- [x] Atualizar `apps/web/src/lib/auth-redirect.ts`:
  - [x] Alterar `getPostLoginTarget` para direcionar `ADMIN`, `STAFF` e `BASIC` para `/personal-panel` quando não houver `redirect` explícito (mantendo `SUPER_ADMIN` em `/admin` e proteção contra `BASIC` em `/dashboard`)
- [x] Atualizar `apps/web/src/lib/auth-redirect.spec.ts`:
  - [x] Expandir suíte com casos de `getPostLoginTarget` para `ADMIN`, `STAFF`, `BASIC`, `SUPER_ADMIN`, onboarding pendente e `redirect` explícito
- [x] Atualizar `apps/web/src/app/(auth)/login/login-client.tsx`:
  - [x] Alterar fallback de `handleGoogleLogin` para `'/personal-panel'` quando não houver `?redirect=` explícito
- [x] Atualizar `apps/web/src/middleware.ts`:
  - [x] Incluir `pathname.startsWith('/personal-panel')` no redirecionamento e preservação de `?igreja=` em domínios customizados e atualizar o redirect de `!isSuperAdmin && pathname.startsWith('/admin')` para `'/personal-panel'`
- [x] Atualizar `apps/web/src/app/manifest.webmanifest/route.ts`:
  - [x] Ajustar `start_url` para `'/personal-panel?source=pwa'` mantendo `id: '/dashboard'`
- [x] Critério de validação da etapa: `npx.cmd -w apps/web tsc --noEmit` verde e `npx.cmd tsx --test src/lib/auth-redirect.spec.ts` em `apps/web` passando sem regressões.

### Etapa 3 - Sidebar Top Block, Internacionalização e Desbloqueio do Painel Pessoal (`apps/web`)
Status: concluido

- [x] Atualizar `apps/web/src/components/app/sidebar.tsx`:
  - [x] Adicionar ícone dedicado `ICONS.personalPanel` e incluir **Painel Pessoal** (`/personal-panel`) como 1º item do bloco superior de `navItems` (`ADMIN`/`STAFF`) seguido por **Dashboard** (`/dashboard`) antes de `Gestão`
  - [x] Habilitar detecção de `useMinhasEscalas` para `ADMIN`/`STAFF` com `user.memberId` e exibir **Minhas Escalas** no grupo `Conta` (com `groupStart: 'groupAccount'` dinâmico no primeiro item do grupo `Conta`) quando houver escalas vinculadas
- [x] Atualizar `apps/web/messages/pt-BR.json`:
  - [x] Adicionar chaves em `dashboardPersonal` para o atalho do Dashboard da Igreja e o aviso amigável de conta administrativa sem membro vinculado
- [x] Atualizar `apps/web/messages/pt-PT.json`:
  - [x] Adicionar chaves equivalentes em `dashboardPersonal` para `pt-PT`
- [x] Atualizar `apps/web/messages/en-US.json`:
  - [x] Adicionar chaves equivalentes em `dashboardPersonal` para `en-US`
- [x] Atualizar `apps/web/src/app/(dashboard)/personal-panel/page.tsx`:
  - [x] Remover as condições bloqueantes `user?.role !== 'BASIC'` na leitura de liderança (`user.membro?.ministerios`) e nos fetches condicionais
  - [x] Consultar `/api/ministerios/resumo?scope=personal` apenas quando `hasLeadership` for verdadeiro e filtrar `escalasProximoMes` pelos ministérios liderados
  - [x] Adicionar atalho de acesso rápido ao **Dashboard da Igreja** (`/dashboard`) para perfis `ADMIN`/`STAFF`
  - [x] Exibir orientação amigável ODS quando `ADMIN`/`STAFF` não possuir `Membro` vinculado (`!user?.membro`) sem bloquear eventos ou atalhos de gestão
- [x] Conferir mapeamento de título em `apps/web/src/components/app/header.tsx` para `/personal-panel` e `/minhas-escalas`
- [x] Conferir guarda de redirecionamento em `apps/web/src/app/(dashboard)/minhas-escalas/page.tsx` para perfis `ADMIN`/`STAFF`
- [x] Critério de validação da etapa: `npx.cmd -w apps/web tsc --noEmit` e `npm.cmd run build -w apps/web` passando sem erros.

### Etapa 4 - Documentação, Testes Integrados e Validação Final
Status: concluido

- [x] Atualizar `ai-context/frontend/navigation-rules.md` documentando `/personal-panel` como rota inicial pós-login para `ADMIN`, `STAFF` e `BASIC`, a presença de `Painel Pessoal` + `Dashboard` no topo da sidebar administrativa e `Minhas Escalas` condicional no grupo `Conta`
- [x] Atualizar `ai-context/backlog/painel-pessoal-administrador.md` registrando o status concluído e a decisão final (entrada padrão em `/personal-panel` + bloco superior na Sidebar)
- [x] Atualizar todos os checkboxes de `ai-context/plans/painel-pessoal-administrador-plan.md` para `[x]` e `Status geral: concluido`
- [x] Atualizar o índice `ai-context/plans/README.md` refletindo a conclusão da FT-020
- [x] Executar bateria de testes e build em `apps/api` (`npx.cmd jest` e `npm.cmd run build -w apps/api`) e `apps/web` (`npx.cmd -w apps/web tsc --noEmit`, `npx.cmd tsx --test src/lib/auth-redirect.spec.ts` e `npm.cmd run build -w apps/web`)
- [x] Validar ponta a ponta em desktop e mobile (`390x844`): login como `ADMIN`/`STAFF` caindo direto em `/personal-panel`, exibição correta de escalas/liderança/carteirinha, alternância rápida para `/dashboard`, preservação do fluxo `BASIC` (sem acesso a `/dashboard`) e `SUPER_ADMIN` em `/admin`
- [x] Critério de validação da etapa: Builds e testes verdes em ambos os pacotes e todos os perfis validados sem regressões.

### Etapa 5 - Ajustes pós-Staging: Dashboard Sempre Primeiro e Liberação de Membro em Usuários Desativados
Status: concluido

- [x] Atualizar `apps/web/src/components/app/sidebar.tsx`:
  - [x] Posicionar **Dashboard** (`/dashboard`) sempre em 1º lugar e **Painel Pessoal** (`/personal-panel`) logo abaixo em 2º lugar (somente quando `user?.membro?.id` existir)
- [x] Atualizar `apps/web/src/app/(dashboard)/personal-panel/page.tsx`:
  - [x] Garantir redirecionamento para `/dashboard` quando usuário não-`BASIC` não possuir membro ativo vinculado (`!user?.membro?.id`)
- [x] Atualizar `apps/web/src/lib/auth-redirect.ts`:
  - [x] Garantir que `getPostLoginTarget` direcione `ADMIN` e `STAFF` sempre para `/dashboard` por padrão (mantendo `BASIC` em `/personal-panel` e `SUPER_ADMIN` em `/admin`)
- [x] Atualizar `apps/web/src/lib/auth-redirect.spec.ts`:
  - [x] Atualizar suíte unitária validando entrada padrão em `/dashboard` para `ADMIN`/`STAFF` (com e sem membro vinculado) e regras de `?redirect=`
- [x] Atualizar `apps/web/src/app/(auth)/login/login-client.tsx`:
  - [x] Alinhar fallback de `handleGoogleLogin` para `'/dashboard'`
- [x] Atualizar `apps/web/src/middleware.ts`:
  - [x] Alinhar redirect de usuário comum fora de `/admin` para `'/dashboard'` (ou `'/personal-panel'` quando `BASIC`)
- [x] Atualizar `apps/web/src/app/manifest.webmanifest/route.ts`:
  - [x] Alinhar `start_url` do manifesto padrão para `'/dashboard?source=pwa'`
- [x] Atualizar `apps/api/src/modules/auth/social-auth.service.ts`:
  - [x] Alinhar fallback de `getPostAuthRedirect` e `normalizeRedirectPath` para `/dashboard`
- [x] Atualizar `apps/api/src/modules/pwa/pwa.service.ts`:
  - [x] Alinhar `start_url` para `/dashboard?source=pwa` (e com `?igreja=` no manifesto do tenant)
- [x] Atualizar `apps/api/src/modules/pwa/pwa.service.spec.ts`:
  - [x] Validar `start_url` em `/dashboard?source=pwa` nos testes do manifesto
- [x] Atualizar `apps/api/src/modules/auth/auth.service.ts`:
  - [x] Limpar `memberId: null` em `deleteUser` ao desativar usuário
  - [x] Atualizar `findAvailableMembers` para incluir também membros cujo vínculo anterior aponta para usuário `DISABLED` (`ativo: false`)
  - [x] Extrair helper `resolveMemberForUserLink` validando `deletedAt: null` e liberando usuário `DISABLED` legado de forma atômica em `createUser` e `updateUser`
- [x] Atualizar `apps/api/src/modules/auth/auth.service.spec.ts`:
  - [x] Cobrir `deleteUser`, `findAvailableMembers`, bloqueio de membro excluído e reivindicação segura de membro com usuário `DISABLED` legado
- [x] Atualizar `ai-context/frontend/navigation-rules.md` documentando `/dashboard` como 1º item e entrada padrão para `ADMIN`/`STAFF`
- [x] Atualizar `ai-context/backlog/painel-pessoal-administrador.md` refletindo a decisão final
- [x] Critério de validação da etapa: Todos os testes automatizados em `apps/api` e `apps/web`, builds e verificação no navegador verdes.

---

## 5. Critérios de Aceite Gerais

- [x] Usuários `ADMIN` e `STAFF` entram sempre em `/dashboard` por padrão após login tradicional, login Google OAuth ou abertura pelo PWA (mantendo `BASIC` em `/personal-panel`, `SUPER_ADMIN` em `/admin` e `?redirect=` explícito quando permitido).
- [x] Na Sidebar de `ADMIN` e `STAFF`, **Dashboard** aparece sempre em 1º lugar no topo e **Painel Pessoal** aparece logo abaixo em 2º lugar apenas quando há `Membro` vinculado antes do grupo `Gestão`, enquanto o grupo `Conta` exibe `Minhas Escalas` apenas quando o usuário possui escalas.
- [x] O Painel Pessoal exibe exclusivamente os dados pessoais e de liderança própria do usuário logado (`scope=personal`), sem misturar KPIs globais da igreja nos cards pessoais do administrador.
- [x] Administradores com membro vinculado acessam **Minha Carteirinha**, **Próxima Escala**, **Pendências** e exportação para calendário diretamente do Painel Pessoal; administradores sem membro vinculado não exibem o item `Painel Pessoal` e são redirecionados para `/dashboard` caso acessem `/personal-panel`.
- [x] Ao desativar/excluir um usuário no cadastro de usuários (`deleteUser`), o vínculo com o membro (`memberId`) é liberado para novo cadastro/edição, sem exibir membros excluídos (`deletedAt != null`).
- [x] Usuários `BASIC` mantêm o bloqueio estrito às rotas administrativas (`/dashboard`, `/membros`, `/configuracoes`, etc.) tanto na UI quanto no `middleware.ts`.
