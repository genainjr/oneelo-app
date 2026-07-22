# Backlog - Central de Documentos

### FT-013 Central de Documentos

- **Prioridade**: alta
- **Fase**: próxima evolução de produtividade e operação
- **Categoria**: produto / infraestrutura / documentos / relatórios
- **Esforço estimado**: alto
- **Contexto**: o OneElo já possui telas de visualização, exportação e impressão, mas a geração de documentos ainda é tratada como comportamento local de cada tela. A necessidade evolui para gerar e armazenar documentos em PDF, Word, PNG e outros formatos, com histórico, status, reprocessamento e distribuição futura.
- **Ação**: criar uma Central de Documentos multitenant para solicitar, processar, armazenar, baixar e auditar documentos gerados pelo sistema. A primeira versão deve operar dentro do backend atual, com desenho assíncrono e fronteiras claras para possível extração futura em worker ou microserviço.
- **Impacto**: padroniza documentos, reduz dependência de impressão manual do navegador, permite geração em background, viabiliza histórico de arquivos e prepara o sistema para documentos oficiais, relatórios e imagens compartilháveis.

## Problema atual

Hoje a geração de documentos está distribuída por tela e depende principalmente da experiência do navegador.

Limitações:

- não existe histórico central de documentos gerados;
- não existe status de processamento;
- não existe reprocessamento ou retentativa;
- não existe armazenamento padronizado dos arquivos finais;
- documentos gerados por impressão dependem do driver, navegador e orientação escolhida pelo usuário;
- PDF, Word e PNG exigem bibliotecas e runtimes diferentes;
- fluxos pesados podem gerar timeout se forem executados dentro da request HTTP;
- não há uma fronteira clara entre regra de negócio, template e renderização.

## Objetivo

Criar uma infraestrutura central para geração de documentos do OneElo, começando como módulo interno do monólito e preparada para evoluir para worker ou microserviço quando houver necessidade real.

## Escopo funcional

### 1. Solicitação de documento

O usuário deve poder solicitar documentos a partir de fluxos existentes, por exemplo:

- impressão/exportação de Agenda;
- impressão/exportação de Escalas;
- relatórios de membros;
- relatórios ministeriais;
- documentos futuros de comunicação, presença, eventos e financeiro.

Cada solicitação deve registrar tenant, usuário solicitante, origem, tipo, filtros, formato, status, retenção e arquivo final quando concluído.

### 2. Formatos suportados

Formatos desejados, por fases:

- **PDF**: prioridade inicial;
- **PNG**: útil para compartilhamento e visualização rápida;
- **DOCX/Word**: útil para documentos editáveis e atas futuras;
- **CSV/XLSX**: pode continuar nos fluxos atuais ou ser absorvido depois.

### 3. Processamento assíncrono

Documentos simples podem ser gerados de forma síncrona, mas a arquitetura deve favorecer geração assíncrona:

1. usuário solicita o documento;
2. backend cria um registro pendente;
3. worker interno processa;
4. arquivo é salvo no storage;
5. usuário recebe status e link de download.

### 4. Templates

Templates devem ser tratados como contratos versionados.

Regras:

- separar dados do template visual;
- usar templates por tipo de documento;
- preservar identidade do tenant quando aplicável;
- permitir evolução sem quebrar documentos antigos;
- evitar depender apenas de CSS de impressão do navegador para documentos oficiais.

### 5. Storage e retenção

A Central deve salvar arquivos gerados em storage compatível com o modelo atual do projeto.

Regras esperadas:

- path sempre escopado por tenant;
- URLs assinadas ou protegidas;
- retenção configurável por tipo de documento;
- exclusão segura de documentos expirados;
- não armazenar dados sensíveis além do necessário.

## Arquitetura recomendada

### Fase inicial: módulo no monólito

Criar dentro do backend atual:

- `DocumentsModule`;
- serviço de solicitação;
- serviço de renderização;
- processador assíncrono;
- contratos de template;
- API para listar, consultar, baixar e reprocessar.

Motivo: menor custo operacional, menor complexidade de deploy e evolução mais rápida.

### Fase intermediária: worker separado no monorepo

Quando a geração consumir mais CPU/memória ou precisar de Chromium/LibreOffice:

- manter o mesmo banco e storage;
- mover processamento para worker separado;
- backend continua responsável por autorização e criação de jobs;
- worker processa jobs pendentes.

### Fase futura: microserviço de documentos

Faz sentido considerar microserviço quando o processamento usar runtimes pesados, houver alto volume ou for necessário escalar CPU/memória separadamente.

O microserviço não deve ser a primeira entrega.

## Modelo de dados sugerido

### DocumentJob

Representa a solicitação e o ciclo de vida do documento.

Campos esperados:

- `id`;
- `tenantId`;
- `requestedByUserId`;
- `sourceType`;
- `sourceId` opcional;
- `templateKey`;
- `templateVersion`;
- `format`;
- `status`;
- `parameters` sanitizados;
- `storageKey` opcional;
- `fileName`;
- `mimeType`;
- `fileSize`;
- `attemptCount`;
- `lastErrorCode`;
- `lastErrorMessage` sanitizada;
- `requestedAt`;
- `processingStartedAt`;
- `completedAt`;
- `expiresAt`;
- `createdAt`;
- `updatedAt`.

### DocumentAttempt

Registra tentativas de renderização com início, fim, resultado, engine usada, erro sanitizado e duração.

## Permissões

Regras iniciais:

- `ADMIN`: pode gerar e consultar documentos administrativos do tenant;
- `STAFF`: pode gerar conforme permissões atuais do módulo de origem;
- `BASIC` líder ou auxiliar: pode gerar documentos apenas dos seus ministérios autorizados;
- `BASIC` comum: pode gerar apenas documentos pessoais quando existir esse fluxo;
- backend sempre valida o escopo, não apenas a UI.

## Fora de escopo inicial

- assinatura digital;
- edição online de documentos;
- templates customizados por tenant;
- microserviço separado na primeira entrega;
- envio automático por e-mail/WhatsApp;
- OCR ou leitura de documentos enviados.

## Critérios de aceite

- Existe uma tela ou ponto de acesso para documentos gerados.
- Solicitações ficam persistidas com status.
- Documento concluído pode ser baixado.
- Falhas ficam visíveis de forma segura.
- Jobs podem ser reprocessados quando fizer sentido.
- Tenant e permissões são respeitados.
- A primeira entrega melhora um fluxo real, preferencialmente Agenda ou Escalas em PDF.

