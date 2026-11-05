# Plano - Central e Infraestrutura Robusta de Notificações

Status geral: planejado  
Data de criação: 2026-07-22  
Última atualização: 2026-11-04  
Branch sugerida para implementação: `feature/central-notificacoes`  

## Planos e Referências Relacionados

- [Detalhamento de Produto FT-011](../backlog/notification-center.md)
- [Fortalecimento PWA e Push Notifications](pwa-push-foundation-plan.md)
- [OneElo Design System (ODS)](../../ai-core/skills/oneelo-design-system/README.md)
- [ODS - Padrão de Visualização](../../ai-core/skills/oneelo-design-system/VIEW_STANDARD.md)
- [ODS - Padrão CRUD](../../ai-core/skills/oneelo-design-system/CRUD_STANDARD.md)

---

## 1. Objetivo da Entrega

Criar uma infraestrutura central, persistente e multitenant para produzir, agendar, processar, entregar e auditar notificações no OneElo, eliminando envios síncronos espalhados pelos serviços de negócio e substituindo jobs com janelas rígidas de minutos por uma fila confiável e idempotente.

A entrega atende conjuntamente:
1. **Automações do Sistema:** Escala publicada, confirmação pendente 24h, escala do dia, respostas de confirmação para líderes, lembrete de eventos 2h antes e aniversariantes.
2. **Confiabilidade e Idempotência:** Eliminar duplicidades e permitir recuperação automática de envios atrasados em caso de reinício da API (Render Free ~512 MB).
3. **Auditoria e Observabilidade:** Registro histórico de status por destinatário (`PENDING`, `SENT`, `FAILED`, `NO_SUBSCRIPTION`).
4. **Central Administrativa (ODS):** Interface autenticada para consulta operacional, reenvio de falhas e comunicados manuais controlados por administradores e lideranças.

---

## 2. Contexto e Diagnóstico do Código Atual

Atualmente, o Web Push opera de forma direta e volátil em [`apps/api/src/modules/notifications/notifications.service.ts`](../../apps/api/src/modules/notifications/notifications.service.ts) e [`apps/api/src/modules/escalas/escalas.service.ts`](../../apps/api/src/modules/escalas/escalas.service.ts):

### Automações Mapeadas no Código:
1. **Escala Publicada:** Disparo síncrono em `escalas.service.ts` (`notifyEscalaPublished`) chamando `notificationsService.sendToUsers` em lote. Se a requisição falhar ou der timeout, a notificação é perdida.
2. **Confirmação/Recusa para Liderança:** Disparo síncrono em `escalas.service.ts` (`notifyLeadershipAboutConfirmationResponse`) ao confirmar ou recusar participação.
3. **Confirmação Pendente (24h antes):** Cron `@Cron('0 8,13 * * *')` em `notifications.service.ts` buscando itens de amanhã.
4. **Lembrete da Escala (No dia):** Cron `@Cron('0 9 * * *')` em `notifications.service.ts` buscando escalas de hoje.
5. **Aniversariantes do Dia:** Cron `@Cron('0 8 * * *')` em `notifications.service.ts`.
6. **Lembrete de Evento (2h antes):** Cron `@Cron('* * * * *')` em `notifications.service.ts` executando a cada minuto em uma janela estreita (`dataInicio >= now + 2h` e `< now + 2h + 1min`). Se a API hibernar ou reiniciar nesse minuto, o lembrete é perdido para sempre.

### Problemas Críticos:
- **Sem Persistência:** Não existe tabela de notificações enviadas. O único modelo existente é `PushSubscription`.
- **Sem Idempotência:** Não há chave única (`idempotencyKey`), permitindo duplicidades se jobs reexecutarem.
- **Sem Fila Resiliente:** Falhas de rede com o gateway de push são descartadas sem política de retry.
- **Sem Visibilidade:** Administradores não sabem quais notificações foram entregues, quem não tem push habilitado ou quais falharam.

