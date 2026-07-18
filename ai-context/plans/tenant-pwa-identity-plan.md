# Plano - PWA com nome e ícone da igreja

Status geral: implementação em andamento na branch `feature/tenant-pwa-identity`
Última atualização: 2026-07-18

Branch de planejamento: `docs/tenant-branded-experience-backlog`

Backlog de origem: `ai-context/backlog/tenant-branded-experience.md`

Entrega de origem: `Entrega 1 - PWA reconhecível como aplicativo da igreja`

## Objetivo

Permitir que um usuário autenticado instale o PWA do OneElo com o nome e o ícone da própria igreja e, ao abrir o aplicativo, permaneça no tenant e na página correspondente ao seu perfil.

A entrega deve gerar valor perceptível sem depender de:

- login por slug;
- subdomínio;
- domínio personalizado;
- tema completo por tenant;
- editor de conteúdo;
- reconstrução da página pessoal.

## Resultado esperado ao final do plano

- `ADMIN` configura um nome curto e um ícone quadrado para o aplicativo da igreja.
- O backend valida e gera as variantes necessárias do ícone.
- O manifesto usado no ambiente autenticado contém nome, nome curto, ícones e identificador estável do tenant.
- Android/Chrome oferece `Instalar app {Nome da igreja}` com identidade correta.
- iPhone/Safari usa título e Apple Touch Icon da igreja no fluxo `Adicionar à Tela de Início`.
- O aplicativo instalado abre em `/dashboard`; o middleware mantém o redirecionamento atual de `BASIC` para `/personal-panel`.
- A sidebar e o prompt de instalação mantêm continuidade mínima com nome e logo da igreja.
- Tenants sem configuração válida continuam usando integralmente o PWA OneElo.
- Instalações antigas recebem orientação quando for necessário remover e instalar novamente.
- Nenhuma regra de tenant, autenticação, RBAC, PWA ou PushSubscription é enfraquecida.

## Valor entregue ao cliente

O membro encontra no celular um aplicativo reconhecível como parte da sua igreja, em vez de um atalho genérico do fornecedor.

O administrador consegue configurar essa identidade sem intervenção da equipe técnica do OneElo.

Hipóteses a validar:

- nome e ícone da igreja aumentam reconhecimento e confiança;
- o prompt contextualizado aumenta a intenção de instalação;
- o usuário encontra o aplicativo com mais facilidade depois da instalação;
- a continuidade visual reduz dúvida sobre estar no tenant correto.

## Estado atual do código

### Já existe

- `Tenant.nome`, `Tenant.slug`, `Tenant.logoUrl` e `Tenant.logoKey` no Prisma.
- Upload e remoção da logo pelo `ADMIN` do tenant.
- Upload público no bucket `tenant-logos` do Supabase Storage.
- `TenantMediaService` com auditoria de alterações de logo.
- `GET /api/auth/me` retornando nome, slug e logo do tenant.
- Manifesto PWA em `apps/web/src/app/manifest.ts`.
- Metadados Apple e ícones globais em `apps/web/src/app/layout.tsx`.
- Service Worker e fallback offline.
- Prompt de instalação no layout autenticado.
- Tratamento de `beforeinstallprompt` no Android/Chromium.
- Orientação manual para `Adicionar à Tela de Início` no iOS.
- Middleware que redireciona `BASIC` de `/dashboard` para `/personal-panel`.
- Proxy do Next.js para `/api/*` em desenvolvimento e produção.
- Infraestrutura de PWA e PushSubscription já em produção.

### Ainda não existe

- nome curto do aplicativo por tenant;
- ícone específico do PWA por tenant;
- validação de dimensões e área segura do ícone;
- geração de variantes 180, 192, 512 e maskable;
- manifesto dinâmico por tenant;
- `id` de PWA diferente por tenant;
- metadados Apple dinâmicos no layout autenticado;
- configuração do PWA na tela de Configurações;
- prompt de instalação usando a identidade da igreja;
- estratégia explícita para instalações antigas;
- testes automatizados para manifesto e mídia do PWA.

## Decisões fechadas

### 1. Ícone do PWA é diferente da logo institucional

O tenant terá um ícone dedicado ao aplicativo.

Motivos:

- logos podem ser horizontais;
- textos pequenos ficam ilegíveis na tela inicial;
- Android pode aplicar máscaras circulares ou arredondadas;
- Apple Touch Icon exige composição quadrada;
- trocar a logo de documentos não deve alterar silenciosamente o ícone já instalado.

