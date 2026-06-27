# Copilot Instructions — Módulo 3: Prontuário

> Projeto: novo sistema de prontuário/atendimento para clínica, construído do zero com tecnologias atuais.  
> Este arquivo deve orientar o GitHub Copilot/Copilot Chat durante o desenvolvimento do **Módulo 3 — Prontuário**.  
> O objetivo é transformar as telas do sistema legado em um backlog técnico-funcional moderno, sem copiar cegamente a experiência antiga.

---

## 1. Como usar este arquivo

Use este arquivo como contexto principal ao implementar o Módulo 3.

Quando estiver gerando código, o Copilot deve considerar:

- O sistema legado é apenas uma referência funcional.
- A nova solução deve ter melhor usabilidade, menos janelas modais e fluxo mais simples.
- A implementação deve priorizar segurança, auditoria, permissões, rastreabilidade e preservação histórica.
- Nem tudo visto no legado deve entrar automaticamente no MVP.
- Sempre que houver dúvida sobre uma tela, campo, regra ou comportamento, considerar como **ponto a validar**.
- Não implementar integrações externas, automações clínicas complexas, assinatura digital certificada ou faturamento completo sem validação explícita.

---

## 2. Contexto geral do projeto

O sistema novo será um sistema web moderno para uma clínica, substituindo partes usadas de um sistema legado.

Funcionalidades confirmadas pelo cliente no escopo geral:

- Acolhimento;
- Prontuário;
- Agendamento de consultas e exames;
- Atendimento Ambulatorial.

Funcionalidades do sistema legado que **não devem ser assumidas automaticamente**:

- Estoque completo;
- Faturamento hospitalar completo;
- Financeiro completo;
- Convênios/TISS completo;
- Farmácia completa;
- Integrações laboratoriais;
- Telemedicina;
- WhatsApp/e-mail oficial;
- Receita digital regulatória;
- Assinatura digital certificada;
- Portal completo do paciente/familiar sem validação.

---

## 3. Premissas técnicas

Assumir arquitetura web moderna, preferencialmente:

- Frontend: React;
- Backend: Node.js;
- Banco relacional, preferencialmente PostgreSQL;
- API REST ou equivalente consistente;
- Autenticação por login interno do sistema;
- Controle de acesso por permissões/grupos;
- Auditoria para ações críticas;
- Soft delete/desativação/cancelamento em registros clínicos;
- Histórico/snapshot para dados clínicos e documentos emitidos.

Não usar lógica acoplada à interface legada.

Evitar:

- Telas com múltiplas janelas pequenas;
- Fluxos dependentes de estado só no frontend;
- Exclusão física de registros clínicos;
- Alteração silenciosa de registros finalizados;
- Permissões apenas no frontend;
- Reutilização de valores atuais de cadastros para reconstruir registros históricos.

---

## 4. Princípios globais de implementação

### 4.1 Prontuário como centro do módulo

O prontuário deve ser o eixo central do Módulo 3.

A partir dele, o usuário deve conseguir visualizar ou acessar:

- Dados do paciente;
- Atendimento atual;
- Timeline clínica;
- Evoluções;
- Registro de enfermagem;
- Fichas;
- Prescrições;
- Problemas ativos;
- Interconsultas;
- Controles assistenciais;
- Documentos;
- Ocorrências;
- Plano de cuidados;
- Uso contínuo;
- Histórico.

### 4.2 Cabeçalho clínico fixo

Nas telas principais do prontuário, exibir cabeçalho fixo com:

- Nome do paciente;
- Nome social;
- Registro/prontuário;
- Idade;
- Sexo;
- Convênio/plano;
- Atendimento atual;
- Data/hora da internação ou atendimento;
- Quarto/leito/setor, quando aplicável;
- Especialidade;
- Profissional responsável;
- Alertas:
  - isolamento;
  - alergias;
  - problemas ativos;
  - alta;
  - pendências;
  - itens críticos de segurança.

### 4.3 Timeline clínica unificada

Sempre que possível, consolidar registros em uma timeline:

- Evolução médica;
- Evolução multidisciplinar;
- Registro de enfermagem;
- Fichas clínicas;
- Prescrição médica;
- Prescrição de enfermagem;
- Problemas ativos;
- Interconsultas;
- Sinais vitais/controles;
- Ocorrências relacionadas ao paciente;
- Plano de cuidados;
- Documentos emitidos;
- Notas e observações;
- Opiniões profissionais.

A timeline deve permitir filtros por:

- Período;
- Tipo de registro;
- Área profissional;
- Profissional;
- Status;
- Cancelados/desativados.

### 4.4 Status e histórico

Para registros clínicos, usar status explícitos.

Status comuns:

- `DRAFT`;
- `ACTIVE`;
- `FINALIZED`;
- `CANCELED`;
- `INACTIVE`;
- `EXPIRED`;
- `RESOLVED`;
- `ENDED`.

Regra geral:

- Registro finalizado não deve ser editado livremente.
- Registro cancelado/desativado permanece no histórico.
- Cancelamento deve exigir motivo ou justificativa.
- Alterações críticas devem gerar log de auditoria.
- Não excluir fisicamente registros assistenciais.

### 4.5 Snapshot de dados

Sempre salvar snapshot quando o dado histórico depender de cadastro que pode mudar.

Exemplos:

- Nome do medicamento na prescrição;
- Frequência usada;
- Via de aplicação;
- Cuidado prescrito;
- Pergunta e alternativa de ficha clínica;
- Procedimento/taxa faturável;
- Plano de cuidado aplicado;
- Status de adesão;
- Descrição de escala;
- Dados de relatório/documento emitido.

---

## 5. Segurança, LGPD, permissões e auditoria

### 5.1 Permissões

Todas as ações críticas devem passar por validação no backend.

Não confiar somente em ocultar botão no frontend.

Permissões devem ser granulares por domínio:

- Visualizar;
- Criar;
- Editar;
- Finalizar;
- Cancelar;
- Reabrir;
- Imprimir;
- Exportar;
- Assinar;
- Visualizar histórico;
- Gerenciar cadastros;
- Gerenciar permissões específicas.

### 5.2 Auditoria

Auditar, no mínimo:

- Criação de registro clínico;
- Edição de registro clínico;
- Finalização;
- Cancelamento/desativação;
- Reabertura;
- Impressão/exportação relevante;
- Emissão/envio de documentos;
- Alteração de permissões;
- Alteração de cadastros críticos;
- Acesso ao portal familiar;
- Ações CCIH;
- Faturamento ou mudança de valor;
- Ocorrências e anonimato.

Campos mínimos de auditoria:

- Entidade;
- ID da entidade;
- Ação;
- Usuário;
- Profissional, quando aplicável;
- Data/hora;
- Valores anteriores e novos, quando aplicável;
- Motivo/justificativa;
- IP/user-agent, se disponível.

### 5.3 Dados sensíveis

Dados sensíveis exigem cuidado especial:

- Diagnósticos;
- CID;
- Evoluções de psicologia/psiquiatria;
- Dependência química;
- Fotos clínicas;
- Opinião profissional;
- Interconsultas;
- Notas privadas;
- Portal familiar;
- Documentos enviados para terceiros.

Não expor esses dados para usuário sem permissão.

---

# 6. Backlog consolidado do Módulo 3

## Épico 1 — Cadastros base do prontuário

### 1.1 Frequências

Criar cadastro de frequências usado em prescrições, medicações, cuidados e protocolos.

Campos sugeridos:

- Código;
- Descrição;
- Tipo;
- Intervalo/horários;
- Ativo/inativo;
- Dados de controle.

Requisitos:

- Listar frequências;
- Criar;
- Editar;
- Desativar;
- Reativar;
- Definir horários quando aplicável;
- Impedir uso de frequência inativa em novos registros;
- Manter histórico se frequência já foi usada.

Permissões sugeridas:

```txt
frequencies.read
frequencies.create
frequencies.update
frequencies.deactivate
```

---

## Épico 2 — Fichas clínicas, questionários e modelos

### 2.1 Fichas de atendimento e questionários

Criar motor de fichas clínicas configuráveis.

Deve suportar:

- Ficha médica;
- Ficha de enfermagem;
- Ficha multidisciplinar;
- Questionários reutilizáveis;
- Perguntas;
- Alternativas;
- Tipos de resposta;
- Obrigatoriedade;
- Ordem;
- Ativo/inativo;
- Versionamento ou snapshot no preenchimento.

Tipos de resposta recomendados:

- Texto curto;
- Texto longo;
- Número;
- Data;
- Hora;
- Sim/não;
- Seleção única;
- Múltipla escolha;
- Escala;
- Opção com complemento textual.

Entidades sugeridas:

- `ClinicalFormTemplate`;
- `ClinicalFormSection`;
- `ClinicalQuestion`;
- `ClinicalQuestionOption`;
- `ClinicalFormTemplateQuestion`;
- `ClinicalFormInstance`;
- `ClinicalFormInstanceAnswer`.

Regras:

- Ficha inativa não aparece para novo preenchimento.
- Ficha preenchida deve preservar snapshot das perguntas e alternativas.
- Alterar modelo não altera ficha histórica.
- Perguntas obrigatórias devem ser validadas antes de finalizar.
- Ficha cancelada permanece no histórico.

Permissões sugeridas:

```txt
clinical_form_templates.read
clinical_form_templates.create
clinical_form_templates.update
clinical_form_templates.deactivate
clinical_form_templates.manage_questions

clinical_form_instances.read
clinical_form_instances.create
clinical_form_instances.update
clinical_form_instances.finalize
clinical_form_instances.cancel
clinical_form_instances.print
```

### 2.2 Modelos SAE

Criar modelos SAE reutilizáveis em registro de enfermagem.

Requisitos:

- Criar modelo;
- Editar;
- Desativar;
- Associar especialidade/profissional, se necessário;
- Inserir modelo em registro de enfermagem;
- Permitir edição do texto após inserir;
- Preservar texto final no registro.

Não implementar SAE clínica completa NANDA/NIC/NOC sem validação.

---

## Épico 3 — Cuidados e prescrição de enfermagem

### 3.1 Cadastro de cuidados de enfermagem

Criar cadastro de cuidados usados em prescrição/solicitação de enfermagem.

Campos sugeridos:

- Código;
- Descrição;
- Grupo;
- Local de atendimento permitido;
- Produtos associados, se houver;
- Frequência sugerida;
- Ativo/inativo;
- Dados de controle.

Requisitos:

- Listar cuidados;
- Criar;
- Editar;
- Desativar;
- Associar produtos de forma apenas cadastral;
- Associar locais/setores, se necessário;
- Usar em prescrição de enfermagem.

Não assumir estoque, baixa automática ou faturamento.

### 3.2 Prescrição de enfermagem

Criar fluxo para prescrição/solicitação de cuidados de enfermagem.

Requisitos:

- Criar prescrição vinculada ao atendimento;
- Informar data/hora;
- Informar validade;
- Informar responsável;
- Informar centro de custo, se usado;
- Adicionar cuidados;
- Definir frequência;
- Definir início/fim;
- Informar observação;
- Marcar cuidado contínuo;
- Cancelar item com motivo;
- Imprimir prescrição;
- Gerar mapa/grade de checagem imprimível.

Entidades sugeridas:

- `NursingPrescription`;
- `NursingPrescriptionItem`;
- `NursingPrescriptionSchedule`;
- `NursingContinuousCare`;
- `NursingPrescriptionPrintHistory`.

Fora de escopo inicial:

- Execução digital completa dos cuidados;
- Checagem com assinatura digital;
- Farmácia;
- Estoque;
- Faturamento;
- Aprazamento avançado.

---

## Épico 4 — Registro de enfermagem

### 4.1 Registro de enfermagem

Criar registro assistencial de enfermagem.

Tipos sugeridos:

- Histórico;
- Evolução;
- Diagnóstico;
- Avaliação de resultado;
- Anotação.

Requisitos:

- Criar registro;
- Selecionar tipo;
- Usar modelo SAE;
- Preencher texto livre;
- Salvar rascunho, se confirmado;
- Finalizar;
- Cancelar com motivo;
- Imprimir;
- Visualizar histórico;
- Exibir na timeline.

Entidades sugeridas:

- `NursingRecord`;
- `NursingRecordStatusHistory`.

Regras:

- Texto obrigatório para finalizar.
- Atendimento encerrado bloqueia novo registro comum.
- Registro finalizado não edita livremente.
- Cancelamento exige motivo.
- Histórico preservado.

### 4.2 Anotações do atendimento

Criar recurso simples de anotação vinculada ao atendimento.

Requisitos:

- Criar anotação;
- Listar;
- Editar enquanto permitido;
- Cancelar/inativar com motivo;
- Registrar usuário/data;
- Exibir no prontuário.

Entidade sugerida:

- `AttendanceNote`.

Diferença recomendada:

- Registro de enfermagem = documento assistencial formal.
- Anotação do atendimento = observação simples operacional/clínica.

---

## Épico 5 — Problemas ativos do paciente e CID-10

### 5.1 Problemas ativos

Criar recurso centralizado de problemas ativos do paciente.

Requisitos:

