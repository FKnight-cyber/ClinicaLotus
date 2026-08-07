# Plano de implementacao - Multi-clinica

**Criado em:** 28/07/2026  
**Atualizado em:** 03/08/2026  
**Modulo:** Cadastros gerais / Autenticacao / Prontuario / Atendimento clinico  
**Objetivo:** detalhar as mudancas necessarias para transformar o sistema atual, hoje orientado a uma unica clinica, em um modelo multi-clinica funcional para clinicas da mesma rede.

---

## 0. Status atual da implementacao

Esta secao resume o que ja foi implementado ate 03/08/2026 e o que ainda falta para completar a entrega multi-clinica.

### 0.1 Implementado

- Modelagem Prisma multi-clinica criada com `Clinic`, `UserClinic`, `PatientClinic`, `AccessGroupClinic` e `clinicId` em registros clinicos, documentos, prontuario e auditoria.
- Seed cria `Clinica principal`, vincula usuarios, grupos e pacientes existentes e preenche registros clinicos existentes com a clinica padrao.
- Autenticacao retorna `clinics`, `activeClinic`, `activeClinicId` e `availableClinicIds`.
- JWT e `AuthGuard` carregam `activeClinicId` e escopo de clinicas disponiveis.
- Endpoint `POST /api/auth/active-clinic` troca a clinica ativa e emite novo token.
- Backend de pacientes, anamnese e evolucoes clinicas foi isolado pelo escopo de clinicas do usuario nas operacoes principais.
- `PatientClinic` e usado para listar e criar pacientes vinculados a uma clinica.
- Anamneses, evolucoes, documentos clinicos, entradas de prontuario e auditorias clinicas gravam `clinicId` nas escritas migradas.
- Modulo backend `clinics` criado com listagem, criacao, edicao e ativacao/inativacao.
- Permissoes `clinics.read` e `clinics.manage` criadas.
- Tela web do modulo **Clinica** criada para administrar clinicas.
- Grupos de acesso podem receber escopo de clinicas por `AccessGroupClinic` via backend e tela **Grupos e acessos**.
- Usuarios/profissionais podem receber vinculo direto com clinicas por `UserClinic` via backend e tela **Gerenciar usuarios**.
- Frontend `AuthProvider` guarda `clinics` e `activeClinic`; o `AppShell` mostra contexto de clinica e restringe troca global a perfis administrativos.
- O escopo principal de leitura passou a ser `availableClinicIds`: sem `clinicId` explicito, listas operacionais consultam todas as clinicas permitidas ao usuario; com apenas uma clinica, o usuario ve e escreve automaticamente nessa clinica.
- O seletor global de clinica no topo fica restrito a perfis com gestao de clinicas; profissionais usam filtros locais somente quando possuem mais de uma clinica no escopo.
- Formularios de criacao que dependem de clinica aceitam/enviam `clinicId` explicito quando o usuario possui mais de uma clinica: novo paciente, novo rascunho de anamnese e nova evolucao clinica.
- Permissao `patients.clinic_filter` criada.
- Listagem de pacientes aceita `clinicId` opcional como filtro local, validando permissao e escopo do usuario.
- Tela **Pacientes** mostra filtro de clinica quando o usuario tem `patients.clinic_filter` e mais de uma clinica disponivel.
- Detalhe do paciente e endpoint de prontuario aceitam `clinicId` opcional, validando permissao e escopo do usuario.
- Navegacao da lista de pacientes para o detalhe preserva o `clinicId` filtrado.
- Permissao `anamnese.clinic_filter` criada.
- Listagem e detalhe de anamnese aceitam `clinicId` opcional para leitura, validando permissao e escopo do usuario.
- Tela **Anamnese** mostra filtro local de clinica e preserva o `clinicId` ao abrir o registro.
- Busca/seletor de pacientes na edicao de anamnese usa o `clinicId` local para listar apenas pacientes ativos da clinica filtrada.
- Permissao `medical_evolutions.clinic_filter` criada.
- Listagem de evolucoes do paciente aceita `clinicId` opcional, validando permissao e escopo do usuario.
- Tela **Prontuario** mostra filtro local de clinica, busca pacientes ativos no escopo filtrado e carrega evolucoes da clinica selecionada.
- Endpoints de auditoria aceitam `clinicId` opcional, validando escopo do usuario.
- Telas de auditoria exibem a clinica de origem do evento e permitem filtro local de clinica.
- Auditoria de pacientes esta exposta em endpoint e tela proprios, incluindo criacao, edicao, status, emissao de relatorio e vinculo de cadastro existente entre clinicas.
- Cadastro de paciente reutiliza pessoa existente por CPF/RG/documento e cria ou reativa `PatientClinic` na clinica selecionada, evitando duplicidade entre clinicas.

### 0.2 Parcialmente implementado

- A clinica ativa global fica como fallback tecnico/administrativo quando o usuario possui mais de uma clinica; para usuarios com uma unica clinica disponivel, leituras e escritas resolvem a clinica automaticamente pelo escopo.
- A listagem de pacientes, o endpoint de prontuario, a listagem de anamnese e a listagem de evolucoes no Prontuario usam o escopo completo do usuario quando `clinicId` nao e informado; o filtro local apenas refina para uma clinica especifica.
- O isolamento backend esta aplicado nos modulos principais, mas `clinicId` ainda esta nullable em parte do schema para permitir migracao incremental.
- Auditoria grava e exibe `clinicId` em varias acoes clinicas, mas registros antigos podem aparecer como sem clinica.
- Caches backend foram ajustados nos fluxos ja migrados, mas ainda e necessario revisar todos os caches e estados frontend dependentes de clinica.

### 0.3 Ainda falta

- Usar a clinica do proprio registro para editar/finalizar/cancelar/emitir PDF de registros existentes quando usuarios com multiplas clinicas estiverem na visao `Todos`.
- Expandir `clinicId` local/escopo permitido para detalhe e PDF de evolucoes, removendo dependencia residual da clinica ativa.
- Decidir status global do paciente versus status por clinica em `PatientClinic.status`.
- Ajustar cadastro/aprovacao de usuario pendente para confirmar clinicas.
- Tornar `clinicId` obrigatorio no schema quando todos os escritores estiverem migrados.
- Criar testes automatizados ou roteiro manual completo para acesso cruzado entre clinicas.

