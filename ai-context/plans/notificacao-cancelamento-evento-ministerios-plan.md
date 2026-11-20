# Plano - Notificação Automática de Cancelamento de Eventos aos Ministérios Vinculados (IMP-011)

Status geral: concluido  
Data de criação: 2026-11-19  
Branch sugerida para implementação: feature/notificacao-cancelamento-evento-ministerios  

## Planos e Referências Relacionados

- [Template Oficial de Planos](PLAN_TEMPLATE.md)
- [Backlog IMP-011: Notificação de Cancelamento de Eventos por Ministério](../backlog/notificacao-cancelamento-evento-ministerios.md)
- [Decisões Arquiteturais](../architecture/decisions.md)
- [Decisões de RBAC e Autorização](../architecture/rbac-decisions.md)
- [Design System do OneElo (ODS)](../../ai-core/skills/oneelo-design-system/README.md)

---

## 1. Objetivo da Entrega

Garantir que membros da igreja, integrantes de ministérios vinculados e voluntários escalados recebam aviso imediato (**In-App + Push PWA**) sempre que um evento futuro (ou ainda em curso) for **cancelado** (`status: CANCELADO` via `PATCH`) ou **excluído** (`DELETE`) na agenda, evitando deslocamentos desnecessários até o templo — oferecendo ao operador controle explícito por checkbox para evitar disparos acidentais ao apagar cadastros feitos por engano.

Regras definidas para o disparo:
1. **Voluntários escalados em escala `PUBLICADA` (qualquer tipo de evento):** recebem notificação **obrigatória** mesmo que tenham desativado preferências de notificação (`notifyEvents` / `notifySchedules`), pois estavam escalados para servir (filtrando apenas itens com `statusConfirmacao !== RECUSADO` e nunca vazando escalas em `RASCUNHO`).
2. **Demais públicos (sem duplicidade com quem já foi notificado como escalado):**
   - **Eventos `GERAL`:** notificam os demais usuários ativos do tenant (respeitando `notifyEvents`).
   - **Eventos `MINISTERIO` e `REUNIAO_INTERNA` com ministérios:** notificam os demais membros ativos dos ministérios vinculados ao evento (usando a união de `eventoAtual` e `updatedEvento` em caso de edição simultânea no `PATCH`, respeitando `notifyEvents`).
   - **Eventos `REUNIAO_INTERNA` sem ministérios vinculados:** notificam os usuários ativos `ADMIN` e `STAFF` do tenant (público que visualiza esse evento em `buildVisibilityWhere`).
3. **Exclusão do autor:** o usuário que executou o cancelamento/exclusão (`user.sub`) não recebe a própria notificação.
4. **Controle explícito na UI (`notificarMembros`):** nos modais de **Cancelar**, **Editar (ao marcar Cancelado)** e **Excluir** em `agenda/page.tsx`, exibir checkbox (pré-marcado para eventos futuros elegíveis) permitindo ao operador desmarcar o envio caso esteja removendo um evento de teste/erro de cadastro.
5. **Higiene e idempotência de disparos:** eventos já encerrados (`(dataFim ?? dataInicio) <= now`), eventos previamente `CANCELADO` ou `REALIZADO` ao serem removidos não disparam alertas; `idempotencyKey` usa janela de bucket (5 minutos) para impedir duplicidade em duplo clique/retry HTTP.

---

## 2. Contexto e Diagnóstico

1. **Dois fluxos de cancelamento no backend (`apps/api/src/modules/eventos/eventos.service.ts`):**
   - `update` (`PATCH /api/eventos/:id`): hoje apenas chama `this.cancelEventReminder(tenantId, id)` (linhas 810–811), sem notificar os participantes.
   - `remove` (`DELETE /api/eventos/:id`): hoje chama `cancelEventReminder` e executa `prisma.evento.delete({ where: { id } })`, que aciona `Cascade` em `EventoMinisterio` e `SetNull` em `EscalaDia.eventoId` (`apps/api/prisma/schema.prisma`), apagando os vínculos antes de qualquer coleta.