---

## 3. Decisões de Arquitetura e Engenharia

### 3.1 Estratégia de Fatiamento (Milestones)
Para mitigar riscos e entregar valor rapidamente, o projeto é dividido em **duas fatias bem delimitadas**:
- **Fatia 1 (Infraestrutura Confiável, Persistência e Automações):** Criação do schema persistente, processador em background com concorrência atômica, chave de idempotência e migração de todas as 6 automações existentes.
- **Fatia 2 (Central Administrativa e Comunicados Manuais):** Tela ODS de consulta e auditoria, métricas de entrega, envio de comunicados gerais (Admin) e ministeriais (Líderes).

### 3.2 Concorrência no Render Free (Sem Redis / Sem Worker Separado)
Para rodar dentro do container de ~512 MB da API sem dependências externas adicionais:
- O processamento de notificações pendentes utilizará o próprio PostgreSQL com **`FOR UPDATE SKIP LOCKED`** em lotes pequenos (20 a 50 itens por ciclo).
- Esse padrão garante atomicidade, impede que requisições simultâneas disputem o mesmo destinatário e permite escalar para múltiplas instâncias no futuro sem refatoração de código.

### 3.3 Modelo de Dados Persistente
```prisma
enum NotificationOrigin {
  SYSTEM_AUTOMATION
  COMMUNICATION_GENERAL
  COMMUNICATION_MINISTRY
}

enum NotificationAudienceType {
  ALL_MEMBERS
  MINISTRY
  SPECIFIC_USERS
}

enum NotificationStatus {
  DRAFT
  SCHEDULED
  PROCESSING
  COMPLETED
  FAILED
  CANCELED
}

enum RecipientDeliveryStatus {
  PENDING
  PROCESSING
  SENT
  FAILED_RETRYABLE
  FAILED_PERMANENT
  NO_SUBSCRIPTION
}

model Notification {
  id               String                   @id @default(uuid())
  tenantId         String                   @map("tenant_id")
  titulo           String                   @map("title")
  mensagem         String                   @map("message")
  urlDestino       String?                  @map("target_url")
  origem           NotificationOrigin       @map("origin")
  tipoPublico      NotificationAudienceType @map("audience_type")
  ministerioId     String?                  @map("ministry_id")
  status           NotificationStatus       @default(SCHEDULED) @map("status")
  scheduledAt      DateTime                 @default(now()) @map("scheduled_at")
  idempotencyKey   String?                  @unique @map("idempotency_key")
  criadoPorId      String?                  @map("created_by_id")
  createdAt        DateTime                 @default(now()) @map("created_at")
  updatedAt        DateTime                 @updatedAt @map("updated_at")

  tenant           Tenant                   @relation(fields: [tenantId], references: [id])
  ministerio       Ministerio?              @relation(fields: [ministerioId], references: [id])
  criadoPor        User?                    @relation("NotificationAuthor", fields: [criadoPorId], references: [id])
  destinatarios    NotificationRecipient[]

  @@index([tenantId, status, scheduledAt])
  @@index([tenantId, origem])
  @@map("tb_notification")
}

model NotificationRecipient {
  id              String                  @id @default(uuid())
  notificationId  String                  @map("notification_id")
  userId          String                  @map("user_id")
  status          RecipientDeliveryStatus @default(PENDING) @map("status")
  tentativas      Int                     @default(0) @map("attempt_count")
  ultimoErro      String?                 @map("last_error")
  lockedUntil     DateTime?               @map("locked_until")
  enviadoEm       DateTime?               @map("sent_at")
  createdAt       DateTime                @default(now()) @map("created_at")
  updatedAt       DateTime                @updatedAt @map("updated_at")

  notification    Notification            @relation(fields: [notificationId], references: [id], onDelete: Cascade)
  user            User                    @relation(fields: [userId], references: [id])

  @@index([status, lockedUntil])
  @@index([notificationId, status])
  @@index([userId])
  @@map("tb_notification_recipient")
}
```

