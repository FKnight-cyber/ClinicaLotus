# Escopo do MVP — Sistema de Prontuário e Atendimento Clínico

**Versão:** 1.0  
**Objetivo:** definir, de forma clara, o que será entregue no MVP e o que ficará fora do escopo automatizado/integrado, podendo existir apenas de forma manual ou interna no sistema.

---

## Premissas gerais do MVP

O MVP contemplará os 5 módulos principais do sistema:

1. Cadastros Gerais.
2. Acolhimento.
3. Prontuário.
4. Agendamento.
5. Atendimento Ambulatorial.

O sistema será desenvolvido do zero, com frontend em React, backend em Node.js e banco de dados relacional.

O MVP não terá integração com APIs externas, não terá migração de dados do sistema legado e não realizará sincronização com sistemas de terceiros.

Todas as informações necessárias para operação inicial serão cadastradas manualmente pelos usuários administradores ou operadores autorizados.

O sistema legado será utilizado apenas como referência funcional. A nova solução deverá ter interface mais moderna, fluxos mais simples, menos telas poluídas e melhor organização dos dados.

---

# 1. O que será entregue no MVP

## 1.1 Módulo 1 — Cadastros Gerais

Será entregue a base administrativa do sistema.

### Funcionalidades incluídas

- Login interno com usuário e senha.
- Logout.
- Controle de sessão/autenticação.
- Cadastro de usuários.
- Ativação/inativação de usuários.
- Cadastro de grupos de acesso.
- Cadastro e configuração de permissões.
- Vínculo de usuários a grupos de acesso.
- Permissões operacionais por usuário ou grupo.
- Cadastro de profissionais.
- Cadastro de especialidades.
- Cadastro de locais de atendimento.
- Cadastro de convênios.
- Cadastro de planos.
- Cadastro de tipos de serviço.
- Cadastro de salas/grupos de sala, quando necessário para agenda.
- Cadastro de procedimentos/exames usados internamente.
- Cadastro interno de medicamentos.
- Cadastro de vias de administração.
- Cadastro de frequências.
- Cadastro de cuidados.
- Cadastro de modelos simples de ficha/documento.
- Cadastro de CID-10 de forma interna/manual ou via carga inicial fornecida pelo cliente.
- Cadastro de dados básicos de contratos e credenciamentos.
- Cadastro de anexos/documentos administrativos, se necessário.
- Auditoria básica para alterações críticas.

### Observações

O Módulo 1 terá foco cadastral. Ele não fará cálculos financeiros, faturamento, repasse, controle fiscal ou integração com órgãos externos.

---

## 1.2 Módulo 2 — Acolhimento, Pacientes e Atendimento Inicial

Será entregue o fluxo inicial de cadastro, localização e criação de atendimento.

### Funcionalidades incluídas

- Pesquisa de pacientes.
- Cadastro rápido de paciente.
- Cadastro completo de paciente.
- Edição de dados cadastrais do paciente.
- Validação básica de duplicidade.
- Cadastro de documentos, endereço e contatos do paciente.
- Cadastro de convênio/plano do paciente.
- Histórico de atendimentos do paciente.
- Criação de atendimento.
- Edição de atendimento enquanto permitido.
- Seleção de local de atendimento.
- Seleção de convênio/plano no atendimento.
- Registro de profissional responsável, quando aplicável.
- Registro de observações do atendimento.
- Encerramento/alta do atendimento.
- Cancelamento de alta, se permitido por perfil.
- Histórico de eventos do atendimento.
- Registro básico de documentos administrativos vinculados ao atendimento.
- Controle simples de acompanhantes e visitantes, se necessário para operação.
- Controle simples de leitos, somente se for necessário para a clínica no MVP.
- Controle de isolamento, somente se for necessário para a clínica no MVP.

### Observações

Internação, leitos, acompanhantes, visitantes e isolamento podem entrar no MVP em versão simplificada, caso sejam necessários para a operação inicial. Caso contrário, ficam como Pós-MVP.

---

## 1.3 Módulo 3 — Prontuário

Será entregue o prontuário clínico básico, centralizado e auditável.

### Funcionalidades incluídas

