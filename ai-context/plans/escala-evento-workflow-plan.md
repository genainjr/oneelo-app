# Plano - Criação de Escalas com Base em Eventos

Status geral: planejado - aguardando início da implementação

Última atualização: 2026-07-19

Branch de planejamento: `docs/escala-evento-workflow`

Backlog de origem: `ai-context/backlog/escala-evento-vinculo.md`

Feature de origem: `FT-008 Criar escalas com base nos eventos da agenda`

## Objetivo

Permitir que um ministério crie sua escala mensal selecionando eventos previamente cadastrados na Agenda e marcados como necessitando de escala para aquele ministério.

A Agenda continuará responsável apenas por declarar o contexto do evento. Toda criação e manutenção de escala permanecerá no módulo `/escalas`.

## Resultado esperado

- O responsável pelo evento seleciona os ministérios envolvidos e indica, por ministério, se será necessária uma escala.
- Um evento geral pode ter ministérios relacionados sem perder a visibilidade geral.
- Ao criar uma escala, o usuário escolhe entre dias da semana, eventos elegíveis ou escala vazia.
- O modo baseado em eventos lista somente eventos do tenant, período e ministério corretos com `requerEscala = true`.
- O usuário escolhe explicitamente quais eventos serão incluídos.
- Escala e dias vinculados são criados em uma única transação.
- Cada dia vinculado usa o evento como contexto atual e preserva data e título como fallback histórico.
- Nenhuma escala é criada automática ou diretamente pela Agenda.
- Permissões atuais de eventos e escalas são preservadas.

## Valor entregue ao cliente

O líder deixa de reproduzir manualmente, dentro da escala, datas e títulos que já existem na Agenda.

O evento passa a indicar antecipadamente quais ministérios deverão preparar equipe, sem obrigar todos os eventos a terem escala e sem criar escalas antes da decisão do líder.

## Estado atual do código

### Já existe

- `Escala` mensal por ministério, com unicidade por `ministerioId`, `mes` e `ano`.
- `EscalaDia.eventoId` opcional com `onDelete: SetNull`.
- Relação reversa `Evento.escalasDias`.
- Relação N:N `EventoMinisterio`.
- Eventos `GERAL`, `MINISTERIO` e `REUNIAO_INTERNA`.
- Filtro de eventos por período, tipo, status e ministério.
- Regras de visibilidade e gestão de eventos por perfil e liderança ministerial.
- Criação de escala por mês, ano, ministério e dias da semana.
- Criação manual de dia com data e título.
- Consulta detalhada da escala incluindo `evento.id` e `evento.titulo`.
- Permissões de escala para `ADMIN`, `STAFF` e `BASIC` líder ou auxiliar do ministério.

### Ainda não existe

- Indicador de necessidade de escala por relação evento-ministério.
- Ministério relacionado a evento `GERAL`.
- Contrato de evento que receba configuração por ministério.
- Consulta específica de eventos elegíveis para uma escala.
- Modo de criação de escala baseado em eventos.
- Criação transacional da escala e dos dias vinculados.
- Proteção contra o mesmo evento duplicado na mesma escala.
- Exibição consistente de horário, local e status do evento na gestão da escala.
- Manutenção do vínculo em dias existentes.
- Regra consolidada para mudança de data, cancelamento ou remoção do evento vinculado.

## Decisões fechadas

### 1. A Agenda não cria escala

- Não adicionar botão `Criar escala` na Agenda.
- Salvar um evento nunca cria `Escala` nem `EscalaDia`.
- A Agenda apenas registra ministérios envolvidos e necessidade de escala.

### 2. O vínculo permanece por dia

- Manter `EscalaDia.eventoId` como relação principal.
- Não adicionar `eventoId` em `Escala`.
- Uma escala mensal pode conter vários eventos.
- Um evento pode participar de escalas de vários ministérios.

### 3. Necessidade de escala pertence à relação evento-ministério

Adicionar `requerEscala` em `EventoMinisterio`.

```prisma
model EventoMinisterio {
  eventoId     String  @map("event_id")
  ministerioId String  @map("ministry_id")
  requerEscala Boolean @default(false) @map("requires_schedule")

  evento     Evento     @relation(fields: [eventoId], references: [id], onDelete: Cascade)
  ministerio Ministerio @relation(fields: [ministerioId], references: [id], onDelete: Cascade)

  @@id([eventoId, ministerioId])
  @@index([ministerioId, requerEscala])
  @@map("tb_event_ministry")
}
```

