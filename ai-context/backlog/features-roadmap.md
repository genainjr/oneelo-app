# Backlog — Features de Produto

Features planejadas para homologação e fases seguintes. As pós-MVP têm tela "Em breve" no frontend — o componente `<ComingSoon />` está em `apps/web/src/components/app/coming-soon.tsx`.

---

## Necessárias para Homologação / Pré-lançamento

### FT-000 Painel Super Admin

- **Prioridade**: crítica — bloqueia homologação
- **Fase**: pré-lançamento
- **Categoria**: infraestrutura / operação
- **Contexto**: A Lookup Labs precisa de um painel separado para cadastrar e gerenciar as igrejas clientes (tenants). Hoje, a criação de tenants é feita diretamente no banco — impossível de operar em produção. Esse painel é necessário para cadastrar as igrejas piloto antes de homologar.
- **Ação**: Criar grupo de rotas `/admin/*` no Next.js (separado de `/dashboard/*`). Criar role `SUPER_ADMIN` sem `tenantId` no model `User`. Criar endpoints NestJS `/admin/*` com guard exclusivo `SUPER_ADMIN` que não filtra por tenant. Telas mínimas: listagem/criação/edição de Tenants (com ativação/desativação) e criação do primeiro usuário ADMIN de cada tenant.
- **Impacto**: Permite cadastrar igrejas piloto sem acesso direto ao banco. Operação de produção sustentável.
- **Depende de**: IMP-001 (campos email/phone/language no Tenant). Claim `SUPER_ADMIN` no JWT sem `tenantId`.
- **Arquivos a criar**:
  - `apps/web/src/app/admin/` (grupo de rotas)
  - `apps/api/src/modules/admin/` (controller + service + guard)
  - Migration: adicionar enum value `SUPER_ADMIN` ao campo `role` de `User`

---

## Pós-MVP (por fase)

### FT-001 Integração com WhatsApp
- **Prioridade**: alta
- **Fase**: 1
- **Categoria**: UX / comunicação
- **Contexto**: Líderes repassam informações de escala e eventos manualmente pelo WhatsApp. A comunicação já acontece lá — o sistema só não está integrado.
- **Ação**: Integrar via Z-API ou Evolution API (self-hosted). Implementar Redis + BullMQ para fila de envios. Criar triggers nos eventos do sistema: membro escalado, lembrete 24h antes do evento, aviso geral por ministério.
- **Impacto**: Elimina trabalho manual de comunicação dos líderes. Membros recebem confirmações e lembretes automaticamente.
- **Depende de**: Redis + BullMQ, conta Z-API ou Evolution API rodando.

---

### FT-002 Adicionar Escalas e Eventos a Aplicativos de Agenda (Google, Apple, Outlook e .ics)
- **Prioridade**: alta
- **Status**: implementado (suporte multi-provedor Google/Apple/Outlook/.ics, a��es em lote e atalhos de notifica��o via commit aca4f9c)
- **Fase**: entregue
- **Categoria**: UX / Produtividade
- **Contexto**: Membros precisam entrar no portal para saber quando est�o escalados. Integrar via OAuth bidirecional traria fric��o desnecess�ria (senhas, escopos restritos do Google e verifica��o de aplicativo). Uma abordagem �gil e sem atrito via Link Direto Template e Lote permite ao membro colocar seus compromissos no Google Agenda com 1 clique.
- **A��o**:
  1. **Inclus�o Unit�ria (1 Clique)**: Bot�o "Adicionar ao Google Agenda" em cada compromisso individual no portal (/minhas-escalas e /personal-panel), gerando URL template direta (calendar.google.com/calendar/render?action=TEMPLATE...) com t�tulo, data/hora, minist�rio, fun��o e local preenchidos.
  2. **Inclus�o em Lote**: Bot�o "Adicionar todas as minhas escalas do m�s" no topo do painel do membro. No ecossistema web, abrir m�ltiplas abas de uma vez � bloqueado pelos navegadores como pop-up; para lote, a solu��o recomendada � disponibilizar um arquivo agregador que o app de calend�rio importa de uma vez s� com todos os cultos do m�s, ou um assistente de confirma��o em sequ�ncia.
  3. **Processo de Remo��o**: Manual no pr�prio aplicativo do Google Agenda do membro. Por ser uma adi��o via link direto sem invas�o de permiss�es na conta pessoal do usu�rio, caso a escala seja alterada ou o membro seja removido, o OneElo dispara a notifica��o de cancelamento/altera��o e o membro remove o compromisso manualmente da sua agenda em 1 toque.
  4. **Atalho nas Notifica��es**: Nas notifica��es push e no Inbox In-App (/notifications), os alertas de escala publicada ou escala do dia devem conter o link/a��o direta "Adicionar � Agenda".
