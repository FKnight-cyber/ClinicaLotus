# Relatorio de Implementacao — MVP de Anamnese, Prontuario e Evolucoes

**Atualizado em:** 27/07/2026
**Objetivo da etapa:** registrar o que ja foi implementado no MVP tecnico/funcional de anamnese, persistencia clinica, permissoes, cadastro simples de pacientes, prontuario inicial, evolucoes clinicas e rastreabilidade documental.

---

## 1. Visao geral implementada

O projeto esta em monorepo com:

```txt
apps/
  api/   # NestJS + Prisma + PostgreSQL
  web/   # Next.js + React
shared/
  anamnese-templates.json
docs/
docker-compose.yml
package.json
```

A implementacao atual cobre o fluxo principal de anamnese clinica com backend real, banco PostgreSQL, autenticacao, autorizacao por permissoes, vinculo com paciente, prontuario inicial, evolucoes multiprofissionais e documento/PDF rastreavel.

---

## 2. Backend e banco de dados

### 2.1 Stack

- NestJS com TypeScript.
- Prisma 7 com PostgreSQL.
- `@prisma/adapter-pg`.
- JWT para autenticacao.
- Guards de autenticacao e permissao.
- `ValidationPipe` global.
- CORS configuravel por `WEB_ORIGIN`.
- Porta local por `API_PORT` e suporte a `PORT` para deploy Railway.

### 2.2 Modelos principais

Foram implementados modelos para:

- usuarios;
- grupos de acesso;
- permissoes;
- pacientes;
- templates oficiais de anamnese;
- secoes;
- perguntas;
- opcoes;
- linhas de tabela;
- registros de anamnese;
- respostas;
- customizacoes de perguntas por registro;
- entradas de prontuario;
- evolucoes clinicas;
- documentos clinicos rastreaveis;
- logs de auditoria.

### 2.3 Seed

O seed atual cria apenas dados estruturais:

- permissoes;
- visibilidade de menu;
- grupo `Administrador`;
- grupo `Developer`;
- usuario inicial `admin`;
- templates oficiais de anamnese no banco.

O seed **nao cria rascunhos nem registros clinicos de anamnese**. Rascunhos vazios usados em validacoes locais foram removidos.

A fonte oficial dos templates fica em:

```txt
shared/anamnese-templates.json
```

O frontend importa esse JSON por wrapper tipado, e o seed le o mesmo arquivo diretamente. O backend nao depende mais de transpilar arquivo TypeScript do frontend.

---

## 3. Autenticacao, usuarios e permissoes

### 3.1 Autenticacao

Endpoints implementados:

```txt
POST /api/auth/login
POST /api/auth/register
GET  /api/auth/me
```

Fluxos implementados:

- login interno por usuario/senha;
- cadastro pendente;
- aprovacao por administrador;
- perfil autenticado;
- logout no frontend.

### 3.2 Autorizacao

As permissoes ficam no banco e sao aplicadas por `PermissionsGuard`.

Exemplos de permissoes implementadas:

```txt
anamnese.read
anamnese.create
anamnese.update
anamnese.finalize
anamnese.print
patients.read
patients.create
prontuario.read
medical_evolutions.read
medical_evolutions.create
medical_evolutions.update
medical_evolutions.finalize
medical_evolutions.cancel
medical_evolutions.print
access.users.read
access.users.manage
access.groups.read
access.groups.manage
admin.full_access
menu.<modulo>.view
```

A UI tambem respeita permissoes:

- links de menu aparecem conforme permissao de visibilidade;
- botoes de criar, salvar, finalizar, imprimir, exportar, aprovar e gerenciar grupos so aparecem quando o usuario tem permissao;
- tela de detalhes do usuario esconde aprovacao/status de usuarios nao administradores;
- campos de anamnese ficam somente leitura sem permissao de edicao ou apos finalizacao.

---

## 4. Modulo de anamnese

### 4.1 Templates oficiais

Foram estruturados 3 templates oficiais:

- Admissao de Enfermagem;
- Anamnese Psicologica;
- Anamnese Terapeutica Inicial.

Esses templates possuem:

- secoes;
- perguntas;
- tipos de campo;
- obrigatoriedade;
- opcoes;
- linhas de tabelas;
- colunas de tabelas;
- textos auxiliares.

A API expõe os templates persistidos no banco:

```txt
GET /api/anamneses/templates
```

O frontend usa os templates vindos da API para:

- listagem;
- progresso de obrigatorios;
- workspace de preenchimento;
- impressao HTML;
- exportacao PDF.

### 4.2 Registros de anamnese

Endpoints implementados:

```txt
GET   /api/anamneses
GET   /api/anamneses/:id
POST  /api/anamneses
PATCH /api/anamneses/:id
POST  /api/anamneses/:id/finalize
POST  /api/anamneses/:id/documents/pdf
```

Funcionalidades implementadas:

- criar rascunho;
- listar registros;
- abrir registro;
- salvar respostas;
- autosave de rascunho durante preenchimento;
- salvar perguntas customizadas do registro;
- validar obrigatorios antes de finalizar;
- bloquear edicao apos finalizacao;
- finalizar anamnese;
- gerar documento/PDF rastreavel.

O frontend nao usa mais `localStorage` para registros clinicos. Os dados clinicos sao persistidos no PostgreSQL via API.

### 4.3 Autosave

O workspace de anamnese salva automaticamente rascunhos enquanto o usuario preenche ou edita.

O autosave persiste:

- respostas dos campos;
- nome do paciente derivado das fichas;
- vinculo com paciente;
- perguntas customizadas;
- edicoes/remocoes de perguntas customizadas.

A UI mostra mensagens como:

```txt
Alteracoes pendentes
Salvando rascunho automaticamente...
Rascunho salvo automaticamente
```

### 4.4 Layout e campos

Foi ajustado o comportamento visual dos campos para melhor aproveitamento de espaco:

- `input`, `select` e `textarea` respeitam o tamanho do container;
- selects possuem padding para nao colidir com a seta;
- painel de paciente usa grid responsivo;
- campos de informacao longa ocupam mais colunas;
- mobile usa uma coluna.

---

## 5. Pacientes e prontuario

### 5.1 Pacientes

Endpoints implementados:

```txt
GET  /api/patients
POST /api/patients
```

Funcionalidades implementadas:

- buscar pacientes por nome/documento;
- listar pacientes com suporte a paginacao quando a rota recebe `limit` e `offset`;
- criar paciente rapido com nome, data de nascimento, CPF e RG/documento;
- vincular paciente a anamnese;
- remover vinculo enquanto a anamnese ainda e rascunho.
- reaproveitar o mesmo cadastro simples na busca de pacientes do prontuario.

Limitacoes atuais:

- ainda nao existe tela propria funcional em `/modulos/pacientes`;
- ainda nao existem endpoints de detalhe, edicao, inativacao, duplicidade avancada, endereco, contatos, convenio/plano ou historico cadastral completo do paciente;
- a criacao de paciente esta exposta principalmente dentro dos fluxos de Anamnese e Prontuario.

### 5.2 Prontuario

Endpoint implementado:

```txt
GET /api/patients/:patientId/prontuario
```

Tela frontend implementada em:

```txt
/modulos/prontuario
```

Funcionalidades implementadas:

- busca/lista de pacientes;
- selecao de paciente;
- timeline clinica inicial;
- exibicao de eventos de anamnese finalizada;
- exibicao de evolucoes finalizadas quando o usuario possui permissao;
- lista/historico de evolucoes do paciente;
- criacao, edicao de rascunho, finalizacao e cancelamento de evolucoes;
- emissao de PDF rastreavel de evolucao;
- referencia ao codigo da anamnese.

Ao finalizar uma anamnese vinculada a paciente, o backend cria uma entrada em `MedicalRecordEntry`.

Ao finalizar uma evolucao vinculada a paciente, o backend cria uma entrada em `MedicalRecordEntry` do tipo `MEDICAL_EVOLUTION`.

### 5.3 Evolucoes clinicas

Endpoints implementados:

```txt
GET   /api/patients/:patientId/evolutions
POST  /api/patients/:patientId/evolutions
GET   /api/medical-evolutions/:id
PATCH /api/medical-evolutions/:id
POST  /api/medical-evolutions/:id/finalize
POST  /api/medical-evolutions/:id/cancel
POST  /api/medical-evolutions/:id/documents/pdf
```

Funcionalidades implementadas:

- evolucao generica/multiprofissional com area profissional explicita;
- rascunho, edicao, finalizacao e cancelamento com motivo;
- bloqueio de edicao livre apos finalizacao ou cancelamento;
- assinatura simples com snapshot dos dados profissionais do usuario finalizador;
- PDF/documento rastreavel da evolucao;
- auditoria para criacao, edicao, finalizacao, cancelamento e emissao de PDF;
- integracao com a timeline do prontuario do paciente.

---

## 6. Documento/PDF rastreavel

A emissao de PDF rastreavel esta integrada ao backend.

Ao emitir documento, a API cria `ClinicalDocument` com:

- codigo sequencial anual;
- tipo;
- nome do arquivo;
- hash SHA-256 do snapshot da anamnese;
- vinculo com paciente, quando houver;
- vinculo com registro de anamnese;
- usuario emissor;
- data/hora de emissao.

O frontend registra o documento antes de baixar o PDF.

---

## 7. Auditoria

Foram implementados logs de auditoria para eventos principais da anamnese, pacientes e evolucoes:

- `CREATE`;
- `UPDATE`;
- `FINALIZE`;
- `EMIT_PDF`.
- `create_patient`;
- `create_medical_evolution`;
- `update_medical_evolution`;
- `finalize_medical_evolution`;
- `cancel_medical_evolution`.

