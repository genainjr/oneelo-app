# Plano - Exportação Unificada PDF/PNG na Visualização Financeira (IMP-010)

Status geral: em andamento  
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

Substituir o fluxo legado de impressão via navegador (`window.print()`) da tela `/financeiro/visualizacao` pelo padrão unificado de exportação e compartilhamento server-side em **PDF** e **PNG** (já consolidado em `/escalas/visualizacao` e `/agenda/visualizacao`), garantindo:

1. **Paridade Visual e Operacional:** Botão de ação `Compartilhar` (`Share2`), diálogo `ExportShareDialog`, banners `ExportSharePreparedBanner` / `ExportShareErrorBanner` e suporte a Web Share API (`navigator.share`) no mobile + download direto no desktop.
2. **Qualidade Documental Consistente (Playwright/Chromium):** Renderização no backend via `ExportModule` (`ChromiumRendererService`, `DocumentCacheService`, `TenantLogoService` e `renderBaseDocumentStyles`), eliminando distorções entre drivers de impressão e browsers móveis.
3. **Resumo Inteligente no Documento:**
   - **Sem filtros avançados** (extrato padrão do período/conta): exibe os totalizadores oficiais do período (`Saldo Inicial`, `Entradas`, `Saídas`, `Saldo`, `A Receber` e `A Pagar`).
   - **Com filtros específicos ativos** (`status`, `type`, `description`, `eventoId`, `memberId`, `recurringGroupId`): exibe os filtros aplicados no cabeçalho e destaca um bloco de **Subtotal dos Lançamentos Listados** (quantidade, entradas filtradas, saídas filtradas e saldo líquido filtrado) batendo exatamente com a soma da tabela exibida.
4. **Governança e Segurança:** Respeito rigoroso às permissões financeiras (`FinancePermission` via `FinanceAuthorizationService.ensureCanAccessFinanceData`), isolamento estrito por `tenantId` do JWT, cache privado por `ETag` e proteção anti-XSS (`escapeHtml`) + CSP fechada.

---

## 2. Contexto e Diagnóstico

1. **Estado atual em `apps/web/src/app/(dashboard)/financeiro/visualizacao/page.tsx`:**
   - O `PageHeader` exibe botão legado `<button onClick={handlePrint}>Imprimir</button>` chamando `window.print()`.
   - O bloco oculto `.print-area.print-document` contém apenas `<PrintDocumentHeader>`, `<table className="print-schedule-table">` (colunas: Data, Descrição, Parcela, Tipo, Status, Conta, Categoria, Valor) e `<PrintScheduleFooter>`, **omitindo o resumo financeiro** e falhando em fluxos de compartilhamento mobile/WhatsApp.
2. **Lacuna de filtro textual no backend (`financial-transactions.service.ts`):**
   - Na UI (`visualizacao/page.tsx` e `financeiro-shared.tsx`), o usuário pode filtrar por `description` via `matchTransactionSearch` (que busca em descrição, título exibido, categoria, conta, contraparte, evento, membro e forma de pagamento).
   - O endpoint `GET /api/financeiro/transactions` ainda não recebe `search` / `description`, filtrando apenas no cliente. A exportação no backend precisa receber e aplicar o mesmo filtro textual para garantir paridade exata entre tela e PDF/PNG.
3. **Dependência do componente compartilhado `ExportShareDialog` e `useDocumentShare`:**
   - Hoje `apps/web/src/components/app/export-share-dialog.tsx` e `apps/web/src/hooks/use-document-share.ts` possuem rótulos acoplados ao domínio de calendário (*"Selecionar semana"*, *"eventos"*, *"Todas as semanas"*).
   - O extrato financeiro não é paginado por "semanas de eventos", e sim por página de lançamentos (ou imagem única quando couber em 1 folha). Logo, ambos os utilitários devem aceitar rótulos customizáveis opcionais e opção de atalho direto quando houver apenas 1 página PNG — **sem alterar os textos ou comportamentos existentes de Escalas e Agenda**.
4. **Infraestrutura compartilhada já pronta (`apps/api/src/common/export/`):**
   - `ExportModule` já provê `ChromiumRendererService` (fila serializada low-memory para Render Free), `DocumentCacheService` (ETag + LRU cache limitado em memória), `TenantLogoService` (data URI com cache) e estilos/cabeçalho oficiais One Elo / Lookup Labs.

---

## 3. Decisões de Arquitetura, Riscos e Engenharia

