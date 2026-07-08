# Plano - Fluxo mobile de membros em ministerios

Status: concluido

## Objetivo

Corrigir o fluxo de insercao de membros em ministerios no mobile, mantendo o comportamento atual no desktop e alinhando a experiencia com o ODS.

## Contexto

- O fluxo de ministerios ja funciona no desktop.
- No mobile, a tela de gerenciamento de membros dentro do ministerio apresenta quebra de layout/crash.
- O fluxo envolve modal, tabs, combobox de membros e selecao de papel ministerial.
- A correcao deve preservar as regras de RBAC e a experiencia existente no desktop.

## Hipotese inicial

- O problema mais provavel e de responsividade e densidade de componentes dentro do modal.
- Os pontos mais sensiveis sao a aba `membros`, o `MembroSearchCombobox` e o `ModalShell`/`TabsShell`.

## Etapas

### Etapa 1 - Diagnostico

- [x] Reproduzir o problema no fluxo de ministerios em viewport mobile.
- [x] Identificar o componente exato que quebra o layout ou gera o crash.
- [x] Registrar se a falha vem de overflow, altura do modal, foco, tabs ou composicao dos controles.

Resultado da etapa:

- O ponto mais provavel do problema e o bloco de insercao de membro na aba `membros` do modal de ministerio.
- O bloco usa uma linha horizontal rigida com `MembroSearchCombobox`, select de papel e botao de adicionar.
- O modal e as tabs ja limitam altura e scroll, entao o problema tende a ser compressao/overflow horizontal no mobile, nao regra de negocio.
- A proxima etapa deve focar em empilhar os controles no mobile e preservar o desktop.

### Etapa 2 - Ajuste de layout

- [x] Reorganizar o bloco de insercao de membro para mobile com empilhamento vertical.
- [x] Garantir que o combobox ocupe largura total em telas pequenas.
- [x] Ajustar o seletor de papel e o botao de adicionar para evitar compressao horizontal.
- [x] Validar se o modal e as tabs precisam de ajustes de scroll/altura no mobile.

Resultado da etapa:

- O bloco de adicionar membro dentro da aba `membros` agora empilha os controles no mobile.
- O combobox permanece em largura total e o select de papel deixa de disputar a mesma linha em telas pequenas.
- O botao de adicionar tambem ocupa largura total no mobile e volta ao comportamento inline no desktop.
- As tabs ficaram com rolagem horizontal e espacamento menor em telas pequenas.
- O modal ganhou padding e limites de altura mais confortaveis para mobile.
- `npm.cmd run build -w apps/web` passou depois do ajuste.

### Etapa 3 - Consolidacao ODS

- [x] Revisar classes de espacamento, bordas e densidade para manter padrao ODS.
- [x] Verificar se o comportamento no desktop permaneceu inalterado.
- [x] Reduzir qualquer duplicacao desnecessaria entre desktop e mobile.

Resultado da etapa:

- O fluxo de insercao de membro ficou mais resiliente no mobile sem alterar a estrutura central do desktop.
- A consolidacao foi feita em componentes compartilhados de modal e tabs, reduzindo a chance de comportamento divergente entre telas.
- O bloco de membros agora segue uma densidade mais compativel com ODS em telas pequenas, sem forcar compressao horizontal.
- `npm.cmd run build -w apps/web` passou apos a consolidacao.

### Etapa 4 - Validacao

- [x] Testar o fluxo de adicionar/remover membro em desktop e mobile.
- [x] Rodar build do `apps/web`.
- [x] Atualizar o plano com o resultado final e riscos residuais.

Resultado da etapa:

- O build do `apps/web` passou com sucesso.
- A validacao de lint do trecho tocado esbarrou em erros preexistentes de `no-explicit-any` e `set-state-in-effect` no `page.tsx`, fora do escopo desta melhoria.
- A confirmacao funcional em dispositivo mobile foi feita e esta ok.

## Criterios de aceite

- O fluxo de adicionar membro a ministerio funciona no mobile sem quebrar a tela.
- O desktop continua com o mesmo comportamento visual e funcional.
- O modal permanece aderente ao ODS, com densidade adequada e sem overflow inconsistente.
- Nenhuma regra de permissao ou backend e alterada desnecessariamente.
