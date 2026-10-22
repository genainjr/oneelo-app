# Plano - Compartilhamento Unificado de PDF/PNG: Componentes Compartilhados e Padrão Visual (Escalas e Eventos)

Status: concluído  
Data de criação: 2026-10-20  
Branch sugerida para implementação: `feature/unified-share-pdf-png`  

## Planos e Referências Relacionados

- [OneElo Design System (ODS)](../../ai-core/skills/oneelo-design-system/README.md)
- [ODS - Padrão de Visualização](../../ai-core/skills/oneelo-design-system/VIEW_STANDARD.md)
- [ODS - Padrão de Exportação](../../ai-core/skills/oneelo-design-system/EXPORT_STANDARD.md)
- [Matriz de Conformidade do ODS](../frontend/ods-compliance-matrix.md)
- [Plano - Exportação de PDF e Imagens](exportacao-pdf-plan.md)
- [Plano - Estabilidade de memória da exportação de Escalas](escala-export-memory-stability-plan.md)
- [Plano - Performance da exportação de Escalas](escala-export-performance-plan.md)
- [Plano - Modernização dos Templates de Impressão](refactor-template-generation-pdf.md)

---

## 1. Contexto e Motivação: Por que Componentes Compartilhados?

O repositório possui diretrizes explícitas no **OneElo Design System (ODS)** contra a proliferação de telas divergentes e código duplicado. No [README do ODS](../../ai-core/skills/oneelo-design-system/README.md), os seguintes anti-padrões foram formalmente catalogados:

> - *Shell de modal duplicado em várias páginas.*
> - *Quatro páginas de exportação com a mesma estrutura reimplementada.*
> - *Filtros com layouts diferentes para problemas semelhantes.*
> - *Telas de módulos parecidos divergindo visualmente e comportamentalmente.*

Quando a exportação de PDF e PNG foi desenvolvida recentemente para o módulo de Escalas, os layouts foram definidos a partir de um modelo de design externo homologado:
1. **Layout de PDF (Organizado por Dias da Semana com Cor):** Documento em A4 paisagem, cabeçalho institucional em grid (logo do tenant, título e metadados com período), **agrupamento obrigatório por dias da semana** (ex.: `DOMINGOS`, `QUARTAS-FEIRAS`, `SÁBADOS`), onde cada dia recebe uma barra de cabeçalho com cor temática própria (`.weekday-group h2`), seguida pela tabela técnica com zebra suave e rodapé One Elo / Lookup Labs.
2. **Layout de PNG (Folha Semanal Vertical / Mobile):** Folha semanal vertical (`1080px`) otimizada para WhatsApp e visualização mobile, composta por cabeçalho institucional e cartões visuais (`.event-card`) com faixas coloridas semânticas, data grande (`44px`), tags em pílulas translúcidas e linhas de detalhamento.

No entanto, essa implementação ficou acoplada aos arquivos de Escalas.  
**A exportação de eventos da Agenda deve seguir rigorosamente o MESMO padrão de layout para PDF e PNG**, aproveitando componentes e geradores visuais compartilhados para eliminar qualquer discrepância.

---

## 2. Princípios de Redução de Código e Consistência

1. **Paridade Visual e Comportamental Absoluta:** O modal de compartilhamento, os botões, os estados de loading, os feedbacks de erro e o comportamento em mobile/desktop devem ser **idênticos** em qualquer módulo do sistema.
2. **Mesma Identidade Visual nos Documentos (PDF e PNG):**
   - Cabeçalho padronizado idêntico (logo da igreja, título central, período e nome da organização);
   - Rodapé com identificação da Lookup Labs / One Elo e marcação de página;
   - **No PDF:** Agrupamento por dia da semana com faixas coloridas temáticas (`ROLE_COLORS`);
   - **No PNG:** Cartões no formato vertical `1080px` com tipografia, contrastes e espaçamentos idênticos aos de Escalas.
3. **Componentização Estrita no Frontend:**
   - A página de visualização (`/agenda/visualizacao`) não deve conter JSX inline de modais nem chamadas manuais a `navigator.share`.
   - Ela deve apenas declarar o botão de ação e renderizar o componente compartilhado `<ExportShareDialog />`.
   - A página `/escalas/visualizacao` será refatorada para consumir esse mesmo componente (eliminando ~180 linhas de código duplicado).
