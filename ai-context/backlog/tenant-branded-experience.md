# Backlog - Experiência personalizada da igreja por tenant

### FT-012 Identidade, conteúdo e engajamento por tenant

- **Prioridade**: alta
- **Fase**: evolução da experiência do membro
- **Categoria**: produto / UX / personalização / engajamento
- **Esforço estimado**: alto
- **Contexto**: o OneElo já isola os dados de cada igreja e permite cadastrar sua logo, mas a experiência principal ainda apresenta predominantemente a identidade fixa do produto. Login, navegação, PWA, página inicial e comunicação não formam uma experiência própria da igreja. A personalização atual também não ajuda o usuário a encontrar rapidamente o próximo compromisso ou conteúdo relevante.
- **Ação**: criar uma experiência personalizada e coerente para cada tenant, combinando identidade visual controlada, entrada identificada por igreja, página inicial relevante por perfil, conteúdo institucional, navegação configurável, PWA personalizado e métricas de adoção.
- **Impacto**: aumenta pertencimento, reconhecimento, utilidade recorrente e frequência de uso, mantendo a consistência, acessibilidade e sustentabilidade operacional do OneElo.

## Visão funcional

Cada usuário deve perceber que está utilizando o ambiente digital da sua igreja, sem perder a confiança de que a tecnologia é fornecida e mantida pelo OneElo.

A experiência não deve se limitar a trocar logo e cor. Ela deve responder a três perguntas logo após o acesso:

1. Em qual igreja estou?
2. O que é relevante para mim agora?
3. Qual é a próxima ação que preciso realizar?

O direcionamento inicial é de personalização controlada com co-branding discreto. Um whitelabel integral, sem qualquer referência ao OneElo, pode ser avaliado futuramente como capacidade comercial específica.

## Objetivos de produto

- reforçar a identidade e o senso de pertencimento à igreja;
- reduzir o tempo até a próxima ação relevante;
- aumentar acessos recorrentes de membros e lideranças;
- aumentar confirmações de escala realizadas pelo sistema;
- tornar eventos, comunicados e conteúdos mais descobertos;
- oferecer autonomia de personalização sem comprometer usabilidade;
- manter uma experiência consistente entre web, PWA, notificações, ativação e materiais impressos;
- permitir evolução comercial por plano sem criar aplicações diferentes por tenant.

## Públicos atendidos

### Membro

Precisa acompanhar sua vida na comunidade com o mínimo de navegação possível:

- próximas escalas;
- confirmações pendentes;
- próximos eventos;
- comunicados da igreja e dos seus ministérios;
- ministérios dos quais participa;
- informações e links importantes da igreja;
- atualização do próprio perfil.

### Liderança ministerial

Precisa combinar sua experiência pessoal com ações de coordenação:

- situação das escalas dos ministérios que lidera;
- confirmações, recusas e pendências;
- próximos eventos ministeriais;
- acesso rápido aos membros e escalas autorizados;
- criação e acompanhamento de comunicados ministeriais quando a `FT-011` estiver disponível.

### Administração do tenant

Precisa configurar a experiência da igreja e acompanhar sua adoção:

- identidade visual e informações públicas;
- página inicial e conteúdo em destaque;
- navegação e módulos visíveis;
- comunicados gerais;
- indicadores de utilização;
- pré-visualização antes da publicação.

## Escopo funcional

### 1. Configuração da identidade da igreja

O `ADMIN` do tenant deve possuir uma área de configuração com:

- nome público da igreja;
- nome curto para espaços reduzidos;
- logo para fundo claro;
- logo para fundo escuro;
- ícone quadrado para instalação do PWA;
- imagem de capa opcional;
- cor principal da marca;
- endereço e informações de contato;
- links oficiais e redes sociais;
- idioma principal;
- fuso horário;
- mensagem curta de boas-vindas;
- pré-visualização em desktop e celular;
- restauração dos valores visuais padrão do OneElo.

Regras:

