import { jsPDF } from "jspdf";
import { clinicLogoSvg } from "@/components/brand/clinicLogoSvg";
import type { MedicalEvolution, PatientSummary } from "./prontuarioTypes";

const margin = 14;
const pageWidth = 210;
const pageHeight = 297;
const contentWidth = pageWidth - margin * 2;

type ProfessionalProfile = {
  name?: string | null;
  professionalCouncil?: string | null;
  professionalRegistration?: string | null;
  professionalCouncilState?: string | null;
  professionalSpecialty?: string | null;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function getSignatureText(evolution: MedicalEvolution) {
  if (!evolution.finalizedBy || !evolution.finalizedAt) {
    return "Assinatura simples pendente";
  }

  return `Assinado pelo usuário ${evolution.finalizedBy.name} (${evolution.finalizedBy.login}) em ${formatDateTime(evolution.finalizedAt)}`;
}

function getProfessionalCouncilText(user: ProfessionalProfile | null | undefined) {
  if (!user) return null;

  const council = user.professionalCouncil?.trim();
  const state = user.professionalCouncilState?.trim();
  if (!council && !state) return null;
  return [council, state].filter(Boolean).join("/");
}

function getProfessionalInfoRows(professional: ProfessionalProfile | null | undefined) {
  const rows = [
    { label: "Conselho profissional", value: getProfessionalCouncilText(professional) },
    { label: "Número do registro", value: professional?.professionalRegistration?.trim() || null },
    { label: "Especialidade", value: professional?.professionalSpecialty?.trim() || null }
  ];

  return rows.filter((row): row is { label: string; value: string } => Boolean(row.value));
}

function getEvolutionProfessionalProfile(evolution: MedicalEvolution): ProfessionalProfile | null {
  if (evolution.finalizedProfessionalName || evolution.finalizedProfessionalCouncil || evolution.finalizedProfessionalRegistration || evolution.finalizedProfessionalCouncilState || evolution.finalizedProfessionalSpecialty) {
    return {
      name: evolution.finalizedProfessionalName,
      professionalCouncil: evolution.finalizedProfessionalCouncil,
      professionalRegistration: evolution.finalizedProfessionalRegistration,
      professionalCouncilState: evolution.finalizedProfessionalCouncilState,
      professionalSpecialty: evolution.finalizedProfessionalSpecialty
    };
  }

  return evolution.finalizedBy ?? null;
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

async function drawHeader(doc: jsPDF) {
  const logoDataUrl = await svgToPngDataUrl(clinicLogoSvg, 112, 92);
  doc.addImage(logoDataUrl, "PNG", margin, margin - 2, 31, 25.5, undefined, "FAST");

  doc.setTextColor(123, 63, 178);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text("Flor de Lótus", margin + 40, margin + 8);
  doc.setTextColor(139, 106, 167);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Documento clínico rastreável", margin + 40, margin + 15);

  doc.setTextColor(23, 49, 43);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("EVOLUÇÃO", pageWidth / 2, margin + 34, { align: "center" });
}

function drawInfoRow(doc: jsPDF, label: string, value: string, x: number, y: number, width: number) {
  doc.setTextColor(23, 49, 43);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.4);
  doc.text(label.toUpperCase(), x, y);
  doc.setTextColor(23, 49, 43);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.2);
  doc.text(value || "-", x, y + 5.5, { maxWidth: width });
}

function drawProfessionalSignature(doc: jsPDF, evolution: MedicalEvolution, professional: ProfessionalProfile | null | undefined, y: number) {
  const signatureCenterX = pageWidth - margin - 41;
  const signatureLeftX = pageWidth - margin - 82;
  const professionalName = professional?.name || evolution.professionalName || evolution.finalizedBy?.name || evolution.createdBy?.name || "-";

  doc.setDrawColor(23, 49, 43);
  doc.line(signatureLeftX, y, pageWidth - margin, y);
  doc.setTextColor(23, 49, 43);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Assinatura do profissional responsável", signatureCenterX, y + 5, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(professionalName, signatureCenterX, y + 12, { align: "center", maxWidth: 78 });

  doc.setTextColor(90, 104, 98);
  doc.setFontSize(7.2);
  doc.text(getSignatureText(evolution), signatureCenterX, y + 21, { align: "center", maxWidth: 82 });
  doc.text("Assinatura simples interna. Não substitui assinatura digital certificada/ICP-Brasil.", signatureCenterX, y + 28, { align: "center", maxWidth: 82 });
}

function drawSectionTitle(doc: jsPDF, title: string, y: number) {
  doc.setTextColor(23, 49, 43);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(title, margin, y);
  return y + 7;
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

function addFooters(doc: jsPDF, documentCode?: string) {
  const totalPages = doc.getNumberOfPages();

  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(90, 104, 98);
    doc.text(documentCode ? `Documento ${documentCode}` : "Documento clínico", margin, pageHeight - 7);
    doc.text(`Página ${page} de ${totalPages}`, pageWidth - margin, pageHeight - 7, { align: "right" });
  }
}

export async function downloadMedicalEvolutionPdf(patient: PatientSummary, evolution: MedicalEvolution, documentCode?: string, professionalProfile?: ProfessionalProfile | null) {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  await drawHeader(doc);
  const savedProfessionalProfile = getEvolutionProfessionalProfile(evolution) ?? professionalProfile;
  const professionalInfoRows = getProfessionalInfoRows(savedProfessionalProfile);

  let y = margin + 44;
  const halfWidth = (contentWidth - 4) / 2;
  const thirdWidth = (contentWidth - 8) / 3;

  y = drawSectionTitle(doc, "Dados do profissional", y);
  drawInfoRow(doc, "Profissional", savedProfessionalProfile?.name || evolution.professionalName || evolution.finalizedBy?.name || evolution.createdBy?.name || "-", margin, y, halfWidth);
  drawInfoRow(doc, "Área profissional", evolution.professionalArea || "-", margin + halfWidth + 4, y, halfWidth);
  y += 13;

  for (let index = 0; index < professionalInfoRows.length; index += 2) {
    const leftRow = professionalInfoRows[index];
    const rightRow = professionalInfoRows[index + 1];
    drawInfoRow(doc, leftRow.label, leftRow.value, margin, y, rightRow ? halfWidth : contentWidth);
    if (rightRow) {
      drawInfoRow(doc, rightRow.label, rightRow.value, margin + halfWidth + 4, y, halfWidth);
    }
    y += 13;
  }

  y = drawSectionTitle(doc, "Dados do paciente", y);
  drawInfoRow(doc, "Data da evolução", formatDateTime(evolution.evolutionDate), margin, y, thirdWidth);
  drawInfoRow(doc, "Nome do paciente", patient.name, margin + thirdWidth + 4, y, thirdWidth);
  drawInfoRow(doc, "Identificação", formatPatientDocuments(patient), margin + (thirdWidth + 4) * 2, y, thirdWidth);
  y += 13;

  doc.setTextColor(23, 49, 43);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Registro clínico", margin, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const lines = doc.splitTextToSize(evolution.text, contentWidth);
  for (const line of lines) {
    if (y > pageHeight - 58) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += 5;
  }

  if (y > pageHeight - 68) {
    doc.addPage();
    y = margin;
  }

  if (y > pageHeight - 45) {
    doc.addPage();
    y = margin;
  }

  y += 22;
  drawProfessionalSignature(doc, evolution, savedProfessionalProfile, y);

  addFooters(doc, documentCode);
  doc.save(`evolucao-${documentCode ?? evolution.id.slice(0, 8)}.pdf`);
}