- Criar problema;
- Associar CID-10 opcional ou obrigatório conforme validação;
- Descrever diagnóstico/problema;
- Definir tipo;
- Definir data de início;
- Resolver problema;
- Cancelar problema;
- Relacionar problemas;
- Listar ativos;
- Consultar histórico.

Entidades sugeridas:

- `PatientProblem`;
- `PatientProblemHistory`;
- `PatientProblemRelation`.

Regras:

- Problema ativo aparece em destaque no prontuário.
- Problema resolvido sai de ativos e permanece no histórico.
- Problema cancelado permanece auditável.
- Não duplicar entidade por área. Médico, enfermagem e multidisciplinar compartilham os mesmos problemas.

### 5.2 CID-10

Criar pesquisa/autocomplete de CID-10.

Requisitos:

- Buscar por código;
- Buscar por descrição;
- Selecionar CID;
- Associar a problema/diagnóstico;
- Suportar tabela importada/seed ou cadastro manual.

Ponto a validar:

- Base CID-10 será importada, cadastrada manualmente ou reduzida?

---

## Épico 6 — Uso multidisciplinar

Criar área de uso multidisciplinar dentro do prontuário.

Requisitos:

- Pesquisar paciente;
- Abrir visão multidisciplinar;
- Criar evolução multidisciplinar;
- Selecionar especialidade;
- Informar profissional;
- Preencher texto livre;
- Copiar evolução anterior;
- Usar fichas multidisciplinares;
- Ver problemas ativos;
- Ver anotações;
- Imprimir evolução;
- Cancelar com motivo.

Entidades sugeridas:

- `MultidisciplinaryEvolution`;
- `MultidisciplinaryEvolutionPrintHistory`.

Regras:

- Evolução finalizada não edita livremente.
- Copiar evolução anterior cria novo registro.
- Fichas multidisciplinares reutilizam o motor de fichas clínicas.
- Problemas ativos são centralizados.

Fora de escopo sem validação:

- Receita completa;
- Encaminhamento externo formal;
- Interconsulta completa, caso não confirmada;
- Assinatura digital.

---

## Épico 7 — Uso médico e prescrição médica

### 7.1 Uso médico

Criar aba/área médica do prontuário.

Requisitos:

- Visualizar cabeçalho do paciente;
- Ver problemas ativos;
- Ver anotações;
- Acessar evolução médica;
- Acessar prescrição médica;
- Acessar consulta do prontuário;
- Acessar documentos, se aplicável.

### 7.2 Evolução médica

Requisitos:

- Criar evolução;
- Preencher texto livre;
- Informar data/hora;
- Registrar profissional;
- Finalizar;
- Cancelar com motivo;
- Imprimir;
- Exibir histórico;
- Exibir na timeline.

Entidade sugerida:

- `MedicalEvolution`.

### 7.3 Prescrição médica

Criar prescrição médica com itens de diferentes tipos.

Tipos de item:

- Medicamento;
- Dieta;
- Cuidado;
- Exame/procedimento, se confirmado;
- Outros.

Requisitos:

- Criar prescrição;
- Definir data/hora;
- Definir validade;
- Definir prescritor;
- Adicionar medicamento;
- Adicionar dieta;
- Adicionar cuidado;
- Duplicar prescrição anterior;
- Cancelar item;
- Imprimir;
- Gerar mapa/grade de checagem;
- Salvar snapshot dos itens.

Entidades sugeridas:

- `MedicalPrescription`;
- `MedicalPrescriptionItem`;
- `PrescriptionSchedule`;
- `PrescriptionPrintHistory`.

Fora de escopo inicial:

- Administração digital de medicamentos;
- Código de barras;
- Farmácia completa;
- Estoque;
- Baixa automática;
- Interação medicamentosa;
- Dose por peso;
- Receita digital oficial.

### 7.4 Medicamentos e dietas

Criar cadastros simples, se necessários:

- `Medication`;
- `MedicationRoute`;
- `Diet`.

Medicamentos devem suportar:

- Nome;
- Nome comercial;
- Forma de apresentação;
- Código;
- Ativo/inativo.

Não assumir bulário externo.

---

## Épico 8 — Uso contínuo, medicação programada e protocolos

### 8.1 Uso contínuo do paciente

Criar visão de uso contínuo com:

- Medicamentos;
- Dietas;
- Cuidados;
- Ativos;
- Finalizados;
- Cancelados.

Requisitos:

- Listar itens contínuos;
- Criar item;
- Encerrar;
- Cancelar;
- Reutilizar em prescrição;
- Exibir origem:
  - manual;
  - prescrição;
  - protocolo.

Entidade sugerida:

- `PatientContinuousUseItem`.

### 8.2 Medicação programada

Requisitos:

- Listar medicação programada;
- Filtrar finalizados/cancelados;
- Abrir detalhe;
- Cancelar com motivo;
- Exibir responsável e período.

Entidade sugerida:

- `ScheduledMedication`.

### 8.3 Protocolos de uso contínuo

Criar cadastro de protocolos reutilizáveis.

Tipos:

- Uso contínuo;
- Medicação programada;
- Ambos.

Itens do protocolo:

- Medicamentos;
- Dietas;
- Cuidados.

Requisitos:

- Criar protocolo;
- Adicionar medicamento;
- Adicionar dieta;
- Adicionar cuidado;
- Associar profissionais;
- Desativar;
- Aplicar protocolo ao paciente/prescrição com revisão;
- Detectar duplicidades.

Entidades sugeridas:

- `ContinuousUseProtocol`;
- `ContinuousUseProtocolMedication`;
- `ContinuousUseProtocolDiet`;
- `ContinuousUseProtocolCare`;
- `ContinuousUseProtocolProfessional`.

Regra importante:

- Alteração no protocolo afeta apenas aplicações futuras.
- Ao aplicar, salvar snapshot.

---

## Épico 9 — Interconsultas e avaliação de outra especialidade

Criar fluxo centralizado de interconsultas.

Requisitos:

- Solicitar avaliação/interconsulta;
- Informar especialidade solicitada;
- Informar profissional desejado, opcional;
- Informar motivo;
- Informar resumo clínico;
- Listar solicitações pendentes/avaliadas/canceladas;
- Registrar resposta;
- Transferir para outra especialidade, se confirmado;
- Imprimir solicitação/resposta;
- Exibir status e timeline.

Status sugeridos:

- `REQUESTED`;
- `IN_ANALYSIS`;
- `EVALUATED`;
- `TRANSFERRED`;
- `CANCELED`;
- `REFUSED`;
- `COMPLETED`.

Entidades sugeridas:

- `SpecialtyConsultationRequest`;
- `SpecialtyConsultationResponse`;
- `SpecialtyTransferHistory`.

