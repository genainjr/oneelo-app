# Plano - Exportacao de PDF e Imagens

Status geral: **em andamento - layouts de PDF/PNG e escolha unica de formato implementados; validacao visual pendente**

Criacao: 2026-10-09

Branch sugerida para implementacao: `feature/pdf-export`

Backlog relacionado: [exportacao-pdf.md](../backlog/exportacao-pdf.md)

Planos relacionados: [estabilidade de memoria](escala-export-memory-stability-plan.md) e [performance da exportacao de Escalas](escala-export-performance-plan.md)

## Objetivo da entrega

Entregar exportacao de PDF e PNG pelo backend para Escalas e Agenda, removendo a dependencia do navegador do usuario, do driver de impressao e da configuracao manual de papel.

A primeira resposta do endpoint entrega os arquivos diretamente. PDF e PNG nao sao salvos em banco ou storage; eles retratam os dados existentes no instante da solicitacao.

## Decisoes fechadas

- a entrega permanece no backend atual, sem worker ou microservico;
- Playwright com Chromium e a engine de renderizacao desta entrega;
- PDF e PNG sao os unicos formatos desta entrega;
- Escalas e o primeiro caso de uso; Agenda usa a mesma base depois da validacao;
- o PDF de Escalas apresenta duas visoes: escala geral e matriz geral por membro, em paginas A4 paisagem;
- a matriz por membro contem todas as pessoas nas linhas e as datas/eventos nas colunas; cada celula mostra a funcao ou funcoes daquela pessoa;
- a matriz usa titulo generico, como `Escala por membro`, sem texto especifico de um ministerio;
- o PNG de Escalas usa uma composicao vertical propria para celular, com cartoes dos eventos agrupados por semana civil (segunda a domingo); o intervalo exibido no cabecalho fica limitado ao mes da escala;
- e gerado um PNG por semana que contenha dias da escala dentro do periodo filtrado; nenhum evento e omitido por ser passado ou por aparecer apenas nos exemplos visuais;
- as imagens de referencia em `Proposta_Impressao/` definem direcao visual, nao datas, selecao de eventos nem conteudo fixo;
- a visualizacao oferece um unico botao `Compartilhar`; ao aciona-lo, o usuario escolhe PDF ou Imagem, sem textos explicativos adicionais;
- `Imprimir` continua sendo uma acao separada para o fluxo existente de impressao do navegador;
- apos a geracao do arquivo, o usuario aciona explicitamente `Compartilhar` para abrir o compartilhamento nativo, preservando a ativacao do toque exigida por navegadores mobile; cada PNG tambem pode ser compartilhado individualmente ou baixado;
- a exportacao e sincrona e nao cria jobs;
- nao ha storage, historico, retencao, listagem de arquivos ou re-download;
- autorizacao e isolamento multitenant sao aplicados no backend, segundo as regras do modulo de origem;
- o fluxo de `window.print()` permanece como fallback enquanto o PDF nao for validado em producao;
- a implementacao cria apenas contratos internos leves que poderao ser reutilizados pela futura Central de Documentos.

## Referencia de equivalencia com producao

A area de impressao atual de Escalas e Agenda e a referencia de regressao. A exportacao deve preservar conteudo autorizado, identidade do tenant, cabecalho, rodape, ordenacao, tabela, destaque semantico e regras de quebra de pagina hoje exibidos em producao.

Esse criterio compara somente a area de impressao do OneElo. URL, data, cabecalhos e rodapes que o dialogo nativo do navegador eventualmente adiciona nao fazem parte do documento e nao devem ser reproduzidos.

## Referencia visual aprovada para Escalas

Os arquivos em `Proposta_Impressao/` sao referencias visuais aprovadas para esta entrega. Os conteudos devem ser gerados a partir dos dados e filtros autorizados no sistema; datas, nomes, ministerio e quantidade de eventos mostrados nos exemplos nao sao regras nem fixtures obrigatorias.

### PDF

1. **Escala geral:** uma tabela mensal por escala, agrupada por dia/evento, com responsavel (quando existir na escala) e funcoes como colunas.
2. **Escala por membro:** matriz geral com uma linha por membro escalado, uma coluna por data/evento e a(s) funcao(oes) da pessoa na celula correspondente.