A logo existente poderá ser exibida como referência na configuração, mas não será usada automaticamente como ícone publicado sem passar pela validação e confirmação do administrador.

### 2. Nome completo vem de `Tenant.nome`

O campo `name` do manifesto será o nome atual do tenant.

Um novo campo opcional `pwaShortName` será usado em `short_name` e nas superfícies com pouco espaço.

Regras iniciais:

- remover espaços externos;
- não aceitar valor vazio;
- limitar o nome curto a 12 caracteres na primeira entrega;
- permitir letras, números, espaços e caracteres usuais do idioma;
- usar `Tenant.nome` reduzido de forma segura apenas na pré-visualização;
- exigir confirmação explícita do nome curto antes de publicar a identidade personalizada.

### 3. Ativação da personalização sem feature flag

Não será criada chave `.env` nem feature flag para o PWA por tenant.

A personalização estará ativa quando houver simultaneamente:

- `pwaShortName` válido;
- conjunto completo de variantes do ícone publicado.

Se a configuração estiver incompleta, o manifesto deve retornar o padrão OneElo.

### 4. Campos dedicados no Tenant

Adicionar ao `Tenant`:

```prisma
pwaShortName String?   @map("pwa_short_name")
pwaIconUrl   String?   @map("pwa_icon_url")
pwaIconKey   String?   @map("pwa_icon_key")
pwaUpdatedAt DateTime? @map("pwa_updated_at")
```

Contrato:

- `pwaIconUrl` aponta para a variante principal de 512×512;
- `pwaIconKey` aponta para a chave da variante principal;
- as demais variantes seguem convenção determinística resolvida por helper único;
- `pwaUpdatedAt` muda quando nome curto ou ícone é publicado ou removido;
- os campos são opcionais para preservar todos os tenants existentes.

### 5. Processamento de imagem no backend

Adicionar `sharp` como dependência direta da API. Não depender da instalação transitiva do Next.js.

O backend deve:

- aceitar PNG, JPEG ou WEBP;
- manter o limite atual de 5 MB;
- ler dimensões reais da imagem;
- rejeitar imagem menor que 512×512;
- rejeitar proporção que não possa ser tratada como quadrada sem perda inesperada;
- remover metadados não necessários;
- gerar PNGs 180×180, 192×192 e 512×512;
- preservar uma variante quadrada 512×512 para a pré-visualização administrativa;
- gerar variante 512×512 preparada para `maskable`;
- não distorcer a imagem;
- manter o conteúdo principal dentro da área segura;
- armazenar todas as variantes antes de publicar a nova configuração;
- limpar uploads parciais se uma variante falhar;
- excluir as variantes anteriores somente depois da atualização concluída.

A interface deve mostrar prévias quadrada, circular e arredondada antes do envio.

### 6. Reutilizar o armazenamento atual de mídia do tenant

Não criar bucket novo nesta entrega.

Usar o bucket `tenant-logos` com caminho separado:

```text
tenants/{tenantId}/pwa/{versao}/icon-180.png
tenants/{tenantId}/pwa/{versao}/icon-192.png
tenants/{tenantId}/pwa/{versao}/icon-512.png
tenants/{tenantId}/pwa/{versao}/icon-square-512.png
tenants/{tenantId}/pwa/{versao}/icon-maskable-512.png
```

O helper de mídia deve centralizar criação, resolução e remoção desse conjunto.

### 7. Manifesto público por slug contém somente branding

Criar endpoint público:

```text
GET /api/pwa/:slug/manifest.webmanifest
```

O endpoint pode ser público porque retorna apenas:

- nome público da igreja;
- nome curto do aplicativo;
- URLs públicas dos ícones;
- configuração técnica do manifesto.

Não retornar usuário, contatos, plano, limites ou dados operacionais.

Regras:

- resolver somente tenant ativo;
- retornar `Content-Type: application/manifest+json`;
- não aceitar `tenantId` arbitrário vindo do cliente autenticado como fonte de autorização;
- aplicar fallback OneElo se a personalização não estiver completa;
- permitir cache curto e invalidação por versão baseada em `pwaUpdatedAt`;
- escapar e serializar todo conteúdo como JSON, sem interpolação de HTML.

### 8. Identidade estável do PWA

