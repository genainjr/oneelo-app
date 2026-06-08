# Backlog — Melhorias Gerais

---

### IMP-001 Adicionar campos email, phone e language ao Tenant

- **Prioridade**: alta
- **Categoria**: infraestrutura / homologação
- **Contexto**: O Tenant já existe com isolamento multi-tenant completo. O ROADMAP_ONEELO_HOMOLOGACAO.md previa os campos `email`, `phone` e `language` na entidade Church (hoje Tenant), mas eles nunca foram adicionados. São necessários para o Painel Super Admin exibir e gerir dados de contato de cada igreja e para suportar idioma padrão por tenant no futuro.
- **Ação**: Adicionar migration Prisma com os campos opcionais `email String?`, `phone String?` e `language String?` ao model `Tenant`. Atualizar DTO de criação/edição de tenant quando o Super Admin for implementado.
- **Impacto**: Desbloqueia informações de contato no Super Admin. Permite futura configuração de idioma padrão por tenant (hoje o idioma é por sessão/cookie do usuário).
- **Arquivos afetados**:
  - `apps/api/prisma/schema.prisma` (model Tenant)
  - Nova migration em `apps/api/prisma/migrations/`

---

### IMP-002 Landing Page — tornar rota `/` pública no middleware

- **Prioridade**: alta
- **Categoria**: infraestrutura / homologação
- **Contexto**: Atualmente o middleware redireciona qualquer rota não autenticada (incluindo `/`) para `/login`. Quando a Landing Page for criada em `apps/web/src/app/page.tsx`, ela precisa ser pública. O array `PUBLIC_PATHS` no middleware precisa incluir `/`.
- **Ação**: Adicionar `'/'` ao array `PUBLIC_PATHS` em `apps/web/src/middleware.ts`. Garantir que a lógica de redirect para `/login` não captura a rota raiz. Criar `apps/web/src/app/page.tsx` com o componente da Landing Page.
- **Impacto**: Qualquer visitante acessa a Landing Page sem estar autenticado. Fluxo correto: `/` → landing → `/login` → `/dashboard`.
- **Arquivos afetados**:
  - `apps/web/src/middleware.ts`
  - `apps/web/src/app/page.tsx` (novo)

---

### IMP-003 Fluxo Git — branches devem partir de `development`, não de `main`

- **Prioridade**: média
- **Categoria**: DX
- **Contexto**: O ROADMAP define que todo desenvolvimento deve partir de `development` e nunca de `main`. O branch `feat/coming-soon-screens` (onde a maioria das features recentes foi implementada) foi criado a partir de `main`. O branch `development` existe no repositório mas não está sendo usado como base de features.
- **Ação**: Alinhar equipe para sempre fazer `git checkout development && git pull` antes de criar branches. Configurar proteção de branch no GitHub para `main` e `development` (require PR, no direct push). Avaliar se `feat/coming-soon-screens` precisa ser rebased em `development` antes do merge.
- **Impacto**: Histórico limpo. `main` só recebe releases aprovados via `development`. Features não chegam a `main` sem passar por `development` primeiro.

---

### IMP-004 AuditLog registra IP do proxy Vercel em vez do IP real do cliente

- **Prioridade**: alta
- **Categoria**: segurança
- **Contexto**: Ver `security.md` SEC-001. Após adoção do proxy reverso via Next.js Rewrites, `req.ip` no backend retorna o IP do edge node do Vercel, não o do cliente real. Compromete rastreabilidade nos logs de auditoria.
- **Ação**: Ler header `x-forwarded-for` (ou `x-real-ip`) no auth controller e no AuditInterceptor. Aplicar fallback para `req.ip` em dev local.
- **Impacto**: Logs de auditoria voltam a registrar o IP real. Rastreabilidade para conformidade e investigação de incidentes.
- **Arquivos afetados**:
  - `apps/api/src/modules/auth/auth.controller.ts`
  - `apps/api/src/common/interceptors/audit.interceptor.ts`