### 0.4 Duvidas abertas

- Status do paciente deve ser global (`Patient.status`) ou por vinculo de clinica (`PatientClinic.status`)?
- Usuario comum pode buscar paciente na rede inteira para evitar duplicidade ou apenas dentro de `availableClinicIds`?
- Prontuario deve ter visao consolidada da rede na primeira entrega ou somente a visao por escopo/filtro atual?
- Qual permissao deve liberar uma eventual visao consolidada da rede?
- Cadastro publico/pendente deve listar clinicas ou usar convite/link por clinica?
- Administrador global continua sendo `admin.full_access` ou deve existir uma permissao especifica para visao global?
- Para registros existentes, a regra final sera sempre usar a clinica gravada no registro para editar/finalizar/cancelar/emitir PDF?

---

## 1. Contexto atual

O sistema ja possui:

- autenticacao interna com JWT;
- cadastro de usuarios;
- grupos de acesso e permissoes globais;
- cadastro simples de pacientes;
- modulo de anamnese com vinculo opcional a paciente;
- prontuario inicial por paciente;
- evolucoes clinicas multiprofissionais;
- documentos/PDF rastreaveis;
- auditoria basica em `AuditLog`;
- frontend com controle visual por permissoes.

No estado atual, o projeto funciona como uma unica clinica. Os principais dados sao globais:

- `User` nao possui vinculo com clinica;
- `Patient` nao possui vinculo com clinica;
- `AnamnesisRecord`, `MedicalEvolution`, `MedicalRecordEntry`, `ClinicalDocument` e `AuditLog` nao registram clinica;
- o JWT carrega usuario e permissoes, mas nao carrega clinica ativa;
- as buscas por pacientes, prontuarios, evolucoes e auditoria nao filtram por clinica;
- os caches nao incluem clinica na chave.

Com o novo requisito, o sistema deve atender clinicas da mesma rede, permitindo que usuarios atuem em mais de uma clinica e que a producao assistencial fique registrada na clinica em que foi realizada.

---

## 2. Decisoes de produto ja definidas

### 2.1 Modelo escolhido

Seguir com o modelo **multi-clinica completo**, com:

- cadastro de clinicas;
- usuarios vinculados a uma ou mais clinicas;
- escopo de clinicas disponiveis (`availableClinicIds`) como regra primaria de leitura e autorizacao;
- clinica ativa como fallback tecnico/administrativo, nao como dependencia da experiencia dos profissionais;
- filtros locais por clinica nas telas operacionais quando o usuario tiver permissao e escopo para mais de uma clinica;
- `activeClinicId` na sessao/JWT ou no contexto autenticado;
- isolamento de dados clinicos pelo escopo permitido do usuario e pelo `clinicId` local validado pelo backend quando informado;
- grupos de acesso e permissoes globais;
- auditoria registrando a clinica da acao;
- administrador com visao global e filtros por clinica.

Decisao atualizada em 02/08/2026:

- manter `activeClinicId` no JWT para compatibilidade, fallback e criacao operacional padrao;
- permitir `clinicId` em query como filtro local em telas operacionais, desde que haja permissao especifica e a clinica esteja em `availableClinicIds`;
- comecar por pacientes com a permissao `patients.clinic_filter`;
- expandir o mesmo padrao para detalhe do paciente, prontuario, anamnese e evolucoes;
- avaliar se o seletor global do topo deve continuar visivel para medicos ou ficar restrito a perfis administrativos.

### 2.2 Rede de clinicas

As clinicas pertencem a mesma rede. Por isso, o sistema deve evitar duplicar pessoas quando possivel.

Exemplo esperado:

- um paciente entra pela clinica/rede 1;
- meses depois, por reincidencia, passa pela clinica/rede 3;
- o cadastro da pessoa pode ser reaproveitado;
- o novo atendimento, anamnese, evolucao, documento e evento de prontuario devem ficar registrados como realizados na clinica/rede 3.

### 2.3 Grupos e permissoes

Os grupos de acesso e as permissoes continuam **globais**.

Isso significa:

- `Permission` continua global;
- `AccessGroup` continua global;
- um grupo como `Administrador`, `Recepcao`, `Enfermagem` ou `Medico` pode ser usado por qualquer clinica;
- a permissao define o que o usuario pode fazer;
- o vinculo com clinica define onde ele pode fazer.

O cadastro e a liberacao de funcionalidades devem seguir o padrao atual do sistema:

- criar uma `Permission` para cada funcionalidade ou acao protegida;
- associar permissoes aos grupos em `AccessGroupPermission`;
- usar `RequirePermissions` no backend e controle visual por permissoes no frontend;
- auditar mudancas de permissoes, grupos, vinculos e acessos administrativos.

Para operacao multi-clinica, alem da permissao funcional, o sistema deve controlar o **escopo de clinicas** disponivel ao usuario. Esse escopo pode vir de dois lugares:

- vinculo direto do usuario com clinicas em `UserClinic`, para excecoes ou configuracoes individuais;
- vinculo do grupo profissional/de acesso com clinicas em `AccessGroupClinic`, para permitir que um grupo veja uma ou mais clinicas.

Exemplo esperado:

- grupo `Medico rede 1 e 2` possui `patients.read`, `prontuario.read` e vinculo com as clinicas 1 e 2;
- grupo `Medico rede 1` possui as mesmas permissoes, mas vinculo apenas com a clinica 1;
- ao fazer login, o usuario recebe como clinicas disponiveis a uniao das clinicas vinculadas diretamente a ele e das clinicas vinculadas aos seus grupos ativos;
- a clinica ativa escolhida limita pacientes, anamneses, evolucoes, documentos, prontuario e auditoria operacional por padrao;
- filtros locais de clinica podem substituir esse contexto em telas autorizadas, desde que o backend valide permissao e escopo.

### 2.4 Administrador

O administrador deve poder ver tudo.

As telas administrativas devem oferecer filtro por clinica para facilitar a operacao, mas o administrador com permissao adequada pode consultar dados de todas as clinicas.

### 2.5 Cadastro/registro de usuario

