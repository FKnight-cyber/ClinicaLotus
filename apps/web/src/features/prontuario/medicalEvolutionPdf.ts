import { jsPDF } from "jspdf";
import { clinicLogoSvg } from "@/components/brand/clinicLogoSvg";
import type { MedicalEvolution, PatientSummary } from "./prontuarioTypes";

const margin = 14;
const pageWidth = 210;
const pageHeight = 297;
const contentWidth = pageWidth - margin * 2;

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
  doc.setDrawColor(216, 226, 221);
  doc.setFillColor(251, 253, 252);
  doc.roundedRect(x, y, width, 18, 1.5, 1.5, "FD");
  doc.setTextColor(87, 104, 97);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text(label.toUpperCase(), x + 3, y + 5);
  doc.setTextColor(23, 49, 43);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(value || "-", x + 3, y + 12, { maxWidth: width - 6 });
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

export async function downloadMedicalEvolutionPdf(patient: PatientSummary, evolution: MedicalEvolution, documentCode?: string) {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  await drawHeader(doc);

  let y = margin + 44;
  const halfWidth = (contentWidth - 4) / 2;
  drawInfoRow(doc, "Paciente", patient.name, margin, y, halfWidth);
  drawInfoRow(doc, "Identificação", formatPatientDocuments(patient), margin + halfWidth + 4, y, halfWidth);
  y += 23;
  drawInfoRow(doc, "Data da evolução", formatDateTime(evolution.evolutionDate), margin, y, halfWidth);
  drawInfoRow(doc, "Área profissional", evolution.professionalArea || "-", margin + halfWidth + 4, y, halfWidth);
  y += 23;
  drawInfoRow(doc, "Profissional", evolution.professionalName || evolution.finalizedBy?.name || evolution.createdBy?.name || "-", margin, y, contentWidth);
  y += 25;

  doc.setTextColor(23, 49, 43);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Registro clínico", margin, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const lines = doc.splitTextToSize(evolution.text, contentWidth);
  for (const line of lines) {
    if (y > pageHeight - 34) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += 5;
  }

  if (y > pageHeight - 45) {
    doc.addPage();
    y = margin;
  }

  y += 22;
  doc.setDrawColor(23, 49, 43);
  doc.line(pageWidth - margin - 82, y, pageWidth - margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Assinatura do profissional responsável", pageWidth - margin - 41, y + 5, { align: "center" });

  doc.setTextColor(90, 104, 98);
  doc.setFontSize(7.5);
  doc.text(getSignatureText(evolution), margin, y + 17, { maxWidth: contentWidth });
  doc.text("Assinatura simples interna. Não substitui assinatura digital certificada/ICP-Brasil.", margin, y + 22, { maxWidth: contentWidth });

  addFooters(doc, documentCode);
  doc.save(`evolucao-${documentCode ?? evolution.id.slice(0, 8)}.pdf`);
}