# Copilot Instructions — Módulo 5: Atendimento

Documento consolidado da migração do app legado — **Módulo 5: Atendimento**.  
Baseado nas partes 1 a 22 recebidas no levantamento por imagens.

> Regra importante: tudo que não estiver claro a partir das imagens deve permanecer em **Observações / Pontos a validar**. Não implementar regra definitiva sem confirmação.

---

## 1. Escopo geral do módulo

O Módulo 5 representa a camada operacional de atendimento do sistema legado. Ele cobre:

- Painel da recepção.
- Triagem, acolhimento e classificação de risco.
- Uso médico ambulatorial.
- Uso multidisciplinar ambulatorial.
- Uso enfermagem ambulatorial.
- Controle de filas/status do paciente.
- Chamada de paciente.
- Consulta médica.
- Ficha médica.
- Evolução médica.
- Conduta/prescrição.
- Problemas ativos.
- Hipóteses diagnósticas/CID-10.
- Sinais vitais.
- Documentos clínicos: receita, receita/rede, atestado, encaminhamento e solicitação AIH.
- Pedido de exame para retorno.
- Agendamento de retorno.
- Alta ambulatorial, cancelamento de alta e “não atendeu”.
- Medicação programada, uso contínuo e administração/checagem pela enfermagem.
- Finalização médica, multidisciplinar e enfermagem.
- Fatura de procedimentos/taxas no atendimento multidisciplinar.
- Laudos APAC, incluindo dados complementares de oncologia/quimioterapia/radioterapia.
- Integração Memed para prescrição digital.

O módulo deve reaproveitar, sempre que possível, estruturas já previstas em outros módulos:

- **Módulo 3 / Prontuário**: fichas, evoluções, problemas ativos, documentos clínicos, prescrição, consulta de prontuário, uso contínuo e timeline clínica.
- **Módulo 4 / Agendamento**: agenda, reservas, horários, retorno, faltas e cancelamentos.
- **Cadastros gerais**: pacientes, profissionais, especialidades, locais de atendimento, convênios, planos, procedimentos, medicamentos, CID-10, modelos e protocolos.

---

## 2. Diretrizes de implementação

### 2.1 Separar domínio operacional e domínio clínico

O atendimento deve ser modelado separando:

1. **Fila/status operacional**
   - Aguardando triagem.
   - Aguardando acolhimento.
   - Aguardando consulta.
   - Em consulta.
   - Em procedimento/preparação de exame.
   - Administração de medicamentos.
   - Em observação.
   - Alta.
   - Encaminhado para internação.
   - Encaminhado para outra especialidade.
   - Não atendeu.

2. **Registros clínicos**
   - Ficha médica.
   - Ficha multidisciplinar.
   - Evolução médica.
   - Evolução multidisciplinar.
   - Problemas ativos.
   - Diagnósticos/CID.
   - Sinais vitais.
   - Anotações de enfermagem.
   - Prescrição/conduta.

3. **Documentos e relatórios**
   - Receita.
   - Receita/rede.
   - Atestado.
   - Encaminhamento.
   - Solicitação AIH.
   - Pedido de exame.
   - Guias SADT/TISS.
   - APAC.
   - PDF externo/Memed.

4. **Configurações**
   - Local de atendimento.
   - Fluxogramas de classificação de risco.
   - Queixas de triagem.
   - Discriminadores.
   - Modelos de ficha.
   - Modelos de documento.
   - Protocolos de prescrição.

### 2.2 Auditar ações relevantes

Registrar histórico/auditoria para:

- Chamada do paciente.
- Início de triagem/acolhimento.
- Início de consulta.
- Não atendeu.
- Alta.
- Cancelamento da alta.
- Encaminhamentos.
- Finalização de consulta.
- Criação/alteração/desativação de problemas ativos.
- Criação/edição/desativação/impressão de fichas, evoluções, documentos, prescrições, APAC e pedidos.
- Administração/checagem/cancelamento de medicação.
- Classificação de risco e reclassificação.
- Integração Memed: emissão, envio, cópia para prontuário e falhas.

### 2.3 Guardar snapshots de documentos

Todo documento impresso, reimpresso ou enviado deve guardar snapshot dos dados usados na geração.

Aplica-se a:

- Ficha médica.
- Evolução.
- Receita.
- Receita/rede.
- Atestado.
- Encaminhamento.
- Pedido de exame.
- Guia SADT/TISS.
- APAC.
- Documento Memed.
- Relatórios de finalização.

---

## 3. Status e filas do atendimento

Status observados nas telas:

- Aguardando Triagem.
- Aguardando Acolhimento.
- Aguardando Consulta.
- Em Consulta.
- Em Procedimento.
- Em Procedimento / Preparação de Exame.
- Administração de Medicamentos.
- Em Observação.
- Alta.
- Encaminhado para Internação.
- Encaminhado para outra Especialidade.
- Aguardando Procedimento/Medicação, em Administração, em Observação.
- Pacientes em Consulta.
- Pacientes Encaminhados para outra Especialidade/Internação.
- Não Atendeu.
- Atendimento com mais de 18 horas.
- Pacientes agendados que não chegaram.
- Pacientes aguardando troca de plantão.

Sugestão de enum:

```ts
type AttendanceStatus =
  | "WAITING_TRIAGE"
  | "WAITING_RECEPTION"
  | "WAITING_CONSULTATION"
  | "IN_CONSULTATION"
  | "WAITING_PROCEDURE"
  | "IN_PROCEDURE"
  | "WAITING_EXAM_PREPARATION"
  | "MEDICATION_ADMINISTRATION"
  | "IN_OBSERVATION"
  | "DISCHARGED"
  | "NO_SHOW_CALLED"
  | "REFERRED_TO_HOSPITALIZATION"
  | "REFERRED_TO_SPECIALTY"
  | "WAITING_MEDICATION_OR_EXAM"
  | "FINISHED";
```

Observações a validar:

- Critérios de transição entre status.
- Se “Não Atendeu” remove da fila ou cria status rastreável.
- Se “Alta” bloqueia edição clínica.
- Se o cancelamento da alta reabre o atendimento integralmente ou apenas reposiciona o paciente na fila.

---

## 4. Painel da Recepção

### 4.1 Visão geral

Tela observada: **Painel da Recepção / SisHOSP - Triagem e Procedimento**.

Filtros por locais/setores:

- Ambulatório Clínica Médica.
- Ambulatório de Cardiologia.
- Ambulatório Ortopedia.
- Ambulatório Pediatria.
- Clínica Cardiologia.
- Clínica Cirúrgica.
- Clínica Especializada.
- Quimioterapia.
- SESMT.
- Em contexto de pronto atendimento:
  - PS Adulto.
  - PS Infantil.
  - PS Obstetrícia.
  - PS Ortopédico.

Filtros e opções:

- Especialidade.
- Todas as Especialidades.
- Desativar Chamada Paciente.

Ações da barra:

- Atendimento.
- Triagem/Acolhimento.
- Atualizar.
- Salas.
- Em Atend.
- At. Manual.
- Saída Recep.
- Não Atendeu.
- Consulta.
- Sair.

Seções de grade:

- Aguardando Triagem / Consulta.
- Pacientes encaminhados para outra especialidade/internação.
- Aguardando procedimento/medicação, em administração, em observação.
- Pacientes em consulta.

Colunas observadas:

- Efetivado.
- Agendado.
- Md.
- Im.
- Lb.
- Ob/Ot.
- Tr.
- Ret OK.
- Paciente.
- Idade.
- At Preferencial.
- Ag.
- Especialidade.
- Convênio.
- Local Atendimento.
- Painel.
- Espera.
- T Hosp.
- Profissional.
- Registro.
- Ordem.
- Nome social.
- Fim consulta.

### 4.2 Requisitos

- Listar pacientes por local, especialidade e status.
- Exibir contadores por fila/status.
- Exibir tempo de espera e tempo total no hospital/atendimento.
- Permitir chamar paciente.
- Permitir desabilitar chamada.
- Permitir abrir triagem/acolhimento/atendimento/consulta.
- Permitir registrar não atendimento.
- Permitir ver histórico de eventos.
- Atualizar a lista de forma manual e/ou automática.

### 4.3 Observações

- Significado exato dos indicadores Md, Im, Lb, Ob/Ot, Tr, Ret OK, At Pref, Int, Ag e Ad precisa ser confirmado.
- Regras das cores verde/amarelo/vermelho e azul/verde/amarelo/laranja/vermelho precisam ser confirmadas.
- Confirmar se a chamada do paciente é exibida em TV, tela de recepção, painel web ou todos.

---

## 5. Uso Médico Ambulatorial

### 5.1 Tela principal

Tela observada: **Uso Médico Ambulatorial**, com título do profissional, por exemplo:

- `Profissional: SisHOSP [111]`
- `Profissional: SISHOSP MÉDICO [998]`
- `CONSULTÓRIO 1 SISHOSP [111]`
- `CONSULTÓRIO 3 SISHOSP [480844]`

Ações superiores:

- Consulta.
- Exames.
- Atualiza.
- Troca Plantão.
- Relatório.
- Pesquisa.
- Não Atendeu.
- Sair.

Filtros:

- Local/setor.
- Especialidade.
- Aguardando Triagem.
- Aguardando Consulta.
- Em Consulta.
- Em Procedimento/Observação.
- Alta.
- Encaminhado para Internação.
- Encaminhado outra Especialidade.

Painel lateral:

- Desabilita Chamada do Paciente.
- Totalização 24 horas.
- Contadores por status.
- Histórico de Eventos / botão direito do mouse.
- Botão Agenda.

### 5.2 Organização dos campos da grid

Modal observado: **Organização dos Campos no Grid**.

Campos configuráveis:

- Md.
- Im.
- Lb.
- Ot.
- Nome Paciente.
- Retorno OK.
- At Pref.
- Int.
- Ag.
- Espec/Profissional.
- Espera.
- T Hosp.
- Local de Atendimento.
- Idade.
- Inclusão.
- Agendado.
- Painel.
- Profissional.
- Internado.
- Retorno.
- Medicação.
- Convênio.
- Plano.
- Ad.

Ação observada:

- Salvar e Atualizar Grid.

Requisito:

- Permitir personalizar ordem/visibilidade das colunas.
- Guardar configuração por usuário, salvo confirmação diferente.

Observação:

- Validar se personalização é por usuário, perfil, profissional ou global.

### 5.3 Menu de contexto da fila

Ações observadas:

- Consultar Histórico de Eventos.
- Informações do Atendimento.
- Alta por Evasão.
- Alta por Óbito.
- Cancelamento da Alta.
- Iniciar Consulta para Paciente Fora da Sequência.
- Encerrar Consulta Iniciada por Médico Ausente.
- Alterar Ordem de Exibição dos Campos.

Observações:

- Validar permissões.
- Validar se iniciar paciente fora da sequência exige justificativa.
- Validar se alta por óbito/evasão reutiliza regras do módulo de internação ou é fluxo ambulatorial próprio.

---

## 6. Tela de Atendimento Médico

### 6.1 Cabeçalho

Campos observados:

- Registro.
- Ordem.
- Inclusão.
- Paciente.
- Nascimento.
- Idade.
- Convênio.
- Plano.
- Local de Atendimento.
- Especialidade.
- Possui outro convênio.
- Senha painel.
- Nome da mãe.
- Profissão do paciente.
- Patologia.
- CID principal.
- Histórico/últimos atendimentos.
- Link para acessar informações.

### 6.2 Áreas principais

- Problemas ativos.
- Dados de triagem/acolhimento.
- Hipóteses diagnósticas/diagnósticos.
- Ações clínicas.

Ações laterais observadas:

- Consulta Prontuário.
- Evolução.
- Ficha Médica.
- Prescrição Médica.
- Sinais Vitais.
- Formulários.
- Solicitação Exames Externos.
- Opinião Profissional.
- Finalização da Consulta.
- Dados Enfermagem.
- Audiometria.
- Consulta de Retorno.
- Medicação Programada.

### 6.3 Diagnósticos

Campos:

- Principal.
- Secundária.
- HD 3.
- HD 4.

Cada linha permite:

- Seleção da terminologia/CID.
- Código.
- Descrição.
- Pesquisa.
- Inclusão/adição.

Observações:

- Confirmar se CID principal é obrigatório para finalizar em determinados locais.
- Confirmar se diagnóstico final alimenta problemas ativos automaticamente.

---

## 7. Problemas Ativos

### 7.1 Grade

Colunas observadas:

- Problema Ativo.
- Tipo.
- Desde.
- Resolvido Em.
- Situação.
- Observação.
- Inclusão.
- UTC.
- Responsável.
- Relacionado à.

### 7.2 Modal Problemas Ativos do Paciente

Campos/opções:

- Paciente.
- Hipótese diagnóstica/diagnóstico.
- Alergia.
- Diagnóstico/terminologia.
- CID-10.
- Outro.
- Tipo:
  - Definitivo.
  - Provisório.
  - Risco.
  - Prevenção.
- Controle:
  - Ativo.
  - Inativo.
  - Resolvido.
- Início/detecção do problema.
- Observação.
- Produtos relacionados.
- Tipo de ação:
  - Alerta.
  - Crítica.
  - Bloqueio.
- Problemas relacionados.
- Data/hora inclusão.

### 7.3 Pesquisa CID-10

Permite buscar por:

- CID.
- Descrição.

Opções:

- Com Hierarquia.
- Sem Hierarquia.

Lista:

- CID.
- Descrição.
- Descrição resumida.

### 7.4 Requisitos

- Criar, editar, resolver, inativar e consultar problemas ativos.
- Vincular a CID/terminologia.
- Marcar alergia.
- Relacionar produtos com alerta/crítica/bloqueio.
- Exibir problemas ativos no atendimento.
- Manter histórico e responsável.

### 7.5 Observações

- Validar se alergias são problemas ativos, entidade própria ou ambos.
- Validar se produtos com bloqueio impedem prescrição/conduta.
- Validar se problemas ativos reutilizam recurso do Módulo 3.

---

## 8. Triagem, Acolhimento e Sinais Vitais

Dados observados:

- PA Sistólica.
- PA Diastólica.
- Pulso.
- Frequência Cardíaca.
- Frequência Respiratória.
- Temperatura.
- Saturação.
- Dextro.
- Peso.
- Diabético.
- Fumante.
- Hipertenso.
- Data/hora/responsável.
- Classificação de risco.
- Queixa principal.
- Alergia.

Requisitos:

- Registrar sinais vitais e dados de triagem/acolhimento.
- Exibir dados nas telas médica, multidisciplinar e enfermagem.
- Manter responsável, data/hora e origem.
- Alimentar classificação de risco quando aplicável.

