# Plano - Dízimos e Ofertas Digitais: PIX, Comprovantes Privados e Conciliação (FT-021)

Status geral: concluido  
Data de criação: 2026-11-24  
Branch sugerida para implementação: feature/dizimos-ofertas-pix-comprovantes  

## Planos e Referências Relacionados

- [Template Oficial de Planos](PLAN_TEMPLATE.md)
- [Backlog FT-021: Dízimos e Ofertas Digitais](../backlog/dizimos-ofertas-pix-comprovantes.md)
- [Backlog FT-014: Módulo Financeiro e Patrimonial](../backlog/financeiro-patrimonial.md)
- [Backlog FT-023: Importação de Extratos Bancários](../backlog/importacao-extrato-bancario.md)
- [Decisões Arquiteturais](../architecture/decisions.md)
- [Decisões de RBAC e Autorização](../architecture/rbac-decisions.md)
- [Arquitetura de Notificações](../backend/notification-architecture.md)
- [OneElo Design System (ODS)](../../ai-core/skills/oneelo-design-system/README.md)
- [Padrão de Formulários ODS](../../ai-core/skills/oneelo-design-system/FORM_STANDARD.md)
- [Padrão de CRUD e Modais ODS](../../ai-core/skills/oneelo-design-system/CRUD_STANDARD.md)

---

## 1. Objetivo da Entrega

Implementar o ciclo completo de **Dízimos e Ofertas Digitais via PIX Estático (BRCode EMVCo — 0% de taxa)** conectado diretamente ao módulo Financeiro, ao Painel Pessoal dos membros e ao Site Institucional (`/[slug]` e domínios customizados), eliminando o envio informal de comprovantes no WhatsApp e garantindo conformidade LGPD real no acesso aos arquivos:

1. **Configuração e Projeção na Tesouraria (`/financeiro`):** cadastro da chave PIX oficial da igreja (`TenantPixConfig`) vinculada a uma conta financeira padrão ativa, curadoria de categorias de entrada visíveis ao membro (`visibleToMembers`) com alerta quando não houver nenhuma marcada e **Modo Projeção / Telão de Culto** com download de QR Code em PNG de alta resolução gerado no navegador (com tratamento seguro de CORS para o logo).
2. **Autosserviço do Membro (`/minhas-contribuicoes` + Painel Pessoal + Sidebar):** acesso condicional ao QR Code / Copia-e-Cola com cálculo instantâneo de valor opcional, envio de comprovante (JPG/PNG/WEBP/PDF até 10 MB com validação real de assinatura/magic bytes e rate limit por usuário autenticado) com titular alternativo opcional (`payerName`), histórico anual privado (envios próprios em qualquer status + contribuições confirmadas lançadas pela tesouraria) e cancelamento enquanto `PENDING`.
3. **Conciliação Assistida e Notificações:** comprovantes entram como `FinancialTransaction` (`INCOME`, `PENDING`, `PIX`, `source = MEMBER_PORTAL`), destacados no resumo da tesouraria (`pendingMemberCount`/`pendingMemberAmount` globais independentemente do mês filtrado) para conferência rápida (**Confirmar/Dar Baixa** com ajuste opcional de conta/categoria/valor ou **Recusar com motivo**), com notificações In-App + Push idempotentes nos 3 gatilhos.
4. **Sigilo Financeiro / LGPD Real:** tornar o bucket `financial-receipts` privado (`public = false`), remover fallback para URL pública em `SupabaseStorageService`, eliminar exposição de `receiptUrl`/`receiptKey` em 100% dos retornos da API e migrar toda visualização de comprovantes (tesouraria, visualização, modais, CSV e membro) para **Modal de Visualização Inline** carregado via **Signed URL temporária** sob demanda (eliminando bloqueio de pop-up no iOS/Safari).
5. **Portal Público Opcional (`/[slug]` e domínios customizados):** nova seção editorial `SiteGivingSection` (`#contribuir`) e âncora discreta **"Contribuir"** no `SiteHeader`, exibidos exclusivamente quando `enabled && showOnPublicSite`, respeitando o tema dinâmico da igreja (`FT-022`).

---

## 2. Contexto e Diagnóstico

1. **Bucket e camada de Storage hoje expõem comprovantes publicamente (`infra/supabase/storage/main.tf` e `supabase-storage.service.ts`):**
   - `financial-receipts` usa `public = var.public_buckets` (`default = true` em `variables.tf`).
   - `SupabaseStorageService.createSignedUrl` faz fallback silencioso para `getPublicUrl` quando ocorre erro, e `uploadReceipt` usa `uploadPublicObject`.
   - `cancel()`, `uploadReceipt()` e `removeReceipt()` em `FinancialTransactionsService` não passam por `serializeTransaction`, expondo `receiptUrl`/`receiptKey` crus; `financeiro/page.tsx` depende de `editingTransaction?.receiptUrl` para remover comprovante; `validateFinancialReceiptUpload` verifica apenas `mimetype` declarado sem magic bytes.
   - Quatro telas (`financeiro/page.tsx`, `visualizacao/page.tsx`, `financeiro-modals.tsx` e o CSV `exportacao/page.tsx`) consomem `transaction.receiptUrl` diretamente como link aberto.
2. **Revalidação do site público restrita a `ADMIN`/`STAFF` (`apps/web/src/app/api/site/revalidate/route.ts`):**
   - A rota bloqueia com `403` qualquer usuário cujo papel global no JWT não seja `ADMIN`/`STAFF`, o que falharia quando um `FINANCE_MANAGER` com `Role.BASIC` ligar/desligar `showOnPublicSite`.
3. **Proteções pendentes no módulo financeiro (`apps/api/src/modules/financeiro/`):**
   - `FinanceiroModule` ainda não importa `NotificationsModule`.
   - `FinancialAccountsService.deactivate` apenas delega para `update(..., { active: false })`, exigindo a proteção da conta padrão PIX dentro de `update()` para impedir bypass via `PATCH`.
   - `FinancialTransactionsService.getSummary` soma todo `PENDING` do período sem separar pendências globais de membros (`MEMBER_PORTAL`), podendo esconder comprovantes da virada de mês.
   - `PATCH /transactions/:id`, `PATCH /transactions/:id/cancel` e rotas de comprovante ainda não protegem integridade de `MEMBER_PORTAL` (impedindo mudança de `type`, `memberId`, volta a `DRAFT`, confirmação sem notificação ou cancelamento sem motivo).
   - `ExportFinanceiroDto` e `prepareExportData` (IMP-010) ainda não propagam filtro `source` nem buscam por `payerName`.
