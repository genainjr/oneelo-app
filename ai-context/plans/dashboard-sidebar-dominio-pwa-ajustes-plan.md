# Plano - Ajustes de Empilhamento da Sidebar, Padronização PWA e Domínio Próprio no Link de Cadastro

Status geral: concluido  
Data de criação: 2026-11-17  
Branch sugerida para implementação: fix/dashboard-sidebar-dominio-pwa-ajustes  

## Planos e Referências Relacionados

- [sidebar-flyout-zindex-plan.md](sidebar-flyout-zindex-plan.md)
- [site-institucional-tenant-plan.md](site-institucional-tenant-plan.md)
- [README.md](README.md)

---

## 1. Objetivo da Entrega

Atender a três correções pontuais e críticas de usabilidade e identidade visual solicitadas pelo usuário:

1. **Correção de Empilhamento e Z-Index da Sidebar:** Impedir que o container de filtros (`FilterShell`) e o conteúdo das páginas fiquem sobrepondo os submenus flutuantes (*flyouts*) da sidebar colapsada em telas como `/membros`, `/ministerios`, `/escalas` e `/financeiro`.
2. **Padronização Visual do Botão "Trocar ícone" no PWA:** Ajustar os botões de upload e remoção do "Ícone quadrado" em `TenantPwaSettings` para seguirem estritamente o padrão ODS do `ImageUploadPanel` (`bg-brand`, ícone `Upload` e `Trash2`).
3. **Suporte a Domínio Próprio no Card de Auto-Cadastro:** Fazer com que o `JoinLinkCard` nas Configurações exiba, copie, gere QR Code e abra o link de cadastro com o domínio próprio ativo do cliente (ex: `https://ccrv.org.br/cadastro`) quando configurado, mantendo fallback gracioso para o domínio padrão (`https://oneelo.vercel.app/${slug}/cadastro`).

---

## 2. Contexto e Diagnóstico

1. **Sobreposição do Filtro na Sidebar (`apps/web/src/components/app/sidebar.tsx`):**
   - No breakpoint desktop, o `<aside>` da `Sidebar` utilizava `lg:static lg:z-auto`.
   - Concomitantemente, o `<aside>` possui `transform: translateX(0px)` (`lg:translate-x-0`), o que pela especificação do CSS W3C cria um novo contexto de empilhamento local isolado.
   - Como o container irmão subsequente (`DashboardShell` -> `main`) contém o `FilterShell` e inputs renderizados após o `<aside>` no DOM, o navegador pintava o card do filtro **por cima** do flyout da sidebar.
2. **Botões de Troca de Ícone no PWA (`apps/web/src/components/app/tenant-pwa-settings.tsx`):**
   - Os botões de upload e exclusão utilizavam estilos ad-hoc em outline (`border border-accent-soft-border text-accent-ink`) sem os ícones de ação (`Upload`, `Trash2`, `Loader2`), destoando do componente `ImageUploadPanel` localizado logo acima na mesma tela.
3. **Card do Link de Auto-Cadastro (`apps/web/src/components/app/join-link-card.tsx`):**
   - O componente construía a URL utilizando estritamente `window.location.origin` concatenado com `/${slug}/cadastro`.
   - Como o painel do administrador é acessado via `oneelo.vercel.app` (ou domínio central), o link gerado sempre apontava para o domínio genérico, mesmo quando a igreja já possuía domínio customizado configurado (ex: `ccrv.org.br`).

---

## 3. Decisões de Arquitetura, Riscos e Engenharia

1. **Elevação do Contexto de Empilhamento do `<aside>`:**
   - No desktop, aplicar `lg:relative lg:z-40` ao `<aside>`, garantindo que a barra lateral e todos os seus menus flutuantes tenham precedência de empilhamento sobre os containers de página (`FilterShell`, `DataTable`, etc.).
   - Incorporar ajuste no cálculo de posicionamento vertical do flyout para evitar corte inferior na viewport, além de listeners para fechar o flyout em scroll/resize e mudança de rota.
2. **Harmonização do `TenantPwaSettings`:**
   - Adotar classes oficiais do Design System: `bg-brand text-brand-foreground hover:bg-brand-hover` com ícone `<Upload />` no botão principal, e `border border-red-200 text-red-700 hover:bg-red-50` com `<Trash2 />` no botão de remover.
3. **Resolução de Domínio Customizado no `JoinLinkCard`:**
   - O `JoinLinkCard` passa a receber `customDomain?: string | null`.
   - Em caso de ausência no contexto imediato, realiza consulta resiliente à configuração do site (`/api/site/config`) para checar se há domínio configurado.
   - Se houver domínio próprio: URL torna-se `https://${cleanDomain}/cadastro`.
   - Se não houver: mantém fallback `https://oneelo.vercel.app/${slug}/cadastro`.
   - Todas as ações do card (Copiar, QR Code e Visualizar) passam a refletir o domínio resolvido.

