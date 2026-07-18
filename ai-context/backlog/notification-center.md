# Backlog - Central e infraestrutura robusta de notificações

### FT-011 Central e infraestrutura robusta de notificações

- **Prioridade**: crítica
- **Fase**: próxima evolução da infraestrutura de comunicação
- **Categoria**: infraestrutura / confiabilidade / comunicação / UX / segurança
- **Esforço estimado**: alto
- **Contexto**: as notificações atuais são enviadas diretamente pelos fluxos de negócio ou por jobs internos com janelas estreitas. O lembrete de evento duas horas antes, por exemplo, depende de a API estar disponível no minuto exato da busca. Não existe registro persistente da notificação, controle por destinatário, recuperação de atrasos, retentativa, histórico detalhado ou interface para gerenciamento.
- **Ação**: criar uma central única de notificações com persistência, fila confiável, idempotência, histórico de entregas, retentativas e gestão por administradores e lideranças ministeriais. Migrar gradualmente todas as notificações automáticas existentes para essa infraestrutura.
- **Impacto**: reduz perdas e duplicidades, permite investigar falhas em produção, recupera envios após indisponibilidade e oferece comunicação geral e ministerial controlada dentro do OneElo.

## Problema atual

O sistema já possui Web Push, `PushSubscription`, service worker e diferentes disparos automáticos. Entretanto, o envio ainda não é tratado como um processo persistente e auditável.

Limitações identificadas:

- jobs podem perder a janela de envio quando a API reinicia ou fica indisponível;
- não existe recuperação automática de notificações atrasadas;
- não existe uma chave central de idempotência para impedir duplicidades;
- não há registro persistente da notificação e de seus destinatários;
- resultados ficam limitados a contadores temporários em logs;
- erros do provedor não ficam disponíveis para consulta pelo administrador;
- não há retentativa controlada nem política de esgotamento;
- uma assinatura pode continuar aparecendo como ativa no navegador mesmo estando inválida no backend;
- administradores e líderes não possuem uma tela para criar e acompanhar comunicados;
- notificações automáticas usam regras e mecanismos distribuídos pelos serviços de negócio.

## Objetivo

Criar uma infraestrutura central, persistente e multitenant para produzir, agendar, processar, entregar e acompanhar notificações do OneElo.

A entrega deve atender conjuntamente:

1. notificações automáticas geradas por eventos do sistema;
2. comunicados gerais criados por administradores;
3. comunicados ministeriais criados por lideranças autorizadas;
4. acompanhamento operacional e auditoria de cada envio;
5. recuperação, retentativa e prevenção de duplicidade.

## Escopo funcional

### 1. Central de notificações

Criar uma área autenticada para gerenciamento de notificações com:

- listagem paginada;
- busca por título ou conteúdo;
- filtros por origem, tipo, público, ministério, autor, período e status;
- criação e edição de rascunhos;
- envio imediato;
- agendamento para data e hora futuras;
- cancelamento antes do processamento;
- duplicação de uma notificação existente como novo rascunho;
- visualização detalhada dos destinatários e resultados;
- reenvio seletivo de entregas recuperáveis que falharam;
- resumo de totais pendentes, processados, enviados, sem assinatura e com erro.

### 2. Comunicados gerais

Usuários administrativos autorizados devem poder criar notificações para todos os usuários elegíveis do tenant.

Regras:

- nunca atravessar o limite do tenant;
- aceitar título, mensagem e destino interno opcional;
- permitir envio imediato ou agendado;
- materializar e registrar os destinatários antes do envio;
- excluir usuários inativos, bloqueados ou sem membro ativo quando a regra de público exigir vínculo com membro;
- apresentar uma estimativa de público antes da confirmação;
- exigir confirmação explícita antes do envio geral imediato.

Permissão inicial:

- `ADMIN`: permitido;
- `STAFF`: decisão de produto pendente, com backend como fonte de verdade;
- `BASIC`: não permitido por role global, salvo atuação ministerial descrita a seguir.

### 3. Comunicados ministeriais

Líderes devem poder criar notificações apenas para os ministérios nos quais possuem liderança ativa.

Regras:

- considerar os papéis ministeriais `LEADER` e `ASSISTANT_LEADER`, seguindo o modelo atual;
- validar tenant, ministério ativo, vínculo ministerial ativo e papel no backend;
- permitir escolher somente entre os ministérios autorizados;
- enviar apenas para usuários ativos vinculados a membros ativos daquele ministério;
- impedir manipulação do `ministerioId` para acessar ou notificar outro ministério;
- registrar o ministério e o autor na auditoria;
- permitir envio imediato ou agendado.

### 4. Notificações automáticas

Migrar para a nova infraestrutura todos os disparos automáticos existentes, preservando suas regras e textos aprovados:

- escala publicada;
- confirmação pendente;
- escala do dia;
- confirmação ou recusa comunicada à liderança;
- lembrete de evento duas horas antes;
- notificações de aniversário;
- outros disparos futuros.

Os serviços de negócio não devem enviar Web Push diretamente. Eles devem criar uma notificação ou evento persistente para processamento pela infraestrutura central.

### 5. Lembrete robusto de eventos

O lembrete duas horas antes deve deixar de depender de uma janela exata de um minuto.

Comportamento esperado:

- ao criar ou atualizar um evento elegível, registrar ou reconciliar o lembrete agendado;
- usar uma chave idempotente, por exemplo `event:{eventoId}:reminder:2h`;
- definir `scheduledAt` como `Evento.dataInicio - 2 horas`;
- buscar itens pendentes com `scheduledAt <= agora`, permitindo recuperar atrasos;
- atualizar ou cancelar o lembrete quando horário, status ou tipo do evento mudar;
- não notificar eventos cancelados;
- preservar as regras de público para `GERAL` e `MINISTERIO`;
- manter `REUNIAO_INTERNA` fora do push enquanto essa for a regra de produto;
- impedir novo envio do mesmo lembrete já concluído.

## Modelo de dados recomendado

Os nomes finais devem seguir as convenções Prisma do projeto, mas o domínio precisa representar pelo menos as entidades abaixo.

### Notification

Representa o conteúdo e o ciclo de vida da notificação.

Campos esperados:

- `id`;
- `tenantId`;
- `ministryId` opcional;
- `createdByUserId` opcional para notificações automáticas;
- `origin`: manual, evento, escala, aniversário ou outra origem controlada;
- `audienceType`: geral, ministerial ou usuários específicos;
- `title`;
- `body`;
- `url` interna opcional;
- `status`;
- `scheduledAt`;
- `processingStartedAt`;
- `completedAt`;
- `cancelledAt`;
- `idempotencyKey` opcional e única no escopo adequado;
- contadores consolidados de destinatários e entregas;
- `createdAt` e `updatedAt`.

Estados mínimos:

- `DRAFT`;
- `SCHEDULED`;
- `PROCESSING`;
- `SENT`;
- `PARTIALLY_SENT`;
- `FAILED`;
- `CANCELLED`.

### NotificationRecipient

Representa o destinatário materializado e seu resultado consolidado.

Campos esperados:

- `id`;
- `notificationId`;
- `tenantId`;
- `userId`;
- `memberId` opcional para rastreabilidade;
- `status`;
- `attemptCount`;
- `nextAttemptAt`;
- `lastAttemptAt`;
- `providerAcceptedAt`;
- `displayedAt` opcional;
- `openedAt` opcional;
- `lastErrorCode` e `lastErrorMessage` sanitizados;
- `createdAt` e `updatedAt`;
- restrição única por `notificationId + userId`.

Estados mínimos:

- `PENDING`;
- `PROCESSING`;
- `PROVIDER_ACCEPTED`;
- `FAILED_RETRYABLE`;
- `FAILED_PERMANENT`;
- `WITHOUT_SUBSCRIPTION`;
- `CANCELLED`;
- `OPENED` quando houver confirmação.

### NotificationAttempt

Registra cada tentativa de entrega sem armazenar segredos da assinatura.

Campos esperados:

- `id`;
- `recipientId`;
- `subscriptionId` opcional;
- número da tentativa;
- data de início e término;
- resultado;
- código HTTP ou código normalizado do provedor;
- mensagem de erro sanitizada;
- data prevista para nova tentativa.

O registro detalhado de tentativas pode ser mantido por política de retenção para evitar crescimento ilimitado.

## Processamento confiável

### Fila persistente

- O banco deve ser a fonte de verdade dos itens pendentes.
- O processador deve consultar itens vencidos com `scheduledAt <= agora`.
- Um reinício não pode apagar trabalho pendente.
- O processamento deve usar reivindicação atômica, lock ou lease para suportar mais de uma instância sem duplicar envios.
- Itens presos em `PROCESSING` devem voltar à fila após expiração controlada do lease.
- O mecanismo pode começar com worker apoiado em PostgreSQL; Redis/BullMQ só deve ser introduzido mediante decisão arquitetural e necessidade operacional comprovada.

### Idempotência

- Toda automação deve possuir chave idempotente determinística.
- Criações concorrentes com a mesma chave não podem gerar duas notificações.
- O reenvio manual deve criar uma nova operação auditável ou reutilizar apenas entregas falhas, sem duplicar as já concluídas.
- Atualizações de evento devem reconciliar o agendamento existente em vez de criar outro lembrete.

### Retentativas

