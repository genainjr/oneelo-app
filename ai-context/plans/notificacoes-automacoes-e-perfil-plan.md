# Plano - Autonomia de Notificações: Regras por Igreja e Preferências no Perfil

Status geral: planejado  
Data de criação: 2026-11-04  
Branch sugerida para implementação: feature/central-notificacoes (ou feature/notificacoes-automacoes-e-perfil)  

## Planos e Referências Relacionados

- [Plano PWA Push Foundation](pwa-push-foundation-plan.md)
- [Design System One Elo - Form Standard](../../ai-core/skills/oneelo-design-system/FORM_STANDARD.md)
- [Design System One Elo - Table & Tabs Standard](../../ai-core/skills/oneelo-design-system/TABLE_STANDARD.md)
- [Código Atual da Central de Notificações](../../apps/web/src/app/(dashboard)/configuracoes/notificacoes/page.tsx)
- [Código Atual de Meu Perfil](../../apps/web/src/app/(dashboard)/meu-perfil/page.tsx)

---

## 1. Objetivo da Entrega

Permitir autonomia e transparência no sistema de notificações em dois níveis:
1. **Nível Igreja (Administrador / Líder):** Configuração personalizada das regras de automação (aniversários, lembrete de eventos, escala do dia e confirmações pendentes), permitindo ativar/desativar cada automação, escolher horários/antecedência e customizar títulos e mensagens através de templates com tags dinâmicas (`{nome}`, `{ministerio}`, `{horario}`, `{evento}`, `{igreja}`).
2. **Nível Membro (Usuário Pessoal):** Na tela *Meu Perfil* (`/meu-perfil`), oferecer uma seção para gerenciar o status do Web Push no dispositivo atual (ativar/desativar) e definir preferências pessoais de recebimento (ex.: opt-in/opt-out para notificações comunitárias de aniversário e lembretes de eventos gerais).

---

## 2. Contexto e Diagnóstico

- Atualmente, as notificações automáticas do sistema operam com parâmetros **hardcoded** no código:
  - Aniversários: fixo às 08:00, com texto pré-definido e disparo obrigatório de mensagem individual e comunitária.
  - Confirmação de escala: fixo às 08:00 e 13:00 com janela de 24h e mensagem estática.
  - Lembrete do dia de serviço: fixo às 09:00 com texto estático.
  - Lembrete de eventos: fixo em 2 horas de antecedência.
- As igrejas possuem linguagens e culturas distintas (saudações litúrgicas, versículos, horários preferenciais de culto e avisos).
- Os membros não possuem na tela de perfil uma forma clara de saber se seu dispositivo atual está recebendo notificações push, nem como escolher quais categorias de avisos desejam receber.

---

## 3. Decisões de Arquitetura e Engenharia

1. **Modelagem de Dados (Tenant Rules):**
   - Criação da tabela `tb_notification_automation_rule` com chave única `[tenantId, tipo]`.
   - Tipos suportados:
     - `BIRTHDAY_PERSONAL`: Notificação individual de felicitações ao aniversariante.
     - `BIRTHDAY_COMMUNITY`: Notificação geral para a igreja celebrando os aniversariantes do dia.
     - `SCHEDULE_DAY_REMINDER`: Lembrete aos voluntários no dia do serviço.
     - `SCHEDULE_CONFIRMATION_24H`: Lembrete aos voluntários pendentes de confirmação.
     - `EVENT_REMINDER_BEFORE`: Lembrete com antecedência antes do evento/culto.
   - Padrão resiliente (Fallback): Se o tenant não tiver customizações salvas no banco, o backend utiliza os defaults de fábrica automaticamente, garantindo compatibilidade total sem quebras.

2. **Modelagem de Dados (User Preferences):**
   - Criação da tabela `tb_user_notification_preference` com relação 1:1 para `User` e vinculada a `Tenant`.
   - Preferências configuráveis pelo membro:
     - `notifyBirthdays`: Receber avisos de aniversariantes da igreja (default: `true`).
     - `notifyEvents`: Receber lembretes de eventos gerais e cultos (default: `true`).
     - `notifySchedules`: Receber convocações e avisos de escala (default: `true`).
   - Respeito às preferências: Ao materializar destinatários no `NotificationDispatchService` ou nos jobs de push, membros que desativaram determinada categoria não entram como destinatários.

3. **Substituição Dinâmica de Variáveis nos Templates:**
   - Mecanismo seguro de template replace no backend suportando:
     - `{nome}`: Nome do membro ou primeiro nome.
     - `{igreja}`: Nome da congregação.
     - `{ministerio}`: Nome do ministério.
     - `{horario}`: Horário formatado no fuso `America/Sao_Paulo`.
     - `{evento}`: Título do evento.

4. **Interface do Usuário (ODS):**
   - **Central de Notificações:** Adição de navegação por abas: `Notificações` (histórico/envios) e `Regras Automáticas` (configuração das réguas de automação).
   - **Meu Perfil:** Nova seção `Notificações e Alertas` com status em tempo real do dispositivo, botão para ativar/desativar permissão push e toggles de preferências pessoais.

---

## 4. Etapas de Desenvolvimento

