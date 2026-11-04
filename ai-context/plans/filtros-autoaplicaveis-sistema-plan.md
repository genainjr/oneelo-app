# Plano - Filtros Autoaplicáveis Unificados e Adoção Universal do FilterShell (IMP-007+)

Status: concluído  
Data de criação: 2026-10-31  
Branch sugerida para implementação: `feature/filtros-autoaplicaveis-ods`  

## Planos e Referências Relacionados

- [OneElo Design System (ODS)](../../ai-core/skills/oneelo-design-system/README.md)
- [ODS - Padrão de Visualização](../../ai-core/skills/oneelo-design-system/VIEW_STANDARD.md)
- [ODS - Padrão CRUD](../../ai-core/skills/oneelo-design-system/CRUD_STANDARD.md)
- [ODS - Padrão de Formulários](../../ai-core/skills/oneelo-design-system/FORM_STANDARD.md)
- [ODS - Design da Fase 4: Filtros](ods-phase-4-filters-design.md)
- [Backlog - Melhorias Gerais e Débito Técnico](../backlog/improvements.md) (item IMP-007)

---

## 1. Contexto e Motivação

### O Problema do Botão "Filtrar" e Inconsistências
Historicamente, o sistema adotou um modelo híbrido com formulário manual e botão `Filtrar` / `Aplicar` para evitar requisições frequentes em campos de texto. Essa decisão gerou atritos conhecidos:
1. **Fricção de Uso (Cliques Desnecessários):** O usuário altera um dropdown ou checkbox e a tela não reage até ele clicar em "Filtrar".
2. **Condições de Corrida na Navegação (Bug do Dashboard):** Ao navegar para `/membros/visualizacao?aniversarioMes=10`, a tela frequentemente carregava os dados padrão antes de aplicar o parâmetro da URL, exigindo cliques manuais posteriores.
3. **Inconsistência Entre Telas:** Algumas telas mantiveram filtros manuais fora do padrão compartilhado (por exemplo, a aba de Auditoria em `/configuracoes`, que usava selects nativos sem `FilterShell`).

### O Novo Padrão: Reatividade com Debounce Universal
Com a introdução de **debounce em campos textuais** e **reatividade imediata em dropdowns/checkboxes/datas**, elimina-se totalmente o risco de sobrecarga da API e elimina-se a necessidade do botão manual "Filtrar" em **todas** as telas do OneElo.

Além disso, todas as telas com filtros que ainda utilizam código ad-hoc devem ser migradas para os componentes compartilhados do **OneElo Design System (`FilterShell`, `FilterInput`, `FilterSelect`, `useFilterState`)**.

---

## 2. Decisões Arquiteturais

### 2.1 Evolução do Hook Compartilhado `useFilterState`
Localização: `apps/web/src/hooks/use-filter-state.ts`

O hook passará a gerenciar a autoaplicação de filtros nativamente:
- **`autoApply` (padrão: `true`):** Toda alteração dispara `onApply` automaticamente.
- **Debounce Inteligente:**
  - Campos de texto (`string` que não sejam selects de valor fechado) recebem debounce de **350ms** por padrão.
  - Campos imediatos (selects, datas selecionadas em picker, checkboxes booleanos, ordenação) cancelam qualquer debounce pendente e disparam `onApply` **imediatamente**.
- **Inicialização Sincronizada com URL Params:**
  - O hook aceitará `syncWithUrlParams?: boolean` ou uma função `getInitialFromUrl` para popular o estado antes de qualquer disparo inicial à API, evitando a busca inicial incorreta.
- **`handleClear` Reativo:**
  - Reseta os campos para os valores padrão e dispara imediatamente `onApply(defaultValues)` cancelando debounces pendentes.
- **`isDebouncing` / `isApplying`:**
  - Expõe estado para sinalizar visualmente que uma busca está programada ou em trânsito.

### 2.2 Simplificação do `FilterShell` e `FilterActions`
Localizações:
- `apps/web/src/components/app/filter-shell.tsx`
- `apps/web/src/components/app/filter-field.tsx`

1. **Eliminação do Botão "Filtrar":**
   - O botão `submit` com ícone de lupa e rótulo "Filtrar" / "Aplicar" é **removido de todas as barras de filtros**.
   - O `<form onSubmit={(e) => e.preventDefault()}>` passa a interceptar apenas a tecla `Enter` (caso o usuário aperte Enter enquanto digita no input, aplica imediatamente sem esperar o tempo restante de debounce).
