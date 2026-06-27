# Relatório de Implementação — MVP Inicial de Anamnese

**Data:** 27/06/2026  
**Objetivo da etapa:** criar a primeira versão funcional do sistema priorizando exclusivamente o fluxo de Anamnese, mantendo os demais módulos apenas como estrutura inicial bloqueada.

---

## 1. Fontes analisadas

Foram utilizados como referência os documentos existentes na pasta `docs`:

- `escopo-mvp-sistema-prontuario.md`;
- `copilot-instructions-modulo-1-prontuario-v2.md`;
- `copilot-instructions-modulo-2-acolhimento.md`;
- `copilot-instructions-modulo-3-prontuario.md`;
- `copilot-instructions-modulo-4-agendamento.md`;
- `copilot-instructions-modulo-5-atendimento.md`;
- `ADMISSÃO DE ENFERMAGEM NOVO.pdf`;
- `ANAMNESE PSICOLÓGICA.pdf`;
- `ANAMNESE TERAPÊUTICA INICIAL - FLOR DE LOTUS.pdf`.

Os documentos gerais indicam que fichas clínicas, questionários e formulários devem ser tratados como estruturas configuráveis, com seções, perguntas, tipos de resposta, obrigatoriedade, versionamento/snapshot e histórico. Por isso, a implementação inicial da anamnese foi feita como um fluxo de ficha clínica estruturada, preparado para futura persistência via backend.

---

## 2. O que foi implementado

### 2.1 Estrutura do projeto

Foi criada uma estrutura inicial em monorepo:

```txt
apps/
  api/
  web/
docs/
docker-compose.yml
package.json
.env.example
```

Componentes principais:

- `apps/web`: aplicação Next.js com React e TypeScript;
- `apps/api`: backend Nest.js com TypeScript;
- `docker-compose.yml`: serviço PostgreSQL preparado para uso futuro;
- `.env.example`: variáveis esperadas para API, frontend e banco.

### 2.2 Frontend Next.js

Foi implementada uma aplicação web funcional com:

- rota principal `/anamnese`;
- redirecionamento da raiz `/` para `/anamnese`;
- layout base de sistema clínico;
- menu lateral com módulos previstos no escopo;
- tela funcional de preenchimento de anamnese;
- layout responsivo para desktop e telas menores;
- interface limpa, profissional e voltada para uso clínico.

Arquivos principais:

- `apps/web/src/app/layout.tsx`;
- `apps/web/src/app/page.tsx`;
- `apps/web/src/app/anamnese/page.tsx`;
- `apps/web/src/features/anamnese/AnamneseWorkspace.tsx`;
- `apps/web/src/features/anamnese/templates.ts`;
- `apps/web/src/app/globals.css`.

### 2.3 Menu e placeholders dos módulos futuros

Foram adicionados no menu principal os módulos previstos no escopo geral:

- Anamnese;
- Acolhimento;
- Prontuário;
- Agendamento;
- Atendimento;
- Cadastros;
- Relatórios;
- Pacientes;
- Configurações;
- Clínica.

Apenas o módulo Anamnese está funcional nesta etapa.

Os demais módulos possuem:

- página inicial placeholder;
- layout base preparado;
- ações previstas exibidas;
- botões desabilitados;
- tooltip com o texto `Em desenvolvimento`.

Não foram implementadas regras de negócio nos módulos fora do escopo da anamnese.

### 2.4 Fluxo funcional de Anamnese

A tela de anamnese permite:

- iniciar nova anamnese;
- preencher as fichas extraídas dos PDFs;
- navegar por fichas e seções;
- salvar rascunho local;
- finalizar anamnese;
- validar campos obrigatórios antes da finalização;
- listar registros locais já preenchidos;
- reabrir registros locais salvos;
- identificar status `Rascunho` ou `Finalizada`;
- exibir código local da anamnese;
- persistir dados em `localStorage`.

Essa persistência é local/mock, conforme solicitado para a primeira etapa, e já deixa a estrutura preparada para substituição futura por API.

### 2.5 Tipos de campos implementados

O renderizador de fichas suporta:

- texto curto;
- texto longo;
- data;
- hora;
- número;
- sim/não;
- seleção única;
- múltipla escolha;
- tabelas estruturadas.

### 2.6 Backend Nest.js

Foi criada uma base inicial de backend com:

- Nest.js;
- TypeScript;
- `ValidationPipe` global;
- CORS configurado para o frontend local;
- prefixo global `/api`;
- healthcheck em `/api/health`;
- módulo inicial de anamnese em `/api/anamneses`;
- conexão PostgreSQL preparada via `pg` e `DATABASE_URL`.

Endpoints iniciais disponíveis:

```txt
GET  /api/health
GET  /api/anamneses/templates
GET  /api/anamneses/:id
POST /api/anamneses
```

