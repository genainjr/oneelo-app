# ODS - Membros Management Table Plan

Status: concluido
Branch: `refactor/ods-escalas-mobile`

## Objetivo

Corrigir a tela de gerenciamento de membros para manter apresentacao tabular no desktop e no mobile, removendo o fallback em cards que nao faz sentido para o fluxo CRUD de gerenciamento.

## Fontes

- `ai-context/frontend/ods-compliance-matrix.md`
- `ai-context/plans/ods-current-status.md`

## Diagnostico

- A matriz ODS classifica `/membros` como CRUD tabular com `DataTable`.
- A pagina usa `DataTable`, mas tambem passa `renderMobileCard` com `EntityCard`.
- Esse fallback transforma a listagem em cards abaixo do breakpoint responsivo, destoando da expectativa de gerenciamento tabular.
- A pagina tambem exibia cards de metricas (`StatCard`) no topo, enquanto o benchmark interno solicitado foi `/escalas`, que usa cabecalho, filtros e listagem sem cards de resumo.

## Plano

- [x] Remover `renderMobileCard` de `/membros`.
- [x] Remover import de `EntityCard` se ficar sem uso.
- [x] Remover cards de metricas do topo para alinhar ao padrao de gerenciamento de escalas.
- [x] Preservar colunas, selecao, paginacao, acoes, filtros e modal.
- [x] Rodar lint direcionado.
- [x] Rodar build web.

## Validacoes

- `npm exec -w apps/web eslint -- 'src/app/(dashboard)/membros/page.tsx' 'src/components/app/data-table.tsx'` - passou.
- `npm run build -w apps/web` - passou.

## Resultado

- `/membros` deixa de renderizar cards via `EntityCard`.
- `/membros` deixa de renderizar os cards de metricas no topo.
- `DataTable` passa a ser a apresentacao unica da tela de gerenciamento, inclusive no mobile.
- O comportamento de filtros, selecao, paginacao, modal de membro, exclusao e acoes em massa foi preservado.
- Foram corrigidos pequenos debitos no mesmo arquivo para manter lint direcionado passando: import sem uso, `any` em catches e chamada direta de `fetchTags` no effect inicial.