4. **Roteamento, slugs reservados, domínios customizados, auth e i18n (`apps/web` e `apps/api`):**
   - `minhas-contribuicoes` ainda não consta em `reserved-slugs.ts` (web/api) nem na lista de redirecionamento de domínio customizado em `middleware.ts`.
   - `GET /api/auth/me` e `createSessionForUser` ainda não expõem `tenant.pixEnabled`; `JwtAuthGuard` não verifica se o `Membro` vinculado está ativo/não deletado.
   - `Sidebar` e `PersonalPanelPage` usam `next-intl` em 3 locales (`pt-BR.json`, `pt-PT.json`, `en-US.json`).
   - O pacote `qrcode` (`^1.5.4`) e `@types/qrcode` já estão instalados em `apps/web/package.json` e `apps/api/package.json`.

---

## 3. Decisões de Arquitetura, Riscos e Engenharia

### 3.1. Modelagem de Dados (`apps/api/prisma/schema.prisma`) e Storage Privado
- **Novos Enums:**
  - `PixKeyType`: `CPF | CNPJ | EMAIL | PHONE | EVP`
  - `FinancialTransactionSource`: `TREASURY | MEMBER_PORTAL`
- **Novo Model `TenantPixConfig` (`@@map("tb_tenant_pix_config")`):**
  - `id`, `tenantId @unique`, `enabled Boolean @default(false)`, `showOnPublicSite Boolean @default(false)`, `pixKeyType PixKeyType`, `pixKey String`, `merchantName String`, `merchantCity String`, `txidPrefix String?`, `defaultAccountId String` (FK `FinancialAccount`), `updatedByUserId String?`, `createdAt`, `updatedAt`.
- **Evoluções em Models Existentes:**
  - `FinancialCategory`: `visibleToMembers Boolean @default(false) @map("visible_to_members")`.
  - `FinancialTransaction`: `source FinancialTransactionSource @default(TREASURY) @map("source")`, `rejectionReason String? @map("rejection_reason")`, `payerName String? @map("payer_name")`, índices `@@index([tenantId, memberId, date])` e `@@index([tenantId, source, status])`.
- **Storage Privado Real (`infra/supabase/storage/main.tf`, `image-upload.ts` e `supabase-storage.service.ts`):**
  - Fixar `public = false` exclusivamente no bucket `financial_receipts` no Terraform (mantendo `member-photos` e `tenant-logos` públicos).
  - Validar magic bytes reais (`%PDF-`, JPEG `FF D8 FF`, PNG `89 50 4E 47`, WEBP `RIFF....WEBP`) em `validateFinancialReceiptUpload`.
  - Adicionar `uploadPrivateObject(bucket, path, buffer, mimeType)` (usando `ensureBucket(bucket, false)`) e `createPrivateSignedUrl(bucket, path, expiresIn = 300)` lançando `ServiceUnavailableException` em caso de falha (**nunca** retornando `getPublicUrl`), e tolerar `404` em `deleteObject` opcionalmente para não travar substituições/limpezas.
  - Em `FinancialTransactionsService.serializeTransaction` (usado em **100%** dos retornos, incluindo `cancel`, `uploadReceipt`, `removeReceipt`), remover `receiptUrl` e `receiptKey` do payload público da API e expor `hasReceipt: Boolean(receiptKey || receiptUrl)`, `receiptFileName` e `receiptMimeType`; gravar `receiptUrl: null` em novos uploads privados.

### 3.2. Gerador BRCode EMVCo e Validações de Domínio
- **Utilitário compartilhável (`apps/api/src/modules/financeiro/pix-brcode.util.ts` e espelho tipado em `apps/web/src/lib/pix-brcode.ts`):**
  - Validação rígida por `PixKeyType`:
    - `CPF`: 11 dígitos + dígitos verificadores válidos (armazenado e emitido sem máscara);
    - `CNPJ`: 14 dígitos + dígitos verificadores válidos (armazenado e emitido sem máscara);
    - `PHONE`: normalização E.164 `+55` + DDD válido + 9 dígitos (celular brasileiro — 13 dígitos após `+`, 14 chars total);
    - `EMAIL`: formato e-mail válido ASCII em lowercase (máx. 77 chars);
    - `EVP`: UUID válido (8-4-4-4-12 hex) em lowercase.
  - Sanitização ASCII estrita sem acentos/cedilha/símbolos inválidos para `merchantName` (máx. 25 chars) e `merchantCity` (máx. 15 chars).
  - Campo `62.05` (`txid`): quando `txidPrefix` não informado, emitir obrigatoriamente `'***'`; quando informado, aceitar apenas `[A-Za-z0-9]` (1–25 chars).
  - Campo `54` (valor opcional `0.01..9999999.99`, formatado com 2 casas decimais e ponto) + `CRC-16/CCITT-FALSE` (`0x1021`, init `0xFFFF`, hex uppercase 4 chars).
  - Helper `formatPixKeyForDisplay(type, key)` para leitura amigável no Telão, Modal e Site Público.
- **Integridade de Conta/Categoria:**
  - `FinancialAccountsService.update`: lançar `BadRequestException` quando `dto.active === false` e a conta for `defaultAccountId` de `TenantPixConfig` com `enabled === true` (protegendo tanto `PATCH` quanto `DELETE`).
  - `FinancialCategoriesService.create/update`: validar que `visibleToMembers === true` só é aceito quando `type === INCOME`, forçando `visibleToMembers = false` caso uma categoria mude para `EXPENSE`.

