# Copilot Instructions — Módulo 1: Cadastros Gerais do Sistema de Prontuário

## 1. Contexto geral do projeto

Este projeto é um novo sistema de prontuário e gestão clínica desenvolvido do zero, inspirado em funcionalidades existentes em um sistema legado, mas sem obrigação de copiar fielmente sua interface, navegação ou organização visual.

O objetivo é construir uma versão moderna, mais clara, segura e fácil de usar, mantendo as regras essenciais que a clínica utiliza.

O Módulo 1 — Cadastros Gerais será a base administrativa do sistema e deve contemplar:

- Usuários;
- Grupos de acesso;
- Permissões do sistema;
- Permissões operacionais;
- Cadastros auxiliares;
- Profissionais;
- Especialidades;
- Endereços;
- Dados financeiros cadastrais;
- Agenda parametrizada do profissional;
- Credenciamento;
- Contratos;
- Taxas administrativas;
- Documentos e anexos;
- Auditoria básica de alterações críticas.

Stack esperada:

- Frontend: React com TypeScript.
- Backend: Node.js com TypeScript.
- Banco de dados relacional, preferencialmente PostgreSQL.
- Autenticação própria do sistema.
- Deploy moderno, possivelmente Railway para backend/banco e Cloudflare Pages para frontend.

Sempre que gerar código, priorizar:

- TypeScript;
- Clareza de domínio;
- Segurança;
- Separação de responsabilidades;
- Validações no backend;
- Interface moderna;
- Manutenibilidade;
- Estrutura preparada para módulos futuros, como agenda, prontuário, prescrição, estoque e financeiro.

---

## 2. Decisões de escopo já definidas

### 2.1 Sem migração de dados

Assumir que não haverá migração de dados do sistema antigo.

O sistema novo começará com base vazia ou minimamente pré-configurada, e o administrador será responsável por cadastrar manualmente:

- Usuários;
- Profissionais;
- Centros de custo;
- Bancos;
- Convênios;
- Planos;
- Especialidades;
- Locais de atendimento;
- Setores;
- Pontos de estoque;
- Tipos de movimentação;
- Tipos de serviço;
- Grupos de acesso;
- Permissões operacionais.

Não implementar importação, sincronização ou integração com banco legado nesta fase, salvo solicitação futura.

---

### 2.2 O Módulo 1 é principalmente cadastral

O Módulo 1 deve cadastrar e parametrizar informações, mas não deve implementar motores complexos de negócio de outros módulos.

Ou seja:

- Dados financeiros do profissional serão apenas cadastro.
- Taxas administrativas serão apenas cadastro.
- Contratos serão apenas cadastro e validação de vigência.
- Credenciamentos serão cadastro e validação de vigência.
- Regras de agenda serão parametrizadas no cadastro do profissional, com validações/bloqueios quando usadas.
- Não implementar cálculo completo de repasse financeiro neste módulo.
- Não implementar faturamento SUS completo neste módulo.
- Não implementar prescrição completa neste módulo.
- Não implementar agenda completa neste módulo, a menos que seja solicitado em etapa posterior.
- Não implementar relatórios avançados neste módulo.

O sistema deve, no entanto, deixar os dados bem modelados para que módulos futuros consumam essas regras.

---

### 2.3 Permissões configuráveis pelo administrador

O sistema deve permitir que o próprio administrador crie grupos de acesso e configure o que cada grupo pode ou não fazer.

O controle de acesso deve ser flexível e administrável pela interface.

Um usuário pode ter múltiplos grupos de acesso.

As permissões efetivas do usuário devem considerar a união das permissões dos grupos ativos vinculados ao usuário.

Exemplo:

- Grupo Recepção permite acessar agenda.
- Grupo Financeiro permite acessar bancos e telas financeiras.
- Se o usuário estiver nos dois grupos, terá as permissões dos dois.

O sistema também deve permitir configurar permissões operacionais por usuário, como:

- Locais de atendimento;
- Bancos;
- Centros de custo;
- Pontos de estoque;
- Setores de exame;
- Tipos de serviço;
- Grupos de salas;
- Tipos de movimentação de estoque.

Sempre validar permissões no backend. O frontend pode esconder botões e telas, mas não pode ser a única camada de proteção.

