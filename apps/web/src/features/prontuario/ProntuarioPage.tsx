"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, Eye, FilePenLine, Plus, Printer, Save, Search, UserRound, X, XCircle } from "lucide-react";
import { ButtonSpinner } from "@/components/feedback/ButtonSpinner";
import { useAuth } from "@/features/auth/AuthProvider";
import { downloadMedicalEvolutionPdf } from "./medicalEvolutionPdf";
import { cancelMedicalEvolution, createMedicalEvolution, emitMedicalEvolutionPdfDocument, fetchMedicalEvolution, fetchMedicalEvolutions, fetchProntuarioPatients, finalizeMedicalEvolution, updateMedicalEvolution } from "./prontuarioStorage";
import { professionalAreaOptions } from "./prontuarioTypes";
import type { MedicalEvolution, MedicalEvolutionPayload, PatientSummary, ProfessionalArea } from "./prontuarioTypes";

type FormState = {
  id?: string;
  text: string;
  evolutionDate: string;
  professionalArea: ProfessionalArea | "";
  professionalName: string;
};

const emptyFormState: FormState = {
  text: "",
  evolutionDate: "",
  professionalArea: "",
  professionalName: ""
};

const patientSearchLimit = 5;
const evolutionsPageSize = 10;
const selectedPatientStorageKey = "clinica.prontuario.selectedPatient";

function formatPageSummary(total: number, offset: number, count: number, label: string) {
  if (total === 0) return `0 ${label}`;
  return `${offset + 1}-${offset + count} de ${total} ${label}`;
}

