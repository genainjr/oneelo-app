# Plano - Correção de Empilhamento e Z-Index dos Submenus da Sidebar

Status geral: concluido  
Data de criação: 2026-11-09  
Branch sugerida para implementação: fix/sidebar-flyout-zindex  

## Planos e Referências Relacionados

- [ODS - Padrão de Visualização](../../ai-core/skills/oneelo-design-system/VIEW_STANDARD.md)
- [Workflow Git Worktree](../workflows/git-worktree.md)
- [Workflow de Bugfix](../workflows/bugfix.md)

---

## 1. Objetivo da Entrega

Corrigir a sobreposição visual na barra lateral (`Sidebar`), onde os submenus flutuantes (*flyouts* de itens com múltiplos módulos, como Ministérios, Membros, Escalas, Agenda e Financeiro) e o seletor de idiomas em modo colapsado (`collapsed`) ficavam sendo renderizados por trás dos cards de conteúdo e elementos das páginas (ex: cards de ministérios em `/ministerios`).

Com esta entrega:
- O elemento `<aside>` da `Sidebar` passa a ter posicionamento relativo com nível de empilhamento adequado (`lg:relative lg:z-40`), garantindo que todos os elementos e menus flutuantes da sidebar fiquem sempre à frente do container de páginas e cabeçalhos em todas as telas;
- O cálculo de posicionamento vertical dos flyouts ganha contenção de borda inferior (evitando que submenus maiores ou de itens inferiores extravasem a base da janela do navegador);
- É adicionado fechamento automático e resiliente do flyout ao rolar a navegação interna da sidebar (`scroll`) ou ao redimensionar a janela (`resize`), além de fechar ao navegar entre rotas (`pathname`).

---

## 2. Contexto e Diagnóstico

1. **Stacking Context no Desktop (`apps/web/src/components/app/sidebar.tsx` linha 426)**:
   - No breakpoint desktop (`lg:`), o elemento `<aside>` utilizava `lg:static lg:z-auto`.
   - Concomitantemente, o `<aside>` possui animação e transição contendo `lg:translate-x-0` (`transform: translateX(0px)`).
   - De acordo com a especificação CSS (W3C Transforms Level 1), a propriedade `transform` estabelece um novo contexto de empilhamento (*stacking context*) local.
   - Como o `<aside>` estava com `position: static` e `z-index: auto`, seu contexto de empilhamento ficava no nível `0` do flex container pai (`DashboardShell`).
2. **Precedência do Conteúdo da Página (`apps/web/src/components/app/dashboard-shell.tsx` linha 65)**:
   - O container da página `<div className="flex min-w-0 flex-1 flex-col overflow-hidden">` é o irmão subsequente do `<aside>` na árvore DOM.
   - O `<Header>` possui `sticky top-0 z-10`.
   - Os cards das páginas (como `EntityCard` em `/ministerios`) possuem `shadow-sm`, `transition-all` e estilos com posicionamento/transformação.
   - Pela ordem natural de pintura do CSS, elementos do container irmão posterior com qualquer contexto de empilhamento são pintados **sobre** os descendentes do `<aside>`, fazendo com que o submenu flutuante (`position: fixed z-50` interno) fosse desenhado por baixo dos cards de ministério.
3. **Seletor de Idiomas em Modo Colapsado**:
   - Em modo colapsado, o menu de idiomas utiliza `absolute z-50 bottom-0 left-full ml-2 w-52`. Estando preso no `<aside>` estático, sofria o mesmo risco de ser encoberto pelo rodapé ou conteúdo da página.

---

## 3. Decisões de Arquitetura e Engenharia

1. **Elevação do Contexto de Empilhamento do `<aside>`**:
   - Alterar `<aside>` no desktop para `lg:relative lg:z-40`, removendo `lg:static lg:z-auto`.
   - No mobile, alinhar o overlay com `z-30` e o drawer com `z-40`.
   - Modais de sistema (`ModalShell`, `ConfirmDialog`, `ExportShareDialog`, drawers) operam em `z-50`, continuando a cobrir tanto a sidebar quanto as páginas com o backdrop escuro.