---

## 4. Etapas de Desenvolvimento

> **Regra de Execução:** O desenvolvimento deve avançar estritamente etapa por etapa. Ao concluir uma tarefa ou etapa, atualize imediatamente seu checkbox para `[x]`, apresente o resumo das validações e aguarde a autorização explícita do usuário antes de iniciar a etapa seguinte.

### Etapa 0 - Preparação e Isolamento da Branch
Status: concluido

- [x] Confirmar branch `fix/dashboard-sidebar-dominio-pwa-ajustes` criada a partir de `development`.
- [x] Validar que o repositório está limpo e sincronizado com `origin/development`.
- [x] Critério de validação da etapa: Branch de trabalho criada e pronta para receber os ajustes.

### Etapa 1 - Correção do Empilhamento da Sidebar e Flyouts
Status: concluido

- [x] Atualizar `apps/web/src/components/app/sidebar.tsx`:
  - [x] Alterar `<aside>` no desktop para `lg:relative lg:z-40` (removendo `lg:static lg:z-auto`).
  - [x] Ajustar overlay mobile para `z-30` e container aside para `z-40`.
  - [x] Implementar cálculo de topo ajustado (`adjustedTop`) no flyout para evitar overflow na parte inferior da tela.
  - [x] Adicionar fechamento automático do flyout em eventos de scroll no nav e resize de janela.
  - [x] Adicionar fechamento do flyout e do seletor de idiomas ao mudar de rota (`pathname`).
- [x] Critério de validação da etapa: Flyout de submenus na sidebar colapsada renderiza 100% sobreposto ao `FilterShell` e elementos de página em `/membros`.

### Etapa 2 - Padronização Visual dos Botões em `TenantPwaSettings`
Status: concluido

- [x] Atualizar `apps/web/src/components/app/tenant-pwa-settings.tsx`:
  - [x] Importar ícones `Loader2`, `Trash2` e `Upload` de `lucide-react`.
  - [x] Padronizar botão de upload/troca com `bg-brand text-brand-foreground hover:bg-brand-hover` e ícone correspondente.
  - [x] Padronizar botão de remoção com `border-red-200 text-red-700 hover:bg-red-50` e ícone de lixeira.
- [x] Critério de validação da etapa: Botões do PWA exibem mesma linguagem visual, cores e ícones do `ImageUploadPanel`.

### Etapa 3 - Suporte a Domínio Próprio no `JoinLinkCard`
Status: concluido

- [x] Atualizar `apps/web/src/components/app/join-link-card.tsx`:
  - [x] Aceitar prop opcional `customDomain?: string | null`.
  - [x] Adicionar consulta interna a `/api/site/config` para resolução automática quando `customDomain` for omitido.
  - [x] Construir `joinUrl` priorizando `https://${resolvedDomain}/cadastro` quando ativo.
  - [x] Atualizar geração do QR Code, cópia para clipboard e link de visualização com a URL resolvida.
- [x] Atualizar `apps/web/src/app/(dashboard)/configuracoes/page.tsx`:
  - [x] Passar `customDomain` para o `<JoinLinkCard />` se disponível.
- [x] Critério de validação da etapa: Tenant com domínio `ccrv.org.br` exibe e copia `https://ccrv.org.br/cadastro` e gera QR Code correspondente.

### Etapa 4 - Validação Integrada, Build e Não-Regressão
Status: concluido

- [x] Executar typecheck e linting no `apps/web`.
- [x] Executar build de produção do frontend (`npm run build --prefix apps/web`).
- [x] Validar telas afetadas: `/membros` (sidebar z-index), `/configuracoes` (botão PWA e JoinLinkCard com domínio).
- [x] Critério de validação da etapa: Build do Next.js compilando com código 0 e sem erros de TypeScript ou layout.

---

## 5. Critérios de Aceite Gerais

- [x] O flyout da sidebar colapsada nunca fica por baixo do `FilterShell` ou cards das páginas.
- [x] O botão "Trocar ícone" do aplicativo segue rigorosamente o padrão visual do botão da logo (`bg-brand`, ícone de upload).
- [x] O card de auto-cadastro reflete o domínio próprio do tenant (ex: `https://ccrv.org.br/cadastro`) em vez do domínio genérico.
- [x] Fallback preservado para igrejas sem domínio próprio cadastrado.
- [x] Build e testes passando com sucesso.