Manifesto personalizado:

```json
{
  "name": "Nome completo da igreja",
  "short_name": "Nome curto",
  "id": "/pwa/tenant/{tenantId}",
  "start_url": "/dashboard?source=pwa",
  "scope": "/",
  "display": "standalone"
}
```

Regras:

- `id` deve ser estável e não usar nome, slug ou versão do ícone;
- `start_url` permanece no mesmo origin;
- `/dashboard` continua sendo a entrada comum;
- `BASIC` continua sendo redirecionado pelo middleware para `/personal-panel`;
- mudança de nome ou ícone não pode mudar o `id`;
- o manifesto global OneElo continua sendo o fallback para páginas públicas e tenants sem personalização.

### 9. Metadados devem chegar no HTML inicial

Não depender apenas de trocar o manifesto no navegador depois de `beforeinstallprompt`.

Direção técnica:

- tornar o layout autenticado um wrapper server-side capaz de resolver o usuário atual;
- mover o estado e interações atuais para um `DashboardShell` client-side;
- reutilizar o usuário carregado no servidor como `initialUser`;
- gerar metadata do segmento autenticado com manifesto, título Apple e Apple Touch Icon do tenant;
- manter fallback quando a API ou configuração personalizada estiver indisponível;
- garantir que cada documento autenticado possua um único manifesto efetivo.

Antes da implementação completa, executar um spike curto para confirmar no Next.js 16:

- sobrescrita do manifesto global pelo metadata do layout autenticado;
- presença de um único `<link rel="manifest">` no HTML final;
- atualização do `href` quando `pwaUpdatedAt` muda;
- comportamento de `beforeinstallprompt` após login e navegação;
- comportamento do Apple Touch Icon e título no Safari do iPhone.

Se o metadata aninhado não substituir o manifesto de modo confiável, usar uma rota autenticada de instalação renderizada no servidor como fallback técnico, sem ampliar o produto para login por slug.

### 10. Continuidade mínima ao abrir

Atualizar a identidade do app shell sem implementar o tema completo:

- sidebar expandida usa `tenant.logoUrl`, com fallback para ícone do PWA e depois OneElo;
- sidebar mostra `tenant.nome`;
- assinatura secundária usa `Tecnologia OneElo`;
- prompt de instalação usa nome curto e ícone do tenant;
- no mobile, o header deve manter contexto suficiente da igreja sem remover o título da página;
- nenhuma cor estrutural da sidebar será personalizada nesta entrega.

### 11. Instalações antigas

Alterações de nome e ícone não são atualizadas igualmente em todos os navegadores.

A entrega deve:

- detectar a versão de identidade vista pelo navegador usando `pwaUpdatedAt`;
- registrar localmente a versão apresentada no fluxo de instalação;
- mostrar orientação não bloqueante quando uma instalação antiga precisar ser removida e instalada novamente;
- apresentar instruções específicas para Android e iPhone;
- não afirmar que a atualização automática ocorreu sem evidência do navegador;
- documentar que o ícone no iOS pode exigir reinstalação.

### 12. Push e sessão permanecem invariantes

- Não recriar `PushSubscription` por causa da troca de ícone.
- Não alterar chaves VAPID.
- Não alterar Service Worker nesta entrega, salvo referência de ícone se tecnicamente necessária.
- Não cachear telas autenticadas.
- Não persistir dados do tenant no cache offline.
- Logout e expiração de sessão continuam levando ao login global.

## Escopo

### Incluído

- campos Prisma e migration aditiva;
- configuração de nome curto;
- upload, substituição e remoção do ícone do PWA;
- geração das variantes de imagem;
- manifesto por tenant;
- metadata autenticada para Chromium e Apple;
- atualização de tipos e payload de `/api/auth/me`;
- configuração em `/configuracoes` para `ADMIN`;
- prompt de instalação contextualizado;
- continuidade mínima na sidebar e header;
- orientação para instalações antigas;
- fallback OneElo;
- testes automatizados e roteiro manual em dispositivos reais;
- documentação de rollout e operação.

### Fora do escopo

- cor primária por tenant;
- logo clara e escura;
- login personalizado antes da autenticação;
- URL pública por slug;
- subdomínio ou domínio personalizado;
- página da igreja;
- editor de conteúdo;
- navegação configurável;
- melhoria ampla da página pessoal;
- alteração de notificações ou VAPID;
- aplicativo nativo;
- publicação em Play Store ou App Store;
- múltiplos tenants por usuário;
- remoção integral da marca OneElo.