2. **Ações Restantes no `FilterActions`:**
   - **Limpar (`onClear`):** Botão secundário neutro com ícone `X`, visível quando algum filtro difere do padrão.
   - **Recarregar (`onReload`):** Botão secundário com ícone `RotateCcw`, útil em telas de visualização/leitura para buscar dados frescos do servidor sem resetar as escolhas do usuário.
3. **Indicador Visual de Digitação/Carregamento:**
   - O `FilterInput` suportará opcionalmente um spinner discreto ou ícone de busca ativo durante o período de debounce ou loading da requisição.

---

## 3. Inventário Completo de Telas a Migrar / Atualizar

| Tela | Rota | Situação Atual | Ação Necessária |
|---|---|---|---|
| **Membros (Visualização)** | `/membros/visualizacao` | `FilterShell` com botão manual "Filtrar". Race condition com `aniversarioMes` vindo do dashboard. | Tornar reativo com debounce no `nome`; inicializar via URL params antes da 1ª busca; remover botão "Filtrar". (IMP-007) |
| **Membros (CRUD)** | `/membros` | `FilterShell` com botão manual "Filtrar". Tags, selects e input de nome. | Autoaplicar selects e tags imediatamente; debounce no nome; remover botão "Filtrar". |
| **Agenda (Visualização)** | `/agenda/visualizacao` | `FilterShell` com botão manual "Filtrar". Datas, tipo, status, ministério. | Autoaplicar selects e datas imediatamente; remover botão "Filtrar". |
| **Agenda (CRUD)** | `/agenda` | `FilterShell` com botão manual "Filtrar". Datas, tipo, status, ministério. | Autoaplicar selects e datas imediatamente; remover botão "Filtrar". |
| **Escalas (Visualização)** | `/escalas/visualizacao` | `FilterShell` com botão manual "Filtrar". Mês, ano, ministério, status, pendentes. | Autoaplicar selects e checkbox imediatamente; debounce em ano/mês numérico; remover botão "Filtrar". |
| **Escalas (CRUD)** | `/escalas` | `FilterShell` com botão manual "Filtrar". Mês, ano, ministério, status. | Autoaplicar selects imediatamente; remover botão "Filtrar". |
| **Financeiro (Visualização)**| `/financeiro/visualizacao` | `FilterShell` com botão manual "Filtrar". Tipo, status, categoria, datas. | Autoaplicar selects e datas imediatamente; remover botão "Filtrar". |
| **Financeiro (CRUD)** | `/financeiro` | `FilterShell` com botão manual "Filtrar". Tipo, status, categoria, datas. | Autoaplicar selects e datas imediatamente; remover botão "Filtrar". |
| **Ministérios (Visualização)** | `/ministerios/visualizacao` | `FilterShell` com botão manual "Filtrar". Busca textual e checkbox de ativos. | Debounce em busca textual; autoaplicar checkbox imediatamente; remover botão "Filtrar". |
| **Configurações (Usuários)** | `/configuracoes` (tab Usuários) | `FilterShell` com botão manual "Filtrar". Busca textual e role select. | Debounce na busca de usuários; autoaplicar perfil imediatamente; remover botão "Filtrar". |
| **Configurações (Auditoria)**| `/configuracoes` (tab Auditoria) | **Fora do padrão**: `<select>` e `<label>` manuais sem `FilterShell`. | **Migrar integralmente** para `FilterShell` + `FilterSelect` + `useFilterState` autoaplicável. |

---

## 4. Fases de Implementação

### Fase 1: Evolução dos Componentes Compartilhados (`apps/web`)
- [x] Atualizar `apps/web/src/hooks/use-filter-state.ts`:
  - Implementar auto-apply padrão com suporte a campos com debounce e campos imediatos;
  - Gerenciar timers de debounce com limpeza (`clearTimeout`) em unmount e resets;
  - Fornecer sincronização/leitura inicial segura de query parameters (`window.location.search`);
  - Manter suporte a submissão via `Enter` forçando aplicação imediata.
- [x] Atualizar `apps/web/src/components/app/filter-shell.tsx`:
  - Tornar o botão de submissão no `FilterActions` opcional/depreciado e ocultá-lo por padrão;
  - Garantir que `onClear` e `onReload` fiquem alinhados com espaçamento harmonioso sem o botão "Filtrar";
  - Adicionar suporte a indicador sutil de loading/debounce no shell.
