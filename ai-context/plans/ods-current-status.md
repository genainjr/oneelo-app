# OneElo Design System - Status Atual

## Resumo Executivo

O projeto de adoção do OneElo Design System (ODS) avança de forma sustentável e previsível. O sistema passou de uma interface com alta fragmentação e componentes isolados para um ambiente em transição, onde os principais gargalos de UI (Ações Destrutivas, Exportações e Filtros) foram plenamente padronizados sem causar regressões nas regras de negócios.

* ✅ **Fases concluídas (com auditoria)**: Fase 0 (Baseline), Fase 1 (Fundações), Fase 2 (Confirmações), Fase 3 (Exportações), Fase 4 (Filtros), Fase 5 (Modais CRUD), **Fase 6 (Tabelas e Listagens)**, **Fase 7 (Visualizações e Métricas)**.
* ⏸ **Fases pendentes**: Fase 8 (Permissões e Navegação), Fase 9 (Validação Final).
* **Percentual estimado de aderência ao ODS**: **> 85%** globais.
* **Próxima fase**: Fase 8 — Permissões e Navegação.
* **Estado geral da aplicação**: Estável. Todas as refatorações mantiveram os contratos das APIs intactos. Nenhuma quebra de lint nas áreas refatoradas foi introduzida, embora débitos pré-existentes em áreas legadas persistam.

---

## Fases Concluídas

### Fase 0: Preparação e Baseline
**Resumo:** Estabeleceu a fundação de segurança. As telas críticas, componentes e fluxos foram mapeados para servirem de base de comparação ("antes e depois").
**Resultado:** PASSOU. Sem alterações funcionais.

### Fase 1: Fundações Compartilhadas
**Resumo:** Criação do repositório base de componentes ODS (ModalShell, ConfirmDialog, campos de form, FilterShell). Dois modais (Membro e Usuário) foram refatorados como prova de conceito.
**Resultado:** PASSOU. Mas deixou um pequeno débito técnico temporário (componentes criados sem uso global imediato).

### Fase 2: Confirmações e Feedback
**Resumo:** Eliminação total de invocações bloqueantes e nativas do browser como `alert()` e `confirm()`. Em seu lugar, foi injetado o `ConfirmDialog` do ODS e toasts padronizados. Adicionadas as chaves de internacionalização equivalentes.
**Resultado:** PASSOU. Padronização 100% na eliminação de interações bloqueantes nativas.

### Fase 3: Exportações
**Resumo:** Padronização visual e sistêmica da funcionalidade de extração de relatórios CSV nas 4 áreas alvo (Membros, Ministérios, Escalas, Agenda), reduzindo drasticamente o JSX redundante com a introdução do `ExportShell` e hook genérico `useExport`.
**Resultado:** PASSOU. UX de exportação agora é 100% uniforme e o código de página foi reduzido em ~65%.

### Fase 4: Filtros
**Resumo:** Continuação natural da otimização de Listagens, unificando os comportamentos híbridos de filtros (submissões manuais vs automáticas). Reviveu e injetou os componentes `FilterShell` e `FilterActions` originários da Fase 1, e centralizou estados no `useFilterState`.
**Resultado:** PASSOU. Filtros 100% unificados nas 5 páginas alvo, com suporte a estruturas avançadas (como slots para tags).

### Fase 5: Modais CRUD
**Resumo:** Padronização visual e estrutural de todos os modais de inserção e edição da plataforma, eliminando HTML cru e shells sobrepostos localmente. Introduziu os componentes `TabsShell` e `ModalFooter`, solidificando a hierarquia visual.
**Resultado:** PASSOU. Layout 100% responsivo para formulários densos, com forte reuso e redução de boilerplate.

### Fase 6: Tabelas e Listagens
**Resumo:** Estabelecimento do `DataTable` (tabular) e `EntityCard` (grid) como padrões únicos de apresentação de dados. Criado o `EntityCard` e estendido o `DataTable` com `renderMobileCard`/`mobileBreakpoint` (Fase 6.1), encapsulando o anti-pattern de duplicação de DOM `hidden md:block`/`md:hidden`. Migradas 4 páginas: `/admin` e `/membros/visualizacao` (tabelas) e `/agenda` e `/ministerios` (grids de card). Executada em 5 sub-fases / 3 PRs.
**Resultado:** PASSOU. Auditada com 15/15 critérios de saída verificados (`ods-phase-6-tables-report.md`). Aderência de tabelas/listagens elevada de ~20% para ~95%. Matriz de escalas mantida com lógica customizada (exceção justificada).

### Fase 7: Visualizações e Métricas
**Resumo:** Padronização das áreas read-only de apresentação de dados e painéis estatísticos. Criação do componente utilitário `InfoItem` centralizado, redução de código local no `MemberProfileDrawer` e `meu-perfil`, e secagem de lógicas compartilhadas nas views da Escala através do `escala-shared.tsx`.
**Resultado:** PASSOU. Auditada com 15/15 critérios verificados em 2026-06-17 (`ods-phase-7-audit-report.md`). `StatCard`, `InfoItem` e `escala-shared` confirmados como padrões únicos, sem `StatBox`/`StatItem` locais remanescentes. Aderência de Visualizações/Métricas elevada de ~80% para ~95%. Matriz de escalas mantida com `<table>` custom (exceção justificada).

---

## Componentes Compartilhados Existentes

