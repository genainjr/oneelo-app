# Multitenancy no OneElo

## Conceito de Tenant
No contexto do OneElo, um **Tenant** representa uma congregação individual (uma Igreja). Cada igreja cadastrada opera como uma ilha isolada de dados corporativos e perfis de usuários dentro de um mesmo ecossistema central de banco de dados.

## Arquitetura Atual
O OneElo implementa o modelo de **Multi-tenancy por coluna**.
* **Banco de dados (PostgreSQL + Prisma):** Todas as entidades operacionais, relacionais e transacionais (como `Membro`, `Evento`, `Ministerio`, `User`) possuem a coluna obrigatória `tenantId`.
* **Middlewares e JWT:** Durante o processo de autenticação, o token gerado acopla o `tenantId` e perfil do usuário. O `JwtAuthGuard` das APIs do NestJS injeta esse dado no ciclo de requisição.
* **Isolamento Lógico:** Todos os services do backend são obrigados a receber e atrelar as queries do Prisma ao `tenantId` extraído da autenticação para prevenir vazamento de dados inter-tenant.

## Diagrama da Arquitetura

```mermaid
graph TD
    Client[Cliente/Browser] -->|Autenticação| NextJS[Frontend Next.js]
    NextJS -->|JWT Token| NestJS[Backend NestJS API]
    
    subgraph Lógica de Isolamento
        NestJS --> JwtAuthGuard[Validação JWT + tenantId]
        JwtAuthGuard --> Services[Services e Regras]
    end
    
    Services -->|Prisma ORM where: {tenantId}| DB[(PostgreSQL)]
    
    subgraph Banco Multi-tenant
        DB -.->|tenantId = 1| T1[Igreja Alfa]
        DB -.->|tenantId = 2| T2[Igreja Ômega]
    end
```

## Fluxo de Provisionamento
A **Lookup Labs** atua como provedora central de infraestrutura.
1. O painel exclusivo do **Super Admin** (área `/admin` isolada) fornece ferramentas de cadastro central.
2. A criação de uma nova igreja dispara o provisionamento do `Tenant` gerando um ID unívoco e os primeiros usuários administradores.
3. Configurações de limites operacionais (ex: máximo de membros por plano) e features liberadas ficam acopladas a essa entidade global.

## Gestão de Acessos Plataforma
Por padrão, o administrador global da Lookup (`SUPER_ADMIN`) foca na manipulação estrutural de tenants e faturação. É uma anti-pattern arquitetural o `SUPER_ADMIN` vasculhar dados operacionais sensíveis (como escalas e perfis de usuários de uma igreja em específico), sendo restrito pelas validações contextuais de serviços da aplicação.
