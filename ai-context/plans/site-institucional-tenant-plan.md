# Plano - Site Institucional Público do Tenant e Portal da Igreja (FT-019)

Status geral: em andamento  
Data de criação: 2026-11-13  
Última revisão: 2026-11-13  
Branches sugeridas para implementação:
- Fase 1 (FT-019A): `feature/site-institucional-tenant`
- Fase 2 (FT-019B): `feature/site-institucional-dominio-proprio`

## Planos e Referências Relacionados

- [Backlog FT-019: Site Institucional Público do Tenant](../backlog/site-institucional-tenant.md)
- [Backlog FT-018: Auto-Cadastro de Membros e Visitantes](../backlog/novo-membro-auto-cadastro.md)
- [Plano de Auto-Cadastro Público e Triagem](novo-membro-auto-cadastro-plan.md)
- [Matriz de Permissões](../backlog/permissions-matrix.md)
- [Design System do OneElo (ODS)](../../ai-core/skills/oneelo-design-system/README.md)
- [Padrões de Visualização ODS](../../ai-core/skills/oneelo-design-system/VIEW_STANDARD.md)

---

## 1. Objetivo da Entrega

Prover para cada igreja (`Tenant`) um site institucional público, contemporâneo, responsivo e de alta performance, integrado nativamente ao sistema de gestão e ao auto-cadastro (FT-018).

Para reduzir risco operacional e de regressão, a entrega é estruturada em **duas fases independentes**:

### Fase 1 (FT-019A) — Portal Público (`/[slug]`), Auto-Cadastro Canônico e CMS no Dashboard
1. **Portal Público da Igreja (`oneelo.com.br/[slug]`):**
   - Header com logotipo da igreja, nome oficial, âncoras de navegação e botão **"Área de Membros"** direcionando para `/login`.
   - Hero Banner acolhedor com foto de capa da comunidade, versículo tema e chamada de boas-vindas.
   - Botão de ação rápida (CTA) de acolhimento direcionando para `/[slug]/cadastro`.
   - Grade de horários e modalidades dos cultos regulares da semana.
   - Feed de comunicados, eventos especiais e notícias da igreja (`/[slug]/noticias/[noticiaSlug]`).
   - Apresentação institucional da igreja e da liderança pastoral.
   - Barra de redes sociais e canais de transmissão (Instagram, YouTube, Facebook, Spotify, WhatsApp).
   - Localização física com endereço estruturado, horário da secretaria e botão "Como Chegar".
2. **Integração Fluida e Canônica com Auto-Cadastro (FT-018):**
   - O formulário público de auto-cadastro migra de `/join/[slug]` para a rota canônica `/[slug]/cadastro`.
   - Retrocompatibilidade: `/join/[slug]` passa a responder com redirect permanente (`301`) para `/[slug]/cadastro`, e o componente `JoinLinkCard` + rota Open Graph passam a usar o endereço canônico.
3. **Painel de Gestão CMS no Dashboard (`/configuracoes/site`):**
   - Formulários estruturados (sem construtores visuais complexos) para `ADMIN` e `STAFF` manterem hero, cultos, informativos, dados pastorais, redes sociais e localização.
4. **SEO, Performance e Open Graph Dinâmico:**
   - Renderização SSR/ISR no App Router com `remotePatterns` configurado para imagens do Supabase Storage e cards Open Graph atualizados.

### Fase 2 (FT-019B) — Domínio Próprio Customizado (`ccrv.org.br`)
1. **Provisionamento e Verificação Real de Domínio na Vercel + DNS:**
   - Integração com **Vercel Domains API** (adição e verificação do domínio no projeto Vercel para SSL automático) combinada à checagem de DNS (`CNAME` para subdomínios como `www.` e `A`/`ALIAS` + `TXT` de verificação para domínios raiz/apex).
   - Política de elegibilidade por plano do tenant (`Plano`) configurável antes da ativação.
2. **Middleware Multi-Host Seguro:**
   - Resolução de `Host` customizado no `middleware.ts` com cache Edge de TTL curto, timeout resiliente e rewrite restrito às rotas públicas do portal (`/`, `/cadastro`, `/og`, `/noticias/*`), mantendo `/login`, `/api/*` e área autenticada no domínio principal do One Elo para preservar cookies `access_token`, OAuth Google e `CORS_ORIGIN`.

---

## 2. Contexto e Diagnóstico

1. **Estado Atual das Rotas Públicas (FT-018):**
   - Hoje o auto-cadastro reside em `apps/web/src/app/(public)/join/[slug]/page.tsx` (acompanhado de `join-client.tsx`, `tenant-public.ts` e `og/route.tsx`), divulgado no dashboard pelo componente `apps/web/src/components/app/join-link-card.tsx` (dentro de `/configuracoes`).
   - No Next.js App Router, route groups como `(public)` não entram na URL. Portanto, **não é possível manter `(public)/join/[slug]/page.tsx` e criar `join/[slug]/route.ts` simultaneamente**, pois isso gera erro de build por rota duplicada. A migração deve mover os módulos compartilhados e substituir a página antiga pelo handler de redirect `301` na mesma etapa.
