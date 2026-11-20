# Plano - Exportação Unificada em PDF na Visualização Financeira (IMP-010)

Status geral: concluido  
Data de criação: 2026-11-19  
Branch sugerida para implementação: feature/financeiro-exportacao-pdf-png  

## Planos e Referências Relacionados

- [Template Oficial de Planos](PLAN_TEMPLATE.md)
- [Backlog IMP-010: Migrar impressão financeira para exportação unificada](../backlog/improvements.md)
- [Backlog FT-014: Módulo Financeiro e Patrimonial](../backlog/financeiro-patrimonial.md)
- [Plano de Referência: Agenda Exportação PDF/PNG](agenda-exportacao-pdf-png-plan.md)
- [Plano Anterior: Contas Recorrentes em Lote](financeiro-contas-recorrentes-em-lote-plan.md)
- [ODS - View Standard](../../ai-core/skills/oneelo-design-system/VIEW_STANDARD.md)
- [Decisões de RBAC e Autorização](../architecture/rbac-decisions.md)

---

## 1. Objetivo da Entrega

Substituir o fluxo legado de impressão via navegador (`window.print()`) da tela `/financeiro/visualizacao` pela exportação e compartilhamento server-side em **PDF (A4 paisagem)** — **sem geração de PNG** (escopo enxuto e seguro para extratos financeiros, evitando lotes de dezenas de imagens e risco de timeout/memória no Render Free), garantindo:

1. **Experiência ODS Idêntica à Agenda/Escalas (com Disparo Direto em PDF):** Substituir o botão `Imprimir` pelo botão quadrado padrão de compartilhamento (`Share2` / `LoaderCircle`, `h-10 w-10`, `bg-brand text-brand-foreground`) acionando `handleExportPdf()` diretamente via `useDocumentShare` (sem modal intermediário de escolha de formato), mantendo o mesmo comportamento de Agenda/Escalas (`navigator.share` quando disponível e `<ExportSharePreparedBanner />` com **Compartilhar / Baixar** + `<ExportShareErrorBanner />` como fallback).
2. **Qualidade Documental Consistente (Playwright/Chromium):** Renderização no backend via `ExportModule` (`ChromiumRendererService`, `DocumentCacheService`, `TenantLogoService`, `renderBaseDocumentStyles`, `renderDocumentHeader` e `renderPdfFooterTemplate` com numeração `Página X de Y`), eliminando distorções entre drivers de impressão e navegadores móveis.
3. **Totalização 100% Fiel à Tabela (Sem Cards Globais no Topo):**
   - O PDF **não** exibe os 5 cards globais de saldo/indicadores da tela (que não reagem a filtros como tipo, status, evento, membro ou busca).
   - Exibe cabeçalho institucional limpo (logo, título *Extrato Financeiro*, período em `UTC`, data de emissão em `America/Sao_Paulo` e rótulos legíveis dos filtros aplicados, quando houver), seguido pela **tabela de lançamentos** e por uma faixa compacta de **Total dos Lançamentos Listados** no encerramento da tabela — sempre 100% consistente com as linhas exibidas, com somatórios separados por status e tipo (`Entrada`/`Saída`), nunca somando `CANCELLED` ou `DRAFT` no resultado líquido.
4. **Governança e Segurança Financeira:** Respeito rigoroso às permissões financeiras (`FinanceAuthorizationService.ensureCanAccessFinanceData`, sem `@Roles(...)` restritivo para permitir tesoureiros `BASIC`), isolamento por `tenantId` do JWT, **sem gravação na Central de Documentos (`DocumentJob`)** para não expor extratos a usuários `ADMIN`/`STAFF` sem `FinancePermission`, cache privado por `ETag` (incluindo `tenantId`, `issuedDateKey` e snapshot completo) e proteção anti-XSS (`escapeHtml`) + CSP fechada.

---

## 2. Contexto e Diagnóstico

