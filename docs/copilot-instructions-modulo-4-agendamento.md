# Copilot Instructions — Módulo 4: Agendamento de Consultas, Exames e Reservas

> Projeto: novo sistema web de prontuário, atendimento e gestão clínica, construído do zero com tecnologias modernas.  
> Este arquivo orienta o GitHub Copilot/Copilot Chat durante o desenvolvimento do **Módulo 4 — Agendamento**.  
> O sistema legado deve ser tratado como **referência funcional**, não como modelo obrigatório de UX/UI.

---

## 1. Contexto geral do Módulo 4

O Módulo 4 contempla o fluxo de **Agendamento de Consultas e Exames**, incluindo:

- Agenda diária de profissionais, salas, especialidades e procedimentos;
- Cadastro e uso de modelos de agendamento/reserva;
- Reserva de salas por modelo e reserva avulsa;
- Inclusão de paciente em horário disponível;
- Agendamento múltiplo;
- Busca de horários disponíveis;
- Confirmação de agendamento;
- Cancelamentos e faltas;
- Bloqueio e desbloqueio de horários;
- Geração/início de atendimento a partir de um agendamento;
- Impressões/documentos vinculados ao agendamento;
- Lembretes por e-mail, SMS, WhatsApp ou URA, se confirmado;
- Configurações gerais da agenda;
- Regras de capacidade, cota, encaixe, reagendamento e retorno.

O Módulo 4 deve se integrar com os módulos anteriores:

- **Módulo 1 — Cadastros Gerais:** usuários, profissionais, especialidades, locais de atendimento, convênios, planos, permissões, permissões operacionais e auditoria.
- **Módulo 2 — Acolhimento:** pacientes, atendimentos, convênio do atendimento, documentos administrativos e criação/encerramento de atendimento.
- **Módulo 3 — Prontuário:** atendimento ambulatorial e prontuário clínico após a efetivação/início do atendimento.

---

## 2. Premissas gerais

### 2.1 O legado é referência funcional

Não copiar cegamente a interface antiga.

A nova agenda deve ser mais clara, moderna e segura, evitando:

- Telas excessivamente densas;
- Janelas modais encadeadas;
- Menus escondidos com ações críticas;
- Ações sem confirmação ou justificativa;
- Status ambíguos;
- Regras executadas apenas no frontend.

Sempre que possível, transformar fluxos do legado em fluxos guiados.

Exemplos:

- “Efetivar” deve ser apresentado como **Registrar chegada**, **Iniciar atendimento** ou **Gerar atendimento**, conforme validação.
- “Transferência” deve ser apresentado como **Reagendar** ou **Transferir horário**.
- “Falta Pac.” deve ser apresentado como **Registrar falta do paciente**.
- “Falta Prof.” deve ser apresentado como **Registrar falta do profissional**.
- “Bloquear Horário” deve ser apresentado como **Bloquear horário da agenda**.
- “Desbloquear Horário” deve ser apresentado como **Desbloquear horário da agenda**.

### 2.2 Backend como fonte da verdade

Toda regra crítica deve ser validada no backend:

- Permissão para criar, editar, cancelar, reagendar, bloquear ou efetivar agendamento;
- Permissão operacional por local, sala ou grupo de sala;
- Conflito de sala;
- Conflito de profissional;
- Capacidade do horário;
- Cota por profissional ou convênio, se usada;
- Disponibilidade do profissional;
- Disponibilidade da sala;
- Bloqueios ativos;
- Status atual do agendamento;
- Atendimento já gerado;
- Paciente duplicado;
- Profissional inativo;
- Convênio/plano inativo;
- Procedimento não permitido no local.

O frontend pode esconder botões e melhorar a experiência, mas não pode ser a única camada de proteção.

### 2.3 Preservar histórico

Agendamentos, cancelamentos, faltas, confirmações, bloqueios e alterações relevantes devem manter histórico.

Não excluir fisicamente registros assistenciais ou operacionais importantes.

Preferir:

- Cancelamento com motivo;
- Soft delete;
- Status explícito;
- Histórico de status;
- Auditoria.

### 2.4 MVP e funcionalidades opcionais

O MVP do Módulo 4 deve priorizar:

- Agenda principal;
- Geração de horários/reservas;
- Inclusão de paciente;
- Busca de paciente;
- Agendamento simples;
- Reagendamento;
- Cancelamento/falta;
- Bloqueio/desbloqueio;
- Busca de horário disponível;
- Integração com criação de atendimento;
- Configurações essenciais.

Funcionalidades avançadas devem ser tratadas como opcionais ou pontos a validar:

- Envio real de SMS;
- Integração WhatsApp/Twilio;
- URA;
- Importação de agenda;
- Guia TISS;
- APAC;
- Faturamento;
- Lista de espera avançada;
- Agenda web;
- Automação de lembretes;
- Confirmação automática por resposta recebida;
- Impressão de pulseira;
- Etiquetas complexas;
- Regras SUS/APAC;
- Integrações externas.

---

## 3. Conceitos principais do domínio

### 3.1 Agenda

A agenda representa a visualização operacional dos horários disponíveis, agendados, bloqueados, cancelados, realizados ou com falta.

Deve permitir visualizar por:

- Data;
- Sala;
- Grupo de sala;
- Profissional;
- Especialidade;
- Procedimento/exame;
- Convênio;
- Status;
- Local de atendimento.

A tela principal do legado exibe:

- Calendário lateral;
- Lista superior de salas/profissionais/especialidades;
- Capacidade e horário final;
- Usuário responsável pela reserva;
- Grade inferior de horários;
- Status do horário;
- Paciente;
- Prontuário;
- Telefone;
- Convênio;
- Observação;
- Origem;
- Responsável pela inclusão;
- Data/hora da inclusão;
- Responsável pelo status;
- Exame/procedimento;
- Responsável pela confirmação.

No sistema novo, recomenda-se organizar isso em uma interface mais limpa:

- Barra de filtros no topo;
- Agenda em grade por horário;
- Cards ou linhas de horários;
- Badges de status;
- Painel lateral de detalhes;
- Ações contextuais condicionadas ao status e permissões.

---

## 4. Status recomendados

### 4.1 Status de slot/horário

```txt
AVAILABLE
BOOKED
CONFIRMED
CHECKED_IN
IN_ATTENDANCE
COMPLETED
CANCELED_BY_PATIENT
CANCELED_BY_PROFESSIONAL
PATIENT_NO_SHOW
PROFESSIONAL_NO_SHOW
BLOCKED
RESCHEDULED
TRANSFERRED
DELETED
```

### 4.2 Mapeamento sugerido com termos do legado

| Legado | Sistema novo recomendado |
|---|---|
| Disponível | Disponível |
| Em aberto | Agendado / Em aberto |
| Aberto | Agendado / Em aberto |
| Realizado | Realizado / Atendimento concluído |
| Cancelado/Falta | Cancelado ou Falta |
| Falta Pac. | Falta do paciente |
| Falta Prof. | Falta do profissional |
| Bloqueado | Bloqueado |
| Efetivar | Registrar chegada / Iniciar atendimento / Gerar atendimento |
| Canc. Efet | Cancelar chegada / Cancelar efetivação |
| Canc. Pac. | Cancelar por paciente |
| Canc. Prof. | Cancelar por profissional |
| Transferência | Reagendamento / Transferência |
| Confirma Agendamento | Confirmar agendamento |

