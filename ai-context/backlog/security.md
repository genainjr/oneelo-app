# Backlog — Segurança

---

### SEC-001 Auditoria registra IP do Vercel em vez do IP real do usuário

- **Prioridade**: alta
- **Categoria**: segurança
- **Contexto**: Após a adoção do proxy reverso via Next.js Rewrites (ADR #7), o `req.ip` no backend retorna o IP do edge node do Vercel, não o do cliente real. Isso compromete os logs de auditoria (`AuditLog`) e o registro de IP no login.
- **Ação**: Ler o header `x-forwarded-for` (ou `x-real-ip`) no auth controller e no AuditInterceptor. Aplicar fallback para `req.ip` quando o header não estiver presente (dev local).
- **Impacto**: Logs de auditoria voltam a registrar o IP real do usuário, mantendo rastreabilidade para conformidade e investigação de incidentes.
- **Arquivos afetados**:
  - `apps/api/src/modules/auth/auth.controller.ts` (linha do `req.ip`)
  - `apps/api/src/common/interceptors/audit.interceptor.ts`

---

### SEC-002 Cookie em produção usa sameSite: 'none' desnecessariamente

- **Prioridade**: média
- **Categoria**: segurança
- **Contexto**: Com o proxy reverso ativo, todas as requisições do browser são same-origin (Vercel → Vercel). O cookie não precisa mais de `sameSite: 'none'`, que é a configuração menos restritiva e permite envio do cookie em contextos cross-site desnecessários.
- **Ação**: Alterar o cookie em produção para `sameSite: 'lax'` + `secure: true`. Isso bloqueia o envio do cookie em requisições cross-site (proteção CSRF) sem quebrar o fluxo atual.
- **Impacto**: Reduz superfície de ataque CSRF. O cookie só é enviado em navegações top-level e requisições same-origin.
- **Arquivos afetados**:
  - `apps/api/src/modules/auth/auth.controller.ts` (configuração do `res.cookie`)
