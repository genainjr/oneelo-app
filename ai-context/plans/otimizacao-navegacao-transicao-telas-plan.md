# Plano - Otimização de Navegação e Transição Instantânea de Telas

Status geral: concluído  
Data de criação: 2026-11-09  
Última atualização: 2026-11-09 (Todas as etapas 0 a 4 implementadas e validadas na branch `feature/navegacao-dashboard-performance`)  
Branch sugerida para implementação: `feature/navegacao-dashboard-performance`  

## Planos e Referências Relacionados

- [Otimização de Performance, Memória e Consumo de Recursos](otimizacao-performance-memoria-render-plan.md)
- [PWA com Nome e Ícone da Igreja](tenant-pwa-identity-plan.md)
- [RBAC, Navegação e Experiência por Perfil](rbac-navigation-experience-plan.md)
- [OneElo Design System (ODS)](../../ai-core/skills/oneelo-design-system/README.md)
- [Performance da Exportação de Escalas no Render Free](escala-export-performance-plan.md)

---

## 1. Objetivo da Entrega

Eliminar o congelamento/delay de 400ms a mais de 1,2s percebido ao clicar nos itens do menu lateral (`Sidebar`), tornando a transição de telas no dashboard instantânea (`< 50ms`) e reduzindo a carga de requisições redundantes de autenticação no backend hospedado no Render Free.

---

## 2. Contexto e Diagnóstico

### Diagnóstico do Estado Atual na branch `development`:
1. **SSR Bloqueante no Layout do Dashboard (Principal Gargalo Ativo):**
   - **Arquivo:** `apps/web/src/app/(dashboard)/layout.tsx`
   - Possui `export const dynamic = 'force-dynamic'` e executa duas vezes `getServerAuthUser()` (em `generateMetadata` e no componente `DashboardLayout`).
   - A função `getServerAuthUser()` (`apps/web/src/lib/server-auth.ts`) executa `fetch(\`\${API_BASE}/api/auth/me\`, { cache: 'no-store' })`.
   - **Consequência:** A cada clique na `Sidebar`, o Next.js App Router reexecuta `generateMetadata()` no servidor (Vercel) e suspende a navegação no cliente até que a Vercel consulte `/api/auth/me` na API do Render (`https://oneelo-app-api.onrender.com`), que por sua vez consulta o Supabase em Ohio (`us-east-2`). A tela atual fica paralisada durante todo esse trajeto.
2. **Auditoria de Consumo de Sessão no Cliente (`useAuthUser`):**
   - No plano anterior (`otimizacao-performance-memoria-render-plan.md`, commit `dcc1e5f`), o `AuthUserContext` foi evoluído com `{ user, setUser, loadingUser, refreshUser }` e as páginas principais foram migradas.
   - Contudo, enquanto o `layout.tsx` continuar buscando `initialUser` via SSR a cada clique ou se alguma tela/fluxo ainda disparar `/api/auth/me` ou deixar de tratar `loadingUser` quando `initialUser` passar a ser `null` no SSR, o gargalo e o risco de race condition persistem.
3. **Ausência de Feedback Imediato (`loading.tsx`):**
   - O Next.js não possui fallback visual imediato registrado em `apps/web/src/app/(dashboard)/loading.tsx`, impedindo o prefetch automático de segmentos dinâmicos pelo `<Link>` e mantendo a tela anterior estática até o carregamento completo da nova rota.

---

## 3. Decisões de Arquitetura e Engenharia

1. **Sessão Exclusivamente em Memória do Cliente:** Os dados do usuário autenticado (`AuthUser`) são carregados uma única vez na entrada da sessão (ou `F5`) pelo `DashboardShell` e compartilhados com toda a árvore via `AuthUserContext` / `useAuthUser()`.
2. **Layout 100% Desacoplado de Requisições Externas por Navegação + Preservação do PWA da Igreja:** O `layout.tsx` não fará chamadas HTTP (`getServerAuthUser()`) para a API. Os metadados dinâmicos do PWA da igreja (`manifest`, `apple-touch-icon`, `apple-mobile-web-app-title` e `document.title`) serão sincronizados diretamente no `document.head` pelo `DashboardShell` no cliente assim que `user.tenant` estiver carregado.
3. **Segurança Inalterada:** O controle de acesso a rotas continua garantido pelo `middleware.ts` do Next.js (validação do JWT via cookie) e pelo backend NestJS (`jwt-auth.guard.ts` e decorators `@Roles()`). O frontend apenas reflete o estado do usuário.
4. **Isolamento Multi-tenant Estrito:** Nenhum cache compartilhado em nível de servidor (SSR) de dados de usuário será utilizado na Vercel, impedindo qualquer risco de vazamento de dados entre sessões ou igrejas.

---

## 4. Análise de Riscos e Mitigações