2. **Infraestrutura de notificações (`NotificationDispatchService`):**
   - `EventosModule` já importa `NotificationsModule` e `EventosService` já injeta `NotificationDispatchService`.
   - Em `resolveTargetUserIds` (`apps/api/src/modules/notifications/services/notification-dispatch.service.ts` linhas 270–303), passar `userIds: []` cai no fallback `ALL_MEMBERS` ou `MINISTRY`. Logo, `EventosService` deve sempre validar `userIds.length > 0` antes de chamar `createNotification`.
   - Em `filterUserIdsByPreferences` (linhas 343–383), `notifyEvents: false` bloqueia notificações com `:evento:` ou `/agenda/visualizacao`. Para garantir que **voluntários escalados** recebam o cancelamento mesmo com preferências desativadas, `CreateNotificationInput` precisa suportar `ignorePreferences?: boolean`.
3. **Visibilidade na Central de Notificações (`listNotifications` / `getNotificationById`):**
   - Um líder `BASIC` vê destinatários de notificações cujo `ministerioId` corresponda a um ministério que lidera. Atribuir `ministerioId` do 1º ministério em eventos multi-ministério exporia destinatários de outros ministérios e esconderia o registro do 2º líder. Logo, `tipoPublico: MINISTRY` com `ministerioId` preenchido deve ser usado somente em eventos de **1 único ministério** sem mistura de públicos; demais casos usam `SPECIFIC_USERS` e `ministerioId: null`.
4. **Risco de UX na Agenda (`apps/web/src/app/(dashboard)/agenda/page.tsx`):**
   - Os modais de alteração de status (`pendingStatusEvento`) e exclusão (`pendingDeleteEvento`) hoje não avisam nem permitem optar por não enviar notificação ao apagar um evento criado por engano.

---

## 3. Decisões de Arquitetura, Riscos e Engenharia

### 3.1. Bypass Controlado de Preferências para Escalados (`NotificationDispatchService`)
- **`apps/api/src/modules/notifications/services/notification-dispatch.service.ts`:**
  - Adicionar campo opcional `ignorePreferences?: boolean` em `CreateNotificationInput` (padrão `false`).
  - Em `createNotification`: quando `input.ignorePreferences === true`, usar `resolvedUserIds` diretamente sem passar por `filterUserIdsByPreferences`.
  - Mantém 100% do comportamento existente em todas as demais chamadas do sistema.

### 3.2. Contrato de API (`notificarMembros`) e Elegibilidade (`EventosController` + `EventosService`)
- **Contratos HTTP:**
  - `UpdateEventoDto` (`apps/api/src/modules/eventos/dto/update-evento.dto.ts`): adicionar `@IsBoolean() @IsOptional() notificarMembros?: boolean` (padrão `true` quando omitido).
  - `DELETE /api/eventos/:id` (`apps/api/src/modules/eventos/eventos.controller.ts`): aceitar query param opcional `@Query('notificarMembros') notificarMembros?: string` (tratando `'false'` como `false`, e qualquer outro valor/ausência como `true`).
- **Elegibilidade temporal (`isUpcomingOrOngoingEvent`):**
  - Compara `(evento.dataFim ?? evento.dataInicio).getTime() > Date.now()`, evitando disparar avisos sobre eventos que já terminaram mais cedo no mesmo dia ou em dias anteriores.
  - Em `update`: dispara somente se `dto.notificarMembros !== false`, `eventoAtual.status !== StatusEvento.CANCELADO`, `updatedEvento.status === StatusEvento.CANCELADO` e `isUpcomingOrOngoingEvent(updatedEvento)`.
  - Em `remove`: captura snapshot completo do evento (`getEventoPorId`) e resolve destinatários **antes** de `prisma.evento.delete`; dispara somente se `notificarMembros !== false`, `eventoAtual.status === StatusEvento.AGENDADO` e `isUpcomingOrOngoingEvent(eventoAtual)`.