O fluxo de cadastro precisa decidir em qual clinica o usuario entra.

Possibilidades:

- cadastro publico/pendente exige selecionar uma clinica;
- administrador cria usuario e seleciona uma ou mais clinicas;
- administrador aprova um usuario pendente e confirma os vinculos de clinica;
- usuario sem clinica ativa nao deve acessar modulos operacionais.

---

## 3. Principios de modelagem

### 3.1 Separar pessoa de ocorrencia clinica

Como a rede pode atender a mesma pessoa em clinicas diferentes, o ideal e separar:

- dados cadastrais da pessoa/paciente;
- dados assistenciais produzidos em uma clinica especifica.

Na primeira versao, pode-se manter o modelo `Patient` como cadastro compartilhado da pessoa e adicionar `clinicId` diretamente nos registros clinicos. Porem, se houver necessidade de controlar o status cadastral do paciente por clinica, a modelagem mais robusta e criar um vinculo `PatientClinic`.

### 3.2 Recomendacao de modelo

Modelo recomendado para evitar retrabalho:

- `Clinic`: representa cada clinica da rede;
- `UserClinic`: vincula usuario a clinicas;
- `Patient`: representa a pessoa/paciente compartilhavel na rede;
- `PatientClinic`: vincula paciente a uma ou mais clinicas da rede;
- entidades assistenciais recebem `clinicId` obrigatorio;
- auditoria recebe `clinicId` opcional ou obrigatorio conforme a acao.

Esse desenho permite que o mesmo paciente apareca em mais de uma clinica sem duplicar a pessoa, mas preserva onde cada atendimento foi feito.

---

## 4. Mudancas no banco de dados

### 4.1 Novos enums sugeridos

```prisma
enum ClinicStatus {
  ACTIVE
  INACTIVE
}

enum UserClinicStatus {
  ACTIVE
  INACTIVE
}

enum PatientClinicStatus {
  ACTIVE
  INACTIVE
}
```

### 4.2 Novo modelo `Clinic`

Campos sugeridos:

```prisma
model Clinic {
  id        String       @id @default(uuid())
  name      String
  code      String?      @unique
  document  String?
  status    ClinicStatus @default(ACTIVE)
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt

  users     UserClinic[]
  patients  PatientClinic[]
  groups    AccessGroupClinic[]
}
```

Observacoes:

- `code` pode ser usado para identificadores curtos como `REDE-1`, `REDE-3` ou unidade operacional;
- `document` pode guardar CNPJ se fizer sentido;
- usar `status` para desativar clinicas sem excluir historico.

### 4.3 Novo modelo `UserClinic`

Campos sugeridos:

```prisma
model UserClinic {
  userId     String
  clinicId   String
  status     UserClinicStatus @default(ACTIVE)
  isDefault  Boolean          @default(false)
  assignedAt DateTime         @default(now())

  user       User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  clinic     Clinic           @relation(fields: [clinicId], references: [id], onDelete: Cascade)

  @@id([userId, clinicId])
  @@index([clinicId, status])
}
```

Observacoes:

- um usuario pode atuar em varias clinicas;
- um usuario pode ter uma clinica padrao;
- o papel/perfil continua vindo dos grupos globais;
- o vinculo direto pode ser usado para excecoes individuais;
- o escopo padrao por perfil/profissional deve ser preferencialmente configurado no grupo, por meio de `AccessGroupClinic`.

### 4.4 Novo modelo `AccessGroupClinic`

Campos sugeridos:

```prisma
model AccessGroupClinic {
  accessGroupId String
  clinicId      String
  assignedAt    DateTime @default(now())

  accessGroup   AccessGroup @relation(fields: [accessGroupId], references: [id], onDelete: Cascade)
  clinic        Clinic      @relation(fields: [clinicId], references: [id], onDelete: Cascade)

  @@id([accessGroupId, clinicId])
  @@index([clinicId])
}
```

Observacoes:

- permite definir que um grupo profissional ou operacional acessa apenas clinicas especificas;
- complementa as permissoes globais, sem duplicar permissoes por clinica;
- o backend deve calcular as clinicas disponiveis do usuario como a uniao entre `UserClinic` e `AccessGroupClinic` dos grupos ativos;
- alteracoes nesses vinculos devem invalidar cache de autenticacao e ser auditadas.

### 4.5 Novo modelo `PatientClinic`

Campos sugeridos:

```prisma
model PatientClinic {
  patientId  String
  clinicId   String
  status     PatientClinicStatus @default(ACTIVE)
  firstSeenAt DateTime           @default(now())
  lastSeenAt  DateTime?

  patient    Patient             @relation(fields: [patientId], references: [id], onDelete: Cascade)
  clinic     Clinic              @relation(fields: [clinicId], references: [id], onDelete: Cascade)

  @@id([patientId, clinicId])
  @@index([clinicId, status])
}
```

Observacoes:

- evita duplicar o mesmo paciente quando ele for atendido em mais de uma clinica;
- permite listar pacientes por clinica;
- permite saber em quais clinicas aquele paciente ja teve passagem;
- `lastSeenAt` pode ser atualizado ao criar atendimento, anamnese ou evolucao.

### 4.6 Ajustes em `User`

Adicionar relacao:

```prisma
clinics UserClinic[]
```

Manter `login` e `email` unicos globalmente na primeira versao, para evitar ambiguidade no login.

Decisao recomendada:

- `login` globalmente unico;
- `email` globalmente unico quando informado;
- vinculos de clinica controlam acesso operacional.

### 4.7 Ajustes em `Patient`

Adicionar relacao:

```prisma
clinics PatientClinic[]
```

Manter dados pessoais em `Patient`, como nome, CPF, RG, documento e data de nascimento.

Decisao recomendada:

- CPF/documento nao precisa ser obrigatorio;
- quando CPF existir, avaliar unicidade global para reduzir duplicidade;
- se houver risco de cadastro sem documento, manter busca por nome/data de nascimento e permitir revisao manual.

### 4.8 Ajustes em entidades clinicas

Adicionar `clinicId` nas entidades que representam acao, documento ou historico produzido em uma clinica:

- `AnamnesisRecord`;
- `MedicalEvolution`;
- `MedicalRecordEntry`;
- `ClinicalDocument`;
- futuros `Appointment`, `Attendance`, `Prescription`, `Billing`, etc.

