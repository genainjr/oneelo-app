# Plano - Suporte a Múltiplos Formatos e Proporções de Imagens nos Informativos do Site

Status geral: concluido  
Data de criação: 2026-11-17  
Branch sugerida para implementação: fix/site-noticias-formato-imagem  

## Planos e Referências Relacionados

- [site-institucional-tenant-plan.md](site-institucional-tenant-plan.md)
- [README.md](README.md)

---

## 1. Objetivo da Entrega

Permitir que os informativos e comunicados do site institucional público exibam perfeitamente imagens e cartazes em qualquer proporção — com destaque para os formatos mais utilizados por igrejas:
- **4:5 Vertical / Retrato:** Padrão do feed do Instagram (1080×1350 px), formato padrão de flyers de eventos e cultos.
- **1:1 Quadrado:** Padrão clássico de post de redes sociais (1080×1080 px).
- **16:9 Horizontal / Paisagem:** Padrão de banners e miniaturas do YouTube (1920×1080 px).
- **9:16 Vertical Completo:** Padrão de Stories do Instagram e Status do WhatsApp (1080×1920 px).

Eliminar o corte e enquadramento truncado atual (que forçava `aspect-[16/9]` com `object-cover`), garantindo a integridade de textos, horários, locais e elementos visuais tanto na página individual da notícia quanto na listagem e no modal administrativo.

---

## 2. Contexto e Diagnóstico

1. **Página de Detalhe da Notícia (`apps/web/src/app/[slug]/noticias/[noticiaSlug]/page.tsx`):**
   - Utilizava `<div className="relative mt-8 aspect-[16/9] w-full overflow-hidden rounded-3xl ..."><Image fill className="object-cover" /></div>`.
   - Como forçava proporção fixa de 16:9 com `object-cover`, qualquer imagem vertical ou quadrada sofria zoom agressivo e corte severo no topo e na base (ex: cartaz do "Culto de Domingo" da CCRV perdeu o cabeçalho e todo o rodapé com endereço e horário).

2. **Vitrine / Cards da Home (`apps/web/src/components/public-site/site-news-section.tsx`):**
   - Os cards na grade possuem `aspect-[16/10]` com `object-cover`.
   - Para cartazes verticais, é importante manter um enquadramento estético equilibrado e harmônico sem quebrar o grid nem deformar os cards.

3. **Modal Administrativo de Cadastro/Edição (`apps/web/src/components/app/site/news-form-modal.tsx`):**
   - O preview de upload também utilizava `aspect-[16/9]` com `object-cover`, exibindo o cartaz já cortado antes mesmo de salvar, sem dar visibilidade ao usuário sobre o enquadramento real.

---

## 3. Decisões de Arquitetura, Riscos e Engenharia

1. **Página de Leitura (`[noticiaSlug]/page.tsx`):**
   - Remover a trava rígida `aspect-[16/9]`.
   - Adotar um container responsivo com fundo neutro suave (com backdrop blur sutil baseado na própria imagem para preenchimento de laterais quando necessário).
   - Renderizar a imagem completa com `object-contain`, mantendo a proporção nativa íntegra até uma altura máxima confortável (`max-h-[720px]`).
   - 100% do cartaz visível em qualquer resolução (mobile e desktop).

2. **Cards da Vitrine (`site-news-section.tsx`):**
   - Manter a proporção estável da grade dos cards (`aspect-[16/10]`), aplicando técnica de duplo layer (camada de fundo com blur suave + camada frontal com `object-contain` ou posicionamento otimizado), preservando a legibilidade e a harmonia visual.

3. **Preview do Formulário Admin (`news-form-modal.tsx`):**
   - Ajustar o container de preview para `max-h-72` com `object-contain`, permitindo ao administrador conferir o cartaz real inteiro.
   - Adicionar texto de apoio informativo: *"Formatos aceitos: 4:5 (Post Instagram), 1:1 (Quadrado), 16:9 (Horizontal) e 9:16 (Story/Cartaz)."*

