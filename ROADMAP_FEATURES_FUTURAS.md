# Roadmap de Features Futuras — Oneelo

**Versão 1.0 — Pós-MVP**

---

## Contexto

O MVP entrega o núcleo operacional: gestão de membros, ministérios, escalas e agenda. Este documento descreve as próximas camadas de valor que serão adicionadas ao produto. Cada feature está classificada por **fase**, **complexidade técnica** e **valor de negócio**, para guiar a priorização.

A estratégia de comunicação com o usuário já no MVP é mostrar todas essas features nas telas com o estado `"Em breve"`, para validar o interesse antes de construir. Isso serve como pesquisa de produto ao mesmo tempo que gera expectativa.

---

## Como tratar "Em breve" no front

Criar um componente reutilizável `<ComingSoon />` que:
- Exibe o ícone e o título da feature normalmente na sidebar e nas páginas
- Ao clicar, mostra um `<Badge>Em breve</Badge>` ou um `<Dialog>` com:
  - Nome da feature
  - Breve descrição do que vai fazer
  - Botão opcional "Me avise quando estiver pronto" (coleta email ou salva flag no perfil do membro)
- Não bloqueia nem redireciona — apenas informa

Esse componente deve receber `props.locked = true` para ativar o estado "Em breve", de forma que quando a feature for lançada basta remover o prop.

---

## Fase 1 — Integrações (após MVP estabilizado)

### 1.1 Integração com WhatsApp

**O que faz:** Envia mensagens automáticas via WhatsApp para membros e ministérios — confirmação de escala, lembretes de eventos, avisos gerais.

**Valor:** Elimina o trabalho manual dos líderes de repassar informações. A comunicação acontece onde os membros já estão.

