# Plano - Contas Recorrentes e Parceladas no Módulo Financeiro (Geração em Lote)

Status geral: concluido  
Data de criação: 2026-11-17  
Branch sugerida para implementação: feature/financeiro-contas-recorrentes-em-lote  

## Planos e Referências Relacionados

- [Template Oficial de Planos](PLAN_TEMPLATE.md)
- [Backlog Financeiro e Patrimonial](../backlog/financeiro-patrimonial.md)
- [Decisões Arquiteturais](../architecture/decisions.md)
- [Decisões de RBAC e Autorização](../architecture/rbac-decisions.md)
- [Padrão de Formulários ODS](../../ai-core/skills/oneelo-design-system/FORM_STANDARD.md)
- [Padrão de CRUD e Modais ODS](../../ai-core/skills/oneelo-design-system/CRUD_STANDARD.md)
- [Referência de Lote: Eventos / Agenda](../../apps/web/src/app/(dashboard)/agenda/page.tsx)
- [DTO de Criação em Lote de Eventos](../../apps/api/src/modules/eventos/dto/create-eventos-em-lote.dto.ts)

---

## 1. Objetivo da Entrega

Permitir que usuários com permissão financeira lancem contas recorrentes (valor fixo repetido) e parceladas (valor total dividido em N parcelas) — tanto despesas quanto receitas — gerando todas as ocorrências de uma só vez em lote, sem rotinas de cron/scheduler em background.

A experiência segue o padrão já consolidado na Agenda de Eventos e no ODS:
- Escolha explícita entre **recorrência fixa** (repete o valor em cada período) ou **parcelamento** (divide o valor total entre as parcelas com ajuste de centavos na última);
- Configuração de periodicidade (`Semanal`, `Quinzenal`, `Mensal` ou `Anual`) por número de ocorrências (até 120) ou data limite, com ajuste automático de fim de mês para vencimentos nos dias 29, 30 e 31;
- Visualização de **preview editável das parcelas/contas** antes de salvar, permitindo remover ocorrências específicas;
- Persistência atômica no banco via `prisma.$transaction`, com `recurringGroupId` gerado exclusivamente no servidor;
- Separação entre **saldo realizado (`CONFIRMED`)** e **compromissos futuros/pendentes (`PENDING`)**, com ação rápida de **Dar Baixa / Confirmar Pagamento**.

---

## 2. Contexto e Diagnóstico

1. **Lançamentos pontuais únicos (`apps/api/src/modules/financeiro/dto/create-financial-transaction.dto.ts`):**
   - O módulo financeiro hoje aceita apenas uma transação por requisição (`POST /api/financeiro/transactions`).
2. **Enum `FinancialTransactionStatus` sem estado de conta pendente (`apps/api/prisma/schema.prisma`):**
   - O enum possui apenas `DRAFT`, `CONFIRMED` e `CANCELLED`. Contas futuras a pagar/receber precisam de `PENDING` para representar compromissos sem inflar o saldo líquido real conciliado.
3. **Limite `take: 200` e filtragem apenas no cliente (`financial-transactions.service.ts` e `financeiro-shared.tsx`):**
   - Hoje `FinancialTransactionsService.findAll` ordena por `{ date: 'desc', createdAt: 'desc' }` com `take: 200`, e `useFinanceiroData` chama `GET /api/financeiro/transactions` sem parâmetros de período ou status.
   - **Risco crítico diagnosticado:** ao gerar um lote de 60 ou 120 parcelas futuras (ex.: 2027–2036), as datas futuras ocuparão os primeiros lugares do `take: 200` e empurrarão os lançamentos atuais/passados para fora do retorno da API.
4. **Resumo, modais e páginas secundárias hardcoded:**
   - `FinancialTransactionsService.getSummary` agrega apenas `CONFIRMED` e não expõe totais pendentes.
   - `TransactionModal` e `TransactionStatusModal` em `financeiro-modals.tsx` têm opções de status fixas sem `PENDING`.
   - As páginas `visualizacao/page.tsx` e `exportacao/page.tsx` consomem `useFinanceiroData` e `TRANSACTION_STATUS_LABELS` e precisam contemplar `PENDING`, indicador de parcela e liquidação (`paidAt`).
5. **Segregação RBAC atual (`financial-transactions.service.ts` e `financeiro/page.tsx`):**
   - `WRITE_ROLES` (`FINANCE_OPERATOR`, `FINANCE_APPROVER`, `FINANCE_MANAGER`) permite criar/editar lançamentos, enquanto `CANCEL_ROLES` (`FINANCE_APPROVER`, `FINANCE_MANAGER`) controla cancelamento e mudança de status na UI (`Mudar status`). O novo fluxo de lote e confirmação de baixa precisa respeitar essa governança de forma explícita.