## Contratos previstos

### Configuração

```text
PATCH /api/auth/tenant/pwa-settings
```

Payload:

```json
{
  "shortName": "CCRV"
}
```

Regras:

- somente `ADMIN` do tenant autenticado;
- validação no DTO e no service;
- alteração auditada;
- atualizar `pwaUpdatedAt`;
- retornar a configuração corrente do tenant.

### Ícone

```text
POST   /api/auth/tenant/pwa-icon
DELETE /api/auth/tenant/pwa-icon
```

Regras:

- somente `ADMIN`;
- upload multipart em memória com limite de 5 MB;
- processamento e publicação atômicos;
- remoção desativa a personalização e restaura fallback;
- não alterar `logoUrl` ou `logoKey`.

### Manifesto

```text
GET /api/pwa/:slug/manifest.webmanifest
```

Regras:

- público e somente leitura;
- tenant ativo;
- resposta sem dados privados;
- content type correto;
- fallback previsível;
- `id` estável;
- URLs de ícones no mesmo origin visível ao navegador ou absolutas e públicas.

## Impacto previsto no código

### Banco e API

- `apps/api/prisma/schema.prisma`;
- `apps/api/prisma/migrations/<timestamp>_add_tenant_pwa_identity/migration.sql`;
- `apps/api/package.json` e lockfile para `sharp`;
- `apps/api/src/common/storage/image-upload.ts`;
- `apps/api/src/common/storage/tenant-media.service.ts`;
- `apps/api/src/modules/auth/auth.controller.ts`;
- `apps/api/src/modules/auth/auth.service.ts`;
- novo DTO de configuração PWA;
- novo `PwaModule`, controller e service para manifesto público;
- testes de mídia, configuração e manifesto.

### Web

- `apps/web/src/app/manifest.ts` ou sua estratégia de fallback;
- `apps/web/src/app/layout.tsx`;
- `apps/web/src/app/(dashboard)/layout.tsx`;
- novo `DashboardShell` client-side se o layout for separado;
- helper server-side para carregar o usuário autenticado;
- `apps/web/src/components/app/install-app-prompt.tsx`;
- `apps/web/src/components/app/sidebar.tsx`;
- `apps/web/src/components/app/header.tsx`;
- `apps/web/src/app/(dashboard)/configuracoes/page.tsx`;
- novo componente de configuração e prévia do ícone;
- `apps/web/src/types/index.ts`;
- traduções `pt-BR`, `pt-PT` e `en-US`;
- roteiro ou componente de orientação para reinstalação.

### Documentação

- este plano;
- backlog `FT-012`;
- documentação de modelos;
- inventário do design system se novo componente reutilizável for criado;
- documentação operacional de deploy e validação PWA.

## Etapas de desenvolvimento

### Etapa 0 - Prova técnica do manifesto por tenant

Status: validação automatizada, iPhone e desktop concluída - Android pendente

- [x] Criar experimento mínimo com manifesto diferente no segmento autenticado.
- [x] Confirmar HTML inicial com apenas um manifesto efetivo.
- [x] Confirmar que a rota por slug funciona via rewrite da web para a API.
- [x] Confirmar `beforeinstallprompt` no Chrome com manifesto personalizado.
- [x] Confirmar nome e Apple Touch Icon no Safari/iPhone.
- [ ] Confirmar que `id` e `start_url` não criam instalação duplicada inesperada.
- [x] Registrar o resultado no plano antes de avançar.

Resultado parcial em 2026-07-18:

- o layout autenticado foi separado em wrapper server-side e `DashboardShell` client-side;
- a API simulada recebeu `/api/auth/me` com o cookie encaminhado corretamente;
- a build do Next.js 16.2.6 compilou com o segmento autenticado marcado como `force-dynamic`;
- a causa do manifesto global foi a precedência do arquivo especial `app/manifest.ts` sobre `generateMetadata`, conforme a documentação oficial do Next.js;
- o manifesto global passou a ser uma rota comum explicitamente referenciada pelo layout raiz, permitindo sobrescrita pelo layout autenticado;
- `htmlLimitedBots: /.*/` desabilita streaming de metadata para que manifesto, título e Apple Touch Icon estejam no HTML inicial;
- a build de produção retornou exatamente um manifesto, apontando para `/api/pwa/igreja-spike/manifest.webmanifest`;
- título, Apple Touch Icon e identidade do tenant também foram confirmados no HTML inicial;
- fallback global e rewrite do manifesto por slug responderam com `application/manifest+json`;
- o teste inicial com `Invoke-WebRequest` não encaminhou o cookie como esperado; a prova final foi repetida com `curl` e API local instrumentada;
- o fallback OneElo permaneceu seguro durante todas as tentativas.

