"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, FilePenLine, Plus, Printer, Save, Search, UserRound, XCircle } from "lucide-react";
import { useAuth } from "@/features/auth/AuthProvider";
import { downloadMedicalEvolutionPdf } from "./medicalEvolutionPdf";
import { cancelMedicalEvolution, createMedicalEvolution, emitMedicalEvolutionPdfDocument, fetchMedicalEvolutions, fetchProntuarioPatients, fetchProntuarioTimeline, finalizeMedicalEvolution, updateMedicalEvolution } from "./prontuarioStorage";
import { professionalAreaOptions } from "./prontuarioTypes";
import type { MedicalEvolution, MedicalEvolutionPayload, MedicalRecordEntry, PatientSummary, ProfessionalArea } from "./prontuarioTypes";

type FormState = {
  id?: string;
  text: string;
  evolutionDate: string;
  professionalArea: ProfessionalArea | "";
  professionalName: string;
};

type CombinedRecord =
  | { kind: "evolution"; id: string; date: string; evolution: MedicalEvolution }
  | { kind: "entry"; id: string; date: string; entry: MedicalRecordEntry };

const emptyFormState: FormState = {
  text: "",
  evolutionDate: "",
  professionalArea: "",
  professionalName: ""
};

const pageSize = 5;

function formatPageSummary(total: number, offset: number, count: number, label: string) {
  if (total === 0) return `0 ${label}`;
  return `${offset + 1}-${offset + count} de ${total} ${label}`;
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

function toDateTimeLocalValue(value: string) {
  const date = new Date(value);
  const timezoneOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

function toPayload(form: FormState): MedicalEvolutionPayload {
  return {
    text: form.text,
    evolutionDate: form.evolutionDate ? new Date(form.evolutionDate).toISOString() : undefined,
    professionalArea: form.professionalArea,
    professionalName: form.professionalName || undefined
  };
}

function formatPatientDocuments(patient: PatientSummary | null | undefined, fallback = "Sem documento") {
  if (!patient) return fallback;

  const documents = [
    patient.cpf ? `CPF: ${patient.cpf}` : null,
    patient.rg ? `RG: ${patient.rg}` : null
  ].filter(Boolean);

  if (documents.length > 0) return documents.join(" ");
  if (patient.document) return `Documento: ${patient.document}`;
  return fallback;
}

function statusLabel(status: MedicalEvolution["status"]) {
  if (status === "finalized") return "Finalizada";
  if (status === "canceled") return "Cancelada";
  return "Rascunho";
}

function getSimpleSignatureLabel(evolution: MedicalEvolution) {
  if (evolution.status !== "finalized" || !evolution.finalizedBy || !evolution.finalizedAt) return null;
  return `Assinado por ${evolution.finalizedBy.name} em ${formatDateTime(evolution.finalizedAt)}`;
}

function canUseProfileProfessionalData(userType?: string) {
  return userType === "DOCTOR" || userType === "NURSE";
}

export function ProntuarioPage() {
  const { hasPermission, token, user } = useAuth();
  const canReadPatients = hasPermission("patients.read");
  const canReadProntuario = hasPermission("prontuario.read");
  const canReadEvolutions = hasPermission("medical_evolutions.read");
  const canCreateEvolutions = hasPermission("medical_evolutions.create");
  const canUpdateEvolutions = hasPermission("medical_evolutions.update");
  const canFinalizeEvolutions = hasPermission("medical_evolutions.finalize");
  const canCancelEvolutions = hasPermission("medical_evolutions.cancel");
  const canPrintEvolutions = hasPermission("medical_evolutions.print");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [patientTotal, setPatientTotal] = useState(0);
  const [patientPage, setPatientPage] = useState(1);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [entries, setEntries] = useState<MedicalRecordEntry[]>([]);
  const [entriesPatientId, setEntriesPatientId] = useState<string | null>(null);
  const [entriesTotal, setEntriesTotal] = useState(0);
  const [timelinePage, setTimelinePage] = useState(1);
  const [evolutions, setEvolutions] = useState<MedicalEvolution[]>([]);
  const [evolutionsPatientId, setEvolutionsPatientId] = useState<string | null>(null);
  const [evolutionsTotal, setEvolutionsTotal] = useState(0);
  const [evolutionsPage, setEvolutionsPage] = useState(1);
  const [form, setForm] = useState<FormState>(emptyFormState);
  const [message, setMessage] = useState("Busque um paciente para abrir o prontuario.");
  const [evolutionMessage, setEvolutionMessage] = useState("Selecione um paciente para registrar evolucoes.");
  const [patientListLoading, setPatientListLoading] = useState(false);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [evolutionsLoading, setEvolutionsLoading] = useState(false);
  const [savingEvolution, setSavingEvolution] = useState(false);
  const [finalizingEvolutionId, setFinalizingEvolutionId] = useState<string | null>(null);
  const [cancelingEvolutionId, setCancelingEvolutionId] = useState<string | null>(null);
  const [printingEvolutionId, setPrintingEvolutionId] = useState<string | null>(null);
  const [pendingCancelEvolutionId, setPendingCancelEvolutionId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const patientOffset = (patientPage - 1) * pageSize;
  const timelineOffset = (timelinePage - 1) * pageSize;
  const evolutionsOffset = (evolutionsPage - 1) * pageSize;
  const visibleEntries = useMemo(() => entriesPatientId === selectedPatientId ? entries : [], [entries, entriesPatientId, selectedPatientId]);
  const visibleEvolutions = useMemo(() => evolutionsPatientId === selectedPatientId ? evolutions : [], [evolutions, evolutionsPatientId, selectedPatientId]);
  const combinedRecords = useMemo<CombinedRecord[]>(() => {
    const visibleEvolutionIds = new Set(visibleEvolutions.map((evolution) => evolution.id));
    const evolutionRecords = visibleEvolutions.map((evolution) => ({
      kind: "evolution" as const,
      id: `evolution-${evolution.id}`,
      date: evolution.evolutionDate,
      evolution
    }));
    const entryRecords = visibleEntries
      .filter((entry) => !entry.medicalEvolution?.id || !visibleEvolutionIds.has(entry.medicalEvolution.id))
      .map((entry) => ({
        kind: "entry" as const,
        id: `entry-${entry.id}`,
        date: entry.createdAt,
        entry
      }));

    return [...evolutionRecords, ...entryRecords]
      .sort((leftRecord, rightRecord) => new Date(rightRecord.date).getTime() - new Date(leftRecord.date).getTime());
  }, [visibleEntries, visibleEvolutions]);
  const recordsTotal = Math.max(entriesTotal, evolutionsTotal);
  const recordsLoading = timelineLoading || evolutionsLoading;

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timeout);
  }, [search]);

  function selectPatient(patientId: string | null) {
    setSelectedPatientId(patientId);
    setForm(emptyFormState);
    setEntriesPatientId(null);
    setEvolutionsPatientId(null);
    setTimelinePage(1);
    setEvolutionsPage(1);
  }

  function setRecordsPage(nextPage: number | ((currentPage: number) => number)) {
    setTimelinePage((currentPage) => {
      const resolvedPage = typeof nextPage === "function" ? nextPage(currentPage) : nextPage;
      return Math.max(1, resolvedPage);
    });
    setEvolutionsPage((currentPage) => {
      const resolvedPage = typeof nextPage === "function" ? nextPage(currentPage) : nextPage;
      return Math.max(1, resolvedPage);
    });
  }

  useEffect(() => {
    if (!token || !canReadPatients) return;
    let isCurrent = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPatientListLoading(true);

    fetchProntuarioPatients(token, debouncedSearch, { limit: pageSize, offset: patientOffset })
      .then((response) => {
        if (!isCurrent) return;
        const nextPatients = response.items;
        setPatients(nextPatients);
        setPatientTotal(response.total);
        const nextSelectedPatientId = selectedPatientId && nextPatients.some((patient) => patient.id === selectedPatientId) ? selectedPatientId : nextPatients[0]?.id ?? null;
        if (nextSelectedPatientId !== selectedPatientId) {
          selectPatient(nextSelectedPatientId);
        }
      })
      .catch((error) => {
        if (isCurrent) setMessage(error instanceof Error ? error.message : "Nao foi possivel carregar pacientes.");
      })
      .finally(() => {
        if (isCurrent) setPatientListLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [canReadPatients, debouncedSearch, patientOffset, selectedPatientId, token]);

  useEffect(() => {
    if (!token || !selectedPatientId || !canReadProntuario) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEntries([]);
      return;
    }
    let isCurrent = true;
    setTimelineLoading(true);

    fetchProntuarioTimeline(token, selectedPatientId, { limit: pageSize, offset: timelineOffset })
      .then((response) => {
        if (!isCurrent) return;
        setEntries(response.items);
        setEntriesPatientId(selectedPatientId);
        setEntriesTotal(response.total);
        setMessage(response.total > 0 ? "Eventos carregados do prontuario." : "Paciente sem eventos no prontuario.");
      })
      .catch((error) => {
        if (isCurrent) setMessage(error instanceof Error ? error.message : "Nao foi possivel carregar o prontuario.");
      })
      .finally(() => {
        if (isCurrent) setTimelineLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [canReadProntuario, selectedPatientId, timelineOffset, token]);

  useEffect(() => {
    if (!token || !selectedPatientId || !canReadEvolutions) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEvolutions([]);
      return;
    }
    let isCurrent = true;
    setEvolutionsLoading(true);

    fetchMedicalEvolutions(token, selectedPatientId, { limit: pageSize, offset: evolutionsOffset })
      .then((response) => {
        if (!isCurrent) return;
        setEvolutions(response.items);
        setEvolutionsPatientId(selectedPatientId);
        setEvolutionsTotal(response.total);
        setEvolutionMessage(response.total > 0 ? "Evolucoes carregadas." : "Paciente sem evolucoes registradas.");
      })
      .catch((error) => {
        if (isCurrent) setEvolutionMessage(error instanceof Error ? error.message : "Nao foi possivel carregar evolucoes.");
      })
      .finally(() => {
        if (isCurrent) setEvolutionsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [canReadEvolutions, evolutionsOffset, selectedPatientId, token]);

  const selectedPatient = useMemo(() => patients.find((patient) => patient.id === selectedPatientId) ?? null, [patients, selectedPatientId]);
  const activeEvolution = useMemo(() => form.id ? visibleEvolutions.find((evolution) => evolution.id === form.id) ?? null : null, [form.id, visibleEvolutions]);

  async function refreshSelectedPatientData(patientId = selectedPatientId) {
    if (!token || !patientId) return;
    const [nextEntries, nextEvolutions] = await Promise.all([
      canReadProntuario ? fetchProntuarioTimeline(token, patientId, { limit: pageSize, offset: timelineOffset }) : Promise.resolve({ items: [], total: 0, limit: pageSize, offset: timelineOffset }),
      canReadEvolutions ? fetchMedicalEvolutions(token, patientId, { limit: pageSize, offset: evolutionsOffset }) : Promise.resolve({ items: [], total: 0, limit: pageSize, offset: evolutionsOffset })
    ]);
    setEntries(nextEntries.items);
    setEntriesPatientId(patientId);
    setEntriesTotal(nextEntries.total);
    setEvolutions(nextEvolutions.items);
    setEvolutionsPatientId(patientId);
    setEvolutionsTotal(nextEvolutions.total);
  }

  function startNewEvolution() {
    const shouldUseProfile = canUseProfileProfessionalData(user?.userType);
    setForm({
      ...emptyFormState,
      evolutionDate: toDateTimeLocalValue(new Date().toISOString()),
      professionalArea: shouldUseProfile && professionalAreaOptions.includes(user?.professionalArea as ProfessionalArea) ? user?.professionalArea as ProfessionalArea : "",
      professionalName: shouldUseProfile ? user?.name ?? "" : ""
    });
    setEvolutionMessage("Novo rascunho de evolucao.");
  }

  function editEvolution(evolution: MedicalEvolution) {
    setForm({
      id: evolution.id,
      text: evolution.text,
      evolutionDate: toDateTimeLocalValue(evolution.evolutionDate),
      professionalArea: evolution.professionalArea ?? "",
      professionalName: evolution.professionalName ?? ""
    });
    setEvolutionMessage(`Editando evolucao ${statusLabel(evolution.status).toLowerCase()}.`);
  }

  async function saveEvolution() {
    if (!token || !selectedPatientId) return;
    setSavingEvolution(true);
    try {
      const savedEvolution = form.id
        ? await updateMedicalEvolution(token, form.id, selectedPatientId, toPayload(form))
        : await createMedicalEvolution(token, selectedPatientId, toPayload(form));
      setForm({
        id: savedEvolution.id,
        text: savedEvolution.text,
        evolutionDate: toDateTimeLocalValue(savedEvolution.evolutionDate),
        professionalArea: savedEvolution.professionalArea ?? "",
        professionalName: savedEvolution.professionalName ?? ""
      });
      await refreshSelectedPatientData(selectedPatientId);
      setEvolutionMessage("Rascunho salvo.");
    } catch (error) {
      setEvolutionMessage(error instanceof Error ? error.message : "Nao foi possivel salvar a evolucao.");
    } finally {
      setSavingEvolution(false);
    }
  }

  async function finalizeEvolution(evolution: MedicalEvolution) {
    if (!token) return;
    setFinalizingEvolutionId(evolution.id);
    try {
      await finalizeMedicalEvolution(token, evolution);
      setForm(emptyFormState);
      await refreshSelectedPatientData(evolution.patientId);
      setEvolutionMessage("Evolucao finalizada e enviada para a timeline.");
    } catch (error) {
      setEvolutionMessage(error instanceof Error ? error.message : "Nao foi possivel finalizar a evolucao.");
    } finally {
      setFinalizingEvolutionId(null);
    }
  }

  async function cancelEvolution(evolution: MedicalEvolution) {
    if (!token) return;
    const reason = cancelReason.trim();
    if (!reason) return;
    setCancelingEvolutionId(evolution.id);
    try {
      await cancelMedicalEvolution(token, evolution, reason);
      setForm((currentForm) => currentForm.id === evolution.id ? emptyFormState : currentForm);
      setPendingCancelEvolutionId(null);
      setCancelReason("");
      await refreshSelectedPatientData(evolution.patientId);
      setEvolutionMessage("Evolucao cancelada.");
    } catch (error) {
      setEvolutionMessage(error instanceof Error ? error.message : "Nao foi possivel cancelar a evolucao.");
    } finally {
      setCancelingEvolutionId(null);
    }
  }

  async function downloadEvolutionPdf(evolution: MedicalEvolution) {
    if (!token || !selectedPatient) return;
    setPrintingEvolutionId(evolution.id);
    try {
      setEvolutionMessage("Registrando documento PDF...");
      const document = await emitMedicalEvolutionPdfDocument(token, evolution.id);
      await downloadMedicalEvolutionPdf(selectedPatient, evolution, document.code);
      setEvolutionMessage(`PDF ${document.code} registrado. Hash ${document.contentHash.slice(0, 12)}...`);
    } catch (error) {
      setEvolutionMessage(error instanceof Error ? error.message : "Nao foi possivel gerar o PDF da evolucao.");
    } finally {
      setPrintingEvolutionId(null);
    }
  }

  if (!canReadPatients || !canReadProntuario) {
    return (
      <section className="placeholder-page">
        <div className="page-intro">
          <div className="intro-icon" aria-hidden="true"><UserRound size={28} /></div>
          <div>
            <span className="eyebrow">Prontuario</span>
            <h2>Permissao necessaria</h2>
            <p>Seu usuario nao possui permissao para visualizar pacientes e prontuario.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="prontuario-page">
      <div className="list-header">
        <div>
          <span className="eyebrow">Prontuario</span>
          <h2>Timeline clinica do paciente</h2>
          <p>Consulte eventos clinicos e registre evolucoes por area profissional.</p>
        </div>
        <span className="status-badge"><CalendarClock aria-hidden="true" size={17} />{recordsTotal} registro(s)</span>
      </div>

      <div className="prontuario-layout">
        <aside className="plain-panel prontuario-patients-panel">
          <label className="prontuario-search">
            <span>Buscar paciente</span>
            <div>
              <Search aria-hidden="true" size={16} />
              <input onChange={(event) => { setSearch(event.target.value); setPatientPage(1); }} placeholder="Nome, CPF ou RG" value={search} />
            </div>
          </label>
          <div className="prontuario-patient-list" aria-label="Pacientes">
            {patients.map((patient) => (
              <button className={patient.id === selectedPatientId ? "is-selected" : ""} key={patient.id} onClick={() => selectPatient(patient.id)} type="button">
                <strong>{patient.name}</strong>
                <span>{formatPatientDocuments(patient)}</span>
              </button>
            ))}
            {patientListLoading ? <div className="empty-state">Carregando pacientes...</div> : null}
            {patients.length === 0 ? <div className="empty-state">Nenhum paciente encontrado.</div> : null}
          </div>
          <div className="pagination-bar prontuario-pagination" aria-label="Paginação de pacientes">
            <span>{patientListLoading ? "Atualizando pacientes..." : formatPageSummary(patientTotal, patientOffset, patients.length, "paciente(s)")}</span>
            <div>
              <button disabled={patientListLoading || patientPage === 1} onClick={() => setPatientPage((currentPage) => Math.max(1, currentPage - 1))} type="button"><ChevronLeft aria-hidden="true" size={15} />Anterior</button>
              <button disabled={patientListLoading || patientOffset + patients.length >= patientTotal} onClick={() => setPatientPage((currentPage) => currentPage + 1)} type="button">Próxima<ChevronRight aria-hidden="true" size={15} /></button>
            </div>
          </div>
        </aside>

        <div className="prontuario-content-grid">
          <section className="plain-panel prontuario-evolution-panel">
            <div className="access-card-heading">
              <div>
                <h3>{selectedPatient?.name ?? "Selecione um paciente"}</h3>
                <p>{selectedPatient ? formatPatientDocuments(selectedPatient) : evolutionMessage}</p>
              </div>
              {canCreateEvolutions && selectedPatient ? <button className="secondary-button" onClick={startNewEvolution} type="button"><Plus aria-hidden="true" size={16} />Nova evolucao</button> : null}
            </div>

            {canReadEvolutions ? (
              <div className="evolution-workspace">
                <form className="evolution-form" onSubmit={(event) => { event.preventDefault(); void saveEvolution(); }}>
                  <div className="evolution-form-grid">
                    <label>
                      <span>Data e hora</span>
                      <input disabled={!selectedPatient || savingEvolution || activeEvolution?.status !== "draft" && Boolean(activeEvolution)} onChange={(event) => setForm((currentForm) => ({ ...currentForm, evolutionDate: event.target.value }))} type="datetime-local" value={form.evolutionDate} />
                    </label>
                    <label>
                      <span>Área profissional</span>
                      <select disabled={!selectedPatient || savingEvolution || activeEvolution?.status !== "draft" && Boolean(activeEvolution)} onChange={(event) => setForm((currentForm) => ({ ...currentForm, professionalArea: event.target.value as ProfessionalArea | "" }))} value={form.professionalArea}>
                        <option value="">Selecione</option>
                        {professionalAreaOptions.map((area) => <option key={area} value={area}>{area}</option>)}
                      </select>
                    </label>
                    <label>
                      <span>Profissional</span>
                      <input disabled={!selectedPatient || savingEvolution || activeEvolution?.status !== "draft" && Boolean(activeEvolution)} onChange={(event) => setForm((currentForm) => ({ ...currentForm, professionalName: event.target.value }))} placeholder="Nome do responsavel" value={form.professionalName} />
                    </label>
                  </div>
                  <label>
                    <span>Texto da evolucao</span>
                    <textarea disabled={!selectedPatient || savingEvolution || activeEvolution?.status !== "draft" && Boolean(activeEvolution)} onChange={(event) => setForm((currentForm) => ({ ...currentForm, text: event.target.value }))} placeholder="Registre a evolucao clinica" rows={6} value={form.text} />
                  </label>
                  <div className="evolution-actions">
                    <span>{evolutionsLoading ? "Carregando evolucoes..." : evolutionMessage}</span>
                    <div>
                      <button className="secondary-button" disabled={savingEvolution || !form.id && !form.text} onClick={() => setForm(emptyFormState)} type="button">Limpar</button>
                      <button className="primary-button" disabled={!selectedPatient || savingEvolution || !form.professionalArea || !canCreateEvolutions && !form.id || Boolean(form.id && !canUpdateEvolutions) || activeEvolution?.status !== "draft" && Boolean(activeEvolution)} type="submit"><Save aria-hidden="true" size={16} />{savingEvolution ? "Salvando..." : "Salvar rascunho"}</button>
                    </div>
                  </div>
                </form>

                <div className="access-card-heading prontuario-history-heading">
                  <div>
                    <h3>Histórico clínico e evoluções</h3>
                    <p>{recordsLoading ? "Atualizando registros do paciente..." : message}</p>
                  </div>
                </div>

                <div className="evolution-list prontuario-history-list" aria-label="Histórico clínico e evoluções">
                  {combinedRecords.map((record) => record.kind === "evolution" ? (() => {
                    const evolution = record.evolution;

                    return (
                    <article className={`evolution-card is-${evolution.status}`} key={evolution.id}>
                      {(() => {
                        const simpleSignatureLabel = getSimpleSignatureLabel(evolution);

                        return simpleSignatureLabel ? <span className="evolution-signature-badge">{simpleSignatureLabel}</span> : null;
                      })()}
                      <div className="evolution-card-meta">
                        <span>{formatDateTime(evolution.evolutionDate)}</span>
                        <strong>{statusLabel(evolution.status)}</strong>
                      </div>
                      {evolution.professionalArea ? <small>Área: {evolution.professionalArea}</small> : null}
                      <p>{evolution.text}</p>
                      {evolution.professionalName ? <small>{evolution.professionalName}</small> : null}
                      {evolution.cancelReason ? <small>Motivo: {evolution.cancelReason}</small> : null}
                      {pendingCancelEvolutionId === evolution.id ? (
                        <div className="evolution-cancel-reason">
                          <label>
                            <span>Motivo do cancelamento</span>
                            <input onChange={(event) => setCancelReason(event.target.value)} value={cancelReason} />
                          </label>
                          <div>
                            <button className="danger-button" disabled={!cancelReason.trim() || cancelingEvolutionId === evolution.id} onClick={() => void cancelEvolution(evolution)} type="button"><XCircle aria-hidden="true" size={15} />Confirmar</button>
                            <button className="secondary-button" disabled={cancelingEvolutionId === evolution.id} onClick={() => { setPendingCancelEvolutionId(null); setCancelReason(""); }} type="button">Voltar</button>
                          </div>
                        </div>
                      ) : null}
                      <div className="evolution-card-actions">
                        <button className="secondary-button" onClick={() => editEvolution(evolution)} type="button"><FilePenLine aria-hidden="true" size={15} />Abrir</button>
                        {evolution.status === "draft" && canFinalizeEvolutions ? <button className="primary-button" disabled={finalizingEvolutionId === evolution.id} onClick={() => void finalizeEvolution(evolution)} type="button"><CheckCircle2 aria-hidden="true" size={15} />Finalizar</button> : null}
                        {evolution.status === "finalized" && canPrintEvolutions ? <button className="secondary-button" disabled={printingEvolutionId === evolution.id} onClick={() => void downloadEvolutionPdf(evolution)} type="button"><Printer aria-hidden="true" size={15} />Baixar PDF</button> : null}
                        {evolution.status !== "canceled" && canCancelEvolutions ? <button className="danger-button" disabled={cancelingEvolutionId === evolution.id} onClick={() => { setPendingCancelEvolutionId(evolution.id); setCancelReason(""); }} type="button"><XCircle aria-hidden="true" size={15} />Cancelar</button> : null}
                      </div>
                    </article>
                    );
                  })() : (
                    <article className={`prontuario-entry ${record.entry.medicalEvolution?.status === "CANCELED" ? "is-canceled" : ""}`} key={record.id}>
                      <span>{formatDateTime(record.entry.createdAt)}</span>
                      <strong>{record.entry.title}</strong>
                      {record.entry.summary ? <p>{record.entry.summary}</p> : null}
                      {record.entry.anamnesisRecord ? <small>{record.entry.anamnesisRecord.code}</small> : null}
                      {record.entry.medicalEvolution ? <small>{record.entry.medicalEvolution.status === "CANCELED" ? "Evolucao cancelada" : `Evolucao${record.entry.medicalEvolution.professionalArea ? ` - ${record.entry.medicalEvolution.professionalArea}` : ""}`}</small> : null}
                    </article>
                  ))}
                  {recordsLoading ? <div className="empty-state">Carregando registros do paciente...</div> : null}
                  {combinedRecords.length === 0 && !recordsLoading ? <div className="empty-state">{evolutionMessage}</div> : null}
                </div>
                <div className="pagination-bar prontuario-pagination" aria-label="Paginação do histórico clínico">
                  <span>{recordsLoading ? "Atualizando histórico..." : formatPageSummary(recordsTotal, timelineOffset, combinedRecords.length, "registro(s)")}</span>
                  <div>
                    <button disabled={recordsLoading || timelinePage === 1} onClick={() => setRecordsPage((currentPage) => currentPage - 1)} type="button"><ChevronLeft aria-hidden="true" size={15} />Anterior</button>
                    <button disabled={recordsLoading || timelineOffset + combinedRecords.length >= recordsTotal} onClick={() => setRecordsPage((currentPage) => currentPage + 1)} type="button">Próxima<ChevronRight aria-hidden="true" size={15} /></button>
                  </div>
                </div>
              </div>
            ) : <div className="empty-state">Seu usuario nao possui permissao para visualizar evolucoes.</div>}
          </section>
        </div>
      </div>
    </section>
  );
}