- Classificar falhas entre temporárias e permanentes.
- Aplicar backoff progressivo com limite configurável de tentativas.
- Não repetir erros permanentes como assinatura expirada ou removida.
- Desativar subscriptions que retornarem códigos definitivos, preservando o histórico.
- Registrar a próxima tentativa e o motivo da falha.
- Permitir retentativa operacional das falhas recuperáveis pela central.

### Agendamento e recuperação

- Processar notificações vencidas, e não apenas uma janela do minuto atual.
- Definir uma política para notificações excessivamente atrasadas, evitando enviar lembretes sem utilidade após o evento.
- Registrar quando uma entrega for ignorada por expiração.
- Usar datas persistidas em UTC e apresentar horários no fuso do tenant ou na regra consolidada do produto.

## Semântica de entrega

A interface e os relatórios não devem chamar todo envio aceito pelo provedor de "entregue ao dispositivo".

Definições:

- **Processada**: destinatário passou pela fila.
- **Aceita pelo provedor**: Web Push aceitou a requisição.
- **Exibida**: service worker confirmou a exibição quando tecnicamente possível.
- **Aberta**: usuário clicou na notificação e o evento foi registrado.
- **Sem assinatura**: usuário elegível não possuía subscription ativa.
- **Falhou**: tentativa temporária ou permanentemente rejeitada.

Confirmações de exibição e abertura são telemetria de melhor esforço e não podem ser apresentadas como garantia absoluta de leitura.

## Auditoria, segurança e privacidade

- Todas as consultas e mutações devem ser isoladas por `tenantId`.
- O backend deve resolver e validar o público autorizado.
- Registrar criação, edição, agendamento, cancelamento e reenvio no `AuditLog`.
- Não registrar endpoint, `p256dh`, `auth` ou conteúdo sensível da subscription nos logs e tentativas.
- Sanitizar respostas de erro do provedor antes de persistir.
- Impedir links externos ou destinos internos não permitidos sem validação explícita.
- Aplicar limite de frequência para evitar abuso ou disparo acidental em massa.
- Definir política de retenção para conteúdo, destinatários e tentativas.
- Exibir confirmação reforçada para comunicados gerais e grandes públicos.

## API prevista

Os caminhos finais devem seguir o padrão NestJS existente. Capacidades mínimas:

- listar notificações autorizadas;
- obter detalhes e resumo de uma notificação;
- listar destinatários e tentativas;
- criar e atualizar rascunho;
- estimar público;
- agendar ou enviar;
- cancelar;
- reenviar falhas recuperáveis;
- registrar telemetria de exibição e abertura;
- consultar o estado real da subscription atual do dispositivo.

Endpoints de criação geral e ministerial devem compartilhar o mesmo serviço de domínio, mas aplicar políticas de autorização específicas.

## Experiência de usuário

### Listagem

- mostrar título, origem, público, ministério, autor, agendamento e status;
- mostrar contadores de aceitas, falhas, sem assinatura e pendentes;
- permitir filtros compatíveis com as permissões do usuário;
- líderes visualizam somente notificações dos seus ministérios;
- administradores visualizam as notificações do tenant.

### Criação

- selecionar público geral ou ministério autorizado;
- informar título, mensagem e destino opcional;
- visualizar prévia;
- visualizar estimativa de destinatários;
- salvar rascunho, enviar agora ou agendar;
- validar tamanho e campos obrigatórios no frontend e no backend;
- confirmar explicitamente o disparo.

### Detalhes

- apresentar linha do tempo da notificação;
- apresentar resultados por destinatário;
- mostrar tentativas e erros sanitizados;
- permitir filtrar falhas, ausência de subscription e envios aceitos;
- disponibilizar reenvio somente quando permitido e tecnicamente aplicável.

## Observabilidade operacional

- Produzir logs estruturados com `notificationId`, tenant, origem e contadores, sem dados secretos.
- Disponibilizar métricas de tamanho da fila, atraso do item mais antigo, taxa de sucesso, falhas e retentativas.
- Alertar quando a fila parar de avançar ou acumular itens atrasados.
- Criar uma verificação operacional que diferencie API saudável de worker saudável.
- Registrar a versão do processador ou estratégia de envio quando útil para investigação.

## Migração e implantação gradual

### Etapa 1 - Fundação persistente

- criar modelos, migrations, serviço de domínio e processador confiável;
- implementar idempotência, locks, retentativas e observabilidade;
- manter os disparos atuais funcionando até cada migração ser validada.

### Etapa 2 - Lembrete de eventos

- migrar primeiro o lembrete de eventos duas horas antes;
- reconciliar eventos existentes ainda futuros;
- validar recuperação após parada simulada da API;
- remover o job antigo somente após confirmar o novo processamento.

### Etapa 3 - Demais automações

- migrar notificações de escalas, respostas e aniversários;
- preservar regras, destinatários, textos e URLs existentes;
- eliminar envios diretos após validação de equivalência.