Nesta fase, o frontend ainda usa `localStorage`. A API existe como preparação arquitetural para a próxima etapa.

---

## 3. Conteúdo dos PDFs implementado

### 3.1 `ADMISSÃO DE ENFERMAGEM NOVO.pdf`

Este PDF foi extraído com boa qualidade textual e seus campos foram convertidos em ficha estruturada.

Seções implementadas:

- Identificação e uso atual;
- Alergias;
- Comorbidades;
- Nível de consciência;
- Exame físico;
- Sistema geniturinário e fechamento.

Campos contemplados:

- nome do paciente;
- data de nascimento;
- idade;
- fumante;
- uso de medicamentos;
- quais medicamentos;
- alergia a medicamentos;
- alergia alimentar;
- hipertenso;
- diabetes mellitus;
- hepatites;
- asma;
- consciente, letárgico, ansioso, agitado, orientado, desorientado e calmo;
- PA, temperatura, frequência cardíaca e frequência respiratória;
- couro cabeludo;
- olhos;
- mucosa;
- pescoço;
- pele;
- lesão em outra região do corpo;
- estado nutricional;
- diurese;
- evacuações;
- região genital;
- observações;
- data;
- profissional de enfermagem;
- COREN.

Campos obrigatórios definidos inicialmente:

- nome do paciente;
- data de nascimento;
- data da admissão/registro de enfermagem;
- profissional de enfermagem;
- COREN.

### 3.2 `ANAMNESE PSICOLÓGICA.pdf`

Este PDF foi extraído com boa qualidade textual e convertido em ficha estruturada.

Seções implementadas:

- Identificação e admissão;
- Família e moradia;
- Religião, encaminhamento e queixas;
- Sexualidade, risco e saúde;
- História forense;
- Histórico de consumo de substância.

Campos contemplados:

- paciente;
- data de admissão;
- data de nascimento;
- idade;
- HD;
- data e hora da entrevista;
- profissão;
- trabalho atual;
- função;
- afastamento pela previdência social;
- tempo de afastamento;
- sexo;
- cônjuge;
- idade do cônjuge;
- escolaridade;
- usuário(a) e substâncias;
- filhos e quantidade;
- tabela de filhos;
- pai, mãe e respectivos dados;
- irmãos e tabela de irmãos;
- com quem mora atualmente;
- religião e prática religiosa;
- quem encaminhou;
- voluntário/involuntário;
- doença mental em familiares;
- motivo da internação segundo família;
- queixa principal segundo paciente;
- aspectos apresentados;
- fatores de risco psicossociais;
- tentativa de suicídio;
- vida sexual;
- histórico forense;
- fatores de início e continuidade do uso de drogas;
- horários preferenciais de uso;
- tabela de drogas utilizadas;
- origem dos recursos para conseguir drogas;
- prejuízos/perdas;
- impacto financeiro;
- impacto social;
- consequências familiares;
- expectativas com o tratamento;
- impressão do triagista;
- psicólogo(a) responsável/carimbo.

Campos obrigatórios definidos inicialmente:

- paciente;
- data de admissão;
- data da entrevista;
- hora da entrevista;
- psicólogo(a) responsável/carimbo.

### 3.3 `ANAMNESE TERAPÊUTICA INICIAL - FLOR DE LOTUS.pdf`

Este PDF possui páginas escaneadas. A extração automática de texto recuperou integralmente apenas a página 3. As páginas 1 e 2 foram analisadas por renderização visual, com limitações de legibilidade principalmente na página 1.

Seções implementadas:

- Cabeçalho;
- Dados pessoais;
- Anamnese inicial;
- Histórico de consumo de substâncias psicoativas;
- Histórico de tratamentos;
- Histórico familiar;
- Histórico social;
- Histórico ocupacional;
- Termo de declaração.

Campos contemplados:

- conselheiro responsável;
- data da anamnese;
- nome;
- data de nascimento;
- idade calculada pela data de nascimento;
- naturalidade;
- UF;
- cidade;
- estado civil;
- profissão;
- tipo de internação;
- convênio;
- necessidade de afastamento pelo INSS;
- relato de uso de substâncias químicas;
- compulsão/dependência em outro comportamento ou substância;
- último uso de substâncias ou comportamentos com prejuízo;
- tabela de consumo de substâncias;
- frequência e quantidade nos últimos 12 meses;
- período de uso durante a vida;
- observações por substância;
- histórico de internação/tratamento;
- quantidade de tratamentos;
- período em tratamento;
- abstinência após tratamento;
- local de tratamento;
- motivo da saída;
- conhecimento do Programa de 12 Passos;
- tratamento psiquiátrico;
- diagnóstico de transtorno mental;
- histórico de recaída;
- tabela familiar por parentesco;
- relação com companheiro(a);
- uso de substância/comportamento transgressor por companheiro(a);
- separação/divórcio por uso de substâncias ou comportamentos prejudiciais;
- relação da família com uso de substâncias;
- abuso de substâncias por membro da família;
- problemas criminais na família;
- apoio familiar;
- referência externa indicada pelo paciente;
- violência/agressividade;
- com quem o paciente mora;
- participação em grupos de mútuo ajuda;
- espiritualidade/religião;
- contato com outros usuários de substâncias psicoativas;
- escolaridade;
- situação de escolaridade;
- vínculo de trabalho;
- origem do sustento;
- ciência/declaração do paciente;
- cidade e data;
- assinatura do paciente;
- assinatura do conselheiro.

