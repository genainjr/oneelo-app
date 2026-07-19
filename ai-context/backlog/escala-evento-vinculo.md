# Backlog - Vínculo entre Escalas e Eventos

## FT-008 Criar escalas com base nos eventos da agenda

- **Status**: refinado - pronto para planejamento
- **Prioridade**: alta
- **Categoria**: UX / produto / consistência de dados

## Contexto

O produto precisa permitir que uma escala represente os compromissos reais cadastrados na Agenda, especialmente cultos e eventos que exigem atuação de um ou mais ministérios.

O modelo já possui `EscalaDia.eventoId`, mas o fluxo atual cria os dias da escala somente por dias da semana ou manualmente. Ainda não existe uma experiência para declarar, no evento, quais ministérios precisarão montar escala e depois selecionar esses eventos ao criar a escala mensal.

Nem todo evento precisa de escala. Por isso, cadastrar ou relacionar um evento não deve criar uma escala automaticamente.

## Decisões de produto fechadas

### 1. A escala será criada somente no módulo de Escalas

- A tela de Agenda não terá ação para criar escala.
- A Agenda apenas registra os ministérios envolvidos e quais deles precisam montar escala.
- O usuário continua responsável por iniciar a criação da escala no módulo `/escalas`.

### 2. O vínculo permanece em `EscalaDia -> Evento`

- Não será criada uma associação de alto nível entre `Escala` e `Evento`.
- Uma escala mensal pode conter dias vinculados a vários eventos.
- Um evento pode gerar dias de escala para vários ministérios.
- Cada `EscalaDia` vinculado representa o compromisso daquele ministério no evento.

### 3. Ministério envolvido e necessidade de escala são conceitos diferentes

A relação `EventoMinisterio` deve receber um indicador explícito:

```prisma
model EventoMinisterio {
  eventoId     String  @map("event_id")
  ministerioId String  @map("ministry_id")
  requerEscala Boolean @default(false) @map("requires_schedule")
}
```

Motivo:

- um ministério pode estar relacionado ao evento apenas para organização ou visibilidade;
- uma reunião interna pode envolver um ministério sem exigir escala;
- somente relações com `requerEscala = true` tornam o evento elegível na criação da escala daquele ministério.

### 4. Eventos gerais poderão ter ministérios relacionados

- Evento `GERAL` continua visível para todos os usuários autenticados.
- A regra atual que impede evento geral de possuir ministérios relacionados deverá ser removida.
- Os ministérios relacionados ao evento geral terão finalidade operacional e não restringirão sua visibilidade.

### 5. A seleção de eventos será opcional

Na criação da escala, o usuário escolherá como deseja gerar os dias:

1. **Por dias da semana**: mantém o comportamento atual.
2. **Com base nos eventos**: seleciona eventos elegíveis para o ministério, mês e ano escolhidos.
3. **Começar sem dias**: cria a escala mensal vazia para preenchimento posterior.

Os modos serão separados inicialmente para evitar duplicidade entre um dia recorrente e um evento na mesma data.

### 6. As permissões e regras de visibilidade de eventos serão preservadas

Esta feature não altera quem pode visualizar, criar, editar ou remover eventos:

- `ADMIN` e `STAFF` mantêm as permissões atuais de gestão de eventos do tenant.
- `BASIC` mantém as restrições atuais e só gerencia eventos dos ministérios em que é `LEADER` ou `ASSISTANT_LEADER`.
- Evento `GERAL` continua visível para todos os usuários autenticados, mesmo quando possuir ministérios relacionados.
- Evento `MINISTERIO` continua visível para todos os usuários autenticados; os ministérios relacionados permanecem como contexto operacional e filtro.
- Evento `REUNIAO_INTERNA` continua seguindo as regras atuais de visibilidade por perfil e liderança ministerial.
- Marcar `requerEscala` não concede visibilidade, liderança ou permissão de gestão sobre o evento ou o ministério.
- A lista de eventos elegíveis para uma escala deve aplicar primeiro a visibilidade e as permissões atuais do usuário e somente depois os filtros de período, ministério e `requerEscala`.
- As permissões para criar e editar escalas também permanecem inalteradas: o backend continua sendo a fonte de verdade para `ADMIN`, `STAFF` e líderes ou auxiliares autorizados.

## Fluxo proposto

### Criação ou edição do evento

1. Usuário informa os dados do evento.
2. Seleciona os ministérios envolvidos.
3. Para cada ministério selecionado, informa se ele **precisa de escala**.
4. Salva o evento sem criar qualquer escala automaticamente.

### Criação da escala

1. Usuário escolhe mês, ano e ministério.
2. Seleciona o modo **Com base nos eventos**.
3. O backend retorna somente eventos:
   - do mesmo tenant;
   - dentro do mês e ano escolhidos;
   - não cancelados;
   - relacionados ao ministério escolhido;
   - com `EventoMinisterio.requerEscala = true`;
   - visíveis e gerenciáveis pelo usuário conforme RBAC atual.
