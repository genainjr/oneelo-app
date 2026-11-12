# Plano - Auto-Cadastro Público de Novos Membros e Visitantes com Triagem Pastoral (FT-018)

Status geral: planejado  
Data de criação: 2026-11-12  
Branch sugerida para implementação: feature/novo-membro-auto-cadastro  

## Planos e Referências Relacionados

- [Backlog FT-018: Formulário Público e Auto-Cadastro](../backlog/novo-membro-auto-cadastro.md)
- [Backlog Geral de Funcionalidades](../backlog/README.md)
- [Plano de Ativação e Onboarding de Usuários](new-user-creation-and-onboarding-workflow.md)
- [Plano de Limites do Tenant e Quota de Membros](tenant-plan-limits-plan.md)
- [Design System do OneElo (ODS)](../ods/)

---

## 1. Objetivo da Entrega

Modernizar a recepção dominical das igrejas através de uma página pública responsiva e *mobile-first* (`/join/[slug]`), acessível por QR Code e link compartilhável, permitindo que novos membros e visitantes realizem seu auto-cadastro pelo próprio smartphone.

A entrega contempla:
1. **Página Pública de Boas-Vindas por Igreja (`/join/[slug]`):** Identidade visual da igreja (logo e nome) com alternância fluida entre perfil **Visitante** (cadastro leve para acolhimento) e **Novo Membro** (ficha eclesiástica completa).
2. **Fila de Triagem e Moderação Pastoral (`/membros`):** Aba administrativa com badge de pendências, verificação inteligente de duplicidade e visualização responsiva (tabela no desktop e cards empilhados no mobile).
3. **Efetivação e Criação de Acesso Atômica:** Aprovação de visitante como status `VISITANTE` (sem consumo de limite de membros) ou de membro como `ATIVO` com criação atômica de conta `User` (`role: BASIC`, `status: PENDING`) e token de ativação válido por 72 horas.
4. **Acolhimento no WhatsApp:** Modal imediato pós-aprovação com a mensagem oficial de boas-vindas pré-formatada e botão de disparo direto no WhatsApp (aplicativo no celular e WhatsApp Web no desktop).

---

## 2. Contexto e Diagnóstico

1. **Gargalo Operacional na Recepção:** Nos cultos de domingo, a equipe de recepção utiliza fichas de papel manuscritas. Na segunda-feira, a secretaria precisa redigitar manualmente os dados no OneElo, gerando lentidão, erros de digitação e perda frequente de contatos de visitantes.
2. **Diferenciação entre Membro e Visitante:**
   - O enum `StatusMembro` no banco de dados já possui `VISITANTE`, `ATIVO`, `INATIVO` e `TRANSFERIDO`.
   - O serviço de limites de plano (`tenant-plan.ts`) contabiliza estritamente membros com status `ATIVO`. Portanto, acolher visitantes não consome a quota de membros do plano da igreja.
   - Visitantes não necessitam de credenciais de login no sistema, apenas de dados de contato e data de nascimento para acompanhamento pastoral e ministério de acolhimento.
3. **Mensagem Oficial de Ativação Existente:** O sistema já possui um formato oficial de mensagem de boas-vindas com link de ativação em `apps/web/src/app/(dashboard)/configuracoes/page.tsx` (`buildActivationWelcomeMessage`). Esse gerador deve ser promovido a helper compartilhado e reaproveitado na triagem.
4. **Proteção de Rotas:** O arquivo `middleware.ts` intercepta acessos ao frontend. A rota `/join/:slug` deve ser declarada explicitamente como rota pública permitida sem autenticação.
5. **Segurança e Anti-Spam:** Um formulário público precisa de proteção contra robôs e abusos, combinando rate-limiting do NestJS (`ThrottlerGuard`), normalização de números telefônicos para formato E.164 e campo armadilha invisível (*honeypot*).

---

## 3. Decisões de Arquitetura, Riscos e Engenharia

### 3.1. Modelo de Dados (Prisma)
- Criação da tabela física `tb_member_registration_request` através do modelo `SolicitacaoCadastroMembro`:
  - `id`: CUID/UUID (chave primária).
  - `tenantId`: Referência à igreja (`tb_tenants`).
  - `tipo`: Enum `TipoSolicitacaoCadastro` (`VISITANTE` | `MEMBRO`).
  - `status`: Enum `StatusSolicitacaoCadastro` (`PENDENTE` | `APROVADO` | `REJEITADO`).
  - Campos do postulante: `nome`, `telefone` (E.164), `email` (opcional para visitante, obrigatório para membro), `dataNascimento`, `genero`, `estadoCivil`, `batizadoAguas`, `igrejaAnterior`, `quemConvidou`, `observacoes`.
  - Auditoria e controle: `rejectionReason` (motivo de descarte), `processedAt`, `processedByUserId` (quem aprovou/rejeitou), `createdAt`, `updatedAt`.
  - Índices compostos de busca e performance: `@@index([tenantId, status])`, `@@index([tenantId, telefone])` e `@@index([tenantId, email])`.

