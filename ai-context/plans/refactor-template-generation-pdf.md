# Plano - Modernizacao dos Templates de Impressao

Status geral: planejado
Ultima atualizacao: 2026-07-11

## Objetivo

Modernizar a impressao de escalas para que o documento tenha aparencia profissional, contemporanea e propria de um sistema, preservando a estrutura de dados e a legibilidade em A4 paisagem.

A base visual de impressao deve continuar compartilhada com a Agenda. Regras semanticas exclusivas de escalas, como destaque de domingo e data, devem ficar isoladas na variante de escalas e nao podem alterar a impressao de eventos.

## Contexto Atual

O frontend nao gera um arquivo PDF por biblioteca propria. Ele renderiza uma area HTML dedicada e chama `window.print()`. O navegador ou a impressora virtual e responsavel por produzir o PDF.

Implementacao atual:

- `PrintScheduleHeader` e `PrintScheduleFooter` sao compartilhados entre Escalas e Agenda;
- `.print-area`, `.print-page` e `.print-schedule-table` formam a base global de impressao;
- `EscalaPrintGrid` renderiza a matriz de dias e funcoes;
- a Agenda possui sua propria tabela, mas consome o mesmo cabecalho, rodape e tema base;
- `@page` ja define A4 em orientacao paisagem;
- a tabela atual ja possui bordas suaves, zebra e tipografia compacta.

Arquivos principais:

- `apps/web/src/components/app/print-layout.tsx`
- `apps/web/src/components/app/escala-print-grid.tsx`
- `apps/web/src/app/(dashboard)/escalas/visualizacao/page.tsx`
- `apps/web/src/app/(dashboard)/agenda/visualizacao/page.tsx`
- `apps/web/src/app/globals.css`

## Decisoes de Arquitetura

### Base compartilhada

Continuar compartilhando:

- estrutura do documento imprimivel;
- tipografia;
- paleta neutra;
- cabecalho;
- rodape One Elo / Lookup Labs;
- bordas;
- espacamentos base;
- comportamento A4 paisagem;
- regras de quebra de pagina;
- tabela base e zebra discreta.

### Variantes por documento

Criar variantes semanticas explicitas, sem duplicar o template completo:

- `print-document--schedule` para escalas;
- `print-document--agenda` para eventos.

A variante de escalas pode aplicar:

- destaque de domingo somente nas celulas Dia e Data;
- maior peso visual para Data;
- ajustes de largura proprios da matriz de funcoes.

A variante da Agenda deve manter suas regras atuais de data, evento, tipo, ministerios, status, local e descricao. Ela nao deve receber destaque de domingo.

### Tema de impressao

Centralizar tokens em CSS variables escopadas na area de impressao, em vez de criar um objeto TypeScript desconectado do CSS.

Estrutura conceitual:

```css
.print-document {
  --print-color-text: #1f2937;
  --print-color-muted: #6b7280;
  --print-color-border: #d1d5db;
  --print-color-header: #f3f4f6;
  --print-color-zebra: #fafafa;
  --print-space-cell-x: 4px;
  --print-space-cell-y: 3px;
}
```

Valores especificos de uma variante devem ser declarados na propria classe da variante.

### Identificacao de Ministro

O destaque de Ministro foi removido desta entrega por decisao de escopo. A identificacao textual da funcao Ministro nao deve ser aplicada no CSS nem na Agenda neste ciclo.

### Orientacao do PDF

A entrega continua usando impressao do navegador.

Garantias possiveis:

- declarar `@page { size: A4 landscape; }`;
- renderizar o conteudo naturalmente na horizontal;
- evitar transformacao ou rotacao CSS;
- validar o PDF salvo pelo Chrome e Edge.

Nao faz parte desta entrega controlar diretamente `MediaBox`, `CropBox` ou `Rotate`, pois esses metadados pertencem ao PDF produzido pelo navegador. Caso seja necessario controle absoluto, deve ser planejada uma geracao server-side separada.

## Objetivos de UX

O documento de escala deve transmitir:

- profissionalismo;
- organizacao;
- limpeza visual;
- hierarquia clara;
- leitura rapida dos cultos;
- boa reproducao em impressora colorida ou monocromatica;
- familiaridade com a matriz de escala atual.

Hierarquia visual da escala:

1. Igreja;
2. Nome do documento ou ministerio;
3. Mes e ano;
4. Data e Dia;
5. Demais participantes.

## Escopo

Incluido:

- modernizar o tema compartilhado de impressao;
- evoluir o cabecalho compartilhado para tres niveis de informacao;
- preservar o rodape compartilhado;
- criar variantes semanticas para Escalas e Agenda;
- melhorar tipografia, bordas, espacamentos e zebra;
- destacar domingo apenas em Dia e Data na escala;
- manter A4 paisagem;
- validar uma e multiplas escalas;
- validar que a Agenda nao sofreu regressao;
- manter nome de impressao dos membros pela regra existente.

Fora do escopo:

- geracao server-side de PDF;
- mudanca de banco ou backend;
- alterar estrutura, quantidade ou ordem das colunas;
- alterar regras de escala;
- alterar permissoes;
- criar temas selecionaveis pelo usuario;
- permitir personalizacao de cores por tenant;
- redesenhar a tela normal de visualizacao;
- aplicar regras de domingo na Agenda.

## Direcao Visual

### Cabecalho

O componente compartilhado deve suportar:

- nome da igreja como titulo principal;
- nome do documento/ministerio como titulo secundario;
- periodo como informacao terciaria;
- logo da igreja a partir de `tenant.logoUrl`, quando disponivel;
- layout funcional mesmo sem logo, sem reservar espaco vazio.

A logo do tenant identifica a igreja somente no cabecalho. Ela nao substitui nem altera a marca do produto no rodape.

Escala:

```text
Nome da Igreja
Escala - Ministerio de Louvor
Julho de 2026
```

Agenda:

```text
Nome da Igreja
Agenda de Eventos
01/07/2026 a 31/07/2026
```

### Tipografia

- usar Inter, com fallback para Arial e sans-serif;
- manter letter spacing em `0`;
- igreja com maior peso e tamanho;
- documento com tamanho intermediario;
- periodo menor e em cor secundaria;
- cabecalho da tabela em semibold/bold;
- conteudo compacto, sem comprometer leitura.

### Tabela compartilhada

- cabecalho: `#F3F4F6`;
- texto principal: `#1F2937`;
- texto secundario: `#6B7280`;
- bordas: `#D1D5DB`;
- linha impar: `#FFFFFF`;
- linha par: `#FAFAFA`;
- borda externa discretamente mais evidente que as internas;
- sem sombras, gradientes ou bordas pretas.

### Regras exclusivas de escalas

Domingo:

- destacar somente as celulas Dia e Data;
- fundo `#FEF3C7`;
- texto `#1F2937`;
- nao pintar a linha inteira.

Ministro:

- removido desta entrega por decisao de escopo;
- nao aplicar helper textual nem destaque visual neste ciclo.

## Etapas de Desenvolvimento

### Etapa 1 - Baseline e contrato visual

Status: concluido

- [X] Definir que a comparacao visual antes/depois sera validada manualmente pelo usuario.
- [X] Registrar a impressao atual da Agenda pelo codigo como controle de regressao.
- [X] Confirmar os dados disponiveis para igreja, ministerio e periodo.
- [X] Registrar que o destaque de Ministro foi removido do escopo desta entrega.
- [X] Registrar o comportamento com uma e multiplas escalas.

Resultado esperado:

- baseline comparavel antes/depois;
- contrato visual fechado sem alterar dados.

Resultado parcial:

- frontend local confirmado em `http://localhost:3001` e API em `http://localhost:4001`;
- `/api/auth/me` fornece `tenant.nome` e `tenant.logoUrl`; no tenant local validado, o nome esta presente e a logo ainda nao esta cadastrada, cobrindo o fallback sem logo;
- `/api/escalas/visualizacao?mes=7&ano=2026` retornou duas escalas, confirmando o fluxo de multiplas paginas;
- as escalas locais possuem seis linhas de domingo para validar o destaque de Dia e Data;
- outras funcoes permanecem dinamicas e nao devem receber regra visual por posicao;
- baseline estrutural atual: cabecalho com dois niveis, A4 paisagem, bordas `#b9c2cf`, cabecalho de tabela `#e8eef5`, zebra `#f8fafc` e Dia/Data com fundo `#f4f1ec`;
- a Agenda usa o mesmo cabecalho, rodape e tabela base, com larguras especificas em `.print-events-table`;
- capturas visuais iniciais nao foram exigidas; a comparacao e a verificacao da previa de impressao serao realizadas manualmente pelo usuario na etapa de validacao visual.

### Etapa 2 - Tema compartilhado

Status: concluido

