# OneElo Design System - Status Atual

## Resumo Executivo

O projeto de adoção do OneElo Design System (ODS) avança de forma sustentável e previsível. O sistema passou de uma interface com alta fragmentação e componentes isolados para um ambiente em transição, onde os principais gargalos de UI (Ações Destrutivas, Exportações e Filtros) foram plenamente padronizados sem causar regressões nas regras de negócios.

* **Fases concluídas**: Fase 0 (Baseline), Fase 1 (Fundações), Fase 2 (Confirmações), Fase 3 (Exportações) e Fase 4 (Filtros).
* **Fases pendentes**: Tabelas e Listagens, Modais CRUD, Visualizações/Métricas e Permissões/Navegação. *(Nota: O mapeamento original marcava Tabelas como Fase 4 e Filtros como Fase 6, porém a ordem de execução avançou com Filtros na Fase 4).*
* **Percentual estimado de aderência ao ODS**: **~45%** globais.
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

---

## Componentes Compartilhados Existentes

* **ModalShell**: Shell padrão para modais. Utilizado em `MembroModal` e `UsuarioModal`. *Status: Adoção Parcial.*
* **ModalError**: Erro inline dentro do header de modais. Utilizado com `ModalShell`. *Status: Adoção Parcial.*
* **ConfirmDialog**: Modal genérico de validações destrutivas. Usado em Agenda, Escalas, Ministérios, Membros. *Status: Alta adoção (100% das páginas auditadas na Fase 2).*
* **InputField**: Input textual do ODS. Utilizado nos modais base. *Status: Adoção Parcial.*
* **SelectField**: Select nativo formatado ODS. Utilizado nos modais base. *Status: Adoção Parcial.*
* **TextareaField**: Campo de texto longo ODS. Utilizado em MembroModal. *Status: Adoção Parcial.*
* **PasswordField**: Campo de senha com função show/hide. Utilizado em UsuarioModal (existe duplicidade órfã em Meu Perfil). *Status: Adoção Parcial.*
* **FilterShell**: Container wrapper de filtros com borda/sombra. *Status: 100% de adoção nas telas listadas (Fase 4).*
* **FilterActions**: Botões padronizados (Aplicar, Limpar, Recarregar). *Status: 100% de adoção suportada.*
* **ExportShell**: Interface padronizada de exportações de dados. *Status: 100% de adoção nas exportações.*
* **useExport**: Hook gestor de estados para CSV. *Status: 100% de adoção nas exportações.*
* **useFilterState**: Hook de gerência de input/estado para buscas de dados. *Status: 100% de adoção nos filtros de tabelas.*

---

## ODS Compliance Atual

* **Filtros**: ~100%
* **Exportações**: ~100%
* **Formulários**: ~50%
* **Modais**: ~50%
* **Tabelas / Listagens**: ~20%
* **CRUDs (Mutações)**: ~20%
* **Navegação (Layout Base)**: 0%
* **Permissões (Visibilidade UI)**: 0%

**Estimativa Global ODS:** **~45%**

---

## Débito Técnico Remanescente

* **Componentes não padronizados**: Implementações avulsas de campos de entrada em modais não mapeados na Fase 1. A duplicidade isolada do `PasswordField` persistente em `/meu-perfil`.
* **Tabelas pendentes**: Telas do painel Admin, configurações de tenants e painéis listando membros/escalas ainda não consomem um container de `DataTable` global do ODS, mantendo implementações locais da tag `<table>` ou visualizações baseadas em Grid Cards.
* **Modais pendentes**: Agenda, Escalas, Ministérios e Super Admin mantêm caixas de diálogo híbridas que misturam lógica de view severa sem consumir o `ModalShell`.
* **Listagens pendentes**: Visualizações "read-only" de Escalas e perfis.

---

## Riscos Arquiteturais

* **Lógicas de Lifecycle no React**: Os ganchos customizados de busca e os utilitários de estado remanescentes ainda possuem chamadas síncronas de `setState` dentro de `useEffect` (vide logs da Fase 4 em `use-membros`, `use-ministerios`, etc). Esse anti-pattern pode causar duplos re-renders pesados e prejudicar a performance do ODS em máquinas mais fracas no longo prazo.
* **Migração de Tabelas/Modais**: Refatorar tabelas interativas e migrar fluxos profundos de Modais (como Agenda e Escalas) tem alto risco de quebrar regras de negócios por exigirem o desmonte da lógica de inserção atual da tela original para dentro dos slots ODS.

---

## Próximas Prioridades

1. **Prioridade Alta**: **Tabelas e Listagens**. A padronização de DataTables (Fase originalmente mapeada como 4) é o alicerce principal onde os botões de controle de Modais CRUD estarão ancorados.
2. **Prioridade Média**: **Modais CRUD**. Após as tabelas estarem no padrão ODS, a transição dos popups de criação/atualização de instâncias fica previsível.
3. **Prioridade Baixa**: **Navegação e Permissões**. Os contratos atuais da API já protegem a aplicação. A mudança da barra lateral e restrições focais são apenas melhorias cosméticas a serem polidas na prévia do MVP para a Igreja Piloto.

---

## Recomendação Estratégica

O próximo esforço deve focar em **Tabelas e Listagens**.

**Justificativa**: Com as Fases 3 (Exportações) e a nossa Fase 4 (Filtros) finalizadas, toda a periferia do núcleo de dados (o topo da listagem) já é 100% ODS. A principal fonte de inconsistência atual para o usuário corporativo ou Igreja Piloto será visualizar um formulário de filtros bonito com uma grade genérica logo abaixo dele. A padronização para o `DataTable` resolve o vazio entre o Filtro/Exportação e o componente de navegação interativa, unificando em definitivo a visualização principal do produto. Além disso, estabelecer um padrão sólido de Tabelas facilita injetar "Actions Columns" consistentes, servindo de tapete vermelho perfeito para a fase seguinte, que seria a padronização pesada dos Modais CRUD ODS abertos através dessas ações.