Fora de escopo inicial:

- Chat entre profissionais;
- SLA;
- Agenda automática;
- Notificações em tempo real;
- Aceite formal complexo.

---

## Épico 10 — Passagem de plantão

Criar recurso de passagem de plantão de enfermagem.

Requisitos:

- Pesquisar passagens;
- Filtrar por setor/data;
- Criar passagem por setor;
- Informar responsável;
- Informar data/hora;
- Carregar pacientes ativos do setor;
- Selecionar pacientes;
- Registrar observação geral;
- Registrar observação por paciente, se confirmado;
- Finalizar;
- Cancelar com motivo;
- Imprimir relatório resumido e completo.

Entidades sugeridas:

- `NursingShiftHandover`;
- `NursingShiftHandoverPatient`;
- `NursingShiftHandoverPrintHistory`.

Regra:

- Ao finalizar, preservar snapshot dos dados do paciente/leito/setor.

---

## Épico 11 — Consulta de prontuário, notas, opinião profissional e arquivamento

### 11.1 Consulta de prontuário

Criar tela de consulta com timeline.

Requisitos:

- Exibir eventos do prontuário;
- Filtrar por tipo/data/profissional;
- Abrir detalhe;
- Ver prescrições;
- Ver evoluções;
- Ver registros de enfermagem;
- Ver fichas;
- Ver problemas;
- Ver interconsultas;
- Ver documentos;
- Ver contínuos;
- Respeitar permissões.

Pode ser uma read model:

- `MedicalRecordEvent`.

### 11.2 Notas e observações

Criar nota/observação no prontuário.

Entidade sugerida:

- `MedicalRecordNote`.

Regras:

- Texto obrigatório.
- Cancelamento com motivo.
- Exibir na timeline.

### 11.3 Opinião profissional

Criar opinião profissional com controle de visibilidade.

Modos de compartilhamento:

- Privada;
- Mesma especialidade;
- Profissionais selecionados;
- Todos os profissionais autorizados.

Entidades sugeridas:

- `ProfessionalOpinion`;
- `ProfessionalOpinionRecipient`;
- `ProfessionalOpinionSpecialty`.

Regra crítica:

- Visibilidade deve ser aplicada no backend.
- Opinião privada não deve aparecer em listagens, impressões ou portal sem permissão.

### 11.4 Arquivamento/impressão

Criar fluxo guiado para exportar/imprimir partes do prontuário.

Requisitos:

- Selecionar período;
- Selecionar tipos de registros;
- Pré-visualizar;
- Imprimir;
- Exportar PDF, se confirmado.

Fora de escopo:

- PDF consolidado complexo;
- Assinatura digital;
- OCR;
- IA.

---

## Épico 12 — Portal familiar / prontuário web externo

Funcionalidade opcional e sensível. Não implementar sem confirmação.

Se confirmada, tratar como portal somente leitura para familiar/responsável autorizado.

Requisitos:

- Usuário externo separado dos usuários internos;
- Vínculo explícito com paciente;
- Escopo de visualização;
- Login;
- Troca de senha;
- Revogação;
- Expiração;
- Auditoria de acesso;
- Consulta por período;
- Abas liberadas:
  - evoluções médicas;
  - prescrições médicas;
  - uso contínuo;
  - evoluções multidisciplinares;
  - registros de enfermagem;
  - prescrições de enfermagem;
  - cuidados contínuos;
  - fotos, se confirmado.

Entidades sugeridas:

- `PortalUser`;
- `PatientPortalAccess`;
- `PatientPortalAccessScope`;
- `PatientPortalPublishedRecord`;
- `PatientPortalAccessLog`.

Regras:

- Nada sensível deve aparecer por padrão.
- Fotos e evoluções multidisciplinares exigem cuidado especial.
- Opinião profissional privada nunca deve aparecer.
- Backend deve bloquear acesso não autorizado.

---

## Épico 13 — Avaliação multiaxial

Funcionalidade específica, provavelmente ligada a saúde mental/psiquiatria.

Validar antes do MVP.

Duas opções:

1. Tela própria;
2. Reutilizar motor de fichas clínicas.

Recomendação:

- Preferir motor de fichas clínicas, salvo se cliente confirmar uso central e regras específicas.

Campos/eixos observados:

- Eixo I;
- Eixo II;
- Eixo III;
- Eixo IV;
- Eixo V;
- Diagnóstico por eixo;
- Data do diagnóstico;
- Responsável.

Entidade própria, se necessário:

- `MultiaxialAssessment`;
- `MultiaxialAssessmentAxis`.

Fora de escopo:

- DSM/CID automático;
- Sugestão diagnóstica;
- Scores;
- Assinatura digital;
- Exposição automática no portal familiar.

---

## Épico 14 — CCIH, controle de antimicrobianos e formulários para prescrição

Funcionalidade avançada e sensível. Validar antes de incluir no MVP.

### 14.1 Painel CCIH

Requisitos:

- Listar tratamentos sujeitos à CCIH;
- Filtrar por período/paciente/status/produto;
- Ver problemas ativos;
- Ver medicamentos recentes;
- Registrar parecer;
- Liberar/não liberar;
- Sugerir alteração;
- Confirmar leitura pelo médico;
- Registrar ação adotada.

Entidades sugeridas:

- `CcihReview`;
- `CcihReviewHistory`;
- `CcihReviewAcknowledgement`.

Status sugeridos:

- Pendente;
- Em análise;
- Liberado;
- Não liberado;
- Alteração sugerida;
- Leitura confirmada;
- Alteração aplicada;
- Tratamento interrompido.

Regra importante:

- Não bloquear prescrição automaticamente sem validação explícita.
- Começar com alerta/pendência/parecer, se o cliente usar.

### 14.2 Formulários para prescrição

Criar templates de formulários vinculados a produto/medicamento/procedimento.

Requisitos:

- Criar formulário;
- Definir tipo;
- Definir textos;
- Definir perguntas;
- Vincular a produto;
- Trocar formulário em produtos;
- Salvar respostas no momento da prescrição;
- Exibir respostas no painel CCIH, se aplicável.

Entidades sugeridas:

- `PrescriptionFormTemplate`;
- `PrescriptionFormQuestion`;
- `PrescriptionFormResponse`;
- `PrescriptionFormAnswer`;
- `ProductPrescriptionForm`.

Reutilizar motor de questionários quando possível.

Fora de escopo:

- Protocolos automáticos de antibioticoterapia;
- Dose por função renal;
- Integração laboratório;
- Indicadores epidemiológicos avançados.

---

## Épico 15 — Uso médico ambulatorial, documentos clínicos e finalização

