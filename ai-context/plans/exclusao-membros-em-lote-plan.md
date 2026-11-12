# Plano - Exclusão de Membros em Lote (Bulk Delete)

Status geral: concluido  
Data de criação: 2026-11-12  
Branch sugerida para implementação: feature/exclusao-membros-em-lote  

## Planos e Referências Relacionados

- [Regras de Validação de Negócio](../business-rules/validation-rules.md)
- [OneElo Design System (ODS)](../../ai-core/skills/oneelo-design-system/README.md)
- [Plano de Importação de Membros](importacao-membros-planilha-plan.md)

---

## 1. Objetivo da Entrega

Permitir que administradores e staff excluam múltiplos membros simultaneamente a partir da seleção em lote na listagem de membros, facilitando limpezas pós-testes, correções de importações em lote e manutenção da base de cadastros de forma segura, com confirmação explícita, soft delete e registro consolidado de auditoria.

---

## 2. Contexto e Diagnóstico

- **Cenário Atual:** A tela de membros (`apps/web/src/app/(dashboard)/membros/page.tsx`) possui seleção de múltiplos checkboxes (`selectedIds`) e uma barra flutuante inferior, porém apenas com ações de tags em lote e emissão de carteirinhas. Para excluir membros, o administrador é obrigado a clicar de um em um no ícone de lixeira e confirmar individualmente.
- **Necessidade:** Ao realizar testes de importação ou limpezas periódicas, excluir dezenas de membros manualmente é lento e propenso a erros.
- **Solução:** Adicionar endpoint de exclusão em lote no backend com transação atômica, desvinculação segura de ministérios/funções/tags, soft delete e registro em auditoria, acompanhado do botão "Excluir selecionados" na barra flutuante com diálogo de confirmação.

---

## 3. Decisões de Arquitetura, Riscos e Engenharia

- **Isolamento Multitenant:** Apenas membros pertencentes ao `tenantId` da sessão autenticada podem ser afetados. Membros de outros tenants ou já excluídos são filtrados.
- **Integridade Referencial:**
  - Desvinculação em lote de `ministerioMembroFuncao`, `ministerioMembro` e `membroTag`.
  - Soft delete em `membro` atualizando `deletedAt: new Date()`, `fotoUrl: null`, `fotoKey: null`.
  - Exclusão das fotos associadas no bucket de armazenamento via `StorageService`.
- **Auditoria:** Registro em `tb_audit_log` com a contagem de registros, IDs excluídos e identificação do usuário que executou a ação.
- **UX & Segurança:**
  - Botão na barra flutuante em tom vermelho/perigo (`border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100`).
  - Diálogo de confirmação modal explícito (`ConfirmDialog`) mostrando a contagem exata e aviso de desvinculação.
  - Limpeza automática de `selectedIds` e recarregamento da tabela (`refetch()`) com mensagem de feedback de sucesso.

---

## 4. Etapas de Desenvolvimento

### Etapa 1 - Backend: DTO, Serviço e Controller
Status: concluido

- [x] Criar DTO `BulkDeleteMembrosDto` em `apps/api/src/modules/membros/dto/bulk-delete-membros.dto.ts`:
  - [x] Validar array de UUIDs não vazio (`@IsArray()`, `@ArrayNotEmpty()`, `@ArrayMaxSize(500)`)
- [x] Implementar método `bulkRemove` em `apps/api/src/modules/membros/membros.service.ts`:
  - [x] Buscar membros ativos do tenant correspondentes aos IDs fornecidos
  - [x] Remover fotos associadas do bucket de storage
  - [x] Executar `$transaction` com remoção de vínculos (`ministerioMembroFuncao`, `ministerioMembro`, `membroTag`), atualização `deletedAt` e criação de `auditLog`
- [x] Adicionar endpoint `@Post('bulk-delete')` ou `@Delete('bulk')` em `apps/api/src/modules/membros/membros.controller.ts`:
  - [x] Proteger com `@Roles(Role.ADMIN, Role.STAFF)`
  - [x] Capturar `tenantId` e `userId` da sessão
- [x] Criar testes unitários em `apps/api/src/modules/membros/membros.service.spec.ts` ou spec dedicado
- [x] Critério de validação da etapa: Testes unitários do backend executados com sucesso via `npm test -w apps/api`

### Etapa 2 - Frontend: Hook e Integração na Barra de Ações em Lote
Status: concluido

- [x] Adicionar função `bulkDeleteMembros` no hook `apps/web/src/hooks/use-membros.ts`
- [x] Atualizar componente da página `apps/web/src/app/(dashboard)/membros/page.tsx`:
  - [x] Adicionar estado `isBulkDeleteConfirmOpen: boolean` e `bulkDeleteLoading: boolean`
  - [x] Adicionar botão "Excluir Selecionados ({count})" com ícone de lixeira na barra flutuante de ações em lote
  - [x] Adicionar diálogo `ConfirmDialog` de confirmação com contagem de membros a serem excluídos
  - [x] Integrar feedback visual ODS e limpeza de `selectedIds` após conclusão
- [x] Critério de validação da etapa: Checagem TypeScript (`npx tsc --noEmit`) sem erros em `apps/web`

### Etapa 3 - Validação Integrada, Documentação, Build e Merge
Status: concluido

- [x] Executar testes automatizados do backend e build do frontend e backend
- [x] Atualizar status do plano em `ai-context/plans/exclusao-membros-em-lote-plan.md`
- [x] Realizar merge com a branch `development` e push para deploy na instância de staging
- [x] Critério de validação da etapa: Builds passando com 0 erros e código implantado em staging para validação no celular

---

## 5. Critérios de Aceite Gerais

- [x] Administradores e Staff conseguem selecionar múltiplos membros via checkbox e excluí-los em lote com 1 clique de confirmação.
- [x] A exclusão em lote realiza soft delete (`deletedAt`), preservando integridade referencial.
- [x] Todos os vínculos dos membros com escalas, ministérios e tags são removidos em transação atômica.
- [x] A exclusão em lote é auditada em `tb_audit_log` com identificação do usuário e contagem de itens.
- [x] A barra flutuante e o diálogo de confirmação seguem rigorosamente o OneElo Design System (ODS) em desktop e mobile.
