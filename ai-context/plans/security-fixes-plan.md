# Plano de Correção de Segurança

> Status: em andamento
> Última atualização: 2026-06-08

---

## Resumo Executivo

Foram identificados **5 problemas críticos (P0)**, **2 problemas altos (P1)** e **3 médios (P2)**.
O problema relatado pelo usuário ("usuário não-admin conseguiu fazer tudo") tem duas causas:
1. Rotas sem `@Roles()` ficam abertas a qualquer usuário autenticado (comportamento do RolesGuard)
2. Frontend não filtra UI por role — BASIC vê e tenta acessar tudo

---

## Etapas

- [x] **1. `forbidNonWhitelisted: true` no ValidationPipe** — `apps/api/src/main.ts`
- [x] **2. Corrigir `@Roles()` faltando — EscalasController** — rotas GET e confirmar sem decorator
- [x] **3. Corrigir `@Roles()` faltando — MinisteriosController** — rotas GET sem decorator
- [x] **4. Corrigir `@Roles()` faltando — EventosController** — rotas GET sem decorator
- [x] **5. Remover BASIC de operações destrutivas em escalas** — DELETE, addDia, removeDia, addMembro, removeMembro, toggleFuncaoOculta
- [x] **6. Rate Limiting no login** — `@nestjs/throttler` instalado, 5 req/60s em auth + super-admin login
- [x] **7. `@IsNotEmpty()` nos Create DTOs** — membro, ministerio, evento, tag, lead
- [x] **8. Role-based UI no frontend** — sidebar oculta Membros de BASIC; página /membros redireciona BASIC
- [x] **9. Auditoria no Super Admin Service** — AuditLog em createTenant, updateTenant, createTenantUser

---

## Detalhes

### P0 — Crítico

#### 1. `forbidNonWhitelisted: true`
**Arquivo:** `apps/api/src/main.ts:20`
API atualmente aceita campos extras no body sem rejeitar. Mudar para `true` faz o NestJS
retornar 400 para qualquer campo fora do DTO declarado.

#### 2–4. Rotas sem `@Roles()`
O `RolesGuard` tem fallback: "se não tem `@Roles()`, qualquer autenticado passa".
Rotas afetadas:

| Rota | Status |
|---|---|
| `GET /escalas` | ✗ sem @Roles |
| `GET /escalas/:id` | ✗ sem @Roles |
| `PATCH /escalas/itens/:id/confirmar` | ✗ sem @Roles |
| `GET /ministerios` | ✗ sem @Roles |
| `GET /ministerios/:id` | ✗ sem @Roles |
| `GET /eventos` | ✗ sem @Roles |
| `GET /eventos/:id` | ✗ sem @Roles |

#### 5. Matriz de roles correta para escalas
| Operação | ADMIN | STAFF | BASIC |
|---|---|---|---|
| GET listar/ver | ✓ | ✓ | ✓ |
| POST criar escala | ✓ | ✓ | ✗ |
| PATCH editar escala | ✓ | ✓ | ✗ |
| DELETE apagar escala | ✓ | ✓ | ✗ |
| addDia / removeDia | ✓ | ✓ | ✗ |
| addMembro item / removeMembro item | ✓ | ✓ | ✗ |
| toggleFuncaoOculta | ✓ | ✓ | ✗ |
| confirmar presença | ✓ | ✓ | ✓ |

#### 6. Rate Limiting
Sem throttle nos endpoints de login — vulnerável a brute force.
Solução: `@nestjs/throttler` com 5 req/60s nas rotas de login.

### P1 — Alto

#### 7. `@IsNotEmpty()` nos Create DTOs
Campos como `nome` aceitam string vazia `""` passando validação.

#### 8. Role-based UI no frontend
Sidebar mostra todos os módulos a todos os usuários.
BASIC vê "Membros" no menu mesmo sem acesso no backend.

### P2 — Médio

#### 9. Auditoria no Super Admin
`createTenant`, `updateTenant`, `createTenantUser` não geram `AuditLog`.

---

## Arquivos Modificados

| Arquivo | Etapa | Status |
|---|---|---|
| `apps/api/src/main.ts` | 1 | ✅ concluído |
| `apps/api/src/modules/escalas/escalas.controller.ts` | 2, 5 | ✅ concluído |
| `apps/api/src/modules/ministerios/ministerios.controller.ts` | 3 | ✅ concluído |
| `apps/api/src/modules/eventos/eventos.controller.ts` | 4 | ✅ concluído |
| `apps/api/src/app.module.ts` + `ThrottlerModule` | 6 | ✅ concluído |
| `apps/api/src/modules/auth/auth.controller.ts` | 6 | ✅ concluído |
| `apps/api/src/modules/super-admin/super-admin.controller.ts` | 6, 9 | ✅ concluído |
| `apps/api/src/modules/membros/dto/create-membro.dto.ts` | 7 | ✅ concluído |
| `apps/api/src/modules/ministerios/dto/create-ministerio.dto.ts` | 7 | ✅ concluído |
| `apps/api/src/modules/eventos/dto/create-evento.dto.ts` | 7 | ✅ concluído |
| `apps/api/src/modules/tags/dto/create-tag.dto.ts` | 7 | ✅ concluído |
| `apps/web/src/components/app/sidebar.tsx` | 8 | ✅ concluído |
| `apps/web/src/app/(dashboard)/membros/page.tsx` | 8 | ✅ concluído |
| `apps/api/src/modules/super-admin/super-admin.service.ts` | 9 | ✅ concluído |
