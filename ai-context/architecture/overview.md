# Arquitetura Geral - SaaS de Gestao para Igrejas

Este projeto e um SaaS multi-tenant para gestao operacional de igrejas: membros, ministerios, escalas, agenda, perfis de acesso e auditoria.

---

## Stack Tecnologica

- Monorepo com `npm workspaces`.
- Backend: NestJS, Prisma ORM, PostgreSQL, DTOs com `class-validator`.
- Frontend: Next.js App Router, React, Tailwind CSS.
- Banco local: PostgreSQL via Docker Compose na porta `5433`.

---

## Padroes Arquiteturais

### 1. Multi-tenancy por coluna

As entidades operacionais usam `tenantId`.

- O backend extrai `tenantId` do JWT no `JwtAuthGuard`.
- Controllers repassam `tenantId` aos services.
- Queries Prisma devem filtrar pelo tenant.
- `SUPER_ADMIN` e uma excecao de plataforma e nao deve acessar dados operacionais sem escopo explicito.

### 2. Autenticacao

- Login retorna JWT em cookie HTTP-only `access_token`.
- Rotas sao protegidas por padrao.
- `@Public()` abre excecoes controladas, como login.
- O frontend usa chamadas same-origin via `/api/*` e o Next faz rewrite para a API.

### 3. RBAC global e contextual

O sistema separa perfil global de papel ministerial.

`User.role`:

- `ADMIN`: acesso administrativo total ao tenant.
- `STAFF`: equipe operacional global do tenant.
- `BASIC`: membro comum; pode ganhar poderes contextuais por ministerio.
- `SUPER_ADMIN`: administrador da plataforma Lookup Labs.

`MinisterioMembro.role`:

- `LEADER`: lider do ministerio.
- `ASSISTANT_LEADER`: co-lider.
- `MEMBER`: participante.

Decisao: os enums tecnicos permanecem `ADMIN`, `STAFF`, `BASIC` e `SUPER_ADMIN`. Labels amigaveis pertencem a UI/i18n.

### 4. Autorizacao por entidade

`RolesGuard` cobre permissao global simples. Regras que dependem de descobrir o ministerio de uma entidade devem ficar no service.

Padrao:

- `AuthorizationService.canManageTenant(user)`
- `AuthorizationService.isMinistryLeader(user, ministerioId)`
- `AuthorizationService.canManageMinistry(user, ministerioId)`
- `AuthorizationService.assertCanManageMinistry(user, ministerioId)`

Exemplos:

- Em ministerios, `BASIC` pode gerir apenas ministerios onde e `LEADER` ou `ASSISTANT_LEADER`.
- Em escalas, o service deve validar o ministerio associado a escala antes de permitir mutacoes.

### 5. Separacao entre User e Membro

- `Membro` representa a pessoa da igreja.
- `User` representa login e permissao de sistema.
- Um membro pode existir sem login.
- Um user pode apontar para `memberId` quando precisa atuar como membro/lider ministerial.
- Lideranca ministerial nao e `User.role`; e `MinisterioMembro.role`.

### 6. Soft delete de membros

`Membro.deletedAt` preserva historico operacional.

- Leituras devem ignorar membros com `deletedAt != null`.
- Atualizacoes em membro excluido devem falhar como `404`.

### 7. Auditoria

Mutacoes sensiveis devem gerar `AuditLog` quando aplicavel.

Escopo principal:

- membros;
- ministerios;
- escalas;
- usuarios;
- super admin/tenants.

---

## Fluxo Principal

```txt
Usuario
  -> Frontend Next.js
  -> Middleware valida presenca do cookie e regras basicas de rota
  -> /api/* same-origin
  -> Rewrite do Next para NestJS API
  -> JwtAuthGuard injeta user e tenantId
  -> RolesGuard valida roles globais
  -> Service aplica regras de negocio e autorizacao contextual
  -> Prisma/PostgreSQL
  -> AuditLog quando aplicavel
  -> Resposta HTTP
```

---

## Estrutura do Monorepo

```txt
apps/
  api/
    prisma/
    src/
      common/
        authorization/
        guards/
        decorators/
        interceptors/
        prisma/
      modules/
        auth/
        membros/
        ministerios/
        escalas/
        eventos/
        dashboard/
        super-admin/
  web/
    src/
      app/
      components/
      hooks/
      lib/
      middleware.ts
```

---

## Referencias

- `ai-context/architecture/decisions.md`
- `ai-context/backlog/permissions-matrix.md`
- `ai-context/database/models.md`
- `ai-context/frontend/navigation-rules.md`
