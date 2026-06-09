# Backlog - Seguranca

---

### SEC-001 Auditoria registra IP do proxy em vez do IP real do usuario

- **Status**: implementado em `fix/member-audit-cookie-backlog`
- **Prioridade**: alta
- **Categoria**: seguranca
- **Contexto**: Apos a adocao do proxy reverso via Next.js Rewrites, `req.ip` no backend pode retornar o IP do proxy/edge em vez do cliente real. Isso compromete os logs de auditoria (`AuditLog`) e o registro de IP no login.
- **Acao**: Ler `x-forwarded-for` ou `x-real-ip`, com fallback para `req.ip` em desenvolvimento/local.
- **Impacto**: Logs de auditoria registram o IP real quando os headers de proxy estao presentes.
- **Arquivos afetados**:
  - `apps/api/src/common/utils/request-ip.ts`
  - `apps/api/src/modules/auth/auth.controller.ts`
  - `apps/api/src/modules/super-admin/super-admin.controller.ts`
  - `apps/api/src/common/interceptors/audit.interceptor.ts`

---

### SEC-002 Cookie em producao usa sameSite restritivo

- **Status**: implementado em `fix/member-audit-cookie-backlog`
- **Prioridade**: media
- **Categoria**: seguranca
- **Contexto**: Com o proxy reverso ativo, as requisicoes do browser sao same-origin. O cookie nao precisa de `sameSite: 'none'`.
- **Acao**: Usar `sameSite: 'lax'` nos cookies de autenticacao e manter `secure: true` em producao.
- **Impacto**: Reduz superficie de ataque CSRF sem quebrar o fluxo atual de login.
- **Arquivos afetados**:
  - `apps/api/src/modules/auth/auth.controller.ts`
  - `apps/api/src/modules/super-admin/super-admin.controller.ts`