Campos obrigatórios definidos inicialmente:

- conselheiro responsável;
- data da anamnese;
- nome;
- data de nascimento;
- nome do paciente para ciência;
- cidade e data;
- assinatura do conselheiro.

---

## 4. O que ainda está faltando

### 4.1 Persistência definitiva

Ainda falta substituir a persistência local/mock por persistência real no backend com PostgreSQL.

Próximos passos sugeridos:

- criar migrations/tabelas para templates e instâncias de anamnese;
- criar repositório de anamnese no backend;
- salvar rascunhos via API;
- finalizar registros via API;
- consultar histórico por paciente;
- preservar snapshot do template usado.

### 4.2 Cadastro real de paciente e atendimento

Atualmente a anamnese armazena os dados do paciente dentro da própria ficha.

Ainda falta integrar com entidades reais de:

- paciente;
- atendimento;
- profissional;
- especialidade;
- local de atendimento;
- prontuário.

### 4.3 Autenticação e permissões

O sistema ainda não possui autenticação real.

Ainda falta implementar:

- login;
- sessão/token;
- usuário logado real;
- vínculo com profissional;
- permissões por módulo;
- permissões para criar, editar, finalizar e consultar anamnese;
- auditoria por usuário.

### 4.4 Auditoria

O escopo geral exige auditoria para registros clínicos e ações críticas.

Ainda falta registrar:

- quem criou a anamnese;
- quem editou;
- data/hora de cada alteração;
- finalização;
- reabertura, se permitida futuramente;
- cancelamento/desativação, se implementado;
- valores anteriores e novos, quando aplicável.

### 4.5 Status clínico completo

Hoje existem apenas os status:

- `draft`;
- `finalized`.

Ainda falta avaliar a necessidade de outros status previstos no escopo, como:

- ativo;
- cancelado;
- inativo;
- reaberto;
- substituído.

### 4.6 Impressão e exportação

Foi adicionada uma ação inicial de impressão pelo navegador na tela de detalhe da anamnese.

Ainda falta transformar essa impressão em um modelo fiel ao documento físico, com paginação e organização visual validada pelo cliente.

Próximos passos possíveis:

- tela de visualização consolidada;
- layout semelhante ao formulário original;
- geração futura de PDF;
- histórico de impressão.

### 4.7 Validações condicionais

Foram implementadas validações obrigatórias básicas.

Ainda falta implementar validações condicionais, por exemplo:

- se respondeu `Sim` para alergia, exigir o campo `Quais`;
- se faz uso de medicamentos, exigir quais medicamentos;
- se já tentou suicídio, permitir detalhamento obrigatório conforme regra clínica;
- se houve internação/tratamento, exigir período/local/motivo;
- se informou uso de substância, exigir frequência/quantidade;
- se tratamento for finalizado, exigir responsável e data;
- regras específicas por perfil profissional.

### 4.8 Motor configurável de fichas

A tela foi implementada com templates em TypeScript.

Ainda falta transformar isso em motor administrável, com:

- cadastro de templates pela interface;
- versionamento de templates;
- ativação/inativação de perguntas;
- ordenação de seções e campos;
- obrigatoriedade configurável;
- snapshot completo do template ao preencher;
- importação/exportação de modelos.

### 4.9 Integração com prontuário/timeline

Ainda falta exibir a anamnese finalizada no prontuário do paciente.

Integrações futuras esperadas:

- timeline clínica;
- cabeçalho clínico do paciente;
- histórico de atendimentos;
- eventos de prontuário;
- documentos clínicos;
- auditoria.

### 4.10 Testes automatizados

Foram executados lint, typecheck, build e checagens HTTP manuais.

Ainda faltam testes automatizados, como:

- testes unitários do renderizador de campos;
- testes de validação de obrigatórios;
- testes de persistência local;
- testes de endpoints Nest.js;
- testes end-to-end do fluxo de preenchimento e finalização.

---

## 5. Observações pendentes sobre os PDFs

### 5.1 Qualidade do PDF terapêutico

O arquivo `ANAMNESE TERAPÊUTICA INICIAL - FLOR DE LOTUS.pdf` não possui texto pesquisável nas páginas 1 e 2.