### 3.1. Contrato da API (`GET /api/financeiro/exportacao`)
- **DTO (`ExportFinanceiroDto`):**
  - `formato`: `'pdf' | 'png'` (default `'pdf'`).
  - `pagina`: `number | 'todas'` (validado via `@Transform` + `@IsInt` `@Min(1)` como em `ExportEventoDto`).
  - Filtros espelhados da tela: `startDate`, `endDate`, `status`, `type`, `accountId`, `categoryId`, `eventoId`, `memberId`, `recurringGroupId`, `description` (ou `search`), `_t` opcional (cache busting do cliente).
- **Autorização e Respostas HTTP:**
  - Valida `FinanceAuthorizationService.ensureCanAccessFinanceData(tenantId, user)` (`FINANCE_VIEWER` ou superior; `ADMIN` sem permissão financeira recebe `403 Forbidden`).
  - Lança `NotFoundException` (`404`) caso não haja nenhum lançamento para os filtros informados.
  - Suporta `If-None-Match` retornando `304 Not Modified` quando `ETag` coincidir.
  - Emite headers `X-Document-Page-Count`, `ETag` e `Cache-Control: private, max-age=0, must-revalidate`.
  - Retorna binário (`application/pdf` ou `image/png`) para documento único ou `{ files, pageCount }` em JSON para PNG em lote (`pagina=todas`).

### 3.2. Cálculo de Totais e Filtros no Extrato
- **Resumo Geral do Período:** obtido via `FinancialTransactionsService.getSummary(tenantId, actor, { startDate, endDate, accountId })` (`initialBalance`, `income`, `expense`, `balance`, `transactions`, `pendingIncome`, `pendingExpense`, `pendingCount`).
- **Detecção de Filtros Específicos (`hasNarrowFilters`):** verdadeiro quando qualquer um destes filtros estiver ativo: `status`, `type`, `eventoId`, `memberId`, `categoryId`, `recurringGroupId` ou `description`/`search` não vazio.
- **Subtotal dos Lançamentos Listados (`filteredSummary`):** calculado no servidor sobre exatamente a mesma lista filtrada enviada para a tabela:
  - `count`: total de lançamentos listados;
  - `income`: soma de `amount` onde `type === 'INCOME'`;
  - `expense`: soma de `amount` onde `type === 'EXPENSE'`;
  - `net`: `income - expense`;
  - `confirmedTotal` / `pendingTotal`: útil quando listagem combina status.
- **Ordenação no Documento:** ordem cronológica crescente (`date asc`, `createdAt asc`), espelhando a tabela de impressão atual de `/financeiro/visualizacao`.

### 3.3. Design Documental (PDF A4 Paisagem & PNG Mobile `1080px`)
- **PDF (A4 Paisagem — `283mm`):**
  - Acomoda com conforto todas as colunas financeiras sem quebra exagerada: `Data`, `Liquidação`, `Descrição / Título`, `Parcela`, `Tipo`, `Status`, `Conta`, `Categoria` e `Valor`.
  - Usa `renderDocumentHeader` (`One Elo` / logo do tenant), bloco de cards de resumo financeiro no topo, faixa discreta de **Filtros Aplicados & Subtotal Filtrado** quando `hasNarrowFilters === true`, tabela com `thead` repetido em quebras de página e `renderPdfFooterTemplate` com marca Lookup Labs / One Elo no rodapé.
- **PNG (Folha vertical `1080px` para WhatsApp/Mobile):**
  - Paginação determinística em blocos de **15 lançamentos por imagem** (`FINANCEIRO_PNG_ITEMS_PER_PAGE = 15`), garantindo legibilidade em smartphones sem gerar screenshots gigantes que estouram memória ou perdem resolução no WhatsApp.
  - Cada página PNG contém cabeçalho institucional, resumo compacto (na página 1 ou em todas para autossuficiência de cada imagem compartilhada) e cards/linhas bem espaçados com badge de status, tipo, parcela e valor formatado em `pt-BR` (`R$`).