* **ModalShell**: Shell padrão para modais com header/footer fixos e body com scroll. *Status: 100% de adoção.*
* **ModalFooter**: Rodapé isolado e padronizado para botões e spinners. *Status: 100% de adoção em fluxos CRUD.*
* **TabsShell**: Componente de abas puramente visual e desacoplado. *Status: 100% adoção em modais complexos.*
* **ModalError**: Erro inline dentro do header de modais. *Status: 100% de adoção.*
* **ConfirmDialog**: Modal genérico de validações destrutivas. *Status: Alta adoção (100% das ações destrutivas mapeadas).*
* **InputField**: Input textual do ODS. *Status: ~100% de adoção nas telas principais.*
* **SelectField**: Select nativo formatado ODS. *Status: ~100% de adoção nas telas principais.*
* **TextareaField**: Campo de texto longo ODS. *Status: ~100% de adoção nas telas principais.*
* **PasswordField**: Campo de senha com função show/hide. *Status: Adoção Alta (existe apenas duplicidade órfã em `/meu-perfil`).*
* **FilterShell**: Container wrapper de filtros com borda/sombra. *Status: 100% de adoção nas telas listadas (Fase 4).*
* **FilterActions**: Botões padronizados (Aplicar, Limpar, Recarregar). *Status: 100% de adoção suportada.*
* **ExportShell**: Interface padronizada de exportações de dados. *Status: 100% de adoção nas exportações.*
* **useExport**: Hook gestor de estados para CSV. *Status: 100% de adoção nas exportações.*
* **useFilterState**: Hook de gerência de input/estado para buscas de dados. *Status: 100% de adoção nos filtros de tabelas.*
* **DataTable**: Container genérico `DataTable<T>` para entidades tabulares, com paginação/ordenação e prop `renderMobileCard` que encapsula o fallback mobile (elimina `hidden md:block`/`md:hidden`). *Status: 100% de adoção nas telas tabulares alvo (`/admin`, `/membros/visualizacao`).*
* **EntityCard**: Container de entidade presentation-only, com modos convenience e shell + skeleton nativo (`loading`). *Status: 100% de adoção nos grids alvo (`/agenda`, `/ministerios`) e como card mobile do `DataTable`.*
* **EmptyState**: Estado vazio padronizado, delegável via props do `DataTable`. *Status: 100% de adoção em tabelas/listagens.*

---

## ODS Compliance Atual

* **Filtros**: ~100%
* **Exportações**: ~100%
* **Formulários**: ~100%
* **Modais**: ~100%
* **CRUDs (Mutações)**: ~100%
* **Tabelas / Listagens**: ~95%
* **Visualizações / Métricas**: ~95%
* **Navegação (Layout Base)**: 0%
* **Permissões (Visibilidade UI)**: 0%

**Estimativa Global ODS:** **> 85%**

---

## Débito Técnico Remanescente

* **Inputs de senha crus nos logins**: as telas de login (`/login`, `/admin/login`) ainda usam `<input type="password">` cru (não o `PasswordField` do ODS). A auditoria da Fase 7 (2026-06-17) confirmou que `/meu-perfil` **já** usa o `PasswordField` — a antiga pendência de duplicidade foi resolvida; resta apenas o contexto de autenticação.
* **Skeleton interno de modal**: Resta um skeleton manual (`animate-pulse`) **dentro do modal** de `/ministerios` (aba de membros) — fora do escopo da Fase 6 (listagens); candidato a padronização futura de loading interno de modais.
* **Lint pré-existente em páginas migradas**: `any` em handlers e `setState` síncrono em efeitos de `/agenda` e `/ministerios` — débito pré-existente, não introduzido pela Fase 6 (não tocado por respeitar o escopo).

---

## Riscos Arquiteturais

* **Lógicas de Lifecycle no React**: Os ganchos customizados de busca e os utilitários de estado remanescentes ainda possuem chamadas síncronas de `setState` dentro de `useEffect` (vide logs da Fase 4 em `use-membros`, `use-ministerios`, etc). Esse anti-pattern pode causar duplos re-renders pesados e prejudicar a performance do ODS em máquinas mais fracas no longo prazo.
* **Migração de Tabelas/Modais**: Refatorar tabelas interativas e migrar fluxos profundos de Modais (como Agenda e Escalas) tem alto risco de quebrar regras de negócios por exigirem o desmonte da lógica de inserção atual da tela original para dentro dos slots ODS.

---

## Próximas Prioridades

1. **Prioridade Alta — Fase 8**: **Navegação e Permissões**. Com tabelas e listagens já padronizadas, este é o pilar central remanescente. Os contratos atuais da API já protegem a aplicação; a mudança da barra lateral e restrições focais de visibilidade são melhorias a serem polidas antes do MVP para a Igreja Piloto.
2. **Fase 9**: **Validação Final**. Executar após a conclusão da Fase 8 (lint/build/testes + validação manual desktop/mobile por perfil).
3. **Débito desacoplado**: tarefa dedicada de lint-cleanup (corrigir `any` e `setState`-em-efeito pré-existentes nos hooks e páginas legadas), fora do ciclo ODS.

---

## Recomendação Estratégica

O próximo esforço deve focar em **Fase 8 — Permissões e Navegação**.

**Justificativa**: Com Exportações, Filtros, Modais CRUD, Visualizações e agora **Tabelas e Listagens** concluídos, o núcleo de apresentação de dados do OneElo opera integralmente em ODS. O `DataTable` e o `EntityCard` unificaram a visualização tabular e em grid, fechando o grande ciclo de refatoração das áreas centrais. Resta a camada de navegação (sidebar/layout base) e a visibilidade condicional por permissão — itens a polir antes do MVP para a Igreja Piloto, seguidos da Validação Final (Fase 9).

Relatório de fechamento da Fase 6: `ods-phase-6-tables-report.md`.
