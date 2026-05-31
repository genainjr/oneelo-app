# Arquitetura Geral — SaaS de Gestão para Igrejas (MVP)

Este projeto é um **SaaS de Gestão para Igrejas** estruturado como um monorepo multi-tenant, cujo objetivo é simplificar a gestão operacional de membros, ministérios, escalas de serviço e eventos.

---

## Stack Tecnológica

O ecossistema é baseado nas seguintes tecnologias:

- **Monorepo**: Gerenciado através de `npm workspaces` com pacotes independentes para evitar complexidade desnecessária de compartilhamento no MVP.
- **Backend (API)**:
  - **NestJS (v11+)**: Framework progressivo em Node.js com TypeScript.
  - **Prisma ORM (v5+)**: Abstração e manipulação de banco de dados PostgreSQL.
  - **PostgreSQL 16**: Banco de dados relacional (gerido localmente via Docker Compose mapeado na porta `5433`).
  - **class-validator / class-transformer**: Validação estrutural de payloads de requisição (DTOs).
- **Frontend (Web)**:
  - **Next.js (v16+)**: App Router e Server Components com React 19.
  - **Tailwind CSS v4**: Estilização e design responsivo.
  - **Lucide-React**: Conjunto de ícones vetoriais.

---

## Padrões Arquiteturais e Segurança

O projeto é guiado por princípios de isolamento de dados, conformidade regulatória simplificada e flexibilidade de perfis:

### 1. Multi-tenancy por Coluna
Toda tabela com relevância operacional de dados possui um campo `tenantId` (Uuid).
- **Extração**: O `tenantId` é extraído do payload do token JWT decodificado no `JwtAuthGuard` do backend.
- **Injeção**: O guard injeta o `tenantId` no objeto do request Express (`request['tenantId']`), que é repassado obrigatoriamente a todos os serviços e queries Prisma.
- **Isolamento**: Usuários de um tenant nunca interagem ou acessam registros de outro tenant.

### 2. Autenticação e RBAC (Role-Based Access Control)
A autenticação e sessão são centralizadas no backend, sem dependência de bibliotecas de terceiros como NextAuth.js.
- **Sessão**: O JWT é armazenado em um cookie HTTP-only (`access_token`), o que mitiga vulnerabilidades como XSS (Cross-Site Scripting).
- **Guards**: 
  - `JwtAuthGuard`: Protege as rotas por padrão (com exceção daquelas anotadas com o decorator `@Public()`).
  - `RolesGuard`: Valida permissões comparando os perfis definidos no decorator `@Roles(...)` com o perfil do usuário no JWT.
- **Perfis (Roles)**:
  - `ADMIN_GERAL`: Acesso irrestrito a configurações, auditoria e usuários.
  - `PASTOR`: Gestão geral das operações da igreja (membros, ministérios, escalas).
  - `LIDER_MINISTERIO`: Permissões restritas ao(s) ministério(s) que lidera (ex: escalas de louvor).
  - `SECRETARIO`: Auxílio no cadastro de membros, tags e eventos.
  - `MEMBRO`: Acesso somente à visualização de escalas e sua própria confirmação de presença.

### 3. Mecanismo de Soft Delete
Para manter a integridade histórica dos dados operacionais e de relatórios, o modelo `Membro` não é deletado fisicamente do banco de dados.
- **Flag**: É utilizada a coluna `deletedAt DateTime?`.
- **Tratamento Global**: O `PrismaService` estende o cliente padrão (`this.prisma.client`) com uma query customizada que intercepta operações `findMany`, `findFirst`, `findUnique` e `count` na tabela de `Membro`, injetando automaticamente a restrição `{ deletedAt: null }`.

### 4. Interceptor de Auditoria Global
Para rastreamento de alterações críticas, o backend conta com o `AuditInterceptor` associado globalmente.
- **Escopo**: Qualquer mutação HTTP (`POST`, `PATCH`, `PUT`, `DELETE`) em endpoints que contenham `/membros`, `/escalas`, `/ministerios` ou `/usuarios` é interceptada.
- **Gravação**: Gera um registro na tabela `AuditLog` com metadados do IP, autor da ação, ação (`CRIAR`, `ATUALIZAR`, `DELETAR`) e o conteúdo do payload antes ou depois da alteração.

### 5. Limitação de Planos no MVP
O plano de assinatura do Tenant (ex: `GRATUITO`, `BASICO`, `PROFISSIONAL`) define um `limiteMembros` (padrão: 50).
- **Verificação**: Antes da criação de qualquer membro, o serviço executa um `count` dos membros ativos atuais no tenant. Se o limite for atingido, a operação é rejeitada na camada de negócio retornando um erro HTTP `403 Forbidden`.

---

## Fluxo Principal de Dados

```
[ Usuário ]
    │
    ▼ (Ações na Interface)
[ Frontend (Next.js App) ] ── (Next.js Middleware) ──► Valida cookie 'access_token'
    │
    ▼ (Requisição HTTP com Cookie access_token)
[ Backend (NestJS API) ]
    │
    ├── (cookieParser) ──► Extrai token do cookie
    ├── (JwtAuthGuard) ──► Decodifica JWT e injeta 'tenantId' + 'user'
    ├── (RolesGuard) ───► Valida decorators @Roles() da rota
    ├── (ValidationPipe) ──► Sanitiza e converte DTOs de entrada
    │
    ▼ (Controller / Service)
[ Lógica de Negócio ] ──► Valida regras de limite de plano e isolamento
    │
    ▼ (Extended Prisma Client)
[ Camada de Acesso (PostgreSQL) ] ──► Filtra implicitamente membros com soft delete
    │
    ▼ (AuditInterceptor)
[ Gravação em AuditLog ] ──► Registra payloads de alteração
    │
    ▼ (Resposta HTTP)
[ Retorno de Sucesso ]
```

---

## Estrutura do Monorepo

```
/
├── apps/
│   ├── api/ (NestJS Backend)
│   │   ├── prisma/             # Schema Prisma (PostgreSQL) e seed do MVP
│   │   └── src/
│   │       ├── common/         # Decorators, guards, filters, interceptors, prisma client
│   │       └── modules/        # Recursos (auth, membros, tags, ministerios, escalas, eventos, dashboard)
│   │
│   └── web/ (Next.js Frontend)
│       └── src/
│           ├── app/            # Route Groups: (auth) e (dashboard)
│           ├── components/     # Componentes compartilhados e de UI
│           ├── hooks/          # Hooks customizados de consumo da API (ex: useMembros)
│           └── lib/            # Helpers de autenticação e client fetch customizado
│
├── docker-compose.yml          # Container PostgreSQL local (Porta 5433)
└── package.json                # Configurações do workspace do monorepo
```
