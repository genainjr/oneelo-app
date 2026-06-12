# Pré-Análise: Fase 6 - Tabelas e Listagens (ODS)

## Objetivo
Analisar as estruturas atuais de exibição de dados tabulares e em formato de listagem no OneElo, identificando níveis de duplicação, responsividade e viabilidade de unificação via componentes do OneElo Design System (ODS).

---

## 1. Inventário Completo

### A. Telas Administrativas (Admin)
* **Local:** `admin/page.tsx`
* **Tipo:** Tabelas HTML cruas (`<table className="w-full text-sm">`).
* **Casos:** Tabela de Tenants e Tabela de Usuários por Tenant.
* **Colunas:** 3 a 5 colunas.
* **Recursos:** Sem paginação, sem ordenação. Ações na última coluna (Editar/Excluir).
* **Mobile:** Comportamento nativo de tabela (arriscado, possível quebra ou compressão forçada).

### B. Visualização de Membros
* **Local:** `membros/visualizacao/page.tsx`
* **Tipo:** Híbrido (Tabela HTML no Desktop / Cards em Mobile).
* **Colunas:** 5 colunas (Nome, Contato, Status, Ministérios, Nascimento).
* **Recursos:** Filtros já migrados (ODS), sem paginação, sem ordenação.
* **Mobile:** Utiliza um wrapper `<div className="md:hidden">` renderizando cards brancos com `flex` e `border-b` manualmente.

### C. Gestão de Membros (Administração)
* **Local:** `membros/page.tsx`
* **Tipo:** Grid de Cards (`grid-cols-1 md:grid-cols-3`).
* **Recursos:** Exibição através de cartões (Cards) com botões e tags integradas. Filtros migrados. Sem paginação.

### D. Agenda e Ministérios
* **Local:** `agenda/page.tsx` e `ministerios/page.tsx`
* **Tipo:** Grid de Cards (`grid-cols-1 md:grid-cols-3`).
* **Recursos:** Cartões interativos. O card de ministério contém métricas (líderes, membros). O card de agenda exibe datas. Filtros migrados.

### E. Escalas
* **Local:** `escalas/page.tsx` (e `/visualizacao`)
* **Tipo:** Grid de Cards para listagem principal, e uma **Matriz Customizada** (`<table>`) para a visualização da edição de escalas.
* **Recursos:** A matriz possui colunas dinâmicas (dias) e linhas (funções). É o layout mais complexo do sistema.

---

## 2. Duplicações Encontradas

* **Tabelas HTML:** As tags `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>` são declaradas manualmente em `admin`, `membros/visualizacao` e `escalas`.
* **Classes CSS Repetidas:** `px-4 py-3 text-left text-xs font-bold uppercase text-gray-500` repete-se em todos os cabeçalhos de tabela do sistema.
* **Empty States:** A verificação `items.length === 0` com um bloco de "Nenhum item encontrado" é recriada manualmente ou parcialmente importada em 6 arquivos diferentes.
* **Loading States:** O padrão `animate-pulse` iterando um array fake `[1, 2, 3]` para criar esqueletos (Skeletons) de carregamento foi mapeado como copiado/colado em `ministerios`, `membros`, `minhas-escalas` e `escalas`.
* **Badges de Status:** O mapeamento de cores (ex: `STATUS_MEMBRO_COLOR`) é renderizado cru via `<span>` arredondado na listagem.

*Estimativa de duplicação: Alta. O boilerplate de exibição representa cerca de 15% do JSX das telas consultadas.*

---

## 3. Problemas de UX e Responsividade

* **Ausência de Paginação e Ordenação:** Nenhuma tabela atual possui paginação explícita ou cabeçalhos ordenáveis (sort), forçando scroll infinito nativo ou limite fixo da API.
* **Responsividade Híbrida Manual:** Em vez de a tabela saber se comportar em telas menores, o código injeta a tabela dentro de um `hidden md:block` e cria toda a listagem de novo no formato de lista usando `md:hidden`. Isso duplica o peso do DOM renderizado no React e dificulta a manutenção em caso de inclusão de novas colunas.
* **Overflow de Ações:** Botões de ação em tabelas comprimidas (Admin) podem colidir em tablets se o conteúdo das colunas vizinhas for muito extenso.

---

## 4. Padrões Existentes e Complexidade

