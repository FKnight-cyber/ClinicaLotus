import { ClinicLogo } from "@/components/brand/ClinicLogo";
import { anamneseTemplates } from "./templates";
import type { AnamneseRecord, FieldValue, FormField, TableValue, TemplateId } from "./types";

type AnamnesePrintDocumentProps = {
  record: AnamneseRecord;
};

function getPrintablePatientName(record: AnamneseRecord) {
  const nursingName = record.answers["nursing-admission"].patientName;
  const psychologicalName = record.answers.psychological.patient;
  const therapeuticName = record.answers["therapeutic-initial"].therapeuticPatientName;
  const consentName = record.answers["therapeutic-initial"].consentPatientName;

  if (typeof nursingName === "string" && nursingName.trim()) return nursingName.trim();
  if (typeof psychologicalName === "string" && psychologicalName.trim()) return psychologicalName.trim();
  if (typeof therapeuticName === "string" && therapeuticName.trim()) return therapeuticName.trim();
  if (typeof consentName === "string" && consentName.trim()) return consentName.trim();
  return record.patientName || "Paciente sem nome";
}

function formatPrintDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatPrintValue(value: FieldValue | undefined) {
  if (!value) return "-";
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "-";
  if (typeof value === "string") return value.trim() || "-";
  if (typeof value === "object" && "answer" in value) {
    const answer = typeof value.answer === "string" && value.answer.trim() ? value.answer.trim() : "-";
    const details = typeof value.details === "string" && value.details.trim() ? value.details.trim() : "";
    return details ? `${answer}. ${details}` : answer;
  }
  return "-";
}

function getSectionFields(record: AnamneseRecord, templateId: TemplateId, sectionId: string, fields: FormField[]) {
  const customFields = record.customFields?.[templateId]?.[sectionId] ?? [];
  const sectionOverrides = record.customFields?.[templateId]?.[`__overrides__${sectionId}`] ?? [];
  const removedFieldIds = new Set(sectionOverrides.filter((field) => field.id.startsWith("removed-")).map((field) => field.id.replace("removed-", "")));
  const renamedFields = new Map(sectionOverrides.filter((field) => field.id.startsWith("renamed-")).map((field) => [field.id.replace("renamed-", ""), field.label]));
  const baseFields = fields
    .filter((field) => !removedFieldIds.has(field.id))
    .map((field) => renamedFields.has(field.id) ? { ...field, label: renamedFields.get(field.id) ?? field.label } : field);

  return [...baseFields, ...customFields];
}

function getPrintableRows(field: FormField, value: FieldValue | undefined) {
  const tableValue = typeof value === "object" && !Array.isArray(value) && value !== null ? value as TableValue : {};
  const baseRows = field.rows ?? [];
  const removedRows = Array.isArray(tableValue.__removedRows) ? tableValue.__removedRows as unknown as string[] : [];
  const renamedRows = typeof tableValue.__renamedRows === "object" && tableValue.__renamedRows !== null ? tableValue.__renamedRows as unknown as Record<string, string> : {};
  const customRows = Object.keys(tableValue).filter((row) => !baseRows.includes(row) && !row.startsWith("__"));

  return [...baseRows, ...customRows]
    .filter((row) => !removedRows.includes(row))
    .map((row) => ({ id: row, label: renamedRows[row] ?? row, value: tableValue[row] ?? {} }));
}

function PrintField({ field, value }: { field: FormField; value: FieldValue | undefined }) {
  if (field.type === "table") {
    const rows = getPrintableRows(field, value);

    return (
      <div className="print-field print-field-wide">
        <h4>{field.label}</h4>
        <table className="print-table">
          <thead>
            <tr>
              <th>Item</th>
              {field.columns?.map((column) => <th key={column.id}>{column.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={(field.columns?.length ?? 0) + 1}>Sem registros.</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <th>{row.label}</th>
                  {field.columns?.map((column) => <td key={column.id}>{row.value[column.id] || "-"}</td>)}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className={`print-field ${field.type === "textarea" ? "print-field-wide" : ""}`}>
      <span>{field.label}</span>
      <strong>{formatPrintValue(value)}</strong>
    </div>
  );
}

export function AnamnesePrintDocument({ record }: AnamnesePrintDocumentProps) {
  return (
    <article className="print-document" aria-label="Documento para impressão da anamnese">
      <header className="print-cover-header">
        <div className="print-logo" aria-hidden="true">
          <ClinicLogo />
        </div>
        <div>
          <strong>Flor de Lótus</strong>
          <span>Clínica Terapêutica</span>
        </div>
      </header>

      <section className="print-document-title">
        <h1>Anamnese Clínica</h1>
        <p>Registro consolidado das fichas preenchidas no sistema.</p>
      </section>

      <section className="print-summary">
        <div>
          <span>Paciente</span>
          <strong>{getPrintablePatientName(record)}</strong>
        </div>
        <div>
          <span>Código</span>
          <strong>{record.code}</strong>
        </div>
        <div>
          <span>Status</span>
          <strong>{record.status === "finalized" ? "Finalizada" : "Rascunho"}</strong>
        </div>
        <div>
          <span>Última alteração</span>
          <strong>{formatPrintDateTime(record.updatedAt)}</strong>
        </div>
      </section>

      {anamneseTemplates.map((template) => (
        <section className="print-template" key={template.id}>
          <h2>{template.title}</h2>
          {template.sections.map((section) => {
            const fields = getSectionFields(record, template.id, section.id, section.fields);

            if (fields.length === 0) {
              return null;
            }

            return (
              <section className="print-section" key={section.id}>
                <h3>{section.title}</h3>
                {section.description ? <p>{section.description}</p> : null}
                <div className="print-field-grid">
                  {fields.map((field) => (
                    <PrintField field={field} key={field.id} value={record.answers[template.id][field.id]} />
                  ))}
                </div>
              </section>
            );
          })}
        </section>
      ))}

      <footer className="print-signatures">
        <div>
          <span>Assinatura do paciente</span>
        </div>
        <div>
          <span>Assinatura do profissional responsável</span>
        </div>
      </footer>
    </article>
  );
}