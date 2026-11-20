# Backlog - Exportação para Excel (.xlsx) além de CSV

### FT-024 Habilitar Exportação para Excel (`.xlsx`) nas Telas de Exportação

- **Prioridade**: média (produtividade administrativa, secretaria e tesouraria)
- **Status**: pendente
- **Fase**: evolução da experiência de exportação (complementa o `EXPORT_STANDARD.md`)
- **Categoria**: produto / UX / ODS / exportação
- **Esforço estimado**: baixo a médio
- **Contexto**: hoje, os cinco módulos exportáveis (`/membros/exportacao`, `/ministerios/exportacao`, `/escalas/exportacao`, `/agenda/exportacao` e `/financeiro/exportacao`) utilizam o componente compartilhado `ExportShell` (`apps/web/src/components/app/export-shell.tsx`) e o hook `useExport` (`apps/web/src/hooks/use-export.ts`), que geram apenas arquivo `.csv`. A própria interface do `ExportShell` já exibe a opção **`XLSX (em breve)`** desabilitada. Muitas igrejas enfrentam atrito ao abrir `.csv` diretamente no Microsoft Excel em Windows/Mac por questões de codificação/separador (`;` vs `,`), perda de formatação de datas/moedas ou desalinhamento de colunas. Além disso, o backend (`apps/api`) já possui o `exceljs` instalado para a geração da planilha modelo da `FT-016`.

- **Ação**: habilitar o formato **Excel (`.xlsx`)** em todo o fluxo de exportação compartilhado do sistema:

  1. **Componente Compartilhado e Hook (`ExportShell` e `useExport`):**
     - Tornar o seletor de formato (`CSV` × `XLSX`) ativo e controlado (`format: 'csv' | 'xlsx'`), removendo o badge `(em breve)` e ajustando o rótulo do botão de ação (`"Exportar CSV"` / `"Exportar Excel (.xlsx)"`).
     - Manter `CSV` intacto e funcional para todos os módulos e preservar a seleção dinâmica de campos (`selectedFields`) também na geração do `.xlsx`.

  2. **Geração Nativa de Planilha Excel (`exceljs` sem onerar bundle do browser):**
     - Preferir geração no backend (`apps/api`) reutilizando a biblioteca `exceljs` já existente (evitando adicionar dependência pesada no bundle client-side do Next.js) ou helper isolado conforme arquitetura definida no plano.
     - Aplicar **formatação real de planilha Excel** nos dados exportados:
       - Linha de cabeçalho estilizada com congelamento (`freeze`) e filtro automático ativado;
       - Auto-ajuste proporcional de largura das colunas;
       - **Tipagem nativa de células**: valores monetários em formato numérico contábil/moeda (`R$ #,##0.00`) no módulo Financeiro para permitir somas e fórmulas imediatas no Excel, e datas reais formatadas (`dd/mm/yyyy`);
       - Proteção contra *Formula Injection* (sanitização de textos iniciados com `=`, `+`, `-`, `@`).

  3. **Segurança, RBAC e Cobertura nos 5 Módulos:**
     - Garantir paridade rigorosa de permissões e isolamento por `tenantId` em todas as rotas de exportação, com destaque para `/financeiro/exportacao` (`FinancePermission` / `FINANCE_VIEWER`+);
     - Cobrir os 5 pontos existentes de exportação:
       - `/membros/exportacao`
       - `/ministerios/exportacao`
       - `/escalas/exportacao`
       - `/agenda/exportacao`
       - `/financeiro/exportacao`

  4. **Documentação ODS (`ai-core`):**
     - Atualizar `ai-core/skills/oneelo-design-system/EXPORT_STANDARD.md` refletindo o suporte oficial aos dois formatos (`CSV` e `XLSX`).

- **Impacto**: elimina erros de abertura de CSV no Excel, entrega planilhas prontas para conferência e cálculos na tesouraria e secretaria (especialmente no Financeiro e Membros) e conclui a opção `XLSX` já prometida visualmente na UI.