Critério de saída:

- estratégia de metadata e manifesto validada em Chromium e iOS, ou fallback por rota dedicada de instalação escolhido e documentado.

### Etapa 1 - Modelo e migration

Status: concluída - migration aplicada e validada localmente; produção pendente de rollout

- [x] Adicionar campos opcionais ao `Tenant`.
- [x] Criar migration somente aditiva.
- [x] Atualizar selects e contratos necessários.
- [x] Atualizar documentação do modelo.
- [x] Executar `prisma format`, `prisma validate` e `prisma generate`.
- [x] Confirmar que a migration não executa seed.

Critério de saída:

- tenants existentes continuam válidos e recebem fallback sem atualização manual.

### Etapa 2 - Processamento e armazenamento do ícone

Status: concluída em código

- [x] Adicionar `sharp` como dependência direta da API.
- [x] Implementar validação de dimensão, proporção e formato.
- [x] Gerar as quatro variantes previstas.
- [x] Implementar paths versionados no bucket existente.
- [x] Garantir publicação atômica e limpeza em falha.
- [x] Garantir remoção segura das variantes antigas.
- [x] Registrar auditoria sem salvar o binário ou conteúdo sensível.
- [x] Cobrir helpers de imagem com testes unitários.

Critério de saída:

- upload válido publica o conjunto completo; upload inválido ou parcial não substitui a identidade anterior.

### Etapa 3 - Configuração administrativa e manifesto público

Status: concluída em código

- [x] Criar DTO e endpoint de nome curto.
- [x] Criar endpoints de upload e remoção do ícone.
- [x] Restringir mutações a `ADMIN` do próprio tenant.
- [x] Criar `PwaModule` e endpoint público por slug.
- [x] Retornar `application/manifest+json`.
- [x] Implementar fallback OneElo.
- [x] Garantir `id` estável e `start_url` correto.
- [x] Atualizar `/api/auth/me` e tipos.
- [x] Cobrir autorização, isolamento e manifesto com testes direcionados.

Critério de saída:

- configuração administrativa gera manifesto válido e nenhum endpoint permite alterar outro tenant.

### Etapa 4 - Metadata autenticada e app shell

Status: concluída em código - validação manual por perfil pendente

- [x] Separar server layout e client shell para o spike.
- [x] Criar carregamento server-side autenticado com cookie encaminhado à API.
- [x] Evitar busca duplicada de `/api/auth/me` por render usando `cache()` do React.
- [x] Implementar manifesto e metadata Apple por tenant e validar no HTML autenticado.
- [x] Preservar metadata OneElo em páginas públicas.
- [x] Atualizar sidebar com nome e logo da igreja.
- [x] Atualizar header mobile sem perder o título da página.
- [x] Manter co-branding discreto.
- [ ] Validar logout, sessão expirada, `ADMIN`, `STAFF` e `BASIC`.

Critério de saída:

- o HTML autenticado apresenta a identidade correta e a navegação atual não sofre regressão.

### Etapa 5 - Configuração e pré-visualização na web

Status: concluída em código

- [x] Adicionar seção `Aplicativo da igreja` em `/configuracoes`.
- [x] Exibir nome atual, nome curto e ícone corrente.
- [x] Implementar prévia quadrada, circular e arredondada.
- [x] Validar tamanho, formato e mensagens antes do upload.
- [x] Permitir trocar e remover ícone.
- [x] Explicar que a logo institucional e o ícone do app são diferentes.
- [x] Atualizar estado do usuário após salvar sem exigir logout.
- [x] Adicionar traduções nos três idiomas suportados.
- [x] Preservar a seção atual de logo do tenant.

Critério de saída:

- `ADMIN` conclui configuração, troca e remoção sem suporte técnico e sem afetar a logo existente.

### Etapa 6 - Instalação contextualizada

Status: concluída em código - iPhone e desktop validados, Android pendente

