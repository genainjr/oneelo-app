# Backlog - Melhorias Gerais

---

### IMP-001 Adicionar campos email, phone e language ao Tenant

- **Status**: pendente
- **Prioridade**: alta
- **Categoria**: infraestrutura / homologacao
- **Contexto**: O Tenant ja existe com isolamento multi-tenant completo. O roadmap previa campos de contato e idioma padrao para a entidade Tenant.
- **Acao**: Confirmar o estado atual do schema. Se ainda faltar algo, adicionar migration Prisma e atualizar DTOs de criacao/edicao de tenant.
- **Impacto**: Desbloqueia informacoes de contato no Super Admin e futura configuracao de idioma padrao por tenant.
- **Arquivos afetados**:
  - `apps/api/prisma/schema.prisma`
  - `apps/api/src/modules/super-admin/`

---

### IMP-002 Landing Page publica no middleware

- **Status**: revisar estado atual
- **Prioridade**: alta
- **Categoria**: infraestrutura / homologacao
- **Contexto**: A landing page precisa ser publica em `/`. O plano da landing esta marcado como concluido, entao este item deve ser reconciliado com o codigo atual.
- **Acao**: Validar se `/` esta em `PUBLIC_PATHS` no middleware. Se estiver, marcar como concluido; se nao estiver, ajustar.
- **Impacto**: Visitantes acessam a landing sem autenticacao.
- **Arquivos afetados**:
  - `apps/web/src/middleware.ts`
  - `apps/web/src/app/page.tsx`

---

### IMP-003 Fluxo Git - branches devem partir de `development`

- **Status**: documentado
- **Prioridade**: media
- **Categoria**: DX
- **Contexto**: O fluxo padrao de trabalho deve partir sempre de `development` atualizado.
- **Acao**: Manter o workflow documentado em `ai-context/workflows/feature-development.md` e configurar protecao de branch no GitHub quando aplicavel.
- **Impacto**: Historico mais limpo e menor risco de features partirem de base incorreta.

---

### IMP-004 AuditLog registra IP do proxy em vez do IP real do cliente

- **Status**: implementado em `fix/member-audit-cookie-backlog`
- **Prioridade**: alta
- **Categoria**: seguranca
- **Contexto**: Duplicado funcional de `SEC-001`. Mantido aqui apenas como referencia historica.
- **Acao**: Resolvido por helper compartilhado que prioriza `x-forwarded-for`, depois `x-real-ip`, depois `req.ip`.
- **Impacto**: Logs de auditoria voltam a registrar o IP real quando headers de proxy estao presentes.
- **Arquivos afetados**:
  - `apps/api/src/common/utils/request-ip.ts`
  - `apps/api/src/modules/auth/auth.controller.ts`
  - `apps/api/src/common/interceptors/audit.interceptor.ts`

---

### IMP-005 Membro excluido continua vinculado e visivel em ministerios

- **Status**: implementado em `fix/member-audit-cookie-backlog`
- **Prioridade**: alta
- **Categoria**: consistencia de dados / UX
- **Contexto**: Ao excluir ou arquivar um membro que participa de um ministerio, o membro continuava aparecendo no gerenciamento de ministerios.
- **Acao**: Ao fazer soft delete do membro, remover vinculos em `MinisterioMembroFuncao` e `MinisterioMembro`. Nas consultas de ministerios, filtrar membros com `deletedAt = null` e `status = ATIVO`.
- **Impacto**: Evita inconsistencia visual e operacional no gerenciamento de ministerios.
- **Arquivos afetados**:
  - `apps/api/src/modules/membros/membros.service.ts`
  - `apps/api/src/modules/ministerios/ministerios.service.ts`