### 3.4 Padrão Determinístico de Chaves de Idempotência
- Escala publicada: `tenant:{tenantId}:escala:{escalaId}:published`
- Lembrete de confirmação pendente 24h: `tenant:{tenantId}:escala-item:{itemId}:pending-reminder:{dataYmd}`
- Lembrete de escala no dia: `tenant:{tenantId}:escala-item:{itemId}:day-reminder:{dataYmd}`
- Confirmação/Recusa para liderança: `tenant:{tenantId}:escala-item:{itemId}:resp:{statusConfirmacao}:{timestampMinute}`
- Lembrete de evento 2h antes: `tenant:{tenantId}:evento:{eventoId}:reminder-2h`
- Aniversário: `tenant:{tenantId}:membro:{membroId}:birthday:{ano}`

---

## 4. Etapas de Desenvolvimento

> **Regra de Execução:** O desenvolvimento deve avançar estritamente etapa por etapa. Ao concluir uma etapa, atualize o checklist (`[x]`), apresente o resumo das validações e **aguarde a autorização explícita do usuário antes de iniciar a etapa seguinte**.

---

### FATIA 1: Infraestrutura Confiável, Persistência e Automações

#### Etapa 0 - Modelagem e Migrations de Banco
Status: concluído

- [x] Adicionar enums `NotificationOrigin`, `NotificationAudienceType`, `NotificationStatus` e `RecipientDeliveryStatus` ao `schema.prisma`.
- [x] Adicionar modelos `Notification` e `NotificationRecipient` com índices de performance em `schema.prisma`.
- [x] Gerar migração com `npx prisma migrate dev --name add_notification_center_core`.
- [x] Executar `npx prisma generate` e validar tipos TypeScript gerados.
- Critério de validação da etapa: `npx.cmd prisma validate` executado com sucesso e migration aplicada sem conflitos no banco local.

#### Etapa 1 - Serviço de Comando e Materialização de Destinatários
Status: concluído

- [x] Criar `NotificationDispatchService` em `apps/api/src/modules/notifications/services/notification-dispatch.service.ts`.
- [x] Implementar método `createNotification`:
  - Recebe dados da notificação e lista de `userIds` ou regra de público;
  - Valida e insere registro `Notification` com `idempotencyKey` exclusivo;
  - Se a chave já existir, retorna o registro existente sem recriar (idempotência transparente);
  - Materializa os destinatários na tabela `NotificationRecipient` com status `PENDING` (ou `NO_SUBSCRIPTION` se o usuário não possuir assinatura de push ativa).
- [x] Adicionar testes unitários cobrindo idempotência e materialização de destinatários.
- Critério de validação da etapa: Testes unitários do `NotificationDispatchService` executando com 100% de sucesso (`npm.cmd test -- notifications.service`).

#### Etapa 2 - Processador de Fila em Lotes com Lease Atômico
Status: concluído

- [x] Criar `NotificationQueueProcessorService` com job cron recorrente (ex: a cada 30 segundos).
- [x] Implementar claim atômico via query segura:
  - Seleciona até 50 destinatários com `status = PENDING` e `scheduledAt <= NOW()` utilizando lock atômico (`lockedUntil = NOW() + 2min`).
- [x] Disparar envios Web Push individuais tratando respostas HTTP do provedor:
  - Sucesso (`201`): Marca `SENT` e preenche `enviadoEm`.
  - Assinatura expirada (`404` / `410 Gone`): Marca `FAILED_PERMANENT` e desativa o `PushSubscription` no banco.
  - Erro temporário (`429` / `5xx`): Incrementa `tentativas`, agenda retry com backoff exponencial ou marca `FAILED_PERMANENT` se exceder 3 tentativas.
