# Repository AI Context Manifest

Este repositório contém a documentação de contexto da Inteligência Artificial para o projeto **SaaS de Gestão para Igrejas**.

## Domínios Principais
- **Multi-tenancy & Limitações**: Isolamento de dados baseado em coluna (`tenantId`) e limite de membros por plano.
- **Gestão de Membros & Tags**: Cadastro de membros, exclusão lógica (Soft Delete) e filtros avançados/compostos por etiquetas (Tags).
- **Ministérios & Escalas**: Organização de equipes/ministérios, delegação de líderes e criação/publicação de escalas com confirmação autenticada.
- **Eventos & Agenda**: Gerenciamento de eventos de calendário e controle de datas.
- **Auditoria de Operações**: Rastreamento automático de mutações através de logs integrados.

## Arquitetura Primária
- **Monorepo**: Estrutura com `npm workspaces` segregando frontend e backend.
- **NestJS (Backend)**: Arquitetura em camadas (Controller, Service, Prisma).
- **Next.js (Frontend)**: Utilização de App Router e proteção por middleware de rotas autenticadas.
- **Prisma & PostgreSQL**: Camada de banco de dados estendida com injeção automática de filtros.

## Contextos Importantes
- **[Visão Geral da Arquitetura](architecture/overview.md)**: Detalhes de guards, decorators, interceptors, soft delete e infraestrutura.
- **[Plano de Desenvolvimento Original](../plano_desenvolvimento_ideal_markdown.md)**: O documento com especificações completas de regras de negócio, limites e roadmap de desenvolvimento do MVP.