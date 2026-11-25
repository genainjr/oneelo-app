# Backlog - Dízimos e Ofertas Digitais (PIX, Comprovantes e Conciliação)

### FT-021 Arrecadação Digital de Dízimos e Ofertas (PIX QR Code, Comprovantes do Membro e Conciliação na Tesouraria)

- **Prioridade**: alta (sustentabilidade financeira, profissionalização da tesouraria e transparência ao membro)
- **Status**: concluído (implementado e validado — ver [dizimos-ofertas-pix-comprovantes-plan.md](../plans/dizimos-ofertas-pix-comprovantes-plan.md))
- **Fase**: expansão do módulo financeiro, autosserviço do membro e portal público
- **Categoria**: produto / financeiro / autosserviço / conciliação / LGPD
- **Esforço estimado**: médio

---

## 1. Contexto e Dor Resolvida

Hoje, a maior parte dos dízimos e ofertas nas igrejas acontece via PIX diretamente para a conta bancária da comunidade, mas o processo operacional ainda é desorganizado:
1. O membro faz o PIX e envia o "print" do comprovante no WhatsApp pessoal do pastor ou do tesoureiro no domingo à noite.
2. O tesoureiro precisa garimpar mensagens soltas, identificar quem enviou (muitas vezes a conta bancária está no nome do cônjuge) e digitar tudo manualmente no Financeiro.
3. O membro não tem um histórico privado organizado das suas contribuições do ano para controle pessoal ou declaração anual.
4. A igreja não possui um gerador padronizado de QR Code / Copia-e-Cola PIX para exibir no telão do culto, no Painel Pessoal ou no Site Institucional (`/[slug]`).

---

## 2. Decisões de Produto e Arquitetura Fechadas

1. **Chave PIX Principal (MVP):**
   - **1 chave PIX principal por igreja**, vinculada a uma conta financeira ativa padrão (`FinancialAccount`, ex.: Banco / Conta PIX).
   - Padrão oficial **BRCode / EMVCo (PIX Estático do Banco Central)** — funciona com qualquer banco brasileiro com **0% de taxa** (sem gateway intermediário), gerando QR Code + código Copia-e-Cola com suporte a valor opcional informado pelo membro antes de copiar.
   - Validação rigorosa de chave por tipo (`CPF`/`CNPJ` com dígitos verificadores, `PHONE` em `+55...`, `EMAIL` válido, `EVP` UUID v4), remoção de acentos em `merchantName`/`merchantCity` e emissão obrigatória de `***` no campo `62.05` (`txid`) quando vazio (exigência de compatibilidade bancária).
   - Integridade referencial na tesouraria: bloquear inativação da `FinancialAccount` definida como `defaultAccountId` enquanto o PIX estiver ativo (`enabled = true`), e resetar `visibleToMembers = false` automaticamente caso uma categoria seja alterada de `INCOME` para `EXPENSE`.
   - Estrutura preparada para evoluir futuramente para múltiplas chaves por finalidade caso necessário.

2. **Disponibilização do QR Code e Copia-e-Cola nos 3 Canais:**
   - **Área Logada do Membro:** Painel Pessoal (`/personal-panel`) e página dedicada `/minhas-contribuicoes` *(slug reservado tanto no frontend quanto no backend; exibidos na navegação via flag `tenant.pixEnabled` em `GET /api/auth/me` sem chamadas extras quando o usuário possuir `Membro` vinculado — mantendo o histórico em modo leitura se o PIX for desativado posteriormente)*.
   - **Modo Projeção / Telão de Culto:** Tela/modal em tela cheia dentro de `/financeiro` com alto contraste, logo da igreja, QR Code grande, chave formatada e botão **"Baixar QR Code (PNG)"** renderizado via `qrcode` + Canvas no cliente (sem carga de Chromium no servidor).
   - **Site Institucional Público (`/[slug]`):** Nova seção editorial opcional de Dízimos e Ofertas controlada por **toggle explícito** (`showOnPublicSite`) nas configurações da tesouraria, respeitando o tema dinâmico da igreja (`FT-022`), com suporte à revalidação do site por `FINANCE_MANAGER` (inclusive quando seu papel global for `Role.BASIC`) e fallback seguro via ISR.