1. **Estado atual em `apps/web/src/app/(dashboard)/financeiro/visualizacao/page.tsx`:**
   - O `PageHeader` exibe botão legado `<button onClick={handlePrint}>Imprimir</button>` chamando `window.print()`.
   - O bloco oculto `.print-area.print-document` contém apenas `<PrintDocumentHeader>`, `<table className="print-schedule-table">` e `<PrintScheduleFooter>`, falhando em fluxos de compartilhamento mobile/WhatsApp e dependendo do motor de impressão do navegador.
   - Os 5 cards do topo (`financialSummary` via `GET /api/financeiro/summary`) reagem apenas a `startDate`/`endDate`/`accountId`, não refletindo `status`, `type`, `eventoId`, `memberId` ou `description` — razão pela qual não são replicados no topo do PDF.
2. **Paridade de filtro textual e debounce (`financial-transactions.service.ts`, `financeiro-shared.tsx`, `visualizacao/page.tsx` e `financeiro/page.tsx`):**
   - A UI filtra `description` via `matchTransactionSearch` (descrição, título exibido, tipo traduzido, categoria, conta, contraparte, evento, membro e forma de pagamento traduzida).
   - O backend ainda não aplica esse filtro textual em `findAll`/exportação — e **tanto** `visualizacao/page.tsx` **quanto** `financeiro/page.tsx` usam `useFinanceiroData(appliedTransactionFilters)` com `debounceFields: []`. Ao enviar `description` em `stableFilters` e `buildTransactionsUrl`, **ambas** as páginas precisam ativar `debounceFields: ['description']` (350ms) para evitar rajada de 4 requests HTTP por tecla digitada.
   - Para evitar risco de OOM no Render Free (512 MB) quando `description` estiver preenchido sem filtro de datas, a varredura textual no backend deve usar um teto defensivo de leitura (`MAX_SEARCH_SCAN_LIMIT = 2000`) antes do corte de `MAX_LIST_LIMIT = 500`; sem `description`, usar `take: MAX_LIST_LIMIT + 1` (501) e consultar `count()` apenas quando exceder 500.
3. **Decisão de escopo exclusivamente PDF:**
   - Como `/financeiro/visualizacao` exportará **apenas PDF** (enquanto `/financeiro/exportacao` permanece dedicada à exportação CSV), `ExportShareDialog` e `export-calendar-weeks.ts` não precisam ser modificados (risco zero de regressão em Escalas e Agenda), bastando tornar `weeklyOptions` opcional em `useDocumentShare` e acionar `handleExportPdf()` diretamente.
4. **Cuidados identificados no `common/export`:**
   - `financeiro-shared.tsx` e `visualizacao/page.tsx` formatam `date` e `paidAt` em **`timeZone: 'UTC'`**, assim como `parseFilterDateBoundary` no backend usa `Z`; o renderizador financeiro deve usar `UTC` para `date`, `paidAt`, subtítulo de período fallback e nome do arquivo (não reutilizar `parseDateFilter` da Agenda para `Date`, pois ele usa `America/Sao_Paulo`), mantendo `America/Sao_Paulo` para `issuedAt`.
   - `renderBaseDocumentStyles()` em `apps/api/src/common/export/base-document-styles.ts` esconde `.header-period` apenas em `.pdf-page` e `.agenda-pdf-document`, além de usar `@page { margin: 7mm }`; o CSS financeiro deve esconder `.header-period` em `.financeiro-pdf-document` e definir `@page { size: A4 landscape; margin: 8mm 8mm 12mm 8mm; }` com `viewport: { width: 1123, height: 794 }`.
   - `renderPdfFooterTemplate` (evoluído com suporte opcional a `showPageNumbers?: boolean` para `Página X de Y` à direita) e `countPdfPagesFromBuffer` hoje vivem em `evento-document-renderer.service.ts` e devem ser extraídos para `apps/api/src/common/export/` para reúso limpo.

---

## 3. Decisões de Arquitetura, Riscos e Engenharia

