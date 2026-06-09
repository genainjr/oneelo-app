# Plano - RBAC, Navegacao e Experiencia por Perfil

> Status: em desenvolvimento
> Ultima atualizacao: 2026-06-09

---

## Resumo Executivo

A auditoria de permissoes identificou inconsistencias entre o modelo esperado
(`ADMIN`, `COLABORADOR`, `MEMBRO`) e o modelo tecnico definitivo do sistema
(`ADMIN`, `STAFF`, `BASIC`, `SUPER_ADMIN`).

O problema central nao e ausencia completa de RBAC. O sistema ja tem `@Roles()`,
`RolesGuard`, `MinistryRole`, `MinistryGuard` e validacoes manuais em alguns
services. O risco esta na aplicacao inconsistente dessas regras entre backend,
frontend, navegacao e experiencia.

Prioridade tecnica:

1. Fechar brechas reais de autorizacao no backend.
2. Alinhar controller e service em escalas.
3. Criar experiencia propria para `BASIC` com label de produto "Membro".
4. Consolidar `STAFF` como equipe global do tenant, separado da lideranca por
   ministerio.

---

## Decisoes de Produto

Os ENUMs de roles nao serao renomeados. O sistema deve manter:

```txt
ADMIN
STAFF
BASIC
SUPER_ADMIN
```

Qualquer nomenclatura como "Administrador", "Equipe", "Colaborador" ou
"Membro" deve ser tratada apenas como label de interface/i18n, sem migration no
enum `Role`.

| Decisao | Recomendacao | Motivo |
|---|---|---|
| Enum de roles | Manter `ADMIN`, `STAFF`, `BASIC`, `SUPER_ADMIN` | Decisao fechada de produto/arquitetura |
| Label de `BASIC` na UI | "Membro" | Nome tecnico nao deve aparecer para usuario final |
| Papel de `STAFF` | Equipe global do tenant | Diferenciar de lider/co-lider ministerial |
| Colaborador ministerial | `BASIC` + `MinistryRole.LEADER/ASSISTANT_LEADER` | Ja existe relacao por ministerio |

---

## Etapas

- [x] 1. Corrigir autorizacao em `POST /ministerios/:id/membros`
- [x] 2. Corrigir autorizacao em `DELETE /ministerios/:id/membros/:membroId`
- [x] 3. Criar helper/service central de autorizacao ministerial
- [x] 4. Revisar uso de `MinistryGuard` e `@MinistryRoles()`
- [x] 5. Alinhar `EscalasController` com regras ja previstas em `EscalasService`
- [x] 6. Ajustar UI de escalas para permissao por ministerio selecionado
- [x] 7. Criar rota `/minhas-escalas`
- [x] 8. Criar rota `/meu-perfil`
- [x] 9. Ajustar redirect pos-login por role/perfil
- [x] 10. Ajustar sidebar para `ADMIN`, `STAFF`, lider/co-lider e membro comum
- [x] 11. Bloquear/ocultar dashboard administrativo para membro comum
- [x] 11.1. Permitir que lider/co-lider `BASIC` adicione membros no proprio ministerio e selecione tipo permitido na inclusao/listagem
- [x] 11.2. Definir sidebar com secoes internas minimizadas por padrao
- [ ] 12. Definir e implementar escopo ministerial da agenda
- [ ] 13. Ajustar labels/i18n de roles
- [ ] 14. Adicionar testes e2e para perfis e acessos indevidos

---

## P0 - Seguranca Backend

### 1. Ministerio: adicionar membro

**Rota:** `POST /ministerios/:id/membros`

Problema:

- O controller permite `Role.BASIC`.
- O service `addMembro` nao recebe `user`.
- Nao ha validacao se o usuario `BASIC` lidera o ministerio informado.

Risco:

- Um membro autenticado pode tentar adicionar membros em ministerios indevidos
  caso conheca IDs validos.

Correcao:

- Passar `JwtPayload` do controller para o service.
- Permitir acesso global para `ADMIN` e `STAFF`.
- Para `BASIC`, exigir `LEADER` ou `ASSISTANT_LEADER` no ministerio.
- Bloquear elevacao indevida para `LEADER`, salvo `ADMIN`/`STAFF`.

### 2. Ministerio: remover membro

**Rota:** `DELETE /ministerios/:id/membros/:membroId`