Observações:

- Validar se será entidade própria, ficha ou formulário.
- Validar se classificação de risco puxa sinais vitais já coletados.
- Validar regra de edição após início/finalização da consulta.

---

## 9. Ficha Médica

Tela: **Ficha Médica**.

Ações:

- Anterior.
- Próximo.
- Adicionar.
- Editar.
- Salvar.
- Cancelar.
- Desativar.
- Imprimir.
- Exames.
- Cons Pront.
- Triagem.
- Rec. Rede.
- Prescrição.
- Sair.

Campos:

- Modelo de ficha.
- Atendimento médico.
- Carregar ficha.
- Data/hora.
- Informação da ficha:
  - Pública.
  - Restrita ao profissional que preencheu.
  - Restrita para especialidade do atendimento.
- Motivo do atendimento e descrição do exame clínico.
- Exames complementares/realizados.
- Conduta extra hospital.

Atalhos:

- Solicitação Exames Externos.
- Receita.
- Atestado.
- Receita/Rede.
- Preparação para Exame.
- Encaminhamento.

Comportamento observado:

- O conteúdo salvo pode aparecer como texto consolidado.
- Ao inserir resposta padronizada, aparece confirmação:
  - “Confirma a inclusão da Resposta na Tabela de Domínio?”

Requisitos:

- Criar ficha a partir de modelo.
- Salvar, editar, imprimir e desativar.
- Respeitar restrição de visibilidade.
- Suportar campos textuais e estruturados.
- Reutilizar respostas padronizadas/tabela de domínio.

Observações:

- Validar se usa motor de fichas do Módulo 3.
- Validar se modelos são por especialidade/local/profissional.
- Validar bloqueio após finalização/assinatura.
- Validar auditoria de impressão.

---

## 10. Evolução Médica

Tela: **Evolução**.

Ações:

- Dados.
- Sinais Vitais.
- Escores.
- Inserir.
- Duplicar.
- Excluir.
- Exames/Índices.
- Imprimir.
- Salvar.
- Cancelar.
- Notas.
- Sair.
- Prescrição.

Campos:

- Registro.
- Ordem.
- Paciente.
- Data/Hora Internação.
- Quarto/Leito.
- Setor.
- Prontuário.
- Sexo.
- Idade.
- Convênio.
- Plano.
- Especialidade.
- Tratamento.
- Encaminhado por.
- Data/Hora Inclusão.
- Número.
- Evoluído por.
- Data/Hora Evolução.

Modelo observado:

- Anamnese de Pediatria.

Conteúdo exemplo:

- QP.
- HDA.
- HPP.
- Antecedentes.
- Exame físico.
- Sinais vitais.

Controle de exibição:

- Do profissional ou especialidade.
- Todas, inclusive internados.

Restrição:

- Público.
- Profissional.
- Especialidade.

Atalhos:

- Solicitação Exames Externos.
- Receita.
- Receita/Rede.
- Encaminhamento.
- Atestado.
- Preparação para Exame.
- Informações Destacadas.
- Resumo de Alta.
- Publicar WEB.

Requisitos:

- Criar evolução por modelo/template.
- Salvar, duplicar, excluir, imprimir e cancelar conforme permissão.
- Aplicar restrição de visibilidade.
- Exibir na timeline/prontuário.
- Registrar responsável e data/hora.

Observações:

- Validar se reutiliza entidade de evolução do Módulo 3.
- Validar se “Publicar WEB” fica fora do MVP.
- Validar se evolução precisa de assinatura/finalização.
- Validar se escores e exames/índices entram no MVP.

---

## 11. Conduta / Prescrição Ambulatorial

Tela: **Conduta**.

Ações:

- Dados Cadastrais.
- Inserir.
- Avalia/Trat. Espec.
- Exclui.
- Protocolos.
- Duplicar.
- Imprimir.
- Cop Evolução.
- Salvar.
- Cancelar.
- Arquivo.
- Sair.
- Ir Evolução.

Dados:

- Registro.
- Ordem.
- Paciente.
- Data/Hora Atendimento.
- Prontuário.
- Sexo.
- Idade.
- Convênio.
- Plano.
- Especialidade.
- Tratamento.
- Encaminhado por.
- Data/Hora Registro.
- Data/Hora da Conduta.
- Número.
- Prescrito por.

Abas/atalhos:

- Medicamentos.
- Exame/Proced.
- Cuidados.
- Receita.
- Uso Contínuo.

Grade:

- Item.
- Produto/Serviço.
- Qtde Unit.
- Unidade.
- Aplicação.
- Frequência.
- Qtde Total.
- Observação.
- SN.
- SH.

Itens observados:

- Solução cloreto de sódio.
- AAS.
- Dipirona.
- Metoclopramida.
- Salbutamol/aerotrem.
- Hemograma.
- Sódio.
- Potássio.
- Ureia.
- Creatinina.
- Magnésio.
- TTPA.
- CPK.
- CKMB.
- Troponina.
- Eletrocardiograma.
- Tórax PA.

### 11.1 Protocolos

Tela: **Escolha de Protocolo de Prescrição**.

Exemplos:

- TTO DIA/TTO AGD.
- Avaliação.
- SESMT - Acidente de Trabalho.
- SESMT - Exames admissionais.
- SESMT - Exames demissionais/periódicos.
- SESMT - Exames de rotina.
- Acidente biológico.
- Protocolos nefro.
- Infecção trato urinário.

### 11.2 Prescrição de Medicamento

Campos:

- Item.
- Medicamento.
- Qtde por horário.
- Via de aplicação.
- Dose.
- Frequência.
- Observação.
- Se necessário.
- Agora.
- Somente hoje.
- Administrar em horário fora do padrão.
- Histórico de prescrições anteriores.

Pesquisa de medicamentos:

- Código.
- Descrição.
- Nome comercial.
- Forma de apresentação.

### 11.3 Prescrição de Cuidado

Permite buscar cuidado por lista/texto e salvar.

### 11.4 Prescrição de Exame/Procedimento e Serviço

Tipos:

- Todos.
- Demais Exames.
- Imagem.
- Procedimentos.
- Todos os Procedimentos.

Campos:

- Exame/procedimento/serviço.
- Quantidade.
- Frequência.
- Quantidade total.
- Urgente.
- Observação.
- Indicação clínica.
- Justificativa.
- Medicamentos associados.

Requisitos:

- Prescrever medicamentos, exames, procedimentos, cuidados e receitas.
- Aplicar protocolos com snapshot dos itens.
- Gerar impressão/receita quando aplicável.
- Integrar com enfermagem para administração/checagem, se confirmado.
- Exibir no prontuário.

Observações:

- Validar se Conduta é fluxo próprio ou reutiliza prescrição do Módulo 3.
- Validar significado de SN/SH.
- Validar se itens geram faturamento/estoque.
- Validar se medicamentos controlados exigem fluxo separado.
- Validar se “Cop Evolução” entra no MVP.

---

## 12. Opinião Profissional

Tela: **Opinião Profissional**.

Ações:

- Novo.
- Desativar.
- Consultar.
- Histórico.
- Salvar.
- Cancelar.
- Sair.

Campos:

- Paciente.
- Data/hora.
- Usuário.
- Texto livre.

Compartilhamento:

- Não compartilhar a informação.
- Profissionais da especialidade.
- Lista de profissionais.
- Todos os profissionais.

