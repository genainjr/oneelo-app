# Plano - Central de Notificações

Status geral: **planejado**

Criação: 2026-07-22

Branch sugerida para implementação: `feature/central-notificacoes`

Backlog relacionado: [notification-center.md](../backlog/notification-center.md)

## Objetivo da entrega

Criar uma infraestrutura central, persistente e multitenant para produzir, agendar, processar, entregar e acompanhar notificações do OneElo, começando por Web Push e preparando a arquitetura para canais futuros.

O objetivo não é apenas criar uma tela. O objetivo é tirar os envios automáticos de fluxos diretos e transformá-los em um processo auditável, recuperável e idempotente.

## Decisões fechadas

- A primeira implementação fica no backend atual.
- Não criar microserviço na primeira entrega.
- Web Push é o primeiro canal.
- O banco deve ser a fonte de verdade dos itens pendentes.
- Notificações automáticas devem usar chave idempotente.
- Serviços de negócio não devem enviar push diretamente no modelo final.
- O processador deve buscar atrasadas com `scheduledAt <= now`, não janela exata de minuto.
- O sistema deve distinguir aceito pelo provedor, sem assinatura, falha, aberto e estados internos.

## Fora de escopo inicial

- WhatsApp.
- SMS.
- E-mail transacional completo.
- Campanhas de marketing.
- Preferências avançadas por canal se não forem necessárias na primeira entrega.
- Garantia absoluta de leitura pelo usuário.
- Microserviço separado.

## Etapa 0 - Inventário do estado atual

Objetivo: mapear todos os disparos antes de modelar a migração.

- [ ] Mapear Web Push atual.
- [ ] Mapear `PushSubscription` e service worker.
- [ ] Mapear notificações de escala publicada.
- [ ] Mapear confirmação pendente.
- [ ] Mapear escala do dia.
- [ ] Mapear confirmação/recusa para liderança.
- [ ] Mapear lembrete de evento duas horas antes.
- [ ] Mapear aniversários.
- [ ] Identificar textos, URLs e públicos atuais.
- [ ] Identificar onde há envio direto dentro de services.

Entregável:

- seção "Estado atual do código" preenchida no plano antes da implementação.

Critérios de aceite:

- nenhum disparo atual fica sem classificação;
- textos aprovados ficam preservados;
- riscos de duplicidade são conhecidos antes da migration.

## Etapa 1 - Contrato funcional da primeira entrega

Objetivo: evitar uma entrega grande demais.

- [ ] Definir se a primeira entrega cobre apenas infraestrutura automática ou também comunicados manuais.
- [ ] Definir se a tela administrativa entra no primeiro release ou na segunda fatia.
- [ ] Definir decisão de produto para `STAFF` em comunicados gerais.
- [ ] Definir se líderes BASIC podem criar comunicados ministeriais na primeira entrega.
- [ ] Definir política inicial de retry.
- [ ] Definir prazo máximo para envio atrasado de lembretes.
- [ ] Definir retenção de tentativas detalhadas.

Entregável:

- escopo da primeira fatia fechado;
- permissões iniciais sem ambiguidade.

Critérios de aceite:

- primeira fatia entrega confiabilidade real sem depender da central completa;
- decisões de permissão não ficam implícitas na UI.

## Etapa 2 - Modelo persistente

Objetivo: criar o núcleo auditável.

- [ ] Criar enum `NotificationOrigin`.
- [ ] Criar enum `NotificationAudienceType`.
- [ ] Criar enum `NotificationStatus`.
- [ ] Criar enum `NotificationRecipientStatus`.
- [ ] Criar modelo `Notification`.
- [ ] Criar modelo `NotificationRecipient`.
- [ ] Criar modelo `NotificationAttempt` ou registrar tentativa consolidada na primeira versão.
- [ ] Criar `idempotencyKey` único no escopo adequado.
- [ ] Criar índices por tenant, status, scheduledAt, origin e ministryId.
- [ ] Criar migration.

