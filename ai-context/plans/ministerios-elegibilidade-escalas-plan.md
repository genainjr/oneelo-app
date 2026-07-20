# Plano - Elegibilidade de Ministérios e Membros para Escalas

Status geral: planejado

Criação: 2026-07-19

Branch de planejamento: `docs/event-batch-and-schedule-eligibility-plans`

Branch sugerida para implementação: `feature/ministerios-elegibilidade-escalas`

Origem: necessidade identificada no Ministério Infantil e em ministérios que não utilizam escalas.

## Objetivo

Separar claramente três conceitos hoje misturados:

1. o ministério utiliza ou não o módulo de Escalas;
2. o membro pertence ao ministério, mas pode ou não ser escalado;
3. quando escalável, o membro pode atuar em todas ou somente em funções específicas.

A entrega também ampliará a visualização de ministérios para apresentar a relação de membros sem misturar liderança, equipe de escala e demais participantes.

## Resultado esperado

- Cada ministério informa se utiliza escalas.
- Ministérios sem escala não aparecem na criação de escalas nem permitem `requerEscala` em eventos.
- Cada vínculo `MinisterioMembro` informa se a pessoa pode ser escalada naquele ministério.
- Membros não escaláveis continuam pertencendo e aparecendo no ministério.
- A seleção da escala mostra apenas membros elegíveis para a função.
- A API aplica a mesma regra e impede inclusão por chamada direta.
- A visualização de ministérios permite consultar todos os membros em grupos coerentes.
- Dados e escalas existentes são preservados.

## Valor entregue ao cliente

O Ministério Infantil pode manter professores, liderança e crianças no mesmo contexto organizacional sem oferecer crianças na seleção das escalas. Ministérios que não trabalham com escala deixam de gerar opções e ruído no módulo.

## Estado atual do código

### Já existe

- `Ministerio.ativo` e relações com membros, funções, eventos e escalas.
- `MinisterioMembro.role` para `LEADER`, `ASSISTANT_LEADER` e `MEMBER`.
- `MinisterioMembroFuncao` para funções disponíveis por membro.
- Gestão de funções por membro na aba **Membros** do modal de ministério.
- Líder `BASIC` autorizado a gerir membros e funções somente no próprio ministério.
- Seleção de membros na grade da escala.
- Regra atual da web: membro sem função configurada aparece em todas as funções.
- Visualização de ministérios com contagem total, liderança e funções do ministério.
- `GET /api/ministerios/:id` já retorna todos os membros e funções disponíveis.
- `requerEscala` por relação entre evento e ministério.

### Problemas atuais

- Todo ministério ativo aparece como potencial ministério de escala.
- Não existe indicação de que um membro pertence ao ministério, mas não compõe equipe de escala.
- Crianças e participantes aparecem como candidatos quando não possuem função configurada.
- O filtro de elegibilidade está principalmente na web.
- `EscalasService.addMembro` valida o membro no tenant, mas não comprova vínculo com o ministério, elegibilidade nem função permitida.
- A visualização mostra apenas a quantidade total e os líderes, sem relação completa dos membros.

## Decisões fechadas

### 1. Não criar ministérios artificiais

- Professores e crianças permanecem no mesmo Ministério Infantil.
- O vínculo ministerial representa pertencimento.
- Elegibilidade de escala é uma característica adicional do vínculo.
- Não usar separação de ministérios como solução para um problema de escala.

### 2. Adicionar dois controles explícitos

```prisma
model Ministerio {
  usaEscalas Boolean @default(true) @map("uses_schedules")
}

model MinisterioMembro {
  podeSerEscalado Boolean @default(true) @map("can_be_scheduled")
}
```

Labels sugeridos:

- Ministério: **Este ministério utiliza escalas**.
- Membro: **Pode ser escalado neste ministério**.

Texto auxiliar do membro:

> Define se este membro aparece na seleção das escalas deste ministério.

### 3. Defaults preservam produção

- Ministérios existentes recebem `usaEscalas = true`.
- Vínculos existentes recebem `podeSerEscalado = true`.
- Não executar inferência por função, papel ou nome do ministério.
- Não desmarcar automaticamente crianças ou outros participantes.
- O usuário revisa somente os casos que precisam mudar.

### 4. Função vazia mantém o comportamento atual

Para um membro com `podeSerEscalado = true`:

- sem função configurada: pode aparecer em todas as funções do ministério;
- com funções configuradas: aparece somente nas funções selecionadas.

