"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowLeft, CalendarClock, ClipboardList, FileDown, FileText, ToggleLeft, ToggleRight, UserRound } from "lucide-react";
import Link from "next/link";
import { useShellTitle } from "@/components/shell/AppShell";
import { useAuth } from "@/features/auth/AuthProvider";
import { downloadPatientSummaryReportPdf } from "./patientSummaryReportPdf";

type PatientStatus = "ACTIVE" | "INACTIVE";
type ClinicalStatus = "draft" | "finalized" | "canceled";

type PatientDetail = {
  id: string;
  name: string;
  status: PatientStatus;
  birthDate?: string | null;
  document?: string | null;
  cpf?: string | null;
  rg?: string | null;
  createdAt: string;
  updatedAt: string;
  anamneses: PatientAnamnesis[];
  evolutions: PatientEvolution[];
};

type PatientStatusResponse = Omit<PatientDetail, "anamneses" | "evolutions">;

type ClinicalDocumentSummary = {
  id: string;
  code: string;
  type: string;
  fileName: string;
  contentHash: string;
  emittedAt: string;
  patientId?: string | null;
};

type PatientAnamnesis = {
  id: string;
  code: string;
  status: ClinicalStatus;
  patientName: string;
  finalizedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

type PatientEvolution = {
  id: string;
  status: ClinicalStatus;
  evolutionDate: string;
  text: string;
  professionalArea?: string | null;
  professionalName?: string | null;
  finalizedProfessionalName?: string | null;
  finalizedAt?: string | null;
  canceledAt?: string | null;
  cancelReason?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; name: string; login: string } | null;
  finalizedBy?: { id: string; name: string; login: string } | null;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

async function apiRequest<T>(token: string, path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers
    }
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message ?? "Não foi possível carregar os dados do paciente.");
  }

  return response.json() as Promise<T>;
}

