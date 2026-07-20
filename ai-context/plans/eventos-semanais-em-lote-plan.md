# Plano - Criação Semanal de Eventos em Lote

Status geral: planejado

Criação: 2026-07-19

Branch de planejamento: `docs/event-batch-and-schedule-eligibility-plans`

Branch sugerida para implementação: `feature/eventos-semanais-em-lote`

Origem: melhoria de usabilidade identificada após a entrega do vínculo entre eventos e escalas.

## Objetivo

Permitir que o usuário cadastre, em uma única operação, eventos que se repetem semanalmente durante um período definido, como cultos aos domingos, terças e sextas-feiras.

A entrega será uma criação em lote de eventos independentes. Não será introduzido um conceito persistente de série recorrente.

## Resultado esperado

- A criação de evento oferece os modos **Evento único** e **Repetir semanalmente**.
- O usuário informa um período finito e seleciona um ou mais dias da semana.
- Cada dia selecionado pode ter seu próprio horário inicial e final.
- O sistema apresenta uma prévia de todas as datas antes da confirmação.
- Datas específicas podem ser removidas da prévia.
- Todas as ocorrências herdam título, descrição, local, tipo e configuração ministerial.
- A API cria todas as ocorrências em uma única transação.
- Cada ocorrência é persistida como um `Evento` independente e usa os fluxos atuais de edição, cancelamento, remoção, Agenda e escala.
- Nenhuma escala é criada automaticamente.

## Valor entregue ao cliente

O usuário deixa de cadastrar manualmente dezenas de eventos previsíveis ao longo do semestre ou do ano, mantendo a liberdade de alterar ou cancelar cada data individualmente depois da criação.

## Estado atual do código

### Já existe

- Formulário de criação e edição em `/agenda`.
- `POST /api/eventos` para criar um evento individual.
- DTO validado com título, descrição, período, local, tipo, status e ministérios.
- Configuração `requerEscala` por ministério.
- RBAC de eventos para `ADMIN`, `STAFF` e `BASIC` líder ou auxiliar.
- Conversão de `datetime-local` para ISO na web.
- Criação de `EventoMinisterio` junto com o evento.
- Testes unitários do serviço de Eventos.
- Atualização, cancelamento e remoção individual de eventos.

### Ainda não existe

- Modo semanal no formulário da Agenda.
- Configuração de período e dias/horários semanais.
- Prévia das ocorrências.
- Remoção de exceções antes da criação.
- Endpoint de criação em lote.
- Limite de período e quantidade de ocorrências.
- Detecção de datas duplicadas no lote e de conflitos com eventos já existentes.
- Transação que garanta criação integral do lote.

## Decisões fechadas

### 1. A entrega cria eventos independentes

- Não criar tabela de série ou recorrência.
- Não adicionar `serieId` em `Evento`.
- Não executar geração futura por cron ou job.
- Alterar, cancelar ou remover uma ocorrência afeta somente aquele evento.
- O formulário deve informar explicitamente essa característica antes da confirmação.

Texto sugerido:

> As datas serão criadas como eventos independentes. Alterações futuras serão feitas individualmente em cada evento.

### 2. O modo em lote existe somente na criação

- A edição de evento continua individual.
- O seletor de modo não aparece ao editar um evento existente.
- Não oferecer “editar todos”, “esta e as próximas” ou “toda a série”.

### 3. O padrão semanal tem período finito

- `dataInicial` é obrigatória.
- `dataFinal` é obrigatória e não pode ser anterior à inicial.
- O período máximo é de 366 dias.
- O lote pode conter no máximo 200 ocorrências.
- Não existe opção “sem data final”.

O limite de 200 cobre três eventos semanais durante um ano e protege API, auditoria e experiência de prévia.

### 4. Cada dia possui horário próprio

Exemplo:

```text
Domingo  19:00 às 21:00
Terça    20:00 às 21:30
Sexta    19:30 às 21:00
```

Regras:

- não repetir o mesmo dia da semana;
- hora inicial é obrigatória;
- hora final é opcional;
- quando informada, a hora final deve ser posterior à inicial;
- eventos que atravessam a meia-noite permanecem fora do primeiro incremento;
- datas são construídas no fuso operacional `America/Sao_Paulo` e enviadas em ISO.

### 5. A prévia define as ocorrências enviadas

- A web gera a lista a partir do período, dias e horários.
- A prévia é recalculada quando uma configuração muda.
- O usuário pode retirar datas específicas sem alterar o padrão semanal.
- O submit envia somente as ocorrências mantidas na prévia.
- A API revalida todo o conteúdo e não confia na geração do frontend.

### 6. O lote é atômico

- Ou todas as ocorrências são criadas, ou nenhuma é criada.
- Validar permissões, ministérios e duplicidades antes da primeira escrita.
- Usar transação Prisma para criar eventos e relações ministeriais.
- Uma falha em qualquer ocorrência deve reverter o lote inteiro.

### 7. Duplicidades são bloqueadas antes da escrita

Considerar duplicidade de lote quando houver:

- duas ocorrências com o mesmo `dataInicio` no próprio payload;
- evento existente no tenant com o mesmo título normalizado e o mesmo `dataInicio`.

A resposta deve listar as datas conflitantes para que o usuário ajuste o período ou retire as ocorrências da prévia.

Eventos com títulos diferentes no mesmo horário continuam permitidos.

### 8. Permissões atuais são preservadas

- O endpoint em lote aceita os mesmos perfis do endpoint individual.
- `ADMIN` e `STAFF` mantêm a gestão global do tenant.
- `BASIC` não cria evento `GERAL`.
- `BASIC` usa somente ministérios onde é `LEADER` ou `ASSISTANT_LEADER`.
- A configuração `requerEscala` segue as mesmas validações atuais.
- O backend permanece como fonte de verdade.

### 9. O lote não cria escalas

- Cada evento criado poderá aparecer como candidato no módulo de Escalas quando possuir `requerEscala = true`.
- A seleção e criação da escala continuam explícitas no módulo `/escalas`.

## Contrato proposto

### Endpoint

```http
POST /api/eventos/lote
```

### Payload

```ts
type CreateEventosEmLoteInput = {
  titulo: string;
  descricao?: string;
  local?: string;
  tipo?: EventoTipo;
  status?: StatusEvento;
  ministerios?: Array<{
    ministerioId: string;
    requerEscala: boolean;
  }>;
  ocorrencias: Array<{
    dataInicio: string;
    dataFim?: string;
  }>;
};
```

### Resposta

```ts
type CreateEventosEmLoteResponse = {
  total: number;
  eventos: Evento[];
};
```

### Compatibilidade

- `POST /api/eventos` permanece inalterado.
- Contratos de update e remoção permanecem individuais.
- Não há migration nem alteração no modelo Prisma.

## Experiência da web

### Seleção do modo

No topo do formulário de criação:

```text
[ Evento único ] [ Repetir semanalmente ]
```

O modo inicial continua sendo **Evento único**.

### Campos do modo semanal

- data inicial;
- data final;
- seleção dos dias da semana;
- hora inicial e final por dia selecionado;
- contador de ocorrências;
- prévia cronológica com ação de remover uma data;
- estado vazio quando nenhuma data for gerada;
- aviso sobre eventos independentes.

Os campos comuns de título, descrição, local, tipo e ministérios são compartilhados entre os dois modos.

### Comportamentos de usabilidade

- Não perder os campos comuns ao alternar o modo.
- Limpar apenas configurações semanais ao voltar para evento único.
- Mostrar erro inline no modal.
- Desabilitar o botão enquanto o lote estiver sendo salvo.
- Após sucesso, fechar o modal, atualizar a Agenda e informar quantos eventos foram criados.
- Em mobile, apresentar cada dia/horário em uma linha vertical e a prévia em área rolável.

## Arquivos impactados

### API

- `apps/api/src/modules/eventos/eventos.controller.ts`
- `apps/api/src/modules/eventos/eventos.service.ts`
- `apps/api/src/modules/eventos/eventos.service.spec.ts`
- `apps/api/src/modules/eventos/dto/create-eventos-em-lote.dto.ts` — novo
- `apps/api/src/modules/eventos/dto/evento-ocorrencia-input.dto.ts` — novo, se a separação melhorar a validação
- `apps/api/src/common/interceptors/audit.interceptor.ts` — revisar classificação e payload do novo endpoint

### Web

- `apps/web/src/app/(dashboard)/agenda/page.tsx`
- `apps/web/src/hooks/use-eventos.ts`
- `apps/web/src/types/index.ts`
- `apps/web/messages/pt-BR.json`
- `apps/web/messages/pt-PT.json`
- `apps/web/messages/en-US.json`

### Documentação

- `ai-context/business-rules/validation-rules.md`
- este plano

## Etapas de implementação

### Etapa 0 - Baseline e contratos

- [ ] Confirmar `development` atualizada e criar a branch de implementação.
- [ ] Registrar baseline dos testes de Eventos.
- [ ] Confirmar comportamento atual de criação individual para todos os perfis.
- [ ] Fechar nomes e mensagens do contrato em lote.

Critério de saída:

- contrato e limites aprovados sem alterar o fluxo individual.

### Etapa 1 - DTO e validação compartilhada

- [ ] Criar DTO do lote com `@ValidateNested` para ocorrências e ministérios.
- [ ] Validar quantidade entre 1 e 200 ocorrências.
- [ ] Validar datas ISO, ordem de início/fim e janela máxima de 366 dias.
- [ ] Rejeitar `dataInicio` repetida no payload.
- [ ] Extrair do create individual somente os helpers necessários para compartilhar RBAC e validação ministerial.
- [ ] Preservar mensagens e regras atuais do endpoint individual.

Critério de saída:

- o serviço possui uma preparação comum segura sem regressão no create atual.

### Etapa 2 - Criação transacional em lote

- [ ] Adicionar `POST /api/eventos/lote` antes da rota dinâmica `:id`.
- [ ] Consultar conflitos existentes por tenant, título e datas enviadas.
- [ ] Criar todos os eventos e `EventoMinisterio` em uma transação.
- [ ] Retornar total e eventos criados em ordem cronológica.
- [ ] Garantir auditoria com quantidade e IDs, sem payload excessivo.

