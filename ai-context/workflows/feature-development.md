# Workflow de Desenvolvimento de Feature

Este workflow deve ser seguido para novas features e correcoes planejadas.

---

## Padrao de Branch

1. Sempre partir da branch `development`.
2. Sempre atualizar `development` antes de criar a branch.
3. Criar uma branch de feature/correcao com nome descritivo.
4. Nao misturar refactors ou mudancas nao relacionadas.
5. Nao iniciar edicao de codigo antes de validar os passos 1 a 3.

Comandos esperados:

```txt
git checkout development
git pull
git checkout -b feature/nome-da-feature
```

Se houver alteracoes locais nao relacionadas, preservar o trabalho existente e usar stash quando necessario. Nunca descartar alteracoes do usuario sem pedido explicito.

---

## Plano de Desenvolvimento

Antes de implementar uma feature relevante:

1. Verificar se existe plano em `ai-context/plans`.
2. Se nao existir, criar um plano seguindo o padrao dos planos existentes.
3. Manter checklist com etapas pequenas e verificaveis.
4. Atualizar o checklist durante o desenvolvimento, nao apenas no final.

Planos sao documentos vivos. Eles devem refletir decisoes tomadas durante a implementacao.

---

## Implementacao

- Seguir padroes existentes do projeto.
- Preferir services/helpers locais ja existentes.
- Backend deve ser a fonte de verdade de autorizacao.
- Frontend pode ocultar UI, mas nao pode ser a unica barreira de seguranca.
- Alteracoes de RBAC devem atualizar a documentacao de contexto.
- Mudancas de UX/navegacao devem atualizar `ai-context/frontend/navigation-rules.md` quando aplicavel.

---

## Validacao

Antes de concluir:

1. Rodar build/testes relevantes.
2. Registrar comandos executados e resultado.
3. Informar warnings conhecidos se eles nao bloquearem.
4. Atualizar o plano em `ai-context/plans`.

Comandos comuns:

```txt
npm.cmd run build
```

Executar no pacote afetado:

- `apps/api`
- `apps/web`

---

## Finalizacao

Ao finalizar, informar:

- arquivos principais alterados;
- comportamento entregue;
- validacoes executadas;
- pendencias ou riscos residuais.