As duas visoes compoem o PDF nessa ordem, em A4 paisagem. Para filtros que retornem mais de uma escala, o documento repete o par de visoes para cada escala. A paginacao adicional so e permitida quando necessaria para manter legibilidade e nao pode omitir dados.

### PNG

Gerar uma imagem vertical por semana civil com eventos, usando cabecalho com nome da escala/ministerio e periodo semanal, seguido por cartoes que identificam data, dia, responsavel (quando houver) e funcoes/membros escalados. O nome da composicao deve funcionar para qualquer ministerio, nao apenas Louvor.

## Estado atual do codigo

- Escalas, Agenda e Financeiro usam areas de impressao no frontend e chamam `window.print()`.
- Os estilos compartilhados de impressao ficam em `apps/web/src/app/globals.css`, e os componentes de layout em `apps/web/src/components/app/print-layout.tsx`.
- O fallback `Imprimir` de Escalas ja usa uma lista compacta quando ha somente uma funcao; essa melhoria pertence ao frontend e nao substitui os novos templates PDF/PNG do backend.
- O backend NestJS nao possui engine de PDF/imagem nem modelo de documento/job.
- O projeto possui Supabase Storage para midia, com servico atual voltado a objetos publicos; ele nao sera usado nesta entrega.
- O backend ja executa tarefas agendadas, mas nao possui uma fila persistente; ela tambem nao sera criada nesta entrega.

## Arquitetura alvo da feature

```text
Botao Compartilhar
  -> usuario escolhe PDF (escala A4 para imprimir/compartilhar) ou PNG (imagens semanais para compartilhar)
  -> endpoint autenticado da origem
  -> service aplica tenant e autorizacao contextual
  -> assembler consulta e normaliza os dados
  -> Playwright com Chromium renderiza HTML/CSS
  -> renderer gera Buffer de PDF ou PNG
  -> controller responde como attachment
```

O contrato interno deve ser orientado a resultado, por exemplo:

```ts
interface RenderedDocument {
  buffer: Buffer;
  mimeType: 'application/pdf' | 'image/png';
  fileName: string;
}
```

O nome final de interfaces, modulos e pastas deve seguir o codigo existente. Nao criar `DocumentsModule`, `DocumentJob` ou uma abstracao para DOCX/XLSX antes de haver necessidade concreta.

## Etapa 0 - Validacao tecnica do renderer

Objetivo: validar Playwright com Chromium no ambiente de producao antes de iniciar os endpoints da feature.

- [x] Adicionar Playwright e o Chromium necessarios ao backend.
- [x] Criar um spike isolado com logo, fontes, cabecalho, tabela longa, PDF e PNG.
- [x] Validar geracao local e no ambiente equivalente ao deploy.
- [x] Medir tempo e memoria para uma Escala curta e uma extensa.
- [x] Registrar configuracao de Chromium, dependencias operacionais e limites no plano.

Critérios de aceite:

- Playwright com Chromium gera PDF A4 e PNG legiveis sem depender do navegador do usuario;
- as dependencias exigidas pelo runtime de producao estao conhecidas e reproduziveis;
- o teste evidencia comportamento aceitavel para os dois volumes escolhidos.

### Resultado da Etapa 0 - 2026-10-09

- A API usa `playwright` 1.64.0, com Chromium instalado por `npx playwright install --with-deps chromium`.
- O `Dockerfile` da API mudou de Alpine para `node:20-bookworm-slim`, pois o Playwright nao suporta distribuicoes Linux baseadas em musl. O runtime instala as dependencias do Chromium durante o build da imagem.
- O spike isolado esta em `apps/api/scripts/playwright-renderer-spike.mjs` e pode ser executado com `npm.cmd run spike:export-renderer` dentro de `apps/api`.
- A execucao local gerou um PDF A4 e dois PNGs de paginas distintas, com 863 ms de duracao e 117,2 MiB de RSS final. A previa PNG apresentou cabecalho, logo, tabela e rodape legiveis.
- A imagem Docker equivalente ao deploy foi construida e executou uma geracao de PDF e PNG com sucesso: 14.866 bytes de PDF, 35.816 bytes de PNG e 407 ms de duracao.
- A medicao usa dados estaticos de uma Escala curta e uma tabela de duas paginas; os limites com dados reais, logos remotos e Escalas mais extensas continuam obrigatorios na Etapa 3.

