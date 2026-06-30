import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { clinicLogoSvg } from "@/components/brand/clinicLogoSvg";
import type { AnamneseRecord, FieldValue, FormField, FormTemplate, TableValue, TemplateId } from "./types";

type JsPdfWithAutoTable = jsPDF & {
  lastAutoTable?: {
    finalY: number;
  };
};

const margin = 14;
const pageWidth = 210;
const pageHeight = 297;
const contentWidth = pageWidth - margin * 2;
const columnGap = 4;
const twoColumnWidth = (contentWidth - columnGap) / 2;

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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatValue(value: FieldValue | undefined) {
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

function ensureSpace(doc: jsPDF, y: number, requiredHeight: number) {
  if (y + requiredHeight <= pageHeight - margin) {
    return y;
  }

  doc.addPage();
  return margin;
}

function svgToPngDataUrl(svg: string, width: number, height: number) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    image.onload = () => {
      const canvas = document.createElement("canvas");
      const scale = 3;
      canvas.width = width * scale;
      canvas.height = height * scale;
      const context = canvas.getContext("2d");

      if (!context) {
        URL.revokeObjectURL(url);
        reject(new Error("Não foi possível preparar o logo para o PDF."));
        return;
      }

      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível carregar o logo para o PDF."));
    };

    image.src = url;
  });
}

async function drawLogo(doc: jsPDF, x: number, y: number) {
  const logoDataUrl = await svgToPngDataUrl(clinicLogoSvg, 112, 92);
  doc.addImage(logoDataUrl, "PNG", x, y, 31, 25.5, undefined, "FAST");
}

async function drawHeader(doc: jsPDF, record: AnamneseRecord) {
  await drawLogo(doc, margin, margin - 2);

  doc.setTextColor(123, 63, 178);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text("Flor de Lótus", margin + 40, margin + 8);
  doc.setTextColor(139, 106, 167);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Clínica Terapêutica", margin + 40, margin + 14);

  doc.setTextColor(23, 49, 43);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("ANAMNESE CLÍNICA", pageWidth - margin, margin + 8, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(record.code, pageWidth - margin, margin + 14, { align: "right" });

  doc.setDrawColor(190, 205, 198);
  doc.line(margin, margin + 36, pageWidth - margin, margin + 36);
}

function drawSummary(doc: jsPDF, record: AnamneseRecord, startY: number) {
  const patientName = getPrintablePatientName(record);
  const summaryRows = [
    ["Paciente", patientName],
    ["Status", record.status === "finalized" ? "Finalizada" : "Rascunho"],
    ["Última alteração", formatDateTime(record.updatedAt)]
  ];

  autoTable(doc, {
    body: summaryRows,
    startY,
    theme: "grid",
    margin: { left: margin, right: margin },
    styles: { font: "helvetica", fontSize: 8, cellPadding: 2.2, overflow: "linebreak" },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 38, fillColor: [238, 244, 241], textColor: [23, 49, 43] },
      1: { cellWidth: contentWidth - 38 }
    }
  });

  return (doc as JsPdfWithAutoTable).lastAutoTable?.finalY ?? startY;
}

function drawSectionTitle(doc: jsPDF, title: string, y: number, level: "template" | "section") {
  const height = level === "template" ? 8 : 7;
  const nextY = ensureSpace(doc, y, height + 4);

  if (level === "template") {
    doc.setFillColor(234, 243, 239);
    doc.rect(margin, nextY, contentWidth, height, "F");
    doc.setDrawColor(15, 107, 90);
    doc.setLineWidth(1.4);
    doc.line(margin, nextY, margin, nextY + height);
    doc.setTextColor(23, 49, 43);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(title.toUpperCase(), margin + 3, nextY + 5.4);
  } else {
    doc.setTextColor(23, 49, 43);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(title, margin, nextY + 4.8);
    doc.setDrawColor(203, 216, 210);
    doc.line(margin, nextY + 6.5, pageWidth - margin, nextY + 6.5);
  }

  return nextY + height + 3;
}

function getTextFieldHeight(doc: jsPDF, field: FormField, value: FieldValue | undefined, width: number) {
  const labelLines = doc.splitTextToSize(field.label.toUpperCase(), width - 4);
  const bodyLines = doc.splitTextToSize(formatValue(value), width - 4);
  return Math.max(12, 5 + labelLines.length * 3.3 + bodyLines.length * 4.1);
}