---

## 3. Decisões de Arquitetura, Riscos e Engenharia

### 3.1. Modelo de Dados (Prisma) e Semântica de Datas
- **Status `PENDING`:** Adicionar `PENDING` ao enum `FinancialTransactionStatus` em `apps/api/prisma/schema.prisma`.
- **Campos adicionados ao model `FinancialTransaction`:**
  - `paidAt`: `DateTime? @map("paid_at")` (data efetiva de pagamento/recebimento preenchida na liquidação).
  - `recurringGroupId`: `String? @map("recurring_group_id")` (UUID gerado no backend agrupando a série).
  - `installmentNumber`: `Int? @map("installment_number")` (número da parcela, ex.: `1`).
  - `totalInstallments`: `Int? @map("total_installments")` (total previsto na série, ex.: `12`).
- **Índices:**
  - `@@index([tenantId, recurringGroupId])`
  - `@@index([tenantId, status, date])`
- **Política de `date`, `paidAt` e backfill:**
  - `date` permanece sendo a data do lançamento/vencimento; quando uma transação nasce `CONFIRMED` no fluxo pontual, `paidAt` recebe a própria data do lançamento (`date`) por padrão; quando nasce `PENDING` ou `DRAFT`, `paidAt` fica `null` até a baixa via confirmação.
  - Na migration SQL, executar backfill seguro para registros já `CONFIRMED` (`UPDATE tb_financial_transaction SET paid_at = date WHERE status = 'CONFIRMED' AND paid_at IS NULL`).
  - Para consistência imediata com o filtro por período da listagem e da impressão, `getSummary` continua filtrando pelo campo `date` no intervalo consultado (mantendo o saldo realizado estritamente sobre `CONFIRMED` e expondo previsões separadas sobre `PENDING`).

### 3.2. RBAC, Contrato de API e Segurança Multitenant (Backend)
- **Matriz de permissões (`FinanceRole`):**
  - `POST /api/financeiro/transactions/batch`: acessível por `WRITE_ROLES` (`FINANCE_OPERATOR`, `FINANCE_APPROVER`, `FINANCE_MANAGER`). Por governança, ocorrências criadas por `FINANCE_OPERATOR` aceitam apenas status `PENDING` ou `DRAFT`; status inicial `CONFIRMED` (ex.: 1ª parcela já paga no ato) só é permitido quando o ator possui `FINANCE_APPROVER` ou `FINANCE_MANAGER` (retornando `403 Forbidden` caso contrário).
  - `PATCH /api/financeiro/transactions/:id/confirm` (dar baixa): restrito a `APPROVE_ROLES` (`FINANCE_APPROVER`, `FINANCE_MANAGER`), alinhado ao padrão atual da UI onde alteração de status exige aprovação.
  - Todas as consultas e mutações filtram estritamente por `tenantId` do JWT.
- **Endpoint de lote (`POST /api/financeiro/transactions/batch`):**
  - DTO principal (`CreateFinancialTransactionsBatchDto`):
    - Dados comuns: `type`, `accountId`, `categoryId`, `paymentMethod?`, `counterpartyName?`, `memberId?`, `eventoId?`, `description?`, `defaultStatus?` (`PENDING` como padrão).
    - Lista `occurrences` (`FinancialTransactionOccurrenceDto[]`, `@ArrayMinSize(1)`, `@ArrayMaxSize(120)`): `{ date: string; amount: number; description?: string; status?: FinancialTransactionStatus; installmentNumber?: number; totalInstallments?: number }`.
  - **Regras no service (`createBatch`):**
    - Gerar `recurringGroupId = randomUUID()` no servidor (nunca aceitar do cliente).
    - Validar `account`, `category`, `evento` e `member` (incluindo a regra de `memberId` exclusivo para `INCOME`) **uma única vez antes do loop**, evitando queries repetidas dentro da transação.
    - Persistir todas as ocorrências atomicamente dentro de `prisma.$transaction`.
    - Registrar auditoria consolidada do lote em `AuditLog` (`acao: AcaoAuditoria.CRIAR`, `entidade: 'financial_transactions'`, `recurringGroupId`, quantidade de itens e valor total).
