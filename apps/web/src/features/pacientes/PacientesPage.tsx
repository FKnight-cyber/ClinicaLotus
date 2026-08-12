"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { CircleAlert, ChevronLeft, ChevronRight, Edit3, Eye, Plus, ToggleLeft, ToggleRight, UserRound, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { ClearFiltersButton, FilterButton } from "@/components/filters/FilterActionButtons";
import { invalidateAnamneseCachesForPatientTransfer } from "@/features/anamnese/storage";
import { useAuth } from "@/features/auth/AuthProvider";
import { invalidateProntuarioCachesForPatientTransfer } from "@/features/prontuario/prontuarioStorage";

type PatientStatus = "ACTIVE" | "INACTIVE";
type ClinicalStatus = "draft" | "finalized" | "canceled";

type PatientClinicFilter = {
  id: string;
  name: string;
  code?: string | null;
};

type Patient = {
  id: string;
  name: string;
  status: PatientStatus;
  clinics?: Array<{ clinicId: string; status: PatientStatus; clinic: PatientClinicFilter }>;
  admissionDate?: string | null;
  dischargeDate?: string | null;
  birthDate?: string | null;
  document?: string | null;
  cpf?: string | null;
  rg?: string | null;
  createdAt: string;
  updatedAt: string;
  linkedExisting?: boolean;
  existingInClinic?: boolean;
  transferSummary?: {
    sourceClinicId: string;
    targetClinicId: string;
    draftAnamnesesTransferred: number;
    draftEvolutionsTransferred: number;
  } | null;
};

type PatientFormState = {
  name: string;
  admissionDate: string;
  dischargeDate: string;
  birthDate: string;
  document: string;
  cpf: string;
  rg: string;
  clinicId: string;
};

type PaginatedPatients = {
  items: Patient[];
  limit: number;
  offset: number;
  total: number;
};

type StoredPatientFilters = {
  clinicId: string;
  search: string;
  status: PatientStatus | "";
  admissionDate: string;
  dischargeDate: string;
  limit: number;
};

type PatientTransferPreview = {
  draftAnamneses: number;
  draftEvolutions: number;
};