- Tela de prontuário do paciente.
- Cabeçalho clínico com dados principais do paciente e atendimento.
- Timeline clínica básica.
- Visualização do histórico de atendimentos.
- Registro de ficha clínica/médica.
- Registro de evolução médica.
- Registro de evolução multidisciplinar simples, se necessário.
- Registro de enfermagem simples, se necessário.
- Registro de sinais vitais.
- Registro de problemas ativos.
- Registro de alergias/problemas relevantes.
- Registro de diagnósticos e hipóteses diagnósticas.
- Pesquisa interna de CID-10.
- Prescrição/conduta básica.
- Registro de medicamentos prescritos.
- Registro de exames/procedimentos solicitados.
- Registro de cuidados.
- Registro de uso contínuo simples, se necessário.
- Impressão ou geração simples de documentos clínicos.
- Histórico de documentos emitidos.
- Cancelamento/desativação com motivo.
- Auditoria de ações clínicas críticas.
- Snapshots dos dados usados em documentos e registros históricos.

### Observações

O prontuário do MVP deve priorizar o fluxo essencial: visualizar paciente, registrar evolução, ficha, problemas ativos, diagnóstico, sinais vitais, conduta/prescrição simples e documentos básicos.

---

## 1.4 Módulo 4 — Agendamento

Será entregue a agenda interna do sistema.

### Funcionalidades incluídas

- Agenda principal por data.
- Filtro por profissional.
- Filtro por sala.
- Filtro por especialidade.
- Filtro por local de atendimento.
- Cadastro de modelo de agendamento.
- Geração de horários/reservas a partir de modelo.
- Reserva avulsa de sala/horário.
- Busca de horários disponíveis.
- Inclusão de paciente no agendamento.
- Agendamento simples de consulta/exame.
- Confirmação manual de agendamento.
- Reagendamento.
- Cancelamento com motivo.
- Registro de falta do paciente.
- Bloqueio de horário.
- Desbloqueio de horário.
- Geração/início de atendimento a partir do agendamento.
- Histórico de alterações do agendamento.
- Auditoria de ações críticas da agenda.

### Observações

A agenda será totalmente interna. Não haverá integração com Google Calendar, WhatsApp, SMS, URA, e-mail automático ou ferramentas externas de confirmação.

---

## 1.5 Módulo 5 — Atendimento Ambulatorial

Será entregue o fluxo operacional do atendimento ambulatorial.

### Funcionalidades incluídas

- Painel da recepção.
- Lista/fila de pacientes por status.
- Filtros por local, especialidade e status.
- Exibição de tempo de espera.
- Chamada manual do paciente.
- Registro de não atendimento.
- Início de triagem/acolhimento.
- Registro de triagem.
- Registro de sinais vitais.
- Classificação de risco simples/manual.
- Início de consulta.
- Tela de atendimento médico.
- Visualização dos dados do paciente no atendimento.
- Visualização de problemas ativos.
- Visualização de dados de triagem/acolhimento.
- Registro de hipótese diagnóstica/CID.
- Ficha médica.
- Evolução médica.
- Conduta/prescrição básica.
- Prescrição de medicamento a partir de cadastro interno.
- Solicitação interna de exame/procedimento.
- Registro de cuidado.
- Receita simples.
- Atestado simples.
- Encaminhamento simples.
- Solicitação de exame para retorno.
- Agendamento de retorno usando a agenda interna.
- Finalização da consulta.
- Alta ambulatorial.
- Cancelamento de alta, se permitido.
- Histórico de eventos do atendimento.
- Auditoria das principais ações.

### Observações

O atendimento ambulatorial do MVP deve cobrir o fluxo operacional principal: paciente entra na fila, passa por triagem, é atendido pelo profissional, recebe evolução/ficha/conduta/documento e tem o atendimento finalizado.

---

# 2. Funcionalidades que existirão de forma manual/interna

As funcionalidades abaixo não terão integração externa no MVP, mas poderão existir como cadastro, registro ou processo manual dentro do sistema.

## 2.1 Memed / Prescrição digital

### No MVP

- Cadastro interno de medicamentos.
- Cadastro de apresentação do medicamento.
- Cadastro de forma farmacêutica, se necessário.
- Cadastro de via de administração.
- Cadastro de frequência.
- Cadastro de dose e observação na prescrição.
- Prescrição simples vinculada ao atendimento.
- Receita simples impressa ou gerada em PDF.
- Histórico da prescrição no prontuário.

