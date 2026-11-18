# Backlog - Notificação de Cancelamento de Eventos por Ministério

### IMP-010 Notificação Automática de Cancelamento de Eventos aos Ministérios Vinculados

- **Prioridade**: alta (comunicação e não-regressão de presença nos cultos)
- **Status**: pendente
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