2. **Ajuste de Limites de Janela nos Flyouts**:
   - No cálculo de abertura de `collapsedSectionOpen`, calcular a altura estimada do flyout (`childrenCount * 40 + 44`) e limitar `top` a `Math.min(rect.top, Math.max(8, window.innerHeight - estimatedHeight - 16))`, impedindo corte vertical na parte inferior da tela.
3. **Limpeza de Estado e Listeners**:
   - Adicionar listener passivo de `scroll` no `<nav ref={navRef}>` e `resize` na `window` para fechar `collapsedSectionOpen`.
   - Limpar `collapsedSectionOpen` e `localeOpen` ao alterar `pathname`.

---

## 4. Etapas de Desenvolvimento

### Etapa 0 - Isolamento do Ambiente de Desenvolvimento
Status: concluido

- [x] Executar `git fetch origin` a partir da branch `development`.
- [x] Criar `git worktree` em diretório irmão `../oneelo-sidebar-fix` na branch `fix/sidebar-flyout-zindex`.
- [x] Confirmar que a pasta principal com a feature concorrente permaneceu 100% intocada.
- [x] Critério de validação da etapa: `git worktree list` comprovando isolamento total entre os diretórios.

### Etapa 1 - Correção do Stacking Context e Posicionamento da Sidebar
Status: concluido

- [x] Atualizar classes do elemento `<aside>` em `apps/web/src/components/app/sidebar.tsx` de `lg:static lg:z-auto` para `lg:relative lg:z-40`.
- [x] Atualizar overlay mobile para `z-30` e drawer mobile para `z-40` em `apps/web/src/components/app/sidebar.tsx`.
- [x] Implementar contenção de borda inferior da tela no cálculo de coordenadas do flyout (`top: adjustedTop`).
- [x] Adicionar fechamento automático do submenu ao rolar a navegação interna ou redimensionar a janela.
- [x] Adicionar fechamento de menus ao alterar `pathname`.
- [x] Critério de validação da etapa: Código compilando sem erros de sintaxe ou tipagem.

### Etapa 2 - Validação em Todas as Telas e Módulos da Sidebar
Status: concluido

- [x] Validar comportamento do flyout no módulo Membros (`/membros`, `/membros/visualizacao`, `/membros/exportacao`).
- [x] Validar comportamento do flyout no módulo Ministérios (`/ministerios`, `/ministerios/visualizacao`, `/ministerios/exportacao`).
- [x] Validar comportamento do flyout no módulo Escalas (`/escalas`, `/escalas/visualizacao`, `/escalas/exportacao`).
- [x] Validar comportamento do flyout no módulo Agenda (`/agenda`, `/agenda/visualizacao`, `/agenda/exportacao`).
- [x] Validar comportamento do flyout no módulo Financeiro (`/financeiro`, `/financeiro/visualizacao`, `/financeiro/exportacao`).
- [x] Validar comportamento do seletor de idiomas colapsado em telas com cards e rodapés.
- [x] Validar que modais (`ModalShell`, `ConfirmDialog`) continuam sobrepondo a sidebar corretamente com backdrop `z-50`.
- [x] Critério de validação da etapa: Nenhuma tela do dashboard apresentando elementos sobrepostos ao menu da sidebar.

### Etapa 3 - Validação Automatizada, Build e Finalização
Status: concluido

- [x] Executar typecheck em `apps/web` (`npx tsc --project apps/web/tsconfig.json --noEmit`).
- [x] Executar build de produção do frontend (`npx next build --webpack` em `apps/web`).
- [x] Executar bateria de testes do backend para garantir não-regressão geral (`npm test -w apps/api`).
- [x] Atualizar checklist do plano para concluído.
- [x] Critério de validação da etapa: Build e testes passando com 0 erros.

---

## 5. Critérios de Aceite Gerais

1. Todos os submenus flutuantes da sidebar colapsada (Membros, Ministérios, Escalas, Agenda, Financeiro) são renderizados estritamente acima de qualquer card, tabela, cabeçalho ou formulário em todas as telas do sistema.
2. O seletor de idiomas em modo colapsado abre à direita sem ficar oculto por nenhum componente da página.
3. Submenus abertos próximos à parte inferior da tela não sofrem corte vertical para fora da viewport.
4. Modais e diálogos de confirmação continuam cobrindo a sidebar normalmente com seu backdrop `z-50`.
5. Nenhuma alteração afeta a branch de feature concorrente no diretório principal.