### 3.2. Arquitetura da API (NestJS)
- **Módulo Público (`apps/api/src/modules/public/` ou rotas públicas em `membros`):**
  - `GET /api/public/tenants/:slug`: Retorna nome da igreja, slug e URL do logotipo para renderizar o cabeçalho público.
  - `POST /api/public/tenants/:slug/members/submit`: Endpoint protegido por rate-limit (`@Throttle({ default: { limit: 10, ttl: 60000 } })`), validação com `class-validator`, normalização de telefone, checagem do campo invisível `honeypot` e disparo de notificação in-app para os administradores/secretaria do tenant.
- **Módulo Administrativo (`apps/api/src/modules/membros/`):**
  - `GET /api/membros/solicitacoes`: Retorna listagem com filtro por status (`PENDENTE` por padrão) e flag calculada `hasDuplicate` (indicando se já existe membro ativo com mesmo telefone ou e-mail no tenant).
  - `POST /api/membros/solicitacoes/:id/aprovar`: Operação transacional atômica (`prisma.$transaction`):
    - Se `tipo == 'VISITANTE'`: Cria registro em `Membro` com `status = VISITANTE`. Não cria conta `User`. Marca solicitação como `APROVADO`.
    - Se `tipo == 'MEMBRO'`: Valida quota disponível no plano do tenant via `assertTenantCanAddMember`. Cria registro em `Membro` com `status = ATIVO`. Cria conta `User` com `role = BASIC`, `status = PENDING` e token de ativação criptografado (expiração de 72h). Marca solicitação como `APROVADO`. Retorna dados do usuário e o link de ativação gerado.
  - `POST /api/membros/solicitacoes/:id/rejeitar`: Atualiza status para `REJEITADO` registrando motivo e usuário responsável.

### 3.3. Experiência Frontend e Multi-Dispositivo
- **Página Pública (`apps/web/src/app/(auth)/join/[slug]/page.tsx`):**
  - Mobile-First: Elementos de formulário em coluna única com área de toque mínima de 44px de altura.
  - Teclados virtuais otimizados: `type="tel"` e `type="email"`.
  - Máscaras dinâmicas leves de telefone `(00) 00000-0000` e data `DD/MM/AAAA`.
  - No desktop: Apresentação em card centralizado (`max-w-lg`) com tipografia nítida e logotipo destacado.
  - Feedback visual acolhedor de envio com mensagem de confirmação.
- **Aba de Triagem em `/membros`:**
  - Adição da aba `Fichas Recebidas` com badge numérico de pendências ao lado da aba existente de membros.
  - Responsividade ODS: No desktop exibe `DataTable` completa; em telas `< 768px` renderiza cartões empilhados (`EntityCard`) evitando quebra de layout.
  - Badges visuais de atenção quando houver possível duplicidade cadastral (telefone ou e-mail coincidente).
- **Modal de Boas-Vindas Pós-Aprovação:**
  - Exibe a mensagem de acolhimento formatada com o link de ativação de 72h.
  - Botão híbrido de envio no WhatsApp: no celular abre o app oficial diretamente na conversa; no desktop abre o WhatsApp Web em nova aba.
  - Botão para copiar texto completo para a área de transferência.
- **Modal de Divulgação e QR Code:**
  - Botão na página de membros para abrir modal com QR Code da igreja em alta resolução e link copiável para projeção em telão ou impressão.

### 3.4. Matriz de Riscos e Mitigações
| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Envio de spam / robôs no formulário público | Média | Médio | ThrottlerGuard restritivo + campo invisível honeypot que descarta o request silenciosamente se preenchido. |
| Cadastros duplicados (mesmo membro preenchendo mais de uma vez) | Alta | Baixo | Flag visual de duplicidade na fila de triagem permitindo que a secretaria identifique e descarte com um clique. |
| Ultrapassagem de limite de membros ativos do plano | Baixa | Alto | A validação `assertTenantCanAddMember` é executada dentro da transação atômica de aprovação do membro. Visitantes não consomem limite. |
| Incompatibilidade de máscaras em navegadores móveis | Média | Médio | Utilização de máscara pura sem travar o teclado nativo de Android e iOS. |