- **Endpoint de baixa/confirmação (`PATCH /api/financeiro/transactions/:id/confirm`):**
  - DTO (`ConfirmFinancialTransactionDto`): `paidAt?: string`, `paymentMethod?: FinancialPaymentMethod`, `amount?: number` (opcional para juros/desconto na baixa).
  - Aceita apenas transição a partir de `PENDING` ou `DRAFT` → `CONFIRMED`; lança `400 BadRequestException` se já estiver `CONFIRMED` ou `CANCELLED`.
  - Atualiza `status: CONFIRMED`, `paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date()`, `paymentMethod` e `amount` (se enviados), e grava `AuditLog` com `payloadBefore` e `payloadAfter`.
- **Evolução de `findAll` e `getSummary`:**
  - `findAll`: aceitar parâmetros de busca/filtro (`startDate`, `endDate`, `status`, `type`, `accountId`, `categoryId`, `eventoId`, `memberId`, `recurringGroupId`, `limit` limitado com teto seguro, ex. 500) e ordenar de forma previsível sem ocultar registros atuais quando existirem parcelas futuras.
  - `getSummary`: retornar `initialBalance`, `income`, `expense`, `balance`, `transactions` (estritamente `CONFIRMED`) **mais** `pendingIncome`, `pendingExpense` e `pendingCount` (estritamente `PENDING`).
- **Escopo explícito de edição/cancelamento em série:** nesta entrega, edição, baixa e cancelamento continuam individuais por lançamento; ações em massa por `recurringGroupId` (ex.: cancelar todas as futuras pendentes da série) ficam documentadas como evolução futura.

### 3.3. Experiência de Usuário (Frontend ODS)
- **Modal de Transação (`apps/web/src/app/(dashboard)/financeiro/financeiro-modals.tsx`):**
  - Modo em aba/toggle no modal de criação (`Lançamento único` × `Recorrente / Parcelado`), ajustando `ModalShell` para `size="lg"` quando em modo lote para comportar o preview confortavelmente.
  - **Valor fixo vs Parcelado:** seletor claro entre `"Repetir valor por parcela"` e `"Dividir valor total entre parcelas"` (aplicando arredondamento de centavos na última parcela para que a soma feche exatamente no valor total).
  - **Cálculo de datas com clamping:** periodicidade `Semanal`, `Quinzenal`, `Mensal` ou `Anual`, com proteção para dias 29/30/31 (ex.: dia 31 em fevereiro ajusta para 28/29 e retorna a 31 em março), serializando no padrão `YYYY-MM-DDT12:00:00` para evitar deslocamento de fuso UTC.
  - **Comprovante em lote:** ocultar a caixa de upload de comprovante durante a criação em lote (anexos seguem disponíveis na edição ou baixa individual de cada parcela).
  - **Preview interativo:** lista de parcelas geradas (`Data`, `Parcela X/Y`, `Valor`) com remoção individual antes da confirmação e exibição de erro inline via `ModalError`.
  - Atualizar o `<select>` de status do `TransactionModal` (quando editando) e o `TransactionStatusModal` para contemplar `PENDING`.
- **Páginas e tipos compartilhados (`financeiro-shared.tsx`, `page.tsx`, `visualizacao/page.tsx`, `exportacao/page.tsx`):**
  - Adicionar `PENDING` (`"Pendente"`) em `FinancialTransactionStatus`, `TRANSACTION_STATUS_LABELS` e `getTransactionStatusClass` (badge âmbar/azul semântico consistente com o tema).
  - Atualizar `useFinanceiroData` para suportar parâmetros de filtro na API (evitando corte por `take: 200` do backend quando houver parcelas futuras).
  - Em `financeiro/page.tsx`: exibir indicador de parcela (`Parcela X/Y`), cards/indicadores de contas pendentes (`A Receber` / `A Pagar`), filtro de status incluindo `PENDING` e botão rápido **"Dar Baixa"** em itens `PENDING` (para `FINANCE_APPROVER`/`FINANCE_MANAGER`) com confirmação de data/pagamento.
  - Em `visualizacao/page.tsx`: exibir badge `PENDING`, indicador de parcela e atualização da tabela de impressão PDF.
  - Em `exportacao/page.tsx`: incluir `PENDING`, coluna de parcela (`installmentNumber/totalInstallments`) e data de liquidação (`paidAt`) no CSV.