---

### 2.4 Login e recuperação de senha

O login será apenas interno, com usuário e senha do próprio sistema.

Não haverá:

- Login por certificado digital;
- Login social;
- Integração externa de identidade;
- Credencial online externa.

A recuperação de senha será interna:

- O usuário solicita recuperação de senha;
- O administrador recebe/visualiza a solicitação;
- O administrador redefine a senha ou gera uma senha temporária;
- O usuário pode ser obrigado a trocar a senha no próximo login, se implementado.

---

### 2.5 Bloqueios automáticos e alertas

Sempre que houver regras com vigência ou associação cadastral, o sistema deve facilitar a vida do usuário com bloqueios automáticos e alertas claros.

Exemplos:

- Profissional com credenciamento vencido:
  - Bloquear seleção para novo atendimento/agendamento relacionado ao convênio/plano vencido;
  - Exibir alerta explicando o motivo.
- Contrato vencido:
  - Bloquear ou impedir uso em novas operações relacionadas;
  - Exibir alerta com data de vencimento.
- Profissional desativado/desligado:
  - Não permitir uso em novos atendimentos/agendas;
  - Manter histórico antigo intacto.
- Agenda do profissional sem regra compatível:
  - Bloquear agendamento quando a regra for obrigatória;
  - Exibir mensagem clara indicando qual regra falta configurar.
- Convênio/plano/especialidade sem vínculo permitido:
  - Bloquear operação quando aplicável;
  - Sugerir ao usuário revisar cadastro do profissional.

Priorizar mensagens úteis, por exemplo:

> Este profissional não possui credenciamento ativo para o convênio selecionado na data informada.

> Este profissional não possui regra de agenda para o local, convênio e tipo de atendimento selecionados.

> O contrato deste profissional está vencido. Atualize o contrato antes de prosseguir.

---

### 2.6 Anexos/documentos

Assumir que provavelmente haverá anexos no cadastro, principalmente para profissionais.

Preparar o sistema para permitir anexos como:

- RG;
- CPF;
- Comprovante de endereço;
- Diploma;
- Certificado;
- Conselho profissional;
- Contrato;
- Documentos de credenciamento;
- Outros documentos administrativos.

A implementação deve considerar:

- Upload de arquivos;
- Listagem de anexos;
- Download/visualização;
- Exclusão lógica ou remoção controlada;
- Controle de permissão para visualizar/baixar/remover;
- Registro de auditoria para upload e remoção;
- Limite de tamanho configurável;
- Tipos permitidos, como PDF, PNG, JPG/JPEG.

O armazenamento pode ser local em desenvolvimento e externo em produção, conforme arquitetura escolhida posteriormente.

---

### 2.7 Auditoria básica

Implementar auditoria básica para alterações críticas.

Não precisa ser uma auditoria extremamente complexa inicialmente, mas deve registrar pelo menos:

- Quem criou;
- Quem alterou;
- Quando alterou;
- Qual entidade foi alterada;
- Tipo de operação;
- Quando possível, campo alterado, valor antigo e valor novo.

Entidades críticas para auditoria:

- Usuários;
- Senhas/redefinições;
- Grupos de acesso;
- Permissões;
- Vínculos usuário x grupos;
- Permissões operacionais;
- Profissionais;
- Documentos pessoais;
- Dados financeiros;
- Credenciamentos;
- Contratos;
- Taxas administrativas;
- Anexos.

---

### 2.8 Relatórios

Assumir que relatórios avançados não fazem parte do Módulo 1 neste momento.

Podem existir apenas listagens administrativas com filtros e paginação.

Não implementar exportação Excel/PDF ou relatórios formais sem solicitação futura.

---

### 2.9 Usabilidade

Não seguir o sistema antigo ao pé da letra.

O sistema legado serve como referência funcional, não como referência obrigatória de UX/UI.

Sempre que possível:

- Agrupar campos de forma mais clara;
- Reduzir poluição visual;
- Usar abas com boa organização;
- Usar selects pesquisáveis;
- Usar tabelas com filtros;
- Usar mensagens de erro úteis;
- Evitar formulários gigantes sem divisão;
- Evitar obrigar o usuário a decorar códigos;
- Usar nomes claros para permissões e regras;
- Mostrar alertas preventivos antes de bloqueios definitivos;
- Preferir desativação lógica em vez de exclusão física.