### 4.3 Regras gerais de status

- Horário disponível pode receber agendamento, reserva ou bloqueio.
- Horário bloqueado não pode receber agendamento comum.
- Agendamento cancelado não deve ser excluído fisicamente.
- Falta deve ser registrada com responsável e data/hora.
- Cancelamento deve exigir motivo quando configurado.
- Alteração de motivo do cancelamento deve exigir permissão.
- Agendamento realizado/efetivado não deve ser alterado livremente.
- Atendimento gerado deve criar vínculo claro entre agendamento e atendimento.
- Reagendamento deve preservar origem e histórico do horário anterior.
- Transferência deve ser tratada como reagendamento quando o objetivo for mudar data/hora/sala/profissional.

---

# 5. Backlog consolidado do Módulo 4

---

## Épico 1 — Cadastros base da agenda

### Objetivo

Permitir configurar os recursos necessários para criação e uso da agenda.

### Cadastros observados no legado

Menu **Cadastro** observado:

- Grupo Sala;
- Sala;
- Profissional;
- Grupo de Especialidade;
- Especialidade;
- Modelo de Agendamento;
- Lembrete;
- Local de Encaminhamento;
- Procedimentos por Local de Atendimento;
- Classificação de Lista de Espera;
- Tipo de Bloqueio;
- Exames e Procedimentos Padrão;
- Importações;
- Configuração;
- Trocar Usuário.

### Regras

- Não duplicar cadastros já existentes no Módulo 1.
- Profissionais, especialidades, convênios, planos e locais devem ser reutilizados dos cadastros gerais.
- O Módulo 4 pode criar cadastros próprios apenas quando forem específicos da agenda.
- Cadastros usados historicamente em agendamentos devem preservar snapshot ou descrição histórica quando necessário.
- Itens inativos não devem aparecer para novos agendamentos.
- Não excluir fisicamente cadastros que possuam vínculo com agendamentos.

### Entidades sugeridas

```txt
RoomGroup
Room
SpecialtyGroup
AppointmentProcedure
ProcedureByAttendanceLocation
ReferralLocation
ReminderTemplate
BlockType
AppointmentSettings
```

### Ponto a validar

- Confirmar quais cadastros já existirão no Módulo 1 e quais precisam ser próprios do Módulo 4.
- Confirmar se “Grupo Sala” e “Sala” representam locais físicos, grupos de agenda ou agrupadores de visualização.
- Confirmar se “Classificação de Lista de Espera” entra no MVP.

---

## Épico 2 — Modelo de agendamento / modelo de reserva de sala

### Objetivo

Permitir cadastrar modelos reutilizáveis para gerar reservas/horários da agenda.

### Funcionalidades observadas

- Pesquisar modelo de agendamento;
- Criar modelo;
- Editar modelo;
- Excluir/desativar modelo;
- Listar modelos;
- Cadastrar itens do modelo vinculando sala, profissional, especialidade e horários;
- Usar modelo para gerar reservas em período e dias da semana.

### Campos observados na pesquisa

- Modelo;
- Código;
- Descrição do modelo.

### Ações observadas

- Novo;
- Editar;
- Excluir;
- Listagem;
- Sair.

### Campos observados no cadastro

- Código;
- Descrição;
- Sala;
- CRM;
- Médico/Profissional;
- Especialidade;
- Início;
- Fim.

### Entidades sugeridas

```txt
AppointmentTemplate
AppointmentTemplateItem
```

### Regras

- Modelo deve ter descrição obrigatória.
- Modelo pode conter um ou mais itens.
- Cada item deve definir ao menos sala, profissional ou especialidade, conforme regra validada.
- Horário inicial deve ser menor que horário final.
- Profissional inativo não deve ser usado em novos modelos.
- Sala inativa não deve ser usada em novos modelos.
- Especialidade inativa não deve ser usada em novos modelos.
- Desativar modelo não remove reservas já geradas.
- Alterar modelo não altera automaticamente reservas históricas já criadas, salvo ação explícita futura.
- Gerar reservas a partir de modelo deve validar conflitos.

### Ponto a validar

- Validar se modelo apenas sugere uma configuração ou se gera reservas recorrentes automaticamente.
- Validar se o modelo representa agenda do profissional, agenda da sala, disponibilidade de procedimento ou todos esses conceitos.
- Validar se CRM é apenas campo exibido do profissional ou se deve ser armazenado no item do modelo.
- Validar se deve existir versionamento do modelo.

---

## Épico 3 — Reserva de salas utilizando modelo

### Objetivo

Permitir gerar reservas/horários de agenda a partir de um modelo previamente cadastrado.

### Campos observados

- Período de reserva;
- Data inicial;
- Data final;
- Modelo;
- Dias da semana:
  - Domingo;
  - Segunda;
  - Terça;
  - Quarta;
  - Quinta;
  - Sexta;
  - Sábado;
- Sala;
- Profissional;
- Especialidade;
- Duração;
- Início;
- Fim;
- Lembrete.

### Regras

- Deve ser possível selecionar um período.
- Deve ser possível selecionar os dias da semana.
- O sistema deve gerar horários/reservas conforme itens do modelo.
- Não gerar reserva em datas fora do período.
- Não gerar reserva em dias da semana não selecionados.
- Validar conflitos com reservas existentes.
- Validar conflitos com bloqueios.
- Validar conflitos de sala.
- Validar conflitos de profissional.
- Validar se sala/profissional/especialidade estão ativos.
- Registrar usuário responsável pela geração.
- Registrar data/hora da geração.
- Exibir resumo antes de confirmar geração em massa.
- Evitar duplicidade se o mesmo modelo for aplicado novamente ao mesmo período.

### Entidade sugerida

```txt
RoomReservation
```

### Melhorias recomendadas

Criar fluxo guiado:

1. Escolher modelo.
2. Escolher período.
3. Escolher dias da semana.
4. Pré-visualizar horários que serão gerados.
5. Destacar conflitos.
6. Confirmar geração.
7. Exibir relatório de sucesso, conflitos e ignorados.

### Ponto a validar

- Validar se reservas geradas são slots disponíveis para pacientes ou apenas reserva operacional de sala.
- Validar se duração é derivada de início/fim ou informada manualmente.
- Validar se lembrete é interno, e-mail, SMS, WhatsApp ou outro tipo.

---

## Épico 4 — Reserva de sala avulsa

### Objetivo

Permitir reservar uma sala manualmente, sem usar modelo.

### Campos observados

- Sala;
- Data;
- Hora início;
- Hora fim;
- Profissional;
- Especialidade;
- Duração.

### Regras