Seleção quando compartilhado:

- Profissional.
- Especialidade.
- Adicionar.
- Remover.
- Grade com profissional/código.

Requisitos:

- Registrar opinião profissional vinculada ao paciente/atendimento.
- Controlar visibilidade/compartilhamento.
- Consultar histórico.
- Desativar conforme permissão.
- Exibir indicador quando houver opinião.

Observações:

- Validar se reutiliza ProfessionalOpinion do Módulo 3.
- Validar se privado é padrão.
- Validar se aparece na timeline/prontuário.
- Validar histórico de alterações e acessos.

---

## 13. Documentos Clínicos

Modal **Tipo de Informação**:

- Receita.
- Receita (Rede).
- Atestado.
- Encaminhamento.
- Solicitação AIH.

Tela: **Atestados, Receitas e Encaminhamento Externo**.

Funcionalidades:

- Criar/editar documento por modelo.
- Editor de texto rico.
- Navegação.
- Salvar.
- Excluir/desativar.
- Imprimir.
- Selecionar modelo.
- Número de vias.
- Imprimir dados do comprador.
- Impressão em meia folha.
- Cabeçalho com logo/dados da instituição.
- Dados de inclusão/responsável.
- Campo de cancelamento.

### 13.1 Receita

Modelo observado:

- Receita Modelo.
- Texto com paciente, local, data, CRM e assinatura.

### 13.2 Atestado

Modelo observado:

- Atestado Médico.
- Texto com CID.
- Opções de repouso/horário:
  - Horário de chegada e saída.
  - Repouso no período da manhã.
  - Repouso no período da tarde.
  - Repouso no dia de hoje.
  - Repouso por quantidade de dias.
- Campo:
  - Autorizo divulgação do CID no atestado.

### 13.3 Receita (Rede)

Tela específica com:

- Medicamentos SEM Controle Especial.
- Medicamentos COM Controle Especial.
- Colunas:
  - Ordem.
  - Medicamento/Produto.
  - Qtde.
  - Grupo.
  - CE.
  - Complemento.
- Observações.
- Ações:
  - Receita Pronta.
  - Medicamento cadastrado.
  - Medicamento não cadastrado.
  - Medicamento não padrão.
  - Preview.
  - Imprimir.

Requisitos:

- Centralizar documentos clínicos vinculados ao atendimento.
- Usar modelos configuráveis.
- Registrar consentimento para divulgar CID no atestado.
- Guardar histórico, responsável, status e snapshot.
- Permitir uso no fluxo médico e multidisciplinar.

Observações:

- Validar se reutiliza ClinicalDocument do Módulo 3.
- Validar se Solicitação AIH entra no MVP.
- Validar se Receita/Rede tem regra regulatória específica.
- Validar se profissionais multidisciplinares podem emitir todos os tipos.
- Validar assinatura/CRM/conselho por profissão.

---

## 14. Pedido de Exame para Retorno

Tela: **Pedido de Exame Para Retorno**.

Ações:

- Novo.
- Editar.
- Protocolos.
- Salvar.
- Cancelar.
- Sair.
- Em lista: Novo, Editar, Retorno, Guias Retorno, Desativar, Sair.

Campos:

- Registro/paciente.
- Retorno.
- Botão Agendar Retorno.
- Observação.
- Tipo de informação:
  - Todos Exames.
  - SADT.
  - Imagem.
  - Cuidados.
  - Medicamento.
  - Material.
- Exame/procedimento.
- Quantidade.
- Indicação clínica.
- Observação/Justificativa.
- Adicionar.
- Remover.
- Grade Exames/Cuidados Solicitados:
  - Código Item.
  - Descrição.
  - Qtde.
  - Indicação Clínica.
  - Observação.

Requisitos:

- Criar pedido de exame/cuidados/medicamento/material para retorno.
- Associar a retorno interno ou externo.
- Aplicar protocolo.
- Listar pedidos.
- Gerar guias de retorno quando aplicável.
- Desativar pedido.

Observações:

- Validar se é fluxo separado da conduta.
- Validar se retorno externo gera apenas orientação.
- Validar se guias SADT/TISS entram no MVP.
- Validar se aparece no próximo atendimento e no prontuário.

---

## 15. Agendamento de Retorno

Tela: **Agendamento de Consulta de Retorno**.

Ações:

- Selecionar.
- Pesquisar.
- Cons Prontuário.
- Sair.

Campos:

- Calendário.
- Sala.
- Profissional.
- Especialidade.
- Agend.
- Capacidade.
- Final.
- Usuário responsável pela reserva.
- Apresentar agendamentos cancelados e faltas.

Grade:

- Hora.
- Alta.
- Paciente.
- Prontuário.
- 1º Atend.
- Convênio.
- Observação do Agendamento.
- Confirma.

Requisitos:

- Abrir agenda dentro do atendimento.
- Reutilizar Módulo 4.
- Associar retorno ao atendimento atual.
- Exibir horários disponíveis/ocupados.
- Registrar observação.

Observações:

- Validar se retorno cria novo atendimento ou apenas agendamento.
- Validar se há regras específicas para retorno.
- Validar tratamento de cancelados/faltas.

---

## 16. Finalização da Consulta Médica

Tela: **Finalização de Consulta**.

Ações:

- Finaliza.
- Impressão.
- Enviar PDF.
- Sair.

Listas selecionáveis:

- Ficha Médica:
  - Ficha de Ambulatório.
- Prescrição Médica:
  - Conduta.
- Outras Informações:
  - Receita.
  - Evolução Médica.
  - Atestado.
  - Encaminhamento.
  - Pedido de exame.

Opções:

- Imprime Guia SADT.
- Imprime Pedido de Exame.
- Imprime Guia TISS em Branco.
- Observações.

Tipos/desfechos:

- Alta.
- Encaminhar para outra especialidade.
- Óbito.
- Retornar após medicação/exame.
- Encaminhar para internação.
- Preparação para exame.
- Após procedimento/medicação/cuidado.
- Após transferência.
- Alta por evasão.

Requisitos:

- Selecionar documentos gerados.
- Definir o que imprimir.
- Escolher desfecho.
- Mover paciente para status/fila adequado.
- Registrar evento de finalização.
- Confirmar ações críticas.
- Exigir diagnóstico/CID quando configuração do local determinar.

Observações:

- Validar se finalização bloqueia edição posterior.
- Validar se CID principal é obrigatório.
- Validar se Enviar PDF é integração real.
- Validar regras de Guia SADT/TISS.

---

## 17. Alta Ambulatorial, Não Atendeu e Cancelamento da Alta

### 17.1 Alta Ambulatorial

Filtros:

- Paciente.
- Local de Atendimento.
- Profissional.

Grade:

- Nome/Paciente.
- Idade.
- Inclusão.
- Profissional.
- Convênio.

### 17.2 Não Atendeu

Confirmação observada:

> Confirma que o Paciente Não Atendeu o Chamado Médico para a Consulta? Caso Confirme, o Paciente sairá da Lista para Atendimento.

### 17.3 Cancelamento da Alta

Campos:

- Registro.
- Ordem.
- Inclusão.
- Paciente.
- Nascimento.
- Convênio.
- Local de Atendimento.
- Senha Painel.
- Especialidade.
- Observações sobre Cancelamento da Alta.

Situação de retorno:

- Aguardando Triagem.
- Aguardando Consulta.
- Aguardando Procedimento/Medicação.

Requisitos:

- Listar pacientes em alta.
- Cancelar alta e recolocar paciente na fila.
- Registrar não atendimento.
- Exigir observação/motivo quando configurado.
- Auditar ações.

Observações:

- Validar se Não Atendeu permite rechamada.
- Validar se cancelamento reabre o atendimento.
- Validar permissões de alta/cancelamento/não atendeu.

---

## 18. Uso Multidisciplinar Ambulatorial

Tela: **Uso Multi-Disciplinar Ambulatorial**.

Ações:

- Atendimento.
- Atualiza.
- Pesquisa.
- Sair.

Filtros:

- Locais/setores.
- Aguardando Triagem.
- Aguardando Consulta.
- Em Consulta.
- Em Procedimento/Observação.
- Alta.
- Encaminhado para Internação.
- Encaminhado outra Especialidade.
- Especialidade.
- Sala/consultório.

Ao iniciar atendimento:

- Modal **Informa Sala**.

Tela do paciente:

- Dados do paciente/atendimento.
- Últimos atendimentos/informações.
- Link Ver Histórico.
- Problemas ativos.
- Botões:
  - Fichas.
  - Evolução.
  - Formulários.
  - Opinião Profissional.
  - Fatura.
  - Audiometria.
  - Retorno.
  - Consulta Prontuário.
  - Finalização Consulta.

Observações:

- Validar se seleção de sala é obrigatória.
- Validar se Audiometria e Fatura entram no MVP.
- Validar se status são compartilhados com uso médico.

---

## 19. Ficha Multidisciplinar

Tela: **Ficha Multidisciplinar**.

Ações:

- Anterior.
- Próximo.
- Adicionar.
- Editar.
- Formulário.
- Salvar.
- Cancelar.
- Imprimir.
- Desativar.
- Sair.

Campos:

- Modelo de ficha.
- Carregar ficha.
- Paginação.
- Informação da ficha:
  - Pública.
  - Restrita ao profissional que preencheu.
  - Restrita para especialidade do atendimento.

Exemplos:

- Acompanhamento Fonoaudiológico.
- Via oral/via alternativa de alimentação.
- Teste da orelhinha direita/esquerda.
- Teste da linguinha.
- Orientações aos cuidadores.
- Escala FOIS.
- Textura dos alimentos.

Requisitos:

- Suportar modelos configuráveis.
- Suportar perguntas, alternativas, obrigatoriedade e paginação.
- Salvar versão do modelo usado.
- Respeitar visibilidade.
- Exibir no prontuário.

Observações:

- Validar se motor de formulários do Módulo 3 cobre esse fluxo.
- Validar se ficha fonoaudiológica entra no MVP.

---

## 20. Evolução Multidisciplinar

Tela: **Evolução Multi-Disciplinar**.

Ações:

- Dados Cadastrais.
- Inserir.
- Duplicar.
- Imprimir.
- Salvar.
- Cancelar.
- Controles.
- Excluir.
- Notas.
- Arquivamento.
- Sair.

Campos semelhantes à evolução médica.

Modelo observado:

- Escala FOIS.

Requisitos:

- Criar evolução multidisciplinar por modelo.
- Permitir salvar, imprimir, duplicar e excluir conforme permissão.
- Exibir no prontuário.
- Registrar responsável, data/hora e versão.

Observações:

- Validar se FOIS é escala própria ou template textual.
- Validar se Controles, Notas e Arquivamento entram no MVP.

---

## 21. Formulários Multidisciplinares

Fluxo reaproveita documentos clínicos:

- Receita.
- Receita (Rede).
- Atestado.
- Encaminhamento.
- Solicitação AIH.

Requisitos:

- Reutilizar ClinicalDocument.
- Aplicar permissão por profissão/especialidade.
- Registrar no prontuário.

Observações:

- Validar se multidisciplinar pode emitir receita/atestado.
- Validar assinatura/conselho profissional.
- Validar AIH no MVP.

---

## 22. Fatura Multidisciplinar

Tela: **Fatura de Procedimentos/Taxa**.

Ações:

- Incluir.
- Impressão.
- Sair.

Abas:

- Faturados.
- Não Faturados.

Grade:

- Código.
- Procedimento.
- Qtde.
- Valor Total.
- CRM.
- Profissional.

Pesquisa de itens:

- Item/Descrição.
- Procedimento.
- Medicamento.
- Material.
- Pacote.
- Utiliza a Tabela TUSS.
- Código.
- Descrição.
- Tipo.

Requisitos se entrar no escopo:

- Registrar itens de fatura.
- Diferenciar faturados e não faturados.
- Bloquear alteração de faturados.
- Auditar valor, quantidade, profissional e exclusões.

Observações:

- Provavelmente pertence a financeiro/faturamento.
- Pode ficar fora do MVP.
- Validar TUSS/TISS e credenciamento.

---

## 23. Finalização Multidisciplinar

Tela: **Finalização Multi-Disciplinar**.

Ações:

- Finaliza.
- Impressão.
- Sair.

Listas:

- Ficha Médica/Multi-Disciplinar:
  - Ficha de Ambulatório.
  - Acompanhamento Fonoaudiológico.
  - Atendimento.
- Outras Informações:
  - Encaminhamento.
  - Atestado.
  - Receita.
  - Evolução Multi-Disciplinar.

Campos:

- Especialidade.
- Observação.

Desfechos:

- Alta.
- Preparação de Exame.
- Encaminhar para outra Especialidade.
- Aguardando Consulta.
- Aguardando Procedimento/Medicação.

Opções de encaminhamento:

- Atendimento Imediato.
- Novo Atendimento.

Confirmação:

> Confirma a Alta do Paciente?

Observações:

- Validar se alta finaliza todo atendimento ou só a etapa multidisciplinar.
- Validar se encaminhar cria novo atendimento.
- Validar bloqueio de edição após finalização.

---

## 24. Uso Enfermagem Ambulatorial

Tela: **Uso Enfermagem Ambulatorial**.

Ações:

- Atendimento.
- Atualiza.
- Pesquisa.
- Sair.

Filtros/setores:

- Ambulatório.
- COVID 19.
- Observação.
- Procedimentos de Enfermagem.
- Pronto Atendimento.
- Pronto Atendimento 1.
- Vacinação.

Status:

- Aguardando Acolhimento.
- Aguardando Consulta.
- Em Consulta.
- Em Procedimento.
- Administração de Medicamentos.
- Em Observação.
- Alta.
- Encaminhado para Internação.
- Encaminhado outra Especialidade.
- Atendimento com + de 18 horas.

Legendas:

- Nec. Especiais.
- Covid 19.
- Irmãos.
- Urgência.
- Carência de Interna.

### 24.1 Atendimento de enfermagem

Ações:

- Chamar Pac.
- Finalizar.
- Solicitação.
- Sinais Vitais.
- Prescr Enferm.
- Sair.

Áreas:

- Anotações da Enfermagem.
- Administração de Medicação.

Opções de finalização:

- Retorno OK.
- Encaminhar Observação.
- Aguardando Procedimento/Medicação.
- Alta.

### 24.2 Administração de medicação

Ações:

- Confirmar.
- Cancelar.
- Cons Lanc.
- Materiais.
- Histórico.
- Coleta.
- Med Progr.

Colunas:

- Presc.
- Data.
- Horário.
- UTC.
- Hora.
- SN.
- Item.
- Qtde Presc.
- Qtde Unit.
- Qtde Forn.
- Data Checagem.