---

## 3. Diretrizes técnicas gerais

### 3.1 Backend

Ao gerar código backend:

- Usar TypeScript.
- Separar módulos por domínio.
- Criar schemas/DTOs para validação.
- Validar permissões sempre no backend.
- Usar paginação em listagens.
- Criar filtros para telas administrativas.
- Usar soft delete/desativação lógica para dados administrativos.
- Criar auditoria em operações críticas.
- Não expor dados sensíveis sem necessidade.
- Não retornar hash de senha em nenhuma resposta.
- Tratar erros com mensagens claras.
- Evitar regras de negócio apenas no frontend.

Sugestão de estrutura:

```txt
src/
  modules/
    auth/
    users/
    access-groups/
    permissions/
    operational-access/
    professionals/
    auxiliary-registrations/
    attachments/
    audit/
  shared/
    database/
    errors/
    middlewares/
    utils/
```

---

### 3.2 Frontend

Ao gerar código frontend:

- Usar React com TypeScript.
- Criar componentes reutilizáveis.
- Usar formulários organizados por seções/abas.
- Implementar estados de loading, erro e vazio.
- Implementar feedback de sucesso/erro.
- Usar confirmações para ações destrutivas.
- Criar componentes de autorização visual, como `Can` ou `usePermission`.
- Criar selects pesquisáveis para cadastros auxiliares.
- Usar tabelas com paginação e filtros.
- Priorizar telas limpas, modernas e responsivas para desktop.

---

### 3.3 Banco de dados

Ao modelar entidades:

- Usar IDs consistentes.
- Preferir UUID ou IDs numéricos, conforme padrão do projeto.
- Incluir campos de auditoria:
  - created_at;
  - updated_at;
  - created_by;
  - updated_by;
  - deactivated_at;
  - deactivated_by.
- Criar tabelas de relacionamento para associações muitos-para-muitos.
- Usar status ativo/inativo quando a entidade puder ser desativada.
- Evitar exclusão física em entidades com vínculo histórico.

---

## 4. Modelo de autorização recomendado

Utilizar uma abordagem parecida com RBAC, com suporte a permissões operacionais.

### 4.1 RBAC — permissões por grupo

Entidades principais:

- User;
- AccessGroup;
- Permission;
- UserAccessGroup;
- AccessGroupPermission.

Um usuário pode ter vários grupos.

Um grupo pode ter várias permissões.

Uma permissão representa uma ação ou acesso, como:

- `users.read`;
- `users.create`;
- `users.update`;
- `professionals.read`;
- `professionals.manage_financial_data`;
- `access_groups.manage_permissions`.

A permissão deve ser administrável pela interface.

---

### 4.2 Permissões operacionais

Além das permissões de tela/ação, o usuário pode ter restrições por recurso.

Exemplos:

- Quais locais de atendimento pode acessar;
- Quais bancos pode movimentar;
- Quais centros de custo pode usar;
- Quais setores de exame pode acessar;
- Quais pontos de estoque pode movimentar;
- Quais tipos de movimentação de estoque pode realizar;
- Quais tipos de serviço pode usar em prescrição;
- Quais grupos de salas pode movimentar ou reservar.

Essas permissões operacionais devem ser tratadas como associações configuráveis.

Exemplo conceitual:

```ts
requirePermission('professionals.update')
requireOperationalAccess('attendance_location', attendanceLocationId)
```

---

### 4.3 Regra padrão para ausência de permissão operacional

Quando uma operação exigir permissão operacional específica e o usuário não tiver vínculo com aquele recurso, a ação deve ser bloqueada.

Exemplo:

- Se o usuário não tem acesso ao banco X, não pode movimentar banco X.
- Se o usuário não tem acesso ao centro de custo Y, não pode usar centro de custo Y.
- Se o usuário não tem acesso ao local Z, não pode operar no local Z.

Para administradores/super usuários, pode existir uma permissão especial:

- `operational_access.all`;
- `admin.full_access`;
- ou equivalente.

Essa permissão deve liberar acesso amplo sem precisar cadastrar todos os vínculos manualmente.