Problema:

- O controller permite `Role.BASIC`.
- O service impede remover outro `LEADER`, mas nao valida se o ator lidera o
  ministerio.

Risco:

- Um membro comum pode tentar remover participantes de ministerios indevidos.

Correcao:

- Aplicar a mesma validacao ministerial da etapa anterior.
- Manter bloqueio contra remocao de `LEADER` por lider ministerial.
- Definir se `ASSISTANT_LEADER` pode remover membros ou apenas `LEADER`.

---

## P1 - Autorizacao Ministerial Padrao

### Estado atual

- `MinistryGuard` existe.
- `@MinistryRoles()` existe.
- Nenhum controller usa esses decorators de forma efetiva.
- Algumas regras estao duplicadas manualmente em services.

### Direcao tecnica

Criar um `AuthorizationService` para regras que exigem resolver entidade antes
de autorizar. Exemplo: uma escala aponta para um ministerio, entao a autorizacao
precisa carregar a escala para descobrir `ministerioId`.

Usar `MinistryGuard` apenas em rotas onde `ministerioId` esta claro na URL ou no
body.

### API sugerida

```ts
canManageTenant(user: JwtPayload): boolean
canManageMinistry(user: JwtPayload, ministerioId: string): Promise<boolean>
assertCanManageMinistry(user: JwtPayload, ministerioId: string): Promise<void>
isMinistryLeader(user: JwtPayload, ministerioId: string): Promise<boolean>
```

---

## P1 - Escalas

### Problema

`EscalasService` ja tem logica para `BASIC` lider/co-lider administrar escalas
dos seus ministerios, mas `EscalasController` bloqueia `BASIC` em varias rotas
administrativas.

No frontend, a pagina de escalas considera `BASIC` como `canManage`, o que pode
exibir acoes que falham com `403`.

### Matriz desejada

| Operacao | ADMIN | STAFF | Lider/co-lider | Membro comum |
|---|---:|---:|---:|---:|
| Listar/ver escalas | sim | sim | seus ministerios | onde esta escalado |
| Criar escala | sim | sim | seus ministerios | nao |
| Editar escala | sim | sim | seus ministerios | nao |
| Excluir escala | sim | sim | seus ministerios | nao |
| Adicionar/remover dia | sim | sim | seus ministerios | nao |
| Adicionar/remover membro da escala | sim | sim | seus ministerios | nao |
| Confirmar/recusar propria escala | sim | sim | sim | sim |

### Correcao

- Permitir `Role.BASIC` nas rotas administrativas de escalas quando o service
  validar lideranca no ministerio da escala.
- Diferenciar no frontend:
  - `canManageTenant`
  - `canManageSelectedMinistry`
  - `canConfirmOwnSchedule`

---

## P1 - Experiencia do MEMBRO/BASIC

### Estado atual

- Login usa `/dashboard` como redirect padrao.
- Sidebar oculta pouco para `BASIC`.
- Nao existem telas dedicadas de `Minhas Escalas` e `Meu Perfil`.
- Dashboard administrativo nao deve ser a tela inicial de membro comum.

### Menu esperado

```txt
Minhas Escalas
Agenda
Meu Perfil
```

### Rotas novas

```
apps/web/src/app/(dashboard)/minhas-escalas/page.tsx
apps/web/src/app/(dashboard)/meu-perfil/page.tsx
```

### Correcao

- Redirecionar `BASIC` sem lideranca para `/minhas-escalas`.
- Ocultar de membro comum:
  - Dashboard
  - Membros
  - Ministerios
  - Configuracoes
  - Financeiro
  - Integracoes
  - Grupos
- Manter acesso a agenda global e escalas proprias.

---

## P2 - Dashboard por Perfil

| Perfil | Recomendacao |
|---|---|
| `ADMIN` | Mantem dashboard global |
| `STAFF` | Mantem dashboard global, se for equipe administrativa |
| Lider/co-lider | Dashboard ministerial opcional |
| Membro comum | Sem dashboard administrativo |

Backend atual ja restringe dashboard a `ADMIN` e `STAFF`. O ajuste principal e
de navegacao/UX para impedir que `BASIC` seja direcionado para essa tela.

---

## P2 - Agenda por Escopo

### Estado atual

`Evento` e global do tenant. O model nao possui `ministerioId`.

