# Decisões Arquiteturais

Este documento registra as decisões arquiteturais e os padrões de desenvolvimento adotados no desenvolvimento do projeto **SaaS de Gestão para Igrejas**.

---

## 1. Criação de Tenants via Seeders (Foco no MVP)

### Decisão
**Os Tenants (Igrejas) no MVP são criados apenas via Script de Seed.**

### Contexto
O MVP é voltado para validação rápida com uma igreja piloto específica. Construir fluxos de checkout, cadastro público de tenant, escolha de planos e ativação adicionaria complexidade que não agrega valor operacional na fase de testes.

### Consequências
- Não há endpoints públicos para criação de Tenants no MVP.
- O cadastro de novos Tenants é feito administrativamente através de comandos ou do arquivo `prisma/seed.ts`.
- Reduz o tempo de entrega e foca no fluxo de uso do usuário final (membros e pastores).

---

## 2. Autenticação e Gestão de Sessão (JWT no Backend)

### Decisão
**Utilizar tokens JWT trafegados por HTTP-only Cookies, implementados diretamente no NestJS (sem NextAuth.js).**

### Contexto
A segurança e o controle de acesso de perfil (RBAC) precisam ser robustos desde o MVP. O backend NestJS deve ser a única fonte de verdade da sessão do usuário, simplificando validações, interceptores e auditoria.

