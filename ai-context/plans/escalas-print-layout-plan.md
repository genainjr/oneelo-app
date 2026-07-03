vamos

# Plano - Impressao de Escalas

Status geral: implementado - validacao visual pendente
Ultima atualizacao: 2026-07-03

## Objetivo

Melhorar a impressao de `/escalas/visualizacao` para gerar uma folha limpa e propria para PDF/papel, em vez de imprimir a tela administrativa como um print.

A impressao deve conter, no minimo:

- nome da igreja;
- mes e ano;
- ministerio da escala;
- tabela por dia/data e funcoes;
- membros escalados por funcao em texto compacto.
- layout otimizado para folha A4.

Referencia visual analisada:

- `impressao_escala.png`

## Contexto Atual

Hoje o botao de impressao em `/escalas/visualizacao` executa `window.print()` diretamente na pagina inteira.

Comportamento atual:

- imprime `PageHeader`;
- imprime cards de metricas;
- imprime filtros;
- imprime elementos do layout administrativo;
- usa a grade read-only atual, com celulas baseadas em chips/componentes visuais;
- nao existe area dedicada de impressao.

Arquivos envolvidos:

- `apps/web/src/app/(dashboard)/escalas/visualizacao/page.tsx`
- `apps/web/src/components/app/escala-readonly-grid.tsx`
- `apps/web/src/components/app/escala-shared.tsx`
- `apps/web/src/types/index.ts`

## Diagnostico

A referencia do Excel mostra uma impressao com caracteristicas diferentes da tela web:

- cabecalho grande com nome da igreja e mes/ano;
- uma tabela unica, densa e legivel;
- linhas por dia;
- colunas por funcao;
- membros como texto separado por virgula;
- ausencia de controles, cards, filtros e decoracao de dashboard.

No modelo atual do OneElo, isso corresponde naturalmente a uma variacao de impressao da grade read-only de escalas.

## Escopo

Incluido:

- criar uma area exclusiva de impressao dentro de `/escalas/visualizacao`;
- ocultar filtros, cards, botoes e elementos administrativos no modo print;
- exibir nome da igreja usando dados de `/api/auth/me`;
- exibir mes/ano e ministerio no cabecalho da folha;
- renderizar membros em texto compacto, sem chips;
- otimizar a folha para tamanho A4;
- manter a visualizacao normal da tela sem regressao;
- suportar uma ou mais escalas no resultado filtrado;
- preparar CSS `@media print` especifico.

Fora do escopo:

- alterar regras de escala;
- alterar backend de escalas;
- alterar permissoes/RBAC;
- criar exportacao PDF server-side;
- criar arquivo XLSX;
- redesenhar a tela interativa de `/escalas`;
- mudar o cadastro de ministerios, funcoes ou membros.

## Estrategia

### 1. Separar tela e impressao

Manter a tela atual como experiencia de consulta e filtros.

Adicionar uma estrutura dedicada para impressao, por exemplo:

- wrapper `print-area`;
- elementos administrativos com classe `print:hidden` ou equivalente global;
- folha imprimivel com cabecalho e tabela.

### 2. Criar grade compacta de impressao

Criar uma variacao dedicada, preferencialmente local ao dominio de escalas, para evitar sobrecarregar `EscalaReadonlyGrid`.

Opcao recomendada:

- novo componente `EscalaPrintGrid`;
- recebe `escala` e dados de cabecalho;
- reutiliza `getFuncoes`, `getDias`, `getItens` e `isFuncaoOculta`;
- renderiza celulas como strings, nao como `MemberChip`.

Formato da tabela:

| Dia | Data       | Funcao 1       | Funcao 2 | Funcao 3 |
| --- | ---------- | -------------- | -------- | -------- |
| sex | 03/07/2026 | Nome 1, Nome 2 | Nome 3   | -        |

### 3. Cabecalho de folha

O cabecalho imprimivel deve conter:

- nome da igreja em destaque;
- mes e ano na mesma linha ou alinhado a direita;
- nome do ministerio;
- status da escala opcionalmente discreto;
- observacoes da escala, se existirem.

Fonte do nome da igreja:

- `api.get<AuthUser>('/api/auth/me')`;
- usar `currentUser.tenant?.nome`;
- fallback seguro: `OneElo` ou nome do ministerio se o tenant nao estiver disponivel.

### 4. CSS de impressao

Adicionar regras em `globals.css` ou escopo equivalente:

- definir `@page` para tamanho A4;
- esconder sidebar/header/filtros/cards/botoes no print;
- remover fundos escuros e sombras;
- definir margens de pagina;
- evitar quebra de linha dentro de uma linha de escala quando possivel;
- usar fonte menor e compacta;
- permitir `page-break-before` entre escalas quando houver multiplas escalas;
- recomendar paisagem para muitas funcoes.

Exemplo conceitual:

```css
@media print {
  @page {
    size: A4 landscape;
    margin: 10mm;
  }

  .no-print {
    display: none !important;
  }

  .print-area {
    display: block !important;
  }

  .print-page {
    break-after: page;
  }
}
```

Decisao inicial recomendada:

- usar A4 em orientacao paisagem como padrao para impressao de escalas, porque a matriz cresce horizontalmente conforme o numero de funcoes;
- manter margens compactas entre 8mm e 12mm;
- evitar fontes grandes dentro da tabela;
- se houver poucas funcoes, o layout continua adequado em paisagem e reduz risco de corte lateral.

### 5. Multiplas escalas

Quando os filtros retornarem mais de uma escala:

- renderizar uma folha por escala;
- cada folha inicia com seu proprio cabecalho;
- aplicar quebra de pagina entre folhas;
- preservar a ordem atual dos resultados.

## Status das Etapas

| Etapa                         | Status    | Descricao                                                                              |
| ----------------------------- | --------- | -------------------------------------------------------------------------------------- |
| 1. Confirmacao de dados       | concluido | Dados de cabecalho e tabela confirmados sem necessidade de backend novo.               |
| 2. Estrutura de impressao     | concluido | Area administrativa isolada em`no-print` e area imprimivel criada em `print-area`. |
| 3. Componente de grade A4     | concluido | Criado `EscalaPrintGrid` com tabela compacta dias x funcoes para impressao.            |
| 4. CSS de print               | concluido | CSS de impressao A4 paisagem criado com ocultacao de UI e estilos compactos.           |
| 5. Integracao na pagina       | concluido | Tenant, cabecalho por escala e multiplas paginas integrados na area de impressao.      |
| 6. Validacao                  | parcial   | Checks automatizados passaram; previa/PDF ainda requer validacao manual.               |
| 7. Atualizacao final do plano | concluido | Resultado, arquivos alterados, validacoes e pendencias registrados.                    |

## Etapas de Execucao

### Etapa 1 - Confirmacao de Dados

Status: concluido

Objetivo: confirmar que os dados necessarios ja estao disponiveis no frontend sem alterar backend.

Checklist:

- [X] Confirmar se `/api/auth/me` fornece `tenant.nome` para perfis que acessam `/escalas/visualizacao`.
- [X] Confirmar estrutura retornada por `/api/escalas/visualizacao`.
- [X] Confirmar que `escala.ministerio.funcoes` vem ordenado por `ordem`.
- [X] Confirmar que `dias.itens` contem `membro.nome` e `ministerioFuncaoId`.
- [X] Definir fallback para nome da igreja quando `tenant.nome` nao estiver disponivel.

Saida esperada:

- lista de dados confirmados;
- decisao sobre necessidade ou nao de backend.

Resultado:

- `/api/auth/me` retorna `tenant.nome`, `tenant.slug`, `tenant.plano` e `tenant.limiteMembros` em `AuthService.me`.
- `/api/escalas/visualizacao` ja retorna escalas com `ministerio`, `funcoes`, `dias`, `funcoesOcultas` e `itens`.
- `ministerio.funcoes` e ordenado por `ordem: 'asc'` em `EscalasService.findVisualizacao`.
- `dias.itens` inclui `membro` com `id`, `nome`, `email`, `whatsapp` e `status`.
- Cada item de escala contem `ministerioFuncaoId`, suficiente para agrupar membros por funcao usando os helpers atuais.
- O hook `useEscalasVisualizacao` ja consome `/api/escalas/visualizacao` e guarda o resultado como `Escala[]`.
- Nao ha necessidade de alterar backend para a primeira versao da impressao.
- Fallback definido para cabecalho: usar `currentUser.tenant?.nome`; se ausente, usar `OneElo`.