### 3.1. Contrato da API (`GET /api/financeiro/exportacao`)
- **DTO (`ExportFinanceiroDto`):**
  - `formato`: `@IsOptional()`, `@Transform` normalizando `undefined`/`null`/`''` para `'pdf'`, `@IsIn(['pdf'])` (compatível com `ValidationPipe` global `whitelist: true` e `forbidNonWhitelisted: true`).
  - Filtros espelhados da tela: `startDate`, `endDate`, `status`, `type`, `accountId`, `categoryId`, `eventoId`, `memberId`, `recurringGroupId`, `description`, `_t` opcional (ignorado no `ETag`).
  - Normalização defensiva com `@Transform`: converter strings vazias e `'all'` em `undefined` para `status` e `type` antes de `@IsEnum`.
- **Autorização e Respostas HTTP (`FinanceiroController`):**
  - **Sem `@Roles(...)` restritivo** no handler (preservando acesso de usuários `BASIC` que possuam `FinancePermission`).
  - Valida `FinanceAuthorizationService.ensureCanAccessFinanceData(tenantId, user)` (`FINANCE_VIEWER` ou superior; `ADMIN` sem permissão financeira recebe `403 Forbidden`) **sempre antes** de consultar o cache.
  - Lança `NotFoundException` (`404`) caso não haja nenhum lançamento para os filtros informados.
  - Captura `ExportServiceUnavailableException` enviando header `Retry-After` (padrão `EventosController`) para feedback amigável de fila cheia (`503`).
  - Suporta `If-None-Match` retornando `304 Not Modified` quando `ETag` coincidir.
  - Emite headers `X-Document-Page-Count`, `ETag`, `Cache-Control: private, max-age=0, must-revalidate`, `Content-Type: application/pdf` e `Content-Disposition: attachment; filename="..."`.
  - **Não registra em `DocumentJob` (Central de Documentos):** decisão intencional de segurança, já que `DocumentsController` não valida `FinancePermission`.

### 3.2. Cálculo Contábil do Totalizador, Filtros e Paridade com a Tela
- **Filtro Textual Compartilhado:** reutilizar `normalizeSearchText` de `apps/api/src/common/utils/search-text.ts` replicando os mesmos campos e rótulos PT-BR de `matchTransactionSearch` (título exibido, descrição, tipo traduzido `Entrada`/`Saída`, categoria, conta, contraparte, evento, membro e forma de pagamento traduzida).
- **Recorte Seguro, Ordenação e Truncamento:**
  - Sem `description`: consulta Prisma com `take: MAX_LIST_LIMIT + 1` (501); se exceder 500, calcula `totalMatchingCount` via `count()` e marca `truncated: true`.
  - Com `description`: lê até `MAX_SEARCH_SCAN_LIMIT = 2000` registros em `desc`, aplica o filtro textual normalizado em memória, conta `totalMatchingCount`, recorta os 500 mais recentes (`truncated: totalMatchingCount > 500 || scannedHitCap`) e reordena em memória em ordem cronológica `date asc, createdAt asc` para exibição no PDF.
  - **Sem consulta a `getSummary`:** elimina consulta adicional desnecessária no banco.
- **Resolução de `appliedFilterLabels` (Zero Queries Extras):** como a exportação lança `404` quando vazia, quando há lançamentos os nomes reais (`account.name`, `category.name`, `evento.titulo`, `member.nome`) já vêm carregados no `TRANSACTION_INCLUDE` do primeiro registro retornado (e `recurringGroupId` exibe rótulo amigável *"Série recorrente"*).
- **Totalizador dos Lançamentos Listados (`totals` em centavos inteiros, separado por status e tipo):**
  - `count`: quantidade total de lançamentos listados;
  - `confirmedCount`, `confirmedIncome`, `confirmedExpense`, `confirmedNet` (`confirmedIncome - confirmedExpense`): apenas `CONFIRMED`;
  - `pendingCount`, `pendingIncome`, `pendingExpense`, `pendingNet`: apenas `PENDING`;
  - `draftCount`, `draftIncome`, `draftExpense`: apenas `DRAFT` (**nunca** somados no resultado líquido);
  - `cancelledCount`, `cancelledIncome`, `cancelledExpense`: apenas `CANCELLED` (**nunca** somados no resultado líquido).
  - A faixa final do PDF adapta a exibição ao recorte real (destaca **Confirmados / Resultado (Confirmados)** quando `confirmedCount > 0`; destaca **Pendentes (`A Receber` / `A Pagar`)** quando houver pendentes ou filtro exclusivo `PENDING`; e apresenta **Rascunhos** e **Cancelados** separados em Entradas/Saídas sem rotular como resultado líquido).

