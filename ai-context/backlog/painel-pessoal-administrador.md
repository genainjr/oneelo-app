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
     - Exibir **Painel Pessoal** (`/personal-panel`) como 1º item do bloco superior de `navItems` (`ADMIN`/`STAFF`) seguido por **Dashboard** (`/dashboard`) antes do grupo `Gestão`, com ícones distintos (`ICONS.personalPanel` e `ICONS.dashboard`).
     - Exibir **Minhas Escalas** (`/minhas-escalas`) no grupo `Conta` quando `ADMIN`/`STAFF` possuir membro vinculado com escalas.

  2. **Comportamento Pós-Login e PWA (`apps/web/src/lib/auth-redirect.ts`, `social-auth.service.ts`, `pwa.service.ts`):**
     - Unificar o redirecionamento padrão pós-login (tradicional e OAuth Google) e o `start_url` do PWA para `/personal-panel` em todos os perfis do tenant (`ADMIN`, `STAFF`, `BASIC`), preservando `?redirect=` explícito e mantendo `SUPER_ADMIN` em `/admin`.

  3. **Validação de Permissões e Contexto (`/personal-panel` e `GET /api/ministerios/resumo?scope=personal`):**
     - Garantir que `/personal-panel` renderize os dados pessoais e de liderança própria do administrador logado (`scope=personal`), atalho rápido para o **Dashboard da Igreja** (`/dashboard`) e aviso orientativo amigável quando a conta administrativa ainda não possuir `Membro` vinculado.

- **Impacto**: O administrador deixa de ser tratado apenas como um operador do sistema e passa a ter acesso imediato às suas próprias escalas, carteirinha e compromissos espirituais na comunidade, sem necessidade de logout ou criação de conta secundária.