---

## 5. Backlog do Módulo 1

---

# Épico 1 — Autenticação

## Objetivo

Permitir acesso seguro ao sistema por login e senha internos.

## Funcionalidades

- Login;
- Logout;
- Sessão/token;
- Bloqueio de usuário inativo;
- Solicitação interna de recuperação de senha;
- Redefinição de senha pelo administrador;
- Registro de auditoria em redefinições.

## Critérios gerais

- Senha deve ser armazenada com hash seguro.
- Backend nunca deve retornar senha ou hash.
- Usuário inativo não pode logar.
- Admin pode redefinir senha conforme permissão.
- Pode haver flag para obrigar troca de senha no próximo login.

---

# Épico 2 — Usuários

## Objetivo

Gerenciar usuários do sistema.

## Funcionalidades

- Listar usuários;
- Pesquisar por login, nome, departamento e status;
- Criar usuário;
- Editar usuário;
- Desativar usuário;
- Reativar usuário;
- Redefinir senha;
- Vincular usuário a profissional, quando aplicável;
- Vincular usuário a múltiplos grupos;
- Configurar permissões operacionais;
- Cadastrar documentação do usuário.

## Campos principais

- Código;
- Login;
- Nome completo;
- Nome resumido;
- E-mail;
- Sexo;
- Turno;
- Departamento;
- Cargo/ocupação;
- Profissional vinculado;
- Local de atendimento exclusivo;
- Status;
- Data de desativação.

---

# Épico 3 — Documentação do usuário

## Objetivo

Cadastrar dados documentais e pessoais do usuário quando necessário.

## Campos

- CNS;
- CPF;
- RG;
- Órgão emissor;
- Data de nascimento;
- Inscrição na prefeitura;
- Ordem/inscrição;
- INSS;
- PIS/PASEP;
- CTPS;
- Frequenta escola atualmente;
- Endereço;
- Telefones;
- Plano de saúde;
- Convênio;
- Plano;
- Número da carteirinha;
- Validade;
- Condição;
- Segurado.

## Regras

- CPF deve ser validado quando informado.
- Dados sensíveis devem exigir permissão de visualização/edição.
- Alterações devem ser auditadas.

---

# Épico 4 — Grupos de acesso

## Objetivo

Permitir que o administrador crie grupos e defina permissões.

## Funcionalidades

- Listar grupos;
- Criar grupo;
- Editar grupo;
- Desativar grupo;
- Configurar permissões do grupo;
- Vincular usuários ao grupo;
- Definir se é grupo de faturamento;
- Definir regra de impressão automática.

## Campos

- Código;
- Nome/descrição;
- Status;
- Grupo de faturamento;
- Regra de impressão automática:
  - Sim;
  - Não;
  - Sempre;
  - Nunca.

---

# Épico 5 — Permissões do sistema

## Objetivo

Permitir configuração flexível do que cada grupo pode fazer.

## Funcionalidades

- Criar seed inicial de permissões;
- Exibir permissões em árvore ou agrupadas por módulo;
- Permitir adicionar/remover permissões de um grupo;
- Permitir que admin controle permissões pela interface;
- Calcular permissões efetivas do usuário;
- Proteger rotas e endpoints.

## Permissões iniciais sugeridas

```txt
users.read
users.create
users.update
users.deactivate
users.reactivate
users.reset_password
users.manage_groups
users.manage_operational_permissions
users.view_documents
users.update_documents

access_groups.read
access_groups.create
access_groups.update
access_groups.deactivate
access_groups.manage_permissions

permissions.read
permissions.manage

professionals.read
professionals.create
professionals.update
professionals.deactivate
professionals.reactivate
professionals.view_documents
professionals.update_documents
professionals.manage_specialties
professionals.manage_financial_data
professionals.manage_schedule_rules
professionals.manage_accreditations
professionals.manage_contracts
professionals.manage_administrative_fees
professionals.manage_attachments
professionals.view_audit_log

auxiliary.read
auxiliary.create
auxiliary.update
auxiliary.deactivate

attachments.upload
attachments.read
attachments.delete

audit_logs.read

admin.full_access
operational_access.all
```

---

# Épico 6 — Permissões operacionais do usuário

## Objetivo

