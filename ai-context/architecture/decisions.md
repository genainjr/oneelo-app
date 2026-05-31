# Decisões Arquiteturais

Este documento registra as decisões arquiteturais e padrões de desenvolvimento adotados no projeto DBT.

## Preservação de Histórico de Dados (Silver Layer)

### Decisão
**Não filtrar dados com `deleted_at IS NULL` na camada Silver**

### Contexto
KPIs e análises históricos precisam manter integridade de dados mesmo quando dimensões são desativadas. Filtrar registros deletados na Silver causaria perda de rastreabilidade histórica.

### Solução Adotada
1. **Mantém campos deletados intactos**: `deleted_at` é preservado em todas as CTEs de dimensão
2. **Cria flags de status**: Derivadas programaticamente a partir de `deleted_at`
   - `is_active = CASE WHEN deleted_at IS NULL THEN 1 ELSE 0 END`
   - Aplicado para cada dimensão: `deposit_is_active`, `reason_is_active`, etc
3. **Joins sem filtros**: Usa `LEFT JOIN` sem condição `WHERE deleted_at IS NULL`
4. **Rastreabilidade**: Permite análise de eventos históricos com contexto temporal correto

### Benefícios
- ✅ Histórico completo de movimentações de sucata mesmo com dimensões desativadas
- ✅ Auditoria temporal precisa
- ✅ Flexibilidade para análises: consumidor decide se inclui/exclui deletados
- ✅ Não perde dados relacionados a períodos históricos

### Exemplo
```sql
-- ❌ ANTES (Incorreto)
FROM deposit d
LEFT JOIN plant p ON d.plant_id = p.plant_id
WHERE d.deleted_at IS NULL  -- Perde histórico!

-- ✅ DEPOIS (Correto)
FROM deposit d
LEFT JOIN plant p ON d.plant_id = p.plant_id
-- Sem filtro WHERE, mantém histórico
-- Consumidor usa is_active flag conforme necessário
```

## Organização de Modelos por Domínios

### Decisão
**Agrupar modelos Silver por domínio de negócio (core, logistic, controllership, person)**

### Contexto
Facilita manutenção, rastreabilidade e alinhamento com estrutura de schemas do banco de dados.

### Estrutura
```
models/
├── 2_silver/
│   ├── core/           (depósito, produto, turno)
│   ├── logistic/       (motivo de sucata, movimentação)
│   ├── controllership/  (faturamento)
│   └── person/         (acidentes, horas trabalhadas)
```

### Benefícios
- ✅ Organização clara e previsível
- ✅ Facilita busca de modelos relacionados
- ✅ Alinhado com schemas do banco de dados
- ✅ Suporta crescimento organizado

## CTEs para Enriquecimento em Silver

### Decisão
**Usar Common Table Expressions (CTEs) para organizar joins com dimensões**

### Padrão
```sql
WITH tabela_principal AS (
    SELECT ... FROM {{ ref('brz_*') }}
),
dimensao_1 AS (
    SELECT ... FROM {{ ref('brz_*') }}
),
dimensao_2 AS (
    SELECT ... FROM {{ ref('brz_*') }}
)
SELECT
    tp.*,
    d1.campo_1,
    d2.campo_2
FROM tabela_principal tp
LEFT JOIN dimensao_1 d1 ON ...
LEFT JOIN dimensao_2 d2 ON ...
```

### Benefícios
- ✅ Legibilidade clara da lógica
- ✅ Fácil identificação de joins
- ✅ Simplifica debugging
- ✅ Reduz complexidade de queries aninhadas

## Normalização de Nomenclatura em Silver

### Decisão
**Renomear campos para nomenclatura padrão e descritiva**

### Padrão
- Genéricos renomeados com sufixo: `name` → `{entity_name}` (ex: `deposit_name`, `product_name`)
- Timestamps mantêm nome original: `created_at`, `updated_at`, `deleted_at`
- IDs mantêm sufixo `_id`: nunca omitir ou abreviar
- Flags booleanas usam `is_` ou status flags

### Exemplo
```sql
SELECT
    id,
    code,
    name AS deposit_name,  -- Renomeado para clareza
    plant_id,              -- ID mantido
    created_at,            -- Timestamp original
    CASE WHEN deleted_at IS NULL THEN 1 ELSE 0 END AS is_active  -- Flag de status
FROM {{ ref('brz_deposit') }}
```

### Benefícios
- ✅ Evita ambiguidade em joins múltiplos
- ✅ Autodocumentação do schema
- ✅ Facilita descoberta em ferramentas de BI
- ✅ Consistência em toda a Silver layer

## Tratamento de Valores Nulos

### Decisão
**Usar TRIM e COALESCE para dados string; manter NULLs em campos opcionais**

### Padrão
```sql
TRIM(field) AS field_name                    -- Remove espaços
COALESCE(field1, field2) AS field_fallback   -- Usa alternativa se nulo
CASE WHEN field IS NULL THEN 0 ELSE field END -- Valor padrão para não-nulo
```

### Aplicação
- Product: `COALESCE(sap_name, name)` como `product_display_name`
- Deposit, ScrapReason: `TRIM()` em strings
- Billing: `CAST(total_amount AS DECIMAL(18,2))` com validação `WHERE total_amount > 0`

### Benefícios
- ✅ Dados limpos e padronizados
- ✅ Evita comportamentos inesperados em agregações
- ✅ Melhor compatibilidade com BI tools

## Decomposição de Data em Silver

### Decisão
**Extrair year, month, day de timestamps para facilitar agregações em Gold**

### Padrão
```sql
CAST(date AS DATE) AS event_date,
YEAR(date) AS event_year,
MONTH(date) AS event_month,
DAY(date) AS event_day
```

### Benefícios
- ✅ Facilita agregações temporais em Gold
- ✅ Evita cálculos repetidos em múltiplos modelos
- ✅ Melhora performance de queries analíticas
- ✅ Padrão em data warehouses modernos

## Materialização e Performance

### Decisão
**Bronze e Silver como views por padrão; avaliar tabelas materializadas caso necessário**

### Raciocínio
- Views reduzem armazenamento e mantém dados sempre atualizados
- Tabelas materializadas usadas apenas em casos de performance crítica
- Avaliado por modelo e KPI específico

### Config no dbt_project.yml
```yaml
models:
  dbt_dw:
    1_bronze:
      +materialized: view      # Views por padrão
    2_silver:
      +materialized: view      # Views para flexibilidade
    3_gold:
      +materialized: view      # Views, indexadas no SQL Server
```
