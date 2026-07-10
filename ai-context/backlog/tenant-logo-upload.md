# Backlog - Logo da Igreja por Tenant

### FT-009 Logo da igreja por tenant
- **Prioridade**: media
- **Fase**: 2
- **Categoria**: UX / branding / infraestrutura
- **Contexto**: O sistema hoje usa marca padrao do produto nas impressoes e nao possui um campo de logo proprio por igreja. Para personalizar impressoes, telas institucionais e futuras exportacoes, cada tenant precisa poder cadastrar a propria logo sem depender de alteracao manual no codigo.
- **Acao**: Adicionar suporte a logo por tenant. Incluir campo `logoUrl` e, se necessario, `logoKey` no modelo `Tenant`. Criar fluxo de upload em configuracoes do tenant, validar tipo/tamanho da imagem e salvar o arquivo em storage externo. O backend deve expor endpoint autenticado para atualizar/remover a logo e retornar a URL no payload de tenant/usuario. O frontend deve exibir preview, permitir substituir/remover a imagem e usar `tenant.logoUrl` como prioridade nas impressoes, mantendo a marca padrao do One Elo como fallback.
- **Impacto**: Permite personalizacao visual por igreja, melhora a qualidade das impressoes e prepara a base para branding por tenant em documentos, paginas publicas e comunicacoes futuras.
- **Depende de**: Definicao do provedor de storage (Supabase Storage, S3, Cloudinary ou equivalente), configuracao de variaveis de ambiente e politica de acesso publico/assinado para imagens.
- **Riscos / cuidados**:
  - Nao salvar binario no banco.
  - Nao depender do filesystem local do Render para armazenamento persistente.
  - Validar extensao, MIME type e tamanho maximo.
  - Definir fallback quando a logo estiver ausente ou indisponivel.
  - Evitar expor endpoints de upload para usuarios sem permissao administrativa.
- **Arquivos afetados previstos**:
  - `apps/api/prisma/schema.prisma`
  - `apps/api/src/modules/auth/`
  - `apps/api/src/modules/super-admin/` ou modulo de tenant/configuracoes
  - `apps/api/src/common/` para servico de storage, se criado
  - `apps/web/src/app/(dashboard)/configuracoes/`
  - `apps/web/src/components/app/print-layout.tsx`
  - `apps/web/src/types/`
