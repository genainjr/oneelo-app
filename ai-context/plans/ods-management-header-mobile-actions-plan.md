# ODS - Management Header Mobile Actions Plan

Status: concluido
Branch: `refactor/ods-escalas-mobile`

## Objetivo

Replicar nas telas de gerenciamento de membros, ministerios e agenda o padrao mobile estabelecido em gerenciamento de escalas: botao principal abaixo do titulo/descricao no mobile, mantendo posicao superior direita no desktop.

## Escopo

- `/membros`
- `/ministerios`
- `/agenda`
- `PageHeader`

## Implementacao

- `PageHeader` recebeu a prop opcional `stackActionsOnMobile`.
- A prop foi aplicada apenas nas telas de gerenciamento alvo.
- Os botoes primarios receberam `max-sm:w-full` e centralizacao no mobile.
- Desktop permanece com o mesmo layout de acao no canto superior direito.

## Validacoes

- `npm exec -w apps/web eslint -- 'src/app/(dashboard)/membros/page.tsx' 'src/components/app/page-header.tsx'` - passou.
- `npm run build -w apps/web` - passou.

## Observacao

O lint direcionado incluindo `/agenda` e `/ministerios` ainda falha por debitos preexistentes nessas paginas (`any`, hooks/effects e import sem uso). Esses pontos nao foram alterados para evitar misturar refatoracao ampla com o ajuste visual solicitado.