Entregável:

- schema persistente versionado;
- migrations e Prisma validados.

Critérios de aceite:

- notificação pertence a um tenant;
- destinatários são materializados;
- a mesma automação não cria duplicidade;
- erro por destinatário é rastreável.

## Etapa 3 - Serviço de criação e materialização de público

Objetivo: centralizar a criação de notificações.

- [ ] Criar `NotificationsCommandService` ou equivalente.
- [ ] Criar método para notificação automática idempotente.
- [ ] Criar método para comunicado geral.
- [ ] Criar método para comunicado ministerial.
- [ ] Materializar destinatários no momento correto.
- [ ] Excluir usuários inativos, bloqueados ou sem vínculo quando aplicável.
- [ ] Tratar usuários sem subscription ativa como destinatários com estado próprio.
- [ ] Validar tenant e permissão no backend.

Entregável:

- services de negócio conseguem criar notificações sem enviar push diretamente.

Critérios de aceite:

- ADMIN cria geral apenas dentro do tenant;
- líder cria ministerial apenas em ministério autorizado;
- BASIC comum não cria comunicado administrativo;
- manipulação de `ministerioId` não atravessa autorização.

## Etapa 4 - Processador confiável

Objetivo: entregar Web Push com retry e recuperação.

- [ ] Criar processador de notificações pendentes.
- [ ] Buscar `scheduledAt <= now`.
- [ ] Implementar reivindicação atômica ou lease.
- [ ] Processar destinatários pendentes.
- [ ] Registrar tentativa por destinatário.
- [ ] Classificar falha retryable e permanente.
- [ ] Desativar subscription inválida quando o provedor indicar.
- [ ] Aplicar backoff progressivo.
- [ ] Marcar notificação como `SENT`, `PARTIALLY_SENT` ou `FAILED`.
- [ ] Recuperar itens presos em `PROCESSING` após expiração do lease.

Entregável:

- envio não depende da request original;
- reinício da API não perde trabalho.

Critérios de aceite:

- notificação atrasada ainda é processada;
- falha temporária entra em retry;
- assinatura inválida não fica tentando para sempre;
- duas instâncias não enviam o mesmo destinatário simultaneamente.

## Etapa 5 - Migração dos disparos automáticos

Objetivo: migrar sem mudar comportamento aprovado pelo usuário.

- [ ] Migrar escala publicada.
- [ ] Migrar confirmação pendente.
- [ ] Migrar escala do dia.
- [ ] Migrar confirmação/recusa para liderança.
- [ ] Migrar lembrete de evento duas horas antes.
- [ ] Migrar aniversários quando aplicável.
- [ ] Preservar títulos, mensagens e URLs atuais.
- [ ] Criar chaves idempotentes determinísticas por automação.
- [ ] Remover envio direto antigo após validação.

Entregável:

- principais automações usam a infraestrutura central.

Critérios de aceite:

- nenhuma automação duplica envio;
- textos aprovados continuam iguais;
- falha do push não quebra fluxo principal de negócio;
- logs mostram criação da notificação, não apenas envio imediato.

## Etapa 6 - Lembrete robusto de eventos

Objetivo: resolver a fragilidade do lembrete duas horas antes.

- [ ] Criar lembrete ao criar evento elegível.
- [ ] Reconciliar lembrete ao alterar data/hora.
- [ ] Reconciliar lembrete ao alterar tipo.
- [ ] Reconciliar lembrete ao alterar ministérios.
- [ ] Cancelar lembrete se evento for cancelado.
- [ ] Usar chave `event:{eventoId}:reminder:2h`.
- [ ] Definir `scheduledAt = dataInicio - 2 horas`.
- [ ] Processar lembretes atrasados dentro da política definida.
- [ ] Não enviar para `REUNIAO_INTERNA` enquanto essa for a regra de produto.

