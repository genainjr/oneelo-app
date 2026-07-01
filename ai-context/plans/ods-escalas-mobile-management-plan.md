# ODS - Escalas Mobile Management Plan

Status: concluido
Branch: `refactor/ods-escalas-mobile`

## Objetivo

Ajustar exclusivamente a experiencia mobile de `/escalas` para aderir melhor ao OneElo Design System, sem alterar desktop, APIs, backend, permissoes, regras de negocio, auth, RBAC, criacao/edicao, `/escalas/visualizacao` ou `/escalas/exportacao`.

Fontes oficiais:

- `ai-context/plans/ods-current-status.md`
- `ai-context/frontend/ods-compliance-matrix.md`

## Diagnostico Inicial

- `/escalas/visualizacao` usa `EscalaReadonlyGrid` com duas renderizacoes: tabela em desktop e cards por dia em mobile.
- `/escalas` usa `EscalaGrid` com tabela horizontal unica, exigindo scroll lateral no mobile e gerando perda de contexto entre dia, funcao e membro.
- A estrutura de mobile mais madura ja existe no produto: dias como secoes, funcoes como blocos verticais e membros agrupados por funcao.

## Estrategia

Implementar um render mobile especifico dentro de `EscalaGrid`, inspirado em `EscalaReadonlyGrid`, mantendo a tabela atual para desktop.

Preservar:

- Mesmos handlers.
- Mesma regra de exibicao de acoes por `canManage`.
- Mesma logica de membros por funcao.
- Mesma logica de ocultar/mostrar funcao.
- Mesmo fluxo de adicionar/remover membro.
- Mesmo fluxo de adicionar/remover dia.

## Checklist

- [x] Manter desktop visualmente igual.
- [x] Criar render mobile em cards por dia.
- [x] Reutilizar `getDias`, `getFuncoes`, `getItens`, `isFuncaoOculta` e `MemberChip` quando aplicavel.
- [x] Manter acoes de edicao disponiveis no mobile.
- [x] Evitar inputs/selects crus.
- [x] Evitar nova arquitetura ou componente generico excessivo.
- [x] Rodar lint direcionado.
- [x] Rodar build web.

## Implementacao

- `EscalaGrid` passou a ter renderizacoes responsivas separadas:
  - desktop: tabela existente preservada em `md:block`;
  - mobile: cards por dia em `md:hidden`, alinhados ao padrao de `EscalaReadonlyGrid`.
- O cabecalho de `/escalas` foi alinhado ao padrao CRUD: `PageHeader` com uma unica acao primaria de criar no canto superior direito.
- No mobile, o `PageHeader` de `/escalas` empilha a acao primaria abaixo do titulo/descricao para manter o botao de IA logo abaixo de `Nova Escala`.
- O mobile agrupa funcoes verticalmente por dia para reduzir scroll lateral e perda de contexto.
- Os controles desktop de remover dia, remover membro e ocultar/mostrar funcao foram refinados com area de clique consistente, borda, foco visivel e sem sobreposicao no conteudo da celula.
- As acoes existentes foram mantidas:
  - adicionar/remover membro;
  - ocultar/mostrar funcao;
  - adicionar/remover dia;
  - reordenar dias em rascunho.
- A reordenacao em mobile usa botoes compactos de subir/descer com o mesmo `onReorderDias` ja usado pela tabela desktop.
- O bloco de adicionar dia foi extraido para `AddDayControls`, reutilizado no desktop e no mobile sem criar componente generico global.
- A acao secundaria de IA em breve foi removida do `PageHeader` para nao competir com a acao primaria de criacao, mas foi preservada como botao proprio logo abaixo, alinhado a direita e com o mesmo padrao visual do botao de criar.

## Validacoes

- `npm exec -w apps/web eslint -- 'src/app/(dashboard)/escalas/page.tsx' 'src/components/app/escala-grid.tsx' 'src/components/app/page-header.tsx' 'src/components/app/escala-shared.tsx' 'src/components/app/form-field.tsx'` - passou sem erros.
- `npm run build -w apps/web` - passou.
- `Select-String` para `<input|<select` no escopo retornou apenas `InputField` e `SelectField`, sem campos crus novos.

## Pendencias

- Validacao visual manual em dispositivo real ou em screenshot responsivo ainda recomendada antes de merge.
- O desktop nao foi redesenhado por estar fora do escopo.
- Arquivos sujos preexistentes fora do escopo foram preservados e nao fazem parte desta entrega:
  - `.claude/settings.local.json`
  - `ESTRUTURA_MONOREPO.md`
  - `apps/api/prisma/migrations/migration_lock.toml`

## Score ODS Estimado

- Antes: aproximadamente 76/100, conforme auditoria anterior.
- Depois: aproximadamente 82/100 no modulo de gerenciamento de escalas.
- Ganho principal: responsividade mobile alinhada ao padrao interno de `/escalas/visualizacao`, com menor dependencia de scroll lateral.