### 15.1 Atendimento médico ambulatorial

Criar fluxo integrado com agenda/fila.

Requisitos:

- Abrir atendimento;
- Visualizar resumo;
- Registrar evolução;
- Ver problemas;
- Registrar diagnósticos;
- Emitir documentos;
- Solicitar exames, se confirmado;
- Finalizar consulta.

Entidade sugerida:

- `AmbulatoryMedicalEncounter`.

### 15.2 Documentos clínicos

Tipos:

- Receita;
- Atestado;
- Encaminhamento;
- Solicitação de exame;
- Relatório;
- Outro.

Requisitos:

- Criar documento;
- Editar rascunho;
- Emitir;
- Imprimir;
- Enviar por e-mail/WhatsApp, se confirmado;
- Cancelar com motivo;
- Consultar histórico;
- Salvar snapshot do conteúdo.

Entidades sugeridas:

- `ClinicalDocument`;
- `ClinicalDocumentSendHistory`.

Fora de escopo inicial:

- Receita digital oficial;
- Assinatura digital certificada;
- WhatsApp Business oficial;
- SMTP transacional;
- Telemedicina.

### 15.3 Finalização da consulta

Requisitos:

- Checklist de pendências;
- Desfecho;
- Observação;
- Assinatura simples pelo usuário logado;
- Bloqueio após finalização;
- Reabertura com motivo e permissão.

Desfechos possíveis:

- Alta;
- Retorno;
- Encaminhamento;
- Solicitação de exames;
- Encaminhado para outra especialidade;
- Atendimento concluído.

---

## Épico 16 — Controles assistenciais e escalas

Criar área de controles assistenciais.

Escalas observadas no menu:

- Avaliação de Dor;
- Braden;
- Braden Neonatal;
- Braden Q;
- Dow;
- Fugulin;
- Humpty Dumpty;
- Maddox;
- Morse;
- PEWS;
- MEOWS.

Não implementar todas sem validação.

### 16.1 Avaliação de dor

Tipos observados:

- EVA;
- EVN;
- FLACC;
- NIPs.

Requisitos:

- Listar avaliações;
- Criar avaliação;
- Calcular pontuação;
- Exibir resultado;
- Registrar localização da dor;
- Registrar observação;
- Registrar conduta;
- Cancelar/desativar com justificativa;
- Exibir na timeline.

Entidades sugeridas:

- `ClinicalScaleAssessment`;
- `ClinicalScaleAnswer`.

### 16.2 Escala de Maddox

Requisitos:

- Listar avaliações;
- Exibir tabela de referência;
- Selecionar pontuação;
- Registrar resultado;
- Cancelar/desativar com justificativa.

Entidade sugerida:

- `MaddoxScaleLevel`.

Observação:

- Textos exatos da escala devem ser validados.

Fora de escopo:

- Motor configurável completo de escalas;
- Alertas automáticos;
- Gráficos avançados;
- Protocolos automáticos.

---

## Épico 17 — Ocorrências e controles

### 17.1 Tipos de ocorrência

Criar cadastro de tipos.

Campos:

- Código;
- Descrição;
- Relacionada ao paciente;
- Ativo/inativo.

Entidade:

- `OccurrenceType`.

### 17.2 Cadastro/modelo de ocorrência

Campos:

- Código;
- Descrição;
- Tipo;
- Permite registro anônimo;
- Observações;
- Pessoas associáveis;
- Dispositivos/serviços associáveis.

Entidades:

- `OccurrenceDefinition`;
- `OccurrenceAssociatedPersonRule`;
- `OccurrenceAssociatedDeviceServiceRule`.

### 17.3 Registro operacional de ocorrência

Criar registro de ocorrência real.

Requisitos:

- Vincular a paciente, se tipo exigir;
- Vincular a atendimento, preferencialmente;
- Informar data/hora;
- Informar local/setor;
- Descrever ocorrido;
- Informar conduta imediata;
- Associar pessoas envolvidas;
- Associar dispositivos/serviços;
- Permitir anonimato quando configurado;
- Acompanhar status;
- Cancelar/resolver;
- Exibir na timeline, se relacionada ao paciente.

Entidades:

- `OccurrenceReport`;
- `OccurrenceReportPerson`;
- `OccurrenceReportDeviceService`;
- `DeviceService`.

Regra de anonimato:

- Validar se é anonimato real ou ocultação do autor.
- Recomendação inicial: ocultar autor para usuários comuns e preservar log restrito.

Fora de escopo:

- Workflow completo de segurança do paciente;
- Matriz de risco;
- BI;
- Notificação regulatória;
- Investigação avançada.

---

## Épico 18 — Fatura direta, procedimentos, taxas e TISS

Funcionalidade administrativa/financeira. Validar cuidadosamente antes do MVP.

Requisitos se confirmada:

- Criar conta/fatura do atendimento;
- Listar procedimentos/taxas;
- Incluir item faturável;
- Informar quantidade;
- Calcular valor;
- Informar centro de custo;
- Informar profissional executante;
- Informar especialidade;
- Marcar item como faturado;
- Cancelar item;
- Configurar usuário por tipo de serviço;
- Pesquisar item TISS como referência.

Entidades sugeridas:

- `DirectBillingAccount`;
- `DirectBillingItem`;
- `BillableProcedure`;
- `TissItem`;
- `UserDirectBillingServiceType`.

Permissões críticas:

```txt
direct_billing_items.change_value
direct_billing_items.bill
direct_billing_items.cancel
user_direct_billing_service_types.manage
```

Fora de escopo:

- Financeiro completo;
- Nota fiscal;
- Pagamento;
- Convênio completo;
- XML TISS;
- Guias;
- Remessas;
- Glosas;
- Repasse profissional completo.

---

## Épico 19 — Plano de cuidados

Parte 21 do levantamento.

### 19.1 Contexto observado

As telas mostram a funcionalidade **Plano de Cuidados**, incluindo:

- Menu de configuração;
- Cadastro de planos de cuidado;
- Tópicos;
- Status de adesão;
- Pesquisa/listagem de planos de cuidado;
- Plano de cuidado aplicado ao paciente;
- Controle do plano de cuidados do paciente;
- Campos de descrição/caso, objetivos, barreiras, prioridade e recomendações;
- Vínculo com especialidade;
- Configuração de quais áreas podem preencher:
  - Medicina;
  - Enfermagem;
  - Equipe multiprofissional;
- Configuração de quais dados aparecem no preenchimento do plano.

### 19.2 Cadastro de plano de cuidados

Criar cadastro de modelos de plano de cuidados.

Campos observados/inferidos:

- Código;
- Descrição;
- Plano terapêutico;
- Permissões de preenchimento por área:
  - médico;
  - enfermagem;
  - equipe multiprofissional;
- Especialidades associadas;
- Dados a apresentar no preenchimento:
  - tópico/caso;
  - descrição/caso;
  - barreiras/dificuldades;
  - objetivos;
  - prioridade;
  - recomendações;
  - data de início;
  - prazo;
  - data de conclusão;
  - metas;
  - observação;
  - status de adesão;
  - monitoramento;
  - manter pendência de contato, se confirmado.

Entidade sugerida:

- `CarePlanTemplate`.

Entidades auxiliares:

- `CarePlanTemplateSpecialty`;
- `CarePlanTemplateVisibleField`;
- `CarePlanTemplateAllowedRole`.

Regras:

- Plano inativo não deve aparecer para nova aplicação.
- Alterações no modelo não devem alterar planos já aplicados.
- Especialidades associadas limitam ou sugerem o uso do plano.
- Áreas autorizadas definem quem pode preencher.

### 19.3 Tópicos

Criar cadastro de tópicos usados no plano de cuidados.

Campos:

- Código;
- Descrição;
- Inclusão;
- Responsável pela inclusão;
- Ativo/inativo.

Entidade:

- `CarePlanTopic`.

Requisitos:

- Listar;
- Criar;
- Editar;
- Desativar;
- Reativar;
- Usar em plano aplicado ao paciente.

### 19.4 Status de adesão

Criar cadastro de status de adesão.

Exemplos observados:

- Aderente;
- Pouco aderente intercorrencial;
- Pouco aderente não intercorrencial.

Campos:

- Código;
- Descrição;
- Inclusão;
- Responsável;
- Ativo/inativo.

Entidade:

- `CarePlanAdherenceStatus`.

Requisitos:

- Listar;
- Criar;
- Editar;
- Desativar;
- Usar no plano de cuidado aplicado ao paciente.

### 19.5 Plano de cuidados do paciente

Criar funcionalidade para aplicar um plano de cuidados a um paciente/atendimento.

Campos observados/inferidos:

- Paciente;
- Registro;
- Plano de cuidado;
- Projeto;
- Local de atendimento;
- Data;
- Tópico;
- Descrição/caso;
- Objetivos;
- Barreiras/dificuldades;
- Prioridade;
- Recomendações;
- Data de início;
- Prazo de avaliação;
- Status de adesão;
- Observação;
- Profissional responsável;
- Área profissional.

Entidade sugerida:

- `PatientCarePlan`.

Entidades complementares:

- `PatientCarePlanEntry`;
- `PatientCarePlanStatusHistory`.

Requisitos:

- Aplicar plano ao paciente;
- Selecionar plano de cuidado;
- Selecionar projeto, se usado;
- Selecionar local de atendimento;
- Preencher campos conforme configuração do modelo;
- Registrar tópico/caso;
- Registrar objetivos;
- Registrar barreiras/dificuldades;
- Registrar recomendações;
- Definir prioridade;
- Definir status de adesão;
- Definir data de início/prazo;
- Listar planos aplicados;
- Editar enquanto permitido;
- Desativar/cancelar com justificativa;
- Exibir na timeline do prontuário;
- Respeitar área profissional autorizada.

### 19.6 Controle do plano de cuidados do paciente

A tela "Controle do Plano de Cuidados do Paciente" mostra uma visão de acompanhamento de um plano aplicado.

Requisitos:

- Abrir controle de plano aplicado;
- Ver paciente e plano;
- Ver tipo/status;
- Preencher detalhe/descrição;
- Preencher objetivos;
- Preencher barreiras/dificuldades;
- Preencher prioridade;
- Preencher recomendações;
- Informar data de início;
- Salvar acompanhamento;
- Registrar profissional e data/hora.

### 19.7 Regras de bloqueio

Bloquear ao aplicar plano se:

- Paciente não informado;
- Atendimento obrigatório não informado, se a regra for adotada;
- Plano inativo;
- Usuário sem permissão;
- Área profissional do usuário não autorizada no plano;
- Especialidade incompatível, se a regra for obrigatória.

Bloquear ao editar se:

- Plano aplicado estiver cancelado/desativado;
- Atendimento estiver encerrado sem permissão especial;
- Usuário não tiver permissão;
- Campo obrigatório configurado não foi preenchido.

### 19.8 Permissões sugeridas

```txt
care_plan_templates.read
care_plan_templates.create
care_plan_templates.update
care_plan_templates.deactivate
care_plan_templates.manage_specialties
care_plan_templates.manage_visible_fields

care_plan_topics.read
care_plan_topics.create
care_plan_topics.update
care_plan_topics.deactivate

care_plan_adherence_statuses.read
care_plan_adherence_statuses.create
care_plan_adherence_statuses.update
care_plan_adherence_statuses.deactivate

patient_care_plans.read
patient_care_plans.create
patient_care_plans.update
patient_care_plans.cancel
patient_care_plans.view_history
```

### 19.9 Melhorias de usabilidade

- Criar aba “Plano de cuidados” no prontuário.
- Mostrar planos ativos do paciente em cards.
- Usar status visual de adesão.
- Permitir acompanhamento por tópicos.
- Exibir histórico das alterações/acompanhamentos.
- Evitar modal legado; usar drawer ou tela dedicada.
- Exibir apenas campos configurados no modelo.
- Mostrar claramente quem pode preencher o plano.

### 19.10 Fora de escopo

Não implementar sem validação:

- Plano terapêutico avançado com metas mensuráveis automáticas;
- Workflow de aprovação;
- Assinatura digital;
- Notificações automáticas;
- Indicadores de adesão;
- Relatórios gerenciais;
- Integração com portal familiar;
- Geração automática por IA.

---

# 7. Modelo de dados consolidado sugerido

Esta seção lista entidades principais. Não é necessário criar tudo no primeiro sprint. Implementar conforme backlog priorizado.

## Núcleo

```txt
Patient
Attendance
Professional
Specialty
User
Permission
Role/Group
AuditLog
CancellationReason
```

## Prontuário

```txt
MedicalRecordEvent
MedicalRecordNote
ProfessionalOpinion
ProfessionalOpinionRecipient
ProfessionalOpinionSpecialty
```

## Fichas

```txt
ClinicalFormTemplate
ClinicalFormSection
ClinicalQuestion
ClinicalQuestionOption
ClinicalFormTemplateQuestion
ClinicalFormInstance
ClinicalFormInstanceAnswer
ClinicalFormInstanceHistory
```

## Enfermagem

```txt
NursingRecord
NursingRecordStatusHistory
NursingPrescription
NursingPrescriptionItem
NursingPrescriptionSchedule
NursingContinuousCare
NursingShiftHandover
NursingShiftHandoverPatient
```