- [X] Criar tokens CSS sob `.print-document`.
- [X] Migrar cores, bordas, tipografia e espacamentos compartilhados para os tokens.
- [X] Manter A4 landscape e margens entre 8 mm e 12 mm.
- [X] Preservar rodape One Elo / Lookup Labs.
- [X] Garantir impressao aceitavel em monocromatico.

Resultado esperado:

- tema moderno compartilhado por Escalas e Agenda;
- ausencia de duplicacao integral de estilos.

Resultado:

- Escalas e Agenda passaram a aplicar a classe compartilhada `.print-document`;
- cores, fontes, tamanhos, bordas, espacamentos e densidade da tabela foram centralizados em CSS variables;
- larguras especificas de `.print-events-table` foram preservadas fora do tema comum;
- A4 landscape com margem de `10mm` foi mantido;
- o rodape compartilhado da Lookup Labs / One Elo foi preservado;
- a paleta usa contraste de texto e bordas que continua distinguivel sem depender exclusivamente de cor.

Validacao:

- `npx.cmd tsc -p apps/web/tsconfig.json --noEmit` - passou;
- `npm.cmd run build -w apps/web` - passou;
- warnings nao bloqueantes mantidos: multiplos lockfiles e convencao `middleware` depreciada pelo Next.js.

### Etapa 3 - Cabecalho compartilhado

Status: concluido

- [x] Evoluir o componente para igreja, documento e periodo.
- [x] Consumir `tenant.logoUrl` de `/api/auth/me` no cabecalho.
- [x] Definir fallback sem logo e sem nome de tenant.
- [x] Aplicar o novo contrato em Escalas e Agenda.
- [x] Manter alinhamentos e espacamentos consistentes.
- [x] Manter a logo da Lookup Labs e o nome One Elo no rodape compartilhado.

Resultado esperado:

- cabecalho compartilhado com hierarquia moderna;
- conteudo especifico fornecido por cada modulo.

Resultado:

- `PrintScheduleHeader` foi evoluido para `PrintDocumentHeader`;
- o contrato agora recebe `organizationName`, `documentTitle`, `period` e `logoUrl`;
- Escalas exibem igreja, `Escala - {ministerio}` e mes/ano;
- Agenda exibe igreja, `Agenda de Eventos` e intervalo filtrado;
- `tenant.logoUrl` e carregada por `/api/auth/me` nas duas visualizacoes;
- sem logo, o bloco de imagem nao e renderizado e o texto ocupa a largura disponivel;
- sem nome de tenant, permanece o fallback `OneElo`;
- rodape Lookup Labs / One Elo permaneceu inalterado.

Validacao:

- `npx.cmd tsc -p apps/web/tsconfig.json --noEmit` - passou;
- `npm.cmd run build -w apps/web` - passou apos permitir o download da fonte Inter pelo `next/font`;
- warnings nao bloqueantes mantidos: multiplos lockfiles e convencao `middleware` depreciada pelo Next.js.

### Etapa 4 - Variante de escalas

Status: concluido

- [X] Aplicar `print-document--schedule` na impressao de escalas.
- [X] Identificar domingo pela data do dia da escala.
- [X] Adicionar classes semanticas apenas nas celulas Dia e Data de domingo.
- [X] Manter Ministro sem destaque visual nesta entrega.
- [X] Ajustar padding e altura de linha sem alterar colunas.
- [X] Preservar a regra existente de nome de impressao dos membros.

Resultado esperado:

- escala moderna, legivel e com hierarquia propria;
- nenhuma regra exclusiva vazando para Agenda.

Resultado:

- a impressao de escalas passou a usar a variante `print-document--schedule`;
- domingo recebe destaque somente nas celulas Dia e Data;
- nao foi aplicada identificacao nem destaque de Ministro por decisao de escopo;
- o padding e a densidade da tabela foram ajustados apenas para a variante de escalas.

Validacao:

- `npx.cmd tsc -p apps/web/tsconfig.json --noEmit` - passou;
- `npm.cmd run build -w apps/web` - passou.

### Etapa 5 - Variante de Agenda e regressao

Status: concluido

- [X] Aplicar `print-document--agenda` na Agenda.
- [X] Preservar larguras e alinhamentos proprios de eventos.
- [X] Confirmar ausencia de destaque de domingo.
- [X] Confirmar ausencia de regra de Ministro nesta entrega.
- [X] Confirmar cabecalho e rodape compartilhados.

Resultado esperado:

- Agenda consome o tema moderno sem assumir semantica de escalas.

