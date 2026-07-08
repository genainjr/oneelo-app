# Regras de migrations

## Objetivo

Padronizar como migrations Prisma devem ser geradas e aplicadas neste repositório.

## Regra principal

- Execute comandos Prisma a partir de `apps/api`.
- Nao rode `prisma generate` ou `prisma migrate deploy` a partir da raiz do monorepo quando o `.env` da API estiver em `apps/api`.
- Em Windows, o caminho mais previsivel e entrar na pasta da API antes de executar o comando.

## Comandos recomendados

### Gerar client

```powershell
Set-Location apps/api
npx.cmd prisma generate
```

### Aplicar migrations em ambiente local ou de producao

```powershell
Set-Location apps/api
npx.cmd prisma migrate deploy
```

### Criar migration durante desenvolvimento

```powershell
Set-Location apps/api
npx.cmd prisma migrate dev
```

## Observacoes

- `migrate deploy` aplica migrations que ja existem no repositório.
- `migrate dev` e o comando de criacao/aplicacao durante desenvolvimento.
- Se o Prisma reclamar de `DATABASE_URL`, confirme que o comando foi executado dentro de `apps/api`.
- Se o `prisma generate` falhar com `EPERM` no Windows, feche processos Node em uso antes de rodar novamente.

## Validacao pratica

- O comando que funcionou neste repositório foi:

```powershell
Set-Location apps/api
npx.cmd prisma migrate deploy
```

- Esse fluxo deve ser repetido em producao, trocando apenas a configuracao de ambiente da `.env` ou da variavel `DATABASE_URL`.
