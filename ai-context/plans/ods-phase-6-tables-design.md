# Fase 6: Design de Tabelas e Listagens (ODS)

Este documento estabelece o design arquitetural oficial das Tabelas, Listagens e Grids do OneElo, e define as decisões necessárias para executar a migração (Fase 6), baseadas nos apontamentos da auditoria de Pré-Análise.

---

## Decisões Arquiteturais

### Decisão 1: DataTable
**Decisão:** **Aprovado.** Deve existir.
* **Responsabilidades:** Encapsular toda a marcação HTML de tabela (`<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>`), iterar sobre os dados e renderizar as células de forma padronizada.
* **Problemas que resolverá:** Erradicará as centenas de linhas de CSS redundante (`px-4 py-3 text-left font-bold text-gray-500 uppercase`, etc.) espalhadas pelas páginas, garantindo que qualquer alteração de tipografia do ODS no futuro seja refletida instantaneamente em todo o sistema.
* **Telas que utilizarão:** Painel Super Admin (Tenants e Usuários) e Visualização de Membros.

### Decisão 2: TableToolbar
**Decisão:** **Rejeitado.** (Não deve existir como componente acoplado).
* **Justificativa:** O OneElo já estabilizou o uso do `FilterShell` (Fase 4) e `ExportShell` (Fase 3). Esses componentes operam de forma independente acima das listagens, controlando o estado da URL e CSV. Criar um `TableToolbar` acoplado geraria conflito arquitetural com as fundações anteriores e engessaria layouts que possuem apenas grid de cards (sem tabela), mas que ainda necessitam de filtros. A barra de busca e ações permanecerá solta/modularizada usando flexbox.

### Decisão 3: EmptyState
**Decisão:** **Aprovado.** Deve existir.
* **Obrigatoriedade:** Deve ser obrigatório sempre que uma tabela ou grid retornar um array vazio (`length === 0`).
* **Ações:** Deve aceitar (de forma opcional) botões de ação, como "Limpar Filtros" ou "Criar Novo Registro", permitindo que o usuário escape do estado vazio sem precisar buscar os botões no topo da página.

### Decisão 4: LoadingState
**Decisão:** **Aprovado.** Deve existir.
* **Skeleton Genérico ou Especializado?** Especializado. Devemos criar o `TableSkeleton` (que imita linhas de tabela realistas) e o `CardSkeleton` (que imita grids), para substituir a sujeira visual dos `[1, 2, 3].map(...)` espalhados nos arquivos.

### Decisão 5: Responsividade
**Decisão:** **Padrão B (Tabela desktop + EntityCard mobile).**
* **Justificativa Técnica:** Tabelas complexas (como Membros, que possui 5 colunas) quebram inevitavelmente em telas de smartphones. Permitir *overflow* horizontal causa uma péssima experiência (o usuário perde o contexto da primeira coluna). A abordagem oficial será o componente `DataTable` aceitar uma prop `renderMobileCard`. No Desktop, a tabela HTML nativa será exibida. No Mobile, a tabela será oculta e iteraremos os mesmos dados num formato visual de lista (`EntityCard`), sem a necessidade de duplicar lógicas de iteração no arquivo principal (como acontece hoje).

### Decisão 6: EntityCard
**Decisão:** **Aprovado.** Deve existir.
* **Cenários e Módulos:**
  1. Como *fallback* responsivo para listagens de `DataTable` em smartphones (ex: Membros).
  2. Como componente principal de renderização nativa de entidades em *Grids* (Módulos de **Agenda**, **Ministérios** e **Minhas Escalas**), substituindo as dezenas de `divs` sombreadas construídas à mão nestas páginas.

### Decisão 7: Escalas
**Decisão:** **A Matriz de Escalas NÃO utilizará o DataTable.**
* **Justificativa:** A tela de criação/edição de escalas não é um CRUD tabular tradicional. Trata-se de uma matriz tridimensional dinâmica cruzando dias, funções e membros (com suporte drag and drop em potencial futuro e lógica massiva de React states). Forçar isso para dentro de um `DataTable` genérico amarraria o layout e fatalmente quebraria a UX flexível de escalas. Ela permanecerá sendo uma estrutura customizada.

---

## Estratégia de Migração

A ordem de migração é estabelecida pelo menor risco de quebra de regras de negócio em tela:

1. **Admin (Baixo Risco):** Tabelas simples de Tenants e Usuários. Não exigem responsividade extrema nem callbacks complexos. Servirão para homologar o `DataTable`.
2. **Membros (Médio Risco):** A visualização de membros consolidará a estratégia de Responsividade Oficial (Tabela Desktop + Card Mobile via prop).
3. **Agenda e Ministérios (Baixo Risco):** Substituição de cartões manuais (`divs`) pelo novo `EntityCard` em grids flexíveis. Aplicação dos `EmptyStates` e `CardSkeletons`.
4. **Escalas (Alto Risco):** Alterar apenas a listagem secundária e painéis (Minhas Escalas, Histórico). **Ignorar a matriz principal de criação**.
5. **Demais Módulos:** Aplicação massiva de `EmptyState` e skeletons de carregamento onde faltar.

---

## ODS Compliance Estimado

| Métrica | Situação Atual | Após Fase 6 |
|---|---|---|
| **Tabelas e Listagens** | ~20% | **~95%** |
| Adendo | O gap de 5% diz respeito à matriz intocável de Escalas, considerada regra de negócio em vez de tabela comum. |

---

## Complexidade, Riscos e Ganhos

* **Complexidade Geral:** **Média**. Não afeta hooks lógicos ou mutações (já resolvidos na Fase 5), sendo puramente transformações de abstração JSX (HTML `table` para React Component).
* **Risco Principal:** Quebrar colunas em telas médias (Tablets). Garantir que o ponto de quebra para o CardMobile seja configurável ou bem estabelecido (ex: no breakpoint `md` ou `lg`).
* **Ganho Esperado:** Consistência estética final no "coração" do painel de dados. Telas mais limpas, tipograficamente corretas segundo as guidelines do ODS.
* **Redução de Código Estimada:** Remoção de **300 a 450 linhas** de JSX estático redundante (Skeletons, `thead`, layouts mobile duplicados manualmente na mesma view).

---

## Respostas Finais

1. **Quais componentes devem ser criados?** 
   `DataTable`, `EmptyState`, `TableSkeleton`, `CardSkeleton` e `EntityCard`.
   
2. **Quais telas migrar primeiro?** 
   `admin/page.tsx` (Tabelas canônicas simples), em seguida `membros/visualizacao/page.tsx` (Validação do fallback mobile responsivo).
   
3. **A matriz de escalas entra ou não no DataTable?** 
   **NÃO.** A matriz é uma visualização híbrida de negócio complexa e deve permanecer customizada.
   
4. **Qual o ganho esperado de aderência ao ODS?** 
   Pular de ~20% para a marca de **~95%** no escopo de Tabelas e Listagens.