Configurar permissões de recursos específicos por usuário.

## Funcionalidades

### Local de atendimento

- Associar locais de atendimento ao usuário;
- Remover locais;
- Bloquear operações fora dos locais permitidos.

### Agenda e grupo de salas

- Associar grupos de salas;
- Definir direito de reservar salas;
- Controlar movimentação/reserva.

### Financeiro/bancos

- Associar bancos ao usuário;
- Bloquear movimentações em bancos não permitidos.

### Estoque

- Associar pontos de estocagem;
- Associar tipos de movimentação;
- Definir se pode incluir produto em ponto de estocagem.

### Setor de exame

- Associar setores de exame;
- Restringir acesso por setor.

### Controle de equipamento

- Associar centros de custo para controle de patrimônio;
- Associar centros de custo faturáveis de serviço.

### Centro de custo

- Associar centros de custo para sistema de custos;
- Associar centros de custo para solicitação de produtos/manutenção.

### Prescrição

- Associar tipos de serviço de prescrição;
- Bloquear uso de tipo de serviço não permitido futuramente.

---

# Épico 7 — Cadastros auxiliares administrativos

## Objetivo

Permitir que o administrador cadastre manualmente todas as tabelas auxiliares necessárias.

## Cadastros

- Departamentos;
- Cargos/ocupações;
- Locais de atendimento;
- Grupos de salas;
- Bancos;
- Pontos de estocagem;
- Tipos de movimentação de estoque;
- Setores de exame;
- Centros de custo;
- Tipos de serviço;
- Convênios;
- Planos de convênio;
- Especialidades;
- Conselhos profissionais;
- Grupos de pagamento;
- Grupos de repasse;
- Tipos de logradouro;
- Estados/UF;
- Cidades;
- Escolaridades;
- Nacionalidades;
- Estados civis;
- Cor/raça;
- Situações familiares/conjugais.

## Requisitos gerais

Para cada cadastro auxiliar:

- Criar;
- Editar;
- Desativar;
- Listar;
- Pesquisar por nome/código;
- Impedir exclusão física se houver vínculo;
- Registrar auditoria básica.

---

# Épico 8 — Profissionais

## Objetivo

Gerenciar cadastro completo dos profissionais da clínica.

## Funcionalidades

- Listar profissionais;
- Pesquisar por código, nome, CPF/CNPJ, CNS, CNES, especialidade, grupo de pagamento e grupo de repasse;
- Criar profissional;
- Editar profissional;
- Desativar profissional;
- Reativar profissional;
- Gerenciar dados pessoais;
- Gerenciar documentação;
- Gerenciar endereços;
- Gerenciar especialidades;
- Gerenciar informações profissionais;
- Gerenciar dados financeiros cadastrais;
- Gerenciar agenda parametrizada;
- Gerenciar credenciamentos;
- Gerenciar especialidades contratadas;
- Gerenciar taxas administrativas;
- Gerenciar contratos;
- Gerenciar anexos;
- Visualizar auditoria básica.

---

# Épico 9 — Cadastro base do profissional

## Campos

### Identificação

- Código;
- Código do profissional;
- Conselho profissional;
- Estado do conselho;
- Nome;
- Nome reduzido;
- Nome social;
- Celular;
- E-mail;
- Data de contratação;
- Data de desligamento.

### Dados pessoais

- Data de nascimento;
- Estado de nascimento;
- Município de nascimento;
- Sexo;
- Nome da mãe;
- Nome do pai;
- Nacionalidade;
- Estado civil;
- Cor/raça;
- Situação familiar/conjugal.

### Documentação

- Tipo de pessoa:
  - Física;
  - Jurídica;
- CPF/CNPJ;
- RG;
- Órgão emissor;
- Data de emissão do RG;
- CNS;
- Inscrição na prefeitura;
- Cidade onde tem inscrição;
- Número do INSS;
- Cadastrado somente neste estabelecimento.

### Configurações clínicas

- Pertence ao corpo clínico;
- Autorizado a solicitar/encaminhar atendimento;
- Autorizado a prescrever psicotrópicos;
- Cadastro completo;
- Atende SUS;
- Circulante.

## Regras

