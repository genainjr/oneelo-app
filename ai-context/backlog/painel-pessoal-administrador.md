# Backlog - Visão Pessoal do Administrador e Gestores (Painel Pessoal)

### FT-020 Acesso ao Painel Pessoal para Administradores e Liderança Geral

- **Prioridade**: alta (experiência do usuário e usabilidade da liderança)
- **Status**: concluido
- **Fase**: experiência do usuário / RBAC / dashboard
- **Categoria**: produto / UX / RBAC / navegação
- **Esforço estimado**: baixo a médio
- **Contexto**: Atualmente, a tela de **Painel Pessoal** (`/personal-panel`) foi disponibilizada no menu lateral exclusivamente para usuários com o perfil `BASIC`. Quando um usuário possui o perfil de `ADMIN`, `PASTOR` ou `SECRETARIA`, ele visualiza apenas o **Dashboard Geral da Igreja** (`/dashboard`), que apresenta KPIs institucionais de membros, finanças e ministérios. No entanto, os administradores e pastores também são membros ativos da igreja:
  - Participam de ministérios (louvor, recepção, ensino, mídia, etc.);
  - Têm escalas marcadas e precisam consultar suas próximas atuações;
  - Têm pendências de confirmação de presença em eventos e cultos;
  - Possuem carteirinha digital de membro (com botão de emissão);
  - Precisam exportar suas próprias escalas para o Google Agenda / Apple Calendar.
  Como a sidebar oculta o item "Painel Pessoal" para quem não é `BASIC`, o administrador fica sem uma visão centralizada da sua própria rotina eclesiástica.

- **Ação**: Disponibilizar o acesso ao Painel Pessoal para todos os perfis com acesso administrativo (`ADMIN`, `PASTOR`, `SECRETARIA`, `LEADER`):

  1. **Navegação na Sidebar (`apps/web/src/components/app/sidebar.tsx`):**
     - Exibir sempre **Dashboard** (`/dashboard`) como **1º item** no topo de `navItems` (`ADMIN`/`STAFF`) e **Painel Pessoal** (`/personal-panel`) logo abaixo em **2º** antes do grupo `Gestão`, **somente quando o usuário possuir `Membro` vinculado** (`user?.membro?.id`), com ícones distintos (`ICONS.dashboard` e `ICONS.personalPanel`). Contas administrativas sem membro vinculado exibem apenas **Dashboard**.
     - Exibir **Minhas Escalas** (`/minhas-escalas`) no grupo `Conta` quando `ADMIN`/`STAFF` possuir membro vinculado com escalas.

  2. **Comportamento Pós-Login e PWA (`apps/web/src/lib/auth-redirect.ts`, `social-auth.service.ts`, `pwa.service.ts`):**
     - Manter o redirecionamento padrão pós-login (tradicional, OAuth Google e `start_url` do PWA) de `ADMIN` e `STAFF` **sempre para `/dashboard` em qualquer caso** (tendo ou não membro vinculado), mantendo `BASIC` em `/personal-panel` e `SUPER_ADMIN` em `/admin`. Contas administrativas sem membro vinculado são redirecionadas de `/personal-panel` para `/dashboard`.

  3. **Validação de Permissões e Contexto (`/personal-panel` e `GET /api/ministerios/resumo?scope=personal`):**
     - Garantir que `/personal-panel` renderize os dados pessoais e de liderança própria do administrador logado (`scope=personal`) e atalho rápido para o **Dashboard da Igreja** (`/dashboard`).

- **Impacto**: O administrador deixa de ser tratado apenas como um operador do sistema e passa a ter acesso imediato às suas próprias escalas, carteirinha e compromissos espirituais na comunidade, sem necessidade de logout ou criação de conta secundária.
