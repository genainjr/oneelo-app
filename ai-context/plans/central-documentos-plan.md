# Plano - Central de Documentos e Carteirinhas de Membros

Status geral: planejado  
Data de criação: 2026-11-10  
Branch sugerida para implementação: feature/central-documentos-carteirinha  

## Planos e Referências Relacionados

- [Backlog - Central de Documentos](../backlog/central-documentos.md)
- [ODS - Export Standard](../../ai-core/skills/oneelo-design-system/EXPORT_STANDARD.md)
- [Permissões e RBAC](../architecture/rbac-decisions.md)

---

## 1. Objetivo da Entrega

Entregar a infraestrutura da **Central de Documentos** multitenant no OneElo e a funcionalidade de **Carteirinhas de Membros (unitárias e em lote)**, além de persistir e otimizar as exportações de **Escalas e Agenda** no Supabase Storage:
1. Permitir que a secretaria emita carteirinhas oficiais de membros em formato individual (cartão CR80: 85.6mm x 53.98mm) e em lote (grade A4 para impressão gráfica), além de versão digital (PNG) para o PWA do membro.
2. Expandir o modelo de dados de `Membro` para registrar dados eclesiásticos, pessoais e documentais indispensáveis (`matricula`, `cargo`, `dataBatismo`, `cpf`, `rg`, `sexo`, `estadoCivil`).
3. Eliminar a lentidão e as falhas do menu de compartilhamento nativo do celular (`navigator.share`) em Escalas e Agenda, mantendo rigorosamente o layout ODS validado (`ExportShareDialog` e `ExportSharePreparedBanner`), através de cache por versão (`updatedAt`) no Supabase Storage.
4. Implementar fila assíncrona baseada em PostgreSQL/Prisma gerenciada internamente pelo NestJS (sem dependência de Redis), garantindo histórico permanente e reprocessamento por tenant.

---

## 2. Contexto e Diagnóstico

- **Renderizador Existente**: O monólito NestJS já possui o `ChromiumRendererService` via Playwright configurado com flags de economia de memória e semáforo sequencial.
- **Limitação Atual**: A geração síncrona atual de Escalas e Agenda via requisição HTTP leva de 4 a 8 segundos. No iOS Safari e no Android Chrome, qualquer chamada a `navigator.share` precedida por um `await` longo tem seu gesto de usuário (*transient user activation*) revogado por segurança, fazendo o compartilhamento falhar no primeiro clique.
- **Falta de Persistência**: Documentos gerados não ficam salvos; cada clique reprocessa o Chromium, consumindo CPU/RAM desnecessariamente.
- **Dados Ausentes no Cadastro**: O modelo `Membro` não possui campos cruciais para a secretaria de uma igreja (matrícula/rol, data de batismo, cargo eclesiástico, CPF). A carteirinha de membros precisa desses dados já na sua versão 1.

---

## 3. Decisões de Arquitetura, Riscos e Engenharia

1. **Fila Assíncrona em Banco de Dados (PostgreSQL + Prisma)**:
   - Evita a dependência e custo de hospedar um Redis/BullMQ.
   - Tabela `tb_document_job` no PostgreSQL gerencia estados (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`).
   - Worker em NestJS consome jobs sequencialmente respeitando o limite do Chromium.
2. **Armazenamento no Supabase Storage**:
   - Bucket `tenant-documents`, com caminhos isolados por tenant: `tenant-documents/{tenantId}/{tipo}/{jobId}.{ext}`.
   - URLs assinadas com tempo de expiração seguro para downloads e visualizações.
3. **Cache Inteligente de Escalas e Agenda**:
   - Chave de versão no Storage contendo o `updatedAt` da escala/evento. Se inalterado, a resposta é imediata (< 200ms), viabilizando o `navigator.share` nativo abrir de primeira no mobile.
4. **Layout Visual ODS Preservado**:
   - O `<ExportShareDialog />` e o `<ExportSharePreparedBanner />` permanecem com seu design e comportamento intactos.
5. **Autenticidade por QR Code**:
   - QR Code embutido no verso da carteirinha apontando para URL segura do OneElo (`/validar-carteirinha/{id}`), permitindo comprovação rápida por secretarias e eventos.

---

## 4. Etapas de Desenvolvimento

> **Regra de Execução:** O desenvolvimento deve avançar estritamente etapa por etapa. Ao concluir uma tarefa ou etapa, atualize imediatamente seu checkbox para `[x]`, apresente o resumo das validações e **aguarde a autorização explícita do usuário antes de iniciar a etapa seguinte**.

### Etapa 0 - Modelagem de Dados e Migração (Prisma & DTOs)
Status: concluido

- [x] Atualizar schema Prisma (`apps/api/prisma/schema.prisma`):
  - [x] Adicionar campos em `Membro` (`tb_member`):
    - [x] `matricula` (String?, nullable)
    - [x] `cargo` (String?, nullable)
    - [x] `dataBatismo` (DateTime?, nullable)
    - [x] `cpf` (String?, nullable)
    - [x] `rg` (String?, nullable)
    - [x] `sexo` (enum `SexoMembro` com `MASCULINO`, `FEMININO`, nullable)
    - [x] `estadoCivil` (enum `EstadoCivil` com `SOLTEIRO`, `CASADO`, `DIVORCIADO`, `VIUVO`, `UNIAO_ESTAVEL`, nullable)
  - [x] Criar enum `TipoDocumento` (`CARTEIRINHA_INDIVIDUAL`, `CARTEIRINHAS_LOTE`, `ESCALA_PDF`, `ESCALA_PNG`, `AGENDA_PDF`, `AGENDA_PNG`, `RELATORIO`)
  - [x] Criar enum `FormatoDocumento` (`PDF`, `PNG`)
  - [x] Criar enum `StatusDocumentJob` (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`)
  - [x] Criar modelo `DocumentJob` (`tb_document_job`) com `id`, `tenantId`, `requestedByUserId`, `tipoDocumento`, `formato`, `status`, `parametros` (Json), `versionHash` (String?), `storageKey` (String?), `fileName` (String?), `fileSize` (Int?), `tentativas` (Int @default(0)), `erroMensagem` (String?), `createdAt`, `completedAt`
  - [x] Adicionar índices por `[tenantId, status]` e `[tenantId, tipoDocumento, versionHash]`