### 3.3. Design Documental (PDF A4 Paisagem)
- **Layout PDF (`@page { size: A4 landscape; margin: 8mm 8mm 12mm 8mm; }`, `viewport: { width: 1123, height: 794 }`):**
  - Wrapper `.financeiro-pdf-document` com `.financeiro-pdf-document .header-period { display: none; }` (evitando duplicação de subtítulo) e CSS leve/flat (sem `box-shadow`/gradientes por linha para rapidez no Render Free).
  - **Cabeçalho limpo (sem cards globais):** `renderDocumentHeader` (`Extrato Financeiro`, período formatado em `UTC`, nome e logo do tenant em data URI, data de emissão em `America/Sao_Paulo`) + faixa discreta de **Filtros Aplicados** somente quando houver filtros além do período.
  - **Tabela de lançamentos:** `thead { display: table-header-group }` com 9 colunas dimensionadas para `281mm` úteis (`Data`, `Liquidação`, `Descrição / Detalhes`, `Parcela`, `Tipo`, `Status`, `Conta`, `Categoria` e `Valor`).
    - Na coluna `Descrição / Detalhes`, deduplicar `member.nome` / `counterpartyName` / `evento.titulo` em relação ao título exibido e entre si para nunca repetir o mesmo texto.
    - Datas `date` e `paidAt` formatadas estritamente em **`UTC`** para bater 100% com `/financeiro/visualizacao`.
    - Coluna `Valor` alinhada à direita com `tabular-nums`, sinal semântico (`+` / `-`) e estilo atenuado/riscado em linhas `CANCELLED` para deixar visualmente claro que não entram no resultado líquido.
  - **Faixa compacta de Totalização no encerramento da tabela (`break-inside: avoid`):** apresenta os totais exatos das linhas listadas + nota explícita de truncamento caso `truncated === true` (*"Exibindo os 500 lançamentos mais recentes de X encontrados — os totais abaixo refletem exclusivamente os itens listados."*).
  - **Rodapé institucional com paginação:** `renderPdfFooterTemplate(lookupLabsLogoDataUri, { showPageNumbers: true })` exibindo `One Elo / Lookup Labs` à esquerda e `Página X de Y` (`<span class="pageNumber"></span>` / `<span class="totalPages"></span>`) à direita.

### 3.4. Matriz de Riscos e Mitigações
| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Soma indevida de `CANCELLED`/`DRAFT` ou mistura de Entrada+Saída no totalizador | Alta (se não separado) | Crítico | Separar somatórios em centavos por status **e** tipo (`confirmed*`, `pending*`, `draft*`, `cancelled*`), exibindo visual riscado em cancelados. |
| Divergência de data (-1 dia) entre tela, subtítulo e PDF por fuso horário | Alta | Alto | Formatar `date`, `paidAt`, período fallback e nome do arquivo estritamente em `UTC`; usar `America/Sao_Paulo` apenas em `issuedAt` e `issuedDateKey`. |
| Sobreposição de rodapé ou subtítulo duplicado no cabeçalho PDF | Média | Médio | Definir `.financeiro-pdf-document .header-period { display: none; }`, `@page { size: A4 landscape; margin: 8mm 8mm 12mm 8mm; }` e `viewport: { width: 1123, height: 794 }`. |
| OOM no Render Free ao buscar `description` em tenant grande sem filtro de datas | Média | Alto | Teto defensivo `MAX_SEARCH_SCAN_LIMIT = 2000` para busca textual e `take: 501` sem busca textual (nunca `findMany` irrestrito). |
| Rajada de 4 requests por tecla em `/financeiro` ou `/financeiro/visualizacao` | Alta (se esquecer `/financeiro`) | Médio | Ativar `debounceFields: ['description']` em **ambas** as páginas (`visualizacao/page.tsx` e `financeiro/page.tsx`), atualizar `stableFilters` e desabilitar o botão de PDF durante `isTransactionDebouncing`. |
| Vazamento de dados financeiros em cache, Central de Documentos ou PDF com data vencida | Baixa | Crítico | Validar `ensureCanAccessFinanceData` antes do cache (sem `@Roles` restritivo), `ETag` com `v: 'financeiro-v1'` + `tenantId` + `issuedDateKey` + snapshot completo, `Cache-Control: private` e **não** salvar em `DocumentJob`. |
| Injeção HTML/XSS via descrição, conta, categoria ou contraparte | Média | Alto | Aplicar `escapeHtml` em todos os campos textuais renderizados e manter CSP fechada (`default-src 'none'; img-src data:; style-src 'unsafe-inline';`). |