- **Separação sem duplicidade em dois públicos (`resolveEventCancellationRecipients`):**
  1. **`scheduledUserIds` (entrega garantida — ignora preferências):**
     - Consulta `escalaDia` onde `{ eventoId: evento.id, escala: { tenantId, status: StatusEscala.PUBLICADA } }`, incluindo `itens` com `statusConfirmacao: { not: StatusConfirmacao.RECUSADO }` e `membro: { tenantId, deletedAt: null, status: StatusMembro.ATIVO, user: { is: { tenantId, ativo: true, status: UserStatus.ACTIVE } } }`.
     - Remove `actorUserId`.
  2. **`generalUserIds` (demais participantes — respeita `notifyEvents`):**
     - `EventoTipo.GERAL`: todos os usuários ativos do tenant (`{ tenantId, ativo: true, status: UserStatus.ACTIVE }`).
     - `EventoTipo.MINISTERIO` ou `REUNIAO_INTERNA` com ministérios: membros ativos dos ministérios vinculados (em `update`, união dos `ministerioIds` de `eventoAtual` + `updatedEvento`).
     - `EventoTipo.REUNIAO_INTERNA` sem ministérios: usuários ativos com `role: { in: [Role.ADMIN, Role.STAFF] }` no tenant.
     - Remove `actorUserId` **e** remove todos os IDs presentes em `scheduledUserIds` (garantindo **zero duplicidade**).

### 3.3. Payload, Idempotência e Resiliência
- **Bucket de idempotência (5 minutos):** `cooldownBucket = Math.floor(Date.now() / (5 * 60 * 1000))` — bloqueia duplicações de duplo clique/retry HTTP e permite novo aviso se um evento for reativado e cancelado posteriormente.
- **Disparo 1 (se `scheduledUserIds.length > 0`):**
  - `titulo`: `Evento cancelado (sua escala): ${evento.titulo}`
  - `mensagem`: `O evento "${evento.titulo}" em que você estava escalado(a) para ${dataFormatada} às ${horarioFormatado}${localSuffix} foi cancelado. Caso tenha salvo na sua agenda pessoal, lembre-se de removê-lo.`
  - `urlDestino`: `'/minhas-escalas'`
  - `origem`: `NotificationOrigin.SYSTEM_AUTOMATION`
  - `tipoPublico`: `NotificationAudienceType.SPECIFIC_USERS`
  - `ministerioId`: `null`
  - `ignorePreferences`: `true`
  - `idempotencyKey`: `tenant:${tenantId}:evento:${evento.id}:cancelled-scheduled:${cooldownBucket}`
  - `userIds`: `scheduledUserIds`
- **Disparo 2 (se `generalUserIds.length > 0`):**
  - `titulo`: `Evento cancelado: ${evento.titulo}`
  - `mensagem`: `O evento "${evento.titulo}" previsto para ${dataFormatada} às ${horarioFormatado}${localSuffix} foi cancelado. Caso tenha salvo na sua agenda pessoal, lembre-se de removê-lo.`
  - `urlDestino`: `'/agenda/visualizacao'`
  - `origem`: `NotificationOrigin.SYSTEM_AUTOMATION`
  - `tipoPublico`: `evento.tipo === EventoTipo.GERAL ? ALL_MEMBERS : (singleMinistryId ? MINISTRY : SPECIFIC_USERS)`
  - `ministerioId`: `evento.tipo !== EventoTipo.GERAL && uniqueMinistryIds.length === 1 ? uniqueMinistryIds[0] : null`
  - `ignorePreferences`: `false`
  - `idempotencyKey`: `tenant:${tenantId}:evento:${evento.id}:cancelled:${cooldownBucket}`
  - `userIds`: `generalUserIds`
- **Resiliência:** envolver os disparos em `try/catch` com `this.logger.error(...)` para nunca impedir ou reverter o cancelamento/exclusão na agenda.
- **Escopo de automação:** manter como automação de sistema sem nova migration de enum `NotificationAutomationType` neste ciclo.

