"use client";

import { AlertCircle, ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, CircleDot, FileCheck2, FileSearch, FileText, Pencil, Plus, Printer, Save, Search, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import { downloadMedicalEvolutionPdf } from "@/features/prontuario/medicalEvolutionPdf";
import { emitMedicalEvolutionPdfDocument, fetchMedicalEvolution, fetchMedicalEvolutions } from "@/features/prontuario/prontuarioStorage";
import type { MedicalEvolution } from "@/features/prontuario/prontuarioTypes";
import { AnamnesePrintDocument } from "./AnamnesePrintDocument";
import { downloadAnamnesePdf } from "./pdfExport";
import { completeAnamneseTemplate, createAnamneseRecord, emitAnamnesePdfDocument, emitAnamneseTemplatePdfDocument, fetchAnamneseRecord, fetchAnamneseTemplates, fetchPatients, finalizeAnamneseRecord, saveAnamneseRecord } from "./storage";
import { anamneseTemplates as fallbackTemplates } from "./templates";
import { filterAnamneseTemplateConfigByPermissions, filterAnamneseTemplatesByPermissions } from "./templatePermissions";
import type { AnamneseRecord, FieldValue, FormField, FormSection, FormTemplate, PatientSummary, SectionConfigItem, TableValue, TemplateAnswers, TemplateConfigItem, TemplateId, ValidationIssue } from "./types";

const yesNoOptions = ["Sim", "Não"];
const customTemplateSectionId = "custom-section";
const evolutionHistoryPageSize = 5;
type CustomQuestionType = "textarea" | "yesNo" | "yesNoDetails" | "multiChoice" | "table";

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

function formatPageSummary(total: number, offset: number, count: number, label: string) {
  if (total === 0) return `0 ${label}`;
  return `${offset + 1}-${offset + count} de ${total} ${label}`;
}

function getEvolutionStatusLabel(status: MedicalEvolution["status"]) {
  if (status === "finalized") return "Finalizada";
  if (status === "canceled") return "Cancelada";
  return "Rascunho";
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

function formatPatientDocuments(patient: PatientSummary) {
  const documents = [
    patient.cpf ? `CPF: ${patient.cpf}` : null,
    patient.rg ? `RG: ${patient.rg}` : null
  ].filter(Boolean);

  if (documents.length > 0) return documents.join(" ");
  if (patient.document) return `Documento: ${patient.document}`;
  return "Sem documento";
}

function getRecordSavePayload(record: AnamneseRecord) {
  return {
    patientName: getPatientName(record),
    patientId: record.patientId,
    answers: record.answers,
    customFields: record.customFields,
    templateConfig: record.templateConfig
  };
}

function applySectionConfig(baseSections: FormSection[], sectionConfig: SectionConfigItem[] | undefined) {
  const configById = new Map((sectionConfig ?? []).map((config) => [config.id, config]));
  const baseSectionIds = new Set(baseSections.map((section) => section.id));
  const configuredBaseSections = baseSections.map((section, index) => {
    const config = configById.get(section.id);
    return {
      ...section,
      title: config?.title ?? section.title,
      description: config?.description ?? section.description,
      sortOrder: config?.sortOrder ?? index
    };
  });
  const customSections = (sectionConfig ?? [])
    .filter((config) => !baseSectionIds.has(config.id))
    .map((config, index) => ({
      id: config.id,
      title: config.title,
      description: config.description,
      sortOrder: config.sortOrder ?? baseSections.length + index,
      fields: []
    }));

  return [...configuredBaseSections, ...customSections]
    .sort((firstSection, secondSection) => firstSection.sortOrder - secondSection.sortOrder)
    .map(({ sortOrder: _sortOrder, ...section }) => section);
}

function getEffectiveTemplates(baseTemplates: FormTemplate[], templateConfig: TemplateConfigItem[] | undefined) {
  const configById = new Map((templateConfig ?? []).map((config) => [config.id, config]));
  const baseTemplateIds = new Set(baseTemplates.map((template) => template.id));
  const configuredBaseTemplates = baseTemplates.map((template, index) => {
    const config = configById.get(template.id);
    return {
      ...template,
      title: config?.title ?? template.title,
      shortTitle: config?.shortTitle ?? template.shortTitle,
      description: config?.description ?? template.description,
      sortOrder: config?.sortOrder ?? index,
      sections: applySectionConfig(template.sections, config?.sections)
    };
  });
  const customTemplates = (templateConfig ?? [])
    .filter((config) => config.isCustom || !baseTemplateIds.has(config.id))
    .map((config, index) => ({
      id: config.id,
      title: config.title,
      shortTitle: config.shortTitle,
      source: "Personalizada",
      description: config.description ?? "Ficha personalizada deste registro.",
      sortOrder: config.sortOrder ?? baseTemplates.length + index,
      sections: applySectionConfig([{ id: customTemplateSectionId, title: "Campos personalizados", description: undefined, fields: [] }], config.sections)
    }));

  return [...configuredBaseTemplates, ...customTemplates]
    .sort((firstTemplate, secondTemplate) => firstTemplate.sortOrder - secondTemplate.sortOrder)
    .map(({ sortOrder: _sortOrder, ...template }) => template);
}

function getRecordSnapshot(record: AnamneseRecord) {
  return JSON.stringify(getRecordSavePayload(record));
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

function requiredProgressForTemplate(record: AnamneseRecord, template: FormTemplate) {
  let total = 0;
  let complete = 0;

  for (const section of template.sections) {
    for (const field of section.fields) {
      if (field.required) {
        total += 1;
        if (isFilled(record.answers[template.id][field.id])) complete += 1;
      }
    }
  }

  return { complete, total };
}

function validateTemplateRecord(record: AnamneseRecord, template: FormTemplate): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const section of template.sections) {
    for (const field of section.fields) {
      if (field.required && !isFilled(record.answers[template.id][field.id])) {
        issues.push({ templateTitle: template.shortTitle, sectionTitle: section.title, fieldLabel: field.label });
      }
    }
  }

  return issues;
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
                onChange={() => onChange({ answer: option, details: option === "Sim" ? details : "" })}
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
    const options = field.type === "yesNo" ? field.options ?? yesNoOptions : field.options ?? [];

    return (
      <div className="choice-group" role="radiogroup" aria-label={field.label}>
        {options.map((option) => (
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
  const { hasPermission, token, user } = useAuth();
  const canReadAnamnese = hasPermission("anamnese.read");
  const canCreateAnamnese = hasPermission("anamnese.create");
  const canUpdateAnamnese = hasPermission("anamnese.update");
  const canFinalizeAnamnese = hasPermission("anamnese.finalize");
  const canPrintAnamnese = hasPermission("anamnese.print");
  const canReadPatients = hasPermission("patients.read");
  const canReadEvolutionHistory = hasPermission("medical_evolutions.read");
  const canPrintEvolutionHistory = hasPermission("medical_evolutions.print");
  const canUpdateAnamneseOptions = canUpdateAnamnese;
  const canUpdateAnamneseQuestions = canUpdateAnamnese;
  const [currentRecord, setCurrentRecord] = useState<AnamneseRecord | null>(null);
  const [templates, setTemplates] = useState<FormTemplate[]>(fallbackTemplates);
  const [activeTemplateId, setActiveTemplateId] = useState<TemplateId>("nursing-admission");
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [message, setMessage] = useState("Carregando anamnese do banco...");
  const [isCreatingRecord, setIsCreatingRecord] = useState(false);
  const [newQuestionLabel, setNewQuestionLabel] = useState("");
  const [newQuestionType, setNewQuestionType] = useState<CustomQuestionType>("textarea");
  const [isMultiChoiceModalOpen, setIsMultiChoiceModalOpen] = useState(false);
  const [multiChoiceOptionDrafts, setMultiChoiceOptionDrafts] = useState([""]);
  const [isTableQuestionModalOpen, setIsTableQuestionModalOpen] = useState(false);
  const [tableRowDrafts, setTableRowDrafts] = useState([""]);
  const [tableColumnDrafts, setTableColumnDrafts] = useState([""]);
  const [isTemplateCompletionConfirmOpen, setIsTemplateCompletionConfirmOpen] = useState(false);
  const [isTemplateManagerOpen, setIsTemplateManagerOpen] = useState(false);
  const [newTemplateTitle, setNewTemplateTitle] = useState("");
  const [isSectionManagerOpen, setIsSectionManagerOpen] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [draggingSectionId, setDraggingSectionId] = useState<string | null>(null);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editingQuestionLabel, setEditingQuestionLabel] = useState("");
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [patientSearch, setPatientSearch] = useState("");
  const [debouncedPatientSearch, setDebouncedPatientSearch] = useState("");
  const [isPatientOptionsOpen, setIsPatientOptionsOpen] = useState(false);
  const [isEvolutionHistoryOpen, setIsEvolutionHistoryOpen] = useState(false);
  const [evolutionHistory, setEvolutionHistory] = useState<MedicalEvolution[]>([]);
  const [evolutionHistoryTotal, setEvolutionHistoryTotal] = useState(0);
  const [evolutionHistoryPage, setEvolutionHistoryPage] = useState(1);
  const [isEvolutionHistoryLoading, setIsEvolutionHistoryLoading] = useState(false);
  const [printingEvolutionId, setPrintingEvolutionId] = useState<string | null>(null);
  const [evolutionHistoryMessage, setEvolutionHistoryMessage] = useState("Histórico não carregado.");
  const lastSavedSnapshotRef = useRef<string | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveSequenceRef = useRef(0);

  useEffect(() => {
    if (!token || !canReadAnamnese) return;
    let isCurrent = true;

    Promise.all([fetchAnamneseRecord(token, recordId), fetchAnamneseTemplates(token)])
      .then(([record, nextTemplates]) => {
        if (!isCurrent) return;
        lastSavedSnapshotRef.current = getRecordSnapshot(record);
        setCurrentRecord(record);
        setTemplates(nextTemplates);
        setMessage("Anamnese carregada do banco");
      })
      .catch((error) => {
        if (!isCurrent) return;
        setMessage(error instanceof Error ? error.message : "Não foi possível carregar a anamnese.");
      });

    return () => {
      isCurrent = false;
    };
  }, [canReadAnamnese, recordId, token]);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedPatientSearch(patientSearch), 350);
    return () => clearTimeout(timeout);
  }, [patientSearch]);

  useEffect(() => {
    if (!token || !canReadPatients) return;
    let isCurrent = true;

    fetchPatients(token, debouncedPatientSearch)
      .then((nextPatients) => {
        if (isCurrent) setPatients(nextPatients);
      })
      .catch(() => undefined);

    return () => {
      isCurrent = false;
    };
  }, [canReadPatients, debouncedPatientSearch, token]);

  useEffect(() => {
    if (!token || !canReadEvolutionHistory || !isEvolutionHistoryOpen || !currentRecord?.patientId) return;
    let isCurrent = true;
    const offset = (evolutionHistoryPage - 1) * evolutionHistoryPageSize;

    Promise.resolve().then(() => {
      if (isCurrent) setIsEvolutionHistoryLoading(true);
    });

    fetchMedicalEvolutions(token, currentRecord.patientId, { limit: evolutionHistoryPageSize, offset })
      .then((response) => {
        if (!isCurrent) return;
        setEvolutionHistory(response.items);
        setEvolutionHistoryTotal(response.total);
        setEvolutionHistoryMessage(response.total > 0 ? "Histórico de evoluções carregado." : "Paciente sem evoluções registradas.");
      })
      .catch((error) => {
        if (isCurrent) setEvolutionHistoryMessage(error instanceof Error ? error.message : "Não foi possível carregar o histórico de evoluções.");
      })
      .finally(() => {
        if (isCurrent) setIsEvolutionHistoryLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [canReadEvolutionHistory, currentRecord?.patientId, evolutionHistoryPage, isEvolutionHistoryOpen, token]);

  useEffect(() => {
    if (!token || !currentRecord || !canUpdateAnamnese || currentRecord.status === "finalized") return;

    const nextSnapshot = getRecordSnapshot(currentRecord);

    if (lastSavedSnapshotRef.current === null) {
      lastSavedSnapshotRef.current = nextSnapshot;
      return;
    }

    if (nextSnapshot === lastSavedSnapshotRef.current) return;

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    const sequence = autosaveSequenceRef.current + 1;
    autosaveSequenceRef.current = sequence;
    autosaveTimerRef.current = setTimeout(() => {
      setMessage("Salvando rascunho automaticamente...");
      const payload = getRecordSavePayload(currentRecord);
      void saveAnamneseRecord(token, currentRecord.id, payload)
        .then((savedRecord) => {
          if (autosaveSequenceRef.current !== sequence) return;
          lastSavedSnapshotRef.current = getRecordSnapshot(savedRecord);
          setCurrentRecord((record) => record?.id === savedRecord.id ? savedRecord : record);
          setMessage("Rascunho salvo automaticamente");
        })
        .catch((error) => {
          if (autosaveSequenceRef.current !== sequence) return;
          setMessage(error instanceof Error ? error.message : "Não foi possível salvar automaticamente.");
        });
    }, 800);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [canUpdateAnamnese, currentRecord, token]);

  useEffect(() => () => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
  }, []);

  if (!canReadAnamnese) {
    return <div className="loading-panel">Você não possui permissão para visualizar anamneses.</div>;
  }

  if (!currentRecord) {
    return <div className="loading-panel">Carregando anamnese...</div>;
  }

  const loadedRecord = currentRecord;
  const userPermissions = user?.permissions ?? [];
  const visibleTemplates = filterAnamneseTemplatesByPermissions(templates, userPermissions);
  const visibleTemplateConfig = filterAnamneseTemplateConfigByPermissions(loadedRecord.templateConfig, userPermissions);
  const effectiveTemplates = getEffectiveTemplates(visibleTemplates, visibleTemplateConfig);
  const activeTemplate = effectiveTemplates.find((template) => template.id === activeTemplateId) ?? effectiveTemplates[0];

  if (!activeTemplate) {
    return <div className="loading-panel">Nenhuma ficha de anamnese disponível para o seu grupo de acesso.</div>;
  }

  const activeSection = activeTemplate.sections[activeSectionIndex] ?? activeTemplate.sections[0];
  const customFields = loadedRecord.customFields?.[activeTemplate.id]?.[activeSection.id] ?? [];
  const sectionOverrides = loadedRecord.customFields?.[activeTemplate.id]?.[`__overrides__${activeSection.id}`] ?? [];
  const removedFieldIds = new Set(sectionOverrides.filter((field) => field.id.startsWith("removed-")).map((field) => field.id.replace("removed-", "")));
  const renamedFields = new Map(sectionOverrides.filter((field) => field.id.startsWith("renamed-")).map((field) => [field.id.replace("renamed-", ""), field.label]));
  const baseSectionFields = activeSection.fields
    .filter((field) => !removedFieldIds.has(field.id))
    .map((field) => renamedFields.has(field.id) ? { ...field, label: renamedFields.get(field.id) ?? field.label, helper: field.helper ? `${field.helper} Título editado neste registro.` : "Título editado neste registro." } : field);
  const sectionFields = [...baseSectionFields, ...customFields];
  const progress = requiredProgress(loadedRecord, effectiveTemplates);
  const activeTemplateProgress = requiredProgressForTemplate(loadedRecord, activeTemplate);
  const activeTemplateStatus = loadedRecord.templateStatuses?.[activeTemplate.id]?.status ?? "draft";
  const isActiveTemplateCompleted = activeTemplateStatus === "completed";
  const allTemplatesCompleted = effectiveTemplates.every((template) => loadedRecord.templateStatuses?.[template.id]?.status === "completed");
  const selectedPatient = patients.find((patient) => patient.id === loadedRecord.patientId) ?? null;
  const hasLinkedPatient = Boolean(loadedRecord.patientId);
  const linkedPatientName = selectedPatient?.name ?? (hasLinkedPatient ? getPatientName(loadedRecord) : "Sem paciente vinculado");
  const canEditCurrentRecord = canUpdateAnamnese && loadedRecord.status !== "finalized";
  const canEditActiveTemplate = canEditCurrentRecord && !isActiveTemplateCompleted;
  const canLinkPatient = canEditCurrentRecord && canReadPatients;
  const shouldShowPatientOptions = canLinkPatient && isPatientOptionsOpen;
  const evolutionHistoryOffset = (evolutionHistoryPage - 1) * evolutionHistoryPageSize;
  const canOpenEvolutionHistory = canReadEvolutionHistory && Boolean(loadedRecord.patientId);
  const canManageCurrentQuestions = canUpdateAnamneseQuestions && canEditActiveTemplate;
  const canManageCurrentOptions = canUpdateAnamneseOptions && canEditActiveTemplate;
  const parsedNewQuestionOptions = multiChoiceOptionDrafts
    .map((option) => option.trim())
    .filter((option, index, options) => option.length > 0 && options.findIndex((currentOption) => currentOption.toLowerCase() === option.toLowerCase()) === index);
  const parsedTableRows = tableRowDrafts
    .map((row) => row.trim())
    .filter((row, index, rows) => row.length > 0 && rows.findIndex((currentRow) => currentRow.toLowerCase() === row.toLowerCase()) === index);
  const parsedTableColumns = tableColumnDrafts
    .map((column) => column.trim())
    .filter((column, index, columns) => column.length > 0 && columns.findIndex((currentColumn) => currentColumn.toLowerCase() === column.toLowerCase()) === index);

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

  async function persistDraft(record: AnamneseRecord) {
    if (!token) return record;
    const savedRecord = await saveAnamneseRecord(token, record.id, getRecordSavePayload(record));
    lastSavedSnapshotRef.current = getRecordSnapshot(savedRecord);
    setCurrentRecord(savedRecord);
    return savedRecord;
  }

  async function saveRecord(status: "draft" | "finalized") {
    if (!token) return;
    if (status === "draft" && !canUpdateAnamnese) return;
    if (status === "finalized" && !canFinalizeAnamnese) return;
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    const validationIssues = status === "finalized" ? validateRecord(loadedRecord, effectiveTemplates) : [];
    setIssues(validationIssues);

    if (validationIssues.length > 0) {
      setMessage("Existem campos obrigatórios pendentes");
      return;
    }

    if (status === "finalized" && !allTemplatesCompleted) {
      setMessage("Conclua todas as fichas antes de finalizar a anamnese completa");
      return;
    }

    setMessage(status === "finalized" ? "Salvando e finalizando anamnese..." : "Salvando rascunho no banco...");
    const savedRecord = await persistDraft(loadedRecord);
    const nextRecord = status === "finalized" ? await finalizeAnamneseRecord(token, savedRecord.id) : savedRecord;
    lastSavedSnapshotRef.current = getRecordSnapshot(nextRecord);
    setCurrentRecord(nextRecord);
    setMessage(status === "finalized" ? "Anamnese finalizada no banco" : "Rascunho salvo no banco");
  }

  async function completeActiveTemplate() {
    if (!token || !canFinalizeAnamnese || loadedRecord.status === "finalized") return;
    setIsTemplateCompletionConfirmOpen(false);
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    const validationIssues = validateTemplateRecord(loadedRecord, activeTemplate);
    setIssues(validationIssues);

    if (validationIssues.length > 0) {
      setMessage("Existem campos obrigatórios pendentes nesta ficha");
      return;
    }

    setMessage(`Concluindo ficha ${activeTemplate.shortTitle}...`);
    const savedRecord = await persistDraft(loadedRecord);
    const completedRecord = await completeAnamneseTemplate(token, savedRecord.id, activeTemplate.id);
    lastSavedSnapshotRef.current = getRecordSnapshot(completedRecord);
    setCurrentRecord(completedRecord);
    setMessage(`Ficha ${activeTemplate.shortTitle} concluída`);
  }

  async function startNewRecord() {
    if (!token || !canCreateAnamnese || isCreatingRecord) return;
    setIsCreatingRecord(true);
    setMessage("Criando rascunho no banco...");
    try {
      const record = await createAnamneseRecord(token, { patientName: "Paciente sem nome" });
      lastSavedSnapshotRef.current = getRecordSnapshot(record);
      setCurrentRecord(record);
      setIssues([]);
      setActiveTemplateId(effectiveTemplates[0]?.id ?? "nursing-admission");
      setActiveSectionIndex(0);
      setMessage("Novo rascunho criado no banco");
      router.replace(`/anamnese/${record.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível criar o rascunho.");
    } finally {
      setIsCreatingRecord(false);
    }
  }

  function linkPatient(patientId: string) {
    if (!canLinkPatient) return;
    const patient = patients.find((item) => item.id === patientId);
    setCurrentRecord((record) => record ? {
      ...record,
      patientId: patientId || null,
      patientName: patient?.name ?? record.patientName,
      updatedAt: new Date().toISOString()
    } : record);
    setPatientSearch(patient?.name ?? "");
    setIsPatientOptionsOpen(false);
    setIsEvolutionHistoryOpen(false);
    setEvolutionHistory([]);
    setEvolutionHistoryTotal(0);
    setEvolutionHistoryPage(1);
    setMessage(patient ? `Paciente vinculado: ${patient.name}` : "Vinculo com paciente removido");
  }

  function openEvolutionHistory() {
    if (!canOpenEvolutionHistory) return;
    setEvolutionHistoryPage(1);
    setIsEvolutionHistoryOpen(true);
  }

  async function downloadEvolutionHistoryPdf(evolution: MedicalEvolution) {
    if (!token || !loadedRecord.patientId || !canPrintEvolutionHistory) return;

    const patient = selectedPatient ?? {
      id: loadedRecord.patientId,
      name: linkedPatientName,
      createdAt: loadedRecord.createdAt,
      updatedAt: loadedRecord.updatedAt
    };

    setPrintingEvolutionId(evolution.id);
    try {
      setEvolutionHistoryMessage("Gerando PDF da evolução...");
      const latestEvolution = await fetchMedicalEvolution(token, evolution.id);
      const document = await emitMedicalEvolutionPdfDocument(token, evolution.id);
      await downloadMedicalEvolutionPdf(patient, latestEvolution, document.code);
      setEvolutionHistoryMessage(`PDF ${document.code} gerado.`);
    } catch (error) {
      setEvolutionHistoryMessage(error instanceof Error ? error.message : "Não foi possível gerar o PDF da evolução.");
    } finally {
      setPrintingEvolutionId(null);
    }
  }

  async function handleDownloadPdf() {
    if (!token || !canPrintAnamnese) return;
    setMessage("Gerando PDF...");
    const document = await emitAnamnesePdfDocument(token, loadedRecord.id);
    await downloadAnamnesePdf(loadedRecord, effectiveTemplates);
    setMessage(`PDF ${document.code} gerado.`);
  }

  async function handleDownloadTemplatePdf() {
    if (!token || !canPrintAnamnese || !isActiveTemplateCompleted) return;
    setMessage(`Gerando PDF da ficha ${activeTemplate.shortTitle}...`);
    const document = await emitAnamneseTemplatePdfDocument(token, loadedRecord.id, activeTemplate.id);
    await downloadAnamnesePdf(loadedRecord, effectiveTemplates, {
      templateId: activeTemplate.id,
      title: "FICHA DE ANAMNESE",
      summaryStatus: `Documento parcial - ${activeTemplate.shortTitle} concluída`,
      fileNameSuffix: activeTemplate.id
    });
    setMessage(`PDF parcial ${document.code} gerado.`);
  }

  function addCustomQuestion() {
    if (!canManageCurrentQuestions) return;

    const normalizedLabel = newQuestionLabel.trim();

    if (!normalizedLabel) {
      return;
    }

    const alreadyExists = sectionFields.some((field) => field.label.toLowerCase() === normalizedLabel.toLowerCase());

    if (alreadyExists) {
      setMessage("Essa pergunta já existe nesta seção");
      return;
    }

    if (newQuestionType === "multiChoice" && parsedNewQuestionOptions.length === 0) {
      setMessage("Informe as opções da pergunta de múltipla seleção");
      return;
    }

    if (newQuestionType === "table" && (parsedTableRows.length === 0 || parsedTableColumns.length === 0)) {
      setMessage("Informe ao menos uma linha e uma coluna para a tabela");
      return;
    }

    const newField: FormField = {
      id: `custom-${activeSection.id}-${crypto.randomUUID()}`,
      label: normalizedLabel,
      type: newQuestionType,
      options: newQuestionType === "yesNo" ? yesNoOptions : newQuestionType === "multiChoice" ? parsedNewQuestionOptions : undefined,
      rows: newQuestionType === "table" ? parsedTableRows : undefined,
      columns: newQuestionType === "table" ? parsedTableColumns.map((column) => ({ id: `custom-column-${crypto.randomUUID()}`, label: column })) : undefined,
      helper: newQuestionType === "yesNoDetails"
        ? "Pergunta personalizada com complemento quando a resposta for Sim."
        : newQuestionType === "multiChoice"
          ? "Pergunta personalizada de múltipla seleção."
          : newQuestionType === "table"
            ? "Tabela personalizada adicionada neste registro."
            : "Pergunta personalizada adicionada neste registro."
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
    setMultiChoiceOptionDrafts([""]);
    setIsMultiChoiceModalOpen(false);
    setTableRowDrafts([""]);
    setTableColumnDrafts([""]);
    setIsTableQuestionModalOpen(false);
    setMessage("Pergunta personalizada adicionada");
  }

  function handleNewQuestionPrimaryAction() {
    if (newQuestionType === "multiChoice") {
      setIsMultiChoiceModalOpen(true);
      return;
    }

    if (newQuestionType === "table") {
      setIsTableQuestionModalOpen(true);
      return;
    }

    addCustomQuestion();
  }

  function updateMultiChoiceOption(index: number, value: string) {
    setMultiChoiceOptionDrafts((currentOptions) => currentOptions.map((option, optionIndex) => optionIndex === index ? value : option));
  }

  function addMultiChoiceOption() {
    setMultiChoiceOptionDrafts((currentOptions) => [...currentOptions, ""]);
  }

  function removeMultiChoiceOption(index: number) {
    setMultiChoiceOptionDrafts((currentOptions) => currentOptions.length === 1 ? [""] : currentOptions.filter((_, optionIndex) => optionIndex !== index));
  }

  function updateTableRowDraft(index: number, value: string) {
    setTableRowDrafts((currentRows) => currentRows.map((row, rowIndex) => rowIndex === index ? value : row));
  }

  function addTableRowDraft() {
    setTableRowDrafts((currentRows) => [...currentRows, ""]);
  }

  function removeTableRowDraft(index: number) {
    setTableRowDrafts((currentRows) => currentRows.length === 1 ? [""] : currentRows.filter((_, rowIndex) => rowIndex !== index));
  }

  function updateTableColumnDraft(index: number, value: string) {
    setTableColumnDrafts((currentColumns) => currentColumns.map((column, columnIndex) => columnIndex === index ? value : column));
  }

  function addTableColumnDraft() {
    setTableColumnDrafts((currentColumns) => [...currentColumns, ""]);
  }

  function removeTableColumnDraft(index: number) {
    setTableColumnDrafts((currentColumns) => currentColumns.length === 1 ? [""] : currentColumns.filter((_, columnIndex) => columnIndex !== index));
  }

  function updateCustomQuestion(fieldId: string) {
    if (!canManageCurrentQuestions) return;

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
    if (!canManageCurrentQuestions) return;

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

  function getTemplateConfigItems() {
    const existingConfigById = new Map((loadedRecord.templateConfig ?? []).map((config) => [config.id, config]));
    const baseTemplateIds = new Set(templates.map((template) => template.id));

    return effectiveTemplates.map((template, index) => {
      const existingConfig = existingConfigById.get(template.id);
      return {
        id: template.id,
        title: existingConfig?.title ?? template.title,
        shortTitle: existingConfig?.shortTitle ?? template.shortTitle,
        description: existingConfig?.description ?? template.description,
        sortOrder: index,
        isCustom: existingConfig?.isCustom ?? !baseTemplateIds.has(template.id),
        sections: existingConfig?.sections
      };
    });
  }

  function applyTemplateConfig(nextConfig: TemplateConfigItem[]) {
    if (!canManageCurrentQuestions) return;

    const normalizedConfig = nextConfig.map((config, index) => ({ ...config, sortOrder: index }));

    setCurrentRecord((record) => {
      if (!record) return record;

      const existingConfigById = new Map((record.templateConfig ?? []).map((config) => [config.id, config]));
      const editableConfig = normalizedConfig.flatMap((config) => {
        if (record.templateStatuses?.[config.id]?.status !== "completed") return [config];
        const existingConfig = existingConfigById.get(config.id);
        return existingConfig ? [existingConfig] : [];
      });

      const nextAnswers = { ...record.answers };
      const nextCustomFields = { ...record.customFields };

      for (const config of editableConfig) {
        nextAnswers[config.id] = nextAnswers[config.id] ?? {};
        if (config.isCustom) {
          nextCustomFields[config.id] = nextCustomFields[config.id] ?? { [customTemplateSectionId]: [] };
        }
      }

      return {
        ...record,
        answers: nextAnswers,
        customFields: nextCustomFields,
        templateConfig: editableConfig,
        updatedAt: new Date().toISOString()
      };
    });
    setMessage("Configuração das fichas atualizada");
  }

  function isTemplateConfigLocked(templateId: TemplateId) {
    return loadedRecord.templateStatuses?.[templateId]?.status === "completed";
  }

  function updateTemplateConfigItem(templateId: TemplateId, patch: Partial<TemplateConfigItem>) {
    if (isTemplateConfigLocked(templateId)) {
      setMessage("Ficha concluída não pode ser editada.");
      return;
    }

    applyTemplateConfig(getTemplateConfigItems().map((config) => config.id === templateId ? { ...config, ...patch } : config));
  }

  function moveTemplateConfigItem(templateId: TemplateId, direction: -1 | 1) {
    const configItems = getTemplateConfigItems();
    const currentIndex = configItems.findIndex((config) => config.id === templateId);
    const nextIndex = currentIndex + direction;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= configItems.length) return;
    if (isTemplateConfigLocked(templateId) || isTemplateConfigLocked(configItems[nextIndex].id)) {
      setMessage("Ficha concluída não pode ser reordenada.");
      return;
    }

    const nextConfigItems = [...configItems];
    [nextConfigItems[currentIndex], nextConfigItems[nextIndex]] = [nextConfigItems[nextIndex], nextConfigItems[currentIndex]];
    applyTemplateConfig(nextConfigItems);
  }

  function addCustomTemplate() {
    const normalizedTitle = newTemplateTitle.trim();

    if (!normalizedTitle) return;

    const nextTemplate: TemplateConfigItem = {
      id: `custom-template-${crypto.randomUUID()}`,
      title: normalizedTitle,
      shortTitle: normalizedTitle,
      description: "Ficha personalizada deste registro.",
      sortOrder: getTemplateConfigItems().length,
      isCustom: true
    };

    applyTemplateConfig([...getTemplateConfigItems(), nextTemplate]);
    setNewTemplateTitle("");
  }

  function getSectionConfigItems() {
    const baseTemplate = templates.find((template) => template.id === activeTemplate.id);
    const baseSectionIds = new Set((baseTemplate?.sections ?? (activeTemplate.id.startsWith("custom-template-") ? [{ id: customTemplateSectionId }] : [])).map((section) => section.id));
    const existingTemplateConfig = loadedRecord.templateConfig?.find((config) => config.id === activeTemplate.id);
    const existingSectionConfigById = new Map((existingTemplateConfig?.sections ?? []).map((sectionConfig) => [sectionConfig.id, sectionConfig]));

    return activeTemplate.sections.map((section, index) => {
      const existingSectionConfig = existingSectionConfigById.get(section.id);
      return {
        id: section.id,
        title: existingSectionConfig?.title ?? section.title,
        description: existingSectionConfig?.description ?? section.description,
        sortOrder: index,
        isCustom: existingSectionConfig?.isCustom ?? !baseSectionIds.has(section.id)
      };
    });
  }

  function applySectionConfigItems(templateId: TemplateId, nextSectionConfig: SectionConfigItem[]) {
    if (!canManageCurrentQuestions) return;

    const normalizedSectionConfig = nextSectionConfig.map((sectionConfig, index) => ({ ...sectionConfig, sortOrder: index }));
    const nextTemplateConfigItems = getTemplateConfigItems().map((templateConfig) => templateConfig.id === templateId ? {
      ...templateConfig,
      sections: normalizedSectionConfig
    } : templateConfig);

    setCurrentRecord((record) => {
      if (!record) return record;

      const nextCustomFields = { ...record.customFields };
      nextCustomFields[templateId] = { ...nextCustomFields[templateId] };

      for (const sectionConfig of normalizedSectionConfig) {
        if (sectionConfig.isCustom) {
          nextCustomFields[templateId][sectionConfig.id] = nextCustomFields[templateId][sectionConfig.id] ?? [];
        }
      }

      return {
        ...record,
        customFields: nextCustomFields,
        templateConfig: nextTemplateConfigItems,
        updatedAt: new Date().toISOString()
      };
    });
    setMessage("Configuração das abas atualizada");
  }

  function updateSectionConfigItem(sectionId: string, patch: Partial<SectionConfigItem>) {
    applySectionConfigItems(activeTemplate.id, getSectionConfigItems().map((sectionConfig) => sectionConfig.id === sectionId ? { ...sectionConfig, ...patch } : sectionConfig));
  }

  function moveSectionConfigItem(sectionId: string, direction: -1 | 1) {
    const sectionConfigItems = getSectionConfigItems();
    const currentIndex = sectionConfigItems.findIndex((sectionConfig) => sectionConfig.id === sectionId);
    const nextIndex = currentIndex + direction;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= sectionConfigItems.length) return;

    const nextSectionConfigItems = [...sectionConfigItems];
    [nextSectionConfigItems[currentIndex], nextSectionConfigItems[nextIndex]] = [nextSectionConfigItems[nextIndex], nextSectionConfigItems[currentIndex]];
    applySectionConfigItems(activeTemplate.id, nextSectionConfigItems);
    setActiveSectionIndex(nextIndex);
  }

  function moveSectionConfigItemTo(sectionId: string, targetSectionId: string) {
    if (sectionId === targetSectionId) return;

    const sectionConfigItems = getSectionConfigItems();
    const currentIndex = sectionConfigItems.findIndex((sectionConfig) => sectionConfig.id === sectionId);
    const targetIndex = sectionConfigItems.findIndex((sectionConfig) => sectionConfig.id === targetSectionId);

    if (currentIndex < 0 || targetIndex < 0) return;

    const nextSectionConfigItems = [...sectionConfigItems];
    const [movedSectionConfig] = nextSectionConfigItems.splice(currentIndex, 1);
    nextSectionConfigItems.splice(targetIndex, 0, movedSectionConfig);
    applySectionConfigItems(activeTemplate.id, nextSectionConfigItems);
    setActiveSectionIndex(targetIndex);
  }

  function addCustomSection() {
    const normalizedTitle = newSectionTitle.trim();

    if (!normalizedTitle) return;

    const nextSection: SectionConfigItem = {
      id: `custom-section-${crypto.randomUUID()}`,
      title: normalizedTitle,
      description: undefined,
      sortOrder: getSectionConfigItems().length,
      isCustom: true
    };

    const currentSectionConfigItems = getSectionConfigItems();
    applySectionConfigItems(activeTemplate.id, [...currentSectionConfigItems, nextSection]);
    setActiveSectionIndex(currentSectionConfigItems.length);
    setNewSectionTitle("");
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
            <div className="patient-link-title-row">
              <h3>{linkedPatientName}</h3>
              {canOpenEvolutionHistory ? (
                <button aria-label="Ver histórico de evoluções do paciente" className="patient-history-button" onClick={openEvolutionHistory} title="Ver histórico de evoluções do paciente" type="button">
                  <FileSearch aria-hidden="true" size={17} />
                </button>
              ) : null}
            </div>
            <p>{hasLinkedPatient ? "Paciente vinculado para registro no prontuário ao finalizar." : "Vincule um paciente para registrar a anamnese no prontuário ao finalizar."}</p>
          </div>
          <div className="patient-link-fields">
            {canLinkPatient ? <div className="patient-link-selector">
              <label className="patient-link-search">
                <span>Paciente vinculado</span>
                <div>
                  <Search aria-hidden="true" size={16} />
                  <input
                    disabled={!canLinkPatient}
                    onChange={(event) => {
                      setPatientSearch(event.target.value);
                      setIsPatientOptionsOpen(true);
                    }}
                    onFocus={() => setIsPatientOptionsOpen(true)}
                    placeholder="Digite o nome, CPF ou RG do paciente"
                    value={patientSearch}
                  />
                </div>
              </label>
              {shouldShowPatientOptions ? (
                <div className="patient-link-options" aria-label="Opções de pacientes">
                  {hasLinkedPatient ? (
                    <button className="is-unlink" onClick={() => linkPatient("")} type="button">
                      <strong>Sem vínculo</strong>
                      <span>Remover paciente vinculado desta anamnese</span>
                    </button>
                  ) : null}
                  {patients.map((patient) => {
                    const isSelected = patient.id === loadedRecord.patientId;
                    return (
                      <button className={isSelected ? "is-selected" : ""} key={patient.id} onClick={() => linkPatient(patient.id)} type="button">
                        <strong>{patient.name}</strong>
                        <span>{formatPatientDocuments(patient)}</span>
                        {isSelected ? <CheckCircle2 aria-hidden="true" size={16} /> : null}
                      </button>
                    );
                  })}
                  {patients.length === 0 ? <div className="empty-state">Nenhum paciente encontrado.</div> : null}
                </div>
              ) : null}
            </div> : null}
          </div>
        </div> : null}

        {isEvolutionHistoryOpen && loadedRecord.patientId ? (
          <div className="confirmation-modal-layer" role="presentation">
            <button aria-label="Fechar histórico de evoluções" className="confirmation-modal-backdrop" onClick={() => setIsEvolutionHistoryOpen(false)} type="button" />
            <section aria-labelledby="evolution-history-title" aria-modal="true" className="confirmation-modal-panel evolution-history-modal" role="dialog">
              <div className="confirmation-modal-heading">
                <span className="confirmation-modal-icon is-primary"><FileText aria-hidden="true" size={20} /></span>
                <div>
                  <span className="eyebrow">Prontuário</span>
                  <h3 id="evolution-history-title">Histórico de evoluções</h3>
                </div>
                <button className="icon-button" onClick={() => setIsEvolutionHistoryOpen(false)} title="Fechar histórico" type="button"><X aria-hidden="true" size={18} /></button>
              </div>
              <p>{linkedPatientName}. {isEvolutionHistoryLoading ? "Atualizando histórico..." : evolutionHistoryMessage}</p>
              <div className={`records-table-shell ${isEvolutionHistoryLoading ? "is-loading" : ""}`}>
                <table className="records-table evolution-history-table">
                  <colgroup>
                    <col className="evolution-history-date-column" />
                    <col className="evolution-history-status-column" />
                    <col className="evolution-history-area-column" />
                    <col className="evolution-history-actions-column" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Data e hora</th>
                      <th>Status</th>
                      <th>Área</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evolutionHistory.length === 0 ? (
                      <tr>
                        <td colSpan={4}>{isEvolutionHistoryLoading ? "Carregando evoluções do paciente..." : "Nenhuma evolução registrada para este paciente."}</td>
                      </tr>
                    ) : evolutionHistory.map((evolution) => (
                      <tr key={evolution.id}>
                        <td>{formatDateTime(evolution.evolutionDate)}</td>
                        <td><span className={`table-status is-${evolution.status}`}>{getEvolutionStatusLabel(evolution.status)}</span></td>
                        <td>{evolution.professionalArea ?? "-"}</td>
                        <td>
                          {evolution.status === "finalized" && canPrintEvolutionHistory ? (
                            <button className="table-action" disabled={printingEvolutionId === evolution.id} onClick={() => void downloadEvolutionHistoryPdf(evolution)} type="button">
                              <Printer aria-hidden="true" size={15} />
                              {printingEvolutionId === evolution.id ? "Gerando..." : "PDF"}
                            </button>
                          ) : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pagination-bar" aria-label="Paginação do histórico de evoluções">
                <span>{isEvolutionHistoryLoading ? "Atualizando evoluções..." : formatPageSummary(evolutionHistoryTotal, evolutionHistoryOffset, evolutionHistory.length, evolutionHistoryTotal === 1 ? "evolução" : "evoluções")}</span>
                <div>
                  <button disabled={isEvolutionHistoryLoading || evolutionHistoryPage === 1} onClick={() => setEvolutionHistoryPage((currentPage) => Math.max(1, currentPage - 1))} type="button"><ChevronLeft aria-hidden="true" size={15} />Anterior</button>
                  <button disabled={isEvolutionHistoryLoading || evolutionHistoryOffset + evolutionHistory.length >= evolutionHistoryTotal} onClick={() => setEvolutionHistoryPage((currentPage) => currentPage + 1)} type="button">Próxima<ChevronRight aria-hidden="true" size={15} /></button>
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {hasLinkedPatient ? <>
        <div className="template-tabs" role="tablist" aria-label="Fichas de anamnese">
          {effectiveTemplates.map((template) => (
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
              <span>{template.shortTitle}</span>
              {loadedRecord.templateStatuses?.[template.id]?.status === "completed" ? <small>Concluída</small> : null}
            </button>
          ))}
        </div>

        <div className="template-context">
          <div>
            <h3>{activeTemplate.title}</h3>
            <p>{activeTemplate.description}</p>
            <div className="template-status-row">
              <span>{activeTemplateProgress.complete}/{activeTemplateProgress.total} obrigatórios</span>
              <span className={isActiveTemplateCompleted ? "is-completed" : ""}>{isActiveTemplateCompleted ? "Ficha concluída" : "Ficha em rascunho"}</span>
            </div>
          </div>
          {canManageCurrentQuestions ? (
            <button className="secondary-button editor-action-button" onClick={() => setIsTemplateManagerOpen(true)} type="button">
              <Pencil size={16} />
              Editar fichas
            </button>
          ) : null}
        </div>

        {isTemplateManagerOpen ? (
          <div className="confirmation-modal-layer" role="presentation">
            <button aria-label="Fechar edição de fichas" className="confirmation-modal-backdrop" onClick={() => setIsTemplateManagerOpen(false)} type="button" />
            <section aria-labelledby="template-manager-modal-title" aria-modal="true" className="confirmation-modal-panel template-manager-modal" role="dialog">
              <div className="confirmation-modal-heading">
                <span className="confirmation-modal-icon is-primary"><FileText aria-hidden="true" size={20} /></span>
                <div>
                  <span className="eyebrow">Fluxo de anamnese</span>
                  <h3 id="template-manager-modal-title">Editar fichas</h3>
                </div>
              </div>
              <div className="template-manager-list">
                {getTemplateConfigItems().map((templateConfig, index, configItems) => {
                  const isTemplateLocked = isTemplateConfigLocked(templateConfig.id);
                  const previousTemplateLocked = index > 0 && isTemplateConfigLocked(configItems[index - 1].id);
                  const nextTemplateLocked = index < configItems.length - 1 && isTemplateConfigLocked(configItems[index + 1].id);

                  return (
                  <div className="template-manager-row" key={templateConfig.id}>
                    <label>
                      <span>Nome da aba</span>
                      <input disabled={isTemplateLocked} onChange={(event) => updateTemplateConfigItem(templateConfig.id, { shortTitle: event.target.value })} value={templateConfig.shortTitle} />
                    </label>
                    <label>
                      <span>Título da ficha</span>
                      <input disabled={isTemplateLocked} onChange={(event) => updateTemplateConfigItem(templateConfig.id, { title: event.target.value })} value={templateConfig.title} />
                    </label>
                    <div className="template-manager-actions">
                      <button aria-label={`Mover ${templateConfig.shortTitle} para cima`} disabled={isTemplateLocked || previousTemplateLocked || index === 0} onClick={() => moveTemplateConfigItem(templateConfig.id, -1)} type="button">↑</button>
                      <button aria-label={`Mover ${templateConfig.shortTitle} para baixo`} disabled={isTemplateLocked || nextTemplateLocked || index === configItems.length - 1} onClick={() => moveTemplateConfigItem(templateConfig.id, 1)} type="button">↓</button>
                    </div>
                  </div>
                  );
                })}
              </div>
              <div className="template-manager-new">
                <label>
                  <span>Nova ficha personalizada</span>
                  <input
                    onChange={(event) => setNewTemplateTitle(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addCustomTemplate();
                      }
                    }}
                    placeholder="Ex.: Nutrição"
                    value={newTemplateTitle}
                  />
                </label>
                <button className="secondary-button editor-action-button" disabled={!newTemplateTitle.trim()} onClick={addCustomTemplate} type="button">
                  <Plus size={16} />
                  Adicionar ficha
                </button>
              </div>
              <div className="confirmation-modal-actions">
                <button className="primary-button" onClick={() => setIsTemplateManagerOpen(false)} type="button">Concluir edição</button>
              </div>
            </section>
          </div>
        ) : null}

        <div className="section-tabs-toolbar">
          <div className="section-rail" aria-label="Seções da ficha">
            {activeTemplate.sections.map((section, index) => (
              <button
                className={index === activeSectionIndex ? "is-active" : ""}
                draggable={canManageCurrentQuestions}
                key={section.id}
                onClick={() => setActiveSectionIndex(index)}
                onDragEnd={() => setDraggingSectionId(null)}
                onDragOver={(event) => {
                  if (!canManageCurrentQuestions || !draggingSectionId) return;
                  event.preventDefault();
                }}
                onDragStart={(event) => {
                  if (!canManageCurrentQuestions) return;
                  event.dataTransfer.effectAllowed = "move";
                  setDraggingSectionId(section.id);
                }}
                onDrop={(event) => {
                  if (!canManageCurrentQuestions || !draggingSectionId) return;
                  event.preventDefault();
                  moveSectionConfigItemTo(draggingSectionId, section.id);
                  setDraggingSectionId(null);
                }}
                type="button"
              >
                {index + 1}. {section.title}
              </button>
            ))}
          </div>
          {canManageCurrentQuestions ? (
            <button className="secondary-button editor-action-button" onClick={() => setIsSectionManagerOpen(true)} type="button">
              <Pencil size={16} />
              Editar abas
            </button>
          ) : null}
        </div>

        {isSectionManagerOpen ? (
          <div className="confirmation-modal-layer" role="presentation">
            <button aria-label="Fechar edição de abas" className="confirmation-modal-backdrop" onClick={() => setIsSectionManagerOpen(false)} type="button" />
            <section aria-labelledby="section-manager-modal-title" aria-modal="true" className="confirmation-modal-panel template-manager-modal" role="dialog">
              <div className="confirmation-modal-heading">
                <span className="confirmation-modal-icon is-primary"><FileText aria-hidden="true" size={20} /></span>
                <div>
                  <span className="eyebrow">{activeTemplate.shortTitle}</span>
                  <h3 id="section-manager-modal-title">Editar abas</h3>
                </div>
              </div>
              <div className="template-manager-list">
                {getSectionConfigItems().map((sectionConfig, index, sectionConfigItems) => (
                  <div className="template-manager-row section-manager-row" key={sectionConfig.id}>
                    <label>
                      <span>Nome da aba</span>
                      <input onChange={(event) => updateSectionConfigItem(sectionConfig.id, { title: event.target.value })} value={sectionConfig.title} />
                    </label>
                    <div className="template-manager-actions">
                      <button aria-label={`Mover ${sectionConfig.title} para cima`} disabled={index === 0} onClick={() => moveSectionConfigItem(sectionConfig.id, -1)} type="button">↑</button>
                      <button aria-label={`Mover ${sectionConfig.title} para baixo`} disabled={index === sectionConfigItems.length - 1} onClick={() => moveSectionConfigItem(sectionConfig.id, 1)} type="button">↓</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="template-manager-new">
                <label>
                  <span>Nova aba personalizada</span>
                  <input
                    onChange={(event) => setNewSectionTitle(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addCustomSection();
                      }
                    }}
                    placeholder="Ex.: Evolução nutricional"
                    value={newSectionTitle}
                  />
                </label>
                <button className="secondary-button editor-action-button" disabled={!newSectionTitle.trim()} onClick={addCustomSection} type="button">
                  <Plus size={16} />
                  Adicionar aba
                </button>
              </div>
              <div className="confirmation-modal-actions">
                <button className="primary-button" onClick={() => setIsSectionManagerOpen(false)} type="button">Concluir edição</button>
              </div>
            </section>
          </div>
        ) : null}

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
                      handleNewQuestionPrimaryAction();
                    }
                  }}
                  placeholder="Ex.: Qual foi o principal gatilho da recaída?"
                  value={newQuestionLabel}
                />
              </label>
              <label>
                <span>Tipo de pergunta</span>
                <select onChange={(event) => setNewQuestionType(event.target.value as CustomQuestionType)} value={newQuestionType}>
                  <option value="textarea">Texto livre</option>
                  <option value="yesNo">Sim/Não sem complemento</option>
                  <option value="yesNoDetails">Sim/Não com complemento se Sim</option>
                  <option value="multiChoice">Múltipla seleção</option>
                  <option value="table">Tabela</option>
                </select>
              </label>
              <button className="editor-action-button" disabled={newQuestionType !== "multiChoice" && newQuestionType !== "table" && !newQuestionLabel.trim()} onClick={handleNewQuestionPrimaryAction} title="Requer permissão de atualização da anamnese" type="button">
                <Plus size={16} />
                {newQuestionType === "multiChoice" || newQuestionType === "table" ? "Configurar pergunta" : "Adicionar pergunta"}
              </button>
            </div>
          ) : null}

          {canManageCurrentQuestions && isMultiChoiceModalOpen ? (
            <div className="confirmation-modal-layer" role="presentation">
              <button aria-label="Cancelar criação de pergunta" className="confirmation-modal-backdrop" onClick={() => setIsMultiChoiceModalOpen(false)} type="button" />
              <section aria-labelledby="multi-choice-question-modal-title" aria-modal="true" className="confirmation-modal-panel multi-choice-question-modal" role="dialog">
                <div className="confirmation-modal-heading">
                  <span className="confirmation-modal-icon is-primary"><Plus aria-hidden="true" size={20} /></span>
                  <div>
                    <span className="eyebrow">Pergunta personalizada</span>
                    <h3 id="multi-choice-question-modal-title">Múltipla seleção</h3>
                  </div>
                </div>
                <div className="multi-choice-question-fields">
                  <label>
                    <span>Nome da pergunta</span>
                    <input autoFocus onChange={(event) => setNewQuestionLabel(event.target.value)} placeholder="Ex.: Aspectos observados" value={newQuestionLabel} />
                  </label>
                  <div className="multi-choice-options-editor">
                    <span>Opções de resposta</span>
                    {multiChoiceOptionDrafts.map((option, index) => (
                      <div className="multi-choice-option-row" key={index}>
                        <input
                          aria-label={`Opção ${index + 1}`}
                          onChange={(event) => updateMultiChoiceOption(index, event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              addMultiChoiceOption();
                            }
                          }}
                          placeholder={`Opção ${index + 1}`}
                          value={option}
                        />
                        <button aria-label={`Remover opção ${index + 1}`} disabled={multiChoiceOptionDrafts.length === 1 && !option.trim()} onClick={() => removeMultiChoiceOption(index)} type="button">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                    <button className="secondary-button editor-action-button" onClick={addMultiChoiceOption} type="button">
                      <Plus size={16} />
                      Adicionar opção
                    </button>
                  </div>
                </div>
                <div className="confirmation-modal-actions">
                  <button className="secondary-button" onClick={() => setIsMultiChoiceModalOpen(false)} type="button">Cancelar</button>
                  <button className="primary-button" disabled={!newQuestionLabel.trim() || parsedNewQuestionOptions.length === 0} onClick={addCustomQuestion} type="button">Criar pergunta</button>
                </div>
              </section>
            </div>
          ) : null}

          {canManageCurrentQuestions && isTableQuestionModalOpen ? (
            <div className="confirmation-modal-layer" role="presentation">
              <button aria-label="Cancelar criação de tabela" className="confirmation-modal-backdrop" onClick={() => setIsTableQuestionModalOpen(false)} type="button" />
              <section aria-labelledby="table-question-modal-title" aria-modal="true" className="confirmation-modal-panel table-question-modal" role="dialog">
                <div className="confirmation-modal-heading">
                  <span className="confirmation-modal-icon is-primary"><Plus aria-hidden="true" size={20} /></span>
                  <div>
                    <span className="eyebrow">Pergunta personalizada</span>
                    <h3 id="table-question-modal-title">Tabela</h3>
                  </div>
                </div>
                <div className="multi-choice-question-fields">
                  <label>
                    <span>Nome da pergunta</span>
                    <input autoFocus onChange={(event) => setNewQuestionLabel(event.target.value)} placeholder="Ex.: Filhos" value={newQuestionLabel} />
                  </label>
                  <div className="table-question-groups">
                    <div className="multi-choice-options-editor">
                      <span>Itens da tabela</span>
                      {tableRowDrafts.map((row, index) => (
                        <div className="multi-choice-option-row" key={index}>
                          <input
                            aria-label={`Item ${index + 1}`}
                            onChange={(event) => updateTableRowDraft(index, event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                addTableRowDraft();
                              }
                            }}
                            placeholder={`Item ${index + 1}`}
                            value={row}
                          />
                          <button aria-label={`Remover item ${index + 1}`} disabled={tableRowDrafts.length === 1 && !row.trim()} onClick={() => removeTableRowDraft(index)} type="button">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))}
                      <button className="secondary-button editor-action-button" onClick={addTableRowDraft} type="button">
                        <Plus size={16} />
                        Adicionar item
                      </button>
                    </div>
                    <div className="multi-choice-options-editor">
                      <span>Colunas</span>
                      {tableColumnDrafts.map((column, index) => (
                        <div className="multi-choice-option-row" key={index}>
                          <input
                            aria-label={`Coluna ${index + 1}`}
                            onChange={(event) => updateTableColumnDraft(index, event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                addTableColumnDraft();
                              }
                            }}
                            placeholder={`Coluna ${index + 1}`}
                            value={column}
                          />
                          <button aria-label={`Remover coluna ${index + 1}`} disabled={tableColumnDrafts.length === 1 && !column.trim()} onClick={() => removeTableColumnDraft(index)} type="button">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))}
                      <button className="secondary-button editor-action-button" onClick={addTableColumnDraft} type="button">
                        <Plus size={16} />
                        Adicionar coluna
                      </button>
                    </div>
                  </div>
                </div>
                <div className="confirmation-modal-actions">
                  <button className="secondary-button" onClick={() => setIsTableQuestionModalOpen(false)} type="button">Cancelar</button>
                  <button className="primary-button" disabled={!newQuestionLabel.trim() || parsedTableRows.length === 0 || parsedTableColumns.length === 0} onClick={addCustomQuestion} type="button">Criar tabela</button>
                </div>
              </section>
            </div>
          ) : null}

          {canFinalizeAnamnese && isTemplateCompletionConfirmOpen ? (
            <div className="confirmation-modal-layer" role="presentation">
              <button aria-label="Cancelar conclusão da ficha" className="confirmation-modal-backdrop" onClick={() => setIsTemplateCompletionConfirmOpen(false)} type="button" />
              <section aria-labelledby="template-completion-confirm-title" aria-modal="true" className="confirmation-modal-panel" role="dialog">
                <div className="confirmation-modal-heading">
                  <span className="confirmation-modal-icon is-primary"><CheckCircle2 aria-hidden="true" size={20} /></span>
                  <div>
                    <span className="eyebrow">Confirmacao obrigatoria</span>
                    <h3 id="template-completion-confirm-title">Concluir ficha {activeTemplate.shortTitle}?</h3>
                  </div>
                </div>
                <p>Ao concluir esta ficha, ela ficará bloqueada: não será mais possível editar respostas, adicionar perguntas, editar ou excluir itens desta ficha.</p>
                <div className="confirmation-modal-actions">
                  <button className="secondary-button" onClick={() => setIsTemplateCompletionConfirmOpen(false)} type="button">Cancelar</button>
                  <button className="primary-button" onClick={() => { void completeActiveTemplate(); }} type="button">Concluir ficha</button>
                </div>
              </section>
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
                  canEditRecord={canEditActiveTemplate}
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
              <button className="secondary-button" disabled={isCreatingRecord} onClick={startNewRecord} type="button">
                <Plus size={17} />
                {isCreatingRecord ? "Criando..." : "Nova"}
              </button>
            ) : null}
            {canUpdateAnamnese && !isActiveTemplateCompleted ? (
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
            {canPrintAnamnese ? (
              <button className="secondary-button" disabled={!isActiveTemplateCompleted} onClick={() => { void handleDownloadTemplatePdf(); }} type="button">
                <Printer size={17} />
                PDF da ficha
              </button>
            ) : null}
            {canFinalizeAnamnese && !isActiveTemplateCompleted ? (
              <button className="secondary-button" disabled={loadedRecord.status === "finalized"} onClick={() => setIsTemplateCompletionConfirmOpen(true)} type="button">
                <CheckCircle2 size={17} />
                Concluir ficha
              </button>
            ) : null}
            {canFinalizeAnamnese ? (
              <button className="primary-button" disabled={loadedRecord.status === "finalized" || !allTemplatesCompleted} onClick={() => saveRecord("finalized")} type="button">
                <FileCheck2 size={17} />
                Finalizar completa
              </button>
            ) : null}
          </div>
        </div>
        </> : (
          <div className="patient-required-state">
            <span className="confirmation-modal-icon is-primary"><FileText aria-hidden="true" size={20} /></span>
            <div>
              <h3>Selecione um paciente para preencher a anamnese</h3>
              <p>Use a busca acima para vincular um paciente ativo já cadastrado antes de abrir as fichas.</p>
            </div>
          </div>
        )}
      </section>
      {hasLinkedPatient ? <AnamnesePrintDocument record={loadedRecord} templates={effectiveTemplates} /> : null}
    </div>
  );
}