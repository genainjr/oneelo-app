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

### ADMIN

Pode acessar a experiencia administrativa do tenant:

- `/dashboard`
- `/membros`
- `/ministerios`
- `/escalas`
- `/agenda`
- `/configuracoes`
- demais modulos administrativos liberados.

### STAFF

Pode acessar a operacao global do tenant:

- `/dashboard`
- `/membros`
- `/ministerios`
- `/escalas`
- `/agenda`

Nao deve acessar areas exclusivas de `ADMIN`, como configuracoes sensiveis quando assim definido.

### BASIC comum

Fluxo principal:

- login deve cair em `/minhas-escalas`;
- pode acessar `/minhas-escalas`;
- pode acessar `/agenda`;
- pode acessar `/meu-perfil`.

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
- `/escalas`, escopado aos ministerios onde e `LEADER` ou `ASSISTANT_LEADER`.

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
- Quando a sidebar inteira estiver colapsada, itens com filhos podem apontar para a primeira rota filha.
- Labels de roles devem vir de i18n, nao do enum bruto quando exibidas ao usuario final.

Menu BASIC comum:

```txt
Minhas Escalas
Agenda
Meu Perfil
```

Menu BASIC lider/co-lider:

```txt
Minhas Escalas
Ministerios
Escalas
Agenda
Meu Perfil
```

---

## Middleware

O middleware do Next.js deve aplicar bloqueios basicos por cookie/role para UX e reducao de exposicao visual.

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