Registros existentes recebem `false`. Nenhum evento antigo passa a aparecer como elegível sem revisão explícita.

### 4. Eventos gerais podem ter ministérios

- Remover a validação que rejeita `ministerioIds` em evento `GERAL`.
- Ministério relacionado a evento geral representa contexto operacional.
- A visibilidade do evento geral continua abrangendo todos os usuários autenticados.

### 5. Os modos de criação são mutuamente exclusivos no primeiro incremento

Adicionar os modos de formulário:

```ts
type ModoCriacaoEscala = 'DIAS_SEMANA' | 'EVENTOS' | 'VAZIA';
```

Regras:

- `DIAS_SEMANA`: exige ao menos um dia da semana e não aceita eventos.
- `EVENTOS`: exige ao menos um evento e não aceita dias da semana.
- `VAZIA`: não aceita dias da semana nem eventos.
- O contrato legado sem `modoCriacao` continua funcionando durante a transição.

### 6. Somente eventos agendados são candidatos para nova escala

- Listar apenas `StatusEvento.AGENDADO`.
- Evento cancelado ou realizado permanece visível onde já estiver vinculado, mas não entra em novas escalas.

### 7. Permissões atuais são preservadas

- `requerEscala` não concede acesso ou liderança.
- A visibilidade do evento é calculada antes da elegibilidade para escala.
- `ADMIN` e `STAFF` mantêm as permissões atuais.
- `BASIC` só consulta e cria escala para ministério em que é `LEADER` ou `ASSISTANT_LEADER`.
- Evento `GERAL`, `MINISTERIO` e `REUNIAO_INTERNA` mantêm as regras atuais de visibilidade.
- Backend continua sendo a fonte de verdade.

### 8. Evento duplicado na mesma escala é inválido

Adicionar proteção de serviço e, após auditoria dos dados atuais, índice único:

```prisma
@@unique([escalaId, eventoId])
```

Como `eventoId` é opcional e PostgreSQL permite múltiplos valores nulos em índice único, dias manuais continuam permitidos.

### 9. Data e título do dia funcionam como snapshot

Ao criar o vínculo:

- `EscalaDia.data` recebe `Evento.dataInicio`;
- `EscalaDia.titulo` recebe `Evento.titulo`;
- as telas exibem primeiro os dados atuais do evento;
- se o evento for removido, data e título permanecem disponíveis no dia.

### 10. Mudança de mês do evento vinculado será bloqueada no MVP

- Mudança de data dentro do mesmo mês e ano sincroniza os dias vinculados.
- Mudança para outro mês ou ano retorna conflito quando houver dias vinculados.
- A mensagem orienta desvincular o evento das escalas antes da alteração.
- Não mover dias automaticamente entre escalas e não criar escala no mês de destino.

Essa regra evita deixar um `EscalaDia` fora do período definido por sua `Escala` mensal.

## Modelo de dados e migration

### Alterações Prisma

1. Adicionar `EventoMinisterio.requerEscala` com default `false`.
2. Adicionar índice `[ministerioId, requerEscala]` para consulta de elegibilidade.
3. Adicionar unicidade `[escalaId, eventoId]` em `EscalaDia` após auditoria.

### Pré-validação da migration

Antes de criar o índice único, consultar possíveis duplicidades existentes por:

- `escala_id`;
- `event_id` não nulo;
- contagem maior que 1.

Se houver duplicidade, não remover dados automaticamente. Registrar os casos e decidir qual dia será mantido antes da migration de unicidade.

### Regras da migration

- Migration aditiva.
- Sem seed automático.
- Sem backfill de `requerEscala = true`.
- Aplicar primeiro em ambiente local e homologação.
- Validar rollback operacional antes de produção.

## Contratos de API

### Configuração de ministérios no evento

Introduzir contrato novo e compatível:

```ts
interface EventoMinisterioInput {
  ministerioId: string;
  requerEscala: boolean;
}

interface CreateEventoDto {
  // campos atuais
  ministerios?: EventoMinisterioInput[];
  ministerioIds?: string[]; // legado temporário
}
```

Normalização no backend:

- se `ministerios` estiver presente, ele é a fonte de verdade;
- se apenas `ministerioIds` estiver presente, criar relações com `requerEscala = false`;
- IDs duplicados são rejeitados ou normalizados antes da persistência;
- `requerEscala = true` só é aceito para ministério válido e permitido ao usuário;
- em update, `ministerios: undefined` preserva relações e `ministerios: []` remove todas;
- a resposta de evento inclui `ministerios[].requerEscala`.