3. **Entrada no Financeiro como "Contas a Receber" (`FinancialTransaction`):**
   - Comprovantes enviados por membros criam diretamente uma `FinancialTransaction` (`type: INCOME`, `status: PENDING`, `paymentMethod: PIX`, `memberId: user.memberId`, `source: MEMBER_PORTAL`), vinculada à conta padrão da configuração PIX e à categoria escolhida pelo membro, com campo opcional de **nome do titular/pagador alternativo** (`payerName`, ex.: conta do cônjuge) para facilitar conferência e futura conciliação OFX (`FT-023`).
   - O resumo da tesouraria (`getSummary`) expõe separadamente `pendingMemberCount` e `pendingMemberAmount` (além de `pendingIncome`), evitando que eventuais erros de digitação de membros distorçam silenciosamente a leitura de contas a receber da tesouraria antes da conferência.
   - Assim o lançamento **já aparece na fila de conciliação (`PENDING`)** na tesouraria, alimenta o fluxo de baixa (`PATCH /transactions/:id/confirm`) e nasce pronto para conciliação futura via extrato bancário (`FT-023`).

4. **Categorias Curadas pela Tesouraria (`visibleToMembers`):**
   - Em `FinancialCategory` (`type = INCOME`), a tesouraria marca explicitamente quais categorias ficam visíveis para seleção do membro (ex.: *Dízimos*, *Ofertas*, *Missões*), ocultando categorias internas da igreja (ex.: *Aluguel de espaço*, *Estornos*, *Rendimentos*).

5. **Histórico Completo e Privado do Membro ("Minhas Contribuições"):**
   - Exibe:
     - **Todos os envios feitos pelo próprio membro** (`source = MEMBER_PORTAL`) em qualquer status: `Em análise` (`PENDING`), `Confirmado` (`CONFIRMED`) ou `Recusado` (`CANCELLED` com `rejectionReason` exibido + botão *"Enviar novamente"* criando um novo lançamento preservando a auditoria do recusado);
     - **Contribuições confirmadas lançadas manualmente pela tesouraria** vinculadas ao `memberId` dele (`source = TREASURY` e `status = CONFIRMED`, ex.: entrega em envelope no culto).
   - **Nunca** expõe lançamentos internos da tesouraria em `DRAFT`, `PENDING` ou `CANCELLED` que não tenham sido enviados pelo próprio membro.
   - Enquanto um envio próprio estiver `PENDING`, o membro pode cancelá-lo/removê-lo antes da conferência da tesouraria; após `CONFIRMED`, torna-se imutável para auditoria.

6. **Sigilo Financeiro e LGPD nos Comprovantes (Ponto Crítico de Segurança):**
   - Alterar o bucket `financial-receipts` para **privado (`public = false`)** na infraestrutura (`infra/supabase/storage/main.tf`) e introduzir métodos estritos `uploadPrivateObject` e `createPrivateSignedUrl` em `SupabaseStorageService` (**sem fallback silencioso para `getPublicUrl`** em caso de erro).
   - Servir comprovantes exclusivamente via **Signed URL temporária** (TTL curto, ex.: 300s) por endpoints autenticados:
     - Tesouraria (`GET /api/financeiro/transactions/:id/receipt-url`): exige `FinanceAuthorizationService.ensureCanAccessFinanceData` + `tenantId`;
     - Membro (`GET /api/minhas-contribuicoes/:id/receipt-url`): exige `transaction.tenantId === user.tenantId` e `transaction.memberId === user.memberId`.
   - Deixar de expor `receiptUrl` público aberto no payload das transações e em todos os 4 pontos da UI (`financeiro/page.tsx`, `visualizacao/page.tsx`, `financeiro-modals.tsx` e exportação CSV `exportacao/page.tsx`, onde o CSV passa a exportar apenas indicador `"Sim"/"Não"` ou `receiptFileName`).
   - **`ADMIN` global sem `FinancePermission`** continua sem acesso aos dados financeiros/comprovantes de outros membros (preservando a regra fechada da FT-014).

---

## 3. Modelagem de Dados Prevista (Prisma)

