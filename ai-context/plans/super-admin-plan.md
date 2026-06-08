# Plano — Painel Super Admin (FT-000)

> Status: concluído
> Última atualização: 2026-06-07

## Etapas

- [x] 1. Migration Prisma (Role.SUPER_ADMIN, User.tenantId?, AuditLog.tenantId?)
- [x] 2. JwtPayload → tenantId opcional
- [x] 3. JwtAuthGuard → injeção condicional de tenantId
- [x] 4. SuperAdminModule (dto → service → controller, incluindo /admin/auth/login)
- [x] 5. AppModule → importar SuperAdminModule
- [x] 6. Middleware Next.js → decodificação de role + novas regras de rota
- [x] 7. Layout (admin) + página /admin/login
- [x] 8. Página /admin (listagem de tenants + modais)
- [x] 9. Hook use-admin.ts + tipos Tenant

---

## Contexto e Restrições Técnicas

O sistema atual pressupõe que **todo usuário tem um `tenantId` obrigatório**. O SUPER_ADMIN é ortogonal a isso — ele gerencia tenants, não pertence a um. Três campos precisam se tornar opcionais antes de qualquer tela existir:

| Campo | Situação atual | Mudança |
|---|---|---|
| `User.tenantId` | `String` (obrigatório) | `String?` |
| `User.tenant` | relação obrigatória | relação opcional |
| `AuditLog.tenantId` | `String` (obrigatório) | `String?` |

O enum `Role` também precisa de um novo valor: `SUPER_ADMIN`.

---

## Fluxo de Autenticação

O SUPER_ADMIN não pode usar o `/auth/login` atual, pois esse endpoint resolve o tenant por slug. A solução mais limpa é um **endpoint separado**: `POST /admin/auth/login` — recebe só `email + senha`, busca por `{ email, tenantId: null }`, retorna JWT com `role: SUPER_ADMIN` e sem `tenantId`.

No frontend, a tela de login do admin fica em `/admin/login` (rota pública separada do `/login` normal).

---

## Escopo do MVP

**Telas:**
1. `/admin/login` — autenticação SUPER_ADMIN
2. `/admin` — listagem de todos os tenants
3. Modal criar tenant (nome, slug, plano, email, telefone, idioma)
4. Modal editar tenant (mesmos campos + toggle ativo/inativo)
5. Modal criar usuário admin para um tenant (nome, email, senha)

---

## Camadas e Arquivos

### 1. Schema Prisma — migration

```prisma
enum Role {
  ADMIN
  STAFF
  BASIC
  SUPER_ADMIN
}

model User {
  tenantId  String?
  tenant    Tenant?
}

model AuditLog {
  tenantId  String?
}
```

### 2. Backend — JWT e Guards

- `JwtPayload.tenantId` → `string?`
- `JwtAuthGuard` → só injeta `tenantId` no request se existir no payload

### 3. Backend — SuperAdminModule

```
super-admin/
├── super-admin.module.ts
├── super-admin.controller.ts
├── super-admin.service.ts
└── dto/
    ├── create-tenant.dto.ts
    ├── update-tenant.dto.ts
    └── create-tenant-user.dto.ts
```

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/admin/auth/login` | Login do SUPER_ADMIN (`@Public()`) |
| `GET` | `/admin/tenants` | Lista todos os tenants |
| `POST` | `/admin/tenants` | Cria tenant + usuário ADMIN inicial |
| `PATCH` | `/admin/tenants/:id` | Edita tenant |
| `POST` | `/admin/tenants/:id/usuarios` | Cria usuário em um tenant |

### 4. Frontend — Middleware

Regras:
- `/admin/login` → pública
- `/` → pública (prep Landing Page)
- `/admin/*` → só SUPER_ADMIN; outros → /dashboard
- `/dashboard/*` → não-SUPER_ADMIN; SUPER_ADMIN → /admin

### 5. Frontend — Grupo de Rotas `(admin)`

```
apps/web/src/app/(admin)/
├── layout.tsx
├── admin/
│   └── page.tsx
└── admin/login/
    └── page.tsx
```

### 6. Frontend — Tipos e Hook

- `Tenant` interface em `types/index.ts`
- `use-admin.ts` — hook dedicado

---

## Decisões de Design

| Decisão | Alternativa descartada | Motivo |
|---|---|---|
| `tenantId` opcional em User | Modelo separado `SuperAdminUser` | Reutiliza auth existente sem duplicar guard/JWT |
| Login separado `/admin/auth/login` | Adaptar o `/auth/login` com flag | Mantém os dois fluxos isolados |
| Decodificar JWT no middleware (sem verificar assinatura) | Biblioteca `jose` no Edge | A API verifica; o middleware só precisa do role para redirect |
| Layout `(admin)` totalmente separado | Adaptar layout do dashboard | Evita side effects entre fluxos |
