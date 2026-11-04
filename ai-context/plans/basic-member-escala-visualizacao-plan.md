# Plano - Visualização de Escalas para Membros Comuns (BASIC)

Status geral: concluido  
Data de criação: 2026-11-04  
Branch sugerida para implementação: fix/basic-member-escala-visualizacao  

## Planos e Referências Relacionados

- [Visualizações de membros e escalas no portal](portal-member-scale-visualizations-plan.md)
- [Regras de Validação e RBAC](../business-rules/validation-rules.md)
- [ODS - Padrão de Visualização](../../ai-core/skills/oneelo-design-system/VIEW_STANDARD.md)

---

## 1. Objetivo da Entrega

Reverter a restrição excessiva que limitava a consulta de visualização de escalas (`GET /api/escalas/visualizacao`) exclusivamente a usuários com papel de líder ou co-líder (`LEADER` ou `ASSISTANT_LEADER`).

Com esta entrega:
- Usuários com perfil `BASIC` (membros comuns) que participam de ministérios com escalas passam a ter acesso de leitura à grade completa (`/escalas/visualizacao`) dos ministérios dos quais são membros.
- Na barra lateral (Sidebar), o item de navegação **Escalas** (`/escalas/visualizacao`) volta a ser exibido para membros comuns que participam de ministérios com escalas ativas.
- Na página de visualização de escalas, os filtros por ministério exibem corretamente as opções dos ministérios vinculados ao membro.

---

## 2. Contexto e Diagnóstico

1. **Backend (`apps/api/src/modules/escalas/escalas.service.ts`)**:
   No método `applyVisualizacaoScope`, uma alteração adicionou o filtro `role: { in: [MinistryRole.LEADER, MinistryRole.ASSISTANT_LEADER] }`. Por conta disso, membros comuns que participam de ministérios, mas não são líderes, recebiam uma lista vazia `[]`.
2. **Frontend (`apps/web/src/components/app/sidebar.tsx`)**:
   A Sidebar já possui a condição `!basicHasLeadership && basicHasEscalasVisualizacao ? [{ href: '/escalas/visualizacao', label: t('schedules'), icon: ICONS.schedules }] : []`. Como o endpoint retornava vazio, `basicHasEscalasVisualizacao` avaliava para `false`, ocultando o item "Escalas" e deixando apenas "Minhas Escalas".
3. **Filtro de Ministérios (`apps/web/src/app/(dashboard)/escalas/visualizacao/page.tsx`)**:
   O select de ministérios consulta `/api/ministerios`, que é restrito a líderes para perfil `BASIC`. Membros comuns ficavam sem opções no select caso não houvesse fallback a partir do perfil do membro (`user.membro.ministerios`) ou das escalas carregadas.

---

## 3. Decisões de Arquitetura e Engenharia

1. **Escopo de Acesso na Visualização**:
   - `applyVisualizacaoScope`: O usuário `BASIC` poderá visualizar escalas de todos os ministérios ativos em que ele possui vínculo em `MinisterioMembro` (`membroId === user.memberId`), independentemente de ser líder ou membro comum.
   - Escopo isolado por tenant e ministérios participados é mantido rigorosamente.
2. **Manutenção do Bloqueio de Edição**:
   - A rota e operações de gestão/criação/edição (`/escalas`, `POST`, `PATCH`, `DELETE`) continuam estritamente protegidas e restritas a administradores e líderes de ministério.
3. **Resiliência do Filtro no Frontend**:
   - Em `escalas/visualizacao/page.tsx`, caso `/api/ministerios` não retorne registros (membro não-líder), as opções do filtro de ministério são derivadas a partir dos ministérios do usuário em `user.membro.ministerios` ou das escalas retornadas.
4. **Testes Unitários**:
   - Atualizar a suíte `escalas.service.spec.ts` para testar o acesso de membros comuns com participação ministerial.

---

## 4. Etapas de Desenvolvimento

### Etapa 1 - Ajuste no Backend (`applyVisualizacaoScope` e Testes Unitários)
Status: concluido

- [x] Remover restrição de `role: { in: [LEADER, ASSISTANT_LEADER] }` no método `applyVisualizacaoScope` de `apps/api/src/modules/escalas/escalas.service.ts`.
- [x] Atualizar suíte de testes em `apps/api/src/modules/escalas/escalas.service.spec.ts`.
- [x] Executar bateria de testes do módulo de escalas (`npm test -w apps/api`).
- Critério de validação da etapa: Testes unitários do backend passando com 100% de sucesso (24/24 no módulo, 172/172 na suíte completa).

### Etapa 2 - Resiliência no Frontend (Sidebar e Filtros de Visualização)
Status: concluido

- [x] Garantir que em `apps/web/src/app/(dashboard)/escalas/visualizacao/page.tsx` os ministérios disponíveis para filtro incluam os ministérios do membro (`user.membro.ministerios`).
- [x] Confirmar que `apps/web/src/components/app/sidebar.tsx` renderiza corretamente o link "Escalas" para membro `BASIC` sem liderança quando houver escalas disponíveis.
- [x] Verificar tipagem com `npx tsc --project apps/web/tsconfig.json --noEmit`.
- Critério de validação da etapa: TypeScript typecheck do web concluído sem erros.

### Etapa 3 - Validação Integrada, Build e Conclusão
Status: concluido

- [x] Executar build de produção do frontend (`npm run build -w apps/web`).
- [x] Executar testes gerais do backend (`npm test -w apps/api`).
- [x] Atualizar documentação e status do plano.
- Critério de validação da etapa: Builds e testes aprovados.

---

## 5. Critérios de Aceite Gerais

1. Membro `BASIC` que participa de ministérios com escalas ativas consegue ver o item "Escalas" na Sidebar.
2. Ao acessar `/escalas/visualizacao`, o membro visualiza a grade completa com os demais escalados do ministério.
3. Membro `BASIC` sem liderança continua proibido de editar ou gerenciar escalas.
4. Nenhuma outra feature ou branch é impactada.
