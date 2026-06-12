# Repository AI Context Manifest

Este repositorio contem a documentacao de contexto da IA para o projeto Oneelo, um SaaS de gestao para igrejas.

---

## Dominios Principais

- Multi-tenancy e limites de plano.
- Gestao de membros, tags e soft delete.
- Ministerios, lideranca contextual e funcoes por membro.
- Escalas, confirmacao de presenca e experiencia do membro.
- Eventos e agenda.
- Auditoria e seguranca.
- Super Admin da plataforma Lookup Labs.

---

## Arquitetura Primaria

- Backend: NestJS, Prisma e PostgreSQL.
- Frontend: Next.js App Router.
- Autenticacao: JWT em cookie HTTP-only.
- RBAC: `User.role` para permissao global e `MinisterioMembro.role` para permissao ministerial.

---

## Contextos Importantes

- [Visao Geral da Arquitetura](architecture/overview.md)
- [Decisoes de RBAC](architecture/rbac-decisions.md)
- [Dicionario de Modelos](database/models.md)
- [Matriz de Permissoes](backlog/permissions-matrix.md)
- [Regras de Negocio e Validacoes](business-rules/validation-rules.md)
- [Regras de Navegacao e Sidebar](frontend/navigation-rules.md)
- [Workflow de Desenvolvimento](workflows/feature-development.md)
- [Plano RBAC, Navegacao e Experiencia](plans/rbac-navigation-experience-plan.md)
- [Plano de Visualizacoes de Membros e Escalas](plans/portal-member-scale-visualizations-plan.md)
- [Backlog Tecnico](backlog/README.md)
- [Plano de Desenvolvimento Original](../plano_desenvolvimento_ideal_markdown.md)
---

## Product

- [Visão Geral](product/oneelo-overview.md)
- [Módulos](product/oneelo-modules.md)
- [Papéis e Permissões](product/oneelo-roles-and-permissions.md)
- [Multi-tenancy](product/oneelo-multitenancy.md)
- [Status do ODS](product/ods-current-status.md)

---
## Decisoes Consolidadas

- Os enums de `Role` permanecem `ADMIN`, `STAFF`, `BASIC` e `SUPER_ADMIN`.
- Labels amigaveis devem ser resolvidas na UI/i18n.
- `BASIC` comum nao acessa areas administrativas.
- `BASIC` lider/co-lider ganha poderes apenas nos ministerios onde possui `LEADER` ou `ASSISTANT_LEADER`.
- Backend e a fonte de verdade de autorizacao.
- Sidebar inicia com secoes internas recolhidas por padrao.