### Decisao pendente

Agenda deve ser:

1. Apenas global da igreja.
2. Global + ministerial.
3. Vinculada a multiplos ministerios.

### Recomendacao

Implementar `ministerioId` opcional em `Evento`.

- `ministerioId = null`: evento global da igreja.
- `ministerioId != null`: evento de ministerio.
- Membro comum ve eventos globais e eventos dos ministerios onde participa.
- Lider/co-lider administra eventos dos ministerios que lidera.

---

## Arquivos

### Backend

| Arquivo | Acao | Status |
|---|---|---|
| `apps/api/src/modules/ministerios/ministerios.controller.ts` | passar user e revisar roles | concluido |
| `apps/api/src/modules/ministerios/ministerios.service.ts` | validar lideranca em add/remove membro e listar membros disponiveis por ministerio | concluido |
| `apps/api/src/modules/escalas/escalas.controller.ts` | alinhar roles com service | concluido |
| `apps/api/src/modules/escalas/escalas.service.ts` | centralizar autorizacao | pendente |
| `apps/api/src/common/guards/ministry.guard.ts` | manter para rotas com ministerioId direto; usar service em regras indiretas | concluido |
| `apps/api/src/common/decorators/ministry-roles.decorator.ts` | manter para rotas com ministerioId direto; usar service em regras indiretas | concluido |
| `apps/api/src/common/authorization/authorization.service.ts` | novo helper/service | concluido |
| `apps/api/src/common/authorization/authorization.module.ts` | novo modulo compartilhado | concluido |
| `apps/api/prisma/schema.prisma` | adicionar `Evento.ministerioId?` se aprovado | pendente |
| `apps/api/src/modules/eventos/eventos.controller.ts` | aplicar escopo de agenda | pendente |
| `apps/api/src/modules/eventos/eventos.service.ts` | filtrar por perfil/ministerio | pendente |

### Frontend

| Arquivo | Acao | Status |
|---|---|---|
| `apps/web/src/app/(auth)/login/page.tsx` | redirect por perfil | concluido |
| `apps/web/src/middleware.ts` | matriz basica de rotas por role | concluido |
| `apps/web/src/components/app/sidebar.tsx` | menu por perfil | concluido |
| `apps/web/src/app/(dashboard)/minhas-escalas/page.tsx` | nova tela | concluido |
| `apps/web/src/app/(dashboard)/meu-perfil/page.tsx` | nova tela | concluido |
| `apps/web/src/app/(dashboard)/ministerios/page.tsx` | gestao ministerial por lider/co-lider `BASIC` | concluido |
| `apps/web/src/app/(dashboard)/escalas/page.tsx` | permissao por ministerio | concluido |
| `apps/web/src/app/(dashboard)/dashboard/page.tsx` | bloquear BASIC comum | pendente |
| `apps/web/src/app/(dashboard)/agenda/page.tsx` | escopo global/ministerial | pendente |
| `apps/web/src/lib/auth.ts` | helpers de role/perfil | pendente |
| `apps/web/messages/pt-BR.json` | labels de roles | pendente |
| `apps/web/messages/pt-PT.json` | labels de roles | pendente |
| `apps/web/messages/en-US.json` | labels de roles | pendente |

---

## Criterios de Aceite

- Membro comum nao consegue executar mutacoes administrativas por API.
- Membro comum nao ve menus administrativos.
- Membro comum entra em `/minhas-escalas`, nao em `/dashboard`.
- Lider/co-lider administra apenas ministerios onde possui `LEADER` ou
  `ASSISTANT_LEADER`.
- Lider/co-lider nao consegue alterar outros ministerios por URL ou chamada
  direta de API.
- `ADMIN` mantem acesso total ao tenant.
- `SUPER_ADMIN` permanece isolado no painel Lookup Labs.
- Testes cobrem pelo menos `ADMIN`, `STAFF`, lider/co-lider e membro comum.

---

## Ordem Recomendada

1. Corrigir autorizacao backend de ministerios.
2. Criar `AuthorizationService` ou padrao equivalente.
3. Alinhar escalas entre controller, service e UI.
4. Criar experiencia do membro comum.
5. Ajustar experiencia do lider/co-lider.
6. Decidir e implementar escopo da agenda.
7. Padronizar labels, i18n e documentacao final.
