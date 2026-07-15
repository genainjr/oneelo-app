# Plano - Notificacoes de confirmacao e recusa para lideranca

Status geral: etapas 1 e 2 concluidas
Ultima atualizacao: 2026-07-15

Branch de trabalho: `feature/leader-response-notifications`

## Objetivo

Criar duas notificacoes automaticas para a lideranca do ministerio quando um membro responder uma escala publicada:

1. membro confirmou presenca;
2. membro recusou presenca.

Os destinatarios devem ser os usuarios ativos vinculados a membros com papel `LEADER` ou `ASSISTANT_LEADER` no ministerio da escala.

## Decisoes

- A notificacao sera enviada no backend, no fluxo de confirmacao/recusa da escala.
- O envio deve acontecer apenas quando o status realmente mudar para `CONFIRMADO` ou `RECUSADO`.
- A notificacao nao deve ser enviada para o proprio usuario que realizou a acao.
- Nao criar migration: a feature usa `PushSubscription` existente.
- O envio deve respeitar tenant, ministerio ativo, membro ativo e usuario ativo.
- Os textos finais das notificacoes seguem a tabela definida em 2026-07-15:
  - `Nova Escala Publicada`: titulo `Você foi escalado`;
  - `Confirmação Pendente`: titulo `Confirmação pendente`;
  - `Escala Hoje`: titulo `Sua escala é hoje`;
  - `Presença Confirmada`: titulo dinamico `{Membro} confirmou presença`;
  - `Presença Recusada`: titulo dinamico `{Membro} não poderá servir`.

## Etapas

### Etapa 0 - Preparacao

Status: concluida

- [x] Atualizar `development` local com `origin/development`.
- [x] Criar branch `feature/leader-response-notifications`.
- [x] Identificar o fluxo atual de confirmacao/recusa.
- [x] Identificar o servico atual de notificacoes push.

### Etapa 1 - Implementacao backend

Status: implementada

Tarefas:

- [x] Buscar lideres e assistentes do ministerio da escala.
- [x] Enviar notificacao quando o membro confirmar presenca.
- [x] Enviar notificacao quando o membro recusar presenca.
- [x] Evitar notificacao duplicada quando o status enviado for igual ao status atual.
- [x] Excluir o proprio usuario que realizou a acao dos destinatarios.

Validacao:

- [x] `npx.cmd tsc -p apps/api/tsconfig.build.json --noEmit --pretty false`.
- [x] `npm.cmd run build -w apps/api`.

### Etapa 2 - Revisao final

Status: concluida

Tarefas:

- [x] Revisar diff.
- [x] Rodar `git diff --check`.
- [x] Atualizar este plano com resultados.
- [x] Preparar resumo para handoff.

Resultados:

- [x] `npx.cmd tsc -p apps/api/tsconfig.build.json --noEmit --pretty false`.
- [x] `npm.cmd run build -w apps/api`.
- [x] `git diff --check` sem erros, apenas warning de CRLF do Windows.

### Ajuste posterior - textos finais das notificacoes

Status: concluido

- [x] Atualizar texto de escala publicada para incluir ministerio e funcao.
- [x] Atualizar texto de confirmacao pendente.
- [x] Atualizar texto de escala do dia para incluir ministerio e horario.
- [x] Atualizar textos de confirmacao/recusa para lideranca.

### Ajuste posterior - notificacao de eventos 2h antes

Status: concluido

Decisoes:

- Seguir o padrao atual sem criar estrutura de controle no banco.
- Usar job interno do backend, sem cron externo.
- Rodar a cada minuto e buscar eventos com inicio na janela `agora + 2h` ate `agora + 2h + 1 minuto`.
- Notificar apenas eventos `AGENDADO`.
- Notificar eventos `GERAL` para todos os usuarios ativos vinculados a membros ativos do tenant.
- Notificar eventos `MINISTERIO` para usuarios ativos vinculados a membros ativos dos ministerios do evento.
- Nao notificar eventos `REUNIAO_INTERNA`.
- Texto final: `{Evento} começa às {Horário}. Esperamos você!`.

Tarefas:

- [x] Criar janela de busca de eventos 2h antes.
- [x] Buscar destinatarios de eventos gerais.
- [x] Buscar destinatarios de eventos ministeriais.
- [x] Ignorar reunioes internas.
- [x] Enviar push com link para `/agenda/visualizacao`.

Validacao:

- [x] `npx.cmd tsc -p apps/api/tsconfig.build.json --noEmit --pretty false`.
- [x] `npm.cmd run build -w apps/api`.
- [x] `git diff --check`.
