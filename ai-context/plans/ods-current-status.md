# OneElo Design System - Status Atual

> Atualização: 2026-06-15 · branch `refactor/ods-phase-7`. Revisado contra o código atual e alinhado a `ods-refactoring-plan.md`, `ods-compliance-matrix.md`, `design-system-pattern-analysis.md` e `design-system-inventory.md`. Esta revisão corrige estimativas anteriormente infladas (Formulários/Modais/CRUDs estavam marcados como ~100%) e reclassifica Permissões/Navegação como alto impacto (não cosmético).

## Resumo Executivo

A adoção do OneElo Design System (ODS) avança de forma sustentável. Os principais gargalos de UI das **periferias do sistema** — Ações Destrutivas, Exportações e Filtros — foram plenamente padronizados sem regressões nas regras de negócio. O **núcleo de dados** (tabelas/listagens e o fluxo CRUD completo) e as áreas **transversais** (permissões e navegação) ainda são a maior fonte de fragmentação.

* **Fases concluídas**: Fase 0 (Baseline), Fase 1 (Fundações), Fase 2 (Confirmações), Fase 3 (Exportações), Fase 4 (Filtros), Fase 5 (Modais CRUD), **Fase 6 (Tabelas e Listagens)** e Fase 7 (Visualizações e Métricas).
* **Fases pendentes**: Fase 8 (Permissões e Navegação) e Fase 9 (Validação Final). Consolidação CRUD (`ResourcePage`) é transversal e depende da Fase 8.
* **Percentual estimado de aderência ao ODS**: **~62–65% global** (alto nas periferias e no núcleo de dados; baixo em permissões/navegação).
* **Estado geral da aplicação**: Estável. Todas as refatorações mantiveram os contratos de API intactos. Sem novas quebras de lint nas áreas refatoradas; débitos pré-existentes em áreas legadas persistem.

---

## Fases Concluídas

### Fase 0: Preparação e Baseline
**Resumo:** Estabeleceu a fundação de segurança. Telas críticas, componentes e fluxos mapeados para comparação antes/depois.
**Resultado:** PASSOU. Sem alterações funcionais.

### Fase 1: Fundações Compartilhadas
**Resumo:** Criação do repositório base de componentes ODS (`ModalShell`, `ModalError`, `ModalFooter`, `ConfirmDialog`, campos de form, `FilterShell`). Dois modais (Membro e Usuário) refatorados como prova de conceito.
**Resultado:** PASSOU. Débito temporário: componentes criados sem uso global imediato (parcialmente resolvido nas fases seguintes).

### Fase 2: Confirmações e Feedback
**Resumo:** Eliminação de invocações bloqueantes nativas (`alert()`/`confirm()`), substituídas pelo `ConfirmDialog` e feedback inline/toast. Chaves de i18n adicionadas.
**Resultado:** PASSOU. 100% das confirmações nativas eliminadas. **Exceção remanescente:** `/configuracoes` ainda usa um modal de desativação inline (não `ConfirmDialog`).

### Fase 3: Exportações
**Resumo:** Padronização das 4 páginas de exportação CSV (Membros, Ministérios, Escalas, Agenda) com `ExportShell` + `useExport` + `downloadCsv`.
**Resultado:** PASSOU. UX 100% uniforme; código de página reduzido ~60–65%. Pendência menor: labels de status locais por página (mover para `lib/utils`); XLSX presente apenas como "em breve".

### Fase 4: Filtros
**Resumo:** Unificação dos filtros (submissões manuais vs automáticas) com `FilterShell` + `FilterActions` + `useFilterState`.
**Resultado:** PASSOU. Filtros unificados nas 5 páginas alvo, com suporte a estruturas avançadas (slots/tags). Pendência menor: os **campos internos** ainda são `<input>`/`<select>` manuais (alvo futuro: `FilterInput`/`FilterSelect`).

### Fase 5: Modais CRUD
**Resumo:** Migração dos modais inline para `ModalShell`; introdução de `TabsShell` e `ModalFooter`.
**Resultado:** PASSOU. Padronização do shell em agenda, escalas, ministérios (com `TabsShell`), admin e tag. **Pendência:** `MembroModal` e `UsuarioModal` ainda escrevem o rodapé à mão (não usam `ModalFooter`).

