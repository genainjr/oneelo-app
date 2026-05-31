# Camadas de Arquitetura — Monorepo

O projeto está estruturado em camadas claras divididas entre o Frontend (Next.js), o Backend (NestJS) e a persistência (Prisma/PostgreSQL), com o objetivo de simplificar o MVP e garantir a separação de responsabilidades.

---

## 1. Camada de Frontend (`apps/web/src/`)

O frontend em Next.js lida com a interface do usuário, proteção de rotas no cliente e chamadas HTTP:

- **Rotas e Páginas (`app/`)**:
  - Utiliza o App Router do Next.js.
  - Organizado em Route Groups: `(auth)` para login não autenticado e `(dashboard)` para o painel administrativo.
  - O arquivo global `middleware.ts` atua como um guardião interceptando requisições de páginas administrativas no cliente para verificar a presença do cookie `access_token`.
- **Componentes (`components/`)**:
  - **UI (`components/ui/`)**: Componentes de interface puros e reaproveitáveis (como botões, tabelas, inputs).
  - **Negócio (`components/app/`)**: Componentes que reúnem layouts específicos do domínio do SaaS.
- **Hooks Customizados (`hooks/`)**:
  - Isolam a lógica de consumo de API (ex: `useMembros`, `useEscalas`) dos componentes visuais. Componentes visuais apenas chamam funções do hook e renderizam estados de loading/error.
- **Comunicação e Sessão (`lib/`)**:
  - Wrapper do fetch customizado (`api.ts`) que inclui credenciais (`credentials: 'include'`) para tráfego seguro de cookies HTTP-only.

---

## 2. Camada de Backend API (`apps/api/src/`)

O backend em NestJS expõe os endpoints REST e executa as regras de negócio:

- **Controllers (`modules/**/*.controller.ts`)**:
  - Porta de entrada HTTP da API.
  - Mapeia as rotas (ex: `/api/membros`) e verbos HTTP.
  - Valida a estrutura dos dados de entrada utilizando DTOs.
- **DTOs (`modules/**/*.dto.ts`)**:
  - Classes anotadas com propriedades do `class-validator` (ex: `@IsString()`, `@IsEmail()`) para garantir sanitização e tipagem dos payloads recebidos.
- **Services (`modules/**/*.service.ts`)**:
  - Concentram as regras de negócio de domínio da aplicação.
  - Validam permissões complexas e regras estruturais (ex: checar se o número atual de membros excede o limite do plano contratado antes de criar um novo registro).
  - Orquestram transações no banco de dados através do Prisma.
- **Filtros, Guards e Interceptors (`common/`)**:
  - **Guards**: `JwtAuthGuard` (autenticação e resolução de tenant) e `RolesGuard` (autorização de perfis RBAC).
  - **Interceptors**: `AuditInterceptor` (gravação automática de alterações).
  - **Filters**: `HttpExceptionFilter` (captura e padronização de respostas de erro).

---

## 3. Camada de Banco de Dados e ORM (`apps/api/prisma/`)

Camada responsável pela persistência, integridade relacional e isolamento lógico:

- **Prisma Client (`PrismaService`)**:
  - Interface entre a aplicação NestJS e o PostgreSQL.
  - Estendido programaticamente para injetar filtros de exclusão lógica (Soft Delete) de forma transparente nas queries do modelo `Membro` (filtra `{ deletedAt: null }` automaticamente).
- **Schema & Migrations (`schema.prisma`)**:
  - Fonte única de verdade da modelagem do banco de dados (tabelas, relacionamentos, enums de status).
  - Mapeia o multi-tenancy a nível de linha através do campo `tenantId`.
- **PostgreSQL**:
  - Banco de dados relacional físico que persiste as tabelas.

---

## Fluxo de Execução entre Camadas

O diagrama abaixo ilustra como as requisições fluem através das camadas do sistema:

```
[ FRONTEND ]
┌────────────────────────┐
│  Componente de Página  │ ◄─── (Ação do Usuário)
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│    Custom React Hook   │
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│    Client API (Fetch)  │ ─── (Requisição HTTP + Cookie) ──┐
└────────────────────────┘                                  │
                                                            │
[ BACKEND ]                                                 │
┌────────────────────────┐                                  │
│   Jwt & Roles Guards   │ ◄────────────────────────────────┘
└───────────┬────────────┘
            │ (Autorizado & Tenant Injetado)
            ▼
┌────────────────────────┐
│       Controller       │ ─── (Validação de DTO)
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│        Service         │ ─── (Validação de Regras e Limites)
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│  Prisma Client (Ext)   │ ─── (Injeção de deletedAt IS NULL)
└───────────┬────────────┘
            │
            ▼
[ BANCO DE DADOS ]
┌────────────────────────┐
│    PostgreSQL Table    │ ─── (Retorna registros isolados por tenant)
└────────────────────────┘
```
