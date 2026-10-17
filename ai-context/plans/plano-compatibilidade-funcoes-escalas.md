# Plano - Compatibilidade de Funções nas Escalas (Matriz + Segmentos do Culto)

Status geral: **concluído (validado localmente)**

Criação: 2026-10-14

Branch de planejamento: `docs/schedule-role-compatibility-plan`

Branch sugerida para implementação: `feature/compatibilidade-funcoes-escalas`

Baseline de testes: `apps/api/src/modules/escalas/escalas.service.spec.ts` (20 testes).

---

## 1. Contexto e Problema

O bloqueio atual de conflito em escalas impede que a mesma pessoa seja escalada mais de uma vez no mesmo dia civil. Isso foi introduzido para resolver a dor original de alocações concorrentes acidentais, mas passou a bloquear combinações legítimas comuns na rotina das igrejas:

| Pessoa   | Combinação                                            | Comportamento Atual | Comportamento Desejado                                                                          |
| -------- | ------------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------- |
| Gleison  | Ministro + Violão (mesmo ministério de Louvor)        | ❌ Bloqueado        | ✅ **Permitir** (mesmo segmento ou compatibilidade direta)                                |
| Carlos   | Ministro + Violão (Louvor) + Pregador (Geral/Pastoral) | ❌ Bloqueado        | ✅ **Permitir** (segmentos distintos no mesmo culto)                                      |
| Thaynara | Back (Louvor) + Professora (Ministério Infantil)       | ❌ Bloqueado        | ⚠️ **Permitir com Aviso** (segmentos consecutivos com troca de local: Palco → Salinha) |
| Messias  | Baixo (Louvor) + Mesa de Som (Mídia)                   | ❌ Bloqueado        | ❌ **Continuar Bloqueado** (sobreposição no Louvor)                                     |
| Messias  | Baixo (Louvor) + Portaria (Obreiros)                    | ❌ Bloqueado        | ❌ **Continuar Bloqueado** (sobreposição no mesmo culto)                                |
| Lídia   | Professora EBD (Manhã 09h) + Back Culto (Noite 19h)    | ❌ Bloqueado        | ✅ **Permitir** (eventos distintos com horários não sobrepostos)                        |

### Causa Raiz

A regra atual pergunta apenas: *"O membro já possui qualquer escala registrada hoje?"* (`EscalaItem` no intervalo 00:00:00 a 23:59:59 do mesmo dia).

Deveria perguntar:

1. *Os eventos ocorrem em horários diferentes no mesmo dia?* (Se sim, sem conflito).
2. *Dentro do mesmo culto/evento, os segmentos de atuação se sobrepõem?* (Se não se sobrepõem, sem conflito).
3. *Se os segmentos se sobrepõem, o par de funções possui autorização expressa na matriz?* (Se sim, permitir ou avisar; se não, bloquear).

---

## 2. Estado Atual do Código

### Já existe

- **Módulo de Escalas**: `/escalas` na web e `EscalasService` na API.
- **Modelos no Prisma**:
  - `Escala` (`tb_schedule`): vinculada a `Ministerio`, com mês e ano.
  - `EscalaDia` (`tb_schedule_day`): data do dia e vínculo opcional a `Evento` (`eventoId`).
  - `EscalaItem` (`tb_schedule_assignment`): atribuição de um `Membro` a uma `MinisterioFuncao` no `EscalaDia`.
  - `MinisterioFuncao` (`tb_ministry_position`): funções específicas de cada ministério (ex.: Ministro, Violão, Baixo, Mesa de som, Professora, Portaria).
  - `Evento` (`tb_event`): com `dataInicio` e `dataFim` no tenant.
- **Validação de conflito atual**:
  - `EscalasService.addMembro` consulta `prisma.escalaItem.findFirst` verificando se o membro já tem escala em `dia.data` (00:00:00 a 23:59:59.999).
  - Retorna `BadRequestException` textual genérica.
- **Restrição física no banco**:
  - `tb_schedule_assignment` possui constraint única `tb_schedule_assignment_schedule_day_id_member_id_key` (`@@unique([escalaDiaId, membroId])`).
  - Também possui `tb_schedule_assignment_schedule_day_id_member_id_ministry_p_key` (`@@unique([escalaDiaId, membroId, ministerioFuncaoId])`).
- **Comportamento da grade web (`escala-grid.tsx`)**:
  - `CellMemberSelect` filtra previamente membros já escalados no dia: `alreadyAssigned.includes(ministerioMembro.membroId)`.

### Problemas e o que ainda não existe

