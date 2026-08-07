"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Building2, ChevronLeft, ChevronRight, Edit3, Plus, ToggleLeft, ToggleRight, X } from "lucide-react";
import { ClearFiltersButton, FilterButton } from "@/components/filters/FilterActionButtons";
import { useAuth } from "@/features/auth/AuthProvider";

type ClinicStatus = "ACTIVE" | "INACTIVE";

type Clinic = {
  id: string;
  name: string;
  code?: string | null;
  document?: string | null;
  status: ClinicStatus;
  _count?: {
    accessGroups: number;
    patients: number;
    users: number;
  };
};

type ClinicFormState = {
  name: string;
  code: string;
  document: string;
};

type PaginatedClinics = {
  items: Clinic[];
  limit: number;
  page: number;
  total: number;
  totalPages: number;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
const DEFAULT_CLINIC_LIMIT = 5;
const MAX_CLINIC_LIMIT = 100;
const CLINIC_SEARCH_DELAY_MS = 350;

const emptyClinicForm: ClinicFormState = {
  name: "",
  code: "",
  document: ""
};

function normalizeClinicsPage(payload: PaginatedClinics | Clinic[], fallbackLimit: number, fallbackPage: number): PaginatedClinics {
  if (Array.isArray(payload)) {
    return { items: payload.slice(0, fallbackLimit), limit: fallbackLimit, page: fallbackPage, total: payload.length, totalPages: 1 };
  }

  return payload;
}

function normalizeClinicLimit(value: unknown) {
  const parsedLimit = Number(value);
  if (!Number.isFinite(parsedLimit)) return DEFAULT_CLINIC_LIMIT;
  return Math.min(Math.max(Math.trunc(parsedLimit), 1), MAX_CLINIC_LIMIT);
}

function normalizeClinicStatus(value: unknown): ClinicStatus | "ALL" {
  return value === "ACTIVE" || value === "INACTIVE" || value === "ALL" ? value : "ACTIVE";
}

function buildClinicsPath(limit: number, page: number, search: string, status: ClinicStatus | "ALL") {
  const params = new URLSearchParams({ limit: String(limit), page: String(page), status });
  const normalizedSearch = search.trim();
  if (normalizedSearch) params.set("search", normalizedSearch);
  return `/api/clinics?${params.toString()}`;
}

function buildClinicsCacheKey(limit: number, page: number, search: string, status: ClinicStatus | "ALL") {
  return `${limit}:${page}:${search.trim().toLowerCase()}:${status}`;
}

function getClinicForm(clinic: Clinic): ClinicFormState {
  return {
    name: clinic.name,
    code: clinic.code ?? "",
    document: clinic.document ?? ""
  };
}

function toClinicPayload(form: ClinicFormState) {
  return {
    name: form.name.trim(),
    code: form.code.trim() || undefined,
    document: form.document.trim() || undefined
  };
}

function formatClinicCounts(clinic: Clinic) {
  const counts = clinic._count;
  if (!counts) return "Sem vínculos carregados";
  return `${counts.users} usuários · ${counts.patients} pacientes · ${counts.accessGroups} grupos`;
}

function formatPageSummary(total: number, page: number, limit: number, count: number) {
  if (total === 0) return "0 clínicas";
  const start = (page - 1) * limit + 1;
  return `${start}-${start + count - 1} de ${total} clínicas`;
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
    throw new Error(payload?.message ?? "Não foi possível concluir a operação com clínicas.");
  }

  return response.json() as Promise<T>;
}