---

## 4. Etapas de Desenvolvimento

> **Regra de Execução:** O desenvolvimento deve avançar estritamente etapa por etapa. Ao concluir uma tarefa ou etapa, atualize imediatamente seu checkbox para `[x]`, apresente o resumo das validações e **aguarde a autorização explícita do usuário antes de iniciar a etapa seguinte**.

### Etapa 0 - Modelagem de Dados e Schema Prisma
Status: planejado

- [ ] Atualizar o arquivo de schema Prisma (`apps/api/prisma/schema.prisma`):
  - [ ] Declarar enum `TipoSolicitacaoCadastro` (`VISITANTE`, `MEMBRO`)
  - [ ] Declarar enum `StatusSolicitacaoCadastro` (`PENDENTE`, `APROVADO`, `REJEITADO`)
  - [ ] Criar o modelo `SolicitacaoCadastroMembro` mapeando para a tabela `tb_member_registration_request` com índices para `tenantId`, `status`, `telefone` e `email`
  - [ ] Adicionar relação reversa no modelo `Tenant` para `solicitacoesCadastro`
- [ ] Gerar migração do Prisma e atualizar o client (`npx prisma migrate dev` / `npx prisma generate`):
  - [ ] Validar criação da migração em `apps/api/prisma/migrations/`
  - [ ] Validar tipagem TypeScript gerada no `@prisma/client`
- [ ] Critério de validação da etapa: Prisma Client compilando sem erros e tabela `tb_member_registration_request` devidamente criada no banco com todos os índices e chaves estrangeiras.

### Etapa 1 - Endpoints Públicos de Consulta de Tenant e Submissão (Backend)
Status: planejado

- [ ] Criar DTOs de submissão e consulta pública (`apps/api/src/modules/public/dto/` ou `apps/api/src/modules/membros/dto/`):
  - [ ] `submit-member-registration.dto.ts` com validações `class-validator` (nome, telefone, email condicional, dataNascimento, tipo, honeypot)
  - [ ] Normalizador de telefone celular no padrão E.164 brasileiro
- [ ] Implementar serviço de submissão pública (`apps/api/src/modules/membros/solicitacoes-cadastro.service.ts`):
  - [ ] Método `getPublicTenantInfo(slug: string)` retornando nome, logo e slug da igreja
  - [ ] Método `submitRegistration(slug: string, dto: SubmitMemberRegistrationDto)` com checagem de honeypot, busca do tenant e persistência com status `PENDENTE`
  - [ ] Integração com serviço de notificações internas para alertar administradores/secretaria sobre nova ficha recebida
- [ ] Implementar controller público (`apps/api/src/modules/membros/public-solicitacoes.controller.ts`):
  - [ ] Decorador `@Throttle({ default: { limit: 10, ttl: 60000 } })` para proteção contra abusos
  - [ ] Rota `GET /api/public/tenants/:slug`
  - [ ] Rota `POST /api/public/tenants/:slug/members/submit`
- [ ] Registrar módulos e controladores no NestJS (`apps/api/src/modules/membros/membros.module.ts`):
  - [ ] Registrar novos controllers e services nos providers e exports
- [ ] Criar testes unitários para o fluxo de submissão pública (`apps/api/src/modules/membros/solicitacoes-cadastro.service.spec.ts`):
  - [ ] Teste de submissão de visitante com sucesso
  - [ ] Teste de submissão de membro com validação de campos obrigatórios
  - [ ] Teste de descarte por preenchimento de honeypot
  - [ ] Teste de erro para slug de tenant inexistente
- [ ] Critério de validação da etapa: Execução de testes unitários do serviço de submissão passando com sucesso (`npm run test -- solicitacoes-cadastro.service.spec.ts`).

### Etapa 2 - Endpoints Administrativos de Triagem e Aprovação Atômica (Backend)
Status: planejado

