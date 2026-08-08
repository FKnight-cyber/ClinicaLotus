"use client";

import { ChevronLeft, ChevronRight, Eye, Filter, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import { createAnamneseRecord, deleteAnamneseDraftRecord, fetchAnamneseRecords, fetchAnamneseTemplates, fetchPatients, formatDateTime, getPatientName, requiredProgress } from "./storage";
import { anamneseTemplates as fallbackTemplates } from "./templates";
import { filterAnamneseTemplatesByPermissions } from "./templatePermissions";
import type { AnamneseRecord, FormTemplate, PatientSummary } from "./types";

const DEFAULT_PAGE_SIZE = 40;
const MAX_PAGE_SIZE = 100;
const ANAMNESE_FILTERS_STORAGE_KEY = "clinica.anamnese.filters";

type StatusFilter = "all" | "draft" | "finalized";
type RequiredFilter = "all" | "complete" | "pending";

type ListFilters = {
  patient: string;
  code: string;
  clinicId: string;
  status: StatusFilter;
  required: RequiredFilter;
  updatedFrom: string;
  updatedTo: string;
};

const emptyFilters: ListFilters = {
  patient: "",
  code: "",
  clinicId: "",
  status: "all",
  required: "all",
  updatedFrom: "",
  updatedTo: ""
};

function normalizeStatusFilter(value: unknown): StatusFilter {
  return value === "draft" || value === "finalized" ? value : "all";
}

function normalizeRequiredFilter(value: unknown): RequiredFilter {
  return value === "complete" || value === "pending" ? value : "all";
}

function normalizePageSize(value: unknown) {
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.max(Math.trunc(parsedValue), 1), MAX_PAGE_SIZE);
}

function readStoredAnamneseFilters() {
  const defaultState = { filters: emptyFilters, pageSize: DEFAULT_PAGE_SIZE };
  if (typeof window === "undefined") return defaultState;

  try {
    const storedFilters = window.localStorage.getItem(ANAMNESE_FILTERS_STORAGE_KEY);
    if (!storedFilters) return defaultState;
    const parsedFilters = JSON.parse(storedFilters) as Partial<Record<keyof ListFilters | "pageSize", unknown>>;

    return {
      filters: {
        patient: typeof parsedFilters.patient === "string" ? parsedFilters.patient : "",
        code: typeof parsedFilters.code === "string" ? parsedFilters.code : "",
        clinicId: typeof parsedFilters.clinicId === "string" ? parsedFilters.clinicId : "",
        status: normalizeStatusFilter(parsedFilters.status),
        required: normalizeRequiredFilter(parsedFilters.required),
        updatedFrom: typeof parsedFilters.updatedFrom === "string" ? parsedFilters.updatedFrom : "",
        updatedTo: typeof parsedFilters.updatedTo === "string" ? parsedFilters.updatedTo : ""
      },
      pageSize: normalizePageSize(parsedFilters.pageSize)
    };
  } catch {
    window.localStorage.removeItem(ANAMNESE_FILTERS_STORAGE_KEY);
    return defaultState;
  }
}

function writeStoredAnamneseFilters(filters: ListFilters, pageSize: number) {
  window.localStorage.setItem(ANAMNESE_FILTERS_STORAGE_KEY, JSON.stringify({ ...filters, pageSize }));
}

function buildAnamneseDetailHref(recordId: string, clinicId: string) {
  const params = new URLSearchParams();
  if (clinicId) params.set("clinicId", clinicId);
  const queryString = params.toString();
  return `/anamnese/${recordId}${queryString ? `?${queryString}` : ""}`;
}

function getClinicLabel(clinicId: string | null | undefined, clinics: Array<{ id: string; name: string; code?: string | null }>) {
  if (!clinicId) return "Não informada";
  const clinic = clinics.find((item) => item.id === clinicId);
  if (!clinic) return "Clínica fora do escopo";
  return clinic.code ? `${clinic.name} (${clinic.code})` : clinic.name;
}