2. **Roteamento Dinâmico `/[slug]` e Salvaguarda de `RESERVED_SLUGS`:**
   - Pastas explícitas na raiz de `apps/web/src/app/` têm prioridade sobre `[slug]`, porém a criação/edição de tenants no `SuperAdminService` (`createTenant` / `updateTenant`) ainda não bloqueia slugs reservados.
   - É obrigatório centralizar `RESERVED_SLUGS` cobrindo todas as rotas de raiz reais do app (`admin`, `api`, `auth`, `login`, `activate`, `locale`, `manifest.webmanifest`, `onboarding`, `validar-carteirinha`, `dashboard`, `membros`, `ministerios`, `escalas`, `agenda`, `documentos`, `financeiro`, `grupos`, `integracoes`, `meu-perfil`, `configuracoes`, `minhas-escalas`, `personal-panel`, `join`, `site`, `robots.txt`, `sitemap.xml`, `offline.html`, `sw.js`, `_next`, `favicon.ico`) e validar antes do deploy se há tenants pré-existentes em colisão.
   - Em `apps/web/src/middleware.ts`, a liberação pública deve aceitar **apenas** o padrão estrito de rotas do portal público (`/[slug]`, `/[slug]/cadastro`, `/[slug]/og`, `/[slug]/noticias/[noticiaSlug]`) excluindo `RESERVED_SLUGS`, sem jamais enfraquecer a exigência de `access_token` nas rotas do sistema.
3. **Permissões e Navegação na `Sidebar` (`STAFF` vs `ADMIN`):**
   - Atualmente, `apps/web/src/components/app/sidebar.tsx` marca `/configuracoes` como `adminOnly: true`, ocultando-o para `STAFF`, e utiliza ícones SVG inline (`ICONS`) e lista `EXACT_ROOTS` para estado ativo.
   - Como a gestão editorial do site pertence à secretaria/equipe pastoral (`ADMIN` e `STAFF`), `/configuracoes/site` deve ser exposto na `Sidebar` com visibilidade `staffOnly: true` (visível para `ADMIN` e `STAFF`, bloqueado para `BASIC` no `middleware.ts`), seguindo o padrão de SVG inline da sidebar e chaves `next-intl`.
4. **Mídias e `next/image`:**
   - `apps/web/next.config.ts` ainda não define `images.remotePatterns`. O uso de `next/image` com URLs públicas do Supabase Storage lançará erro em runtime caso os domínios do Supabase não sejam declarados em `next.config.ts`.
   - `TenantMediaService` (`apps/api/src/common/storage/tenant-media.service.ts`) hoje atende logo e ícones PWA no bucket `tenant-logos` usando `validateImageUpload` e `MAX_IMAGE_SIZE` (5 MB). O módulo de website deve estender o armazenamento reutilizando `SupabaseStorageService` e `validateImageUpload` em prefixos organizados ou bucket público dedicado (documentando o provisionamento do bucket no Supabase antes do uso).
5. **Segurança de Conteúdo, Mapas e Cache:**
   - **XSS e Links Maliciosos:** `TenantNews.conteudo` não deve aceitar HTML arbitrário sem sanitização; adotar texto estruturado/parágrafos ou Markdown seguro renderizado sem `dangerouslySetInnerHTML`. URLs externas (`instagramUrl`, `youtubeUrl`, `facebookUrl`, `spotifyUrl`, `googleMapsUrl`) devem exigir protocolo `http://` ou `https://` na validação DTO.
   - **Google Maps:** links curtos colados pelo usuário (`maps.app.goo.gl/...`) são bloqueados dentro de `<iframe>` por `X-Frame-Options`. O portal deve gerar o botão "Como Chegar" via URL externa validada (ou endereço estruturado) e não depender de `<iframe>` com URL arbitrária.
   - **Cache e Visualização Imediata:** Server Components devem buscar `${process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL}/api/public/site/...` (mesmo padrão de `tenant-public.ts`). Para evitar atraso de até 60s após salvar no CMS, combinar cache com revalidação sob demanda (`revalidatePath` / Route Handler autenticado ou tag cacheada) ao atualizar o site no dashboard.

---

## 3. Decisões de Arquitetura, Riscos e Engenharia

