# Decisoes de RBAC, Labels e Autorizacao Contextual

Este documento complementa `architecture/decisions.md` com as decisoes consolidadas durante a revisao de permissoes, navegacao e experiencia por perfil.

---

## Decisao 1 - Enums de Role nao serao renomeados

Os enums tecnicos de `User.role` devem permanecer:

```txt
ADMIN
STAFF
BASIC
SUPER_ADMIN
```

Termos como "Administrador", "Equipe", "Membro", "Lider" e "Co-lider" sao labels de interface/i18n.

Motivo:

- evita migration desnecessaria;
- reduz risco de regressao;
- preserva contratos ja implementados no backend, frontend e JWT.

---

## Decisao 2 - Permissao global e ministerial sao separadas

`User.role` define permissao global do sistema.

`MinisterioMembro.role` define papel contextual dentro de um ministerio:

```txt
LEADER
ASSISTANT_LEADER
MEMBER
```

Um `BASIC` so ganha poderes de gestao quando seu `memberId` possui `LEADER` ou `ASSISTANT_LEADER` no ministerio alvo.

---

## Decisao 3 - Backend e fonte de verdade

O frontend deve ocultar menus e acoes por perfil, mas toda regra de permissao precisa existir no backend.

Padroes:

- `@Roles()` para permissao global simples;
- `AuthorizationService` para regra contextual por ministerio;
- validacao em service quando for necessario carregar uma entidade para descobrir `ministerioId`.

---

## Decisao 4 - Gestao ministerial por BASIC lider/co-lider

`BASIC + LEADER/ASSISTANT_LEADER` pode, no proprio ministerio:

- adicionar participantes;
- adicionar como `MEMBER` ou `ASSISTANT_LEADER`;
- remover participantes, exceto `LEADER`;
- alterar papel entre `MEMBER` e `ASSISTANT_LEADER`, exceto em outro `LEADER` e em si mesmo;
- definir funcoes disponiveis por membro;
- gerir escalas do ministerio.

Nao pode:

- criar, editar ou arquivar ministerios;
- listar membros globais;
- definir `LEADER`;
- alterar/remover outro `LEADER`;
- alterar o proprio papel;
- agir em ministerios onde nao lidera/co-lidera.

---

## Referencias

- `ai-context/backlog/permissions-matrix.md`
- `ai-context/business-rules/validation-rules.md`
- `ai-context/frontend/navigation-rules.md`
- `ai-context/plans/rbac-navigation-experience-plan.md`