- [x] Atualizar prompt para `Instalar app {Nome da igreja}`.
- [x] Mostrar o ícone configurado no prompt e nas instruções do iPhone.
- [x] Tornar a chave de dismiss/versionamento específica do tenant.
- [x] Preservar destino por perfil ao abrir.
- [x] Não exibir prompt quando já estiver em standalone.
- [x] Detectar identidade instalada desatualizada e orientar a reinstalação dentro do app no Android, iPhone e desktop.
- [x] Não prometer atualização automática de metadata.
- [x] Preservar ativação de push e service worker existentes.

Critério de saída:

- instalação nova é identificada pela igreja e instalação antiga recebe orientação coerente.

### Etapa 7 - Testes, documentação e rollout

Status: em andamento

- [x] Executar testes direcionados da API (5 suítes e 26 testes aprovados).
- [x] Executar build da API.
- [x] Executar typecheck/build da web.
- [x] Executar lint direcionado dos componentes novos da web.
- [x] Executar `git diff --check`.
- [x] Validar migration em banco local sem seed automático.
- [x] Testar fallback de tenant sem configuração por teste automatizado e build de produção.
- [x] Testar configuração completa e remoção por testes automatizados de serviço e controller.
- [ ] Testar Android/Chrome em dispositivo real.
- [x] Testar iPhone/Safari em dispositivo real.
- [ ] Testar `BASIC`, liderança, `STAFF` e `ADMIN`.
- [ ] Testar instalação existente e orientação de reinstalação.
- [x] Atualizar checklist e registrar resultados neste plano.

Resultados registrados em 2026-07-18:

- API: 5 suítes e 26 testes direcionados aprovados; build aprovado.
- Web: lint direcionado, typecheck e build de produção aprovados.
- Prisma: schema validado automaticamente e migration local confirmada pelo usuário; nenhum seed faz parte da migration.
- iPhone/Safari: nome e ícone personalizados confirmados em instalação real.
- Chrome/Edge no Windows: identidade personalizada confirmada; o atalho `.lnk` pode manter o ícone no cache do Windows Shell, sem afetar o manifesto ou o app instalado.
- Android, matriz manual de perfis e reabertura do aviso de reinstalação continuam pendentes.

Critério de saída:

- validações automatizadas passam e o roteiro manual comprova nome, ícone, abertura e tenant corretos nos dispositivos alvo.

## Estratégia de testes

### API unitária

- nome curto válido, vazio, longo e com espaços externos;
- somente `ADMIN` altera configuração;
- usuário não altera outro tenant;
- imagem pequena, não quadrada, MIME inválido e arquivo acima do limite;
- geração das variantes esperadas;
- falha intermediária preserva configuração anterior;
- remoção limpa banco e objetos;
- manifesto customizado;
- fallback OneElo;
- tenant inativo não expõe manifesto personalizado;
- `id` não muda ao trocar nome ou ícone.

### Integração web/API

- `/api/auth/me` retorna configuração publicada;
- metadata autenticada usa o tenant da sessão;
- logout retorna ao fallback público;
- versão do manifesto muda com `pwaUpdatedAt`;
- trocar tenant por parâmetro não concede acesso nem muda sessão;
- URLs dos ícones respondem com imagem pública válida.

### Manual em navegador e dispositivo

Android/Chrome:

- prompt nativo disponível;
- nome curto correto;
- ícone correto no launcher;
- máscara não corta conteúdo;
- abertura em standalone;
- `BASIC` chega a `/personal-panel`;
- administrador chega a `/dashboard`.

iPhone/Safari:

- instrução `Adicionar à Tela de Início` correta;
- Apple Touch Icon correto;
- nome editável parte do nome curto esperado;
- abertura no tenant correto;
- orientação de reinstalação para ícone antigo.

Fallback:

- tenant sem configuração;
- ícone removido;
- API temporariamente indisponível durante metadata;
- storage temporariamente indisponível;
- sessão expirada;
- navegador sem suporte a instalação.

## Ordem de deploy

1. aplicar migration com `npm run db:migrate:prod` em `apps/api`;
2. publicar API com campos opcionais, endpoints e fallback;
3. confirmar manifesto OneElo para tenants ainda não configurados;
4. publicar web com metadata e UI administrativa;
5. configurar primeiro apenas o tenant piloto;
6. testar instalação nova em Android e iPhone;
7. validar abertura por perfil;
8. comunicar reinstalação aos usuários já instalados quando necessária;
9. acompanhar erros de imagem, manifesto, metadata e instalação;
10. liberar configuração para os demais tenants.

