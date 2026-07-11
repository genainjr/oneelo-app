# Plano - Midia de membros e tenant com Supabase Storage e Terraform

Status geral: concluido
Ultima atualizacao: 2026-07-11

## Objetivo

Implementar suporte a imagens no sistema para dois casos de uso:

- foto de perfil de membros;
- foto de perfil do proprio usuario em `Meu Perfil`;
- logo do tenant/igreja.

O armazenamento deve usar Supabase Storage. A infraestrutura e configuracoes relevantes devem ser versionadas com Terraform, mesmo que o projeto ainda nao tenha usado Terraform ate aqui.

## Contexto

Hoje o sistema:

- nao possui foto propria por membro;
- nao possui upload de foto no `Meu Perfil`;
- nao possui logo por tenant;
- depende de marcacoes visuais padrao do produto em telas e impressoes;
- ainda nao utiliza Terraform para provisionar ou padronizar infraestrutura ligada ao Supabase.

O objetivo e evoluir essa base sem salvar binarios no banco e sem depender do filesystem local como armazenamento permanente.

## Decisoes de produto e arquitetura

- A foto do membro e a logo do tenant devem ser tratadas como midias distintas, com contratos e fallback proprios.
- A foto do proprio usuario no `Meu Perfil` deve reaproveitar a mesma base tecnica da foto de membro, quando o usuario estiver vinculado a um membro.
- A foto do membro deve poder ser inserida no cadastro inicial, atualizada em `Membros/Gerenciamento` e atualizada pelo proprio usuario em `Meu Perfil`.
- A logo do tenant deve poder ser atualizada pelo Super Admin e pelo ADMIN do proprio tenant em `Configuracoes`.
- O banco deve armazenar apenas referencia da midia, nunca o arquivo.
- O upload deve ser feito via backend autenticado, com validacao de tipo, tamanho e permissao.
- O Supabase Storage deve ser o provedor de arquivos.
- Terraform deve ser introduzido para versionar a infraestrutura relacionada ao Supabase, buckets, politicas e configuracoes necessarias.
- Se a foto/logo nao existir, o sistema deve continuar funcionando com fallback visual padrao.

## Escopo

Incluido:

- schema do banco para foto de membro e logo do tenant;
- suporte a foto do proprio usuario via `Meu Perfil`;
- suporte a foto do membro via `Membros/Gerenciamento`;
- endpoint de upload e remocao de foto de membro;
- endpoint de upload e remocao de foto do usuario;
- endpoint de upload e remocao de logo do tenant para Super Admin e para ADMIN do tenant;
- integracao do frontend com preview e substituicao de imagem;
- definicao de buckets no Supabase Storage;
- politicas de acesso no Supabase Storage;
- introducao de Terraform para a infraestrutura ligada a essa feature;
- fallback visual quando nao houver imagem;
- validacao de arquivos, extensao, MIME type e tamanho maximo;
- atualizacao de tipos compartilhados e payloads de API.

Fora do escopo:

- galeria de multiplas fotos;
- edicao de imagem no navegador;
- compressao avancada ou crop automatico;
- armazenamento local;
- integracao com outros provedores de storage nesta entrega.

## Estrutura proposta

### Entidades

Membro:

- `fotoUrl`
- `fotoKey`
- opcionalmente campos auxiliares de metadata, se fizer sentido tecnico.

Tenant:

- `logoUrl`
- `logoKey`
- opcionalmente campos auxiliares de metadata, se fizer sentido tecnico.

Usuario:

- pode reaproveitar a referencia da foto do membro vinculado;
- se houver campo proprio, manter a mesma convencao de url/key.

### Storage

Buckets sugeridos:

- `member-photos`
- `tenant-logos`

Regras:

- bucket publico apenas se a necessidade de leitura for realmente aberta;
- bucket privado com politica de acesso quando a leitura precisar ser controlada;
- separar caminho de upload por tenant e por entidade;
- nunca misturar foto de membro com logo de tenant no mesmo bucket sem convencao clara de path.

### Terraform

Terraform deve ser usado para:

- provisionar e manter em codigo o que for possivel no ambiente Supabase;
- registrar buckets e configuracoes relacionadas;
- manter o desenho de infraestrutura versionado no repo;
- facilitar reproducao do ambiente sem depender de configuracao manual.

Se houver limite do provider em algum recurso, o plano deve registrar a excecao e manter esse trecho em SQL/migration versionada, sem abandonar o uso de Terraform para o resto.

## Plano de Execucao

### Etapa 1 - Validacao tecnica do caminho com Supabase + Terraform

- [x] Confirmar o uso do Supabase Storage como repositorio oficial de midia.
- [x] Definir se os buckets serao publicos ou privados.
- [x] Validar como o Terraform vai ser introduzido no projeto.
- [x] Separar o que fica em Terraform, o que fica em migration SQL e o que fica no backend.
- [x] Definir os nomes finais dos buckets e caminhos.

Resultado da validacao local:

- nao existe estrutura Terraform no repositorio hoje;
- nao existe configuracao de Supabase Storage versionada no codigo hoje;
- a introducao de Terraform vai exigir uma nova pasta de infra, sem reaproveitamento previo;
- a regra mais segura para esta entrega e tratar o Supabase Storage como camada oficial de arquivos e manter no banco apenas metadados e referencias.
- os buckets serao publicos por enquanto para simplificar o consumo das imagens.
- os buckets seguirao os nomes `member-photos` e `tenant-logos`.
- os caminhos seguirao a convencao por tenant e entidade, com nome versionado a cada troca, como `tenants/{tenantId}/members/{memberId}/photo-{versao}.jpg` e `tenants/{tenantId}/logo/logo-{versao}.png`;
- a nova versao evita cache da imagem anterior e o arquivo substituido deve ser removido depois que a nova referencia for persistida.

Resultado esperado:

- arquitetura fechada;
- convencao de paths definida;
- estrategia de acesso definida;
- base tecnica para seguir sem retrabalho.

### Etapa 2 - Banco e contratos de API

- [x] Adicionar os campos de foto no `Membro`.
- [x] Adicionar os campos de logo no `Tenant`.
- [x] Criar migration compativel com a estrategia de deploy do projeto.
- [x] Atualizar DTOs e tipos compartilhados.
- [x] Garantir que os payloads de auth, membro e tenant carreguem a referencia da midia.

Decisao tecnica desta etapa:

- `Membro` vai armazenar `fotoUrl` e `fotoKey` como origem oficial da foto de perfil do cadastro pastoral;
- `Tenant` vai armazenar `logoUrl` e `logoKey` para a marca da igreja;
- o `GET /api/auth/me` deve devolver a foto do membro vinculado quando existir, porque o `Meu Perfil` atualiza a foto do membro e nao uma foto isolada do `User`;
- as telas de listagem e visualizacao de membros continuam lendo a foto do membro;
- o frontend deve tratar a ausencia de imagem sem quebrar layout nem depender de campos opcionais inexistentes.

Resultado da implementacao:

- `tb_member` recebeu `photo_url` e `photo_key`;
- `tb_tenant` recebeu `logo_url` e `logo_key`;
- o contrato de `auth/me` e dos payloads de tenant/membro foi atualizado para expor as referencias de midia;
- o Prisma Client foi regenerado para refletir os novos campos.

Resultado esperado:

- banco preparado;
- contratos de API preparados;
- frontend consegue consumir as referencias de imagem sem quebrar.

### Etapa 3 - Servico de upload para membros

- [x] Criar endpoint autenticado para upload de foto.
- [x] Criar endpoint autenticado para remover foto.
- [x] Validar permissao por papel e tenant.
- [x] Validar formato, tamanho e mime type.
- [x] Salvar arquivo no Supabase Storage e persistir apenas chave/url no banco.
- [x] Expor fallback quando nao houver foto.

Resultado da implementacao:

- `POST /api/membros/:id/foto` recebe a imagem via multipart e salva no bucket `member-photos`;
- `DELETE /api/membros/:id/foto` remove a imagem do Storage e limpa os campos no banco;
- a validacao aceita apenas JPG, PNG e WEBP, com limite de 5 MB;
- o caminho usa a convencao `tenants/{tenantId}/members/{memberId}/photo.{ext}`;
- o retorno do membro continua vindo com o restante das relacoes ja existentes.

Resultado esperado:

- membros podem ter foto;
- o backend controla a integridade do arquivo;
- a foto nao depende do filesystem local.

### Etapa 4 - Servico de upload para usuario no Meu Perfil

- [x] Reaproveitar o fluxo de foto do membro quando o usuario estiver vinculado a um membro.
- [x] Garantir que o `Meu Perfil` permita upload da propria foto quando fizer sentido para o usuario.
- [x] Atualizar o payload de autenticacao para refletir a foto corrente do usuario.
- [x] Manter o mesmo padrao de validacao, substituicao e limpeza do arquivo anterior.

Resultado da implementacao:

- `POST /api/auth/me/photo` permite que o usuario autenticado atualize a foto do membro vinculado;
- `DELETE /api/auth/me/photo` remove a foto do mesmo membro;
- o `Meu Perfil` chama essa rota diretamente, sem depender de permissao administrativa;
- o payload de `auth/me` continua sendo a fonte da imagem atual exibida na tela.

Resultado esperado:

- o usuario consegue subir sua propria foto no `Meu Perfil`;
- o fluxo reaproveita a mesma infraestrutura e regras da foto de membro;
- a imagem fica consistente entre perfis, membros e demais telas.

### Etapa 5 - Servico de upload para tenant

- [x] Criar endpoint autenticado para upload de logo.
- [x] Criar endpoint autenticado para remover logo.
- [x] Garantir que apenas perfis administrativos alterem a configuracao.
- [x] Atualizar a configuracao do tenant com `logoUrl` e `logoKey`.
- [x] Aplicar fallback padrao do produto quando nao houver logo.

Resultado da implementacao:

- `POST /api/admin/tenants/:id/logo` envia a logo para o bucket `tenant-logos`;
- `DELETE /api/admin/tenants/:id/logo` remove a logo anterior e limpa os campos do tenant;
- `POST /api/auth/tenant/logo` permite que o ADMIN do tenant logado envie a propria logo;
- `DELETE /api/auth/tenant/logo` permite que o ADMIN do tenant logado remova a propria logo;
- o modal de edicao do tenant no painel de Super Admin recebeu preview, troca e remocao da logo;
- o fluxo reutiliza o mesmo padrao de upload com validacao de formato e tamanho.

Resultado esperado:

- tenant pode cadastrar a propria logo;
- impressoes e telas passam a usar a marca da igreja quando houver.

### Etapa 6 - Frontend de membros, perfil e configuracoes

- [x] Adicionar preview de foto na tela de membros.
- [x] Adicionar preview e troca de foto em `Meu Perfil`.
- [x] Adicionar acao de trocar/remover foto em `Meu Perfil`.
- [x] Adicionar acao de inserir/trocar/remover foto em `Membros/Gerenciamento`.
- [x] Adicionar preview de logo nas configuracoes do tenant para Super Admin.
- [x] Permitir selecionar logo tambem na criacao do tenant pelo Super Admin.
- [x] Adicionar acao de trocar/remover logo nas configuracoes do tenant para Super Admin.
- [x] Adicionar preview e acao de trocar/remover logo em `Configuracoes` para ADMIN do tenant.
- [x] Reaproveitar padroes visuais e componentes do ODS.
- [x] Garantir comportamento responsivo no mobile.

Resultado da implementacao:

- a foto do membro aparece na listagem e na visualizacao detalhada de membros;
- o `Meu Perfil` exibe a foto atual, permite troca e remocao sem sair da pagina;
- o painel de foto em `Meu Perfil` recebeu mais area util para evitar texto comprimido em telas medias;
- o modal de cadastro/edicao de membro em `Membros/Gerenciamento` permite inserir, trocar e remover a foto do membro;
- o modal de criacao do tenant permite selecionar a logo antes de salvar e envia a imagem depois que o tenant e criado;
- o modal de edicao do tenant mostra preview e acoes para a logo;
- a tela `Configuracoes` permite que o ADMIN do tenant troque ou remova a logo da propria igreja;
- o bloco visual de upload foi centralizado em `ImageUploadPanel`, reutilizado em `Meu Perfil`, `Membros/Gerenciamento`, `Configuracoes` e Super Admin;
- a validacao frontend de imagem foi centralizada em `validateImageFile`, com `IMAGE_UPLOAD_ACCEPT` e limite de 5 MB compartilhados;
- a montagem de `FormData` para uploads de imagem foi centralizada em `buildImageFormData`;
- a validacao backend de imagem, o limite de upload e as convencoes de path foram centralizados em `common/storage/image-upload.ts`;
- a regra backend de upload/remocao da logo do tenant foi centralizada em `TenantMediaService`, reutilizada pelo ADMIN do tenant e pelo Super Admin;
- os componentes reutilizados seguiram o mesmo estilo visual ja adotado no restante do sistema.

Resultado esperado:

- usuario consegue subir e revisar a midia sem fluxo confuso;
- a tela segue o padrao visual ja adotado no projeto.

### Etapa 7 - Terraform e infraestrutura

- [x] Introduzir a estrutura Terraform no repo.
- [x] Modelar os recursos Supabase necessarios.
- [x] Versionar configuracoes de storage e acesso.
- [x] Documentar variaveis e aplicacao do Terraform.
- [x] Definir a rotina de aplicacao em dev e producao.

Resultado da implementacao:

- criada a pasta `infra/supabase/storage` para concentrar a infraestrutura de midia no Supabase;
- versionados os buckets `member-photos` e `tenant-logos` como configuracao Terraform;
- os buckets seguem a decisao atual de serem publicos, com limite de 5 MB e MIME types `image/jpeg`, `image/png` e `image/webp`;
- criada rotina idempotente chamada pelo Terraform para criar ou atualizar os buckets via API do Supabase Storage;
- criados exemplos de variaveis para dev e producao com `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` para uso em arquivo local nao versionado;
- como o plano gratuito possui apenas um projeto Supabase, o fluxo atual usa somente `prod.tfvars`; `dev.tfvars` fica reservado para quando existir um projeto separado de desenvolvimento;
- `.gitignore` passou a ignorar state Terraform e `.tfvars` reais;
- documentados os comandos de `terraform init`, `terraform plan` e `terraform apply` para o projeto atual, usando somente `-var-file`;
- validacao local executada com sucesso usando `terraform fmt -recursive`, `terraform init` e `terraform validate`.

Resultado esperado:

- infra da feature versionada;
- caminho claro para reproduzir ambiente;
- base para futuras midias sem configuracao manual solta.

### Etapa 8 - Validacao

- [x] Validar upload e remocao de foto.
- [x] Validar que trocar/remover foto no modal so persiste ao salvar e que cancelar preserva a imagem original.
- [x] Validar que excluir um membro tambem remove sua foto do Storage.
- [x] Validar upload e remocao de logo pelo Super Admin e pelo ADMIN do tenant.
- [x] Validar que trocar/remover logo no modal do Super Admin so persiste ao salvar e que cancelar preserva a imagem original.
- [x] Validar fallback visual sem imagem.
- [x] Validar foto do usuario na sidebar e atualizacao imediata apos alteracao no Meu Perfil e em Membros/Gerenciamento.
- [x] Validar permissao por perfil.
- [x] Validar comportamento em desktop e mobile.
- [x] Rodar typecheck/build nos pontos afetados.

Resultado esperado:

- feature pronta para uso;
- sem quebra de tela ou contrato;
- sem dependencia de arquivo local.

## Riscos e cuidados

- Nao salvar binario no banco.
- Nao depender de disco local.
- Nao misturar regra de acesso de foto com regra de acesso de logo.
- Nao criar bucket sem convencao de path.
- Nao introduzir Terraform parcial sem definir o que ele cobre.
- Nao expor URLs publicas sem necessidade real.
- Nao quebrar os fluxos atuais de membros, configuracoes e impressao.
