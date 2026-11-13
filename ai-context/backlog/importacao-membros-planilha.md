# Backlog - Importação de Membros em Lote via Planilha

### FT-016 Importação de Membros em Lote (Excel / CSV)

- **Prioridade**: crítica (destravador de onboarding e adoção em novas igrejas)
- **Status**: implementado (concluído)
- **Fase**: entregue
- **Categoria**: produto / onboarding / produtividade / ingestão de dados
- **Esforço estimado**: médio
- **Contexto**: igrejas com mais de 50 membros enfrentavam barreira crítica de adoção por precisarem cadastrar manualmente membro a membro. Igrejas piloto e potenciais clientes relataram abandono do sistema por falta de importação automática de suas planilhas legadas (Excel / Google Sheets).
- **Ação**: implementado fluxo completo de importação inteligente de membros via arquivo `.xlsx` e `.csv`:
  1. Modelo de planilha oficial para download com máscaras de data, formatações de CPF, celular com zero no DDD e colunas eclesiásticas.
  2. Upload com parser resiliente em memória via `exceljs`, sanitização e suporte completo aos atributos do modelo `Membro`.
  3. Modal e tela de **Preview com Validação Antecipada (Dry-run)**:
     - Diagnóstico de registros válidos, erros impeditivos e duplicidades (por nome exato, telefone ou e-mail).
     - Seletor de estratégia para duplicados: *"Pular membros duplicados"* ou *"Atualizar dados de membros existentes"* com diff detalhado.
     - Respeito rigoroso aos limites do plano contratado do tenant (`LIMITES_MEMBROS_POR_PLANO`).
  4. Execução em lote via transaction atômica no Prisma com registro consolidado em `AuditLog`.
  5. Exclusão em lote na barra flutuante da listagem de membros.
- **Impacto**: elimina a maior fricção de vendas do OneElo, permitindo que uma nova igreja cadastre ou atualize centenas de membros em segundos.

---

## Estrutura Implementada

1. **Download do Template**: Botão em `/membros` com `"Baixar Planilha Modelo (.xlsx)"`.
2. **Modal/Wizard de Importação**:
   - Passo 1: Dropzone de upload com link para o modelo.
   - Passo 2: Prévia completa com cards de estatísticas (Válidos, Erros, Duplicados), tabela de conferência e seletor de duplicados.
   - Passo 3: Execução com feedback de progresso e tela de conclusão.
3. **Resiliência e Performance**:
   - Parser em memória sem escrita em disco (`exceljs`).
   - Normalização de telefones para E.164 e detecção de duplicidades otimizada.