- **Constraint do banco é impeditiva**: a constraint física `[escalaDiaId, membroId]` impede que o mesmo membro tenha dois itens na mesma escala/dia, mesmo que a aplicação quisesse permitir.
- **Conceito de Segmentos do Culto**: não existe no schema nem nas regras (ex.: Abertura, Louvor, Pregação, Encerramento).
- **Vínculo Função × Segmentos**: não há definição de em quais momentos do culto uma função atua.
- **Local de atuação da função**: não existe campo para diferenciar Palco, Cabine, Salinha, Portaria.
- **Matriz de Compatibilidade**: não existe tabela para pares de funções autorizadas (`PERMITIR` / `AVISAR`).
- **Filtro agressivo no frontend**: o dropdown de membros oculta quem já foi alocado em qualquer função do dia.
- **Tratamento de avisos**: a API não possui resposta estruturada com `tipo: 'BLOQUEIO' | 'AVISO'` nem aceita flag `confirmarAvisos`.

---

## 3. Decisões Fechadas de Arquitetura

### 1. A compatibilidade é entre funções (`MinisterioFuncao`), nunca por pessoa

- A regra vale para o par de funções (`funcaoAId`, `funcaoBId`), herdada por qualquer membro escalado em ambas.
- Não existem exceções cadastrais por pessoa (ex.: "o Gleison pode, o João não").
- Mantém o sistema auditável, previsível e sem regras ocultas por indivíduo.

### 2. O padrão seguro continua sendo BLOQUEAR

- Par de funções sem regra cadastrada = **BLOQUEIO** (`SEM_REGRA`).
- Só existem dois registros possíveis na matriz: `PERMITIR` e `AVISAR`.
- "Bloquear" é a ausência de registro na matriz (apagar a regra restaura o bloqueio).
- Em tenants sem nenhuma configuração de segmentos ou matriz, o comportamento de segurança é **idêntico ao atual**.

### 3. Ajuste obrigatório de integridade no banco (Remoção segura de constraint)

- Para que um membro possa exercer duas funções na mesma `EscalaDia` (ex.: Ministro + Violão no Louvor), a migration deve:
  1. Remover a constraint única física `tb_schedule_assignment_schedule_day_id_member_id_key` (`@@unique([escalaDiaId, membroId])`).
  2. Manter a constraint única `tb_schedule_assignment_schedule_day_id_member_id_ministry_p_key` (`@@unique([escalaDiaId, membroId, ministerioFuncaoId])`).
- Isso garante que a mesma pessoa nunca seja alocada na **mesma função duas vezes**, mas viabiliza alocações compatíveis na mesma data.

### 4. Segmentos do culto por tenant (`tb_schedule_segment`)

- Cada tenant possui uma lista ordenada de segmentos.
- Template padrão inicial sugerido no primeiro acesso: `Abertura` (ordem 1), `Louvor` (ordem 2), `Pregação` (ordem 3), `Encerramento` (ordem 4). Editável por `ADMIN` e `STAFF`.
- Cada `MinisterioFuncao` declara os segmentos em que atua (`tb_ministry_position_segment`).
- **Função sem segmento declarado**: tratada como atuando em **todos** os segmentos (comportamento conservador padrão).
- **Sem sobreposição de segmentos**: se as duas funções não compartilham nenhum segmento, não há conflito de tempo (passa sem precisar de regra na matriz).
- **Com sobreposição de segmentos**: se compartilham ao menos um segmento, consulta-se a matriz de compatibilidade.

### 5. Local de atuação e aviso de transição

- `MinisterioFuncao` recebe campo opcional `localAtuacao` (ex.: `Palco`, `Cabine`, `Salinha`, `Portaria`).
- Se duas funções possuem segmentos **consecutivos** (diferença de ordem = 1), com locais **distintos e preenchidos**, gera um **AVISO** (`TRANSICAO_LOCAL`).
- Local em branco em qualquer uma das funções não gera aviso de transição.

### 6. Escopo de conflito: Mesmo Culto vs Horários Distintos no Dia

- Quando duas escalas do mesmo membro ocorrem no mesmo dia civil:
  - Se ambas possuem `eventoId` diferente e os horários dos eventos não se sobrepõem (ex.: EBD 09h-11h e Culto 19h-21h): **NÃO HÁ CONFLITO**.
  - Se ocorrem no mesmo `eventoId`, ou na mesma `EscalaDia`, ou os eventos possuem horários sobrepostos (ou sem horário/evento informado): **MESMO ESCOPO OPERACIONAL** → aplica validação de segmentos e matriz.

### 7. Duas severidades: Bloqueio vs Aviso

- **BLOQUEIO**: escala não é criada/salva. HTTP 409 com detalhes dos conflitos. Não permite override.
- **AVISO**: HTTP 409 com flag `requerConfirmacao: true`.
  - A web exibe modal de confirmação com a justificativa (ex.: transição de local ou regra `AVISAR`).
  - O usuário confirma e a web reenvia a requisição com `confirmarAvisos: true`.
  - A confirmação é registrada em `AuditLog`.

### 8. Gestão e Permissões

- Apenas `ADMIN` e `STAFF` configuram segmentos, locais de atuação e a matriz de compatibilidade.
- `BASIC` líder ou co-líder opera normalmente a grade da escala e é guiado pelas regras (recebe avisos e bloqueios).
- Escalas já salvas não são revalidadas retroativamente. As regras valem para as próximas alocações.