Observações:

- Validar se checagem/administração entra no MVP.
- Validar baixa de estoque por checagem.
- Validar se prescrição precisa estar assinada.

---

## 25. Medicação Programada e Uso Contínuo

### 25.1 Medicação Programada

Opções:

- Medicamento.
- Prescrição Vigente.
- Cancelados.
- Apresentar medicamentos com tratamento finalizado.

Grade:

- Número.
- Medicamento.
- Qtde.
- Unidade.
- Aplicação.
- Frequência.
- SN.
- Form.
- OBS.

Exemplo:

- Penicilina Cristalina 5.000.000 UI.
- Água Destilada 10 ml.
- EV.
- 12/12H.

### 25.2 Uso contínuo

Campos:

- Item.
- Código.
- Medicamento.
- Qtde.
- Unidade.
- Qtde de dispensação.
- Via de aplicação.
- Todas as vias.
- Frequência.
- Qtde total.
- Se necessário.
- Diluente.
- Primeiro horário.
- Observação.
- Data inicial.
- Data final.
- Horários.

### 25.3 Pendência de assinatura

Observado:

- Botão Pendência Assinatura.
- Assinatura Atendimento.
- Botões Assinar e Sair.
- Visualização textual da ficha médica.
- Botão Enviar PDF.

Observações:

- Validar diferença entre medicação programada, uso contínuo, prescrição vigente e conduta.
- Validar assinatura obrigatória antes da administração.
- Validar valor jurídico da assinatura.

---

## 26. Classificação de Risco

### 26.1 Queixas para Triagem

Menu Pronto Atendimento/PS > Cadastro > Queixas para Triagem.

Ações:

- Novo.
- Editar.
- Desativar.
- Sair.

Colunas:

- ID.
- Queixa de Triagem.
- Cancelamento.
- Fluxograma.

Opção:

- Apresentar Queixas Canceladas.

Edição:

- Descrição da Queixa.
- Fluxograma.

Exemplos:

- Sangramento a vários dias.
- Linha vermelha região plantar pé esquerdo.
- Aperto no peito.
- Aperto na cabeça.
- Bolinha.
- Caroço.
- Peso.
- Pontadas.
- Pressão na cabeça.
- Queimação.
- Tosse.
- Mal estar.
- Episódio de convulsão.
- Episódio de desmaio.
- Episódio de vômito.
- Edema.

### 26.2 Fluxograma de classificação

Campos:

- Queixa Principal.
- Fluxograma.
- Complemento da Queixa.
- Alergia.
- Doenças Associadas.
- Peso.
- Gestante Sim/Não.
- Duração.
- Observações.

Execução:

- Perguntas/discriminadores em sequência.
- Etapa 01/10, 06/10, 23/26 etc.
- Parâmetros clínicos:
  - Frequência cardíaca.
  - Temperatura.
  - PA sistólica.
  - PA diastólica.
- Botões Sim, Não e Voltar.
- Resultado por cor.
- Histórico de respostas.

Mensagem:

> Fluxograma concluído com sucesso. Classificação de Risco: Laranja.

Alerta:

> Valor do Parâmetro Clínico está dentro do limite do Discriminador. Este valor somente pode ser aceito com resposta = SIM. Caso não queira responder, limpe o conteúdo do parâmetro.

### 26.3 Discriminadores

Menu: Prontuário > Cadastro > Classificação de Risco > Discriminadores.

Colunas:

- ID.
- Descrição.
- Sexo.
- Idade Min.
- Idade Max.
- Glasgow.
- Parâmetro Clínico.
- Val Min.
- Val Max.

Exemplos:

- Frequência cardíaca < 60.
- Frequência cardíaca > 120.
- PAD >= 120.
- PAD 100-119.
- PAS 160-170.
- PAS >= 180.
- Temperatura >= 41.
- Temperatura 37,8-40,9.
- Convulsionando.
- Cólica.
- Criança com faixas de FC/temperatura.

### 26.4 Cadastro de Fluxograma

Campos:

- Código.
- Descrição.
- Apresentar para preenchimento:
  - Complemento da queixa.
  - Duração.
  - Alergias.
  - Doenças associadas.
  - Gestante.
  - Observação.
  - Peso.
- Classificação de risco na finalização.
- Discriminador.
- Classificação de risco.
- Sequência.
- Adicionar/remover/ordenar.

Requisitos:

- Cadastrar queixas, fluxogramas e discriminadores.
- Executar fluxograma no acolhimento.
- Registrar respostas e parâmetros.
- Definir cor/classificação.
- Alimentar prioridade da fila.
- Validar coerência entre parâmetro e resposta.

Observações:

- Validar se protocolo é Manchester ou próprio.
- Validar tempos máximos por cor.
- Validar se cadastro entra no MVP ou será seedado.
- Validar reclassificação e auditoria.

---

## 27. Cadastros e Local de Atendimento

### 27.1 Cadastros gerais > Atendimentos

Itens:

- Centro de Custo.
- Locais de Atendimento.
- Origem.
- Especialidades.
- Caráter de Atendimento.
- Motivo da Alta.
- Motivo de Alta SUS.
- Motivo da Saída - TISS.
- Nacionalidade.
- Classificação para Atendimento.
- Serviço Social.
- Motivo de Cancelamento.
- Terminologias.
- Tipo de atendimento TISS.
- Motivo de Ausência de Validação.

### 27.2 Cadastro de Local de Atendimento

Abas:

- Cadastro.
- Atendimento.
- Especialidade.
- Prescrição Ambulatorial.
- Prontuário.
- Cabeçalho Externo.
- Log de Alteração.

Tipos de local:

- Internação.
- Cirurgia Ambulatorial.
- Pronto Socorro.
- Exames.
- Ambulatório.
- Hospital Dia.
- Internação Domiciliar.
- Quimioterapia.
- Radioterapia.
- Terapia Renal.
- Remoção.
- Terapias.
- Outros.
- Exames de Mama.

Configurações observadas:

- Controla prontuário para consulta médica.
- Organização por especialidade direta, todas ou profissional.
- Classificação de risco obrigatória.
- Permite impressão de ficha manual.
- Possui agendamento de consulta para este local.
- Filtro de agenda por profissional ou agenda completa.
- Permite finalização com alta após medicação/procedimento quando há SADT prescrito.
- Informar especialidade ao selecionar consultório.
- Chamada do paciente na televisão ou recepção.
- Recepções que recebem mensagem.
- Encaminhamento para outra especialidade como atendimento imediato ou novo atendimento.
- Possui acolhimento.
- Exige preenchimento de alergia.
- Consiste repetição em ficha médica.
- Exige CID antes de finalizar consulta.
- Confirma finalização quando não houver atestado registrado.
- Tempo de espera para paciente que chegou antes do horário.
- Permite novo atendimento com atendimento em aberto.
- Permite finalizar somente com prescrição médica.
- Permite impressão de guias SADT sem prescrição médica.
- Apresentar termo de autorização de consulta a prontuário no primeiro atendimento.
- Após inclusão encaminhar para aguardando medicação e exames.
- Na alta encaminhar para internação/internar automaticamente.
- Uso médico ambulatorial simplificado.
- Checagem de enfermagem registra baixa no estoque.
- Frequência quando única.

Observações:

- Validar quais configurações entram no MVP.
- Validar se Local de Atendimento é cadastro central já existente.
- Validar termo de autorização e baixa de estoque.