- **Impacto**: Membro nunca esquece o compromisso em cultos e eventos; reduz aus�ncias; implementa��o limpa, segura e sem depend�ncia de credenciais OAuth permanentes.
- **Depende de**: Helper utilit�rio de formata��o de links de calend�rio (calendar-url-builder).

---

### FT-003 Escala Automática com IA
- **Prioridade**: alta
- **Fase**: 2
- **Categoria**: UX / automação
- **Contexto**: Montar escala mensal é o trabalho mais repetitivo e propenso a conflito dos líderes. Exige cruzar disponibilidade, funções e histórico de cada membro.
- **Ação**: Implementar gerador de escala via Claude API com saída estruturada (JSON da grade). Regras do ministério e disponibilidade dos membros entram como contexto no prompt. Tela de revisão onde o líder edita e aprova antes de publicar.
- **Impacto**: Poupa horas de trabalho manual dos líderes por mês. IA propõe, humano decide.
- **Depende de**: Campo de disponibilidade no cadastro de membro (dias da semana / frequência), Claude API key no backend.

---

### FT-004 Chatbot de Tarefas no Portal
- **Prioridade**: média
- **Fase**: 2
- **Categoria**: DX / UX
- **Contexto**: Tarefas administrativas como adicionar membro a ministério, consultar escala ou criar evento exigem navegar por várias telas. Linguagem natural é mais rápido para usuários avançados.
- **Ação**: Implementar assistente com Claude API + tool use (function calling). Cada "ferramenta" mapeia para um endpoint interno da API. Interface: drawer lateral acionado pelo botão flutuante já presente no layout. Permissões do chatbot espelham as do usuário logado.
- **Impacto**: Reduz cliques para tarefas repetitivas. Usuários power conseguem operar o sistema sem sair de uma tela.
- **Depende de**: Claude API key, mapeamento das ferramentas disponíveis por role.

---

### FT-005 Módulo de Louvor
- **Prioridade**: alta
- **Fase**: 3
- **Categoria**: UX / produto
- **Contexto**: O ministério de louvor é o mais complexo operacionalmente. Sem ferramenta dedicada, set lists e controle de tom são feitos em planilhas ou apps externos.
- **Ação**: Criar módulo em `/ministerios/louvor` com: (1) biblioteca de músicas — título, artista, tom original, letra cifrada, links YouTube/Spotify; (2) set list por culto com drag-and-drop vinculado ao evento da agenda; (3) controle de tom por vocalista com transposição automática; (4) exportação do set list em PDF.
- **Impacto**: Centraliza tudo que o ministério de louvor precisa. Elimina planilhas e apps externos.
- **Depende de**: Tabelas `songs`, `setlists`, `setlist_songs` no Prisma. Lógica de transposição de tom (12 semitons).

---

### FT-006 Módulo Infantil — Histórias Bíblicas com IA
- **Prioridade**: média
- **Fase**: 3
- **Categoria**: UX / produto
- **Contexto**: Professores do ministério infantil precisam preparar material adaptado por faixa etária toda semana. Criar histórias do zero é demorado.
- **Ação**: Chat em `/ministerios/infantil` onde o professor informa o texto bíblico base e a faixa etária (4-6, 7-10 anos) e seleciona o formato (narrativa, peça, atividade interativa). Claude API gera o conteúdo. Professor edita e salva numa biblioteca compartilhada do ministério.
- **Impacto**: Reduz tempo de preparação de aula. Material fica salvo e reutilizável por outros professores.
- **Depende de**: Claude API key, tabela `ministry_content` no Prisma.

---

### FT-007 Módulo de Mídia — Geração de Imagens
- **Prioridade**: média
- **Fase**: 3
- **Categoria**: UX / produto
- **Contexto**: A equipe de mídia precisa criar banners e artes para posts toda semana. Ferramentas de IA de imagem existem mas exigem saber escrever bons prompts.
- **Ação**: Chat em `/ministerios/midia` onde o usuário descreve o que precisa. Claude API gera um prompt otimizado. Opção A: integração com DALL-E 3 ou Stability AI para gerar diretamente. Opção B: copia o prompt para usar no Canva IA / Midjourney. Histórico de imagens geradas salvo em S3 ou Cloudflare R2.
- **Impacto**: Reduz tempo de criação de arte. Equipe sem habilidade técnica consegue gerar imagens de qualidade.
- **Depende de**: Claude API key, DALL-E API ou Stability AI, bucket S3/R2 para storage. Controle de cota por tenant para gerenciar custo de geração.





