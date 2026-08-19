"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Building2, CheckCircle2, Clock3, Save, UserRound, UserX, UsersRound, X } from "lucide-react";
import { ClearFiltersButton, FilterButton } from "@/components/filters/FilterActionButtons";
import { useAuth } from "@/features/auth/AuthProvider";

type Clinic = {
  id: string;
  name: string;
  code?: string | null;
  status: "ACTIVE" | "INACTIVE";
};

type AccessGroup = {
  id: string;
  name: string;
};

type AccessUser = {
  id: string;
  login: string;
  name: string;
  email?: string | null;
  userType: "MANAGER" | "PATIENT" | "NURSE" | "DOCTOR";
  professionalArea?: string | null;
  status: "PENDING" | "ACTIVE" | "INACTIVE";
  groups: { accessGroup: AccessGroup }[];
  clinics: { clinic: Clinic }[];
};

type PaginatedAccessUsers = {
  items: AccessUser[];
  limit: number;
  total: number;
};

type UserFilters = {
  search: string;
  clinicId: string;
  status: AccessUser["status"] | "";
  limit: number;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 100;
const SEARCH_DELAY_MS = 350;
const FILTERS_STORAGE_KEY = "clinica.access.user-clinic-assignments.filters";

function normalizeLimit(value: unknown) {
  const parsedLimit = Number(value);
  if (!Number.isFinite(parsedLimit)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(parsedLimit), 1), MAX_LIMIT);
}

function normalizeStatus(value: unknown): UserFilters["status"] {
  return value === "ACTIVE" || value === "PENDING" || value === "INACTIVE" ? value : "";
}

function readStoredFilters(): UserFilters {
  const fallback: UserFilters = { search: "", clinicId: "", status: "", limit: DEFAULT_LIMIT };
  if (typeof window === "undefined") return fallback;

  try {
    const storedFilters = window.localStorage.getItem(FILTERS_STORAGE_KEY);
    if (!storedFilters) return fallback;
    const parsedFilters = JSON.parse(storedFilters) as Partial<UserFilters>;

    return {
      search: typeof parsedFilters.search === "string" ? parsedFilters.search : "",
      clinicId: typeof parsedFilters.clinicId === "string" ? parsedFilters.clinicId : "",
      status: normalizeStatus(parsedFilters.status),
      limit: normalizeLimit(parsedFilters.limit)
    };
  } catch {
    window.localStorage.removeItem(FILTERS_STORAGE_KEY);
    return fallback;
  }
}

function buildUsersPath(filters: UserFilters) {
  const params = new URLSearchParams({ limit: String(filters.limit) });
  const search = filters.search.trim();
  if (search) params.set("search", search);
  if (filters.clinicId) params.set("clinicId", filters.clinicId);
  if (filters.status) params.set("status", filters.status);
  return `/api/access/users/clinic-assignments?${params.toString()}`;
}

function buildUsersCacheKey(filters: UserFilters) {
  return `${filters.limit}:${filters.search.trim().toLowerCase()}:${filters.clinicId}:${filters.status}`;
}

function getStatusBadge(status: AccessUser["status"]) {
  if (status === "ACTIVE") return { className: "is-active", icon: CheckCircle2, label: "Ativo" };
  if (status === "INACTIVE") return { className: "is-inactive", icon: UserX, label: "Inativo" };
  return { className: "is-pending", icon: Clock3, label: "Pendente" };
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
    throw new Error(payload?.message ?? "Não foi possível atualizar as clínicas do usuário.");
  }

  return response.json() as Promise<T>;
}

