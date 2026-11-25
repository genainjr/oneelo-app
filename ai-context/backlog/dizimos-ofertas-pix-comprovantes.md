# Backlog - Dízimos e Ofertas Digitais (PIX, Comprovantes e Conciliação)

### FT-021 Arrecadação Digital de Dízimos e Ofertas (PIX QR Code, Comprovantes do Membro e Conciliação na Tesouraria)

- **Prioridade**: alta (sustentabilidade financeira, profissionalização da tesouraria e transparência ao membro)
- **Status**: pendente (escopo funcional, arquitetural e de segurança fechado — pronto para geração do plano)
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
   - Estrutura preparada para evoluir futuramente para múltiplas chaves por finalidade caso necessário.

2. **Disponibilização do QR Code e Copia-e-Cola nos 3 Canais:**
   - **Área Logada do Membro:** Painel Pessoal (`/personal-panel`) e página dedicada `/minhas-contribuicoes` *(exibidos apenas quando a igreja ativar o PIX/contribuições E o usuário possuir `Membro` vinculado — mesmo critério da FT-020)*.
   - **Modo Projeção / Telão de Culto:** Tela/modal em tela cheia dentro de `/financeiro` com alto contraste, logo da igreja, QR Code grande, chave formatada e botão **"Baixar QR Code (PNG)"** para slides e folhetos.
   - **Site Institucional Público (`/[slug]`):** Nova seção editorial opcional de Dízimos e Ofertas controlada por **toggle explícito** (`showOnPublicSite`) nas configurações da tesouraria, respeitando o tema dinâmico da igreja (`FT-022`).

3. **Entrada no Financeiro como "Contas a Receber" (`FinancialTransaction`):**
   - Comprovantes enviados por membros criam diretamente uma `FinancialTransaction` (`type: INCOME`, `status: PENDING`, `paymentMethod: PIX`, `memberId: user.memberId`, `source: MEMBER_PORTAL`), vinculada à conta padrão da configuração PIX e à categoria escolhida pelo membro.
   - Assim o lançamento **já aparece como Contas a Receber (`PENDING`)** na tesouraria, alimenta o fluxo de baixa (`PATCH /transactions/:id/confirm`) e nasce pronto para conciliação futura via extrato bancário (`FT-023`).

4. **Categorias Curadas pela Tesouraria (`visibleToMembers`):**
   - Em `FinancialCategory` (`type = INCOME`), a tesouraria marca explicitamente quais categorias ficam visíveis para seleção do membro (ex.: *Dízimos*, *Ofertas*, *Missões*), ocultando categorias internas da igreja (ex.: *Aluguel de espaço*, *Estornos*, *Rendimentos*).

5. **Histórico Completo e Privado do Membro ("Minhas Contribuições"):**
   - Exibe:
     - **Todos os envios feitos pelo próprio membro** (`source = MEMBER_PORTAL`) em qualquer status: `Em análise` (`PENDING`), `Confirmado` (`CONFIRMED`) ou `Recusado` (`CANCELLED` com `rejectionReason` exibido + botão *"Enviar novamente"*);
     - **Contribuições confirmadas lançadas manualmente pela tesouraria** vinculadas ao `memberId` dele (`source = TREASURY` e `status = CONFIRMED`, ex.: entrega em envelope no culto).
   - **Nunca** expõe lançamentos internos da tesouraria em `DRAFT`, `PENDING` ou `CANCELLED` que não tenham sido enviados pelo próprio membro.
   - Enquanto um envio próprio estiver `PENDING`, o membro pode cancelá-lo/removê-lo antes da conferência da tesouraria; após `CONFIRMED`, torna-se imutável para auditoria.

6. **Sigilo Financeiro e LGPD nos Comprovantes (Ponto Crítico de Segurança):**
   - Atualmente, `FinancialTransactionsService.uploadReceipt` grava em `financial-receipts` via `uploadPublicObject` (URL pública permanente).
   - Como comprovantes bancários de dízimo contêm nome completo, CPF, conta bancária e valores sensíveis, a FT-021 deve garantir **acesso privado via Signed URL temporária** (`SupabaseStorageService.createSignedUrl`, TTL curto ex.: 300s) servida por endpoints autenticados:
     - Tesouraria (`GET /api/financeiro/transactions/:id/receipt-url`): exige `FinanceAuthorizationService.ensureCanAccessFinanceData` + `tenantId`;
     - Membro (`GET /api/minhas-contribuicoes/:id/receipt-url`): exige `transaction.tenantId === user.tenantId` e `transaction.memberId === user.memberId`.
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
  - Índices adicionais: `@@index([tenantId, memberId, date])` e `@@index([tenantId, source, status])`.