- [ ] Implementar métodos administrativos no serviço (`apps/api/src/modules/membros/solicitacoes-cadastro.service.ts`):
  - [ ] Método `listSolicitacoes(tenantId: string, status?: StatusSolicitacaoCadastro)` com enriquecimento de flag `hasDuplicate`
  - [ ] Método `aprovarSolicitacao(tenantId: string, solicitacaoId: string, userId: string)`:
    - [ ] Fluxo Visitante: cria `Membro` (`status = VISITANTE`), sem criar `User` e sem validar limite de plano
    - [ ] Fluxo Membro: valida limite de membros via `assertTenantCanAddMember`, cria `Membro` (`status = ATIVO`), cria `User` (`role = BASIC`, `status = PENDING`) e gera token hash de ativação (72h)
    - [ ] Atualização do status da solicitação para `APROVADO` dentro da mesma transação (`prisma.$transaction`)
  - [ ] Método `rejeitarSolicitacao(tenantId: string, solicitacaoId: string, userId: string, motivo?: string)`:
    - [ ] Atualização do status para `REJEITADO` com auditoria
- [ ] Implementar controller administrativo (`apps/api/src/modules/membros/solicitacoes-cadastro.controller.ts`):
  - [ ] Rota protegida `GET /api/membros/solicitacoes`
  - [ ] Rota protegida `POST /api/membros/solicitacoes/:id/aprovar`
  - [ ] Rota protegida `POST /api/membros/solicitacoes/:id/rejeitar`
- [ ] Criar testes unitários para a aprovação e rejeição administrativa (`apps/api/src/modules/membros/solicitacoes-triagem.service.spec.ts`):
  - [ ] Teste de listagem com identificação de duplicidade
  - [ ] Teste de aprovação de visitante sem criar usuário
  - [ ] Teste de aprovação atômica de membro com criação de usuário e geração de token
  - [ ] Teste de rejeição de membro caso o limite do plano seja atingido
  - [ ] Teste de rejeição com motivo
- [ ] Critério de validação da etapa: Testes unitários de triagem e aprovação atômica executados com 100% de sucesso.

### Etapa 3 - Página Pública Mobile-First de Auto-Cadastro e Modal de QR Code (Frontend)
Status: planejado

- [ ] Liberar rota pública no middleware (`apps/web/src/middleware.ts`):
  - [ ] Adicionar prefixo `/join` na lista de rotas públicas permitidas sem sessão
- [ ] Criar cliente HTTP para endpoints públicos (`apps/web/src/lib/api/public-tenant.ts`):
  - [ ] Função `getPublicTenantBySlug(slug: string)`
  - [ ] Função `submitMemberRegistration(slug: string, payload: SubmitMemberPayload)`
- [ ] Criar página pública de auto-cadastro (`apps/web/src/app/(auth)/join/[slug]/page.tsx`):
  - [ ] Layout mobile-first responsivo com suporte a celulares e desktops
  - [ ] Cabeçalho com logo da igreja e mensagem de boas-vindas
  - [ ] Botões tipo pílula para alternar entre "Sou Visitante" e "Quero ser Membro"
  - [ ] Formulário com inputs ergonômicos (mínimo 44px de altura) e teclados semânticos (`tel`, `email`)
  - [ ] Máscaras de telefone `(00) 00000-0000` e data de nascimento `DD/MM/AAAA`
  - [ ] Campo invisível honeypot contra robôs
  - [ ] Estado de loading no botão de envio e tela de confirmação/sucesso acolhedora
- [ ] Criar modal de divulgação do link e QR Code (`apps/web/src/components/membros/QrCodeJoinModal.tsx`):
  - [ ] Exibição visual do QR Code gerado dinamicamente para a URL pública do tenant
  - [ ] Botão para copiar link direto da igreja (`oneelo.com.br/join/slug-da-igreja`)
  - [ ] Opção para download da imagem do QR Code para impressão ou projeção em telão
- [ ] Critério de validação da etapa: Acessar `/join/[slug]` no navegador sem autenticação, testar o formulário responsivo no modo mobile e desktop, e conferir renderização do QR Code.

### Etapa 4 - Tela de Triagem Pastoral e Modal de Boas-Vindas no WhatsApp (Frontend)
Status: planejado

- [ ] Extrair e centralizar helper de mensagem de ativação (`apps/web/src/lib/utils/activation-message.ts`):
  - [ ] Mover `buildActivationWelcomeMessage` para função utilitária pura reaproveitável
  - [ ] Atualizar `apps/web/src/app/(dashboard)/configuracoes/page.tsx` para consumir o helper compartilhado
- [ ] Criar cliente HTTP de triagem (`apps/web/src/lib/api/solicitacoes-cadastro.ts`):
  - [ ] Funções `getSolicitacoesCadastro(status?: string)`, `aprovarSolicitacao(id: string)` e `rejeitarSolicitacao(id: string, motivo?: string)`
