# Plano de Correcao de Seguranca

> Status: concluido com observacoes
> Ultima atualizacao: 2026-06-09

---

## Resumo

Este plano registrou correcoes iniciais de seguranca e RBAC. A regra final de permissao foi refinada posteriormente no plano de RBAC, navegacao e experiencia por perfil.

Referencia atual obrigatoria:

- `ai-context/backlog/permissions-matrix.md`
- `ai-context/plans/rbac-navigation-experience-plan.md`

---

## Etapas Concluidas

- [x] `forbidNonWhitelisted: true` no `ValidationPipe`.
- [x] Corrigir `@Roles()` faltando em controllers sensiveis.
- [x] Corrigir roles em `EscalasController`.
- [x] Corrigir roles em `MinisteriosController`.
- [x] Corrigir roles em `EventosController`.
- [x] Aplicar rate limiting no login.
- [x] Adicionar `@IsNotEmpty()` em DTOs de criacao.
- [x] Aplicar role-based UI no frontend.
- [x] Adicionar auditoria em fluxos de Super Admin.

---

## Observacao sobre BASIC

A leitura antiga deste plano tratava `BASIC` como sempre bloqueado para operacoes administrativas de escalas.

A regra atual e:

- `BASIC` comum nao pode executar mutacoes administrativas.
- `BASIC` com `MinisterioMembro.role = LEADER` ou `ASSISTANT_LEADER` pode gerir escalas apenas dos ministerios que lidera/co-lidera.
- Essa permissao deve ser validada no backend, preferencialmente via `AuthorizationService` ou regra equivalente no service.

---

## Matriz Atual de Escalas

| Operacao | ADMIN | STAFF | BASIC lider/co-lider | BASIC comum |
|---|---:|---:|---:|---:|
| Listar/ver | sim | sim | seus ministerios | onde esta escalado |
| Criar escala | sim | sim | seus ministerios | nao |
| Editar escala | sim | sim | seus ministerios | nao |
| Excluir escala | sim | sim | seus ministerios | nao |
| Adicionar/remover dia | sim | sim | seus ministerios | nao |
| Adicionar/remover membro | sim | sim | seus ministerios | nao |
| Confirmar/recusar propria presenca | sim | sim | sim | sim |

---

## Arquivos Relacionados

| Arquivo | Observacao |
|---|---|
| `apps/api/src/main.ts` | ValidationPipe |
| `apps/api/src/modules/escalas/escalas.controller.ts` | Roles alinhadas com service |
| `apps/api/src/modules/ministerios/ministerios.controller.ts` | Roles e rotas ministeriais |
| `apps/api/src/common/authorization/authorization.service.ts` | Autorizacao contextual |
| `apps/web/src/components/app/sidebar.tsx` | Navegacao por perfil |
| `apps/web/src/middleware.ts` | Bloqueio basico de rotas |