## Médico

```txt
MedicalEvolution
MedicalPrescription
MedicalPrescriptionItem
PrescriptionSchedule
Medication
MedicationRoute
Diet
ContinuousMedication
ContinuousDiet
```

## Multidisciplinar

```txt
MultidisciplinaryEvolution
```

## Problemas e CID

```txt
PatientProblem
PatientProblemHistory
PatientProblemRelation
Cid10
```

## Interconsulta

```txt
SpecialtyConsultationRequest
SpecialtyConsultationResponse
SpecialtyTransferHistory
```

## Uso contínuo e protocolos

```txt
PatientContinuousUseItem
ScheduledMedication
ContinuousUseProtocol
ContinuousUseProtocolMedication
ContinuousUseProtocolDiet
ContinuousUseProtocolCare
ContinuousUseProtocolProfessional
```

## CCIH e formulários de prescrição

```txt
CcihReview
CcihReviewHistory
CcihReviewAcknowledgement
PrescriptionFormTemplate
PrescriptionFormQuestion
PrescriptionFormResponse
PrescriptionFormAnswer
ProductPrescriptionForm
```

## Controles e escalas

```txt
ClinicalScaleAssessment
ClinicalScaleAnswer
MaddoxScaleLevel
```

## Ocorrências

```txt
OccurrenceType
OccurrenceDefinition
OccurrenceReport
OccurrenceReportPerson
OccurrenceReportDeviceService
DeviceService
```

## Documentos clínicos e ambulatório

```txt
AmbulatoryMedicalEncounter
ClinicalDocument
ClinicalDocumentSendHistory
AmbulatoryEncounterStatusHistory
```

## Portal familiar

```txt
PortalUser
PatientPortalAccess
PatientPortalAccessScope
PatientPortalPublishedRecord
PatientPortalAccessLog
```

## Plano de cuidados

```txt
CarePlanTemplate
CarePlanTemplateSpecialty
CarePlanTemplateVisibleField
CarePlanTemplateAllowedRole
CarePlanTopic
CarePlanAdherenceStatus
PatientCarePlan
PatientCarePlanEntry
PatientCarePlanStatusHistory
```

## Fatura direta

```txt
DirectBillingAccount
DirectBillingItem
BillableProcedure
TissItem
UserDirectBillingServiceType
```

---

# 8. Padrões de API sugeridos

Usar padrão REST consistente.

Exemplos:

```txt
GET    /patients/:patientId/medical-record
GET    /patients/:patientId/medical-record/timeline

GET    /attendances/:attendanceId/nursing-records
POST   /attendances/:attendanceId/nursing-records
PATCH  /nursing-records/:id
POST   /nursing-records/:id/finalize
POST   /nursing-records/:id/cancel

GET    /attendances/:attendanceId/medical-prescriptions
POST   /attendances/:attendanceId/medical-prescriptions
POST   /medical-prescriptions/:id/finalize
POST   /medical-prescriptions/:id/cancel

GET    /attendances/:attendanceId/patient-problems
POST   /attendances/:attendanceId/patient-problems
POST   /patient-problems/:id/resolve
POST   /patient-problems/:id/cancel

GET    /clinical-form-templates
POST   /clinical-form-templates
POST   /attendances/:attendanceId/clinical-form-instances
POST   /clinical-form-instances/:id/finalize
POST   /clinical-form-instances/:id/cancel

GET    /attendances/:attendanceId/care-plans
POST   /attendances/:attendanceId/care-plans
PATCH  /patient-care-plans/:id
POST   /patient-care-plans/:id/cancel
```

Para ações que mudam status, preferir endpoints explícitos:

```txt
/finalize
/cancel
/resolve
/reopen
/print
/archive
/apply
/acknowledge
```

Evitar update genérico para ações clínicas críticas.

---

# 9. Padrões de frontend sugeridos

## 9.1 Componentes reutilizáveis

Criar componentes reutilizáveis:

- `PatientClinicalHeader`;
- `MedicalRecordTimeline`;
- `ClinicalEventCard`;
- `ClinicalTextEditor`;
- `ConfirmCancelDialog`;
- `CancellationReasonDialog`;
- `ClinicalFormRenderer`;
- `ClinicalFormBuilder`;
- `PrescriptionItemTable`;
- `MedicationSearch`;
- `Cid10Autocomplete`;
- `ProfessionalSelect`;
- `SpecialtySelect`;
- `FrequencySelect`;
- `AuditInfoPanel`;
- `StatusBadge`;
- `PrintPreview`.

## 9.2 Layout recomendado

Evitar janelas pequenas herdadas do legado.

Preferir:

- Abas;
- Drawers laterais;
- Modais grandes apenas quando necessário;
- Tabelas com filtros;
- Cards;
- Timeline;
- Formulários por seções;
- Validações inline.

## 9.3 Estados de tela

Toda tela deve tratar:

- Carregando;
- Erro;
- Sem dados;
- Sem permissão;
- Registro cancelado;
- Atendimento encerrado;
- Conflito de edição;
- Dados obrigatórios ausentes.

---

# 10. Priorização sugerida para MVP

## MVP essencial do prontuário

Priorizar:

1. Cabeçalho clínico do paciente;
2. Consulta de prontuário/timeline;
3. Problemas ativos;
4. Evolução médica;
5. Registro de enfermagem;
6. Anotações do atendimento;
7. Fichas clínicas básicas;
8. Prescrição médica básica;
9. Prescrição/cuidados de enfermagem básica;
10. Uso contínuo básico;
11. Documentos clínicos básicos: receita, atestado, encaminhamento;
12. Finalização de consulta ambulatorial;
13. Plano de cuidados, se confirmado como usado;
14. Auditoria e permissões.

## Pós-MVP / avançado

Deixar para fase posterior, salvo confirmação:

- Portal familiar;
- CCIH;
- Formulários avançados de prescrição;
- Fatura direta;
- TISS;
- Ocorrências completas;
- Escalas além das confirmadas;
- Passagem de plantão;
- Interconsultas avançadas;
- Avaliação multiaxial;
- Administração digital de medicamentos;
- Checagem digital;
- PDF consolidado complexo;
- Assinatura digital;
- WhatsApp/e-mail integrado;
- Farmácia/estoque/financeiro.

---

# 11. Regras globais de bloqueio

Bloquear criação/alteração quando:

- Atendimento estiver encerrado, salvo permissão especial;
- Usuário não tiver permissão;
- Registro estiver cancelado;
- Registro estiver finalizado e não permitir edição;
- Campos obrigatórios estiverem vazios;
- Cadastro relacionado estiver inativo;
- Data final for anterior à data inicial;
- Item já existir de forma duplicada sem confirmação;
- Ação exigir motivo e motivo não foi informado.

