# Pré-Análise ODS — Fase 4: Filtros

---

## Estado Atual dos Filtros

Foram identificadas **6 telas** com implementação de filtros no sistema. Os módulos de Configurações e Super Admin **não possuem** filtros nativos.

| # | Tela | Arquivo | Campos de Filtro | Tipo(s) | Componente ODS? | Duplicação |
|---|---|---|---|---|---|---|
| 1 | Membros (gestão) | `membros/page.tsx` | Nome (text), WhatsApp (text), Status (select), Tags (chip toggle) + operador AND/OR | `<form>` inline | ❌ Não | Alta |
| 2 | Membros (visualização) | `membros/visualizacao/page.tsx` | Nome (text), Status (select), Ministério (select), Mês aniversário (select), Sem telefone (checkbox) | `<form>` inline | ❌ Não | Alta |
| 3 | Escalas (gestão) | `escalas/page.tsx` | Mês (select), Ano (select), Ministério (select) | `<div>` inline (sem `<form>`) | ❌ Não | Alta |
| 4 | Escalas (visualização) | `escalas/visualizacao/page.tsx` | Ministério (select), Status (select), Mês (select), Ano (number), Pendentes (checkbox) | `<form>` inline | ❌ Não | Alta |
| 5 | Agenda | `agenda/page.tsx` | Status (select), Data início (date), Data fim (date) | `<form>` inline | ❌ Não | Alta |
| 6 | Ministérios | `ministerios/page.tsx` | — Nenhum filtro visual | — | — | — |
| 7 | Configurações | `configuracoes/page.tsx` | — Nenhum filtro visual (tabs, não filtros) | — | — | — |
| 8 | Super Admin | `admin/page.tsx` | — Nenhum filtro visual | — | — | — |

---

## Componentes Utilizados

### Componentes ODS existentes (criados na Fase 1)
- **`FilterShell`** (`src/components/app/filter-shell.tsx`): Wrapper `<form>` com bordas, padding e slot para botões de ação.
- **`FilterActions`** (`src/components/app/filter-shell.tsx`): Botões padronizados de "Aplicar", "Limpar" e "Recarregar" com ícones Lucide.

### Adoção Atual
**ZERO.** Nenhuma das 6 telas identificadas importa ou utiliza `FilterShell` ou `FilterActions`. Os componentes existem no diretório de componentes do app, mas estão completamente orfãos — sem nenhuma referência em nenhum arquivo do projeto.

---

## Componentes Duplicados

### Estruturas Repetidas (Alta Duplicação)

1. **Container de Filtro (`<form>` / `<div>` wrapper)**
   Cada tela cria manualmente seu próprio container branco com borda/sombra. Três estilos visuais distintos coexistem:
   - Estilo A (`membros`, `agenda`): `bg-white rounded-2xl border border-gray-100 shadow-sm p-5`
   - Estilo B (`membros/visualizacao`, `escalas/visualizacao`): `rounded-lg border border-gray-100 bg-white p-4`
   - Estilo C (`escalas`): `bg-white border border-gray-100 rounded-2xl px-5 py-4 shadow-xs` (sem `<form>`, aplicação instantânea via `useEffect`)

2. **Botões de Ação (Aplicar / Limpar / Recarregar)**
   Replicados em 5 telas com variações visuais significativas:
   - Membros/Agenda: `bg-gray-800` para "Aplicar" e `bg-gray-100` para "Limpar"
   - Visualizações: `bg-indigo-600` para "Filtrar" e `border border-gray-200` para "Limpar" + "Recarregar"
   - Escalas (gestão): Não há botões — filtros aplicam automaticamente via `useEffect`

3. **Labels de Campo**
   Duas convenções incompatíveis:
   - Convenção A: `text-xs font-semibold text-gray-500 uppercase tracking-wider`
   - Convenção B: `text-xs font-bold text-gray-500 uppercase` (sem tracking)

4. **Inputs / Selects**
   Estilos de input com 3+ variações:
   - `rounded-xl` com `bg-gray-50` (Membros, Agenda)
   - `rounded-lg` sem fundo (Visualizações)
   - `rounded-xl` com `bg-gray-50` (Escalas gestão)

5. **Estados Locais**
   Todos os módulos declaram manualmente:
   - `useState` por campo de filtro
   - `handleFilterSubmit(e)` com `e.preventDefault()` e chamada a `applyFilter({...})`
   - `handleClearFilters()` que reseta todos os estados e chama `applyFilter({})` com valores vazios

