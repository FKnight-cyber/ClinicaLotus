# Copilot Instructions — Módulo 2: Acolhimento, Agenda, Leitos e Controle Assistencial

## 1. Contexto geral do Módulo 2

Este projeto é um novo sistema de prontuário e gestão clínica desenvolvido do zero, inspirado em funcionalidades de um sistema legado, mas sem obrigação de copiar fielmente suas telas, navegação ou fluxo visual.

O Módulo 2 deve contemplar principalmente o fluxo assistencial inicial da clínica/hospital, incluindo:

- Acolhimento;
- Cadastro e localização de pacientes;
- Criação e manutenção de atendimentos;
- Dados de convênio do atendimento;
- Internação/leitos, quando aplicável;
- Alta;
- Formulários, documentos e declarações;
- Administração de leitos;
- Agenda de pacientes, consultas e exames;
- Isolamento do paciente;
- Controle de acompanhantes e visitantes;
- Etiquetas/crachás de acompanhantes;
- Orientações para acompanhante/visitante;
- Configurações simples do acolhimento.

O cliente confirmou que, da interface inicial do sistema antigo, o novo sistema deve contemplar apenas:

- Acolhimento;
- Prontuário;
- Agendamento de consultas e exames;
- Atendimento Ambulatorial.

Todo o restante do sistema antigo fica fora do escopo inicial, salvo decisão futura.

---

## 2. Premissas gerais de desenvolvimento

### 2.1 Não copiar cegamente o sistema legado

O sistema legado é uma referência funcional, não uma referência obrigatória de UX/UI.

Sempre que possível:

- Reduzir janelas modais encadeadas;
- Evitar telas poluídas;
- Criar fluxos guiados;
- Usar mensagens claras;
- Usar botões com nomes explícitos;
- Agrupar informações por contexto;
- Prevenir erros antes de salvar;
- Reutilizar dados já cadastrados;
- Separar paciente, atendimento, agenda, leito e prontuário como conceitos distintos.

### 2.2 Escopo assistencial inicial

O Módulo 2 deve ser focado em:

- Atendimento/Acolhimento;
- Agenda;
- Internação/leitos;
- Controle operacional básico;
- Documentos administrativos do atendimento.

Não implementar inicialmente:

- Faturamento;
- Financeiro;
- Estoque completo;
- Controle completo de medicamentos;
- TISS completo;
- Integração com convênios;
- Integração CNES;
- Relatórios avançados;
- BI/gráficos;
- Integração com catraca;
- Controle físico de acesso;
- Notificações WhatsApp/SMS/e-mail;
- Assinatura digital;
- OCR;
- Cálculos financeiros;
- Exportações avançadas.

### 2.3 Relação com o Módulo 1

O Módulo 2 depende de dados e permissões do Módulo 1, como:

- Usuários;
- Grupos de acesso;
- Permissões;
- Locais de atendimento;
- Convênios;
- Planos;
- Profissionais;
- Especialidades;
- Tipos de serviço;
- Tipos de acomodação;
- Centros de custo, se usados;
- Permissões operacionais por local;
- Auditoria básica;
- Anexos/documentos, se reutilizados.

O backend deve sempre validar permissões. O frontend pode esconder ações, mas não deve ser a única camada de segurança.

---

## 3. Diretrizes técnicas

### 3.1 Backend

Ao gerar código backend:

- Usar TypeScript;
- Separar módulos por domínio;
- Validar entrada com DTO/schema;
- Validar permissões por endpoint;
- Criar paginação em listagens;
- Criar filtros para pesquisas;
- Usar soft delete/desativação lógica;
- Registrar auditoria básica nas operações críticas;
- Evitar exclusão física de dados assistenciais;
- Tratar dados pessoais com cuidado;
- Não implementar regras críticas apenas no frontend.

Estrutura sugerida:

```txt
src/
  modules/
    patients/
    attendances/
    appointments/
    beds/
    forms/
    documents/
    isolation/
    companions/
    visitors/
    reception-settings/
    audit/
  shared/
    database/
    errors/
    middlewares/
    permissions/
    utils/
```

### 3.2 Frontend

Ao gerar código frontend:

- Usar React com TypeScript;
- Criar componentes reutilizáveis;
- Usar formulários organizados em abas/seções;
- Implementar loading, erro e estado vazio;
- Criar confirmações para ações críticas;
- Usar badges/status visuais;
- Usar filtros em listas;
- Usar telas de detalhe com histórico;
- Usar mensagens de bloqueio claras;
- Criar componentes de autorização visual, como `Can` ou `usePermission`.

### 3.3 Auditoria

Auditar pelo menos:

- Criação/edição de paciente;
- Criação/edição/encerramento de atendimento;
- Alta;
- Movimentação de leito;
- Alteração de status de leito;
- Isolamento;
- Entrada/saída de acompanhante;
- Entrada/saída de visitante;
- Impressão/reimpressão de etiqueta;
- Emissão de documentos;
- Alteração de configurações;
- Cancelamento/reagendamento de consulta/exame.

---

# 4. Backlog do Módulo 2

---

## Épico 1 — Cadastro e pesquisa de pacientes

### Objetivo

Permitir localizar, cadastrar e manter pacientes que serão usados no acolhimento, agenda, prontuário e atendimento ambulatorial.

### Funcionalidades

- Pesquisa de paciente;
- Cadastro rápido de paciente;
- Cadastro completo de paciente;
- Edição de dados cadastrais;
- Validação de duplicidade;
- Dados pessoais;
- Documentação;
- Endereço e contatos;
- Convênios do paciente;
- Nome social;
- Histórico de atendimentos.

### Campos principais do paciente

- Nome;
- Nome social;
- CPF;
- RG;
- CNS;
- Data de nascimento;
- Sexo;
- Estado civil;
- Nacionalidade;
- Naturalidade;
- Nome da mãe;
- Nome do pai;
- Escolaridade;
- Profissão;
- Religião;
- Endereço;
- Bairro;
- Município;
- Estado;
- CEP;
- Telefones;
- E-mail;
- Localização do prontuário;
- Data/hora de óbito, se aplicável.

### Regras

- CPF deve ser validado quando informado.
- Se CPF não for informado, validar possível duplicidade por nome + nascimento + nome da mãe.
- Nome social deve ser exibido de forma clara, sem perder o nome civil.
- Dados sensíveis devem exigir permissão adequada.
- Não excluir paciente fisicamente se houver atendimento vinculado.

### Melhorias sugeridas

Fluxo recomendado para novo atendimento:

1. Buscar paciente;
2. Selecionar paciente existente ou cadastrar rapidamente;
3. Validar duplicidade;
4. Escolher tipo/local de atendimento;
5. Criar atendimento.

---

## Épico 2 — Atendimento / Acolhimento

### Objetivo

Criar e manter o registro de atendimento do paciente, separando dados do paciente dos dados do evento assistencial.

### Conceito

Paciente é uma entidade permanente.

Atendimento é um evento vinculado ao paciente.

Exemplo:

- Paciente: nome, CPF, documentos, endereço, contatos.
- Atendimento: data/hora, local, convênio, profissional, situação, leito, alta, acompanhantes e documentos emitidos.

### Funcionalidades

- Criar atendimento;
- Editar atendimento;
- Selecionar local de atendimento;
- Informar convênio/plano;
- Informar profissional, quando aplicável;
- Informar dados de internação;
- Registrar observações;
- Visualizar histórico;
- Encerrar atendimento/alta;
- Bloquear alterações após alta, salvo permissão especial.

### Abas/seções sugeridas

- Resumo;
- Dados do paciente;
- Documentação;
- Convênio;
- Internação/leito;
- Alta;
- Documentos;
- Isolamento;
- Acompanhantes e visitantes;
- Histórico/Auditoria.