| # | Risco Identificado | Impacto | Estratégia de Mitigação |
|---|---|---|---|
| **R1** | **Estado de Usuário Desatualizado (Stale User State):** Se o usuário tiver seu perfil/permissões alterados por um admin ou se ele mesmo atualizar dados em `/meu-perfil`, a UI poderia manter o estado antigo em memória. | Médio (Visual) | 1. O backend continua sendo a autoridade máxima e rejeitará ações não permitidas com `403 Forbidden`.<br>2. Nas telas onde o próprio usuário faz mutações (`/meu-perfil`, `/configuracoes`, `/ministerios`), chamar explicitamente `refreshUser()` / `setUser()` do contexto após o sucesso.<br>3. Adicionar revalidação suave em background no `DashboardShell` ao focar na janela (`visibilitychange`) com throttle mínimo de 60s. |
| **R2** | **Vazamento de Cache entre Tenants/Sessões no SSR (Vercel):** Uso indevido de cache estático ou `revalidate` compartilhado na Vercel para rotas de autenticação. | Crítico (Segurança) | Nunca utilizar cache global de servidor (`next: { revalidate: ... }` compartilhado) para autenticação. O cache de sessão existirá exclusivamente na memória do navegador do cliente (React Context). |
| **R3** | **Layout Shift ou Flicker com `loading.tsx`:** Esqueleto visual piscar na tela por poucos milissegundos em rotas que carregam quase instantaneamente. | Baixo (UX) | Implementar um `loading.tsx` minimalista e sutil (ex: barra de progresso fina de topo ou esqueleto neutro respeitando os paddings exatos do `DashboardShell`), evitando skeletons intrusivos de tela inteira. |
| **R4** | **Sobrecarga por Prefetching Excessivo no Render Free:** O `<Link>` do Next.js fazer prefetch de páginas que executem chamadas de API antes do clique. | Médio (Carga) | Garantir que o prefetch do Next.js baixe apenas os arquivos estáticos JS/CSS (hospedados na CDN da Vercel a custo zero de servidor). Todas as chamadas de API de dados devem residir exclusivamente dentro de `useEffect` (que não é disparado durante o prefetch). |
| **R5** | **Quebra da Identidade PWA da Igreja (`manifest` e `apple-touch-icon`) ao remover `generateMetadata` de `layout.tsx`:** O `generateMetadata()` em `layout.tsx` injeta o manifesto e o ícone 180x180 da igreja no `<head>`. Apagá-lo sem substituto faria o Android/iPhone instalar o PWA genérico do OneElo. | Alto (Produto / PWA) | Mover a injeção e atualização das tags `<link rel="manifest">`, `<link rel="apple-touch-icon">`, `<meta name="apple-mobile-web-app-title">` e `document.title` para um efeito client-side dentro do `DashboardShell` assim que `user.tenant` carregar no `AuthUserContext`. |
| **R6** | **Condição de Corrida no Primeiro Carregamento (`F5`) nas Páginas Filhas:** Quando `layout.tsx` passa a renderizar sem `initialUser` do SSR, `user` inicia como `null` no cliente por ~150ms enquanto `DashboardShell` busca `/api/auth/me`. Páginas que redirecionam `BASIC` ou cruzam dados com `user.membro.ministerios` no mount podem falhar se não aguardarem `loadingUser === false`. | Alto (Funcional) | Garantir que `DashboardShell` inicie `loadingUser = true` apenas no boot inicial da sessão (nunca nas trocas de rota da `Sidebar`) e auditar todas as páginas filhas de `(dashboard)` para que aguardem `!loadingUser` antes de redirecionar e reajam à chegada de `user` via `useMemo`/`useEffect`. |
| **R7** | **Alinhamento com o Plano `otimizacao-performance-memoria-render-plan.md`:** Parte da migração de `useAuthUser` nas páginas filhas foi tocada no commit `dcc1e5f`, mas o `layout.tsx` continuou bloqueando o SSR e não foi criado o `loading.tsx`. | Baixo (Governança) | Na Etapa 2, realizar auditoria completa em todas as páginas de `(dashboard)` para validar o que já foi migrado em `dcc1e5f`, corrigir eventuais lacunas de reatividade quando `initialUser` deixa de vir do SSR e evitar retrabalho. |

---

## 5. Etapas de Desenvolvimento

> **Regra de Execução:** O desenvolvimento deve avançar estritamente etapa por etapa. Ao concluir uma etapa, atualize o checklist (`[x]`), apresente o resumo das validações e **aguarde a autorização explícita do usuário antes de iniciar a etapa seguinte**.

### Etapa 0 - Baseline de Performance de Navegação
Status: concluído

- [x] Inspecionar e registrar o comportamento atual de transição entre rotas na `Sidebar` (ex: de `/dashboard` para `/escalas` e `/membros`).
- [x] Mapear todas as chamadas HTTP e execuções SSR de `/api/auth/me` disparadas na troca de abas.
- Critério de validação da etapa: Registro documentado do baseline atual para comparação posterior.

### Etapa 1 - Desacoplar o Layout de Fetch Bloqueante no SSR Preservando o PWA da Igreja (R1, R2, R5, R6)
Status: concluído

