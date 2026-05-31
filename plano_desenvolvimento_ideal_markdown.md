# Plano de Desenvolvimento — SaaS de Gestão para Igrejas (MVP)
**Versão 2.0 — Revisada e alinhada ao Plano de MVP**

---

## Princípios que guiam este plano

Este plano respeita as três regras centrais do MVP: **simples**, **rápido de desenvolver**, **fácil de validar**. Toda decisão arquitetural foi tomada com base no menor esforço que entrega o maior valor operacional à igreja piloto. Complexidade só entra quando há um caso de uso concreto e validado.

---

## Decisões técnicas fechadas

Estas questões abertas foram deliberadamente resolvidas para não bloquear o desenvolvimento:

**Criação de tenants:** No MVP, o tenant da igreja piloto será criado via seeder. Não haverá tela pública de cadastro — ela entra apenas na fase comercial, quando o produto for aberto a outras igrejas.

**Autenticação:** JWT com HTTP-only Cookies, implementado diretamente no NestJS. Sem NextAuth.js — o backend é a única fonte de verdade da sessão, o que simplifica o fluxo de RBAC e auditoria.

**Confirmação de escala:** Feita dentro do painel autenticado do membro. Sem link público ou rota não autenticada no MVP — isso expõe dados de membros sem justificativa de negócio validada.

**Infraestrutura de filas:** Redis e BullMQ ficam de fora do MVP. Não há nenhum caso de uso de fila nas cinco fases. Eles entram quando WhatsApp e notificações automáticas forem implementados (Fase 2 pós-MVP).

**Limite de plano:** Ao atingir `limite_membros`, retornar HTTP 403 com mensagem amigável. Bloqueio na camada de serviço, não no banco.

---

## Stack tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 14, React, TypeScript, TailwindCSS, shadcn/ui |
| Backend | NestJS, TypeScript |
| ORM | Prisma |
| Banco | PostgreSQL 16 |
| Infraestrutura local | Docker Compose (apenas PostgreSQL) |
| Testes | Jest + Supertest |

---

## Estrutura do projeto

Monorepo com `npm workspaces`, **sem pacotes compartilhados no MVP**. Os pacotes `/packages/ui`, `/packages/types` e `/packages/utils` só fazem sentido quando houver um segundo frontend (ex: app mobile, painel do admin). Por ora, tipos e utilitários ficam dentro de cada app.

```
/apps
  /web        ← Frontend Next.js
  /api        ← Backend NestJS + Prisma

package.json  ← Workspace root (scripts globais apenas)
docker-compose.yml
```

```json
// package.json (raiz)
{
  "workspaces": ["apps/*"],
  "scripts": {
    "dev": "concurrently \"npm run dev -w apps/api\" \"npm run dev -w apps/web\"",
    "db:migrate": "npm run prisma:migrate -w apps/api",
    "db:seed": "npm run prisma:seed -w apps/api"
  }
}
```

---

## Infraestrutura local

Apenas PostgreSQL. Sem Redis no MVP.

```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: church_saas
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

---

## Modelagem do banco de dados

### Regras globais
- Toda tabela tem `tenant_id` (multi-tenancy por coluna).
- Soft delete via `deleted_at` nas entidades que precisam de histórico (`Membro`). Para demais entidades, usar campo `ativo Boolean`.
- Timestamps `createdAt` e `updatedAt` em todas as tabelas.

### Schema Prisma completo

```prisma
// apps/api/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── Enums ────────────────────────────────────────────────

enum Plano {
  GRATUITO
  BASICO
  PROFISSIONAL
}

enum StatusAssinatura {
  ATIVA
  TRIAL
  SUSPENSA
  CANCELADA
}

enum Role {
  ADMIN_GERAL
  PASTOR
  LIDER_MINISTERIO
  SECRETARIO
  MEMBRO
}

enum StatusMembro {
  ATIVO
  INATIVO
  VISITANTE
  TRANSFERIDO
}

enum StatusEscala {
  RASCUNHO
  PUBLICADA
  ENCERRADA
}