- [x] Atualizar status mestre de `Notification` para `COMPLETED` ou `FAILED` quando todos os destinatários forem finalizados.
- Critério de validação da etapa: Teste de integração simulando envio, recuperação após lease expirado e desativação automática de assinatura 410.

#### Etapa 3 - Migração do Lembrete de Eventos (Fim da Janela de 1 Minuto)
Status: concluído

- [x] Modificar `EventosService`:
  - Ao criar evento elegível (`GERAL` ou `MINISTERIO`), gerar a notificação agendada com `scheduledAt = dataInicio - 2 horas` e chave `evento:{id}:reminder-2h`.
  - Ao atualizar data/hora do evento, reagendar `scheduledAt` da notificação pendente.
  - Ao cancelar o evento, cancelar a notificação (`status = CANCELED`).
- [x] Substituir o cron de minuto de `runEventReminderJob` pelo processador de fila geral.
- [x] Garantir que eventos passados com mais de 2 horas de atraso não notifiquem retroativamente de forma indevida.
- Critério de validação da etapa: Criar, alterar e cancelar evento via API, comprovando nos registros de `Notification` a criação, reagendamento e cancelamento do lembrete. Testes unitários do EventosService com 25 testes passando.

#### Etapa 4 - Migração das Automações de Escalas e Aniversários
Status: concluído

- [x] Refatorar `notifyEscalaPublished` em `escalas.service.ts`:
  - Enfileirar via `NotificationDispatchService` com chave `escala:{id}:published` em vez de chamar push síncrono.
- [x] Refatorar `notifyLeadershipAboutConfirmationResponse` em `escalas.service.ts`:
  - Enfileirar aviso com chave determinística para liderança.
- [x] Refatorar `runPendingConfirmationReminderJob` e `runScheduleDayReminderJob`:
  - Enfileirar via central com idempotência diária.
- [x] Refatorar `runBirthdayNotificationJob`:
  - Enfileirar lembretes de aniversário do dia.
- Critério de validação da etapa: Testes unitários do módulo de escalas (48 testes) e notificações (26 testes) passando sem falhas, com idempotência e persistência centralizadas.

---

### FATIA 2: Central Administrativa e Comunicados Manuais

#### Etapa 5 - Endpoints de Consulta e Auditoria
Status: concluído

- [x] Criar `GET /notifications` no `NotificationsController`:
  - Acesso para `ADMIN` e `STAFF`;
  - Paginação e filtros por status, origem, público, ministério e período (conforme padrão de filtros do ODS).
- [x] Criar `GET /notifications/:id`:
  - Retorna resumo e lista paginada de destinatários com status sanitizado.
- [x] Criar `POST /notifications/:id/retry`:
  - Permite reprocessar destinatários em falha recuperável.
- [x] Criar `POST /notifications/manual`:
  - Envio de comunicados manuais gerais e ministeriais com agendamento opcional e validação RBAC.
- Critério de validação da etapa: Testes unitários do serviço cobrindo isolamento multitenant, RBAC, paginação, agregação de métricas e reenvio de falhas (21 testes passando).

#### Etapa 6 - Tela de Listagem da Central de Notificações (Frontend ODS)
Status: concluído

- [x] Criar rota `apps/web/src/app/(dashboard)/configuracoes/notificacoes/page.tsx` (ou rota de topo `/notificacoes`).
- [x] Implementar `PageHeader` com título "Central de Notificações" e métricas em `StatCard` (Enviadas, Pendentes, Falhas, Sem Assinatura).
- [x] Implementar barra de filtros unificada com `FilterShell`, `FilterInput` e `FilterSelect` autoaplicáveis (sem botão manual Filtrar).
- [x] Implementar listagem tabular com `DataTable`, badges de status semânticos e estados vazios com `EmptyState`.
- Critério de validação da etapa: Navegação funcional em desktop e mobile, consumindo os novos endpoints com feedback visual de carregamento.

#### Etapa 7 - Modal de Detalhes e Reenvio de Falhas (Frontend ODS)
Status: concluído