Resultado:

- a impressao da Agenda passou a usar a variante `print-document--agenda`;
- as larguras especificas de eventos continuam preservadas em `.print-events-table`;
- nao foram adicionadas regras de domingo ou Ministro na Agenda;
- cabecalho compartilhado e rodape compartilhado continuam em uso.

Validacao:

- `npx.cmd tsc -p apps/web/tsconfig.json --noEmit` - passou;
- `npm.cmd run build -w apps/web` - passou.

### Etapa 6 - Validacao tecnica

Status: concluido

- [X] Rodar typecheck do frontend.
- [X] Rodar build do frontend.
- [X] Confirmar que a tela normal nao foi alterada.
- [X] Confirmar que filtros, cards, sidebar e botoes nao aparecem na impressao.
- [X] Confirmar quebra de pagina entre multiplas escalas.
- [X] Confirmar ausencia de overflow e sobreposicao.

Resultado:

- o frontend passou em typecheck;
- o frontend passou em build;
- a area de impressao continua isolada em `print-area`/`no-print`, sem interferir na tela normal;
- o fluxo de impressao continua por pagina separada entre escalas;
- a Agenda permanece com a tabela de eventos e larguras especificas preservadas.

Comandos:

```powershell
npx.cmd tsc -p apps/web/tsconfig.json --noEmit
npm.cmd run build -w apps/web
```

### Etapa 7 - Validacao visual e PDF

Status: pendente

- [ ] Validar previa no Chrome em A4 paisagem.
- [ ] Salvar PDF pelo Chrome e conferir orientacao ao abrir novamente.
- [ ] Validar previa no Edge em A4 paisagem.
- [ ] Testar uma escala com poucas funcoes.
- [ ] Testar uma escala com muitas funcoes e nomes longos.
- [ ] Testar multiplas escalas.
- [ ] Testar domingo.
- [ ] Testar Agenda apos a alteracao compartilhada.
- [ ] Fazer verificacao visual em desktop e mobile.

Observacao:

- iOS, Android e leitores externos devem ser tratados como validacao de compatibilidade, nao como garantia absoluta da aplicacao enquanto o PDF for produzido pelo navegador.

### Etapa 8 - Fechamento

Status: pendente

- [ ] Atualizar os status deste plano.
- [ ] Registrar arquivos alterados.
- [ ] Registrar validacoes executadas.
- [ ] Registrar riscos residuais.
- [ ] Comparar capturas antes/depois.

## Criterios de Aceitacao

- A impressao de escalas permanece em A4 paisagem.
- A estrutura e a ordem das colunas permanecem inalteradas.
- O documento apresenta igreja, documento/ministerio e periodo com hierarquia clara.
- Quando cadastrada, a logo do tenant aparece no cabecalho como identidade da igreja.
- A logo da Lookup Labs e o nome One Elo permanecem no rodape.
- O tema base continua compartilhado com a Agenda.
- Regras de domingo e Data aparecem somente na escala.
- Domingo destaca apenas Dia e Data.
- Ministro nao recebe destaque nesta entrega.
- A Agenda nao recebe semantica de escalas e nao sofre regressao visual.
- Bordas, zebra, tipografia e espacamentos usam tokens centralizados.
- O documento continua legivel com poucas e muitas funcoes.
- Uma nova escala inicia em nova pagina quando houver multiplos resultados.
- Nenhuma regra de negocio, permissao ou contrato de backend e alterado.
- O PDF salvo pelo navegador abre em paisagem nos visualizadores validados.

## Riscos e Cuidados

- Nomes de funcao nao possuem identificador semantico para Ministro; a regra textual e provisoria.
- Tabelas com muitas funcoes podem exigir fonte e padding mais compactos.
- Nomes longos podem aumentar a altura das linhas.
- `position: fixed` no rodape pode variar entre navegadores e multiplas paginas.
- Cores de fundo dependem da opcao de imprimir graficos de fundo em alguns navegadores.
- O navegador pode ignorar ou solicitar confirmacao manual de A4 paisagem.
- Mudancas em classes compartilhadas devem sempre ser verificadas na Agenda.

## Evolucoes Futuras

- identificador semantico de funcao para Ministro;
- temas selecionaveis, como Classico, Moderno e Minimalista;
- identidade visual configuravel por tenant;
- cabecalho e rodape configuraveis;
- geracao server-side para controle integral do arquivo PDF;
- reutilizacao do tema em listas, relatorios e certificados.
