# Plano de Implementação: Regras e Limites de Membros por Plano do Tenant

## 1. Visão Geral e Contexto

No OneElo, cada Tenant possui um plano cadastrado (`Plano: GRATUITO, BASICO, PROFISSIONAL`).
A especificação oficial de limites de membros por plano é:
- **GRATUITO**: limite padrão de **50 membros** ativos.
- **BASICO**: limite padrão de **200 membros** ativos.
- **PROFISSIONAL**: membros **ilimitados** (sem barreira de bloqueio).

Atualmente, na criação do tenant e em seeds/migrações, o campo `limiteMembros` do model `Tenant` no Prisma possui `@default(50)`. Além disso, o cadastro de membros em `MembrosService` realizava uma verificação cega:
```typescript
if (totalAtivos >= tenant.limiteMembros) {
  throw new BadRequestException('Limite de membros ativos atingido...');
}
```
Isso causava bloqueios indevidos em igrejas que contrataram o plano `PROFISSIONAL`, obrigando intervenções manuais no banco para elevar artificialmente o campo `limiteMembros` (ex.: para 100, 200, 500 ou 1000).

Este plano visa:
1. Centralizar a lógica de cálculo de limites em um helper robusto e testável.
2. Garantir que tenants no plano `PROFISSIONAL` sejam tratados como ilimitados em todo o ciclo de vida do sistema.
3. Garantir que tenants nos planos `GRATUITO` e `BASICO` respeitem seus respectivos limites padrão (50 e 200), permitindo overrides contratuais individuais se `limiteMembros` for superior.
4. Ajustar o Super Admin para criar e atualizar tenants sincronizando coerentemente o plano com o limite correspondente.

---

## 2. Status do Projeto

- **Branch de trabalho**: `feature/tenant-plan-limits`
- **Etapa atual**: Etapa 3 concluída (Aguardando aprovação para Etapa 4)
- **Status geral**: Em andamento

---

## 3. Arquivos Afetados

- `apps/api/src/common/utils/tenant-plan.ts` (helper centralizado de limites e regras de plano)
- `apps/api/src/common/utils/tenant-plan.spec.ts` (testes unitários do helper)
- `apps/api/src/modules/membros/membros.service.ts` (aplicação do helper na validação de criação de membros)
- `apps/api/src/modules/membros/membros.service.spec.ts` (testes unitários do serviço de membros)
- `apps/api/src/modules/super-admin/super-admin.service.ts` (sincronização de limites ao criar/editar tenant)
- `apps/api/src/modules/super-admin/super-admin.service.spec.ts` (testes unitários do Super Admin)
- `apps/api/src/modules/super-admin/dto/create-tenant.dto.ts` (suporte a limiteMembros opcional)
- `apps/api/src/modules/super-admin/dto/update-tenant.dto.ts` (suporte a limiteMembros opcional)
- `apps/api/prisma/migrations/20261104170000_align_tenant_member_limits/migration.sql` (migração de alinhamento de limites)
- `apps/api/scripts/backfill-tenant-limits.ts` (script de backfill)
- `apps/web/src/types/index.ts` (adição de limiteMembros na interface Tenant)
- `apps/web/src/hooks/use-admin.ts` (suporte a limiteMembros nos payloads)
- `apps/web/src/app/(admin)/admin/page.tsx` (exibição amigável de limites na interface administrativa)

---

## 4. Etapas de Desenvolvimento

### Etapa 0 - Preparação e Análise de Impacto
Status: concluído

- [x] Confirmar branch `feature/tenant-plan-limits` a partir de `development` atualizada.
- [x] Identificar ocorrências de `limiteMembros` e regras de plano no monorepo.
- Critério de validação da etapa: Repositório com branch criada e escopo mapeado sem conflitos.

### Etapa 1 - Helper Centralizado de Regras do Plano
Status: concluído

- [x] Mapear todos os pontos do código que consultam `tenant.limiteMembros` e `tenant.plano`.
- [x] Definir a tabela oficial de limites (`LIMITES_MEMBROS_POR_PLANO: Record<Plano, number | null>`).
- [x] Implementar helper de domínio com funções utilitárias (`canAddMember`, `getEffectiveMemberLimit`, `isUnlimitedMembers`, `getDefaultStoredMemberLimit`).
- [x] Criar testes unitários para o helper cobrindo todos os planos e cenários de override.
- Critério de validação da etapa: Testes unitários do helper passando com 100% de cobertura nos cenários de limites por plano (`npm test -w apps/api -- tenant-plan.spec.ts`).

### Etapa 2 - Ajuste no Backend de Membros (MembrosService)
Status: concluído

- [x] Substituir a checagem manual em `apps/api/src/modules/membros/membros.service.ts` pela chamada ao helper centralizado.
- [x] Garantir que tenants `PROFISSIONAL` nunca sejam bloqueados, independentemente do valor em `limiteMembros`.
- [x] Garantir mensagem de erro clara e contextual quando o limite de `GRATUITO` ou `BASICO` for atingido.
- [x] Atualizar e expandir a suíte de testes de `membros.service.spec.ts`.
- Critério de validação da etapa: Testes de `membros.service.spec.ts` validando permissão irrestrita para `PROFISSIONAL` e bloqueios corretos para `GRATUITO` e `BASICO` (`npm test -w apps/api -- membros.service.spec.ts`).

### Etapa 3 - Super Admin e Sincronização de Tenants
Status: concluído

- [x] Atualizar `apps/api/src/modules/super-admin/super-admin.service.ts` na criação de tenants para associar o limite padrão ao plano selecionado.
- [x] Atualizar `super-admin.service.ts` na edição de tenant para atualizar coerentemente o limite ao trocar de plano (a menos que haja override manual).
- [x] Permitir que o Super Admin informe ou visualize o limite efetivo na interface administrativa se aplicável.
- [x] Criar script/migração de backfill para alinhar tenants `PROFISSIONAL` existentes.
- Critério de validação da etapa: Testes do Super Admin passando e criação/edição de tenant gerando limites coerentes com o plano.

### Etapa 4 - Validação Integrada, Documentação e Build Final
Status: planejado

- [ ] Executar build de produção (`npm run build -w apps/api` e `npm run build -w apps/web`).
- [ ] Executar suite completa de testes do backend (`npm test -w apps/api`).
- [ ] Testar fluxo manual de criação de membro em tenant `PROFISSIONAL`.
- [ ] Atualizar documentação em `ai-context/`.
- Critério de validação da etapa: Build e testes passando com 0 erros, sem regressões em multitenancy.

---

## 5. Critérios de Aceite Gerais

1. Tenants com plano `PROFISSIONAL` nunca são impedidos de cadastrar novos membros.
2. Tenants com plano `GRATUITO` e `BASICO` respeitam seus respectivos limites oficiais com mensagem descritiva amigável.
3. A regra de cálculo de limite de membros fica centralizada em um único helper, eliminando duplicações e divergências futuras.
4. Novos tenants criados no Super Admin já nascem com limites configurados de acordo com o plano contratado.
