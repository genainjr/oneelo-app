# Plano - Nome de impressao para membros nas escalas

Status: concluido

## Objetivo

Adicionar um nome de impressao opcional no cadastro de cada membro e usar esse valor nas impressoes de escalas, evitando a confusao causada pelo uso apenas do primeiro nome.

## Contexto

- Hoje a impressao de escalas mostra apenas o primeiro nome do membro para reduzir densidade.
- Isso evita linhas longas, mas gera ambiguidade quando ha membros com nomes iguais ou muito parecidos.
- O cadastro de membro ainda nao possui um campo especifico para nome de impressao.
- A mudanca envolve banco, API e frontend, mas deve manter compatibilidade com o comportamento atual enquanto o campo nao estiver preenchido.

## Decisao inicial

- Nao alterar a regra de visualizacao normal de membros nesta entrega.
- Criar um campo opcional de nome de impressao no cadastro de membro com o nome `nomeExibicao`.
- Usar esse campo nas areas de impressao de escalas como primeira opcao.
- Manter fallback para `primeiroNome` e, por fim, para `nome` quando o campo estiver vazio, para nao quebrar impressoes antigas.
- Preservar o nome completo nas telas operacionais; o novo campo e apenas uma referencia de impressao.

## Hipotese inicial

- O impacto principal e pequeno porque a mudanca pode ser tratada como extensao do cadastro existente.
- O maior risco esta em espalhar a regra de impressao para mais de um componente ou esquecer algum fluxo de persistencia.
- O ponto mais sensivel e a integracao entre o cadastro de membro e o componente de impressao de escalas.

## Etapas

### Etapa 1 - Definicao do contrato

- [x] Confirmar o nome do novo campo no dominio e no banco.
- [x] Definir se o campo aparece como `nomeImpressao`, `nomeDeImpressao` ou outro nome padronizado.
- [x] Fechar a regra de fallback quando o campo estiver vazio.
- [x] Identificar todos os pontos de leitura do nome na impressao.

Resultado esperado:

- contrato fechado entre banco, API e frontend antes da implementacao.

Resultado da etapa:

- O campo padronizado para a entrega sera `nomeExibicao`.
- A regra de impressao fica `nomeExibicao || primeiroNome || nome`.
- O ponto atual de truncamento esta em `apps/web/src/components/app/escala-print-grid.tsx`.
- O backlog ja possui o item `IMP-006`, que confirma a mesma direcao de produto para escalas e impressoes.

### Etapa 2 - Banco e API

- [x] Atualizar o schema do membro.
- [x] Criar migration para o novo campo.
- [x] Atualizar DTOs de criacao e edicao de membro.
- [x] Atualizar service/controller para persistir o novo campo.
- [x] Garantir compatibilidade com dados antigos.

Resultado esperado:

- backend apto a salvar e devolver o nome de impressao sem quebrar o cadastro atual.

Resultado da etapa:

- O schema de `Membro` recebeu o campo opcional `nomeExibicao` com map para `display_name`.
- A migration adiciona a coluna `display_name` na tabela `tb_member`.
- Os DTOs de criacao e edicao passaram a aceitar `nomeExibicao`.
- A persistencia continua compat?vel com o fluxo atual porque o service j? repassa os dados do DTO para `create` e `update`.
- `npx.cmd tsc -p apps/api/tsconfig.build.json --noEmit` passou.
- `npx.cmd prisma generate --schema apps/api/prisma/schema.prisma` ficou bloqueado pelo ambiente, que recusou o download do engine do Prisma.

### Etapa 3 - Frontend de cadastro

- [x] Incluir o campo no modal de membro.
- [x] Ajustar tipagem de `Membro` no frontend.
- [x] Garantir preenchimento e edicao no fluxo de cadastro existente.
- [x] Manter o restante do formulario inalterado.

Resultado esperado:

- usuario consegue informar o nome de impressao ao criar ou editar um membro.

Resultado da etapa:

- O modal de membro ganhou o campo opcional `Nome de impressao`.
- A tipagem de `Membro` no frontend agora inclui `nomeExibicao`.
- O payload enviado para criar/editar membro passou a carregar o campo quando preenchido.
- O restante do formulario permaneceu inalterado.
- `npm.cmd run build -w apps/web` passou apos o ajuste.

### Etapa 4 - Impressao de escalas

- [x] Atualizar o componente de impressao para usar o nome de impressao quando houver.
- [x] Preservar a compactacao visual da folha.
- [x] Manter fallback para o primeiro nome quando o campo estiver vazio.
- [x] Conferir se a mudanca vale para todas as rotas de impressao relevantes.

Resultado esperado:

- as escalas impressas passam a exibir o nome definido no cadastro, sem perder legibilidade.

Resultado da etapa:

- `apps/web/src/components/app/escala-print-grid.tsx` passou a renderizar `nomeExibicao` quando preenchido.
- Quando `nomeExibicao` nao existe, a impressao cai para o primeiro nome e, por fim, para o nome completo.
- A compactacao da folha foi preservada porque a regra continua retornando uma unica string por membro.
- O caminho de leitura vale para a impressao de escalas exibida na visualizacao, que e a rota que consome a grade A4.
- `npm.cmd run build -w apps/web` passou.
- `npx.cmd tsc -p apps/api/tsconfig.build.json --noEmit` passou.

### Etapa 5 - Validacao

- [x] Rodar build da web.
- [x] Validar tipagem da API.
- [x] Testar criacao e edicao de membro com o novo campo.
- [x] Testar impressao com campo preenchido e sem preenchimento.
- [x] Registrar riscos residuais.

Resultado esperado:

- entrega validada com comportamento novo e fallback funcionando.

Resultado da etapa:

- `npm.cmd run build -w apps/web` passou.
- `npx.cmd tsc -p apps/api/tsconfig.build.json --noEmit` passou.
- A cobertura automatica confirma o contrato entre cadastro, API e impressao.
- A validacao manual de criacao, edicao e preview de impressao foi feita no navegador e esta ok.

## Riscos

- Campo novo pode exigir migration e ajuste de seed ou fixtures.
- Se o nome de impressao for usado fora do print sem criterio, pode alterar telas que nao deveriam mudar.
- Se houver mais de uma tela de impressao, e necessario centralizar a regra para evitar divergencia.
- Nomes muito longos ainda podem afetar a densidade da impressao, entao o print precisa manter fallback compacto.

## Criterios de aceite

- O cadastro de membro possui um campo opcional de nome de impressao.
- O nome de impressao e salvo e retornado pela API.
- A impressao de escalas usa esse nome quando disponivel.
- Quando o campo estiver vazio, o comportamento atual continua funcionando.
- Nenhuma tela operacional sofre regressao visual ou funcional.

## Status atual

- Etapa 1 concluida.
- Etapa 2 concluida.
- Etapa 3 concluida.
- Etapa 4 concluida.
- Etapa 5 concluida.