---

## 4. Etapas de Desenvolvimento

> **Regra de Execução:** O desenvolvimento deve avançar estritamente etapa por etapa. Ao concluir uma tarefa ou etapa, atualize imediatamente seu checkbox para `[x]`, apresente o resumo das validações e **aguarde a autorização explícita do usuário antes de iniciar a etapa seguinte**.

### Etapa 0 - Preparação, Branch e Baseline
Status: concluido

- [x] Confirmar criação da branch `feature/financeiro-exportacao-pdf-png` a partir de `development`
- [x] Validar baseline de testes do módulo financeiro em `apps/api` (`npx jest src/modules/financeiro`)
- [x] Critério de validação da etapa: Branch de feature ativa e testes atuais do módulo financeiro passando sem erros (`npm.cmd test -w apps/api -- src/modules/financeiro`: 10 passed / 10 total, exit code 0).

### Etapa 1 - DTOs, Filtro Textual e Preparação de Dados de Exportação (Backend)
Status: concluido

- [x] Criar `apps/api/src/modules/financeiro/dto/export-financeiro.dto.ts`:
  - [x] Declarar `formato` opcional normalizado para `'pdf'` (`@IsOptional()`, `@Transform`, `@IsIn(['pdf'])`)
  - [x] Declarar filtros opcionais (`startDate`, `endDate`, `status`, `type`, `accountId`, `categoryId`, `eventoId`, `memberId`, `recurringGroupId`, `description`, `_t`) com `@Transform` normalizando strings vazias e `'all'` para `undefined`
- [x] Atualizar `apps/api/src/modules/financeiro/financial-transactions.service.ts`:
  - [x] Suportar filtro textual normalizado `description` (usando `normalizeSearchText` de `apps/api/src/common/utils/search-text.ts`, cobrindo os mesmos campos e rótulos PT-BR de `matchTransactionSearch`) com teto defensivo `MAX_SEARCH_SCAN_LIMIT = 2000` antes do corte `MAX_LIST_LIMIT = 500` em `findAll` e na exportação
  - [x] Implementar `prepareExportData(tenantId, query, actor)` validando `ensureCanAccessFinanceData`, aplicando `take: MAX_LIST_LIMIT + 1` (sem `description`) ou varredura limitada (com `description`), ordenando cronologicamente (`date asc`, `createdAt asc`) e sinalizando `truncated` e `totalMatchingCount` quando exceder `500`
  - [x] Consultar `tenant` (`nome`, `logoUrl`), derivar `appliedFilterLabels` diretamente das relações já carregadas em `transactions[0]` (zero queries extras) e calcular `totals` em centavos inteiros separados por status e tipo (`confirmed*`, `pending*`, `draft*`, `cancelled*`, sem chamar `getSummary`)
  - [x] Lançar `NotFoundException` (`404`) quando não houver lançamentos para exportar
- [x] Atualizar `apps/api/src/modules/financeiro/financeiro.controller.ts`:
  - [x] Repassar `@Query('description')` também em `GET /api/financeiro/transactions`
