# Arquitetura da Central de Notificações e Web Push

Este documento descreve o funcionamento, a governança e a infraestrutura da **Central de Notificações do OneElo**, responsável por todo o agendamento, enfileiramento, entrega assíncrona e auditoria de notificações Web Push.

---

## 1. Visão Geral e Princípios de Design

1. **Persistência Confiável sem Dependências Externas (Zero Redis):**
   - Utiliza exclusivamente o PostgreSQL como message broker e fila persistente via `FOR UPDATE SKIP LOCKED`.
   - Adequado para containers enxutos (Render 512 MB) sem sobrecarga de memória ou custos adicionais de infraestrutura.
2. **Desacoplamento e Assincronicidade:**
   - Serviços de domínio (Eventos, Escalas, Aniversários) enfileiram notificações em milissegundos via transações locais, sem bloquear requisições HTTP de usuários aguardando disparos Web Push externos.
3. **Idempotência Determinística:**
   - Toda notificação possui uma `idempotencyKey` única. Repetições de requisições, jobs duplicados ou concorrência simultânea não geram múltiplos envios.
4. **Isolamento Multitenant e Auditoria Completa:**
   - Todos os registros vinculam-se estritamente ao `tenantId`.
   - Cada destinatário (`NotificationRecipient`) possui rastreabilidade individual: status (`SENT`, `FAILED_RETRYABLE`, `FAILED_PERMANENT`, `NO_SUBSCRIPTION`), contagem de tentativas, motivo do último erro e data de envio.

---

## 2. Modelo de Dados

### 2.1 Enums
- **`NotificationOrigin`**: `SYSTEM_AUTOMATION` (automações), `COMMUNICATION_GENERAL` (comunicado geral), `COMMUNICATION_MINISTRY` (comunicado ministerial).
- **`NotificationAudienceType`**: `ALL_MEMBERS` (toda a igreja), `MINISTRY` (membros de ministério), `SPECIFIC_USERS` (destinatários específicos).
- **`NotificationStatus`**: `DRAFT`, `SCHEDULED`, `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELED`.
- **`RecipientDeliveryStatus`**: `PENDING`, `PROCESSING`, `SENT`, `FAILED_RETRYABLE`, `FAILED_PERMANENT`, `NO_SUBSCRIPTION`.

### 2.2 Modelos Prisma
- **`Notification` (`tb_notification`)**: Cabeçalho do evento de notificação com título, mensagem, url de destino, público, agendamento e chave de idempotência.
- **`NotificationRecipient` (`tb_notification_recipient`)**: Linha de entrega por usuário com lease atômico (`lockedUntil`), tentativas e status sanitizado.

---

## 3. Padrão de Fila com Lease Atômico (`FOR UPDATE SKIP LOCKED`)

### 3.1 Reserva (Claim Batch)
A cada 15 segundos, o `NotificationQueueProcessorService` executa um claim em lotes de 50 itens:
```sql
SELECT
  r.id, r.notification_id, r.user_id, r.attempt_count,
  n.tenant_id, n.title, n.message, n.target_url
FROM tb_notification_recipient r
INNER JOIN tb_notification n ON n.id = r.notification_id
WHERE (
  (r.status = 'PENDING' AND (r.locked_until IS NULL OR r.locked_until < NOW()))
  OR (r.status = 'FAILED_RETRYABLE' AND (r.locked_until IS NULL OR r.locked_until < NOW()) AND r.attempt_count < 3)
)
AND n.status IN ('SCHEDULED', 'PROCESSING')
AND n.scheduled_at <= NOW()
ORDER BY r.created_at ASC
LIMIT 50
FOR UPDATE OF r SKIP LOCKED;
```
Na mesma transação rápida (milissegundos):
```sql
UPDATE tb_notification_recipient
SET status = 'PROCESSING', locked_until = NOW() + INTERVAL '2 minutes'
WHERE id IN (:claimedIds);
```