## Etapa 1 - Contrato e dados de Escalas

Objetivo: separar autorizacao, consulta e representacao para PDF e PNG sem duplicar a regra de negocio no controller.

- [x] Mapear a consulta que abastece a visualizacao de Escalas e seus filtros.
- [x] Definir o DTO interno normalizado para o template da Escala.
- [x] Reutilizar a validacao de tenant e de permissao ministerial do service de Escalas.
- [x] Implementar o renderer Playwright para PDF e PNG, com nomes de arquivo previsiveis.
- [x] Criar endpoint autenticado que retorna PDF ou PNG como attachment.
- [x] Garantir que nenhum Buffer ou metadado do arquivo seja persistido.

Critérios de aceite:

- ADMIN, STAFF e lider/co-lider somente exportam Escalas dentro do escopo que ja podem consultar;
- tenant e ministerio informados pelo cliente nao ampliam permissao;
- o endpoint retorna PDF ou PNG e erro sem stack trace em caso de falha;
- filtros solicitados sao refletidos no documento quando autorizados.

### Resultado da Etapa 1 - 2026-10-09

- O endpoint autenticado `GET /api/escalas/exportacao` reutiliza a mesma consulta e filtros de `visualizacao`; aceita `formato=pdf|png` e, para PNG, seleciona uma imagem individual pelo indice.
- PDF retorna as Escalas filtradas em um attachment. Para PNG, `pagina=1..N` seleciona uma imagem semanal, e `X-Document-Page-Count` representa a quantidade de semanas com eventos no conjunto filtrado.
- O contrato interno normalizado e o renderer Playwright ficam no modulo de Escalas; nao foi criado modulo de documentos, job, tabela ou bucket.
- Foi corrigido o escopo da visualizacao para exigir que usuarios BASIC sejam lideres ou co-lideres do ministerio. A exportacao herda esse mesmo escopo e nunca aceita ministerio fora dele.
- O renderer validado diretamente gerou PDF (47.288 bytes) e PNG (16.164 bytes) com uma Escala de exemplo. A validacao de quebrar uma Escala longa em varias paginas fisicas segue para a Etapa 3.

## Etapa 2 - Interface de Escalas e fallback

Objetivo: disponibilizar a acao de exportacao sem quebrar a impressao atual.

- [x] Adicionar acoes iniciais de exportacao PDF e imagem na visualizacao de Escalas.
- [x] Substituir as acoes por um unico botao `Compartilhar` que abre a escolha do formato.
- [x] Manter apenas as opcoes `PDF` e `Imagem`, sem textos explicativos no seletor.
- [x] Usar o cliente de API autenticado existente para requisitar o arquivo.
- [x] Tratar loading, erro e download no navegador.
- [x] Manter `Imprimir` como fallback durante a validacao inicial.
- [ ] Verificar acessibilidade e comportamento em viewport mobile, incluindo abertura do compartilhamento nativo no iPhone.

Critérios de aceite:

- existe um unico botao `Compartilhar`, seguido da escolha entre PDF e Imagem;
- apos a geracao, um toque explicito abre o compartilhamento nativo quando suportado; ha fallback para download;
- `Imprimir` continua claramente separado da exportacao;
- falha de exportacao nao deixa a pagina em estado bloqueado;
- o download mantem um nome de arquivo legivel e previsivel.

### Resultado parcial da Etapa 2 - 2026-10-09