- a personalização deve ser sempre limitada ao próprio tenant;
- alterações devem ser salvas como rascunho antes da publicação quando impactarem várias superfícies;
- a interface deve impedir combinações de cores sem contraste suficiente;
- o sistema deve gerar ou selecionar variações acessíveis para texto, hover, foco e fundos suaves;
- a ausência de configuração deve preservar a identidade padrão do OneElo;
- logos devem respeitar requisitos de formato, dimensão, tamanho e transparência;
- a identidade do tenant não pode alterar cores semânticas de erro, alerta, sucesso ou status operacional;
- o co-branding deve usar uma assinatura discreta definida pelo produto, como `Tecnologia OneElo`.

### 2. Aplicação consistente da identidade

Depois de publicada, a identidade deve aparecer de maneira consistente em:

- sidebar e cabeçalho autenticados;
- página pessoal e dashboard administrativo;
- ativação de conta e boas-vindas;
- entrada identificada da igreja;
- onboarding ou orientação inicial quando habilitado;
- página inicial da igreja;
- PWA instalado;
- notificações e central de notificações;
- documentos e impressões que representam a igreja;
- mensagens transacionais que forem evoluídas para templates por tenant.

Regras:

- o nome e a logo da igreja devem ocupar a posição principal de contexto;
- a marca OneElo não deve competir visualmente com a identidade da igreja;
- superfícies administrativas globais da Lookup Labs não devem herdar a identidade do tenant;
- links compartilhados devem manter o contexto correto da igreja;
- o usuário deve conseguir identificar o tenant atual em qualquer tela operacional.

### 3. Entrada identificada por igreja

O usuário deve poder chegar a uma experiência de entrada que já conheça sua igreja.

Possibilidades funcionais previstas:

- URL com slug, como `app.oneelo.com/{igreja}`;
- subdomínio, como `{igreja}.oneelo.app`;
- domínio personalizado, como `app.igrejaexemplo.com.br`, em fase ou plano posterior;
- links de convite e ativação que preservem a identificação do tenant;
- QR Code para divulgação e instalação já vinculada à igreja.

Regras:

- a rota global de login do OneElo deve continuar disponível;
- um acesso identificado deve mostrar logo, nome e cor da igreja antes do login;
- o usuário não deve escolher manualmente um tenant quando o link já contiver esse contexto;
- credenciais válidas não podem conceder acesso a outro tenant por manipulação da URL;
- erros de autenticação não devem revelar existência de usuários ou vínculos;
- ao receber um link da igreja, o usuário deve permanecer nesse contexto durante login, ativação e instalação;
- domínio e subdomínio não podem alterar as regras atuais de sessão, tenant ou RBAC.

### 4. Página pessoal orientada à próxima ação

A página inicial do usuário autenticado deve ser personalizada por perfil, vínculos e contexto atual.

#### Para membros

Prioridade de conteúdo:

1. ação urgente, como confirmar ou recusar escala;
2. próxima escala confirmada;
3. próximo evento relevante;
4. comunicado recente da igreja;
5. comunicado dos ministérios do usuário;
6. atalhos pessoais e atualização de perfil.

Comportamentos esperados:

- apresentar primeiro o que exige ação;
- ocultar blocos vazios quando não agregarem orientação;
- usar mensagens amigáveis quando não houver compromissos;
- permitir acessar detalhes com poucos toques;
- adaptar o conteúdo sem expor informações administrativas.

#### Para líderes

Além da experiência pessoal, apresentar:

- escalas que precisam ser criadas ou publicadas;
- confirmações e recusas que exigem atenção;
- próximos eventos dos ministérios liderados;
- resumo dos ministérios autorizados;
- atalhos contextuais para gestão;
- comunicados ministeriais recentes.

#### Para administradores

Apresentar visão operacional do tenant:

- usuários aguardando ativação;
- próximos eventos;
- pendências de escala;
- notificações com falha ou aguardando processamento;
- indicadores resumidos de adoção;
- atalhos para personalização e publicação de conteúdo.

### 5. Página da igreja e conteúdo administrável

O `ADMIN` deve poder manter uma página inicial simples da igreja usando blocos predefinidos.

Blocos iniciais:

- destaque com imagem, título, texto e ação;
- comunicado;
- próximos eventos;
- horários de cultos ou reuniões;
- links importantes;
- informações de contato;
- redes sociais;
- chamada para uma área interna do OneElo;
- ação externa validada.

Capacidades:

- adicionar, remover e reordenar blocos;
- editar textos e imagens;
- salvar rascunho;
- pré-visualizar em desktop e celular;
- publicar alterações;
- remover conteúdo publicado;
- definir período opcional de exibição para destaques;
- escolher visibilidade para visitante identificado, usuário autenticado ou ambos;
- visualizar data da última publicação e responsável.

Regras:

- não permitir HTML, JavaScript ou CSS arbitrário;
- links externos devem ser validados e visualmente identificados;
- blocos devem seguir responsividade e acessibilidade do ODS;
- conteúdo expirado deve sair automaticamente de destaque;
- a página não substitui as regras de acesso aos módulos internos;
- imagens devem usar a infraestrutura de mídia aprovada pelo produto.

### 6. Navegação configurável com limites

O `ADMIN` deve poder ajustar a navegação do tenant dentro de regras controladas.

Capacidades previstas:

- escolher quais módulos opcionais aparecem;
- ordenar itens configuráveis;
- destacar um acesso principal da igreja;
- adicionar links institucionais validados;
- visualizar a navegação por perfil antes de publicar;
- restaurar a ordem padrão.

Restrições:

- a personalização nunca concede acesso funcional;
- RBAC e liderança ministerial continuam sendo a fonte de verdade;
- módulos obrigatórios e ações de segurança não podem ser removidos;
- um item oculto não deve ser tratado como revogação de permissão;
- usuários continuam vendo apenas itens compatíveis com seu perfil;
- não permitir menus ilimitados ou estruturas profundas que prejudiquem o uso móvel.

### 7. PWA personalizado por tenant

Quando o acesso estiver identificado pela igreja, a instalação do PWA deve refletir esse contexto.

Experiência esperada:

- nome curto da igreja no aplicativo instalado, dentro dos limites do dispositivo;
- ícone da igreja;
- cor principal acessível;
- tela inicial direcionada ao tenant correto;
- orientação de instalação já identificada pela igreja;
- fallback para nome, ícone e cores do OneElo;
- possibilidade de QR Code de instalação para comunicação da igreja.

Regras:

- cada instalação deve manter um identificador de aplicação e escopo coerentes;
- o usuário não pode ser direcionado para outro tenant ao abrir o app instalado;
- troca de identidade deve ter comportamento documentado para instalações existentes;
- a experiência deve respeitar limitações específicas de navegador e sistema operacional;
- as notificações push devem permanecer vinculadas ao usuário, tenant e dispositivo corretos.

### 8. Comunicação contextual

A experiência personalizada deve se integrar à `FT-011 - Central e infraestrutura robusta de notificações`.

Requisitos funcionais:

- notificações gerais usam nome e contexto da igreja;
- notificações ministeriais identificam o ministério quando necessário;
- a abertura leva ao conteúdo ou ação correta dentro do tenant;
- comunicados publicados podem aparecer também na página pessoal;
- preferências futuras podem separar comunicações gerais, ministeriais e operacionais;
- a identidade visual não deve ocultar a origem ou finalidade da mensagem;
- histórico e métricas devem respeitar as regras de privacidade e permissão.

### 9. Indicadores de adoção

O `ADMIN` deve visualizar indicadores agregados que ajudem a avaliar se o sistema está sendo utilizado.

Indicadores iniciais:

- usuários ativados e pendentes;
- usuários ativos em períodos recentes;
- usuários que retornaram após o primeiro acesso;
- instalações ou acessos em modo PWA quando mensuráveis;
- usuários com notificações ativas;
- confirmações de escala realizadas pelo sistema;
- visualizações e interações com comunicados;
- acessos aos módulos principais;
- ações pendentes versus concluídas.

Regras:

- apresentar métricas agregadas por padrão;
- não transformar a funcionalidade em vigilância individual de membros;
- explicar como cada indicador é calculado;
- indicar ausência ou insuficiência de dados;
- respeitar tenant, período e permissões;
- não prometer métricas que o navegador ou PWA não consegue confirmar com precisão.

### 10. Administração, publicação e auditoria

Toda configuração que impacte a experiência do tenant deve possuir:

- identificação do responsável;
- data da alteração;
- estado de rascunho ou publicado quando aplicável;
- pré-visualização antes da publicação;
- confirmação para alterações de grande impacto;
- possibilidade de restaurar a configuração padrão;
- registro de auditoria para mudanças relevantes;
- isolamento completo entre tenants.