- Profissional desativado ou desligado não deve ser usado em novos fluxos.
- Alterações em dados pessoais e clínicos devem ser auditadas.
- CPF/CNPJ devem ser validados quando informados.

---

# Épico 10 — Endereços do profissional

## Tipos

- Residencial;
- Consultório 1;
- Consultório 2.

## Campos

- Tipo de logradouro;
- Endereço;
- Número;
- Complemento;
- Bairro;
- Estado;
- Cidade;
- CEP;
- Telefone;
- Fax;
- E-mail.

## Regras

- Permitir definir endereço para correspondência.
- Permitir diferentes dados por endereço.
- Validar CEP quando possível.
- Dados devem ser editáveis pelo admin autorizado.

---

# Épico 11 — Especialidades do profissional

## Funcionalidades

- Definir especialidade principal;
- Associar múltiplas especialidades;
- Definir especialidades autorizadas;
- Definir vínculo;
- Definir interconsulta;
- Definir compatibilidade CBO x especialidade, se adotado;
- Cadastrar competências para faturamento SUS.

## Competência SUS

Campos:

- Início;
- Fim;
- Especialidade;
- Carga horária ambulatorial;
- Carga horária hospitalar;
- Carga horária outros;
- Código do vínculo;
- Tipo;
- Subtipo.

## Regras

- Especialidade principal deve ser válida.
- Evitar períodos conflitantes quando aplicável.
- Essa informação é cadastral neste módulo, mas deve estar pronta para uso futuro em faturamento, agenda e atendimento.

---

# Épico 12 — Informações profissionais

## Campos

- Escolaridade;
- Área de atuação;
- Faculdade;
- Ano de formatura;
- Residência médica:
  - Local;
  - Especialidade;
  - Ano;
- Título de especialista:
  - Sociedade 1;
  - Ano;
  - Sociedade 2;
  - Ano;
- Mestrado:
  - Local;
  - Conclusão;
- Doutorado:
  - Local;
  - Conclusão;
- Participa atualmente de algum curso.

## Regras

- Campos podem ser opcionais.
- Alterações devem ser auditadas de forma básica.

---

# Épico 13 — Dados financeiros cadastrais do profissional

## Objetivo

Cadastrar dados financeiros, sem implementar cálculo financeiro completo.

## Campos

- Grupo de pagamento;
- Funcionário;
- Recebe pelo serviço prestado;
- Recebe repasse de pagamento;
- Grupo de repasse;
- Tipo de pagamento;
- Repasse SUS ambulatorial:
  - percentual ou valor;
- Repasse APAC:
  - percentual ou valor;
- Repasse SUS internado:
  - percentual ou valor;
- Número de dependentes para IRRF;
- Contas bancárias:
  - banco;
  - número do banco;
  - agência;
  - conta;
  - indicador de depósito;
- Referente à prestação de serviços;
- Emite recibo;
- Isento;
- IRRF;
- ISS;
- Código da Receita para IRRF;
- Permite envio do extrato do repasse por e-mail.

## Regras

- Apenas cadastro nesta fase.
- Não calcular repasse.
- Não gerar pagamento.
- Não emitir recibo fiscal.
- Não enviar extrato automaticamente.
- Dados financeiros devem exigir permissão específica.
- Alterações devem ser auditadas.

---

# Épico 14 — Agenda parametrizada do profissional

## Objetivo

Cadastrar regras de disponibilidade/validação do profissional para agendamentos futuros.

## Campos

- Local de atendimento;
- Convênio;
- Plano do convênio;
- Tipo de regra:
  - Geral;
  - Consulta;
  - Retorno;
  - Encaixe.

## Regras

- O cadastro deve permitir adicionar e remover regras.
- O módulo de agenda futuro deve bloquear automaticamente agendamentos incompatíveis.
- O sistema deve emitir alertas claros quando faltar regra.
- Se não houver regra cadastrada para o profissional, assumir bloqueio por segurança, exceto se houver configuração global permitindo agenda sem regra.
- Pode existir uma regra geral para simplificar uso.
- Sugestão de melhoria: permitir regra "Todos os convênios", "Todos os planos" e "Todos os tipos", para evitar cadastro repetitivo.

---

# Épico 15 — Especialidade contratada

## Objetivo

Relacionar profissional, convênio e especialidade contratada.