- Data obrigatória.
- Sala obrigatória.
- Horário inicial obrigatório.
- Horário final obrigatório.
- Hora início deve ser menor que hora fim.
- Duração pode ser calculada automaticamente.
- Validar conflito de sala.
- Validar conflito de profissional quando informado.
- Permitir profissional e especialidade opcionais apenas se a clínica usar reserva sem profissional.
- Registrar usuário responsável.
- Registrar data/hora de inclusão.
- Permitir cancelar reserva com motivo.
- Reserva cancelada permanece no histórico.

### Ponto a validar

- Confirmar se reserva avulsa pode ser usada para criar horários disponíveis para paciente.
- Confirmar se reserva avulsa pode bloquear a sala para reunião, manutenção ou uso interno.
- Confirmar se deve existir tipo de reserva.

---

## Épico 5 — Agenda principal

### Objetivo

Permitir visualização e operação diária dos horários, reservas e agendamentos.

### Elementos observados

Na tela principal do legado:

- Calendário lateral;
- Data atual selecionada;
- Lista superior de reservas/salas/profissionais;
- Grade inferior de horários;
- Legenda de status;
- Botões de ação;
- Menu contextual por horário/agendamento.

### Colunas observadas na lista superior

- Sala;
- Profissional;
- Especialidade;
- Agendados;
- Capacidade;
- Final;
- Usuário responsável pela reserva.

### Colunas observadas na grade inferior

- Hora;
- Paciente;
- Prontuário;
- Fone;
- Situação;
- Retorno;
- Convênio;
- Início;
- Final;
- Tipo;
- Código/controle;
- Observação do agendamento;
- Origem;
- Responsável pela inclusão;
- Data de inclusão;
- Hora de inclusão;
- Responsável pelo status;
- Exame/procedimento;
- Responsável pela confirmação.

### Regras

- Selecionar uma sala/profissional na lista superior deve carregar os horários correspondentes.
- A agenda deve diferenciar visualmente:
  - disponível;
  - agendado;
  - confirmado;
  - realizado;
  - cancelado;
  - falta;
  - bloqueado.
- Ações disponíveis devem depender do status.
- Ações disponíveis devem depender das permissões do usuário.
- Horários bloqueados não devem aparecer como disponíveis.
- Deve haver filtros por data, sala, profissional, especialidade, convênio e procedimento.
- Deve haver atualização clara após criar, cancelar, bloquear ou efetivar um agendamento.

### Melhorias recomendadas

- Exibir agenda em modo lista e calendário.
- Permitir navegação por dia/semana.
- Usar badges de status.
- Usar painel lateral para detalhe do agendamento.
- Evitar menu contextual como única forma de ação.
- Oferecer botões primários claros para ações principais.

---

## Épico 6 — Inclusão de paciente no agendamento

### Objetivo

Permitir agendar um paciente em um horário disponível.

### Fluxo recomendado

1. Selecionar horário disponível.
2. Buscar paciente.
3. Selecionar paciente existente ou cadastrar paciente resumido, se permitido.
4. Validar duplicidade.
5. Informar convênio/plano/procedimento.
6. Confirmar agendamento.
7. Registrar histórico e auditoria.

### Busca/localização de paciente

Campos observados:

- Nome do paciente;
- Nome social;
- Prontuário;
- Registro;
- Cartão Nacional de Saúde (CNS);
- Data de nascimento;
- Código do paciente no convênio;
- CPF;
- Nome da mãe;
- Código no município;
- Apresentar cancelados.

Colunas observadas nos resultados:

- Registro;
- Prontuário;
- Nome do paciente;
- Data de nascimento;
- Nome social.

### Inclusão de paciente

Campos observados:

- Horário;
- Sala;
- Profissional;
- Registro;
- Paciente;
- Localização do prontuário;
- Origem;
- Observação do agendamento;
- Data de nascimento;
- Idade;
- Telefone;
- Celular;
- Local de atendimento;
- Convênio;
- Plano;
- Condição;
- Nome do segurado;
- Exame/procedimento principal;
- Quantidade;
- Tipo do agendamento:
  - Agendado;
  - Encaixe agendado;
  - Reagendado.
- Tipo de consulta:
  - Primeira consulta;
  - Retorno;
  - Pré-natal;
  - Por encaminhamento.
- Observação;
- Diagnóstico;
- Histórico de agendamentos.

### Regras

- Não permitir agendamento sem paciente, salvo reserva/bloqueio.
- Se paciente não existir, permitir cadastro resumido apenas se configuração permitir.
- Validar duplicidade antes de criar novo paciente.
- Convênio/plano devem vir de cadastros ativos.
- Procedimento/exame deve ser compatível com local e agenda, se configurado.
- Horário deve continuar disponível no momento da confirmação.
- Agendamento deve salvar snapshot mínimo dos dados relevantes.
- Agendamento deve registrar usuário responsável pela inclusão.
- Agendamento deve registrar origem.
- Agendamento deve registrar data/hora da inclusão.
- Histórico de agendamentos do paciente deve ser visível durante a inclusão.

### Ponto a validar

- Validar quais campos são obrigatórios para agendar.
- Validar se diagnóstico é necessário no agendamento ou apenas no atendimento/prontuário.
- Validar se cadastro resumido de paciente será permitido no MVP.
- Validar regra para paciente com agendamento ativo no mesmo procedimento/data.
- Validar se paciente cancelado/inativo pode ser apresentado e em quais casos.

---

## Épico 7 — Cadastro resumido de paciente no agendamento

### Objetivo

Permitir cadastrar rapidamente um paciente durante o agendamento, quando autorizado.

### Campos observados

- Registro;
- Paciente;
- Prontuário;
- Nome social;
- Convênio;
- Plano;
- Código no convênio;
- Sexo;
- Estado;
- Município;
- CEP;
- Bairro;
- Logradouro;
- Número;
- Complemento;
- Rua;
- Fone 1;
- Fone 2;
- Celular;
- E-mail;
- Data de nascimento;
- Idade;
- Estado natal;
- Cidade natal;
- Nacionalidade;
- Estado civil;
- Filhos;
- Nome do pai;
- Nome da mãe;
- Raça/cor;
- Grau de instrução;
- Religião;
- Aceita visita religiosa;
- Profissão;
- Ocupação/cargo;
- Observação;
- Localização do prontuário.

### Regras

- Cadastro resumido deve reutilizar as regras do Módulo 2.
- CPF e CNS devem ser validados quando informados.
- Dados sensíveis exigem permissão.
- O sistema deve sinalizar possíveis duplicidades.
- O cadastro resumido deve poder ser complementado posteriormente.
- Alterações devem ser auditadas.

### Ponto a validar

- Confirmar conjunto mínimo obrigatório.
- Confirmar se convênio/plano deve ficar no cadastro do paciente ou somente no agendamento/atendimento.
- Confirmar se dados como religião e aceita visita religiosa fazem parte do MVP.

---

## Épico 8 — Agendamento múltiplo

### Objetivo

Permitir selecionar múltiplos horários para um mesmo paciente, profissional, especialidade ou procedimento.

### Funcionalidades observadas

- Abrir tela de agendamento múltiplo.
- Pesquisar horários por período.
- Filtrar por especialidade.
- Filtrar por sala.
- Filtrar por profissional.
- Filtrar por exame/procedimento principal.
- Visualizar próximos horários vagos.
- Selecionar vários horários.
- Remover horário selecionado.
- Agendar horários selecionados.
- Preencher informações adicionais para todos os horários selecionados.