Exemplo:

```prisma
clinicId String
clinic   Clinic @relation(fields: [clinicId], references: [id])

@@index([clinicId, createdAt])
```

Para `AnamnesisRecord`, o campo deve ser obrigatorio mesmo quando `patientId` for nulo, porque hoje a anamnese pode existir sem paciente vinculado.

### 4.9 Ajustes em `AuditLog`

Adicionar:

```prisma
clinicId String?
clinic   Clinic? @relation(fields: [clinicId], references: [id])

@@index([clinicId, createdAt])
```

Regras:

- acoes clinicas devem registrar `clinicId`;
- acoes administrativas globais podem ter `clinicId` nulo;
- acoes administrativas filtradas por clinica devem registrar `clinicId` quando houver contexto;
- o payload de auditoria deve continuar registrando antes/depois, usuario e motivo.

### 4.10 Migracao inicial

Como nao ha migracao de sistema legado prevista, a migracao inicial pode ser simples:

1. Criar uma clinica padrao, por exemplo `Clinica principal`.
2. Vincular todos os usuarios existentes a essa clinica.
3. Vincular todos os pacientes existentes a essa clinica.
4. Vincular grupos administrativos/iniciais a essa clinica em `AccessGroupClinic`.
5. Preencher `clinicId` dos registros clinicos existentes com a clinica padrao.
6. Preencher `clinicId` dos documentos e entradas de prontuario existentes com a clinica padrao.
7. Manter `clinicId` nulo em auditorias antigas ou preencher com a clinica padrao quando a entidade auditada for claramente clinica.

---

## 5. Mudancas na autenticacao e sessao

### 5.1 Login

O login deve retornar:

- usuario;
- permissoes efetivas globais;
- lista de clinicas ativas do usuario;
- clinica ativa inicial.

Clinica ativa inicial sugerida:

1. usar a clinica marcada como `isDefault` em `UserClinic`;
2. se nao houver, usar a primeira clinica ativa do usuario;
3. se o usuario for superadmin/global, permitir entrar sem clinica ativa apenas em telas administrativas globais;
4. se usuario comum nao tiver clinica ativa, bloquear acesso operacional com mensagem clara.

### 5.2 JWT ou sessao

O contexto autenticado deve conter:

```txt
userId
login
permissions
activeClinicId
availableClinicIds
```

Recomendacao:

- manter JWT com `activeClinicId` para simplificar o backend;
- criar endpoint para trocar clinica ativa e emitir novo token;
- validar no backend se o usuario realmente possui acesso a clinica escolhida.

### 5.3 Endpoint de troca de clinica

Criar endpoint sugerido:

```txt
POST /api/auth/active-clinic
```

Payload:

```json
{
  "clinicId": "..."
}
```

Resposta:

```json
{
  "accessToken": "...",
  "user": { ... },
  "activeClinic": { ... },
  "clinics": [ ... ]
}
```

Regras:

- usuario comum so pode escolher clinica ativa se tiver `UserClinic` ativo;
- administrador global pode escolher qualquer clinica ativa, se essa for a regra de produto;
- ao trocar clinica, frontend deve limpar caches e estados dependentes de paciente/prontuario.

### 5.4 `AuthenticatedUser`

O tipo autenticado usado pelos controllers deve passar a incluir:

```ts
type AuthenticatedUser = {
  id: string;
  login: string;
  name: string;
  permissions: string[];
  activeClinicId: string | null;
  availableClinicIds: string[];
};
```

---

## 6. Regras de autorizacao e isolamento

### 6.1 Permissao vs escopo

Separar duas perguntas:

- **permissao:** o usuario pode executar esta acao?
- **escopo:** o usuario pode executar esta acao nesta clinica?

Exemplo:

- `patients.read` permite ler pacientes;
- `activeClinicId` limita quais pacientes aparecem;
- `admin.full_access` pode liberar visao global, conforme regra definida.

### 6.2 Consultas por lista

Toda listagem operacional deve filtrar por clinica ativa por padrao, ou por `clinicId` local quando o endpoint aceitar filtro de clinica validado por permissao e escopo:

- pacientes;
- anamneses;
- prontuario;
- evolucoes;
- documentos clinicos;
- auditoria clinica;
- futuros atendimentos e agendamentos.

Regra atual aplicada em pacientes:

- sem `clinicId` na query, usar `activeClinicId`;
- com `clinicId` na query, exigir permissao `patients.clinic_filter`;
- rejeitar `clinicId` fora de `availableClinicIds`.

### 6.3 Consultas por ID

Nao basta filtrar listas. Todo endpoint por ID tambem deve validar clinica.

Exemplos:

- `GET /api/patients/:patientId` deve validar se o paciente esta vinculado a clinica ativa;
- `PATCH /api/patients/:patientId` deve validar permissao e escopo;
- `GET /api/medical-evolutions/:id` deve validar se a evolucao pertence a clinica ativa;
- `PATCH /api/anamneses/:id` deve validar se a anamnese pertence a clinica ativa.

Sem essa validacao, um usuario poderia acessar dados de outra clinica apenas conhecendo um ID.

### 6.4 Escritas

Toda criacao operacional deve gravar `clinicId` a partir de um contexto validado pelo backend, nao de payload livre do frontend.

Regras:

- frontend pode exibir a clinica ativa ou um filtro local de clinica;
- backend decide o `clinicId` com base no contexto autenticado e, quando permitido, no `clinicId` local validado;
- payload pode aceitar `clinicId` apenas em fluxos administrativos globais;
- para usuarios comuns, ignorar ou rejeitar `clinicId` enviado no corpo da requisicao.

### 6.5 Administrador global

Definir uma permissao ou regra explicita para visao global.

Opcoes:

- reutilizar `admin.full_access`;
- criar permissao `clinics.global_access`;
- criar permissao `clinics.manage` para cadastro de clinicas e `clinics.read_all` para leitura global.

Recomendacao:

- manter `admin.full_access` como bypass geral;
- adicionar permissoes explicitas de clinica para telas administrativas;
- evitar depender somente de `admin.full_access` em novas telas, para permitir administradores operacionais no futuro.

