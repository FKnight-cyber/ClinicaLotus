import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { clinicLogoSvg } from "@/components/brand/clinicLogoSvg";

type JsPdfWithAutoTable = jsPDF & {
  lastAutoTable?: {
    finalY: number;
  };
};

type ClinicalStatus = "draft" | "finalized" | "canceled";

type PatientSummaryReport = {
  id: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
  admissionDate?: string | null;
  dischargeDate?: string | null;
  clinics: Array<{
    clinicId: string;
    status: "ACTIVE" | "INACTIVE";
    firstSeenAt: string;
    lastSeenAt?: string | null;
    clinic: {
      id: string;
      name: string;
      code?: string | null;
      status: "ACTIVE" | "INACTIVE";
    };
  }>;
  birthDate?: string | null;
  document?: string | null;
  cpf?: string | null;
  rg?: string | null;
  createdAt: string;
  updatedAt: string;
  anamneses: Array<{
    id: string;
    code: string;
    status: ClinicalStatus;
    finalizedAt?: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  evolutions: Array<{
    id: string;
    status: ClinicalStatus;
    evolutionDate: string;
    text: string;
    professionalArea?: string | null;
    professionalName?: string | null;
    finalizedProfessionalName?: string | null;
    finalizedAt?: string | null;
    cancelReason?: string | null;
    createdAt: string;
    updatedAt: string;
    createdBy?: { id: string; name: string; login: string } | null;
    finalizedBy?: { id: string; name: string; login: string } | null;
  }>;
};

type PatientSummaryReportDocument = {
  code?: string;
  emittedAt?: string;
  emittedBy?: {
    name?: string | null;
    login?: string | null;
  } | null;
};

type PatientSummaryReportOptions = {
  includePsychologicalPart?: boolean;
  includeMedicalPart?: boolean;
};

const margin = 14;
const pageWidth = 210;
const pageHeight = 297;
const contentWidth = pageWidth - margin * 2;

function formatDate(value?: string | null) {
  if (!value) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function formatDateTime(value?: string | null) {
  if (!value) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function formatDocuments(patient: PatientSummaryReport) {
  const documents = [
    patient.cpf ? `CPF: ${patient.cpf}` : null,
    patient.rg ? `RG: ${patient.rg}` : null,
    patient.document ? `Documento: ${patient.document}` : null
  ].filter(Boolean);

  return documents.join(" | ") || "Sem documento cadastrado";
}

function getStatusLabel(status: ClinicalStatus) {
  if (status === "finalized") return "Finalizado";
  if (status === "canceled") return "Cancelado";
  return "Rascunho";
}

function countByStatus(items: Array<{ status: ClinicalStatus }>, status: ClinicalStatus) {
  return items.filter((item) => item.status === status).length;
}

function getAge(patient: PatientSummaryReport) {
  if (!patient.birthDate) return "Não informado";
  const birthDate = new Date(patient.birthDate);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDelta = today.getMonth() - birthDate.getMonth();

  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return Number.isFinite(age) && age >= 0 ? `${age} anos` : "Não informado";
}

function getEvolutionResponsible(evolution: PatientSummaryReport["evolutions"][number]) {
  return evolution.finalizedProfessionalName ?? evolution.professionalName ?? evolution.finalizedBy?.name ?? evolution.createdBy?.name ?? "Não informado";
}

function normalizeText(text: string, maxLength = 620) {
  const normalizedText = text.replace(/\s+/g, " ").trim();
  return normalizedText.length > maxLength ? `${normalizedText.slice(0, maxLength - 3)}...` : normalizedText || "-";
}

function formatClinicLinkLabel(clinicLink: PatientSummaryReport["clinics"][number]) {
  return clinicLink.clinic.code ? `${clinicLink.clinic.name} (${clinicLink.clinic.code})` : clinicLink.clinic.name;
}

function buildClinicHistorySummary(patient: PatientSummaryReport) {
  if (patient.clinics.length === 0) return "Sem passagens registradas.";
  return patient.clinics
    .map((clinicLink) => `${formatClinicLinkLabel(clinicLink)} desde ${formatDate(clinicLink.firstSeenAt)}`)
    .join(" | ");
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

async function drawHeader(doc: jsPDF, documentCode?: string) {
  const logoDataUrl = await svgToPngDataUrl(clinicLogoSvg, 112, 92);
  doc.addImage(logoDataUrl, "PNG", margin, margin - 2, 31, 25.5, undefined, "FAST");

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
  doc.text("RELATÓRIO DO PACIENTE", pageWidth - margin, margin + 8, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(documentCode ? `Documento ${documentCode}` : "Documento em emissão", pageWidth - margin, margin + 14, { align: "right" });

  doc.setDrawColor(190, 205, 198);
  doc.line(margin, margin + 36, pageWidth - margin, margin + 36);
}

function addFooters(doc: jsPDF, documentCode?: string) {
  const totalPages = doc.getNumberOfPages();

  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(90, 104, 98);
    doc.text(documentCode ? `Documento ${documentCode}` : "Relatório do paciente", margin, pageHeight - 7);
    doc.text(`Página ${page} de ${totalPages}`, pageWidth - margin, pageHeight - 7, { align: "right" });
  }
}

function drawSectionTitle(doc: jsPDF, title: string, y: number) {
  doc.setTextColor(23, 49, 43);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(title, margin, y);
  return y + 3;
}

function drawKeyValueTable(doc: jsPDF, rows: string[][], y: number) {
  autoTable(doc, {
    body: rows,
    startY: y,
    theme: "grid",
    margin: { left: margin, right: margin },
    styles: { font: "helvetica", fontSize: 8, cellPadding: 2.2, overflow: "linebreak" },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 42, fillColor: [238, 244, 241], textColor: [23, 49, 43] },
      1: { cellWidth: contentWidth - 42 }
    }
  });

  return (doc as JsPdfWithAutoTable).lastAutoTable?.finalY ?? y;
}

function formatEmitter(emittedBy?: PatientSummaryReportDocument["emittedBy"]) {
  if (!emittedBy?.name && !emittedBy?.login) return "usuário autenticado";
  if (!emittedBy.login) return emittedBy.name ?? "usuário autenticado";
  if (!emittedBy.name) return emittedBy.login;
  return `${emittedBy.name} (${emittedBy.login})`;
}

function drawGeneratedNotice(doc: jsPDF, patient: PatientSummaryReport, document: PatientSummaryReportDocument, y: number) {
  doc.setTextColor(90, 104, 98);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.8);
  const notice = `Documento ${document.code ?? "sem código"} emitido em ${formatDateTime(document.emittedAt)} por ${formatEmitter(document.emittedBy)}. Relatório resumido gerado a partir dos registros disponíveis do paciente ${patient.name}. Conteúdos clínicos em rascunho ou cancelados não compõem o corpo clínico deste documento.`;
  doc.text(doc.splitTextToSize(notice, contentWidth), margin, y);
}

export async function downloadPatientSummaryReportPdf(patient: PatientSummaryReport, document: PatientSummaryReportDocument = {}, options: PatientSummaryReportOptions = {}) {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  await drawHeader(doc, document.code);

  const finalizedEvolutions = patient.evolutions.filter((evolution) => evolution.status === "finalized");
  const latestFinalizedEvolution = finalizedEvolutions[0] ?? null;
  const latestFinalizedAnamnesis = patient.anamneses.find((anamnesis) => anamnesis.status === "finalized") ?? null;
  const includePsychologicalPart = options.includePsychologicalPart ?? true;
  const includeMedicalPart = options.includeMedicalPart ?? true;
  const currentClinic = patient.clinics.find((clinicLink) => clinicLink.status === "ACTIVE") ?? patient.clinics[0] ?? null;
  let y = margin + 44;

  y = drawSectionTitle(doc, "Identificação", y);
  y = drawKeyValueTable(doc, [
    ["Paciente", patient.name],
    ["Status cadastral", patient.status === "ACTIVE" ? "Ativo" : "Inativo"],
    ["Clínica operacional atual", currentClinic ? formatClinicLinkLabel(currentClinic) : "Não informada"],
    ["Nascimento / idade", `${formatDate(patient.birthDate)} / ${getAge(patient)}`],
    ["Data de admissão", formatDate(patient.admissionDate)],
    ["Dia da alta", formatDate(patient.dischargeDate)],
    ["Histórico de clínicas", buildClinicHistorySummary(patient)],
    ["Documentos", formatDocuments(patient)],
    ["Cadastro", formatDateTime(patient.createdAt)],
    ["Última atualização", formatDateTime(patient.updatedAt)]
  ], y + 3) + 9;

  const summaryRows: string[][] = [];
  if (includePsychologicalPart) {
    summaryRows.push(
      ["Anamneses", `${patient.anamneses.length} registro(s): ${countByStatus(patient.anamneses, "finalized")} finalizada(s), ${countByStatus(patient.anamneses, "draft")} rascunho(s), ${countByStatus(patient.anamneses, "canceled")} cancelada(s)`],
      ["Última anamnese finalizada", latestFinalizedAnamnesis ? `${latestFinalizedAnamnesis.code} em ${formatDateTime(latestFinalizedAnamnesis.finalizedAt)}` : "Sem registro finalizado"]
    );
  }
  if (includeMedicalPart) {
    summaryRows.push(
      ["Evoluções", `${patient.evolutions.length} registro(s): ${countByStatus(patient.evolutions, "finalized")} finalizada(s), ${countByStatus(patient.evolutions, "draft")} rascunho(s), ${countByStatus(patient.evolutions, "canceled")} cancelada(s)`],
      ["Última evolução finalizada", latestFinalizedEvolution ? `${formatDateTime(latestFinalizedEvolution.evolutionDate)} - ${latestFinalizedEvolution.professionalArea ?? "Sem área"}` : "Sem registro finalizado"]
    );
  }
  if (summaryRows.length > 0) {
    y = drawSectionTitle(doc, "Resumo clínico", y);
    y = drawKeyValueTable(doc, summaryRows, y + 3) + 9;
  }

  if (includePsychologicalPart) {
    y = drawSectionTitle(doc, "Parte psicológica / acolhimento", y);
    autoTable(doc, {
      head: [["Código", "Status", "Finalização", "Atualização"]],
      body: patient.anamneses.length > 0 ? patient.anamneses.map((anamnesis) => [anamnesis.code, getStatusLabel(anamnesis.status), formatDateTime(anamnesis.finalizedAt), formatDateTime(anamnesis.updatedAt)]) : [["-", "Nenhuma anamnese vinculada", "-", "-"]],
      startY: y + 3,
      theme: "striped",
      margin: { left: margin, right: margin },
      styles: { font: "helvetica", fontSize: 7.8, cellPadding: 2, overflow: "linebreak" },
      headStyles: { fillColor: [23, 49, 43], textColor: [255, 255, 255] }
    });
    y = ((doc as JsPdfWithAutoTable).lastAutoTable?.finalY ?? y) + 9;
  }

  if (includeMedicalPart) {
    y = drawSectionTitle(doc, "Parte médica", y);
    autoTable(doc, {
      head: [["Data", "Área", "Responsável", "Síntese"]],
      body: finalizedEvolutions.length > 0 ? finalizedEvolutions.map((evolution) => [formatDateTime(evolution.evolutionDate), evolution.professionalArea ?? "Sem área", getEvolutionResponsible(evolution), normalizeText(evolution.text)]) : [["-", "-", "-", "Nenhuma evolução finalizada disponível para o relatório"]],
      startY: y + 3,
      theme: "striped",
      margin: { left: margin, right: margin },
      styles: { font: "helvetica", fontSize: 7.6, cellPadding: 2, overflow: "linebreak", valign: "top" },
      headStyles: { fillColor: [23, 49, 43], textColor: [255, 255, 255] },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 30 },
        2: { cellWidth: 40 },
        3: { cellWidth: contentWidth - 98 }
      }
    });
    y = ((doc as JsPdfWithAutoTable).lastAutoTable?.finalY ?? y) + 10;
  }

  if (y > pageHeight - 30) {
    doc.addPage();
    y = margin;
  }

  drawGeneratedNotice(doc, patient, document, y);
  addFooters(doc, document.code);
  doc.save(`relatorio-paciente-${document.code ?? patient.id.slice(0, 8)}.pdf`);
}