- [x] Gerar migração Prisma e client (`npx prisma generate`)
- [x] Atualizar DTOs de membros (`apps/api/src/modules/membros/dto/create-membro.dto.ts` e `update-membro.dto.ts`) para suportar os novos campos com validações de formato
- [x] Critério de validação da etapa: `npx prisma validate`, `npx tsc --noEmit -p apps/api/tsconfig.json` e testes unitários de membros passando sem regressão.

### Etapa 1 - Backend: Módulo de Documentos e Fila Assíncrona
Status: planejado

- [ ] Criar módulo `apps/api/src/modules/documents/documents.module.ts` e registrar no `app.module.ts`
- [ ] Implementar repositório e serviço de jobs (`apps/api/src/modules/documents/document-jobs.service.ts`):
  - [ ] `createJob(tenantId, userId, dto)`: cria job `PENDING`
  - [ ] `getNextPendingJob()`: busca próximo job elegível com trava lógica de processamento
  - [ ] `completeJob(jobId, storageKey, fileName, fileSize)`: marca `COMPLETED` e dispara notificação in-app
  - [ ] `failJob(jobId, erroMensagem)`: incrementa tentativas e marca `FAILED` se atingir limite
- [ ] Implementar fila/worker leve em background (`apps/api/src/modules/documents/document-worker.service.ts`):
  - [ ] Polling concorrente controlado com semáforo de concorrência máxima de 1 renderização simultânea
  - [ ] Tratamento gracioso de erros com mensagens sanitizadas
- [ ] Implementar controller multitenant (`apps/api/src/modules/documents/documents.controller.ts`):
  - [ ] `POST /api/documents/jobs`: solicitar novo job assíncrono
  - [ ] `GET /api/documents/jobs/:id`: consultar status de um job em andamento
  - [ ] `GET /api/documents/history`: listagem paginada do histórico de documentos do tenant
  - [ ] `GET /api/documents/:id/download`: URL assinada ou stream do arquivo no Supabase Storage
- [ ] Critério de validação da etapa: Testes unitários do `document-jobs.service.spec.ts` validando criação, transições de status e isolamento de tenant.

### Etapa 2 - Backend: Motor de Renderização de Carteirinhas (PDF & PNG)
Status: planejado

- [ ] Adicionar dependência leve para geração de QR Code (`qrcode`) no backend
- [ ] Implementar serviço de renderização de carteirinhas (`apps/api/src/modules/documents/renderers/carteirinha-renderer.service.ts`):
  - [ ] Template HTML/CSS da Frente (Foto do membro, logo e cores do tenant, nome completo, cargo, congregação)
  - [ ] Template HTML/CSS do Verso (Matrícula, data de nascimento, data de batismo, CPF/RG, data de emissão/validade e QR code)
  - [ ] Renderização de cartão individual CR80 (`85.6mm x 53.98mm`) em PDF e imagem PNG de alta resolução
  - [ ] Renderização em lote em grade A4 para impressão gráfica (múltiplas carteirinhas frente/verso por folha)
- [ ] Integrar carteirinhas ao worker de documentos para processar jobs `CARTEIRINHA_INDIVIDUAL` e `CARTEIRINHAS_LOTE`
- [ ] Implementar endpoint público de validação de autenticidade (`GET /api/documents/validar/carteirinha/:id`):
  - [ ] Retorna dados oficiais para conferência pública (nome, igreja, status ativo, foto, cargo) sem expor dados sensíveis
