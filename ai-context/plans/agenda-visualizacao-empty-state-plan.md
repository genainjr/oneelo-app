# Plano - Correção das Chaves de Tradução do Estado Vazio em Visualização Agenda

Status geral: concluido  
Data de criação: 2026-11-19  
Branch sugerida para implementação: fix/agenda-visualizacao-empty-state  

## Planos e Referências Relacionados

- [Template Oficial de Planos](PLAN_TEMPLATE.md)
- [Padrão de Visualizações ODS](../../ai-core/skills/oneelo-design-system/VIEW_STANDARD.md)
- [Workflow Git Worktree](../workflows/git-worktree.md)

---

## 1. Objetivo da Entrega

Corrigir a exibição de chaves literais de internacionalização (`agenda.view.empty.title` e `agenda.view.empty.description`) no componente `EmptyState` da tela `/agenda/visualizacao` quando não existem eventos no período ou filtros selecionados, garantindo que os textos traduzidos sejam exibidos corretamente nos idiomas suportados (`pt-BR`, `pt-PT` e `en-US`).

---

## 2. Contexto e Diagnóstico

1. **Incompatibilidade entre código e dicionários i18n:**
   - Em `apps/web/src/app/(dashboard)/agenda/visualizacao/page.tsx:375-378`, o `EmptyState` utilizava `t('view.empty.title')` e `t('view.empty.description')`.
   - Contudo, nos arquivos `apps/web/messages/pt-BR.json`, `apps/web/messages/pt-PT.json` e `apps/web/messages/en-US.json`, sob `agenda.view`, as chaves existentes são `emptyTitle` e `emptyDescription` (seguindo o mesmo padrão de `ministerios/visualizacao/page.tsx`).
2. **Auditoria preventiva nas demais telas de `(dashboard)`:**
   - A varredura automática das chaves estáticas `t(...)` nos arquivos `.tsx` de `apps/web/src/app/(dashboard)` contra `pt-BR.json`, `pt-PT.json` e `en-US.json` confirmou que apenas `agenda.view.empty.title` e `agenda.view.empty.description` estavam ausentes.

---

## 3. Decisões de Arquitetura, Riscos e Engenharia

1. **Ajustar as chamadas `t(...)` para as chaves existentes (`view.emptyTitle` e `view.emptyDescription`):**
   - Mantém alinhamento estrito com os dicionários de tradução já consolidados nos três idiomas e com as páginas irmãs (como `ministerios/visualizacao`), evitando duplicação de chaves nos arquivos JSON.
2. **Isolamento via Git Worktree (`../oneelo-bugfix`):**
   - Como o diretório principal contém trabalho em andamento na branch `feature/financeiro-exportacao-pdf-png`, a correção é executada em worktree dedicado a partir de `origin/development`.

---

## Etapas de Desenvolvimento

### Etapa 0 - Preparação do Worktree Isolado
Status: concluido

- [x] Verificar branch ativa e trabalho não commitado no diretório principal sem sobrescrever arquivos em andamento.
- [x] Criar worktree isolado `../oneelo-bugfix` na branch `fix/agenda-visualizacao-empty-state` a partir de `origin/development`.
- [x] Critério de validação da etapa: Worktree limpo criado e rastreando `origin/development`.

### Etapa 1 - Correção das Chaves i18n na Tela de Visualização Agenda
Status: concluido

- [x] Atualizar `apps/web/src/app/(dashboard)/agenda/visualizacao/page.tsx`:
  - [x] Substituir `t('view.empty.title')` por `t('view.emptyTitle')` no `EmptyState`.
  - [x] Substituir `t('view.empty.description')` por `t('view.emptyDescription')` no `EmptyState`.
- [x] Critério de validação da etapa: Auditoria das chaves i18n no módulo `agenda` e demais rotas de `(dashboard)` sem nenhuma chave ausente em `pt-BR`, `pt-PT` e `en-US`.

### Etapa 2 - Validação, Build e Integração
Status: concluido

- [x] Executar validação TypeScript (`tsc --noEmit`), ESLint no arquivo alterado e build de produção do frontend (`next build`).
- [x] Atualizar checkboxes deste plano e status no índice `ai-context/plans/README.md`.
- [x] Realizar commit, push da branch e integração conforme fluxo do repositório, removendo o worktree temporário com segurança.
- [x] Critério de validação da etapa: Build e auditoria i18n aprovados com código 0 e alterações publicadas.

---

## Critérios de Aceite Gerais

- [x] Ao filtrar `/agenda/visualizacao` sem eventos retornados, o `EmptyState` exibe *"Nenhum evento encontrado"* e *"Ajuste o período ou o status para localizar outros eventos."* (e traduções equivalentes em `pt-PT` e `en-US`).
- [x] Nenhuma chave literal de tradução aparece na interface de `/agenda/visualizacao`.
- [x] Typecheck, ESLint e build de produção do frontend passando com código 0.