Entregável:

- lembrete não depende mais de cron acertar janela de um minuto.

Critérios de aceite:

- evento alterado não mantém lembrete antigo incorreto;
- evento cancelado não notifica;
- evento ministerial usa público ministerial correto;
- evento geral usa público geral correto.

## Etapa 7 - Central administrativa de consulta

Objetivo: dar visibilidade operacional antes de habilitar criação manual ampla.

- [ ] Criar tela de listagem.
- [ ] Filtros por status, origem, público, ministério e período.
- [ ] Busca por título/conteúdo quando seguro.
- [ ] Mostrar contadores: pendente, processado, aceito, sem assinatura, falha.
- [ ] Criar detalhe com destinatários.
- [ ] Mostrar tentativas e erro sanitizado.
- [ ] Permitir reenvio seletivo de falhas recuperáveis.
- [ ] Seguir ODS.

Entregável:

- ADMIN consegue auditar o que aconteceu com um envio.

Critérios de aceite:

- erros não expõem dados sensíveis da subscription;
- tela não mistura dados de tenants;
- reenvio não duplica destinatários já concluídos.

## Etapa 8 - Comunicados manuais

Objetivo: permitir comunicação controlada pelo sistema.

- [ ] Criar rascunho de comunicado geral.
- [ ] Criar rascunho de comunicado ministerial.
- [ ] Estimar público antes do envio.
- [ ] Exigir confirmação explícita para envio geral imediato.
- [ ] Permitir agendamento.
- [ ] Permitir cancelamento antes do processamento.
- [ ] Permitir duplicar comunicado como novo rascunho.
- [ ] Registrar autor e escopo.

Entregável:

- ADMIN envia comunicado geral;
- líder autorizado envia comunicado ministerial, se aprovado na Etapa 1.

Critérios de aceite:

- público estimado bate com destinatários materializados;
- confirmação evita envio geral acidental;
- permissões são validadas no backend.

## Etapa 9 - Preferências, abertura e canais futuros

Objetivo: preparar evolução sem reescrever a Central.

- [ ] Avaliar preferências por usuário.
- [ ] Registrar abertura de notificação quando o service worker permitir.
- [ ] Diferenciar "aceita pelo provedor" de "aberta".
- [ ] Criar abstração de canal.
- [ ] Preparar templates versionados por canal.
- [ ] Documentar como e-mail/WhatsApp entrariam depois.

Entregável:

- Web Push não fica acoplado ao domínio de notificação.

Critérios de aceite:

- estados de entrega são semanticamente corretos;
- novos canais não exigem reescrever criação de notificações.

## Etapa 10 - Preparação para worker ou microserviço futuro

Objetivo: permitir extração quando houver necessidade real.

- [ ] Isolar processador de envio.
- [ ] Isolar provedor Web Push.
- [ ] Evitar envio dentro de controller.
- [ ] Documentar variáveis necessárias para worker.
- [ ] Documentar estratégia de lease em múltiplas instâncias.
- [ ] Definir sinais que justificam extração: volume, canais, deploy independente ou risco operacional.

Entregável:

- monólito robusto agora;
- fronteira clara para extração depois.

Critérios de aceite:

- processador pode rodar separado no futuro;
- backend continua dono de autorização e criação;
- provedor externo não contamina regra de negócio.

## Validação final da entrega

- [ ] `npx.cmd prisma validate`
- [ ] `npx.cmd prisma generate`
- [ ] Build da API.
- [ ] Build do web.
- [ ] Testes de criação idempotente.
- [ ] Testes de tenant isolado.
- [ ] Testes de permissões ADMIN, STAFF, BASIC líder e BASIC comum.
- [ ] Teste de retry.
- [ ] Teste de assinatura inválida.
- [ ] Teste de lembrete de evento atrasado.
- [ ] Teste de evento cancelado.
- [ ] Teste de reenvio seletivo.