- **Novos Enums (`apps/api/prisma/schema.prisma`):**
  - `PixKeyType`: `CPF | CNPJ | EMAIL | PHONE | EVP`
  - `FinancialTransactionSource`: `TREASURY | MEMBER_PORTAL`
- **Novo Modelo `TenantPixConfig` (`tb_tenant_pix_config`):**
  - `id`, `tenantId @unique`, `enabled` (`Boolean @default(false)`), `showOnPublicSite` (`Boolean @default(false)`), `pixKeyType`, `pixKey`, `merchantName` (máx. 25 chars sem acento), `merchantCity` (máx. 15 chars sem acento — sugerida de `TenantWebsiteConfig.cidade`), `txidPrefix?` (máx. 25 alfanuméricos), `defaultAccountId` (FK `FinancialAccount`), `updatedByUserId?`, `createdAt`, `updatedAt`.
- **Evolução em `FinancialCategory` (`tb_financial_category`):**
  - `visibleToMembers: Boolean @default(false) @map("visible_to_members")`.
- **Evolução em `FinancialTransaction` (`tb_financial_transaction`):**
  - `source: FinancialTransactionSource @default(TREASURY) @map("source")`;
  - `rejectionReason: String? @map("rejection_reason")`;
  - `payerName: String? @map("payer_name")` *(titular alternativo no comprovante PIX, ex.: cônjuge)*;
  - Índices adicionais: `@@index([tenantId, memberId, date])` e `@@index([tenantId, source, status])`.

---

## 4. Endpoints e Regras de Backend (`apps/api/src/modules/financeiro/`)

### 4.1. Gerador BRCode EMVCo (`pix-brcode.util.ts`)
- Função pura validada por testes unitários: valida e normaliza chave por tipo (`CPF`/`CNPJ` com dígitos verificadores, `PHONE` `+55...`, `EMAIL` minúsculo, `EVP` UUID v4), remove acentos de `merchantName`/`merchantCity`, emite `***` no campo `62.05` quando sem `txidPrefix`, injeta campo `54` quando houver valor opcional e calcula `CRC-16/CCITT-FALSE` (`0x1021`, init `0xFFFF`).

### 4.2. Gestão na Tesouraria (`FinanceiroController`)
- `GET /api/financeiro/pix-config` (`FINANCE_VIEWER`+): retorna configuração atual e payload BRCode padrão.
- `PUT /api/financeiro/pix-config` (`FINANCE_MANAGER` + `AuditLog`): salva/atualiza chave PIX validada, exige `defaultAccountId` ativa no tenant e atualiza toggles `enabled` e `showOnPublicSite` (acionando revalidação compatível com `FINANCE_MANAGER` + fallback ISR).
- `PATCH /api/financeiro/categories/:id`: suportar `visibleToMembers` (validando `type === INCOME` e resetando para `false` se mudar para `EXPENSE`).
- `DELETE /api/financeiro/accounts/:id`: impedir inativação de conta vinculada a `TenantPixConfig.defaultAccountId` enquanto `enabled === true`.
- `PATCH /api/financeiro/transactions/:id`: impedir que `FINANCE_OPERATOR` confirme ou altere `memberId` de um lançamento `source === MEMBER_PORTAL` fora do fluxo formal de conciliação.
- `PATCH /api/financeiro/transactions/:id/confirm`: evoluir para permitir ajuste opcional de `accountId`/`categoryId` (além dos já existentes `amount`, `paidAt`, `paymentMethod`) na conferência e disparar notificação ao membro quando `source === MEMBER_PORTAL`.
- `PATCH /api/financeiro/transactions/:id/reject`: restrito a `FINANCE_APPROVER`/`FINANCE_MANAGER`, exclusivo para `source === MEMBER_PORTAL && status === PENDING`, exige `rejectionReason` (mín. 5 chars), registra `AuditLog`, marca como `CANCELLED` e notifica o membro.
- `GET /api/financeiro/transactions/:id/receipt-url`: gera Signed URL temporária privada protegida por `FinancePermission`.

