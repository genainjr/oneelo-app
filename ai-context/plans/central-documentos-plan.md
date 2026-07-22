# Plano - Central de Documentos

Status geral: **planejado**

Criação: 2026-07-22

Branch sugerida para implementação: `feature/central-documentos`

Backlog relacionado: [central-documentos.md](../backlog/central-documentos.md)

## Objetivo da entrega

Criar uma Central de Documentos multitenant para gerar, acompanhar, armazenar e baixar documentos do sistema, começando por PDF de Agenda/Escalas e mantendo a arquitetura preparada para PNG, DOCX/Word e worker/microserviço no futuro.

O foco inicial não é substituir todos os fluxos de exportação. O foco é criar a base confiável para documentos gerados pelo sistema.

## Decisões fechadas

- A primeira implementação deve ficar no backend atual.
- Não criar microserviço na primeira entrega.
- O desenho deve permitir extração futura para worker ou serviço separado.
- O processamento deve ser preferencialmente assíncrono.
- O banco registra o ciclo de vida do documento.
- O arquivo final deve ser salvo em storage com escopo por tenant.
- A UI deve permitir acompanhar status, erro seguro e download.
- O primeiro caso de uso deve ser um fluxo real, preferencialmente Agenda PDF ou Escala PDF.

## Fora de escopo inicial

- Assinatura digital.
- Edição online de documentos.
- Templates customizados por tenant.
- OCR ou leitura de documentos enviados.
- Envio automático por e-mail ou WhatsApp.
- Microserviço separado.
- Conversão completa para todos os formatos no primeiro release.

## Etapa 0 - Contrato de produto e recorte inicial

Objetivo: fechar uma primeira entrega pequena, útil e testável.

- [ ] Definir se o primeiro documento será Agenda PDF, Escala PDF ou ambos.
- [ ] Definir se o fluxo atual de impressão continua disponível como fallback.
- [ ] Definir nome da área: "Documentos", "Central de Documentos" ou outro.
- [ ] Definir retenção inicial, por exemplo 7, 30 ou 90 dias.
- [ ] Definir se o usuário recebe notificação quando o documento fica pronto.
- [ ] Definir limite inicial de documentos por tenant/usuário.
- [ ] Definir formatos da primeira entrega: provavelmente somente PDF.

Entregável:

- contrato funcional fechado no plano;
- escopo da primeira entrega documentado;
- decisões pendentes explicitadas.

Critérios de aceite:

- a primeira entrega tem valor visível sem depender de todos os formatos;
- não há decisão aberta que bloqueie modelagem ou API.

## Etapa 1 - Auditoria do estado atual

Objetivo: mapear o que já existe antes de criar estrutura nova.

- [ ] Mapear fluxos atuais de impressão e exportação de Agenda.
- [ ] Mapear fluxos atuais de impressão e exportação de Escalas.
- [ ] Mapear exportações existentes de Membros e Ministérios.
- [ ] Identificar helpers reutilizáveis de tenant, logo, período e filtros.
- [ ] Identificar storage já usado no projeto e variáveis existentes.
- [ ] Identificar padrões atuais de RBAC por módulo.

Entregável:

- seção "Estado atual do código" atualizada neste plano antes da implementação.

Critérios de aceite:

- o plano aponta quais arquivos/módulos serão reaproveitados;
- não cria configuração nova quando já existir equivalente no projeto.

## Etapa 2 - Modelo persistente

Objetivo: criar a base de dados mínima para acompanhar documentos.

- [ ] Criar enum de origem do documento: agenda, escala, membros, ministerios, outros.
- [ ] Criar enum de formato: pdf, png, docx, csv, xlsx.
- [ ] Criar enum de status: pending, processing, completed, failed, cancelled, expired.
- [ ] Criar modelo `DocumentJob`.
- [ ] Avaliar se `DocumentAttempt` entra já na primeira entrega ou fica para a etapa de robustez.
- [ ] Criar índices por `tenantId`, `status`, `requestedAt`, `expiresAt` e `sourceType`.
- [ ] Garantir que `parameters` não armazene segredos ou dados desnecessários.
- [ ] Criar migration.

Entregável:

- schema versionado;
- migration criada;
- Prisma gerado e validado.

Critérios de aceite:

- todo documento pertence a um tenant;
- todo documento sabe quem solicitou;
- status e erro são persistidos;
- filtros usados podem ser auditados de forma sanitizada.

## Etapa 3 - API base da Central

Objetivo: permitir criar, listar, detalhar e baixar documentos.

- [ ] Criar módulo `DocumentsModule`.
- [ ] Criar endpoint para solicitar documento.
- [ ] Criar endpoint de listagem com paginação.
- [ ] Criar filtros por origem, formato, status e período.
- [ ] Criar endpoint de detalhe.
- [ ] Criar endpoint de download protegido.
- [ ] Criar endpoint de cancelamento para documentos ainda pendentes.
- [ ] Criar endpoint de reprocessamento para documentos com falha recuperável.
- [ ] Validar tenant e permissão no backend.

Entregável:

- API funcional sem UI completa;
- testes de autorização e tenant.

Critérios de aceite:

- usuário não acessa documento de outro tenant;
- usuário sem permissão não gera documento administrativo;
- download só funciona para documento concluído e autorizado;
- erro de job não expõe stack trace nem segredo.