---

## 7. Mudancas nos modulos backend

### 7.1 Novo modulo `clinics`

Criar modulo para cadastro e consulta de clinicas.

Endpoints sugeridos:

```txt
GET    /api/clinics
POST   /api/clinics
GET    /api/clinics/:clinicId
PATCH  /api/clinics/:clinicId
PATCH  /api/clinics/:clinicId/status
```

Permissoes sugeridas:

```txt
clinics.read
clinics.manage
```

Funcionalidades:

- listar clinicas com filtro por nome/status;
- criar clinica;
- editar dados basicos;
- ativar/inativar clinica;
- auditar alteracoes.

### 7.2 Modulo `auth`

Alteracoes necessarias:

- login deve carregar clinicas do usuario;
- perfil `/api/auth/me` deve retornar clinicas disponiveis e clinica ativa;
- criar troca de clinica ativa;
- JWT deve carregar `activeClinicId`;
- `AuthGuard` deve montar `request.user` com clinica ativa;
- invalidar cache de perfil quando vinculos de clinica mudarem.

### 7.3 Modulo `access`

Alteracoes necessarias:

- cadastro de usuario deve permitir selecionar clinicas;
- detalhe de usuario deve mostrar clinicas vinculadas;
- update de usuario deve permitir alterar clinicas, se usuario tiver permissao;
- listagem de usuarios deve permitir filtro por clinica;
- aprovacao de usuario pendente deve confirmar clinica;
- pedidos de senha podem continuar globais, mas a listagem pode filtrar por clinica do usuario;
- auditoria de usuarios deve registrar clinica quando a acao for feita em contexto de clinica.

Grupos permanecem globais:

- listagem de grupos nao precisa filtrar por clinica;
- associacao usuario x grupo continua global;
- permissoes continuam globais.

### 7.4 Modulo `patients`

Alteracoes necessarias:

- criar paciente vinculado a clinica ativa;
- se paciente ja existir na rede, permitir vincular a clinica ativa em vez de duplicar;
- listagem deve retornar pacientes vinculados a clinica ativa;
- administrador pode filtrar por clinica ou consultar todas;
- detalhe deve validar vinculo com clinica;
- atualizacao cadastral deve considerar que dados sao compartilhados na rede;
- status pode precisar existir em `PatientClinic`, nao apenas em `Patient`.

Ponto de atencao:

- se `Patient.status` continuar global, inativar paciente em uma clinica inativa para toda a rede;
- se isso nao for desejado, mover status operacional para `PatientClinic.status`.

Recomendacao:

- manter `Patient.status` como status geral da pessoa;
- adicionar `PatientClinic.status` para status naquela clinica;
- telas operacionais usam `PatientClinic.status`.

### 7.5 Modulo `anamnesis`

Implementado:

- listagem e detalhe filtram por clinica ativa por padrao;
- listagem e detalhe aceitam `clinicId` local quando o usuario tem `anamnese.clinic_filter` e escopo na clinica solicitada;
- tela de listagem de anamnese permite filtro local de clinica e preserva esse contexto ao abrir o registro;
- registros abertos por clinica filtrada diferente da ativa ficam em modo leitura para evitar escritas na clinica errada.

Alteracoes necessarias:

- `AnamnesisRecord` deve receber `clinicId` obrigatorio;
- criacao usa clinica ativa;
- detalhe/update/finalizacao/documentos validam clinica;
- ao vincular paciente, validar se paciente pertence ou pode ser vinculado a clinica ativa;
- anamnese sem paciente ainda deve pertencer a clinica ativa;
- auditoria deve registrar `clinicId`.

### 7.6 Modulo `medical-evolutions`

Implementado:

- listagem de evolucoes por paciente filtra por clinica ativa por padrao;
- listagem de evolucoes por paciente aceita `clinicId` local quando o usuario tem `medical_evolutions.clinic_filter` e escopo na clinica solicitada;
- tela **Prontuario** usa o filtro local de clinica para buscar pacientes ativos e carregar evolucoes do paciente;
- acoes de criacao, edicao, finalizacao, cancelamento e PDF continuam vinculadas a clinica ativa para evitar escrita em contexto ambíguo.

Alteracoes necessarias:

- `MedicalEvolution` deve receber `clinicId` obrigatorio;
- criar evolucao com clinica ativa;
- detalhe/update/finalizacao/cancelamento/PDF validam clinica;
- entrada de prontuario criada ao finalizar deve receber o mesmo `clinicId`;
- documento emitido deve receber o mesmo `clinicId`;
- auditoria deve registrar `clinicId`.

Regra importante:

- se paciente foi cadastrado na rede 1, mas atendimento/evolucao ocorre na rede 3, a evolucao deve gravar `clinicId` da rede 3.

### 7.7 Prontuario

Implementado:

- endpoint de prontuario por paciente aceita `clinicId` opcional e valida permissao/escopo antes de consultar os eventos;
- sem `clinicId` local, a timeline segue usando a clinica ativa como padrao.
- tela **Prontuario** oferece filtro local de clinica para usuarios autorizados e limpa paciente selecionado quando ele sai do escopo filtrado.

Alteracoes necessarias:

- avaliar se administradores podem ver timeline consolidada da rede;
- cada evento deve exibir ou carregar a clinica de origem;
- documentos e eventos antigos devem apontar para a clinica padrao apos migracao.

Decisao recomendada:

- usuario comum ve prontuario da clinica ativa;
- administrador pode alternar entre visao da clinica e visao consolidada da rede, se houver necessidade operacional;
- mesmo na visao consolidada, cada evento deve exibir a clinica de origem.

### 7.8 Auditoria

Implementado:

- `AuditLog` ja possui `clinicId` e relacao com `Clinic`;
- endpoints de logs aceitam `clinicId` opcional e validam se a clinica pertence ao escopo do usuario;
- telas de auditoria exibem coluna de clinica e oferecem filtro local de clinica;
- logs sem `clinicId` continuam visiveis como registros antigos sem clinica.

Alteracoes necessarias:

- todos os metodos de escrita de auditoria devem aceitar clinica;
- administrador pode consultar todas;
- payload deve manter rastreabilidade de entidade, acao, antes/depois, usuario e motivo.