Não executar `db:seed` em produção como parte desta entrega.

## Rollback

- Web pode voltar ao manifesto global OneElo sem remover os campos do banco.
- API deve manter fallback OneElo mesmo que a web anterior seja restaurada.
- Campos opcionais não devem ser removidos em rollback emergencial.
- Remover o ícone personalizado do tenant restaura o comportamento padrão.
- Objetos de storage podem permanecer temporariamente sem afetar sessão ou operação.
- Não alterar `id` de uma personalização já instalada durante correção emergencial.

## Riscos e mitigação

### Manifesto autenticado não ser aplicado no momento correto

Risco: navegador usar manifesto global carregado antes da resolução do tenant.

Mitigação: metadata server-side no HTML inicial, spike obrigatório e rota dedicada de instalação como fallback.

### Ícone cortado ou ilegível

Risco: imagem enviada não respeitar máscaras do sistema operacional.

Mitigação: ícone dedicado, dimensão mínima, prévias com máscaras, área segura e validação em dispositivo.

### Instalação antiga manter identidade OneElo

Risco: sistema operacional não atualizar nome ou ícone.

Mitigação: versionamento, orientação de reinstalação e comunicação clara sem prometer atualização automática.

### Duplicar o PWA instalado

Risco: mudança de `id` ou `start_url` fazer o navegador tratar a atualização como outro aplicativo.

Mitigação: `id` estável por tenant, `start_url` invariável e testes com instalação anterior.

### Falha parcial de upload

Risco: manifesto referenciar apenas parte das variantes.

Mitigação: gerar antes, subir todas as variantes, atualizar banco por último e limpar objetos incompletos.

### Refatoração do layout autenticado gerar regressões

Risco: sessão, onboarding, sidebar ou carregamento inicial mudarem de comportamento.

Mitigação: extrair `DashboardShell`, preservar contrato de contexto, testar todos os perfis e manter fallback client-side controlado.

### Exposição indevida por endpoint público

Risco: manifesto retornar dados não destinados ao público.

Mitigação: select mínimo, DTO de saída fechado e testes que comprovem ausência de dados operacionais.

## Critérios de aceite finais

- `ADMIN` configura nome curto e ícone do PWA no próprio tenant.
- Arquivo inválido é rejeitado com mensagem clara.
- Variantes 180, 192, 512, quadrada de pré-visualização e maskable são geradas e acessíveis.
- A logo institucional permanece independente.
- Manifesto personalizado usa tenant correto e `id` estável.
- Tenant sem configuração continua instalando OneElo sem regressão.
- Android instala com nome e ícone da igreja.
- iPhone adiciona à tela inicial com nome e ícone da igreja.
- Aplicativo abre no mesmo tenant.
- `BASIC` chega à página pessoal e perfis administrativos ao dashboard.
- Sidebar e prompt mantêm continuidade mínima da identidade.
- Remover personalização restaura fallback.
- Instalação antiga recebe orientação quando necessário.
- Push, service worker, offline e sessão continuam funcionando.
- Migration de produção não executa seed.
- Testes e builds definidos no plano passam.

## Validação de valor após lançamento

Executar com o tenant piloto:

- registrar quantos usuários visualizaram o prompt contextualizado;
- medir instalações ou acessos standalone quando tecnicamente possível;
- entrevistar os usuários que solicitaram a personalização;
- confirmar se encontram o aplicativo com facilidade no celular;
- observar chamados relacionados a nome, ícone ou tenant incorreto;
- comparar ativação de notificações antes e depois da instalação;
- decidir o próximo incremento da `FT-012` com base em uso e feedback.

## Pendências antes de iniciar a implementação

- confirmar o limite final de 12 caracteres para nome curto;
- confirmar se o upload exige imagem exatamente quadrada ou aceita recorte assistido;
- tratamento visual definido: cantos transparentes arredondados nas variantes regulares e fundo branco opaco no `maskable`;
- confirmar se o primeiro tenant piloto já possui arte quadrada adequada;
- validar no spike a estratégia de metadata aninhada do Next.js 16;
- definir o texto final da orientação de reinstalação para Android e iPhone.