### 3.4. UX na Agenda (`apps/web`)
- **`apps/web/src/hooks/use-eventos.ts`:** suportar `notificarMembros?: boolean` em `EventoInput` (`updateEvento`) e `deleteEvento(id, options?: { notificarMembros?: boolean })` enviando `?notificarMembros=false` quando desmarcado.
- **`apps/web/src/app/(dashboard)/agenda/page.tsx`:**
  - Exibir checkbox ODS claro nos 3 pontos onde um evento futuro/em andamento pode ser cancelado ou excluído:
    1. Modal de alterar status (`pendingStatusEvento` quando elegível);
    2. `ConfirmDialog` de exclusão (`pendingDeleteEvento` quando `status === 'AGENDADO'` e elegível);
    3. Modal de edição (`selectedEvento` quando o usuário altera o `<select>` de status para `CANCELADO` em evento elegível).
  - Texto orientativo informando que voluntários escalados e membros/ministérios vinculados receberão aviso In-App + Push, podendo desmarcar em caso de remoção de evento criado por engano.
  - Internacionalização nas 3 línguas (`pt-BR`, `pt-PT`, `en-US`).

### 3.5. Matriz de Riscos e Mitigações
| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Push em massa acidental ao apagar evento de teste/erro | Alta (sem controle) | Alto | Checkbox `notificarMembros` nos modais de Cancelar/Excluir/Editar em `agenda/page.tsx`. |
| Voluntário escalado que desativou `notifyEvents` perder aviso de cancelamento | Média | Crítico | Separação de `scheduledUserIds` com `ignorePreferences: true` em `NotificationDispatchService`. |
| `createNotification` cair em `ALL_MEMBERS` ao receber `userIds: []` | Alta (se não guardado) | Crítico | Guarda obrigatória `if (ids.length > 0)` antes de cada chamada a `createNotification`. |
| Duplicidade para quem é membro do ministério e também está escalado | Alta (se não dedupado) | Médio | Subtrair `scheduledUserIds` de `generalUserIds` antes dos disparos. |
| `REUNIAO_INTERNA` sem ministério vinculado não notificar liderança | Média | Médio | Quando `REUNIAO_INTERNA` tiver 0 ministérios, buscar `ADMIN` e `STAFF` ativos do tenant. |
| Vazamento de destinatários multi-ministério na Central de Notificações | Média | Médio | Preencher `ministerioId` apenas quando houver 1 único ministério; caso contrário usar `SPECIFIC_USERS` + `ministerioId: null`. |
| Duplo clique/retry gerar 2 notificações com `Date.now()` | Média | Médio | Usar bucket de 5 minutos na `idempotencyKey`. |
| Exclusão apagar vínculos (`Cascade`/`SetNull`) antes da coleta | Alta (se invertido) | Alto | Resolver snapshot e destinatários antes de `prisma.evento.delete`, disparando após o delete. |

---

## 4. Etapas de Desenvolvimento

> **Regra de Execução:** O desenvolvimento deve avançar estritamente etapa por etapa. Ao concluir uma tarefa ou etapa, atualize imediatamente seu checkbox para `[x]`, apresente o resumo das validações e **aguarde a autorização explícita do usuário antes de iniciar a etapa seguinte**.

### Etapa 0 - Preparação, Branch e Baseline
Status: concluido

- [x] Confirmar repositório limpo na branch `development` e atualizar com `git pull origin development`
- [x] Criar a branch `feature/notificacao-cancelamento-evento-ministerios` a partir de `development`
- [x] Registrar baseline de testes e build dos módulos afetados:
  - [x] Executar `npx.cmd jest src/modules/eventos src/modules/notifications` em `apps/api`
  - [x] Executar `npm.cmd run build -w apps/api` e `npx.cmd -w apps/web tsc --noEmit`
- [x] Critério de validação da etapa: Branch `feature/notificacao-cancelamento-evento-ministerios` ativa sobre `development` atualizada e baseline verde.

### Etapa 1 - Suporte a `ignorePreferences` e Fluxo de Cancelamento/Exclusão (Backend)
Status: concluido

- [x] Atualizar `apps/api/src/modules/notifications/services/notification-dispatch.service.ts`:
  - [x] Adicionar `ignorePreferences?: boolean` em `CreateNotificationInput` e ignorar `filterUserIdsByPreferences` quando `true`