export function ClinicsAdminPage() {
  const { hasPermission, token } = useAuth();
  const canReadClinics = hasPermission("clinics.read");
  const canManageClinics = hasPermission("clinics.manage");
  const clinicsCacheRef = useRef(new Map<string, PaginatedClinics>());
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [clinicTotal, setClinicTotal] = useState(0);
  const [clinicLimit, setClinicLimit] = useState(DEFAULT_CLINIC_LIMIT);
  const [clinicPage, setClinicPage] = useState(1);
  const [clinicSearch, setClinicSearch] = useState("");
  const [debouncedClinicSearch, setDebouncedClinicSearch] = useState("");
  const [selectedClinicStatus, setSelectedClinicStatus] = useState<ClinicStatus | "ALL">("ACTIVE");
  const [draftClinicSearch, setDraftClinicSearch] = useState("");
  const [draftSelectedClinicStatus, setDraftSelectedClinicStatus] = useState<ClinicStatus | "ALL">("ACTIVE");
  const [draftClinicLimit, setDraftClinicLimit] = useState(DEFAULT_CLINIC_LIMIT);
  const [isClinicFiltersOpen, setIsClinicFiltersOpen] = useState(false);
  const [isClinicModalOpen, setIsClinicModalOpen] = useState(false);
  const [editingClinic, setEditingClinic] = useState<Clinic | null>(null);
  const [statusConfirmation, setStatusConfirmation] = useState<{ clinic: Clinic; nextStatus: ClinicStatus } | null>(null);
  const [clinicForm, setClinicForm] = useState<ClinicFormState>(emptyClinicForm);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClinicsLoading, setIsClinicsLoading] = useState(true);
  const [isSavingClinic, setIsSavingClinic] = useState(false);
  const [savingStatusClinicId, setSavingStatusClinicId] = useState<string | null>(null);

  const activeClinicFilterCount = [clinicSearch.trim(), selectedClinicStatus !== "ACTIVE" ? "status" : "", clinicLimit !== DEFAULT_CLINIC_LIMIT ? String(clinicLimit) : ""].filter(Boolean).length;
  const hasActiveClinicFilters = activeClinicFilterCount > 0;

  const applyClinicsPage = useCallback((nextClinicsPage: PaginatedClinics) => {
    setClinics(nextClinicsPage.items);
    setClinicTotal(nextClinicsPage.total);
    setClinicLimit(nextClinicsPage.limit);
  }, []);

  const fetchClinicsPage = useCallback(async (limit: number, page: number, search: string, status: ClinicStatus | "ALL", bypassCache = false) => {
    if (!token) return { items: [], limit, page, total: 0, totalPages: 1 };

    const cacheKey = buildClinicsCacheKey(limit, page, search, status);
    const cachedClinicsPage = clinicsCacheRef.current.get(cacheKey);
    if (!bypassCache && cachedClinicsPage) return cachedClinicsPage;

    const nextClinicsPayload = await apiRequest<PaginatedClinics | Clinic[]>(token, buildClinicsPath(limit, page, search, status));
    const nextClinicsPage = normalizeClinicsPage(nextClinicsPayload, limit, page);
    clinicsCacheRef.current.set(cacheKey, nextClinicsPage);
    return nextClinicsPage;
  }, [token]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedClinicSearch(clinicSearch);
      setClinicPage(1);
    }, CLINIC_SEARCH_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [clinicSearch]);

  useEffect(() => {
    if (!token || !canReadClinics) return;

    let isCurrent = true;
    const cacheKey = buildClinicsCacheKey(clinicLimit, clinicPage, debouncedClinicSearch, selectedClinicStatus);
    const cachedClinicsPage = clinicsCacheRef.current.get(cacheKey);

    Promise.resolve().then(() => {
      if (!isCurrent) return;
      setIsClinicsLoading(!cachedClinicsPage);
      if (!cachedClinicsPage) setIsLoading(true);
    });

    fetchClinicsPage(clinicLimit, clinicPage, debouncedClinicSearch, selectedClinicStatus).then((nextClinicsPage) => {
      if (!isCurrent) return;
      applyClinicsPage(nextClinicsPage);
      setIsClinicsLoading(false);
      setIsLoading(false);
    }).catch((error) => {
      if (!isCurrent) return;
      setMessage(error instanceof Error ? error.message : "Não foi possível carregar clínicas.");
      setIsClinicsLoading(false);
      setIsLoading(false);
    });

    return () => {
      isCurrent = false;
    };
  }, [token, canReadClinics, clinicLimit, clinicPage, debouncedClinicSearch, selectedClinicStatus, applyClinicsPage, fetchClinicsPage]);

  const refreshCurrentPage = async () => {
    if (!token) return;
    clinicsCacheRef.current.clear();
    const nextClinicsPage = await fetchClinicsPage(clinicLimit, clinicPage, debouncedClinicSearch, selectedClinicStatus, true);
    applyClinicsPage(nextClinicsPage);
  };

  const handleClearClinicFilters = () => {
    setClinicSearch("");
    setDebouncedClinicSearch("");
    setSelectedClinicStatus("ACTIVE");
    setClinicLimit(DEFAULT_CLINIC_LIMIT);
    setClinicPage(1);
    setDraftClinicSearch("");
    setDraftSelectedClinicStatus("ACTIVE");
    setDraftClinicLimit(DEFAULT_CLINIC_LIMIT);
  };

  const handleOpenClinicFilters = () => {
    setDraftClinicSearch(clinicSearch);
    setDraftSelectedClinicStatus(selectedClinicStatus);
    setDraftClinicLimit(clinicLimit);
    setIsClinicFiltersOpen(true);
  };

  const handleApplyClinicFilters = () => {
    setClinicSearch(draftClinicSearch);
    setDebouncedClinicSearch(draftClinicSearch);
    setSelectedClinicStatus(draftSelectedClinicStatus);
    setClinicLimit(normalizeClinicLimit(draftClinicLimit));
    setClinicPage(1);
    setIsClinicFiltersOpen(false);
  };

  const openCreateClinicModal = () => {
    setEditingClinic(null);
    setClinicForm(emptyClinicForm);
    setIsClinicModalOpen(true);
  };

  const openEditClinicModal = (clinic: Clinic) => {
    setEditingClinic(clinic);
    setClinicForm(getClinicForm(clinic));
    setIsClinicModalOpen(true);
  };

  const handleSaveClinic = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !clinicForm.name.trim()) return;
    setIsSavingClinic(true);

    try {
      if (editingClinic) {
        await apiRequest<Clinic>(token, `/api/clinics/${editingClinic.id}`, {
          method: "PATCH",
          body: JSON.stringify(toClinicPayload(clinicForm))
        });
        setMessage("Clínica atualizada.");
      } else {
        await apiRequest<Clinic>(token, "/api/clinics", {
          method: "POST",
          body: JSON.stringify(toClinicPayload(clinicForm))
        });
        setMessage("Clínica criada.");
      }

      setIsClinicModalOpen(false);
      setClinicForm(emptyClinicForm);
      await refreshCurrentPage();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar a clínica.");
    } finally {
      setIsSavingClinic(false);
    }
  };

  const handleConfirmStatusChange = async () => {
    if (!token || !statusConfirmation) return;
    const { clinic, nextStatus } = statusConfirmation;
    setSavingStatusClinicId(clinic.id);
    setIsClinicsLoading(true);

    try {
      await apiRequest<Clinic>(token, `/api/clinics/${clinic.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus })
      });
      await refreshCurrentPage();
      setStatusConfirmation(null);
      setMessage(nextStatus === "ACTIVE" ? "Clínica ativada." : "Clínica inativada.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível atualizar o status da clínica.");
    } finally {
      setSavingStatusClinicId(null);
      setIsClinicsLoading(false);
    }
  };

  if (!canReadClinics) {
    return (
      <section className="placeholder-page">
        <div className="page-intro">
          <div className="intro-icon" aria-hidden="true"><Building2 size={28} /></div>
          <div>
            <span className="eyebrow">Clínicas</span>
            <h2>Permissão necessária</h2>
            <p>Seu usuário não possui permissão para visualizar clínicas.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="list-page clinics-page">
      <div className="list-header">
        <div>
          <span className="eyebrow">Institucional</span>
          <h2>Clínicas</h2>
          <p>Cadastre unidades, acompanhe vínculos e controle quais clínicas permanecem ativas.</p>
        </div>
        <div className="list-actions">
          {canManageClinics ? <button className="primary-button" onClick={openCreateClinicModal} type="button"><Plus aria-hidden="true" size={16} />Nova clínica</button> : null}
        </div>
      </div>

      {message ? <div className="access-message">{message}</div> : null}
      {isLoading ? <div className="loading-panel">Carregando clínicas...</div> : null}

      <div className="list-toolbar">
        <div className="filter-actions-row">
          <FilterButton activeCount={activeClinicFilterCount} onClick={handleOpenClinicFilters} />
          <ClearFiltersButton disabled={!hasActiveClinicFilters} onClick={handleClearClinicFilters} />
        </div>
        <span>{isClinicsLoading ? "Atualizando clínicas..." : `${clinics.length} de ${clinicTotal} clínicas exibidas`}</span>
      </div>

      {isClinicFiltersOpen ? (
        <div className="filter-drawer-layer" role="presentation">
          <button aria-label="Fechar filtros" className="filter-drawer-backdrop" onClick={() => setIsClinicFiltersOpen(false)} type="button" />
          <aside aria-label="Filtros de clínicas" className="filter-drawer-panel">
            <div className="filter-drawer-heading">
              <div>
                <span className="eyebrow">Filtros</span>
                <h3>Filtrar clínicas</h3>
              </div>
              <button className="icon-button" onClick={() => setIsClinicFiltersOpen(false)} title="Fechar filtros" type="button"><X aria-hidden="true" size={18} /></button>
            </div>
            <div className="filter-drawer-fields">
              <label>
                <span>Buscar clínica</span>
                <input aria-label="Buscar clínica" onChange={(event) => setDraftClinicSearch(event.target.value)} placeholder="Nome, código ou documento" value={draftClinicSearch} />
              </label>
              <label>
                <span>Status</span>
                <select aria-label="Filtrar por status" onChange={(event) => setDraftSelectedClinicStatus(normalizeClinicStatus(event.target.value))} value={draftSelectedClinicStatus}>
                  <option value="ACTIVE">Ativas</option>
                  <option value="INACTIVE">Inativas</option>
                  <option value="ALL">Todos os status</option>
                </select>
              </label>
              <label>
                <span>Nº de clínicas exibidas</span>
                <input
                  max={MAX_CLINIC_LIMIT}
                  min={1}
                  onChange={(event) => setDraftClinicLimit(normalizeClinicLimit(event.target.value))}
                  type="number"
                  value={draftClinicLimit}
                />
              </label>
            </div>
            <div className="filter-drawer-actions">
              <ClearFiltersButton disabled={!hasActiveClinicFilters} onClick={handleClearClinicFilters} />
              <button className="primary-button" onClick={handleApplyClinicFilters} type="button">Aplicar filtros</button>
            </div>
          </aside>
        </div>
      ) : null}

      {isClinicsLoading ? <div className="inline-loading clinics-inline-loading">Atualizando clínicas...</div> : null}

      <div className={`records-table-shell ${isClinicsLoading ? "is-loading" : ""}`}>
        <table className="records-table clinics-table">
          <thead>
            <tr>
              <th>Clínica</th>
              <th>Código</th>
              <th>Documento</th>
              <th>Vínculos</th>
              <th>Status</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {clinics.length === 0 ? (
              <tr>
                <td colSpan={6}>Nenhuma clínica encontrada.</td>
              </tr>
            ) : (
              clinics.map((clinic) => {
                const nextStatus = clinic.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
                const ToggleIcon = nextStatus === "ACTIVE" ? ToggleRight : ToggleLeft;
                const isInactive = clinic.status === "INACTIVE";

                return (
                  <tr key={clinic.id}>
                    <td><strong>{clinic.name}</strong></td>
                    <td>{clinic.code || "-"}</td>
                    <td>{clinic.document || "-"}</td>
                    <td>{formatClinicCounts(clinic)}</td>
                    <td>
                      <span className={`table-status ${isInactive ? "is-inactive" : "is-finalized"}`}>
                        {isInactive ? "Inativa" : "Ativa"}
                      </span>
                    </td>
                    <td>
                      <div className="records-table-actions clinics-table-actions">
                        {canManageClinics ? <button className="table-action" onClick={() => openEditClinicModal(clinic)} type="button"><Edit3 aria-hidden="true" size={16} />Editar</button> : null}
                        {canManageClinics ? (
                          <button className="table-action" disabled={savingStatusClinicId === clinic.id} onClick={() => setStatusConfirmation({ clinic, nextStatus })} type="button">
                            <ToggleIcon aria-hidden="true" size={16} />{savingStatusClinicId === clinic.id ? "Atualizando..." : nextStatus === "ACTIVE" ? "Ativar" : "Inativar"}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination-bar" aria-label="Paginação de clínicas">
        <span>{isClinicsLoading ? "Atualizando clínicas..." : formatPageSummary(clinicTotal, clinicPage, clinicLimit, clinics.length)}</span>
        <div>
          <button disabled={isClinicsLoading || clinicPage === 1} onClick={() => setClinicPage((currentPage) => Math.max(1, currentPage - 1))} type="button"><ChevronLeft aria-hidden="true" size={15} />Anterior</button>
          <button disabled={isClinicsLoading || clinicPage * clinicLimit >= clinicTotal} onClick={() => setClinicPage((currentPage) => currentPage + 1)} type="button">Próxima<ChevronRight aria-hidden="true" size={15} /></button>
        </div>
      </div>

      {isClinicModalOpen ? (
        <div className="confirmation-modal-layer" role="presentation">
          <button aria-label="Cancelar edição de clínica" className="confirmation-modal-backdrop" onClick={() => setIsClinicModalOpen(false)} type="button" />
          <section aria-labelledby="clinic-modal-title" aria-modal="true" className="confirmation-modal-panel clinic-modal-panel" role="dialog">
            <div className="confirmation-modal-heading">
              <span className="confirmation-modal-icon is-primary"><Building2 aria-hidden="true" size={20} /></span>
              <div>
                <span className="eyebrow">Clínicas</span>
                <h3 id="clinic-modal-title">{editingClinic ? "Editar clínica" : "Nova clínica"}</h3>
              </div>
              <button className="icon-button" onClick={() => setIsClinicModalOpen(false)} title="Fechar" type="button"><X aria-hidden="true" size={18} /></button>
            </div>
            <form className="access-form clinic-form-grid" onSubmit={handleSaveClinic}>
              <label className="clinic-form-full"><span>Nome da clínica</span><input autoFocus onChange={(event) => setClinicForm((form) => ({ ...form, name: event.target.value }))} required value={clinicForm.name} /></label>
              <label><span>Código</span><input onChange={(event) => setClinicForm((form) => ({ ...form, code: event.target.value }))} placeholder="Ex.: MATRIZ" value={clinicForm.code} /></label>
              <label><span>Documento</span><input onChange={(event) => setClinicForm((form) => ({ ...form, document: event.target.value }))} placeholder="CNPJ ou documento interno" value={clinicForm.document} /></label>
              <div className="confirmation-modal-actions clinic-form-full">
                <button className="secondary-button" disabled={isSavingClinic} onClick={() => setIsClinicModalOpen(false)} type="button">Cancelar</button>
                <button className="primary-button" disabled={isSavingClinic || !clinicForm.name.trim()} type="submit">{isSavingClinic ? "Salvando..." : "Salvar clínica"}</button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {statusConfirmation ? (
        <div className="confirmation-modal-layer" role="presentation">
          <button aria-label="Cancelar alteração de status" className="confirmation-modal-backdrop" onClick={() => setStatusConfirmation(null)} type="button" />
          <section aria-labelledby="clinic-status-modal-title" aria-modal="true" className="confirmation-modal-panel" role="dialog">
            <div className="confirmation-modal-heading">
              <span className={`confirmation-modal-icon ${statusConfirmation.nextStatus === "ACTIVE" ? "is-primary" : "is-danger"}`}><Building2 aria-hidden="true" size={20} /></span>
              <div>
                <span className="eyebrow">Status institucional</span>
                <h3 id="clinic-status-modal-title">{statusConfirmation.nextStatus === "ACTIVE" ? "Ativar clínica?" : "Inativar clínica?"}</h3>
              </div>
            </div>
            <p>{statusConfirmation.nextStatus === "ACTIVE" ? `${statusConfirmation.clinic.name} voltará a aparecer nas listas de clínicas ativas.` : `${statusConfirmation.clinic.name} deixará de aparecer como clínica ativa para novas configurações e seleções.`}</p>
            <div className="confirmation-modal-actions">
              <button className="secondary-button" disabled={savingStatusClinicId === statusConfirmation.clinic.id} onClick={() => setStatusConfirmation(null)} type="button">Cancelar</button>
              <button className="primary-button" disabled={savingStatusClinicId === statusConfirmation.clinic.id} onClick={handleConfirmStatusChange} type="button">{savingStatusClinicId === statusConfirmation.clinic.id ? "Atualizando..." : statusConfirmation.nextStatus === "ACTIVE" ? "Ativar" : "Inativar"}</button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}