### 3.1. Modelagem de Dados no Prisma (`apps/api/prisma/schema.prisma`)
Criação dos modelos dedicados ao módulo institucional vinculados ao `Tenant`:
- **`TenantWebsiteConfig` (`tb_tenant_website_config`):**
  - `id`: UUID (chave primária).
  - `tenantId`: FK para `tb_tenant` com restrição `@unique` (relação 1:1) e `onDelete: Cascade`.
  - Apresentação: `tituloHero`, `subtituloHero`, `bannerUrl`, `bannerKey`, `versiculoTema`, `versiculoReferencia`.
  - Sobre nós: `sobreNos`, `historia`, `visaoValores`.
  - Pastores presidentes: `pastoresNomes`, `pastoresBio`, `pastoresFotoUrl`, `pastoresFotoKey`.
  - Localização e atendimento: `endereco`, `numero`, `bairro`, `cidade`, `estado`, `cep`, `googleMapsUrl`, `horarioSecretaria`.
  - Redes e canais: `instagramUrl`, `youtubeUrl`, `facebookUrl`, `spotifyUrl`, `whatsappAtendimento`.
  - Domínio próprio (preparado no schema na Fase 1, ativado na Fase 2): `customDomain` (`@unique`), `dnsStatus` (enum `DnsStatus`: `PENDING`, `ACTIVE`, `ERROR`), `dnsCheckedAt`, `customDomainVerifiedAt`.
  - Auditoria: `createdAt`, `updatedAt`.
  - Índice: `@@index([customDomain])`.
- **`ChurchSchedule` (`tb_church_schedule`):**
  - `id`, `tenantId` (`onDelete: Cascade`), `diaSemana` (Int 0-6), `horario` (String `"HH:mm"`), `titulo`, `descricao`, `modalidade` (enum `ModalidadeCulto`: `PRESENCIAL`, `ONLINE`, `HIBRIDO`), `ordem` (Int), `ativo` (Boolean), `createdAt`, `updatedAt`.
  - Índices: `@@index([tenantId, ativo])`, `@@index([tenantId, ordem])`.
- **`TenantNews` (`tb_tenant_news`):**
  - `id`, `tenantId` (`onDelete: Cascade`), `titulo`, `slug`, `resumo`, `conteudo` (texto estruturado sem HTML bruto), `imagemUrl`, `imagemKey`, `dataPublicacao`, `destaque` (Boolean), `ativo` (Boolean), `createdAt`, `updatedAt`.
  - Índices: `@@index([tenantId, ativo])`, `@@unique([tenantId, slug])`.

### 3.2. Arquitetura da API (NestJS)
- **Módulo `website` (`apps/api/src/modules/website/`):**
  - **Endpoints Públicos (`public-website.controller.ts`):**
    - `@Controller('public/site')`, `@Public()`, `@UseGuards(ThrottlerGuard)` (60 req/min por IP; mantendo convivência documentada com `@Controller('public/tenants')` da FT-018).
    - `GET /api/public/site/:slug`: payload consolidado do site (dados públicos do tenant ativo, config institucional, cultos ativos ordenados e notícias ativas). Retorna `404` se tenant não existir ou `ativo === false`.
    - `GET /api/public/site/:slug/noticias/:noticiaSlug`: detalhes de uma notícia ativa do tenant.
    - *(Fase 2)* `GET /api/public/site/resolve?domain=...`: retorna apenas `{ slug }` para tenant ativo com `dnsStatus === 'ACTIVE'`.
  - **Endpoints Administrativos (`website.controller.ts`):**
    - `@Roles(Role.ADMIN, Role.STAFF)` com isolamento estrito por `user.tenantId`.
    - `GET /api/site/config` e `PUT /api/site/config`: leitura e atualização das configurações (sem expor alteração de `customDomain` fora da Fase 2).
    - `POST /api/site/banner` e `DELETE /api/site/banner`: upload/remoção via `SupabaseStorageService` + `validateImageUpload`.
    - `POST /api/site/pastores-foto` e `DELETE /api/site/pastores-foto`: upload/remoção da foto pastoral.
    - `POST /api/site/noticias/:id/imagem` e `DELETE /api/site/noticias/:id/imagem`: upload/remoção da imagem de capa da notícia.
    - CRUD de cultos: `GET /api/site/cultos`, `POST /api/site/cultos`, `PUT /api/site/cultos/:id`, `DELETE /api/site/cultos/:id`, `PATCH /api/site/cultos/reordenar`.
    - CRUD de informativos: `GET /api/site/noticias`, `POST /api/site/noticias`, `PUT /api/site/noticias/:id`, `DELETE /api/site/noticias/:id`.
    - *(Fase 2)* `PUT /api/site/custom-domain`, `POST /api/site/custom-domain/verify` e `DELETE /api/site/custom-domain`.