### Fase 6: Tabelas e Listagens
**Resumo:** `DataTable` **estendido** (não recriado) com ordenação controlada, `renderMobileCard` (responsividade B) e `hideOnMobile`, mantido presentation-only. Criados `StatusBadge` e `EntityCard`. Migradas 5 telas: Admin (tenants → `DataTable`), Configurações (**paginação corrigida** + `StatusBadge` + ordenação), Membros/visualização (`DataTable` + `renderMobileCard`, fim da lista mobile duplicada), Agenda e Ministérios (cards → `EntityCard`). Matriz de Escalas mantida fora (exceção de domínio).
**Resultado:** PASSOU. TypeScript exit 0; lint sem erros novos (apenas baseline pré-existente); sem alteração de API/permissões/multitenancy/regras de negócio. Evidência: `ods-phase-6-tables-report.md`. **Pendência:** server-side pagination não ativada (contrato pronto); ações de linha seguem via coluna `render`.

### Fase 7: Visualizações e Métricas
**Resumo:** Padronização das áreas read-only e dos painéis estatísticos. Criação do `InfoItem`; consolidação de `MemberProfileDrawer` e `meu-perfil`; helpers compartilhados em `escala-shared.tsx`.
**Resultado:** PASSOU. Métricas rodam em `StatCard` padronizado (sem mais `StatBox` local). **Pendência:** falta um `DrawerShell` genérico; `EscalaGrid` ainda duplica `EscalaReadonlyGrid`.

---

## Componentes Compartilhados Existentes (adoção real)

* **ModalShell** — Shell padrão (header/footer fixos, body com scroll). *Adoção alta nos modais.*
* **ModalFooter** — Rodapé padronizado. *Adoção parcial: usado em agenda, escalas, ministérios, admin e tag; **`MembroModal`/`UsuarioModal` ainda não usam**.*
* **TabsShell** — Abas desacopladas. *Adoção pontual: **apenas** no modal de ministério; `/configuracoes` faz tabs à mão.*
* **ModalError** — Erro inline no modal. *Adoção alta.*
* **ConfirmDialog** — Confirmação destrutiva. *Adoção alta (membros, ministérios, agenda, escalas); **1 exceção inline** em `/configuracoes`.*
* **InputField / SelectField / TextareaField** — Campos ODS. *Adoção alta em formulários de entidade; **filtros e telas de login não usam**.*
* **PasswordField** — Campo de senha show/hide. *Adoção alta (usado inclusive em `/meu-perfil`).*
* **FilterShell / FilterActions** — Container e botões de filtro. *~100% nas 5 páginas da Fase 4 (container).*
* **ExportShell / useExport** — Exportação CSV. *~100% nas exportações.*
* **useFilterState** — Estado de filtro. *~100% nas listagens com filtro.*
* **StatCard** — Métricas. *~100% (dashboard + todas as visualizações).*
* **InfoItem** — Pares rótulo/valor. *Adoção em perfil e drawer.*
* **DataTable** — Tabela genérica (estendida na Fase 6: ordenação + `renderMobileCard` + `hideOnMobile`). *Adoção: membros, configurações, Admin (tenants) e membros/visualização.*
* **StatusBadge** — Pill de status (consome `lib/utils`/módulo via className). *Criado na Fase 6; adotado em Admin, configurações, membros/visualização, agenda e ministérios.*
* **EntityCard** — Container de card para grids + fallback mobile do `DataTable` (com `loading`). *Criado na Fase 6; adotado em agenda, ministérios e como card mobile de membros/visualização.*

---

## ODS Compliance Atual

* **Exportações**: ~100%
* **Filtros (container)**: ~100%
* **Feedback / Confirmação**: ~85% (1 exceção em `/configuracoes`)
* **Formulários**: ~50% (`form-field` existe; filtros e login ignoram; erro por-campo subutilizado)
* **Modais**: ~50% (`ModalShell` adotado; footer inconsistente)
* **Tabelas / Listagens**: ~90% (`DataTable` adotado; tabelas artesanais eliminadas; resta a matriz de Escalas — exceção de domínio)
* **CRUDs (fluxo completo)**: ~20% (5 padrões distintos; alvo: `ResourcePage`)
* **Navegação**: 0% (sem breadcrumbs; ícones inline; `PAGE_TITLES` hardcoded)
* **Permissões (visibilidade UI)**: 0% de abstração (refetch de `/me` espalhado; regras por página)

