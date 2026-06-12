# Fase 5: Design dos Modais CRUD (ODS)

Este documento estabelece o design arquitetural oficial dos Modais CRUD e as decisões necessárias para executar a migração (Fase 5), baseadas nos apontamentos da auditoria de Pré-Análise.

---

## 1. Decisão sobre Componentes

### 1.1 ModalFooter
**Decisão:** **Aprovado.** Deve existir.
* **Responsabilidades:** Encapsular e padronizar o bloco inferior de todos os modais da plataforma. Irá uniformizar as margens superiores (`border-t`), o alinhamento dos botões (geralmente lado direito), e tratar os estados visuais de submissão (loading spinners, botões desabilitados).
* **Ações suportadas:** O componente deverá suportar uma ação primária (ex: "Salvar", "Criar"), uma ação de cancelamento (ex: "Fechar", "Cancelar") e possuir suporte opcional a um slot secundário no lado oposto (ex: "Arquivar", "Deletar", para o caso de edições).
* **Obrigatoriedade:** Deve ser obrigatório em todos os modais que representem um CRUD (Criação, Atualização, Exclusão). Modais puramente informativos podem consumi-lo enviando apenas a ação de "Fechar".

### 1.2 TabsShell
**Decisão:** **Aprovado.** Deve ser criado.
* **Necessidade:** É estritamente necessário para absorver a complexidade do modal de Ministérios (que já utiliza um sistema de abas manuais para Info, Membros e Funções).
* **Justificativa de Uso:** Além de Ministérios, as futuras implementações do módulo "Super Admin" (configurações completas de Tenant) e "Painel do Usuário / Meu Perfil" fatalmente exigirão formulários separados por guias estruturais.
* **Momento da Criação:** Deve ser criado **agora** (durante a Fase 5). Não podemos refatorar Ministérios sem esse componente, e deixar Ministérios para fora quebraria o escopo do ODS na plataforma.

---

## 2. Decisão sobre Hooks (useCrudForm)

**Decisão:** **Rejeitado.** (Não).
* **Justificativa:** O OneElo adota o padrão arquitetural de centralizar a lógica de requisições, `loading`, `error` e invalidação de cache (SWR ou equivalentes manuais) dentro de **Custom Hooks de Domínio** (ex: `useMinisterios`, `useEventos`, `useEscalas`).
* Criar um hook agnóstico de UI como `useCrudForm` geraria concorrência direta com esses hooks de domínio, espalhando lógica de requisição e forçando refatorações massivas em locais que não deveriam sofrer impacto nesta fase de componentes de interface. O correto é a tela invocar os métodos de `useEventos` e simplesmente repassar as props (ex: `loading={loading}`) para o `<ModalFooter>`.

---

## 3. Arquitetura Recomendada (Estrutura Oficial de CRUD)

O padrão oficial para injeção de formulários do OneElo passa a ser:

```jsx
<ModalShell title="Novo Evento" subtitle="Adicione à agenda">
  <form onSubmit={handleSave}>
    {/* Tratamento de Erro Padrão */}
    <ModalError message={error} />
    
    {/* Opção A: Modal Simples */}
    <div className="space-y-4 p-6">
      <InputField label="Título" required />
      <SelectField label="Status" />
    </div>

    {/* Opção B: Modal Complexo com Abas */}
    <TabsShell tabs={[{ id: 'info', label: 'Info' }, { id: 'membros', label: 'Membros' }]}>
       <div className="p-6">...</div>
    </TabsShell>

    {/* Rodapé Obrigatório */}
    <ModalFooter 
      primaryLabel="Salvar" 
      onCancel={handleClose} 
      loading={isSaving} 
      secondaryAction={isEditing ? <DeleteButton /> : null} 
    />
  </form>
</ModalShell>
```
* **Responsabilidades:** O `ModalShell` continua sendo a "casca/backdrop". O form abraça o conteúdo (permitindo sumissões via tecla *Enter*). O `ModalFooter` isola os botões e evita repetição de JSX nos finais dos arquivos.

---

## 4. Estratégia de Migração e Complexidade

A ordem de migração segue a matriz de risco da Pré-Análise (do menor para o maior impacto na estabilidade da árvore React):

1. **Agenda (Risco: Baixo | Complexidade: Baixa):** Formulário vertical e clássico. Será o piloto perfeito para homologar o `ModalFooter` e os campos (Inputs e Selects).
2. **Usuários e Configurações (Risco: Baixo | Complexidade: Baixa):** O modal principal (`UsuarioModal`) já é ODS. Resta apenas migrar o modal solto de inativação de usuários para o `ConfirmDialog` oficial.
3. **Escalas (Risco: Baixo | Complexidade: Baixa):** A estrutura de edição é inline (tabela), as refatorações cabem apenas aos modais simples soltos pela tela (criação de mês, aviso de IA).
4. **Membros (Risco: Baixo | Complexidade: Baixa):** Migrar o modal manual que cadastra novas Tags (`<div className="fixed inset-0...">`) para os moldes padrão.
5. **Super Admin (Risco: Média | Complexidade: Média):** Refatorar o helper customizado do arquivo (`CreateTenantModal` e afins) para consumir o `ModalShell` base da aplicação.
6. **Ministérios (Risco: Alta | Complexidade: Alta):** É a etapa final. Usará tudo que foi estabilizado: `ModalShell`, `ModalFooter` e o novíssimo `TabsShell`.

---

## 5. Riscos e Ganho Esperado

* **Riscos Arquiteturais:** O refactoring do modal de Ministérios lidará com modificação profunda na UI enquanto preserva lógicas complexas de atribuição de permissão por membro (`MinistryRole`) e checkboxes dinâmicas para Funções de voluntários. Haverá alto risco de regressão nos callbacks desses formulários.
* **Ganho Visível:** Uma vez finalizada, o usuário do OneElo finalmente sentirá o sistema 100% amarrado ao Design System. As bordas, paddings, sombreamentos e comportamentos de carregamento ao clicar em botões serão imperceptíveis independentemente do módulo navegado.
* **Redução Estimada de Código:** Estima-se uma exclusão de cerca de **200 a 300 linhas líquidas** de boilerplate Tailwind (como modais de fundo preto e botões padrão reescritos dezenas de vezes).

---

## 6. ODS Compliance Estimado

| Métrica | Situação Atual | Após Fase 5 |
|---|---|---|
| **Formulários** | ~50% | **~100%** |
| **Modais** | ~50% | **~100%** |
| **CRUDs (Mutações)** | ~20% | **~100%** |
| Aderência Global | ~45% | **> 70%** |

---

## 7. Plano de Implementação

1. **Step 1:** Modificar o arquivo `modal-shell.tsx` para acomodar e exportar o novo `<ModalFooter>`.
2. **Step 2:** Criar o componente `tabs-shell.tsx`.
3. **Step 3:** Iniciar a conversão linear módulo a módulo, seguindo a hierarquia aprovada (Agenda → Configurações → Escalas → Membros → Super Admin → Ministérios).
4. **Step 4:** Auditoria e Commit Final.

---

### Respostas Finais:
* **A Fase 5 deve criar novos componentes?** Sim. `<ModalFooter>` e `<TabsShell>`.
* **A Fase 5 deve criar novos hooks?** Não. O sistema dependerá dos hooks de domínio de serviços atuais.
* **Quais módulos migrar primeiro?** A Agenda, por ser o escopo CRUD mais tradicional e seguro.
* **Qual o ganho esperado de aderência ao ODS?** A arquitetura visual de formulários baterá a métrica de ~100%, empurrando o projeto como um todo para além dos 70% de aderência ODS.
