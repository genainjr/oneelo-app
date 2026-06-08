# OneElo — Estratégia de Homologação, Multi-Tenancy e Escalabilidade

> **Atualizado em:** 2026-06-07
> Documento revisado para refletir o estado real do projeto. Divergências em relação à versão original estão marcadas com `[ATUALIZADO]`.

---

## Status do MVP — O que existe hoje

### Gestão de Membros
- Cadastro, edição, exclusão, listagem
- Filtros por nome, telefone, status e tags
- Bulk actions (adicionar/remover tags em lote)
- Soft delete

### Gestão de Ministérios
- CRUD completo
- Associação de membros com roles (LEADER, ASSISTANT_LEADER, MEMBER)
- Gerenciamento de funções ministeriais (colunas da escala)
- Funções disponíveis por membro (quais funções cada membro pode exercer)

### Gestão de Escalas
- CRUD completo
- Grade mensal por ministério
- Associação de membros a funções por dia
- Exclusão de função por dia específico (não exibe a célula sem remover a função do ministério)
- Reordenação de dias via drag-and-drop
- Confirmação de presença pelo membro escalado
- Filtros por mês, ano e ministério

### Gestão de Agenda
- CRUD completo (eventos, cultos, reuniões)
- Filtros por status e período
- Integração com dias da escala

### Gestão de Usuários
- CRUD completo
- Permissões: Admin, Colaborador (STAFF), Membro (BASIC)
- Log de auditoria de ações
- Desativação de usuário

### Internacionalização `[ATUALIZADO]`
- Português (Brasil) — idioma padrão
- Português (Portugal)
- Inglês (EUA)
- Seletor de idioma no sidebar com bandeiras SVG e dropdown

---

## Objetivo Atual

Disponibilizar o sistema para homologação em igrejas piloto.

Atualmente:
- Igreja Piloto Principal
- Possível Segunda Igreja Piloto

---

## Arquitetura

### Empresa
Lookup Labs — responsável pelo desenvolvimento dos produtos.

### Produto
OneElo — plataforma SaaS para gestão de comunidades cristãs.

---

## Estrutura Técnica

### Monorepo
```
oneelo/
├── apps/
│   ├── web      (Next.js)
│   └── api      (NestJS)
├── packages/
└── docker/
```

---

## Multi-Tenancy `[ATUALIZADO — JÁ IMPLEMENTADO]`

> **A entidade de isolamento já existe no código.** O que o documento original chamava de "Church" foi implementado como `Tenant`.

### O que está implementado

| Campo proposto | Campo no código | Status |
|---|---|---|
| `id` | `id` | ✅ |
| `name` | `nome` | ✅ |
| `slug` | `slug` (unique) | ✅ |
| `active` | `ativo` | ✅ |
| `plan` | `plano` (GRATUITO/BASICO/PROFISSIONAL) | ✅ |
| `email` | — | ❌ ausente |
| `phone` | — | ❌ ausente |
| `language` | — | ❌ ausente |

### Isolamento aplicado

`tenantId` presente e indexado em todos os módulos:
- Usuários ✅
- Membros ✅
- Tags ✅
- Ministérios ✅
- Escalas ✅
- Agenda ✅

### Regra garantida

Uma igreja nunca visualiza dados de outra. Todos os services filtram por `where: { tenantId }`.

### O que falta

Adicionar os campos `email`, `phone` e `language` ao model `Tenant`. Pequena migration, necessária antes do Super Admin fazer sentido.

---

## Painel Super Admin `[PENDENTE]`

Módulo exclusivo da Lookup Labs para gerenciar clientes (igrejas).

**Status:** não implementado.

### Menu planejado
```
Dashboard
Igrejas
Usuários
Planos
Logs
```

### Gestão de Igrejas
- Criar, editar, ativar, desativar igrejas
- Criar tenant + usuário administrador vinculado automaticamente