Permissão inicial recomendada:

- `ADMIN`: configura e publica identidade, conteúdo e navegação;
- `STAFF`: decisão de produto pendente para edição e publicação;
- líderes ministeriais: não alteram a identidade geral, mas podem gerenciar comunicação do próprio ministério por meio da `FT-011`;
- `BASIC`: consome a experiência personalizada sem configurar o tenant.

## Histórias de usuário

### Identidade

- Como administrador, quero cadastrar a identidade da igreja para que os membros reconheçam o ambiente como parte da comunidade.
- Como administrador, quero pré-visualizar a experiência antes de publicar para evitar uma configuração visual inadequada.
- Como membro, quero ver claramente o nome e a logo da minha igreja para ter certeza de que estou no ambiente correto.

### Acesso e instalação

- Como membro, quero acessar por um link da minha igreja sem precisar escolhê-la novamente.
- Como membro, quero instalar um aplicativo identificado pela minha igreja para encontrá-lo facilmente no celular.
- Como administrador, quero divulgar um link ou QR Code único para simplificar a entrada dos membros.

### Utilidade recorrente

- Como membro, quero visualizar primeiro minha próxima ação para não procurar informações em vários menus.
- Como líder, quero enxergar rapidamente pendências dos meus ministérios para agir no momento certo.
- Como administrador, quero destacar comunicados e próximos eventos para aumentar o alcance das informações.

### Gestão e adoção

- Como administrador, quero publicar conteúdo sem depender da equipe técnica do OneElo.
- Como administrador, quero saber se os usuários estão ativando e utilizando o sistema para orientar ações de adoção.
- Como administrador, quero restaurar o padrão quando uma personalização não ficar adequada.

## Jornada funcional esperada

### Primeira entrega - instalação identificada

1. administrador acessa a configuração do aplicativo da igreja;
2. informa o nome curto e envia o ícone quadrado;
3. visualiza como o aplicativo será identificado;
4. publica a configuração;
5. membro já autenticado recebe a opção `Instalar app {Nome da igreja}`;
6. instala o PWA;
7. encontra nome e ícone da igreja no celular;
8. abre diretamente no tenant e na página adequada ao seu perfil.

### Evolução da experiência

1. administrador completa identidade, contatos e cor;
2. identidade passa a aparecer nas demais superfícies incluídas;
3. membro acessa uma página pessoal com a próxima ação priorizada;
4. igreja passa a divulgar link e QR Code identificados;
5. comunicados e conteúdos são integrados à experiência;
6. administração acompanha indicadores de adoção;
7. capacidades avançadas são liberadas somente após validação de valor.

## Priorização por valor e esforço

A ordem das entregas deve considerar valor percebido pelo usuário, evidências recebidas de clientes, esforço e capacidade de validar o resultado em produção.

Princípios:

- entregar jornadas completas, mesmo que pequenas, em vez de várias fundações técnicas sem benefício visível;
- cada incremento deve poder ser publicado, utilizado e medido de forma independente;
- feedback direto de cliente aumenta a prioridade da necessidade relacionada;
- aproveitar estruturas que já existem antes de criar novas superfícies;
- não bloquear uma entrega de valor por uma evolução futura mais complexa;
- manter fallback para o OneElo em todos os incrementos;
- validar adoção antes de avançar para personalizações de custo operacional alto.

### Matriz inicial

| Entrega funcional | Valor para o cliente | Esforço relativo | Prioridade |
| --- | --- | --- | --- |
| PWA com nome e ícone da igreja, instalado após autenticação | Muito alto | Médio | 1 - primeira entrega |
| Continuidade mínima da identidade ao abrir o PWA | Alto | Baixo | 1 - mesma entrega do PWA |
| Identidade da igreja na ativação, boas-vindas e instalação | Alto | Baixo/médio | 2 - ganho rápido |
| Página pessoal priorizando próximas ações | Alto | Médio | 3 - evolução incremental |
| Cor principal acessível nas superfícies do tenant | Médio/alto | Médio | 4 - identidade ampliada |
| URL com slug e QR Code da igreja | Alto | Médio | 5 - aquisição e acesso |
| Comunicados na página pessoal e notificações contextualizadas | Alto | Médio | 6 - depende da `FT-011` |
| Página da igreja com blocos administráveis | Alto | Alto | 7 - expansão de conteúdo |
| Indicadores básicos de adoção | Médio/alto | Médio | 8 - medir e otimizar |
| Navegação configurável com limites | Médio | Médio/alto | 9 - melhoria incremental |
| Subdomínio por tenant | Médio/alto | Alto | 10 - evolução de acesso |
| Domínio personalizado | Médio | Alto | 11 - futuro ou plano superior |
| Whitelabel integral sem referência ao OneElo | Incerto | Muito alto | avaliar após evidência comercial |
| Aplicativo nativo separado por igreja | Incerto | Muito alto | não priorizar |

