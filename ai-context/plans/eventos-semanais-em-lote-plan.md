# Plano - Criação Semanal de Eventos em Lote

Status geral: **concluído** — validação manual aprovada em 2026-07-21.

Criação: 2026-07-19

Branch de planejamento: `docs/event-batch-and-schedule-eligibility-plans`

Branch sugerida para implementação: `feature/eventos-semanais-em-lote`

Execução em 2026-07-20:

- branch criada a partir de `development` atualizada;
- baseline de Eventos aprovado com 10 testes;
- endpoint transacional, gerador semanal, prévia e integração web implementados;
- suíte completa da API aprovada com 89 testes;
- builds de API e web aprovados.

Validação manual em 2026-07-21:

- cenários 1 a 8 aprovados pelo usuário;
- cenários 9 (isolamento entre tenants) e 10 (rollback transacional) não testados manualmente por decisão do usuário.

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

- [x] Confirmar `development` atualizada e criar a branch de implementação.
- [x] Registrar baseline dos testes de Eventos.
- [x] Confirmar comportamento atual de criação individual para todos os perfis.
- [x] Fechar nomes e mensagens do contrato em lote.

Critério de saída:

- contrato e limites aprovados sem alterar o fluxo individual.

### Etapa 1 - DTO e validação compartilhada

- [x] Criar DTO do lote com `@ValidateNested` para ocorrências e ministérios.
- [x] Validar quantidade entre 1 e 200 ocorrências.
- [x] Validar datas ISO, ordem de início/fim e janela máxima de 366 dias.
- [x] Rejeitar `dataInicio` repetida no payload.
- [x] Extrair do create individual somente os helpers necessários para compartilhar RBAC e validação ministerial.
- [x] Preservar mensagens e regras atuais do endpoint individual.

Critério de saída:

- o serviço possui uma preparação comum segura sem regressão no create atual.

### Etapa 2 - Criação transacional em lote

- [x] Adicionar `POST /api/eventos/lote` antes da rota dinâmica `:id`.
- [x] Consultar conflitos existentes por tenant, título e datas enviadas.
- [x] Criar todos os eventos e `EventoMinisterio` em uma transação.
- [x] Retornar total e eventos criados em ordem cronológica.
- [x] Garantir auditoria com quantidade e IDs, sem payload excessivo.

Critério de saída:

- falha em qualquer ocorrência não deixa eventos parciais.

### Etapa 3 - Gerador semanal e prévia na web

- [x] Adicionar modo de criação sem afetar a edição.
- [x] Implementar período finito e seleção de dias/horários.
- [x] Gerar ocorrências no fuso operacional.
- [x] Ordenar a prévia cronologicamente.
- [x] Permitir remover e restaurar exceções ao recalcular o padrão.
- [x] Aplicar limite visual e mensagens antes do submit.
- [x] Garantir layout mobile e desktop.

Critério de saída:

- o usuário entende quantos eventos serão criados e quais datas serão enviadas.

### Etapa 4 - Integração e feedback

- [x] Adicionar `createEventosEmLote` em `use-eventos.ts`.
- [x] Enviar campos comuns e ocorrências da prévia.
- [x] Tratar conflitos com datas identificáveis no erro inline.
- [x] Recarregar a Agenda após sucesso.
- [x] Manter criação e edição individual funcionando.
- [x] Adicionar traduções nos três idiomas.

Critério de saída:

- lote e evento único coexistem no mesmo modal sem estado residual.

### Etapa 5 - Testes e documentação

- [x] Cobrir RBAC de `ADMIN`, `STAFF`, líder `BASIC` e `BASIC` comum.
- [x] Cobrir evento geral bloqueado para `BASIC`.
- [x] Cobrir lote com vários dias e horários.
- [x] Cobrir ministérios e `requerEscala` copiados para todas as ocorrências.
- [x] Cobrir duplicidade interna e conflito com evento existente.
- [x] Cobrir rollback transacional.
- [x] Cobrir limite de período e quantidade.
- [x] Validar horário no fuso `America/Sao_Paulo`.
- [x] Executar testes, builds e `git diff --check`.
- [x] Atualizar regras de negócio e checklist com resultados reais.

Critério de saída:

- testes automatizados e roteiro manual comprovam consistência, atomicidade e preservação das permissões.

## Estratégia de testes manuais

1. ✅ Criar evento único e confirmar comportamento inalterado.
2. ✅ Criar lote com domingo, terça e sexta em horários diferentes.
3. ✅ Conferir contador e todas as datas da prévia.
4. ✅ Remover uma ocorrência e confirmar que ela não foi criada.
5. ✅ Criar lote com ministérios que precisam e não precisam de escala.
6. ✅ Confirmar que somente os eventos elegíveis aparecem nas escalas.
7. ✅ Tentar repetir um lote já criado e conferir o bloqueio de duplicidade.
8. ✅ Validar o formulário em desktop e mobile.
9. ⏭️ Validar líder `BASIC` limitado aos próprios ministérios — não testado manualmente (coberto pelos testes automatizados).
10. ⏭️ Isolamento entre tenants e rollback transacional — não testados manualmente (cobertos pelos testes automatizados).

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