Os logs armazenam entidade, identificador, acao, usuario, data/hora e snapshots antes/depois quando aplicavel.

---

## 8. Telas implementadas

### Funcionais

- `/login`;
- `/cadastro`;
- `/anamnese`;
- `/anamnese/[recordId]`;
- `/meu-perfil`;
- `/usuarios/[userId]`;
- `/modulos/controle-acesso`;
- `/modulos/controle-acesso/grupos-e-acessos`;
- `/modulos/controle-acesso/gerenciar-usuarios`;
- `/modulos/auditoria/logs-controle-acessos`;
- `/modulos/auditoria/logs-anamnese`;
- `/modulos/auditoria/logs-evolucoes`;
- `/modulos/prontuario`.

### Estruturais/placeholders

Os demais modulos do menu existem como estrutura inicial e ainda nao possuem regras completas:

- Acolhimento;
- Agendamento;
- Atendimento;
- Cadastros;
- Relatorios;
- Pacientes;
- Configuracoes;
- Clinica.

---

## 9. Validacoes executadas

Foram executadas validacoes durante a implementacao:

```bash
npm.cmd run typecheck
npm.cmd run typecheck --workspace @clinica/web
npm.cmd run typecheck --workspace @clinica/api
docker compose exec api sh -lc "cd apps/api && npx prisma generate && npx prisma db push"
docker compose exec api sh -lc "cd apps/api && npm run prisma:seed"
git diff --check
```

Tambem foram feitos smokes via navegador/API para:

- carregamento dos templates oficiais pelo backend;
- autosave de campo preenchido;
- autosave de pergunta customizada;
- ausencia de rascunhos criados pelo seed;
- layout do select de paciente com texto longo;
- tela de prontuario;
- controle de exibicao por permissao.

---

## 10. Pendencias assumidas para etapas futuras

Nao fazem parte do status atual:

- E2E automatizado completo;
- seed demonstrativo opcional com pacientes/anamneses ficticias;
- implementacao completa dos modulos de acolhimento, agendamento e atendimento;
- tela propria funcional de Pacientes no item `/modulos/pacientes` do menu;
- edicao, inativacao, detalhe, validacao avancada de duplicidade e dados completos de paciente;
- cadastros operacionais completos fora de usuarios/grupos/permissoes/pacientes basicos;
- prescricao, CID, agenda e atendimento medico completos;
- pipeline formal de migrations versionadas para producao.

---

## 11. Proximos passos para o menu Pacientes

O item Pacientes ja existe no menu principal em `apps/web/src/config/modules.ts`, com rota `/modulos/pacientes` e permissao `menu.pacientes.view`. Hoje essa rota ainda usa o placeholder generico de modulo.

### Objetivo da proxima fatia

Transformar `/modulos/pacientes` em uma tela funcional de cadastro e consulta de pacientes, reaproveitando o backend existente e preparando a evolucao para cadastro completo do MVP.

### Passos sugeridos

1. Definir o recorte da primeira entrega do modulo Pacientes: listagem, busca, cadastro rapido, detalhe basico e acesso ao prontuario.
2. Criar feature frontend propria em `apps/web/src/features/pacientes/`, separada de Anamnese e Prontuario.
3. Criar rota dedicada para `/modulos/pacientes`, substituindo o placeholder por uma pagina real dentro do `AppShell`.
4. Reaproveitar `GET /api/patients` para busca/listagem paginada e `POST /api/patients` para cadastro rapido.
5. Extrair ou duplicar de forma controlada o client de pacientes hoje espalhado entre Anamnese e Prontuario, criando uma camada comum de API/cache para pacientes.
6. Implementar a tela com busca por nome, documento, CPF e RG, estados de carregamento/erro/vazio e paginacao.
7. Implementar formulario de novo paciente com os campos ja suportados pelo backend: nome, data de nascimento, CPF, RG e documento.
8. Adicionar acoes por linha: abrir prontuario, iniciar anamnese vinculada e visualizar dados basicos.
9. Respeitar permissoes no frontend: `patients.read`, `patients.create`, `prontuario.read` e `anamnese.create`.
10. Planejar a segunda fatia de backend para `GET /api/patients/:id`, `PATCH /api/patients/:id` e, se necessario, inativacao em vez de exclusao fisica.
11. Planejar validacao de duplicidade por CPF/RG/documento antes ou durante a criacao, com mensagem clara para o operador.
12. Ampliar o modelo de paciente para dados completos do MVP: contatos, endereco, convenio/plano, responsavel e observacoes administrativas.
13. Registrar auditoria nas novas mutacoes de paciente, especialmente edicao, inativacao e alteracoes de documentos.
14. Validar por typecheck do web/API e smoke manual: listar, buscar, criar, abrir prontuario e iniciar anamnese a partir do paciente.