- [x] **Ponto de Correção 1 (`apps/web/src/app/(dashboard)/layout.tsx` linhas 8–31):** Remover `generateMetadata()` e a chamada bloqueante `await getServerAuthUser()` de `DashboardLayout`, passando a renderizar `<DashboardShell initialUser={null}>{children}</DashboardShell>` de forma 100% síncrona no servidor (mitigando R2).
- [x] **Ponto de Correção 2 (`apps/web/src/components/app/dashboard-shell.tsx` linhas 27–50):**
  - Corrigir `refreshUser` para **não acionar `setLoadingUser(true)`** quando já existir um `user` carregado em memória (revalidação silenciosa), evitando piscar telas ao atualizar perfil ou focar na janela (mitigando R1 e R6);
  - Sincronizar dinamicamente no `document.head` as tags de identidade PWA da igreja (`<link rel="manifest">`, `<link rel="apple-touch-icon">`, `<meta name="apple-mobile-web-app-title">` e `document.title`) quando `user?.tenant` carregar (mitigando R5);
  - Adicionar listener `visibilitychange` com throttle de 60s para revalidar `refreshUser()` silenciosamente em background ao retornar à aba (mitigando R1).
- [x] **Ponto de Correção 3 (`apps/web/src/components/app/sidebar.tsx` linhas 380–385):**
  - Evitar que `baseItems` caia no fallback `navItems` (menu de Admin/Staff) enquanto `user === null` nos primeiros ~150ms do `F5`, impedindo o *flash* de itens administrativos para usuários `BASIC` (mitigando R6).
- Critério de validação da etapa: Clicar em um link da `Sidebar` altera a URL imediatamente sem round-trip para `/api/auth/me` na Vercel, mantendo as tags de PWA da igreja no `<head>` e sem flash de menu indevido no `F5`.

### Etapa 2 - Auditoria e Consolidação das Páginas Filhas com `useAuthUser` (R1, R6, R7)
Status: concluído

- [x] **Ponto de Correção 4 (`apps/web/src/app/(dashboard)/ministerios/page.tsx` linha 50):** Desestruturar `refreshUser` de `useAuthUser()` e invocá-lo silenciosamente após alterar configurações de ministério (`usaEscalas`), adicionar/remover membros ou alterar papel de liderança (`LEADER` / `ASSISTANT_LEADER`), mantendo a `Sidebar` e permissões sincronizadas (mitigando R1).
- [x] Auditar todas as 12 páginas de `(dashboard)` (`agenda`, `agenda/visualizacao`, `escalas`, `escalas/visualizacao`, `minhas-escalas`, `membros`, `ministerios`, `configuracoes`, `dashboard`, `personal-panel`, `financeiro/visualizacao` e `meu-perfil`) confirmando zero chamadas diretas a `GET /api/auth/me` e proteção a `loadingUser === true` no boot inicial (`F5`) (mitigando R6 e R7).
- Critério de validação da etapa: Navegação entre páginas registra zero chamadas a `/api/auth/me` na aba Network e `F5` em qualquer rota carrega apenas 1 vez `/api/auth/me` no `DashboardShell` sem quebrar redirecionamentos ou filtros.

### Etapa 3 - Feedback Visual Instantâneo com `loading.tsx` (R3)
Status: concluído

- [x] Criar `apps/web/src/app/(dashboard)/loading.tsx` com componente skeleton sutil alinhado ao OneElo Design System (mitigando R3).
- [x] Validar comportamento visual em telas rápidas (sem flicker desconfortável) e em conexões lentas.
- Critério de validação da etapa: A UI reage no exato instante do clique do mouse, fornecendo feedback tátil imediato e habilitando o prefetch de segmento do Next.js.

### Etapa 4 - Ajuste Fino de Prefetching e Validação Final (R4)
Status: concluído

- [x] Revisar os links em `apps/web/src/components/app/sidebar.tsx` garantindo prefetch seguro das rotas mais frequentes apenas para bundles estáticos (mitigando R4).
- [x] Rodar build completo do frontend (`npm.cmd run build -w apps/web`) e typecheck (`npx tsc --noEmit`).
- [x] Comparar o novo comportamento de transição de telas com o baseline da Etapa 0.
- Critério de validação da etapa: Transição percebida menor que 50ms e build aprovado sem erros.

---

## 6. Critérios de Aceitação

1. Clique em qualquer item da `Sidebar` transiciona a rota sem sensação de travamento (`< 50ms` de resposta visual).
2. Zero requisições redundantes de autenticação `/api/auth/me` (no SSR ou no cliente) ao alternar entre páginas do dashboard.
3. Identidade PWA da igreja (`manifest`, `apple-touch-icon` e título) preservada integralmente para instalação em Android e iOS.
4. Nenhuma regressão de permissões de RBAC, redirecionamentos no `F5` ou controle multi-tenant.
5. Edição de perfil ou configurações da igreja reflete imediatamente no cabeçalho e na sessão.
6. Build do Next.js sem erros de tipagem ou de compilação.
