# Pré-Análise: Fase 5 - Modais CRUD (ODS)

## Estado Atual
Atualmente, apenas as páginas de Membros e Usuários utilizam as fundações de modais criadas na Fase 1 (`ModalShell`, `ModalError`, e campos base). As demais páginas do sistema implementam seus modais CRUD de forma completamente manual, recriando as camadas de sombra (`fixed inset-0 bg-black/60 backdrop-blur-xs`), estruturas de formulários e cabeçalhos em cada arquivo.

## Inventário de Modais
1. **MembroModal** (`membros`): Implementação ODS existente. Modal de tags (`membros/page.tsx`) com implementação manual.
2. **Ministérios** (`ministerios/page.tsx`): Modal de criação/edição altamente complexo, implementação manual contendo três abas dinâmicas (Info, Membros, Funções).
3. **Agenda** (`agenda/page.tsx`): Modal de criação/edição manual, com formulário denso e inputs de datetime.
4. **Escalas** (`escalas/page.tsx`): Modais manuais soltos, como o modal de funcionalidade IA e criação inicial de escala.
5. **UsuárioModal** (`configuracoes`): Implementação ODS existente. Modal de exclusão (`configuracoes/page.tsx`) implementado manualmente (em vez de usar ConfirmDialog).
6. **Super Admin** (`admin/page.tsx`): Três modais completamente manuais (`CreateTenantModal`, `EditTenantModal`, `CreateUserModal`), empacotados num helper local.

## Inventário de Formulários
* **Campos Padronizados ODS:** Utilizados estritamente no `MembroModal` e `UsuarioModal` (`InputField`, `SelectField`, `TextareaField`, `PasswordField`).
* **Campos Manuais:** Em Ministérios, Agenda, Escalas e Super Admin, os inputs são declarados com tags HTML `input`, `select` e `textarea` cruas, replicando a cadeia imensa de classes CSS do Tailwind (`px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-100`).

## Componentes Compartilhados Utilizados
* **ConfirmDialog**: Alta adoção (utilizado de ponta a ponta na Agenda, Ministérios e Escalas para ações destrutivas).
* **ModalShell**: Baixa/Média adoção. Apenas nos componentes herdados da Fase 1.
* **ModalError**: Baixa/Média adoção.

## Componentes Compartilhados Não Utilizados
As páginas cruas continuam não utilizando as fundações ODS:
* Nenhuma delas usa o shell.
* Nenhuma usa o `InputField`, `SelectField` ou `TextareaField`.
* Em Configurações, um modal destrutivo manual de desativação foi criado ignorando o `ConfirmDialog`.

## Duplicações Encontradas
* **Classificação: Alta Duplicação.**
* **Overlay/Wrapper**: Todo arquivo redefine a `div className="fixed inset-0..."`.
* **Headers de Modal**: O bloco `<div className="flex items-center justify-between px-6 py-4 border-b">` se repete em quase todos os módulos.
* **Footers**: Lógica de botões "Salvar" e "Cancelar" (com loading states manuais em cada formulário).
* **Estilização Visual**: Existem inconsistências de layout. A agenda usa inputs `bg-gray-50` com `px-4 py-2.5`, o Super Admin usa inputs brancos `px-3 py-2`, e o modal de Ministérios usa `px-4 py-2.5 bg-white`.

## Complexidade por Módulo
* **Agenda**: **Baixa/Média**. Trata-se de um formulário contínuo simples.
* **Escalas**: **Baixa**. Modais auxiliares menores.
* **Super Admin**: **Média**. Requer unificação do helper local para uso do ODS sem quebrar a tela administrativa.
* **Ministérios**: **Alta**. O modal possui abas (Tabs), listas aninhadas, combobox complexos de busca de membros com atribuição de papéis, demandando muito cuidado para não ferir a arquitetura reativa atual.

## Estratégia Recomendada
A migração deve ocorrer na seguinte ordem para garantir curva de validação sem sobressaltos:
1. **Agenda**: Menor risco, formulário canônico.
2. **Configurações/Usuários**: Substituir a desativação manual por `ConfirmDialog`.
3. **Escalas**: Padronizar os toasts de IA e criação de escala usando `ModalShell`.
4. **Super Admin**: Migrar as 3 variantes parciais.
5. **Ministérios**: Deixar para o final, dado que a arquitetura das abas pode exigir uma evolução no `ModalShell` ou a injeção do formulário em camadas.

## Riscos
* **Quebra de State**: Embutir as regras de negócio de `Ministérios` (que usam arrays imutáveis no estado) dentro de um novo sistema de componentes genéricos pode causar bugs na inserção de novas funções de membros.
* **Tipagens**: Passar sub-estado para formulários desacoplados exige interfaces estritas de Typescript.

## Componentes Necessários vs Existentes
Os componentes já criados (`ModalShell`, `InputField`, `SelectField`) cobrem 80% do necessário. 
**No entanto**, pode ser necessário criar:
* Um `<TabsShell>` ou `ModalTabs` no core do ODS para acomodar modais complexos como o de Ministérios, sem poluir o `ModalShell` original.
* Um `ModalFooter` padronizado para matar os infinitos botões manuais repetidos nos fins dos formulários.

## Ganho Esperado e Estimativa de Redução de Código
A remoção agressiva das centenas de tags HTML de formatação vai reduzir o tamanho dos arquivos de páginas (`admin.tsx`, `agenda.tsx`, `ministerios.tsx`) em pelo menos **20% a 30%**. O ganho principal é de consistência visual para a Igreja Piloto: Modais iguais, com inputs iguais.

## Próximos Passos
O usuário deve avaliar esta pré-análise e, havendo acordo com as diretrizes propostas (e com a adoção do ODS para modais), seguir para autorizar a implementação oficial da Fase 5 (criação das adaptações em `ModalShell` e aplicação ordenada nos módulos).

---

### Respostas Objetivas Finais

* **A Fase 5 possui baixa, média ou alta complexidade?**
  Possui **Alta Complexidade** devido à fragilidade e ramificação lógica do modal de Ministérios, além da fragmentação maciça de inputs.
* **Quais módulos devem migrar primeiro?**
  **Agenda** deve iniciar o roteiro por ter os moldes mais limpos e canônicos para formulários lineares, abrindo terreno para as demais páginas.
* **Quais componentes adicionais são realmente necessários?**
  É recomendada a criação de um componente/subcomponente para acomodar `Tabs` (para Ministério) e um `ModalFooter` isolado para padronizar as ações "Salvar / Cancelar".
* **Qual o ganho estimado de aderência ao ODS após a conclusão da Fase 5?**
  A aderência em Modais e Formulários subirá de **~50%** para próximo de **100%**, levando a aderência global do ODS de **~45%** para mais de **70%**.