**Estimativa Global ODS:** **~62–65%**

---

## Débito Técnico Remanescente

* **Footer de modal inconsistente**: `MembroModal`/`UsuarioModal` escrevem o rodapé à mão em vez de `ModalFooter`.
* **`/configuracoes` fora do padrão**: tabs feitas à mão (não `TabsShell`) e modal de desativação inline (reimplementa `ConfirmDialog`) — alvo do CRUD único (Fase 8/transversal).
* **Paginação server-side** não ativada (contrato do `DataTable` pronto; decisão de hook/endpoint futura). Paginação atual é client-side.
* **Campos de filtro manuais**: `<input>`/`<select>` com a mesma classe repetida (~15×); não usam `form-field`.
* **Métricas/Views**: falta `DrawerShell` genérico; `EscalaGrid` duplica `EscalaReadonlyGrid`.
* **Permissões sem abstração**: `/api/auth/me` refeito em ~9 páginas; `canManage` reimplementado por página; lista de rotas BASIC duplicada (middleware + sidebar); decode de JWT duplicado (`lib/auth.ts` e `middleware.ts`).
* **Ícones**: predomínio de SVG inline (sidebar, dashboard, ações) apesar de `lucide-react` instalado.
* **Labels/cores de status** ainda duplicados inline em membros/agenda/escalas e exportações (existem em `lib/utils`).

---

## Riscos Arquiteturais

* **Lifecycle no React**: hooks de busca ainda têm `setState` síncrono dentro de `useEffect` (`use-membros`, `use-ministerios`, etc.), com risco de duplos re-renders.
* **Migração de Tabelas/CRUD**: refatorar tabelas interativas e fluxos profundos (agenda, escalas) tem risco de quebra de regras de negócio ao mover a lógica de inserção para os slots ODS — exige validação por perfil.
* **Permissões**: introduzir `UserContext`/`usePermissions` toca o layout e ~9 páginas; precisa preservar o comportamento atual de `canManage`/escopo de liderança.

---

## Próximas Prioridades

1. ✅ **Fase 6 (Tabelas e Listagens) — CONCLUÍDA.** `DataTable` estendido + `StatusBadge`/`EntityCard`; 5 telas migradas. Ver `ods-phase-6-tables-report.md`.
2. **ALTO IMPACTO — Fase 8 (Permissões e Navegação)**: `UserContext` + `usePermissions`; eliminar refetch de `/me`; unificar decode de JWT; centralizar rotas BASIC. **Não é cosmético** — é a base para o CRUD único e para a previsibilidade de visibilidade. **Próxima prioridade.**
3. **ALTO IMPACTO — Consolidação CRUD (`ResourcePage`)**: depende da Fase 8; unifica os 5 padrões de CRUD reusando o `DataTable` (inclui migrar `MembroModal`/`UsuarioModal` para `ModalFooter` e `/configuracoes` para `TabsShell`/`ConfirmDialog`).
4. **MÉDIO IMPACTO**: View única (`ViewPage` + `DrawerShell`), Configuração e Dashboard (`DashboardSection`, ícones via `lucide`).
5. **BAIXO IMPACTO**: Export XLSX (UI já prevê) + cosméticos de navegação (breadcrumbs, `PAGE_TITLES` em i18n, ícones inline → `lucide`).
6. **Fase 9 (Validação Final)**.

---

## Recomendação Estratégica

Com a Fase 6 concluída, o `DataTable` é o padrão de listagem e as tabelas artesanais foram eliminadas. O próximo esforço deve focar em **Permissões (Fase 8) + CRUD único (`ResourcePage`)**. Centralizar permissões (`UserContext`/`usePermissions`) desbloqueia o contrato único de `ResourcePage` — que reusa o `DataTable` já pronto — fechando o ciclo das áreas centrais do OneElo.

**Correção de avaliação anterior:** Permissões/Navegação **não** são apenas cosméticas. Embora o backend continue sendo a fonte de verdade de autorização, a ausência de `UserContext`/`usePermissions` é hoje uma das maiores fontes de duplicação estrutural (refetch de `/me` em ~9 páginas e regras de visibilidade espalhadas), e bloqueia a consolidação do CRUD único.