export function AnamneseListPage() {
  const router = useRouter();
  const { clinics, hasPermission, token, user } = useAuth();
  const canReadAnamnese = hasPermission("anamnese.read");
  const canCreateAnamnese = hasPermission("anamnese.create");
  const canReadPatients = hasPermission("patients.read");
  const canDeleteDraftAnamnese = hasPermission("admin.full_access");
  const canFilterByClinic = hasPermission("anamnese.clinic_filter") && clinics.length > 1;
  const [initialFilters] = useState(readStoredAnamneseFilters);
  const [records, setRecords] = useState<AnamneseRecord[]>([]);
  const [templates, setTemplates] = useState<FormTemplate[]>(fallbackTemplates);
  const [filters, setFilters] = useState<ListFilters>(initialFilters.filters);
  const [recordPendingDeletion, setRecordPendingDeletion] = useState<AnamneseRecord | null>(null);
  const [isCreatePatientModalOpen, setIsCreatePatientModalOpen] = useState(false);
  const [createPatientSearch, setCreatePatientSearch] = useState("");
  const [debouncedCreatePatientSearch, setDebouncedCreatePatientSearch] = useState("");
  const [createPatients, setCreatePatients] = useState<PatientSummary[]>([]);
  const [selectedCreatePatientId, setSelectedCreatePatientId] = useState("");
  const [isCreatePatientsLoading, setIsCreatePatientsLoading] = useState(false);
  const [createPatientsError, setCreatePatientsError] = useState<string | null>(null);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [pageSize, setPageSize] = useState(initialFilters.pageSize);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingRecord, setIsCreatingRecord] = useState(false);
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);
  const [message, setMessage] = useState("Registros disponíveis para consulta");
  const effectiveAnamneseClinicId = canFilterByClinic && clinics.some((clinic) => clinic.id === filters.clinicId) ? filters.clinicId : "";

  useEffect(() => {
    writeStoredAnamneseFilters(filters, pageSize);
  }, [filters, pageSize]);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedCreatePatientSearch(createPatientSearch), 350);
    return () => clearTimeout(timeout);
  }, [createPatientSearch]);

  useEffect(() => {
    if (!token || !canReadAnamnese) return;
    let isCurrent = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);

    Promise.all([fetchAnamneseRecords(token, effectiveAnamneseClinicId), fetchAnamneseTemplates(token)])
      .then(([nextRecords, nextTemplates]) => {
        if (!isCurrent) return;
        setRecords(nextRecords);
        setTemplates(nextTemplates);
        setMessage("Registros carregados do banco");
      })
      .catch((error) => {
        if (!isCurrent) return;
        setMessage(error instanceof Error ? error.message : "Não foi possível carregar os registros.");
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [canReadAnamnese, effectiveAnamneseClinicId, token]);

  useEffect(() => {
    if (!token || !canReadPatients || !isCreatePatientModalOpen) return;
    let isCurrent = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsCreatePatientsLoading(true);
    setCreatePatientsError(null);

    fetchPatients(token, debouncedCreatePatientSearch, effectiveAnamneseClinicId || undefined)
      .then((nextPatients) => {
        if (!isCurrent) return;
        setCreatePatients(nextPatients);
        setSelectedCreatePatientId((currentId) => currentId && nextPatients.some((patient) => patient.id === currentId) ? currentId : nextPatients[0]?.id ?? "");
      })
      .catch((error) => {
        if (!isCurrent) return;
        setCreatePatients([]);
        setSelectedCreatePatientId("");
        const nextError = error instanceof Error ? error.message : "Não foi possível carregar os pacientes.";
        setCreatePatientsError(nextError);
        setMessage(nextError);
      })
      .finally(() => {
        if (isCurrent) setIsCreatePatientsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [canReadPatients, debouncedCreatePatientSearch, effectiveAnamneseClinicId, isCreatePatientModalOpen, token]);

  const userPermissions = useMemo(() => user?.permissions ?? [], [user?.permissions]);
  const visibleTemplates = useMemo(() => filterAnamneseTemplatesByPermissions(templates, userPermissions), [templates, userPermissions]);
  const selectedCreatePatient = useMemo(
    () => createPatients.find((patient) => patient.id === selectedCreatePatientId) ?? null,
    [createPatients, selectedCreatePatientId]
  );

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const progress = requiredProgress(record, visibleTemplates);
      const patientMatches = getPatientName(record).toLowerCase().includes(filters.patient.trim().toLowerCase());
      const codeMatches = record.code.toLowerCase().includes(filters.code.trim().toLowerCase());
      const statusMatches = filters.status === "all" || record.status === filters.status;
      const requiredMatches = filters.required === "all" || (filters.required === "complete" ? progress.complete === progress.total : progress.complete < progress.total);
      const updatedAt = record.updatedAt.slice(0, 10);
      const updatedFromMatches = !filters.updatedFrom || updatedAt >= filters.updatedFrom;
      const updatedToMatches = !filters.updatedTo || updatedAt <= filters.updatedTo;

      return patientMatches && codeMatches && statusMatches && requiredMatches && updatedFromMatches && updatedToMatches;
    });
  }, [filters, records, visibleTemplates]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRecords = filteredRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const activeFilterCount = Object.entries(filters).filter(([key, value]) => {
    if (key === "clinicId") return canFilterByClinic && Boolean(value);
    return key === "status" || key === "required" ? value !== "all" : Boolean(value);
  }).length + (pageSize !== DEFAULT_PAGE_SIZE ? 1 : 0);

  async function createRecord(patient: PatientSummary) {
    if (!token || isCreatingRecord || !canCreateAnamnese) return;
    setIsCreatingRecord(true);
    setMessage("Criando rascunho no banco...");
    try {
      const record = await createAnamneseRecord(token, { patientId: patient.id, patientName: patient.name });
      setRecords((currentRecords) => [record, ...currentRecords]);
      setIsCreatePatientModalOpen(false);
      setSelectedCreatePatientId("");
      setCreatePatientSearch("");
      router.push(buildAnamneseDetailHref(record.id, record.clinicId || ""));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível criar o rascunho.");
    } finally {
      setIsCreatingRecord(false);
    }
  }

  function handleCreateButtonClick() {
    if (!canCreateAnamnese) return;
    if (!canReadPatients) {
      setMessage("Seu perfil precisa da permissão de visualizar pacientes para criar a anamnese a partir do paciente.");
      return;
    }
    setCreatePatientSearch("");
    setDebouncedCreatePatientSearch("");
    setCreatePatients([]);
    setCreatePatientsError(null);
    setSelectedCreatePatientId("");
    setIsCreatePatientModalOpen(true);
  }

  async function confirmDeleteDraft() {
    if (!token || !canDeleteDraftAnamnese || !recordPendingDeletion || recordPendingDeletion.status !== "draft") return;

    setDeletingRecordId(recordPendingDeletion.id);
    try {
      await deleteAnamneseDraftRecord(token, recordPendingDeletion.id);
      setRecords((currentRecords) => currentRecords.filter((record) => record.id !== recordPendingDeletion.id));
      setMessage(`Rascunho ${recordPendingDeletion.code} excluído.`);
      setRecordPendingDeletion(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível excluir o rascunho.");
    } finally {
      setDeletingRecordId(null);
    }
  }

  function updateFilter<Key extends keyof ListFilters>(key: Key, value: ListFilters[Key]) {
    setFilters((currentFilters) => ({ ...currentFilters, [key]: value }));
    setPage(1);
  }

  function updatePageSize(value: unknown) {
    setPageSize(normalizePageSize(value));
    setPage(1);
  }

  function clearFilters() {
    setFilters(emptyFilters);
    setPageSize(DEFAULT_PAGE_SIZE);
    setPage(1);
    setMessage("Filtros limpos");
  }

  if (!canReadAnamnese) {
    return <div className="loading-panel">Você não possui permissão para visualizar anamneses.</div>;
  }

  if (isLoading) {
    return <div className="loading-panel">Carregando registros do banco...</div>;
  }

  return (
    <section className="list-page">
      <div className="list-header">
        <div>
          <span className="eyebrow">Anamnese</span>
          <h2>Registros de anamnese</h2>
          <p>Consulte rascunhos e anamneses finalizadas antes de abrir o preenchimento detalhado.</p>
        </div>
        {canCreateAnamnese ? (
          <div className="list-actions">
            <button className="primary-button" disabled={isCreatingRecord} onClick={handleCreateButtonClick} type="button">
              <Plus size={17} />
              {isCreatingRecord ? "Criando..." : "Nova anamnese"}
            </button>
          </div>
        ) : null}
      </div>

      <div className="list-toolbar">
        <div className="filter-actions">
          <button className="secondary-button" onClick={() => setIsFilterDrawerOpen(true)} type="button">
            <Filter size={17} />
            Filtros
            {activeFilterCount > 0 ? <span>{activeFilterCount}</span> : null}
          </button>
          <button className="secondary-button" onClick={clearFilters} type="button">
            <RotateCcw size={17} />
            Limpar filtros
          </button>
        </div>
        <span>{filteredRecords.length} de {records.length} registros exibidos. {message}</span>
      </div>

      {isFilterDrawerOpen ? (
        <div className="drawer-backdrop" role="presentation" onClick={() => setIsFilterDrawerOpen(false)}>
          <aside className="filter-drawer" aria-label="Filtros da listagem de anamnese" onClick={(event) => event.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <span className="eyebrow">Filtros</span>
                <h3>Filtrar registros</h3>
              </div>
              <button aria-label="Fechar filtros" onClick={() => setIsFilterDrawerOpen(false)} type="button">
                <X size={18} />
              </button>
            </div>

            <div className="drawer-fields">
              <label>
                <span>Paciente</span>
                <input onChange={(event) => updateFilter("patient", event.target.value)} placeholder="Nome do paciente" value={filters.patient} />
              </label>
              <label>
                <span>Código</span>
                <input onChange={(event) => updateFilter("code", event.target.value)} placeholder="Ex.: ANA-2026" value={filters.code} />
              </label>
              {canFilterByClinic ? (
                <label>
                  <span>Clínica</span>
                  <select onChange={(event) => updateFilter("clinicId", event.target.value)} value={filters.clinicId}>
                    <option value="">Todas as clínicas permitidas</option>
                    {clinics.map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.name}</option>)}
                  </select>
                </label>
              ) : null}
              <label>
                <span>Status</span>
                <select onChange={(event) => updateFilter("status", event.target.value as StatusFilter)} value={filters.status}>
                  <option value="all">Todos</option>
                  <option value="draft">Rascunho</option>
                  <option value="finalized">Finalizada</option>
                </select>
              </label>
              <label>
                <span>Obrigatórios</span>
                <select onChange={(event) => updateFilter("required", event.target.value as RequiredFilter)} value={filters.required}>
                  <option value="all">Todos</option>
                  <option value="complete">Completos</option>
                  <option value="pending">Pendentes</option>
                </select>
              </label>
              <label>
                <span>Atualização inicial</span>
                <input onChange={(event) => updateFilter("updatedFrom", event.target.value)} type="date" value={filters.updatedFrom} />
              </label>
              <label>
                <span>Atualização final</span>
                <input onChange={(event) => updateFilter("updatedTo", event.target.value)} type="date" value={filters.updatedTo} />
              </label>
              <label>
                <span>Nº de itens exibidos por página</span>
                <input
                  max={MAX_PAGE_SIZE}
                  min={1}
                  onChange={(event) => updatePageSize(event.target.value)}
                  type="number"
                  value={pageSize}
                />
              </label>
            </div>

            <div className="drawer-footer">
              <button className="secondary-button" onClick={clearFilters} type="button">
                <RotateCcw size={17} />
                Limpar filtros
              </button>
              <button className="primary-button" onClick={() => setIsFilterDrawerOpen(false)} type="button">
                Aplicar
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      {isCreatePatientModalOpen ? (
        <div className="confirmation-modal-layer" role="presentation">
          <button aria-label="Cancelar criação de anamnese" className="confirmation-modal-backdrop" onClick={() => setIsCreatePatientModalOpen(false)} type="button" />
          <section aria-labelledby="create-anamnesis-patient-title" aria-modal="true" className="confirmation-modal-panel" role="dialog">
            <div className="confirmation-modal-heading">
              <span className="confirmation-modal-icon is-primary"><Plus aria-hidden="true" size={20} /></span>
              <div>
                <span className="eyebrow">Anamnese</span>
                <h3 id="create-anamnesis-patient-title">Selecionar paciente</h3>
              </div>
            </div>
            <p>Escolha o paciente. A clínica da anamnese será definida automaticamente pela clínica atual dele.</p>
            {effectiveAnamneseClinicId ? <p>Busca limitada à clínica filtrada na listagem.</p> : null}
            <label>
              <span>Buscar paciente</span>
              <input onChange={(event) => setCreatePatientSearch(event.target.value)} placeholder="Nome, CPF, RG ou documento" value={createPatientSearch} />
            </label>
            <div className="create-anamnesis-patient-list">
              {isCreatePatientsLoading ? <span>Carregando pacientes...</span> : null}
              {!isCreatePatientsLoading && createPatientsError ? <span>{createPatientsError}</span> : null}
              {!isCreatePatientsLoading && !createPatientsError && createPatients.length > 0 ? createPatients.map((patient) => (
                <label className="choice-pill create-anamnesis-patient-option" key={patient.id}>
                  <input checked={selectedCreatePatientId === patient.id} name="create-anamnesis-patient" onChange={() => setSelectedCreatePatientId(patient.id)} type="radio" value={patient.id} />
                  <span>{patient.name}</span>
                </label>
              )) : null}
              {!isCreatePatientsLoading && !createPatientsError && createPatients.length === 0 ? <span>Nenhum paciente ativo encontrado.</span> : null}
            </div>
            <div className="confirmation-modal-actions">
              <button className="secondary-button" disabled={isCreatingRecord} onClick={() => setIsCreatePatientModalOpen(false)} type="button">Cancelar</button>
              <button className="primary-button" disabled={isCreatingRecord || !selectedCreatePatient || isCreatePatientsLoading} onClick={() => { if (selectedCreatePatient) void createRecord(selectedCreatePatient); }} type="button">{isCreatingRecord ? "Criando..." : "Criar anamnese"}</button>
            </div>
          </section>
        </div>
      ) : null}

      <div className="records-table-shell">
        <table className="records-table">
          <thead>
            <tr>
              <th>Paciente</th>
              <th>Clínica</th>
              <th>Código</th>
              <th>Status</th>
              <th>Obrigatórios</th>
              <th>Atualização</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {pageRecords.length === 0 ? (
              <tr>
                <td colSpan={7}>Nenhum registro encontrado.</td>
              </tr>
            ) : (
              pageRecords.map((record) => {
                const progress = requiredProgress(record, visibleTemplates);
                return (
                  <tr key={record.id}>
                    <td>
                      <strong>{getPatientName(record)}</strong>
                    </td>
                    <td>{getClinicLabel(record.clinicId, clinics)}</td>
                    <td>{record.code}</td>
                    <td>
                      <span className={`table-status ${record.status === "finalized" ? "is-finalized" : ""}`}>
                        {record.status === "finalized" ? "Finalizada" : "Rascunho"}
                      </span>
                    </td>
                    <td>{progress.complete}/{progress.total}</td>
                    <td>{formatDateTime(record.updatedAt)}</td>
                    <td>
                      <div className="records-table-actions">
                        <button className="table-action" onClick={() => router.push(buildAnamneseDetailHref(record.id, effectiveAnamneseClinicId || record.clinicId || ""))} type="button">
                          <Eye size={16} />
                          Abrir
                        </button>
                        {canDeleteDraftAnamnese && record.status === "draft" ? (
                          <button className="table-action is-danger" disabled={deletingRecordId === record.id} onClick={() => setRecordPendingDeletion(record)} type="button">
                            <Trash2 size={16} />
                            {deletingRecordId === record.id ? "Excluindo..." : "Excluir"}
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

      <div className="pagination-bar">
        <span>Página {currentPage} de {totalPages}</span>
        <div>
          <button disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button">
            <ChevronLeft size={16} />
            Anterior
          </button>
          <button disabled={currentPage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} type="button">
            Próxima
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {canDeleteDraftAnamnese && recordPendingDeletion ? (
        <div className="confirmation-modal-layer" role="presentation">
          <button aria-label="Cancelar exclusão de rascunho" className="confirmation-modal-backdrop" disabled={deletingRecordId === recordPendingDeletion.id} onClick={() => setRecordPendingDeletion(null)} type="button" />
          <section aria-labelledby="delete-anamnese-draft-title" aria-modal="true" className="confirmation-modal-panel" role="dialog">
            <div className="confirmation-modal-heading">
              <span className="confirmation-modal-icon is-danger"><Trash2 aria-hidden="true" size={20} /></span>
              <div>
                <span className="eyebrow">Confirmacao obrigatoria</span>
                <h3 id="delete-anamnese-draft-title">Excluir rascunho {recordPendingDeletion.code}?</h3>
              </div>
            </div>
            <p>Esta ação remove o rascunho de anamnese de {getPatientName(recordPendingDeletion)}. Anamneses finalizadas não podem ser excluídas.</p>
            <div className="confirmation-modal-actions">
              <button className="secondary-button" disabled={deletingRecordId === recordPendingDeletion.id} onClick={() => setRecordPendingDeletion(null)} type="button">Cancelar</button>
              <button className="danger-button" disabled={deletingRecordId === recordPendingDeletion.id} onClick={confirmDeleteDraft} type="button">
                {deletingRecordId === recordPendingDeletion.id ? "Excluindo..." : "Excluir rascunho"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