### Fora do MVP como integração

- Integração com Memed.
- Busca automática na base Memed.
- Assinatura digital pela Memed.
- Envio de receita digital por link.
- Cópia automática do PDF Memed para o prontuário.
- Validação regulatória de receita digital.
- Controle de token/link externo.

---

## 2.2 Medicamentos

### No MVP

- Cadastro manual de medicamentos.
- Busca interna de medicamentos.
- Associação do medicamento à prescrição/conduta.
- Registro de dose, frequência, via, quantidade e observação.
- Histórico da prescrição.

### Fora do MVP como automação

- Integração com base externa de medicamentos.
- Atualização automática de bulário.
- Controle regulatório de medicamentos controlados.
- Integração com farmácia.
- Baixa automática de estoque.
- Lote, validade, rastreabilidade e inventário completo.

---

## 2.3 CID-10

### No MVP

- Cadastro interno de CID-10.
- Pesquisa por código.
- Pesquisa por descrição.
- Associação ao diagnóstico/problema ativo.
- Registro do CID no atendimento/prontuário.

### Fora do MVP como integração

- Consulta em API externa de CID.
- Atualização automática de tabela CID.
- Integração com bases governamentais.

---

## 2.4 Convênios, planos e credenciamentos

### No MVP

- Cadastro manual de convênios.
- Cadastro manual de planos.
- Vínculo de convênio/plano ao paciente.
- Vínculo de convênio/plano ao atendimento.
- Cadastro básico de credenciamento do profissional.
- Alertas simples de vigência, se configurado.

### Fora do MVP como integração

- Integração com operadoras.
- Elegibilidade automática.
- Validação automática de carteira.
- Autorização online.
- Integração TISS.
- Envio eletrônico de guias.
- Retorno automático de autorização.

---

## 2.5 TISS / SADT / Guias

### No MVP

- Registro manual de número de guia/documento, se necessário.
- Cadastro interno de procedimentos.
- Solicitação interna de exame/procedimento.
- Impressão simples de solicitação, se necessário.
- Histórico do documento emitido.

### Fora do MVP como integração/automação

- TISS completo.
- XML TISS.
- Envio eletrônico para convênio.
- Retorno automático de autorização.
- Validação oficial de guia.
- Faturamento TISS.
- SADT completo.

---

## 2.6 APAC / AIH

### No MVP

- Campo manual para registrar informação administrativa, se necessário.
- Documento simples de solicitação, se validado como necessário.
- Histórico do documento gerado.

### Fora do MVP como processo completo

- APAC completa.
- Laudo APAC completo.
- Dados complementares complexos de oncologia, quimioterapia ou radioterapia.
- Integração SUS.
- Faturamento SUS.
- AIH completa.
- Validação oficial.
- Geração de arquivo para envio externo.

---

## 2.7 WhatsApp, SMS, e-mail e URA

### No MVP

- Cadastro de telefone e e-mail do paciente.
- Registro manual de confirmação de agendamento.
- Registro manual de observações de contato.
- Status de confirmação atualizado manualmente pelo usuário.

### Fora do MVP como integração

- Envio automático de WhatsApp.
- Envio automático de SMS.
- Envio automático de e-mail.
- URA.
- Twilio.
- Confirmação automática por resposta do paciente.
- Templates automáticos de mensagem.
- Lembretes automáticos.

---

## 2.8 Google Calendar / Agenda externa

### No MVP

- Agenda interna do sistema.
- Horários, reservas, bloqueios e agendamentos internos.
- Confirmação e reagendamento internos.

### Fora do MVP

- Integração com Google Calendar.
- Sincronização com agenda externa.
- Convite automático para paciente/profissional.
- Eventos externos.

---

## 2.9 Assinatura digital

### No MVP

- Registro de usuário responsável.
- Registro de profissional responsável.
- Auditoria de criação/finalização/impressão.
- Impressão de documentos com identificação do profissional, se necessário.

### Fora do MVP

- Assinatura digital certificada.
- ICP-Brasil.
- Certificado digital.
- Login por certificado.
- Receita digital regulatória assinada.
- Validação criptográfica de documentos.