- [x] Atualizar `apps/api/src/modules/financeiro/financial-transactions.service.spec.ts`:
  - [x] Testar filtro textual `description` sem acentos em múltiplos campos (descrição, categoria, contraparte, membro, evento, tipo e forma de pagamento traduzidos)
  - [x] Testar cálculo contábil de `totals` em centavos separado por status e tipo (garantindo que `CANCELLED` e `DRAFT` não entram no resultado líquido realizado)
  - [x] Testar derivação de nomes legíveis em `appliedFilterLabels`, flag `truncated` / `totalMatchingCount`, bloqueio RBAC (`403 Forbidden`) e `404` para lista vazia
- [x] Critério de validação da etapa: `npx.cmd jest src/modules/financeiro/financial-transactions.service.spec.ts` passando 100% e `npm.cmd run build -w apps/api` sem erros.

### Etapa 2 - Helpers Compartilhados, Renderizador PDF e Endpoint `/api/financeiro/exportacao` (Backend)
Status: concluido

- [x] Atualizar `apps/api/src/common/export/base-document-styles.ts`:
  - [x] Extrair `renderPdfFooterTemplate(lookupLabsLogoDataUri, options?: { showPageNumbers?: boolean })` com marca `One Elo / Lookup Labs` à esquerda e paginação opcional `Página X de Y` à direita
- [x] Atualizar `apps/api/src/common/export/document-format.utils.ts`:
  - [x] Extrair `countPdfPagesFromBuffer(buffer)` para reúso entre módulos
- [x] Atualizar `apps/api/src/modules/eventos/export/evento-document-renderer.service.ts`:
  - [x] Reutilizar `renderPdfFooterTemplate` e `countPdfPagesFromBuffer` a partir de `../../../common/export` (reexportando-os para preservar compatibilidade com testes existentes)
- [x] Criar tipos do documento financeiro em `apps/api/src/modules/financeiro/export/financeiro-document.types.ts`:
  - [x] Definir `FinanceiroDocumentInput`, `FinanceiroDocumentItem`, `FinanceiroDocumentTotals`, `FinanceiroFilterLabel` e `FinanceiroExportResult`
- [x] Criar renderizador PDF em `apps/api/src/modules/financeiro/export/financeiro-document-renderer.service.ts`:
  - [x] Reutilizar `ChromiumRendererService`, `DocumentCacheService`, `TenantLogoService`, `renderBaseDocumentStyles`, `renderDocumentHeader`, `renderPdfFooterTemplate` (`showPageNumbers: true`), `countPdfPagesFromBuffer` e `escapeHtml`
  - [x] Implementar renderização **PDF (A4 paisagem)** com `viewport: { width: 1123, height: 794 }`, wrapper `.financeiro-pdf-document` (ocultando `.header-period` duplicado e definindo `@page { size: A4 landscape; margin: 8mm 8mm 12mm 8mm; }`), cabeçalho institucional limpo (sem cards globais), faixa condicional de filtros aplicados, tabela de 9 colunas com deduplicação de contraparte/membro/evento, datas `date`/`paidAt` e período fallback em `UTC`, sinal/cor na coluna `Valor` com estilo atenuado/riscado em `CANCELLED`, e bloco compacto adaptativo de **Total dos Lançamentos Listados** ao final da tabela (mais nota de truncamento se `truncated`)
  - [x] Implementar `computeEtag` com namespace `financeiro-v1`, `tenantId`, `issuedDateKey` (`America/Sao_Paulo`), filtros e snapshot completo dos campos renderizados (ignorando `_t`), com suporte completo a `304 Not Modified` / cache LRU
- [x] Atualizar `apps/api/src/modules/financeiro/financeiro.module.ts`:
  - [x] Importar `ExportModule` e registrar `FinanceiroDocumentRendererService`
- [x] Atualizar `apps/api/src/modules/financeiro/financeiro.controller.ts`:
  - [x] Adicionar `@Get('exportacao')` (sem `@Roles(...)` restritivo) aceitando `ExportFinanceiroDto`, lendo `if-none-match`, tratando `ExportServiceUnavailableException` com header `Retry-After` e retornando headers `X-Document-Page-Count`, `ETag`, `Cache-Control: private, max-age=0, must-revalidate`, `Content-Type: application/pdf` e `Content-Disposition`