### Etapa 4 - Gestão manual

- liberar central administrativa;
- liberar comunicados gerais para administradores;
- liberar comunicados ministeriais para lideranças;
- acompanhar volume, erros e uso antes de ampliar permissões.

## Fora do escopo inicial

- WhatsApp, SMS e e-mail como canais de entrega;
- marketing externo ou campanhas para pessoas sem usuário no tenant;
- editor avançado de HTML;
- segmentações arbitrárias por dados sensíveis;
- garantia absoluta de leitura pelo destinatário;
- comunicação entre tenants;
- mensagens bidirecionais ou chat.

A arquitetura deve permitir novos canais futuramente sem acoplar o domínio exclusivamente ao Web Push, mas a primeira entrega deve estabilizar o canal existente.

## Critérios de aceite

### Confiabilidade

- uma notificação pendente sobrevive ao reinício da API ou worker;
- itens atrasados são retomados automaticamente dentro da política definida;
- duas instâncias não enviam a mesma entrega simultaneamente;
- a mesma chave idempotente não cria duas notificações automáticas;
- falhas temporárias geram retentativas com backoff;
- falhas permanentes encerram a entrega e atualizam a subscription quando aplicável;
- notificações canceladas não são processadas;
- alterações e cancelamentos de eventos reconciliam seus lembretes.

### Rastreabilidade

- cada notificação possui autor ou origem automática identificável;
- cada destinatário possui estado e contadores consultáveis;
- cada tentativa relevante possui horário, resultado e erro sanitizado;
- os totais consolidados correspondem aos registros individuais;
- administradores conseguem distinguir aceitação pelo provedor, ausência de assinatura e falha;
- abertura é registrada quando o usuário interage com o push.

### Permissões

- administrador autorizado cria comunicado geral apenas no próprio tenant;
- líder cria comunicado apenas para ministérios em que possui liderança ativa;
- alteração manual do `ministerioId` não amplia acesso;
- usuários sem permissão não acessam criação, detalhes ou destinatários indevidos;
- todas as decisões críticas de autorização são aplicadas no backend.

### Produto

- administrador consegue salvar, revisar, enviar, agendar e cancelar uma notificação;
- líder consegue fazer o mesmo dentro do seu escopo ministerial;
- a central exibe estados, totais, destinatários e falhas;
- é possível reenviar somente falhas recuperáveis sem duplicar entregas concluídas;
- o lembrete de evento é enviado mesmo após uma indisponibilidade curta no horário original;
- os textos e destinos das automações atuais permanecem compatíveis após a migração.

### Qualidade

- testes unitários cobrem estados, idempotência, autorização e classificação de falhas;
- testes de integração cobrem concorrência, recovery, retentativa e isolamento multitenant;
- testes end-to-end cobrem criação geral, criação ministerial e consulta de resultados;
- um teste com parada e retomada do worker comprova que itens pendentes não são perdidos;
- migrations são compatíveis com `prisma migrate deploy` e não executam seed automaticamente.

## Decisões pendentes para o plano de desenvolvimento

- confirmar se `STAFF` pode criar comunicados gerais ou apenas `ADMIN`;
- confirmar se `ASSISTANT_LEADER` possui a mesma permissão de comunicação que `LEADER`;
- escolher processamento inicial com PostgreSQL ou Redis/BullMQ;
- definir número de tentativas e intervalos de backoff;
- definir tolerância máxima para lembretes atrasados;
- definir fuso por tenant ou manter inicialmente `America/Sao_Paulo`;
- definir política de retenção de notificações, destinatários e tentativas;
- definir se a central também será uma caixa de entrada interna para os destinatários;
- definir limites de tamanho, frequência e quantidade de destinatários por disparo;
- definir quais notificações automáticas podem ser desativadas por preferência do usuário.

## Dependências

- infraestrutura atual de `PushSubscription` e Web Push;
- `NotificationsModule` existente;
- `AuditLog`;
- regras de tenant e RBAC;
- papéis ministeriais `LEADER` e `ASSISTANT_LEADER`;
- eventos, ministérios, membros, usuários e escalas existentes;
- decisão operacional sobre processo worker e monitoramento em produção.

## Áreas previstas de impacto

- `apps/api/prisma/schema.prisma` e nova migration;
- `apps/api/src/modules/notifications/`;
- serviços que hoje chamam `sendToUsers` diretamente;
- jobs automáticos atuais;
- `apps/web/src/app/(dashboard)/` para listagem, criação e detalhes;
- navegação e matriz de permissões;
- service worker e telemetria de abertura;
- documentação operacional de deploy, worker, monitoramento e recuperação.

## Plano de desenvolvimento

Ainda não criado. Deve ser produzido antes da implementação e dividido em entregas incrementais, mantendo este backlog como o escopo completo da funcionalidade.