- [x] Implementar Drawer/Modal de detalhes do envio selecionado.
- [x] Exibir cards com resumo de entrega (percentual de sucesso, contagem por status).
- [x] Tabela de destinatários com indicação de horário de envio e motivo de falha sanitizado.
- [x] Botão de reenvio seletivo de falhas temporárias com confirmação customizada.
- Critério de validação da etapa: Executar reenvio pela interface e comprovar a atualização em tempo real dos contadores.

#### Etapa 8 - Envio de Comunicados Gerais e Ministeriais
Status: concluído

- [x] Implementar endpoints `POST /notifications/announcement/general` e `POST /notifications/announcement/ministry` (unificados em `POST /notifications/manual` com validação estrita de RBAC):
  - `ADMIN`: pode disparar geral e ministerial;
  - Líder (`LEADER` / `ASSISTANT_LEADER`): pode disparar apenas para os ministérios sob sua liderança ativa;
  - `BASIC` comum: bloqueado pelo backend (`403 Forbidden`).
- [x] Criar modal/tela de criação de comunicado no frontend:
  - Seleção de público (Toda a Igreja vs Ministério);
  - Estimativa de público em tempo real antes de enviar;
  - Campo de título, mensagem e link de destino opcional;
  - Opção de envio imediato ou agendado para data/hora futura.
- Critério de validação da etapa: Teste de RBAC garantindo que líderes só conseguem notificar seus próprios ministérios e validação do envio imediato e agendado.

#### Etapa 9 - Validação Integrada, Limpeza de Dados (TTL) e Build Final
Status: concluído

- [x] Criar rotina periódica de retenção de dados (`cleanupOldNotifications` com TTL de 60 dias).
- [x] Executar builds de produção:
  - `npm run build` em `apps/api` (concluído com código 0)
  - `npm run build` em `apps/web` (concluído com código 0)
- [x] Executar bateria completa de testes automatizados (`npm test -w apps/api` com 22 suítes e 212 testes verdes).
- [x] Documentar o módulo em `ai-context/backend/notification-architecture.md`.
- Critério de validação da etapa: Builds passando com sucesso e testes unitários/integrados 100% verdes.

---

### FATIA 3: Caixa de Entrada In-App (Sino no Cabeçalho) e Confirmação de Leitura

#### Etapa 10 - Modelagem do Campo de Leitura (`read_at`) e Migrations
Status: concluído

- [x] Adicionar campo `lidoEm DateTime? @map("read_at")` em `NotificationRecipient` no `apps/api/prisma/schema.prisma`.
- [x] Adicionar índice `@@index([userId, lidoEm])` em `NotificationRecipient` para otimização de consultas de notificações não lidas.
- [x] Gerar migração com `npx prisma migrate dev --name add_notification_read_receipts`.
- [x] Executar `npx prisma generate` e validar tipos TypeScript gerados.
- Critério de validação da etapa: `npx prisma validate` e migration aplicada com sucesso sem quebra de integridade no banco local.

#### Etapa 11 - Endpoints da Caixa de Entrada do Usuário (Inbox API)
Status: concluído

- [x] Implementar `GET /notifications/inbox` no `NotificationsController`:
  - Retorna as notificações mais recentes do usuário autenticado (`userId`), ordenadas por data de criação decrescente;
  - Inclui a contagem total de notificações não lidas (`unreadCount`).
- [x] Implementar `PATCH /notifications/inbox/:id/read` no `NotificationsController`:
  - Valida que o registro `NotificationRecipient` pertence ao usuário autenticado (`userId`);
  - Registra `lidoEm = new Date()` e retorna o item atualizado.
- [x] Implementar `POST /notifications/inbox/read-all` no `NotificationsController`:
  - Marca todas as notificações pendentes de leitura do usuário autenticado como lidas em lote.