### 3.4. Matriz de Riscos e Mitigações
| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Quebra de textos ou labels em Escalas/Agenda ao ajustar `ExportShareDialog` | Média | Alto | Todas as novas props de rótulo são opcionais com *fallback* idêntico ao comportamento atual de semanas/eventos; validar Escalas e Agenda após alteração. |
| Divergência entre busca por descrição no cliente e PDF gerado no backend | Alta | Alto | Extrair lógica equivalente a `matchTransactionSearch` no backend (normalização NFD sem acentos sobre os mesmos campos) usada por `exportar` e opcionalmente por `findAll`. |
| Estouro de memória no Render Free em extratos grandes | Média | Alto | Manter teto de segurança (`limit = 500`), fila serializada `ChromiumRendererService`, `deviceScaleFactor: 1` e paginação de PNG em blocos de 15 itens com cache limitado por `DocumentCacheService`. |
| Injeção HTML/XSS via descrição, conta, categoria ou contraparte | Média | Alto | Aplicar `escapeHtml` em todos os campos textuais renderizados e manter CSP rígida (`default-src 'none'; img-src data:; style-src 'unsafe-inline';`). |
| Vazamento de dados financeiros no cache HTTP/memória | Baixa | Alto | `tenantId`, `user.sub`/`role` ou filtros no cálculo de `ETag` + header `Cache-Control: private, max-age=0, must-revalidate` + RBAC antes de consultar cache. |

---

## 4. Etapas de Desenvolvimento

> **Regra de Execução:** O desenvolvimento deve avançar estritamente etapa por etapa. Ao concluir uma tarefa ou etapa, atualize imediatamente seu checkbox para `[x]`, apresente o resumo das validações e **aguarde a autorização explícita do usuário antes de iniciar a etapa seguinte**.

### Etapa 0 - Preparação, Branch e Baseline
Status: concluido

- [x] Confirmar criação da branch `feature/financeiro-exportacao-pdf-png` a partir de `development`
- [x] Validar baseline de testes do módulo financeiro em `apps/api` (`npx jest src/modules/financeiro`)
- [x] Critério de validação da etapa: Branch de feature ativa e testes atuais do módulo financeiro passando sem erros (`npm.cmd test -w apps/api -- src/modules/financeiro`: 10 passed / 10 total, exit code 0).

### Etapa 1 - DTOs, Filtro Textual e Preparação de Dados de Exportação (Backend)
Status: planejado

- [ ] Criar `apps/api/src/modules/financeiro/dto/export-financeiro.dto.ts`:
  - [ ] Declarar `formato` (`'pdf' | 'png'`) e `pagina` (`number | 'todas'`) com validação `class-validator` / `@Transform`
  - [ ] Declarar filtros opcionais (`startDate`, `endDate`, `status`, `type`, `accountId`, `categoryId`, `eventoId`, `memberId`, `recurringGroupId`, `description`, `_t`)
- [ ] Atualizar `apps/api/src/modules/financeiro/financial-transactions.service.ts`:
  - [ ] Suportar filtro textual normalizado `description` (sem acentos, equivalente a `matchTransactionSearch`) em `findAll` e na consulta da exportação
  - [ ] Implementar método auxiliar `prepareExportData(tenantId, query, actor)` validando `ensureCanAccessFinanceData`, buscando transações ordenadas cronologicamente (`asc`), obtendo `getSummary`, consultando `tenant` (`nome`, `logoUrl`) e calculando `filteredSummary` + `appliedFilterLabels` quando `hasNarrowFilters === true`
  - [ ] Lançar `NotFoundException` quando não houver lançamentos para exportar
- [ ] Atualizar `apps/api/src/modules/financeiro/financial-transactions.service.spec.ts`:
  - [ ] Testar filtro textual `description` em múltiplos campos (descrição, categoria, membro, evento, pagamento)
  - [ ] Testar cálculo de `filteredSummary` vs resumo geral com e sem filtros avançados
  - [ ] Testar bloqueio RBAC (`403 Forbidden`) para usuário sem permissão financeira e `404` para lista vazia
- [ ] Critério de validação da etapa: `npx jest src/modules/financeiro/financial-transactions.service.spec.ts` passando 100% e `npm.cmd run build -w apps/api` sem erros.

### Etapa 2 - Renderizador PDF/PNG e Endpoint `/api/financeiro/exportacao` (Backend)
Status: planejado

- [ ] Criar tipos do documento financeiro em `apps/api/src/modules/financeiro/export/financeiro-document.types.ts`:
  - [ ] Definir `FinanceiroDocumentInput`, `FinanceiroDocumentItem`, `FinanceiroDocumentSummary`, `FinanceiroFilteredSummary` e `FinanceiroPngPage`