Evidencias:

- `apps/api/src/modules/auth/auth.service.ts`
- `apps/api/src/modules/auth/auth.controller.ts`
- `apps/api/src/modules/escalas/escalas.service.ts`
- `apps/api/src/modules/escalas/escalas.controller.ts`
- `apps/web/src/hooks/use-escalas-visualizacao.ts`

### Etapa 2 - Estrutura de Impressao

Status: concluido

Objetivo: separar visualizacao normal e conteudo imprimivel.

Checklist:

- [X] Definir wrappers `no-print` para UI administrativa.
- [X] Definir wrapper `print-area` para conteudo imprimivel.
- [X] Manter `PageHeader`, filtros, cards e estados normais na tela.
- [X] Garantir que a area imprimivel seja renderizada apenas quando houver escalas.
- [X] Garantir que estado vazio continue usando `EmptyState`.

Saida esperada:

- pagina preparada para imprimir apenas o conteudo da escala.

Resultado:

- Todo o conteudo administrativo atual de `/escalas/visualizacao` foi envolvido por `no-print`.
- A area `print-area` foi criada e renderiza apenas quando `!loading && escalas.length > 0`.
- A area imprimivel cria uma `print-page` por escala, preparando o suporte a multiplas escalas.
- Nesta etapa, a area imprimivel ainda reutiliza `EscalaReadonlyGrid`; a grade compacta A4 sera tratada na Etapa 3.
- O estado vazio continua exclusivo da tela normal com `EmptyState`.
- Nenhum backend foi alterado.

Validacao:

- `npx.cmd tsc -p apps/web/tsconfig.json --noEmit` - passou.

### Etapa 3 - Componente de Grade A4

Status: concluido

Objetivo: criar uma grade compacta e propria para A4.

Checklist:

- [X] Criar componente dedicado para impressao, por exemplo `EscalaPrintGrid`.
- [X] Reutilizar `getFuncoes`, `getDias`, `getItens` e `isFuncaoOculta`.
- [X] Renderizar colunas fixas `Dia` e `Data`.
- [X] Renderizar uma coluna por funcao do ministerio.
- [X] Renderizar membros como texto separado por virgula.
- [X] Renderizar `-` para celulas vazias.
- [X] Renderizar indicacao discreta para funcao oculta/indisponivel.
- [X] Evitar `MemberChip`, badges grandes e controles interativos.

Saida esperada:

- tabela densa, legivel e independente da grade visual atual.

Resultado:

- Criado `apps/web/src/components/app/escala-print-grid.tsx`.
- O componente renderiza uma tabela compacta com colunas `Dia`, `Data` e funcoes do ministerio.
- Os membros escalados sao exibidos como texto separado por virgula.
- Celulas vazias exibem `-`.
- Funcoes ocultas exibem `Indisponivel`.
- A grade reutiliza `getFuncoes`, `getDias`, `getItens` e `isFuncaoOculta`.
- A `print-area` de `/escalas/visualizacao` passou a usar `EscalaPrintGrid`, preservando `EscalaReadonlyGrid` apenas na tela normal.

Arquivos alterados:

- `apps/web/src/components/app/escala-print-grid.tsx`
- `apps/web/src/app/(dashboard)/escalas/visualizacao/page.tsx`

Validacao:

- `npx.cmd tsc -p apps/web/tsconfig.json --noEmit` - passou.

### Etapa 4 - CSS de Print A4

Status: concluido

Objetivo: aplicar regras especificas de impressao em A4.

Checklist:

- [X] Definir `@page { size: A4 landscape; margin: 10mm; }`.
- [X] Ocultar `.no-print` no modo print.
- [X] Exibir/ajustar `.print-area` no modo print.
- [X] Remover sombras, fundos de dashboard e bordas decorativas.
- [X] Ajustar fonte da tabela para caber em A4.
- [X] Evitar quebra de pagina dentro de linhas quando possivel.
- [X] Aplicar quebra de pagina entre multiplas escalas.
- [ ] Testar se a impressao continua aceitavel com poucas funcoes.

