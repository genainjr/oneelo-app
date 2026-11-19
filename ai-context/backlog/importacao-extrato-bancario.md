# Backlog - Importação de Extratos Bancários e Conciliação Financeira

### FT-023 Importação de Arquivos Financeiros Exportados do Banco e Conciliação (OFX / CSV / XLSX)

- **Prioridade**: média-alta (produtividade da tesouraria e confiabilidade do caixa)
- **Status**: pendente
- **Fase**: evolução operacional do módulo financeiro (expande a Entrega 9 de [FT-014](financeiro-patrimonial.md))
- **Categoria**: produto / financeiro / ingestão de dados / conciliação
- **Esforço estimado**: médio
- **Contexto**: tesoureiros de igrejas precisam lançar dezenas ou centenas de movimentações bancárias mensais manualmente (tarifas bancárias, contas pagas no débito automático, PIX de dízimos/ofertas sem comprovante anexado e rendimentos), o que consome horas e abre margem para erros de digitação e divergência com o saldo real do banco. A base do módulo financeiro já possui contas (`FinancialAccount`), categorias (`FinancialCategory`), lançamentos pendentes (`PENDING` da Entrega 6.1) e o padrão consolidado de importação com preview *dry-run* da [FT-016](importacao-membros-planilha.md).

- **Ação**: implementar fluxo completo de importação de extratos bancários com conciliação assistida em `/financeiro`:

  1. **Formatos Suportados (Padrão Bancário Brasileiro):**
     - **OFX (Open Financial Exchange):** parser resiliente em memória (suporte a OFX SGML 1.x e XML 2.x usados por Itaú, Banco do Brasil, Bradesco, Santander, Caixa, Sicoob, Sicredi, Cora e Banco Inter), extraindo `FITID`, `DTPOSTED`, `TRNAMT`, `TRNTYPE` e `MEMO`.
     - **CSV / XLSX:** suporte a extratos exportados por bancos digitais (Nubank, Inter, Cora, Mercado Pago, Stone/PagBank) com detecção de encoding (`UTF-8` / `ISO-8859-1`), separador (`;` / `,`) e mapeamento simples de colunas (`Data`, `Descrição`, `Valor` ou colunas separadas de `Entrada`/`Saída`).

  2. **Wizard com Preview Antecipado (*Dry-Run*) e Anti-Duplicidade:**
     - **Passo 1 (Upload):** Seleção da conta bancária de destino (`FinancialAccount`) e envio do arquivo (em memória, sem escrita em disco).
     - **Passo 2 (Conferência e Conciliação Assistida):** Classificação automática das linhas do extrato em três blocos claros:
       - **Já Conciliados / Duplicados (Ignorados automaticamente):** detectados por `externalId` (`FITID` do OFX) ou hash determinístico `(tenantId, accountId, date, amount, memoNormalized)`, permitindo importar extratos semanais/parciais no mesmo mês sem risco de duplicar lançamentos.
       - **Vínculos Sugeridos (Dar Baixa em Pendências):** cruzamento automático com lançamentos `PENDING` (contas recorrentes/parceladas da Entrega 6.1 ou comprovantes de dízimo da FT-021) com mesmo tipo (`INCOME`/`EXPENSE`), valor compatível e data próxima (`± 3` dias), permitindo confirmar e dar baixa no lançamento existente em vez de criar um novo.
       - **Novas Movimentações do Extrato:** linhas inéditas editáveis na prévia (selecionar `FinancialCategory`, opcionalmente vincular membro quando identificado no `MEMO` de PIX recebido, ou desmarcar itens como resgates/aplicações internas).
       - **Sugestão Inteligente de Categoria:** autopreenchimento opcional baseado em histórico anterior de descrições semelhantes do mesmo tenant.
     - **Passo 3 (Execução Atômica e Auditoria):** persistência única dentro de `prisma.$transaction`, preenchendo `paidAt` com a data bancária e gravando registro consolidado em `AuditLog`.

  3. **Governança, RBAC e Rastreabilidade:**
     - Restrito a perfis financeiros autorizados (`FINANCE_APPROVER` / `FINANCE_MANAGER` para importar já `CONFIRMED` e liquidar pendências; `FINANCE_OPERATOR` limitado a rascunho/pendente caso permitido pela política do tenant).
     - Campo de referência externa (`externalTransactionId` / `importHash` com índice único parcial por `tenantId` + `accountId`) no modelo `FinancialTransaction` e registro do lote importado (`BankStatementImport`) preservando histórico e auditoria.

- **Impacto**: elimina a redigitação do extrato bancário na tesouraria, garante que o saldo do OneElo feche exatamente com o banco e integra nativamente contas a pagar/receber pendentes e dízimos via PIX com o extrato real.

---

## Referências e Conexões no Sistema

- **Entrega 9 da FT-014:** [financeiro-patrimonial.md](financeiro-patrimonial.md#L331-L352)
- **Padrão de Importação Dry-Run (FT-016):** [importacao-membros-planilha.md](importacao-membros-planilha.md)
- **Dízimos e Ofertas Digitais (FT-021):** [dizimos-ofertas-pix-comprovantes.md](dizimos-ofertas-pix-comprovantes.md)
