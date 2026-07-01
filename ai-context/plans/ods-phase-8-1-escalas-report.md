# ODS Fase 8.1 - Escalas: Grid, Filtros e Campos

Status: implementado
Branch: `refactor/ods-escalas-layout`

## Objetivo

Executar uma refatoracao incremental e controlada no modulo `/escalas`, aumentando aderencia ao OneElo Design System sem alterar comportamento funcional, regras de negocio, APIs, contratos, autenticacao ou permissoes.

Fontes oficiais:

- `ai-context/plans/ods-current-status.md`
- `ai-context/frontend/ods-compliance-matrix.md`

## Escopo Executado

- Extracao da grade interativa para componente dedicado `EscalaGrid`.
- Reducao da responsabilidade de `apps/web/src/app/(dashboard)/escalas/page.tsx`.
- Reuso de utilitarios compartilhados de escala:
  - `getDias`
  - `getFuncoes`
  - `getItens`
  - `isFuncaoOculta`
- Inclusao de constantes compartilhadas:
  - `MONTH_KEYS`
  - `WEEKDAY_KEYS`
- Padronizacao do fluxo de filtros com `FilterShell` + `FilterActions`.
- Substituicao de campos inline crus por `InputField` e `SelectField`, preservando labels acessiveis ocultos via `hideLabel`.
- Inclusao de `ModalError` no modal de criacao.
- Uso de `STATUS_ESCALA_COLOR` compartilhado.

## Checklist

- [x] Manter backend intocado.
- [x] Manter endpoints intocados.
- [x] Manter schemas intocados.
- [x] Manter autenticacao/RBAC intocados.
- [x] Nao alterar `/escalas/visualizacao`.
- [x] Nao alterar `/escalas/exportacao`.
- [x] Nao substituir grade por `DataTable`.
- [x] Extrair `EscalaGrid`.
- [x] Usar `FilterActions`.
- [x] Remover `<input>` e `<select>` crus da rota/grade.
- [x] Reduzir duplicacao de meses, dias da semana e status.
- [x] Adicionar erro inline no modal com `ModalError`.
- [x] Rodar validacoes relevantes.

## Arquivos Alterados

- `apps/web/src/app/(dashboard)/escalas/page.tsx`
- `apps/web/src/components/app/escala-grid.tsx`
- `apps/web/src/components/app/escala-shared.tsx`
- `apps/web/src/components/app/form-field.tsx`

## Validacoes

Comandos executados:

```txt
npm exec -w apps/web eslint -- 'src/app/(dashboard)/escalas/page.tsx' 'src/components/app/escala-grid.tsx' 'src/components/app/escala-shared.tsx' 'src/components/app/form-field.tsx'
npm run build -w apps/web
```

Resultado:

- Lint direcionado dos arquivos alterados: passou.
- Build do app web: passou.

Observacao:

- `npm run lint -w apps/web` global ainda falha por debitos preexistentes fora do escopo desta fase, especialmente `any` e `setState` em efeitos em outros modulos/hooks.

## Pendencias

- Permissoes e navegacao continuam locais/distribuidas; isso permanece fora do escopo desta fase e pertence a Fase 8 completa.
- Toast local de `/escalas` permanece inalterado por requisito de escopo.
- A grade interativa continua sendo uma tabela customizada, conforme excecao de dominio prevista no ODS.

## Score Estimado

Score anterior auditado: 76/100.

Score estimado apos esta fase: 84/100.