## Funcionalidades

- Listar convênios;
- Listar especialidades;
- Associar convênio + especialidade ao profissional;
- Remover associação;
- Exibir associações cadastradas.

## Regras

- O profissional pode ter uma especialidade geral, mas não necessariamente estar contratado para essa especialidade em todos os convênios.
- Futuramente, agenda e atendimento devem poder bloquear uso de especialidade não contratada.
- Emitir alerta quando o usuário tentar usar uma combinação não cadastrada.

---

# Épico 16 — Credenciamento

## Objetivo

Cadastrar credenciamento do profissional por convênio e plano.

## Campos

- Convênio;
- Plano;
- Código no convênio;
- Data inicial;
- Data final;
- Credenciado sempre;
- Exclusão/inativação.

## Regras

- Credenciamento vencido deve bloquear novas operações relacionadas.
- O sistema deve emitir alerta explicando o bloqueio.
- `Credenciado sempre` pode ignorar data final, conforme regra definida.
- Deve validar vigência.
- Deve evitar duplicidade conflitante para o mesmo profissional, convênio e plano.

---

# Épico 17 — Taxa administrativa

## Objetivo

Cadastrar taxas administrativas do profissional sem calcular repasse financeiro neste módulo.

## Campos

- Convênio;
- Plano;
- Local de atendimento;
- Tipo de serviço;
- Taxa;
- Data inicial;
- Data final;
- Exclusão/inativação.

## Regras

- Apenas cadastro nesta fase.
- Validar vigência.
- Validar valor/percentual.
- Emitir alerta para taxa vencida quando for usada futuramente.
- Não implementar cálculo de desconto/repasse neste módulo.

---

# Épico 18 — Contratos

## Objetivo

Cadastrar contratos do profissional.

## Campos

- Contrato;
- Data inicial;
- Data final;
- Convênio;
- Plano;
- Local de atendimento;
- Tipo;
- Tipo de serviço;
- Exclusão/inativação.

## Regras

- Contrato vencido deve bloquear novas operações relacionadas.
- O sistema deve emitir alerta explicando o motivo.
- Deve permitir anexar arquivo de contrato.
- Deve validar vigência.
- Deve evitar conflitos de contratos ativos quando aplicável.

---

# Épico 19 — Anexos

## Objetivo

Permitir anexar documentos administrativos a profissionais e, se necessário, a usuários.

## Funcionalidades

- Upload de arquivo;
- Listagem de anexos;
- Visualização/download;
- Remoção controlada;
- Desativação lógica, se aplicável;
- Controle de permissão;
- Auditoria.

## Metadados do anexo

- Nome original;
- Nome armazenado;
- Tipo MIME;
- Tamanho;
- Categoria;
- Entidade vinculada;
- ID da entidade;
- Usuário que enviou;
- Data de envio;
- Status.

## Categorias sugeridas

- Documento pessoal;
- Contrato;
- Certificado;
- Conselho profissional;
- Comprovante;
- Outros.

---

# Épico 20 — Auditoria básica

## Objetivo

Registrar alterações críticas do sistema.

## Funcionalidades

- Registrar criação;
- Registrar edição;
- Registrar desativação;
- Registrar reativação;
- Registrar alteração de permissão;
- Registrar alteração de grupo;
- Registrar alteração de dados financeiros;
- Registrar upload/remoção de anexos;
- Registrar redefinição de senha.

## Campos sugeridos

- ID;
- Entidade;
- ID da entidade;
- Tipo de operação;
- Campo alterado;
- Valor antigo;
- Valor novo;
- Usuário responsável;
- Data/hora;
- IP/origem, se disponível.

---

## 6. Sugestão de entidades

### 6.1 Autenticação e usuários

- User;
- UserDocument;
- UserHealthPlan;
- PasswordResetRequest;
- UserSession ou RefreshToken, se aplicável.

### 6.2 Acesso e permissões

- AccessGroup;
- Permission;
- UserAccessGroup;
- AccessGroupPermission;
- AuditLog.

### 6.3 Permissões operacionais