### Consequências
- O frontend Next.js não armazena tokens no localStorage.
- O cookie `access_token` é configurado como `httpOnly: true`, `secure: true` (em produção) e `sameSite: 'none'`, permitindo requisições cross-domain. Em desenvolvimento, usa `secure: false` e `sameSite: 'lax'`.
- Em produção, o frontend proxeia chamadas via Next.js Rewrites para evitar bloqueios de cookies third-party (ver decisão #7).
- O `JwtAuthGuard` valida o token e resolve o `tenantId` a cada requisição.

---

## 3. Confirmação de Presença Autenticada

### Decisão
**A confirmação de presença em escalas é feita estritamente dentro do painel autenticado do membro.**

### Contexto
Oferecer links públicos/não autenticados para confirmação simplificaria o fluxo para o membro, mas exporia informações pessoais de escalas, nomes de membros e datas de eventos sem controle de auditoria de segurança.

### Consequências
- Todos os membros que escalados precisam fazer login no painel para aceitar ou recusar a escala.
- Garante conformidade de dados e proteção de informações de menores de idade e escalas sensíveis da igreja.

---

## 4. Exclusão de Filas e Mensageria (Redis e BullMQ) no MVP

### Decisão
**Não utilizar Redis ou infraestrutura de filas assíncronas no escopo do MVP.**

### Contexto
Filas são necessárias para processamento assíncrono pesado e integrações (ex: envio em lote de mensagens de WhatsApp). No MVP, essas notificações automáticas não estão no escopo, logo adicionar Redis e BullMQ traria sobrecarga de infraestrutura desnecessária.

### Consequências
- Simplifica a infraestrutura local (apenas container PostgreSQL 16 é exigido).
- Tarefas comuns são executadas de forma síncrona.
- O Redis será introduzido apenas na Fase 2 pós-MVP, juntamente com o gateway de WhatsApp.

---

## 5. Validação de Limites de Plano na Camada de Aplicação

### Decisão
**A checagem do `limiteMembros` do Tenant é feita no NestJS Service antes da criação de novos membros.**

### Contexto
Impedir a inserção de membros além do limite do plano contratado poderia ser feito por triggers no banco de dados. Contudo, tratar isso na camada de serviço (NestJS) permite retornar erros amigáveis (HTTP 403 Forbidden com texto explicativo) e facilita a escrita de testes de integração rápidos.

### Consequências
- A validação ocorre na função `create` do `MembrosService`.
- Evita erros genéricos de banco de dados na resposta da API.
- Facilita testes de e2e para limite de quota.

---

## 6. Soft Delete com Query Extensions do Prisma

### Decisão
**Implementar Soft Delete na entidade `Membro` utilizando extensions programáticas do Prisma Client.**

### Contexto
Igrejas necessitam de histórico e logs para relatórios anuais de frequência e membros ativos/inativos. A remoção física quebraria históricos de escalas passadas.

### Consequências
- O `MembrosService` apenas atualiza a coluna `deletedAt` com a data atual ao invés de usar `prisma.membro.delete()`.
- O cliente Prisma é estendido globalmente no `PrismaService` (`this.prisma.client`) para filtrar automaticamente registros que possuem `deletedAt != null` nas operações de leitura.
- Para outras tabelas operacionais menores, utiliza-se a flag booleana `ativo` para simplicidade.

---

## 7. Proxy Reverso via Next.js Rewrites (Cross-Domain Auth)

### Decisão
**As chamadas de API do frontend passam por um rewrite do Next.js (`/api/:path*` → backend externo), eliminando cookies cross-site.**

### Contexto
Em produção, o frontend (Vercel) e o backend (Render) rodam em domínios diferentes. Cookies com `SameSite=None` são progressivamente bloqueados pelos browsers modernos (Chrome Third-Party Cookie Deprecation). O cookie `access_token` setado pelo backend não era enviado de volta pelo browser nas requisições subsequentes ao frontend, causando redirecionamento infinito para `/login`.

### Solução Implementada
1. **`next.config.ts`**: Configurado `rewrites()` para proxear `/api/:path*` para a URL do backend (`NEXT_PUBLIC_API_URL`).
2. **`src/lib/api.ts`**: No browser, `API_BASE` é string vazia (caminho relativo); no servidor (SSR), usa a URL direta.
3. **`src/middleware.ts`**: Rotas `/api/` excluídas do matcher para não serem interceptadas pelo guard de autenticação.
4. **`auth.controller.ts`**: Cookie adaptativo — `secure: true` + `sameSite: 'none'` em produção; `secure: false` + `sameSite: 'lax'` em desenvolvimento.

### Consequências
- O cookie `access_token` é first-party (gravado no domínio do Vercel), eliminando bloqueios de third-party cookies.
- O middleware do Next.js consegue ler o cookie normalmente em todas as requisições.
- A variável `NEXT_PUBLIC_API_URL` no Vercel deve apontar para o backend sem trailing slash (ex: `https://oneelo-app-api.onrender.com`).
- Em desenvolvimento local, o rewrite aponta para `http://localhost:3000` e o cookie usa `sameSite: 'lax'` sem necessidade de HTTPS.

---

## 8. Separação Member × User e Nova Nomenclatura de Roles

### Decisão
**Separar completamente a entidade Membro (pessoa da igreja) da entidade User (acesso ao sistema), com roles distintos para sistema e ministério.**

### Contexto
O modelo anterior usava User tanto como representação da pessoa quanto como acesso ao sistema. Isso gerava dependência incorreta: ministérios e escalas exigiam um User (login) para funcionar, quando na prática a maioria dos membros escalados não precisa de acesso ao sistema. Além disso, a tabela `MinisterioLider` ligava User a Ministério, misturando autorização de sistema com função ministerial.

### Solução Implementada

**Roles de Sistema (User.role):**
- `ADMIN` — Acesso irrestrito (dev, suporte, administrador)
- `STAFF` — Gestão operacional (pastor, secretário). Autonomia total sobre escalas.
- `BASIC` — Acesso restrito; poderes extras via MinisterioMembro.role

**Roles de Ministério (MinisterioMembro.role):**
- `LEADER` — Líder do ministério
- `ASSISTANT_LEADER` — Co-líder (mesmos poderes sobre escalas)
- `MEMBER` — Participante

**Mudanças estruturais:**
- `User.memberId` é nullable (User pode existir sem ser membro da igreja)
- Tabela `MinisterioLider` removida (unificada em `MinisterioMembro` com campo `role`)
- Liderança resolvida por `MinisterioMembro` onde `role = LEADER`, não mais por `User.role`

### Consequências
- Membros podem ser escalados sem nunca terem login no sistema.
- A permissão contextual (quem lidera qual ministério) é desacoplada da permissão global (acesso ao sistema).
- Guards precisam consultar `MinisterioMembro` para autorização em rotas de ministério/escalas.
- Documento completo de permissões: `ai-context/backlog/permissions-matrix.md`