### 3.3. Matriz de Riscos e Mitigações
| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Erro de build no Next.js por rota `/join/[slug]` duplicada (`page.tsx` vs `route.ts`) | Alta | Crítico | Remover `app/(public)/join/[slug]/page.tsx` na mesma etapa em que `app/[slug]/cadastro/page.tsx` e `app/join/[slug]/route.ts` forem criados. |
| Colisão de slug do tenant com rotas do sistema ou tenants pré-existentes | Média | Crítico | Aplicar `RESERVED_SLUGS` em `SuperAdminService` (`createTenant` e `updateTenant`), DTOs e UI admin, e auditar slugs existentes antes do deploy. |
| Crash em runtime ao usar `next/image` com URLs do Supabase Storage | Alta | Alto | Declarar `images.remotePatterns` em `apps/web/next.config.ts` para o host do Supabase Storage antes de habilitar os componentes públicos. |
| Domínio customizado sem provisionamento na Vercel ou em domínio raiz (`A`/`ALIAS`) | Alta | Alto | Isolar Domínio Próprio na **Fase 2 (FT-019B)** integrando Vercel Domains API e suportando verificação para raiz (`A`/`TXT`) e subdomínio (`CNAME`). |
| Rewrite de domínio customizado interceptar `/login`, `/api/*`, `/manifest.webmanifest` ou quebrar cookies/CORS/OAuth | Média | Crítico | Restringir rewrite do `middleware.ts` apenas às rotas públicas do portal (`/`, `/cadastro`, `/og`, `/noticias/*`) e direcionar "Área de Membros" para o domínio principal do One Elo. |
| Latência ou indisponibilidade do `middleware.ts` ao consultar domínio customizado | Média | Médio | Na Fase 2, usar cache Edge com TTL curto, timeout curto (~1.5s) e fallback seguro sem bloquear rotas do sistema. |
| `STAFF` bloqueado na interface apesar da permissão no backend | Alta | Médio | Ajustar visibilidade na `Sidebar` (`staffOnly: true` para `/configuracoes/site`) preservando `/configuracoes` restrito ou coerente com `permissions-matrix.md`. |
| XSS / bloqueio de `iframe` em URLs e notícias cadastradas no CMS | Média | Médio | Rejeitar HTML bruto em `conteudo`, validar URLs `http(s)://` nos DTOs e usar link/busca estruturada para Google Maps em vez de `iframe` arbitrário. |
| Cache ISR atrasar exibição de edições feitas pela secretaria | Média | Baixo | Disparar revalidação sob demanda (`revalidatePath`) ao salvar alterações no CMS para atualização imediata ao clicar em "Visualizar Site Público". |

---

## 4. Etapas de Desenvolvimento

> **Regra de Execução:** O desenvolvimento deve avançar estritamente etapa por etapa. Ao concluir uma tarefa ou etapa, atualize imediatamente seu checkbox para `[x]`, apresente o resumo das validações e **aguarde a autorização explícita do usuário antes de iniciar a etapa seguinte**.

### Etapa 0 - Modelagem de Dados, Enums e Schema Prisma (Fase 1)
Status: concluido

- [x] Atualizar o arquivo `apps/api/prisma/schema.prisma`:
  - [x] Declarar enum `ModalidadeCulto` (`PRESENCIAL`, `ONLINE`, `HIBRIDO`) com `@@map("worship_modality")`
  - [x] Declarar enum `DnsStatus` (`PENDING`, `ACTIVE`, `ERROR`) com `@@map("dns_status")`
  - [x] Criar modelo `TenantWebsiteConfig` mapeado para `tb_tenant_website_config` com relação 1:1 (`@unique`) com `Tenant` (`onDelete: Cascade`), campos institucionais e campos preparatórios de domínio customizado
  - [x] Criar modelo `ChurchSchedule` mapeado para `tb_church_schedule` com relação com `Tenant` (`onDelete: Cascade`) e índices `[tenantId, ativo]` e `[tenantId, ordem]`
  - [x] Criar modelo `TenantNews` mapeado para `tb_tenant_news` com relação com `Tenant` (`onDelete: Cascade`), índice `[tenantId, ativo]` e unicidade `@@unique([tenantId, slug])`
  - [x] Adicionar relações reversas no modelo `Tenant` (`websiteConfig`, `churchSchedules`, `tenantNews`)
- [x] Executar migração e geração do Prisma Client:
  - [x] Rodar `npx prisma migrate dev --name add_tenant_website_module` em `apps/api` (aplicada migration limpa `20261113124500_add_tenant_website_module` via `prisma migrate deploy` devido a terminal não interativo)
  - [x] Validar o arquivo SQL gerado em `apps/api/prisma/migrations/`
  - [x] Executar `npx prisma generate` e validar tipagens geradas
- [x] Auditar slugs já cadastrados na base local verificando ausência de conflito com a lista de slugs reservados *(conferir staging/produção antes do deploy)*
- [x] Critério de validação da etapa: Prisma Client compilando sem erros e tabelas criadas no banco local com chaves estrangeiras e índices aplicados.

### Etapa 1 - `RESERVED_SLUGS`, Storage e Módulo `WebsiteModule` no Backend (Fase 1)
Status: concluido

