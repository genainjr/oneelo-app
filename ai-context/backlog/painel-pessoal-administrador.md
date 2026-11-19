# Backlog - Visão Pessoal do Administrador e Gestores (Painel Pessoal)

### FT-020 Acesso ao Painel Pessoal para Administradores e Liderança Geral

- **Prioridade**: alta (experiência do usuário e usabilidade da liderança)
- **Status**: pendente
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
     - Incluir a opção de navegar para o **Painel Pessoal** também no menu dos administradores/líderes.
     - *Opção A (Menu Direto):* Exibir tanto o `Dashboard` (Visão Igreja) quanto o `Painel Pessoal` (Minha Visão) no topo da sidebar.
     - *Opção B (Alternador de Visão / Switcher):* Permitir alternar suavemente entre a **Visão da Igreja** (KPIs administrativos) e o **Painel Pessoal** (minha vida na igreja) no cabeçalho ou topo do menu.
     - *Opção C (Item no grupo de Conta/Pessoal):* Manter o `Dashboard` como entrada inicial no topo e disponibilizar `Painel Pessoal` com destaque para acesso rápido à carteirinha, escalas pessoais e pendências.

  2. **Comportamento Pós-Login (`apps/web/src/lib/auth-redirect.ts`):**
     - Manter o redirecionamento padrão do `ADMIN` para o `/dashboard` geral (ou respeitar a preferência da última tela visitada).
     - Manter o redirecionamento do `BASIC` para o `/personal-panel`.

  3. **Validação de Permissões e Contexto (`/personal-panel`):**
     - Garantir que a página `/personal-panel` renderize com precisão os dados do administrador logado (suas escalas pessoais, liderados dos ministérios que lidera, aniversariantes e pendências pessoais).

- **Impacto**: O administrador deixa de ser tratado apenas como um operador do sistema e passa a ter acesso imediato às suas próprias escalas, carteirinha e compromissos espirituais na comunidade, sem necessidade de logout ou criação de conta secundária.
