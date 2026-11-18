# Backlog - Personalização de Cores e Identidade Visual por Igreja

### FT-022 Personalização de Cores e Identidade Visual da Igreja (Tema Customizado por Tenant)

- **Prioridade**: alta (identidade da marca e experiência personalizada da igreja)
- **Status**: pendente / priorizado para desenvolvimento
- **Fase**: identidade visual e experiência da marca
- **Categoria**: produto / UX / frontend / design system
- **Esforço estimado**: baixo a médio (facilitado pela base de tokens semânticos já implementada)
- **Contexto**: com a entrega da infraestrutura de tokens semânticos (Plano A da unificação visual), todas as superfícies vinculadas à igreja (portal público `/[slug]`, login identificado `/login?igreja=[slug]`, PWA e painel interno) passaram a consumir variáveis CSS semânticas padronizadas em Obsidiana + Âmbar (`#09090b` + `#fbbf24`). No entanto, cada igreja possui sua própria identidade visual (ex: logotipo em azul marinho, verde esmeralda, vinho/bordô, terracota, etc.). A liderança deseja poder escolher a cor primária da sua igreja no painel administrativo, garantindo que o sistema espelhe perfeitamente a identidade visual da sua comunidade sem perder legibilidade ou consistência.

- **Ação**: implementar o seletor de paleta e a injeção dinâmica de tema por tenant:

  1. **Modelagem de Dados e Backend (Prisma & API):**
     - Adicionar o campo `primaryColor` (string HEX, default `#fbbf24`) e `themePalette` (slug da paleta predefinida) no modelo `Tenant` em `apps/api/prisma/schema.prisma`.
     - Atualizar os endpoints de configuração do tenant (`PATCH /api/tenants/:id` e consulta de tenant autenticado / público).
     - Atualizar o gerador de manifesto PWA (`pwa.service.ts`) para sincronizar o `theme_color` com a cor primária do tenant.

  2. **Interface do Seletor de Cores (`apps/web/src/app/(dashboard)/configuracoes/page.tsx`):**
     - Adicionar seção de **"Identidade Visual & Cores da Igreja"**:
       - **Paletas Curadas (Presets Oficiais ODS):**
         - *Âmbar / Dourado* (Padrão atual: calor, nobreza e acolhimento)
         - *Azul Real / Marinho* (Tradicional, sereno e institucional)
         - *Verde Esmeralda / Oliva* (Vida, crescimento e renovação)
         - *Vinho / Bordô* (Realeza, comunhão e sobriedade)
         - *Roxo / Púrpura* (Eclesiástico, solene e contemporâneo)
         - *Terracota / Cobre* (Orgânico, acolhedor e artesanal)
         - *Grafite / Ardósia* (Minimalista, neutro e elegante)
       - **Color Picker Customizado (HEX):** Para igrejas com manual de marca rígido que precisam de um código exato de cor.
       - **Calculadora Automática de Contraste e Escala (WCAG AA):**
         - Se a cor primária for clara (ex: amarelo/âmbar), o texto do botão é escuro (`#09090b`).
         - Se a cor primária for escura (ex: azul marinho ou vinho), o texto do botão é branco puro (`#ffffff`).
         - Derivação automática de `--theme-brand-hover`, `--theme-accent-soft` (fundo suave) e `--theme-accent-soft-border`.
       - **Preview em Tempo Real:** Pequeno card interativo na tela de configurações mostrando botão, badge e avatar na cor selecionada antes de salvar.

  3. **Injeção Dinâmica dos Tokens no Frontend:**
     - Criar ou estender o provedor de tema (`BrandThemeProvider` ou script de injeção em `:root / [data-brand-theme="church"]`).
     - As variáveis CSS (`--theme-brand`, `--theme-brand-hover`, `--theme-brand-foreground`, `--theme-accent-ink`, `--theme-sidebar-active-bg`, etc.) são injetadas dinamicamente com base nas configurações da igreja ativa.
     - Sincronização automática com a tag `<meta name="theme-color">` no navegador móvel.

- **Impacto**: Cada igreja cliente ganha uma experiência digital totalmente personalizada com sua cor institucional, aumentando o senso de pertencimento de membros e pastores, sem risco de quebras visuais e mantendo 100% de conformidade com os padrões de acessibilidade do OneElo.