- [ ] Criar renderizador em `apps/api/src/modules/financeiro/export/financeiro-document-renderer.service.ts`:
  - [ ] Reutilizar `ChromiumRendererService`, `DocumentCacheService`, `TenantLogoService`, `renderBaseDocumentStyles`, `renderDocumentHeader` e `escapeHtml` de `apps/api/src/common/export/`
  - [ ] Implementar renderização **PDF (A4 paisagem)** com cabeçalho oficial, cards do resumo do período, faixa de filtros ativos + subtotal filtrado (quando aplicável), tabela de lançamentos (`Data`, `Liquidação`, `Descrição`, `Parcela`, `Tipo`, `Status`, `Conta`, `Categoria`, `Valor`) e rodapé Lookup Labs / One Elo
  - [ ] Implementar paginação (`FINANCEIRO_PNG_ITEMS_PER_PAGE = 15`) e renderização **PNG (`1080px` vertical)** suportando seleção unitária (`pagina=N`) e lote (`pagina=todas`)
  - [ ] Implementar `computeEtag`, validação de página inválida (`400 BadRequestException`) e suporte completo a `304 Not Modified` / cache LRU
- [ ] Atualizar `apps/api/src/modules/financeiro/financeiro.module.ts`:
  - [ ] Importar `ExportModule` e registrar `FinanceiroDocumentRendererService`
- [ ] Atualizar `apps/api/src/modules/financeiro/financeiro.controller.ts`:
  - [ ] Adicionar `@Get('exportacao')` aceitando `ExportFinanceiroDto`, lendo `if-none-match` e retornando headers `X-Document-Page-Count`, `ETag`, `Cache-Control: private, max-age=0, must-revalidate` e payload binário/JSON/`304`
- [ ] Criar `apps/api/src/modules/financeiro/export/financeiro-document-renderer.service.spec.ts`:
  - [ ] Testar paginação determinística em blocos de 15 itens e erro de página fora do intervalo
  - [ ] Testar inclusão condicional do bloco de subtotal filtrado e sanitização `escapeHtml` contra XSS no HTML gerado
  - [ ] Testar cache HIT / `304 Not Modified` por `ETag` e renderização simulada com mock de Playwright para PDF e PNG (unitário e lote)
- [ ] Critério de validação da etapa: Todos os testes em `apps/api` (`npx jest src/modules/financeiro`) e `npm.cmd run build -w apps/api` passando com exit code 0.

### Etapa 3 - Generalização Segura do Fluxo Compartilhado (`ExportShareDialog` & `useDocumentShare`) (Frontend)
Status: planejado

- [ ] Atualizar `apps/web/src/components/app/export-share-dialog.tsx`:
  - [ ] Adicionar props opcionais para customização de textos da etapa de seleção de página (`pageSelectTitle`, `itemCountSingular`, `itemCountPlural`, `allPagesLabel`, `allPagesDescriptionSuffix`, `generateSinglePageLabel`, `generateAllPagesLabel`) preservando integralmente os defaults atuais de Escalas e Agenda
- [ ] Atualizar `apps/web/src/hooks/use-document-share.ts`:
  - [ ] Adicionar opção `skipPageStepWhenSingle?: boolean` para acionar diretamente a geração de PNG único quando `weeklyOptions.length <= 1` sem exibir etapa desnecessária de seleção de página
  - [ ] Aceitar `defaultPngSelection?: PngWeekSelection` (permitindo iniciar em `1` em listagens paginadas) e preservar exatamente o comportamento padrão em Escalas e Agenda
- [ ] Criar `apps/web/src/lib/export-financial-pages.ts`:
  - [ ] Implementar `buildFinancialExportPageOptions(transactions, itemsPerPage = 15)` gerando rótulos legíveis por bloco/período e contagem de lançamentos
- [ ] Critério de validação da etapa: `npx -w apps/web tsc --noEmit` passando sem erros e Escalas/Agenda mantendo exatamente os mesmos textos e fluxo.

### Etapa 4 - Migração de `/financeiro/visualizacao` para Exportação Unificada (Frontend)
Status: planejado

- [ ] Atualizar `apps/web/src/app/(dashboard)/financeiro/financeiro-shared.tsx`:
  - [ ] Adicionar `description?: string` em `FinanceiroQueryFilters` e enviar `description` quando preenchido em `buildTransactionsUrl` para paridade com o backend (mantendo filtragem reativa fluida)