enum StatusConfirmacao {
  PENDENTE
  CONFIRMADO
  RECUSADO
}

enum StatusEvento {
  AGENDADO
  REALIZADO
  CANCELADO
}

enum AcaoAuditoria {
  CRIAR
  ATUALIZAR
  DELETAR
  LOGIN
  LOGOUT
}

// ─── Tenant ───────────────────────────────────────────────

model Tenant {
  id               String           @id @default(uuid())
  nome             String
  slug             String           @unique
  plano            Plano            @default(GRATUITO)
  statusAssinatura StatusAssinatura @default(TRIAL)
  limiteMembros    Int              @default(50)
  ativo            Boolean          @default(true)
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt

  users        User[]
  membros      Membro[]
  tags         Tag[]
  ministerios  Ministerio[]
  escalas      Escala[]
  eventos      Evento[]
  auditLogs    AuditLog[]
}

// ─── User ─────────────────────────────────────────────────

model User {
  id           String   @id @default(uuid())
  tenantId     String
  nome         String
  email        String
  senhaHash    String
  role         Role     @default(MEMBRO)
  ativo        Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  tenant              Tenant               @relation(fields: [tenantId], references: [id])
  ministeriosLiderados MinisterioLider[]
  escalasItens         EscalaItem[]
  auditLogs            AuditLog[]

  @@unique([tenantId, email])
  @@index([tenantId])
}

// ─── Membro ───────────────────────────────────────────────

model Membro {
  id              String       @id @default(uuid())
  tenantId        String
  nome            String
  whatsapp        String?
  email           String?
  dataNascimento  DateTime?
  status          StatusMembro @default(ATIVO)
  observacoes     String?
  deletedAt       DateTime?    // soft delete
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  tenant       Tenant         @relation(fields: [tenantId], references: [id])
  tags         MembroTag[]
  ministerios  MinisterioMembro[]
  escalas      EscalaItem[]

  @@index([tenantId])
  @@index([tenantId, deletedAt])
}

// ─── Tag ──────────────────────────────────────────────────

model Tag {
  id       String @id @default(uuid())
  tenantId String
  nome     String
  corHex   String @default("#6366f1")

  tenant  Tenant      @relation(fields: [tenantId], references: [id])
  membros MembroTag[]

  @@unique([tenantId, nome])
  @@index([tenantId])
}

model MembroTag {
  membroId String
  tagId    String

  membro Membro @relation(fields: [membroId], references: [id])
  tag    Tag    @relation(fields: [tagId], references: [id])

  @@id([membroId, tagId])
}

// ─── Ministério ───────────────────────────────────────────

model Ministerio {
  id       String  @id @default(uuid())
  tenantId String
  nome     String
  descricao String?
  ativo    Boolean @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tenant  Tenant             @relation(fields: [tenantId], references: [id])
  lideres MinisterioLider[]
  membros MinisterioMembro[]
  escalas Escala[]

  @@index([tenantId])
}

model MinisterioLider {
  ministerioId String
  userId       String

  ministerio Ministerio @relation(fields: [ministerioId], references: [id])
  user       User       @relation(fields: [userId], references: [id])

  @@id([ministerioId, userId])
}

model MinisterioMembro {
  ministerioId String
  membroId     String

  ministerio Ministerio @relation(fields: [ministerioId], references: [id])
  membro     Membro     @relation(fields: [membroId], references: [id])

  @@id([ministerioId, membroId])
}

// ─── Escala ───────────────────────────────────────────────

model Escala {
  id           String       @id @default(uuid())
  tenantId     String
  ministerioId String
  titulo       String
  data         DateTime
  status       StatusEscala @default(RASCUNHO)
  observacoes  String?
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt

  tenant      Tenant       @relation(fields: [tenantId], references: [id])
  ministerio  Ministerio   @relation(fields: [ministerioId], references: [id])
  itens       EscalaItem[]

  @@index([tenantId])
  @@index([tenantId, data])
}

