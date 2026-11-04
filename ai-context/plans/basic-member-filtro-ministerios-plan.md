# Plano - Correção do Filtro de Ministério na Visualização de Escalas para Membro Comum (BASIC)

Status geral: concluido  
Data de criação: 2026-11-04  
Branch sugerida para implementação: fix/basic-member-escala-filtro-ministerios  

## Planos e Referências Relacionados

- [basic-member-escala-visualizacao-plan.md](basic-member-escala-visualizacao-plan.md)
- [portal-member-scale-visualizations-plan.md](portal-member-scale-visualizations-plan.md)
- [ODS - Padrão de Visualização](../../ai-core/skills/oneelo-design-system/VIEW_STANDARD.md)

---

## 1. Objetivo da Entrega

Corrigir a exibição das opções no filtro "Ministério" da tela de visualização de escalas (`/escalas/visualizacao`) para membros com perfil `BASIC` (membros comuns que participam de ministérios com escalas) e ajustar o carregamento inicial dos cards de escala para iniciarem minimizados por padrão, reduzindo ruído visual e melhorando a navegabilidade.

---

## 2. Contexto e Diagnóstico

1. **Condição de Filtro Estrita no JSX (`page.tsx`)**:
   No select de ministério (`<FilterSelect label="Ministério">`), os itens eram filtrados por `.filter((m) => m.ativo && m.usaEscalas)`.
2. **Propriedades Indefinidas no Mapeamento de Membro**:
   Os ministérios extraídos de `user.membro.ministerios` eram mapeados como `{ id: m.id, nome: m.nome } as Ministerio`. As propriedades `ativo` e `usaEscalas` ficavam `undefined`, fazendo com que a checagem `m.ativo && m.usaEscalas` avaliasse para `false`, descartando todas as opções e exibindo apenas "Todos".
3. **Condição de Corrida (Race Condition) na Inicialização**:
   As chamadas `api.get('/api/ministerios')` e `api.get('/api/auth/me')` executavam em paralelo descompassado. Como `/api/ministerios` retorna `[]` para membros `BASIC`, se ela respondesse após `/api/auth/me`, a lista de ministérios era sobrescrita com `[]`.
4. **Fallback de Escalas com Propriedades Omitidas**:
   Ao extrair ministérios a partir de `escalas`, o fallback também criava objetos apenas com `{ id, nome }`, sujeitos ao mesmo descarte no filtro.
5. **Carga Inicial Expandida**:
   Todas as escalas carregavam expandidas por padrão, gerando uma rolagem longa quando havia múltiplos ministérios ou dias escalados.

---

## 3. Decisões de Arquitetura e Engenharia

1. **Coordenação de Requisições com `Promise.all`**:
   Unificar a busca de `/api/ministerios` e `/api/auth/me` no `useEffect` de montagem com `Promise.all`, evitando sobrescrita concorrente.
2. **Consolidação Segura via Map**:
   Consolidar ministérios vindos de `/api/ministerios` e de `user.membro.ministerios` em um `Map<string, Ministerio>`, assegurando que cada entrada possua `ativo: true` e `usaEscalas: item.ministerio.usaEscalas ?? true`.
3. **Ajuste no Fallback por Escalas Carregadas**:
   Garantir que as entradas adicionadas pelo `useEffect([escalas])` contenham `ativo: true` e `usaEscalas: true`.
4. **Filtro Defensivo no JSX**:
   Ajustar a expressão de filtragem do select para `ministerio.ativo !== false && ministerio.usaEscalas !== false`.
5. **Escalas Minimizadas por Padrão**:
   Substituir o estado `escalasMinimizadas` por `escalasExpandidas: Set<string>` iniciado vazio (`new Set()`). Cada escala renderiza minimizada a menos que conste em `escalasExpandidas`.

---

## 4. Etapas de Desenvolvimento

### Etapa 0 - Preparação e Isolamento da Branch
Status: concluido

- [x] Confirmar base atualizada a partir de `development`.
- [x] Criar e ativar a branch `fix/basic-member-escala-filtro-ministerios`.
- Critério de validação da etapa: `git status` limpo na branch correta.

### Etapa 1 - Correção da Carga e Filtragem de Ministérios no Frontend
Status: concluido

- [x] Unificar chamadas com `Promise.all` no `useEffect` de `apps/web/src/app/(dashboard)/escalas/visualizacao/page.tsx`.
- [x] Atribuir explicitamente `ativo: true` e `usaEscalas` nos objetos derivados de `user.membro.ministerios` e de `escalas`.
- [x] Atualizar a checagem no JSX para `ministerio.ativo !== false && ministerio.usaEscalas !== false`.
- [x] Executar typecheck com `npx tsc --project apps/web/tsconfig.json --noEmit`.
- Critério de validação da etapa: Typecheck do frontend aprovado sem erros.

### Etapa 2 - Carga Inicial Minimizada de Escalas
Status: concluido

- [x] Alterar gerenciamento de estado para `escalasExpandidas`, iniciando vazio.
- [x] Garantir que `minimizada = !escalasExpandidas.has(escala.id)`.
- [x] Validar funcionamento do `CollapseButton` para alternar entre "Mostrar escala" e "Minimizar escala".
- Critério de validação da etapa: Escalas iniciam minimizadas e abrem/fecham ao clicar no botão.

### Etapa 3 - Validação, Build e Finalização
Status: concluido

- [x] Executar typecheck (`npx tsc --project apps/web/tsconfig.json --noEmit`).
- [x] Executar build de produção do frontend (`npm --prefix apps/web run build`).
- [x] Atualizar checklist do plano para concluído.
- Critério de validação da etapa: Build e testes passando com 0 erros.

---

## 5. Critérios de Aceite Gerais

1. Membro com perfil `BASIC` visualiza no dropdown de Ministério da tela `/escalas/visualizacao` a opção "Todos" e cada um dos seus ministérios vinculados que utilizam escalas.
2. A seleção de um ministério específico filtra corretamente as escalas daquele ministério.
3. Não há condições de corrida entre `/api/ministerios` e `/api/auth/me`.
4. Usuários administradores e líderes continuam tendo acesso completo aos seus ministérios normalmente.
5. As escalas carregam inicialmente minimizadas em `/escalas/visualizacao`, exibindo apenas o cabeçalho e permitindo expansão individual sob demanda.