- [x] Criar `apps/api/src/modules/financeiro/export/financeiro-document-renderer.service.spec.ts`:
  - [x] Testar formatação de datas e período fallback em `UTC` (sem deslocamento de -1 dia), valores em `pt-BR`, deduplicação de contraparte/membro e sanitização `escapeHtml` contra XSS
  - [x] Testar renderização do cabeçalho sem cards globais, faixa condicional de filtros aplicados, paginação no rodapé (`pageNumber`/`totalPages`), estilo riscado em `CANCELLED` e bloco de totalização adaptativo (incluindo filtros `PENDING`, `CANCELLED` e `DRAFT`)
  - [x] Testar cache HIT / `304 Not Modified` por `ETag` (ignorando `_t` e sensível a `tenantId`, `issuedDateKey` e `paidAt`) e renderização PDF com mock de Playwright
- [x] Criar `apps/api/src/modules/financeiro/financeiro.controller.spec.ts`:
  - [x] Testar `@Get('exportacao')`: retorno binário PDF com headers corretos, `304 Not Modified` via `If-None-Match` e header `Retry-After` em `ExportServiceUnavailableException` (`503`)
- [x] Critério de validação da etapa: Todos os testes em `apps/api` (`npx.cmd jest src/modules/financeiro src/modules/eventos`) e `npm.cmd run build -w apps/api` passando com exit code 0.

### Etapa 3 - Migração de `/financeiro/visualizacao` para Exportação PDF Direta (Frontend ODS)
Status: concluido

- [x] Atualizar `apps/web/src/hooks/use-document-share.ts`:
  - [x] Tornar `weeklyOptions` opcional (`weeklyOptions = []`) preservando 100% da API e comportamento existentes para Escalas e Agenda (sem tocar em `ExportShareDialog`)
- [x] Atualizar `apps/web/src/app/(dashboard)/financeiro/financeiro-shared.tsx`:
  - [x] Adicionar `description?: string` em `FinanceiroQueryFilters`, em `stableFilters` (`useFinanceiroData`) e em `buildTransactionsUrl` quando preenchido
- [x] Atualizar `apps/web/src/app/(dashboard)/financeiro/page.tsx`:
  - [x] Configurar `debounceFields: ['description']` no `useFilterState` para evitar rajada de chamadas à API ao digitar na tela de gerenciamento
- [x] Atualizar `apps/web/src/app/(dashboard)/financeiro/visualizacao/page.tsx`:
  - [x] Configurar `debounceFields: ['description']` no `useFilterState`
  - [x] Montar `exportFilter` sanitizado omitindo valores `'all'` e strings vazias (`startDate`, `endDate`, `status`, `type`, `eventoId`, `memberId`, `description`)
  - [x] Substituir o botão `Imprimir` no `PageHeader` pelo botão quadrado padrão de Agenda/Escalas (`h-10 w-10`, `bg-brand text-brand-foreground hover:bg-brand-hover`, `Share2` / `LoaderCircle`, `aria-label="Compartilhar"`, `title="Compartilhar"`), desabilitado quando `loadingData || isTransactionDebouncing || filteredTransactions.length === 0 || exporting !== null`, acionando `handleExportPdf()` diretamente via `useDocumentShare`
  - [x] Remover `handlePrint`, estado `printedAt` e todo o bloco HTML legado `.print-area.print-document` (e imports não utilizados de `PrintDocumentHeader`/`PrintScheduleFooter`)
  - [x] Renderizar `<ExportSharePreparedBanner />` e `<ExportShareErrorBanner />` (padrão idêntico a Agenda/Escalas) com `resetDependencies: [filteredTransactions]`
- [x] Critério de validação da etapa: `npx.cmd -w apps/web tsc --noEmit` e `npm.cmd run build -w apps/web` sem erros; `/financeiro/visualizacao` exportando PDF diretamente no padrão ODS sem botão `Imprimir` legado e sem regressão em `/financeiro`, `/escalas/visualizacao` ou `/agenda/visualizacao`.