### 3.3. Contratos de API, RBAC, Rate Limit por Usuário e Notificações (`apps/api`)
- **Tesouraria (`FinanceiroController`):**
  - `GET /api/financeiro/pix-config` (`FINANCE_VIEWER`+): retorna config atual + `brCode` padrão + sugestão de cidade (`TenantWebsiteConfig.cidade`) + contagem `visibleIncomeCategoriesCount`.
  - `PUT /api/financeiro/pix-config` (`FINANCE_MANAGER` + `AuditLog`): valida chave PIX e `defaultAccountId` ativa do tenant, salva config e retorna dados atualizados.
  - `GET /api/financeiro/transactions` e `GET /api/financeiro/exportacao` (`ExportFinanceiroDto`): aceitar filtro opcional `source` (`TREASURY | MEMBER_PORTAL`), incluir `source` no `ETag` e chips do PDF, e incluir `payerName` em `matchesFinancialTransactionSearch`.
  - `GET /api/financeiro/summary`: adicionar `pendingMemberCount` e `pendingMemberAmount` (globais de `INCOME + PENDING + MEMBER_PORTAL` no tenant, respeitando apenas `accountId` se informado, sem perder comprovantes na virada de mês).
  - `PATCH /api/financeiro/transactions/:id`: para `current.source === MEMBER_PORTAL`, bloquear alteração de `type`, `memberId`, `source`, mudança para `DRAFT` ou confirmação direta via `update` (exigindo `/confirm` para garantir notificação).
  - `PATCH /api/financeiro/transactions/:id/cancel`: bloquear cancelamento genérico em `source === MEMBER_PORTAL && status === PENDING` (exigindo `/reject` com motivo obrigatório).
  - `POST/DELETE /api/financeiro/transactions/:id/receipt`: bloquear alteração/remoção do comprovante original quando `source === MEMBER_PORTAL`.
  - `PATCH /api/financeiro/transactions/:id/confirm` (`APPROVE_ROLES`): suportar ajuste opcional de `accountId` e `categoryId` (validando conta/categoria ativas e compatíveis com `current.type`), e notificar o membro quando `source === MEMBER_PORTAL`.
  - `PATCH /api/financeiro/transactions/:id/reject` (`APPROVE_ROLES`): exclusivo para `source === MEMBER_PORTAL && status === PENDING`, exige `rejectionReason` (5–500 chars), grava `status: CANCELLED`, `cancelledAt`, `cancelledByUserId`, `rejectionReason`, `AuditLog` e notifica o membro.
  - `GET /api/financeiro/transactions/:id/receipt-url` (`ensureCanAccessFinanceData`): retorna `{ url, expiresInSeconds: 300, fileName, mimeType }` via `createPrivateSignedUrl`.
- **Autosserviço do Membro (`ContribuicoesController` — rota `/api/minhas-contribuicoes`, `@UseGuards(JwtAuthGuard)` global):**
  - `UserThrottlerGuard`: estende `ThrottlerGuard` rastreando por `req.user?.sub ?? req.ip` (evita falso positivo no Wi-Fi da igreja no culto).
  - Validação de `Membro` no banco (`id: user.memberId, tenantId, deletedAt: null`, exigindo `status: ATIVO` no `POST`).
  - `GET /api/minhas-contribuicoes/pix`: retorna config PIX pública interna + `brCode` (aceitando `?amount=`) + categorias `INCOME` ativas com `visibleToMembers = true`.
  - `GET /api/minhas-contribuicoes?year=YYYY`: retorna histórico privado do `user.memberId` (`source = MEMBER_PORTAL` em qualquer status **OU** `source = TREASURY && status = CONFIRMED`), resumo anual em centavos (`confirmedTotal`, `confirmedCount`, `pendingCount`) e lista de anos disponíveis — acessível em modo leitura mesmo se `enabled === false`.
  - `POST /api/minhas-contribuicoes` (`@UseGuards(UserThrottlerGuard)` + `@Throttle({ default: { ttl: 60_000, limit: 10 } })`, `multipart/form-data`): exige membro ativo, `TenantPixConfig.enabled === true` e conta padrão ativa, valida categoria (`INCOME`, `active`, `visibleToMembers`), `amount > 0`, `date`, `payerName?`, `description?`, arquivo obrigatório com magic bytes, gera `transactionId` previamente, sobe no storage privado com rollback em falha no DB, cria `FinancialTransaction` (`INCOME`, `PENDING`, `PIX`, `source: MEMBER_PORTAL`, `counterpartyName: payerName || memberPrintName`, `receiptUrl: null`, `receiptKey: path`), grava `AuditLog` e notifica `FINANCE_APPROVER` / `FINANCE_MANAGER`.
  - `DELETE /api/minhas-contribuicoes/:id`: remove atomicamente no banco `{ id, tenantId, memberId, source: MEMBER_PORTAL, status: PENDING }` antes de remover objeto no storage privado e grava `AuditLog`.
  - `GET /api/minhas-contribuicoes/:id/receipt-url`: valida estritamente `tenantId` e `memberId` do membro autenticado (e que o item é visível no histórico dele) antes de gerar Signed URL (300s).
- **Portal Público e Sessão:**
  - `WebsiteService.getPublicSiteData`: incluir `pix: { pixKeyType, pixKey, merchantName, merchantCity, brCode } | null` apenas se `TenantPixConfig.enabled && TenantPixConfig.showOnPublicSite`.
  - `AuthService.me` e `AuthService.createSessionForUser`: incluir `pixEnabled: Boolean(tenant.pixConfig?.enabled)` em `tenant`.
  - `apps/web/src/app/api/site/revalidate/route.ts`: permitir revalidação também quando o usuário autenticado possuir `FINANCE_MANAGER` (validando via `${getServerApiBase()}/api/financeiro/permissions/me` com cookie da requisição), mantendo falha silenciosa com fallback ISR 60s.
- **Notificações (`FinanceiroModule` importando `NotificationsModule`):**
  - Disparos via `NotificationDispatchService.createNotification` com `NotificationAudienceType.SPECIFIC_USERS`, `NotificationOrigin.SYSTEM_AUTOMATION`, chaves idempotentes (`tenant:{tenantId}:contribution:{id}:submitted|confirmed|rejected`), `urlDestino: '/financeiro?source=MEMBER_PORTAL&status=PENDING'` (tesouraria) e `'/minhas-contribuicoes'` (membro), retorno antecipado se `userIds.length === 0`, exclusão de `actor.sub` e isolamento em `try/catch`.