### Campos observados na pesquisa

- Período;
- Especialidade;
- Sala;
- Profissional;
- Exame/procedimento principal.

### Grade de horários vagos

- Data;
- Hora;
- Sala;
- Dia da semana.

### Grade de horários selecionados

- Data;
- Hora;
- Profissional;
- Procedimento/exame.

### Informações adicionais observadas

- Registro;
- Paciente;
- Convênio;
- Plano;
- Condição;
- Nome do segurado;
- Tipo do agendamento:
  - Agendado;
  - Encaixe agendado;
  - Reagendado.
- Protocolo;
- Ano protocolo;
- Tipo de consulta:
  - Primeira consulta;
  - Retorno;
  - Pré-natal;
  - Por encaminhamento.
- Observação.

### Regras

- Validar disponibilidade de todos os horários selecionados no momento da confirmação.
- Se algum horário estiver indisponível, informar claramente e permitir continuar com os demais.
- Evitar duplicidade de horários.
- Agendamentos múltiplos devem ser criados individualmente, mas vinculados por um agrupador.
- Cancelar um item não deve cancelar automaticamente todos, salvo ação específica.
- Deve existir histórico e auditoria para cada item.
- Dados comuns podem ser replicados para todos os horários selecionados.
- Permitir revisão antes de confirmar.

### Entidades sugeridas

```txt
AppointmentBatch
Appointment
```

### Ponto a validar

- Validar se agendamento múltiplo é usado para recorrência, vários exames, agenda seriada ou todos esses casos.
- Validar se deve existir limite máximo de horários selecionados.
- Validar se protocolo/ano protocolo são necessários no MVP.

---

## Épico 9 — Busca de horário disponível

### Objetivo

Permitir localizar horários vagos rapidamente.

### Funcionalidades observadas

- Hora vaga;
- Dias reservados;
- Hora vaga por especialidade;
- Próximo horário;
- Pesquisa por período, profissional, especialidade, convênio, sala e procedimento.

### Tela “Dias Reservados”

Campos observados:

- Profissional;
- Especialidade.

Grade observada:

- Data;
- Sala;
- Início;
- Final;
- Capacidade;
- Agendados;
- Agendamento;
- Limite.

### Tela “Hora vaga por especialidade”

Campos observados:

- Período;
- Especialidade.

Grade observada:

- Data;
- Hora;
- Sala;
- Profissional.

### Tela “Próximo horário”

Campos observados:

- Período;
- Profissional;
- Especialidade;
- Convênio.

Grade observada:

- Data;
- Hora;
- Sala;
- Dia da semana.

### Regras

- Horário vago deve considerar:
  - disponibilidade da sala;
  - disponibilidade do profissional;
  - bloqueios;
  - reservas;
  - capacidade;
  - status dos agendamentos;
  - convênio, se houver regra;
  - procedimento/exame, se houver regra;
  - permissões operacionais do usuário.
- Horário cancelado pode voltar a ficar disponível se a regra permitir.
- Horário com falta não deve ser automaticamente considerado disponível sem validação.
- Horário bloqueado nunca deve ser exibido como disponível.
- A busca deve retornar resultados paginados ou limitados.
- O usuário deve poder agendar diretamente a partir de um horário encontrado.

### Ponto a validar

- Diferença exata entre “Hora Vaga”, “Dias Reservados” e “Hora Vaga por Especialidade”.
- Se “Dias Reservados” representa agenda parametrizada, reservas já geradas ou limites de agenda.
- Como são calculados os campos Capacidade, Agendados, Agendamento e Limite.
- Se a busca precisa considerar feriados.

---

## Épico 10 — Confirmação de agendamento

### Objetivo

Registrar confirmação manual do agendamento, com observação.

### Funcionalidades observadas

- Confirmar agendamento;
- Informar observação;
- Registrar confirmação;
- Exibir responsável pela confirmação na agenda.

### Campos observados

- Identificação do agendamento;
- Observação.

### Regras

- Apenas agendamentos em aberto devem poder ser confirmados.
- Confirmação deve registrar:
  - usuário;
  - data/hora;
  - observação;
  - canal, se aplicável.
- Confirmar agendamento não deve gerar atendimento automaticamente.
- Confirmação deve ser exibida na agenda.
- Deve ser possível visualizar histórico de confirmações.

### Ponto a validar

- Validar se confirmação pode ser feita por resposta de SMS/WhatsApp/URA.
- Validar se agendamento confirmado pode ser cancelado normalmente.
- Validar se confirmação altera status ou apenas registra informação adicional.

---

## Épico 11 — Cancelamento, falta e alteração de motivo

### Objetivo

Permitir cancelar agendamentos ou registrar falta de paciente/profissional de forma controlada.

### Ações observadas

- Cancelar paciente;
- Cancelar profissional;
- Falta paciente;
- Falta profissional;
- Alterar motivo do cancelamento;
- Cancelar cancelamento/falta;
- Cancelar efetivação.

### Modal observado

Campos:

- Motivo do cancelamento;
- Observação para cancelamento/falta.

### Regras

- Cancelamento deve exigir motivo quando configurado.
- Falta deve exigir motivo ou observação quando configurado.
- Cancelamento/falta deve registrar usuário e data/hora.
- Alterar motivo deve exigir permissão especial.
- Cancelar cancelamento/falta deve exigir permissão especial e justificativa.
- Agendamento cancelado/falta deve permanecer no histórico.
- Cancelamento deve liberar o horário apenas se a regra permitir.
- Cancelamento de agendamento com atendimento gerado deve ser bloqueado ou seguir fluxo específico.
- Cancelamento pelo paciente e pelo profissional devem ser diferenciados.
- Falta do paciente e falta do profissional devem ser diferenciadas.

### Entidades sugeridas

```txt
AppointmentCancellationReason
AppointmentStatusHistory
```

### Ponto a validar

- Validar se os motivos são cadastráveis.
- Validar se cancelamento/falta pode ser revertido.
- Validar se cancelamento deve enviar lembrete/notificação.
- Validar se falta impacta alertas futuros de paciente com faltas.

---

## Épico 12 — Reagendamento / transferência

### Objetivo

Permitir mover um agendamento para outro horário, preservando histórico.

### Funcionalidades observadas

- Transferência;
- Reagendado como tipo de agendamento;
- Busca de próximo horário;
- Seleção de novo horário.

### Regras

- Reagendamento deve manter vínculo com o agendamento original.
- O horário original deve ser marcado como reagendado/transferido ou cancelado por transferência, conforme regra validada.
- O novo horário deve receber novo agendamento.
- Histórico deve indicar:
  - agendamento original;
  - novo agendamento;
  - usuário responsável;
  - data/hora;
  - motivo/observação.
- Validar disponibilidade do novo horário.
- Não permitir reagendar agendamento realizado sem permissão especial.
- Não permitir reagendar agendamento com atendimento gerado sem regra específica.

### Entidades sugeridas