- [x] Criar lista canônica de slugs reservados em `apps/api/src/common/constants/reserved-slugs.ts` cobrindo todas as rotas raiz e reservas de sistema (`admin`, `api`, `auth`, `login`, `activate`, `locale`, `manifest.webmanifest`, `onboarding`, `validar-carteirinha`, `dashboard`, `membros`, `ministerios`, `escalas`, `agenda`, `documentos`, `financeiro`, `grupos`, `integracoes`, `meu-perfil`, `configuracoes`, `minhas-escalas`, `personal-panel`, `join`, `site`, `robots.txt`, `sitemap.xml`, `offline.html`, `sw.js`, `_next`, `favicon.ico`)
- [x] Aplicar validação de `RESERVED_SLUGS` na gestão de tenants:
  - [x] Atualizar `apps/api/src/modules/super-admin/dto/create-tenant.dto.ts` e `update-tenant.dto.ts`
  - [x] Atualizar `apps/api/src/modules/super-admin/super-admin.service.ts` (`createTenant` e `updateTenant`) lançando `BadRequestException`/`ConflictException` para slugs reservados
  - [x] Atualizar `apps/api/src/modules/super-admin/super-admin.service.spec.ts` cobrindo rejeição de slug reservado
- [x] Estender helpers de mídia e storage para imagens do site:
  - [x] Adicionar helpers de caminho (`getWebsiteBannerPath`, `getWebsitePastorsPhotoPath`, `getWebsiteNewsImagePath`) em `apps/api/src/common/storage/image-upload.ts`
  - [x] Reutilizar `SupabaseStorageService` e `validateImageUpload` (limite `MAX_IMAGE_SIZE` de 5 MB) com bucket público configurado (ou documentar criação do bucket público no Supabase Storage)
- [x] Criar DTOs do módulo de website em `apps/api/src/modules/website/dto/`:
  - [x] `update-website-config.dto.ts` com validações estritas de texto e URLs `http://`/`https://`
  - [x] `create-church-schedule.dto.ts` e `update-church-schedule.dto.ts`
  - [x] `reorder-schedules.dto.ts`
  - [x] `create-tenant-news.dto.ts` e `update-tenant-news.dto.ts` (texto estruturado sem HTML bruto)
- [x] Implementar serviço `apps/api/src/modules/website/website.service.ts`:
  - [x] Método `getPublicSiteData(slug: string)` retornando dados públicos consolidados (somente para `tenant.ativo === true`; `404` caso contrário)
  - [x] Método `getPublicNewsBySlug(slug: string, noticiaSlug: string)`
  - [x] Métodos administrativos de configuração (`getConfig`, `updateConfig`) com isolamento por `tenantId` e registro em `AuditLog`
  - [x] Métodos de upload/remoção de banner, foto pastoral e imagem de notícia com exclusão do objeto anterior no Storage
  - [x] Métodos CRUD e reordenação de `ChurchSchedule`
  - [x] Métodos CRUD de `TenantNews` com geração de slug único por tenant e tratamento de colisão
- [x] Implementar controladores em `apps/api/src/modules/website/`:
  - [x] `public-website.controller.ts` (`@Controller('public/site')`, `@Public()`, `@UseGuards(ThrottlerGuard)`)
  - [x] `website.controller.ts` (`@Controller('site')`, `@Roles(Role.ADMIN, Role.STAFF)`)
- [x] Registrar `WebsiteModule` em `apps/api/src/app.module.ts`
- [x] Criar suíte de testes unitários em `apps/api/src/modules/website/website.service.spec.ts`:
  - [x] Teste de leitura pública por slug ativo e retorno `404` para slug inexistente ou tenant inativo
  - [x] Teste de isolamento multi-tenant no CRUD de cultos e notícias
  - [x] Teste de geração e unicidade de slug de notícia por tenant
  - [x] Teste de upload/remoção de mídia e validação de URLs
- [x] Critério de validação da etapa: Testes unitários do módulo (`npm run test -w apps/api -- website.service.spec.ts super-admin.service.spec.ts`) passando 100% e `npm run build -w apps/api` com exit code 0.

### Etapa 2 - Roteamento Dinâmico, Migração `/join/[slug]` → `/[slug]/cadastro` e Configuração Next.js (Fase 1)
Status: concluido

- [x] Criar lista compartilhada de slugs reservados no frontend em `apps/web/src/lib/reserved-slugs.ts` espelhando `apps/api/src/common/constants/reserved-slugs.ts`
- [x] Atualizar `apps/web/next.config.ts`:
  - [x] Configurar `images.remotePatterns` permitindo o host do Supabase Storage para uso seguro de `next/image`
- [x] Atualizar `apps/web/src/middleware.ts`:
  - [x] Liberar acesso público sem autenticação apenas para rotas válidas do portal institucional (`/[slug]`, `/[slug]/cadastro`, `/[slug]/og`, `/[slug]/noticias/[noticiaSlug]`) quando `[slug]` não estiver em `RESERVED_SLUGS`
  - [x] Manter proteção integral por `access_token` e regras de `SUPER_ADMIN` / `BASIC` em todas as rotas privadas e administrativas (incluindo `/configuracoes/site` liberado para `ADMIN` e `STAFF` e bloqueado para `BASIC`)
