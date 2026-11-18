# Backlog - Dízimos e Ofertas Digitais (PIX, Comprovantes e Conciliação)

### FT-021 Arrecadação Digital de Dízimos e Ofertas (PIX QR Code, Comprovantes do Membro e Conciliação na Tesouraria)

- **Prioridade**: alta (sustentabilidade financeira e facilidade operacional da igreja)
- **Status**: pendente
- **Fase**: expansão do módulo financeiro e autosserviço do membro
- **Categoria**: produto / financeiro / autosserviço / conciliação
- **Esforço estimado**: médio
- **Contexto**: hoje, a maior parte das contribuições (dízimos e ofertas) nas igrejas é feita via PIX diretamente para a conta bancária da comunidade. No entanto, o processo atual gera grande desorganização:
  1. O membro realiza o PIX e envia o "print" do comprovante no WhatsApp pessoal do pastor ou do tesoureiro no domingo à noite.
  2. O tesoureiro precisa conferir mensagens soltas no WhatsApp, adivinhar qual membro enviou (muitas vezes a conta do banco tem o nome do cônjuge) e redigitar manualmente no financeiro ou em planilhas.
  3. O membro não possui nenhum histórico organizado das suas contribuições anuais para controle pessoal ou declaração de imposto de renda.
  4. A igreja não tem uma forma padronizada de exibir a chave PIX e QR Code no telão do culto, no site da igreja ou no aplicativo dos membros.

- **Ação**: implementar o fluxo integrado de arrecadação digital e conciliação de dízimos/ofertas:

  1. **Configuração e Geração de Chave PIX (Tesouraria / Configurações):**
     - Tela de configuração da chave PIX da igreja (CNPJ, e-mail, telefone ou chave aleatória).
     - Geração automática do payload oficial BRCode (Banco Central) para:
       - **QR Code PIX** (imagem dinâmica/vetorial em alta resolução);
       - **Código PIX Copia e Cola** (com botão de copiar em 1 clique).
     - Disponibilização do QR Code em:
       - **Painel Pessoal do Membro** (botão/card *"Dizimar / Ofertar"*);
       - **Site Institucional da Igreja** (`/[slug]`);
       - **Modo Projeção / Telão de Culto** (modal em tela cheia com alta legibilidade para fotos pelo celular).

  2. **Envio de Comprovante pelo Membro (Autosserviço no Painel Pessoal):**
     - O membro logado clica em *"Enviar Comprovante de Contribuição"*.
     - Formulário simples:
       - Tipo: Dízimo, Oferta de Amor, Missões ou Outro;
       - Valor informado (R$);
       - Data da contribuição;
       - Upload do comprovante bancário (imagem PNG/JPG ou PDF).
     - Armazenamento em bucket seguro e privado no Supabase Storage (`financial-receipts`), gerando registro de transação com status `PENDING` vinculado ao `memberId`.

  3. **Histórico e Extrato Pessoal do Membro:**
     - Tela/aba privada no perfil do membro: *"Minhas Contribuições"*.
     - Tabela listando data, tipo, valor, comprovante anexado e status da conferência:
       - `Pendente de Conferência` (enquanto aguarda tesouraria);
       - `Confirmado` (após conciliação pela tesouraria).
     - **Privacidade e LGPD:** Acesso estritamente restrito ao próprio membro e à tesouraria oficial. Nenhum outro membro ou líder tem acesso a esses valores.

  4. **Fila de Conciliação na Tesouraria (`/financeiro`):**
     - Aba ou filtro na Tesouraria: *"Conciliação de Dízimos e Ofertas"*.
     - Lista de entradas pendentes agrupadas por data:
       - Foto/nome do membro identificado automaticamente;
       - Valor informado;
       - Miniatura e link com visualizador do comprovante anexado;
       - Conta bancária de destino (ex: Conta Corrente / Caixa PIX).
     - Ações com 1 clique:
       - **Confirmar Entrada:** Atualiza o status da transação para `CONFIRMED`, credita no saldo da conta financeira da igreja e atualiza o extrato do membro para "Confirmado".
       - **Solicitar Ajuste / Rejeitar:** Notifica o membro caso o valor ou anexo esteja ilegível ou divergente.

- **Impacto**: elimina completamente a troca de comprovantes por WhatsApp pessoal, poupa horas da tesouraria na conferência de dízimos aos domingos, garante sigilo financeiro e oferece transparência e organização para os membros da igreja.