- [ ] Atualizar `apps/web/src/app/(dashboard)/financeiro/visualizacao/page.tsx`:
  - [ ] Substituir o botão `Imprimir` no `PageHeader` pelo botão padrão de ícone `Share2` (`Compartilhar`, com `LoaderCircle` durante exportação)
  - [ ] Remover `handlePrint`, estado `printedAt` e todo o bloco HTML legado `.print-area.print-document` (e imports não mais utilizados de `PrintDocumentHeader`/`PrintScheduleFooter`)
  - [ ] Integrar `useDocumentShare` com `endpoint: '/api/financeiro/exportacao'`, filtros ativos, `pageOptions` via `buildFinancialExportPageOptions`, `defaultPdfFileName` contextual ao período, `skipPageStepWhenSingle: true` e `resetDependencies: [filteredTransactions, appliedTransactionFilters]`
  - [ ] Renderizar `<ExportShareDialog />` (com labels financeiros: *"Selecionar página"*, *"lançamento"/"lançamentos"*, *"Todas as páginas"*, *"Gerar imagem da página"*), `<ExportSharePreparedBanner />` e `<ExportShareErrorBanner />`
- [ ] Verificar visualmente em `/escalas/visualizacao` e `/agenda/visualizacao` que nenhuma classe/componente compartilhado sofreu regressão
- [ ] Critério de validação da etapa: `npx -w apps/web tsc --noEmit` e `npm.cmd run build -w apps/web` sem erros; `/financeiro/visualizacao` exportando PDF e PNG no padrão ODS sem botão `Imprimir` legado.

### Etapa 5 - Validação Integrada, Testes E2E e Atualização da Documentação
Status: planejado

- [ ] Executar bateria de testes do backend (`npm.cmd test -w apps/api`)
- [ ] Executar typecheck (`npx -w apps/web tsc --noEmit`), lint dos arquivos alterados e builds de produção (`npm.cmd run build -w apps/api` e `npm.cmd run build -w apps/web`)
- [ ] Executar validação funcional integrada (desktop `1280px+` e mobile `390x844`):
  - [ ] Extrato sem filtros extras gerando PDF e PNG com cabeçalho, logo, resumo completo do período e tabela ordenada
  - [ ] Extrato com filtro avançado ativo (ex.: `type=EXPENSE` ou busca textual `description`) exibindo filtros aplicados e subtotal exato dos lançamentos no documento
  - [ ] Extrato com mais de 15 lançamentos exibindo seleção por página e exportando todas as imagens (`pagina=todas`) sem erros
  - [ ] Validação de RBAC confirmando bloqueio para usuários sem permissão financeira (`403`) e acesso liberado para `FINANCE_VIEWER`+
- [ ] Atualizar documentação do backlog e plano:
  - [ ] Marcar `IMP-010` como `implementado` em `ai-context/backlog/improvements.md`
  - [ ] Atualizar status de `IMP-010` e `FT-014` em `ai-context/backlog/README.md` e `ai-context/backlog/financeiro-patrimonial.md`
  - [ ] Marcar plano como `concluido` em `ai-context/plans/financeiro-exportacao-pdf-png-plan.md` e registrar em `ai-context/plans/README.md`
- [ ] Critério de validação da etapa: Todos os builds e testes relevantes passando com exit code 0, validação desktop/mobile concluída e documentação sincronizada.

---

## 5. Critérios de Aceite Gerais

- [ ] O botão legado `Imprimir` (`window.print()`) e o HTML estático `.print-area` foram removidos de `/financeiro/visualizacao`, substituídos pelo botão `Compartilhar`, `ExportShareDialog` e banners ODS.
- [ ] O endpoint `GET /api/financeiro/exportacao` respeita rigorosamente RBAC financeiro (`FINANCE_VIEWER`+) e isolamento por `tenantId`, suportando `pdf` e `png` (`pagina=N` ou `todas`) com cache `ETag` (`304 Not Modified`).
- [ ] Todos os filtros ativos da tela (`startDate`, `endDate`, `status`, `type`, `eventoId`, `memberId`, `description`) produzem paridade exata entre os itens exibidos na lista e os itens exportados no PDF/PNG.
- [ ] O documento exportado exibe o resumo financeiro do período (Saldo Inicial, Entradas, Saídas, Saldo, A Receber/A Pagar) quando sem filtros específicos e inclui o bloco de **Filtros Aplicados & Subtotal Filtrado** sempre que filtros avançados estiverem ativos.
- [ ] A experiência em `/escalas/visualizacao` e `/agenda/visualizacao` permanece 100% preservada em comportamento e copy após a generalização opcional do `ExportShareDialog` e `useDocumentShare`.
- [ ] Todos os testes unitários do módulo financeiro, `tsc` e builds de produção (`apps/api` e `apps/web`) passam sem erros ou regressões.
