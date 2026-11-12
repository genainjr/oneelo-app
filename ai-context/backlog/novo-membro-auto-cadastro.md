# Backlog - Formulário Público de Boas-Vindas e Auto-Cadastro de Novos Membros

### FT-018 Formulário Público de Boas-Vindas e Auto-Cadastro de Membros (com Triagem Pastoral)

- **Prioridade**: alta (engajamento e acolhimento contínuo)
- **Status**: pendente
- **Fase**: expansão e recepção
- **Categoria**: produto / onboarding / UX / secretaria
- **Esforço estimado**: médio
- **Contexto**: em cultos e eventos de domingo, novos membros e visitantes preenchem papéis manuscritos ou fichas físicas de recepção. A secretaria da igreja precisa redigitar manualmente essas fichas na segunda-feira, gerando atraso, perda de dados e esforço operacional recorrente.
- **Ação**: criar página pública responsiva de auto-cadastro por tenant (`/join/[slug]` ou `/novo-membro/[slug]`) com triagem de aprovação pela secretaria:
  1. **Página Pública de Boas-Vindas**:
     - Acessível via QR Code (exibido no telão, folhetos ou recepção da igreja) ou link direto.
     - Identidade visual do tenant (logo e nome da igreja).
     - Formulário limpo: Nome completo, WhatsApp, E-mail, Data de Nascimento, Sexo, Estado Civil, CEP/Endereço opcional e perguntas pastorais opcionais (ex.: *"Já é batizado nas águas?"*, *"Vem transferido de outra igreja?"*).
  2. **Triagem e Fila de Moderação Pastoral**:
     - Os cadastros enviados entram em uma fila de solicitações com status `PENDENTE_APROVACAO` (não entram diretamente como membros ativos para evitar spam ou duplicidades).
     - Notificação no sininho in-app para administradores/secretaria informando novos cadastros recebidos.
     - Tela de moderação em `/membros` (aba ou filtro *"Fichas Recebidas"*):
       - Ações: **Aprovar como Membro Ativo**, **Aprovar como Visitante** ou **Descartar/Arquivar**.
       - Identificação inteligente de duplicidade se o telefone ou e-mail já existir no banco.
  3. **Acolhimento Automático**:
     - Ao aprovar o membro, opcionalmente gerar convite de ativação no app do OneElo.
- **Impacto**: elimina papel e digitação manual após os cultos, moderniza a recepção da igreja e acelera o acolhimento pastoral de novos convertidos e membros recém-chegados.

---

## Estrutura Recomendada

1. **Rota Pública**: `apps/web/src/app/(auth)/join/[slug]/page.tsx`.
2. **Endpoints**:
   - `GET /api/public/tenants/:slug`: Retorna dados públicos do tenant (nome, logo) para exibição do formulário.
   - `POST /api/public/tenants/:slug/members/submit`: Submissão segura com rate-limiting (Throttler) e validações de telefone/e-mail.
   - `GET /api/membros/solicitacoes`: Listagem protegida para secretaria.
   - `POST /api/membros/solicitacoes/:id/aprovar`: Efetivação como membro do tenant.
   - `POST /api/membros/solicitacoes/:id/descartar`: Rejeição do formulário.