- [x] Adicionar testes unitários no `NotificationsService` cobrindo listagem do inbox, cálculo de `unreadCount`, isolamento por usuário/tenant e confirmação de leitura.
- Critério de validação da etapa: Testes unitários do inbox executados com 100% de aprovação (`npm test -w apps/api -- notifications.service`).

#### Etapa 12 - Componente `NotificationBellInbox` no Cabeçalho (Frontend ODS)
Status: concluído

- [x] Criar o componente `NotificationBellInbox` substituindo a exibição direta de `PushNotificationButton` no `Header`:
  - Ícone de sino (`Bell`) com badge vermelho dinâmico contendo o número de notificações não lidas (ou apenas bolinha caso > 9).
  - Popover/Dropdown responsivo que abre ao clicar no sino:
    - Cabeçalho com título "Notificações", contagem de não lidas e botão "Marcar todas como lidas".
    - Lista das notificações recentes recebidas com título, mensagem, tempo relativo (`há 15 min`, `ontem`) e indicador visual de não lida.
    - Clique na notificação marca-a como lida e redireciona para a `urlDestino` correspondente.
    - Estado vazio amigável (`EmptyState`) quando não houver notificações.
    - Barra de rodapé elegante mostrando o status do Web Push no dispositivo atual com link rápido para ativar/desativar permissão.
- [x] Suporte completo a mobile (popover adaptado para tela cheia ou drawer em telas pequenas).
- Critério de validação da etapa: Usuário clica no sino, visualiza as notificações recebidas, o clique marca como lida, diminui o contador no sino e navega para o destino.

#### Etapa 13 - Auditoria de Leitura na Central de Notificações (Visão do Admin/Líder)
Status: concluído

- [x] Atualizar `GET /notifications/:id` para incluir estatísticas de leitura (`totalRead` e porcentagem de lidas).
- [x] No Modal de Detalhes da notificação (`CentralNotificacoesPage`):
  - Adicionar card de métrica de "Lidas" junto às entregues, na fila e falhas.
  - Na tabela de auditoria de destinatários, exibir coluna indicando o status de leitura (`Lido em DD/MM às HH:mm` ou `Não lido`).
- Critério de validação da etapa: Ao abrir os detalhes de um envio na Central, o administrador consegue ver quantos e quais membros já leram a mensagem.

#### Etapa 14 - Validação Integrada, Testes e Build Final
Status: concluído

- [x] Testar fluxo ponta a ponta: membro sem push habilitado recebe notificação no sino, clica, a mensagem é marcada como lida e o admin vê o horário de leitura no relatório.
- [x] Executar bateria completa de testes automatizados (`npm test -w apps/api` com 23 suítes e 239 testes passando).
- [x] Validar builds de produção (`npm run build -w apps/api` e `npm run build -w apps/web` ambos código 0).
- [x] Atualizar documentação de arquitetura em `ai-context/backend/notification-architecture.md`.
- Critério de validação da etapa: Builds passando com código 0 e todos os testes automatizados verdes.

---

## 5. Critérios de Aceite Gerais

1. **Zero Perda de Lembretes:** Nenhuma notificação agendada ou lembrete de evento é perdido em caso de reinício ou indisponibilidade temporária da API.
2. **Idempotência Garantida:** Reprocessamento de jobs ou disparos concorrentes não causam envio duplicado para o mesmo destinatário.
3. **Desativação Automática de Push Inválido:** Subscriptions que retornam `404` ou `410 Gone` são desativadas automaticamente, reduzindo tráfego inútil.
4. **Isolamento Multitenant Estrito:** Um tenant nunca enxerga, agenda ou dispara notificações para usuários de outro tenant.
5. **Aderência ao Design System:** A interface administrativa segue rigorosamente o OneElo Design System (ODS), com filtros autoaplicáveis e componentes compartilhados.
6. **Consumo de Recursos Protegido:** O processamento em lotes (`SKIP LOCKED`) mantém o container Node.js estável dentro dos limites de 512 MB do Render Free.
