"use client";

import { AlertCircle, ArrowLeft, CheckCircle2, CircleDot, FileCheck2, FileText, Pencil, Plus, Printer, Save, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import { AnamnesePrintDocument } from "./AnamnesePrintDocument";
import { downloadAnamnesePdf } from "./pdfExport";
import { createAnamneseRecord, createPatient, emitAnamnesePdfDocument, fetchAnamneseRecord, fetchAnamneseTemplates, fetchPatientMedicalRecord, fetchPatients, finalizeAnamneseRecord, saveAnamneseRecord } from "./storage";
import { anamneseTemplates as fallbackTemplates } from "./templates";
import type { AnamneseRecord, FieldValue, FormField, FormTemplate, MedicalRecordEntry, PatientSummary, TableValue, TemplateAnswers, TemplateId, ValidationIssue } from "./types";

const yesNoOptions = ["Sim", "Não"];

function createEmptyRecord(): AnamneseRecord {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    code: `ANA-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    patientName: "",
    answers: {
      "nursing-admission": {},
      psychological: {},
      "therapeutic-initial": {}
    }
  };
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function isFilled(value: FieldValue | undefined) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === "object" && value !== null) {
    return Object.values(value).some((row) => {
      if (typeof row === "string") return row.trim().length > 0;
      if (typeof row === "object" && row !== null) return Object.values(row).some((cell) => typeof cell === "string" && cell.trim().length > 0);
      return false;
    });
  }

  return typeof value === "string" && value.trim().length > 0;
}

function getPatientName(record: AnamneseRecord) {
  const nursingName = record.answers["nursing-admission"].patientName;
  const psychologicalName = record.answers.psychological.patient;
  const consentName = record.answers["therapeutic-initial"].consentPatientName;

  if (typeof nursingName === "string" && nursingName.trim()) return nursingName.trim();
  if (typeof psychologicalName === "string" && psychologicalName.trim()) return psychologicalName.trim();
  if (typeof consentName === "string" && consentName.trim()) return consentName.trim();
  return record.patientName || "Paciente sem nome";
}

function validateRecord(record: AnamneseRecord, templates: FormTemplate[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const template of templates) {
    for (const section of template.sections) {
      for (const field of section.fields) {
        if (field.required && !isFilled(record.answers[template.id][field.id])) {
          issues.push({ templateTitle: template.shortTitle, sectionTitle: section.title, fieldLabel: field.label });
        }
      }
    }
  }

  return issues;
}

function requiredProgress(record: AnamneseRecord, templates: FormTemplate[]) {
  let total = 0;
  let complete = 0;

  for (const template of templates) {
    for (const section of template.sections) {
      for (const field of section.fields) {
        if (field.required) {
          total += 1;
          if (isFilled(record.answers[template.id][field.id])) complete += 1;
        }
      }
    }
  }

  return { complete, total };
}

function calculateAge(birthDate: string) {
  const birth = new Date(`${birthDate}T00:00:00`);

  if (Number.isNaN(birth.getTime())) {
    return "";
  }

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const hasNotHadBirthdayThisYear = today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());

  if (hasNotHadBirthdayThisYear) {
    age -= 1;
  }

  return String(age);
}

type FieldRendererProps = {
  field: FormField;
  value: FieldValue | undefined;
  canEditRecord: boolean;
  canUpdateAnamneseOptions: boolean;
  onChange: (value: FieldValue) => void;
};

function FieldRenderer({ canEditRecord, canUpdateAnamneseOptions, field, value, onChange }: FieldRendererProps) {
  const [newTableRowName, setNewTableRowName] = useState("");
  const [editingRowName, setEditingRowName] = useState<string | null>(null);
  const [editingRowDraft, setEditingRowDraft] = useState("");

  if (field.type === "textarea") {
    return (
      <textarea
        aria-label={field.label}
        disabled={!canEditRecord}
        onChange={(event) => onChange(event.target.value)}
        placeholder={field.placeholder}
        value={typeof value === "string" ? value : ""}
      />
    );
  }

  if (field.type === "yesNoDetails") {
    const conditionalValue = typeof value === "object" && !Array.isArray(value) && value !== null && "answer" in value ? value : {};
    const answer = typeof conditionalValue.answer === "string" ? conditionalValue.answer : "";
    const details = typeof conditionalValue.details === "string" ? conditionalValue.details : "";

    return (
      <div className="conditional-field">
        <div className="choice-group" role="radiogroup" aria-label={field.label}>
          {yesNoOptions.map((option) => (
            <label className="choice-pill" key={option}>
              <input
                checked={answer === option}
                disabled={!canEditRecord}
                name={field.id}
                onChange={() => onChange({ answer: option, details })}
                type="radio"
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
        {answer === "Sim" ? (
          <textarea
            aria-label={`${field.label} - complemento`}
            disabled={!canEditRecord}
            onChange={(event) => onChange({ answer, details: event.target.value })}
            placeholder="Descreva a resposta"
            value={details}
          />
        ) : null}
      </div>
    );
  }

  if (["text", "date", "time", "number"].includes(field.type)) {
    return (
      <input
        aria-label={field.label}
        disabled={!canEditRecord}
        onChange={(event) => onChange(event.target.value)}
        placeholder={field.placeholder}
        type={field.type}
        value={typeof value === "string" ? value : ""}
      />
    );
  }

  if (field.type === "yesNo" || field.type === "singleChoice") {
    return (
      <div className="choice-group" role="radiogroup" aria-label={field.label}>
        {field.options?.map((option) => (
          <label className="choice-pill" key={option}>
            <input
              checked={value === option}
              disabled={!canEditRecord}
              name={field.id}
              onChange={() => onChange(option)}
              type="radio"
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
    );
  }

  if (field.type === "multiChoice") {
    const selected = Array.isArray(value) ? value : [];

    return (
      <div className="choice-group is-multi" aria-label={field.label}>
        {field.options?.map((option) => {
          const checked = selected.includes(option);
          return (
            <label className="choice-pill" key={option}>
              <input
                checked={checked}
                disabled={!canEditRecord}
                onChange={() => onChange(checked ? selected.filter((item) => item !== option) : [...selected, option])}
                type="checkbox"
              />
              <span>{option}</span>
            </label>
          );
        })}
      </div>
    );
  }

  if (field.type === "table") {
    const tableValue = typeof value === "object" && !Array.isArray(value) && value !== null ? value as TableValue : {};
    const baseRows = field.rows ?? [];
    const removedRows = Array.isArray(tableValue.__removedRows) ? tableValue.__removedRows as unknown as string[] : [];
    const renamedRows = typeof tableValue.__renamedRows === "object" && tableValue.__renamedRows !== null ? tableValue.__renamedRows as unknown as Record<string, string> : {};
    const customRows = Object.keys(tableValue).filter((row) => !baseRows.includes(row) && !row.startsWith("__"));
    const rows = [...baseRows, ...customRows];
    const visibleRows = rows.filter((row) => !removedRows.includes(row));
    const normalizedNewRowName = newTableRowName.trim();
    const rowAlreadyExists = visibleRows.some((row) => (renamedRows[row] ?? row).toLowerCase() === normalizedNewRowName.toLowerCase());

    function addTableRow() {
      if (!normalizedNewRowName || rowAlreadyExists) {
        return;
      }

      onChange({
        ...tableValue,
        [normalizedNewRowName]: {}
      });
      setNewTableRowName("");
    }

    function renameTableRow(row: string) {
      const normalizedDraft = editingRowDraft.trim();
      const renamedRowAlreadyExists = visibleRows.some((currentRow) => currentRow !== row && (renamedRows[currentRow] ?? currentRow).toLowerCase() === normalizedDraft.toLowerCase());

      if (!normalizedDraft || renamedRowAlreadyExists) {
        return;
      }

      if (baseRows.includes(row)) {
        onChange({
          ...tableValue,
          __renamedRows: {
            ...renamedRows,
            [row]: normalizedDraft
          } as unknown as Record<string, string>
        });
      } else {
        const { [row]: rowValue = {}, ...remainingRows } = tableValue;
        onChange({
          ...remainingRows,
          [normalizedDraft]: rowValue
        });
      }
      setEditingRowName(null);
      setEditingRowDraft("");
    }

    function removeTableRow(row: string) {
      if (baseRows.includes(row)) {
        onChange({
          ...tableValue,
          __removedRows: [...removedRows, row] as unknown as Record<string, string>
        });
      } else {
        const { [row]: _removedRow, ...remainingRows } = tableValue;
        onChange(remainingRows);
      }
    }

    return (
      <div className="table-field" role="group" aria-label={field.label}>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              {field.columns?.map((column) => <th key={column.id}>{column.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row}>
                <th>
                  {editingRowName === row ? (
                    <div className="inline-edit-row">
                      <input
                        aria-label={`Editar opção ${row}`}
                        disabled={!canUpdateAnamneseOptions}
                        onChange={(event) => setEditingRowDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            renameTableRow(row);
                          }
                        }}
                        value={editingRowDraft}
                      />
                      <button aria-label="Salvar opção" onClick={() => renameTableRow(row)} type="button">
                        <Save size={14} />
                      </button>
                      <button aria-label="Cancelar edição" onClick={() => setEditingRowName(null)} type="button">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="table-row-heading">
                      <span>
                        {renamedRows[row] ?? row}
                        {customRows.includes(row) ? <span className="custom-row-badge">Nova opção</span> : null}
                        {baseRows.includes(row) && renamedRows[row] ? <span className="custom-row-badge">Editada</span> : null}
                      </span>
                      {canUpdateAnamneseOptions ? (
                        <span className="custom-row-actions">
                          <button aria-label={`Editar opção ${renamedRows[row] ?? row}`} onClick={() => { setEditingRowName(row); setEditingRowDraft(renamedRows[row] ?? row); }} type="button">
                            <Pencil size={14} />
                          </button>
                          <button aria-label={`Remover opção ${renamedRows[row] ?? row}`} onClick={() => removeTableRow(row)} type="button">
                            <Trash2 size={14} />
                          </button>
                        </span>
                      ) : null}
                    </div>
                  )}
                </th>
                {field.columns?.map((column) => (
                  <td key={column.id}>
                    <input
                      aria-label={`${field.label} - ${row} - ${column.label}`}
                      disabled={!canEditRecord}
                      onChange={(event) => {
                        onChange({
                          ...tableValue,
                          [row]: {
                            ...tableValue[row],
                            [column.id]: event.target.value
                          }
                        });
                      }}
                      value={tableValue[row]?.[column.id] ?? ""}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {canUpdateAnamneseOptions ? (
          <div className="table-option-editor">
            <label>
              <span>Nova opção</span>
              <input
                onChange={(event) => setNewTableRowName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addTableRow();
                  }
                }}
                placeholder="Digite uma nova opção para esta tabela"
                value={newTableRowName}
              />
            </label>
            <button disabled={!normalizedNewRowName || rowAlreadyExists} onClick={addTableRow} title="Requer permissão de atualização da anamnese" type="button">
              <Plus size={16} />
              Adicionar opção
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return null;
}

type AnamneseWorkspaceProps = {
  recordId: string;
};

export function AnamneseWorkspace({ recordId }: AnamneseWorkspaceProps) {
  const router = useRouter();
  const { hasPermission, token } = useAuth();
  const canCreateAnamnese = hasPermission("anamnese.create");
  const canUpdateAnamnese = hasPermission("anamnese.update");
  const canFinalizeAnamnese = hasPermission("anamnese.finalize");
  const canPrintAnamnese = hasPermission("anamnese.print");
  const canReadPatients = hasPermission("patients.read");
  const canCreatePatient = hasPermission("patients.create");
  const canReadProntuario = hasPermission("prontuario.read");
  const canUpdateAnamneseOptions = canUpdateAnamnese;
  const canUpdateAnamneseQuestions = canUpdateAnamnese;
  const [currentRecord, setCurrentRecord] = useState<AnamneseRecord | null>(null);
  const [templates, setTemplates] = useState<FormTemplate[]>(fallbackTemplates);
  const [activeTemplateId, setActiveTemplateId] = useState<TemplateId>("nursing-admission");
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [message, setMessage] = useState("Carregando anamnese do banco...");
  const [newQuestionLabel, setNewQuestionLabel] = useState("");
  const [newQuestionType, setNewQuestionType] = useState<"textarea" | "yesNoDetails">("textarea");
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editingQuestionLabel, setEditingQuestionLabel] = useState("");
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [patientSearch, setPatientSearch] = useState("");
  const [newPatientName, setNewPatientName] = useState("");
  const [newPatientBirthDate, setNewPatientBirthDate] = useState("");
  const [newPatientDocument, setNewPatientDocument] = useState("");
  const [medicalRecordEntries, setMedicalRecordEntries] = useState<MedicalRecordEntry[]>([]);

  useEffect(() => {
    if (!token || !canReadPatients) return;
    let isCurrent = true;

    Promise.all([fetchAnamneseRecord(token, recordId), fetchAnamneseTemplates(token)])
      .then(([record, nextTemplates]) => {
        if (!isCurrent) return;
        setCurrentRecord(record);
        setTemplates(nextTemplates);
        setMessage("Anamnese carregada do banco");
      })
      .catch((error) => {
        if (!isCurrent) return;
        setMessage(error instanceof Error ? error.message : "Nao foi possivel carregar a anamnese.");
      });

    return () => {
      isCurrent = false;
    };
  }, [recordId, token]);

  useEffect(() => {
    if (!token) return;
    let isCurrent = true;

    fetchPatients(token, patientSearch)
      .then((nextPatients) => {
        if (isCurrent) setPatients(nextPatients);
      })
      .catch(() => undefined);

    return () => {
      isCurrent = false;
    };
  }, [canReadPatients, patientSearch, token]);

  useEffect(() => {
    if (!token || !canReadProntuario || !currentRecord?.patientId) {
      setMedicalRecordEntries([]);
      return;
    }
    let isCurrent = true;

    fetchPatientMedicalRecord(token, currentRecord.patientId)
      .then((entries) => {
        if (isCurrent) setMedicalRecordEntries(entries);
      })
      .catch(() => undefined);

    return () => {
      isCurrent = false;
    };
  }, [canReadProntuario, currentRecord?.patientId, token]);

  if (!currentRecord) {
    return <div className="loading-panel">Carregando anamnese...</div>;
  }

  const loadedRecord = currentRecord;
  const activeTemplate = templates.find((template) => template.id === activeTemplateId) ?? templates[0] ?? fallbackTemplates[0];
  const activeSection = activeTemplate.sections[activeSectionIndex] ?? activeTemplate.sections[0];
  const customFields = loadedRecord.customFields?.[activeTemplate.id]?.[activeSection.id] ?? [];
  const sectionOverrides = loadedRecord.customFields?.[activeTemplate.id]?.[`__overrides__${activeSection.id}`] ?? [];
  const removedFieldIds = new Set(sectionOverrides.filter((field) => field.id.startsWith("removed-")).map((field) => field.id.replace("removed-", "")));
  const renamedFields = new Map(sectionOverrides.filter((field) => field.id.startsWith("renamed-")).map((field) => [field.id.replace("renamed-", ""), field.label]));
  const baseSectionFields = activeSection.fields
    .filter((field) => !removedFieldIds.has(field.id))
    .map((field) => renamedFields.has(field.id) ? { ...field, label: renamedFields.get(field.id) ?? field.label, helper: field.helper ? `${field.helper} Título editado neste registro.` : "Título editado neste registro." } : field);
  const sectionFields = [...baseSectionFields, ...customFields];
  const progress = requiredProgress(loadedRecord, templates);
  const selectedPatient = patients.find((patient) => patient.id === loadedRecord.patientId) ?? null;
  const canEditCurrentRecord = canUpdateAnamnese && loadedRecord.status !== "finalized";
  const canLinkPatient = canEditCurrentRecord && canReadPatients;
  const canCreateAndLinkPatient = canLinkPatient && canCreatePatient;
  const canManageCurrentQuestions = canUpdateAnamneseQuestions && canEditCurrentRecord;
  const canManageCurrentOptions = canUpdateAnamneseOptions && canEditCurrentRecord;

  function updateField(templateId: TemplateId, fieldId: string, value: FieldValue) {
    setCurrentRecord((record) => {
      if (!record) {
        return record;
      }

      const nextAnswers: TemplateAnswers = {
        ...record.answers[templateId],
        [fieldId]: value
      };

      if (templateId === "therapeutic-initial" && fieldId === "therapeuticBirthDate" && typeof value === "string") {
        nextAnswers.therapeuticAge = calculateAge(value);
      }

      const nextRecord = {
        ...record,
        patientName: (fieldId === "patientName" || fieldId === "therapeuticPatientName") && typeof value === "string" ? value : record.patientName,
        updatedAt: new Date().toISOString(),
        answers: {
          ...record.answers,
          [templateId]: nextAnswers
        }
      };
      setMessage("Alterações pendentes");
      return nextRecord;
    });
  }

  async function saveRecord(status: "draft" | "finalized") {
    if (!token) return;
    const validationIssues = status === "finalized" ? validateRecord(loadedRecord, templates) : [];
    setIssues(validationIssues);

    if (validationIssues.length > 0) {
      setMessage("Existem campos obrigatórios pendentes");
      return;
    }

    setMessage(status === "finalized" ? "Salvando e finalizando anamnese..." : "Salvando rascunho no banco...");
    const savedRecord = await saveAnamneseRecord(token, loadedRecord.id, {
      patientName: getPatientName(loadedRecord),
      patientId: loadedRecord.patientId,
      answers: loadedRecord.answers
    });
    const nextRecord = status === "finalized" ? await finalizeAnamneseRecord(token, savedRecord.id) : savedRecord;
    setCurrentRecord(nextRecord);
    setMessage(status === "finalized" ? "Anamnese finalizada no banco" : "Rascunho salvo no banco");
  }

  async function startNewRecord() {
    if (!token) return;
    const record = await createAnamneseRecord(token, { patientName: "Paciente sem nome" });
    setCurrentRecord(record);
    setIssues([]);
    setActiveTemplateId("nursing-admission");
    setActiveSectionIndex(0);
    setMessage("Novo rascunho criado no banco");
    router.replace(`/anamnese/${record.id}`);
  }

  function linkPatient(patientId: string) {
    const patient = patients.find((item) => item.id === patientId);
    setCurrentRecord((record) => record ? {
      ...record,
      patientId: patientId || null,
      patientName: patient?.name ?? record.patientName,
      updatedAt: new Date().toISOString()
    } : record);
    setMessage(patient ? `Paciente vinculado: ${patient.name}` : "Vinculo com paciente removido");
  }

  async function handleCreatePatient() {
    if (!token || !newPatientName.trim()) return;
    const patient = await createPatient(token, {
      name: newPatientName.trim(),
      birthDate: newPatientBirthDate || undefined,
      document: newPatientDocument.trim() || undefined
    });
    setPatients((currentPatients) => [patient, ...currentPatients.filter((item) => item.id !== patient.id)]);
    setCurrentRecord((record) => record ? {
      ...record,
      patientId: patient.id,
      patientName: patient.name,
      updatedAt: new Date().toISOString()
    } : record);
    setNewPatientName("");
    setNewPatientBirthDate("");
    setNewPatientDocument("");
    setMessage(`Paciente criado e vinculado: ${patient.name}`);
  }

  async function handleDownloadPdf() {
    if (!token) return;
    setMessage("Registrando documento PDF...");
    const document = await emitAnamnesePdfDocument(token, loadedRecord.id);
    await downloadAnamnesePdf(loadedRecord, templates);
    setMessage(`PDF ${document.code} registrado. Hash ${document.contentHash.slice(0, 12)}...`);
  }

  function addCustomQuestion() {
    const normalizedLabel = newQuestionLabel.trim();

    if (!normalizedLabel) {
      return;
    }

    const alreadyExists = sectionFields.some((field) => field.label.toLowerCase() === normalizedLabel.toLowerCase());

    if (alreadyExists) {
      setMessage("Essa pergunta já existe nesta seção");
      return;
    }

    const newField: FormField = {
      id: `custom-${activeSection.id}-${crypto.randomUUID()}`,
      label: normalizedLabel,
      type: newQuestionType,
      helper: newQuestionType === "yesNoDetails" ? "Pergunta personalizada com complemento quando a resposta for Sim." : "Pergunta personalizada adicionada neste registro."
    };
    const nextRecord: AnamneseRecord = {
      ...loadedRecord,
      updatedAt: new Date().toISOString(),
      customFields: {
        ...loadedRecord.customFields,
        [activeTemplate.id]: {
          ...loadedRecord.customFields?.[activeTemplate.id],
          [activeSection.id]: [...customFields, newField]
        }
      }
    };

    setCurrentRecord(nextRecord);
    setNewQuestionLabel("");
    setNewQuestionType("textarea");
    setMessage("Pergunta personalizada adicionada");
  }

  function updateCustomQuestion(fieldId: string) {
    const normalizedLabel = editingQuestionLabel.trim();

    if (!normalizedLabel) {
      return;
    }

    const alreadyExists = sectionFields.some((field) => field.id !== fieldId && field.label.toLowerCase() === normalizedLabel.toLowerCase());

    if (alreadyExists) {
      setMessage("Essa pergunta já existe nesta seção");
      return;
    }

    const isOriginalField = activeSection.fields.some((field) => field.id === fieldId);
    const nextCustomFields = customFields.map((field) => field.id === fieldId ? { ...field, label: normalizedLabel } : field);
    const nextSectionOverrides = [
      ...sectionOverrides.filter((field) => field.id !== `renamed-${fieldId}`),
      ...(isOriginalField ? [{ id: `renamed-${fieldId}`, label: normalizedLabel, type: "text" as const }] : [])
    ];
    const nextRecord: AnamneseRecord = {
      ...loadedRecord,
      updatedAt: new Date().toISOString(),
      customFields: {
        ...loadedRecord.customFields,
        [activeTemplate.id]: {
          ...loadedRecord.customFields?.[activeTemplate.id],
          [activeSection.id]: nextCustomFields,
          [`__overrides__${activeSection.id}`]: nextSectionOverrides
        }
      }
    };

    setCurrentRecord(nextRecord);
    setEditingQuestionId(null);
    setEditingQuestionLabel("");
    setMessage("Pergunta personalizada atualizada");
  }

  function removeCustomQuestion(fieldId: string) {
    const isOriginalField = activeSection.fields.some((field) => field.id === fieldId);
    const nextCustomFields = customFields.filter((field) => field.id !== fieldId);
    const nextSectionOverrides = [
      ...sectionOverrides.filter((field) => field.id !== `removed-${fieldId}` && field.id !== `renamed-${fieldId}`),
      ...(isOriginalField ? [{ id: `removed-${fieldId}`, label: fieldId, type: "text" as const }] : [])
    ];
    const { [fieldId]: _removedAnswer, ...remainingAnswers } = loadedRecord.answers[activeTemplate.id];
    const nextRecord: AnamneseRecord = {
      ...loadedRecord,
      updatedAt: new Date().toISOString(),
      answers: {
        ...loadedRecord.answers,
        [activeTemplate.id]: remainingAnswers
      },
      customFields: {
        ...loadedRecord.customFields,
        [activeTemplate.id]: {
          ...loadedRecord.customFields?.[activeTemplate.id],
          [activeSection.id]: nextCustomFields,
          [`__overrides__${activeSection.id}`]: nextSectionOverrides
        }
      }
    };

    setCurrentRecord(nextRecord);
    setMessage("Pergunta personalizada removida");
  }

  return (
    <div className="anamnese-detail-layout">
      <section className="workflow-panel">
        <div className="workflow-heading">
          <div>
            <span className="eyebrow">Fluxo funcional</span>
            <h2>Preenchimento de anamnese</h2>
            <p>Preencha, revise, finalize e exporte a anamnese clínica do paciente.</p>
          </div>
          <div className="detail-heading-actions">
            <Link className="back-link" href="/anamnese">
              <ArrowLeft size={16} />
              Listagem
            </Link>
            <div className={`status-badge ${loadedRecord.status === "finalized" ? "is-finalized" : ""}`}>
              {loadedRecord.status === "finalized" ? <CheckCircle2 size={16} /> : <CircleDot size={16} />}
              {loadedRecord.status === "finalized" ? "Finalizada" : "Rascunho"}
            </div>
          </div>
        </div>

        <div className="record-summary">
          <div>
            <span>Código</span>
            <strong>{loadedRecord.code}</strong>
          </div>
          <div>
            <span>Paciente</span>
            <strong>{getPatientName(loadedRecord)}</strong>
          </div>
          <div>
            <span>Obrigatórios</span>
            <strong>{progress.complete}/{progress.total}</strong>
          </div>
          <div>
            <span>Última alteração</span>
            <strong>{new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(loadedRecord.updatedAt))}</strong>
          </div>
        </div>

        {canReadPatients ? <div className="patient-link-panel">
          <div>
            <span className="eyebrow">Paciente e prontuário</span>
            <h3>{selectedPatient ? selectedPatient.name : "Sem paciente vinculado"}</h3>
            <p>{selectedPatient ? `${medicalRecordEntries.length} evento(s) no prontuario` : "Vincule um paciente para registrar a anamnese no prontuario ao finalizar."}</p>
          </div>
          <div className="patient-link-fields">
            <label>
              <span>Buscar paciente</span>
              <input disabled={!canLinkPatient} onChange={(event) => setPatientSearch(event.target.value)} placeholder="Nome ou documento" value={patientSearch} />
            </label>
            <label>
              <span>Paciente vinculado</span>
              <select disabled={!canLinkPatient} onChange={(event) => linkPatient(event.target.value)} value={loadedRecord.patientId ?? ""}>
                <option value="">Sem vinculo</option>
                {patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.name}{patient.document ? ` - ${patient.document}` : ""}</option>)}
              </select>
            </label>
            {canCreateAndLinkPatient ? (
              <>
                <label>
                  <span>Novo paciente</span>
                  <input onChange={(event) => setNewPatientName(event.target.value)} placeholder="Nome completo" value={newPatientName} />
                </label>
                <label>
                  <span>Nascimento</span>
                  <input onChange={(event) => setNewPatientBirthDate(event.target.value)} type="date" value={newPatientBirthDate} />
                </label>
                <label>
                  <span>Documento</span>
                  <input onChange={(event) => setNewPatientDocument(event.target.value)} placeholder="CPF/RG" value={newPatientDocument} />
                </label>
                <button disabled={!newPatientName.trim()} onClick={handleCreatePatient} type="button">Criar e vincular</button>
              </>
            ) : null}
          </div>
          {medicalRecordEntries.length > 0 ? (
            <ul className="medical-record-list">
              {medicalRecordEntries.slice(0, 3).map((entry) => <li key={entry.id}><strong>{entry.title}</strong><span>{entry.summary}</span></li>)}
            </ul>
          ) : null}
        </div> : null}

        <div className="template-tabs" role="tablist" aria-label="Fichas de anamnese">
          {templates.map((template) => (
            <button
              aria-selected={activeTemplateId === template.id}
              className={activeTemplateId === template.id ? "is-active" : ""}
              key={template.id}
              onClick={() => {
                setActiveTemplateId(template.id);
                setActiveSectionIndex(0);
              }}
              role="tab"
              type="button"
            >
              <FileText size={17} />
              {template.shortTitle}
            </button>
          ))}
        </div>

        <div className="template-context">
          <div>
            <h3>{activeTemplate.title}</h3>
            <p>{activeTemplate.description}</p>
          </div>
        </div>

        <div className="section-rail" aria-label="Seções da ficha">
          {activeTemplate.sections.map((section, index) => (
            <button
              className={index === activeSectionIndex ? "is-active" : ""}
              key={section.id}
              onClick={() => setActiveSectionIndex(index)}
              type="button"
            >
              {index + 1}. {section.title}
            </button>
          ))}
        </div>

        <form className="clinical-form" onSubmit={(event) => event.preventDefault()}>
          <div className="section-title">
            <h3>{activeSection.title}</h3>
            {activeSection.description ? <p>{activeSection.description}</p> : null}
          </div>

          {canManageCurrentQuestions ? (
            <div className="question-editor">
              <label>
                <span>Nova pergunta nesta seção</span>
                <input
                  onChange={(event) => setNewQuestionLabel(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addCustomQuestion();
                    }
                  }}
                  placeholder="Ex.: Qual foi o principal gatilho da recaída?"
                  value={newQuestionLabel}
                />
              </label>
              <label>
                <span>Tipo de pergunta</span>
                <select onChange={(event) => setNewQuestionType(event.target.value as "textarea" | "yesNoDetails")} value={newQuestionType}>
                  <option value="textarea">Texto livre</option>
                  <option value="yesNoDetails">Sim/Não com complemento se Sim</option>
                </select>
              </label>
              <button disabled={!newQuestionLabel.trim()} onClick={addCustomQuestion} title="Requer permissão de atualização da anamnese" type="button">
                <Plus size={16} />
                Adicionar pergunta
              </button>
            </div>
          ) : null}

          <div className="field-grid">
            {sectionFields.map((field) => (
              <div className={`field-card ${field.type === "textarea" || field.type === "table" || field.type === "yesNoDetails" ? "is-wide" : ""}`} key={field.id}>
                {editingQuestionId === field.id ? (
                  <div className="question-label-editor">
                    <input
                      aria-label="Editar pergunta personalizada"
                      onChange={(event) => setEditingQuestionLabel(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          updateCustomQuestion(field.id);
                        }
                      }}
                      value={editingQuestionLabel}
                    />
                    <button aria-label="Salvar pergunta" onClick={() => updateCustomQuestion(field.id)} type="button">
                      <Save size={14} />
                    </button>
                    <button aria-label="Cancelar edição" onClick={() => setEditingQuestionId(null)} type="button">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <span>
                    {field.label}
                    {field.required ? <small>Obrigatório</small> : null}
                    {field.id.startsWith("custom-") ? <small>Personalizada</small> : null}
                    {!field.id.startsWith("custom-") && renamedFields.has(field.id) ? <small>Editada</small> : null}
                    {canManageCurrentQuestions ? (
                      <span className="custom-question-actions">
                        <button aria-label="Editar pergunta" onClick={() => { setEditingQuestionId(field.id); setEditingQuestionLabel(field.label); }} type="button">
                          <Pencil size={14} />
                        </button>
                        <button aria-label="Remover pergunta" onClick={() => removeCustomQuestion(field.id)} type="button">
                          <Trash2 size={14} />
                        </button>
                      </span>
                    ) : null}
                  </span>
                )}
                {field.helper ? <em>{field.helper}</em> : null}
                <FieldRenderer
                  canEditRecord={canEditCurrentRecord}
                  canUpdateAnamneseOptions={canManageCurrentOptions}
                  field={field}
                  onChange={(value) => updateField(activeTemplate.id, field.id, value)}
                  value={loadedRecord.answers[activeTemplate.id][field.id]}
                />
              </div>
            ))}
          </div>
        </form>

        {issues.length > 0 ? (
          <div className="validation-box" role="alert">
            <AlertCircle size={18} />
            <div>
              <strong>Campos obrigatórios pendentes</strong>
              <ul>
                {issues.slice(0, 8).map((issue) => (
                  <li key={`${issue.templateTitle}-${issue.sectionTitle}-${issue.fieldLabel}`}>
                    {issue.templateTitle} / {issue.sectionTitle}: {issue.fieldLabel}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        <div className="action-bar">
          <span>{message}</span>
          <div>
            {canCreateAnamnese ? (
              <button className="secondary-button" onClick={startNewRecord} type="button">
                <Plus size={17} />
                Nova
              </button>
            ) : null}
            {canUpdateAnamnese ? (
              <button className="secondary-button" disabled={loadedRecord.status === "finalized"} onClick={() => saveRecord("draft")} type="button">
                <Save size={17} />
                Salvar rascunho
              </button>
            ) : null}
            {canPrintAnamnese ? (
              <button className="secondary-button" onClick={() => window.print()} type="button">
                <Printer size={17} />
                Imprimir
              </button>
            ) : null}
            {canPrintAnamnese ? (
              <button className="secondary-button" disabled={loadedRecord.status !== "finalized"} onClick={() => { void handleDownloadPdf(); }} type="button">
                <Printer size={17} />
                Baixar PDF
              </button>
            ) : null}
            {canFinalizeAnamnese ? (
              <button className="primary-button" disabled={loadedRecord.status === "finalized"} onClick={() => saveRecord("finalized")} type="button">
                <FileCheck2 size={17} />
                Finalizar anamnese
              </button>
            ) : null}
          </div>
        </div>
      </section>
      <AnamnesePrintDocument record={loadedRecord} templates={templates} />
    </div>
  );
}