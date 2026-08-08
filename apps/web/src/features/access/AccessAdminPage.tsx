"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Clock3, Eye, KeyRound, ShieldCheck, ToggleLeft, ToggleRight, Trash2, UserX, UsersRound, X, XCircle } from "lucide-react";
import Link from "next/link";
import { ClearFiltersButton, FilterButton } from "@/components/filters/FilterActionButtons";
import { useAuth } from "@/features/auth/AuthProvider";

type Permission = {
  id: string;
  key: string;
  module: string;
  action: string;
  description: string;
  active: boolean;
};

type AccessGroup = {
  id: string;
  name: string;
  description?: string | null;
  active: boolean;
  permissions: { permission: Permission }[];
  clinics: { clinic: Clinic }[];
  users: unknown[];
};

type Clinic = {
  id: string;
  name: string;
  code?: string | null;
  document?: string | null;
  status: "ACTIVE" | "INACTIVE";
};

type AccessUser = {
  id: string;
  login: string;
  name: string;
  email?: string | null;
  userType: "MANAGER" | "PATIENT" | "NURSE" | "DOCTOR";
  professionalArea?: string | null;
  status: "PENDING" | "ACTIVE" | "INACTIVE";
  mustChangePassword: boolean;
  groups: { accessGroup: AccessGroup }[];
  clinics: { clinic: Clinic }[];
};

type PaginatedAccessGroups = {
  items: AccessGroup[];
  limit: number;
  total: number;
};

type PaginatedAccessUsers = {
  items: AccessUser[];
  limit: number;
  total: number;
};

type PaginatedClinics = {
  items: Clinic[];
  limit: number;
  total: number;
};

type PasswordChangeRequestStatus = "PENDING" | "APPROVED" | "CANCELED";

type PasswordChangeRequest = {
  id: string;
  userId: string;
  status: PasswordChangeRequestStatus;
  requestedAt: string;
  reviewedAt?: string | null;
  user: {
    id: string;
    login: string;
    name: string;
    email?: string | null;
    status: AccessUser["status"];
  };
  reviewedBy?: {
    id: string;
    login: string;
    name: string;
  } | null;
};