### 3.4. Experiência Frontend (ODS, Modal Inline, Domínio Customizado e i18n)
- **Modal Inline de Comprovante Privado (`ReceiptPreviewModal`):** componente reutilizável consumindo a Signed URL sob demanda (`/api/financeiro/transactions/:id/receipt-url` ou `/api/minhas-contribuicoes/:id/receipt-url`), exibindo preview inline de imagem (`<img>`) ou PDF (`<iframe>`), tratamento de erro com retry e botão direto "Abrir em nova aba / Baixar" — zero bloqueio de pop-up em Safari/iOS.
- **Telão PIX (`PixTelaoModal`):** projeção em tela cheia com alto contraste, QR Code via `qrcode`, chave formatada e botão **"Baixar QR Code (PNG)"** via Canvas de alta resolução carregando o logo com `crossOrigin = 'anonymous'` e fallback automático caso CORS impeça desenhar o logo.
- **Site Público (`SiteGivingSection` + `SiteHeader`):** seção `#contribuir` + link discreto **"Contribuir"** no `SiteHeader` quando `site.pix` estiver presente; CTA de envio usando `${membersLoginHref}&redirect=%2Fminhas-contribuicoes` (compatível com domínio customizado) e suporte a `/minhas-contribuicoes` em `middleware.ts`.
- **Internacionalização:** sincronizar novas chaves de `nav` e `dashboardPersonal` nos 3 locales (`pt-BR.json`, `pt-PT.json`, `en-US.json`).

### 3.5. Matriz de Riscos e Mitigações
| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Comprovante acessível sem autenticação por bucket público, fallback do storage ou retorno fora de `serializeTransaction` | Alta (hoje) | Crítico | `public = false` em `financial_receipts`, `uploadPrivateObject` / `createPrivateSignedUrl` sem fallback, `serializeTransaction` em 100% dos métodos sem `receiptUrl`/`receiptKey` e remoção de links abertos em UI/CSV. |
| Rate limit por IP bloquear membros no Wi-Fi da igreja no culto | Alta | Alto | `UserThrottlerGuard` rastreando por `req.user?.sub ?? req.ip`. |
| Bypass de proteção da conta padrão PIX via `PATCH /accounts/:id` | Alta | Alto | Trava no método `FinancialAccountsService.update` para `dto.active === false`. |
| Membro inativo/deletado enviar comprovante ou bypass de notificação via `PATCH /transactions/:id` / `/cancel` | Média | Alto | Validar `Membro` ativo em `ContribuicoesService`; bloquear `update`/`cancel`/`receipt` irregulares em `MEMBER_PORTAL`. |
| Pop-up bloqueado no iOS Safari ao abrir Signed URL ou Tainted Canvas no PNG do Telão | Alta | Médio | `ReceiptPreviewModal` inline com Signed URL; `crossOrigin = 'anonymous'` + fallback sem logo no Canvas. |
| Comprovante da virada de mês sumir da fila de pendências | Média | Médio | `pendingMemberCount`/`pendingMemberAmount` globais no `getSummary`; clique no banner limpa intervalo de datas e filtra `source=MEMBER_PORTAL&status=PENDING`. |
| Chave PIX digitada incorretamente ou BRCode rejeitado por bancos | Média | Crítico | Validar CPF/CNPJ com dígitos verificadores, `+55` celular, e-mail/EVP, normalizar ASCII, emitir `***` no `txid` vazio e cobrir com testes unitários EMVCo + CRC-16. |
| CTA do site público quebrar em domínio customizado ou colisão de slug `/minhas-contribuicoes` | Média | Alto | Usar `membersLoginHref` + `&redirect=%2Fminhas-contribuicoes`, registrar `minhas-contribuicoes` em `reserved-slugs.ts` (web/api) e adicionar rota em `middleware.ts`. |

---

## 4. Etapas de Desenvolvimento

> **Regra de Execução:** O desenvolvimento deve avançar etapa por etapa, atualizando os checkboxes imediatamente ao concluir cada item. *(Execução contínua de todas as etapas autorizada explicitamente pelo usuário.)*

### Etapa 0 - Preparação, Branch e Baseline
Status: concluido

- [x] Confirmar repositório na branch `development` e atualizar com `git pull`
- [x] Criar a branch `feature/dizimos-ofertas-pix-comprovantes` a partir de `development`
- [x] Incorporar todos os ajustes da análise crítica neste plano oficial
- [x] Registrar baseline de testes e builds nos pacotes afetados:
  - [x] Executar `npx jest src/modules/financeiro src/modules/website src/common/storage` em `apps/api`
  - [x] Executar `npx -w apps/web tsc --noEmit`
- [x] Critério de validação da etapa: Branch `feature/dizimos-ofertas-pix-comprovantes` ativa sobre `development` atualizada e baseline verde registrado.

### Etapa 1 - Storage Privado, Modelagem Prisma e Slugs Reservados (Infra & Schema)
Status: concluido

- [x] Atualizar `infra/supabase/storage/main.tf`:
  - [x] Fixar `public = false` para o bucket `financial_receipts` (mantendo `member-photos` e `tenant-logos` com `var.public_buckets`)
- [x] Atualizar `apps/api/src/common/storage/image-upload.ts`:
  - [x] Validar magic bytes reais (`%PDF-`, JPEG, PNG, WEBP) em `validateFinancialReceiptUpload`
- [x] Atualizar `apps/api/src/common/storage/supabase-storage.service.ts`:
  - [x] Implementar `uploadPrivateObject(bucket, path, buffer, mimeType)` criando bucket com `isPublic = false` se ausente e retornando `path`
  - [x] Implementar `createPrivateSignedUrl(bucket, path, expiresIn = 300)` lançando `ServiceUnavailableException` em caso de falha (sem fallback para `getPublicUrl`)
  - [x] Suportar `ignoreNotFound` em `deleteObject` para limpeza/substituição segura