4. **Isolamento de Infraestrutura no Backend:**
   - A gestão do Chromium, concorrência, timeouts e cache LRU residem em `apps/api/src/common/export/`.
   - A base de CSS/estilos dos documentos é compartilhada, garantindo que futuras melhorias no design de PDF/PNG sejam refletidas automaticamente em todos os módulos.

---

## 3. Especificação Detalhada dos Layouts (Base Unificada)

### 3.1 Padrão Visual do PDF (A4 Paisagem - Agrupado por Dias da Semana com Cor)
Seguindo o modelo externo aprovado em Escalas, os eventos não aparecem em uma listagem linear contínua sem divisão. Eles são estruturados e agrupados por dia da semana:

1. **Configuração da Página:**
   - `@page { size: A4 landscape; margin: 7mm; }`
   - Container `.pdf-page` com dimensões exatas de A4 horizontal (`width: 283mm; min-height: 194mm; padding: 2mm 2mm 12mm`).
2. **Cabeçalho Unificado (`renderHeader`):**
   - Grid de 3 colunas: Logo do Tenant (`20mm x 20mm`) | Título central (`h1`, 19pt, peso 800) | Bloco de metadados à direita (Período em 10pt/700 e Organização em 8.5pt/700);
   - Marca d'água/rodapé com logo Lookup Labs (`8mm x 8mm`) e texto `One Elo Lookup Labs` fixado no canto inferior esquerdo.
3. **Agrupamento por Dia da Semana com Cores Temáticas (`.weekday-group`):**
   - Os eventos dentro do período filtrado são agrupados pelo dia da semana (`Domingos`, `Segundas-feiras`, `Terças-feiras`, `Quartas-feiras`, `Quintas-feiras`, `Sextas-feiras`, `Sábados`);
   - Cada dia da semana forma uma seção com barra de título superior arredondada (`border-radius: 2mm 2mm 0 0`) colorida com a paleta institucional (`ROLE_COLORS = ['#0f766e', '#1d4ed8', '#a16207', '#6d28d9', '#be123c', '#4d7c0f']`), por exemplo:
     - `DOMINGOS` (barra azul/teal);
     - `QUARTAS-FEIRAS` (barra violeta/âmbar);
     - `SÁBADOS` (barra correspondente).
   - Sob cada dia da semana, uma tabela `.general-table` lista os eventos daquele dia no período.
4. **Tabela e Colunas da Seção do Dia:**
   - Efeito zebra suave nas linhas (`#f4f6f9`), bordas suaves `#d7dee8`, cabeçalho cinza `#e7ebf1` em caixa alta;
   - Colunas:
     1. `Data / Horário` (com destaque `#243b5a; font-weight: 700;`);
     2. `Título do Evento` (peso 800);
     3. `Tipo` (Culto, Ensaio, Reunião, etc.);
     4. `Ministérios Envolvidos`;
     5. `Status` (Agendado, Realizado, Cancelado);
     6. `Local`;
     7. `Descrição / Observações`.
   - Quebras de página limpas com `tr { break-inside: avoid; }`.

### 3.2 Padrão Visual do PNG Semanal (1080px Mobile / WhatsApp)
O PNG de Eventos espelha com exatidão o novo modelo semanal de Escalas:

1. **Estrutura da Folha (`.weekly-sheet`):**
   - Largura fixa de `1080px`, padding `46px 48px 36px`, fundo branco;
   - Cabeçalho institucional ampliado para alta resolução: Logo do Tenant (`84px`), título central `h1 { font-size: 54px }` ("Agenda da semana"), período formatado (`21px`) e nome da igreja (`20px`).
2. **Cartões de Evento (`.event-card`):**
   - `border-radius: 22px`, borda sutil `1px solid #d8dee8`;
   - **Topo do Cartão:** Barra com cor semântica rotativa (`var(--event-color)` baseada em `ROLE_COLORS`):
     - Data em destaque numérico grande (`font-size: 44px; line-height: 1;`);
     - Dia da semana por extenso (`font-size: 26px; font-weight: 700;`);
     - Título do evento (`font-size: 21px; font-weight: 600;`);
     - Pílula de categoria com fundo translúcido (`background: rgba(255,255,255,.2); border-radius: 999px; font-size: 19px;`).
   - **Corpo do Cartão:**
     - Linhas estruturadas (`.assignment-row` / `.info-row`) com rótulo descritivo à esquerda (`font-size: 22px; color: #657184;`) e conteúdo em destaque à direita (`font-size: 27px; font-weight: 700; color: #111827;`):
       - Horário (`19:30 às 21:30`);
       - Ministérios envolvidos;
       - Local;
       - Descrição/detalhes (quando houver).