---

## 4. Contrato Proposto

### Modelo de Dados Prisma

```prisma
// Em apps/api/prisma/schema.prisma

enum RegraCompatibilidade {
  PERMITIR @map("ALLOW")
  AVISAR   @map("WARN")

  @@map("schedule_role_compatibility_rule")
}

model SegmentoCulto {
  id        String   @id @default(uuid())
  tenantId  String   @map("tenant_id")
  nome      String   @map("name")
  ordem     Int      @map("display_order")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  tenant   Tenant                     @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  funcoes  MinisterioFuncaoSegmento[]

  @@unique([tenantId, nome])
  @@unique([tenantId, ordem])
  @@index([tenantId])
  @@map("tb_schedule_segment")
}

model MinisterioFuncaoSegmento {
  funcaoId   String @map("position_id")
  segmentoId String @map("segment_id")

  funcao   MinisterioFuncao @relation(fields: [funcaoId], references: [id], onDelete: Cascade)
  segmento SegmentoCulto    @relation(fields: [segmentoId], references: [id], onDelete: Cascade)

  @@id([funcaoId, segmentoId])
  @@map("tb_ministry_position_segment")
}

model CompatibilidadeFuncao {
  id         String               @id @default(uuid())
  tenantId   String               @map("tenant_id")
  funcaoAId  String               @map("position_a_id") // normalizado: menor UUID
  funcaoBId  String               @map("position_b_id") // normalizado: maior UUID
  regra      RegraCompatibilidade
  observacao String?              @map("notes")
  createdAt  DateTime             @default(now()) @map("created_at")
  updatedAt  DateTime             @updatedAt @map("updated_at")

  tenant  Tenant           @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  funcaoA MinisterioFuncao @relation("CompatibilidadeFuncaoA", fields: [funcaoAId], references: [id], onDelete: Cascade)
  funcaoB MinisterioFuncao @relation("CompatibilidadeFuncaoB", fields: [funcaoBId], references: [id], onDelete: Cascade)

  @@unique([tenantId, funcaoAId, funcaoBId])
  @@index([tenantId])
  @@map("tb_schedule_role_compatibility")
}

// Alterações em modelos existentes:

model MinisterioFuncao {
  // ... campos existentes ...
  localAtuacao String? @map("work_location")

  segmentos          MinisterioFuncaoSegmento[]
  compatibilidadesA  CompatibilidadeFuncao[]    @relation("CompatibilidadeFuncaoA")
  compatibilidadesB  CompatibilidadeFuncao[]    @relation("CompatibilidadeFuncaoB")
}

model EscalaItem {
  // ... campos existentes ...

  // REMOVER: @@unique([escalaDiaId, membroId])
  // MANTER:
  @@unique([escalaDiaId, membroId, ministerioFuncaoId])
  @@map("tb_schedule_assignment")
}
```

### Especificação da Migration (Padrão Físico 100% em Inglês)

Seguindo as regras de banco de dados do projeto (`ai-context/database/migration-rules.md`), a migration física deve ser estritamente em **inglês**:

- **Nome da pasta**: `YYYYMMDDHHMMSS_add_schedule_role_compatibility`
- **Tabelas criadas**: `tb_schedule_segment`, `tb_ministry_position_segment`, `tb_schedule_role_compatibility`
- **Enum criado**: `schedule_role_compatibility_rule` (`'ALLOW'`, `'WARN'`)
- **Colunas adicionadas**: `work_location` em `tb_ministry_position`
- **Constraint removida**: remoção de `tb_schedule_assignment_schedule_day_id_member_id_key` em `tb_schedule_assignment`

Exemplo do SQL gerado pela migration:

```sql
-- CreateEnum
CREATE TYPE "schedule_role_compatibility_rule" AS ENUM ('ALLOW', 'WARN');

-- AlterTable
ALTER TABLE "tb_ministry_position" ADD COLUMN "work_location" TEXT;

-- DropIndex (permite mesma pessoa em funções compatíveis distintas no mesmo dia)
DROP INDEX IF EXISTS "tb_schedule_assignment_schedule_day_id_member_id_key";

-- CreateTable
CREATE TABLE "tb_schedule_segment" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tb_schedule_segment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_ministry_position_segment" (
    "position_id" TEXT NOT NULL,
    "segment_id" TEXT NOT NULL,

    CONSTRAINT "tb_ministry_position_segment_pkey" PRIMARY KEY ("position_id","segment_id")
);

-- CreateTable
CREATE TABLE "tb_schedule_role_compatibility" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "position_a_id" TEXT NOT NULL,
    "position_b_id" TEXT NOT NULL,
    "rule" "schedule_role_compatibility_rule" NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tb_schedule_role_compatibility_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tb_schedule_segment_tenant_id_name_key" ON "tb_schedule_segment"("tenant_id", "name");
CREATE UNIQUE INDEX "tb_schedule_segment_tenant_id_display_order_key" ON "tb_schedule_segment"("tenant_id", "display_order");
CREATE INDEX "tb_schedule_segment_tenant_id_idx" ON "tb_schedule_segment"("tenant_id");
CREATE UNIQUE INDEX "tb_schedule_role_compatibility_tenant_id_position_a_id_position_b_id_key" ON "tb_schedule_role_compatibility"("tenant_id", "position_a_id", "position_b_id");
CREATE INDEX "tb_schedule_role_compatibility_tenant_id_idx" ON "tb_schedule_role_compatibility"("tenant_id");

-- AddForeignKey
ALTER TABLE "tb_schedule_segment" ADD CONSTRAINT "tb_schedule_segment_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tb_tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tb_ministry_position_segment" ADD CONSTRAINT "tb_ministry_position_segment_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "tb_ministry_position"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tb_ministry_position_segment" ADD CONSTRAINT "tb_ministry_position_segment_segment_id_fkey" FOREIGN KEY ("segment_id") REFERENCES "tb_schedule_segment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tb_schedule_role_compatibility" ADD CONSTRAINT "tb_schedule_role_compatibility_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tb_tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tb_schedule_role_compatibility" ADD CONSTRAINT "tb_schedule_role_compatibility_position_a_id_fkey" FOREIGN KEY ("position_a_id") REFERENCES "tb_ministry_position"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tb_schedule_role_compatibility" ADD CONSTRAINT "tb_schedule_role_compatibility_position_b_id_fkey" FOREIGN KEY ("position_b_id") REFERENCES "tb_ministry_position"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

### Algoritmo do Motor de Validação (Função Pura)

```text
Entrada:
  - membroId, novaFuncao, novoDia (com data e evento opcional)
  - itensExistentesDoMembroNoDia (com suas funções, ministérios, segmentos e eventos)
  - matrizCompatibilidadeDoTenant
  - segmentosDoTenant 

Para cada item E em itensExistentes:
  1. Verificar escopo de evento:
     se E.evento e novoDia.evento existem e horários não se sobrepõem:
       pular item (sem conflito)

  2. Mesma função:
     se E.funcaoId == novaFuncao.id:
       retornar BLOQUEIO (motivo: FUNCAO_REPETIDA)

  3. Segmentos:
     segsE = segmentos de E.funcao (se vazio => todos os segmentos do tenant)
     segsN = segmentos de novaFuncao (se vazio => todos os segmentos do tenant)

  4. Sobreposição de segmentos:
     se (segsE ∩ segsN) não é vazio:
       regra = matriz[menorId(E, N), maiorId(E, N)]
       se regra == null:
         retornar BLOQUEIO (motivo: SEM_REGRA)
       se regra == 'AVISAR':
         registrar AVISO (motivo: REGRA_AVISAR)
       se regra == 'PERMITIR':
         ok (não adiciona aviso nem bloqueio)

  5. Não sobrepõem - verificar transição consecutiva com locais distintos:
     senao se existe segA ∈ segsE, segB ∈ segsN com |segA.ordem - segB.ordem| == 1
          e E.funcao.localAtuacao preenchido
          e novaFuncao.localAtuacao preenchido
          e E.funcao.localAtuacao != novaFuncao.localAtuacao:
       registrar AVISO (motivo: TRANSICAO_LOCAL)

Resultado:
  - Se houver algum BLOQUEIO => retornar status de bloqueio com lista de conflitos.
  - Se houver apenas AVISOS => retornar status de aviso com requerConfirmacao = true.
  - Se lista vazia => aprovar alocação.
```

### Contratos da API

#### 1. Alocação de Membro na Escala

```http
POST /api/escalas/dias/:diaId/itens
```

Payload (`ManageEscalaItemDto`):

```ts
{
  membroId: string;
  ministerioFuncaoId: string;
  observacoes?: string;
  confirmarAvisos?: boolean; // default false
}
```

Resposta de Erro de Conflito (HTTP 409 Conflict):

```ts
type RespostaConflitoEscala = {
  statusCode: 409;
  message: string;
  error: 'Conflict';
  requerConfirmacao: boolean; // true se SOMENTE houver avisos e confirmarAvisos for false
  conflitos: Array<{
    tipo: 'BLOQUEIO' | 'AVISO';
    motivo: 'FUNCAO_REPETIDA' | 'SEM_REGRA' | 'REGRA_AVISAR' | 'TRANSICAO_LOCAL';
    membroNome: string;
    funcaoExistente: string;
    ministerioExistente: string;
    funcaoNova: string;
    ministerioNovo: string;
    segmentosEmComum?: string[];
    localOrigem?: string;
    localDestino?: string;
    mensagem: string;
  }>;
};
```

#### 2. Endpoints de Configuração de Escalas (`ADMIN` e `STAFF`)

```http
# Segmentos do Culto
GET    /api/escalas/configuracao/segmentos
POST   /api/escalas/configuracao/segmentos            // body: { nome: string, ordem: number }
PATCH  /api/escalas/configuracao/segmentos/:id        // body: { nome?: string, ordem?: number }
DELETE /api/escalas/configuracao/segmentos/:id
PATCH  /api/escalas/configuracao/segmentos/ordem      // body: { segmentoIds: string[] }