- [x] Atualizar `apps/api/prisma/schema.prisma`:
  - [x] Adicionar enums `PixKeyType` (`CPF | CNPJ | EMAIL | PHONE | EVP`) e `FinancialTransactionSource` (`TREASURY | MEMBER_PORTAL`)
  - [x] Criar model `TenantPixConfig` (`tb_tenant_pix_config`) vinculado a `Tenant` (`@unique`) e `FinancialAccount` (`defaultAccountId`)
  - [x] Adicionar `visibleToMembers` em `FinancialCategory`
  - [x] Adicionar `source`, `rejectionReason`, `payerName` e índices `@@index([tenantId, memberId, date])` e `@@index([tenantId, source, status])` em `FinancialTransaction`
- [x] Criar e aplicar migration Prisma (`prisma migrate dev`) e regenerar Prisma Client (`npm.cmd run db:generate -w apps/api`)
- [x] Adicionar `'minhas-contribuicoes'` em `apps/api/src/common/constants/reserved-slugs.ts`
- [x] Adicionar `'minhas-contribuicoes'` em `apps/web/src/lib/reserved-slugs.ts`
- [x] Critério de validação da etapa: Migration aplicada, Prisma Client atualizado, `npm.cmd run build -w apps/api` e `npx -w apps/web tsc --noEmit` passando sem erros.

### Etapa 2 - BRCode EMVCo, Configuração PIX e Proteções de Conta/Categoria (Backend)
Status: concluido

- [x] Criar utilitário `apps/api/src/modules/financeiro/pix-brcode.util.ts`:
  - [x] Implementar validação e normalização estrita de chave por `PixKeyType` (dígitos verificadores de CPF/CNPJ, `+55` celular em telefone, e-mail ASCII, UUID EVP)
  - [x] Implementar sanitização ASCII sem acentos para `merchantName` (máx. 25) e `merchantCity` (máx. 15), validação `[A-Za-z0-9]` (1–25) e fallback `'***'` para `txid` vazio, campo `54` opcional e cálculo `CRC-16/CCITT-FALSE`
- [x] Criar testes unitários em `apps/api/src/modules/financeiro/pix-brcode.util.spec.ts` cobrindo todos os tipos de chave, chaves inválidas, acentuação, `txid`, valor opcional e CRC-16
- [x] Criar DTO `apps/api/src/modules/financeiro/dto/upsert-tenant-pix-config.dto.ts`
- [x] Criar serviço `apps/api/src/modules/financeiro/tenant-pix-config.service.ts`:
  - [x] Implementar `getConfig(tenantId, actor)` (`FINANCE_VIEWER`+) retornando configuração atual, `brCode` padrão, sugestão de cidade via `TenantWebsiteConfig` e `visibleIncomeCategoriesCount`
  - [x] Implementar `upsertConfig(tenantId, actor, dto, ip)` (`FINANCE_MANAGER`) validando `defaultAccountId` ativa no tenant, validando chave via `pix-brcode.util.ts` e gravando `AuditLog`
- [x] Atualizar `apps/api/src/modules/financeiro/financial-accounts.service.ts`:
  - [x] Impedir em `update()` (cobrindo `PATCH` e `DELETE/deactivate`) a inativação (`active: false`) de conta vinculada a `TenantPixConfig.defaultAccountId` enquanto `enabled === true`
- [x] Atualizar `apps/api/src/modules/financeiro/dto/create-financial-category.dto.ts` e `apps/api/src/modules/financeiro/financial-categories.service.ts`:
  - [x] Suportar `visibleToMembers` apenas para `type === INCOME`, forçando `false` caso alterada para `EXPENSE`
- [x] Atualizar `apps/api/src/modules/auth/auth.service.ts`:
  - [x] Expor `pixEnabled` no objeto `tenant` retornado por `me` e por `createSessionForUser`
- [x] Adicionar endpoints `GET /api/financeiro/pix-config` e `PUT /api/financeiro/pix-config` em `apps/api/src/modules/financeiro/financeiro.controller.ts`
- [x] Critério de validação da etapa: `npx jest src/modules/financeiro` e `npm.cmd run build -w apps/api` passando 100%.

### Etapa 3 - Comprovantes Privados, Conciliação, Recusa, Exportação e Notificações na Tesouraria (Backend)
Status: concluido

- [x] Atualizar `apps/api/src/modules/financeiro/financeiro.module.ts`:
  - [x] Importar `NotificationsModule` e registrar `TenantPixConfigService`
- [x] Criar DTO `apps/api/src/modules/financeiro/dto/reject-financial-transaction.dto.ts` (`rejectionReason` obrigatório, 5–500 chars)
- [x] Atualizar `apps/api/src/modules/financeiro/dto/confirm-financial-transaction.dto.ts`:
  - [x] Adicionar campos opcionais `accountId` e `categoryId` para ajuste durante conferência
- [x] Atualizar `apps/api/src/modules/financeiro/dto/export-financeiro.dto.ts`, `apps/api/src/modules/financeiro/export/financeiro-document.types.ts` e `apps/api/src/modules/financeiro/export/financeiro-document-renderer.service.ts`:
  - [x] Suportar filtro opcional `source` na exportação PDF (incluindo chip de filtro e chave no `ETag`) e exibir `payerName` quando diferente do membro
- [x] Atualizar `apps/api/src/modules/financeiro/financial-transactions.service.ts`:
  - [x] Migrar `uploadReceipt` para `storageService.uploadPrivateObject` (gravando `receiptUrl: null`), bloquear `uploadReceipt`/`removeReceipt` em `MEMBER_PORTAL` e adicionar `getReceiptSignedUrl(tenantId, actor, id)` via `createPrivateSignedUrl` (TTL 300s)
  - [x] Atualizar `serializeTransaction` (e aplicá-lo em 100% dos métodos, incluindo `cancel`, `uploadReceipt` e `removeReceipt`) para retornar `hasReceipt`, `receiptFileName` e `receiptMimeType` sem expor `receiptUrl`/`receiptKey`
  - [x] Suportar filtro `source` em `findAll`/`prepareExportData`, incluir `payerName` em `matchesFinancialTransactionSearch` e incluir `pendingMemberCount` e `pendingMemberAmount` globais (independentes do filtro de datas) em `getSummary`
  - [x] Proteger `update` e `cancel` em `MEMBER_PORTAL` (bloquear mudança de `type`, `memberId`, `source`, volta para `DRAFT`, confirmação via `update` e cancelamento genérico em `PENDING`)
  - [x] Evoluir `confirm` suportando ajuste validado de `accountId`/`categoryId` e disparando notificação idempotente ao usuário ativo do membro (`SPECIFIC_USERS`, exclusão de `actor.sub`, `try/catch`) quando `source === MEMBER_PORTAL`
  - [x] Implementar `reject` (`APPROVE_ROLES`) exclusivo para `source === MEMBER_PORTAL && status === PENDING`, gravando `CANCELLED` + `rejectionReason` + `AuditLog` + notificação idempotente ao membro