### 4.3. Autosserviço do Membro (`ContribuicoesController` — autenticado para qualquer `Role` com `user.memberId`)
- `GET /api/minhas-contribuicoes/pix?amount=...`: retorna `{ enabled, pixKeyType, pixKey, merchantName, merchantCity, brCode, categories }` apenas com categorias `INCOME` ativas e `visibleToMembers = true`.
- `GET /api/minhas-contribuicoes?year=2026`: retorna histórico filtrado por ano do `memberId` logado (`source = MEMBER_PORTAL` em qualquer status + `source = TREASURY` com `status = CONFIRMED`), totais anuais (`confirmedTotal`, `confirmedCount`, `pendingCount`), funcionando em modo leitura mesmo se `enabled === false`.
- `POST /api/minhas-contribuicoes` (`multipart/form-data`, com `@Throttle` anti-abuso/duplo clique): valida `TenantPixConfig.enabled`, `categoryId` (`INCOME` + `active` + `visibleToMembers`), `amount > 0`, `date`, `payerName?`, arquivo obrigatório via `validateFinancialReceiptUpload` (JPG/PNG/WEBP/PDF até 10 MB), salva no storage privado, cria `FinancialTransaction` (`INCOME`, `PENDING`, `PIX`, `source = MEMBER_PORTAL`), grava `AuditLog` e notifica usuários ativos com `FINANCE_APPROVER`/`FINANCE_MANAGER` (excluindo o próprio `actor.sub`).
- `DELETE /api/minhas-contribuicoes/:id`: permite ao membro cancelar/excluir atomicamente apenas envio próprio com `source === MEMBER_PORTAL` e `status === PENDING`, removendo o anexo do storage e registrando auditoria.
- `GET /api/minhas-contribuicoes/:id/receipt-url`: gera Signed URL temporária privada estritamente para o dono (`memberId === user.memberId`).

### 4.4. Portal Público (`WebsiteService`) e Sessão (`AuthService`)
- Em `GET /api/public/site/:slug`: incluir bloco `pix` (`{ pixKeyType, pixKey, merchantName, merchantCity, brCode }`) somente quando `TenantPixConfig.enabled && TenantPixConfig.showOnPublicSite`, sem expor dados internos de conta financeira.
- Em `GET /api/auth/me`: incluir `pixEnabled: boolean` no objeto `tenant` para exibição instantânea no menu sem chamadas extras.

---

## 5. Experiência Frontend (Desktop & Mobile — ODS)

1. **Tesouraria (`/financeiro`, `/financeiro/visualizacao` e `/financeiro/exportacao`):**
   - Ações no topo: **"Configurar PIX"** (`FINANCE_MANAGER`) e **"Telão PIX / QR Code"** (`FINANCE_VIEWER`+ — modal/tela cheia para projeção dominical com botão *"Baixar QR Code PNG"* gerado via `qrcode` + Canvas).
   - Modal de Categoria (`CategoryModal`): checkbox *"Visível para membros (Dízimos e Ofertas)"* em categorias de entrada.
   - Fila de Conciliação: banner/badge clicável *"X comprovante(s) de membros aguardando conferência"* filtrando `source = MEMBER_PORTAL` & `status = PENDING`, exibindo `payerName` quando houver, visualização do comprovante via Signed URL sob demanda, **"Confirmar (Dar Baixa)"** (com ajuste opcional de valor/conta/categoria) e **"Recusar com motivo"**.
   - Atualizar todos os 4 pontos de comprovante (`financeiro/page.tsx`, `visualizacao/page.tsx`, `financeiro-modals.tsx` e `exportacao/page.tsx`) para eliminar links para URL pública aberta.
2. **Área do Membro (`/personal-panel`, Sidebar e `/minhas-contribuicoes`):**
   - Entrada condicional na sidebar e no Painel Pessoal (*"Dízimos e Ofertas"* / *"Contribuições"*) exibida via `user?.tenant?.pixEnabled` quando `user?.membro?.id` existir (mantendo `/minhas-contribuicoes` acessível em modo leitura para histórico caso o PIX seja desativado depois).
   - Tela mobile-first `/minhas-contribuicoes`:
     - Card PIX com QR Code (`qrcode` local), campo de valor opcional para recalcular Copia-e-Cola instantaneamente sem chamada extra e botão 1-toque **"Copiar código PIX"**;
     - Botão **"Enviar Comprovante"** abrindo modal ODS (categoria, valor, data, titular alternativo opcional, upload via câmera/galeria/PDF, observação);
     - Histórico anual com filtro de ano, resumo (*Total confirmado no ano* + *Em análise*), visualização segura do comprovante via Signed URL, motivo visível em caso de recusa (com atalho *"Enviar novamente"* pré-preenchido) e exclusão enquanto `PENDING`.