### Regras

- Usuário só pode criar atendimento em local permitido.
- Se o usuário só tiver um local permitido, selecionar automaticamente.
- Se não houver local permitido, bloquear.
- Atendimento encerrado não deve permitir edição comum.
- Paciente pode ou não ter mais de um atendimento ativo; validar regra com o cliente posteriormente.
- A primeira versão deve assumir bloqueio de atendimento duplicado incompatível para evitar erro operacional.

---

## Épico 3 — Dados do convênio no atendimento

### Objetivo

Registrar convênio, plano e dados relacionados ao atendimento.

### Campos

- Convênio;
- Plano;
- Código no convênio;
- Número da carteira/matrícula;
- Validade da carteira;
- Guia/documento;
- Categoria;
- Acomodação;
- Profissional;
- Tipo de paciente/atendimento;
- Observação;
- Dados de autorização, se necessário.

### Regras

- Convênio e plano devem vir dos cadastros auxiliares.
- Atendimento pode ser particular ou por convênio.
- Carteira vencida deve gerar alerta ou bloqueio conforme configuração futura.
- Credenciamento do profissional pode ser validado quando aplicável.
- Não implementar faturamento ou TISS completo nesta fase.

---

## Épico 4 — Alta / Encerramento do atendimento

### Objetivo

Encerrar atendimento/internação de forma controlada.

### Campos

- Data da alta;
- Hora da alta;
- Motivo da alta;
- Profissional responsável;
- Resumo da alta;
- Data de disponibilização;
- Motivo de óbito, quando aplicável;
- Registro de óbito, quando aplicável;
- Observação.

### Regras

- Alta deve encerrar o atendimento/internação.
- Alta deve liberar leito automaticamente ou mover para limpeza, conforme configuração.
- Se houver isolamento ativo, exigir encerramento ou motivo de saída.
- Se houver acompanhante/visitante ativo, alertar e permitir encerramento guiado.
- Se motivo indicar óbito, exigir dados mínimos de óbito.
- Após alta, atendimento fica bloqueado para edição comum.
- Alta deve ser auditada.

### Melhorias sugeridas

Criar um fluxo guiado de alta:

1. Confirmar dados do paciente;
2. Verificar leito;
3. Verificar isolamento;
4. Verificar acompanhantes/visitantes;
5. Informar motivo/resumo;
6. Confirmar encerramento.

---

## Épico 5 — Formulários, documentos e declarações

### Objetivo

Permitir criar modelos de documentos e gerar documentos preenchidos a partir do atendimento.

### Funcionalidades

- Cadastro de modelos de formulário;
- Editor de texto/template;
- Campos dinâmicos;
- Critérios de exibição;
- Geração de documento no atendimento;
- Declarações;
- Contratos simples;
- Histórico de emissão;
- Impressão/preview;
- Permissões;
- Auditoria.

### Modelos observados

- Contrato padrão;
- Atestado;
- Autorização;
- Cartão;
- Termo de responsabilidade;
- Termo de internação;
- Termo de responsável;
- Solicitação de internação;
- Solicitação de prorrogação;
- Solicitação de OPME;
- Guia de atendimento;
- Guia de solicitação.

### Regras

- Guias complexas, TISS, faturamento e integração com convênios ficam fora do escopo inicial.
- O sistema deve permitir templates com placeholders.
- Exemplo de placeholders:
  - `{{paciente.nome}}`
  - `{{paciente.cpf}}`
  - `{{paciente.dataNascimento}}`
  - `{{atendimento.numero}}`
  - `{{atendimento.dataEntrada}}`
  - `{{convenio.nome}}`
  - `{{profissional.nome}}`
  - `{{responsavel.nome}}`
- Validar se os placeholders usados existem.
- Exibir preview antes de imprimir.
- Registrar emissão do documento.

### Condições de exibição do formulário

O modelo pode ser condicionado por:

- Local de atendimento;
- Convênio;
- Plano;
- Tipo de atendimento;
- Sexo;
- Situação do atendimento;
- Internação/ambulatorial;
- Acompanhante/visitante;
- Alta.

### Melhorias sugeridas

Criar uma aba “Documentos” dentro do atendimento, contendo:

- Formulários disponíveis;
- Declarações;
- Termos;
- Documentos emitidos;
- Anexos, se aplicável.

---

## Épico 6 — Administração de leitos

### Objetivo

Gerenciar leitos, status, ocupação e movimentação de pacientes.

### Funcionalidades

- Cadastro estrutural de unidade/setor/quarto/leito;
- Grade visual de leitos;
- Pesquisa de pacientes internados;
- Alocação de paciente em leito;
- Movimentação/troca de leito;
- Liberação de leito;
- Indisponibilização de leito;
- Alteração de status;
- Histórico de movimentações;
- Permissões;
- Auditoria.

### Status recomendados para leito

- Disponível;
- Ocupado;
- Reservado;
- Em limpeza;
- Em manutenção;
- Indisponível;
- Bloqueado;
- Isolamento;
- Alta pendente.

### Regras

- Apenas leito disponível pode receber paciente.
- Leito ocupado deve estar vinculado a atendimento ativo.
- Leito em limpeza/manutenção/indisponível não pode receber paciente.
- Movimentação deve liberar o leito anterior automaticamente ou mover para limpeza, conforme regra.
- Histórico de movimentação não deve ser apagado.
- Liberação manual deve exigir permissão.
- Não permitir marcar leito ocupado como disponível sem tratar o atendimento.

### Melhorias sugeridas

Criar uma tela única “Administração de Leitos” com:

- Filtros por unidade, setor, quarto, status, convênio e paciente;
- Grade de cards;
- Legenda clara;
- Ações por leito;
- Detalhe do leito;
- Histórico;
- Transferência guiada.

---

## Épico 7 — Agenda de pacientes / consultas e exames

### Objetivo

Gerenciar agendamentos de consultas e exames.

### Funcionalidades

- Tela principal da agenda;
- Visualização por dia/semana/lista;
- Filtros;
- Criar agendamento;
- Editar agendamento;
- Cancelar;
- Confirmar;
- Reagendar/transferir;
- Registrar chegada;
- Iniciar atendimento;
- Finalizar/marcar como realizado;
- Bloquear horários;
- Pesquisa/listagem;
- Recorrência simples, se confirmada;
- Agendamento em grupo, se confirmado;
- Histórico de status.

### Status recomendados

- Agendado;
- Confirmado;
- Cancelado;
- Transferido/Reagendado;
- Em atendimento;
- Realizado;
- Não compareceu;
- Bloqueado.

### Regras

- Não permitir conflito de horário para o mesmo profissional/recurso.
- Não permitir agendar em horário bloqueado.
- Não permitir profissional inativo.
- Não permitir local inativo.
- Validar permissão operacional do usuário para o local.
- Validar regra de agenda do profissional, quando aplicável.
- Validar credenciamento/convênio, quando aplicável.
- Agendamento cancelado não deve ser excluído fisicamente.
- Reagendamento deve manter histórico.
- Iniciar atendimento deve vincular ou criar atendimento ambulatorial.

### Melhorias sugeridas

Evitar termos ambíguos do legado:

- “Efetivar” deve virar “Registrar chegada” ou “Iniciar atendimento”;
- “Transferência” deve virar “Reagendar”;
- “Finalização” deve virar “Finalizar atendimento”;
- “Bloqueia” deve virar “Bloquear horário”.

---

## Épico 8 — Bloqueio de agenda

### Objetivo

Permitir indisponibilizar horários, profissionais, salas ou períodos.

### Funcionalidades

- Bloquear horário específico;
- Bloquear período;
- Bloquear agenda do profissional;
- Informar motivo;
- Desbloquear;
- Exibir bloqueio na agenda;
- Impedir agendamento no período bloqueado.