model EscalaItem {
  id                 String            @id @default(uuid())
  escalaId           String
  membroId           String
  userId             String?           // user que adicionou o item
  funcao             String
  statusConfirmacao  StatusConfirmacao  @default(PENDENTE)
  observacoes        String?

  escala Escala  @relation(fields: [escalaId], references: [id])
  membro Membro  @relation(fields: [membroId], references: [id])
  user   User?   @relation(fields: [userId], references: [id])

  @@unique([escalaId, membroId])
}

// ─── Evento ───────────────────────────────────────────────

model Evento {
  id          String       @id @default(uuid())
  tenantId    String
  titulo      String
  descricao   String?
  dataInicio  DateTime
  dataFim     DateTime?
  local       String?
  status      StatusEvento @default(AGENDADO)
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@index([tenantId])
  @@index([tenantId, dataInicio])
}

// ─── AuditLog ─────────────────────────────────────────────

model AuditLog {
  id            String        @id @default(uuid())
  tenantId      String
  userId        String?
  entidade      String
  entidadeId    String
  acao          AcaoAuditoria
  payloadBefore Json?
  payloadAfter  Json?
  ipAddress     String?
  createdAt     DateTime      @default(now())

  tenant Tenant @relation(fields: [tenantId], references: [id])
  user   User?  @relation(fields: [userId], references: [id])

  @@index([tenantId])
  @@index([tenantId, entidade, entidadeId])
}
```

---

## Backend — Arquitetura de módulos (NestJS)

### Estrutura de pastas

```
apps/api/src/
├── main.ts
├── app.module.ts
│
├── common/
│   ├── decorators/
│   │   ├── current-user.decorator.ts
│   │   └── roles.decorator.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   └── roles.guard.ts
│   ├── interceptors/
│   │   └── audit.interceptor.ts
│   ├── filters/
│   │   └── http-exception.filter.ts
│   ├── middleware/
│   │   └── tenant.middleware.ts
│   └── prisma/
│       ├── prisma.module.ts
│       └── prisma.service.ts
│
├── modules/
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   └── dto/
│   ├── membros/
│   │   ├── membros.module.ts
│   │   ├── membros.controller.ts
│   │   ├── membros.service.ts
│   │   ├── membros.repository.ts
│   │   └── dto/
│   ├── tags/
│   ├── ministerios/
│   ├── escalas/
│   ├── eventos/
│   └── dashboard/
```

### Regras de camadas

**Controller:** apenas recebe a requisição, valida DTO, chama o Service e retorna. Sem lógica de negócio.

**Service:** toda lógica de negócio. Valida regras (ex: limite de membros), orquestra chamadas ao Repository. Nunca acessa Prisma diretamente.

**Repository:** único ponto de acesso ao banco. Todo query fica aqui — facilita testes e evita SQL espalhado.

**DTO:** classes com class-validator. Um DTO por operação (CreateMembroDto, UpdateMembroDto, FilterMembrosDto).

### Guard de tenant (multi-tenancy)

Toda requisição autenticada deve ter o `tenantId` extraído do JWT e injetado no contexto. O `TenantMiddleware` popula `req.tenantId`. Todos os repositories recebem o `tenantId` como parâmetro obrigatório — nunca confiar em dados do body para isso.

```typescript
// Exemplo de uso correto no service
async findAll(tenantId: string, filters: FilterMembrosDto) {
  return this.membrosRepository.findAll(tenantId, filters);
}