3. **Site Institucional Público (`/[slug]`):**
   - Componente `SiteGivingSection` seguindo a estética editorial do portal e os tokens dinâmicos da igreja (`FT-022`), exibindo QR Code, chave, Copia-e-Cola e atalho *"Já é membro? Envie seu comprovante na Área de Membros"* (`/login?igreja=[slug]&redirect=/minhas-contribuicoes`).

---

## 6. Notificações (via `NotificationDispatchService` + `NotificationsModule` no `FinanceiroModule`)

- Usar `NotificationAudienceType.SPECIFIC_USERS` e `NotificationOrigin.SYSTEM_AUTOMATION`, com retorno antecipado caso a lista final de destinatários seja vazia, exclusão do próprio autor (`actor.sub`) e isolamento em `try/catch`:
  - **Envio de comprovante pelo membro:** In-App + Push para usuários ativos com `FINANCE_APPROVER` ou `FINANCE_MANAGER` (`urlDestino: '/financeiro'`).
  - **Confirmação pela tesouraria:** In-App + Push para o usuário do membro confirmando o registro (`urlDestino: '/minhas-contribuicoes'`).
  - **Recusa pela tesouraria:** In-App + Push para o usuário do membro informando o `rejectionReason` (`urlDestino: '/minhas-contribuicoes'`).

---

## 7. Critérios de Aceite para o Plano

- [x] A tesouraria (`FINANCE_MANAGER`) consegue cadastrar/editar a chave PIX validada da igreja, escolher a conta padrão (protegida contra inativação enquanto ativa), definir categorias de entrada visíveis ao membro e ligar/desligar exibição no app e no site público (com revalidação funcionando mesmo para `FINANCE_MANAGER` com `Role.BASIC`).
- [x] O BRCode gerado é válido no padrão EMVCo/Banco Central (CPF/CNPJ com dígitos verificadores, `***` quando sem `txid`, sem acentos, CRC-16) tanto sem valor quanto com valor preenchido.
- [x] O **Modo Projeção / Telão** exibe logo da igreja, QR Code nítido e chave legível em tela cheia e gera download em PNG de alta resolução via Canvas no cliente.
- [x] O site público (`/[slug]`) exibe a seção de Dízimos e Ofertas apenas quando `enabled && showOnPublicSite` estiver ativo.
- [x] Membros vinculados conseguem enviar comprovante (JPG/PNG/WEBP/PDF até 10 MB, com titular alternativo opcional e rate limit), visualizar seu histórico completo (envios próprios + contribuições confirmadas pela tesouraria no nome deles, inclusive em modo leitura se PIX for desativado) e cancelar envios próprios ainda em `PENDING`.
- [x] Comprovantes enviados entram em `/financeiro` como `PENDING` (`source = MEMBER_PORTAL`), destacados separadamente no resumo (`pendingMemberCount`/`pendingMemberAmount`), com fila rápida, visualização via Signed URL privada, confirmação com ajuste opcional e recusa com motivo obrigatório.
- [x] O bucket `financial-receipts` é privado (`public = false`), `createPrivateSignedUrl` nunca faz fallback para URL pública, nenhuma tela/CSV expõe `receiptUrl` público e nenhum usuário sem permissão financeira (inclusive `ADMIN` sem `FinancePermission`) acessa dados de outros membros.
- [x] Notificações In-App + Push disparam nos 3 gatilhos (novo comprovante → tesouraria; confirmado/recusado → membro) sem duplicar para o autor e sem quebrar o fluxo principal em caso de erro de push.

---

## Impacto

Elimina o fluxo informal de comprovantes pelo WhatsApp pessoal, profissionaliza a arrecadação da igreja nos 3 canais (telão, site e app), assegura conformidade LGPD real nos comprovantes e prepara a base direta para conciliação automática com extratos bancários na [FT-023](importacao-extrato-bancario.md).