---

## 4. Endpoints e Regras de Backend (`apps/api/src/modules/financeiro/`)

### 4.1. Gerador BRCode EMVCo (`pix-brcode.util.ts`)
- Função pura validada por testes unitários: normaliza chave por tipo (`CPF`/`CNPJ` dígitos, `PHONE` `+55...`, `EMAIL` minúsculo, `EVP` UUID), remove acentos de `merchantName`/`merchantCity`, injeta campo `54` quando houver valor opcional e calcula `CRC-16/CCITT-FALSE` (`0x1021`, init `0xFFFF`).

### 4.2. Gestão na Tesouraria (`FinanceiroController`)
- `GET /api/financeiro/pix-config` (`FINANCE_VIEWER`+): retorna configuração atual e payload BRCode padrão.
- `PUT /api/financeiro/pix-config` (`FINANCE_MANAGER` + `AuditLog`): salva/atualiza chave PIX, valida `defaultAccountId` ativa no tenant e atualiza toggles `enabled` e `showOnPublicSite` (acionando revalidação do site público quando alterado).
- `PATCH /api/financeiro/categories/:id`: suportar `visibleToMembers` (validando `type === INCOME`).
- `PATCH /api/financeiro/transactions/:id/confirm`: evoluir para permitir ajuste opcional de `accountId`/`categoryId` (além dos já existentes `amount`, `paidAt`, `paymentMethod`) na conferência e disparar notificação ao membro quando `source === MEMBER_PORTAL`.
- `PATCH /api/financeiro/transactions/:id/reject` *(ou extensão de `cancel`)*: restrito a `FINANCE_APPROVER`/`FINANCE_MANAGER`, exige `rejectionReason`, registra `AuditLog`, marca como `CANCELLED` (sem entrar no saldo) e notifica o membro.
- `GET /api/financeiro/transactions/:id/receipt-url`: gera Signed URL temporária protegida por `FinancePermission`.

### 4.3. Autosserviço do Membro (`ContribuicoesController` — autenticado para qualquer `Role` com `user.memberId`)
- `GET /api/minhas-contribuicoes/pix?amount=...`: retorna `{ enabled, pixKeyType, pixKey, merchantName, merchantCity, brCode, categories }` apenas com categorias `INCOME` ativas e `visibleToMembers = true`.
- `GET /api/minhas-contribuicoes?year=2026`: retorna histórico filtrado por ano do `memberId` logado (`source = MEMBER_PORTAL` em qualquer status + `source = TREASURY` com `status = CONFIRMED`), totais anuais (`confirmedTotal`, `confirmedCount`, `pendingCount`).
- `POST /api/minhas-contribuicoes` (`multipart/form-data`): valida `categoryId` (`INCOME` + `active` + `visibleToMembers`), `amount > 0`, `date`, arquivo obrigatório via `validateFinancialReceiptUpload` (JPG/PNG/WEBP/PDF até 10 MB), salva no storage privado, cria `FinancialTransaction` (`INCOME`, `PENDING`, `PIX`, `source = MEMBER_PORTAL`), grava `AuditLog` e notifica usuários ativos com `FINANCE_APPROVER`/`FINANCE_MANAGER`.
- `DELETE /api/minhas-contribuicoes/:id`: permite ao membro cancelar/excluir apenas envio próprio com `source === MEMBER_PORTAL` e `status === PENDING`, removendo o anexo do storage e registrando auditoria.
- `GET /api/minhas-contribuicoes/:id/receipt-url`: gera Signed URL temporária estritamente para o dono (`memberId === user.memberId`).

### 4.4. Portal Público (`WebsiteService`)
- Em `GET /api/public/site/:slug`: incluir bloco `pix` (`{ pixKeyType, pixKey, merchantName, merchantCity, brCode }`) somente quando `TenantPixConfig.enabled && TenantPixConfig.showOnPublicSite`, sem expor dados internos de conta financeira.

---

## 5. Experiência Frontend (Desktop & Mobile — ODS)