4. **Matriz de Riscos e Compatibilidade:**
   - Risco zero de regressão em banco de dados ou API (o backend já armazena o arquivo original íntegro no Supabase Storage).
   - Total aderência às regras do Design System ODS e Tailwind CSS.

---

## 4. Etapas de Desenvolvimento

> **Regra de Execução:** O desenvolvimento deve avançar estritamente etapa por etapa. Ao concluir uma tarefa ou etapa, atualize imediatamente seu checkbox para `[x]`, apresente o resumo das validações e aguarde a autorização explícita do usuário antes de iniciar a etapa seguinte.

### Etapa 0 - Preparação e Análise de Baseline
Status: concluido

- [x] Confirmar branch de trabalho criada a partir de `development` (`fix/site-noticias-formato-imagem`).
- [x] Identificar os pontos de renderização de imagem de informativos no frontend.
- [x] Critério de validação da etapa: Repositório limpo na branch correta com pontos de alteração mapeados.

### Etapa 1 - Ajuste da Página de Detalhes da Notícia
Status: concluido

- [x] Atualizar `apps/web/src/app/[slug]/noticias/[noticiaSlug]/page.tsx`:
  - [x] Remover classe fixa `aspect-[16/9]` do container da imagem de capa.
  - [x] Implementar container adaptativo com altura máxima fluida (`max-h-[720px]`) e fundo estético com backdrop blur.
  - [x] Exibir a imagem na sua proporção nativa (`object-contain`) sem cortar topo ou rodapé.
- [x] Critério de validação da etapa: Notícia exibe imagens 4:5, 1:1 e 16:9 completas em telas mobile e desktop sem corte.

### Etapa 2 - Ajuste dos Cards da Vitrine e Home
Status: concluido

- [x] Atualizar `apps/web/src/components/public-site/site-news-section.tsx`:
  - [x] Ajustar exibição da miniatura para comportar imagens verticais de forma elegante com backdrop sutil e `object-contain`.
  - [x] Garantir que o grid da seção de informativos continue alinhado e responsivo.
- [x] Critério de validação da etapa: Grade de notícias na home renderiza posts horizontais e verticais com proporção uniforme e sem distorção.

### Etapa 3 - Ajuste do Preview no Formulário Administrativo
Status: concluido

- [x] Atualizar `apps/web/src/components/app/site/news-form-modal.tsx`:
  - [x] Ajustar o preview de imagem para visualização em proporção natural (`object-contain` em container delimitado).
  - [x] Adicionar dica visual de formatos suportados (4:5, 1:1, 16:9, 9:16).
- [x] Atualizar `apps/web/src/components/app/image-upload-panel.tsx`:
  - [x] Adicionar suporte a `imageClassName` opcional retrocompatível com fallback `object-cover`.
- [x] Atualizar `apps/web/src/app/(dashboard)/configuracoes/site/page.tsx`:
  - [x] Exibir miniatura da lista com `object-contain` sem corte.
- [x] Critério de validação da etapa: Upload de imagem no modal exibe o preview fiel e sem cortes para o usuário.

### Etapa 4 - Validação, Build e Não-Regressão
Status: concluido

- [x] Executar typecheck e linting no `apps/web` (`npm run lint`).
- [x] Executar build de produção do frontend (`npm run build --prefix apps/web`).
- [x] Validar suíte de testes no `apps/api` (`npm test -- website.service.spec.ts`).
- [x] Critério de validação da etapa: Build do Next.js passando com sucesso (40 páginas estáticas geradas com código 0) e 25 testes do website unitários passando.

---

## 5. Critérios de Aceite Gerais

- [x] Imagens no formato 4:5 (feed portrait Instagram) aparecem 100% legíveis e completas no detalhe da notícia, sem cortar textos ou logos.
- [x] Imagens no formato 1:1 (quadrado) e 16:9 (horizontal) continuam sendo exibidas perfeitamente.
- [x] A grade de notícias da página inicial permanece alinhada, estável e com visual profissional.
- [x] O painel administrativo reflete a imagem real enviada no preview de upload.
- [x] Build do projeto executa com código 0 e sem regressões.