6. **Lógica de Limpeza**
   A função `handleClearFilters` / `clearFilters` é a maior fonte de duplicação lógica — cada tela escreve uma função de 5-10 linhas que zera seus próprios `useState` e re-executa o `applyFilter`.

---

## Oportunidades de Padronização

### Uso Atual
- `FilterShell`: **0 telas** (componente morto)
- `FilterActions`: **0 telas** (componente morto)

### Uso Potencial

| Tela | FilterShell | FilterActions | Complexidade de Migração |
|---|---|---|---|
| Membros (gestão) | ✅ Aplicável | ✅ Aplicável | **Média** — Tags com chips e operador AND/OR adicionam complexidade além do padrão |
| Membros (visualização) | ✅ Aplicável | ✅ Aplicável (com Recarregar) | **Baixa** — Filtros puramente padrão (text, select, checkbox) |
| Escalas (gestão) | ✅ Aplicável | ⚠️ Parcial — sem botão "Aplicar" (filtro instantâneo) | **Baixa** — Mas exige decisão sobre manter auto-apply vs submit |
| Escalas (visualização) | ✅ Aplicável | ✅ Aplicável (com Recarregar) | **Baixa** — Similar à membros/visualização |
| Agenda | ✅ Aplicável | ✅ Aplicável | **Baixa** — Padrão clássico submit/clear |

### Ganhos Esperados

- **Unificação visual:** Atualmente existem 3 estilos visuais distintos de painéis de filtro. Após a migração para `FilterShell`, todos os módulos compartilharão o mesmo container, bordas, espaçamento e semântica do `<form>`.
- **Botões consistentes:** Os 5 padrões diferentes de botões de ação (cor, ordem, ícones) serão substituídos pelo padrão unificado do `FilterActions` com ícones Lucide.
- **Eliminação de código morto:** Os componentes `FilterShell` e `FilterActions` deixarão de ser órfãos, justificando sua existência na base e garantindo coerência com os relatórios das fases anteriores.

---

## Ganho Estimado

- **Linhas de JSX duplicadas removidas:** ~150 a ~200 linhas (containers, labels, botões repetidos em 5 telas)
- **Estados e funções duplicadas:** ~50 a ~80 linhas (handleFilterSubmit, handleClear em 5 telas)
- **Redução percentual média por tela:** ~15% a ~20% (filtros representam uma fração menor do código total comparado à Fase 3)

---

## Complexidade

**Média.**

Justificativa:
- A maioria das telas possui filtros padrão (text + select + date) que se encaixam naturalmente no `FilterShell` — **baixa complexidade**.
- A tela de **Membros (gestão)** possui filtros avançados (tags com chips toggle dinâmicos, operador combinatório AND/OR, criação inline de tags via modal) que vão além do escopo padrão do `FilterShell` — **complexidade adicional**.
- A tela de **Escalas (gestão)** aplica filtros instantaneamente via `useEffect` ao invés de submit manual, exigindo uma decisão de design sobre manter o comportamento de auto-aplicação ou migrar para o padrão submit — **decisão de UX**.
- Há potencial para um hook compartilhado `useFilterState` que centralize o `useState` + `applyFilter` + `clear`, mas o risco de over-engineering é moderado dado que cada tela tem um mapeamento de campos distinto.

---

## Riscos

1. **Escalas com filtro instantâneo:** A tela de Escalas (gestão) não utiliza `<form>` — os selects disparam `applyFilter` diretamente via `useEffect`. Envolver em `FilterShell` (que é um `<form>`) pode introduzir submits indesejados se não for tratado.
2. **Tags em Membros:** A seção de tags com chips, operador AND/OR e modal de criação inline é um bloco de UI complexo que vive *dentro* do container de filtro mas não é um "campo de filtro" clássico. Precisa de decisão se fica dentro do `FilterShell` ou como um bloco separado abaixo dele.
3. **Inconsistência visual intencional vs acidental:** Algumas diferenças de estilo (arredondamento `rounded-xl` vs `rounded-lg`) podem ter sido intencionais para as páginas de visualização (mais compactas). A padronização pode alterar sutilmente a percepção visual dessas telas.
4. **FilterActions sem botão "Recarregar":** As páginas de visualização possuem botão "Recarregar" que já é suportado nativamente pelo `FilterActions` (`onReload`), mas é preciso confirmar se será mantido em todas as telas.