- A primeira versao da visualizacao possuia acoes separadas para `Exportar PDF`, `Exportar imagem` e `Imprimir`. A acao principal agora se chama `Compartilhar` e abre um seletor simples com `PDF` e `Imagem`; `Imprimir` permanece separado.
- O cliente autenticado recebe `Blob`, nome de arquivo e contador de paginas. PDF baixa como attachment; imagens sao solicitadas individualmente.
- PDF e imagens sao preparados primeiro; um segundo toque explicito chama a Web Share API para preservar a ativacao do usuario. Em navegadores sem suporte, permanece o download individual, e PNGs podem ser compartilhados um por vez quando o navegador nao aceita multiplos arquivos.
- Loading, falha e indisponibilidade de dados sao tratados sem bloquear a visualizacao ou a impressao existente.
- Em mobile, `Compartilhar` e exibido acima de `Imprimir`, com acoes em largura total para evitar quebra do cabecalho.
- O teste de uso em iPhone mostrou que a chamada da Web Share API nao deve ocorrer automaticamente apos requisicoes de rede: a ativacao transitoria do toque pode expirar. Agora os arquivos sao preparados primeiro e o usuario toca em `Compartilhar` para abrir a folha nativa; ha acao individual para cada PNG quando o navegador nao aceita compartilhar varios arquivos juntos.

## Etapa 3 - Layout aprovado e validacao de PDF e imagens de Escalas

Objetivo: validar estabilidade visual e de autorizacao antes de ampliar o contrato.

- [x] Validar Escala com uma funcao e varias funcoes.
- [x] Validar poucas e muitas datas/membros na primeira versao do renderer.
- [x] Implementar as duas visoes do PDF: geral e matriz geral por membro.
- [x] Implementar PNG vertical por semana civil com cartoes por evento.
- [x] Usar titulos e rotulos genericos que atendam todos os ministerios.
- [x] Garantir que os exemplos visuais nao limitem datas, eventos ou pessoas incluidos.
- [x] Evitar que limites conservadores criem paginas extras quase vazias; usar limites maiores e distintos para a tabela geral e para a matriz.
- [x] Exibir o nome da igreja junto ao titulo da escala, em vez de isolado no canto superior direito.
- [x] Alinhar cabecalho do PDF ao modelo de impressao: logo a esquerda, titulo da escala centralizado e igreja/periodo a direita.
- [x] Permitir quebra da tabela geral entre linhas, evitando mover um grupo inteiro de dia para uma nova pagina.
- [x] Distribuir largura das colunas de funcoes conforme o maior conteudo por funcao, preservando uma largura minima visual.
- [x] Evitar repeticao de cor entre funcoes na matriz, mesmo quando ha mais funcoes que cores da paleta original.
- [ ] Validar logo presente e fallback quando ela nao existir.
- [ ] Validar A4, quebra de pagina, cabecalho e rodape.
- [x] Validar PNG unico e PNG por pagina na primeira versao do renderer.
- [ ] Validar PNG para todas as semanas com eventos, incluindo semanas parciais no inicio/fim do periodo.
- [x] Validar acesso negado para usuario sem escopo ministerial.
- [ ] Validar acesso negado para outro tenant.
- [ ] Comparar o resultado com a area de impressao atualmente em producao.
- [x] Registrar limites conhecidos de volume ou layout.

Critérios de aceite:

- nenhum teste visual aprovado depende de configuracao do navegador do usuario;
- documentos de tenants distintos nao misturam identidade ou dados;
- PDF e PNG preservam a equivalencia visual e semantica definida para a impressao de producao;
- limites conhecidos ficam documentados antes de liberar Agenda.

### Resultado parcial da Etapa 3 - 2026-10-09

