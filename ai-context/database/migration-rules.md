# Regras de migrations

## Objetivo

Padronizar como migrations Prisma devem ser geradas, nomeadas e aplicadas neste repositório.

---

## Padrão Obrigatório de Idioma (100% em Inglês no Banco Físico)

O banco de dados físico PostgreSQL é estritamente em **inglês**. Todas as novas migrations devem preservar rigorosamente esse padrão:

1. **Nome da pasta da migration**:
   - Padrão: `YYYYMMDDHHMMSS_<action_in_english_snake_case>`
   - Exemplos: `20260720002000_add_schedule_eligibility`, `20261015140000_add_schedule_role_compatibility`.
   - Nunca use termos em português no nome da pasta da migration.

2. **Tabelas Físicas**:
   - Padrão: `tb_<entity_name_in_english_singular_or_composed>`
   - Exemplos: `tb_tenant`, `tb_user`, `tb_member`, `tb_ministry`, `tb_schedule`, `tb_schedule_segment`, `tb_schedule_role_compatibility`.

3. **Colunas Físicas**:
   - Padrão: `snake_case` em inglês.
   - Exemplos: `tenant_id`, `is_active`, `display_order`, `work_location`, `requires_schedule`, `uses_schedules`, `can_be_scheduled`, `notes`, `created_at`, `updated_at`.

4. **Enums Físicos**:
   - Padrão: nome do tipo em `snake_case` inglês e valores em caixa alta em inglês.
   - Exemplos:
     - Tipo: `schedule_role_compatibility_rule` com valores `'ALLOW'`, `'WARN'`.
     - Tipo: `financial_transaction_status` com valores `'DRAFT'`, `'CONFIRMED'`, `'CANCELLED'`.

5. **Constraints e Índices**:
   - Padrão: identificadores físicos derivados da tabela e colunas em inglês.
   - Chave primária: `tb_<table_name>_pkey`
   - Chave única: `tb_<table_name>_<columns>_key`
   - Índice: `tb_<table_name>_<columns>_idx`
   - Foreign Key: `tb_<table_name>_<column>_fkey`

6. **Camada de Compatibilidade do Prisma**:
   - O schema Prisma expõe modelos e campos compatíveis com a aplicação (podendo usar termos em português como `SegmentoCulto`, `CompatibilidadeFuncao`, `PERMITIR`, `AVISAR`), mas deve **obrigatoriamente** usar anotações `@map(...)` e `@@map(...)` para ligar com a nomenclatura física em inglês.

7. **Scripts SQL**:
   - Comentários e mensagens de preflight/exceções dentro dos arquivos `.sql` devem ser redigidos em inglês.

---

## Execução de Comandos

- Execute comandos Prisma a partir de `apps/api`.
- Não rode `prisma generate` ou `prisma migrate deploy` a partir da raiz do monorepo quando o `.env` da API estiver em `apps/api`.
- Em Windows, o caminho mais previsível é entrar na pasta da API antes de executar o comando.

### Comandos recomendados

#### Gerar client
```powershell
Set-Location apps/api
npx.cmd prisma generate
```

#### Aplicar migrations em ambiente local ou de produção
```powershell
Set-Location apps/api
npx.cmd prisma migrate deploy
```

#### Criar migration durante desenvolvimento
```powershell
Set-Location apps/api
npx.cmd prisma migrate dev
```

---

## Observações

- `migrate deploy` aplica migrations que já existem no repositório.
- `migrate dev` é o comando de criação/aplicação durante desenvolvimento.
- Se o Prisma reclamar de `DATABASE_URL`, confirme que o comando foi executado dentro de `apps/api`.
- Se o `prisma generate` falhar com `EPERM` no Windows, feche processos Node em uso antes de rodar novamente.

## Validação prática

- O comando padrão para aplicar migrations neste repositório é:
```powershell
Set-Location apps/api
npx.cmd prisma migrate deploy
```
- Esse fluxo deve ser repetido em produção, trocando apenas a configuração de ambiente da `.env` ou da variável `DATABASE_URL`.