---

## Estratégia Recomendada

### Ordem de Migração (do menor risco ao maior)

| Prioridade | Tela | Justificativa |
|---|---|---|
| 1 | **Agenda** | Filtro mais simples (3 campos: select + date + date). Melhor candidata para validar o padrão. |
| 2 | **Membros (visualização)** | Filtros padrão (text + selects + checkbox). Boa cobertura de tipos. |
| 3 | **Escalas (visualização)** | Similar à anterior. Valida o botão "Recarregar" no FilterActions. |
| 4 | **Escalas (gestão)** | Requer decisão sobre auto-apply vs submit. Risco moderado. |
| 5 | **Membros (gestão)** | A mais complexa. Tags, chips, AND/OR. Deve ser a última para acumular aprendizados. |

### Telas com Maior Ganho
- **Membros (visualização)** e **Escalas (visualização)**: possuem a maior proporção filtro/código total e a menor complexidade de migração.

### Telas com Maior Risco
- **Membros (gestão)**: A seção de tags com criação inline, AND/OR, é atípica.
- **Escalas (gestão)**: Auto-apply via useEffect difere do padrão submit.

---

## Avaliação de UX

### Consistência Visual
- **Inconsistente.** As 5 telas usam 3+ combinações distintas de cores de botão, raios de borda e espaçamentos. O usuário experimenta uma interface fragmentada ao navegar entre módulos.

### Posicionamento dos Filtros
- **Consistente.** Todas as telas posicionam os filtros logo abaixo do `PageHeader` e acima da listagem de dados. Padrão adequado.

### Comportamento Mobile
- **Parcialmente responsivo.** As telas de gestão usam `grid-cols-1 md:grid-cols-4` que colapsa adequadamente. As telas de visualização usam `grid md:grid-cols-5` que pode comprimir os campos em tablets.

### Clareza dos Botões
- **Inconsistente.** "Aplicar" é `bg-gray-800` em algumas telas e `bg-indigo-600` em outras. O label varia entre "Aplicar", "Filtrar" e nenhum (auto-apply). A experiência difere conforme o módulo.

### Experiência do Usuário
- A ausência de padronização confunde o modelo mental do utilizador — cada módulo "ensina" uma interação ligeiramente diferente para a mesma tarefa (filtrar dados).

---

## Arquivos Potencialmente Impactados

| Arquivo | Ação |
|---|---|
| `src/components/app/filter-shell.tsx` | MODIFICAR (possivelmente expandir props) |
| `src/app/(dashboard)/agenda/page.tsx` | MODIFICAR (migrar filtros) |
| `src/app/(dashboard)/membros/page.tsx` | MODIFICAR (migrar filtros) |
| `src/app/(dashboard)/membros/visualizacao/page.tsx` | MODIFICAR (migrar filtros) |
| `src/app/(dashboard)/escalas/page.tsx` | MODIFICAR (migrar filtros) |
| `src/app/(dashboard)/escalas/visualizacao/page.tsx` | MODIFICAR (migrar filtros) |

---

## Respostas Finais

### A Fase 4 possui baixa, média ou alta complexidade?
**Média.** A maioria das telas (3 de 5) possui filtros padrão de baixa complexidade. Contudo, 2 telas requerem decisões de design (tags interativas e auto-apply) que elevam a complexidade geral.

### Qual o percentual estimado de aderência ao ODS após a conclusão desta fase?
Estimativa de **~85% de aderência ao ODS** após a conclusão da Fase 4. Os componentes fundacionais (ModalShell, ConfirmDialog, InputField, ExportShell, FilterShell, FilterActions) estarão todos em uso ativo. As áreas remanescentes de não-aderência serão os modais inline de Ministérios (que não usam ModalShell) e padrões avulsos de feedback/toast.

### É recomendável executar a implementação imediatamente?
**Sim, com ressalvas.** Recomenda-se primeiro gerar um **documento de design** (similar à Fase 3) para formalizar as decisões pendentes:
1. Manter ou não o auto-apply da tela de Escalas?
2. Tratar tags de Membros dentro ou fora do `FilterShell`?
3. Precisamos de um hook `useFilterState` genérico ou as funções `handleSubmit`/`clear` permanecem inline?

Após essas decisões, a implementação pode prosseguir de forma segura e incremental seguindo a ordem de migração proposta.