### 7.9 Cache

Alteracoes necessarias:

- incluir `clinicId` nas chaves de cache de dados operacionais;
- invalidar caches por clinica;
- ao trocar clinica ativa, frontend deve limpar caches locais;
- caches globais, como permissoes, podem continuar sem clinica.

Exemplos de chaves que devem mudar:

```txt
patients:list:<clinicId>:...
patients:detail:<clinicId>:<patientId>:...
patients:medical-record:<clinicId>:<patientId>:...
medical-evolutions:patient:<clinicId>:<patientId>:...
anamnesis:records:list:<clinicId>:...
access:audit-logs:<clinicId-or-all>:...
```

---

## 8. Mudancas no frontend

### 8.1 Autenticacao e estado global

Alteracoes necessarias:

- `AuthProvider` deve guardar `clinics` e `activeClinic`;
- persistencia local da sessao deve incluir clinica ativa;
- troca de clinica deve atualizar token e usuario;
- ao trocar clinica, limpar estados dependentes da clinica.

Estados que devem ser limpos ou recalculados:

- paciente selecionado no prontuario;
- caches de busca de pacientes;
- filtros de pacientes, se fizer sentido;
- listas de anamneses;
- listas de evolucoes;
- relatatorios/documentos carregados;
- dados de auditoria filtrados.

### 8.2 Seletor de clinica ativa

Adicionar seletor na casca principal do sistema.

Comportamento esperado:

- aparece para usuarios com mais de uma clinica;
- mostra clinica ativa claramente;
- troca chama endpoint de troca de clinica;
- enquanto troca, bloquear acoes operacionais;
- apos troca, redirecionar ou recarregar dados da tela atual;
- se a tela atual tiver paciente/registros de outra clinica, limpar selecao.

### 8.3 Telas administrativas de clinicas

Criar tela para:

- listar clinicas;
- criar clinica;
- editar clinica;
- ativar/inativar clinica;
- consultar usuarios vinculados;
- consultar pacientes vinculados, se fizer sentido.

### 8.4 Tela de usuarios

Alteracoes necessarias:

- filtro por clinica;
- formulario de usuario com selecao de clinicas;
- detalhe de usuario mostrando clinicas vinculadas;
- acao para definir clinica padrao;
- validacao visual para usuario sem clinica ativa;
- fluxo de aprovacao de cadastro pendente com definicao de clinica.

### 8.5 Tela de pacientes

Implementado:

- listagem por clinica ativa e filtro local de clinica para usuarios autorizados;
- cadastro reutiliza paciente existente por CPF/RG/documento e vincula a pessoa a clinica ativa sem duplicar cadastro.

Alteracoes necessarias:

- detalhe deve mostrar passagens/clinicas vinculadas, conforme permissao;
- status deve deixar claro se e status global da pessoa ou status na clinica.

### 8.6 Anamnese, prontuario e evolucoes

Alteracoes necessarias:

- sempre exibir contexto da clinica ativa;
- limpar paciente selecionado ao trocar clinica;
- impedir salvar registros sem clinica ativa;
- exibir clinica de origem em eventos/documentos quando houver visao consolidada;
- usar filtros e caches com clinica.

### 8.7 Auditoria

Alteracoes necessarias:

- filtro por clinica;
- coluna ou detalhe de clinica na listagem;
- administrador pode selecionar todas as clinicas;
- usuario comum ve apenas auditoria permitida da clinica ativa, se a permissao permitir.

---

## 9. Mudancas em DTOs e contratos de API

### 9.1 Resposta de autenticacao

Adicionar em login e `/api/auth/me`:

```json
{
  "user": {
    "id": "...",
    "login": "...",
    "name": "...",
    "permissions": ["..."],
    "activeClinicId": "..."
  },
  "activeClinic": {
    "id": "...",
    "name": "...",
    "code": "..."
  },
  "clinics": [
    { "id": "...", "name": "...", "code": "...", "status": "ACTIVE" }
  ]
}
```

### 9.2 Usuarios

Criacao/edicao administrativa deve aceitar:

```json
{
  "clinicIds": ["..."],
  "defaultClinicId": "..."
}
```

### 9.3 Cadastro publico/pendente

Cadastro deve aceitar clinica pretendida:

```json
{
  "clinicId": "..."
}
```

Ou, se a rede nao quiser expor todas as clinicas no cadastro publico, usar convite/link por clinica.

### 9.4 Pacientes

Criacao operacional de paciente aceita `clinicId` explicito. Quando o usuario possui apenas uma clinica disponivel, o backend usa essa clinica automaticamente. Quando possui mais de uma, o formulario exige a clinica do cadastro e o backend bloqueia criacao sem `clinicId`.

Listagem ja aceita filtro local de clinica quando o usuario possui permissao `patients.clinic_filter` e a clinica esta dentro de `availableClinicIds`. Sem `clinicId`, retorna pacientes das clinicas permitidas ao usuario:

```txt
GET /api/patients?clinicId=...&search=...
```

Detalhe e prontuario aceitam `clinicId` local e tambem usam o escopo permitido quando `clinicId` nao e informado:

```txt
GET /api/patients/:patientId?clinicId=...
GET /api/patients/:patientId/prontuario?clinicId=...
```

Para administradores globais, endpoints futuros podem aceitar escopo consolidado alem de `availableClinicIds`, se a visao global entrar no escopo:

```txt
GET /api/patients?clinicScope=all&search=...
```

### 9.5 Auditoria

Adicionar query:

```txt
GET /api/access/audit-logs?clinicId=...
GET /api/access/audit-logs?clinicScope=all
```

---

## 10. Regras para paciente em mais de uma clinica

### 10.1 Cadastro compartilhado

O paciente deve poder ser encontrado na rede quando houver dados suficientes.

Fluxo sugerido:

1. usuario da clinica ativa pesquisa paciente;
2. sistema busca primeiro na clinica ativa;
3. se nao encontrar, pode oferecer busca ampliada na rede para usuarios autorizados;
4. se encontrar paciente existente na rede, usuario vincula o paciente a clinica ativa;
5. novo atendimento/anamnese/evolucao registra `clinicId` da clinica ativa.

### 10.2 Historico clinico