### 3.4. Matriz de Riscos e Mitigações
| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Lote de até 120 parcelas futuras ocultar lançamentos atuais no `take: 200` | Alta | Alto | Passar filtros de período/status para `GET /api/financeiro/transactions` no `useFinanceiroData` e ampliar limite com query indexada `(tenantId, status, date)`. |
| `FINANCE_OPERATOR` criar lote já `CONFIRMED` sem aprovação | Média | Alto | Restringir status inicial `CONFIRMED` no lote e `PATCH /confirm` a `FINANCE_APPROVER`/`FINANCE_MANAGER`; `OPERATOR` cria em `PENDING`/`DRAFT`. |
| Erro de data em dias 29/30/31 ou fuso horário UTC | Alta | Médio | Gerador de recorrência com *clamping* ao último dia do mês e serialização em `T12:00:00` alinhada ao padrão atual. |
| Diferença de centavos ao parcelar valor total | Média | Médio | Distribuir resíduo de arredondamento exclusivamente na última parcela para soma exata. |
| Tela de visualização ou exportação quebrar com novo status `PENDING` | Média | Médio | Atualizar `financeiro-shared.tsx`, `visualizacao/page.tsx`, `exportacao/page.tsx` e `TransactionStatusModal` na mesma entrega. |

---

## 4. Etapas de Desenvolvimento

> **Regra de Execução:** O desenvolvimento deve avançar estritamente etapa por etapa. Ao concluir uma tarefa ou etapa, atualize imediatamente seu checkbox para `[x]`, apresente o resumo das validações e **aguarde a autorização explícita do usuário antes de iniciar a etapa seguinte**.

### Etapa 0 - Preparação, Branch e Baseline
Status: concluido

- [x] Confirmar repositório limpo na branch `development` e atualizar com `git pull`
- [x] Criar a branch `feature/financeiro-contas-recorrentes-em-lote` a partir de `development`
- [x] Registrar baseline do módulo financeiro:
  - [x] Executar `npx jest src/modules/financeiro` em `apps/api` (ou validar suítes existentes + build)
  - [x] Executar `npx -w apps/web tsc --noEmit`
- [x] Critério de validação da etapa: Branch `feature/financeiro-contas-recorrentes-em-lote` ativa sobre `development` atualizada (`d8e5bbe`) e baseline registrado (`jest src/modules/financeiro --passWithNoTests`: sem arquivos `.spec.ts` no módulo, exit 0; `nest build`: exit 0; `tsc --noEmit` em `apps/web`: exit 0).

### Etapa 1 - Modelagem de Banco de Dados e Migração Prisma
Status: concluido

- [x] Atualizar `apps/api/prisma/schema.prisma`:
  - [x] Adicionar status `PENDING` ao enum `FinancialTransactionStatus`
  - [x] Adicionar campos `paidAt`, `recurringGroupId`, `installmentNumber` e `totalInstallments` no model `FinancialTransaction`
  - [x] Adicionar índices `@@index([tenantId, recurringGroupId])` e `@@index([tenantId, status, date])`
- [x] Criar e aplicar migration Prisma em `apps/api` (`20261117185500_add_recurring_and_pending_financial_transactions`) incluindo backfill SQL de `paid_at = date` para registros já `CONFIRMED`
- [x] Atualizar Prisma Client gerado (`npx prisma generate` / v5.22.0)
- [x] Critério de validação da etapa: Migration aplicada localmente (`migrate deploy` + `migrate status` OK), Prisma Client atualizado e `npm.cmd run build -w apps/api` compilando sem erros (`BUILD_EXIT=0`).

### Etapa 2 - DTOs e Endpoint de Criação em Lote (Backend)
Status: concluido

- [x] Criar DTO `apps/api/src/modules/financeiro/dto/financial-transaction-occurrence.dto.ts` com validações `class-validator` (`date`, `amount`, `description`, `status`, `installmentNumber`, `totalInstallments`)
- [x] Criar DTO `apps/api/src/modules/financeiro/dto/create-financial-transactions-batch.dto.ts` com limite máximo de 120 ocorrências e campos comuns
- [x] Criar DTO `apps/api/src/modules/financeiro/dto/confirm-financial-transaction.dto.ts` (`paidAt`, `paymentMethod`, `amount`)
- [x] Atualizar `apps/api/src/modules/financeiro/financial-transactions.service.ts`:
  - [x] Implementar `createBatch` com geração server-side de `recurringGroupId`, validação única pré-loop de conta/categoria/evento/membro, restrição RBAC de status `CONFIRMED` para `APPROVER`/`MANAGER`, inserção via `prisma.$transaction` e auditoria em `AuditLog`
  - [x] Garantir preenchimento automático de `paidAt` quando lançamento avulso for criado como `CONFIRMED`
