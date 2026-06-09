# Matriz de Permissoes - Oneelo

Este documento define a matriz oficial de permissao por perfil global e por papel ministerial. Ele serve como referencia para `@Roles()`, `RolesGuard`, `AuthorizationService`, middleware do frontend e visibilidade condicional na UI.

---

## Conceitos

O sistema possui dois niveis de permissao:

1. `User.role`: perfil global de acesso ao sistema.
2. `MinisterioMembro.role`: papel contextual de um membro dentro de um ministerio.

Enums globais de `User.role`:

```txt
ADMIN
STAFF
BASIC
SUPER_ADMIN
```

Enums de `MinisterioMembro.role`:

```txt
LEADER
ASSISTANT_LEADER
MEMBER
```

Decisao de produto: os enums tecnicos nao devem ser renomeados. Termos como "Administrador", "Equipe", "Membro", "Lider" e "Co-lider" sao labels de UI/i18n.

---

## Perfis

| Perfil | Escopo | Descricao |
|---|---|---|
| `SUPER_ADMIN` | Plataforma | Administra tenants no painel Lookup Labs. Nao pertence ao fluxo operacional do tenant. |
| `ADMIN` | Tenant | Acesso administrativo total ao tenant. |
| `STAFF` | Tenant | Equipe operacional global do tenant. Pode gerir membros, ministerios, escalas e agenda conforme modulo. |
| `BASIC` | Usuario restrito | Membro comum. Ganha poderes contextuais quando seu `memberId` possui `LEADER` ou `ASSISTANT_LEADER` em um ministerio. |

---

## Matriz de Acesso

| Recurso / Acao | ADMIN | STAFF | BASIC + LEADER | BASIC + ASSISTANT_LEADER | BASIC + MEMBER |
|---|---:|---:|---:|---:|---:|
| Dashboard administrativo | sim | sim | nao | nao | nao |
| Membros globais - listar/criar/editar/remover | sim | sim | nao | nao | nao |
| Ministerios - listar | sim | sim | apenas os que lidera | apenas os que co-lidera | nao |
| Ministerios - criar/editar/arquivar | sim | sim | nao | nao | nao |
| Ministerio - ver detalhes | sim | sim | seu ministerio | seu ministerio | nao |
| Ministerio - adicionar participantes | sim | sim | seu ministerio | seu ministerio | nao |
| Ministerio - remover participantes | sim | sim | seu ministerio, exceto `LEADER` | seu ministerio, exceto `LEADER` | nao |
| Ministerio - definir `LEADER` | sim | sim | nao | nao | nao |
| Ministerio - definir `ASSISTANT_LEADER` | sim | sim | seu ministerio, exceto em `LEADER` e em si mesmo | seu ministerio, exceto em `LEADER` e em si mesmo | nao |
| Ministerio - definir funcoes disponiveis por membro | sim | sim | seu ministerio | seu ministerio | nao |
| Escalas - listar/ver | sim | sim | seus ministerios | seus ministerios | onde esta escalado |
| Escalas - criar/editar/excluir | sim | sim | seus ministerios | seus ministerios | nao |
| Escalas - adicionar/remover dias | sim | sim | seus ministerios | seus ministerios | nao |
| Escalas - adicionar/remover membros | sim | sim | seus ministerios | seus ministerios | nao |
| Escalas - confirmar/recusar propria presenca | sim | sim | sim | sim | sim |
| Agenda - listar | sim | sim | sim | sim | sim |
| Agenda - gerir eventos globais | sim | sim | pendente decisao | pendente decisao | nao |
| Meu Perfil | sim | sim | sim | sim | sim |
| Usuarios do tenant | sim | nao | nao | nao | nao |
| Auditoria | sim | sim | nao | nao | nao |

---

## Regras Especificas

### Gestao ministerial por BASIC

Um usuario `BASIC` so pode agir como lider/co-lider quando:

1. `user.memberId` existe.
2. Existe registro em `MinisterioMembro` para o `ministerioId` alvo.
3. O papel ministerial e `LEADER` ou `ASSISTANT_LEADER`.

Quando autorizado nesse contexto, o `BASIC` pode:

- adicionar participantes ao proprio ministerio;
- adicionar participantes como `MEMBER` ou `ASSISTANT_LEADER`;
- remover participantes do proprio ministerio, exceto `LEADER`;
- alterar papel entre `MEMBER` e `ASSISTANT_LEADER`, exceto em outro `LEADER` e em si mesmo;
- marcar funcoes disponiveis por membro no ministerio;
- gerir escalas do ministerio.

Ele nao pode:

- criar, editar ou arquivar ministerios;
- acessar a listagem global de membros;
- promover alguem a `LEADER`;
- alterar/remover outro `LEADER`;
- alterar o proprio papel ministerial;
- agir em ministerios onde nao e lider/co-lider.

### Escalas

- `ADMIN` e `STAFF` gerem escalas de qualquer ministerio do tenant.
- `BASIC + LEADER/ASSISTANT_LEADER` gere escalas apenas dos ministerios onde possui esse papel.
- `BASIC + MEMBER` visualiza/confirmar apenas suas proprias escalas.
- Confirmacao/recusa de presenca e sempre uma acao do membro escalado, independente do perfil global.

### Sidebar e rotas

- `BASIC` comum nao deve ver ou acessar rotas administrativas.
- `BASIC` lider/co-lider ve `Ministerios` e `Escalas`, mas apenas com dados dos ministerios que lidera/co-lidera.
- As secoes expansivas da sidebar devem iniciar fechadas por padrao.

---

## Como o Sistema Resolve Permissoes

### Rotas globais

Use `@Roles(Role.ADMIN, Role.STAFF)` quando o recurso nao tem escopo ministerial.

Exemplos:

```ts
@Roles(Role.ADMIN, Role.STAFF)
```

### Rotas com escopo ministerial direto

Quando o `ministerioId` esta na URL ou no body, a autorizacao deve permitir:

1. `ADMIN` ou `STAFF`;
2. `BASIC` com `MinisterioMembro.role` em `LEADER` ou `ASSISTANT_LEADER` no ministerio alvo.

### Rotas com escopo indireto

Quando a entidade precisa ser carregada para descobrir o ministerio, use `AuthorizationService`.

Exemplo: uma escala aponta para `ministerioId`, entao o service deve carregar a escala e validar se o usuario pode gerir aquele ministerio.

API esperada:

```ts
canManageTenant(user): boolean
isMinistryLeader(user, ministerioId): Promise<boolean>
canManageMinistry(user, ministerioId): Promise<boolean>
assertCanManageMinistry(user, ministerioId): Promise<void>
```

---

## Referencias

- `ai-context/architecture/decisions.md`
- `ai-context/business-rules/validation-rules.md`
- `ai-context/frontend/navigation-rules.md`
- `ai-context/plans/rbac-navigation-experience-plan.md`