export function UserClinicAssignmentsPage() {
  const { hasPermission, token } = useAuth();
  const canManageUserClinics = hasPermission("access.users.clinics.manage");
  const usersCacheRef = useRef(new Map<string, PaginatedAccessUsers>());
  const clinicsCacheRef = useRef<Clinic[] | null>(null);
  const [initialFilters] = useState(readStoredFilters);
  const [filters, setFilters] = useState<UserFilters>(initialFilters);
  const [draftFilters, setDraftFilters] = useState<UserFilters>(initialFilters);
  const [debouncedSearch, setDebouncedSearch] = useState(initialFilters.search);
  const [users, setUsers] = useState<AccessUser[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [clinicDrafts, setClinicDrafts] = useState<Record<string, string[]>>({});
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUsersLoading, setIsUsersLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const clinicId = filters.clinicId;
  const limit = filters.limit;
  const status = filters.status;
  const activeFilterCount = [filters.search.trim(), filters.clinicId, filters.status, filters.limit !== DEFAULT_LIMIT ? String(filters.limit) : ""].filter(Boolean).length;
  const hasActiveFilters = activeFilterCount > 0;

  const applyUsersPage = useCallback((page: PaginatedAccessUsers) => {
    setUsers(page.items);
    setUserTotal(page.total);
    setClinicDrafts(Object.fromEntries(page.items.map((user) => [user.id, user.clinics.map(({ clinic }) => clinic.id)])));
  }, []);

  const fetchClinics = useCallback(async () => {
    if (!token) return [];
    if (clinicsCacheRef.current) return clinicsCacheRef.current;

    const nextClinics = await apiRequest<Clinic[]>(token, "/api/access/users/clinic-options");
    clinicsCacheRef.current = nextClinics;
    return nextClinics;
  }, [token]);

  const fetchUsers = useCallback(async (nextFilters: UserFilters, bypassCache = false) => {
    if (!token) return { items: [], limit: nextFilters.limit, total: 0 };

    const cacheKey = buildUsersCacheKey(nextFilters);
    const cachedPage = usersCacheRef.current.get(cacheKey);
    if (!bypassCache && cachedPage) return cachedPage;

    const page = await apiRequest<PaginatedAccessUsers>(token, buildUsersPath(nextFilters));
    usersCacheRef.current.set(cacheKey, page);
    return page;
  }, [token]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedSearch(filters.search), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timeoutId);
  }, [filters.search]);

  useEffect(() => {
    window.localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
  }, [filters]);

  useEffect(() => {
    if (!token || !canManageUserClinics) return;

    let isCurrent = true;
    const appliedFilters: UserFilters = { search: debouncedSearch, clinicId, status, limit };
    const cacheKey = buildUsersCacheKey(appliedFilters);
    const cachedPage = usersCacheRef.current.get(cacheKey);

    Promise.resolve().then(() => {
      if (!isCurrent) return;
      setIsUsersLoading(!cachedPage);
      if (!cachedPage) setIsLoading(true);
    });

    Promise.all([fetchClinics(), fetchUsers(appliedFilters)]).then(([nextClinics, page]) => {
      if (!isCurrent) return;
      setClinics(nextClinics);
      applyUsersPage(page);
      setIsLoading(false);
      setIsUsersLoading(false);
    }).catch((error) => {
      if (!isCurrent) return;
      setStatusMessage(error instanceof Error ? error.message : "Não foi possível carregar usuários e clínicas.");
      setIsLoading(false);
      setIsUsersLoading(false);
    });

    return () => {
      isCurrent = false;
    };
  }, [applyUsersPage, canManageUserClinics, clinicId, debouncedSearch, fetchClinics, fetchUsers, limit, status, token]);

  function openFilters() {
    setDraftFilters(filters);
    setIsFiltersOpen(true);
  }

  function applyFilters() {
    setFilters(draftFilters);
    setDebouncedSearch(draftFilters.search);
    setIsFiltersOpen(false);
  }

  function clearFilters() {
    const clearedFilters: UserFilters = { search: "", clinicId: "", status: "", limit: DEFAULT_LIMIT };
    setFilters(clearedFilters);
    setDraftFilters(clearedFilters);
    setDebouncedSearch("");
  }

  function toggleClinic(userId: string, clinicId: string) {
    setClinicDrafts((currentDrafts) => {
      const currentClinicIds = currentDrafts[userId] ?? [];
      return {
        ...currentDrafts,
        [userId]: currentClinicIds.includes(clinicId)
          ? currentClinicIds.filter((currentClinicId) => currentClinicId !== clinicId)
          : [...currentClinicIds, clinicId]
      };
    });
  }

  async function saveUserClinics(user: AccessUser) {
    if (!token) return;
    const clinicIds = clinicDrafts[user.id] ?? [];
    setSavingUserId(user.id);
    setStatusMessage(null);

    try {
      const updatedUser = await apiRequest<AccessUser>(token, `/api/access/users/${user.id}/clinics`, {
        method: "PATCH",
        body: JSON.stringify({ clinicIds })
      });
      usersCacheRef.current.clear();
      setUsers((currentUsers) => currentUsers.map((currentUser) => currentUser.id === updatedUser.id ? updatedUser : currentUser));
      setClinicDrafts((currentDrafts) => ({ ...currentDrafts, [updatedUser.id]: updatedUser.clinics.map(({ clinic }) => clinic.id) }));
      setStatusMessage(`Clínicas atualizadas para ${updatedUser.name}.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Não foi possível atualizar as clínicas do usuário.");
    } finally {
      setSavingUserId(null);
    }
  }

  if (!canManageUserClinics) {
    return (
      <section className="placeholder-page">
        <div className="page-intro">
          <div className="intro-icon" aria-hidden="true"><Building2 size={28} /></div>
          <div>
            <span className="eyebrow">Clínicas</span>
            <h2>Permissão necessária</h2>
            <p>Seu usuário não possui permissão para associar usuários às clínicas.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="access-page user-clinic-assignments-page">
      <div className="list-header">
        <div>
          <span className="eyebrow">Controle de acesso</span>
          <h2>Gerenciar usuários e clínicas</h2>
          <p>Associe cada usuário às clínicas nas quais ele pode acessar informações e executar atividades.</p>
        </div>
        <span className="status-badge"><UsersRound aria-hidden="true" size={17} />{userTotal} usuários</span>
      </div>

      {statusMessage ? <div className="access-message" role="status">{statusMessage}</div> : null}
      {isLoading ? <div className="loading-panel">Carregando usuários e clínicas...</div> : null}

      <div className="access-single-panel-layout">
        <section className="plain-panel access-users-panel">
          <div className="access-section-heading">
            <div className="access-section-title-row">
              <div>
                <h3>Associações de clínicas</h3>
                <p>{users.length} de {userTotal} usuários exibidos</p>
              </div>
              <div className="filter-actions-row">
                <FilterButton activeCount={activeFilterCount} onClick={openFilters} />
                <ClearFiltersButton disabled={!hasActiveFilters} onClick={clearFilters} />
              </div>
            </div>
          </div>

          {isFiltersOpen ? (
            <div className="filter-drawer-layer" role="presentation">
              <button aria-label="Fechar filtros" className="filter-drawer-backdrop" onClick={() => setIsFiltersOpen(false)} type="button" />
              <aside aria-label="Filtros de usuários e clínicas" className="filter-drawer-panel">
                <div className="filter-drawer-heading">
                  <span className="eyebrow">Filtros</span>
                  <button className="icon-button" onClick={() => setIsFiltersOpen(false)} title="Fechar filtros" type="button"><X aria-hidden="true" size={18} /></button>
                </div>
                <div className="filter-drawer-fields">
                  <label>
                    <span>Buscar usuário</span>
                    <input onChange={(event) => setDraftFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Nome, login ou e-mail" value={draftFilters.search} />
                  </label>
                  <label>
                    <span>Clínica associada</span>
                    <select onChange={(event) => setDraftFilters((current) => ({ ...current, clinicId: event.target.value }))} value={draftFilters.clinicId}>
                      <option value="">Todas as clínicas</option>
                      {clinics.map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.name}{clinic.code ? ` (${clinic.code})` : ""}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Status do usuário</span>
                    <select onChange={(event) => setDraftFilters((current) => ({ ...current, status: normalizeStatus(event.target.value) }))} value={draftFilters.status}>
                      <option value="">Todos os status</option>
                      <option value="ACTIVE">Ativos</option>
                      <option value="PENDING">Pendentes</option>
                      <option value="INACTIVE">Inativos</option>
                    </select>
                  </label>
                  <label>
                    <span>Usuários exibidos</span>
                    <input max={MAX_LIMIT} min={1} onChange={(event) => setDraftFilters((current) => ({ ...current, limit: normalizeLimit(event.target.value) }))} type="number" value={draftFilters.limit} />
                  </label>
                </div>
                <div className="filter-drawer-actions">
                  <ClearFiltersButton disabled={!hasActiveFilters} onClick={clearFilters} />
                  <button className="primary-button" onClick={applyFilters} type="button">Aplicar filtros</button>
                </div>
              </aside>
            </div>
          ) : null}

          {isUsersLoading ? <div className="inline-loading">Atualizando usuários...</div> : null}
          <div className={`access-user-list user-clinic-assignment-list ${isUsersLoading ? "is-loading" : ""}`}>
            {users.map((user) => {
              const statusBadge = getStatusBadge(user.status);
              const StatusIcon = statusBadge.icon;
              const selectedClinicIds = clinicDrafts[user.id] ?? [];
              const isSaving = savingUserId === user.id;

              return (
                <article className="access-card user-clinic-assignment-card" key={user.id}>
                  <div className="access-card-heading user-card-heading">
                    <div className="user-card-identity">
                      <strong>{user.name}</strong>
                      <span>{user.login}{user.email ? ` - ${user.email}` : ""}</span>
                    </div>
                    <span className={`status-badge user-status-badge ${statusBadge.className}`}><StatusIcon aria-hidden="true" size={16} />{statusBadge.label}</span>
                  </div>
                  <p className="user-clinic-assignment-meta"><UserRound aria-hidden="true" size={15} />{user.professionalArea || user.userType} · {user.groups.map(({ accessGroup }) => accessGroup.name).join(", ") || "Sem grupo"}</p>
                  <fieldset className="clinic-scope-picker">
                    <legend>Clínicas permitidas</legend>
                    <div className="access-checklist">
                      {clinics.map((clinic) => (
                        <label className="choice-pill" key={clinic.id} title={clinic.code ?? clinic.name}>
                          <input checked={selectedClinicIds.includes(clinic.id)} disabled={isSaving} onChange={() => toggleClinic(user.id, clinic.id)} type="checkbox" />
                          {clinic.name}{clinic.code ? ` (${clinic.code})` : ""}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <button className="primary-button user-clinic-save-button" disabled={isSaving} onClick={() => saveUserClinics(user)} type="button"><Save aria-hidden="true" size={17} />{isSaving ? "Salvando..." : "Salvar clínicas"}</button>
                </article>
              );
            })}
            {users.length === 0 ? <div className="empty-state">Nenhum usuário encontrado com os filtros atuais.</div> : null}
          </div>
        </section>
      </div>
    </section>
  );
}