Essa decisão mantém compatibilidade e representa explicitamente o caso “pode atuar em qualquer função”.

Para um membro com `podeSerEscalado = false`, funções configuradas são preservadas, mas ignoradas enquanto o campo estiver desmarcado.

### 5. O controle pertence ao vínculo ministerial

- Não adicionar o campo ao cadastro global de `Membro`.
- A mesma pessoa pode ser escalável no Louvor e não escalável no Infantil.
- O campo é editado em `Ministérios → Membros`, junto de papel e funções.

### 6. Ministério sem escala permanece operacional nos demais módulos

Quando `usaEscalas = false`:

- continua ativo e visível em Ministérios;
- continua aceitando membros, liderança e funções;
- pode ser relacionado a eventos com `requerEscala = false`;
- não aparece na criação de nova escala;
- não aceita `requerEscala = true` na API;
- não oferece o controle de equipe de escala na interface;
- escalas antigas permanecem visíveis e não são apagadas.

O campo controla novas escalas e novas necessidades de escala. Ele não exclui nem reescreve histórico.

### 7. Escalas existentes permanecem gerenciáveis

- Desativar `usaEscalas` não encerra nem remove escalas existentes.
- Escalas já criadas continuam seguindo seu status e permissões atuais.
- A interface deve avisar quando o ministério possui escalas abertas ou históricas.
- Reativar o campo restaura a criação sem perder configurações dos membros.

### 8. A API é a fonte de verdade da elegibilidade

Ao adicionar alguém a uma função da escala, validar:

1. dia e escala pertencem ao tenant autenticado;
2. função pertence ao mesmo ministério da escala;
3. membro está ativo, não excluído e pertence ao mesmo ministério;
4. `podeSerEscalado = true`;
5. se houver funções configuradas, a função solicitada está entre elas;
6. escala está aberta e o usuário pode gerir o ministério.

O frontend filtra a lista para usabilidade, mas não substitui essas validações.

### 9. Permissões atuais são preservadas

- `ADMIN` e `STAFF` configuram `usaEscalas` no ministério.
- `BASIC` líder ou auxiliar não edita dados estruturais do ministério.
- `ADMIN`, `STAFF` e líder ou auxiliar do próprio ministério configuram `podeSerEscalado` e funções dos membros.
- `BASIC` comum não acessa a gestão.
- Nenhum campo amplia acesso a outro ministério.

### 10. A visualização agrupa membros sem duplicação

Ao expandir um ministério, apresentar grupos mutuamente exclusivos:

1. **Liderança**: `LEADER` e `ASSISTANT_LEADER`, com papel, funções e indicador de escala quando aplicável.
2. **Equipe de escala**: `MEMBER` com `podeSerEscalado = true`.
3. **Demais membros**: `MEMBER` com `podeSerEscalado = false`.

Para ministério com `usaEscalas = false`, apresentar apenas **Liderança** e **Membros**, sem linguagem de equipe de escala.

A contagem principal continua representando todos os membros ativos do ministério.

### 11. A relação completa será carregada sob demanda

- Manter `GET /api/ministerios` leve, retornando resumo, líderes, funções e contadores.
- Ao expandir **Ver membros**, reutilizar `GET /api/ministerios/:id`.
- Cachear o detalhe por ministério durante a sessão da página.
- Mostrar loading e retry apenas na área expandida.
- Evitar carregar todos os membros de todos os ministérios na abertura da visualização.

## Modelo de dados e migration

### Prisma proposto

```prisma
model Ministerio {
  usaEscalas Boolean @default(true) @map("uses_schedules")

  @@index([tenantId, ativo, usaEscalas])
}

model MinisterioMembro {
  podeSerEscalado Boolean @default(true) @map("can_be_scheduled")

  @@index([ministerioId, podeSerEscalado])
}
```

### Regras da migration

- Migration exclusivamente aditiva.
- Colunas `NOT NULL` com default `true`.
- Sem seed, `UPDATE`, `DELETE` ou inferência de dados.
- Índices criados depois das colunas.
- Validar em banco local e auditar produção em modo somente leitura antes do deploy.

## Contratos propostos

### Ministério

```ts
type CreateMinisterioInput = {
  nome: string;
  descricao?: string;
  funcoes?: string[];
  usaEscalas?: boolean;
};

type UpdateMinisterioInput = {
  nome?: string;
  descricao?: string;
  ativo?: boolean;
  funcoes?: string[];
  usaEscalas?: boolean;
};
```

