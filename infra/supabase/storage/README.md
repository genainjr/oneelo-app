# Supabase Storage - OneElo Media

Esta pasta versiona a infraestrutura de Storage usada por fotos de membros, logos dos tenants e comprovantes financeiros.

## Recursos

- Bucket publico `member-photos`
- Bucket publico `tenant-logos`
- Bucket publico `financial-receipts`
- Limite de arquivo para midias: `5 MB`
- Limite de arquivo para comprovantes financeiros: `10 MB`
- MIME types de midia: `image/jpeg`, `image/png`, `image/webp`
- MIME types de comprovante: `application/pdf`, `image/jpeg`, `image/png`, `image/webp`

Os buckets sao publicos por decisao atual do produto. O backend continua sendo responsavel por validar permissao de upload/remocao e por salvar apenas referencias no banco, como `fotoUrl`/`fotoKey`, `logoUrl`/`logoKey` ou `receiptUrl`/`receiptKey`.

## Variaveis

Nunca versionar chaves reais em arquivos rastreados pelo Git.
Use um arquivo local baseado no exemplo e mantenha esse arquivo fora do repositorio.

```powershell
Copy-Item env/prod.tfvars.example env/prod.tfvars
```

Atualize no arquivo local:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

`SUPABASE_SERVICE_ROLE_KEY` aceita tanto a chave secreta atual, no formato `sb_secret_...`, quanto a chave legada JWT `service_role`. Apesar do nome mantido por compatibilidade, prefira a chave secreta atual para novas configuracoes.

## Aplicacao no projeto Supabase atual

```powershell
Set-Location infra/supabase/storage
terraform init
terraform plan -var-file="env/prod.tfvars"
terraform apply -var-file="env/prod.tfvars"
```

Como o plano gratuito atual possui apenas um projeto Supabase, `prod.tfvars` e o arquivo canonico para esta infraestrutura. O arquivo `dev.tfvars` nao deve ser aplicado contra o mesmo projeto, pois isso nao cria isolamento e apenas duplica a configuracao.

Quando existir um segundo projeto Supabase para desenvolvimento, crie `env/dev.tfvars` a partir de `env/dev.tfvars.example` e use o mesmo fluxo com `-var-file="env/dev.tfvars"`.

## Observacoes operacionais

- O Terraform cria ou atualiza a configuracao dos buckets via API do Supabase Storage.
- Revise sempre o resultado de `terraform plan` antes de executar `terraform apply`.
- O Terraform nao gerencia os arquivos enviados pelos usuarios.
- `terraform destroy` nao deve ser usado para remover midias de producao.
- Se no futuro os buckets deixarem de ser publicos, esta pasta deve ser atualizada junto com a regra de leitura das imagens no backend/frontend.
