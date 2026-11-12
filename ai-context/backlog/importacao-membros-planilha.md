# Backlog - Importação de Membros em Lote via Planilha

### FT-016 Importação de Membros em Lote (Excel / CSV)

- **Prioridade**: crítica (destravador de onboarding e adoção em novas igrejas)
- **Status**: pendente / em refinamento de arquitetura
- **Fase**: expansão e aquisição
- **Categoria**: produto / onboarding / produtividade / ingestão de dados
- **Esforço estimado**: médio
- **Contexto**: igrejas com mais de 50 membros enfrentam barreira crítica de adoção por precisarem cadastrar manualmente membro a membro. Igrejas piloto e potenciais clientes relataram abandono do sistema por falta de importação automática de suas planilhas legadas (Excel / Google Sheets).
- **Ação**: criar fluxo de importação inteligente de membros via arquivo `.xlsx` e `.csv`:
  1. Disponibilizar modelo de planilha para download com colunas claras (Nome, Telefone/WhatsApp, E-mail, Data de Nascimento, Sexo, Estado Civil, Ministérios/Tags opcionais).
  2. Upload com parser resiliente e sanitização de dados (normalização de telefones para E.164, datas ISO/BR e remoção de espaços em branco).
  3. Tela/etapa de **Preview e Validação Prévia** antes de persistir:
     - Total de registros válidos prontos para importar.
     - Linhas com erros ou avisos (ex.: telefone inválido, campo obrigatório ausente).
     - Identificação de duplicidades (membros com mesmo e-mail ou telefone já existentes no tenant) com opção de "Ignorar" ou "Atualizar".
     - Respeito rigoroso aos limites do plano contratado do tenant (`LIMITES_MEMBROS_POR_PLANO`).
  4. Execução em lote via transaction segura no Prisma com log de auditoria (`AuditLog`).
- **Impacto**: elimina a maior fricção de vendas do OneElo, permitindo que uma nova igreja cadastre 100, 500 ou 1.000 membros em segundos.

---

## Estrutura Recomendada

1. **Download do Template**: Botão em `/membros` com `"Baixar Planilha Modelo (.xlsx)"`.
2. **Modal/Wizard de Importação**:
   - Passo 1: Upload do arquivo drag-and-drop.
   - Passo 2: Preview da importação (linhas válidas vs. erros).
   - Passo 3: Confirmação e barra de progresso.
   - Passo 4: Resumo dos membros importados com sucesso.
3. **Resiliência de Parsing**:
   - Usar biblioteca leve no backend (como `xlsx` ou `exceljs`).
   - Mapeamento flexível de cabeçalhos (aceitar variações comuns como "Nome Completo" / "Nome", "Nascimento" / "Data de Nascimento", "WhatsApp" / "Celular" / "Telefone").