```txt
AppointmentRescheduleHistory
```

### Ponto a validar

- Validar se “Transferência” pode transferir apenas data/hora ou também sala/profissional/procedimento.
- Validar se reagendamento mantém o mesmo código ou cria novo agendamento.
- Validar se reagendamento deve contar para estatísticas de cancelamento.

---

## Épico 13 — Efetivação / geração de atendimento

### Objetivo

Criar ou iniciar atendimento a partir do agendamento.

### Funcionalidades observadas

- Efetivar;
- Cancelar efetivação;
- Dados para geração do atendimento;
- Separar guia de consulta na geração do atendimento;
- Configuração de tolerância para efetivar agendamentos.

### Dados observados para geração do atendimento

Dados do paciente:

- Registro;
- Nome;
- Telefones;
- Celular;
- CEP;
- Município;
- RG;
- Emissão do RG;
- UF emissor;
- Local de trabalho;
- Tipo do documento;
- Número do documento;
- Cartão Nacional de Saúde;
- Código no HYGIA.

Dados do convênio/atendimento:

- Convênio;
- Plano;
- Número da carteirinha;
- Validade da carteirinha;
- Número da guia;
- Emissão da guia;
- Senha;
- Tipo do documento;
- Número do documento responsável;
- Nome do responsável;
- Local de atendimento;
- Origem do atendimento;
- Encaminhado por;
- CID principal;
- Procedimento CIHA;
- Descrição procedimento CIHA genérico;
- Patologia;
- Diagnóstico;
- Profissional executante;
- Profissional solicitante;
- Solicitante externo;
- Código;
- Nome solicitante;
- Especialidade.

### Regras

- Efetivar deve criar ou vincular atendimento no Módulo 2.
- Efetivação deve validar se o agendamento está em status permitido.
- Efetivação deve validar se o paciente está cadastrado corretamente.
- Efetivação deve validar local de atendimento.
- Efetivação deve validar convênio/plano quando obrigatório.
- Efetivação deve registrar usuário, data/hora e origem.
- Cancelar efetivação deve exigir permissão e justificativa.
- Efetivação não deve ser confundida com confirmação.
- Depois de gerado atendimento, o agendamento deve exibir vínculo com atendimento.
- Atendimento gerado deve preservar snapshot dos dados relevantes do agendamento.

### Ponto a validar

- Validar o nome correto do fluxo no sistema novo: “Registrar chegada”, “Iniciar atendimento” ou “Gerar atendimento”.
- Validar se efetivação usa data/hora do agendamento ou data/hora da efetivação.
- Validar regra de tolerância para efetivar agendamentos.
- Validar quais campos da tela de geração do atendimento são realmente obrigatórios.
- Validar se TISS, CIHA, APAC e faturamento entram ou ficam fora do MVP.

---

## Épico 14 — Bloqueio e desbloqueio de horário

### Objetivo

Permitir bloquear horários da agenda para impedir agendamento.

### Funcionalidades observadas

- Bloquear horário;
- Desbloquear horário;
- Informar observação do bloqueio;
- Exibir horário bloqueado na agenda.

### Modal observado

- Título: Bloqueio — Observação do Agendamento;
- Campo de observação;
- Botões OK e Cancelar.

### Regras

- Bloqueio deve ser permitido apenas em horário disponível, salvo regra diferente validada.
- Bloqueio deve exigir motivo ou observação se configurado.
- Horário bloqueado não deve aceitar agendamento comum.
- Desbloqueio deve registrar usuário e data/hora.
- Desbloqueio pode exigir justificativa.
- Bloqueio deve aparecer nas buscas de disponibilidade como indisponível.
- Bloqueio deve aparecer na agenda com status próprio.
- Bloqueio deve gerar auditoria.
- Bloqueio deve respeitar permissões.

### Entidades sugeridas

```txt
ScheduleBlock
BlockType
ScheduleBlockHistory
```

### Ponto a validar

- Validar se bloqueio afeta sala, profissional, especialidade ou apenas o slot selecionado.
- Validar se bloqueio pode ser feito em lote.
- Validar se bloqueio pode ser recorrente.
- Validar se desbloqueio reabre o horário automaticamente para agendamento.

---

## Épico 15 — Alteração de observação e procedimento

### Objetivo

Permitir ajustar informações não críticas de um agendamento, com controle.

### Ações observadas

- Alterar observação do agendamento;
- Alterar procedimento.

### Regras

- Alterar observação deve registrar histórico.
- Alterar procedimento deve validar compatibilidade com sala, profissional, especialidade, local e convênio, se aplicável.
- Alterar procedimento em agendamento efetivado deve ser bloqueado ou exigir permissão especial.
- Alterações devem ser auditadas.

### Ponto a validar

- Validar se alteração de procedimento muda duração/capacidade.
- Validar se alteração de procedimento exige nova confirmação do paciente.
- Validar se alteração de observação pode ocorrer após atendimento gerado.

---

## Épico 16 — Impressões e documentos do agendamento

### Objetivo

Permitir emitir documentos relacionados ao agendamento, quando confirmado no escopo.

### Opções observadas

- Imprime Comprovante;
- Imprime Guia TISS;
- Imprime Etiquetas de Atendimento;
- Imprimir Pulseira de Identificação;
- Impressão do Preparo para o exame;
- Documentos.

### Regras

- Impressões devem ser registradas em histórico quando relevantes.
- Reimpressão deve ser auditada para documentos sensíveis.
- Comprovante pode ser gerado após agendamento, se configurado.
- Guia TISS deve ser tratada como fora do MVP salvo confirmação.
- Pulseira de identificação deve ser tratada como opcional e relacionada ao atendimento/acolhimento.
- Preparo para exame depende de procedimento/exame configurado.
- Documentos devem usar templates quando possível.

### Entidades sugeridas

```txt
AppointmentDocument
AppointmentPrintHistory
ExamPreparationInstruction
```

### Ponto a validar

- Confirmar quais impressões entram no MVP.
- Confirmar se comprovante deve ser impresso automaticamente após inclusão.
- Confirmar se preparo do exame é texto cadastrado por procedimento.
- Confirmar se Guia TISS será implementada ou apenas prevista.

---

## Épico 17 — Lembretes por e-mail, SMS, WhatsApp e URA

### Objetivo

Permitir gerenciar lembretes de agendamentos, se confirmado pelo cliente.

### Funcionalidades observadas

- Acessar tela E-mail/SMS/URA com lembrete.
- Selecionar data do agendamento.
- Selecionar grupo de sala.
- Pesquisar reservas/agendamentos.
- Escolher canal:
  - E-mail;
  - SMS;
  - URA;
  - WhatsApp.
- Visualizar reservas de sala.
- Visualizar agendamentos em aberto.
- Selecionar todos os agendamentos com e-mail ou telefone.
- Destacar pacientes sem e-mail ou sem telefone.
- Exibir último envio.
- Visualizar respostas WhatsApp/SMS.
- Confirmar ou cancelar agendamento a partir de resposta recebida.

### Campos observados na tela de envio

Reservas de sala:

- Sala;
- Profissional;
- Especialidade;
- Início;
- Final.