type PatientTransferPreviewResponse = {
  anamneses: Array<{ status: ClinicalStatus }>;
  evolutions: Array<{ status: ClinicalStatus }>;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
const DEFAULT_PATIENT_LIMIT = 40;
const MAX_PATIENT_LIMIT = 100;
const PATIENT_SEARCH_DELAY_MS = 350;
const PATIENT_FILTERS_STORAGE_KEY = "clinica.pacientes.filters";
const patientClinicEditTooltip = "Ao trocar a clínica atual do paciente, os registros concluídos permanecem na clínica original. Se houver anamneses ou evoluções em andamento, elas serão transferidas para a nova clínica e o sistema avisará ao salvar.";

const emptyPatientForm: PatientFormState = {
  name: "",
  admissionDate: "",
  dischargeDate: "",
  birthDate: "",
  document: "",
  cpf: "",
  rg: "",
  clinicId: ""
};

function getEditablePatientClinicId(patient: Patient, fallbackClinicId = "") {
  if (fallbackClinicId && patient.clinics?.some((clinic) => clinic.clinicId === fallbackClinicId)) return fallbackClinicId;
  return patient.clinics?.find((clinic) => clinic.status === "ACTIVE")?.clinicId ?? patient.clinics?.[0]?.clinicId ?? fallbackClinicId;
}

function getPatientClinicLabel(patient: Patient, selectedClinicId = "") {
  const clinicLink = (selectedClinicId ? patient.clinics?.find((clinic) => clinic.clinicId === selectedClinicId) : null)
    ?? patient.clinics?.find((clinic) => clinic.status === "ACTIVE")
    ?? patient.clinics?.[0];
  if (!clinicLink) return "Sem clínica vinculada";
  return clinicLink.clinic.code ? `${clinicLink.clinic.name} (${clinicLink.clinic.code})` : clinicLink.clinic.name;
}

function normalizePatientsPage(payload: PaginatedPatients | Patient[], fallbackLimit: number, fallbackOffset: number): PaginatedPatients {
  if (Array.isArray(payload)) {
    return { items: payload.slice(0, fallbackLimit), limit: fallbackLimit, offset: fallbackOffset, total: payload.length };
  }

  return payload;
}

function normalizePatientLimit(value: unknown) {
  const parsedLimit = Number(value);
  if (!Number.isFinite(parsedLimit)) return DEFAULT_PATIENT_LIMIT;
  return Math.min(Math.max(Math.trunc(parsedLimit), 1), MAX_PATIENT_LIMIT);
}

function normalizePatientStatus(value: unknown): PatientStatus | "" {
  return value === "ACTIVE" || value === "INACTIVE" ? value : "";
}

function normalizePatientClinicId(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizePatientDateFilter(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readStoredPatientFilters() {
  const defaultFilters: StoredPatientFilters = { clinicId: "", search: "", status: "ACTIVE", admissionDate: "", dischargeDate: "", limit: DEFAULT_PATIENT_LIMIT };
  if (typeof window === "undefined") return defaultFilters;

  try {
    const storedFilters = window.localStorage.getItem(PATIENT_FILTERS_STORAGE_KEY);
    if (!storedFilters) return defaultFilters;
    const parsedFilters = JSON.parse(storedFilters) as { clinicId?: unknown; search?: unknown; status?: unknown; admissionDate?: unknown; dischargeDate?: unknown; limit?: unknown };

    return {
      clinicId: normalizePatientClinicId(parsedFilters.clinicId),
      search: typeof parsedFilters.search === "string" ? parsedFilters.search : "",
      status: normalizePatientStatus(parsedFilters.status || "ACTIVE"),
      admissionDate: normalizePatientDateFilter(parsedFilters.admissionDate),
      dischargeDate: normalizePatientDateFilter(parsedFilters.dischargeDate),
      limit: normalizePatientLimit(parsedFilters.limit)
    };
  } catch {
    window.localStorage.removeItem(PATIENT_FILTERS_STORAGE_KEY);
    return defaultFilters;
  }
}

function writeStoredPatientFilters(filters: StoredPatientFilters) {
  window.localStorage.setItem(PATIENT_FILTERS_STORAGE_KEY, JSON.stringify(filters));
}

function buildPatientsPath(limit: number, offset: number, search: string, status: string, clinicId: string, admissionDate: string, dischargeDate: string) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  const normalizedSearch = search.trim();
  if (normalizedSearch) params.set("search", normalizedSearch);
  if (clinicId) params.set("clinicId", clinicId);
  if (admissionDate) params.set("admissionDate", admissionDate);
  if (dischargeDate) params.set("dischargeDate", dischargeDate);
  params.set("status", status || "ALL");
  return `/api/patients?${params.toString()}`;
}

function buildPatientsCacheKey(limit: number, offset: number, search: string, status: string, clinicId: string, admissionDate: string, dischargeDate: string) {
  return `${limit}:${offset}:${search.trim().toLowerCase()}:${status}:${clinicId}:${admissionDate}:${dischargeDate}`;
}

function buildPatientDetailHref(patientId: string, clinicId: string) {
  const params = new URLSearchParams();
  if (clinicId) params.set("clinicId", clinicId);
  const queryString = params.toString();
  return `/modulos/pacientes/${patientId}${queryString ? `?${queryString}` : ""}`;
}

function toPatientPayload(form: PatientFormState) {
  return {
    name: form.name.trim(),
    admissionDate: form.admissionDate || undefined,
    dischargeDate: form.dischargeDate || undefined,
    birthDate: form.birthDate || undefined,
    document: form.document.trim() || undefined,
    cpf: form.cpf.trim() || undefined,
    rg: form.rg.trim() || undefined,
    clinicId: form.clinicId || undefined
  };
}

function getPatientForm(patient: Patient): PatientFormState {
  return {
    name: patient.name,
    admissionDate: patient.admissionDate ? patient.admissionDate.slice(0, 10) : "",
    dischargeDate: patient.dischargeDate ? patient.dischargeDate.slice(0, 10) : "",
    birthDate: patient.birthDate ? patient.birthDate.slice(0, 10) : "",
    document: patient.document ?? "",
    cpf: patient.cpf ?? "",
    rg: patient.rg ?? "",
    clinicId: ""
  };
}

function formatPatientDocuments(patient: Patient) {
  const documents = [
    patient.cpf ? `CPF: ${patient.cpf}` : null,
    patient.rg ? `RG: ${patient.rg}` : null,
    patient.document ? `Documento: ${patient.document}` : null
  ].filter(Boolean);

  return documents.join(" | ") || "Sem documento cadastrado";
}

function formatBirthDate(value?: string | null) {
  if (!value) return "Nascimento não informado";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function formatPatientDate(value?: string | null, fallback = "Não informado") {
  if (!value) return fallback;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function formatPageSummary(total: number, offset: number, count: number) {
  if (total === 0) return "0 pacientes";
  return `${offset + 1}-${offset + count} de ${total} pacientes`;
}

function buildTransferMessage(transferSummary?: Patient["transferSummary"] | null) {
  if (!transferSummary || transferSummary.sourceClinicId === transferSummary.targetClinicId) return "";

  const transferredItems = [
    transferSummary.draftAnamnesesTransferred ? `${transferSummary.draftAnamnesesTransferred} anamnese(s) em andamento` : "",
    transferSummary.draftEvolutionsTransferred ? `${transferSummary.draftEvolutionsTransferred} evolução(ões) em andamento` : ""
  ].filter(Boolean);

  if (transferredItems.length === 0) {
    return " Registros concluídos permanecem na clínica anterior.";
  }

  return ` Registros concluídos permanecem na clínica anterior. ${transferredItems.join(" e ")} transferida(s) para a nova clínica.`;
}

function buildTransferPreview(counts: PatientTransferPreview) {
  if (!counts.draftAnamneses && !counts.draftEvolutions) return null;

  const items = [
    counts.draftAnamneses ? `${counts.draftAnamneses} anamnese(s) em rascunho` : "",
    counts.draftEvolutions ? `${counts.draftEvolutions} evolução(ões) em rascunho` : ""
  ].filter(Boolean);

  return `Há ${items.join(" e ")} nesta clínica. Ao salvar a troca, esses registros em aberto serão transferidos para a nova clínica. Os registros concluídos permanecerão na clínica anterior.`;
}

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
    throw new Error(payload?.message ?? "Não foi possível concluir a operação com pacientes.");
  }

  return response.json() as Promise<T>;
}

export function PacientesPage() {
  const { clinics, hasPermission, refreshProfile, token } = useAuth();
  const router = useRouter();
  const canReadPatients = hasPermission("patients.read");
  const canCreatePatients = hasPermission("patients.create");
  const canFilterPatientsByClinic = hasPermission("patients.clinic_filter") && clinics.length > 1;
  const canUpdatePatients = hasPermission("patients.update");
  const canInactivatePatients = hasPermission("patients.inactivate");
  const availablePatientClinics: PatientClinicFilter[] = clinics.filter((clinic) => clinic.status === "ACTIVE");
  const shouldShowPatientClinicField = availablePatientClinics.length > 0;
  const mustChoosePatientClinic = availablePatientClinics.length > 1;
  const patientsCacheRef = useRef(new Map<string, PaginatedPatients>());
  const [initialPatientFilters] = useState(readStoredPatientFilters);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientTotal, setPatientTotal] = useState(0);
  const [patientLimit, setPatientLimit] = useState(initialPatientFilters.limit);
  const [patientPage, setPatientPage] = useState(1);
  const [patientSearch, setPatientSearch] = useState(initialPatientFilters.search);
  const [debouncedPatientSearch, setDebouncedPatientSearch] = useState(initialPatientFilters.search);
  const [selectedPatientClinicId, setSelectedPatientClinicId] = useState(initialPatientFilters.clinicId);
  const [selectedPatientStatus, setSelectedPatientStatus] = useState<PatientStatus | "">(initialPatientFilters.status);
  const [selectedAdmissionDate, setSelectedAdmissionDate] = useState(initialPatientFilters.admissionDate);
  const [selectedDischargeDate, setSelectedDischargeDate] = useState(initialPatientFilters.dischargeDate);
  const [draftPatientSearch, setDraftPatientSearch] = useState(initialPatientFilters.search);
  const [draftSelectedPatientClinicId, setDraftSelectedPatientClinicId] = useState(initialPatientFilters.clinicId);
  const [draftSelectedPatientStatus, setDraftSelectedPatientStatus] = useState<PatientStatus | "">(initialPatientFilters.status);
  const [draftSelectedAdmissionDate, setDraftSelectedAdmissionDate] = useState(initialPatientFilters.admissionDate);
  const [draftSelectedDischargeDate, setDraftSelectedDischargeDate] = useState(initialPatientFilters.dischargeDate);
  const [draftPatientLimit, setDraftPatientLimit] = useState(initialPatientFilters.limit);
  const [isPatientFiltersOpen, setIsPatientFiltersOpen] = useState(false);
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [statusConfirmation, setStatusConfirmation] = useState<{ patient: Patient; nextStatus: PatientStatus } | null>(null);
  const [patientForm, setPatientForm] = useState<PatientFormState>(emptyPatientForm);
  const [editingPatientClinicId, setEditingPatientClinicId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPatientsLoading, setIsPatientsLoading] = useState(true);
  const [isSavingPatient, setIsSavingPatient] = useState(false);
  const [savingStatusPatientId, setSavingStatusPatientId] = useState<string | null>(null);
  const [isLoadingPatientTransferPreview, setIsLoadingPatientTransferPreview] = useState(false);
  const [patientTransferPreview, setPatientTransferPreview] = useState<PatientTransferPreview | null>(null);

  const patientOffset = (patientPage - 1) * patientLimit;
  const selectedPatientClinicIsAvailable = availablePatientClinics.some((clinic) => clinic.id === selectedPatientClinicId);
  const effectivePatientClinicId = canFilterPatientsByClinic && selectedPatientClinicIsAvailable ? selectedPatientClinicId : "";
  const activePatientFilterCount = [patientSearch.trim(), effectivePatientClinicId, selectedPatientStatus !== "ACTIVE" ? "status" : "", selectedAdmissionDate, selectedDischargeDate, patientLimit !== DEFAULT_PATIENT_LIMIT ? String(patientLimit) : ""].filter(Boolean).length;
  const hasActivePatientFilters = activePatientFilterCount > 0;
  const isChangingPatientClinic = Boolean(editingPatient && editingPatientClinicId && patientForm.clinicId && patientForm.clinicId !== editingPatientClinicId);
  const patientTransferPreviewMessage = patientTransferPreview ? buildTransferPreview(patientTransferPreview) : null;

  const applyPatientsPage = useCallback((nextPatientsPage: PaginatedPatients) => {
    setPatients(nextPatientsPage.items);
    setPatientTotal(nextPatientsPage.total);
    setPatientLimit(nextPatientsPage.limit);
  }, []);

  const fetchPatientsPage = useCallback(async (limit: number, offset: number, search: string, status: string, clinicId: string, admissionDate: string, dischargeDate: string, bypassCache = false) => {
    if (!token) return { items: [], limit, offset, total: 0 };

    const cacheKey = buildPatientsCacheKey(limit, offset, search, status, clinicId, admissionDate, dischargeDate);
    const cachedPatientsPage = patientsCacheRef.current.get(cacheKey);
    if (!bypassCache && cachedPatientsPage) return cachedPatientsPage;

    const nextPatientsPayload = await apiRequest<PaginatedPatients | Patient[]>(token, buildPatientsPath(limit, offset, search, status, clinicId, admissionDate, dischargeDate));
    const nextPatientsPage = normalizePatientsPage(nextPatientsPayload, limit, offset);
    patientsCacheRef.current.set(cacheKey, nextPatientsPage);
    return nextPatientsPage;
  }, [token]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedPatientSearch(patientSearch);
      setPatientPage(1);
    }, PATIENT_SEARCH_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [patientSearch]);

  useEffect(() => {
    writeStoredPatientFilters({
      clinicId: effectivePatientClinicId,
      search: patientSearch,
      status: selectedPatientStatus,
      admissionDate: selectedAdmissionDate,
      dischargeDate: selectedDischargeDate,
      limit: patientLimit
    });
  }, [effectivePatientClinicId, patientLimit, patientSearch, selectedPatientStatus, selectedAdmissionDate, selectedDischargeDate]);

  useEffect(() => {
    if (!token || !canReadPatients) return;

    let isCurrent = true;
    const cacheKey = buildPatientsCacheKey(patientLimit, patientOffset, debouncedPatientSearch, selectedPatientStatus, effectivePatientClinicId, selectedAdmissionDate, selectedDischargeDate);
    const cachedPatientsPage = patientsCacheRef.current.get(cacheKey);

    Promise.resolve().then(() => {
      if (!isCurrent) return;
      setIsPatientsLoading(!cachedPatientsPage);
      if (!cachedPatientsPage) setIsLoading(true);
    });

    fetchPatientsPage(patientLimit, patientOffset, debouncedPatientSearch, selectedPatientStatus, effectivePatientClinicId, selectedAdmissionDate, selectedDischargeDate).then((nextPatientsPage) => {
      if (!isCurrent) return;
      applyPatientsPage(nextPatientsPage);
      setIsPatientsLoading(false);
      setIsLoading(false);
    }).catch((error) => {
      if (!isCurrent) return;
      setMessage(error instanceof Error ? error.message : "Não foi possível carregar pacientes.");
      setIsPatientsLoading(false);
      setIsLoading(false);
    });

    return () => {
      isCurrent = false;
    };
  }, [token, canReadPatients, patientLimit, patientOffset, debouncedPatientSearch, selectedPatientStatus, effectivePatientClinicId, selectedAdmissionDate, selectedDischargeDate, applyPatientsPage, fetchPatientsPage]);

  const refreshCurrentPage = async () => {
    if (!token) return;
    patientsCacheRef.current.clear();
    const nextPatientsPage = await fetchPatientsPage(patientLimit, patientOffset, debouncedPatientSearch, selectedPatientStatus, effectivePatientClinicId, selectedAdmissionDate, selectedDischargeDate, true);
    applyPatientsPage(nextPatientsPage);
  };

  const handleClearPatientFilters = () => {
    setPatientSearch("");
    setDebouncedPatientSearch("");
    setSelectedPatientClinicId("");
    setSelectedPatientStatus("ACTIVE");
    setSelectedAdmissionDate("");
    setSelectedDischargeDate("");
    setPatientLimit(DEFAULT_PATIENT_LIMIT);
    setPatientPage(1);
    setDraftPatientSearch("");
    setDraftSelectedPatientClinicId("");
    setDraftSelectedPatientStatus("ACTIVE");
    setDraftSelectedAdmissionDate("");
    setDraftSelectedDischargeDate("");
    setDraftPatientLimit(DEFAULT_PATIENT_LIMIT);
  };

  const handleOpenPatientFilters = () => {
    setDraftPatientSearch(patientSearch);
    setDraftSelectedPatientClinicId(effectivePatientClinicId);
    setDraftSelectedPatientStatus(selectedPatientStatus);
    setDraftSelectedAdmissionDate(selectedAdmissionDate);
    setDraftSelectedDischargeDate(selectedDischargeDate);
    setDraftPatientLimit(patientLimit);
    setIsPatientFiltersOpen(true);
  };

  const handleApplyPatientFilters = () => {
    setPatientSearch(draftPatientSearch);
    setDebouncedPatientSearch(draftPatientSearch);
    setSelectedPatientClinicId(canFilterPatientsByClinic ? draftSelectedPatientClinicId : "");
    setSelectedPatientStatus(draftSelectedPatientStatus);
    setSelectedAdmissionDate(draftSelectedAdmissionDate);
    setSelectedDischargeDate(draftSelectedDischargeDate);
    setPatientLimit(normalizePatientLimit(draftPatientLimit));
    setPatientPage(1);
    setIsPatientFiltersOpen(false);
  };

  const openCreatePatientModal = async () => {
    const refreshedProfile = await refreshProfile().catch(() => null);
    const refreshedClinics = refreshedProfile?.clinics?.filter((clinic) => clinic.status === "ACTIVE") ?? availablePatientClinics;

    setEditingPatient(null);
    setEditingPatientClinicId("");
    setPatientTransferPreview(null);
    setIsLoadingPatientTransferPreview(false);
    setPatientForm({ ...emptyPatientForm, clinicId: effectivePatientClinicId || (refreshedClinics.length === 1 ? refreshedClinics[0].id : "") });
    setIsPatientModalOpen(true);
  };

  const openEditPatientModal = async (patient: Patient) => {
    const currentClinicId = getEditablePatientClinicId(patient, effectivePatientClinicId);
    setEditingPatient(patient);
    setEditingPatientClinicId(currentClinicId);
    setPatientTransferPreview(null);
    setPatientForm({ ...getPatientForm(patient), clinicId: currentClinicId });
    setIsPatientModalOpen(true);

    if (!token || !currentClinicId) return;

    setIsLoadingPatientTransferPreview(true);
    try {
      const detail = await apiRequest<PatientTransferPreviewResponse>(token, `/api/patients/${patient.id}?clinicId=${encodeURIComponent(currentClinicId)}`);
      setPatientTransferPreview({
        draftAnamneses: detail.anamneses.filter((record) => record.status === "draft").length,
        draftEvolutions: detail.evolutions.filter((record) => record.status === "draft").length
      });
    } catch {
      setPatientTransferPreview(null);
    } finally {
      setIsLoadingPatientTransferPreview(false);
    }
  };

  const handleSavePatient = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !patientForm.name.trim() || (!editingPatient && mustChoosePatientClinic && !patientForm.clinicId)) return;
    setIsSavingPatient(true);

    try {
      if (editingPatient) {
        const clinicQuery = editingPatientClinicId ? `?clinicId=${encodeURIComponent(editingPatientClinicId)}` : "";
        const updatedPatient = await apiRequest<Patient>(token, `/api/patients/${editingPatient.id}${clinicQuery}`, {
          method: "PATCH",
          body: JSON.stringify(toPatientPayload(patientForm))
        });
        invalidateAnamneseCachesForPatientTransfer(token, editingPatient.id);
        invalidateProntuarioCachesForPatientTransfer(token, editingPatient.id);
        setMessage(`Paciente atualizado.${buildTransferMessage(updatedPatient.transferSummary)}`);
      } else {
        const patient = await apiRequest<Patient>(token, "/api/patients", {
          method: "POST",
          body: JSON.stringify(toPatientPayload(patientForm))
        });
        invalidateAnamneseCachesForPatientTransfer(token, patient.id);
        invalidateProntuarioCachesForPatientTransfer(token, patient.id);
        setMessage(patient.linkedExisting
          ? `Paciente existente vinculado à clínica selecionada.${buildTransferMessage(patient.transferSummary)}`
          : patient.existingInClinic
            ? "Paciente já estava cadastrado nesta clínica."
            : `Paciente criado.${buildTransferMessage(patient.transferSummary)}`);
      }

      setIsPatientModalOpen(false);
      setEditingPatientClinicId("");
      setPatientTransferPreview(null);
      setPatientForm(emptyPatientForm);
      await refreshCurrentPage();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar o paciente.");
    } finally {
      setIsSavingPatient(false);
    }
  };

  const handleConfirmStatusChange = async () => {
    if (!token || !statusConfirmation) return;
    const { nextStatus, patient } = statusConfirmation;
    setSavingStatusPatientId(patient.id);
    setIsPatientsLoading(true);

    try {
      await apiRequest<Patient>(token, `/api/patients/${patient.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus })
      });
      await refreshCurrentPage();
      setStatusConfirmation(null);
      setMessage(nextStatus === "ACTIVE" ? "Paciente ativado." : "Paciente inativado no cadastro administrativo.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível atualizar o status do paciente.");
    } finally {
      setSavingStatusPatientId(null);
      setIsPatientsLoading(false);
    }
  };

  if (!canReadPatients) {
    return (
      <section className="placeholder-page">
        <div className="page-intro">
          <div className="intro-icon" aria-hidden="true"><UserRound size={28} /></div>
          <div>
            <span className="eyebrow">Pacientes</span>
            <h2>Permissão necessária</h2>
            <p>Seu usuário não possui permissão para visualizar pacientes.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="list-page patients-page">
      <div className="list-header">
        <div>
          <span className="eyebrow">Cadastros</span>
          <h2>Pacientes</h2>
          <p>Consulte, cadastre e mantenha o status administrativo dos pacientes.</p>
        </div>
        <div className="list-actions">
          {canCreatePatients ? <button className="primary-button" onClick={openCreatePatientModal} type="button"><Plus aria-hidden="true" size={16} />Novo paciente</button> : null}
        </div>
      </div>

      {message ? <div className="access-message">{message}</div> : null}
      {isLoading ? <div className="loading-panel">Carregando pacientes...</div> : null}

      <div className="list-toolbar">
        <div className="filter-actions-row">
          <FilterButton activeCount={activePatientFilterCount} onClick={handleOpenPatientFilters} />
          <ClearFiltersButton disabled={!hasActivePatientFilters} onClick={handleClearPatientFilters} />
        </div>
        <span>{isPatientsLoading ? "Atualizando pacientes..." : `${patients.length} de ${patientTotal} pacientes exibidos`}</span>
      </div>

      {isPatientFiltersOpen ? (
        <div className="filter-drawer-layer" role="presentation">
          <button aria-label="Fechar filtros" className="filter-drawer-backdrop" onClick={() => setIsPatientFiltersOpen(false)} type="button" />
          <aside aria-label="Filtros de pacientes" className="filter-drawer-panel">
            <div className="filter-drawer-heading">
              <div>
                <span className="eyebrow">Filtros</span>
                <h3>Filtrar pacientes</h3>
              </div>
              <button className="icon-button" onClick={() => setIsPatientFiltersOpen(false)} title="Fechar filtros" type="button"><X aria-hidden="true" size={18} /></button>
            </div>
            <div className="filter-drawer-fields">
              <label>
                <span>Buscar paciente</span>
                <input aria-label="Buscar paciente" onChange={(event) => setDraftPatientSearch(event.target.value)} placeholder="Nome, CPF, RG ou documento" value={draftPatientSearch} />
              </label>
              {canFilterPatientsByClinic ? (
                <label>
                  <span>Clínica</span>
                  <select aria-label="Filtrar por clínica" onChange={(event) => setDraftSelectedPatientClinicId(event.target.value)} value={draftSelectedPatientClinicId}>
                    <option value="">Todas as clínicas permitidas</option>
                    {availablePatientClinics.map((clinic) => (
                      <option key={clinic.id} value={clinic.id}>{clinic.name}{clinic.code ? ` (${clinic.code})` : ""}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label>
                <span>Status</span>
                <select aria-label="Filtrar por status" onChange={(event) => setDraftSelectedPatientStatus(event.target.value as PatientStatus | "")} value={draftSelectedPatientStatus}>
                  <option value="">Todos os status</option>
                  <option value="ACTIVE">Ativos</option>
                  <option value="INACTIVE">Inativos</option>
                </select>
              </label>
              <label>
                <span>Data de admissão</span>
                <input aria-label="Filtrar por data de admissão" onChange={(event) => setDraftSelectedAdmissionDate(event.target.value)} type="date" value={draftSelectedAdmissionDate} />
              </label>
              <label>
                <span>Dia da alta</span>
                <input aria-label="Filtrar por dia da alta" onChange={(event) => setDraftSelectedDischargeDate(event.target.value)} type="date" value={draftSelectedDischargeDate} />
              </label>
              <label>
                <span>Nº de pacientes exibidos</span>
                <input
                  max={MAX_PATIENT_LIMIT}
                  min={1}
                  onChange={(event) => setDraftPatientLimit(normalizePatientLimit(event.target.value))}
                  type="number"
                  value={draftPatientLimit}
                />
              </label>
            </div>
            <div className="filter-drawer-actions">
              <ClearFiltersButton disabled={!hasActivePatientFilters} onClick={handleClearPatientFilters} />
              <button className="primary-button" onClick={handleApplyPatientFilters} type="button">Aplicar filtros</button>
            </div>
          </aside>
        </div>
      ) : null}

      {isPatientsLoading ? <div className="inline-loading patients-inline-loading">Atualizando pacientes...</div> : null}

      <div className={`records-table-shell ${isPatientsLoading ? "is-loading" : ""}`}>
        <table className="records-table patients-table">
          <thead>
            <tr>
              <th>Paciente</th>
              <th>Clínica</th>
              <th>Admissão</th>
              <th>Alta</th>
              <th>Documentos</th>
              <th>Nascimento</th>
              <th>Status</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {patients.length === 0 ? (
              <tr>
                <td colSpan={8}>Nenhum paciente encontrado.</td>
              </tr>
            ) : (
              patients.map((patient) => {
                const nextStatus = patient.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
                const ToggleIcon = nextStatus === "ACTIVE" ? ToggleRight : ToggleLeft;
                const isInactive = patient.status === "INACTIVE";

                return (
                  <tr key={patient.id}>
                    <td><strong>{patient.name}</strong></td>
                    <td>{getPatientClinicLabel(patient, effectivePatientClinicId)}</td>
                    <td>{formatPatientDate(patient.admissionDate)}</td>
                    <td>{formatPatientDate(patient.dischargeDate)}</td>
                    <td>{formatPatientDocuments(patient)}</td>
                    <td>{formatBirthDate(patient.birthDate)}</td>
                    <td>
                      <span className={`table-status ${isInactive ? "is-inactive" : "is-finalized"}`}>
                        {isInactive ? "Inativo" : "Ativo"}
                      </span>
                    </td>
                    <td>
                      <div className="records-table-actions patients-table-actions">
                        {canUpdatePatients ? <button className="table-action" onClick={() => { void openEditPatientModal(patient); }} type="button"><Edit3 aria-hidden="true" size={16} />Editar</button> : null}
                        {canInactivatePatients ? (
                          <button className="table-action" disabled={savingStatusPatientId === patient.id} onClick={() => setStatusConfirmation({ patient, nextStatus })} type="button">
                            <ToggleIcon aria-hidden="true" size={16} />{savingStatusPatientId === patient.id ? "Atualizando..." : nextStatus === "ACTIVE" ? "Ativar" : "Inativar"}
                          </button>
                        ) : null}
                        <button className="table-action" onClick={() => router.push(buildPatientDetailHref(patient.id, effectivePatientClinicId))} type="button"><Eye aria-hidden="true" size={16} />Informações adicionais</button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination-bar" aria-label="Paginação de pacientes">
        <span>{isPatientsLoading ? "Atualizando pacientes..." : formatPageSummary(patientTotal, patientOffset, patients.length)}</span>
        <div>
          <button disabled={isPatientsLoading || patientPage === 1} onClick={() => setPatientPage((currentPage) => Math.max(1, currentPage - 1))} type="button"><ChevronLeft aria-hidden="true" size={15} />Anterior</button>
          <button disabled={isPatientsLoading || patientOffset + patients.length >= patientTotal} onClick={() => setPatientPage((currentPage) => currentPage + 1)} type="button">Próxima<ChevronRight aria-hidden="true" size={15} /></button>
        </div>
      </div>

      {isPatientModalOpen ? (
        <div className="confirmation-modal-layer" role="presentation">
          <button aria-label="Cancelar edição de paciente" className="confirmation-modal-backdrop" onClick={() => setIsPatientModalOpen(false)} type="button" />
          <section aria-labelledby="patient-modal-title" aria-modal="true" className="confirmation-modal-panel patient-modal-panel" role="dialog">
            <div className="confirmation-modal-heading">
              <span className="confirmation-modal-icon is-primary"><UserRound aria-hidden="true" size={20} /></span>
              <div>
                <span className="eyebrow">Pacientes</span>
                <h3 id="patient-modal-title">{editingPatient ? "Editar paciente" : "Novo paciente"}</h3>
              </div>
              <button className="icon-button" onClick={() => setIsPatientModalOpen(false)} title="Fechar" type="button"><X aria-hidden="true" size={18} /></button>
            </div>
            <form className="access-form patient-form-grid" onSubmit={handleSavePatient}>
              {!editingPatient && shouldShowPatientClinicField ? (
                <label className="patient-form-full">
                  <span>Clínica do cadastro</span>
                  <select disabled={!mustChoosePatientClinic} onChange={(event) => setPatientForm((form) => ({ ...form, clinicId: event.target.value }))} required value={patientForm.clinicId}>
                    {mustChoosePatientClinic ? <option value="">Selecione a clínica</option> : null}
                    {availablePatientClinics.map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.name}{clinic.code ? ` (${clinic.code})` : ""}</option>)}
                  </select>
                </label>
              ) : null}
              {editingPatient ? (
                <label className="patient-form-full">
                  <span className="field-label-with-tooltip">
                    Clínica do paciente
                    <span className="permission-tooltip" title={patientClinicEditTooltip}>
                      <button aria-label={patientClinicEditTooltip} className="field-label-tooltip-button" type="button">
                        <CircleAlert aria-hidden="true" size={15} />
                      </button>
                    </span>
                  </span>
                  <select onChange={(event) => setPatientForm((form) => ({ ...form, clinicId: event.target.value }))} required value={patientForm.clinicId}>
                    <option value="">Selecione a clínica</option>
                    {availablePatientClinics.map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.name}{clinic.code ? ` (${clinic.code})` : ""}</option>)}
                  </select>
                  {isChangingPatientClinic && isLoadingPatientTransferPreview ? <small className="patient-clinic-transfer-warning">Verificando registros em aberto na clínica atual...</small> : null}
                  {isChangingPatientClinic && patientTransferPreviewMessage ? <small className="patient-clinic-transfer-warning">{patientTransferPreviewMessage}</small> : null}
                </label>
              ) : null}
              <label><span>Nome completo</span><input autoFocus onChange={(event) => setPatientForm((form) => ({ ...form, name: event.target.value }))} required value={patientForm.name} /></label>
              <label><span>Data de admissão</span><input onChange={(event) => setPatientForm((form) => ({ ...form, admissionDate: event.target.value }))} type="date" value={patientForm.admissionDate} /></label>
              <label><span>Dia da alta</span><input onChange={(event) => setPatientForm((form) => ({ ...form, dischargeDate: event.target.value }))} type="date" value={patientForm.dischargeDate} /></label>
              <label><span>Nascimento</span><input onChange={(event) => setPatientForm((form) => ({ ...form, birthDate: event.target.value }))} type="date" value={patientForm.birthDate} /></label>
              <label><span>CPF</span><input onChange={(event) => setPatientForm((form) => ({ ...form, cpf: event.target.value }))} placeholder="CPF" value={patientForm.cpf} /></label>
              <label><span>RG</span><input onChange={(event) => setPatientForm((form) => ({ ...form, rg: event.target.value }))} placeholder="RG" value={patientForm.rg} /></label>
              <label className="patient-form-full"><span>Documento complementar</span><input onChange={(event) => setPatientForm((form) => ({ ...form, document: event.target.value }))} placeholder="Outro documento" value={patientForm.document} /></label>
              <div className="confirmation-modal-actions patient-form-full">
                <button className="secondary-button" disabled={isSavingPatient} onClick={() => { setIsPatientModalOpen(false); setEditingPatientClinicId(""); setPatientTransferPreview(null); }} type="button">Cancelar</button>
                <button className="primary-button" disabled={isSavingPatient || !patientForm.name.trim() || !patientForm.clinicId} type="submit">{isSavingPatient ? "Salvando..." : "Salvar paciente"}</button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {statusConfirmation ? (
        <div className="confirmation-modal-layer" role="presentation">
          <button aria-label="Cancelar alteração de status" className="confirmation-modal-backdrop" onClick={() => setStatusConfirmation(null)} type="button" />
          <section aria-labelledby="patient-status-modal-title" aria-modal="true" className="confirmation-modal-panel" role="dialog">
            <div className="confirmation-modal-heading">
              <span className={`confirmation-modal-icon ${statusConfirmation.nextStatus === "ACTIVE" ? "is-primary" : "is-danger"}`}><UserRound aria-hidden="true" size={20} /></span>
              <div>
                <span className="eyebrow">Status administrativo</span>
                <h3 id="patient-status-modal-title">{statusConfirmation.nextStatus === "ACTIVE" ? "Ativar paciente?" : "Inativar paciente?"}</h3>
              </div>
            </div>
            <p>{statusConfirmation.nextStatus === "ACTIVE" ? `${statusConfirmation.patient.name} voltará aos filtros de pacientes ativos.` : `${statusConfirmation.patient.name} será removido dos fluxos operacionais de seleção de pacientes ativos. Alta continua sendo um evento do atendimento, não deste status cadastral.`}</p>
            <div className="confirmation-modal-actions">
              <button className="secondary-button" disabled={savingStatusPatientId === statusConfirmation.patient.id} onClick={() => setStatusConfirmation(null)} type="button">Cancelar</button>
              <button className="primary-button" disabled={savingStatusPatientId === statusConfirmation.patient.id} onClick={handleConfirmStatusChange} type="button">{savingStatusPatientId === statusConfirmation.patient.id ? "Atualizando..." : statusConfirmation.nextStatus === "ACTIVE" ? "Ativar" : "Inativar"}</button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}