- UserAttendanceLocation;
- UserRoomGroupPermission;
- UserBankPermission;
- UserStockLocationPermission;
- UserStockMovementTypePermission;
- UserExamSectorPermission;
- UserEquipmentCostCenterPermission;
- UserBillableServiceCostCenterPermission;
- UserCostCenterPermission;
- UserMaintenanceCostCenterPermission;
- UserPrescriptionServiceTypePermission.

### 6.4 Profissionais

- Professional;
- ProfessionalAddress;
- ProfessionalSpecialty;
- ProfessionalSusCompetence;
- ProfessionalEducationInfo;
- ProfessionalFinancialData;
- ProfessionalBankAccount;
- ProfessionalScheduleRule;
- ProfessionalContractedSpecialty;
- ProfessionalAccreditation;
- ProfessionalAdministrativeFee;
- ProfessionalContract;
- ProfessionalAdditionalDocument.

### 6.5 Anexos

- Attachment;
- AttachmentCategory;
- AttachmentAuditLog, se não usar AuditLog genérico.

### 6.6 Cadastros auxiliares

- Department;
- Occupation;
- AttendanceLocation;
- RoomGroup;
- Bank;
- StockLocation;
- StockMovementType;
- ExamSector;
- CostCenter;
- ServiceType;
- InsuranceProvider;
- InsurancePlan;
- Specialty;
- ProfessionalCouncil;
- PaymentGroup;
- TransferGroup;
- AddressType;
- City;
- State;
- EducationLevel;
- Nationality;
- MaritalStatus;
- RaceColor;
- FamilyStatus.

---

## 7. Ordem sugerida de desenvolvimento

1. Estrutura base do projeto.
2. Autenticação.
3. Usuários.
4. Grupos de acesso.
5. Permissões configuráveis.
6. Associação usuário x múltiplos grupos.
7. Cadastros auxiliares básicos.
8. Permissões operacionais do usuário.
9. Cadastro base de profissionais.
10. Endereços de profissionais.
11. Especialidades de profissionais.
12. Dados profissionais/formação.
13. Dados financeiros cadastrais.
14. Agenda parametrizada do profissional.
15. Especialidade contratada.
16. Credenciamento.
17. Taxas administrativas.
18. Contratos.
19. Anexos.
20. Auditoria básica.
21. Refinamento visual e validações finais.

---

## 8. Fora de escopo inicial

Não implementar sem confirmação explícita:

- Migração de dados do sistema legado.
- Login por certificado digital.
- Login social ou credencial externa.
- Integração CNES.
- Integração com convênios externos.
- Faturamento SUS completo.
- Prescrição completa.
- Agenda completa.
- Estoque completo.
- Financeiro completo.
- Cálculo real de repasse.
- Emissão fiscal/recibos fiscais.
- Envio automático real de extrato por e-mail.
- Relatórios avançados.
- Exportação Excel/PDF.
- BI/dashboard.
- Integração com sistemas externos.

---

## 9. Checklist de qualidade

Antes de considerar uma funcionalidade pronta:

- Tem validação no backend.
- Tem controle de permissão no backend.
- Tem tratamento de erro.
- Tem paginação em listagens.
- Tem filtros quando necessário.
- Tem feedback visual no frontend.
- Tem loading/empty/error state.
- Tem confirmação para desativação/remoção.
- Tem auditoria quando for alteração crítica.
- Não expõe dados sensíveis sem necessidade.
- Não usa exclusão física quando existe vínculo histórico.
- Está tipado com TypeScript.
- Não tem regra de negócio importante apenas no frontend.
- Mensagens de bloqueio são claras para o usuário.
- Componentes e serviços foram criados de forma reutilizável.

---

## 10. Observações finais para o Copilot

Ao sugerir código, considere sempre que:

- O sistema deve ser mais moderno e usável que o legado.
- O legado é referência de negócio, não de interface.
- O administrador deve conseguir parametrizar acessos e cadastros auxiliares manualmente.
- O sistema deve estar preparado para crescimento futuro.
- A primeira versão do Módulo 1 é cadastral/administrativa.
- Regras críticas de bloqueio devem ser automáticas e acompanhadas de alertas claros.
- Segurança e permissões devem ser tratadas desde o início.
- Auditoria deve existir pelo menos para pontos críticos.
- Anexos provavelmente farão parte do fluxo, então a arquitetura deve estar preparada para isso.