---

## 4. Arquitetura da Solução Compartilhada

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                             FRONTEND (ODS)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ apps/web/src/components/app/export-share-dialog.tsx                         │
│ • Componente genérico ExportShareDialog:                                    │
│   - Diálogo acessível (ARIA, foco, backdrop)                                │
│   - Etapa 1: Cards de seleção PDF vs Imagem                                 │
│   - Etapa 2: Seletor de semanas civis / "Todas as semanas"                  │
│   - Controle de loading/spinner e mensagens de erro                         │
│                                                                             │
│ apps/web/src/hooks/use-document-share.ts                                    │
│ • Hook de lógica compartilhada:                                             │
│   - Gerencia estado de abertura, etapa atual e seleção                      │
│   - Integração com Web Share API (navigator.share com verificação canShare) │
│   - Fallback resiliente para download direto (downloadFile)                 │
│   - Cache de sessão em memória por filtro/tenant para evitar re-download    │
│   - Tratamento padrão para erros 503 com Retry-After e AbortError           │
│                                                                             │
│ apps/web/src/lib/export-calendar-weeks.ts                                   │
│ • Utilitário de datas: agrupamento por semana civil para Escalas e Eventos  │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │ Consomem o MESMO componente e hook
            ┌───────────────────────────┴───────────────────────────┐
            ▼                                                       ▼