Esta matriz deve ser revisada após cada incremento usando feedback de clientes e métricas observáveis. Ela não deve ser tratada como estimativa definitiva de desenvolvimento.

## Entregas incrementais recomendadas

### Entrega 1 - PWA reconhecível como aplicativo da igreja

**Valor entregue**: o membro instala e encontra no celular um aplicativo com o nome e o ícone da própria igreja. Ao abrir, continua reconhecendo o mesmo contexto.

Inclui:

- configuração de nome curto do aplicativo;
- configuração de ícone quadrado específico para o PWA;
- geração das variações necessárias do ícone ou orientação clara de upload;
- manifesto apresentado durante a sessão autenticada com nome, ícone, identificador e destino do tenant;
- título e Apple Touch Icon coerentes no fluxo de instalação do iPhone;
- prompt usando `Instalar app {Nome da igreja}`;
- destino inicial na página pessoal ou dashboard correspondente ao perfil;
- nome e logo da igreja em posição visível ao abrir o PWA;
- fallback completo para a identidade OneElo;
- orientação de reinstalação quando uma instalação antiga não atualizar nome ou ícone.

Não depende de:

- slug;
- subdomínio;
- domínio personalizado;
- editor de conteúdo;
- página pessoal redesenhada.

Validação de valor:

- testar instalação real em Android e iPhone;
- confirmar nome, ícone, abertura e tenant corretos;
- acompanhar instalações ou modo standalone quando mensurável;
- coletar feedback dos primeiros usuários sobre reconhecimento e confiança.

### Entrega 2 - Identidade nos primeiros contatos

**Valor entregue**: convite, ativação, boas-vindas e instalação formam uma jornada coerente com a igreja.

Inclui:

- logo e nome da igreja na ativação;
- mensagem de boas-vindas configurada ou padronizada com nome da igreja;
- identidade no convite de acesso;
- continuidade visual no prompt de instalação;
- co-branding discreto do OneElo;
- fallback para tenants sem configuração completa.

Validação de valor:

- usuário identifica a igreja antes de concluir a ativação;
- não há troca inesperada de marca entre ativação, sistema e instalação;
- administradores conseguem revisar a experiência sem suporte técnico.

### Entrega 3 - Próxima ação na página pessoal existente

**Valor entregue**: o membro acessa o sistema e entende imediatamente o que precisa fazer.

Esta entrega deve evoluir a página já existente, sem reconstruí-la integralmente.

Inclui:

- confirmação ou recusa pendente em primeiro plano;
- próxima escala confirmada;
- próximo evento relevante;
- estados vazios mais úteis;
- atalhos pessoais existentes reorganizados por prioridade;
- visão complementar de liderança apenas quando houver vínculo autorizado.

Validação de valor:

- medir confirmação de escalas iniciada pela página pessoal;
- medir redução de navegação até a próxima ação;
- validar clareza com membros e líderes.

### Entrega 4 - Tema controlado da igreja

**Valor entregue**: a experiência interna reforça a identidade visual sem perder legibilidade ou consistência.

Inclui:

- cor principal configurável;
- variações acessíveis calculadas ou aprovadas pelo sistema;
- aplicação em ações principais e elementos selecionados;
- logo clara e escura quando necessárias;
- pré-visualização em desktop e celular;
- restauração do padrão OneElo;
- preservação das cores semânticas do sistema.

Validação de valor:

- todas as combinações publicáveis atendem aos critérios de contraste;
- páginas permanecem visualmente consistentes;
- administradores conseguem publicar sem assistência técnica.

### Entrega 5 - Link identificado e QR Code da igreja