### Vínculo do membro

```ts
type AddMembroMinisterioInput = {
  membroId: string;
  role?: MinistryRole;
  funcaoIds?: string[];
  podeSerEscalado?: boolean;
};

type UpdateMembroMinisterioInput = {
  role?: MinistryRole;
  funcaoIds?: string[];
  podeSerEscalado?: boolean;
};
```

### Compatibilidade

- Campo ausente no create usa default `true`.
- Campo ausente no update preserva o valor atual.
- Clientes antigos continuam funcionando durante deploy parcial.
- Respostas de ministério e vínculo passam a incluir os novos campos.

## Regras por fluxo

### Criação e edição de ministério

- Mostrar o controle na aba **Informações**.
- Em ministério novo, iniciar marcado para compatibilidade.
- Ao desmarcar em ministério com escalas existentes, exibir aviso não destrutivo.
- Salvar nunca remove escalas, funções ou elegibilidade dos membros.

### Gestão dos membros

- Na adição, mostrar **Pode ser escalado neste ministério** quando o ministério usa escalas.
- Iniciar marcado para compatibilidade.
- No card expandido do membro, posicionar o controle acima das funções.
- Quando desmarcado, manter funções visíveis como configuração preservada, mas indicar que não serão usadas.
- Líderes e auxiliares seguem as mesmas regras de elegibilidade; papel ministerial não implica participação automática na escala.

### Eventos

- Ministérios continuam selecionáveis para contexto e visibilidade.
- Para `usaEscalas = false`, ocultar ou desabilitar **Precisa de escala**.
- Ao alterar `usaEscalas` para `false`, relações existentes com `requerEscala = true` precisam ser tratadas explicitamente.

Decisão para o MVP:

- bloquear a desativação enquanto existir evento futuro agendado com `requerEscala = true`;
- informar os eventos conflitantes e orientar a desmarcação;
- não alterar relações automaticamente.

### Criação de escalas

- O seletor de ministério mostra somente ativos com `usaEscalas = true`.
- A API rejeita criação para ministério desabilitado mesmo com ID enviado diretamente.
- Consultas de escalas antigas não filtram pelo campo.

### Seleção de membros na escala

- A web remove candidatos com `podeSerEscalado = false`.
- Funções configuradas restringem as opções.
- A API repete todas as validações antes do `upsert` de `EscalaItem`.
- Erro informa que o membro não está disponível para aquela função, sem expor dados de outro tenant.

### Visualização de ministérios

- Adicionar ação read-only **Ver membros** em cada card.
- Expandir dentro do próprio card ou em painel coerente com o layout atual.
- Carregar detalhe sob demanda.
- Ordenar liderança por papel e nome; demais grupos por nome.
- Exibir funções como badges compactos.
- Em mobile, usar seções verticais recolhíveis.
- Não adicionar controles de edição à rota `/ministerios/visualizacao`.

## Arquivos impactados

### Banco e API

- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/<timestamp>_add_schedule_eligibility/migration.sql` — novo
- `apps/api/src/modules/ministerios/dto/create-ministerio.dto.ts`
- `apps/api/src/modules/ministerios/dto/update-ministerio.dto.ts`
- `apps/api/src/modules/ministerios/dto/manage-ministerio.dto.ts`
- `apps/api/src/modules/ministerios/ministerios.controller.ts`
- `apps/api/src/modules/ministerios/ministerios.service.ts`
- `apps/api/src/modules/eventos/eventos.service.ts`
- `apps/api/src/modules/escalas/escalas.service.ts`
- testes unitários de Ministérios, Eventos e Escalas

### Web

- `apps/web/src/app/(dashboard)/ministerios/page.tsx`
- `apps/web/src/app/(dashboard)/ministerios/visualizacao/page.tsx`
- `apps/web/src/app/(dashboard)/agenda/page.tsx`
- `apps/web/src/app/(dashboard)/escalas/page.tsx`
- `apps/web/src/components/app/escala-grid.tsx`
- `apps/web/src/hooks/use-ministerios.ts`
- `apps/web/src/types/index.ts`
- `apps/web/messages/pt-BR.json`
- `apps/web/messages/pt-PT.json`
- `apps/web/messages/en-US.json`

### Documentação

- `ai-context/database/models.md`
- `ai-context/business-rules/validation-rules.md`
- `ai-context/architecture/rbac-decisions.md`, se necessário para explicitar a nova ação contextual
- este plano

## Etapas de implementação

### Etapa 0 - Auditoria e baseline

- [ ] Confirmar `development` atualizada e criar branch de implementação.
- [ ] Registrar baseline de testes e builds.
- [ ] Auditar quantidade de ministérios, vínculos e funções em produção somente leitura.
- [ ] Auditar eventos futuros com `requerEscala = true`.
- [ ] Confirmar que os defaults `true` preservam o comportamento atual.

Critério de saída:

- migration aditiva e impacto sobre dados existentes comprovados antes da escrita.

### Etapa 1 - Schema, migration e contratos

- [ ] Adicionar os dois campos e índices no Prisma.
- [ ] Criar migration aditiva sem backfill manual.
- [ ] Atualizar DTOs de ministério e vínculo ministerial.
- [ ] Atualizar selects, includes, tipos e respostas.
- [ ] Preservar contrato quando campos novos estiverem ausentes.
- [ ] Validar Prisma e migration local.

Critério de saída:

- banco e API expõem os campos sem alterar o comportamento dos registros existentes.

### Etapa 2 - Regras do ministério

- [ ] Persistir `usaEscalas` em create e update.
- [ ] Bloquear desativação com eventos futuros que ainda exigem escala.
- [ ] Filtrar ministérios na criação de novas escalas.
- [ ] Rejeitar criação direta de escala para ministério desabilitado.
- [ ] Rejeitar `requerEscala = true` em ministério desabilitado.
- [ ] Preservar leitura e manutenção das escalas existentes.

Critério de saída:

- ministério sem escala deixa de gerar novas demandas sem perder histórico.

### Etapa 3 - Elegibilidade do membro

- [ ] Persistir `podeSerEscalado` ao adicionar e atualizar membro.
- [ ] Permitir gestão por `ADMIN`, `STAFF` e liderança contextual autorizada.
- [ ] Filtrar candidatos na web.
- [ ] Validar tenant do dia e da escala na API.
- [ ] Validar vínculo com o ministério, membro ativo e elegibilidade.
- [ ] Validar pertencimento da função ao ministério.
- [ ] Aplicar regra de funções específicas ou todas quando vazias.
- [ ] Cobrir chamadas diretas que tentem burlar a web.

Critério de saída:

- pessoa não escalável ou incompatível com a função não pode ser incluída por nenhum cliente.

### Etapa 4 - Gestão de ministério na web

- [ ] Adicionar controle do ministério na aba **Informações**.
- [ ] Adicionar controle do membro no fluxo de inclusão.
- [ ] Adicionar controle no detalhe expandido do membro.
- [ ] Ocultar contexto de escala quando o ministério não usa escalas.
- [ ] Preservar funções ao desmarcar elegibilidade.
- [ ] Implementar avisos de conflitos sem exclusão automática.
- [ ] Ajustar estados mobile, loading, erro e sucesso.

Critério de saída:

- usuário entende a diferença entre pertencer ao ministério e participar de escalas.

### Etapa 5 - Integração com Agenda e Escalas

- [ ] Expor `usaEscalas` nos ministérios usados pelo formulário de evento.
- [ ] Impedir **Precisa de escala** para ministério desabilitado.
- [ ] Limpar `requerEscala` no estado do formulário quando necessário.
- [ ] Filtrar seletor de ministério na criação da escala.
- [ ] Manter escalas existentes acessíveis.
- [ ] Adicionar mensagens específicas para bloqueios da API.

Critério de saída:

- evento e escala respeitam a capacidade do ministério sem alterar visibilidade ministerial.

### Etapa 6 - Visualização da relação de membros

- [ ] Adicionar **Ver membros** nos cards da visualização.
- [ ] Carregar `GET /api/ministerios/:id` sob demanda e cachear resultado.
- [ ] Separar liderança, equipe de escala e demais membros.
- [ ] Adaptar os grupos quando o ministério não utiliza escalas.
- [ ] Exibir papel e funções sem controles de edição.
- [ ] Implementar loading, erro, retry e estado vazio por card.
- [ ] Validar desktop e mobile com ministério de muitos membros.

Critério de saída:

- a visualização mostra quem pertence e quem compõe a equipe sem misturar os grupos.

### Etapa 7 - Testes, documentação e rollout

- [ ] Testar defaults e migration sem perda de dados.
- [ ] Testar ministério com e sem escala.
- [ ] Testar membro escalável, não escalável, todas as funções e funções específicas.
- [ ] Testar `ADMIN`, `STAFF`, líder `BASIC` e `BASIC` comum.
- [ ] Testar isolamento entre tenants e tentativa por IDs externos.
- [ ] Testar conflito de evento futuro ao desativar escala do ministério.
- [ ] Testar escalas históricas depois da desativação.
- [ ] Executar testes, builds, Prisma e `git diff --check`.
- [ ] Atualizar modelos, regras e checklist com resultados reais.

Critério de saída:

- dados existentes, RBAC, histórico e novas regras estão comprovados por testes e roteiro manual.

## Matriz de comportamento

| Ministério usa escalas | Membro pode ser escalado | Funções configuradas | Resultado |
|---|---|---|---|
| Não | qualquer valor | qualquer valor | Não participa de novas escalas |
| Sim | Não | qualquer valor | Não aparece e API rejeita |
| Sim | Sim | Nenhuma | Pode atuar em todas as funções |
| Sim | Sim | Uma ou mais | Pode atuar somente nas funções marcadas |

## Estratégia de testes manuais

1. Marcar Ministério Infantil como usuário de escalas.
2. Marcar professores como escaláveis e crianças como não escaláveis.
3. Confirmar que somente professores aparecem na escala.
4. Restringir um professor a uma função e testar outra coluna.
5. Confirmar bloqueio equivalente por chamada direta à API.
6. Desativar escalas em um ministério sem histórico e conferir Agenda e Escalas.
7. Tentar desativar um ministério com evento futuro que exige escala.
8. Confirmar que escalas antigas continuam visíveis.
9. Reativar o ministério e conferir configurações preservadas.
10. Abrir a visualização e conferir os grupos e contagens.
11. Validar um líder `BASIC` no próprio ministério e fora dele.
12. Validar dois tenants sem compartilhamento de dados.

## Ordem de deploy

1. Auditar produção em modo somente leitura.
2. Aplicar migration aditiva.
3. Publicar API compatível com campos ausentes.
4. Validar contratos antigos.
5. Publicar web de gestão e filtros.
6. Publicar visualização de membros.
7. Ajustar tenant piloto e validar o Ministério Infantil.

## Rollback

- Reverter a web primeiro mantém a API compatível com clientes antigos.
- Reverter a API não exige remover imediatamente as colunas aditivas.
- Não remover colunas durante rollback emergencial.
- Defaults `true` preservam comportamento anterior se a nova UI for retirada.
- Nenhum rollback apaga escalas, funções ou vínculos ministeriais.

## Riscos e mitigações

### Pessoas desaparecerem das escalas após deploy

Mitigação: defaults `true`; mudança somente por ação explícita do usuário.

### Frontend ser a única barreira

Mitigação: validar vínculo, campo e função no `EscalasService`.

### Desativar ministério com demandas futuras

Mitigação: bloquear enquanto houver evento futuro agendado com `requerEscala = true` e não alterar relações silenciosamente.

### Payload excessivo na visualização

Mitigação: carregar membros sob demanda pelo endpoint de detalhe e cachear por ministério.

### Confusão entre papel e função

Mitigação: manter `role` como liderança, `podeSerEscalado` como elegibilidade e `funcoesDisponiveis` como capacidade operacional.

### Deploy parcial

Mitigação: campos opcionais no contrato e defaults compatíveis no banco.

## Fora do escopo

- Criar ministérios separados automaticamente.
- Classificar semanticamente membros como criança, professor, aluno ou voluntário.
- Disponibilidade por data ou período.
- Bloqueio temporário de férias.
- Alterar os papéis `LEADER`, `ASSISTANT_LEADER` e `MEMBER`.
- Apagar ou encerrar escalas existentes ao desativar o recurso.
- Alterar visibilidade de eventos.
- Criar escala automaticamente.

## Critérios de aceite finais

- Ministério informa explicitamente se utiliza escalas.
- Membro informa explicitamente se pode ser escalado naquele ministério.
- Campos novos preservam todos os registros atuais com default `true`.
- Ministério sem escala não recebe nova escala nem `requerEscala = true`.
- Escalas existentes permanecem disponíveis.
- Membro não escalável não aparece e não pode ser incluído pela API.
- Funções específicas restringem candidatos; lista vazia continua significando todas.
- Permissões ministeriais atuais permanecem inalteradas.
- Visualização mostra relação completa agrupada e sem edição.
- Contagem principal inclui todos os membros ativos.
- Tenant e IDs enviados são validados no backend.
- Migration é aditiva e não executa seed ou backfill destrutivo.