### Motivos sugeridos

- Reunião;
- Ausência;
- Feriado;
- Manutenção;
- Folga;
- Outro.

---

## Épico 9 — Isolamento do paciente

### Objetivo

Registrar, exibir e encerrar isolamento do paciente/atendimento.

### Funcionalidades

- Cadastro de motivos de isolamento;
- Iniciar isolamento;
- Encerrar isolamento;
- Histórico de isolamento;
- Alerta no atendimento;
- Alerta no prontuário;
- Badge na grade de leitos;
- Encerramento guiado na alta;
- Permissões;
- Auditoria.

### Campos do isolamento

- Paciente;
- Atendimento;
- Leito, se aplicável;
- Motivo de entrada;
- Data/hora de início;
- Responsável;
- Observação de entrada;
- Motivo de saída;
- Data/hora de saída;
- Observação de saída;
- Status.

### Regras

- Não permitir dois isolamentos ativos no mesmo atendimento, salvo decisão futura.
- Não permitir encerrar sem motivo de saída.
- Alta deve tratar isolamento ativo.
- Isolamento deve aparecer em atendimento, prontuário, lista de internados e leitos.
- Correções administrativas exigem permissão especial.

### Melhorias sugeridas

Criar um alerta fixo no cabeçalho do atendimento/prontuário:

> Paciente em isolamento — Motivo: X — Desde: DD/MM/AAAA HH:mm

Com botão “Ver detalhes”.

---

## Épico 10 — Acompanhantes

### Objetivo

Controlar acompanhantes vinculados ao atendimento/internação.

### Funcionalidades

- Cadastro de acompanhante;
- Entrada de acompanhante;
- Saída de acompanhante;
- Histórico de acompanhantes;
- Acompanhante atual;
- Observações;
- Etiqueta/crachá, se confirmado;
- Bloqueio por orientação, se configurado;
- Integração com alta.

### Campos do acompanhante

- Nome;
- Telefone;
- Celular;
- Parentesco;
- Tipo de documento;
- Número do documento;
- Observação;
- Status;
- Data/hora de entrada;
- Data/hora de saída;
- Usuário de entrada;
- Usuário de saída.

### Regras

- Acompanhante deve ser vinculado preferencialmente ao atendimento.
- Não permitir entrada duplicada do mesmo acompanhante ativo.
- Não permitir mais de um acompanhante ativo se a configuração não permitir.
- Se acomodação não permitir acompanhante, alertar/bloquear.
- Alta deve verificar acompanhante ativo.
- Saída não pode ter data/hora anterior à entrada.
- Documento pode ser opcional ou obrigatório conforme configuração.
- Se houver orientação marcada como “não libera acompanhante”, bloquear entrada.

### Melhorias sugeridas

Criar aba “Acompanhantes e Visitantes” dentro do atendimento, com:

- Card do acompanhante atual;
- Botões de entrada/saída;
- Histórico;
- Observações;
- Impressão de etiqueta;
- Orientações aplicáveis.

---

## Épico 11 — Visitantes

### Objetivo

Controlar entrada e saída de visitantes vinculados ao atendimento/paciente.

### Funcionalidades

- Cadastro de visitante;
- Entrada de visitante;
- Saída de visitante;
- Visitantes em visita;
- Histórico;
- Observação;
- Bloqueio por orientação;
- Integração com alta.

### Regras

- Visitante deve ser diferenciado de acompanhante.
- Pode haver múltiplos visitantes ativos, conforme configuração.
- Se orientação marcar “não libera visita”, bloquear entrada.
- Alta deve verificar visitantes ativos.
- Não implementar regras complexas de horário de visita sem confirmação.
- Documento pode ser opcional ou obrigatório conforme configuração.

---

## Épico 12 — Orientações para acompanhante/visitante

### Objetivo

Registrar orientações ou restrições relacionadas a acompanhantes e visitantes do paciente/atendimento.

### Funcionalidades

