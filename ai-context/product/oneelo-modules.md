# Módulos do OneElo

A plataforma está estruturada nos seguintes módulos principais de negócio:

## Módulos Existentes

### Dashboard
* **Objetivo:** Oferecer uma visão consolidada do estado atual da igreja.
* **Funcionalidades atuais:** Resumo estatístico (total de membros, eventos do dia, escalas pendentes).
* **Dependências:** Todos os outros módulos operacionais.
* **Status de maturidade:** Básico. Requer expansão visual na Fase 7 do ODS (Visualizações e Métricas).

### Membros
* **Objetivo:** Gestão do cadastro e ciclo de vida das pessoas da igreja.
* **Funcionalidades atuais:** Listagem (com filtros ODS), visualização de perfil, criação/edição, arquivamento (soft delete), tags e exportação CSV.
* **Dependências:** Sistema global.
* **Status de maturidade:** Alto. Fluxos fortemente refatorados para ODS.

### Ministérios
* **Objetivo:** Organizar departamentos e equipes.
* **Funcionalidades atuais:** Criação de ministérios, atribuição de líderes e membros, definição de papéis e exportação.
* **Dependências:** Membros.
* **Status de maturidade:** Médio/Alto.

### Escalas
* **Objetivo:** Agendamento e coordenação de voluntários para os cultos/eventos.
* **Funcionalidades atuais:** Criação de escalas por dia/ministério, alocação de membros, filtros híbridos (auto-apply) e visualização de escalas do usuário logado.
* **Dependências:** Ministérios, Membros, Eventos.
* **Status de maturidade:** Médio. As tabelas internas ainda carecem de padronização ODS profunda.

### Agenda
* **Objetivo:** Calendário institucional da igreja.
* **Funcionalidades atuais:** Cadastro de eventos, definição de horários e locais, filtros de período e status.
* **Dependências:** Nenhuma forte externa.
* **Status de maturidade:** Alto. ODS implementado em filtros, modais (Fase 1) e ações destrutivas.

### Usuários e Configurações
* **Objetivo:** Gestão de acesso administrativo e parametrização do tenant.
* **Funcionalidades atuais:** Criação de logins vinculados (ou não) a membros, definição de papel global (`ADMIN`, `STAFF`, `BASIC`).
* **Dependências:** Membros.
* **Status de maturidade:** Médio.

### Super Admin
* **Objetivo:** Visão global da Lookup Labs.
* **Funcionalidades atuais:** Cadastro de novas igrejas (Tenants), gestão de limites, ativação/desativação de instâncias.
* **Dependências:** Infraestrutura multi-tenant.
* **Status de maturidade:** Básico.

---

## Módulos Futuros (Oportunidades)

* **Pequenos Grupos / Células:** Gestão de congregações domiciliares, mapas, frequência local.
* **Comunicação e Notificações:** Central de disparos de email/WhatsApp/Push para escalas e recados.
* **Relatórios e BI:** Dashboards avançados sobre assiduidade e crescimento.
* **Aplicativo do Membro:** Portal mobile para check-in, visualização da própria escala e agenda.
* **Automações:** Fluxos automáticos ("Se um membro faltar na escala X vezes, notificar líder").
* **IA:** Predição de engajamento, sugestão de montagem de escalas baseada no histórico do membro.