O campo legado pode ser removido em uma entrega posterior, depois que web e API estiverem estabilizadas.

### Eventos elegíveis

Criar endpoint antes da rota dinâmica `:id`:

```http
GET /api/escalas/eventos-elegiveis?ministerioId={uuid}&mes={1-12}&ano={yyyy}
```

Resposta mínima:

```ts
interface EventoElegivelEscala {
  id: string;
  titulo: string;
  tipo: EventoTipo;
  dataInicio: string;
  dataFim?: string | null;
  local?: string | null;
  status: StatusEvento;
  ministerioId: string;
}
```

O backend deve:

- validar acesso de gestão ao ministério solicitado;
- montar limites do mês usando o fuso operacional `America/Sao_Paulo`;
- filtrar tenant, período, `AGENDADO`, ministério e `requerEscala = true`;
- aplicar as regras atuais de visibilidade do evento;
- excluir eventos já vinculados à escala mensal existente daquele ministério, se houver;
- ordenar por `dataInicio` e título.

### Criação da escala

Evoluir `CreateEscalaDto`:

```ts
interface CreateEscalaDto {
  mes: number;
  ano: number;
  ministerioId: string;
  observacoes?: string;
  modoCriacao?: 'DIAS_SEMANA' | 'EVENTOS' | 'VAZIA';
  diasSemana?: number[];
  eventoIds?: string[];
}
```

Compatibilidade:

- sem `modoCriacao`, `diasSemana` preenchido mantém o comportamento atual;
- sem `modoCriacao`, `eventoIds` preenchido assume `EVENTOS`;
- sem ambos, cria escala vazia como hoje.

Validação do modo `EVENTOS`:

- IDs únicos e não vazios;
- todos os eventos pertencem ao tenant;
- todos estão no mês e ano informados;
- todos estão `AGENDADO`;
- todos possuem relação com o ministério e `requerEscala = true`;
- usuário pode gerenciar a escala do ministério;
- nenhum evento já está vinculado à mesma escala.

Persistência:

- usar `prisma.$transaction`;
- validar novamente a inexistência da escala mensal dentro da transação;
- criar `Escala` como `RASCUNHO`;
- criar os `EscalaDia` com evento, snapshot e ordem;
- reverter tudo se qualquer vínculo falhar.

### Manutenção do vínculo

Substituir o body inline do endpoint de dia por DTO validado:

```ts
interface CreateEscalaDiaDto {
  data?: string;
  titulo?: string;
  eventoId?: string;
}
```

Regras:

- com `eventoId`, data e título são derivados no backend;
- sem `eventoId`, data continua obrigatória;
- validar tenant, ministério, período, status e permissão;
- adicionar endpoint de atualização para vincular, trocar ou remover evento enquanto a escala não estiver encerrada.

## Backend

### Eventos

- Atualizar migration e Prisma Client.
- Criar DTO aninhado para configuração ministerial.
- Normalizar contrato novo e legado.
- Remover proibição de ministérios em evento geral.
- Preservar integralmente regras de visibilidade.
- Persistir `requerEscala` no create e update.
- Incluir `requerEscala` nos selects e respostas.
- Em alteração de título, atualizar o snapshot dos dias vinculados.
- Em alteração de data dentro do mesmo mês, sincronizar `EscalaDia.data`.
- Bloquear alteração para outro mês ou ano quando houver vínculo.
- Em cancelamento, manter vínculo sem remover dias.
- Em remoção, confiar em `onDelete: SetNull` e preservar snapshots.

### Escalas

- Criar enum de modo apenas no contrato, sem persistência adicional.
- Criar DTO para eventos elegíveis.
- Reutilizar as regras existentes de acesso ao ministério.
- Implementar consulta de elegibilidade sem expor eventos invisíveis.
- Refatorar criação para transação.
- Validar modos mutuamente exclusivos.
- Criar dias de evento com snapshot e ordenação.
- Impedir duplicidade no serviço e no banco.
- Evoluir `addDia` para DTO validado.
- Retornar evento com `titulo`, `dataInicio`, `dataFim`, `local`, `status` e `tipo` nos detalhes de escala.

### Auditoria

Seguir o padrão atual do módulo para registrar:

- alteração de `requerEscala`;
- criação de escala baseada em eventos;
- vínculo, troca e remoção de evento em dia existente;
- bloqueio ou tentativa inválida sem incluir dados sensíveis.

## Frontend

### Agenda

No modal existente de evento:

- permitir ministérios também para evento `GERAL`;
- substituir a seleção simples por linhas de ministério;
- cada linha selecionada mostra checkbox ou switch **Precisa de escala**;
- manter `requerEscala = false` como padrão;
- explicar que a marcação apenas disponibiliza o evento no módulo de Escalas;
- não adicionar ação de criação de escala na página;
- preservar mensagens, loading, erros inline e permissões atuais;
- atualizar `pt-BR`, `pt-PT` e `en-US`.

### Modal de criação da escala

Após mês, ano e ministério, exibir seleção de modo:

- **Por dias da semana**;
- **Com base nos eventos**;
- **Começar sem dias**.

No modo de eventos:

- carregar candidatos somente quando mês, ano e ministério estiverem definidos;
- mostrar skeleton durante carregamento;
- mostrar erro inline com ação de tentar novamente;
- mostrar `EmptyState` quando não houver eventos elegíveis;
- exibir cada evento com data, horário, título, tipo e local;
- permitir seleção múltipla explícita;
- mostrar quantidade selecionada;
- desabilitar criação sem evento selecionado;
- limpar seleção quando mês, ano ou ministério mudar;
- enviar `modoCriacao: 'EVENTOS'` e `eventoIds`.

### Gestão da escala

- Exibir título do evento como contexto principal do dia vinculado.
- Exibir horário e local sem substituir os dados da escala.
- Mostrar badge de evento cancelado ou realizado.
- Diferenciar visualmente dia manual de dia vinculado.
- Na etapa de manutenção, permitir vincular, trocar ou remover evento.
- Não permitir alteração do vínculo em escala `ENCERRADA`.

### Tipos e hooks

- Adicionar `requerEscala` em `EventoMinisterio`.
- Adicionar contrato de ministérios configurados ao hook de eventos.
- Adicionar `ModoCriacaoEscala` e `eventoIds` ao hook de escalas.
- Criar método `getEventosElegiveis`.
- Ampliar o tipo do evento retornado em `EscalaDia`.

## Permissões

| Ação | ADMIN | STAFF | BASIC líder/auxiliar | BASIC comum |
|---|---:|---:|---:|---:|
| Configurar ministérios em evento permitido | Sim | Sim | Somente ministérios liderados | Não |
| Marcar `requerEscala` | Sim | Sim | Somente ministérios liderados | Não |
| Consultar eventos elegíveis | Sim | Sim | Somente ministério liderado | Não |
| Criar escala baseada em eventos | Sim | Sim | Somente ministério liderado | Não |
| Alterar vínculo de escala | Sim | Sim | Somente ministério liderado e escala aberta | Não |

As regras de visibilidade do evento continuam sendo aplicadas independentemente desta matriz.

## Etapas de implementação

### Etapa 0 - Preparação e invariantes

Status: pendente

- [ ] Confirmar branch criada a partir de `development` atualizada.
- [ ] Registrar baseline dos testes de eventos e escalas.
- [ ] Auditar duplicidades atuais de `EscalaDia` por escala e evento.
- [ ] Confirmar comportamento de índice único com `eventoId` nulo no PostgreSQL alvo.
- [ ] Registrar regra de bloqueio para evento vinculado movido para outro mês.

Critério de saída:

- invariantes de dados e comportamento de mudança de mês estão comprovados antes da migration.

### Etapa 1 - Modelo e contratos compatíveis

Status: pendente

- [ ] Adicionar `EventoMinisterio.requerEscala` e índices.
- [ ] Adicionar unicidade de escala e evento após auditoria.
- [ ] Criar migration aditiva sem seed.
- [ ] Atualizar documentação de modelos.
- [ ] Criar DTO de configuração ministerial.
- [ ] Preservar `ministerioIds` como contrato legado temporário.
- [ ] Atualizar respostas com `requerEscala`.
- [ ] Validar Prisma e gerar client.

Critério de saída:

- API aceita clientes atuais e passa a representar necessidade de escala por ministério.

### Etapa 2 - Configuração no evento

Status: pendente

- [ ] Permitir ministérios em evento geral.
- [ ] Persistir configuração por ministério no create e update.
- [ ] Preservar RBAC e visibilidade atuais.
- [ ] Atualizar modal da Agenda.
- [ ] Adicionar opção **Precisa de escala** por ministério.
- [ ] Atualizar hooks, tipos e traduções.
- [ ] Garantir que salvar evento não crie escala.