Agendamentos em aberto:

- Hora;
- Paciente;
- Prontuário;
- Convênio;
- E-mail;
- Celular;
- Telefone 1;
- Telefone 2;
- Último envio.

### Tela de pendência SMS/WhatsApp

Campos observados:

- Data;
- Hora;
- Confirma;
- Paciente;
- Fone;
- Resposta.

Ações observadas:

- Confirmar agendamento;
- Cancelar agendamento;
- Sair.

### Configuração de mensagens

Campos observados:

- Usuário;
- Senha;
- URL;
- Remetente;
- Total de caracteres para envio de SMS;
- Número de horas de antecedência do agendamento para envio automático de SMS;
- Tags disponíveis:
  - `<PrimeiroNome>`;
  - `<DataDoAgendamento>`;
  - `<HorárioAgendamento>`;
  - `<Profissional>`;
  - `<Especialidade>`.
- Mensagem padrão de lembrete;
- Minutos adicionais à hora do contato para pesquisa;
- Apresentar horários disponíveis em dias diferentes;
- Integração WhatsApp:
  - Não integrado;
  - WhatsApp;
  - Twilio.
- Mensagens adicionais por:
  - Procedimento padrão;
  - Tipo de serviço.

### Regras

- Envio real depende de integração externa e deve ser tratado como opcional.
- Deve haver histórico de envio.
- Histórico deve registrar:
  - canal;
  - destinatário;
  - mensagem;
  - status;
  - usuário;
  - data/hora;
  - resposta, se houver.
- Paciente sem contato válido deve ser destacado.
- Envio deve respeitar consentimento LGPD, se aplicável.
- Não enviar lembrete para agendamento cancelado, realizado ou com falta.
- Resposta de confirmação/cancelamento deve ser auditada.
- Templates devem validar placeholders.
- Mensagens específicas por procedimento/tipo de serviço podem sobrescrever mensagem padrão.

### Entidades sugeridas

```txt
AppointmentReminder
AppointmentReminderTemplate
AppointmentReminderDelivery
AppointmentReminderResponse
AppointmentReminderChannelConfig
```

### Ponto a validar

- Confirmar se SMS, WhatsApp, URA e Twilio entram no MVP.
- Confirmar se haverá envio automático ou apenas manual.
- Confirmar se o sistema precisa processar resposta recebida.
- Confirmar se confirmação/cancelamento por resposta é juridicamente aceito pela clínica.
- Confirmar se haverá opt-in/consentimento do paciente.

---

## Épico 18 — Configurações gerais da agenda

### Objetivo

Permitir parametrizar regras operacionais da agenda.

### Configurações observadas

Aba **Configuração**:

- Exibe convênio no agendamento;
- Gera informação para o faturamento;
- Convênio a ser usado na importação da agenda;
- Imprime comprovante após inclusão do agendamento;
- Imprime comprovante em matrícula;
- Cabeçalho do comprovante;
- Mensagem;
- Endereço;
- Rodapé;
- Número de dias de tolerância para efetivar agendamentos;
- Número de meses para apresentação do histórico de atendimento;
- Controla agendamento acima da capacidade;
- Obriga usuário a digitar pelo menos um telefone válido para o agendamento;
- Permite agendamento somente com profissionais do corpo clínico;
- Permite agendamento com cadastro resumido;
- Modelo de etiqueta matricial;
- Permite inclusão de agendamento se horário já ocupado;
- Para pacientes SUS Ambulatorial/APAC dar baixa na lista de espera considerando atendimento/procedimento faturado;
- Na efetivação, incluir atendimento com:
  - data/hora do agendamento;
  - data/hora da efetivação.
- No cancelamento de um agendamento é obrigatório informar o motivo de cancelamento;
- Separar guia de consulta na geração do atendimento;
- Controle de cota de agendamento:
  - por médico/profissional;
  - por convênio.
- Número de dias para apresentação dos exames prescritos para agendamento;
- Procedimento para agendamento através de URA;
- Motivo de cancelamento para desmarcar agendamento através de URA;
- Não permitir agendamento quando há outros agendamentos em aberto para o paciente no período de retorno;
- Lista de espera: obrigatório preencher local de encaminhamento;
- No agendamento: verificar se paciente está na lista de espera para procedimento;
- Apresentar mensagem de alerta no agendamento para pacientes com faltas a partir de certa quantidade de meses;
- Para agendamento web: apresentar horários disponíveis a partir de quantos dias considerando o dia do acesso;
- Para agendamentos SUS: consistir se o CID informado é compatível com o procedimento;
- Solicitar executante para procedimento de todos os tipos.

Aba **E-mail/SMS/WhatsApp**:

- Usuário;
- Senha;
- URL;
- Remetente;
- Total de caracteres;
- Antecedência para envio automático;
- Tags de mensagem;
- Mensagem padrão;
- URA;
- Integração WhatsApp/Twilio;
- Mensagens adicionais por procedimento/tipo de serviço.

Outras abas observadas:

- Impressões;
- Log de alterações.

### Regras

- Configurações devem ser alteradas apenas por usuário autorizado.
- Alterações em configurações críticas devem ser auditadas.
- Configurações devem ter valores padrão seguros.
- Integrações externas devem poder ficar desativadas.
- Senhas/tokens devem ser armazenados de forma segura.
- O backend deve centralizar leitura das configurações.
- Alterações devem ter efeito previsível e documentado.

### Entidade sugerida

```txt
AppointmentSettings
```

### Ponto a validar

- Validar quais configurações entram no MVP.
- Validar se faturamento, APAC, TISS e SUS entram ou ficam fora.
- Validar se importação de agenda será implementada.
- Validar se agenda web será implementada.
- Validar se lista de espera entra no Módulo 4 ou em módulo futuro.

---

## Épico 19 — Cotas, capacidade e limites

### Objetivo

Controlar capacidade e limites de agendamento quando a clínica utilizar essa regra.

### Elementos observados

- Capacidade;
- Agendados;
- Agendamento;
- Limite;
- Controle de cota por médico/profissional;
- Controle de cota por convênio;
- Permitir ou bloquear agendamento acima da capacidade.

### Regras

- A capacidade define o limite esperado de agendamentos em um intervalo ou agenda.
- Agendados representa a quantidade já ocupada.
- Limite pode ser diferente da capacidade, conforme regra validada.
- Se controlar acima da capacidade, bloquear ou alertar ao exceder limite.
- Se permitir inclusão em horário já ocupado, registrar como encaixe ou múltiplo no mesmo horário.
- Cota por convênio deve limitar número de agendamentos por convênio em determinada agenda/período.
- Cota por profissional deve limitar número de agendamentos por profissional em determinada agenda/período.
- Excesso de capacidade deve exigir permissão especial, se permitido.

### Ponto a validar

- Definir fórmula exata de capacidade/limite.
- Validar se cota é diária, por horário, por agenda, por profissional, por convênio ou por procedimento.
- Validar se encaixe conta na capacidade.
- Validar se cancelados/faltas contam no limite.

---

## Épico 20 — Lista de espera

### Objetivo

Prever integração com lista de espera, se confirmada.