Impacto:

- parte do conteúdo precisou ser interpretada visualmente;
- alguns campos podem estar incompletos;
- a página 1 apresentou renderização com artefatos visuais na parte superior;
- recomenda-se revisar o formulário implementado contra o PDF original ou fornecer versão com OCR/texto.

### 5.2 Campos potencialmente incompletos da anamnese terapêutica

Após a revisão baseada no prompt complementar, foram adicionados cabeçalho, dados pessoais, anamnese inicial, termo de declaração e campos ocupacionais/familiares ausentes na primeira leitura.

Ainda precisam de revisão manual com o cliente:

- campos da parte superior da página 1;
- textos completos de perguntas antes da tabela de consumo;
- lista completa e exata de substâncias;
- opções de substâncias com nomes compostos;
- campos de recaída;
- campos clínicos ou sociais eventualmente ocultos por baixa legibilidade;
- obrigatoriedade real de cada pergunta.

### 5.3 Obrigatoriedade não explícita nos PDFs

Os PDFs apresentam campos em branco e checkboxes, mas não indicam formalmente quais campos são obrigatórios no sistema.

Na implementação inicial, foram marcados como obrigatórios apenas campos essenciais de identificação, data e responsável técnico.

Recomenda-se validar com o cliente:

- obrigatoriedade por ficha;
- obrigatoriedade por perfil profissional;
- obrigatoriedade para salvar rascunho;
- obrigatoriedade para finalizar;
- campos obrigatórios condicionais.

### 5.4 Terminologia e adequação clínica

Alguns termos foram mantidos próximos aos PDFs, mas podem precisar padronização para uso em sistema:

- `HD`;
- `Usuário(a)`;
- `Drogas utilizadas`;
- `Comportamentos transgressores`;
- `Impressão do triagista`;
- `Anamnese Terapêutica Inicial`;
- `Histórico de recaída`.

Recomenda-se validação com equipe clínica para garantir linguagem adequada, rastreável e juridicamente segura.

### 5.5 Assinaturas

Os PDFs possuem campos de assinatura/carimbo.

Na implementação atual, esses campos são textuais.

Ainda falta definir:

- se assinatura será apenas identificação do profissional logado;
- se haverá assinatura eletrônica simples;
- se haverá assinatura digital certificada;
- se assinatura do paciente será física, digitalizada ou digital;
- se o documento final impresso precisa reproduzir os campos de assinatura.

### 5.6 Dados sensíveis

As fichas contêm informações sensíveis, incluindo:

- saúde mental;
- ideação/tentativa de suicídio;
- sexualidade;
- histórico forense;
- uso de substâncias;
- contexto familiar;
- dados clínicos e de enfermagem.

Antes de uso em produção, é necessário implementar:

- autenticação;
- autorização por perfil;
- controle de acesso no backend;
- auditoria;
- política de retenção;
- proteção adequada de dados conforme LGPD.

---

## 6. Validações já executadas

Foram executadas as seguintes validações técnicas:

```txt
npm.cmd run typecheck --workspace @clinica/web
npm.cmd run lint --workspace @clinica/web
npm.cmd run typecheck --workspace @clinica/api
npm.cmd run build
```

Também foram feitas checagens HTTP locais:

```txt
GET http://localhost:3000/anamnese -> 200 OK
GET http://localhost:3333/api/health -> 200 OK
```

---

## 7. Riscos e pontos de atenção

- A primeira versão ainda não deve ser usada em produção com dados reais sem autenticação, autorização, auditoria e banco persistente.
- O conteúdo da anamnese terapêutica precisa de revisão por causa da baixa qualidade textual do PDF.
- As obrigatoriedades foram definidas de forma conservadora e precisam ser confirmadas pelo cliente.
- O backend está preparado, mas o frontend ainda não consome a API para persistência.
- Não há migração, integração externa, prescrição, agenda, prontuário funcional ou atendimento ambulatorial funcional nesta etapa.
- Existem vulnerabilidades reportadas por `npm audit` na árvore de dependências; não foi executado `npm audit fix --force` para evitar atualizações quebráveis sem validação.

---

## 8. Próxima etapa recomendada

Ordem sugerida para evolução:

1. Revisar com o cliente os campos e obrigatoriedades dos três PDFs.
2. Obter versão com OCR ou imagem mais limpa da Anamnese Terapêutica Inicial.
3. Criar modelo persistente de anamnese no PostgreSQL.
4. Integrar frontend com API para salvar e consultar registros.
5. Implementar autenticação mínima e usuário/profissional responsável.
6. Adicionar auditoria de criação, alteração e finalização.
7. Criar visualização consolidada/impressão da anamnese.
8. Integrar anamnese finalizada à futura timeline do prontuário.