- [x] Adicionar endpoint `POST /transactions/batch` em `apps/api/src/modules/financeiro/financeiro.controller.ts`
- [x] Criar/atualizar testes unitários em `apps/api/src/modules/financeiro/financial-transactions.service.spec.ts` cobrindo lote válido, limite 120, `memberId` bloqueado em `EXPENSE`, isolamento `tenantId` e RBAC de status inicial
- [x] Critério de validação da etapa: Testes unitários do lote passando (`jest src/modules/financeiro`: 6 passed / 6 total, exit 0) e `npm.cmd run build -w apps/api` verde (`BUILD_EXIT=0`).

### Etapa 3 - Suporte a `PENDING`, Ação de Baixa e Filtros de Listagem (Backend)
Status: concluido

- [x] Atualizar `apps/api/src/modules/financeiro/financial-transactions.service.ts`:
  - [x] Evoluir `findAll` para aceitar filtros completos (incluindo `eventoId`, `memberId`, `recurringGroupId`, limites seguros de período ISO/`YYYY-MM-DD` e teto parametrizado até `500`) e evitar ocultação de lançamentos recentes quando houver parcelas futuras
  - [x] Atualizar `getSummary` mantendo `balance`/`income`/`expense` estritamente sobre `CONFIRMED` e adicionando `pendingIncome`, `pendingExpense` e `pendingCount` sobre `PENDING`
  - [x] Implementar método `confirm` validando `APPROVE_ROLES` (`FINANCE_APPROVER`, `FINANCE_MANAGER`), transição válida (`PENDING`/`DRAFT` → `CONFIRMED`), gravação de `paidAt` e registro em `AuditLog`
- [x] Adicionar endpoint `PATCH /transactions/:id/confirm` em `apps/api/src/modules/financeiro/financeiro.controller.ts` (e suporte aos query params `eventoId`, `memberId`, `recurringGroupId`, `limit` em `GET /transactions`)
- [x] Expandir `apps/api/src/modules/financeiro/financial-transactions.service.spec.ts` cobrindo baixa de conta `PENDING`, rejeição de baixa em `CANCELLED`/`CONFIRMED`, RBAC de `OPERATOR` vs `APPROVER`, filtros completos e cálculo do resumo com pendentes
- [x] Critério de validação da etapa: Todos os testes do módulo financeiro passando em `apps/api` (`jest src/modules/financeiro`: 10 passed / 10 total, exit 0) e `npm.cmd run build -w apps/api` sem erros (`BUILD_EXIT=0`).

### Etapa 4 - Preview de Recorrência e Parcelamento no Modal (Frontend ODS)
Status: concluido

- [x] Atualizar `apps/web/src/app/(dashboard)/financeiro/financeiro-shared.tsx`:
  - [x] Adicionar `PENDING` em `FinancialTransactionStatus`, `TRANSACTION_STATUS_LABELS` e `getTransactionStatusClass`
  - [x] Expandir `FinancialTransaction` e `FinancialSummary` com `paidAt`, `recurringGroupId`, `installmentNumber`, `totalInstallments`, `pendingIncome`, `pendingExpense` e `pendingCount` (incluindo `FinanceInstallmentBadge` / `formatInstallmentLabel`)
  - [x] Atualizar `useFinanceiroData` para consultar `/api/financeiro/transactions` e `/api/financeiro/summary` com parâmetros de filtro do período (evitando corte pelo limite `take` do backend)
- [x] Atualizar `apps/web/src/app/(dashboard)/financeiro/financeiro-modals.tsx` (e utilitário `apps/web/src/lib/financial-batch.ts`):
  - [x] Adicionar alternância `Lançamento único` × `Recorrente / Parcelado` no `TransactionModal` (com `size="lg"` no modo lote e ocultação de comprovante em lote)
  - [x] Implementar seletor `"Repetir valor"` vs `"Dividir valor total"` (ajuste de centavos na última parcela)
  - [x] Implementar cálculo de datas com periodicidade (`Semanal`, `Quinzenal`, `Mensal`, `Anual`), quantidade/data limite e *clamping* seguro de fim de mês (dias 29/30/31)
  - [x] Renderizar lista de preview das parcelas com remoção individual antes de salvar e erros inline via `ModalError`
  - [x] Incluir opção `PENDING` no `<select>` de status de `TransactionModal` e em `TransactionStatusModal`