### 3.2 Entrega Fora da Transação
- Os envios HTTP para os gateways Web Push (Google FCM, Mozilla, Apple) acontecem fora da transação do banco, mantendo o pool do Prisma livre.
- Respostas Web Push:
  - `201 Created`: Marcado como `SENT` com `sent_at = NOW()`.
  - `404 Not Found` / `410 Gone`: A assinatura Web Push expirada é desativada automaticamente no banco (`ativo = false`) e o destinatário é marcado como `FAILED_PERMANENT`.
  - `429 Too Many Requests` / `5xx Server Error`: Destinatário tem `attempt_count` incrementado e marcado como `FAILED_RETRYABLE` com backoff exponencial. Se atingir 3 tentativas, passa a `FAILED_PERMANENT`.

---

## 4. Chaves de Idempotência Padronizadas

- **Lembrete de Evento 2h antes:** `tenant:{tenantId}:evento:{eventoId}:reminder-2h`
- **Escala Publicada:** `tenant:{tenantId}:escala:{escalaId}:published:{userId}`
- **Confirmação/Recusa de Escala:** `tenant:{tenantId}:escala-item:{itemId}:resp:{status}:{minuteTimestamp}`
- **Lembrete de Escala 24h antes:** `tenant:{tenantId}:escala-item:{itemId}:pending-reminder:{yyyy-mm-dd}`
- **Lembrete de Escala no Dia:** `tenant:{tenantId}:escala-item:{itemId}:day-reminder:{yyyy-mm-dd}`
- **Aniversário Pessoal:** `tenant:{tenantId}:membro:{userId}:birthday-personal:{ano}`
- **Aniversário Comunitário:** `tenant:{tenantId}:birthday-community:{yyyy-mm-dd}`

---

## 5. Endpoints Administrativos (`/notifications`)

- `GET /notifications`: Listagem paginada com filtros por status, origem, público, ministério, busca textual e métricas globais para os cards do dashboard.
- `GET /notifications/:id`: Detalhes da notificação com lista paginada de destinatários e auditoria de erros.
- `POST /notifications/:id/retry`: Reprocessa destinatários com falha (`FAILED_RETRYABLE` e `FAILED_PERMANENT`).
- `POST /notifications/manual`: Cria comunicados gerais (para toda a igreja) ou ministeriais com suporte a agendamento futuro.

---

## 6. Governança e Retenção de Dados (TTL)

- Rotina agendada semanalmente aos domingos às 03:00 (`cleanupOldNotifications`).
- Exclui notificações e destinatários finalizados (`COMPLETED`, `FAILED`, `CANCELED`) com mais de 60 dias de criação, prevenindo crescimento descontrolado das tabelas.

---

## 7. Caixa de Entrada In-App e Confirmação de Leitura

Para garantir que 100% dos usuários recebam notificações — independentemente de possuírem Web Push ativado ou navegadores compatíveis —, o sistema dispõe de uma **Caixa de Entrada In-App (Notification Center)** diretamente no cabeçalho do sistema:

### 7.1 Modelo de Dados de Leitura
- O modelo `NotificationRecipient` possui o campo `lidoEm DateTime? @map("read_at")` indexado por `[userId, lidoEm]`.
- Quando uma notificação é criada, todos os destinatários elegíveis recebem uma linha com `lidoEm = null`.

### 7.2 Endpoints do Usuário Autenticado
- `GET /notifications/inbox`: Lista as últimas notificações recebidas pelo usuário logado com a contagem de não lidas (`unreadCount`).
- `PATCH /notifications/inbox/:id/read`: Marca uma notificação individual como lida (`lidoEm = NOW()`).
- `POST /notifications/inbox/read-all`: Marca em lote todas as notificações não lidas do usuário como lidas.

### 7.3 Componente `NotificationBellInbox` (Frontend)
- Substitui o botão isolado de push por um sino com badge dinâmico de não lidas.
- Abre um popover acessível exibindo as mensagens recentes, tempo relativo, status de leitura e link direto de navegação (`urlDestino`).
- Incorpora na barra de rodapé o controle de permissão e ativação rápida do Web Push no dispositivo.

---

## 8. Métricas de Leitura e Auditoria para Administradores

No endpoint `GET /notifications/:id` e no Modal de Detalhes da Central de Notificações:
- A liderança tem acesso à métrica de leitura agregada (`stats.read` e `stats.readPercentage`).
- Na auditoria individual de destinatários, cada membro exibe o carimbo de data e hora em que a mensagem foi lida (`lidoEm`), permitindo saber com precisão quem tomou ciência do comunicado.