Saida esperada:

- CSS previsivel para impressao A4 paisagem.

Resultado:

- Adicionado CSS de impressao em `apps/web/src/app/globals.css`.
- Definido `@page` com `A4 landscape` e margem de `10mm`.
- `.no-print` e ocultado no modo print.
- `.print-area` passa a ser exibido no modo print e fica isolado visualmente.
- A tabela `.print-schedule-table` recebeu estilos compactos, bordas, `table-layout: fixed` e fonte menor.
- Linhas da tabela tentam evitar quebra de pagina com `break-inside: avoid`.
- `.print-page` aplica quebra de pagina entre multiplas escalas.

Arquivos alterados:

- `apps/web/src/app/globals.css`

Validacao:

- `npx.cmd tsc -p apps/web/tsconfig.json --noEmit` - passou.

Observacao:

- O checklist de poucas funcoes permanece pendente para a Etapa 6, pois depende de validacao visual na previa de impressao.

### Etapa 5 - Integracao na Pagina

Status: concluido

Objetivo: integrar dados, botao de impressao e multiplas escalas.

Checklist:

- [X] Buscar `currentUser` ou `tenantName` em `/escalas/visualizacao`.
- [X] Passar nome da igreja para a area de impressao.
- [X] Exibir cabecalho com igreja, mes, ano e ministerio.
- [X] Renderizar uma folha por escala quando houver multiplas escalas.
- [X] Preservar ordem atual dos resultados filtrados.
- [X] Manter `window.print()` como gatilho, mas com conteudo print-only correto.

Saida esperada:

- fluxo de impressao funcionando sem imprimir UI administrativa.

Resultado:

- `/escalas/visualizacao` agora busca `/api/auth/me` e armazena `tenantName`.
- O fallback para nome da igreja permanece `OneElo`.
- Criado `EscalaPrintHeader` local na pagina para renderizar igreja, ministerio, mes e ano por escala.
- A `print-area` renderiza uma `print-page` por escala na ordem atual de `escalas`.
- O botao de impressao continua usando `window.print()`.
- Adicionados estilos de cabecalho imprimivel em `globals.css`.

Arquivos alterados:

- `apps/web/src/app/(dashboard)/escalas/visualizacao/page.tsx`
- `apps/web/src/app/globals.css`

Validacao:

- `npx.cmd tsc -p apps/web/tsconfig.json --noEmit` - passou.

### Etapa 6 - Validacao

Status: parcial

Objetivo: validar codigo e previa de impressao.

Checklist:

- [X] Rodar `npx.cmd tsc -p apps/web/tsconfig.json --noEmit`.
- [X] Rodar `npm run build -w apps/web`.
- [ ] Validar previa com uma escala de Obreiros com multiplas funcoes.
- [ ] Validar previa com multiplas escalas filtradas.
- [ ] Validar estado vazio.
- [ ] Validar tela normal em desktop.
- [ ] Validar que filtros/cards/botoes nao aparecem no print.
- [ ] Confirmar tamanho A4 e orientacao paisagem na previa.

Saida esperada:

- validacoes registradas com comandos e resultados.

Resultado:

- `npx.cmd tsc -p apps/web/tsconfig.json --noEmit` - passou.
- `npm.cmd run build -w apps/web` - passou.
- Refinamento posterior: a grade de impressao passou a exibir apenas o primeiro nome dos membros para reduzir altura das linhas em A4.
- Refinamento posterior: adicionado rodape proprio com data e hora da impressao, atualizado no clique do botao `Imprimir`.
- Build gerou warnings nao bloqueantes:
  - Next.js inferiu workspace root por haver mais de um lockfile.
  - Convencao `middleware` esta depreciada em favor de `proxy`.
- Validacao visual de previa/PDF nao foi executada nesta etapa por depender de navegador com dados reais.

Pendencias de validacao manual:

- Conferir `/escalas/visualizacao` em tela normal.
- Conferir preview de impressao com uma escala de Obreiros.
- Conferir preview com multiplas escalas filtradas.
- Confirmar A4 paisagem no dialog/preview do navegador.
- Confirmar que filtros, cards, botoes e layout administrativo nao aparecem no print.

### Etapa 7 - Atualizacao Final do Plano

Status: concluido

Objetivo: manter o plano como documento vivo apos a execucao.

Checklist:

- [X] Atualizar `Status geral`.
- [X] Atualizar status das etapas.
- [X] Registrar arquivos alterados.
- [X] Registrar decisoes tomadas durante implementacao.
- [X] Registrar validacoes executadas.
- [X] Registrar pendencias ou riscos residuais.

Saida esperada:

- plano refletindo o estado real da entrega.

Resultado:

- Plano atualizado para refletir implementacao concluida com validacao visual pendente.
- Arquivos de implementacao:
  - `apps/web/src/app/(dashboard)/escalas/visualizacao/page.tsx`
  - `apps/web/src/components/app/escala-print-grid.tsx`
  - `apps/web/src/app/globals.css`
- Arquivo de planejamento:
  - `ai-context/plans/escalas-print-layout-plan.md`
- Decisao mantida: primeira versao sem alteracao de backend.
- Decisao mantida: A4 paisagem como padrao inicial.
- Decisao adicionada: na impressao, membros sao exibidos apenas pelo primeiro nome para preservar densidade e legibilidade.
- Decisao adicionada: a impressao usa rodape proprio do OneElo; rodapes nativos do navegador, como URL/localhost, dependem de desativar "Cabeçalhos e rodapés" no dialog de impressao.
- Melhoria futura registrada: criar campo opcional `nomeExibicao` ou `nomeEscala` no cadastro de membro para substituir a regra provisoria de primeiro nome. Backlog: `IMP-006`.
- Risco residual: navegadores podem exigir confirmacao manual de A4/paisagem.
- Risco residual: tabelas com muitas funcoes ou nomes longos precisam ser conferidas visualmente.

## Regras de UX e ODS

- `PageHeader` permanece na tela normal.
- `FilterShell`, `StatCard` e `EmptyState` continuam compondo a experiencia read-only.
- A impressao e uma excecao de apresentacao e deve usar tabela compacta.
- Grades de escala seguem a excecao prevista no ODS para matrizes dias x funcoes.
- Nao usar cards/chips na impressao.
- Nao imprimir botoes, filtros, sidebar ou metricas.
- Manter dados de confirmacao/status fora da tabela principal, salvo se houver decisao explicita de produto.

## Riscos e Cuidados

- Escalas com muitas funcoes podem ficar largas demais em retrato.
- Nomes longos podem quebrar linhas e aumentar altura da folha.
- Multiplas escalas no filtro podem gerar muitas paginas.
- A impressao do navegador varia entre Chrome, Edge e PDF virtual.
- O nome da igreja depende de `auth/me`; se falhar, deve haver fallback sem quebrar a impressao.
- Mesmo com `@page size: A4 landscape`, alguns navegadores podem exigir que o usuario confirme A4/paisagem na caixa de impressao.

## Validacoes Previstas

Comandos:

```txt
npx.cmd tsc -p apps/web/tsconfig.json --noEmit
npm run build -w apps/web
```

Validacao manual:

- abrir `/escalas/visualizacao`;
- filtrar uma escala publicada ou rascunho;
- acionar imprimir;
- conferir previa de impressao/PDF;
- confirmar tamanho A4 e orientacao paisagem na previa;
- confirmar que filtros, cards e botoes nao aparecem;
- confirmar que nome da igreja, mes e ano aparecem no topo;
- confirmar que funcoes viram colunas e membros aparecem como texto.

## Criterios de Aceite

- A impressao nao parece um print da tela administrativa.
- A impressao e otimizada para A4.
- A folha impressa tem cabecalho com igreja, mes e ano.
- A tabela e legivel em PDF.
- Cada linha representa um dia da escala.
- Cada funcao do ministerio vira uma coluna.
- Membros aparecem no formato compacto `Nome 1, Nome 2`.
- A tela normal de visualizacao continua funcional.
- Nenhuma regra de permissao ou backend e alterada sem necessidade.
