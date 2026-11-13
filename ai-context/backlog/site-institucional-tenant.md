# Backlog - Site Institucional Público do Tenant (Igreja Online)

### FT-019 Site Institucional Público da Igreja (Portal Informativo & Boas-Vindas)

- **Prioridade**: alta (presença digital e centralização de acolhimento dos tenants)
- **Status**: pendente / em concepção
- **Fase**: expansão institucional e visibilidade pública
- **Categoria**: produto / CMS / web pública / identidade
- **Esforço estimado**: médio a alto
- **Contexto**: hoje, muitas igrejas que usam o OneElo não possuem um site institucional próprio ou pagam plataformas externas separadas (WordPress, Wix) difíceis de manter. A liderança deseja um portal web público, elegante e contemporâneo para cada igreja (`oneelo.com.br/[slug]` ou `igreja.oneelo.com.br`), servindo como vitrine oficial com horários de culto, avisos, informativos, redes sociais e porta de entrada para acolhimento de visitantes e membros (integrando nativamente com o formulário da FT-018).
- **Ação**: criar o módulo do Portal Institucional com renderização pública e painel de gestão simples no dashboard:

  1. **Estrutura de Rotas e Páginas Públicas (`/[slug]` e `/[slug]/cadastro`):**
     - **Rota Principal da Igreja (`/[slug]`, ex: `/ccrv`):**
       - **Header & Hero Banner:** Logo da igreja, nome oficial, imagem de destaque com chamada de boas-vindas acolhedora e botões de ação rápida.
       - **Porta de Entrada e Acolhimento:** Botões destacados de CTA: *"É sua primeira visita? / Quero me conectar"* levando para a rota `/[slug]/cadastro`.
       - **Agenda e Horários de Cultos:** Cartões elegantes com os dias, horários e modalidades dos cultos regulares (ex.: *Culto da Família - Domingo 19h*, *Quarta da Palavra - 20h*).
       - **Informativos e Avisos (Feed de Notícias):** Banners e comunicados da semana (retiros, conferências, avisos pastorais, campanhas).
       - **Sobre a Igreja & Liderança Pastoral:** Breve história, valores e apresentação dos pastores presidentes.
       - **Redes Sociais & Transmissões:** Barra com links diretos para Instagram, YouTube (culto ao vivo), Spotify (podcasts/músicas), Facebook e WhatsApp oficial de atendimento.
       - **Localização & Contato:** Endereço físico completo, mapa integrado (Google Maps), horário de atendimento da secretaria e botão "Como Chegar".
     - **Rota de Auto-Cadastro (`/[slug]/cadastro`, ex: `/ccrv/cadastro`):**
       - Tela pública dedicada de auto-cadastro de visitante e novo membro (FT-018).
       - Retrocompatibilidade: o link legado `/join/[slug]` redireciona automaticamente para `/[slug]/cadastro`.

  2. **Painel de Gestão no Dashboard (`/site` ou `/configuracoes/site`):**
     - Gestão de horários de cultos (adicionar, editar, ordenar).
     - Gestão de informativos/avisos (título, resumo, imagem de capa, link externo ou modal de texto).
     - Banners rotativos ou hero principal com upload de imagem.
     - Configuração de links de redes sociais e canais de streaming.
     - Textos institucionais ("Sobre nós", endereço, telefone de plantão).

  3. **Direção de Design "Anti-IA" (Identidade Autêntica e Contemporânea):**
     - Rejeitar layouts genéricos de IA (gradientes roxo/azul neon de SaaS corporativo, ilustrações 3D genéricas ou cartões flutuantes clichês).
     - Adotar direção de arte editorial limpa e acolhedora: tipografia refinada com hierarquia clara (ex.: serifada humanista para títulos e semiserifa nítida para leitura), paleta sóbria baseada na identidade da igreja ou neutros quentes elegantes (slate/zinc/stone), espaçamento modular generoso e fotografia real dos membros/cultos.

  4. **Performance, SEO e Compartilhamento Social:**
     - Renderização rápida com SSR/ISR no Next.js App Router.
     - Metadados dinâmicos e Open Graph completos (`og:title`, `og:description`, `og:image`) para que, ao compartilhar o link da igreja no WhatsApp ou Instagram, surja um card profissional com o logo e nome da igreja.

- **Impacto**: cada igreja ganha um site institucional moderno e profissional sem custo adicional, unifica a comunicação com os membros e visitantes e torna o OneElo o ecossistema completo de gestão e presença digital da igreja.

---

## Desafios Técnicos e Arquiteturais

1. **Roteamento Multitenant no Next.js App Router:**
   - Decisão de convenção de rota: subpath `/igreja/[slug]` vs domínio de topo `/[slug]` (com exclusão de rotas reservadas como `/login`, `/membros`, `/dashboard`, etc.) vs subdomínio wildcard `[slug].oneelo.com.br`.
   - Para o MVP, `/igreja/[slug]` ou `/[slug]` com middleware inteligente oferece a entrega mais rápida e segura.
2. **Modelagem de Dados Flexível no Prisma:**
   - Tabelas sugeridas:
     - `tb_tenant_website_config`: guarda bio, sobre nós, redes sociais, tema/cores e telefone de contato.
     - `tb_church_schedules`: horários recorrentes de cultos (`diaSemana`, `horario`, `titulo`, `descricao`).
     - `tb_tenant_news`: comunicados e informativos (`titulo`, `slug`, `resumo`, `conteudo`, `imagemUrl`, `ativo`, `dataPublicacao`).
     - `tb_tenant_banners`: banners de destaque no hero com link de destino.
3. **Equilíbrio entre Customização e Simplicidade:**
   - A secretária ou pastor não quer um construtor de páginas complexo (tipo Elementor/Wix). Eles precisam de formulários simples e estruturados onde preenchem os dados e o sistema monta um site perfeito automaticamente.
4. **Design e Referências do Mundo Real:**
   - Uso de ferramentas como Mobbin MCP / Figma para basear as telas em layouts premiados de produtos institucionais de classe mundial, garantindo sensação humana e editorial.