### Elementos observados

- Classificação de lista de espera;
- Obrigatório preencher local de encaminhamento;
- Verificar se paciente está na lista de espera para procedimento;
- Baixar lista de espera considerando atendimento/procedimento faturado.

### Regras sugeridas

- Lista de espera deve ser tratada como funcionalidade opcional no MVP.
- Se usada, deve permitir vínculo com paciente, procedimento, especialidade, local e prioridade/classificação.
- Ao agendar paciente da lista, registrar vínculo com entrada da lista.
- Não implementar baixa por faturamento sem validação explícita.

### Ponto a validar

- Confirmar se lista de espera entra no escopo inicial.
- Confirmar se baixa da lista ocorre ao agendar, efetivar, atender ou faturar.
- Confirmar regras de prioridade/classificação.

---

## Épico 21 — Logs e auditoria da agenda

### Objetivo

Garantir rastreabilidade das ações críticas da agenda.

### Auditar no mínimo

- Criação de reserva;
- Alteração de reserva;
- Cancelamento de reserva;
- Criação de modelo;
- Alteração de modelo;
- Desativação de modelo;
- Geração de horários por modelo;
- Inclusão de paciente em agendamento;
- Cadastro resumido de paciente;
- Alteração de paciente do agendamento;
- Alteração de procedimento;
- Alteração de observação;
- Confirmação;
- Cancelamento;
- Alteração de motivo de cancelamento;
- Falta do paciente;
- Falta do profissional;
- Reversão de cancelamento/falta;
- Reagendamento/transferência;
- Efetivação/geração de atendimento;
- Cancelamento de efetivação;
- Bloqueio;
- Desbloqueio;
- Impressão/reimpressão relevante;
- Envio de lembrete;
- Resposta de SMS/WhatsApp/URA;
- Alteração de configurações.

### Campos mínimos de auditoria

- Entidade;
- ID da entidade;
- Ação;
- Usuário;
- Data/hora;
- Valores anteriores;
- Valores novos;
- Motivo/justificativa;
- IP/user-agent, se disponível.

### Entidades sugeridas

```txt
AppointmentAuditLog
AppointmentStatusHistory
AppointmentChangeHistory
```

---

# 6. Permissões sugeridas

```txt
appointments.read
appointments.create
appointments.update
appointments.cancel
appointments.cancel_by_patient
appointments.cancel_by_professional
appointments.register_patient_no_show
appointments.register_professional_no_show
appointments.revert_cancellation_or_no_show
appointments.reschedule
appointments.confirm
appointments.check_in
appointments.cancel_check_in
appointments.generate_attendance
appointments.change_procedure
appointments.change_observation
appointments.view_history
appointments.print

appointment_slots.read
appointment_slots.create
appointment_slots.block
appointment_slots.unblock
appointment_slots.manage_capacity

appointment_templates.read
appointment_templates.create
appointment_templates.update
appointment_templates.deactivate
appointment_templates.generate_reservations

room_reservations.read
room_reservations.create
room_reservations.update
room_reservations.cancel

appointment_reminders.read
appointment_reminders.send
appointment_reminders.manage_templates
appointment_reminders.manage_responses
appointment_reminders.manage_settings

appointment_settings.read
appointment_settings.update

appointment_reports.read
appointment_imports.manage

waiting_list.read
waiting_list.manage
waiting_list.schedule_patient

admin.full_access
operational_access.all
```

### Permissões operacionais

Além das permissões de ação, validar acesso por recurso:

- Local de atendimento;
- Grupo de sala;
- Sala;
- Profissional, se aplicável;
- Especialidade, se aplicável;
- Tipo de serviço/procedimento, se aplicável.

Exemplo conceitual:

```ts
requirePermission('appointments.create')
requireOperationalAccess('attendance_location', attendanceLocationId)
requireOperationalAccess('room_group', roomGroupId)
```

---

# 7. Entidades sugeridas

## 7.1 Agenda e reservas

```txt
AppointmentTemplate
AppointmentTemplateItem
RoomReservation
RoomReservationOccurrence
AppointmentSlot
ScheduleBlock
BlockType
```

## 7.2 Agendamento

```txt
Appointment
AppointmentStatusHistory
AppointmentCancellationReason
AppointmentRescheduleHistory
AppointmentBatch
AppointmentProcedureSnapshot
AppointmentAttendanceLink
```

## 7.3 Paciente e atendimento

Reutilizar entidades dos Módulos 2 e 3:

```txt
Patient
Attendance
PatientInsurance
```

## 7.4 Lembretes

```txt
AppointmentReminderTemplate
AppointmentReminderDelivery
AppointmentReminderResponse
AppointmentReminderChannelConfig
```

## 7.5 Configurações e auditoria

```txt
AppointmentSettings
AppointmentAuditLog
AppointmentPrintHistory
```

---

# 8. Campos sugeridos por entidade

## 8.1 Appointment

```txt
id
patient_id
attendance_id
room_id
room_group_id
professional_id
specialty_id
procedure_id
attendance_location_id
insurance_id
insurance_plan_id
date
start_time
end_time
status
appointment_type
consultation_type
origin
observation
diagnosis
quantity
is_return
is_walk_in
is_rescheduled
created_by
created_at
updated_by
updated_at
canceled_by
canceled_at
cancellation_reason_id
cancellation_note
confirmed_by
confirmed_at
confirmation_note
checked_in_by
checked_in_at
completed_at
```

## 8.2 AppointmentSlot

```txt
id
room_id
professional_id
specialty_id
procedure_id
date
start_time
end_time
capacity
booked_count
status
source
source_template_id
source_reservation_id
created_by
created_at
```

## 8.3 ScheduleBlock

```txt
id
slot_id
room_id
professional_id
specialty_id
date
start_time
end_time
block_type_id
note
status
created_by
created_at
unblocked_by
unblocked_at
unblock_reason
```

## 8.4 AppointmentReminderDelivery

```txt
id
appointment_id
channel
recipient
message
status
provider
provider_message_id
sent_by
sent_at
last_error
response_received_at
response_content
```

---

# 9. APIs sugeridas

## 9.1 Modelos

```txt
GET    /appointment-templates
POST   /appointment-templates
GET    /appointment-templates/:id
PATCH  /appointment-templates/:id
DELETE /appointment-templates/:id
POST   /appointment-templates/:id/generate-reservations
```

## 9.2 Agenda e disponibilidade

```txt
GET    /appointments/calendar
GET    /appointments/available-slots
GET    /appointments/reserved-days
GET    /appointments/next-available
POST   /appointment-slots/block
POST   /appointment-slots/:id/unblock
```

## 9.3 Agendamentos

```txt
POST   /appointments
POST   /appointments/batch
GET    /appointments/:id
PATCH  /appointments/:id
POST   /appointments/:id/confirm
POST   /appointments/:id/cancel
POST   /appointments/:id/no-show
POST   /appointments/:id/revert-cancellation
POST   /appointments/:id/reschedule
POST   /appointments/:id/check-in
POST   /appointments/:id/cancel-check-in
POST   /appointments/:id/generate-attendance
POST   /appointments/:id/change-procedure
POST   /appointments/:id/change-observation
GET    /appointments/:id/history
```