function formatEvolutionCount(count: number) {
  return `${count} ${count === 1 ? "evolução" : "evoluções"}`;
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

function getProfileProfessionalArea(professionalArea?: string | null) {
  return professionalAreaOptions.includes(professionalArea as ProfessionalArea) ? professionalArea as ProfessionalArea : "";
}

function getPatientClinicId(patient: PatientSummary | null | undefined) {
  return patient?.clinics?.[0]?.clinicId ?? "";
}

function getClinicLabel(clinicId: string | null | undefined, clinics: Array<{ id: string; name: string; code?: string | null }>) {
  if (!clinicId) return "Não informada";
  const clinic = clinics.find((item) => item.id === clinicId);
  if (!clinic) return "Clínica fora do escopo";
  return clinic.code ? `${clinic.name} (${clinic.code})` : clinic.name;
}

function canUseProfileProfessionalName(userType?: string) {
  return userType === "DOCTOR" || userType === "NURSE";
}

function readStoredSelectedPatient() {
  if (typeof window === "undefined") return null;

  try {
    const storedPatient = window.localStorage.getItem(selectedPatientStorageKey);
    if (!storedPatient) return null;
    const patient = JSON.parse(storedPatient) as Partial<PatientSummary>;
    return patient.id && patient.name ? patient as PatientSummary : null;
  } catch {
    window.localStorage.removeItem(selectedPatientStorageKey);
    return null;
  }
}

function writeStoredSelectedPatient(patient: PatientSummary | null) {
  if (typeof window === "undefined") return;

  if (!patient) {
    window.localStorage.removeItem(selectedPatientStorageKey);
    return;
  }

  window.localStorage.setItem(selectedPatientStorageKey, JSON.stringify(patient));
}

export function ProntuarioPage() {
  const { clinics, hasPermission, token, user } = useAuth();
  const prontuarioScopeKey = useMemo(
    () => clinics
      .filter((clinic) => clinic.status === "ACTIVE")
      .map((clinic) => clinic.id)
      .sort()
      .join(","),
    [clinics]
  );
  const canReadPatients = hasPermission("patients.read");
  const canReadProntuario = hasPermission("prontuario.read");
  const canReadEvolutions = hasPermission("medical_evolutions.read");
  const canCreateEvolutions = hasPermission("medical_evolutions.create");
  const canUpdateEvolutions = hasPermission("medical_evolutions.update");
  const canFinalizeEvolutions = hasPermission("medical_evolutions.finalize");
  const canCancelEvolutions = hasPermission("medical_evolutions.cancel");
  const canPrintEvolutions = hasPermission("medical_evolutions.print");
  const canAccessEvolutionHistory = canReadProntuario || canReadEvolutions;
  const [initialSelectedPatient] = useState(() => readStoredSelectedPatient());
  const [search, setSearch] = useState(initialSelectedPatient?.name ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(initialSelectedPatient?.id ?? null);
  const [selectedPatient, setSelectedPatient] = useState<PatientSummary | null>(initialSelectedPatient);
  const selectedPatientIdRef = useRef<string | null>(initialSelectedPatient?.id ?? null);
  const [patientListError, setPatientListError] = useState<string | null>(null);
  const [patientSearchAttempt, setPatientSearchAttempt] = useState(0);
  const [evolutions, setEvolutions] = useState<MedicalEvolution[]>([]);
  const [evolutionsPatientId, setEvolutionsPatientId] = useState<string | null>(null);
  const [evolutionsTotal, setEvolutionsTotal] = useState(0);
  const [evolutionsPage, setEvolutionsPage] = useState(1);
  const [evolutionsLoadError, setEvolutionsLoadError] = useState<string | null>(null);
  const [evolutionsLoadAttempt, setEvolutionsLoadAttempt] = useState(0);
  const [form, setForm] = useState<FormState>(emptyFormState);
  const [message, setMessage] = useState(initialSelectedPatient ? "Carregando evoluções do paciente." : "Selecione um paciente para visualizar as evoluções.");
  const [evolutionMessage, setEvolutionMessage] = useState("Selecione um paciente para registrar evoluções.");
  const [patientListLoading, setPatientListLoading] = useState(false);
  const [evolutionsLoading, setEvolutionsLoading] = useState(false);
  const [savingEvolution, setSavingEvolution] = useState(false);
  const savingEvolutionRequestRef = useRef(false);
  const [isEvolutionModalOpen, setIsEvolutionModalOpen] = useState(false);
  const [finalizingEvolutionId, setFinalizingEvolutionId] = useState<string | null>(null);
  const [cancelingEvolutionId, setCancelingEvolutionId] = useState<string | null>(null);
  const [printingEvolutionId, setPrintingEvolutionId] = useState<string | null>(null);
  const [pendingCancelEvolutionId, setPendingCancelEvolutionId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const evolutionStatusRequestRef = useRef(false);
  const printingEvolutionRequestRef = useRef(false);

  const evolutionsOffset = (evolutionsPage - 1) * evolutionsPageSize;
  const visibleEvolutions = useMemo(() => evolutionsPatientId === selectedPatientId ? evolutions : [], [evolutions, evolutionsPatientId, selectedPatientId]);
  const recordsTotal = evolutionsTotal;
  const recordsLoading = evolutionsLoading;
  const isEvolutionActionInProgress = savingEvolution || Boolean(finalizingEvolutionId || cancelingEvolutionId || printingEvolutionId);
  const shouldShowPatientOptions = Boolean(search.trim() && !selectedPatient && (patientListLoading || patientListError || patients.length > 0 || debouncedSearch.trim()));

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timeout);
  }, [search]);

  function selectPatient(patient: PatientSummary | null) {
    if (savingEvolutionRequestRef.current || evolutionStatusRequestRef.current || printingEvolutionRequestRef.current) return;
    const patientId = patient?.id ?? null;
    selectedPatientIdRef.current = patientId;
    setSelectedPatientId(patientId);
    setSelectedPatient(patient);
    setForm(emptyFormState);
    setIsEvolutionModalOpen(false);
    setPendingCancelEvolutionId(null);
    setCancelReason("");
    setEvolutionsPatientId(null);
    setEvolutionsLoadError(null);
    setEvolutionsPage(1);
    setMessage(patientId ? "Carregando evoluções do paciente." : "Selecione um paciente para visualizar as evoluções.");
    writeStoredSelectedPatient(patient);
  }

  function setRecordsPage(nextPage: number | ((currentPage: number) => number)) {
    setEvolutionsPage((currentPage) => {
      const resolvedPage = typeof nextPage === "function" ? nextPage(currentPage) : nextPage;
      return Math.max(1, resolvedPage);
    });
  }

  useEffect(() => {
    if (!token || !canReadPatients) return;
    if (!debouncedSearch.trim()) {
      return;
    }
    let isCurrent = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPatientListLoading(true);
    setPatientListError(null);

    fetchProntuarioPatients(token, debouncedSearch, { limit: patientSearchLimit, offset: 0, scopeKey: prontuarioScopeKey })
      .then((response) => {
        if (!isCurrent) return;
        setPatients(response.items);
      })
      .catch((error) => {
        if (!isCurrent) return;
        setPatients([]);
        setPatientListError(error instanceof Error ? error.message : "Não foi possível carregar pacientes.");
      })
      .finally(() => {
        if (isCurrent) setPatientListLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [canReadPatients, debouncedSearch, patientSearchAttempt, prontuarioScopeKey, token]);

  useEffect(() => {
    if (!token || !selectedPatientId || !canReadEvolutions) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEvolutions([]);
      return;
    }
    let isCurrent = true;
    setEvolutionsLoading(true);
    setEvolutionsLoadError(null);

    fetchMedicalEvolutions(token, selectedPatientId, { limit: evolutionsPageSize, offset: evolutionsOffset, scopeKey: prontuarioScopeKey })
      .then((response) => {
        if (!isCurrent) return;
        setEvolutions(response.items);
        setEvolutionsPatientId(selectedPatientId);
        setEvolutionsTotal(response.total);
        setEvolutionMessage(response.total > 0 ? "Evoluções carregadas." : "Paciente sem evoluções registradas.");
      })
      .catch((error) => {
        if (!isCurrent) return;
        const errorMessage = error instanceof Error ? error.message : "Não foi possível carregar evoluções.";
        setEvolutionMessage(errorMessage);
        setEvolutionsLoadError(errorMessage);
        setEvolutions([]);
        setEvolutionsPatientId(null);
        setEvolutionsTotal(0);
        if (errorMessage.includes("Paciente não encontrado")) {
          setSearch("");
          selectPatient(null);
        }
      })
      .finally(() => {
        if (isCurrent) setEvolutionsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [canReadEvolutions, evolutionsLoadAttempt, evolutionsOffset, prontuarioScopeKey, selectedPatientId, token]);

  const activeEvolution = useMemo(() => form.id ? visibleEvolutions.find((evolution) => evolution.id === form.id) ?? null : null, [form.id, visibleEvolutions]);
  const isLockedEvolution = Boolean(activeEvolution && activeEvolution.status !== "draft");
  const canEditEvolutionForm = Boolean(!isLockedEvolution && (form.id ? canUpdateEvolutions : canCreateEvolutions));
  const isEvolutionFormDisabled = !selectedPatient || savingEvolution || !canEditEvolutionForm;
  const hasEvolutionFormContent = Boolean(form.id || form.text.trim() || form.evolutionDate || form.professionalArea || form.professionalName.trim());
  const canSaveEvolution = Boolean(selectedPatient && form.text.trim() && form.professionalArea && canEditEvolutionForm && !savingEvolution);
  const evolutionModalTitle = !form.id ? "Nova evolução" : canEditEvolutionForm ? "Editar evolução" : "Visualizar evolução";

  async function refreshSelectedPatientData(patientId = selectedPatientId, offset = evolutionsOffset) {
    if (!token || !patientId) return;
    const nextEvolutions = canReadEvolutions
      ? await fetchMedicalEvolutions(token, patientId, { limit: evolutionsPageSize, offset, scopeKey: prontuarioScopeKey })
      : { items: [], total: 0, limit: evolutionsPageSize, offset };
    setEvolutions(nextEvolutions.items);
    setEvolutionsPatientId(patientId);
    setEvolutionsTotal(nextEvolutions.total);
    setEvolutionsLoadError(null);
  }

  function startNewEvolution() {
    if (!canCreateEvolutions || !selectedPatient || isEvolutionActionInProgress || savingEvolutionRequestRef.current || evolutionStatusRequestRef.current || printingEvolutionRequestRef.current) return;
    const profileProfessionalArea = getProfileProfessionalArea(user?.professionalArea);
    setForm({
      ...emptyFormState,
      evolutionDate: toDateTimeLocalValue(new Date().toISOString()),
      professionalArea: profileProfessionalArea,
      professionalName: profileProfessionalArea || canUseProfileProfessionalName(user?.userType) ? user?.name ?? "" : ""
    });
    setIsEvolutionModalOpen(true);
    setEvolutionMessage("Novo rascunho de evolução.");
  }

  function editEvolution(evolution: MedicalEvolution) {
    if (isEvolutionActionInProgress || evolutionStatusRequestRef.current || printingEvolutionRequestRef.current) return;
    setForm({
      id: evolution.id,
      text: evolution.text,
      evolutionDate: toDateTimeLocalValue(evolution.evolutionDate),
      professionalArea: evolution.professionalArea ?? "",
      professionalName: evolution.professionalName ?? ""
    });
    setIsEvolutionModalOpen(true);
    setEvolutionMessage(`Editando evolução ${statusLabel(evolution.status).toLowerCase()}.`);
  }

  async function saveEvolution() {
    if (!token || !selectedPatientId || !canSaveEvolution || savingEvolutionRequestRef.current || evolutionStatusRequestRef.current || printingEvolutionRequestRef.current) return;
    savingEvolutionRequestRef.current = true;
    setSavingEvolution(true);
    let mutationPersisted = false;
    const isCreating = !form.id;
    try {
      const savedEvolution = form.id
        ? await updateMedicalEvolution(token, form.id, selectedPatientId, toPayload(form))
        : await createMedicalEvolution(token, selectedPatientId, toPayload(form));
      mutationPersisted = true;
      setForm({
        id: savedEvolution.id,
        text: savedEvolution.text,
        evolutionDate: toDateTimeLocalValue(savedEvolution.evolutionDate),
        professionalArea: savedEvolution.professionalArea ?? "",
        professionalName: savedEvolution.professionalName ?? ""
      });
      if (isCreating) setEvolutionsPage(1);
      await refreshSelectedPatientData(selectedPatientId, isCreating ? 0 : evolutionsOffset);
      setIsEvolutionModalOpen(false);
      setForm(emptyFormState);
      setEvolutionMessage("Rascunho salvo.");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Não foi possível salvar a evolução.";
      setEvolutionMessage(mutationPersisted ? `Evolução salva, mas não foi possível atualizar a lista: ${errorMessage}` : errorMessage);
    } finally {
      savingEvolutionRequestRef.current = false;
      setSavingEvolution(false);
    }
  }

  async function finalizeEvolution(evolution: MedicalEvolution) {
    if (!token || !canFinalizeEvolutions || evolutionStatusRequestRef.current || savingEvolutionRequestRef.current || printingEvolutionRequestRef.current) return;
    evolutionStatusRequestRef.current = true;
    setFinalizingEvolutionId(evolution.id);
    let mutationPersisted = false;
    try {
      await finalizeMedicalEvolution(token, evolution);
      mutationPersisted = true;
      if (form.id === evolution.id) {
        setForm(emptyFormState);
        setIsEvolutionModalOpen(false);
      }
      await refreshSelectedPatientData(evolution.patientId);
      setEvolutionMessage("Evolução finalizada.");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Não foi possível finalizar a evolução.";
      setEvolutionMessage(mutationPersisted ? `Evolução finalizada, mas não foi possível atualizar a lista: ${errorMessage}` : errorMessage);
    } finally {
      evolutionStatusRequestRef.current = false;
      setFinalizingEvolutionId(null);
    }
  }

  async function cancelEvolution(evolution: MedicalEvolution) {
    if (!token || !canCancelEvolutions || evolutionStatusRequestRef.current || savingEvolutionRequestRef.current || printingEvolutionRequestRef.current) return;
    const reason = cancelReason.trim();
    if (!reason) return;
    evolutionStatusRequestRef.current = true;
    setCancelingEvolutionId(evolution.id);
    let mutationPersisted = false;
    try {
      await cancelMedicalEvolution(token, evolution, reason);
      mutationPersisted = true;
      setForm((currentForm) => currentForm.id === evolution.id ? emptyFormState : currentForm);
      setPendingCancelEvolutionId(null);
      setCancelReason("");
      await refreshSelectedPatientData(evolution.patientId);
      setEvolutionMessage("Evolução cancelada.");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Não foi possível cancelar a evolução.";
      setEvolutionMessage(mutationPersisted ? `Evolução cancelada, mas não foi possível atualizar a lista: ${errorMessage}` : errorMessage);
    } finally {
      evolutionStatusRequestRef.current = false;
      setCancelingEvolutionId(null);
    }
  }

  async function downloadEvolutionPdf(evolution: MedicalEvolution) {
    if (!token || !selectedPatient || !canPrintEvolutions || printingEvolutionRequestRef.current || savingEvolutionRequestRef.current || evolutionStatusRequestRef.current) return;
    printingEvolutionRequestRef.current = true;
    setPrintingEvolutionId(evolution.id);
    try {
      setEvolutionMessage("Gerando PDF...");
      const latestEvolution = await fetchMedicalEvolution(token, evolution.id);
      const document = await emitMedicalEvolutionPdfDocument(token, evolution.id);
      await downloadMedicalEvolutionPdf(selectedPatient, latestEvolution, document.code);
      setEvolutionMessage(`PDF ${document.code} gerado.`);
    } catch (error) {
      setEvolutionMessage(error instanceof Error ? error.message : "Não foi possível gerar o PDF da evolução.");
    } finally {
      printingEvolutionRequestRef.current = false;
      setPrintingEvolutionId(null);
    }
  }

  if (!canReadPatients || !canAccessEvolutionHistory) {
    return (
      <section className="placeholder-page">
        <div className="page-intro">
          <div className="intro-icon" aria-hidden="true"><UserRound size={28} /></div>
          <div>
            <span className="eyebrow">Prontuário</span>
            <h2>Permissão necessária</h2>
            <p>Seu usuário não possui permissão para visualizar pacientes e evoluções.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="list-page prontuario-page">
      <div className="list-header">
        <div>
          <span className="eyebrow">Prontuário</span>
          <h2>Evoluções do paciente</h2>
          <p>Busque um paciente para consultar rascunhos, evoluções finalizadas e registros cancelados.</p>
        </div>
        <span className="status-badge"><CalendarClock aria-hidden="true" size={17} />{selectedPatient ? formatEvolutionCount(recordsTotal) : "Paciente não selecionado"}</span>
      </div>

      <section className="prontuario-patient-selector" aria-label="Seleção de paciente">
        <label className="prontuario-search">
          <span>Paciente</span>
          <div>
            <Search aria-hidden="true" size={16} />
            <input
              disabled={isEvolutionActionInProgress}
              onChange={(event) => {
                if (isEvolutionActionInProgress || savingEvolutionRequestRef.current || evolutionStatusRequestRef.current || printingEvolutionRequestRef.current) return;
                const nextSearch = event.target.value;
                setSearch(nextSearch);
                setPatients([]);
                setPatientListError(null);
                setPatientListLoading(Boolean(nextSearch.trim()));
                selectPatient(null);
              }}
              placeholder="Digite o nome, CPF ou RG do paciente"
              value={search}
            />
          </div>
        </label>

        {shouldShowPatientOptions ? (
          <div className="prontuario-patient-options" aria-label="Opções de pacientes">
            {patientListLoading ? <div className="empty-state" role="status">Carregando pacientes...</div> : null}
            {!patientListLoading && patientListError ? (
              <div role="alert">
                <span>{patientListError}</span>
                <button className="table-action" onClick={() => setPatientSearchAttempt((attempt) => attempt + 1)} type="button">Tentar novamente</button>
              </div>
            ) : null}
            {!patientListLoading && !patientListError ? patients.map((patient) => (
              <button key={patient.id} onClick={() => { setSearch(patient.name); setPatients([]); selectPatient(patient); }} type="button">
                <strong>{patient.name}</strong>
                <span>{formatPatientDocuments(patient)} • {getClinicLabel(getPatientClinicId(patient), clinics)}</span>
              </button>
            )) : null}
            {!patientListLoading && !patientListError && patients.length === 0 ? <div className="empty-state">Nenhum paciente encontrado.</div> : null}
          </div>
        ) : null}
      </section>

      {!selectedPatient ? (
        <div className="prontuario-selection-message">
          <strong>Selecione um paciente para visualizar as evoluções.</strong>
          <span>{message}</span>
        </div>
      ) : canReadEvolutions ? (
        <>
          <div className="list-toolbar prontuario-evolutions-toolbar">
            <div>
              <strong>{selectedPatient.name}</strong>
              <span>{formatPatientDocuments(selectedPatient)}</span>
            </div>
            <div className="list-actions">
              <span aria-live="polite" role="status">{recordsLoading ? "Atualizando evoluções..." : evolutionMessage}</span>
              {canCreateEvolutions ? <button className="primary-button" disabled={isEvolutionActionInProgress} onClick={startNewEvolution} type="button"><Plus aria-hidden="true" size={17} />Nova evolução</button> : null}
            </div>
          </div>

          <div className={`records-table-shell ${recordsLoading ? "is-loading" : ""}`}>
            <table className="records-table prontuario-evolutions-table">
              <thead>
                <tr>
                  <th>Clínica</th>
                  <th>Data e hora</th>
                  <th>Status</th>
                  <th>Área</th>
                  <th>Profissional</th>
                  <th>Resumo</th>
                  <th>Assinatura</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {visibleEvolutions.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      {recordsLoading ? "Carregando evoluções do paciente..." : evolutionsLoadError ? (
                        <div role="alert">
                          <span>{evolutionsLoadError}</span>
                          <button className="table-action" onClick={() => setEvolutionsLoadAttempt((attempt) => attempt + 1)} type="button">Tentar novamente</button>
                        </div>
                      ) : "Nenhuma evolução registrada para este paciente."}
                    </td>
                  </tr>
                ) : visibleEvolutions.map((evolution) => (
                  <tr key={evolution.id}>
                    <td>{getClinicLabel(evolution.clinicId ?? getPatientClinicId(selectedPatient), clinics)}</td>
                    <td>{formatDateTime(evolution.evolutionDate)}</td>
                    <td><span className={`table-status is-${evolution.status}`}>{statusLabel(evolution.status)}</span></td>
                    <td>{evolution.professionalArea ?? "-"}</td>
                    <td>{evolution.professionalName ?? "-"}</td>
                    <td className="evolution-summary-cell">{evolution.cancelReason ? `Motivo: ${evolution.cancelReason}` : evolution.text}</td>
                    <td>{getSimpleSignatureLabel(evolution) ?? "-"}</td>
                    <td>
                      <div className="evolution-table-actions">
                        <button className="table-action" disabled={isEvolutionActionInProgress} onClick={() => editEvolution(evolution)} type="button">{evolution.status === "draft" && canUpdateEvolutions ? <FilePenLine aria-hidden="true" size={15} /> : <Eye aria-hidden="true" size={15} />}{evolution.status === "draft" && canUpdateEvolutions ? "Editar" : "Visualizar"}</button>
                        {evolution.status === "draft" && canFinalizeEvolutions ? <button aria-busy={finalizingEvolutionId === evolution.id} className="table-action is-primary" disabled={isEvolutionActionInProgress} onClick={() => void finalizeEvolution(evolution)} type="button">{finalizingEvolutionId === evolution.id ? <ButtonSpinner label="Finalizando evolução" /> : <CheckCircle2 aria-hidden="true" size={15} />}{finalizingEvolutionId === evolution.id ? "Finalizando..." : "Finalizar"}</button> : null}
                        {evolution.status === "finalized" && canPrintEvolutions ? <button aria-busy={printingEvolutionId === evolution.id} className="table-action" disabled={isEvolutionActionInProgress} onClick={() => void downloadEvolutionPdf(evolution)} type="button">{printingEvolutionId === evolution.id ? <ButtonSpinner label="Gerando PDF" /> : <Printer aria-hidden="true" size={15} />}{printingEvolutionId === evolution.id ? "Gerando..." : "PDF"}</button> : null}
                        {evolution.status === "draft" && canCancelEvolutions ? <button className="table-action is-danger" disabled={isEvolutionActionInProgress} onClick={() => { setPendingCancelEvolutionId(evolution.id); setCancelReason(""); }} type="button"><XCircle aria-hidden="true" size={15} />Cancelar</button> : null}
                      </div>
                      {canCancelEvolutions && pendingCancelEvolutionId === evolution.id ? (
                        <div className="evolution-cancel-reason">
                          <label>
                            <span>Motivo do cancelamento</span>
                            <input disabled={isEvolutionActionInProgress} onChange={(event) => setCancelReason(event.target.value)} value={cancelReason} />
                          </label>
                          <div>
                            <button aria-busy={cancelingEvolutionId === evolution.id} className="danger-button" disabled={!cancelReason.trim() || isEvolutionActionInProgress} onClick={() => void cancelEvolution(evolution)} type="button">{cancelingEvolutionId === evolution.id ? <ButtonSpinner label="Cancelando evolução" /> : <XCircle aria-hidden="true" size={15} />}{cancelingEvolutionId === evolution.id ? "Cancelando..." : "Confirmar"}</button>
                            <button className="secondary-button" disabled={isEvolutionActionInProgress} onClick={() => { setPendingCancelEvolutionId(null); setCancelReason(""); }} type="button">Voltar</button>
                          </div>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination-bar" aria-label="Paginação de evoluções">
            <span>{recordsLoading ? "Atualizando evoluções..." : formatPageSummary(recordsTotal, evolutionsOffset, visibleEvolutions.length, recordsTotal === 1 ? "evolução" : "evoluções")}</span>
            <div>
              <button disabled={recordsLoading || isEvolutionActionInProgress || evolutionsPage === 1} onClick={() => setRecordsPage((currentPage) => currentPage - 1)} type="button"><ChevronLeft aria-hidden="true" size={15} />Anterior</button>
              <button disabled={recordsLoading || isEvolutionActionInProgress || evolutionsOffset + visibleEvolutions.length >= recordsTotal} onClick={() => setRecordsPage((currentPage) => currentPage + 1)} type="button">Próxima<ChevronRight aria-hidden="true" size={15} /></button>
            </div>
          </div>
        </>
      ) : <div className="empty-state prontuario-selection-message">Seu usuário não possui permissão para visualizar evoluções.</div>}

      {isEvolutionModalOpen ? (
        <div className="confirmation-modal-layer" role="presentation">
          <button aria-label="Fechar evolução" className="confirmation-modal-backdrop" disabled={savingEvolution} onClick={() => { setIsEvolutionModalOpen(false); setForm(emptyFormState); }} type="button" />
          <section aria-labelledby="evolution-modal-title" aria-modal="true" className="confirmation-modal-panel evolution-modal-panel" role="dialog">
            <div className="confirmation-modal-heading">
              <div className="confirmation-modal-icon is-primary" aria-hidden="true"><FilePenLine size={20} /></div>
              <div>
                <span className="eyebrow">Evolução</span>
                <h3 id="evolution-modal-title">{evolutionModalTitle}</h3>
                <p>{selectedPatient ? `${selectedPatient.name} - ${formatPatientDocuments(selectedPatient)}` : "Selecione um paciente antes de registrar a evolução."}</p>
              </div>
              <button aria-label="Fechar" className="icon-button" disabled={savingEvolution} onClick={() => { setIsEvolutionModalOpen(false); setForm(emptyFormState); }} type="button"><X aria-hidden="true" size={18} /></button>
            </div>

            <form aria-busy={savingEvolution} className="evolution-form" onSubmit={(event) => { event.preventDefault(); void saveEvolution(); }}>
              <div className="evolution-form-grid">
                <label>
                  <span>Data e hora</span>
                  <input disabled={isEvolutionFormDisabled} onChange={(event) => setForm((currentForm) => ({ ...currentForm, evolutionDate: event.target.value }))} type="datetime-local" value={form.evolutionDate} />
                </label>
                <label>
                  <span>Área profissional</span>
                  <select disabled={isEvolutionFormDisabled} onChange={(event) => setForm((currentForm) => ({ ...currentForm, professionalArea: event.target.value as ProfessionalArea | "" }))} value={form.professionalArea}>
                    <option value="">Selecione</option>
                    {professionalAreaOptions.map((area) => <option key={area} value={area}>{area}</option>)}
                  </select>
                </label>
                <label>
                  <span>Profissional</span>
                  <input disabled={isEvolutionFormDisabled} onChange={(event) => setForm((currentForm) => ({ ...currentForm, professionalName: event.target.value }))} placeholder="Nome do responsável" value={form.professionalName} />
                </label>
              </div>
              <label>
                <span>Texto da evolução</span>
                <textarea disabled={isEvolutionFormDisabled} onChange={(event) => setForm((currentForm) => ({ ...currentForm, text: event.target.value }))} placeholder="Registre a evolução clínica" rows={7} value={form.text} />
              </label>
              <div className="evolution-actions">
                <span aria-live="polite" role="status">{savingEvolution ? "Salvando evolução..." : evolutionMessage}</span>
                <div>
                  {canEditEvolutionForm ? <button className="secondary-button" disabled={savingEvolution || !hasEvolutionFormContent} onClick={() => setForm(emptyFormState)} type="button">Limpar</button> : null}
                  {canEditEvolutionForm ? <button aria-busy={savingEvolution} className="primary-button" disabled={!canSaveEvolution} type="submit">{savingEvolution ? <ButtonSpinner label="Salvando evolução" /> : <Save aria-hidden="true" size={16} />}{savingEvolution ? "Salvando..." : "Salvar rascunho"}</button> : null}
                </div>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  );
}