> **Regra de Execução:** O desenvolvimento deve avançar estritamente etapa por etapa. Ao concluir uma etapa, atualize o checklist (`[x]`), apresente o resumo das validações e **aguarde a autorização explícita do usuário antes de iniciar a etapa seguinte**.

### Etapa 0 - Modelagem de Dados no Prisma e Migrations
Status: concluido

- [x] Criar enum `NotificationAutomationType` e modelo `NotificationAutomationRule` (`tb_notification_automation_rule`) no schema Prisma.
- [x] Criar modelo `UserNotificationPreference` (`tb_user_notification_preference`) no schema Prisma.
- [x] Criar migration e rodar `prisma migrate dev` (ou migration SQL correspondente).
- [x] Gerar cliente Prisma atualizado (`npx prisma generate`).
- Critério de validação da etapa: `npx prisma validate` com sucesso e geração dos tipos sem conflito.

### Etapa 1 - Endpoints e Serviços de Regras de Automação (Backend)
Status: concluido

- [x] Implementar `NotificationAutomationRulesService` com obtenção de regras ativas e salvamento com validação de horários/tags.
- [x] Fornecer catálogo padrão de regras (default seeds) caso o tenant ainda não tenha alterado.
- [x] Criar endpoints `GET /api/notifications/automation-rules` e `PUT /api/notifications/automation-rules`.
- [x] Adicionar testes unitários para resolução de templates e regras em `apps/api`.
- Critério de validação da etapa: Testes unitários passando com `npm test -w apps/api` e requisições HTTP retornando 200 OK.

### Etapa 2 - Integração das Regras nos Crons e Gatilhos de Notificação
Status: concluido

- [x] Atualizar `runBirthdayNotificationJob` para respeitar se `BIRTHDAY_PERSONAL` e `BIRTHDAY_COMMUNITY` estão ativos, aplicando os horários e textos configurados.
- [x] Atualizar `runPendingConfirmationReminderJob` para respeitar ativação, horários e template configurados.
- [x] Atualizar `runScheduleDayReminderJob` para respeitar ativação, horário e template configurados.
- [x] Atualizar `scheduleEventReminder` em `EventosService` para usar a antecedência configurada pelo tenant (ex: 1h, 2h, 3h ou 24h) e o template customizado.
- Critério de validação da etapa: Testes do módulo de notificações e eventos passando com `npm test -w apps/api`.

### Etapa 3 - Endpoints e Filtro de Preferências do Usuário (Backend)
Status: concluido

- [x] Criar endpoints `GET /api/users/me/notification-preferences` e `PATCH /api/users/me/notification-preferences`.
- [x] Integrar o filtro de preferências no `NotificationDispatchService` (evitar incluir destinatários que desativaram notificações de aniversários da comunidade ou eventos gerais).
- [x] Testes unitários para garantir isolamento por usuário e respeito aos toggles.
- Critério de validação da etapa: Testes unitários passando com `npm test -w apps/api`.

### Etapa 4 - Interface de Regras Automáticas na Central de Notificações (Frontend)
Status: planejado

- [ ] Adicionar sistema de abas na tela `Central de Notificações`: `Envios e Histórico` vs `Regras Automáticas`.
- [ ] Criar cartões configuráveis para cada tipo de automação com toggles, horários, seletores de antecedência e campos de título e mensagem.
- [ ] Exibir guia de variáveis dinâmicas disponíveis (`{nome}`, `{ministerio}`, etc.) com botões de clique rápido para inserção.
- [ ] Botão de "Restaurar Padrão" para cada regra.
- Critério de validação da etapa: Build do Next.js sem erros com `npm run build -w apps/web`.

### Etapa 5 - Interface de Notificações no Meu Perfil (Frontend)
Status: planejado

- [ ] Adicionar seção `Notificações e Avisos` em `/meu-perfil`.
- [ ] Exibir status atual do dispositivo (Push ativado / desativado / não suportado) com botão de ativação/desativação integrado a `push-notifications.ts`.
- [ ] Exibir toggles de preferências pessoais (Avisos de aniversários da comunidade, Lembretes de eventos gerais).
- [ ] Feedback visual de salvamento e estado de carregamento.
- Critério de validação da etapa: Build do Next.js e verificação responsiva (desktop e mobile).

### Etapa 6 - Validação Integrada, Documentação e Fechamento
Status: planejado

- [ ] Testes ponta a ponta: alteração de regra pelo admin -> disparo respeitando o novo template -> perfil do membro silenciando categoria -> verificação de não envio.
- [ ] Bateria completa de testes automatizados (`npm test -w apps/api`).
- [ ] Build de produção de todo o monorepo (`npm run build`).
- Critério de validação da etapa: 100% dos testes passando e compilação limpa.

---

## 5. Critérios de Aceite Gerais

1. **Autonomia:** Administradores conseguem ligar/desligar qualquer automação, alterar horários de envio e reescrever o texto das mensagens.
2. **Resiliência:** Em caso de ausência de configuração personalizada, o sistema funciona perfeitamente com os valores padrão de fábrica.
3. **Privacidade e Controle:** Membros conseguem ativar push no seu aparelho e escolher no Meu Perfil quais avisos facultativos desejam receber.
4. **Padrão ODS:** Telas e modais 100% integrados ao Design System One Elo, responsivos e acessíveis.