---

## 28. Laudos APAC

### 28.1 Acesso

Menu: **Prontuário > Utilitários > Laudos APAC**.

### 28.2 Tela Laudos para APAC

Ações:

- Impressão.
- Re-Impressão.
- Sair.

Dados do atendimento/paciente:

- Registro.
- Ordem.
- Nome do paciente.
- Data/Hora Atendimento.
- Convênio.
- Local de Atendimento.
- Especialidade.
- Peso.
- Altura.
- Nº de vias para impressão.

Modelos:

- Autorização de Procedimento Ambulatorial.
- Autorização de Medicamentos.
- Controle de Frequência.
- Solicitação de Medicamentos.

Número do prontuário apresenta:

- Número do Atendimento.
- Código do Paciente no Convênio.

Data da solicitação:

- Internação.
- Em branco.

Campos:

- Profissional autorizador.
- Procedimento principal.
- Procedimentos secundários 1 a 5.
- Serviço.
- Classificação.
- Quantidade.
- Profissional solicitante.
- Data da solicitação.
- CID.
- Descrição do diagnóstico.
- Observações.
- Período de validade da APAC.

Opções:

- Preencher nome do hospital como estabelecimento executante.
- Preencher nome do estabelecimento de saúde solicitante.

Impressão adicional:

- Nenhuma.
- Pós Cirurgia Bariátrica.
- Dados Complementares.
- Hemodiálise.

Modelo:

- 1 ou 2.

### 28.3 Pesquisa de procedimento

Busca por:

- Código.
- Procedimento.

Comandos:

- Enter ou duplo clique seleciona.
- ESC sai.

Exemplos:

- Quimioterapia do adenocarcinoma de pâncreas avançado.
- Quimioterapia do adenocarcinoma de colon.
- Hemograma.

### 28.4 Controle de Laudo APAC

Tela: **Controle de Laudo de APAC**.

Ações:

- Impressão.
- Desativar.
- Sair.

Colunas:

- Modelo.
- Data/Hora Geração.
- Responsável Geração.
- Procedimento Principal.

Comportamento:

- Mantém histórico de laudos gerados.
- Permite reimpressão.
- Permite desativar.
- Linha vermelha provavelmente indica desativado/cancelado ou estado especial.

### 28.5 Relatório APAC

Campos do relatório:

- Estabelecimento solicitante.
- CNES.
- Paciente.
- CNS.
- Data nascimento.
- Sexo.
- Raça/cor.
- Etnia.
- Nome da mãe/responsável.
- Telefone.
- Endereço.
- Município/IBGE/UF/CEP.
- Procedimento solicitado.
- Procedimento principal.
- Procedimentos secundários.
- Justificativa.
- Descrição do diagnóstico.
- CID principal.
- CID secundário.
- CID causas associadas.
- Observações.
- Profissional solicitante.
- Data da solicitação.
- Assinatura/carimbo.
- Profissional autorizador.
- Nº APAC.
- Período de validade.
- Estabelecimento executante.
- Nome fantasia.
- CNES.

### 28.6 Dados complementares de oncologia

Quando “Dados Complementares” está marcado, há relatório:

**Laudo para Solicitação/Autorização de Procedimento Ambulatorial - Dados Complementares**

Seção Oncologia:

- Identificação patológica do caso.
- Localização do tumor primário.
- Linfonodos regionais.
- Avaliação.
- Estádio.
- Grau histopatológico.
- Diagnóstico cito/histopatológico.
- Data.

### 28.7 Quimioterapia / Radioterapia

Aba específica:

#### Quimioterapia

- Checkbox Quimioterapia.
- Tratamento anterior Sim/Não.
- Até três descrições de tratamento.
- Data de início.
- Continuidade de tratamento Sim/Não.
- Data de início do tratamento.
- Esquema/sigla/abreviatura.
- Número total de meses planejados.
- Número total de meses autorizados.

#### Radioterapia

- Checkbox Radioterapia.
- Tratamento anterior Sim/Não.
- Descrição/data.
- Continuidade de tratamento.
- Data de início do tratamento.
- Finalidade:
  - Radical.
  - Paliativa.
  - Adjuvante.
  - Prévia.
  - Antiálgica.
  - Anti-hemorrágica.
- Área irradiada.
- CID topografia.
- Nº campos/inserções.
- Data de início.
- Data de término.

### 28.8 CID em APAC

Pesquisa por descrição, exemplo “PÂNCREAS”, com opções:

- Com Hierarquia.
- Sem Hierarquia.

Exemplos:

- C250.
- C252.
- C25.
- K862.

Requisitos:

- Emitir laudo APAC.
- Reimprimir laudo.
- Desativar laudo.
- Registrar histórico e snapshot.
- Pesquisar procedimento e CID.
- Suportar dados complementares oncológicos.
- Gerar relatório compatível com o layout necessário.

Observações:

- Validar se APAC entra no MVP.
- Validar se alteração significa editar, recriar ou desativar e gerar novo.
- Validar se desativação exige motivo.
- Validar se procedimento de quimioterapia habilita dados complementares automaticamente.
- Validar se relatório deve seguir layout oficial SUS/APAC fielmente.
- Validar se CID topográfico usa CID-10 ou outro domínio.

---

## 29. Integração Memed

### 29.1 Acesso

No atendimento médico, em **Atestados, Receitas e Encaminhamento Externo**, há botão/ação **Memed**.

A integração abre interface Memed em janela/webview.

### 29.2 Interface observada

Elementos:

- Busca para adicionar prescrição.
- Abas:
  - Prescrição.
  - Fórmulas.
  - Exames.
  - Documentos.
  - CID.
- Assinatura Digital.
- Gerar Prescrição.
- Sugestões/destaques.
- Mais prescritos por você.
- Pesquisa por medicamento.
- Opção Adicionar texto livre.

Exemplo de busca:

- Novalgina.

A lista exibe:

- Nome/apresentação.
- Fabricante.
- Preço/referência.

### 29.3 Emissão

Fluxo:

- Editar Receita.
- Identificação.
- Emitir Receita.

Seções:

- Assinar o documento:
  - Habilitar certificado.
  - Assinar digitalmente.
- Compartilhar o documento:
  - Enviar SMS para paciente.
  - Telefone.
- Imprimir documento:
  - Documentos.
  - Quantidade de vias.

### 29.4 Documento gerado

Preview/receita mostra:

- Médico.
- CRM.
- Paciente.
- CPF.
- Data/hora.
- Medicamento.
- Posologia.
- Observação.
- QR Code.
- Token/código de dispensação.
- Marca Memed.

### 29.5 Pós-emissão

Tela confirma:

> Documento emitido e enviado!

Ações:

- Copiar para o prontuário.
- Editar documento.
- Ver experiência do paciente.
- WhatsApp Web.
- Email.
- Copiar Link.
- Nova prescrição.

Imagem de celular mostra paciente recebendo mensagem RCS/Memed com link da receita digital e código de autenticação para download do PDF.

Requisitos:

- Permitir abrir Memed a partir da receita/documentos.
- Enviar dados mínimos do paciente/profissional.
- Copiar ou referenciar documento no prontuário.
- Armazenar link/PDF/token/status quando disponível.
- Registrar data/hora, profissional, paciente e atendimento.
- Tratar falhas de integração.
- Respeitar LGPD e consentimento de compartilhamento.

Observações:

- Validar se Memed entra no MVP ou fica futuro.
- Validar se será API oficial, embed/webview ou redirecionamento.
- Validar CPF, telefone, CRM/conselho obrigatórios.
- Validar se receita Memed substitui ou complementa receita interna.
- Validar se cópia para prontuário é automática ou manual.
- Validar regras de certificado/assinatura digital.
- Validar consentimento para SMS/RCS/WhatsApp/E-mail.
- Validar auditoria de emissão, edição, cancelamento e acesso.

---

## 30. Entidades sugeridas

### 30.1 Attendance

```ts
interface Attendance {
  id: string;
  patientId: string;
  order: number;
  status: AttendanceStatus;
  type: "MEDICAL" | "MULTIDISCIPLINARY" | "NURSING" | "TRIAGE";
  appointmentId?: string;
  locationId: string;
  specialtyId?: string;
  professionalId?: string;
  roomId?: string;
  insuranceId?: string;
  planId?: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  priorityColor?: "BLUE" | "GREEN" | "YELLOW" | "ORANGE" | "RED";
  riskClassificationId?: string;
}
```

### 30.2 AttendanceEvent

```ts
interface AttendanceEvent {
  id: string;
  attendanceId: string;
  previousStatus?: AttendanceStatus;
  nextStatus: AttendanceStatus;
  eventType: string;
  reason?: string;
  observation?: string;
  performedByUserId: string;
  performedAt: string;
}
```

### 30.3 ActiveProblem

```ts
interface ActiveProblem {
  id: string;
  patientId: string;
  attendanceId?: string;
  description: string;
  cidCode?: string;
  type: "DEFINITIVE" | "PROVISIONAL" | "RISK" | "PREVENTION";
  status: "ACTIVE" | "INACTIVE" | "RESOLVED";
  isAllergy?: boolean;
  startedAt?: string;
  resolvedAt?: string;
  observation?: string;
  createdBy: string;
  createdAt: string;
}
```

### 30.4 ClinicalDocument

```ts
interface ClinicalDocument {
  id: string;
  patientId: string;
  attendanceId: string;
  type:
    | "PRESCRIPTION"
    | "NETWORK_PRESCRIPTION"
    | "CERTIFICATE"
    | "REFERRAL"
    | "AIH_REQUEST"
    | "APAC"
    | "EXTERNAL_EXAM_REQUEST";
  modelId?: string;
  content?: string;
  status: "ACTIVE" | "CANCELLED" | "DISABLED" | "REPLACED";
  generatedAt: string;
  generatedBy: string;
  printedAt?: string;
  externalProvider?: "MEMED";
  externalId?: string;
  externalUrl?: string;
  pdfFileId?: string;
}
```

### 30.5 Evolution

```ts
interface Evolution {
  id: string;
  patientId: string;
  attendanceId: string;
  type: "MEDICAL" | "MULTIDISCIPLINARY";
  templateId?: string;
  content: string;
  visibility: "PUBLIC" | "PROFESSIONAL" | "SPECIALTY";
  professionalId: string;
  specialtyId?: string;
  createdAt: string;
  signedAt?: string;
  cancelledAt?: string;
}
```

### 30.6 Prescription

```ts
interface Prescription {
  id: string;
  patientId: string;
  attendanceId: string;
  type: "CONDUCT" | "MEDICAL_PRESCRIPTION" | "CONTINUOUS_USE" | "SCHEDULED_MEDICATION";
  prescribedBy: string;
  prescribedAt: string;
  status: "DRAFT" | "ACTIVE" | "CANCELLED" | "FINISHED";
  signedAt?: string;
  items: PrescriptionItem[];
}

interface PrescriptionItem {
  id: string;
  itemType: "MEDICATION" | "EXAM" | "PROCEDURE" | "CARE" | "MATERIAL";
  productId?: string;
  description: string;
  quantity?: number;
  unit?: string;
  route?: string;
  frequency?: string;
  totalQuantity?: number;
  observation?: string;
  urgent?: boolean;
  asNeeded?: boolean;
}
```

### 30.7 RiskClassification

```ts
interface RiskClassification {
  id: string;
  attendanceId: string;
  complaintId: string;
  flowchartId: string;
  color: "BLUE" | "GREEN" | "YELLOW" | "ORANGE" | "RED";
  complement?: string;
  duration?: string;
  weight?: number;
  isPregnant?: boolean;
  allergies?: string;
  associatedDiseases?: string;
  observations?: string;
  answers: RiskClassificationAnswer[];
  createdBy: string;
  createdAt: string;
}
```

### 30.8 ApacReport

```ts
interface ApacReport {
  id: string;
  patientId: string;
  attendanceId: string;
  model:
    | "AMBULATORY_PROCEDURE_AUTHORIZATION"
    | "MEDICATION_AUTHORIZATION"
    | "FREQUENCY_CONTROL"
    | "MEDICATION_REQUEST";
  mainProcedureId?: string;
  secondaryProcedureIds: string[];
  requestingProfessionalId?: string;
  authorizingProfessionalId?: string;
  requestDate?: string;
  cidCode?: string;
  diagnosisDescription?: string;
  observation?: string;
  validityStart?: string;
  validityEnd?: string;
  additionalPrint?: "NONE" | "BARIATRIC_SURGERY" | "COMPLEMENTARY_DATA" | "HEMODIALYSIS";
  printModel?: 1 | 2;
  status: "ACTIVE" | "DISABLED";
  generatedAt: string;
  generatedBy: string;
  oncologyComplement?: ApacOncologyComplement;
}
```

---

## 31. Prioridade sugerida

### Prioridade 1 — Núcleo operacional

- Painel/fila.
- Uso médico.
- Tela de atendimento.
- Problemas ativos.
- Triagem/sinais vitais básicos.
- Ficha médica.
- Evolução médica.
- Conduta/prescrição básica.
- Finalização.
- Alta/cancelamento/não atendeu.
- Histórico de eventos.

### Prioridade 2 — Multidisciplinar e Enfermagem

- Uso multidisciplinar.
- Ficha multidisciplinar.
- Evolução multidisciplinar.
- Finalização multidisciplinar.
- Uso enfermagem.
- Anotações e sinais vitais.
- Administração de medicação, se confirmado.

### Prioridade 3 — Documentos e retorno

- Receita.
- Atestado.
- Encaminhamento.
- Pedido de exame para retorno.
- Agendamento de retorno via Módulo 4.
- Impressão/histórico.

### Prioridade 4 — Classificação de risco

- Queixas.
- Fluxogramas.
- Discriminadores.
- Execução da classificação.
- Histórico e prioridade por cor.

### Prioridade 5 — Integrações e regras avançadas

- APAC.
- Dados complementares de oncologia.
- TISS/SADT.
- Fatura/TUSS.
- Memed.
- Estoque.
- Assinatura digital.

---

## 32. Pontos de atenção final

- Não duplicar funcionalidades já previstas no prontuário.
- Não implementar faturamento, APAC, TISS/SADT, estoque ou Memed como regra definitiva sem validação.
- Toda regra por local de atendimento deve ser parametrizável.
- Toda integração externa deve ser isolada em serviço próprio.
- Toda impressão/reimpressão deve gerar histórico.
- Todo documento deve guardar snapshot.
- Toda alteração de status deve gerar evento.
- Dados sensíveis, como CID em atestado, diagnóstico, receita digital, link/token Memed e problemas ativos, devem respeitar regras de permissão, auditoria e LGPD.