Critério de saída:

- evento declara corretamente quais ministérios podem encontrá-lo na criação da escala.

### Etapa 3 - Elegibilidade e criação transacional

Status: pendente

- [ ] Criar endpoint de eventos elegíveis.
- [ ] Aplicar tenant, RBAC, período, status, ministério e `requerEscala`.
- [ ] Evoluir `CreateEscalaDto` com modo e eventos.
- [ ] Refatorar criação para transação.
- [ ] Criar snapshots de data e título.
- [ ] Impedir duplicidades.
- [ ] Cobrir rollback quando qualquer evento for inválido.

Critério de saída:

- API cria escala baseada em eventos de forma atômica e isolada por tenant.

### Etapa 4 - Experiência de criação da escala

Status: pendente

- [ ] Adicionar seletor dos três modos de criação.
- [ ] Preservar o fluxo atual de dias da semana.
- [ ] Implementar carregamento dos eventos elegíveis.
- [ ] Implementar seleção múltipla e estados loading, erro e vazio.
- [ ] Limpar seleção ao mudar período ou ministério.
- [ ] Exibir resumo antes de criar.
- [ ] Atualizar traduções nos três idiomas.

Critério de saída:

- líder cria uma escala mensal selecionando somente eventos relevantes ao seu ministério.

### Etapa 5 - Exibição e manutenção do vínculo

Status: pendente

- [ ] Ampliar dados de evento retornados na escala.
- [ ] Mostrar título, horário, local, tipo e status.
- [ ] Sinalizar cancelamento.
- [ ] Criar DTO validado para adicionar dia.
- [ ] Permitir vincular, trocar e remover evento em escala aberta.
- [ ] Bloquear manutenção em escala encerrada.
- [ ] Sincronizar título e mudança de data no mesmo mês.
- [ ] Bloquear mudança de evento vinculado para outro mês.

Critério de saída:

- vínculo permanece compreensível e consistente durante o ciclo de vida do evento e da escala.

### Etapa 6 - Testes, documentação e rollout

Status: pendente

- [ ] Executar testes direcionados de eventos e escalas.
- [ ] Executar build da API.
- [ ] Executar lint e typecheck direcionados da web.
- [ ] Executar build de produção da web.
- [ ] Executar `git diff --check`.
- [ ] Validar migration local sem seed.
- [ ] Validar matriz manual de perfis.
- [ ] Validar dois tenants sem vazamento de eventos.
- [ ] Validar evento geral com múltiplos ministérios.
- [ ] Validar evento relacionado sem necessidade de escala.
- [ ] Validar criação vazia, por semana e por eventos.
- [ ] Validar cancelamento, remoção e mudança de data.
- [ ] Atualizar checklist com resultados reais.

Critério de saída:

- testes automatizados e roteiro manual comprovam isolamento, permissões e consistência do vínculo.

## Estratégia de testes

### Prisma e migration

- coluna `requires_schedule` criada com default `false`;
- dados existentes preservados;
- ausência de seed;
- índice de elegibilidade criado;
- índice único não quebra dias manuais com `eventoId = null`;
- migration falha de forma conhecida se houver duplicidade não tratada.

### API de eventos

- evento geral aceita ministérios e continua visível para todos;
- contrato legado cria relações com `requerEscala = false`;
- contrato novo persiste valores por ministério;
- update `undefined` preserva e array vazio remove;
- BASIC não configura ministério que não lidera;
- `requerEscala` não altera visibilidade;
- reunião interna mantém regras atuais;
- mudança de data no mesmo mês sincroniza dias;
- mudança para outro mês com vínculo retorna conflito;
- cancelamento mantém vínculo;
- remoção limpa `eventoId` e preserva snapshot.

### API de escalas

- elegibilidade respeita tenant, mês, ano, ministério e status;
- evento com `requerEscala = false` não aparece;
- evento invisível não aparece;
- BASIC comum não consulta candidatos;
- líder não consulta ministério alheio;
- modo semanal preserva comportamento atual;
- modo vazio cria escala sem dias;
- modo eventos exige seleção;
- evento inválido reverte escala e dias;
- mesmo evento não duplica na mesma escala;
- mesmo evento pode entrar em escalas de ministérios diferentes;
- snapshot usa data e título do evento.

### Web