function drawTextFieldBox(doc: jsPDF, field: FormField, value: FieldValue | undefined, x: number, y: number, width: number, height: number) {
  const label = field.label;
  const body = formatValue(value);
  const labelLines = doc.splitTextToSize(label.toUpperCase(), width - 4);
  const bodyLines = doc.splitTextToSize(body, width - 4);

  doc.setDrawColor(216, 226, 221);
  doc.roundedRect(x, y, width, height, 1.5, 1.5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(87, 104, 97);
  doc.text(labelLines, x + 2, y + 4.2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.4);
  doc.setTextColor(23, 49, 43);
  doc.text(bodyLines, x + 2, y + 4.2 + labelLines.length * 3.3 + 1.2);
}

function drawTextField(doc: jsPDF, field: FormField, value: FieldValue | undefined, y: number) {
  const height = getTextFieldHeight(doc, field, value, contentWidth);
  const nextY = ensureSpace(doc, y, height + 3);

  drawTextFieldBox(doc, field, value, margin, nextY, contentWidth, height);

  return nextY + height + 3;
}

function shouldUseFullWidthField(field: FormField, value: FieldValue | undefined) {
  const text = formatValue(value);
  return field.type === "textarea" || field.type === "yesNoDetails" || field.label.length > 58 || text.length > 85 || Array.isArray(value);
}

function drawTextFieldRow(doc: jsPDF, fields: FormField[], record: AnamneseRecord, templateId: TemplateId, y: number) {
  const heights = fields.map((field) => getTextFieldHeight(doc, field, record.answers[templateId][field.id], fields.length === 1 ? contentWidth : twoColumnWidth));
  const rowHeight = Math.max(...heights);
  const nextY = ensureSpace(doc, y, rowHeight + 3);

  fields.forEach((field, index) => {
    const width = fields.length === 1 ? contentWidth : twoColumnWidth;
    const x = fields.length === 1 ? margin : margin + index * (twoColumnWidth + columnGap);
    drawTextFieldBox(doc, field, record.answers[templateId][field.id], x, nextY, width, rowHeight);
  });

  return nextY + rowHeight + 3;
}

function drawTextFieldsCompact(doc: jsPDF, fields: FormField[], record: AnamneseRecord, templateId: TemplateId, y: number) {
  let nextY = y;
  let rowBuffer: FormField[] = [];

  function flushRow() {
    if (rowBuffer.length === 0) return;
    nextY = drawTextFieldRow(doc, rowBuffer, record, templateId, nextY);
    rowBuffer = [];
  }

  fields.forEach((field) => {
    const value = record.answers[templateId][field.id];
    const isWide = shouldUseFullWidthField(field, value);

    if (isWide) {
      flushRow();
      nextY = drawTextField(doc, field, value, nextY);
      return;
    }

    rowBuffer.push(field);

    if (rowBuffer.length === 2) {
      flushRow();
    }
  });

  flushRow();
  return nextY;
}

function drawTableField(doc: jsPDF, field: FormField, value: FieldValue | undefined, y: number) {
  const rows = getPrintableRows(field, value);
  const head = [["Item", ...(field.columns?.map((column) => column.label) ?? [])]];
  const body = rows.map((row) => [row.label, ...(field.columns?.map((column) => row.value[column.id] || "-") ?? [])]);
  let nextY = drawSectionTitle(doc, field.label, y, "section");

  autoTable(doc, {
    head,
    body: body.length > 0 ? body : [["Sem registros.", ...(field.columns?.map(() => "") ?? [])]],
    startY: nextY,
    theme: "grid",
    margin: { left: margin, right: margin, top: margin, bottom: margin },
    styles: { font: "helvetica", fontSize: 7.4, cellPadding: 1.8, overflow: "linebreak", valign: "top" },
    headStyles: { fillColor: [238, 244, 241], textColor: [23, 49, 43], fontStyle: "bold" },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 34 } },
    rowPageBreak: "avoid",
    pageBreak: "auto"
  });

  nextY = ((doc as JsPdfWithAutoTable).lastAutoTable?.finalY ?? nextY) + 4;
  return nextY;
}

function addFooters(doc: jsPDF) {
  const totalPages = doc.getNumberOfPages();

  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(90, 104, 98);
    doc.text(`Página ${page} de ${totalPages}`, pageWidth - margin, pageHeight - 7, { align: "right" });
  }
}

export async function downloadAnamnesePdf(record: AnamneseRecord, templates: FormTemplate[]) {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  await drawHeader(doc, record);
  let y = drawSummary(doc, record, margin + 42) + 8;

  for (const template of templates) {
    y = drawSectionTitle(doc, template.title, y, "template");

    for (const section of template.sections) {
      const fields = getSectionFields(record, template.id, section.id, section.fields);

      if (fields.length === 0) continue;

      y = drawSectionTitle(doc, section.title, y, "section");

      if (section.description) {
        const descriptionLines = doc.splitTextToSize(section.description, contentWidth);
        y = ensureSpace(doc, y, descriptionLines.length * 4.2 + 2);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(77, 95, 88);
        doc.text(descriptionLines, margin, y);
        y += descriptionLines.length * 4.2 + 2;
      }

      let textFieldsBuffer: FormField[] = [];

      function flushTextFields() {
        if (textFieldsBuffer.length === 0) return;
        y = drawTextFieldsCompact(doc, textFieldsBuffer, record, template.id, y);
        textFieldsBuffer = [];
      }

      for (const field of fields) {
        if (field.type === "table") {
          flushTextFields();
          y = drawTableField(doc, field, record.answers[template.id][field.id], y);
          continue;
        }

        textFieldsBuffer.push(field);
      }

      flushTextFields();
    }
  }

  y = ensureSpace(doc, y, 28);
  doc.setDrawColor(23, 49, 43);
  doc.line(margin, y + 16, margin + 75, y + 16);
  doc.line(pageWidth - margin - 75, y + 16, pageWidth - margin, y + 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Assinatura do paciente", margin + 37.5, y + 21, { align: "center" });
  doc.text("Assinatura do profissional responsável", pageWidth - margin - 37.5, y + 21, { align: "center" });

  addFooters(doc);
  doc.save(`anamnese-${record.code}.pdf`);
}