Alertar quando:

- Paciente tem alta;
- Registro é retroativo;
- Item já existe com frequência diferente;
- Prescrição está vencida;
- Documento está em rascunho;
- Dados serão omitidos por permissão;
- Registro será cancelado/desativado e permanecerá no histórico.

---

# 12. Observações e lacunas consolidadas

Esta seção deve orientar decisões futuras. O que não ficou claro nas imagens deve ser validado com o cliente.

## Lacunas gerais

- Nem todas as abas do sistema legado foram detalhadas.
- Algumas colunas e campos estão parcialmente legíveis.
- Nem sempre está claro se uma tela representa cadastro, registro operacional ou consulta.
- Muitos fluxos do legado abrem modais sem mostrar o comportamento final.
- Não está claro quais funcionalidades são realmente usadas diariamente pelo cliente.
- Algumas funcionalidades são avançadas e podem ampliar muito o MVP.

## Lacunas específicas

### Fichas e questionários

- Confirmar se ficha tem rascunho e finalização.
- Confirmar se ficha finalizada pode ser editada.
- Confirmar quais fichas entram no MVP.

### Problemas ativos

- Confirmar se CID-10 é obrigatório.
- Confirmar se problema é por paciente ou atendimento.
- Confirmar duplicidade de problemas.

### Prescrição

- Confirmar se prescrição precisa ser renovada diariamente.
- Confirmar se mapa de checagem é apenas impresso ou digital.
- Confirmar se uso contínuo alimenta prescrição automaticamente.

### Medicamentos

- Confirmar origem do cadastro de medicamentos.
- Confirmar se via/frequência/dose são obrigatórias para todos.
- Confirmar se haverá farmácia/estoque.

### Interconsultas

- Confirmar quem pode solicitar e responder.
- Confirmar se transferência altera especialidade principal do atendimento.
- Confirmar se há notificação.

### Portal familiar

- Confirmar se entra no novo sistema.
- Confirmar quem acessa.
- Confirmar quais dados podem ser exibidos.
- Confirmar autorização/consentimento.

### CCIH

- Confirmar se cliente usa.
- Confirmar se bloqueia prescrição.
- Confirmar quem libera/não libera.
- Confirmar se formulário é obrigatório.

### Escalas

- Confirmar quais escalas são usadas.
- Detalhar FLACC, EVN, NIPs.
- Confirmar regra exata da EVA.
- Confirmar tabela completa de Maddox.

### Ocorrências

- Confirmar anonimato real vs ocultação.
- Confirmar pessoas/dispositivos associados.
- Confirmar se ocorrência tem investigação/desfecho.
- Confirmar se entra no prontuário/timeline.

### Fatura direta

- Confirmar se entra no MVP.
- Confirmar se é só lançamento simples ou financeiro real.
- Confirmar se TISS é apenas referência.
- Confirmar se há recibo, nota fiscal, pagamento, glosa ou convênio.

### Plano de cuidados

- Confirmar se entra no MVP.
- Confirmar quem preenche: médico, enfermagem, multiprofissional.
- Confirmar quais campos são obrigatórios.
- Confirmar se status de adesão tem impacto operacional.
- Confirmar se plano aparece no portal familiar.
- Confirmar se há workflow de aprovação ou apenas registro/acompanhamento.

---

# 13. Itens que não devem ser implementados sem validação explícita

Não implementar automaticamente:

- Receita digital oficial;
- Assinatura digital com certificado;
- Integração WhatsApp oficial;
- Envio real de e-mail transacional;
- Farmácia;
- Estoque;
- Baixa automática;
- Administração digital de medicamentos;
- Código de barras obrigatório;
- Laboratório/PACS;
- Faturamento hospitalar completo;
- XML TISS;
- Guias/remessas/glosas;
- Pagamento/nota fiscal/financeiro;
- Portal familiar completo;
- CCIH com bloqueio rígido;
- Protocolos clínicos automáticos;
- IA para resumo/diagnóstico/conduta;
- Todas as escalas assistenciais;
- BI gerencial;
- Notificações automáticas;
- Telemedicina.

---

# 14. Definition of Done do Módulo 3

Uma funcionalidade do Módulo 3 só deve ser considerada pronta quando:

- Possui backend validando permissões;
- Possui validação de campos obrigatórios;
- Possui tratamento de status;
- Possui auditoria quando crítica;
- Não exclui fisicamente registros clínicos;
- Preserva snapshot quando necessário;
- Possui estados de loading/erro/vazio;
- Possui mensagens claras;
- Respeita atendimento encerrado;
- Respeita dados sensíveis;
- Possui testes básicos de regras críticas;
- Está integrada à timeline do prontuário quando aplicável;
- Possui cancelamento/desativação com motivo quando aplicável.

---

# 15. Instruções diretas ao Copilot

Ao gerar código para este módulo:

1. Não copie a estrutura visual do legado sem melhorar a usabilidade.
2. Prefira componentes reutilizáveis.
3. Prefira entidades genéricas quando o mesmo conceito aparece em várias áreas.
4. Não duplique problemas ativos para médico/enfermagem/multidisciplinar.
5. Não crie um motor de formulário diferente para cada área.
6. Use snapshots em registros históricos.
7. Use soft delete/cancelamento/desativação.
8. Implemente permissões no backend.
9. Audite ações críticas.
10. Trate dados sensíveis com cuidado.
11. Não implemente integrações externas sem confirmação.
12. Marque pontos incertos como TODO técnico ou ponto de validação.
13. Ao encontrar regra ambígua, escolha a alternativa mais segura e simples.
14. Ao implementar MVP, priorize fluxo clínico essencial em vez de módulos avançados.
15. Sempre separar:
    - cadastro/modelo;
    - aplicação no paciente;
    - histórico;
    - impressão/consulta;
    - auditoria.

---

# 16. Resumo executivo do Módulo 3

O Módulo 3 deve entregar um prontuário moderno, centralizado e auditável.

O núcleo mais importante é:

- Prontuário unificado;
- Timeline clínica;
- Evoluções;
- Registros de enfermagem;
- Fichas;
- Problemas ativos;
- Prescrições;
- Uso contínuo;
- Documentos clínicos;
- Finalização do atendimento;
- Plano de cuidados, se validado;
- Permissões e auditoria.

Funcionalidades como CCIH, portal familiar, fatura direta, ocorrências completas, escalas avançadas e integrações externas devem ser tratadas como módulos avançados ou fases posteriores, salvo confirmação de prioridade pelo cliente.