- evento geral permite selecionar ministérios;
- toggle **Precisa de escala** aparece somente para ministério selecionado;
- formulário envia configuração correta;
- troca do modo limpa campos incompatíveis;
- candidatos recarregam ao mudar período ou ministério;
- estados loading, erro e vazio são acessíveis;
- criação por eventos envia IDs selecionados;
- grade diferencia dia manual e evento;
- status cancelado é visível;
- ações respeitam permissão e estado encerrado;
- traduções existem em `pt-BR`, `pt-PT` e `en-US`.

## Rollout

### Ordem recomendada

1. Auditar duplicidades atuais.
2. Aplicar migration em ambiente local.
3. Executar testes e build da API.
4. Publicar API compatível com contrato legado.
5. Publicar web com configuração ministerial.
6. Ativar experiência de criação baseada em eventos.
7. Validar tenant piloto antes de ampliar uso.

### Segurança do rollout

- Default `false` impede que eventos antigos apareçam inesperadamente.
- Contrato legado reduz risco de deploy desencontrado entre web e API.
- Não executar backfill automático.
- Não criar escalas automaticamente.
- Não apagar vínculos existentes ao alterar configuração ministerial.
- Registrar erros de elegibilidade e conflitos sem expor dados entre tenants.

## Riscos e mitigações

### Evento geral mudar de semântica operacional

Risco: ministérios relacionados serem interpretados como restrição de visibilidade.

Mitigação: manter regra explícita de visibilidade geral e cobrir com teste de regressão.

### Relação ministerial ser confundida com necessidade de escala

Risco: toda relação passar a gerar candidato.

Mitigação: filtrar sempre por `requerEscala = true` e iniciar registros existentes com `false`.

### Evento mover para outro mês

Risco: dia ficar fora do período da escala mensal.

Mitigação: bloquear mudança entre meses enquanto houver vínculo e orientar desvinculação explícita.

### Duplicidade de evento

Risco: evento aparecer duas vezes na mesma escala.

Mitigação: validação de serviço, transação e índice único após auditoria.

### Deploy parcial

Risco: web antiga enviar apenas `ministerioIds` para API nova.

Mitigação: manter contrato legado temporário e normalizar para `requerEscala = false`.

### Vazamento entre tenants ou ministérios

Risco: usuário selecionar evento fora do seu contexto.

Mitigação: nunca confiar nos IDs enviados; reconsultar todos os eventos com tenant, período, relação e permissão dentro da transação.

## Fora do escopo

- Criar escala pela Agenda.
- Criar escala automaticamente ao salvar evento.
- Obrigatoriedade de escala para todo evento.
- Associação direta entre `Escala` e `Evento`.
- Combinar dias da semana e eventos no mesmo submit inicial.
- Recorrência automática de eventos.
- Alterar regras de visibilidade de eventos.
- Alterar permissões de eventos ou escalas.
- Integração com Google Agenda.
- Novas tabelas de notificação.

## Critérios de aceite finais

- Evento configura necessidade de escala por ministério.
- Evento geral aceita ministérios e permanece visível para todos.
- Ministério relacionado com `requerEscala = false` não recebe o evento como candidato.
- Criação da escala lista somente eventos elegíveis do período e ministério.
- Usuário escolhe explicitamente os eventos.
- Escala e dias são persistidos em transação.
- Mesmo evento não duplica na mesma escala.
- Mesmo evento pode alimentar escalas de ministérios diferentes.
- Dia vinculado exibe dados atuais do evento e preserva snapshot.
- Evento cancelado não entra em nova escala e é sinalizado em vínculo existente.
- Evento removido não apaga o dia da escala.
- Mudança de evento para outro mês não deixa escala mensal inconsistente.
- `ADMIN`, `STAFF` e `BASIC` mantêm permissões atuais.
- Dois tenants não compartilham candidatos ou vínculos.
- Agenda nunca cria escala automática ou manualmente.
- Fluxos atuais de escala semanal e vazia continuam funcionando.
- Migration não executa seed.
- Testes e builds definidos no plano passam.

## Pendências antes da implementação

- Confirmar em banco local se já existem duplicidades de `EscalaDia` por `escalaId` e `eventoId`.
- Confirmar suporte do PostgreSQL alvo à unicidade proposta com valores nulos, conforme comportamento esperado.
- Definir prazo para remoção futura do campo legado `ministerioIds`.
- Selecionar tenant piloto para o roteiro manual.