# Configuração de Funções (Segmentos e Local)
GET    /api/escalas/configuracao/funcoes              // lista todas as funções do tenant com seus segmentos e locais
PUT    /api/escalas/configuracao/funcoes/:id          // body: { segmentoIds: string[], localAtuacao?: string | null }

# Matriz de Compatibilidade
GET    /api/escalas/configuracao/compatibilidade      // lista regras cadastradas
PUT    /api/escalas/configuracao/compatibilidade      // body: { funcaoAId: string, funcaoBId: string, regra: 'PERMITIR' | 'AVISAR' | null, observacao?: string }
```

---

## 5. Experiência da Web

### 1. Grade de Escalas (`escala-grid.tsx` e `use-escalas.ts`)

- **Desbloqueio da seleção**:
  - Em `CellMemberSelect`, remover o filtro `alreadyAssigned.includes(membroId)`.
  - Filtrar apenas se o membro já estiver atribuído à **mesma célula** (`cellItems.some(item => item.membroId === membroId)`).
  - Adicionar um marcador visual sutil (ex.: `*` ou badge) caso o membro já esteja em outra função do dia.
- **Tratamento de conflitos no Submit**:
  - Se a API retornar HTTP 409 com `requerConfirmacao: false` (Bloqueio):
    - Exibir toast de erro com a mensagem detalhada do conflito e os ministérios/funções conflitantes.
  - Se a API retornar HTTP 409 com `requerConfirmacao: true` (Aviso):
    - Abrir `ConfirmModal` (ODS):
      - Título: *Aviso de Escala*
      - Mensagem: exibe a lista de avisos (ex.: *"Thaynara atua em segmentos consecutivos com troca de local: Palco (Louvor) → Salinha (Ministério Infantil). Deseja confirmar essa escala?"*).
      - Botão Primário: *Confirmar Alocação*
      - Botão Secundário: *Cancelar*
    - Ao confirmar, invocar novamente `addMembroItem` passando `confirmarAvisos: true`.

### 2. Configurações da Igreja (`/configuracoes`) - Liturgia e Matriz

Acessível por `ADMIN` (e `STAFF` com permissões adequadas), a tela central de configurações do sistema agrega as definições institucionais do culto e da igreja em uma nova aba: **Liturgia e Escalas**:

1. **Segmentos do Culto (Liturgia Institucional)**:
   - Momentos sequenciais do culto da igreja (Abertura, Louvor, Pregação, Encerramento).
   - Lista reordenável com botões para subir/descer e chamada a `PATCH /api/escalas/configuracao/segmentos/ordem`.
   - Ações de adicionar, renomear e excluir segmento.
   - Botão "Carregar template padrão" para preenchimento imediato dos 4 momentos litúrgicos fundamentais.
2. **Matriz de Compatibilidade entre Funções**:
   - Centralizada como regra geral da igreja, permitindo mapear relações intra e inter-ministeriais (ex: Louvor ↔ Mídia, Louvor ↔ Pastoral).
   - Busca por função e ministério.
   - Listagem com badges ODS (`PERMITIR` em verde esmeralda, `AVISAR` em âmbar) e notas explicativas.
   - Modal para cadastro de novas regras entre Função A e Função B.
   - Exclusão com `ConfirmDialog` (revertendo ao bloqueio padrão de sobreposição).

### 3. Gestão de Funções nos Ministérios (`/ministerios`)

Acessível pelos líderes de ministério e administradores:

- Diretamente na aba **"Funções"** do modal de gerenciamento de cada ministério (`/ministerios`).
- Ao cadastrar ou configurar uma função ministerial:
  - Associação dos momentos do culto em que a função atua (multi-select / checkboxes dos `SegmentoCulto` ativos do tenant).
  - Definição do local físico de trabalho (`localAtuacao`, ex: Palco, Mesa de Som, Salinha de Crianças).
  - Nota explicativa: *"Se nenhum momento for selecionado, a função será considerada atuante em todo o culto."*

---

## 6. Arquivos Impactados

### API

- `apps/api/prisma/schema.prisma` (novos modelos, campos e remoção de constraint única).
- `apps/api/prisma/migrations/*_schedule_role_compatibility/migration.sql` (migration do banco).
- `apps/api/src/modules/escalas/conflitos/validador-conflitos.ts` (motor puro de validação).
- `apps/api/src/modules/escalas/conflitos/validador-conflitos.spec.ts` (testes unitários isolados do motor).
- `apps/api/src/modules/escalas/dto/manage-escala-item.dto.ts` (campo `confirmarAvisos`).
- `apps/api/src/modules/escalas/dto/create-segmento.dto.ts`, `reorder-segmentos.dto.ts`, `update-segmento.dto.ts`, `update-funcao-configuracao.dto.ts`, `upsert-compatibilidade.dto.ts`.
- `apps/api/src/modules/escalas/escalas.service.ts` (integração do validador em `addMembro`).
- `apps/api/src/modules/escalas/escalas.service.spec.ts` (testes do serviço).
- `apps/api/src/modules/escalas/configuracao-escalas.service.ts` (CRUD de segmentos, matriz e funções).
- `apps/api/src/modules/escalas/configuracao-escalas.controller.ts` (endpoints `/api/escalas/configuracao/*`).
- `apps/api/src/modules/escalas/escalas.module.ts` (registro dos novos controllers e services).

### Web

- `apps/web/src/hooks/use-escalas.ts` (parâmetro `confirmarAvisos` em `addMembroItem`).
- `apps/web/src/components/app/escala-grid.tsx` (ajuste do dropdown em `CellMemberSelect` e modal de aviso).
- `apps/web/src/app/(dashboard)/escalas/page.tsx` (tela operacional pura de escalas, sem botão de configuração).
- `apps/web/src/app/(dashboard)/configuracoes/page.tsx` (nova aba de Liturgia e Escalas com Segmentos e Matriz).
- `apps/web/src/app/(dashboard)/ministerios/page.tsx` (configuração de momentos e local na aba de funções do ministério).
- `apps/web/src/hooks/use-configuracao-escalas.ts` (hook para chamadas de configuração de segmentos, funções e matriz).
- `apps/web/src/types/index.ts` (novos tipos de segmento, matriz e resposta de conflito).
- `apps/web/messages/pt-BR.json`, `pt-PT.json`, `en-US.json` (chaves de tradução em `settings` e `ministries`).

### Documentação

- `ai-context/business-rules/validation-rules.md` (atualização da seção de regras de Escala).
- `ai-context/plans/README.md` (índice de planos atualizado).
- este plano.

---

## 7. Etapas de Implementação

> **Regra de Execução por Etapas**: O desenvolvimento segue estritamente etapa por etapa. Ao concluir cada etapa, o checklist é atualizado no plano, os resultados das validações e builds são reportados ao usuário, e o início da etapa seguinte aguarda obrigatoriamente a autorização expressa do usuário.

### Etapa 0 - Baseline e Validação de Ambiente

- [X] Confirmar que o trabalho parte da `development` atualizada.
- [X] Criar a branch `feature/compatibilidade-funcoes-escalas`.
- [X] Executar baseline de testes de Escalas (20 testes em `escalas.service.spec.ts`).
- [X] Verificar integridade do schema local antes das alterações.

Critério de saída:

- Branch criada e testes existentes de Escalas 100% verdes.

### Etapa 1 - Schema Prisma e Migration

- [X] Adicionar os modelos `SegmentoCulto`, `MinisterioFuncaoSegmento`, `CompatibilidadeFuncao` e enum `RegraCompatibilidade`.
- [X] Adicionar campo `localAtuacao` em `MinisterioFuncao`.
- [X] Atualizar `EscalaItem` removendo `@@unique([escalaDiaId, membroId])` e preservando `@@unique([escalaDiaId, membroId, ministerioFuncaoId])`.
- [X] Gerar e rodar migration Prisma (`prisma migrate dev` / `prisma migrate deploy`).
- [X] Validar que a base local aceita a migration sem corromper dados existentes.

Critério de saída:

- Migration aplicada com sucesso e Prisma Client atualizado.

### Etapa 2 - Motor Puro de Validação de Conflitos

- [X] Criar `validador-conflitos.ts` implementando o algoritmo desacoplado de banco.
- [X] Normalizar o par de IDs (`funcaoAId < funcaoBId`) para pesquisa comutativa na matriz.
- [X] Cobrir casos de teste unitário exaustivos em `validador-conflitos.spec.ts`:
  - Mesma função na mesma data (bloqueio).
  - Sem sobreposição de segmentos (permitido).
  - Com sobreposição e regra `PERMITIR` (permitido).
  - Com sobreposição e regra `AVISAR` (aviso).
  - Com sobreposição e sem regra (bloqueio).
  - Segmentos consecutivos com locais diferentes (aviso de transição).
  - Segmentos consecutivos com locais iguais ou vazios (permitido).
  - Função sem segmentos cadastrados (avalia como todos os segmentos).
  - Eventos em horários distintos no mesmo dia (sem conflito).

Critério de saída:

- 100% dos cenários do motor cobertos com testes unitários puros.

### Etapa 3 - Integração no `EscalasService` e API de Escala

- [X] Atualizar `ManageEscalaItemDto` para aceitar `confirmarAvisos?: boolean`.
- [X] Integrar o motor em `EscalasService.addMembro`.
- [X] Lançar exceção HTTP 409 tipada (`ConflictException`) com os detalhes estruturados quando houver bloqueio ou aviso pendente de confirmação.
- [X] Se `confirmarAvisos === true` e houver apenas avisos, persistir alocação e registrar em `AuditLog`.
- [X] Garantir que o comportamento sem configurações seja idêntico ao legado.
- [X] Atualizar os testes de `escalas.service.spec.ts`.

Critério de saída:

- Endpoint `POST /api/escalas/dias/:diaId/itens` responde com o novo contrato de conflito e grava com confirmação de aviso.

### Etapa 4 - API de Configurações de Escala

- [X] Criar `ConfiguracaoEscalasService` e `ConfiguracaoEscalasController`.
- [X] Implementar CRUD de `SegmentoCulto` com unicidade por tenant.
- [X] Implementar atualização de segmentos e local de atuação para `MinisterioFuncao`.
- [X] Implementar upsert e deleção na `CompatibilidadeFuncao`.
- [X] Proteger rotas com guard RBAC para `ADMIN` e `STAFF`.
- [X] Testes de controller e service de configuração.

Critério de saída:

- API de configuração operacional, testada e isolada por tenant.

### Etapa 5 - Frontend: Grade de Escalas e Modal de Confirmação

- [X] Ajustar `CellMemberSelect` em `escala-grid.tsx` para permitir membros já escalados em outras funções.
- [X] Atualizar `addMembroItem` em `use-escalas.ts` para suportar `confirmarAvisos`.
- [X] Integrar modal de confirmação de avisos (ODS `ConfirmModal`) ao receber 409 com `requerConfirmacao: true`.
- [X] Tratar bloqueios exibindo mensagem clara com funções e ministérios conflitantes.

Critério de saída:

- Usuário consegue escalar Gleison (Ministro + Violão) diretamente e Thaynara com modal de confirmação de aviso.

### Etapa 6 - Frontend: Reestruturação Arquitetural das Configurações

Conforme alinhamento arquitetural (DDD e ODS), as configurações são distribuídas nos seus contextos de domínio:
- **Igreja (`/configuracoes`)**: Aba "Liturgia e Escalas" reunindo Segmentos do Culto e Matriz de Compatibilidade institucional.
- **Ministérios (`/ministerios`)**: Aba "Funções" de cada ministério com associação aos momentos do culto e local de atuação.
- **Escalas (`/escalas`)**: Tela operacional limpa focada estritamente na alocação de voluntários e validação de conflitos.

Checklist:
- [X] Integrar a aba "Liturgia e Escalas" (Segmentos e Matriz) em `apps/web/src/app/(dashboard)/configuracoes/page.tsx`.
- [X] Integrar a configuração de segmentos e local de atuação na aba "Funções" em `apps/web/src/app/(dashboard)/ministerios/page.tsx`.
- [X] Remover o botão "Configurações" do cabeçalho de `apps/web/src/app/(dashboard)/escalas/page.tsx` e descontinuar `/escalas/configuracao`.
- [X] Atualizar e harmonizar chaves de tradução em `settings` e `ministries` nos arquivos `pt-BR.json`, `pt-PT.json` e `en-US.json`.
- [X] Validar conformidade com ODS e executar build de produção (`npm run build` em `apps/web`).

Critério de saída:
- Segmentos e matriz operacionais dentro de `/configuracoes`, funções configuradas dentro de `/ministerios`, e build da web 100% aprovado.

### Etapa 7 - Validação Final e Builds

- [X] Executar suíte completa de testes da API (`npm run test`).
- [X] Executar build de produção da API (`npm run build` em `apps/api`).
- [X] Executar build de produção da Web (`npm run build` em `apps/web`).
- [X] Executar `git diff --check` para garantir ausência de resíduos ou quebras de formatação.
- [X] Atualizar `validation-rules.md` com as novas regras operacionais de compatibilidade.

Critério de saída:

- Builds e testes 100% aprovados sem warnings bloqueantes.

---

## 8. Estratégia de Testes Manuais

1. **Gleison (Mesmo Ministério - Ministro + Violão)**:

   - Configurar `Ministro ↔ Violão` como `PERMITIR` no mesmo ministério de Louvor.
   - Escalar Gleison em Ministro e depois em Violão no mesmo dia/culto.
   - **Resultado esperado**: ambas as funções alocadas com sucesso sem erros.
2. **Carlos (Louvor + Geral/Pastoral - Ministro + Violão + Pregador)**:

   - Configurar Ministro e Violão no segmento `Louvor`, e Pregador no segmento `Pregação`.
   - Escalar Carlos nas três funções no mesmo culto.
   - **Resultado esperado**: Louvor e Pregação não têm sobreposição de segmento; alocações aceitas.
3. **Thaynara (Aviso de Transição de Local)**:

   - Back no segmento `Louvor` com local `Palco`.
   - Professora no segmento `Pregação` (adjacente) com local `Salinha`.
   - Escalar Thaynara em Back e depois em Professora.
   - **Resultado esperado**: modal de aviso informando transição Palco → Salinha; ao confirmar, alocação gravada.
4. **Messias (Baixo + Mesa de Som - Bloqueio)**:

   - Baixo e Mesa de Som atuam no segmento `Louvor` e não possuem regra `PERMITIR` na matriz.
   - Tentar escalar Messias em ambas.
   - **Resultado esperado**: bloqueio com mensagem clara informando a sobreposição de funções sem regra.
5. **Messias (Baixo + Portaria - Bloqueio de Ministérios Distintos)**:

   - Baixo (Louvor) e Portaria (Obreiros) atuam no mesmo horário/culto.
   - Tentar escalar Messias em ambas.
   - **Resultado esperado**: bloqueio informando conflito interministerial.
6. **Lídia (EBD de manhã + Culto à noite)**:

   - Escalar Lídia na EBD (09:00 às 11:00) e no Culto (19:00 às 21:00) no mesmo domingo.
   - **Resultado esperado**: horários não se sobrepõem; ambas as escalas permitidas.
7. **Mesma função duas vezes (Bloqueio estrito)**:

   - Tentar escalar Gleison como Ministro duas vezes no mesmo dia.
   - **Resultado esperado**: bloqueio imediato por função repetida.
8. **Comportamento Sem Configuração (Regressão Zero)**:

   - Em um tenant novo ou sem matriz configurada, tentar escalar a mesma pessoa em duas funções no mesmo dia.
   - **Resultado esperado**: bloqueio idêntico ao comportamento atual do sistema.
9. **Segurança e RBAC**:

   - Tentar acessar `/escalas/configuracao` com usuário `BASIC` comum ou líder.
   - **Resultado esperado**: redirecionamento ou acesso negado 403; apenas `ADMIN` e `STAFF` configuram.
10. **Isolamento Multi-tenant**:

    - Configurar regras no Tenant A e verificar se no Tenant B as regras e segmentos permanecem isolados.
    - **Resultado esperado**: total segregação por `tenantId`.

---

## 9. Ordem de Deploy e Migrations

1. **Deploy da API (Fase 1)**:
   - Aplicar a migration com criação das tabelas `tb_schedule_segment`, `tb_ministry_position_segment`, `tb_schedule_role_compatibility` e remoção da constraint `tb_schedule_assignment_schedule_day_id_member_id_key`.
   - Publicar API com o novo motor e endpoints de configuração.
   - *Sem regras cadastradas, o comportamento de produção permanece rigorosamente inalterado.*
2. **Deploy da Web (Fase 2)**:
   - Publicar a interface web com a tela de configuração `/escalas/configuracao` e o suporte a confirmação de avisos na grade de escalas.
3. **Rollout Piloto**:
   - Configurar segmentos e matriz na igreja piloto e validar os fluxos reais de Louvor, Infantil e Mídia.
4. **Disponibilização Geral**:
   - Habilitar o uso para os demais tenants.

---

## 10. Rollback

- **Rollback da Web**: reverter para a versão anterior. A grade volta a filtrar membros já escalados sem quebrar a API.
- **Rollback da API**:
  - Reverter código da API para a verificação anterior.
  - A remoção da constraint física `[escalaDiaId, membroId]` não precisa ser revertida imediatamente no banco, pois a validação de software continuará garantindo a integridade.
  - As novas tabelas adicionadas não interferem no funcionamento legado caso fiquem sem uso.

---

## 11. Riscos e Mitigações

| Risco                                                        | Impacto                   | Mitigação                                                                                                  |
| ------------------------------------------------------------ | ------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Liberar combinações em excesso por engano                  | Membros sobrecarregados   | Padrão é sempre bloquear; regras só existem se cadastradas explicitamente; alterações são auditadas.   |
| Quebra de integridade física ao remover constraint do banco | Concorrência acidental   | Mantida a constraint `(escalaDiaId, membroId, ministerioFuncaoId)` e validação transacional no service.  |
| Regressão para igrejas que não configurarem segmentos      | Falhas em escalas legadas | Função sem segmento = todos os segmentos; sem regra = bloqueio. Comportamento default idêntico ao legado. |
| Perda de performance ao validar combinações na grade       | Lentidão ao salvar item  | O motor roda em memória com joins pré-carregados numa única query otimizada indexada por `tenantId`.    |

---

## 12. Critérios de Aceite Finais

- [X] Gleison pode ser escalado como Ministro e Violão no mesmo culto do Louvor.
- [X] Carlos pode ser escalado como Ministro + Violão (Louvor) e Pregador (Pregação) no mesmo culto.
- [X] Thaynara pode ser escalada em Louvor e Infantil mediante confirmação de aviso de troca de local.
- [X] Messias continua impedido de assumir Baixo + Mesa de Som e Baixo + Portaria.
- [X] EBD de manhã e Culto à noite não se bloqueiam mutuamente.
- [X] A mesma pessoa na mesma função duas vezes no mesmo dia permanece bloqueada.
- [X] Sem nenhuma configuração cadastrada, o comportamento de bloqueio é 100% idêntico ao legado.
- [X] Somente `ADMIN` e `STAFF` configuram a matriz e segmentos; isolamento multi-tenant intacto.
- [X] Suíte de testes da API e builds da API e Web passam sem erros.