- [ ] Criar modal de boas-vindas com disparo no WhatsApp (`apps/web/src/components/membros/WelcomeActivationModal.tsx`):
  - [ ] Exibição formatada da mensagem de boas-vindas com link de ativação
  - [ ] Botão "Enviar no WhatsApp" compatível com mobile (app nativo) e desktop (WhatsApp Web)
  - [ ] Botão para copiar texto completo com confirmação de cópia
- [ ] Criar componente de lista e triagem de solicitações (`apps/web/src/components/membros/SolicitacoesTriagemTab.tsx`):
  - [ ] Visão desktop com tabela ODS (`DataTable`) com colunas de dados, badge de duplicidade e botões de ação
  - [ ] Visão mobile com cards empilhados (`EntityCard`) para operação no smartphone da liderança/secretaria
  - [ ] Modal de confirmação de descarte com justificativa opcional
  - [ ] Abertura do modal `WelcomeActivationModal` imediatamente após a aprovação de um membro
- [ ] Atualizar página de membros para integrar abas (`apps/web/src/app/(dashboard)/membros/page.tsx`):
  - [ ] Aba "Membros Cadastrados" e aba "Fichas Recebidas" com badge numérico de itens pendentes
  - [ ] Botão de ação no topo "QR Code de Auto-Cadastro" abrindo o `QrCodeJoinModal`
- [ ] Critério de validação da etapa: Triagem operando na aba de membros, aprovação de visitante criando membro sem login, aprovação de membro gerando credencial e abrindo o modal com disparo de WhatsApp.

### Etapa 5 - Validação Integrada Multi-Dispositivo, Testes e Build Final
Status: planejado

- [ ] Executar suíte completa de testes automatizados do backend (`npm run test` em `apps/api`):
  - [ ] Garantir que nenhum teste existente de membros ou autenticação sofreu regressão
- [ ] Executar type-check e linting no frontend e backend:
  - [ ] `npm run lint` em `apps/api` e `apps/web`
- [ ] Validar build de produção (`npm run build`):
  - [ ] Build do pacote `apps/api` concluído com sucesso
  - [ ] Build do pacote `apps/web` concluído com sucesso (rotas estáticas e dinâmicas)
- [ ] Validação visual integrada de fluxos (Desktop e Mobile):
  - [ ] Acesso público via `/join/[slug]` no viewport mobile (375px e 412px) e desktop (1280px+)
  - [ ] Envio de ficha de visitante e aprovação na triagem
  - [ ] Envio de ficha de membro, verificação de duplicidade e aprovação com disparo de WhatsApp
- [ ] Atualizar documentação e backlog:
  - [ ] Marcar FT-018 como concluída em `ai-context/backlog/novo-membro-auto-cadastro.md` e `ai-context/backlog/README.md`
  - [ ] Atualizar índice em `ai-context/plans/README.md`
- [ ] Critério de validação da etapa: Builds de produção passando sem erros, testes com 100% de sucesso e fluxos operacionais validados em desktop e mobile.

---

## 5. Critérios de Aceite Gerais

- [ ] O visitante ou novo membro consegue preencher e enviar sua ficha pelo smartphone através de `/join/[slug]` sem necessidade de login.
- [ ] A página pública adapta-se perfeitamente a dispositivos móveis e desktops, com ergonomia de toque e máscaras sem travamento.
- [ ] A submissão pública conta com rate-limiting e honeypot invisível para impedir bots e envios maliciosos.
- [ ] A secretaria visualiza a contagem de fichas pendentes através de badge numérico na aba de membros.
- [ ] A tela de triagem alterna automaticamente entre tabela no desktop e cards empilhados no mobile, mantendo usabilidade em qualquer tamanho de tela.
- [ ] Casos de duplicidade (mesmo telefone ou e-mail já cadastrado) exibem alerta visual claro para orientar a decisão pastoral.
- [ ] Visitantes aprovados tornam-se membros com status `VISITANTE`, sem criação de usuário de acesso e sem consumir a quota de membros do plano.
- [ ] Membros aprovados são criados atomicamente com status `ATIVO`, conta de usuário com role `BASIC` e token de ativação com validade de 72 horas.
- [ ] O modal de boas-vindas permite envio com 1 clique no WhatsApp (app oficial no celular ou WhatsApp Web no desktop) e cópia do texto de acolhimento.
- [ ] Nenhum erro de TypeScript ou quebra de build é introduzido em `apps/api` ou `apps/web`.