- [x] Atualizar `apps/api/src/modules/financeiro/financeiro.controller.ts`:
  - [x] Adicionar `@Query('source')` em `GET /transactions`, `PATCH /transactions/:id/reject` e `GET /transactions/:id/receipt-url`
- [x] Expandir testes em `apps/api/src/modules/financeiro/financial-transactions.service.spec.ts` e `apps/api/src/modules/financeiro/financeiro.controller.spec.ts`:
  - [x] Cobrir Signed URL privada (sem vazamento de `receiptUrl`/`receiptKey` em nenhum método), `pendingMemberCount`/`pendingMemberAmount`, `confirm` com ajuste + notificação, `reject` com motivo obrigatório e bloqueios de integridade em `MEMBER_PORTAL`
- [x] Critério de validação da etapa: `npx jest src/modules/financeiro` e `npm.cmd run build -w apps/api` verdes.

### Etapa 4 - Autosserviço do Membro (`/api/minhas-contribuicoes`), Site Público e Revalidação (Backend)
Status: concluido

- [x] Criar guard `apps/api/src/common/guards/user-throttler.guard.ts` rastreando rate limit por `req.user?.sub ?? req.ip`
- [x] Criar DTO `apps/api/src/modules/financeiro/dto/create-member-contribution.dto.ts` (`categoryId`, `amount`, `date`, `payerName?`, `description?`)
- [x] Criar serviço `apps/api/src/modules/financeiro/contribuicoes.service.ts`:
  - [x] Implementar `getMemberPixInfo(tenantId, user, amount?)` validando membro no banco e retornando dados PIX, `brCode` calculado e categorias `INCOME` ativas com `visibleToMembers = true`
  - [x] Implementar `listMyContributions(tenantId, user, year?)` retornando envios próprios (`MEMBER_PORTAL` qualquer status) + lançamentos manuais confirmados da tesouraria (`TREASURY && CONFIRMED`) vinculados ao membro, totais anuais em centavos e anos disponíveis (inclusive em modo leitura se PIX estiver desativado)
  - [x] Implementar `createMyContribution(tenantId, user, dto, file, ip)` exigindo membro `ATIVO` (`deletedAt: null`) e PIX ativo com conta padrão ativa, validando categoria visível e comprovante (magic bytes), gravando no storage privado com rollback em falha de banco, criando `FinancialTransaction` (`INCOME`, `PENDING`, `PIX`, `MEMBER_PORTAL`, `payerName`, `receiptUrl: null`), gravando `AuditLog` e notificando `FINANCE_APPROVER`/`FINANCE_MANAGER` ativos (`urlDestino: '/financeiro?source=MEMBER_PORTAL&status=PENDING'`, chave idempotente, excluindo `user.sub`, guarda de lista vazia e `try/catch`)
  - [x] Implementar `deleteMyPendingContribution(tenantId, user, id, ip)` removendo atomicamente no banco apenas envio próprio `MEMBER_PORTAL + PENDING` antes de excluir o arquivo do storage e registrar `AuditLog`
  - [x] Implementar `getMyReceiptSignedUrl(tenantId, user, id)` validando estritamente `tenantId`, `memberId` do dono e visibilidade no histórico antes de gerar Signed URL (300s)
- [x] Criar controller `apps/api/src/modules/financeiro/contribuicoes.controller.ts` (`@Controller('minhas-contribuicoes')`) com `@UseGuards(UserThrottlerGuard)` + `@Throttle({ default: { ttl: 60_000, limit: 10 } })` no `POST` e registrar no `FinanceiroModule`
- [x] Criar testes unitários em `apps/api/src/modules/financeiro/contribuicoes.service.spec.ts` cobrindo isolamento por `memberId`/`tenantId`, membro inativo, privacidade de histórico (não vazar `DRAFT`/`PENDING`/`CANCELLED` da tesouraria), modo leitura com PIX desativado, criação + rollback de storage, exclusão atômica `PENDING`, Signed URL e notificações
- [x] Atualizar `apps/api/src/modules/website/website.service.ts` e `apps/api/src/modules/website/website.service.spec.ts`:
  - [x] Expor bloco `pix` em `getPublicSiteData` somente quando `TenantPixConfig.enabled && TenantPixConfig.showOnPublicSite`, sem vazar IDs/dados internos de conta
- [x] Atualizar `apps/web/src/app/api/site/revalidate/route.ts`:
  - [x] Permitir revalidação autenticada também para `FINANCE_MANAGER` (mesmo com `Role.BASIC`), validando permissão financeira via backend (`INTERNAL_API_URL || NEXT_PUBLIC_API_URL`) quando papel global não for `ADMIN`/`STAFF`
- [x] Critério de validação da etapa: `npx jest src/modules/financeiro src/modules/website` e `npm.cmd run build -w apps/api` passando 100%.

### Etapa 5 - Tesouraria: Configuração PIX, Telão QR Code, Conciliação e Modal de Comprovante Privado (Frontend ODS)
Status: concluido

- [x] Criar `apps/web/src/lib/pix-brcode.ts`:
  - [x] Espelhar validação/normalização, `formatPixKeyForDisplay` e geração pura de BRCode EMVCo no cliente para preview instantâneo na tesouraria, Telão, área do membro e site público