**Stack técnica:**
- Provedor: [Z-API](https://z-api.io) ou [Evolution API](https://github.com/EvolutionAPI/evolution-api) (self-hosted, gratuito) como alternativa.
- Fila: Redis + BullMQ (já estava no plano pós-MVP conforme `plano_desenvolvimento_ideal_markdown.md`)
- Trigger: eventos do sistema (membro confirmou escala, evento criado, aviso publicado)

**Casos de uso principais:**
1. Notificação automática quando o membro é adicionado a uma escala
2. Lembrete 24h antes do evento
3. Aviso geral enviado pelo líder ou admin via portal
4. Mensagem personalizada para um ministério específico

**Complexidade:** Alta — envolve fila, webhooks e gerenciamento de sessão do WhatsApp.

---

### 1.2 Integração com Google Agenda

**O que faz:** Sincroniza os eventos do portal com o Google Agenda de cada membro, criando compromissos automaticamente quando o membro é escalado.

**Valor:** O membro não precisa entrar no portal para saber onde está — aparece diretamente na agenda do celular.

**Stack técnica:**
- Google Calendar API (OAuth2)
- Cada membro conecta sua conta Google no perfil
- Ao ser escalado, o sistema cria/atualiza o evento no calendário do membro via service account ou token individual

**Casos de uso:**
1. Membro é escalado → evento criado no Google Agenda com data, horário e local
2. Escala é alterada → evento atualizado
3. Membro é removido da escala → evento removido

**Complexidade:** Média — OAuth2 é bem documentado, mas exige gerenciar tokens por membro.

---

## Fase 2 — Automação e IA

### 2.1 Criação Automática de Escalas com IA

**O que faz:** A IA sugere (ou cria automaticamente) escalas com base em regras configuráveis: disponibilidade dos membros, histórico de participação, funções dentro do ministério, frequência desejada de escala por membro.

**Valor:** Elimina o trabalho mais repetitivo e propenso a conflitos dos líderes. A IA propõe, o líder revisa e aprova.

**Stack técnica:**
- Claude API (Anthropic) ou modelo open-source via Ollama para privacidade
- Regras do negócio como contexto no prompt (ex: "João não pode domingo", "Maria escala a cada 2 semanas")
- Saída estruturada: JSON com a grade de escala proposta
- Tela de revisão: líder vê a sugestão, edita se necessário, confirma

**Casos de uso:**
1. Admin seleciona o período e o ministério → IA gera a escala
2. IA identifica conflitos automaticamente (membro em dois lugares ao mesmo tempo)
3. Sistema aprende com as edições do líder para melhorar sugestões futuras

**Complexidade:** Alta — depende de prompt engineering cuidadoso e de um modelo de disponibilidade dos membros bem definido.

---

### 2.2 Chatbot de Tarefas no Portal

**O que faz:** Um assistente de IA dentro do portal que entende linguagem natural e executa tarefas administrativas.

**Exemplos de comandos:**
- "Adiciona João Silva ao ministério de louvor com a função de guitarrista"
- "Mostra quem está escalado domingo"
- "Cria um evento de culto para sábado dia 14 às 19h"
- "Quais membros ainda não confirmaram a escala desta semana?"

**Stack técnica:**
- Claude API com tool use (function calling) para executar ações reais no sistema
- Interface: botão flutuante no canto da tela (estilo chat), abre um drawer lateral
- Cada "ferramenta" do assistente é um endpoint interno da API

**Complexidade:** Alta — exige mapeamento cuidadoso das ações disponíveis e controle de permissões (o chatbot só pode fazer o que o usuário logado pode fazer).

---

## Fase 3 — Módulos de Ministério

Cada ministério terá, além das funcionalidades genéricas (membros, funções, escalas), um módulo específico com ferramentas do seu contexto.

### 3.1 Módulo de Louvor

**Funcionalidades:**

**Biblioteca de Músicas:**
- Cadastro de músicas com: título, artista/banda, tom original, link do YouTube/Spotify, letra cifrada
- Busca por título, artista ou tom
- Filtros por estilo (gospel contemporâneo, hino, adoração)

**Controle de Tom por Membro:**
- Cada vocalista pode ter um tom preferido registrado
- Sistema mostra automaticamente a transposição necessária

**Set List:**
- Criação de set list para cada culto (vinculado ao evento da agenda)
- Arrastar e soltar para ordenar músicas
- Indicação do tom que será usado em cada música na ocasião
- Histórico de set lists anteriores
- Exportação em PDF para distribuição no ensaio

**Complexidade:** Média — CRUD com algumas regras de negócio específicas. A transposição de tom é lógica simples (12 semitons).

---

### 3.2 Módulo Infantil — Chat de Histórias Bíblicas

**O que faz:** Um chat assistido por IA que ajuda os professores do ministério infantil a criar histórias bíblicas adaptadas por faixa etária.

**Fluxo:**
1. Professor informa o texto bíblico base (ex: "Lucas 19 — Zaqueu")
2. Seleciona a faixa etária (ex: 4-6 anos, 7-10 anos)
3. Seleciona o formato (história narrativa, peça curta, atividade interativa)
4. A IA gera o conteúdo
5. Professor edita, salva e pode imprimir ou compartilhar

**Stack técnica:**
- Claude API com prompt especializado no contexto infantil e bíblico
- Interface de chat com área de edição do resultado
- Biblioteca de histórias salvas (reutilizáveis por outros professores do ministério)

**Complexidade:** Baixa-Média — o trabalho pesado é o prompt. A interface é um chat simples + editor.

---

### 3.3 Módulo de Mídia — Geração de Imagens

**O que faz:** Um chat que ajuda a equipe de mídia a criar descrições detalhadas para geração de imagens de posts e avisos da igreja.

**Fluxo:**
1. Usuário descreve o que precisa (ex: "Banner para o culto de jovens no sábado, tema: propósito de vida")
2. Sistema sugere um prompt otimizado para ferramentas de geração de imagem
3. Opção A: integração direta com uma API de geração (ex: DALL-E, Stable Diffusion)
4. Opção B: copia o prompt gerado para usar no Midjourney, Canva IA, etc.
5. Histórico de imagens geradas para reuso

**Stack técnica:**
- Claude API para refinar e gerar o prompt descritivo
- OpenAI Images API (DALL-E 3) ou Stability AI para geração
- Storage: AWS S3 ou Cloudflare R2 para armazenar imagens geradas

**Complexidade:** Média — a integração com APIs de imagem é simples, mas o custo por geração precisa ser gerenciado (rate limiting, cota por tenant).

---

## Resumo de Priorização

| Feature | Fase | Complexidade | Impacto no Dia a Dia |
|---------|------|-------------|----------------------|
| WhatsApp | 1 | Alta | Muito alto — comunicação é gargalo |
| Google Agenda | 1 | Média | Alto — elimina esquecimentos |
| Escala com IA | 2 | Alta | Alto — poupa horas dos líderes |
| Chatbot de Tarefas | 2 | Alta | Médio — produtividade do admin |
| Módulo Louvor | 3 | Média | Alto — ministério mais complexo |
| Histórias Infantil | 3 | Baixa-Média | Médio — preparo de aulas |
| Geração de Imagens | 3 | Média | Médio — economiza tempo da mídia |

---

## O que fazer agora (antes de construir qualquer feature)

1. **Criar as telas "Em breve" no MVP atual:** Sidebar já tem rotas para ministérios — criar sub-rotas para Louvor, Infantil, Mídia com o componente `<ComingSoon />`.

2. **Adicionar WhatsApp e Google Agenda como cards na tela de Configurações** com badge "Em breve".

3. **Adicionar o ícone do chatbot** (botão flutuante) já no layout do dashboard, com o estado desabilitado e tooltip "Em breve".

4. **Coletar feedback:** No componente `<ComingSoon />`, incluir um botão "Me interessa" que registra no banco qual feature cada usuário clicou. Isso dá dados reais de priorização.

5. **Escala com IA:** Adicionar um botão "Gerar escala automaticamente (Em breve)" na tela de escalas.

---

## Dependências técnicas a resolver antes de cada fase

| Feature | Depende de |
|---------|-----------|
| WhatsApp | Redis + BullMQ, conta Z-API ou Evolution API |
| Google Agenda | OAuth2 por membro, tabela `member_integrations` no Prisma |
| Escala com IA | Modelo de disponibilidade dos membros (campo no cadastro), Claude API key |
| Chatbot | Claude API com tool use, definição das ferramentas disponíveis |
| Módulo Louvor | Tabelas: `songs`, `setlists`, `setlist_songs` no Prisma |
| Histórias Infantil | Claude API key, tabela `ministry_content` |
| Geração de Imagens | Claude API + DALL-E API, S3/R2 para storage |