- [x] Criar cliente HTTP do portal público em `apps/web/src/lib/api-website.ts`:
  - [x] Função `getPublicSiteData(slug: string)` usando `INTERNAL_API_URL || NEXT_PUBLIC_API_URL` para Server Components
  - [x] Função `getPublicNewsItem(slug: string, noticiaSlug: string)`
- [x] Migrar rota de auto-cadastro sem conflito de build:
  - [x] Mover/compartilhar `PublicJoinClient` e `getPublicTenantInfoServer` de `apps/web/src/app/(public)/join/[slug]/` para `apps/web/src/components/public-site/join/` (ou `apps/web/src/app/[slug]/cadastro/`)
  - [x] Criar `apps/web/src/app/[slug]/cadastro/page.tsx` com `generateMetadata` usando a URL canônica `/[slug]/cadastro`
  - [x] Criar `apps/web/src/app/[slug]/og/route.tsx` (e manter suporte OG para `/[slug]` e `/[slug]/cadastro`)
  - [x] Remover `apps/web/src/app/(public)/join/[slug]/page.tsx` e `apps/web/src/app/(public)/join/[slug]/og/route.tsx`
  - [x] Criar handler `apps/web/src/app/join/[slug]/route.ts` respondendo redirect `301` para `/${encodeURIComponent(slug)}/cadastro`
- [x] Atualizar `apps/web/src/components/app/join-link-card.tsx` para gerar link e QR Code no endereço canônico `${origin}/${slug}/cadastro`
- [x] Atualizar validação/feedback de slug no painel Super Admin (`apps/web/src/app/(admin)/admin/page.tsx`) bloqueando slugs em `RESERVED_SLUGS`
- [x] Critério de validação da etapa: `npm run build -w apps/web` sem conflito de rotas; `/join/[slug]` redirecionando `301` para `/[slug]/cadastro`; rotas protegidas continuando com redirect para `/login`.

### Etapa 3 - Painel Administrativo CMS (`/configuracoes/site`) no Dashboard (Fase 1)
Status: implementado (pendente validação E2E manual)

- [ ] Consultar referências pontuais no Mobbin (MCP `mobbin_mobbin`) apenas para padrões de formulários com abas e preview/upload de mídia mantendo aderência total ao One Elo Design System (ODS) *(observação: MCP `mobbin_mobbin` indisponível por falha de stream SSE; UI construída seguindo integralmente o ODS)*
- [x] Atualizar `apps/web/src/components/app/sidebar.tsx` e traduções:
  - [x] Adicionar item **"Site da Igreja"** (`/configuracoes/site`) visível para `ADMIN` e `STAFF` (`staffOnly: true`), usando SVG inline no padrão `ICONS` e entrada em `EXACT_ROOTS`
  - [x] Atualizar chaves i18n em `apps/web/messages/pt-BR.json`, `apps/web/messages/pt-PT.json` e `apps/web/messages/en-US.json`
- [x] Criar rota interna de revalidação sob demanda em `apps/web/src/app/api/site/revalidate/route.ts` (ou mecanismo equivalente) chamada após alterações no CMS para atualizar o cache de `/[slug]`
- [x] Criar página administrativa `apps/web/src/app/(dashboard)/configuracoes/site/page.tsx`:
  - [x] Cabeçalho no padrão ODS (`PageHeader`) com botão **"Visualizar Site Público"** abrindo `/[slug]` em nova aba e botão de copiar link do site
  - [x] Abas via `TabsShell`:
    - [x] Aba **Aparência & Hero**: upload/remoção de banner, título de boas-vindas, subtítulo e versículo tema
    - [x] Aba **Cultos Regulares**: listagem, criação, edição, ativação/desativação, exclusão (`ConfirmDialog`) e reordenação
    - [x] Aba **Informativos**: listagem de notícias, criação/edição com texto estruturado seguro e upload/remoção de imagem de capa
    - [x] Aba **Sobre & Pastores**: história, visão/valores, nomes/bio dos pastores presidentes e upload/remoção de foto pastoral
    - [x] Aba **Contato & Redes**: endereço estruturado, horário da secretaria, Instagram, YouTube, Facebook, Spotify, WhatsApp e link do Google Maps (validados com `http(s)://`)
- [x] Criar componentes modulares do CMS em `apps/web/src/components/app/site/`:
  - [x] `schedule-form-modal.tsx` (seguindo `ModalShell` e `FORM_STANDARD.md`)
  - [x] `news-form-modal.tsx` (seguindo `ModalShell` e `FORM_STANDARD.md`)