1. **Tesouraria (`/financeiro`):**
   - Ações no topo: **"Configurar PIX"** (`FINANCE_MANAGER`) e **"Telão PIX / QR Code"** (`FINANCE_VIEWER`+ — modal/tela cheia para projeção dominical com botão *"Baixar QR Code PNG"*).
   - Modal de Categoria (`CategoryModal`): checkbox *"Visível para membros (Dízimos e Ofertas)"* em categorias de entrada.
   - Fila de Conciliação: banner/badge clicável *"X comprovante(s) de membros aguardando conferência"* filtrando `source = MEMBER_PORTAL` & `status = PENDING`, com visualização do comprovante via Signed URL, **"Confirmar (Dar Baixa)"** (com ajuste opcional de valor/conta/categoria) e **"Recusar com motivo"**.
2. **Área do Membro (`/personal-panel`, Sidebar e `/minhas-contribuicoes`):**
   - Entrada condicional na sidebar e no Painel Pessoal (*"Dízimos e Ofertas"* / *"Contribuições"*) exibida apenas quando `user?.membro?.id` existe **e** a igreja habilitou contribuições digitais.
   - Tela mobile-first `/minhas-contribuicoes`:
     - Card PIX com QR Code, campo de valor opcional para recalcular Copia-e-Cola na hora e botão 1-toque **"Copiar código PIX"**;
     - Botão **"Enviar Comprovante"** abrindo modal ODS (categoria, valor, data, upload via câmera/galeria/PDF, observação);
     - Histórico anual com filtro de ano, resumo (*Total confirmado no ano* + *Em análise*), visualização segura do comprovante, motivo visível em caso de recusa (com atalho *"Reenviar"*) e cancelamento enquanto `PENDING`.
3. **Site Institucional Público (`/[slug]`):**
   - Componente `SiteGivingSection` seguindo a estética editorial do portal e os tokens dinâmicos da igreja (`FT-022`), exibindo QR Code, chave, Copia-e-Cola e atalho *"Já é membro? Envie seu comprovante na Área de Membros"* (`/login?igreja=[slug]&redirect=/minhas-contribuicoes`).

---

## 6. Notificações (via `NotificationDispatchService`)

- **Envio de comprovante pelo membro:** notificação In-App + Push para usuários ativos com `FINANCE_APPROVER` ou `FINANCE_MANAGER` (`urlDestino: '/financeiro'`).
- **Confirmação pela tesouraria:** notificação In-App + Push para o usuário do membro confirmando o registro (`urlDestino: '/minhas-contribuicoes'`).
- **Recusa pela tesouraria:** notificação In-App + Push para o usuário do membro informando o `rejectionReason` (`urlDestino: '/minhas-contribuicoes'`).

---

## 7. Critérios de Aceite para o Futuro Plano

- [ ] A tesouraria (`FINANCE_MANAGER`) consegue cadastrar/editar a chave PIX da igreja, escolher a conta padrão, definir quais categorias de entrada aparecem ao membro e ligar/desligar exibição no app e no site público.
- [ ] O BRCode gerado é válido no padrão EMVCo/Banco Central (testado com CRC-16 e leitura em apps bancários) tanto sem valor quanto com valor preenchido.
- [ ] O **Modo Projeção / Telão** exibe logo da igreja, QR Code nítido e chave legível em tela cheia e permite download em PNG.
- [ ] O site público (`/[slug]`) exibe a seção de Dízimos e Ofertas apenas quando `showOnPublicSite` estiver ativo.
- [ ] Membros vinculados conseguem enviar comprovante (JPG/PNG/WEBP/PDF até 10 MB), visualizar seu histórico completo (envios próprios + contribuições confirmadas pela tesouraria no nome deles) e cancelar envios próprios ainda em `PENDING`.
- [ ] Comprovantes enviados entram em `/financeiro` como `PENDING` (`Contas a Receber`), com fila/filtro rápido, visualização protegida por Signed URL temporária, confirmação com ajuste opcional e recusa com motivo obrigatório.
- [ ] Nenhum comprovante é exposto por URL pública aberta e nenhum usuário sem permissão financeira (inclusive `ADMIN` sem `FinancePermission`) consegue acessar dados de outros membros.
- [ ] Notificações In-App + Push disparam corretamente nos 3 gatilhos (novo comprovante → tesouraria; confirmado/recusado → membro).

---

## Impacto

Elimina o fluxo informal de comprovantes pelo WhatsApp pessoal, profissionaliza a arrecadação da igreja nos 3 canais (telão, site e app), assegura conformidade LGPD nos comprovantes e prepara a base direta para conciliação automática com extratos bancários na [FT-023](importacao-extrato-bancario.md).