┌───────────────────────────────┐       ┌───────────────────────────────┐
│     /escalas/visualizacao     │       │     /agenda/visualizacao      │
│  (Refatorada: -180 linhas)    │       │  (Nova ação Compartilhar)     │
└───────────────────────────────┘       └───────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                            BACKEND (NESTJS)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ apps/api/src/common/export/                                                 │
│ • ChromiumRendererService:                                                  │
│   - Lançamento sob demanda com CHROMIUM_LOW_MEMORY_ARGS                     │
│   - Semáforo serial (1 renderização concorrente por container)              │
│   - Limite de fila de espera (3) e timeout rígido (25s)                      │
│ • TenantLogoService:                                                        │
│   - Download com timeout, otimização Sharp (240x240) e cache LRU            │
│   - Logo institucional Lookup Labs local                                    │
│ • DocumentCacheService:                                                     │
│   - Cache LRU de buffers e cálculo de ETag / If-None-Match (304)            │
│ • BaseDocumentStyles:                                                       │
│   - CSS unificado de cabeçalho, tabelas A4, weekly-sheet e event-cards      │
├───────────────────────────────────────┬─────────────────────────────────────┤
│ apps/api/src/modules/escalas/export/  │ apps/api/src/modules/eventos/export/│
│ • EscalaDocumentRenderer              │ • EventoDocumentRenderer            │
│   - HTML específico da Escala         │   - HTML específico da Agenda       │
│   - PDF A4 paisagem (grade/matriz)    │   - PDF A4 paisagem (por dia da sem)│
│   - PNG semanal de escala             │   - PNG semanal de eventos          │
└───────────────────────────────────────┴─────────────────────────────────────┘
```

---

## 5. Fases de Implementação e Redução de Código

### Fase 1: Motor e Estilos Compartilhados no Backend (`apps/api`)
- [x] Criar pasta `apps/api/src/common/export/`.
- [x] Extrair `ChromiumRendererService` (launch enxuto, flags de baixa memória, semáforo serial, timeout de 25s, limite de fila = 3).
- [x] Extrair `TenantLogoService` (download seguro de imagem, redimensionamento com Sharp para 240x240, cache LRU em memória).
- [x] Extrair `DocumentCacheService` (gerenciamento de ETag, 304 Not Modified e cache de buffers LRU).
- [x] Extrair estilos e cabeçalho base (`renderDocumentHeader`, CSS de `.document-header`, `.weekly-sheet`, `.event-card`, `.weekday-group`) para reutilização direta.
- [x] Refatorar `EscalaDocumentRendererService` para consumir esses serviços comuns, reduzindo o arquivo de 1.276 linhas para apenas os templates específicos de escalas.
- [x] Executar bateria de testes de escalas para comprovar que nenhuma regressão ocorreu.

### Fase 2: Implementação do Renderizador de Eventos (`apps/api`)
- [x] Criar `apps/api/src/modules/eventos/dto/export-evento.dto.ts`.
- [x] Criar `EventoDocumentRendererService` em `apps/api/src/modules/eventos/export/`:
  - Implementar agrupamento de eventos por dias da semana (`WEEKDAY_GROUP_LABELS`), aplicando as barras coloridas (`ROLE_COLORS`) e tabelas zebradas;
  - Implementar template HTML/CSS para PNG semanal seguindo o padrão visual exato de `weekly-sheet` e `event-card`;
  - Utilizar o `ChromiumRendererService` e os estilos comuns.
- [x] Implementar método `exportar` em `EventosService` e rota `GET /eventos/exportacao` em `EventosController`.
- [x] Adicionar testes unitários em `evento-document-renderer.service.spec.ts` e `eventos.controller.spec.ts`.

### Fase 3: Componentes Compartilhados de Compartilhamento no Frontend (`apps/web`)
- [x] Criar utilitário `apps/web/src/lib/export-calendar-weeks.ts` com funções de agrupamento de semanas civis.
- [x] Criar componente `apps/web/src/components/app/export-share-dialog.tsx`:
  - Modal genérico de 2 passos (Formato e Semana);
  - Acessibilidade e responsividade (mobile-friendly).
- [x] Criar hook `apps/web/src/hooks/use-document-share.ts`:
  - Gerenciamento de estado, cache de sessão, `navigator.share` e fallback `downloadFile`.
- [x] Refatorar `apps/web/src/app/(dashboard)/escalas/visualizacao/page.tsx`:
  - Remover todo o JSX inline do modal e a lógica repetida de compartilhamento;
  - Substituir pela chamada do hook `useDocumentShare` e do componente `<ExportShareDialog />`;
  - Validar que a tela de Escalas permaneceu idêntica visualmente e funcionalmente.

### Fase 4: Adoção do Padrão Compartilhado na Agenda (`apps/web`)
- [x] Atualizar `apps/web/src/app/(dashboard)/agenda/visualizacao/page.tsx`:
  - Conectar o hook `useDocumentShare` apontando para o endpoint `/api/eventos/exportacao`;
  - Adicionar o botão `Compartilhar` no `PageHeader` idêntico ao de Escalas;
  - Renderizar o `<ExportShareDialog />`.
- [x] Nenhuma lógica de modal ou Web Share duplicada na página da Agenda.

### Fase 5: Auditoria, Documentação no ODS e Validação de Build
- [x] Atualizar a documentação do ODS em `ai-core/skills/oneelo-design-system/EXPORT_STANDARD.md` e `VIEW_STANDARD.md` documentando o padrão oficial de compartilhamento de documentos (`ExportShareDialog` + `useDocumentShare`).
- [x] Executar builds de produção:
  - `npm run build` na `apps/api`
  - `npm run build` na `apps/web`
- [x] Executar todos os testes unitários (`npm test`).
- [x] Teste em dispositivos móveis (Web Share com WhatsApp) e desktop (download direto).

---

## 6. Critérios de Aceite e Garantias Visuais

1. **Equivalência Estética e Estrutural:** O PDF de Eventos organiza os eventos estritamente por dias da semana com cores temáticas nas seções (`DOMINGOS`, `QUARTAS-FEIRAS`, etc.), espelhando o modelo de Escalas. O PNG de Eventos segue o mesmo formato de cartões verticais `1080px`.
2. **Zero Duplicação de Modal:** O modal de compartilhamento existe em um único arquivo no frontend (`export-share-dialog.tsx`).
3. **Redução de Código Líquido:** A página `/escalas/visualizacao` perde ~180 linhas de código inline, e a página `/agenda/visualizacao` adiciona a funcionalidade com menos de 40 linhas.
4. **Isolamento de Infraestrutura no Backend:** Toda lógica de concorrência e estabilidade do Chromium reside em `common/export/`.
5. **Garantia de Não-Regressão:** A exportação existente de Escalas continua funcionando perfeitamente sem alteração de comportamento para o usuário.