function formatDate(value?: string | null) {
  if (!value) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function formatDateTime(value?: string | null) {
  if (!value) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function formatDocuments(patient: PatientDetail) {
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

function getStatusClass(status: ClinicalStatus) {
  if (status === "finalized") return "is-finalized";
  if (status === "canceled") return "is-canceled";
  return "";
}

function getEvolutionSummary(text: string) {
  const normalizedText = text.replace(/\s+/g, " ").trim();
  return normalizedText.length > 190 ? `${normalizedText.slice(0, 187)}...` : normalizedText;
}

function countByStatus(items: Array<{ status: ClinicalStatus }>, status: ClinicalStatus) {
  return items.filter((item) => item.status === status).length;
}

export function PatientDetailPage({ patientId }: { patientId: string }) {
  const { hasPermission, token, user } = useAuth();
  const canReadPatients = hasPermission("patients.read");
  const canReadAnamnese = hasPermission("anamnese.read");
  const canReadEvolutions = hasPermission("medical_evolutions.read");
  const canUpdatePatientStatus = hasPermission("patients.inactivate");
  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  useEffect(() => {
    if (!token || !canReadPatients) return;

    let isCurrent = true;
  // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    apiRequest<PatientDetail>(token, `/api/patients/${patientId}`)
      .then((nextPatient) => {
        if (!isCurrent) return;
        setPatient(nextPatient);
        setIsLoading(false);
      })
      .catch((error) => {
        if (!isCurrent) return;
        setMessage(error instanceof Error ? error.message : "Não foi possível carregar o paciente.");
        setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [token, canReadPatients, patientId]);

  const latestEvolution = canReadEvolutions ? patient?.evolutions.find((evolution) => evolution.status === "finalized") ?? patient?.evolutions[0] ?? null : null;
  const latestAnamnesis = patient?.anamneses.find((anamnesis) => anamnesis.status === "finalized") ?? patient?.anamneses[0] ?? null;
  const analysisSummary = useMemo(() => {
    if (!patient) return [];

    return [
      canReadEvolutions
        ? { label: "Evoluções", value: String(patient.evolutions.length), detail: `${countByStatus(patient.evolutions, "finalized")} finalizadas` }
        : { label: "Evoluções", value: "Restrito", detail: "Permissão necessária" },
      { label: "Anamneses", value: String(patient.anamneses.length), detail: `${countByStatus(patient.anamneses, "finalized")} finalizadas` },
      { label: "Última evolução", value: latestEvolution ? formatDate(latestEvolution.evolutionDate) : "Sem registro", detail: latestEvolution?.professionalArea ?? "Histórico clínico" },
      { label: "Última anamnese", value: latestAnamnesis ? latestAnamnesis.code : "Sem registro", detail: latestAnamnesis ? formatDateTime(latestAnamnesis.updatedAt) : "Histórico de acolhimento" }
    ];
  }, [canReadEvolutions, latestAnamnesis, latestEvolution, patient]);
  useShellTitle(patient ? `Paciente ${patient.name}` : null);

  async function handleStatusChange() {
    if (!token || !patient || !canUpdatePatientStatus) return;
    const nextStatus = patient.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setIsSavingStatus(true);

    try {
      const updatedPatient = await apiRequest<PatientStatusResponse>(token, `/api/patients/${patient.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus })
      });
      setPatient((currentPatient) => currentPatient ? { ...currentPatient, ...updatedPatient } : null);
      setMessage(nextStatus === "ACTIVE" ? "Paciente ativado." : "Paciente inativado no cadastro administrativo.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível atualizar o status do paciente.");
    } finally {
      setIsSavingStatus(false);
    }
  }

  async function handleDownloadReport() {
    if (!token || !patient) return;
    setIsGeneratingReport(true);
    setMessage("Gerando relatório do paciente...");

    try {
      const document = await apiRequest<ClinicalDocumentSummary>(token, `/api/patients/${patient.id}/report/pdf`, { method: "POST" });
      await downloadPatientSummaryReportPdf(patient, {
        code: document.code,
        emittedAt: document.emittedAt,
        emittedBy: user ? { name: user.name, login: user.login } : null
      });
      setMessage(`Relatório ${document.code} gerado.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível gerar o relatório do paciente.");
    } finally {
      setIsGeneratingReport(false);
    }
  }

  if (!canReadPatients) {
    return <div className="loading-panel">Você não possui permissão para visualizar pacientes.</div>;
  }

  if (isLoading) {
    return <div className="loading-panel">Carregando informações do paciente...</div>;
  }

  if (!patient) {
    return <div className="loading-panel">{message ?? "Paciente não encontrado."}</div>;
  }

  const ToggleIcon = patient.status === "ACTIVE" ? ToggleLeft : ToggleRight;
  const anamnesePermissionTooltip = "Você não tem permissão para ver anamnese do paciente";

  return (
    <section className="user-detail-page patient-detail-page">
      <div className="patient-detail-actions-row">
        <Link className="back-link" href="/modulos/pacientes"><ArrowLeft size={16} />Voltar para pacientes</Link>
        <span className={`table-status ${patient.status === "ACTIVE" ? "is-finalized" : "is-inactive"}`}>{patient.status === "ACTIVE" ? "Ativo" : "Inativo"}</span>
        {canUpdatePatientStatus ? (
          <button className="secondary-button" disabled={isSavingStatus} onClick={handleStatusChange} type="button">
            <ToggleIcon aria-hidden="true" size={17} />{isSavingStatus ? "Atualizando..." : patient.status === "ACTIVE" ? "Inativar" : "Ativar"}
          </button>
        ) : null}
        <button className="secondary-button" disabled={isGeneratingReport} onClick={handleDownloadReport} type="button">
          <FileDown aria-hidden="true" size={17} />{isGeneratingReport ? "Gerando..." : "Baixar relatório"}
        </button>
      </div>

      {message ? <div className="access-message">{message}</div> : null}

      <div className="patient-detail-summary-grid">
        <section className="plain-panel patient-registration-panel">
          <div className="access-card-heading">
            <div>
              <h3>Dados cadastrais</h3>
              <p>Base administrativa do paciente usada nos fluxos clínicos.</p>
            </div>
            <UserRound aria-hidden="true" size={22} />
          </div>
          <dl className="patient-detail-fields">
            <div><dt>Nome</dt><dd>{patient.name}</dd></div>
            <div><dt>Nascimento</dt><dd>{formatDate(patient.birthDate)}</dd></div>
            <div><dt>Documentos</dt><dd>{formatDocuments(patient)}</dd></div>
            <div><dt>Cadastrado em</dt><dd>{formatDateTime(patient.createdAt)}</dd></div>
            <div><dt>Última atualização</dt><dd>{formatDateTime(patient.updatedAt)}</dd></div>
          </dl>
        </section>

        <section className="plain-panel patient-analysis-panel">
          <div className="access-card-heading">
            <div>
              <h3>Resumo para análise</h3>
              <p>Atalhos para entender rapidamente volume, recência e pendências.</p>
            </div>
            <Activity aria-hidden="true" size={22} />
          </div>
          <div className="patient-analysis-grid">
            {analysisSummary.map((item) => (
              <div className="patient-analysis-card" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.detail}</small>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="plain-panel patient-history-panel">
        <div className="access-card-heading">
          <div>
            <h3>Histórico de evoluções</h3>
            <p>Ordenado da evolução mais recente para a mais antiga, com área, responsável e síntese do conteúdo.</p>
          </div>
          <CalendarClock aria-hidden="true" size={22} />
        </div>
        <div className="records-table-shell patient-detail-table-shell">
          <table className="records-table patient-detail-history-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Área</th>
                <th>Status</th>
                <th>Responsável</th>
                <th>Síntese</th>
              </tr>
            </thead>
            <tbody>
              {!canReadEvolutions ? (
                <tr><td colSpan={5}>Seu usuário não possui permissão para visualizar evoluções.</td></tr>
              ) : patient.evolutions.length === 0 ? (
                <tr><td colSpan={5}>Nenhuma evolução registrada.</td></tr>
              ) : patient.evolutions.map((evolution) => (
                <tr key={evolution.id}>
                  <td>{formatDateTime(evolution.evolutionDate)}</td>
                  <td>{evolution.professionalArea ?? "Sem área"}</td>
                  <td><span className={`table-status ${getStatusClass(evolution.status)}`}>{getStatusLabel(evolution.status)}</span></td>
                  <td>{evolution.finalizedProfessionalName ?? evolution.professionalName ?? evolution.finalizedBy?.name ?? evolution.createdBy?.name ?? "Não informado"}</td>
                  <td className="patient-history-summary">{evolution.status === "canceled" && evolution.cancelReason ? `Cancelada: ${evolution.cancelReason}` : getEvolutionSummary(evolution.text)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="plain-panel patient-history-panel">
        <div className="access-card-heading">
          <div>
            <h3>Histórico de anamneses</h3>
            <p>Fichas vinculadas ao paciente, com acesso direto aos registros quando permitido.</p>
          </div>
          <ClipboardList aria-hidden="true" size={22} />
        </div>
        <div className="records-table-shell patient-detail-table-shell">
          <table className="records-table patient-detail-history-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Status</th>
                <th>Finalização</th>
                <th>Atualização</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {patient.anamneses.length === 0 ? (
                <tr><td colSpan={5}>Nenhuma anamnese vinculada.</td></tr>
              ) : patient.anamneses.map((anamnesis) => (
                <tr key={anamnesis.id}>
                  <td><strong>{anamnesis.code}</strong></td>
                  <td><span className={`table-status ${getStatusClass(anamnesis.status)}`}>{getStatusLabel(anamnesis.status)}</span></td>
                  <td>{formatDateTime(anamnesis.finalizedAt)}</td>
                  <td>{formatDateTime(anamnesis.updatedAt)}</td>
                  <td>
                    {canReadAnamnese ? (
                      <Link className="table-action" href={`/anamnese/${anamnesis.id}`}><FileText aria-hidden="true" size={16} />Abrir</Link>
                    ) : (
                      <span className="permission-tooltip" title={anamnesePermissionTooltip}>
                        <button aria-label={`${anamnesePermissionTooltip}: ${anamnesis.code}`} className="table-action is-disabled" disabled type="button">
                          <FileText aria-hidden="true" size={16} />Abrir
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}