Decisao importante a validar com a operacao:

- usuario comum de uma clinica pode ver historico do paciente feito em outra clinica da mesma rede?

Opcoes:

1. **Visao por clinica:** usuario ve apenas eventos da clinica ativa.
2. **Visao consolidada da rede:** usuario ve historico completo da rede se tiver permissao.
3. **Visao hibrida:** por padrao ve clinica ativa, com botao/permissao para ver rede.

Recomendacao inicial:

- implementar visao por clinica como padrao;
- criar permissao futura `prontuario.read_network` para visao consolidada;
- em qualquer visao consolidada, mostrar a clinica de origem de cada evento.

### 10.3 Novo atendimento na rede 3

Quando um paciente previamente cadastrado na rede 1 for atendido na rede 3:

- o cadastro `Patient` e reaproveitado;
- criar ou ativar `PatientClinic(patientId, clinicIdRede3)`;
- nova anamnese recebe `clinicIdRede3`;
- nova evolucao recebe `clinicIdRede3`;
- novo documento recebe `clinicIdRede3`;
- nova entrada de prontuario recebe `clinicIdRede3`;
- auditoria recebe `clinicIdRede3`;
- eventos anteriores da rede 1 permanecem com `clinicIdRede1`.

---

## 11. Ordem de implementacao sugerida

### Fase 1 - Fundacao de banco e seed

- [x] Criar `Clinic`.
- [x] Criar `UserClinic`.
- [x] Criar `PatientClinic`.
- [x] Criar `AccessGroupClinic`.
- [x] Adicionar `clinicId` em entidades clinicas.
- [x] Adicionar `clinicId` em `AuditLog`.
- [x] Criar clinica padrao no seed/migracao.
- [x] Vincular dados existentes a clinica padrao.
- [x] Gerar Prisma Client.
- [ ] Tornar `clinicId` obrigatorio apos concluir todos os escritores.

### Fase 2 - Autenticacao e contexto de clinica

- [x] Ajustar login para carregar clinicas do usuario.
- [x] Ajustar `/api/auth/me`.
- [x] Ajustar JWT com `activeClinicId`.
- [x] Ajustar `AuthGuard` e `AuthenticatedUser`.
- [x] Criar endpoint de troca de clinica ativa.
- [x] Validar UX para usuario com uma unica clinica: leitura e criacao usam o escopo automaticamente.
- [ ] Melhorar UX para usuario sem nenhuma clinica disponivel.

### Fase 3 - Isolamento backend operacional

- [x] Filtrar pacientes por escopo de clinicas do usuario.
- [x] Permitir filtro local `clinicId` na listagem de pacientes com `patients.clinic_filter`.
- [x] Validar pacientes por ID contra escopo permitido ou `clinicId` local.
- [x] Filtrar anamneses por escopo de clinicas do usuario.
- [x] Validar anamneses por ID contra escopo permitido ou `clinicId` local.
- [x] Filtrar prontuario por escopo de clinicas do usuario.
- [x] Filtrar evolucoes por escopo de clinicas do usuario.
- [ ] Validar evolucoes por ID contra escopo permitido sem depender da clinica ativa.
- [x] Gravar `clinicId` em documentos nos fluxos migrados.
- [x] Gravar `clinicId` em auditoria nos fluxos migrados.
- [x] Ajustar chaves e invalidacoes de cache nos fluxos migrados.
- [x] Propagar `clinicId` local para detalhe do paciente e prontuario.
- [x] Propagar `clinicId` local para anamnese e listagem de evolucoes.
- [ ] Revisar todos os endpoints por ID e caches antes de tornar `clinicId` obrigatorio.

### Fase 4 - Administracao de clinicas e usuarios

- [x] Criar modulo/tela de clinicas.
- [x] Permitir criar/editar/inativar clinicas.
- [x] Ajustar grupos para vincular escopo de clinicas.
- [x] Ajustar tela de usuarios para vincular clinicas diretamente.
- [ ] Ajustar aprovacao de cadastro pendente.
- [ ] Adicionar filtro por clinica na listagem de usuarios.
- [x] Manter grupos e permissoes globais.

### Fase 5 - Frontend operacional

- [x] Ajustar `AuthProvider` para clinicas.
- [x] Criar contexto/seletor de clinica, restringindo troca global a perfis administrativos.
- [x] Limpar estados principais ao trocar filtro local de clinica nas telas migradas.
- [x] Ajustar listagem de pacientes por escopo permitido.
- [x] Adicionar filtro local de clinica na listagem de pacientes.
- [x] Preservar filtro de clinica ao abrir detalhe/prontuario do paciente.
- [x] Ajustar anamnese para filtro local, seletor de pacientes e criacao com `clinicId` explicito.
- [x] Ajustar prontuario para filtro local e escopo permitido.
- [x] Ajustar evolucoes para listagem por escopo/filtro e criacao com `clinicId` explicito.
- [x] Ajustar auditoria para filtro local, coluna de clinica e logs de pacientes.
- [x] Rever exibicao do seletor global para medicos/profissionais.

### Fase 6 - Regras de rede e refinamento

- [ ] Definir busca ampliada de pacientes fora de `availableClinicIds`, caso entre no escopo.
- [x] Implementar vinculo de paciente existente a nova clinica por CPF/RG/documento.
- [ ] Decidir e implementar visao consolidada do prontuario, se entrar no escopo.
- [x] Exibir clinica de origem nos eventos de auditoria e registros ja migrados.
- [ ] Revisar mensagens, filtros e estados vazios.

---

## 12. Testes e validacoes necessarias

### 12.1 Backend

- [ ] Usuario da clinica A nao lista pacientes da clinica B.
- [ ] Usuario da clinica A nao acessa detalhe de paciente exclusivo da clinica B por ID.
- [ ] Usuario da clinica A nao acessa evolucao da clinica B por ID.
- [ ] Usuario da clinica A nao acessa anamnese da clinica B por ID.
- [ ] Criacao de paciente vincula paciente a clinica ativa.
- [ ] Criacao de anamnese grava `clinicId` da clinica ativa.
- [ ] Criacao/finalizacao de evolucao grava `clinicId` da clinica ativa.
- [ ] Documento emitido herda `clinicId` correto.
- [ ] Auditoria registra `clinicId` correto.
- [ ] Administrador global consegue filtrar por clinica.
- [ ] Administrador global consegue consultar todas as clinicas quando permitido.
- [ ] Troca de clinica rejeita clinica nao vinculada ao usuario comum.