---

## 2.10 Financeiro, faturamento e repasse

### No MVP

- Cadastro básico de dados financeiros do profissional, se necessário.
- Cadastro de taxas administrativas, se necessário.
- Cadastro de contrato e vigência.
- Registro manual de procedimento/taxa no atendimento, se necessário apenas para histórico interno.

### Fora do MVP

- Faturamento completo.
- Cálculo de repasse.
- Contas a pagar.
- Contas a receber.
- Fluxo de caixa.
- Nota fiscal.
- Integração bancária.
- Cobrança online.
- Conciliação.
- Relatórios financeiros avançados.

---

## 2.11 Estoque e farmácia

### No MVP

- Cadastro simples de medicamentos/produtos usados na prescrição.
- Associação manual de medicamento/produto à conduta.
- Histórico clínico da prescrição.

### Fora do MVP

- Controle completo de estoque.
- Entrada e saída de estoque.
- Baixa automática por prescrição.
- Controle de lote.
- Controle de validade.
- Inventário.
- Farmácia completa.
- Separação/dispensação.
- Integração com compras.

---

## 2.12 Relatórios

### No MVP

- Listagens com filtros.
- Histórico do paciente.
- Histórico do atendimento.
- Histórico de agendamentos.
- Histórico de documentos emitidos.
- Histórico de eventos/auditoria.

### Fora do MVP

- BI.
- Dashboards avançados.
- Gráficos gerenciais.
- Exportações avançadas.
- Relatórios financeiros.
- Relatórios regulatórios complexos.

---

# 3. O que fica fora do MVP

As funcionalidades abaixo não fazem parte do MVP, nem como integração nem como automação completa.

- Migração de dados do sistema legado.
- Importação automática de banco legado.
- Sincronização com sistema antigo.
- Integração com APIs externas.
- Integração Memed.
- Integração com convênios.
- Integração CNES.
- Integração SUS.
- Integração TISS.
- Integração APAC.
- Integração AIH.
- Integração SADT.
- Integração com WhatsApp.
- Integração com SMS.
- Integração com e-mail automático.
- Integração com URA.
- Integração com Twilio.
- Integração com Google Calendar.
- Integração com catraca.
- Integração com laboratório.
- Telemedicina.
- Portal do paciente.
- Portal familiar.
- Receita digital regulatória.
- Assinatura digital certificada.
- OCR.
- Reconhecimento facial.
- BI avançado.
- Faturamento completo.
- Financeiro completo.
- Estoque completo.
- Farmácia completa.
- Controle de compras.
- Controle fiscal.
- Cálculo de repasse.
- Emissão de nota fiscal.
- Integração bancária.
- Pagamento online.
- Automação clínica avançada.
- Inteligência artificial clínica.
- Importações automáticas de tabelas externas.
- Lista de espera inteligente.
- Confirmação automática de agendamento.
- Lembretes automáticos.
- Pulseira de identificação complexa.
- Etiquetas complexas.
- Censo hospitalar completo.
- Hotelaria/limpeza integrada.
- Manutenção integrada.

---

# 4. Resumo executivo do MVP

O MVP entregará um sistema funcional para operação clínica básica, cobrindo:

- Cadastro administrativo.
- Usuários e permissões.
- Pacientes.
- Profissionais.
- Convênios e planos.
- Agenda interna.
- Agendamento.
- Criação de atendimento.
- Acolhimento/triagem.
- Painel/fila de atendimento.
- Atendimento médico ambulatorial.
- Prontuário básico.
- Ficha médica.
- Evolução.
- Problemas ativos.
- Diagnóstico/CID.
- Sinais vitais.
- Prescrição/conduta simples.
- Cadastro interno de medicamentos.
- Solicitação simples de exames/procedimentos.
- Receita simples.
- Atestado simples.
- Encaminhamento simples.
- Alta/finalização.
- Histórico de eventos.
- Auditoria básica.
- Documentos com snapshot.

Tudo que depender de terceiros, APIs, validações oficiais, assinatura digital, faturamento, automação de mensagens, estoque completo ou integração regulatória ficará fora do MVP e poderá ser tratado em fases futuras.