- [x] Criar `apps/web/src/components/app/financeiro/receipt-preview-modal.tsx`:
  - [x] Modal ODS reutilizável que busca a Signed URL sob demanda no endpoint informado, exibe imagem (`<img>`) ou PDF (`<iframe>`) inline com loading/erro/retry e botão "Abrir em nova aba / Baixar"
- [x] Atualizar `apps/web/src/app/(dashboard)/financeiro/financeiro-shared.tsx`:
  - [x] Adicionar tipos `PixKeyType`, `FinancialTransactionSource`, `TenantPixConfig`, `pendingMemberCount`/`pendingMemberAmount` em `FinancialSummary`, `visibleToMembers` em `FinancialCategory`, `source`/`rejectionReason`/`payerName`/`hasReceipt` em `FinancialTransaction`
  - [x] Adicionar filtro `source` em `FinanceiroQueryFilters`/`FinancialTransactionFilterState`/`FinanceiroTransactionFilterFields`/`buildTransactionsUrl` e incluir `payerName` em `matchTransactionSearch`
- [x] Atualizar `apps/web/src/app/(dashboard)/financeiro/financeiro-modals.tsx`:
  - [x] Adicionar checkbox *"Visível para membros (Dízimos e Ofertas)"* em `CategoryModal` para categorias `INCOME`
  - [x] Substituir referências a `transaction.receiptUrl` em `TransactionModal` por `transaction.hasReceipt` + abertura via `ReceiptPreviewModal` e proteger campos imutáveis em `MEMBER_PORTAL`
  - [x] Evoluir `TransactionConfirmModal` recebendo `accounts` e `categories` para ajuste opcional de conta/categoria na baixa e criar `RejectContributionModal` exigindo motivo (5–500 chars)
- [x] Criar `apps/web/src/components/app/financeiro/pix-config-modal.tsx` (`FINANCE_MANAGER`):
  - [x] Formulário ODS com tipo de chave, chave PIX, nome/cidade do recebedor, prefixo `txid` opcional, seleção de conta padrão ativa, toggles `enabled` e `showOnPublicSite`, alerta inline quando `visibleIncomeCategoriesCount === 0`, preview do BRCode/QR Code, atualização de `setUser` (`AuthUserContext`) para `pixEnabled` e disparo silencioso de `/api/site/revalidate`
- [x] Criar `apps/web/src/components/app/financeiro/pix-telao-modal.tsx` (`FINANCE_VIEWER`+):
  - [x] Projeção em tela cheia de alto contraste com logo da igreja, nome, QR Code grande gerado via `qrcode`, chave formatada e botão **"Baixar QR Code (PNG)"** renderizado em Canvas de alta resolução com `crossOrigin = 'anonymous'` e fallback automático caso o logo bloqueie CORS
- [x] Atualizar `apps/web/src/app/(dashboard)/financeiro/page.tsx`:
  - [x] Ler query params iniciais (`source`, `status`) para deep-link de notificações, migrar `editingTransaction?.hasReceipt` em `saveTransaction`, adicionar ações **"Configurar PIX"** (`canManage`) e **"Telão PIX"** (`summary?.role`), banner clicável de fila de conciliação (limpando datas e filtrando `MEMBER_PORTAL + PENDING`), exibição de `payerName`/`rejectionReason`/badge de origem, visualização via `ReceiptPreviewModal` e ações rápidas **Dar Baixa** / **Recusar**
- [x] Atualizar `apps/web/src/app/(dashboard)/financeiro/visualizacao/page.tsx`:
  - [x] Propagar `source` no `exportFilter` (paridade com IMP-010), substituir link direto `item.receiptUrl` por abertura via `ReceiptPreviewModal`, exibir `payerName` quando aplicável e refletir `pendingMemberCount` no subtexto de `A Receber`
- [x] Atualizar `apps/web/src/app/(dashboard)/financeiro/exportacao/page.tsx`:
  - [x] Substituir exportação de `receiptUrl` público no CSV por indicador seguro (`receiptFileName` ou `"Sim"` / `"Não"`) e incluir coluna de origem (`Tesouraria` / `Portal do Membro`) e `Titular no comprovante` (`payerName`)
- [x] Critério de validação da etapa: `npx -w apps/web tsc --noEmit` e `npm.cmd run build -w apps/web` sem erros; nenhuma referência a URL pública aberta de comprovante restante no módulo financeiro.

### Etapa 6 - Área do Membro (`/minhas-contribuicoes`, Sidebar, Painel Pessoal), i18n e Site Público (Frontend ODS)
Status: concluido

- [x] Atualizar `apps/web/src/types/index.ts`:
  - [x] Adicionar `pixEnabled?: boolean` em `AuthUser['tenant']`
- [x] Atualizar `apps/web/src/middleware.ts`:
  - [x] Incluir `pathname.startsWith('/minhas-contribuicoes')` na lista de redirecionamento de domínio customizado para o `canonicalAppOrigin`
- [x] Atualizar traduções em `apps/web/messages/pt-BR.json`, `apps/web/messages/pt-PT.json` e `apps/web/messages/en-US.json`:
  - [x] Adicionar chaves de `nav` (`contributions`) e `dashboardPersonal` (`quickLinks.contributions` / `leader.quickLinks.contributions`) nos 3 locales
- [x] Atualizar `apps/web/src/components/app/sidebar.tsx` e `apps/web/src/components/app/header.tsx`:
  - [x] Exibir item **"Contribuições"** (`/minhas-contribuicoes`) para usuários com `user?.membro?.id && user?.tenant?.pixEnabled` (e registrar título da página em `header.tsx` e `EXACT_ROOTS`)
- [x] Atualizar `apps/web/src/app/(dashboard)/personal-panel/page.tsx`:
  - [x] Adicionar atalho de acesso rápido para **"Dízimos e Ofertas"** (`/minhas-contribuicoes`) quando `user?.membro?.id && user?.tenant?.pixEnabled`