### 12.2 Frontend

- [ ] Login exibe clinica ativa.
- [ ] Usuario com uma clinica nao precisa escolher manualmente.
- [ ] Usuario com varias clinicas consegue trocar clinica ativa.
- [ ] Ao trocar clinica, paciente selecionado no prontuario e limpo.
- [ ] Listagem de pacientes muda conforme clinica ativa.
- [ ] Anamnese criada apos troca fica na nova clinica.
- [ ] Evolucao criada apos troca fica na nova clinica.
- [ ] Filtros administrativos por clinica funcionam.
- [ ] Estados de loading/erro deixam claro quando nao ha clinica ativa.

### 12.3 Regressao

- [ ] Login continua funcionando para usuario existente migrado.
- [ ] Admin inicial continua com acesso total.
- [ ] Permissoes globais continuam funcionando.
- [ ] Grupos globais continuam sendo aplicados.
- [ ] Templates de anamnese continuam globais.
- [ ] PDFs continuam sendo gerados.
- [ ] Prontuario continua listando eventos esperados dentro da clinica ativa.

---

## 13. Riscos e pontos de atencao

### 13.1 Vazamento por endpoint de ID

O maior risco e filtrar apenas as listagens e esquecer endpoints por ID.

Mitigacao:

- criar helpers de escopo por clinica;
- revisar todos os `findUnique`, `findFirst`, `update`, `delete` e `create` que envolvem dados clinicos;
- adicionar testes especificos de acesso cruzado.

### 13.2 Cache misturando clinicas

Caches atuais usam chaves sem clinica em varios pontos.

Mitigacao:

- incluir `clinicId` nas chaves operacionais;
- limpar caches ao trocar clinica;
- manter caches globais somente para dados realmente globais, como permissoes e templates.

### 13.3 Status de paciente

Hoje `Patient.status` e global.

Risco:

- inativar paciente em uma clinica pode inativar para toda a rede.

Mitigacao:

- usar `PatientClinic.status` para status operacional por clinica;
- deixar `Patient.status` apenas para bloqueio global da pessoa, se necessario.

### 13.4 Anamneses sem paciente

Como `AnamnesisRecord.patientId` pode ser nulo, o registro precisa de `clinicId` proprio.

Mitigacao:

- tornar `clinicId` obrigatorio em anamnese;
- usar clinica ativa na criacao.

### 13.5 Administrador global excessivamente amplo

`admin.full_access` pode virar bypass de tudo.

Mitigacao:

- manter `admin.full_access` para usuario tecnico/administrador principal;
- criar permissoes explicitas para operacao multi-clinica;
- registrar auditoria de todas as acoes globais.

### 13.6 Duplicidade de paciente

Sem identificador obrigatorio, o mesmo paciente pode ser cadastrado mais de uma vez.

Mitigacao:

- cadastro reutiliza paciente existente por CPF/RG/documento quando disponivel;
- busca por nome e data de nascimento;
- alerta de possivel duplicidade;
- fluxo manual para vincular paciente existente a nova clinica, caso nao haja documento confiavel.

---

## 14. Estimativa de complexidade

Complexidade estimada: **media-alta/alta**.

Prazo estimado para uma entrega bem validada: **3 a 5 semanas**, considerando:

- migracao de banco;
- ajustes de autenticacao;
- isolamento backend;
- ajustes de frontend;
- telas administrativas;
- validacoes de seguranca;
- revisao de caches;
- testes manuais e/ou automatizados.

Se a visao consolidada de prontuario da rede entrar no primeiro pacote, a estimativa tende a ficar mais perto de 5 semanas. Se a primeira entrega limitar a operacao a clinica ativa/filtros locais validados e deixar a visao consolidada como fase posterior, a entrega fica mais controlada.

---

## 15. Decisoes pendentes

- [x] Paciente operacional aparece apenas dentro do escopo permitido e/ou apos vinculo `PatientClinic` com a clinica.
- [ ] Usuario comum pode buscar paciente fora de `availableClinicIds` para evitar duplicidade?
- [ ] Prontuario deve ter visao consolidada da rede na primeira entrega?
- [ ] Qual permissao libera visao consolidada da rede?
- [ ] Cadastro publico deve listar clinicas ou usar convite/link por clinica?
- [ ] Inativacao de paciente sera global (`Patient.status`) ou por clinica (`PatientClinic.status`)?
- [ ] Administrador global sera identificado por `admin.full_access` ou por nova permissao especifica?
- [x] Criacao operacional com multiplas clinicas deve informar a clinica no formulario; com uma unica clinica, o backend resolve automaticamente.
- [ ] Edicao/finalizacao/cancelamento/emissao de PDF deve sempre usar a clinica gravada no registro existente?
- [x] O seletor global de clinica fica restrito a administradores/gestao; profissionais usam filtros locais por tela.

---

## 16. Recomendacao de escopo para primeira entrega

Para reduzir risco, a primeira entrega deve focar em:

- cadastro de clinicas;
- vinculo usuario x clinica;
- escopo de clinicas disponiveis no login/sessao (`availableClinicIds`);
- leituras operacionais limitadas ao escopo permitido por padrao;
- filtro local de clinica nas telas operacionais quando o usuario puder atuar em mais de uma clinica;
- campo de clinica nos formularios de criacao quando houver mais de uma clinica disponivel;
- pacientes vinculados por clinica;
- registros clinicos gravando `clinicId`;
- isolamento backend por escopo de clinicas do usuario;
- auditoria com `clinicId`;
- filtros administrativos por clinica;
- grupos e permissoes globais preservados.

Deixar para uma segunda entrega:

- visao consolidada de prontuario da rede;
- busca ampliada sofisticada de pacientes na rede;
- merge/deduplicacao formal de pacientes;
- permissoes diferentes por clinica;
- parametrizacoes especificas por clinica.

Esse recorte entrega multi-clinica funcional sem bloquear evolucoes futuras do sistema.