## 9.4 Lembretes

```txt
GET    /appointment-reminders
POST   /appointment-reminders/send
GET    /appointment-reminders/responses
POST   /appointment-reminders/responses/:id/confirm-appointment
POST   /appointment-reminders/responses/:id/cancel-appointment
```

## 9.5 Configurações

```txt
GET    /appointment-settings
PATCH  /appointment-settings
```

---

# 10. Regras técnicas gerais

## 10.1 Backend

Ao gerar código backend:

- Usar TypeScript.
- Separar módulos por domínio.
- Validar entrada com DTO/schema.
- Validar permissões no backend.
- Usar transações em operações críticas.
- Garantir consistência em agendamento, reagendamento, bloqueio e efetivação.
- Usar paginação em pesquisas.
- Usar filtros em listagens.
- Registrar auditoria.
- Evitar exclusão física.
- Não expor tokens/senhas de integração.
- Não permitir alteração silenciosa de status.
- Retornar mensagens claras de erro.

### Exemplos de erros úteis

```txt
Este horário não está mais disponível.
Este profissional já possui agendamento neste horário.
Esta sala já está reservada neste período.
O horário está bloqueado e não pode receber agendamento.
O agendamento já foi cancelado.
O agendamento já possui atendimento gerado.
Informe o motivo do cancelamento.
O usuário não possui permissão para agendar neste local.
```

## 10.2 Frontend

Ao gerar código frontend:

- Usar React com TypeScript.
- Usar componentes reutilizáveis.
- Separar agenda, filtros, grade e detalhes.
- Usar estados de loading, erro e vazio.
- Usar feedback de sucesso/erro.
- Usar confirmações para ações críticas.
- Usar badges de status.
- Usar selects pesquisáveis.
- Usar painel lateral ou modal claro para detalhes.
- Evitar telas gigantes e poluídas.
- Não depender apenas do menu de contexto.
- Usar componentes `Can` ou `usePermission` para autorização visual.
- Exibir mensagens preventivas antes de bloqueios definitivos.

### Layout recomendado

- Cabeçalho com filtros:
  - Data;
  - Local;
  - Grupo de sala;
  - Sala;
  - Profissional;
  - Especialidade;
  - Procedimento;
  - Convênio;
  - Status.
- Grade de horários.
- Painel lateral do agendamento selecionado.
- Botões de ação conforme status.
- Legenda de status.

---

# 11. Integrações com outros módulos

## 11.1 Com Módulo 1

Consumir:

- Usuários;
- Permissões;
- Permissões operacionais;
- Profissionais;
- Especialidades;
- Locais de atendimento;
- Convênios;
- Planos;
- Grupos de salas;
- Salas;
- Tipos de serviço;
- Procedimentos;
- Auditoria.

## 11.2 Com Módulo 2

Consumir/criar:

- Paciente;
- Cadastro resumido de paciente;
- Atendimento;
- Convênio do atendimento;
- Documentos administrativos;
- Histórico de atendimentos.

## 11.3 Com Módulo 3

Após atendimento gerado:

- Permitir abrir prontuário;
- Permitir iniciar atendimento ambulatorial;
- Exibir vínculo com consulta/agenda;
- Preservar origem do atendimento.

---

# 12. Observações e pontos a validar

## 12.1 Fluxos e nomenclatura

- Diferença exata entre confirmar, efetivar, realizar, iniciar atendimento e gerar atendimento.
- Quando exatamente um agendamento vira atendimento.
- Se “Efetivar” deve usar data/hora do agendamento ou data/hora da efetivação.
- Se “Transferência” equivale a reagendamento.
- Se “Exclusão” existe no novo sistema ou deve virar cancelamento/desativação.

## 12.2 Escopo

- Guia TISS entra no MVP?
- APAC entra no MVP?
- CIHA entra no MVP?
- Faturamento entra no MVP?
- Importações entram no MVP?
- Agenda web entra no MVP?
- Lista de espera entra no MVP?
- Pulseira de identificação entra no MVP?
- Envio real de SMS/WhatsApp/URA entra no MVP?

## 12.3 Disponibilidade e conflitos

- Como calcular capacidade, agendados, agendamento e limite.
- Se encaixe conta na capacidade.
- Se agendamento acima da capacidade é permitido.
- Se bloqueio ocupa sala, profissional ou ambos.
- Se reserva de sala cria horário disponível para paciente.
- Se cancelamento libera horário automaticamente.
- Se falta libera horário.
- Se feriados devem bloquear agenda.

## 12.4 Paciente

- Quais campos são obrigatórios no cadastro resumido.
- Como tratar paciente duplicado.
- Se paciente cancelado/inativo pode ser agendado.
- Se deve exigir telefone válido.
- Se deve exigir e-mail para lembretes.
- Se deve existir consentimento para mensagens.

## 12.5 Lembretes

- Se envio será manual, automático ou ambos.
- Quais canais serão usados.
- Qual provedor será usado.
- Se respostas de WhatsApp/SMS cancelam ou confirmam automaticamente.
- Se templates serão configuráveis por procedimento/tipo de serviço.
- Se deve haver limite de tentativas de envio.

## 12.6 Configurações

- Quais configurações são realmente necessárias no MVP.
- Quais ficam apenas preparadas para futuro.
- Quem pode alterar configurações.
- Se alterações precisam de log visível em tela.

---

# 13. Recomendações de MVP

Para a primeira versão do Módulo 4, priorizar:

1. Cadastros mínimos de sala/grupo de sala e procedimentos, reaproveitando Módulo 1.
2. Modelo de agendamento.
3. Geração de reservas/horários por modelo.
4. Reserva avulsa de sala/horário.
5. Agenda principal por data, sala/profissional/especialidade.
6. Busca de horário disponível.
7. Inclusão de paciente no agendamento.
8. Agendamento múltiplo simples, se realmente usado.
9. Confirmação manual.
10. Cancelamento/falta com motivo.
11. Reagendamento.
12. Bloqueio/desbloqueio.
13. Geração de atendimento a partir do agendamento.
14. Histórico e auditoria.
15. Configurações essenciais.

Deixar como fase posterior:

- SMS;
- WhatsApp;
- URA;
- Twilio;
- TISS;
- APAC;
- CIHA;
- Faturamento;
- Agenda web;
- Importações;
- Lista de espera avançada;
- Impressões complexas;
- Pulseira;
- Automações de confirmação/cancelamento por mensagem.

---

# 14. Diretriz final para o Copilot

Ao implementar o Módulo 4:

- Não copiar a interface antiga literalmente.
- Criar uma agenda moderna, clara e segura.
- Validar regras críticas no backend.
- Usar status explícitos.
- Preservar histórico.
- Auditar ações críticas.
- Tratar integrações externas como opcionais.
- Tratar faturamento/TISS/APAC/CIHA como fora do MVP sem confirmação.
- Separar reserva, slot, agendamento e atendimento como conceitos distintos.
- Sempre que uma regra não estiver clara nas imagens, marcar como **ponto a validar**.
