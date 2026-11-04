# Plano - Limites por Plano do Tenant

Status geral: em andamento  
Data de criação: 2026-11-04  
Branch sugerida para implementação: feature/tenant-plan-limits  

## Planos e Referências Relacionados

- [improvements.md](../backlog/improvements.md)
- [feature-development.md](../workflows/feature-development.md)

---

## 1. Objetivo da Entrega

Corrigir e estruturar a regra de limite de membros para que respeite nativamente o plano contratado do tenant (`Plano`), eliminando bloqueios indevidos em tenants do plano `PROFISSIONAL` (ilimitado) e estabelecendo limites padrão consistentes para `GRATUITO` e `BASICO`, reduzindo a necessidade de ajustes manuais emergenciais no banco de dados.

---

## 2. Contexto e Diagnóstico

- O sistema hoje bloqueia a criação de membros com base exclusivamente em `tenant.limiteMembros` (definido por padrão no banco como `50`).
- Ao cadastrar ou alterar um tenant para `PROFISSIONAL` no painel Super Admin, o campo `limiteMembros` permanecia com o valor padrão `50` (ou ajustado manualmente para `200`), causando bloqueio indevido de novos membros em igrejas que contrataram o plano Profissional.
- No `MembrosService`, a verificação compara `totalAtivos >= tenant.limiteMembros` sem consultar as características do `tenant.plano`.
- É necessário desacoplar precificação/regras de negócio de plano do override técnico emergencial, centralizando a lógica em um helper de domínio reutilizável e seguro.

---

## 3. Decisões de Arquitetura e Engenharia

1. **Equivalência Oficial de Limites por Plano**:
   - `GRATUITO`: Limite padrão de **50** membros ativos.
   - `BASICO`: Limite padrão de **200** membros ativos.
   - `PROFISSIONAL`: **Ilimitado** (`null` / sem teto numérico restritivo).
2. **Modelo de Override Técnico (`limiteMembros`)**:
   - O campo `limiteMembros` é mantido no schema para compatibilidade com clientes legados e personalizações contratuais extraordinárias.
   - `PROFISSIONAL`: sempre ilimitado (`null`), independentemente de valores legados ou números no banco.
   - `GRATUITO` e `BASICO`: caso `limiteMembros` seja maior que o limite padrão do plano, ele atua como override técnico válido; valores menores ou legados não rebaixam o plano.
3. **Centralização no Backend**:
   - Módulo utilitário `apps/api/src/common/utils/tenant-plan.ts` responsável por:
     - `LIMITES_MEMBROS_POR_PLANO`: Record oficial de limites.
     - `isUnlimitedMembers(plano)`: verificação de ilimitado.
     - `getEffectiveMemberLimit(tenant)`: cálculo do teto efetivo.
     - `canAddMember(tenant, currentActiveCount)`: autorização de cadastro.
4. **Alinhamento no Super Admin**:
   - Ao criar ou atualizar tenant via Super Admin (`super-admin.service.ts`), inicializar `limiteMembros` de acordo com o plano selecionado.

---

## 4. Etapas de Desenvolvimento

> **Regra de Execução:** O desenvolvimento deve avançar estritamente etapa por etapa. Ao concluir uma etapa, atualize o checklist (`[x]`), apresente o resumo das validações e **aguarde a autorização explícita do usuário antes de iniciar a etapa seguinte**.

### Etapa 1 - Fechamento da Regra e Helper Central de Domínio
Status: concluído

- [x] Mapear todos os pontos do código que consultam `tenant.limiteMembros` e `tenant.plano`.
- [x] Definir a tabela oficial de limites (`LIMITES_MEMBROS_POR_PLANO: Record<Plano, number | null>`).
- [x] Implementar helper de domínio com funções utilitárias (`canAddMember`, `getEffectiveMemberLimit`, `isUnlimitedMembers`).
- [x] Criar testes unitários para o helper cobrindo todos os planos e cenários de override.
- Critério de validação da etapa: Testes unitários do helper passando com 100% de cobertura nos cenários de limites por plano (`npm test -w apps/api -- tenant-plan.spec.ts`).

### Etapa 2 - Ajuste no Backend de Membros (MembrosService)
Status: planejado

- [ ] Substituir a checagem manual em `apps/api/src/modules/membros/membros.service.ts` pela chamada ao helper centralizado.
- [ ] Garantir que tenants `PROFISSIONAL` nunca sejam bloqueados, independentemente do valor em `limiteMembros`.
- [ ] Garantir mensagem de erro clara e contextual quando o limite de `GRATUITO` ou `BASICO` for atingido.
- [ ] Atualizar e expandir a suíte de testes de `membros.service.spec.ts`.
- Critério de validação da etapa: Testes de `membros.service.spec.ts` validando permissão irrestrita para `PROFISSIONAL` e bloqueios corretos para `GRATUITO` e `BASICO`.

### Etapa 3 - Super Admin e Sincronização de Tenants
Status: planejado

- [ ] Atualizar `apps/api/src/modules/super-admin/super-admin.service.ts` na criação de tenants para associar o limite padrão ao plano selecionado.
- [ ] Atualizar `super-admin.service.ts` na edição de tenant para atualizar coerentemente o limite ao trocar de plano (a menos que haja override manual).
- [ ] Permitir que o Super Admin informe ou visualize o limite efetivo na interface administrativa se aplicável.
- [ ] Criar script/migração de backfill para alinhar tenants `PROFISSIONAL` existentes.
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