type PaginatedPasswordChangeRequests = {
  items: PasswordChangeRequest[];
  limit: number;
  page: number;
  total: number;
  totalPages: number;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
const DEFAULT_GROUP_LIMIT = 40;
const DEFAULT_USER_LIMIT = 40;
const DEFAULT_PASSWORD_CHANGE_LIMIT = 40;
const MAX_GROUP_LIMIT = 100;
const MAX_USER_LIMIT = 100;
const MAX_PASSWORD_CHANGE_LIMIT = 100;
const GROUP_SEARCH_DELAY_MS = 350;
const USER_SEARCH_DELAY_MS = 350;
const PASSWORD_CHANGE_SEARCH_DELAY_MS = 350;
const USER_FILTERS_STORAGE_KEY = "clinica.access.users.filters";
const permissionModuleLabels: Record<string, string> = {
  access: "Controle de acesso",
  admin: "Administração",
  anamnese: "Anamnese",
  audit: "Auditoria",
  medical_evolutions: "Prontuário",
  menu: "Menu lateral",
  patients: "Pacientes",
  profile: "Perfil",
  prontuario: "Prontuário"
};
const permissionModuleOrder = ["Prontuário", "Pacientes", "Anamnese", "Perfil", "Controle de acesso", "Auditoria", "Menu lateral", "Administração"];

function getPermissionModuleLabel(module: string) {
  return permissionModuleLabels[module] ?? module;
}

function normalizeGroupsPage(payload: PaginatedAccessGroups | AccessGroup[], fallbackLimit: number): PaginatedAccessGroups {
  if (Array.isArray(payload)) {
    return { items: payload.slice(0, fallbackLimit), limit: fallbackLimit, total: payload.length };
  }

  return payload;
}

function normalizeUsersPage(payload: PaginatedAccessUsers | AccessUser[], fallbackLimit: number): PaginatedAccessUsers {
  if (Array.isArray(payload)) {
    return { items: payload.slice(0, fallbackLimit), limit: fallbackLimit, total: payload.length };
  }

  return payload;
}

function normalizeClinicsPage(payload: PaginatedClinics | Clinic[], fallbackLimit: number): PaginatedClinics {
  if (Array.isArray(payload)) {
    return { items: payload.slice(0, fallbackLimit), limit: fallbackLimit, total: payload.length };
  }

  return payload;
}

function normalizePasswordChangeRequestsPage(payload: PaginatedPasswordChangeRequests | PasswordChangeRequest[], fallbackLimit: number): PaginatedPasswordChangeRequests {
  if (Array.isArray(payload)) {
    return { items: payload.slice(0, fallbackLimit), limit: fallbackLimit, page: 1, total: payload.length, totalPages: 1 };
  }

  return payload;
}

function normalizeUserLimit(value: unknown) {
  const parsedLimit = Number(value);
  if (!Number.isFinite(parsedLimit)) return DEFAULT_USER_LIMIT;
  return Math.min(Math.max(Math.trunc(parsedLimit), 1), MAX_USER_LIMIT);
}

function normalizeUserStatus(value: unknown): AccessUser["status"] | "" {
  return value === "ACTIVE" || value === "PENDING" || value === "INACTIVE" ? value : "";
}

function readStoredUserFilters() {
  const defaultFilters = { search: "", groupId: "", clinicId: "", status: "" as AccessUser["status"] | "", limit: DEFAULT_USER_LIMIT };
  if (typeof window === "undefined") return defaultFilters;

  try {
    const storedFilters = window.localStorage.getItem(USER_FILTERS_STORAGE_KEY);
    if (!storedFilters) return defaultFilters;
    const parsedFilters = JSON.parse(storedFilters) as { search?: unknown; groupId?: unknown; clinicId?: unknown; status?: unknown; limit?: unknown };

    return {
      search: typeof parsedFilters.search === "string" ? parsedFilters.search : "",
      groupId: typeof parsedFilters.groupId === "string" ? parsedFilters.groupId : "",
      clinicId: typeof parsedFilters.clinicId === "string" ? parsedFilters.clinicId : "",
      status: normalizeUserStatus(parsedFilters.status),
      limit: normalizeUserLimit(parsedFilters.limit)
    };
  } catch {
    window.localStorage.removeItem(USER_FILTERS_STORAGE_KEY);
    return defaultFilters;
  }
}

function writeStoredUserFilters(search: string, groupId: string, clinicId: string, status: AccessUser["status"] | "", limit: number) {
  window.localStorage.setItem(USER_FILTERS_STORAGE_KEY, JSON.stringify({ search, groupId, clinicId, status, limit }));
}

function buildGroupsPath(limit: number, search: string) {
  const params = new URLSearchParams({ limit: String(limit) });
  const normalizedSearch = search.trim();
  if (normalizedSearch) params.set("search", normalizedSearch);
  return `/api/access/groups?${params.toString()}`;
}

function buildGroupsCacheKey(limit: number, search: string) {
  return `${limit}:${search.trim().toLowerCase()}`;
}

function buildUsersPath(limit: number, search: string, groupId: string, clinicId: string, status: string) {
  const params = new URLSearchParams({ limit: String(limit) });
  const normalizedSearch = search.trim();
  if (normalizedSearch) params.set("search", normalizedSearch);
  if (groupId) params.set("groupId", groupId);
  if (clinicId) params.set("clinicId", clinicId);
  if (status) params.set("status", status);
  return `/api/access/users?${params.toString()}`;
}

function buildUsersCacheKey(limit: number, search: string, groupId: string, clinicId: string, status: string) {
  return `${limit}:${search.trim().toLowerCase()}:${groupId}:${clinicId}:${status}`;
}

function buildClinicsPath() {
  return "/api/clinics?limit=100&status=ACTIVE";
}

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function buildPasswordChangeRequestsPath(limit: number, page: number, search: string, status: PasswordChangeRequestStatus | "ALL") {
  const params = new URLSearchParams({ limit: String(limit), page: String(page), status });
  const normalizedSearch = search.trim();
  if (normalizedSearch) params.set("search", normalizedSearch);
  return `/api/access/password-change-requests?${params.toString()}`;
}

function buildPasswordChangeRequestsCacheKey(limit: number, page: number, search: string, status: PasswordChangeRequestStatus | "ALL") {
  return `${limit}:${page}:${search.trim().toLowerCase()}:${status}`;
}

function getUserStatusBadge(status: string) {
  if (status === "ACTIVE") return { className: "is-active", icon: CheckCircle2, label: "Ativo" };
  if (status === "INACTIVE") return { className: "is-inactive", icon: UserX, label: "Inativo" };
  return { className: "is-pending", icon: Clock3, label: "Pendente" };
}

function getPasswordChangeStatusBadge(status: PasswordChangeRequestStatus) {
  if (status === "APPROVED") return { className: "is-finalized", label: "Aprovado" };
  if (status === "CANCELED") return { className: "is-canceled", label: "Cancelado" };
  return { className: "", label: "Pendente" };
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function getUserStatusConfirmation(user: AccessUser, nextStatus: AccessUser["status"]) {
  if (nextStatus === "INACTIVE") {
    return {
      title: `Inativar ${user.name}?`,
       actionLabel: "Inativar usuário",
       tone: "danger",
       message: "Ao inativar este usuário, ele deixará de aparecer nos demais pontos do sistema, incluindo anamnese e qualquer outra funcionalidade que dependa de usuários ativos. O acesso dele também ficará bloqueado até que seja ativado novamente."
    };
  }

  return {
    title: `Ativar ${user.name}?`,
    actionLabel: "Ativar usuário",
    tone: "primary",
    message: "Ao ativar este usuário, ele voltará a aparecer nas telas e fluxos que exibem usuários ativos, incluindo anamnese e demais funcionalidades do sistema, e poderá acessar os recursos permitidos pelos grupos vinculados."
  };
}

function getPasswordChangeConfirmation(request: PasswordChangeRequest, action: "approve" | "cancel") {
  if (action === "approve") {
    return {
      title: `Aprovar alteração de senha de ${request.user.name}?`,
      actionLabel: "Aprovar alteração",
      tone: "primary" as const,
      message: "Ao aprovar, a nova senha solicitada passa a valer imediatamente para o próximo login do usuário."
    };
  }

  return {
    title: `Cancelar alteração de senha de ${request.user.name}?`,
    actionLabel: "Cancelar pedido",
    tone: "danger" as const,
    message: "Ao cancelar, a senha atual do usuário permanece inalterada."
  };
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
      throw new Error(payload?.message ?? "Não foi possível atualizar os acessos.");
  }

  return response.json() as Promise<T>;
}

export function AccessGroupsPage() {
  const { hasPermission, token } = useAuth();
  const canManageGroups = hasPermission("access.groups.manage");
  const permissionsCacheRef = useRef<Permission[] | null>(null);
  const clinicsCacheRef = useRef<Clinic[] | null>(null);
  const groupsCacheRef = useRef(new Map<string, PaginatedAccessGroups>());
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [groups, setGroups] = useState<AccessGroup[]>([]);
  const [groupTotal, setGroupTotal] = useState(0);
  const [groupLimit, setGroupLimit] = useState(DEFAULT_GROUP_LIMIT);
  const [groupDrafts, setGroupDrafts] = useState<Record<string, string[]>>({});
  const [groupClinicDrafts, setGroupClinicDrafts] = useState<Record<string, string[]>>({});
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [groupSearch, setGroupSearch] = useState("");
  const [debouncedGroupSearch, setDebouncedGroupSearch] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGroupsLoading, setIsGroupsLoading] = useState(true);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [savingGroupId, setSavingGroupId] = useState<string | null>(null);

  const permissionsByModule = useMemo(() => {
    return permissions.reduce<Record<string, Permission[]>>((accumulator, permission) => {
      const moduleLabel = getPermissionModuleLabel(permission.module);
      accumulator[moduleLabel] = [...(accumulator[moduleLabel] ?? []), permission];
      return accumulator;
    }, {});
  }, [permissions]);

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? groups[0] ?? null;

  const applyGroupsPage = useCallback((nextGroupsPage: PaginatedAccessGroups) => {
    setGroups(nextGroupsPage.items);
    setGroupTotal(nextGroupsPage.total);
    setGroupLimit(nextGroupsPage.limit);
    setGroupDrafts(Object.fromEntries(
      nextGroupsPage.items.map((group) => [group.id, group.permissions.map((item) => item.permission.key)])
    ));
    setGroupClinicDrafts(Object.fromEntries(
      nextGroupsPage.items.map((group) => [group.id, group.clinics.map((item) => item.clinic.id)])
    ));
    setSelectedGroupId((currentGroupId) => currentGroupId && nextGroupsPage.items.some((group) => group.id === currentGroupId) ? currentGroupId : nextGroupsPage.items[0]?.id ?? null);
  }, []);

  const fetchPermissions = useCallback(async () => {
    if (!token) return [];
    if (permissionsCacheRef.current) return permissionsCacheRef.current;

    const nextPermissions = await apiRequest<Permission[]>(token, "/api/access/permissions");
    permissionsCacheRef.current = nextPermissions;
    return nextPermissions;
  }, [token]);

  const fetchClinics = useCallback(async () => {
    if (!token) return [];
    if (clinicsCacheRef.current) return clinicsCacheRef.current;

    const nextClinicsPayload = await apiRequest<PaginatedClinics | Clinic[]>(token, buildClinicsPath());
    const nextClinicsPage = normalizeClinicsPage(nextClinicsPayload, 100);
    clinicsCacheRef.current = nextClinicsPage.items;
    return nextClinicsPage.items;
  }, [token]);

  const fetchGroupsPage = useCallback(async (limit: number, search: string, bypassCache = false) => {
    if (!token) return { items: [], limit, total: 0 };

    const cacheKey = buildGroupsCacheKey(limit, search);
    const cachedGroupsPage = groupsCacheRef.current.get(cacheKey);
    if (!bypassCache && cachedGroupsPage) return cachedGroupsPage;

    const nextGroupsPayload = await apiRequest<PaginatedAccessGroups | AccessGroup[]>(token, buildGroupsPath(limit, search));
    const nextGroupsPage = normalizeGroupsPage(nextGroupsPayload, limit);
    groupsCacheRef.current.set(cacheKey, nextGroupsPage);
    return nextGroupsPage;
  }, [token]);

  const loadAccessData = async (limit = groupLimit, search = groupSearch) => {
    if (!token) return;
    setIsLoading(true);
    setIsGroupsLoading(true);
    const [nextPermissions, nextClinics, nextGroupsPage] = await Promise.all([fetchPermissions(), fetchClinics(), fetchGroupsPage(limit, search, true)]);

    setPermissions(nextPermissions);
    setClinics(nextClinics);
    applyGroupsPage(nextGroupsPage);
    setIsGroupsLoading(false);
    setIsLoading(false);
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedGroupSearch(groupSearch);
    }, GROUP_SEARCH_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [groupSearch]);

  useEffect(() => {
    if (!token) return;

    let isCurrent = true;
    const cacheKey = buildGroupsCacheKey(groupLimit, debouncedGroupSearch);
    const cachedGroupsPage = groupsCacheRef.current.get(cacheKey);

    Promise.resolve().then(() => {
      if (!isCurrent) return;
      setIsGroupsLoading(!cachedGroupsPage);
      if (!permissionsCacheRef.current) setIsLoading(true);
    });

    Promise.all([fetchPermissions(), fetchClinics(), fetchGroupsPage(groupLimit, debouncedGroupSearch)]).then(([nextPermissions, nextClinics, nextGroupsPage]) => {
      if (!isCurrent) return;
      setPermissions(nextPermissions);
      setClinics(nextClinics);
      applyGroupsPage(nextGroupsPage);
      setIsGroupsLoading(false);
      setIsLoading(false);
    }).catch((error) => {
      if (!isCurrent) return;
      setStatusMessage(error instanceof Error ? error.message : "Não foi possível carregar os acessos.");
      setIsLoading(false);
    });

    return () => {
      isCurrent = false;
    };
  }, [token, groupLimit, debouncedGroupSearch, applyGroupsPage, fetchClinics, fetchGroupsPage, fetchPermissions]);

  const handleCreateGroup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !canManageGroups || !newGroupName.trim()) return;

    setIsCreatingGroup(true);
    try {
      const createdGroup = await apiRequest<AccessGroup>(token, "/api/access/groups", {
        method: "POST",
        body: JSON.stringify({
          name: newGroupName.trim(),
          description: newGroupDescription.trim() || undefined
        })
      });
      groupsCacheRef.current.clear();
      setNewGroupName("");
      setNewGroupDescription("");
      setSelectedGroupId(createdGroup.id);
      setGroupSearch("");
      setDebouncedGroupSearch("");
      const nextLimit = Math.min(MAX_GROUP_LIMIT, Math.max(groupLimit, groupTotal + 1));
      setStatusMessage("Grupo criado com sucesso.");
      await loadAccessData(nextLimit, "");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Não foi possível criar o grupo.");
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const handleToggleGroupPermission = async (groupId: string, permissionKey: string) => {
    if (!token || !canManageGroups) return;

    const previousPermissionKeys = groupDrafts[groupId] ?? [];
    const nextPermissionKeys = toggleValue(previousPermissionKeys, permissionKey);
    setGroupDrafts((current) => ({ ...current, [groupId]: nextPermissionKeys }));
    setSavingGroupId(groupId);

    await apiRequest<AccessGroup>(token, `/api/access/groups/${groupId}/permissions`, {
      method: "PATCH",
      body: JSON.stringify({ permissionKeys: nextPermissionKeys })
    }).then((updatedGroup) => {
      groupsCacheRef.current.clear();
      setGroups((currentGroups) => currentGroups.map((group) => group.id === updatedGroup.id ? updatedGroup : group));
      setGroupDrafts((current) => ({
        ...current,
        [updatedGroup.id]: updatedGroup.permissions.map((item) => item.permission.key)
      }));
      setStatusMessage("Permissões do grupo atualizadas.");
    }).catch((error) => {
      setGroupDrafts((current) => ({ ...current, [groupId]: previousPermissionKeys }));
      setStatusMessage(error instanceof Error ? error.message : "Não foi possível atualizar as permissões.");
    }).finally(() => {
      setSavingGroupId((currentGroupId) => currentGroupId === groupId ? null : currentGroupId);
    });
  };

  const handleToggleGroupClinic = async (groupId: string, clinicId: string) => {
    if (!token || !canManageGroups) return;

    const previousClinicIds = groupClinicDrafts[groupId] ?? [];
    const nextClinicIds = toggleValue(previousClinicIds, clinicId);
    setGroupClinicDrafts((current) => ({ ...current, [groupId]: nextClinicIds }));
    setSavingGroupId(groupId);

    await apiRequest<AccessGroup>(token, `/api/access/groups/${groupId}/clinics`, {
      method: "PATCH",
      body: JSON.stringify({ clinicIds: nextClinicIds })
    }).then((updatedGroup) => {
      groupsCacheRef.current.clear();
      setGroups((currentGroups) => currentGroups.map((group) => group.id === updatedGroup.id ? updatedGroup : group));
      setGroupClinicDrafts((current) => ({
        ...current,
        [updatedGroup.id]: updatedGroup.clinics.map((item) => item.clinic.id)
      }));
      setStatusMessage("Clínicas do grupo atualizadas.");
    }).catch((error) => {
      setGroupClinicDrafts((current) => ({ ...current, [groupId]: previousClinicIds }));
      setStatusMessage(error instanceof Error ? error.message : "Não foi possível atualizar as clínicas do grupo.");
    }).finally(() => {
      setSavingGroupId((currentGroupId) => currentGroupId === groupId ? null : currentGroupId);
    });
  };

  if (!hasPermission("access.groups.read")) {
    return (
      <section className="placeholder-page">
        <div className="page-intro">
          <div className="intro-icon" aria-hidden="true"><ShieldCheck size={28} /></div>
          <div>
            <span className="eyebrow">Acessos</span>
            <h2>Permissão necessária</h2>
             <p>Seu usuário não possui permissão para gerenciar grupos e permissões.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="access-page">
      <div className="list-header">
        <div>
            <span className="eyebrow">Administração</span>
          <h2>Grupos e acessos</h2>
          <p>Configure permissões por grupo. As mudanças são salvas automaticamente ao marcar ou desmarcar uma permissão.</p>
        </div>
        <span className="status-badge"><ShieldCheck aria-hidden="true" size={17} />{permissions.length} permissões</span>
      </div>

      {statusMessage ? <div className="access-message">{statusMessage}</div> : null}
      {isLoading ? <div className="loading-panel">Carregando acessos...</div> : null}

      <div className="access-groups-layout">
        <section className="plain-panel access-groups-panel">
          <h3>Grupos</h3>
          {canManageGroups ? (
            <form className="access-form compact-form" onSubmit={handleCreateGroup}>
              <label><span>Novo grupo</span><input disabled={isCreatingGroup} onChange={(event) => setNewGroupName(event.target.value)} placeholder="Nome do grupo" required value={newGroupName} /></label>
                <label><span>Descrição</span><input disabled={isCreatingGroup} onChange={(event) => setNewGroupDescription(event.target.value)} placeholder="Opcional" value={newGroupDescription} /></label>
              <button className="primary-button" disabled={isCreatingGroup} type="submit"><ShieldCheck aria-hidden="true" size={17} />{isCreatingGroup ? "Criando..." : "Criar grupo"}</button>
            </form>
          ) : null}

          <div className="access-search-box">
            <input onChange={(event) => setGroupSearch(event.target.value)} placeholder="Buscar grupo" value={groupSearch} />
            <label className="access-limit-field">
              <span>Nº de Grupos exibidos</span>
              <input
                max={MAX_GROUP_LIMIT}
                min={1}
                onChange={(event) => setGroupLimit(Math.min(Math.max(Number(event.target.value) || DEFAULT_GROUP_LIMIT, 1), MAX_GROUP_LIMIT))}
                type="number"
                value={groupLimit}
              />
            </label>
            <span>{groups.length} de {groupTotal} grupos</span>
          </div>

          {isGroupsLoading ? <div className="inline-loading">Atualizando grupos...</div> : null}
          <div className={`group-directory ${isGroupsLoading ? "is-loading" : ""}`} aria-label="Grupos cadastrados">
            {groups.map((group) => {
              const permissionCount = groupDrafts[group.id]?.length ?? 0;
              const clinicCount = groupClinicDrafts[group.id]?.length ?? 0;
              const isSelected = selectedGroup?.id === group.id;

              return (
                <button className={`group-directory-item ${isSelected ? "is-selected" : ""}`} key={group.id} onClick={() => setSelectedGroupId(group.id)} type="button">
                  <strong>{group.name}</strong>
                  <span>{group.description || "Sem descrição"}</span>
                  <small>{permissionCount} permissões · {clinicCount} clínicas</small>
                </button>
              );
            })}
            {groups.length === 0 ? <div className="empty-state">Nenhum grupo encontrado.</div> : null}
          </div>
        </section>

        <section className="plain-panel access-permissions-panel">
          <div className="access-card-heading">
            <div>
              <h3>{selectedGroup ? selectedGroup.name : "Selecione um grupo"}</h3>
              <p>{savingGroupId === selectedGroup?.id ? "Salvando alterações..." : selectedGroup?.description || "Escolha um grupo para revisar permissões e clínicas liberadas."}</p>
            </div>
          </div>
          {selectedGroup ? (
            <div className="group-access-editor">
              <ClinicScopePicker
                canManageGroups={canManageGroups}
                clinics={clinics}
                isSaving={savingGroupId === selectedGroup.id}
                selected={groupClinicDrafts[selectedGroup.id] ?? []}
                onToggle={(clinicId) => handleToggleGroupClinic(selectedGroup.id, clinicId)}
              />
              <PermissionPicker
                canManageGroups={canManageGroups}
                isSaving={savingGroupId === selectedGroup.id}
                permissionsByModule={permissionsByModule}
                selected={groupDrafts[selectedGroup.id] ?? []}
                onToggle={(permissionKey) => handleToggleGroupPermission(selectedGroup.id, permissionKey)}
              />
            </div>
          ) : null}
        </section>
      </div>
    </section>
  );
}

export function AccessUsersAdminPage() {
  const { hasPermission, token, user: sessionUser } = useAuth();
  const canManageUsers = hasPermission("access.users.manage");
  const usersCacheRef = useRef(new Map<string, PaginatedAccessUsers>());
  const userGroupsCacheRef = useRef<AccessGroup[] | null>(null);
  const userClinicsCacheRef = useRef<Clinic[] | null>(null);
  const [initialUserFilters] = useState(readStoredUserFilters);
  const [users, setUsers] = useState<AccessUser[]>([]);
  const [userGroups, setUserGroups] = useState<AccessGroup[]>([]);
  const [userClinics, setUserClinics] = useState<Clinic[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [userLimit, setUserLimit] = useState(initialUserFilters.limit);
  const [userSearch, setUserSearch] = useState(initialUserFilters.search);
  const [debouncedUserSearch, setDebouncedUserSearch] = useState(initialUserFilters.search);
  const [selectedUserGroupId, setSelectedUserGroupId] = useState(initialUserFilters.groupId);
  const [selectedUserClinicId, setSelectedUserClinicId] = useState(initialUserFilters.clinicId);
  const [selectedUserStatus, setSelectedUserStatus] = useState<AccessUser["status"] | "">(initialUserFilters.status);
  const [draftUserLimit, setDraftUserLimit] = useState(initialUserFilters.limit);
  const [draftUserSearch, setDraftUserSearch] = useState(initialUserFilters.search);
  const [draftSelectedUserGroupId, setDraftSelectedUserGroupId] = useState(initialUserFilters.groupId);
  const [draftSelectedUserClinicId, setDraftSelectedUserClinicId] = useState(initialUserFilters.clinicId);
  const [draftSelectedUserStatus, setDraftSelectedUserStatus] = useState<AccessUser["status"] | "">(initialUserFilters.status);
  const [isUserFiltersOpen, setIsUserFiltersOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUsersLoading, setIsUsersLoading] = useState(true);
  const [savingUserStatusId, setSavingUserStatusId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [statusConfirmation, setStatusConfirmation] = useState<{ user: AccessUser; nextStatus: AccessUser["status"] } | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<AccessUser | null>(null);

  const pendingUsersCount = users.filter((user) => user.status === "PENDING").length;
  const activeUserFilterCount = [userSearch.trim(), selectedUserGroupId, selectedUserClinicId, selectedUserStatus, userLimit !== DEFAULT_USER_LIMIT ? String(userLimit) : ""].filter(Boolean).length;
  const hasActiveUserFilters = activeUserFilterCount > 0;

  const applyUsersPage = useCallback((nextUsersPage: PaginatedAccessUsers) => {
    setUsers(nextUsersPage.items);
    setUserTotal(nextUsersPage.total);
    setUserLimit(nextUsersPage.limit);
  }, []);

  const fetchUserGroups = useCallback(async () => {
    if (!token) return [];
    if (userGroupsCacheRef.current) return userGroupsCacheRef.current;

    const nextGroupsPayload = await apiRequest<PaginatedAccessGroups | AccessGroup[]>(token, "/api/access/groups?limit=100");
    const nextGroupsPage = normalizeGroupsPage(nextGroupsPayload, 100);
    userGroupsCacheRef.current = nextGroupsPage.items;
    return nextGroupsPage.items;
  }, [token]);

  const fetchUserClinics = useCallback(async () => {
    if (!token) return [];
    if (userClinicsCacheRef.current) return userClinicsCacheRef.current;

    const nextClinicsPayload = await apiRequest<PaginatedClinics | Clinic[]>(token, buildClinicsPath());
    const nextClinicsPage = normalizeClinicsPage(nextClinicsPayload, 100);
    userClinicsCacheRef.current = nextClinicsPage.items;
    return nextClinicsPage.items;
  }, [token]);

  const fetchUsersPage = useCallback(async (limit: number, search: string, groupId: string, clinicId: string, status: string, bypassCache = false) => {
    if (!token) return { items: [], limit, total: 0 };

    const cacheKey = buildUsersCacheKey(limit, search, groupId, clinicId, status);
    const cachedUsersPage = usersCacheRef.current.get(cacheKey);
    if (!bypassCache && cachedUsersPage) return cachedUsersPage;

    const nextUsersPayload = await apiRequest<PaginatedAccessUsers | AccessUser[]>(token, buildUsersPath(limit, search, groupId, clinicId, status));
    const nextUsersPage = normalizeUsersPage(nextUsersPayload, limit);
    usersCacheRef.current.set(cacheKey, nextUsersPage);
    return nextUsersPage;
  }, [token]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedUserSearch(userSearch);
    }, USER_SEARCH_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [userSearch]);

  useEffect(() => {
    writeStoredUserFilters(userSearch, selectedUserGroupId, selectedUserClinicId, selectedUserStatus, userLimit);
  }, [selectedUserClinicId, selectedUserGroupId, selectedUserStatus, userLimit, userSearch]);

  useEffect(() => {
    if (!token) return;

    let isCurrent = true;
    const cacheKey = buildUsersCacheKey(userLimit, debouncedUserSearch, selectedUserGroupId, selectedUserClinicId, selectedUserStatus);
    const cachedUsersPage = usersCacheRef.current.get(cacheKey);

    Promise.resolve().then(() => {
      if (!isCurrent) return;
      setIsUsersLoading(!cachedUsersPage);
      if (!cachedUsersPage) setIsLoading(true);
    });

    Promise.all([fetchUserGroups(), fetchUserClinics(), fetchUsersPage(userLimit, debouncedUserSearch, selectedUserGroupId, selectedUserClinicId, selectedUserStatus)]).then(([nextGroups, nextClinics, nextUsersPage]) => {
      if (!isCurrent) return;
      setUserGroups(nextGroups);
      setUserClinics(nextClinics);
      applyUsersPage(nextUsersPage);
      setIsUsersLoading(false);
      setIsLoading(false);
    }).catch((error) => {
      if (!isCurrent) return;
      setStatusMessage(error instanceof Error ? error.message : "Não foi possível carregar os usuários.");
      setIsLoading(false);
    });

    return () => {
      isCurrent = false;
    };
  }, [token, userLimit, debouncedUserSearch, selectedUserGroupId, selectedUserClinicId, selectedUserStatus, applyUsersPage, fetchUserClinics, fetchUserGroups, fetchUsersPage]);

  const handleClearUserFilters = () => {
    setUserSearch("");
    setDebouncedUserSearch("");
    setSelectedUserGroupId("");
    setSelectedUserClinicId("");
    setSelectedUserStatus("");
    setUserLimit(DEFAULT_USER_LIMIT);
    setDraftUserSearch("");
    setDraftSelectedUserGroupId("");
    setDraftSelectedUserClinicId("");
    setDraftSelectedUserStatus("");
    setDraftUserLimit(DEFAULT_USER_LIMIT);
  };

  const handleOpenUserFilters = () => {
    setDraftUserSearch(userSearch);
    setDraftSelectedUserGroupId(selectedUserGroupId);
    setDraftSelectedUserClinicId(selectedUserClinicId);
    setDraftSelectedUserStatus(selectedUserStatus);
    setDraftUserLimit(userLimit);
    setIsUserFiltersOpen(true);
  };

  const handleApplyUserFilters = () => {
    setUserSearch(draftUserSearch);
    setDebouncedUserSearch(draftUserSearch);
    setSelectedUserGroupId(draftSelectedUserGroupId);
    setSelectedUserClinicId(draftSelectedUserClinicId);
    setSelectedUserStatus(draftSelectedUserStatus);
    setUserLimit(draftUserLimit);
    setIsUserFiltersOpen(false);
  };

  const handleRequestUserStatusChange = (user: AccessUser) => {
    const nextStatus = user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setStatusConfirmation({ user, nextStatus });
  };

  const handleConfirmUserStatusChange = async () => {
    if (!token || !statusConfirmation || !canManageUsers) return;

    const { nextStatus, user } = statusConfirmation;
    setSavingUserStatusId(user.id);
    setIsUsersLoading(true);

    try {
      await apiRequest<AccessUser>(token, `/api/access/users/${user.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus })
      });
      usersCacheRef.current.clear();
      const nextUsersPage = await fetchUsersPage(userLimit, debouncedUserSearch, selectedUserGroupId, selectedUserClinicId, selectedUserStatus, true);
      applyUsersPage(nextUsersPage);
      setStatusConfirmation(null);
      setStatusMessage(nextStatus === "ACTIVE" ? "Usuário ativado e disponível nos fluxos do sistema." : "Usuário inativado e removido dos fluxos operacionais do sistema.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Não foi possível atualizar o status do usuário.");
    } finally {
      setSavingUserStatusId(null);
      setIsUsersLoading(false);
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (!token || !deleteConfirmation || !canManageUsers) return;

    setDeletingUserId(deleteConfirmation.id);
    setIsUsersLoading(true);

    try {
      await apiRequest<{ id: string }>(token, `/api/access/users/${deleteConfirmation.id}`, {
        method: "DELETE"
      });
      usersCacheRef.current.clear();
      const nextUsersPage = await fetchUsersPage(userLimit, debouncedUserSearch, selectedUserGroupId, selectedUserClinicId, selectedUserStatus, true);
      applyUsersPage(nextUsersPage);
      setStatusMessage("Usuário excluído.");
      setDeleteConfirmation(null);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Não foi possível excluir o usuário.");
    } finally {
      setDeletingUserId(null);
      setIsUsersLoading(false);
    }
  };

  if (!hasPermission("access.users.read")) {
    return (
      <section className="placeholder-page">
        <div className="page-intro">
          <div className="intro-icon" aria-hidden="true"><UsersRound size={28} /></div>
          <div>
            <span className="eyebrow">Usuários</span>
            <h2>Permissão necessária</h2>
            <p>Seu usuário não possui permissão para visualizar usuários e solicitações.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="access-page">
      <div className="list-header">
        <div>
          <span className="eyebrow">Administração</span>
          <h2>Gerenciar usuários</h2>
          <p>Acompanhe solicitações, status e vínculos de grupos de cada usuário.</p>
        </div>
        <div className="access-summary-badges">
          <span className="status-badge"><UsersRound aria-hidden="true" size={17} />{userTotal} usuários</span>
          {pendingUsersCount > 0 ? <span className="status-badge">{pendingUsersCount} pendentes na lista</span> : null}
        </div>
      </div>

      {statusMessage ? <div className="access-message">{statusMessage}</div> : null}
      {isLoading ? <div className="loading-panel">Carregando usuários...</div> : null}

      <div className="access-single-panel-layout">
        <section className="plain-panel access-users-panel">
          <div className="access-section-heading">
            <div className="access-section-title-row">
              <div>
                <h3>Usuários e solicitações</h3>
                <p>{users.length} de {userTotal} usuários exibidos</p>
              </div>
              <div className="filter-actions-row">
                <FilterButton activeCount={activeUserFilterCount} onClick={handleOpenUserFilters} />
                <ClearFiltersButton disabled={!hasActiveUserFilters} onClick={handleClearUserFilters} />
              </div>
            </div>
          </div>
          {isUserFiltersOpen ? (
            <div className="filter-drawer-layer" role="presentation">
              <button aria-label="Fechar filtros" className="filter-drawer-backdrop" onClick={() => setIsUserFiltersOpen(false)} type="button" />
              <aside aria-label="Filtros de usuários" className="filter-drawer-panel">
                <div className="filter-drawer-heading">
                  <div>
                    <span className="eyebrow">Filtros</span>
                  </div>
                  <button className="icon-button" onClick={() => setIsUserFiltersOpen(false)} title="Fechar filtros" type="button"><X aria-hidden="true" size={18} /></button>
                </div>
                <div className="filter-drawer-fields">
                  <label>
                    <span>Buscar usuário</span>
                    <input aria-label="Buscar usuário" onChange={(event) => setDraftUserSearch(event.target.value)} placeholder="Nome, login ou email" value={draftUserSearch} />
                  </label>
                  <label>
                    <span>Grupo</span>
                    <select aria-label="Filtrar por grupo" onChange={(event) => setDraftSelectedUserGroupId(event.target.value)} value={draftSelectedUserGroupId}>
                      <option value="">Todos os grupos</option>
                      {userGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Clínica</span>
                    <select aria-label="Filtrar por clínica" onChange={(event) => setDraftSelectedUserClinicId(event.target.value)} value={draftSelectedUserClinicId}>
                      <option value="">Todas as clínicas</option>
                      {userClinics.map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.name}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Status</span>
                    <select aria-label="Filtrar por status" onChange={(event) => setDraftSelectedUserStatus(normalizeUserStatus(event.target.value))} value={draftSelectedUserStatus}>
                      <option value="">Todos os status</option>
                      <option value="ACTIVE">Ativos</option>
                      <option value="PENDING">Pendentes</option>
                      <option value="INACTIVE">Inativos</option>
                    </select>
                  </label>
                  <label>
                    <span>Nº de usuários exibidos</span>
                    <input
                      max={MAX_USER_LIMIT}
                      min={1}
                      onChange={(event) => setDraftUserLimit(normalizeUserLimit(event.target.value))}
                      type="number"
                      value={draftUserLimit}
                    />
                  </label>
                </div>
                <div className="filter-drawer-actions">
                  <ClearFiltersButton disabled={!hasActiveUserFilters} onClick={handleClearUserFilters} />
                  <button className="primary-button" onClick={handleApplyUserFilters} type="button">Aplicar filtros</button>
                </div>
              </aside>
            </div>
          ) : null}
          {isUsersLoading ? <div className="inline-loading">Atualizando usuários...</div> : null}
          <div className={`access-user-list ${isUsersLoading ? "is-loading" : ""}`}>
            {users.map((listedUser) => (
              <UserCard
                canManageUsers={canManageUsers}
                isCurrentUser={listedUser.id === (sessionUser?.id ?? "")}
                isDeleting={deletingUserId === listedUser.id}
                isSavingStatus={savingUserStatusId === listedUser.id}
                key={listedUser.id}
                onRequestDeleteUser={() => setDeleteConfirmation(listedUser)}
                onRequestStatusChange={handleRequestUserStatusChange}
                user={listedUser}
              />
            ))}
            {users.length === 0 ? <div className="empty-state">Nenhum usuário encontrado.</div> : null}
          </div>
        </section>
      </div>
      {statusConfirmation ? (
        <UserStatusConfirmationModal
          isSaving={savingUserStatusId === statusConfirmation.user.id}
          nextStatus={statusConfirmation.nextStatus}
          onCancel={() => setStatusConfirmation(null)}
          onConfirm={handleConfirmUserStatusChange}
          user={statusConfirmation.user}
        />
      ) : null}
      {deleteConfirmation ? (
        <UserDeleteConfirmationModal
          isSaving={deletingUserId === deleteConfirmation.id}
          onCancel={() => setDeleteConfirmation(null)}
          onConfirm={handleConfirmDeleteUser}
          user={deleteConfirmation}
        />
      ) : null}
    </section>
  );
}

export function PasswordChangeRequestsPage() {
  const { hasPermission, token } = useAuth();
  const canManagePasswordChanges = hasPermission("access.password_changes.manage");
  const requestsCacheRef = useRef(new Map<string, PaginatedPasswordChangeRequests>());
  const [requests, setRequests] = useState<PasswordChangeRequest[]>([]);
  const [requestTotal, setRequestTotal] = useState(0);
  const [requestLimit, setRequestLimit] = useState(DEFAULT_PASSWORD_CHANGE_LIMIT);
  const [requestPage, setRequestPage] = useState(1);
  const [requestTotalPages, setRequestTotalPages] = useState(1);
  const [requestSearch, setRequestSearch] = useState("");
  const [debouncedRequestSearch, setDebouncedRequestSearch] = useState("");
  const [requestStatus, setRequestStatus] = useState<PasswordChangeRequestStatus | "ALL">("PENDING");
  const [draftRequestSearch, setDraftRequestSearch] = useState("");
  const [draftRequestStatus, setDraftRequestStatus] = useState<PasswordChangeRequestStatus | "ALL">("PENDING");
  const [draftRequestLimit, setDraftRequestLimit] = useState(DEFAULT_PASSWORD_CHANGE_LIMIT);
  const [isRequestFiltersOpen, setIsRequestFiltersOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRequestsLoading, setIsRequestsLoading] = useState(true);
  const [reviewingRequestId, setReviewingRequestId] = useState<string | null>(null);
  const [reviewConfirmation, setReviewConfirmation] = useState<{ request: PasswordChangeRequest; action: "approve" | "cancel" } | null>(null);

  const pendingRequestsCount = requests.filter((request) => request.status === "PENDING").length;
  const activeRequestFilterCount = [requestSearch.trim(), requestStatus !== "PENDING" ? requestStatus : "", requestLimit !== DEFAULT_PASSWORD_CHANGE_LIMIT ? String(requestLimit) : ""].filter(Boolean).length;
  const hasActiveRequestFilters = activeRequestFilterCount > 0;

  const applyRequestsPage = useCallback((nextRequestsPage: PaginatedPasswordChangeRequests) => {
    setRequests(nextRequestsPage.items);
    setRequestTotal(nextRequestsPage.total);
    setRequestLimit(nextRequestsPage.limit);
    setRequestPage(nextRequestsPage.page);
    setRequestTotalPages(nextRequestsPage.totalPages);
  }, []);

  const fetchRequestsPage = useCallback(async (limit: number, page: number, search: string, status: PasswordChangeRequestStatus | "ALL", bypassCache = false) => {
    if (!token) return { items: [], limit, page, total: 0, totalPages: 1 };

    const cacheKey = buildPasswordChangeRequestsCacheKey(limit, page, search, status);
    const cachedRequestsPage = requestsCacheRef.current.get(cacheKey);
    if (!bypassCache && cachedRequestsPage) return cachedRequestsPage;

    const nextRequestsPayload = await apiRequest<PaginatedPasswordChangeRequests | PasswordChangeRequest[]>(token, buildPasswordChangeRequestsPath(limit, page, search, status));
    const nextRequestsPage = normalizePasswordChangeRequestsPage(nextRequestsPayload, limit);
    requestsCacheRef.current.set(cacheKey, nextRequestsPage);
    return nextRequestsPage;
  }, [token]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedRequestSearch(requestSearch);
      setRequestPage(1);
    }, PASSWORD_CHANGE_SEARCH_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [requestSearch]);

  useEffect(() => {
    if (!token) return;

    let isCurrent = true;
    const cacheKey = buildPasswordChangeRequestsCacheKey(requestLimit, requestPage, debouncedRequestSearch, requestStatus);
    const cachedRequestsPage = requestsCacheRef.current.get(cacheKey);

    Promise.resolve().then(() => {
      if (!isCurrent) return;
      setIsRequestsLoading(!cachedRequestsPage);
      if (!cachedRequestsPage) setIsLoading(true);
    });

    fetchRequestsPage(requestLimit, requestPage, debouncedRequestSearch, requestStatus).then((nextRequestsPage) => {
      if (!isCurrent) return;
      applyRequestsPage(nextRequestsPage);
      setIsRequestsLoading(false);
      setIsLoading(false);
    }).catch((error) => {
      if (!isCurrent) return;
      setStatusMessage(error instanceof Error ? error.message : "Não foi possível carregar os pedidos de alteração de senha.");
      setIsLoading(false);
    });

    return () => {
      isCurrent = false;
    };
  }, [token, requestLimit, requestPage, debouncedRequestSearch, requestStatus, applyRequestsPage, fetchRequestsPage]);

  const handleClearRequestFilters = () => {
    setRequestSearch("");
    setDebouncedRequestSearch("");
    setRequestStatus("PENDING");
    setRequestLimit(DEFAULT_PASSWORD_CHANGE_LIMIT);
    setRequestPage(1);
    setDraftRequestSearch("");
    setDraftRequestStatus("PENDING");
    setDraftRequestLimit(DEFAULT_PASSWORD_CHANGE_LIMIT);
  };

  const handleOpenRequestFilters = () => {
    setDraftRequestSearch(requestSearch);
    setDraftRequestStatus(requestStatus);
    setDraftRequestLimit(requestLimit);
    setIsRequestFiltersOpen(true);
  };

  const handleApplyRequestFilters = () => {
    setRequestSearch(draftRequestSearch);
    setDebouncedRequestSearch(draftRequestSearch);
    setRequestStatus(draftRequestStatus);
    setRequestLimit(draftRequestLimit);
    setRequestPage(1);
    setIsRequestFiltersOpen(false);
  };

  const handleConfirmReview = async () => {
    if (!token || !reviewConfirmation || !canManagePasswordChanges) return;

    const { action, request } = reviewConfirmation;
    setReviewingRequestId(request.id);
    setIsRequestsLoading(true);

    try {
      await apiRequest<PasswordChangeRequest>(token, `/api/access/password-change-requests/${request.id}/${action}`, { method: "PATCH" });
      requestsCacheRef.current.clear();
      const nextRequestsPage = await fetchRequestsPage(requestLimit, requestPage, debouncedRequestSearch, requestStatus, true);
      applyRequestsPage(nextRequestsPage);
      setReviewConfirmation(null);
      setStatusMessage(action === "approve" ? "Alteração de senha aprovada." : "Pedido de alteração de senha cancelado.");
      window.dispatchEvent(new Event("clinica:password-change-requests-updated"));
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Não foi possível analisar o pedido de alteração de senha.");
    } finally {
      setReviewingRequestId(null);
      setIsRequestsLoading(false);
    }
  };

  if (!hasPermission("access.password_changes.read")) {
    return (
      <section className="placeholder-page">
        <div className="page-intro">
          <div className="intro-icon" aria-hidden="true"><KeyRound size={28} /></div>
          <div>
            <span className="eyebrow">Senhas</span>
            <h2>Permissão necessária</h2>
            <p>Seu usuário não possui permissão para visualizar pedidos de alteração de senha.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="access-page">
      <div className="list-header">
        <div>
          <span className="eyebrow">Administração</span>
          <h2>Gerenciar alteração de senhas</h2>
          <p>Acompanhe pedidos enviados pela tela de login e aprove ou cancele a troca solicitada.</p>
        </div>
        <div className="access-summary-badges">
          <span className="status-badge"><KeyRound aria-hidden="true" size={17} />{requestTotal} pedidos</span>
          {pendingRequestsCount > 0 ? <span className="status-badge">{pendingRequestsCount} pendentes na lista</span> : null}
        </div>
      </div>

      {statusMessage ? <div className="access-message">{statusMessage}</div> : null}
      {isLoading ? <div className="loading-panel">Carregando pedidos...</div> : null}

      <div className="access-single-panel-layout">
        <section className="plain-panel access-users-panel">
          <div className="access-section-heading password-change-heading">
            <div className="access-section-title-row">
              <div>
                <h3>Pedidos de alteração</h3>
                <p>{requests.length} de {requestTotal} pedidos exibidos</p>
              </div>
              <div className="filter-actions-row">
                <FilterButton activeCount={activeRequestFilterCount} onClick={handleOpenRequestFilters} />
                <ClearFiltersButton disabled={!hasActiveRequestFilters} onClick={handleClearRequestFilters} />
              </div>
            </div>
          </div>
          {isRequestFiltersOpen ? (
            <div className="filter-drawer-layer" role="presentation">
              <button aria-label="Fechar filtros" className="filter-drawer-backdrop" onClick={() => setIsRequestFiltersOpen(false)} type="button" />
              <aside aria-label="Filtros de pedidos de alteração de senha" className="filter-drawer-panel">
                <div className="filter-drawer-heading">
                  <div>
                    <span className="eyebrow">Filtros</span>
                  </div>
                  <button className="icon-button" onClick={() => setIsRequestFiltersOpen(false)} title="Fechar filtros" type="button"><X aria-hidden="true" size={18} /></button>
                </div>
                <div className="filter-drawer-fields">
                  <label>
                    <span>Buscar pedido</span>
                    <input aria-label="Buscar pedido" onChange={(event) => setDraftRequestSearch(event.target.value)} placeholder="Nome, login ou email" value={draftRequestSearch} />
                  </label>
                  <label>
                    <span>Status</span>
                    <select aria-label="Filtrar por status" onChange={(event) => setDraftRequestStatus(event.target.value as PasswordChangeRequestStatus | "ALL")} value={draftRequestStatus}>
                      <option value="PENDING">Pendentes</option>
                      <option value="APPROVED">Aprovados</option>
                      <option value="CANCELED">Cancelados</option>
                      <option value="ALL">Todos</option>
                    </select>
                  </label>
                  <label>
                    <span>Nº de pedidos exibidos</span>
                    <input
                      max={MAX_PASSWORD_CHANGE_LIMIT}
                      min={1}
                      onChange={(event) => setDraftRequestLimit(Math.min(Math.max(Number(event.target.value) || DEFAULT_PASSWORD_CHANGE_LIMIT, 1), MAX_PASSWORD_CHANGE_LIMIT))}
                      type="number"
                      value={draftRequestLimit}
                    />
                  </label>
                </div>
                <div className="filter-drawer-actions">
                  <ClearFiltersButton disabled={!hasActiveRequestFilters} onClick={handleClearRequestFilters} />
                  <button className="primary-button" onClick={handleApplyRequestFilters} type="button">Aplicar filtros</button>
                </div>
              </aside>
            </div>
          ) : null}
          {isRequestsLoading ? <div className="inline-loading">Atualizando pedidos...</div> : null}
          <div className={`records-table-shell ${isRequestsLoading ? "is-loading" : ""}`}>
            <table className="records-table password-change-table">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Login</th>
                  <th>Status</th>
                  <th>Solicitação</th>
                  <th>Análise</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 ? (
                  <tr>
                    <td colSpan={6}>Nenhum pedido encontrado.</td>
                  </tr>
                ) : (
                  requests.map((request) => {
                    const statusBadge = getPasswordChangeStatusBadge(request.status);
                    const isPending = request.status === "PENDING";

                    return (
                      <tr key={request.id}>
                        <td><strong>{request.user.name}</strong></td>
                        <td>{request.user.login}{request.user.email ? ` - ${request.user.email}` : ""}</td>
                        <td><span className={`table-status ${statusBadge.className}`}>{statusBadge.label}</span></td>
                        <td>{formatDateTime(request.requestedAt)}</td>
                        <td>{request.reviewedAt ? `${formatDateTime(request.reviewedAt)} por ${request.reviewedBy?.name ?? "usuário removido"}` : "-"}</td>
                        <td>
                          {canManagePasswordChanges && isPending ? (
                            <div className="records-table-actions password-change-table-actions">
                              <button className="table-action is-primary" disabled={reviewingRequestId === request.id} onClick={() => setReviewConfirmation({ request, action: "approve" })} type="button">
                                <CheckCircle2 aria-hidden="true" size={16} />
                                {reviewingRequestId === request.id ? "Salvando..." : "Aprovar"}
                              </button>
                              <button className="table-action is-danger" disabled={reviewingRequestId === request.id} onClick={() => setReviewConfirmation({ request, action: "cancel" })} type="button">
                                <XCircle aria-hidden="true" size={16} />
                                Cancelar
                              </button>
                            </div>
                          ) : "-"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {requestTotalPages > 1 ? (
            <div className="password-change-pagination">
              <button className="secondary-button" disabled={requestPage <= 1 || isRequestsLoading} onClick={() => setRequestPage((current) => Math.max(1, current - 1))} type="button">Anterior</button>
              <span>Página {requestPage} de {requestTotalPages}</span>
              <button className="secondary-button" disabled={requestPage >= requestTotalPages || isRequestsLoading} onClick={() => setRequestPage((current) => Math.min(requestTotalPages, current + 1))} type="button">Próxima</button>
            </div>
          ) : null}
        </section>
      </div>
      {reviewConfirmation ? (
        <PasswordChangeReviewModal
          action={reviewConfirmation.action}
          isSaving={reviewingRequestId === reviewConfirmation.request.id}
          onCancel={() => setReviewConfirmation(null)}
          onConfirm={handleConfirmReview}
          request={reviewConfirmation.request}
        />
      ) : null}
    </section>
  );
}

function PasswordChangeReviewModal({
  action,
  isSaving,
  onCancel,
  onConfirm,
  request
}: {
  action: "approve" | "cancel";
  isSaving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  request: PasswordChangeRequest;
}) {
  const confirmation = getPasswordChangeConfirmation(request, action);
  const ConfirmationIcon = action === "approve" ? CheckCircle2 : XCircle;

  return (
    <div className="confirmation-modal-layer" role="presentation">
      <button aria-label="Cancelar análise de alteração de senha" className="confirmation-modal-backdrop" disabled={isSaving} onClick={onCancel} type="button" />
      <section aria-labelledby="password-change-confirmation-title" aria-modal="true" className="confirmation-modal-panel" role="dialog">
        <div className="confirmation-modal-heading">
          <span className={`confirmation-modal-icon is-${confirmation.tone}`}><ConfirmationIcon aria-hidden="true" size={20} /></span>
          <div>
            <span className="eyebrow">Confirmação obrigatória</span>
            <h3 id="password-change-confirmation-title">{confirmation.title}</h3>
          </div>
        </div>
        <p>{confirmation.message}</p>
        <div className="confirmation-modal-actions">
          <button className="secondary-button" disabled={isSaving} onClick={onCancel} type="button">Voltar</button>
          <button className={confirmation.tone === "danger" ? "danger-button" : "primary-button"} disabled={isSaving} onClick={onConfirm} type="button">
            {isSaving ? "Salvando..." : confirmation.actionLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

function UserCard({
  canManageUsers,
  isCurrentUser,
  isDeleting,
  isSavingStatus,
  onRequestDeleteUser,
  onRequestStatusChange,
  user
}: {
  canManageUsers: boolean;
  isCurrentUser: boolean;
  isDeleting: boolean;
  isSavingStatus: boolean;
  onRequestDeleteUser: () => void;
  onRequestStatusChange: (user: AccessUser) => void;
  user: AccessUser;
}) {
  const statusBadge = getUserStatusBadge(user.status);
  const StatusIcon = statusBadge.icon;
  const nextStatus = user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
  const ToggleIcon = nextStatus === "ACTIVE" ? ToggleRight : ToggleLeft;

  return (
    <article className="access-card compact user-card">
      <div className="access-card-heading user-card-heading">
        <div className="user-card-identity"><strong>{user.name}</strong><span>{user.login}{user.email ? ` - ${user.email}` : ""}</span></div>
        <span className={`status-badge user-status-badge ${statusBadge.className}`}><StatusIcon aria-hidden="true" size={16} />{statusBadge.label}</span>
      </div>
      <p>{user.groups.map((group) => group.accessGroup.name).join(", ") || "Sem grupo vinculado"}</p>
      <div className="user-clinic-scope">
        <strong>Escopo de clínicas</strong>
        <p>O acesso às clínicas é definido exclusivamente pelos grupos vinculados ao usuário.</p>
      </div>
      <div className="user-card-actions">
        {canManageUsers ? (
          <button className="secondary-button user-status-toggle" disabled={isSavingStatus} onClick={() => onRequestStatusChange(user)} type="button">
            <ToggleIcon aria-hidden="true" size={16} />
            {isSavingStatus ? "Atualizando..." : nextStatus === "ACTIVE" ? "Ativar" : "Inativar"}
          </button>
        ) : null}
        {canManageUsers ? (
          <button className="danger-button" disabled={isDeleting || isCurrentUser} onClick={onRequestDeleteUser} type="button">
            <Trash2 aria-hidden="true" size={16} />
            {isDeleting ? "Excluindo..." : "Excluir"}
          </button>
        ) : null}
        <Link className="secondary-button" href={`/usuarios/${user.id}`}><Eye aria-hidden="true" size={16} />Abrir detalhes</Link>
      </div>
    </article>
  );
}

function UserStatusConfirmationModal({
  isSaving,
  nextStatus,
  onCancel,
  onConfirm,
  user
}: {
  isSaving: boolean;
  nextStatus: AccessUser["status"];
  onCancel: () => void;
  onConfirm: () => void;
  user: AccessUser;
}) {
  const confirmation = getUserStatusConfirmation(user, nextStatus);
  const ConfirmationIcon = nextStatus === "ACTIVE" ? ToggleRight : UserX;

  return (
    <div className="confirmation-modal-layer" role="presentation">
      <button aria-label="Cancelar alteracao de status" className="confirmation-modal-backdrop" disabled={isSaving} onClick={onCancel} type="button" />
      <section aria-labelledby="user-status-confirmation-title" aria-modal="true" className="confirmation-modal-panel" role="dialog">
        <div className="confirmation-modal-heading">
          <span className={`confirmation-modal-icon is-${confirmation.tone}`}><ConfirmationIcon aria-hidden="true" size={20} /></span>
          <div>
            <span className="eyebrow">Confirmacao obrigatoria</span>
            <h3 id="user-status-confirmation-title">{confirmation.title}</h3>
          </div>
        </div>
        <p>{confirmation.message}</p>
        <div className="confirmation-modal-actions">
          <button className="secondary-button" disabled={isSaving} onClick={onCancel} type="button">Cancelar</button>
          <button className={confirmation.tone === "danger" ? "danger-button" : "primary-button"} disabled={isSaving} onClick={onConfirm} type="button">
            {isSaving ? "Atualizando..." : confirmation.actionLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

function UserDeleteConfirmationModal({
  isSaving,
  onCancel,
  onConfirm,
  user
}: {
  isSaving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  user: AccessUser;
}) {
  return (
    <div className="confirmation-modal-layer" role="presentation">
      <button aria-label="Cancelar exclusão de usuário" className="confirmation-modal-backdrop" disabled={isSaving} onClick={onCancel} type="button" />
      <section aria-labelledby="user-delete-confirmation-title" aria-modal="true" className="confirmation-modal-panel" role="dialog">
        <div className="confirmation-modal-heading">
          <span className="confirmation-modal-icon is-danger"><Trash2 aria-hidden="true" size={20} /></span>
          <div>
            <span className="eyebrow">Confirmação obrigatória</span>
            <h3 id="user-delete-confirmation-title">Excluir usuário</h3>
          </div>
        </div>
        <p>Esta ação remove o usuário {user.name} de forma definitiva. O histórico de auditoria será preservado.</p>
        <div className="confirmation-modal-actions">
          <button className="secondary-button" disabled={isSaving} onClick={onCancel} type="button">Cancelar</button>
          <button className="danger-button" disabled={isSaving} onClick={onConfirm} type="button">{isSaving ? "Excluindo..." : "Excluir usuário"}</button>
        </div>
      </section>
    </div>
  );
}

function ClinicScopePicker({
  canManageGroups,
  clinics,
  isSaving,
  onToggle,
  selected
}: {
  canManageGroups: boolean;
  clinics: Clinic[];
  isSaving: boolean;
  onToggle: (clinicId: string) => void;
  selected: string[];
}) {
  return (
    <fieldset className="clinic-scope-picker">
      <legend>Clínicas liberadas</legend>
      <p>Defina em quais clínicas este grupo pode operar. As permissões abaixo continuam controlando o que o grupo pode fazer.</p>
      <div className="access-checklist">
        {clinics.map((clinic) => (
          <label className="choice-pill" key={clinic.id} title={clinic.code ?? clinic.name}>
            <input checked={selected.includes(clinic.id)} disabled={!canManageGroups || isSaving} onChange={() => onToggle(clinic.id)} type="checkbox" />
            {clinic.name}{clinic.code ? ` (${clinic.code})` : ""}
          </label>
        ))}
        {clinics.length === 0 ? <div className="empty-state">Nenhuma clínica ativa encontrada.</div> : null}
      </div>
    </fieldset>
  );
}

function PermissionPicker({
  canManageGroups,
  isSaving,
  onToggle,
  permissionsByModule,
  selected
}: {
  canManageGroups: boolean;
  isSaving: boolean;
  onToggle: (permissionKey: string) => void;
  permissionsByModule: Record<string, Permission[]>;
  selected: string[];
}) {
  return (
    <div className="permission-picker">
      {Object.entries(permissionsByModule)
        .sort(([firstModule], [secondModule]) => {
          const firstIndex = permissionModuleOrder.indexOf(firstModule);
          const secondIndex = permissionModuleOrder.indexOf(secondModule);

          if (firstIndex !== -1 || secondIndex !== -1) {
            return (firstIndex === -1 ? permissionModuleOrder.length : firstIndex) - (secondIndex === -1 ? permissionModuleOrder.length : secondIndex);
          }

          return firstModule.localeCompare(secondModule, "pt-BR");
        })
        .map(([module, modulePermissions]) => (
          <fieldset key={module}>
            <legend>{module}</legend>
            <div className="access-checklist">
              {modulePermissions.map((permission) => (
                <label className="choice-pill" key={permission.key} title={permission.key}>
                  <input checked={selected.includes(permission.key)} disabled={!canManageGroups || isSaving} onChange={() => onToggle(permission.key)} type="checkbox" />
                  {permission.description}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
    </div>
  );
}