# Backlog - Midia de membros e tenant

### FT-009 Fotos de membros e logo do tenant
- **Prioridade**: media
- **Fase**: 2
- **Categoria**: UX / branding / infraestrutura
- **Contexto**: O sistema hoje usa marca padrao do produto nas impressoes e nao possui um campo de foto proprio para membros nem de logo por igreja. Para personalizar perfis, telas institucionais e futuras exportacoes, cada tenant precisa cadastrar a propria logo e os membros precisam poder ter foto sem depender de alteracao manual no codigo. Alem disso, o proprio usuario deve conseguir trocar sua foto no fluxo de `Meu Perfil`, quando houver interesse.
- **Acao**: Adicionar suporte a midia por entidade, com dois fluxos:
  - `membros.fotoUrl` e, se necessario, `membros.fotoKey` para foto de perfil.
- `tenants.logoUrl` e, se necessario, `tenants.logoKey` para logo da igreja.
  Criar upload com preview nas telas de membro, `Meu Perfil` e configuracoes do tenant, validar tipo/tamanho da imagem e salvar os arquivos em Supabase Storage. O backend deve expor endpoints autenticados para atualizar/remover a midia e retornar a URL no payload de membro/tenant/usuario. O frontend deve exibir preview, permitir substituir/remover a imagem e usar a imagem correta como fallback quando nao existir arquivo.
- **Impacto**: Permite personalizacao visual por igreja e por membro, melhora a qualidade das telas e impressoes e prepara a base para branding consistente em documentos, paginas publicas e comunicacoes futuras.
- **Depende de**: Supabase Storage como provedor de arquivos, definicao de buckets publicos ou privados, politica de acesso, e uso de Terraform para versionar a infraestrutura e configuracoes do projeto.
- **Riscos / cuidados**:
  - Nao salvar binario no banco.
  - Nao depender do filesystem local para armazenamento persistente.
  - Validar extensao, MIME type e tamanho maximo.
  - Definir fallback quando a foto ou a logo estiver ausente ou indisponivel.
  - Evitar expor endpoints de upload para usuarios sem permissao administrativa.
  - Separar claramente bucket, policy e caminho de arquivo por tipo de midia.
  - Usar Terraform para manter versionadas as configuracoes da infra, sem tentar gerenciar os arquivos enviados.
- **Arquivos afetados previstos**:
  - `apps/api/prisma/schema.prisma`
  - `apps/api/src/modules/auth/`
  - `apps/api/src/modules/super-admin/` ou modulo de tenant/configuracoes
  - `apps/api/src/common/` para servico de storage, se criado
  - `apps/api/src/modules/membros/`
  - `apps/api/src/modules/meu-perfil/` ou modulo de usuario/perfil
  - `apps/web/src/app/(dashboard)/configuracoes/`
  - `apps/web/src/app/(dashboard)/membros/`
  - `apps/web/src/app/(dashboard)/meu-perfil/`
  - `apps/web/src/components/app/print-layout.tsx`
  - `apps/web/src/types/`