Critério de saída:

- falha em qualquer ocorrência não deixa eventos parciais.

### Etapa 3 - Gerador semanal e prévia na web

- [ ] Adicionar modo de criação sem afetar a edição.
- [ ] Implementar período finito e seleção de dias/horários.
- [ ] Gerar ocorrências no fuso operacional.
- [ ] Ordenar a prévia cronologicamente.
- [ ] Permitir remover e restaurar exceções ao recalcular o padrão.
- [ ] Aplicar limite visual e mensagens antes do submit.
- [ ] Garantir layout mobile e desktop.

Critério de saída:

- o usuário entende quantos eventos serão criados e quais datas serão enviadas.

### Etapa 4 - Integração e feedback

- [ ] Adicionar `createEventosEmLote` em `use-eventos.ts`.
- [ ] Enviar campos comuns e ocorrências da prévia.
- [ ] Tratar conflitos com datas identificáveis no erro inline.
- [ ] Recarregar a Agenda após sucesso.
- [ ] Manter criação e edição individual funcionando.
- [ ] Adicionar traduções nos três idiomas.

Critério de saída:

- lote e evento único coexistem no mesmo modal sem estado residual.

### Etapa 5 - Testes e documentação

- [ ] Cobrir RBAC de `ADMIN`, `STAFF`, líder `BASIC` e `BASIC` comum.
- [ ] Cobrir evento geral bloqueado para `BASIC`.
- [ ] Cobrir lote com vários dias e horários.
- [ ] Cobrir ministérios e `requerEscala` copiados para todas as ocorrências.
- [ ] Cobrir duplicidade interna e conflito com evento existente.
- [ ] Cobrir rollback transacional.
- [ ] Cobrir limite de período e quantidade.
- [ ] Validar horário no fuso `America/Sao_Paulo`.
- [ ] Executar testes, builds e `git diff --check`.
- [ ] Atualizar regras de negócio e checklist com resultados reais.

Critério de saída:

- testes automatizados e roteiro manual comprovam consistência, atomicidade e preservação das permissões.

## Estratégia de testes manuais

1. Criar evento único e confirmar comportamento inalterado.
2. Criar lote com domingo, terça e sexta em horários diferentes.
3. Conferir contador e todas as datas da prévia.
4. Remover uma ocorrência e confirmar que ela não foi criada.
5. Criar lote com ministérios que precisam e não precisam de escala.
6. Confirmar que somente os eventos elegíveis aparecem nas escalas.
7. Tentar repetir um lote já criado e conferir o bloqueio de duplicidade.
8. Forçar falha em uma ocorrência e confirmar ausência de criação parcial.
9. Validar o formulário em desktop e mobile.
10. Validar líder `BASIC` limitado aos próprios ministérios e isolamento entre tenants.

## Ordem de deploy

1. Publicar API com endpoint em lote.
2. Validar endpoint sem alterar o consumidor atual.
3. Publicar web com o modo semanal.
4. Executar lote piloto com período curto.
5. Ampliar para períodos maiores após validação.

## Rollback

- O rollback da web remove somente o modo semanal.
- O endpoint individual continua disponível durante todo o rollout.
- O rollback da API remove o endpoint em lote sem alteração de schema.
- Eventos já criados permanecem eventos normais e não dependem da funcionalidade para continuar operando.

## Riscos e mitigações

### Datas deslocadas por fuso

Mitigação: gerar datas civis no fuso operacional, converter para ISO uma única vez e cobrir horários próximos da meia-noite.

### Lote parcial

Mitigação: validar antes da escrita e usar uma única transação.

### Criação acidental de centenas de eventos

Mitigação: período máximo, limite de ocorrências, contador e prévia obrigatória.

### Duplicidade após duplo clique ou reenvio

Mitigação: botão bloqueado durante o submit e verificação de título/data no backend.

### Usuário interpretar o lote como série vinculada

Mitigação: texto explícito antes do submit e ausência de ações de edição coletiva.

## Fora do escopo

- Série recorrente persistida.
- Recorrência infinita.
- Regra mensal ou anual.
- Edição coletiva depois da criação.
- Exceções automáticas por feriado.
- Eventos que atravessam a meia-noite.
- Job de geração futura.
- Criação automática de escalas.
- Alteração das permissões atuais de eventos.

## Critérios de aceite finais

- Usuário alterna entre evento único e repetição semanal durante a criação.
- Período, dias e horários geram uma prévia correta e ordenada.
- Usuário remove datas específicas antes de salvar.
- Cada ocorrência é um evento independente.
- Campos comuns e configurações ministeriais são copiados corretamente.
- Lote é criado integralmente em transação.
- Duplicidades e limites são validados no backend.
- RBAC e isolamento entre tenants permanecem intactos.
- Eventos com `requerEscala = true` aparecem normalmente como candidatos.
- Criação e edição individual não sofrem regressão.
- Não há migration nem criação automática de escala.