## Etapa 4 - Processamento assíncrono inicial

Objetivo: gerar documentos fora da request principal.

- [ ] Criar processador interno de jobs pendentes.
- [ ] Buscar jobs `PENDING` vencidos ou recém-criados.
- [ ] Implementar transição segura para `PROCESSING`.
- [ ] Implementar tentativa e incremento de `attemptCount`.
- [ ] Implementar erro sanitizado.
- [ ] Implementar retorno para `FAILED` quando esgotar tentativa.
- [ ] Evitar processamento duplicado em concorrência.
- [ ] Registrar `processingStartedAt` e `completedAt`.

Entregável:

- job sai de pending para completed ou failed;
- falha pode ser diagnosticada no detalhe.

Critérios de aceite:

- reiniciar a API não apaga job pendente;
- reprocessar um job não duplica arquivo final sem controle;
- falha controlada fica visível para o usuário autorizado.

## Etapa 5 - Storage e retenção

Objetivo: armazenar o arquivo final de forma segura.

- [ ] Definir bucket/path de documentos gerados.
- [ ] Usar path com `tenantId`.
- [ ] Salvar `storageKey`, `fileName`, `mimeType` e `fileSize`.
- [ ] Gerar download protegido ou URL assinada.
- [ ] Definir `expiresAt`.
- [ ] Criar rotina futura ou backlog para expurgo de expirados.
- [ ] Validar que documento expirado não pode ser baixado.

Entregável:

- documento concluído pode ser baixado;
- documento não fica público por URL previsível.

Critérios de aceite:

- tenant A não acessa arquivo do tenant B;
- arquivo ausente ou expirado retorna erro controlado;
- storage não recebe arquivo fora do path esperado.

## Etapa 6 - Primeiro template: Agenda ou Escala PDF

Objetivo: entregar valor real usando um documento já conhecido do usuário.

- [ ] Separar consulta de dados do template visual.
- [ ] Preservar logo e nome do tenant.
- [ ] Preservar filtros usados na tela de origem.
- [ ] Definir nome do arquivo de saída.
- [ ] Garantir layout estável sem depender de configuração manual do driver de impressão.
- [ ] Validar PDF gerado com volume pequeno e grande.
- [ ] Manter fallback de impressão atual se necessário.

Entregável:

- usuário solicita PDF a partir de Agenda ou Escalas;
- job é criado;
- PDF fica disponível para download.

Critérios de aceite:

- documento gerado tem cabeçalho correto;
- documento respeita filtros;
- documento não mistura dados de outro tenant;
- layout não corta tabela de forma inadequada.

## Etapa 7 - UI da Central de Documentos

Objetivo: dar visibilidade operacional ao usuário.

- [ ] Criar rota/tela da Central.
- [ ] Criar lista paginada.
- [ ] Mostrar origem, formato, status, solicitante, data e expiração.
- [ ] Criar filtros por origem, formato, status e período.
- [ ] Mostrar ações: baixar, reprocessar, cancelar quando aplicável.
- [ ] Mostrar erro seguro para jobs com falha.
- [ ] Seguir ODS e padrões de filtros/listagens existentes.

Entregável:

- usuário acompanha documentos solicitados;
- administrador consegue auditar documentos do tenant.

Critérios de aceite:

- UI não mostra ações sem permissão;
- estado vazio, loading e erro estão tratados;
- mobile não quebra ações principais.

## Etapa 8 - Robustez e observabilidade

Objetivo: tornar a operação segura para produção.

- [ ] Adicionar logs estruturados sem dados sensíveis.
- [ ] Registrar métricas básicas de sucesso/falha/duração.
- [ ] Criar política de retry.
- [ ] Criar política para job preso em `PROCESSING`.
- [ ] Criar testes para concorrência básica.
- [ ] Documentar limites de tamanho e tempo.

Entregável:

- operação minimamente auditável;
- falhas investigáveis sem acesso direto ao storage.

Critérios de aceite:

- job travado não fica eternamente invisível;
- falhas comuns têm mensagem operacional útil;
- logs não expõem conteúdo sensível do documento.

## Etapa 9 - Preparação para worker ou microserviço futuro

Objetivo: deixar a fronteira clara sem extrair agora.

- [ ] Isolar contrato `DocumentRenderer`.
- [ ] Isolar contrato de storage.
- [ ] Evitar lógica de renderização dentro de controller.
- [ ] Documentar requisitos de Chromium/LibreOffice se forem adotados.
- [ ] Definir como um worker separado reivindicaria jobs.
- [ ] Definir variáveis necessárias para execução isolada.

Entregável:

- documentação de extração futura;
- módulo organizado para mover renderização sem redesenhar produto.

Critérios de aceite:

- controller chama serviço de aplicação, não engine concreta;
- renderer pode ser trocado por implementação externa;
- dados necessários ao renderer são serializáveis.

## Validação final da entrega

- [ ] `npx.cmd prisma validate`
- [ ] `npx.cmd prisma generate`
- [ ] Build da API.
- [ ] Build do web.
- [ ] Testes de tenant isolado.
- [ ] Testes de permissões ADMIN, STAFF, BASIC líder e BASIC comum.
- [ ] Teste de geração com sucesso.
- [ ] Teste de falha e reprocessamento.
- [ ] Teste de download autorizado e negado.
- [ ] Teste de documento expirado.