// Nunca assim:
async findAll(dto: any) {
  return this.prisma.membro.findMany({ where: { tenantId: dto.tenantId } });
}
```

### RBAC — permissões por perfil

| Ação | Admin Geral | Pastor | Líder de Ministério | Secretário | Membro |
|------|:-----------:|:------:|:-------------------:|:----------:|:------:|
| CRUD membros | ✅ | ✅ | ❌ | ✅ | ❌ |
| Ver membros | ✅ | ✅ | Só do ministério | ✅ | ❌ |
| CRUD ministérios | ✅ | ✅ | ❌ | ❌ | ❌ |
| CRUD escalas | ✅ | ✅ | Só do ministério | ❌ | ❌ |
| Ver escalas | ✅ | ✅ | Só do ministério | ✅ | Próprias |
| Confirmar escala | ✅ | ✅ | ✅ | ✅ | Própria |
| CRUD eventos | ✅ | ✅ | ❌ | ✅ | ❌ |
| Ver dashboard | ✅ | ✅ | Parcial | ✅ | ❌ |
| Audit logs | ✅ | ❌ | ❌ | ❌ | ❌ |
| Gestão de usuários | ✅ | ❌ | ❌ | ❌ | ❌ |

A restrição do `LIDER_MINISTERIO` é aplicada na **camada de serviço** via query filtering (`WHERE ministerio_id IN (...liderados pelo user...)`), não no banco. Isso é mais simples de manter e testar no MVP.

### Soft delete global

Criar um middleware no PrismaService que adiciona `WHERE deleted_at IS NULL` automaticamente para queries em `Membro`. Todos os outros listagens usam o campo `ativo`.

```typescript
// prisma.service.ts
constructor() {
  super();
  this.$extends({
    query: {
      membro: {
        async findMany({ args, query }) {
          args.where = { ...args.where, deletedAt: null };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, deletedAt: null };
          return query(args);
        },
      },
    },
  });
}
```

### Interceptor de auditoria

Aplicado globalmente via `APP_INTERCEPTOR`. Registra `payload_before` e `payload_after` para mutações (POST, PATCH, DELETE) nas entidades principais.

```typescript
// Entidades auditadas automaticamente:
const AUDITED_ENTITIES = ['membros', 'escalas', 'ministerios', 'usuarios'];
```

---

## Frontend — Arquitetura (Next.js)

### Estrutura de pastas

```
apps/web/src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── layout.tsx
│   └── (dashboard)/
│       ├── layout.tsx          ← sidebar + header
│       ├── page.tsx            ← dashboard principal
│       ├── membros/
│       ├── ministerios/
│       ├── escalas/
│       ├── agenda/
│       └── configuracoes/
│
├── components/
│   ├── ui/                     ← shadcn/ui (gerado)
│   └── app/                    ← componentes de negócio
│
├── lib/
│   ├── api.ts                  ← cliente HTTP (fetch wrapper)
│   ├── auth.ts                 ← helpers de sessão
│   └── utils.ts
│
└── types/
    └── index.ts                ← tipos e interfaces
```

### Regras de componentes

Lógica de negócio fica em hooks customizados (`useMembers`, `useEscalas`), nunca em componentes de UI. Componentes recebem dados como props e emitem eventos — sem chamadas de API diretas.

```typescript
// ✅ Correto
function MembrosPage() {
  const { membros, isLoading, createMembro } = useMembros();
  return <MembrosTable data={membros} onAdd={createMembro} />;
}

// ❌ Errado — lógica de API dentro do componente
function MembrosTable() {
  const [data, setData] = useState([]);
  useEffect(() => { fetch('/api/membros').then(...) }, []);
}
```

### Autenticação no frontend

Usar `middleware.ts` do Next.js para proteger rotas do dashboard. O JWT fica em cookie HTTP-only (gerenciado pelo backend). O frontend nunca armazena o token.

---

## Dashboard — indicadores corretos

Conforme especificado no Plano de MVP, o dashboard deve exibir **exatamente** estes cinco indicadores:

| Indicador | Query |
|-----------|-------|
| Total de membros ativos | `COUNT WHERE status = ATIVO AND deleted_at IS NULL` |
| Escalas da semana | Escalas com `data` entre hoje e domingo da semana corrente |
| Aniversariantes do mês | Membros com `data_nascimento` no mês atual |
| Ministérios ativos | `COUNT WHERE ativo = true` |
| Pendências de confirmação | EscalaItens com `status_confirmacao = PENDENTE` em escalas futuras |

---

## Filtro de membros por tags

A busca composta por tags deve suportar os operadores `AND` e `OR` conforme especificado.

```typescript
// GET /api/membros?tags=jovens,musicos&operacao=AND