4. Usuário marca os eventos que deseja incluir.
5. A escala mensal é criada como `RASCUNHO`.
6. Cada evento selecionado cria um `EscalaDia` com:
   - `eventoId`;
   - data baseada em `Evento.dataInicio`;
   - título de fallback preservado para histórico;
   - ordem coerente com data e horário.

Mesmo quando `requerEscala = true`, o evento apenas fica disponível para seleção. Ele não será incluído automaticamente.

## Regras de negócio

- Validar evento, ministério, escala e usuário sempre dentro do mesmo tenant.
- Não ampliar permissões de evento ou escala por causa do vínculo ou de `requerEscala`.
- Não listar evento cancelado como opção para uma nova escala.
- Não permitir que o mesmo evento seja adicionado duas vezes à mesma escala ministerial.
- Permitir que o mesmo evento seja usado em escalas de ministérios diferentes.
- Ao alterar título, local ou horário do evento, refletir os dados atuais nas visualizações da escala.
- Ao alterar `Evento.dataInicio`, sincronizar `EscalaDia.data` para evitar filtros mensais inconsistentes.
- Ao cancelar o evento, manter o vínculo existente e sinalizar o cancelamento na escala.
- Ao remover o evento, preservar data e título de fallback do dia; `eventoId` pode continuar usando `onDelete: SetNull`.
- Remover um ministério ou desmarcar `requerEscala` não deve apagar silenciosamente dias de escala já criados.
- Escalas encerradas não podem receber, trocar ou remover vínculos de evento.

## Entregas incrementais

### Entrega 1 - Criação baseada em eventos

- Adicionar `requerEscala` em `EventoMinisterio`.
- Permitir ministérios em eventos gerais.
- Atualizar formulário de evento com a opção **Precisa de escala** por ministério.
- Adicionar modo **Com base nos eventos** ao modal de criação da escala.
- Criar escala e dias vinculados em transação.
- Exibir evento, horário e status na gestão da escala.

### Entrega 2 - Manutenção do vínculo

- Vincular, trocar ou remover evento em um dia de escala existente.
- Sincronizar mudança de data do evento.
- Sinalizar evento cancelado ou relação ministerial alterada.
- Preservar histórico quando o evento for removido.

### Entrega 3 - Uso operacional do contexto

- Usar horário do evento nas notificações relacionadas à escala.
- Evoluir impressão e visualização da escala com título, horário e local do evento.
- Preparar o vínculo para futuras integrações com calendários.

## Fora do escopo

- Criar escala automaticamente ao salvar evento.
- Criar escala pela tela de Agenda.
- Obrigatoriedade de escala para todo evento.
- Associação direta entre `Escala` e `Evento`.
- Recorrência automática de eventos.
- Integração com Google Agenda nesta entrega.

## Estado técnico atual

- `EscalaDia` já possui `eventoId` opcional.
- `Evento` já possui relação com `EscalaDia`.
- `EventoMinisterio` já relaciona eventos e ministérios, mas ainda não diferencia necessidade de escala.
- A API de eventos já filtra por período e ministério, mas o filtro atual precisará incluir corretamente eventos gerais relacionados.
- A API de escalas já retorna o título do evento vinculado em consultas de detalhe.
- `CreateEscalaDto` ainda aceita apenas mês, ano, ministério, observações e dias da semana.
- O endpoint de adicionar dia ainda aceita apenas data e título.

## Arquivos afetados previstos

- `apps/api/prisma/schema.prisma`
- `apps/api/src/modules/eventos/`
- `apps/api/src/modules/escalas/`
- `apps/web/src/app/(dashboard)/agenda/page.tsx`
- `apps/web/src/app/(dashboard)/escalas/page.tsx`
- `apps/web/src/components/app/escala-grid.tsx`
- `apps/web/src/hooks/use-eventos.ts`
- `apps/web/src/hooks/use-escalas.ts`
- `apps/web/src/types/index.ts`
- mensagens i18n da web

## Critérios de aceite

- Evento pode indicar, por ministério, se precisa de escala.
- Evento geral pode possuir ministérios relacionados sem perder visibilidade geral.
- Evento sem ministério marcado para escala não aparece como candidato.
- Criação da escala lista apenas eventos elegíveis para o ministério e período escolhidos.
- Usuário escolhe explicitamente quais eventos serão incluídos.
- Escala e dias são criados de forma atômica.
- Cada dia criado mantém vínculo com o evento correto.
- Um evento pode alimentar escalas de vários ministérios.
- Evento cancelado não entra em novas escalas e é sinalizado nas já existentes.
- Nenhuma escala é criada automaticamente pela Agenda.
- Permissões e visibilidade atuais de eventos e escalas são preservadas.
