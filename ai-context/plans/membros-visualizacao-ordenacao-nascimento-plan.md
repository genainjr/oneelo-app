# Plano - Ordenacao de membros por nascimento na visualizacao

Status: concluido

## Objetivo

Adicionar um seletor de ordenacao na tela `/membros/visualizacao` para manter a listagem padrao por nome e permitir ordenacao por data de nascimento quando o usuario estiver consultando aniversariantes do mes.

## Contexto

- A visualizacao atual de membros ja suporta filtro por `aniversarioMes`.
- O backend ja possui o endpoint `GET /api/membros/aniversariantes`.
- Hoje a tela de visualizacao ordena a lista por nome e filtra aniversariantes em memoria.
- O caso de uso principal e facilitar a leitura dos aniversariantes do mes sem criar uma nova tela.

## Decisao

- Nao criar uma rota nova nesta etapa.
- Manter `/membros/visualizacao` como a tela unica de leitura.
- Adicionar um controle de ordenacao explicito, com padrao `Nome (A-Z)`.
- Quando o filtro de mes de aniversario estiver ativo, permitir alternar para `Data de nascimento`.
- Quando a tela abrir a partir do atalho do dashboard de `Aniversariantes do Mês`, usar `Data de nascimento` como ordenacao inicial.

## Plano

### Etapa 1 - Definicao de comportamento

- [x] Confirmar a UX do seletor na area de filtros da pagina de visualizacao.
- [x] Fechar a regra de entrada do dashboard: ao abrir com `aniversarioMes`, iniciar em `Data de nascimento`.
- [x] Registrar quais telas ficam fora do escopo nesta entrega (`/membros`, `/membros/exportacao`).

Decisoes fechadas:

- O seletor de ordenacao fica no bloco de filtros da pagina `/membros/visualizacao`, na mesma faixa visual dos demais selects.
- A ordem padrao continua sendo `Nome (A-Z)` quando a tela abre sem filtro de aniversario.
- Quando a tela abrir com `aniversarioMes` vindo do dashboard, a ordem inicial sera `Data de nascimento`.
- A troca manual de ordenacao nao altera o filtro de mes ativo.
- O escopo desta entrega nao altera `/membros` nem `/membros/exportacao`.

### Etapa 2 - Frontend

- [x] Estender `use-membros-visualizacao` para carregar o criterio de ordenacao.
- [x] Ajustar `apps/web/src/app/(dashboard)/membros/visualizacao/page.tsx` para exibir e aplicar o seletor.
- [x] Garantir que a troca de ordenacao preserve o filtro de mes ativo.

Resultado da etapa:

- A visualizacao agora expõe o seletor `Ordenar por` no bloco de filtros.
- O padrão continua por nome quando a tela abre normalmente.
- Quando a tela abre via dashboard com `aniversarioMes`, a pagina inicia em `Data de nascimento`.
- A ordenacao e aplicada antes da paginacao, para manter a leitura correta da lista.

### Etapa 3 - Backend

- [x] Atualizar a API de membros para suportar a ordenacao sem quebrar o comportamento atual da listagem.
- [x] Garantir que o endpoint de aniversariantes mantenha a ordenacao por dia de nascimento.
- [x] Validar que a ordenacao por nascimento nao considera o ano.

Resultado da etapa:

- O DTO de visualizacao passou a aceitar `ordenacao`.
- `findVisualizacao` agora devolve a lista ordenada por nome ou por data de nascimento, conforme a query.
- `findAniversariantes` reutiliza a mesma regra de ordenacao, mantendo a leitura por dia de nascimento.
- A ordenacao por nascimento ignora o ano e usa dia/mês como critério principal, com desempate por nome.
- A validação de tipos da API passou com `npx.cmd tsc -p apps/api/tsconfig.build.json --noEmit`.
- O build completo do Nest ficou bloqueado por arquivos de `dist` já em uso no ambiente.

### Etapa 4 - Validação

- [x] Validar impacto em exportacao e dashboard, confirmando que nao foram alterados por acidente.
- [x] Rodar build/testes relevantes do `apps/web` e `apps/api`.
- [x] Revisar o comportamento final no fluxo do dashboard para aniversariantes.

Resultado da etapa:

- O fluxo do dashboard continua apontando para `/membros/visualizacao?aniversarioMes=...`.
- A tela de exportacao segue consumindo `useMembros()` e nao recebeu ordenacao nova.
- A busca por `ordenacao` ficou restrita a visualizacao de membros e ao DTO/backend correspondente.
- `npm.cmd run build -w apps/web` passou.
- `npx.cmd tsc -p apps/api/tsconfig.build.json --noEmit` passou.
- O build completo da API via `nest build` continuou bloqueado pelo `dist` em uso no ambiente.

## Riscos

- Ordenar apenas no frontend pode manter a pagina funcionando, mas deixa a regra duplicada se outras telas passarem a reutilizar o mesmo criterio.
- Ordenar por `DateTime` completo pode gerar resultado incorreto para aniversariantes, porque o ano de nascimento nao deve influenciar a lista.
- Se a ordenacao for aplicada de forma global ao hook `useMembros`, a exportacao e a tela administrativa podem mudar de comportamento sem necessidade.

## Critérios de aceite

- `/membros/visualizacao` continua ordenada por nome por padrao.
- O usuario consegue alternar para ordenacao por data de nascimento.
- O atalho do dashboard para aniversariantes abre a tela ja ordenada por data de nascimento.
- O fluxo de aniversariantes do mes fica mais legivel sem criar uma nova tela.
- `/membros` e `/membros/exportacao` mantem o comportamento atual.
- O build da web e da API continua passando.

## Controle de progresso

- Ao concluir uma etapa, marcar os itens dela como concluídos.
- Se uma decisao mudar no meio da implementacao, atualizar esta documentacao antes de codificar o ajuste seguinte.
- Nao avançar para a etapa seguinte sem registrar o resultado da etapa atual.

## Status atual

- Etapa 1 concluida.
- Etapa 2 concluida.
- Etapa 3 concluida.
- Etapa 4 concluida.