- [x] Atualizar `apps/api/src/modules/eventos/dto/update-evento.dto.ts`:
  - [x] Adicionar campo opcional `@IsBoolean() @IsOptional() notificarMembros?: boolean`
- [x] Atualizar `apps/api/src/modules/eventos/eventos.controller.ts`:
  - [x] Aceitar query param opcional `@Query('notificarMembros') notificarMembros?: string` em `DELETE /api/eventos/:id` e repassar `notificarMembros !== 'false'` para `eventosService.remove`
- [x] Atualizar `apps/api/src/modules/eventos/eventos.service.ts`:
  - [x] Importar `StatusConfirmacao` e `StatusEscala` de `@prisma/client` e implementar `isUpcomingOrOngoingEvent` (`(dataFim ?? dataInicio) > now`)
  - [x] Implementar `resolveEventCancellationRecipients(tenantId, evento, actorUserId, extraMinistryIds?)` separando `scheduledUserIds` (escalas `PUBLICADA`, `statusConfirmacao !== RECUSADO`, excluindo autor) e `generalUserIds` (`GERAL`, ministérios vinculados com união em edição, ou `ADMIN`/`STAFF` para `REUNIAO_INTERNA` sem ministério, excluindo autor e já escalados)
  - [x] Implementar `notifyEventCancellation` com bucket de 5 min na `idempotencyKey`, guarda de arrays vazios, `ignorePreferences: true` + `/minhas-escalas` para escalados, `ignorePreferences: false` + `/agenda/visualizacao` para demais membros, `tipoPublico`/`ministerioId` seguro para multi-ministério e isolamento em `try/catch`
  - [x] Acionar coleta + disparo em `update` (`status !== CANCELADO → CANCELADO`, `dto.notificarMembros !== false`, evento futuro/em curso) e em `remove` (coleta antes do `delete`, `status === AGENDADO`, `notificarMembros !== false`, evento futuro/em curso)
- [x] Critério de validação da etapa: `npm.cmd run build -w apps/api` compilando sem erros e lógica cobrindo `update`, `remove` e `ignorePreferences`.

### Etapa 2 - Cobertura de Testes Unitários (`apps/api`)
Status: concluido

- [x] Atualizar `apps/api/src/modules/notifications/services/notification-dispatch.service.spec.ts`:
  - [x] Cobrir `createNotification` com `ignorePreferences: true` garantindo que usuários com `notifyEvents: false` / `notifySchedules: false` permaneçam nos destinatários
- [x] Atualizar e expandir `apps/api/src/modules/eventos/eventos.service.spec.ts`:
  - [x] Atualizar `createService()` para incluir mocks de `prisma.user` e `prisma.escalaDia` sem quebrar os testes existentes
  - [x] Cobrir `update` mudando status para `CANCELADO`: disparo separado para voluntários escalados (`ignorePreferences: true`, `/minhas-escalas`, sem `RECUSADO`, sem `RASCUNHO`) e demais membros do ministério (`ignorePreferences: false`, `/agenda/visualizacao`), sem duplicidade e excluindo o autor
  - [x] Cobrir `update` respeitando `notificarMembros: false`, ignorando evento já `CANCELADO` ou já encerrado, e preservando ministérios anteriores (`eventoAtual`) em edição simultânea
  - [x] Cobrir `remove` em evento `AGENDADO` futuro: coleta **antes** de `prisma.evento.delete`, respeito a `notificarMembros = false` e silêncio para evento já `CANCELADO`/`REALIZADO` ou passado
  - [x] Cobrir evento `GERAL`, `REUNIAO_INTERNA` sem ministérios (notifica `ADMIN`/`STAFF`), evento multi-ministério (`SPECIFIC_USERS` + `ministerioId: null`), lista vazia (não chama `createNotification`) e resiliência em erro de `createNotification`
- [x] Critério de validação da etapa: `npx.cmd jest src/modules/eventos src/modules/notifications` passando 100% sem falhas.

### Etapa 3 - Checkbox de Notificação na Agenda e Internacionalização (`apps/web`)
Status: concluido