- Criar orientação;
- Editar orientação;
- Listar orientações do atendimento;
- Marcar orientação como bloqueadora de visita;
- Marcar orientação como bloqueadora de acompanhante;
- Exibir alerta ao tentar registrar entrada;
- Manter histórico;
- Auditar alterações.

### Campos sugeridos

- Atendimento;
- Paciente;
- Descrição/orientação;
- Não liberar visita: sim/não;
- Não liberar acompanhante: sim/não;
- Usuário responsável;
- Data/hora de inclusão;
- Status ativo/inativo.

### Regras

- Se existir orientação ativa com “não liberar visita”, bloquear entrada de visitantes.
- Se existir orientação ativa com “não liberar acompanhante”, bloquear entrada de acompanhantes.
- Ao bloquear, exibir mensagem clara:
  - “Visitas não liberadas para este paciente.”
  - “Acompanhante não liberado para este paciente.”
- Permitir exceção apenas com permissão especial, se o cliente solicitar.
- Orientações devem aparecer na aba de acompanhantes/visitantes e no atendimento.

### Melhorias sugeridas

Criar seção “Orientações e Restrições” dentro da aba de acompanhantes/visitantes, com badges:

- Visitas liberadas/bloqueadas;
- Acompanhantes liberados/bloqueados.

---

## Épico 13 — Etiquetas de acompanhantes

### Objetivo

Permitir imprimir identificação para acompanhante utilizar durante a permanência.

### Funcionalidades

- Gerar etiqueta para acompanhante ativo;
- Pré-visualizar etiqueta;
- Imprimir pelo navegador;
- Reimprimir etiqueta;
- Registrar histórico de impressão;
- Bloquear impressão sem acompanhante ativo;
- Atualizar dados conforme leito atual.

### Dados recomendados na etiqueta

- Nome do acompanhante;
- Nome do paciente;
- Setor/unidade;
- Quarto/leito;
- Data/hora de entrada;
- Data/hora de emissão;
- Número do atendimento ou prontuário, se desejado;
- Identificação da clínica, se desejado.

### Regras

- Não imprimir etiqueta se não houver acompanhante ativo.
- Não imprimir se atendimento estiver encerrado, salvo permissão.
- Se paciente mudou de leito após emissão anterior, alertar e sugerir reimpressão.
- Cada emissão/reimpressão deve ficar no histórico.

### Fora de escopo inicial

- Integração direta com impressora térmica específica;
- QR Code obrigatório;
- Código de barras obrigatório;
- Catraca;
- Leitor de etiqueta;
- Foto;
- Reconhecimento facial.

---

## Épico 14 — Tipos de acomodação

### Objetivo

Cadastrar tipos de acomodação usados em leitos, acompanhantes e convênio.

### Campos

- Código;
- Nome/tipo de acomodação;
- Classificação;
- Quantidade de acomodação pela TISS;
- Código reduzido TISS;
- Tipo de acomodação TISS;
- Ativo/inativo.

### Classificações sugeridas

- Apartamento;
- Enfermaria;
- Acompanhante;
- Observação;
- Outros.

### Regras

- Tipo de acomodação pode ser vinculado a quarto/leito.
- Acomodação pode impactar permissão de acompanhante.
- Não implementar faturamento/TISS complexo nesta fase.
- Alterações devem ser auditadas.

---

## Épico 15 — Configurações do acolhimento

### Objetivo

Permitir configurar comportamentos simples do módulo sem replicar a tela enorme do legado.

### Configurações sugeridas

- Permitir mais de um acompanhante ativo por atendimento;
- Exigir documento do acompanhante;
- Exigir parentesco do acompanhante;
- Exigir documento do visitante;
- Encerrar acompanhante automaticamente na alta;
- Encerrar visitantes automaticamente na alta;
- Permitir impressão de etiqueta;
- Modelo padrão da etiqueta;
- Alertar etiqueta antiga após troca de leito;
- Exigir motivo na saída do acompanhante;
- Permitir visitante sem documento;
- Alta libera leito como disponível ou em limpeza;
- Encerrar isolamento automaticamente na alta com motivo padrão.