// Repository — operação AND (membro tem TODAS as tags)
async findAll(tenantId: string, { tags, operacao }: FilterMembrosDto) {
  if (tags?.length && operacao === 'AND') {
    return this.prisma.membro.findMany({
      where: {
        tenantId,
        deletedAt: null,
        AND: tags.map(tagNome => ({
          tags: { some: { tag: { nome: tagNome } } }
        }))
      }
    });
  }

  if (tags?.length && operacao === 'OR') {
    return this.prisma.membro.findMany({
      where: {
        tenantId,
        deletedAt: null,
        tags: { some: { tag: { nome: { in: tags } } } }
      }
    });
  }

  return this.prisma.membro.findMany({ where: { tenantId, deletedAt: null } });
}
```

---

## Seeders

O seed cria um ambiente completo para a igreja piloto, evitando configuração manual no banco.

```typescript
// prisma/seed.ts — o que o seed deve criar:
// 1. Tenant "Igreja Piloto" com slug "igreja-piloto", plano PROFISSIONAL
// 2. Usuário admin (admin@igreja.com / admin123)
// 3. Usuário pastor, líder, secretário e membro de exemplo
// 4. Tags padrão: Jovens, Músicos, Batizados, Visitantes, Liderança, Casados, Discipulado
// 5. Ministérios: Louvor, Mídia, Infantil, Recepção, Intercessão
// 6. 30 membros fictícios distribuídos nos ministérios
// 7. 2 escalas (uma da semana atual, uma da próxima semana)
// 8. 3 eventos nos próximos 30 dias
```

---

## Roadmap de desenvolvimento

### Fase 1 — Fundação (2 dias)

**Objetivo:** ambiente rodando, banco criado, seed funcionando.

- [ ] Configurar monorepo com npm workspaces
- [ ] Criar `docker-compose.yml` (apenas PostgreSQL)
- [ ] Configurar `apps/api`: NestJS + Prisma + variáveis de ambiente
- [ ] Configurar `apps/web`: Next.js + TailwindCSS + shadcn/ui
- [ ] Escrever `schema.prisma` completo e rodar migration inicial
- [ ] Implementar seed completo (tenant piloto + dados de teste)
- [ ] Validar: `npm run dev` sobe os dois apps sem erro

**Entrega:** banco estruturado, seed rodando, apps no ar localmente.

---

### Fase 2 — Autenticação e RBAC (2 dias)

**Objetivo:** login funcionando com controle de acesso por perfil.

- [ ] `AuthModule`: login com email/senha, geração de JWT, HTTP-only cookie
- [ ] `AuthModule`: refresh token e logout (invalida cookie)
- [ ] `JwtAuthGuard` e `RolesGuard` globais
- [ ] Decorator `@CurrentUser()` para injetar usuário autenticado nas rotas
- [ ] Middleware de tenant: popula `req.tenantId` a partir do JWT
- [ ] Interceptor de auditoria: registra mutações automaticamente
- [ ] Middleware de soft delete no PrismaService
- [ ] Middleware de limite de membros na camada de serviço
- [ ] Testes de integração: isolamento entre tenants (usuário do tenant A não acessa dados do tenant B)

**Entrega:** autenticação segura, RBAC funcional, auditoria automática.

---

### Fase 3 — Módulos de CRUD (3 dias)

**Objetivo:** gestão de membros, tags, ministérios e agenda operacional.

**Membros:**
- [ ] CRUD completo com soft delete
- [ ] Filtro por nome, status, whatsapp
- [ ] Filtro composto por tags (AND/OR)
- [ ] Aplicação de tags em lote
- [ ] Validação de limite do plano ao criar membro

**Tags:**
- [ ] CRUD de tags com cor hex
- [ ] Listagem com contagem de membros por tag

**Ministérios:**
- [ ] CRUD de ministérios
- [ ] Associação de líderes (users) e membros
- [ ] Filtro de acesso para `LIDER_MINISTERIO`

**Eventos:**
- [ ] CRUD de eventos com datas e local
- [ ] Listagem por período

**Entrega:** backend e frontend das três seções funcionando com dados reais.

---

### Fase 4 — Escalas (2 dias)

**Objetivo:** o core do MVP — escalas operacionais com confirmação de presença.

- [ ] CRUD de escalas com associação ao ministério
- [ ] Adicionar/remover membros da escala com função
- [ ] Publicar escala (muda status de RASCUNHO para PUBLICADA)
- [ ] Confirmação de presença: membro confirma/recusa dentro do painel autenticado
- [ ] Visualização semanal e mensal das escalas
- [ ] Histórico de escalas por membro
- [ ] Filtro de pendências de confirmação

**Entrega:** escalas criadas, publicadas e com confirmações registradas.

---

### Fase 5 — Frontend, Dashboard e Polish (3 dias)

**Objetivo:** interface completa, navegável e utilizável pela equipe da igreja.

- [ ] Layout do dashboard com sidebar responsiva (desktop e mobile)
- [ ] Dashboard com os 5 indicadores corretos do MVP
- [ ] Página de membros: tabela com busca, filtros por tag, ações em lote
- [ ] Página de escalas: calendário com status visual (confirmado/pendente/recusado)
- [ ] Página de agenda: visualização mensal/semanal de eventos
- [ ] Página de configurações: gestão de usuários e audit log (apenas Admin Geral)
- [ ] Tela de login: clean e funcional (sem glassmorphism — simplicidade primeiro)
- [ ] Tratamento de erros global (toast de erro amigável para 403, 422, 500)
- [ ] Loading states e estados vazios em todas as listagens

**Entrega:** sistema completo e utilizável para validação com a igreja piloto.

---

## Plano de testes

### Testes de integração (backend)

Prioridade nos casos críticos de segurança e regra de negócio:

```bash
# Rodar em apps/api
npm run test:e2e
```

Cenários obrigatórios:

- Tenant isolation: usuário do Tenant A não retorna dados do Tenant B em nenhuma rota
- Limite de membros: criação bloqueada com 403 ao atingir `limiteMembros`
- RBAC: `MEMBRO` não acessa rotas de CRUD de membros (403)
- RBAC: `LIDER_MINISTERIO` não acessa escalas de outro ministério (403)
- Soft delete: membro deletado não aparece em nenhuma listagem
- Auditoria: toda mutação gera `AuditLog` com `payload_before` e `payload_after`

### Verificação manual

- Confirmação de escala em múltiplos dispositivos (desktop e mobile)
- Login com cada um dos 5 perfis e verificar visibilidade das rotas
- Criação de membro além do limite do plano
- Inspeção direta dos `audit_logs` após alterações críticas

---

## Critérios de conclusão do MVP

O desenvolvimento será considerado concluído quando:

- [ ] A equipe da igreja piloto consegue criar e publicar uma escala completa sem suporte
- [ ] Líderes confirmam presença via painel em seus próprios dispositivos
- [ ] Membros são cadastrados, tagueados e associados a ministérios
- [ ] O dashboard exibe os 5 indicadores corretos e atualizados
- [ ] Nenhum dado de um tenant vaza para outro (validado em teste)
- [ ] O sistema substitui pelo menos uma planilha ou processo manual existente

---

## O que não entra no MVP (referência)

Para evitar scope creep durante o desenvolvimento, estas funcionalidades estão explicitamente fora:

| Funcionalidade | Fase planejada |
|---------------|----------------|
| Integração com WhatsApp | Fase 2 pós-MVP |
| Notificações automáticas | Fase 2 pós-MVP |
| Sincronização com Google Calendar | Fase 2 pós-MVP |
| Tela pública de cadastro de igrejas | Fase comercial |
| Link público de confirmação de escala | Fase 2 pós-MVP |
| Relatórios estratégicos / BI | Fase 3 pós-MVP |
| IA para geração automática de escalas | Fase 3 pós-MVP |
| Redis + BullMQ | Quando WhatsApp entrar |
| Pacotes compartilhados (`/packages/ui`) | Quando houver 2+ frontends |