- [ ] Critério de validação da etapa: Testes unitários do renderer com snapshot/verificação de geração de buffer PDF e PNG válidos.

### Etapa 3 - Backend: Cache e Armazenamento de Escalas e Agenda
Status: planejado

- [ ] Integrar `EscalaDocumentRendererService` ao Supabase Storage:
  - [ ] Salvar arquivos gerados no bucket `tenant-documents/{tenantId}/escalas/{versionHash}.{ext}`
  - [ ] Verificar existência prévia no Storage antes de acionar o Playwright
  - [ ] Registrar job `COMPLETED` no histórico da Central de Documentos
- [ ] Integrar `EventoDocumentRendererService` ao Supabase Storage:
  - [ ] Salvar arquivos gerados no bucket `tenant-documents/{tenantId}/agenda/{versionHash}.{ext}`
  - [ ] Verificar existência prévia no Storage antes de acionar o Playwright
  - [ ] Registrar job `COMPLETED` no histórico da Central de Documentos
- [ ] Critério de validação da etapa: Exportação consecutiva da mesma semana respondendo com o arquivo do Storage em < 300ms.

### Etapa 4 - Frontend: Atualização de Membros e Emissão de Carteirinhas
Status: planejado

- [ ] Atualizar tipos de membro em `apps/web/src/types/index.ts` com os novos campos
- [ ] Atualizar formulário de membros (`apps/web/src/app/(dashboard)/membros/novo/page.tsx` e edição):
  - [ ] Seção "Dados Eclesiásticos e Documentos" com matrícula, cargo, data de batismo, CPF, RG, sexo e estado civil
- [ ] Adicionar ação de emissão de carteirinha unitária em `/membros/[id]` e na tabela de membros:
  - [ ] Modal com pré-visualização (frente/verso) e botões de download (PDF CR80 ou PNG)
- [ ] Adicionar ação de emissão em lote em `/membros`:
  - [ ] Seleção múltipla de membros ou botão "Emitir Carteirinhas Ativas"
  - [ ] Disparo de job com feedback de processamento em segundo plano
- [ ] Adicionar visualização da própria carteirinha digital para o membro comum em `/meu-perfil` e `/personal-panel`
- [ ] Critério de validação da etapa: Criação de membro com os novos campos e emissão da carteirinha individual e em lote funcionando no navegador.

### Etapa 5 - Frontend: Central de Documentos e Validação Pública
Status: planejado

- [ ] Criar página `/documentos` (`apps/web/src/app/(dashboard)/documentos/page.tsx`):
  - [ ] `PageHeader` com título e descrição no padrão ODS
  - [ ] Tabela com listagem de documentos emitidos: tipo, solicitante, data, status (com `StatusBadge`), tamanho e ações
  - [ ] Botão de download direto
  - [ ] Ação de reprocessamento em caso de erro
- [ ] Adicionar item de navegação "Central de Documentos" na sidebar e menu de configurações/secretaria
- [ ] Criar página pública de validação de autenticidade (`apps/web/src/app/validar-carteirinha/[id]/page.tsx`):
  - [ ] Exibição limpa e institucional confirmando autenticidade do membro
- [ ] Critério de validação da etapa: Navegação na Central de Documentos, download de itens concluídos e leitura de QR code redirecionando para validação funcional.

### Etapa 6 - Validação Integrada, Testes e Build Final
Status: planejado

- [ ] Executar suíte de testes unitários do backend (`npm run test` em `apps/api`)
- [ ] Executar typecheck TypeScript (`npx tsc --noEmit`) em `apps/api` e `apps/web`
- [ ] Executar build de produção (`npm run build` em ambos os apps)
- [ ] Validação mobile em viewport reduzido (PWA / iPhone) confirmando que o menu de compartilhamento de escalas/agenda abre instantaneamente
- [ ] Atualizar documentação em `ai-context/` e marcar backlog como entregue
- [ ] Critério de validação da etapa: Build passando 100% sem erros, zero regressão em telas existentes e cobertura completa de testes.

---

## 5. Critérios de Aceite Gerais

- [ ] Carteirinha de membro é gerada em formato cartão individual (PDF CR80 e PNG) e em folha A4 pronta para impressão gráfica.
- [ ] Todos os novos campos do membro (`matricula`, `cargo`, `dataBatismo`, `cpf`, `rg`, `sexo`, `estadoCivil`) são salvos e refletidos na carteirinha.
- [ ] O verso da carteirinha contém QR code escaneável que abre a tela de validação pública no OneElo.
- [ ] As telas de Escalas e Agenda mantêm 100% o layout atual (`ExportShareDialog` e `ExportSharePreparedBanner`), com abertura instantânea do menu de compartilhamento no celular.
- [ ] Os documentos gerados ficam registrados na Central de Documentos com isolamento multitenant estrito por `tenantId`.
- [ ] Fila de processamento assíncrono opera de forma estável no monólito NestJS sem necessidade de Redis.