### Regras

- Configurações devem ter descrição clara.
- Alterações devem ser auditadas.
- Evitar configurações contraditórias.
- Usar valores padrão seguros.

---

# 5. Modelo de dados sugerido

## 5.1 Paciente

- Patient;
- PatientDocument;
- PatientAddress;
- PatientContact;
- PatientInsurance;
- PatientAttachment.

## 5.2 Atendimento

- Attendance;
- AttendanceInsuranceData;
- AttendanceAdmissionData;
- AttendanceDischarge;
- AttendanceStatusHistory;
- AttendanceAuditLog.

## 5.3 Documentos

- AttendanceFormTemplate;
- AttendanceFormTemplateCondition;
- AttendanceFormTemplateVersion;
- AttendanceGeneratedDocument;
- AttendanceDeclaration.

## 5.4 Leitos

- Unit;
- Sector;
- Room;
- Bed;
- BedMovement;
- BedStatusHistory;
- BedUnavailability.

## 5.5 Agenda

- Appointment;
- AppointmentStatusHistory;
- AppointmentTransferHistory;
- ScheduleBlock;
- AppointmentRecurrence;
- AppointmentGroup;
- AppointmentGroupParticipant.

## 5.6 Isolamento

- IsolationReason;
- IsolationRecord;
- IsolationStatusHistory.

## 5.7 Acompanhantes/visitantes

- Companion;
- AttendanceCompanion;
- Visitor;
- AttendanceVisitor;
- CompanionBadgePrint;
- VisitorBadgePrint, se necessário;
- CompanionVisitorOrientation.

## 5.8 Configurações

- ReceptionSetting;
- AccommodationType.

---

# 6. Permissões sugeridas

```txt
patients.read
patients.create
patients.update
patients.view_sensitive_data
patients.update_sensitive_data

attendances.read
attendances.create
attendances.update
attendances.close
attendances.reopen
attendances.view_history

attendance_documents.read
attendance_documents.create
attendance_documents.print
attendance_documents.view_history
attendance_form_templates.read
attendance_form_templates.create
attendance_form_templates.update
attendance_form_templates.deactivate

beds.read
beds.create
beds.update
beds.deactivate
beds.change_status
beds.make_unavailable
beds.release
beds.move_patient
beds.view_history
inpatients.read

appointments.read
appointments.create
appointments.update
appointments.cancel
appointments.confirm
appointments.transfer
appointments.register_arrival
appointments.start_attendance
appointments.finish
appointments.block_schedule
appointments.unblock_schedule
appointments.manage_group
appointments.manage_recurrence

isolation.read
isolation.create
isolation.end
isolation.update
isolation.cancel
isolation.view_history
isolation_reasons.read
isolation_reasons.create
isolation_reasons.update
isolation_reasons.deactivate

companions.read
companions.create
companions.update
companions.register_entry
companions.register_exit
companions.view_history
companions.print_badge

visitors.read
visitors.create
visitors.update
visitors.register_entry
visitors.register_exit
visitors.view_current
visitors.view_history
visitors.print_badge

companion_visitor_orientations.read
companion_visitor_orientations.create
companion_visitor_orientations.update
companion_visitor_orientations.deactivate

accommodation_types.read
accommodation_types.create
accommodation_types.update
accommodation_types.deactivate

reception_settings.read
reception_settings.update

audit_logs.read
```

---

# 7. Regras de bloqueio gerais

## 7.1 Atendimento

Bloquear se:

- Usuário não tiver permissão para local;
- Paciente tiver atendimento incompatível aberto;
- Local estiver inativo;
- Atendimento estiver encerrado.

## 7.2 Leito

Bloquear se:

- Leito estiver ocupado;
- Leito estiver em limpeza;
- Leito estiver em manutenção;
- Leito estiver indisponível;
- Atendimento estiver encerrado;
- Usuário não tiver permissão.