- [x] Atualizar `ai-context/backlog/permissions-matrix.md` documentando acesso de `ADMIN` e `STAFF` ao CMS do site
- [ ] Critério de validação da etapa: Usuário `ADMIN` e `STAFF` conseguindo editar configurações, subir banner/foto, cadastrar cultos e publicar notícias com persistência e visualização imediata em `/[slug]`.

### Etapa 4 - Portal Institucional Público Mobile-First e Open Graph (Fase 1)
Status: implementado (pendente validação E2E manual)

- [ ] Pesquisar referências visuais no Mobbin (MCP `mobbin_mobbin`, seção por seção) antes de desenhar os componentes públicos, buscando estética editorial limpa ("anti-IA"): *(observação: MCP `mobbin_mobbin` indisponível por falha de stream SSE; componentes desenhados seguindo o ODS + paleta editorial clara)*
  - [ ] Referências de **Header + Hero institucional** acolhedor com CTA e botão de acesso ("Área de Membros")
  - [ ] Referências de **cards de programação/horários** e lista de eventos/cultos
  - [ ] Referências de **feed de comunicados/notícias** e tela de leitura individual
  - [ ] Referências de **seção institucional / contato / localização e rodapé**
- [x] Criar layout institucional público em `apps/web/src/app/[slug]/layout.tsx`:
  - [x] Carregamento SSR/ISR (`revalidate: 60`) chamando `getPublicSiteData(slug)` e retornando `notFound()` quando o tenant não existir ou estiver inativo
  - [x] `generateMetadata` com `og:title`, `og:description`, `og:image` apontando para `/[slug]/og` (ou banner/logo validados) e título da igreja
- [x] Criar página `apps/web/src/app/[slug]/not-found.tsx` amigável para slugs inválidos ou igrejas inativas
- [x] Implementar componentes do portal público em `apps/web/src/components/public-site/`:
  - [x] `site-header.tsx`: cabeçalho responsivo com logo oficial, links de seção, CTA de boas-vindas e botão **"Área de Membros"** para `/login`
  - [x] `site-hero.tsx`: hero banner editorial acolhedor com imagem otimizada (`next/image`), versículo tema e CTA para `/[slug]/cadastro`
  - [x] `site-schedules-section.tsx`: grade responsiva de cultos com dia da semana, horário e badge de modalidade (`Presencial`, `Online`, `Híbrido`)
  - [x] `site-news-section.tsx`: grid/cards de informativos e avisos ativos com link para `/[slug]/noticias/[noticiaSlug]`
  - [x] `site-about-section.tsx`: história da comunidade, visão/valores e apresentação da liderança pastoral
  - [x] `site-location-section.tsx`: endereço completo, horário da secretaria e botão **"Como Chegar"** (via link seguro de Google Maps gerado pelo endereço ou URL validada, sem `iframe` frágil)
  - [x] `site-footer.tsx`: redes sociais, canais de transmissão e rodapé discreto "Feito com One Elo"
- [x] Implementar páginas públicas:
  - [x] `apps/web/src/app/[slug]/page.tsx`: composição modular da página inicial da igreja (respeitando direção editorial limpa e mobile-first)
  - [x] `apps/web/src/app/[slug]/noticias/[noticiaSlug]/page.tsx`: leitura completa do comunicado/notícia em texto seguro (sem HTML não sanitizado), com `generateMetadata` próprio e botão de retorno para `/[slug]`
- [ ] Critério de validação da etapa: Navegação completa em mobile (`375px`/`412px`) e desktop (`1280px+`) em `/[slug]`, `/[slug]/noticias/[noticiaSlug]` e `/[slug]/cadastro`, sem erros de console ou quebra de `next/image`.

### Etapa 5 - Validação Integrada, Testes e Documentação da Fase 1 (FT-019A)
Status: parcial (testes unitários e builds validados; pendente validação manual E2E e correções de lint pré-existentes no repo)

- [x] Executar suíte de testes do backend (`npm run test -w apps/api`):
  - [x] Garantir 100% dos testes unitários existentes e novos passando sem regressões
- [ ] Executar checagens de tipagem, lint e build:
  - [ ] `npx eslint "src/**/*.ts"` (sem `--fix`) em `apps/api` *(há apontamentos de formatação Prettier / tipos Multer pré-existentes no repo)*
  - [ ] `npm run lint -w apps/web` *(arquivos do módulo Website com 0 erros; `lint` global falha em 135 erros pré-existentes de outros módulos)*
  - [x] `npm run build -w apps/api`
  - [x] `npm run build -w apps/web`
- [ ] Validação manual de ponta a ponta (desktop e mobile):
  - [ ] Testar criação de tenant bloqueando slugs de `RESERVED_SLUGS`
  - [ ] Acessar `/[slug]`, validar seções, clique em "Área de Membros" (`/login`) e CTA (`/ [slug]/cadastro`)
  - [ ] Acessar `/join/[slug]` e confirmar redirect `301` para `/[slug]/cadastro`
  - [ ] Testar edição no CMS (`/configuracoes/site`) como `ADMIN` e `STAFF` e confirmar atualização no portal público
  - [ ] Validar preview Open Graph da URL `/[slug]` e `/[slug]/cadastro`
