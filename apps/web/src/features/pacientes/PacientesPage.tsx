"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Edit3, Eye, Plus, ToggleLeft, ToggleRight, UserRound, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { ClearFiltersButton, FilterButton } from "@/components/filters/FilterActionButtons";
import { useAuth } from "@/features/auth/AuthProvider";

type PatientStatus = "ACTIVE" | "INACTIVE";

type Patient = {
  id: string;
  name: string;
  status: PatientStatus;
  birthDate?: string | null;
  document?: string | null;
  cpf?: string | null;
  rg?: string | null;
  createdAt: string;
  updatedAt: string;
};

type PatientFormState = {
  name: string;
  birthDate: string;
  document: string;
  cpf: string;
  rg: string;
};

type PaginatedPatients = {
  items: Patient[];
  limit: number;
  offset: number;
  total: number;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
const DEFAULT_PATIENT_LIMIT = 40;
const MAX_PATIENT_LIMIT = 100;
const PATIENT_SEARCH_DELAY_MS = 350;
const PATIENT_FILTERS_STORAGE_KEY = "clinica.pacientes.filters";

const emptyPatientForm: PatientFormState = {
  name: "",
  birthDate: "",
  document: "",
  cpf: "",
  rg: ""
};

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

function readStoredPatientFilters() {
  const defaultFilters = { search: "", status: "ACTIVE" as PatientStatus | "", limit: DEFAULT_PATIENT_LIMIT };
  if (typeof window === "undefined") return defaultFilters;

  try {
    const storedFilters = window.localStorage.getItem(PATIENT_FILTERS_STORAGE_KEY);
    if (!storedFilters) return defaultFilters;
    const parsedFilters = JSON.parse(storedFilters) as { search?: unknown; status?: unknown; limit?: unknown };

    return {
      search: typeof parsedFilters.search === "string" ? parsedFilters.search : "",
      status: normalizePatientStatus(parsedFilters.status || "ACTIVE"),
      limit: normalizePatientLimit(parsedFilters.limit)
    };
  } catch {
    window.localStorage.removeItem(PATIENT_FILTERS_STORAGE_KEY);
    return defaultFilters;
  }
}

function writeStoredPatientFilters(search: string, status: PatientStatus | "", limit: number) {
  window.localStorage.setItem(PATIENT_FILTERS_STORAGE_KEY, JSON.stringify({ search, status, limit }));
}

function buildPatientsPath(limit: number, offset: number, search: string, status: string) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  const normalizedSearch = search.trim();
  if (normalizedSearch) params.set("search", normalizedSearch);
  params.set("status", status || "ALL");
  return `/api/patients?${params.toString()}`;
}

function buildPatientsCacheKey(limit: number, offset: number, search: string, status: string) {
  return `${limit}:${offset}:${search.trim().toLowerCase()}:${status}`;
}

function toPatientPayload(form: PatientFormState) {
  return {
    name: form.name.trim(),
    birthDate: form.birthDate || undefined,
    document: form.document.trim() || undefined,
    cpf: form.cpf.trim() || undefined,
    rg: form.rg.trim() || undefined
  };
}

