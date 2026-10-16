# Operacoes seguras de banco

## Principios

- o Docker Compose local usa somente o Postgres do servico `postgres`; ele nao le `DATABASE_URL` de arquivos `.env`;
- iniciar a API nao executa migration nem seed por padrao;
- migrations e seed sao operacoes explicitas, executadas somente apos conferir o alvo;
- o seed atual e destrutivo: ele remove dados existentes antes de recriar dados de exemplo;
- nenhuma migration de producao e aplicada sem backup valido e janela operacional confirmada.

## Subir o ambiente local

```powershell
docker compose up -d --build
docker compose ps
docker compose logs -f api
```

O banco local fica em `postgres:5432` dentro da rede Docker e em `localhost:5433` no host.

## Migration local explicita

```powershell
docker compose exec api npx prisma migrate deploy
```

Confira antes que `docker compose ps` mostra o servico `postgres` local e que a URL exibida no compose ainda aponta para `postgres`.

## Seed local destrutivo

Use apenas em banco local descartavel:

```powershell
docker compose exec -e RUN_SEED=true -e ALLOW_DESTRUCTIVE_SEED=local-development api ./scripts/run-destructive-seed.sh
```

O wrapper recusa seed se `RUN_SEED` nao for `true` ou `ALLOW_DESTRUCTIVE_SEED` nao tiver exatamente o valor `local-development`.

## Backup antes de producao

Nao registre a URL de producao em arquivo versionado. Carregue-a apenas na sessao atual e gere um dump customizado:

```powershell
$env:DATABASE_URL = '<URL fornecida pelo provedor>'
.\scripts\backup-postgres.ps1
```

O script gera `backups/oneelo-AAAAMMDD-HHMMSS.dump` e valida o arquivo com `pg_restore --list`. O diretorio `backups/` e ignorado pelo Git.

Depois, armazene a copia em local externo ao computador e valide periodicamente um restore em banco isolado. O formato customizado do `pg_dump` pode ser restaurado com `pg_restore`.

## Producao

O deploy da API deve iniciar com `RUN_MIGRATIONS=false` e `RUN_SEED=false`. A migration deve ser um passo separado, executado depois de backup confirmado e usando as variaveis do provedor/CI. Nunca defina `ALLOW_DESTRUCTIVE_SEED=local-development` em producao.