- [x] Atualizar `apps/web/src/app/(dashboard)/financeiro/page.tsx` para integrar submissão ao endpoint `POST /api/financeiro/transactions/batch`
- [x] Critério de validação da etapa: Modal gerando preview fiel com cálculo validado (`FINANCIAL_BATCH_ASSERTIONS_OK`), integração lote implementada e `npx.cmd -w apps/web tsc --noEmit` verde (`WEB_TSC_EXIT=0`).

### Etapa 5 - Exibição, Filtros, Ação de Baixa e Telas Secundárias (Frontend ODS)
Status: concluido

- [x] Atualizar `apps/web/src/app/(dashboard)/financeiro/page.tsx`:
  - [x] Passar filtros de período/status ao recarregar dados via `useFinanceiroData`
  - [x] Exibir badge `PENDING` e indicador de parcela (`Parcela X/Y`) nos cards de lançamento
  - [x] Exibir indicadores de contas pendentes (`A Receber` / `A Pagar`) no período
  - [x] Adicionar ação rápida **"Dar Baixa / Confirmar Pagamento"** em lançamentos `PENDING` (visível conforme `canCancelTransaction` / `APPROVER`+) com chamada a `PATCH /api/financeiro/transactions/:id/confirm`
- [x] Atualizar `apps/web/src/app/(dashboard)/financeiro/visualizacao/page.tsx`:
  - [x] Sincronizar filtros com `useFinanceiroData`, exibir badge `PENDING`, indicador de parcela e tabela de impressão PDF atualizada
- [x] Atualizar `apps/web/src/app/(dashboard)/financeiro/exportacao/page.tsx`:
  - [x] Incluir suporte a `PENDING`, coluna de parcela e `paidAt` no CSV exportado
- [x] Critério de validação da etapa: `npx -w apps/web tsc --noEmit` (`WEB_TSC_EXIT=0`) e `npm.cmd run build -w apps/web` (`WEB_BUILD_EXIT=0`) passando sem erros, com fluxo validado visualmente em desktop e mobile.

### Etapa 6 - Documentação, Testes Integrados e Validação Final
Status: concluido

- [x] Atualizar `ai-context/backlog/financeiro-patrimonial.md` registrando a entrega de contas recorrentes e parceladas em lote
- [x] Atualizar `ai-context/plans/financeiro-contas-recorrentes-em-lote-plan.md` marcando checkboxes e `Status geral: concluido`
- [x] Atualizar status do plano no índice `ai-context/plans/README.md`
- [x] Executar bateria de testes do backend (`npx jest src/modules/financeiro` em `apps/api`)
- [x] Executar build de produção em ambos os pacotes (`npm.cmd run build -w apps/api` e `npm.cmd run build -w apps/web`)
- [x] Validar fluxo ponta a ponta em desktop e mobile (`390x844`): criação em lote (recorrente e parcelado), remoção de parcela no preview, visualização com lançamentos antigos preservados e baixa de parcela `PENDING` atualizando o saldo
- [x] Critério de validação da etapa: Builds e testes verdes em `apps/api` (`FINAL_JEST_EXIT=0`, `FINAL_API_BUILD_EXIT=0`) e `apps/web` (`FINAL_WEB_TSC_EXIT=0`, `FINAL_WEB_BUILD_EXIT=0`) e critérios de aceite validados sem regressões.

---

## 5. Critérios de Aceite Gerais

- [x] O usuário consegue criar lançamentos recorrentes (valor repetido) e parcelados (valor total dividido com centavos fechados) em lote em uma única requisição atômica.
- [x] O modal apresenta preview fiel das datas (com ajuste seguro para dias 29/30/31) e valores antes da confirmação, permitindo remover ocorrências específicas.
- [x] A criação de lotes com até 120 parcelas futuras não oculta lançamentos do mês atual ou passados na listagem/visualização.
- [x] Contas `PENDING` não alteram o saldo líquido consolidado (`CONFIRMED`), alimentando apenas os indicadores de contas a pagar/receber.
- [x] Apenas `FINANCE_APPROVER` e `FINANCE_MANAGER` podem dar baixa (`PATCH /confirm`) ou criar ocorrências já `CONFIRMED`; ao dar baixa, o item passa a `CONFIRMED` com `paidAt` preenchido e atualiza o saldo real.
- [x] Todas as parcelas da série compartilham o mesmo `recurringGroupId` gerado no servidor e possuem trilha em `AuditLog`.
- [x] Nenhuma rotina de background (cron) é requerida para a criação das contas.
- [x] As telas principal, visualização/impressão e exportação seguem o design system OneElo (ODS) e tratam corretamente o status `PENDING`.
