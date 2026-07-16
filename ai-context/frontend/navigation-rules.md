# Regras de Navegacao e Sidebar

Este documento define o comportamento esperado de navegacao por perfil no frontend.

---

## Principios

- O backend continua sendo a fonte de verdade de autorizacao.
- O frontend deve esconder rotas e acoes que o usuario nao pode executar.
- Rotas bloqueadas por perfil devem redirecionar antes de renderizar conteudo sensivel.
- A sidebar deve iniciar com secoes internas recolhidas por padrao.

---

## Rotas por Perfil

### Primeiro acesso

- `/activate/:token` e publico e oferece ativacao por senha ou Google.
- `/login/social-link` e publico e concentra confirmacao de vinculo e mensagens de erro do OAuth.
- Com `NEXT_PUBLIC_ONBOARDING_ENABLED=true`, qualquer usuario do tenant com `onboardingCompletedAt = null` deve ir para `/onboarding` depois da ativacao ou login e antes do destino do perfil.
- Com a flag ausente ou igual a `false`, todos seguem diretamente para o destino normal do perfil e o acesso direto a `/onboarding` tambem redireciona para esse destino.
- `/onboarding` e autenticado, isolado do layout do dashboard e nao exibe sidebar ou header global.
- A conclusao grava `onboardingCompletedAt` e direciona obrigatoriamente para `/meu-perfil` para revisao cadastral.
- Instalacao PWA e notificacoes sao opcionais fora do iOS. No Safari do iOS, a abertura pelo atalho instalado e obrigatoria para continuar.

### ADMIN

Pode acessar a experiencia administrativa do tenant:

- `/dashboard`
- `/membros`
- `/membros/visualizacao`
- `/ministerios`
- `/ministerios/visualizacao`
- `/escalas`
- `/escalas/visualizacao`
- `/agenda`
- `/agenda/visualizacao`
- `/meu-perfil`
- `/configuracoes`
- demais modulos administrativos liberados.

### STAFF

Pode acessar a operacao global do tenant:

- `/dashboard`
- `/membros`
- `/membros/visualizacao`
- `/ministerios`
- `/ministerios/visualizacao`
- `/escalas`
- `/escalas/visualizacao`
- `/agenda`
- `/agenda/visualizacao`
- `/meu-perfil`

Nao deve acessar areas exclusivas de `ADMIN`, como configuracoes sensiveis quando assim definido.

### BASIC comum

Fluxo principal:

- depois do onboarding, login deve cair em `/personal-panel`;
- pode acessar `/personal-panel`;
- pode acessar `/minhas-escalas`;
- pode acessar `/agenda/visualizacao`;
- pode acessar `/meu-perfil`;
- pode alterar a propria senha em `/meu-perfil`.

Nao deve acessar:

- `/dashboard`
- `/membros`
- `/ministerios`
- `/escalas` administrativa
- `/configuracoes`
- `/financeiro`
- `/grupos`
- `/integracoes`

### BASIC lider/co-lider

Tem o mesmo menu do BASIC comum, com acesso adicional a:

- `/ministerios`, escopado aos ministerios onde e `LEADER` ou `ASSISTANT_LEADER`;
- `/ministerios/visualizacao`, escopado aos ministerios onde e `LEADER` ou `ASSISTANT_LEADER`;
- `/escalas`, escopado aos ministerios onde e `LEADER` ou `ASSISTANT_LEADER`;
- `/escalas/visualizacao`, escopado aos ministerios onde e `LEADER` ou `ASSISTANT_LEADER`.

Ele nao deve ver dados de ministerios que nao lidera/co-lidera.

### SUPER_ADMIN

Usa a area `/admin`.

- `/admin/login`
- `/admin`
- rotas administrativas de tenants.

Nao deve ser direcionado para o dashboard operacional do tenant.

---

## Sidebar

Regras:

- Secoes com filhos devem iniciar fechadas.
- Usuario pode expandir/recolher manualmente.
- Quando a sidebar inteira estiver colapsada, itens com filhos devem abrir um submenu lateral flutuante, sem expandir a sidebar e sem navegar direto para a primeira rota filha.
- Labels de roles devem vir de i18n, nao do enum bruto quando exibidas ao usuario final.

Menu BASIC comum:

```txt
Painel Pessoal
Minhas Escalas
Agenda
Meu Perfil
```

Menu BASIC lider/co-lider:

```txt
Painel Pessoal
Minhas Escalas
Ministerios
  Gerenciar
  Visualizacao
Escalas
  Gerenciar
  Visualizacao
Agenda
Meu Perfil
```

Menu ADMIN/STAFF:

```txt
Dashboard
Membros
  Gerenciar
  Visualizacao
  Exportacao
Ministerios
  Gerenciar
  Visualizacao
  Exportacao
Escalas
  Gerenciar
  Visualizacao
  Exportacao
Agenda
  Gerenciar
  Visualizacao
  Exportacao
Grupos
Financeiro
Integracoes
Meu Perfil
Configuracoes (ADMIN)
```

---

## Middleware

O middleware do Next.js deve aplicar bloqueios basicos por cookie/role para UX e reducao de exposicao visual.

O redirecionamento por onboarding usa o usuario devolvido pelo login/ativacao e tambem uma consulta autenticada a `/api/auth/me` no layout autenticado, pois o cookie JWT nao carrega `onboardingCompletedAt`.

`/onboarding` nao deve usar a sidebar nem aparecer no menu. A conclusao so deve gravar `onboardingCompletedAt` no ultimo passo do fluxo.

Ele nao substitui:

- `JwtAuthGuard`;
- `RolesGuard`;
- validacoes de service;
- `AuthorizationService`.

---

## Referencias

- `apps/web/src/components/app/sidebar.tsx`
- `apps/web/src/middleware.ts`
- `ai-context/backlog/permissions-matrix.md`