- [x] Atualizar `apps/web/src/hooks/use-eventos.ts`:
  - [x] Adicionar `notificarMembros?: boolean` em `EventoInput` e suporte a `deleteEvento(id, options?: { notificarMembros?: boolean })` enviando `?notificarMembros=false` quando desmarcado
- [x] Atualizar `apps/web/messages/pt-BR.json`:
  - [x] Adicionar chaves de tradução em `agenda` para o checkbox e texto explicativo de notificação de cancelamento/exclusão
- [x] Atualizar `apps/web/messages/pt-PT.json`:
  - [x] Adicionar chaves equivalentes em `agenda` para `pt-PT`
- [x] Atualizar `apps/web/messages/en-US.json`:
  - [x] Adicionar chaves equivalentes em `agenda` para `en-US`
- [x] Atualizar `apps/web/src/app/(dashboard)/agenda/page.tsx`:
  - [x] Adicionar checkbox ODS (pré-marcado) nos modais de **Alterar Status (`pendingStatusEvento`)**, **Excluir (`pendingDeleteEvento`)** e **Editar Evento** (quando alterando status para `CANCELADO`) para eventos futuros elegíveis, repassando `notificarMembros` para `updateEvento` e `deleteEvento`
- [x] Critério de validação da etapa: `npx.cmd -w apps/web tsc --noEmit` e `npm.cmd run build -w apps/web` passando sem erros.

### Etapa 4 - Documentação, Testes Integrados e Validação Final
Status: concluido

- [x] Atualizar `ai-context/backlog/notificacao-cancelamento-evento-ministerios.md` registrando conclusão e regras finais adotadas
- [x] Atualizar `ai-context/backlog/README.md` alterando status da `IMP-011` para concluído
- [x] Atualizar todos os checkboxes de `ai-context/plans/notificacao-cancelamento-evento-ministerios-plan.md` para `[x]` e `Status geral: concluido`
- [x] Atualizar o índice `ai-context/plans/README.md` refletindo a conclusão da IMP-011
- [x] Executar bateria completa de testes e build em `apps/api` (`npx.cmd jest` e `npm.cmd run build -w apps/api`) e `apps/web` (`npx.cmd -w apps/web tsc --noEmit` e `npm.cmd run build -w apps/web`)
- [x] Validar ponta a ponta no navegador (`http://localhost:3001/agenda`): testar checkbox nos modais de cancelar/excluir (marcado e desmarcado), confirmar geração da notificação In-App e ausência de regressões
- [x] Critério de validação da etapa: Builds e testes verdes em ambos os pacotes e fluxo validado ponta a ponta no navegador.

---

## 5. Critérios de Aceite Gerais

- [x] Ao cancelar um evento futuro/em andamento (`status: CANCELADO`) ou excluí-lo (`DELETE` enquanto `AGENDADO`) com a opção de notificação marcada, as notificações In-App + Push são geradas imediatamente com título, data/horário e orientação de remoção da agenda pessoal.
- [x] Voluntários escalados em escalas `PUBLICADA` (exceto `RECUSADO` e o autor) recebem a notificação de cancelamento com `ignorePreferences: true` (mesmo que tenham desativado preferências de notificação), sem duplicidade com a notificação geral/ministerial.
- [x] Eventos `GERAL` notificam os demais usuários ativos; `MINISTERIO` e `REUNIAO_INTERNA` notificam os demais membros dos ministérios vinculados; `REUNIAO_INTERNA` sem ministérios notifica `ADMIN` e `STAFF` ativos.
- [x] Desmarcar o checkbox nos modais de Cancelar/Excluir/Editar em `agenda/page.tsx` conclui a operação sem enviar notificações.
- [x] Voluntários de escalas em `RASCUNHO`, o autor do cancelamento (`user.sub`), eventos já encerrados ou já `CANCELADO` não recebem/geram disparos indevidos (nem fallback acidental para `ALL_MEMBERS`).
- [x] Falhas no serviço de notificação não impedem nem revertem o cancelamento ou exclusão do evento na agenda.