## 7.3 Agenda

Bloquear se:

- Horário estiver ocupado;
- Horário estiver bloqueado;
- Profissional estiver inativo;
- Serviço/exame estiver inativo;
- Usuário não tiver permissão no local;
- Atendimento já tiver sido iniciado, no caso de cancelamento/reagendamento.

## 7.4 Isolamento

Bloquear se:

- Já houver isolamento ativo;
- Motivo estiver inativo;
- Atendimento estiver encerrado;
- Data/hora de saída for anterior à entrada;
- Usuário não tiver permissão.

## 7.5 Acompanhantes/visitantes

Bloquear se:

- Atendimento estiver encerrado;
- Já houver acompanhante ativo e configuração não permitir mais de um;
- Houver orientação bloqueando acompanhante;
- Houver orientação bloqueando visita;
- Documento obrigatório estiver ausente;
- Usuário não tiver permissão.

---

# 8. Fora de escopo inicial

Não implementar sem confirmação explícita:

- Faturamento;
- Financeiro;
- Estoque completo;
- Controle completo de medicamentos;
- TISS completo;
- Guias oficiais complexas;
- Integração com convênios;
- Integração CNES;
- Integração com WhatsApp/SMS/e-mail;
- Google Calendar;
- Controle de catraca;
- QR Code obrigatório;
- Reconhecimento facial;
- OCR;
- Assinatura digital;
- Relatórios avançados;
- BI;
- Censo hospitalar completo;
- Hotelaria/limpeza integrada;
- Manutenção integrada;
- Impressora térmica específica;
- Pagamento;
- Cobrança de acompanhante;
- Lista de espera inteligente.

---

# 9. Ordem sugerida de desenvolvimento

1. Pacientes;
2. Atendimento/Acolhimento;
3. Dados de convênio do atendimento;
4. Alta;
5. Administração de leitos;
6. Movimentação de leitos;
7. Agenda básica;
8. Cancelamento/reagendamento/confirmação;
9. Iniciar atendimento a partir da agenda;
10. Formulários/documentos básicos;
11. Declarações;
12. Isolamento;
13. Acompanhantes;
14. Visitantes;
15. Orientações de acompanhante/visitante;
16. Etiquetas de acompanhante;
17. Configurações do acolhimento;
18. Auditoria e refinamentos;
19. Melhorias de UX e validações finais.

---

# 10. Checklist de qualidade

Antes de considerar uma funcionalidade pronta:

- Tem validação no backend;
- Tem permissão no backend;
- Tem tratamento de erro;
- Tem loading/empty/error state no frontend;
- Tem confirmação para ações críticas;
- Tem auditoria quando necessário;
- Não exclui fisicamente dados históricos;
- Tem mensagens claras de bloqueio;
- Tem paginação em listas;
- Tem filtros úteis;
- Não replica UX ruim do legado;
- Está tipado com TypeScript;
- Regras críticas não dependem só do frontend;
- Dados sensíveis não são expostos sem necessidade.

---

# 11. Observações finais para o Copilot

Ao sugerir código para o Módulo 2:

- Trate paciente, atendimento, agendamento e prontuário como conceitos separados.
- O atendimento deve ser o centro operacional do acolhimento.
- Leitos devem ter histórico de movimentação.
- Agenda deve ter máquina de status clara.
- Ações antigas com nomes ambíguos devem ser renomeadas para ações compreensíveis.
- Isolamento deve aparecer como alerta assistencial visível.
- Acompanhantes e visitantes devem ficar em uma aba/tela unificada no atendimento.
- Orientações podem bloquear entrada de acompanhante ou visitante.
- Etiqueta de acompanhante deve ser uma identificação simples e imprimível.
- Configurações devem ser simples, úteis e auditadas.
- Não adicionar complexidades de faturamento, TISS, estoque ou integrações sem solicitação explícita.