### O que precisa ser criado
- Role `SUPER_ADMIN` fora do sistema de tenant (sem `tenantId`)
- Rotas `/admin/*` no frontend (grupo de rota separado)
- Endpoints protegidos por `SUPER_ADMIN` no backend sem filtro por tenant
- Autenticação separada ou claim especial no JWT

---

## Landing Page `[PENDENTE]`

### Objetivo
Apresentar o produto para novas igrejas em `oneelo.com.br`.

### Estrutura planejada no Next.js (mesmo repositório)
```
/              Landing Page     (pública)
/login         Autenticação     (pública)
/dashboard/*   Sistema          (privado)
/admin/*       Super Admin      (privado, SUPER_ADMIN)
```

> **Estado atual:** a rota `/` redireciona para `/login`. Não existe `page.tsx` na raiz do app. O middleware só lista `/login` e `/locale` como rotas públicas — `/` precisa ser adicionada.

### Seções planejadas
- Hero com CTA "Solicitar Demonstração"
- Apresentação dos módulos (Membros, Ministérios, Escalas, Agenda)
- Benefícios (organização, comunicação, multi-idioma, escalabilidade)
- Estrutura de planos (preparar sem ativar pagamento ainda)
- Formulário de contato/interesse

---

## Estratégia Comercial Inicial

### Sem cadastro público

Não implementar:
- Criar Conta
- Teste Grátis
- Auto Cadastro

### Processo
1. Interessado acessa `oneelo.com.br`
2. Preenche formulário de interesse
3. Lookup Labs cadastra manualmente via Painel Super Admin

---

## Infraestrutura

| Camada | Serviço | Status |
|---|---|---|
| Banco | Supabase (PostgreSQL) | ✅ ativo |
| Frontend | Vercel Free | a confirmar |
| Backend | Render Free | a confirmar |

### URLs de Homologação
- Frontend: `oneelo.vercel.app`
- Backend: `oneelo-api.onrender.com`

### Domínios Futuros
- Site/Landing: `oneelo.com.br`
- Sistema: `app.oneelo.com.br`
- API: `api.oneelo.com.br`

---

## Status das Sprints `[ATUALIZADO]`

| Sprint | Escopo | Status |
|---|---|---|
| Sprint 1 | Correção dos bugs do MVP | ✅ Concluído |
| Sprint 2 | Multi-Tenancy (entidade Church/Tenant) | ✅ Concluído — faltam campos `email/phone/language` |
| Sprint 3 | Painel Super Admin | ❌ Pendente |
| Sprint 4 | Deploy para homologação | ⚠️ Supabase ativo; Vercel/Render a confirmar |
| Sprint 5 | Landing Page institucional | ❌ Pendente |

---

## O que falta para homologar (ordem de prioridade)

1. **Campos email/phone/language no Tenant** — 1 migration, baixo esforço
2. **Painel Super Admin** — necessário para cadastrar igrejas piloto manualmente
3. **Deploy confirmado** — variáveis de ambiente de produção, domínios, SSL
4. **Landing Page** — necessária antes de divulgar `oneelo.com.br` publicamente

---

## Fluxo Git

### Branches protegidas
Nunca desenvolver diretamente em `main` ou `development`.

### Convenção de branches
```bash
feature/nome-da-feature
fix/nome-da-correcao
feat/nome-da-feature      # variante aceita
```

### Fluxo
```bash
git checkout development
git pull origin development
git checkout -b feature/nome-da-feature
# ... desenvolve ...
# Pull Request: feature/nome → development
# Release: development → main
```

---

## Visão de Longo Prazo

```
Lookup Labs
├── OneElo              (gestão de comunidades cristãs)
├── OneElo Insights     (analytics e relatórios)
├── OneElo AI           (automação e inteligência)
├── Produto SaaS 2
└── Produto SaaS 3
```

**Objetivo:** transformar o OneElo em plataforma completa de gestão, automação e inteligência para comunidades cristãs.