- [x] Atualizar `apps/web/src/components/app/filter-field.tsx`:
  - Garantir que `FilterInput` e `FilterSelect` passem eventos transparentemente sem perda de foco durante re-renders.

### Fase 2: Implementação na Visualização de Membros (IMP-007)
- [x] Refatorar `apps/web/src/app/(dashboard)/membros/visualizacao/page.tsx`:
  - Conectar o novo `useFilterState` com autoaplicação;
  - Debounce de 350ms no input de `nome`;
  - Autoaplicação imediata para `status`, `ministerioId`, `aniversarioMes`, `semTelefone` e `ordenacao`;
  - Ler `aniversarioMes` da URL na montagem antes do primeiro disparo do `useMembrosVisualizacao`;
  - Remover o botão "Filtrar" do `FilterActions`;
  - Validar funcionamento em fluxo do Dashboard (clicar no card de Aniversariantes do Mês).

### Fase 3: Migração das Demais Telas de Visualização (Read-Only)
- [x] Atualizar `/agenda/visualizacao`:
  - Autoaplicar filtros de datas, tipo, status e ministério no `onChange`;
  - Remover botão "Filtrar".
- [x] Atualizar `/escalas/visualizacao`:
  - Autoaplicar mês, ano, ministério, status e pendentes no `onChange`;
  - Remover botão "Filtrar".
- [x] Atualizar `/financeiro/visualizacao`:
  - Autoaplicar selects e intervalo de datas no `onChange`;
  - Remover botão "Filtrar".
- [x] Atualizar `/ministerios/visualizacao`:
  - Debounce no campo de busca textual;
  - Autoaplicar checkbox de ativos no `onChange`;
  - Remover botão "Filtrar".

### Fase 4: Migração das Telas Administrativas (CRUD) e Padronização de Configurações
- [x] Atualizar `/membros`:
  - Debounce na busca por nome; autoaplicar selects e seleção de tags; remover botão "Filtrar".
- [x] Atualizar `/agenda`:
  - Autoaplicar selects e datas; remover botão "Filtrar".
- [x] Atualizar `/escalas`:
  - Autoaplicar selects de mês/ano/ministério; remover botão "Filtrar".
- [x] Atualizar `/financeiro`:
  - Autoaplicar selects e datas; remover botão "Filtrar".
- [x] Atualizar `/configuracoes`:
  - Tab Usuários: debounce na busca textual, autoaplicar filtro de role, remover botão "Filtrar".
  - Tab Auditoria: **migrar** selects manuais para `FilterShell` e `FilterSelect` compartilhados com autoaplicação.

### Fase 5: Atualização da Documentação e Backlog
- [x] Atualizar `ai-core/skills/oneelo-design-system/VIEW_STANDARD.md` e `CRUD_STANDARD.md`:
  - Formalizar a regra: *"Filtros no OneElo são obrigatoriamente reativos ao onChange, com debounce para campos de texto, sem botão manual Filtrar"*.
- [x] Atualizar `ai-context/backlog/improvements.md`:
  - Marcar **IMP-007** como concluído.
- [x] Atualizar `ai-context/backlog/README.md`.

### Fase 6: Testes, Build e Validação de Experiência
- [x] Validar que nenhum loop infinito de renderização ou rajada de chamadas à API ocorre durante a digitação.
- [x] Validar que a tecla `Enter` aplica o filtro imediatamente sem recarregar a página.
- [x] Validar que clicar em "Limpar" reseta todos os campos e recarrega os dados padrão instantaneamente.
- [x] Executar build de produção (`npm run build` em `apps/web`).

---

## 5. Critérios de Aceite

1. Nenhuma tela do sistema possui o botão manual "Filtrar" ou "Aplicar".
2. Todos os campos de texto filtram com debounce suave (300ms–400ms) sem travar a interface nem disparar requisições por caractere.
3. Todos os selects, checkboxes, toggles e datas filtram instantaneamente na seleção.
4. Clicar em links de atalho com query params (como "Aniversariantes do Mês" no Dashboard) abre a visualização de membros já filtrada na primeira carga, sem requisição órfã anterior.
5. A aba de Auditoria de Configurações utiliza os mesmos componentes compartilhados (`FilterShell`, `FilterSelect`) que o resto do sistema.
6. A documentação do Design System em `ai-core/` e o backlog em `ai-context/` refletem oficialmente o novo padrão.