- A primeira versao do renderer divide Escalas extensas em paginas de no maximo 14 dias e quatro funcoes por bloco. Esse layout sera substituido pelas duas visoes aprovadas para o PDF.
- Na revisao de paginacao, os limites foram ampliados para ate 24 datas na visao geral, 18 datas na matriz, 10 funcoes e 22 membros por pagina. A tabela geral e a matriz usam limites de datas distintos por terem densidades visuais diferentes. O cabecalho segue o modelo de impressao: logo a esquerda, titulo centralizado e igreja/periodo alinhados a direita. Os grupos da tabela geral podem continuar entre paginas, mantendo cada linha inteira. Esses limites precisam de validacao visual com escalas reais; nao substituem a verificacao de que o Chromium nao criou uma pagina fisica adicional.
- As colunas da visao geral agora recebem largura proporcional ao maior texto entre o nome da funcao e suas atribuicoes, com peso minimo para manter funcoes vazias legiveis. A previa com Trompete vazio e Back vocal preenchido com nomes longos mostrou a coluna vazia mais estreita e a coluna com conteudo mais larga. Validacao visual com dados reais continua pendente.
- Na matriz por membro, cada funcao agora recebe uma cor pastel por matiz deterministica e distribuida pelo circulo cromatico; a sequencia nao recicla a paleta fixa de seis cores.
- A execucao anterior com uma Escala de 31 dias e duas funcoes gerou um PDF de 58.182 bytes e tres PNGs individuais; esses numeros registram a versao anterior e nao definem a paginacao final.
- Os testes unitarios agora cobrem o escopo de visualizacao: BASIC sem lideranca nao consulta Escalas e lider/co-lider fica limitado aos ministerios associados. A consulta continua iniciando por `tenantId`.
- Ainda e necessaria a validacao manual, com dados reais, de logo remoto, fallback sem logo, equivalencia visual e acesso entre tenants antes de considerar a Etapa 3 concluida.
- O PNG agrupa eventos por semana de segunda a domingo, mas limita o intervalo do cabecalho as datas pertencentes ao mes da escala. O fundo da imagem semanal e branco para coincidir com o fundo da logo e da impressao; o cabecalho reserva largura para manter o periodo legivel a direita, sem rodape de geracao.

## Etapa 4 - Agenda no mesmo contrato

Objetivo: adicionar Agenda sem acoplar semantica de Escalas ao template de eventos.

- [ ] Mapear filtros e autorizacao existentes na visualizacao de Agenda.
- [ ] Criar assembler/template proprio de Agenda usando Playwright com Chromium.
- [ ] Reutilizar somente infraestrutura generica de resposta e renderizacao.
- [ ] Adicionar acao de exportacao e manter o fallback de impressao enquanto necessario.
- [ ] Repetir validacoes de tenant, A4 e volume de dados.

Critérios de aceite:

- Agenda exporta PDF e PNG sem herdar regras visuais exclusivas de Escalas;
- o contrato compartilhado nao mistura dados de dominio;
- as permissoes da Agenda continuam sendo aplicadas pelo backend.

## Etapa 5 - Preparacao documentada para a Central futura

Objetivo: deixar a evolucao possivel sem construir a Central agora.

- [ ] Confirmar que renderer e template nao dependem diretamente de controller ou componente React.
- [ ] Documentar entradas, saidas PDF/PNG, Playwright/Chromium e limites dos renderers.
- [ ] Registrar que Central futura podera adicionar job, storage privado e download protegido ao redor do mesmo contrato.
- [ ] Confirmar que a entrega nao introduziu tabela, bucket, cron, fila ou worker prematuros.

Critérios de aceite:

- uma futura orquestracao assincrona pode chamar os renderers sem reescrever os templates;
- a feature atual permanece estateless e com operacao simples.

## Validacao final

- [ ] Build da API.
- [ ] Build do web.
- [ ] Testes unitarios de dados normalizados, nome de arquivo e erros de renderer.
- [ ] Testes de autorizacao e isolamento por tenant.
- [ ] Teste manual de download PDF e PNG para Escalas e Agenda.
- [ ] Validacao visual do PDF A4 impresso: escala geral e matriz legiveis e completas.
- [ ] Validacao visual das imagens semanais em celular e compartilhamento nativo.
- [ ] Comparar os layouts com as referencias aprovadas, sem tratar dados de exemplo como requisitos.
- [ ] Validacao em ambiente de producao ou equivalente, contra a area de impressao atual.

## Fora de escopo reafirmado

- Central de Documentos;
- armazenamento ou persistencia de arquivo;
- historico e auditoria do arquivo emitido;
- processamento assincrono, job, retry, worker ou microservico;
- DOCX, CSV, XLSX e outros formatos de arquivo;
- envio ou compartilhamento posterior do PDF.
