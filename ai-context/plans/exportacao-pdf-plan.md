# Plano - Exportacao de PDF e Imagens

Status geral: **planejado**

Criacao: 2026-10-09

Branch sugerida para implementacao: `feature/pdf-export`

Backlog relacionado: [exportacao-pdf.md](../backlog/exportacao-pdf.md)

## Objetivo da entrega

Entregar exportacao de PDF e PNG pelo backend para Escalas e Agenda, removendo a dependencia do navegador do usuario, do driver de impressao e da configuracao manual de papel.

A primeira resposta do endpoint entrega os arquivos diretamente. PDF e PNG nao sao salvos em banco ou storage; eles retratam os dados existentes no instante da solicitacao.

## Decisoes fechadas

- a entrega permanece no backend atual, sem worker ou microservico;
- Playwright com Chromium e a engine de renderizacao desta entrega;
- PDF e PNG sao os unicos formatos desta entrega;
- Escalas e o primeiro caso de uso; Agenda usa a mesma base depois da validacao;
- documentos com mais de uma pagina A4 geram um PNG por pagina, em sequencia;
- a exportacao e sincrona e nao cria jobs;
- nao ha storage, historico, retencao, listagem de arquivos ou re-download;
- autorizacao e isolamento multitenant sao aplicados no backend, segundo as regras do modulo de origem;
- o fluxo de `window.print()` permanece como fallback enquanto o PDF nao for validado em producao;
- a implementacao cria apenas contratos internos leves que poderao ser reutilizados pela futura Central de Documentos.

## Referencia de equivalencia com producao

A area de impressao atual de Escalas e Agenda e a referencia de regressao. A exportacao deve preservar conteudo autorizado, identidade do tenant, cabecalho, rodape, ordenacao, tabela, destaque semantico e regras de quebra de pagina hoje exibidos em producao.

Esse criterio compara somente a area de impressao do OneElo. URL, data, cabecalhos e rodapes que o dialogo nativo do navegador eventualmente adiciona nao fazem parte do documento e nao devem ser reproduzidos.

## Estado atual do codigo

- Escalas, Agenda e Financeiro usam areas de impressao no frontend e chamam `window.print()`.
- Os estilos compartilhados de impressao ficam em `apps/web/src/app/globals.css`, e os componentes de layout em `apps/web/src/components/app/print-layout.tsx`.
- O backend NestJS nao possui engine de PDF/imagem nem modelo de documento/job.
- O projeto possui Supabase Storage para midia, com servico atual voltado a objetos publicos; ele nao sera usado nesta entrega.
- O backend ja executa tarefas agendadas, mas nao possui uma fila persistente; ela tambem nao sera criada nesta entrega.

## Arquitetura alvo da feature

```text
Botao Exportar PDF ou Imagem
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

- [ ] Adicionar Playwright e o Chromium necessarios ao backend.
- [ ] Criar um spike isolado com logo, fontes, cabecalho, tabela longa, PDF e PNG.
- [ ] Validar geracao local e no ambiente equivalente ao deploy.
- [ ] Medir tempo e memoria para uma Escala curta e uma extensa.
- [ ] Registrar configuracao de Chromium, dependencias operacionais e limites no plano.

Critérios de aceite:

- Playwright com Chromium gera PDF A4 e PNG legiveis sem depender do navegador do usuario;
- as dependencias exigidas pelo runtime de producao estao conhecidas e reproduziveis;
- o teste evidencia comportamento aceitavel para os dois volumes escolhidos.

## Etapa 1 - Contrato e dados de Escalas

Objetivo: separar autorizacao, consulta e representacao para PDF e PNG sem duplicar a regra de negocio no controller.

- [ ] Mapear a consulta que abastece a visualizacao de Escalas e seus filtros.
- [ ] Definir o DTO interno normalizado para o template da Escala.
- [ ] Reutilizar a validacao de tenant e de permissao ministerial do service de Escalas.
- [ ] Implementar o renderer Playwright para PDF e PNG, com nomes de arquivo previsiveis.
- [ ] Criar endpoint autenticado que retorna PDF ou PNG como attachment.
- [ ] Garantir que nenhum Buffer ou metadado do arquivo seja persistido.

Critérios de aceite:

- ADMIN, STAFF e lider/co-lider somente exportam Escalas dentro do escopo que ja podem consultar;
- tenant e ministerio informados pelo cliente nao ampliam permissao;
- o endpoint retorna PDF ou PNG e erro sem stack trace em caso de falha;
- filtros solicitados sao refletidos no documento quando autorizados.

## Etapa 2 - Interface de Escalas e fallback

Objetivo: disponibilizar a acao de exportacao sem quebrar a impressao atual.

- [ ] Adicionar acoes claras de `Exportar PDF` e `Exportar imagem` na visualizacao de Escalas.
- [ ] Usar o cliente de API autenticado existente para requisitar o arquivo.
- [ ] Tratar loading, erro e download no navegador.
- [ ] Manter `Imprimir` como fallback durante a validacao inicial.
- [ ] Verificar acessibilidade e comportamento em viewport mobile, sem depender da impressao mobile.

Critérios de aceite:

- o usuario distingue exportacao PDF, imagem e impressao pelo navegador;
- falha de exportacao nao deixa a pagina em estado bloqueado;
- o download mantem um nome de arquivo legivel e previsivel.

## Etapa 3 - Validacao de PDF e imagens de Escalas

Objetivo: validar estabilidade visual e de autorizacao antes de ampliar o contrato.

- [ ] Validar Escala com uma funcao e varias funcoes.
- [ ] Validar poucas e muitas datas/membros.
- [ ] Validar logo presente e fallback quando ela nao existir.
- [ ] Validar A4, quebra de pagina, cabecalho e rodape.
- [ ] Validar PNG unico e PNG por pagina para documentos extensos.
- [ ] Validar acesso negado para outro tenant e usuario sem escopo ministerial.
- [ ] Comparar o resultado com a area de impressao atualmente em producao.
- [ ] Registrar limites conhecidos de volume ou layout.

Critérios de aceite:

- nenhum teste visual aprovado depende de configuracao do navegador do usuario;
- documentos de tenants distintos nao misturam identidade ou dados;
- PDF e PNG preservam a equivalencia visual e semantica definida para a impressao de producao;
- limites conhecidos ficam documentados antes de liberar Agenda.

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
- [ ] Validacao visual de PDF e PNG em ambiente de producao ou equivalente, contra a area de impressao atual.

## Fora de escopo reafirmado

- Central de Documentos;
- armazenamento ou persistencia de arquivo;
- historico e auditoria do arquivo emitido;
- processamento assincrono, job, retry, worker ou microservico;
- DOCX, CSV, XLSX e outros formatos de arquivo;
- envio ou compartilhamento posterior do PDF.
