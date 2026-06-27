import type { FormTemplate } from "./types";

const yesNo = ["Sim", "Não"];
const frequencyOptions = ["Não participa", "Raramente", "Periodicamente", "Frequentemente"];

export const anamneseTemplates: FormTemplate[] = [
  {
    id: "nursing-admission",
    title: "Admissão de Enfermagem",
    shortTitle: "Enfermagem",
    source: "ADMISSÃO DE ENFERMAGEM NOVO.pdf",
    description: "Ficha de admissão com identificação, alergias, comorbidades, nível de consciência, sinais vitais e exame físico.",
    sections: [
      {
        id: "nursing-identification",
        title: "Identificação e uso atual",
        fields: [
          { id: "patientName", label: "Nome do paciente", type: "text", required: true },
          { id: "birthDate", label: "Data de nascimento", type: "date", required: true },
          { id: "age", label: "Idade", type: "number" },
          { id: "smoker", label: "Fumante", type: "yesNo", options: yesNo },
          { id: "usesMedication", label: "Faz uso de medicamentos", type: "yesNo", options: yesNo },
          { id: "medicationList", label: "Quais medicamentos", type: "textarea" }
        ]
      },
      {
        id: "nursing-allergies",
        title: "Alergias",
        fields: [
          { id: "medicationAllergy", label: "Alergia a medicamentos", type: "yesNo", options: yesNo },
          { id: "medicationAllergyDetails", label: "Quais medicamentos", type: "textarea" },
          { id: "foodAllergy", label: "Alergia alimentar", type: "yesNo", options: yesNo },
          { id: "foodAllergyDetails", label: "Quais alimentos", type: "textarea" }
        ]
      },
      {
        id: "nursing-comorbidities",
        title: "Comorbidades",
        fields: [
          { id: "hypertension", label: "Hipertenso", type: "yesNo", options: yesNo },
          { id: "diabetes", label: "Diabetes mellitus", type: "yesNo", options: yesNo },
          { id: "hepatitis", label: "Hepatites", type: "yesNo", options: yesNo },
          { id: "asthma", label: "Asma", type: "yesNo", options: yesNo }
        ]
      },
      {
        id: "nursing-consciousness",
        title: "Nível de consciência",
        fields: [
          {
            id: "consciousnessLevel",
            label: "Aspectos observados",
            type: "multiChoice",
            options: ["Consciente", "Letárgico", "Ansioso", "Agitado", "Orientado", "Desorientado", "Calmo"]
          }
        ]
      },
      {
        id: "nursing-physical-exam",
        title: "Exame físico",
        fields: [
          { id: "bloodPressure", label: "PA", type: "text", placeholder: "Ex.: 120x80 mmHg" },
          { id: "temperature", label: "Temperatura", type: "text", placeholder: "°C" },
          { id: "heartRate", label: "Frequência cardíaca", type: "text", placeholder: "BPM" },
          { id: "respiratoryRate", label: "Frequência respiratória", type: "text", placeholder: "RPM" },
          { id: "scalp", label: "Couro cabeludo", type: "singleChoice", options: ["Sem alterações", "Lesões", "Outros"] },
          { id: "scalpDetails", label: "Observação do couro cabeludo", type: "textarea" },
          { id: "eyes", label: "Olhos", type: "multiChoice", options: ["Sem alterações", "Hiperemia", "Icterícia"] },
          { id: "mucosa", label: "Mucosa", type: "singleChoice", options: ["Corada", "Hipocorada"] },
          { id: "mucosaIntensity", label: "Intensidade hipocorada", type: "text", placeholder: "_____/+4" },
          { id: "neck", label: "Pescoço", type: "singleChoice", options: ["Sem alterações", "Lesões"] },
          { id: "skin", label: "Pele", type: "multiChoice", options: ["Sem alterações", "1 hematoma", "Hiperemiada"] },
          { id: "otherLesion", label: "Apresenta lesão em outra região do corpo", type: "yesNo", options: yesNo },
          { id: "otherLesionDetails", label: "Qual região ou descrição", type: "textarea" },
          { id: "nutritionalStatus", label: "Estado nutricional", type: "singleChoice", options: ["Emagrecido", "Obeso", "Sobrepeso", "Nutrido", "Desnutrido"] }
        ]
      },
      {
        id: "nursing-genitourinary",
        title: "Sistema geniturinário e fechamento",
        fields: [
          { id: "diuresis", label: "Diurese", type: "singleChoice", options: ["Presente", "Ausente"] },
          { id: "evacuations", label: "Evacuações", type: "singleChoice", options: ["Presente", "Ausente"] },
          { id: "genitalRegion", label: "Região genital", type: "multiChoice", options: ["Sem alterações", "Prurido", "Lesões"] },
          { id: "nursingNotes", label: "Observações", type: "textarea" },
          { id: "nursingDate", label: "Data", type: "date", required: true },
          { id: "nurseName", label: "Enfermagem", type: "text", required: true },
          { id: "coren", label: "COREN", type: "text", required: true }
        ]
      }
    ]
  },
  {
    id: "psychological",
    title: "Anamnese Psicológica",
    shortTitle: "Psicológica",
    source: "ANAMNESE PSICOLÓGICA.pdf",
    description: "Entrevista psicológica com dados familiares, riscos psicossociais, histórico forense, consumo de substâncias e impressão do triagista.",
    sections: [
      {
        id: "psych-identification",
        title: "Identificação e admissão",
        fields: [
          { id: "patient", label: "Paciente", type: "text", required: true },
          { id: "admissionDate", label: "Data de admissão", type: "date", required: true },
          { id: "birthDate", label: "Data de nascimento", type: "date" },
          { id: "age", label: "Idade", type: "number" },
          { id: "hd", label: "HD", type: "text" },
          { id: "interviewDate", label: "Data da entrevista", type: "date", required: true },
          { id: "interviewTime", label: "Hora da entrevista", type: "time", required: true },
          { id: "profession", label: "Profissão", type: "text" },
          { id: "currentlyWorking", label: "Trabalha atualmente", type: "yesNo", options: yesNo },
          { id: "workRole", label: "Função", type: "text" },
          { id: "socialSecurityLeave", label: "Afastado pela previdência social", type: "yesNo", options: yesNo },
          { id: "leaveTime", label: "Tempo de afastamento", type: "text" },
          { id: "sex", label: "Sexo", type: "singleChoice", options: ["M", "F"] },
          { id: "spouse", label: "Cônjuge", type: "text" },
          { id: "spouseAge", label: "Idade do cônjuge", type: "number" },
          { id: "education", label: "Escolaridade", type: "singleChoice", options: ["Ens. fundamental", "Ens. médio", "Ens. superior", "Analfabeto"] },
          { id: "substanceUser", label: "Usuário(a)", type: "yesNo", options: yesNo },
          { id: "substanceUserDetails", label: "Qual(is)", type: "textarea" },
          { id: "hasChildren", label: "Filho(s)", type: "yesNo", options: yesNo },
          { id: "childrenCount", label: "Quantos filhos", type: "number" }
        ]
      },
      {
        id: "psych-family",
        title: "Família e moradia",
        fields: [
          {
            id: "childrenTable",
            label: "Filhos",
            type: "table",
            rows: ["Filho 1", "Filho 2", "Filho 3"],
            columns: [
              { id: "name", label: "Nome" },
              { id: "age", label: "Idade" },
              { id: "profession", label: "Profissão" }
            ]
          },
          { id: "fatherName", label: "Nome do pai", type: "text" },
          { id: "fatherMaritalStatus", label: "Estado civil do pai", type: "text" },
          { id: "fatherLifeStatus", label: "Situação do pai", type: "singleChoice", options: ["Vivo", "Falecido"] },
          { id: "fatherAge", label: "Idade do pai", type: "number" },
          { id: "fatherProfession", label: "Profissão do pai", type: "text" },
          { id: "motherName", label: "Nome da mãe", type: "text" },
          { id: "motherMaritalStatus", label: "Estado civil da mãe", type: "text" },
          { id: "motherLifeStatus", label: "Situação da mãe", type: "singleChoice", options: ["Viva", "Falecida"] },
          { id: "motherAge", label: "Idade da mãe", type: "number" },
          { id: "motherProfession", label: "Profissão da mãe", type: "text" },
          { id: "hasSiblings", label: "Irmão(s)", type: "yesNo", options: yesNo },
          { id: "siblingsCount", label: "Quantos irmãos", type: "number" },
          {
            id: "siblingsTable",
            label: "Irmãos",
            type: "table",
            rows: ["Irmão 1", "Irmão 2", "Irmão 3"],
            columns: [
              { id: "name", label: "Nome" },
              { id: "age", label: "Idade" },
              { id: "profession", label: "Profissão" }
            ]
          },
          {
            id: "currentHousehold",
            label: "Com quem mora atualmente",
            type: "table",
            rows: ["Pessoa 1", "Pessoa 2", "Pessoa 3", "Pessoa 4"],
            columns: [
              { id: "name", label: "Nome" },
              { id: "age", label: "Idade" },
              { id: "kinship", label: "Parentesco" }
            ]
          }
        ]
      },
      {
        id: "psych-context",
        title: "Religião, encaminhamento e queixas",
        fields: [
          { id: "religion", label: "Religião", type: "text" },
          { id: "religionPracticing", label: "Praticante", type: "yesNo", options: yesNo },
          { id: "referredBy", label: "Quem o encaminhou", type: "text" },
          { id: "admissionType", label: "Tipo de encaminhamento", type: "singleChoice", options: ["Voluntário", "Involuntário"] },
          { id: "familyMentalIllness", label: "Doença mental em familiares", type: "textarea" },
          { id: "hospitalizationReasonFamily", label: "Motivo da internação - relato familiar", type: "textarea" },
          { id: "mainComplaintPatient", label: "Queixa principal - relato do paciente", type: "textarea" },
          {
            id: "presentedAspects",
            label: "Aspectos apresentados",
            type: "multiChoice",
            options: [
              "Reprovação",
              "Problemas de memória",
              "Dificuldade de aprendizagem",
              "Problemas de atenção",
              "Dificuldades de relacionamento",
              "Queixas sobre agressividade",
              "Uso de substância psicoativa",
              "Outros"
            ]
          },
          { id: "presentedAspectsOther", label: "Outros aspectos", type: "textarea" }
        ]
      },
      {
        id: "psych-risk-sexuality",
        title: "Sexualidade, risco e saúde",
        fields: [
          {
            id: "psychosocialRisks",
            label: "Fatores de risco nos últimos 12 meses",
            type: "multiChoice",
            options: [
              "Relações sexuais com várias pessoas em curto espaço de tempo",
              "Relações sexuais sem uso de preservativo",
              "Sofreu abuso sexual ou estupro",
              "Teve ideação suicida",
              "Envolvimento sexual de risco",
              "Outros"
            ]
          },
          { id: "psychosocialRisksOther", label: "Outros fatores de risco", type: "textarea" },
          { id: "suicideAttempt", label: "Já tentou suicídio", type: "yesNo", options: yesNo },
          {
            id: "sexualLife",
            label: "Vida sexual",
            type: "singleChoice",
            options: ["Nunca teve relações sexuais", "Teve apenas a iniciação sexual", "Vida sexual ativa"]
          },
          { id: "sexualLifeAge", label: "Vida sexual ativa desde os anos", type: "number" }
        ]
      },
      {
        id: "psych-forensic",
        title: "História forense",
        fields: [
          { id: "policeJusticeInvolvement", label: "Envolvimento com polícia ou justiça", type: "yesNo", options: yesNo },
          { id: "takenToPoliceStation", label: "Já foi levado para delegacia e enquadrado", type: "yesNo", options: yesNo },
          { id: "processNotConvicted", label: "Já respondeu processo, mas não foi condenado", type: "yesNo", options: yesNo },
          { id: "convicted", label: "Já foi condenado", type: "yesNo", options: yesNo },
          { id: "currentlyResponding", label: "Está respondendo atualmente", type: "yesNo", options: yesNo },
          { id: "article", label: "Qual artigo", type: "text" },
          { id: "servedSentence", label: "Já cumpriu", type: "yesNo", options: yesNo },
          { id: "servedSentenceTime", label: "Quanto tempo", type: "text" }
        ]
      },
      {
        id: "psych-substances",
        title: "Histórico de consumo de substância",
        fields: [
          {
            id: "drugStartFactor",
            label: "Fator mais importante para iniciar uso de drogas",
            type: "multiChoice",
            options: [
              "Influência dos amigos ou pressão do grupo",
              "Curiosidade",
              "Falta de atenção e diálogo em casa",
              "Ansiedade ou nervosismo",
              "Fragilidade, baixa autoestima",
              "Separação dos pais",
              "Liberdade ou repressão excessiva",
              "Não sabe"
            ]
          },
          {
            id: "drugContinuationFactor",
            label: "Fator mais importante para continuar usando",
            type: "multiChoice",
            options: [
              "Convívio com outros usuários",
              "Tédio, falta do que fazer",
              "Ajudou a enfrentar a vida",
              "Fragilidade, baixa autoestima",
              "Gostou, prazer com o uso",
              "Ansiedade",
              "Tornou-se dependente",
              "Dificuldades de se relacionar",
              "Outros"
            ]
          },
          { id: "drugContinuationOther", label: "Outros fatores", type: "textarea" },
          { id: "preferredUseTime", label: "Momentos preferenciais de uso", type: "multiChoice", options: ["De manhã", "De tarde", "À noite", "Tanto faz"] },
          {
            id: "psychDrugsTable",
            label: "Drogas utilizadas",
            type: "table",
            rows: ["Maconha", "Crack", "Cocaína", "Álcool", "Tabaco", "Ecstasy", "LSD", "Solventes", "Sedativos", "Anfetaminas"],
            columns: [
              { id: "startAge", label: "Idade de início" },
              { id: "lastUse", label: "Último uso" },
              { id: "frequency", label: "Frequência" },
              { id: "quantity", label: "Qtd" }
            ]
          },
          {
            id: "drugResources",
            label: "De onde obtém recursos para conseguir drogas",
            type: "multiChoice",
            options: [
              "Quase nunca compra, geralmente ganha dos amigos",
              "Presta serviços para traficantes",
              "Atividades ilegais",
              "Faz tráfico",
              "Pequenos furtos, geralmente de casa",
              "Recurso próprio",
              "Dinheiro de mesada",
              "Prostitui-se",
              "Outros"
            ]
          },
          { id: "drugLosses", label: "Prejuízos ou perdas com o consumo", type: "textarea" },
          { id: "financialImpact", label: "Impacto na vida financeira", type: "singleChoice", options: ["Nenhum", "Discreto", "Moderado", "Grave"] },
          { id: "socialImpact", label: "Impacto na vida social", type: "textarea" },
          { id: "familyImpact", label: "Consequências nas relações com a família", type: "textarea" },
          { id: "treatmentExpectations", label: "Expectativas em relação ao tratamento", type: "textarea" },
          {
            id: "triagistImpression",
            label: "Impressão do triagista",
            type: "multiChoice",
            options: [
              "Paciente trazido pela família, sem vontade",
              "Tratamento por pressão judicial ou profissional",
              "Paciente parece comprometido mentalmente, sem autonomia",
              "Motivação para o tratamento",
              "Indiferente",
              "Outros"
            ],
            helper: "Campo do profissional. Não perguntar ao paciente."
          },
          { id: "triagistOther", label: "Outros registros da impressão", type: "textarea" },
          { id: "psychologistResponsible", label: "Psicólogo(a) responsável/carimbo", type: "text", required: true }
        ]
      }
    ]
  },
  {
    id: "therapeutic-initial",
    title: "Anamnese Terapêutica Inicial",
    shortTitle: "Terapêutica",
    source: "ANAMNESE TERAPÊUTICA INICIAL - FLOR DE LOTUS.pdf",
    description: "Entrevista terapêutica inicial com histórico de consumo, tratamentos, família, contexto social, ocupacional e ciência do paciente.",
    sections: [
      {
        id: "therapeutic-header",
        title: "Cabeçalho",
        fields: [
          { id: "counselorResponsible", label: "Conselheiro responsável", type: "text", required: true },
          { id: "therapeuticDate", label: "Data da anamnese", type: "date", required: true }
        ]
      },
      {
        id: "therapeutic-personal-data",
        title: "Dados pessoais",
        fields: [
          { id: "therapeuticPatientName", label: "Nome", type: "text", required: true },
          { id: "therapeuticBirthDate", label: "Data de nascimento", type: "date", required: true },
          { id: "therapeuticAge", label: "Idade", type: "number", helper: "Calculada automaticamente pela data de nascimento." },
          { id: "naturalness", label: "Naturalidade", type: "text" },
          { id: "stateUf", label: "UF", type: "text" },
          { id: "city", label: "Cidade", type: "text" },
          { id: "maritalStatus", label: "Estado civil", type: "singleChoice", options: ["Solteiro", "Casado", "Divorciado", "Viúvo"] },
          { id: "profession", label: "Profissão", type: "text" },
          { id: "admissionType", label: "Tipo de internação", type: "singleChoice", options: ["Voluntária", "Involuntária"] },
          { id: "insurance", label: "Convênio", type: "text" },
          { id: "needsInssLeave", label: "Necessita afastamento pelo INSS?", type: "yesNo", options: yesNo }
        ]
      },
      {
        id: "therapeutic-initial-anamnesis",
        title: "Anamnese inicial",
        fields: [
          { id: "substanceUseHistory", label: "Paciente já fez/faz uso de Substâncias Químicas (Drogas)? Quais?", type: "textarea" },
          { id: "otherCompulsion", label: "Percebe compulsão/dependência em algum outro comportamento/substância? Qual?", type: "textarea" },
          { id: "lastUse", label: "Quando foi seu último uso de Substâncias Químicas (Drogas) ou de comportamentos que lhe trouxeram prejuízos?", type: "textarea" }
        ]
      },
      {
        id: "therapeutic-consumption",
        title: "Histórico de consumo de substâncias psicoativas",
        description: "Tabela estruturada para registrar substâncias pré-cadastradas do formulário físico.",
        fields: [
          {
            id: "substanceConsumption",
            label: "Consumo de substâncias",
            type: "table",
            rows: [
              "Álcool",
              "Tabaco",
              "Maconha",
              "Cocaína",
              "Crack",
              "Solventes",
              "Heroína",
              "Alucinógenos",
              "Anabolizantes",
              "Anfetamina/Metanfetamina",
              "Medicamentos sem prescrição",
              "Outros"
            ],
            columns: [
              { id: "last12MonthsFrequency", label: "Frequência - últimos 12 meses" },
              { id: "last12MonthsQuantity", label: "Quantidade - últimos 12 meses" },
              { id: "lifetimeFrom", label: "Uso durante a vida - de" },
              { id: "lifetimeTo", label: "Uso durante a vida - até" },
              { id: "notes", label: "Observações" }
            ]
          }
        ]
      },
      {
        id: "therapeutic-treatment-history",
        title: "Histórico de tratamentos",
        fields: [
          { id: "previousHospitalization", label: "Já foi internado/fez tratamento", type: "yesNo", options: yesNo },
          { id: "previousHospitalizationCount", label: "Quantas vezes", type: "number" },
          { id: "treatmentPeriodFrom", label: "Período em tratamento - de", type: "date" },
          { id: "treatmentPeriodTo", label: "Período em tratamento - até", type: "date" },
          { id: "postTreatmentAbstinence", label: "Abstinência após o tratamento", type: "text" },
          { id: "treatmentLocation", label: "Local de tratamento", type: "textarea" },
          { id: "dischargeReason", label: "Motivo da saída", type: "textarea" },
          { id: "knows12Steps", label: "Conhece o Programa de 12 Passos", type: "yesNo", options: yesNo },
          { id: "psychiatricTreatment", label: "Já passou por internação/tratamento psiquiátrico", type: "yesNo", options: yesNo },
          { id: "psychiatricReason", label: "Motivo", type: "textarea" },
          { id: "psychiatricCount", label: "Quantas vezes", type: "number" },
          { id: "psychiatricFrom", label: "Psiquiátrico - de", type: "date" },
          { id: "psychiatricTo", label: "Psiquiátrico - até", type: "date" },
          { id: "mentalDisorderDiagnosis", label: "Foi diagnosticado por algum transtorno mental? Qual", type: "textarea" },
          { id: "relapseHistory", label: "Histórico de recaída", type: "textarea" }
        ]
      },
      {
        id: "therapeutic-family",
        title: "Histórico familiar",
        fields: [
          {
            id: "familyHistory",
            label: "Parentesco, quantidade e relação",
            type: "table",
            rows: ["Pai", "Mãe", "Companheiro(a)", "Filho(a)", "Fora do casamento"],
            columns: [
              { id: "quantity", label: "Quantidade" },
              { id: "relationship", label: "Relação" }
            ]
          },
          { id: "partnerRelationship", label: "Como é a relação com seu companheiro(a)", type: "textarea" },
          { id: "separationBySubstance", label: "Separação/divórcio por uso de substâncias/comportamentos prejudiciais", type: "yesNo", options: yesNo },
          { id: "separationDetails", label: "Observação sobre separação/divórcio", type: "textarea" },
          { id: "familySubstanceRelationship", label: "Relação da família com uso de substâncias/comportamentos prejudiciais", type: "textarea" },
          { id: "familyAbuse", label: "Problemas com abuso em outro membro da família", type: "yesNo", options: yesNo },
          { id: "familyAbuseWho", label: "Quem", type: "text" },
          { id: "familyCriminalProblems", label: "Problemas criminais na família", type: "yesNo", options: yesNo },
          { id: "familyCriminalWho", label: "Quem", type: "text" },
          { id: "familySupport", label: "Apoio familiar", type: "singleChoice", options: ["Não conta com apoio", "Conta com apoio parcial", "Conta com apoio integral"] },
          { id: "externalReference", label: "Pessoa responsável/referência externa", type: "text" },
          { id: "violenceAggression", label: "Situações de violência/agressividade", type: "yesNo", options: yesNo },
          { id: "familyNotes", label: "Observações", type: "textarea" }
        ]
      },
      {
        id: "therapeutic-social",
        title: "Histórico social",
        fields: [
          { id: "livesWith", label: "O paciente mora", type: "multiChoice", options: ["Sozinho(a)", "Companheiro(a)", "Filho(a)", "Pais", "Familiares", "Outros usuários", "Rua", "Outros"] },
          { id: "livesWithNotes", label: "Observação", type: "textarea" },
          { id: "mutualHelpGroups", label: "Participa de grupos de mútuo ajuda", type: "singleChoice", options: frequencyOptions },
          { id: "spirituality", label: "Espiritualidade/Religião", type: "singleChoice", options: frequencyOptions },
          { id: "contactWithUsers", label: "Mantém contato com outros usuários de substâncias psicoativas", type: "singleChoice", options: ["Não mantém", "Raramente", "Ocasionalmente", "Periodicamente", "Frequentemente"] }
        ]
      },
      {
        id: "therapeutic-occupational",
        title: "Histórico ocupacional",
        fields: [
          { id: "educationLevel", label: "Escolaridade", type: "singleChoice", options: ["Ensino Fundamental", "Ensino Médio", "Superior"] },
          { id: "educationCompletion", label: "Situação da escolaridade", type: "singleChoice", options: ["Completo", "Incompleto"] },
          { id: "currentlyEmployed", label: "Está trabalhando/empregado atualmente", type: "yesNo", options: yesNo },
          { id: "incomeSource", label: "Fonte de sustento atual", type: "textarea" }
        ]
      },
      {
        id: "therapeutic-declaration",
        title: "Termo de declaração",
        description: "Eu, ____________________, paciente da Clínica Terapêutica Flor de Lótus, participei ativamente das respostas contidas na entrevista de Anamnese Terapêutica Inicial com um Conselheiro em Dependência Química. Afirmo que as informações fornecidas são verdadeiras e que estou de pleno acordo com a Proposta Terapêutica planejada.",
        fields: [
          { id: "consentPatientName", label: "Nome do paciente para ciência", type: "text", required: true },
          { id: "consentCityDate", label: "Cidade/data", type: "text", placeholder: "Aquiraz, __ de ________, ____", required: true },
          { id: "patientSignature", label: "Assinatura do paciente", type: "text" },
          { id: "counselorSignature", label: "Assinatura do conselheiro", type: "text", required: true }
        ]
      }
    ]
  }
];

export function getTemplateById(id: string) {
  return anamneseTemplates.find((template) => template.id === id);
}