function getPatientForm(patient: Patient): PatientFormState {
  return {
    name: patient.name,
    birthDate: patient.birthDate ? patient.birthDate.slice(0, 10) : "",
    document: patient.document ?? "",
    cpf: patient.cpf ?? "",
    rg: patient.rg ?? ""
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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function formatPageSummary(total: number, offset: number, count: number) {
  if (total === 0) return "0 pacientes";
  return `${offset + 1}-${offset + count} de ${total} pacientes`;
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
  const { hasPermission, token } = useAuth();
  const router = useRouter();
  const canReadPatients = hasPermission("patients.read");
  const canCreatePatients = hasPermission("patients.create");
  const canUpdatePatients = hasPermission("patients.update");
  const canInactivatePatients = hasPermission("patients.inactivate");
  const patientsCacheRef = useRef(new Map<string, PaginatedPatients>());
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientTotal, setPatientTotal] = useState(0);
  const [patientLimit, setPatientLimit] = useState(DEFAULT_PATIENT_LIMIT);
  const [patientPage, setPatientPage] = useState(1);
  const [patientSearch, setPatientSearch] = useState("");
  const [debouncedPatientSearch, setDebouncedPatientSearch] = useState("");
  const [selectedPatientStatus, setSelectedPatientStatus] = useState<PatientStatus | "">("ACTIVE");
  const [draftPatientSearch, setDraftPatientSearch] = useState("");
  const [draftSelectedPatientStatus, setDraftSelectedPatientStatus] = useState<PatientStatus | "">("ACTIVE");
  const [draftPatientLimit, setDraftPatientLimit] = useState(DEFAULT_PATIENT_LIMIT);
  const [isPatientFiltersOpen, setIsPatientFiltersOpen] = useState(false);
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [statusConfirmation, setStatusConfirmation] = useState<{ patient: Patient; nextStatus: PatientStatus } | null>(null);
  const [patientForm, setPatientForm] = useState<PatientFormState>(emptyPatientForm);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPatientsLoading, setIsPatientsLoading] = useState(true);
  const [isSavingPatient, setIsSavingPatient] = useState(false);
  const [savingStatusPatientId, setSavingStatusPatientId] = useState<string | null>(null);
  const [hasLoadedStoredFilters, setHasLoadedStoredFilters] = useState(false);

  const patientOffset = (patientPage - 1) * patientLimit;
  const activePatientFilterCount = [patientSearch.trim(), selectedPatientStatus !== "ACTIVE" ? "status" : "", patientLimit !== DEFAULT_PATIENT_LIMIT ? String(patientLimit) : ""].filter(Boolean).length;
  const hasActivePatientFilters = activePatientFilterCount > 0;

  const applyPatientsPage = useCallback((nextPatientsPage: PaginatedPatients) => {
    setPatients(nextPatientsPage.items);
    setPatientTotal(nextPatientsPage.total);
    setPatientLimit(nextPatientsPage.limit);
  }, []);

  const fetchPatientsPage = useCallback(async (limit: number, offset: number, search: string, status: string, bypassCache = false) => {
    if (!token) return { items: [], limit, offset, total: 0 };

    const cacheKey = buildPatientsCacheKey(limit, offset, search, status);
    const cachedPatientsPage = patientsCacheRef.current.get(cacheKey);
    if (!bypassCache && cachedPatientsPage) return cachedPatientsPage;

    const nextPatientsPayload = await apiRequest<PaginatedPatients | Patient[]>(token, buildPatientsPath(limit, offset, search, status));
    const nextPatientsPage = normalizePatientsPage(nextPatientsPayload, limit, offset);
    patientsCacheRef.current.set(cacheKey, nextPatientsPage);
    return nextPatientsPage;
  }, [token]);

  useEffect(() => {
    const storedFilters = readStoredPatientFilters();
    setPatientSearch(storedFilters.search);
    setDebouncedPatientSearch(storedFilters.search);
    setSelectedPatientStatus(storedFilters.status);
    setPatientLimit(storedFilters.limit);
    setDraftPatientSearch(storedFilters.search);
    setDraftSelectedPatientStatus(storedFilters.status);
    setDraftPatientLimit(storedFilters.limit);
    setHasLoadedStoredFilters(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedStoredFilters) return;

    const timeoutId = window.setTimeout(() => {
      setDebouncedPatientSearch(patientSearch);
      setPatientPage(1);
    }, PATIENT_SEARCH_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [hasLoadedStoredFilters, patientSearch]);

  useEffect(() => {
    if (!hasLoadedStoredFilters) return;
    writeStoredPatientFilters(patientSearch, selectedPatientStatus, patientLimit);
  }, [hasLoadedStoredFilters, patientLimit, patientSearch, selectedPatientStatus]);

  useEffect(() => {
    if (!token || !canReadPatients || !hasLoadedStoredFilters) return;

    let isCurrent = true;
    const cacheKey = buildPatientsCacheKey(patientLimit, patientOffset, debouncedPatientSearch, selectedPatientStatus);
    const cachedPatientsPage = patientsCacheRef.current.get(cacheKey);

    Promise.resolve().then(() => {
      if (!isCurrent) return;
      setIsPatientsLoading(!cachedPatientsPage);
      if (!cachedPatientsPage) setIsLoading(true);
    });

    fetchPatientsPage(patientLimit, patientOffset, debouncedPatientSearch, selectedPatientStatus).then((nextPatientsPage) => {
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
  }, [token, canReadPatients, hasLoadedStoredFilters, patientLimit, patientOffset, debouncedPatientSearch, selectedPatientStatus, applyPatientsPage, fetchPatientsPage]);

  const refreshCurrentPage = async () => {
    if (!token) return;
    patientsCacheRef.current.clear();
    const nextPatientsPage = await fetchPatientsPage(patientLimit, patientOffset, debouncedPatientSearch, selectedPatientStatus, true);
    applyPatientsPage(nextPatientsPage);
  };

  const handleClearPatientFilters = () => {
    setPatientSearch("");
    setDebouncedPatientSearch("");
    setSelectedPatientStatus("ACTIVE");
    setPatientLimit(DEFAULT_PATIENT_LIMIT);
    setPatientPage(1);
    setDraftPatientSearch("");
    setDraftSelectedPatientStatus("ACTIVE");
    setDraftPatientLimit(DEFAULT_PATIENT_LIMIT);
  };

  const handleOpenPatientFilters = () => {
    setDraftPatientSearch(patientSearch);
    setDraftSelectedPatientStatus(selectedPatientStatus);
    setDraftPatientLimit(patientLimit);
    setIsPatientFiltersOpen(true);
  };

  const handleApplyPatientFilters = () => {
    setPatientSearch(draftPatientSearch);
    setDebouncedPatientSearch(draftPatientSearch);
    setSelectedPatientStatus(draftSelectedPatientStatus);
    setPatientLimit(normalizePatientLimit(draftPatientLimit));
    setPatientPage(1);
    setIsPatientFiltersOpen(false);
  };

  const openCreatePatientModal = () => {
    setEditingPatient(null);
    setPatientForm(emptyPatientForm);
    setIsPatientModalOpen(true);
  };

  const openEditPatientModal = (patient: Patient) => {
    setEditingPatient(patient);
    setPatientForm(getPatientForm(patient));
    setIsPatientModalOpen(true);
  };

  const handleSavePatient = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !patientForm.name.trim()) return;
    setIsSavingPatient(true);

    try {
      if (editingPatient) {
        await apiRequest<Patient>(token, `/api/patients/${editingPatient.id}`, {
          method: "PATCH",
          body: JSON.stringify(toPatientPayload(patientForm))
        });
        setMessage("Paciente atualizado.");
      } else {
        await apiRequest<Patient>(token, "/api/patients", {
          method: "POST",
          body: JSON.stringify(toPatientPayload(patientForm))
        });
        setMessage("Paciente criado.");
      }

      setIsPatientModalOpen(false);
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
              <label>
                <span>Status</span>
                <select aria-label="Filtrar por status" onChange={(event) => setDraftSelectedPatientStatus(event.target.value as PatientStatus | "")} value={draftSelectedPatientStatus}>
                  <option value="">Todos os status</option>
                  <option value="ACTIVE">Ativos</option>
                  <option value="INACTIVE">Inativos</option>
                </select>
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
              <th>Documentos</th>
              <th>Nascimento</th>
              <th>Status</th>
              <th>Atualização</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {patients.length === 0 ? (
              <tr>
                <td colSpan={6}>Nenhum paciente encontrado.</td>
              </tr>
            ) : (
              patients.map((patient) => {
                const nextStatus = patient.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
                const ToggleIcon = nextStatus === "ACTIVE" ? ToggleRight : ToggleLeft;
                const isInactive = patient.status === "INACTIVE";

                return (
                  <tr key={patient.id}>
                    <td><strong>{patient.name}</strong></td>
                    <td>{formatPatientDocuments(patient)}</td>
                    <td>{formatBirthDate(patient.birthDate)}</td>
                    <td>
                      <span className={`table-status ${isInactive ? "is-inactive" : "is-finalized"}`}>
                        {isInactive ? "Inativo" : "Ativo"}
                      </span>
                    </td>
                    <td>{formatDateTime(patient.updatedAt)}</td>
                    <td>
                      <div className="records-table-actions patients-table-actions">
                        {canUpdatePatients ? <button className="table-action" onClick={() => openEditPatientModal(patient)} type="button"><Edit3 aria-hidden="true" size={16} />Editar</button> : null}
                        {canInactivatePatients ? (
                          <button className="table-action" disabled={savingStatusPatientId === patient.id} onClick={() => setStatusConfirmation({ patient, nextStatus })} type="button">
                            <ToggleIcon aria-hidden="true" size={16} />{savingStatusPatientId === patient.id ? "Atualizando..." : nextStatus === "ACTIVE" ? "Ativar" : "Inativar"}
                          </button>
                        ) : null}
                        <button className="table-action" onClick={() => router.push(`/modulos/pacientes/${patient.id}`)} type="button"><Eye aria-hidden="true" size={16} />Informações adicionais</button>
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
              <label><span>Nome completo</span><input autoFocus onChange={(event) => setPatientForm((form) => ({ ...form, name: event.target.value }))} required value={patientForm.name} /></label>
              <label><span>Nascimento</span><input onChange={(event) => setPatientForm((form) => ({ ...form, birthDate: event.target.value }))} type="date" value={patientForm.birthDate} /></label>
              <label><span>CPF</span><input onChange={(event) => setPatientForm((form) => ({ ...form, cpf: event.target.value }))} placeholder="CPF" value={patientForm.cpf} /></label>
              <label><span>RG</span><input onChange={(event) => setPatientForm((form) => ({ ...form, rg: event.target.value }))} placeholder="RG" value={patientForm.rg} /></label>
              <label className="patient-form-full"><span>Documento complementar</span><input onChange={(event) => setPatientForm((form) => ({ ...form, document: event.target.value }))} placeholder="Outro documento" value={patientForm.document} /></label>
              <div className="confirmation-modal-actions patient-form-full">
                <button className="secondary-button" disabled={isSavingPatient} onClick={() => setIsPatientModalOpen(false)} type="button">Cancelar</button>
                <button className="primary-button" disabled={isSavingPatient || !patientForm.name.trim()} type="submit">{isSavingPatient ? "Salvando..." : "Salvar paciente"}</button>
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