### Etapa 4 - Validação Integrada e Atualização da Documentação
Status: concluido

- [x] Executar bateria completa de testes do backend (`npx.cmd jest` em `apps/api`)
- [x] Executar typecheck (`npx.cmd -w apps/web tsc --noEmit`) e builds de produção (`npm.cmd run build -w apps/api` e `npm.cmd run build -w apps/web`)
- [x] Executar validação funcional integrada (desktop `1280px+` e mobile `390x844`):
  - [x] Extrato do período gerando PDF A4 paisagem limpo (sem cards globais no topo), com cabeçalho, logo, datas corretas (`UTC`), tabela ordenada, rodapé com `Página X de Y` e totalizador fiel no encerramento da tabela
  - [x] Extrato filtrado (ex.: `type=EXPENSE`, `status=PENDING`, `eventoId` ou busca textual `description`) exibindo nomes legíveis nos filtros aplicados e totalizador contábil exato apenas das linhas listadas (sem incluir cancelados no resultado líquido)
  - [x] Validação de RBAC confirmando bloqueio para usuários sem permissão financeira (`403`) e acesso liberado para `FINANCE_VIEWER`+ (inclusive `BASIC` com permissão financeira)
- [x] Atualizar `ai-core/skills/oneelo-design-system/VIEW_STANDARD.md` registrando a variante de compartilhamento direto somente-PDF sem `ExportShareDialog`
- [x] Atualizar `ai-context/backlog/improvements.md` marcando `IMP-010` como `implementado` (com escopo PDF)
- [x] Atualizar `ai-context/backlog/README.md` refletindo a conclusão de `IMP-010`
- [x] Atualizar `ai-context/backlog/financeiro-patrimonial.md` registrando a exportação oficial em PDF
- [x] Atualizar `ai-context/plans/financeiro-exportacao-pdf-png-plan.md` marcando checkboxes e `Status geral: concluido`
- [x] Atualizar `ai-context/plans/README.md` registrando a conclusão do plano
- [x] Critério de validação da etapa: Todos os builds e testes relevantes passando com exit code 0, validação desktop/mobile concluída e documentação sincronizada.

---

## 5. Critérios de Aceite Gerais

- [x] O botão legado `Imprimir` (`window.print()`) e o HTML estático `.print-area` foram removidos de `/financeiro/visualizacao`, substituídos pelo botão quadrado `Share2` acionando exportação direta em PDF (`useDocumentShare` + `ExportSharePreparedBanner` / `ExportShareErrorBanner`), sem geração de PNG.
- [x] O endpoint `GET /api/financeiro/exportacao` respeita rigorosamente RBAC financeiro (`FINANCE_VIEWER`+, inclusive perfis `BASIC` autorizados), isolamento por `tenantId`, retorna `Retry-After` em `503`, suporta `ETag`/`304 Not Modified` (com `tenantId`, `issuedDateKey` e snapshot completo) e **não** grava em `DocumentJob`.
- [x] Todos os filtros ativos da tela (`startDate`, `endDate`, `status`, `type`, `eventoId`, `memberId`, `description`) produzem paridade exata de itens e datas (`UTC`) entre tela e PDF, com debounce de 350ms em `description` em `/financeiro` e `/financeiro/visualizacao` e proteção de memória no backend.
- [x] O PDF apresenta cabeçalho institucional limpo (sem cards globais no topo), exibe nomes legíveis dos filtros aplicados quando houver, inclui numeração `Página X de Y` no rodapé e encerra a tabela com o **Total dos Lançamentos Listados** calculado em centavos inteiros separado por status e tipo (nunca somando `CANCELLED`/`DRAFT` no resultado líquido).
- [x] A experiência em `/escalas/visualizacao`, `/agenda/visualizacao`, `/financeiro` e `/financeiro/exportacao` permanece 100% preservada sem alterações em `ExportShareDialog`.
- [x] Todos os testes unitários (`apps/api`), `tsc` e builds de produção (`apps/api` e `apps/web`) passam sem erros ou regressões.