**Valor entregue**: a igreja divulga um acesso próprio e o usuário chega ao contexto correto com menos etapas.

Inclui:

- URL baseada em slug;
- login e ativação preservando o tenant identificado;
- QR Code para acesso e instalação;
- compartilhamento do link pela administração;
- validações que impedem troca ou acesso indevido de tenant;
- manutenção do login global OneElo.

Validação de valor:

- usuário acessa sem selecionar a igreja manualmente;
- links de ativação e instalação mantêm a identidade correta;
- medir ativações iniciadas pelo link ou QR Code.

### Entrega 6 - Comunicação integrada à experiência

**Valor entregue**: comunicados da igreja e dos ministérios chegam ao usuário e permanecem disponíveis no contexto correto.

Inclui:

- integração com a `FT-011`;
- comunicados recentes na página pessoal;
- nome e contexto da igreja nas notificações;
- comunicados ministeriais apenas para públicos autorizados;
- abertura direcionada ao conteúdo ou ação correspondente;
- histórico compatível com permissões e privacidade.

Validação de valor:

- medir abertura e ação quando tecnicamente possível;
- validar alcance, falhas e ausência de assinatura;
- confirmar isolamento entre tenants e ministérios.

### Entrega 7 - Página administrável da igreja

**Valor entregue**: o tenant publica informações úteis sem depender da equipe técnica do OneElo.

Inclui:

- conjunto inicial reduzido de blocos;
- rascunho, pré-visualização e publicação;
- destaques, eventos, horários, links e contatos;
- exibição por período;
- integração seletiva com a página pessoal;
- responsividade e acessibilidade preservadas.

Validação de valor:

- administrador publica conteúdo sem suporte;
- membros encontram informações relevantes;
- medir visualizações e interações com os blocos.

### Entrega 8 - Indicadores básicos de adoção

**Valor entregue**: a administração entende se os membros estão ativando e usando o sistema.

Inclui inicialmente:

- usuários ativados e pendentes;
- usuários ativos em período recente;
- confirmações de escala realizadas no sistema;
- notificações ativas;
- utilização do PWA quando mensurável;
- visualizações de comunicados;
- descrições claras das métricas.

Validação de valor:

- administrador consegue identificar uma ação prática a partir dos indicadores;
- métricas não expõem comportamento individual desnecessário;
- cálculos são consistentes e explicáveis.

### Entrega 9 - Navegação configurável

**Valor entregue**: a igreja destaca o que utiliza sem alterar permissões nem criar experiências inconsistentes.

Inclui:

- ordenação limitada;
- visibilidade de módulos opcionais;
- links institucionais validados;
- pré-visualização por perfil;
- restauração da navegação padrão.

Esta entrega deve avançar apenas se pesquisas mostrarem que a navegação atual prejudica descoberta ou adoção.

### Entrega 10 - Subdomínio, domínio e evolução comercial

**Valor entregue**: igrejas com maior necessidade de marca passam a utilizar uma entrada própria.

Ordem recomendada:

1. subdomínio do OneElo por tenant;
2. domínio personalizado;
3. regras comerciais por plano;
4. avaliação de whitelabel integral mediante demanda comprovada.

Essas capacidades não devem bloquear as entregas anteriores.

## Fora do escopo inicial

- aplicativo nativo separado e publicado para cada igreja;
- código, HTML, CSS ou JavaScript arbitrário por tenant;
- temas sem limites ou alteração de todas as cores do sistema;
- layouts completamente diferentes entre tenants;
- remoção obrigatória de toda referência ao OneElo;
- construtor completo de sites institucionais;
- hospedagem do site público principal da igreja;
- métricas individuais invasivas;
- criação de permissões por meio da navegação visual;
- múltiplas identidades para o mesmo tenant na primeira entrega.

## Critérios de aceite

### Identidade

- administrador configura e publica nome, logos e cor do tenant;
- identidade publicada aparece de forma consistente nas superfícies incluídas na fase;
- tenant sem personalização recebe fallback completo do OneElo;
- cor inválida ou sem contraste não pode ser publicada;
- estados semânticos continuam distinguíveis e acessíveis;
- usuário identifica claramente a igreja atual.

### Acesso

