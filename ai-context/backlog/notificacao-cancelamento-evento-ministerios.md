# Backlog - Notificação de Cancelamento de Eventos por Ministério

### IMP-011 Notificação Automática de Cancelamento de Eventos aos Ministérios Vinculados

- **Prioridade**: alta (comunicação e não-regressão de presença nos cultos)
- **Status**: concluido
- **Plano de execução**: [notificacao-cancelamento-evento-ministerios-plan.md](../plans/notificacao-cancelamento-evento-ministerios-plan.md)
- **Fase**: refinamento de Agenda, Escalas e Notificações
- **Categoria**: produto / UX / notificações / agenda
- **Esforço estimado**: baixo
- **Contexto**: hoje, quando um evento é excluído ou cancelado na agenda (`eventos.service.ts` no método `remove`), o sistema apaga o registro no banco e cancela os lembretes agendados futuros. Porém, os membros e voluntários que pertencem aos ministérios atrelados a esse evento (e voluntários eventualmente escalados nele) **não recebem nenhuma notificação imediata de cancelamento**. Isso gera o risco comum de pessoas se deslocarem até o templo para um ensaio, reunião ou culto que foi cancelado sem aviso prévio.

- **Ação**: implementar o disparo automático de notificação no fluxo de cancelamento/exclusão de eventos:

  1. **Disparo no Backend (`apps/api/src/modules/eventos/eventos.service.ts`):**
     - No método `remove(tenantId, id, user)`, antes de executar a deleção física ou atualização de status:
       - Obter os ministérios vinculados ao evento (`evento.ministerios`);
       - Buscar os membros ativos desses ministérios (e membros escalados diretamente no evento);
       - Obter os IDs de usuário (`userId`) associados a esses membros;
       - Disparar notificação em lote via `NotificacoesService`:
         - Título: *"Evento Cancelado"*
         - Mensagem: *"O evento [Nome do Evento] agendado para [Data/Hora] foi cancelado pelo líder."*
         - Categoria: `AGENDA` / `ESCALAS`
         - Link de destino: `/agenda`

  2. **Canais de Notificação:**
     - **In-App:** Notificação visível no sininho e no Inbox da aplicação;
     - **Push PWA:** Notificação direta na tela de bloqueio do smartphone dos voluntários;
     - Se o evento tinha vinculação com Google Agenda / .ics (FT-002), orientar o membro sobre a remoção no seu app de calendário pessoal.

- **Impacto**: evita viagens perdidas e constrangimento de membros e voluntários por cancelamentos de última hora, fortalecendo a credibilidade da comunicação da liderança da igreja.

- **Regras finais adotadas na implementação**:
  - Dispara automaticamente (In-App + Push via `NotificationDispatchService`) tanto no cancelamento via `PATCH /api/eventos/:id` (`status !== CANCELADO → CANCELADO`) quanto na exclusão via `DELETE /api/eventos/:id` (quando `status === AGENDADO`), apenas para eventos futuros ou ainda em andamento (`(dataFim ?? dataInicio) > now`).
  - Voluntários escalados em escalas `PUBLICADA` (com `statusConfirmacao !== RECUSADO`, excluindo o autor) recebem disparo dedicado apontando para `/minhas-escalas` com `ignorePreferences: true` (entrega obrigatória mesmo se tiverem desativado preferências de notificação).
  - Demais públicos sem duplicidade recebem disparo apontando para `/agenda/visualizacao`: eventos `GERAL` notificam os demais usuários ativos do tenant; `MINISTERIO` e `REUNIAO_INTERNA` notificam os demais membros ativos dos ministérios vinculados (preservando a união com os ministérios anteriores em edição simultânea); `REUNIAO_INTERNA` sem ministérios notifica `ADMIN` e `STAFF` ativos.
  - Em `apps/web/src/app/(dashboard)/agenda/page.tsx`, os modais de **Alterar status**, **Editar (ao marcar Cancelado)** e **Excluir** exibem o checkbox `notificarMembros` (pré-marcado para eventos elegíveis) para evitar disparos acidentais ao remover cadastros feitos por engano.
  - Idempotência por janela de 5 minutos, guarda contra lista vazia de destinatários, isolamento de erros em `try/catch` e visibilidade segura na Central de Notificações (`SPECIFIC_USERS` + `ministerioId: null` para eventos multi-ministério).
