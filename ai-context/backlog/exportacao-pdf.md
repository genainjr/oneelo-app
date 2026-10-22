# Backlog - Exportacao de PDF e Imagens

### FT-015 Exportacao de PDF e Imagens de Escalas e Agenda

- **Prioridade**: alta
- **Status**: em andamento / fase final (Escalas PDF/PNG concluído; Agenda PDF/PNG integrado no backend e web na branch feature/unified-share-pdf-png)
- **Fase**: melhoria de produtividade e operacao
- **Categoria**: produto / exportacao / documentos
- **Esforco estimado**: medio
- **Contexto**: as visualizacoes de Escalas e Agenda usam `window.print()` e CSS de impressao no navegador. O resultado depende do navegador, driver, configuracao de papel e dispositivo do usuario, o que impede uma experiencia previsivel de exportacao em PDF ou imagem para compartilhamento.
- **Acao**: criar exportacao sincrona de PDF e PNG pelo backend para Escalas e Agenda, com download direto ao usuario autorizado, usando Playwright com Chromium. A entrega deve extrair um contrato de renderer e separar consulta, autorizacao e template para permitir que uma futura Central de Documentos reaproveite a mesma base.
- **Impacto**: disponibiliza arquivos consistentes, independentes do navegador do usuario e visualmente equivalentes a impressao atual em producao, sem introduzir agora historico, armazenamento, fila ou infraestrutura de processamento dedicada.

## Objetivo

Permitir que um usuario autorizado gere e baixe o PDF ou imagens PNG atuais de uma Escala ou da Agenda diretamente pelo sistema.

Os arquivos sao produzidos na requisicao e devolvidos como download. Eles representam os dados disponiveis no momento da solicitacao e nao ficam persistidos depois da resposta.

## Escopo inicial

- PDF e PNG como formatos de exportacao;
- Escalas como primeiro fluxo vertical;
- Agenda como segundo consumidor do mesmo contrato, apos validacao de Escalas;
- layout A4 validado com dados curtos e extensos;
- PNG gerado por pagina A4 quando o documento tiver mais de uma pagina, pronto para compartilhamento pelo usuario;
- nome de arquivo, MIME type e `Content-Disposition` padronizados;
- autorizacao e isolamento por tenant aplicados no backend;
- tratamento de erro seguro quando a renderizacao falhar;
- manutencao temporaria da impressao pelo navegador como fallback, ate a validacao do PDF em producao.

## Fora de escopo

- Central de Documentos e sua tela;
- historico, listagem ou re-download de arquivos gerados;
- armazenamento em Supabase Storage, URLs assinadas ou politica de retencao;
- `DocumentJob`, `DocumentAttempt`, status, cancelamento, retry ou reprocessamento;
- fila, cron, worker separado ou microservico;
- DOCX, CSV e XLSX novos;
- envio por e-mail, WhatsApp ou compartilhamento automatizado pelo sistema;
- customizacao de template por tenant.

## Direcao arquitetural

A implementacao permanece no monolito NestJS e deve ter apenas as fronteiras necessarias para evolucao futura:

- controller recebe a solicitacao e devolve o download;
- service da origem carrega dados e aplica autorizacao contextual;
- um contrato interno de renderer recebe dados normalizados e devolve `Buffer`, MIME type e nome de arquivo;
- Playwright com Chromium renderiza o HTML/CSS do documento em PDF ou PNG no servidor;
- template e renderer nao ficam no controller;
- nenhuma tabela, bucket ou job e criada nesta entrega.

Uma futura Central de Documentos podera orquestrar os mesmos renderers para persistir arquivo e acompanhar processamento, sem que essa infraestrutura seja antecipada agora.

## Decisoes e riscos tecnicos

- Playwright com Chromium e a engine fechada para PDF e PNG;
- validar no ambiente real de producao que Chromium, fontes, logo do tenant e tabelas extensas funcionam dentro dos limites de tempo e memoria;
- definir limites de volume de dados e tempo de resposta para evitar degradacao da API;
- decidir, apos validacao em producao, quando o botao de impressao do navegador pode deixar de ser fallback;
- manter a autorizacao do download alinhada ao modulo de origem, inclusive para BASIC lider ou co-lider de ministerio.

## Referencia visual de producao

A impressao existente em producao e a referencia de regressao da exportacao. PDF e PNG devem preservar o mesmo conteudo autorizado, identidade do tenant, cabecalho, rodape, tabela, ordenacao, destaque semantico e regras de quebra de pagina da area atual de impressao de Escalas e Agenda.

Equivalencia nao inclui elementos do dialogo nativo do navegador, como URL, data, cabecalhos ou rodapes adicionados pelo proprio browser. A validacao visual compara a area de impressao do OneElo, nao esses elementos externos.

## Criterios de aceite

- usuario autorizado exporta uma Escala e a Agenda em PDF ou PNG sem depender da dialog de impressao do navegador;
- documentos extensos geram PNG separado por pagina A4, com sequencia de nomes previsivel;
- usuario sem permissao, de outro tenant ou fora do ministerio autorizado nao obtem dados pelo endpoint;
- PDF e PNG sao visual e semanticamente equivalentes a impressao atualmente em producao, exceto pelos elementos nativos do dialogo do navegador;
- os arquivos tem cabecalho e identidade corretos do tenant e nao cortam conteudo de forma inadequada nos cenarios validados;
- o arquivo nao e persistido em banco ou storage;
- a aplicacao nao cria job, fila, cron, worker ou microservico para esta entrega.