- [x] Criar `apps/web/src/app/(dashboard)/minhas-contribuicoes/page.tsx`:
  - [x] Tratar `EmptyState` amigável para usuários sem `membro` vinculado e aviso quando PIX estiver ativo sem categorias curadas
  - [x] Implementar card PIX mobile-first (QR Code via `qrcode`, valor opcional recalculado localmente, chave formatada e botão 1-toque **"Copiar código PIX"**) ocultado quando `enabled === false`
  - [x] Implementar modal ODS **"Enviar Comprovante"** (categoria curada, valor, data, titular alternativo opcional `payerName`, upload câmera/galeria/PDF até 10 MB, observação, bloqueio anti-duplo clique)
  - [x] Implementar histórico anual privado com seletor de ano, cards de resumo (*Total confirmado no ano* + *Em análise*), visualização de comprovante via `ReceiptPreviewModal` (`/api/minhas-contribuicoes/:id/receipt-url`), exibição de `rejectionReason` com botão *"Enviar novamente"* pré-preenchido e botão cancelar/remover com `ConfirmDialog` enquanto `PENDING`
- [x] Atualizar `apps/web/src/lib/api-website.ts` adicionando `pix` opcional em `PublicSiteData`
- [x] Criar `apps/web/src/components/public-site/site-giving-section.tsx` e integrar em `apps/web/src/app/[slug]/page.tsx` e `apps/web/src/components/public-site/site-header.tsx`:
  - [x] Renderizar âncora discreta **"Contribuir"** (`#contribuir`) no `SiteHeader` (desktop + mobile) e seção editorial `SiteGivingSection` respeitando os tokens dinâmicos da igreja (`FT-022`) somente quando `site.pix` estiver presente, com QR Code, chave formatada, Copia-e-Cola e CTA compatível com domínio customizado (`${membersLoginHref}&redirect=%2Fminhas-contribuicoes`)
- [x] Critério de validação da etapa: `npx -w apps/web tsc --noEmit` e `npm.cmd run build -w apps/web` passando sem erros; validação visual desktop e mobile (`390x844`) de `/minhas-contribuicoes`, `/personal-panel` e `/[slug]`.

### Etapa 7 - Validação Integrada, Segurança LGPD e Documentação Final
Status: concluido

- [x] Executar bateria completa de testes backend (`npm.cmd test -w apps/api`)
- [x] Executar typecheck (`npx -w apps/web tsc --noEmit`) e builds de produção (`npm.cmd run build -w apps/api` e `npm.cmd run build -w apps/web`)
- [x] Validar ponta a ponta em ambiente real (API + Web + Postgres local, desktop e mobile `390x844`):
  - [x] Configuração PIX pela tesouraria (`FINANCE_MANAGER`), proteção contra inativação da conta padrão (`PATCH` e `DELETE`), validação de chave/BRCode e download do QR Code PNG no Modo Telão
  - [x] Envio de comprovante pelo membro, rate limit por usuário, notificação recebida pela tesouraria (com deep-link), visualização via modal inline + Signed URL temporária, confirmação (com ajuste opcional de conta/categoria) e recusa com motivo + reenvio
  - [x] Isolamento de segurança: confirmar que API nunca retorna `receiptUrl`/`receiptKey`, membro A não acessa comprovante do membro B (`404`/`403`), membro inativo não envia comprovante e `ADMIN` sem `FinancePermission` não acessa endpoints financeiros (`403`)
  - [x] Exibição condicional de `SiteGivingSection` e âncora "Contribuir" em `/[slug]` conforme toggle `showOnPublicSite`
- [x] Atualizar `ai-context/backlog/dizimos-ofertas-pix-comprovantes.md` marcando status concluído
- [x] Atualizar `ai-context/backlog/README.md` marcando `FT-021` como implementado
- [x] Atualizar `ai-context/plans/dizimos-ofertas-pix-comprovantes-plan.md` marcando checkboxes e `Status geral: concluido`
- [x] Atualizar `ai-context/plans/README.md` refletindo a conclusão da `FT-021`
- [x] Critério de validação da etapa: Builds e testes verdes em `apps/api` e `apps/web`, checklist de segurança LGPD/RBAC validado e documentação sincronizada.

---

## 5. Critérios de Aceite Gerais

- [x] A tesouraria (`FINANCE_MANAGER`) configura chave PIX validada, conta padrão protegida contra inativação (`PATCH` e `DELETE`), categorias `INCOME` visíveis ao membro e toggles `enabled` / `showOnPublicSite` (com revalidação funcionando mesmo para `FINANCE_MANAGER` com `Role.BASIC`).
- [x] O BRCode EMVCo gerado passa em validação de formato/dígitos verificadores, normalização ASCII, fallback `'***'` no `txid` e CRC-16, com ou sem valor informado.
- [x] O Modo Telão exibe logo, chave formatada e QR Code nítido em tela cheia e permite download em PNG gerado no navegador via `qrcode` + Canvas (com fallback seguro de CORS).
- [x] Membros ativos vinculados acessam `/minhas-contribuicoes` (slug reservado em web/api e suportado em domínio customizado), copiam o PIX, enviam comprovante validado por magic bytes com titular alternativo opcional (protegido por `UserThrottlerGuard`), acompanham seu histórico anual privado (inclusive em modo leitura se PIX for desativado) e podem excluir envios próprios ainda em `PENDING`.
- [x] Comprovantes entram como `FinancialTransaction` (`INCOME`, `PENDING`, `PIX`, `MEMBER_PORTAL`), aparecem separados em `pendingMemberCount`/`pendingMemberAmount` globais no resumo e passam por confirmação (com ajuste opcional) ou recusa com motivo obrigatório, disparando notificações In-App + Push idempotentes nos 3 gatilhos (sem auto-notificar o autor).
- [x] O bucket `financial-receipts` é privado (`public = false`), `createPrivateSignedUrl` nunca retorna URL pública, 100% dos endpoints omitem `receiptUrl`/`receiptKey`, todas as telas usam o Modal Inline via Signed URL, o CSV não expõe URL aberta e `ADMIN` sem `FinancePermission` permanece bloqueado (`403`).
- [x] O site público (`/[slug]`) exibe a âncora **"Contribuir"** no `SiteHeader` e a `SiteGivingSection` apenas quando `enabled && showOnPublicSite`, respeitando o tema dinâmico do tenant (`FT-022`) e domínios customizados.