- link identificado abre login ou ativação com a identidade correta;
- contexto do tenant é preservado até a entrada no sistema;
- manipular slug ou domínio não concede acesso a outro tenant;
- login global permanece funcional;
- links compartilhados não misturam identidades de tenants.

### Página pessoal

- membro com ação pendente a visualiza em posição prioritária;
- membro sem pendências recebe conteúdo útil e um estado vazio amigável;
- líder visualiza apenas pendências dos ministérios autorizados;
- administrador visualiza indicadores e ações do próprio tenant;
- conteúdo administrativo não é exposto a perfis sem permissão.

### Conteúdo e navegação

- administrador cria, pré-visualiza e publica blocos sem alterar código;
- conteúdo expirado deixa de aparecer no período definido;
- navegação personalizada continua respeitando RBAC;
- esconder um módulo não concede nem revoga permissão;
- links externos inválidos são rejeitados;
- experiência permanece adequada em desktop e celular.

### PWA

- instalação identificada usa tenant, nome, ícone, cor e destino corretos;
- abertura pelo ícone retorna ao tenant correspondente;
- fallback funciona quando algum ativo personalizado estiver ausente;
- subscription push permanece vinculada ao usuário e tenant corretos;
- limitações de atualização de instalações existentes são comunicadas;
- instalação antiga que exija reinstalação recebe orientação clara;
- nome e ícone são validados em Android e iPhone;
- o ícone quadrado respeita a área segura de recorte dos dispositivos;
- o primeiro incremento funciona sem slug, subdomínio ou domínio personalizado.

### Adoção e auditoria

- indicadores possuem descrição e período de cálculo;
- administrador visualiza apenas métricas do próprio tenant;
- alterações relevantes registram responsável e data;
- restauração do padrão não remove dados operacionais da igreja;
- publicação de identidade, conteúdo e navegação exige permissão no backend.

## Métricas de sucesso da feature

Comparar períodos antes e depois da adoção por tenant:

- aumento de usuários ativos semanais;
- aumento da taxa de retorno após ativação;
- aumento de confirmações de escala no OneElo;
- aumento de usuários com PWA instalado ou em modo standalone;
- aumento de notificações ativadas;
- aumento de visualizações de comunicados;
- redução do tempo entre publicação e confirmação de escala;
- percentual de tenants que concluíram a configuração da identidade;
- percentual de usuários que chegam à próxima ação sem navegar por outros módulos.

## Decisões pendentes para o plano de desenvolvimento

- definir o nome comercial da funcionalidade;
- confirmar o modelo de co-branding e os planos que permitem removê-lo;
- confirmar se `STAFF` pode editar ou publicar configurações;
- escolher slug, subdomínio ou ambos como primeira entrada identificada;
- definir quando domínio personalizado será oferecido;
- definir limites de nome curto, logos, ícone, capa e cor;
- definir blocos exatos da primeira versão da página da igreja;
- definir quais itens de navegação podem ser ocultados ou reordenados;
- definir política de rascunho, publicação e restauração;
- definir quais métricas são tecnicamente mensuráveis e aceitáveis em privacidade;
- definir comportamento de uma instalação PWA quando a identidade mudar;
- confirmar se o fuso será configurável por tenant nesta entrega;
- definir como usuários vinculados a mais de um tenant seriam tratados futuramente.

## Dependências funcionais

- identidade e logo já existentes no tenant;
- página pessoal e dashboards atuais;
- regras de RBAC e liderança ministerial;
- infraestrutura PWA e PushSubscription;
- armazenamento de mídia;
- `FT-011 - Central e infraestrutura robusta de notificações` para comunicação e histórico;
- suporte operacional a subdomínios e domínios quando essas fases forem iniciadas.

## Áreas previstas de impacto

- configurações do tenant;
- autenticação, ativação e onboarding;
- app shell, sidebar, header e páginas iniciais;
- página pessoal e dashboard;
- PWA, manifesto, ícones e instalação;
- notificações e comunicação;
- navegação e permissões;
- armazenamento de mídia;
- páginas e componentes públicos identificados;
- métricas, auditoria e documentação operacional.

## Plano de desenvolvimento

- Entrega 1: `ai-context/plans/tenant-pwa-identity-plan.md`.
- As demais entregas devem receber planos próprios somente quando forem priorizadas, preservando o modelo incremental deste backlog.