- [x] Atualizar documentação da Fase 1:
  - [x] Atualizar status em `ai-context/backlog/site-institucional-tenant.md` e `ai-context/backlog/README.md`
  - [x] Atualizar índice em `ai-context/plans/README.md`
- [ ] Critério de validação da etapa: Todos os builds (`apps/api` e `apps/web`) e testes passando com exit code 0 e Fluxo Fase 1 validado ponta a ponta.

### Etapa 6 - Domínio Próprio Customizado + Vercel Domains API (Fase 2 / FT-019B)
Status: implementado em código (pendente validação real em staging com credenciais Vercel e domínio de teste)

- [x] Definir regra de elegibilidade por plano (`Plano`) para uso de domínio próprio no tenant
- [x] Implementar cliente da **Vercel Domains API** no backend (`apps/api/src/modules/website/vercel-domains.service.ts`):
  - [x] Variáveis de ambiente documentadas em `apps/api/.env.example` (`VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID`, `CUSTOM_DOMAIN_CNAME_TARGET`, `CUSTOM_DOMAIN_APEX_IP`)
  - [x] Registro automático e remoção do domínio no projeto Vercel ao salvar/remover `customDomain`
- [x] Implementar resolução e verificação no `WebsiteService` / `WebsiteController`:
  - [x] Endpoints protegidos `PUT /api/site/custom-domain`, `POST /api/site/custom-domain/verify` e `DELETE /api/site/custom-domain` (restrito a `ADMIN` + auditoria)
  - [x] Verificação combinada: status na Vercel Domains API + `dns.promises.resolveCname` (subdomínios) / `resolve4` + `resolveTxt` (domínio raiz/apex)
  - [x] Endpoint público `GET /api/public/site/resolve?domain=...` retornando apenas `{ slug }` para tenants ativos com `dnsStatus === 'ACTIVE'`
- [x] Atualizar `apps/web/src/middleware.ts` para suporte multi-host:
  - [x] Lista configurável de hosts principais do sistema (produção, staging Vercel, `localhost`) que não entram no fluxo de domínio próprio
  - [x] Lookup com cache Edge de TTL curto e timeout curto (~1.5s) para mapear `Host → slug`
  - [x] Rewrite transparente restrito exclusivamente a `/`, `/cadastro`, `/og` e `/noticias/*` para `/[slug]...`
  - [x] Garantir que links **"Área de Membros"** (`/login`) em domínio próprio direcionem para `NEXT_PUBLIC_APP_URL` / domínio canônico do One Elo para preservar cookies `access_token`, OAuth Google e `CORS_ORIGIN`
- [x] Adicionar aba **"Domínio Próprio"** em `/configuracoes/site` com componente `apps/web/src/components/app/site/domain-setup-card.tsx` (card ODS com instruções de `CNAME` / `A` + `TXT`, badge de status DNS/SSL e botão "Verificar Apontamento")
- [ ] Executar testes, build e validação real em staging com domínio de teste
- [ ] Critério de validação da etapa: Domínio customizado validado via Vercel Domains API + DNS com SSL ativo, servindo o portal público na raiz sem interferir em `/login`, `/api/*` ou cookies do One Elo.

---

## 5. Critérios de Aceite Gerais

- [ ] Cada igreja ativa possui site institucional público responsivo em `oneelo.com.br/[slug]`, retornando `404` para slugs inexistentes ou tenants inativos.
- [ ] Nenhuma colisão de rota é permitida: `RESERVED_SLUGS` é validado no `SuperAdminService`, DTOs, UI administrativa e `middleware.ts`.
- [ ] O auto-cadastro reside em `/[slug]/cadastro`, `JoinLinkCard` e Open Graph apontam para o endereço canônico, e `/join/[slug]` redireciona (`301`) sem conflito de build.
- [ ] O CMS em `/configuracoes/site` está acessível para `ADMIN` e `STAFF` na `Sidebar` e no backend, com isolamento multi-tenant e atualização imediata do portal após edição.
- [ ] Imagens de banner, pastores e informativos usam upload seguro no Supabase Storage com `images.remotePatterns` configurado em `apps/web/next.config.ts`.
- [ ] Conteúdos de notícias e links externos possuem proteção contra XSS e URLs inválidas (`http(s)://` apenas), e "Como Chegar" funciona de forma confiável no desktop e mobile.
- [ ] Na Fase 2 (FT-019B), domínios customizados são provisionados com SSL via Vercel Domains API, com rewrite restrito no `middleware.ts` sem quebrar login, OAuth, CORS ou PWA.
- [ ] Todos os testes automatizados, checagens de lint/tipos e builds de produção (`apps/api` e `apps/web`) passam sem erros ou regressões.