| Padrão | Quantidade de Usos | Complexidade |
|---|---|---|
| Tabelas Simples (CRUD Admin) | 2 telas | **Baixa** |
| Tabela de Leitura (Membros) | 1 tela | **Baixa/Média** (devido ao mobile) |
| Matriz de Escala | 1 tela | **Alta** (não é uma tabela comum) |
| Grids / Entity Cards | 5 telas | **Baixa** |

---

## 5. Componentes Compartilháveis (Candidatos ao ODS)

1. **`DataTable`:** **MANDATÓRIO.** Vai encapsular o layout HTML (`table`, `thead`, `tbody`) e as lógicas de renderização. Vai aceitar uma prop `columns` e `data`, erradicando as repetições de JSX em `admin` e `membros`.
2. **`EmptyState`:** **MANDATÓRIO.** Um componente visual padronizado (`title`, `description`, `icon`) a ser consumido por listas, filtros sem resultado e tabelas vazias.
3. **`LoadingState` / `SkeletonList`:** **MANDATÓRIO.** Para limpar os mapeamentos manuais de `[1,2,3].map()` que sujam as Views durante as buscas da API.
4. **`StatusBadge`:** **RECOMENDADO.** Para unificar a exibição das tags de situação (Ativo, Inativo, etc).
5. **`EntityCard`:** **RECOMENDADO.** Componente auxiliar de container para `agenda`, `membros` e `ministerios`, para não repetirmos os `div` de sombra e padding, e para uso como *fallback* mobile do DataTable.
6. **`TablePagination`:** *OPCIONAL (por agora)*. Visto que as lógicas atuais do sistema não possuem states de paginação paginada (offset/limit expostos na UI), criar o componente exigiria alterar regras de negócio.

---

## 6. Estratégia de Migração Recomendada

A migração deve ser atacada substituindo o "pão com manteiga" primeiro, sem encostar nas visualizações customizadas complexas.

1. **Baixo Risco (Começar por aqui):** Telas do Painel `Admin` (Super Admin). São tabelas simples sem variação mobile profunda.
2. **Médio Risco (Segundo Passo):** Tela de `membros/visualizacao`. Vai validar se o nosso `DataTable` consegue injetar a visualização mobile (Cards) ou omitir colunas responsivamente, extinguindo os blocos duplos do arquivo.
3. **Baixo Risco (Terceiro Passo):** Refatorar os "Grids" (Agenda, Ministérios, Membros) para consumirem `EntityCard`, `EmptyState` e os esqueletos de loading (`LoadingState`).
4. **Alto Risco (Não Migrar o Layout Core):** A tela `escalas/page.tsx` utiliza uma tabela como matriz de Excel. **Não deve** ser enquadrada no `DataTable` padrão, pois quebraria a lógica arrastar/soltar dinâmica de escalas.

---

## 7. ODS Compliance

* **Aderência Atual (Tabelas e Listagens):** ~20%
* **Aderência Esperada (Pós-Fase 6):** ~95%
* A única margem restante são matrizes exclusivas da lógica de negócio (como Escalas).

---

## 8. Ganhos e Redução de Código

* **Ganhos:** Experiência de visualização estrita, robustez para o usuário final, e tabelas que não quebram o layout do dashboard quando manipuladas num iPad/Celular.
* **Redução de Código:** Cerca de **300 a 450 linhas** de formatações de HTML `table` e renderizações de Skeletons sendo deletadas em favor de props simples no `DataTable`.

---

## Respostas Finais

1. **Vale a pena criar um DataTable oficial do ODS?**
   **Sim, absolutamente.** É o gargalo visual principal após os modais. Eliminará repetições longas de CSS no HTML e unificará o padrão de cores dos cabeçalhos.
   
2. **Vale a pena criar componentes auxiliares?**
   **Sim.** `EmptyState` e utilitários de carregamento (`SkeletonList`) limparão a poluição visual dos `[1, 2, 3].map` em 6 módulos distintos.

3. **Quais telas devem migrar primeiro?**
   O Super Admin (`admin/page.tsx`) por ser uma tabela padrão imutável sem dualidade mobile, seguido por `membros/visualizacao` para testar o fallback responsivo. As matrizes de `escalas` não devem usar o `DataTable`.

4. **Qual o ganho esperado de aderência ao ODS?**
   Elevação de 20% para ~95% em listagens, garantindo assim que a interface principal do projeto esteja solidificada na Fase 6, alinhando a aplicação às expectativas globais.
