"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Clock3, Eye, ShieldCheck, ToggleLeft, ToggleRight, UserX, UsersRound, X } from "lucide-react";
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
  users: unknown[];
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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
const DEFAULT_GROUP_LIMIT = 5;
const DEFAULT_USER_LIMIT = 5;
const MAX_GROUP_LIMIT = 100;
const MAX_USER_LIMIT = 100;
const GROUP_SEARCH_DELAY_MS = 350;
const USER_SEARCH_DELAY_MS = 350;
const userTypeLabels: Record<AccessUser["userType"], string> = {
  MANAGER: "Gerente",
  PATIENT: "Paciente",
  NURSE: "Enfermeiro",
  DOCTOR: "Médico"
};
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

function buildGroupsPath(limit: number, search: string) {
  const params = new URLSearchParams({ limit: String(limit) });
  const normalizedSearch = search.trim();
  if (normalizedSearch) params.set("search", normalizedSearch);
  return `/api/access/groups?${params.toString()}`;
}

function buildGroupsCacheKey(limit: number, search: string) {
  return `${limit}:${search.trim().toLowerCase()}`;
}

function buildUsersPath(limit: number, search: string, groupId: string, status: string) {
  const params = new URLSearchParams({ limit: String(limit) });
  const normalizedSearch = search.trim();
  if (normalizedSearch) params.set("search", normalizedSearch);
  if (groupId) params.set("groupId", groupId);
  if (status) params.set("status", status);
  return `/api/access/users?${params.toString()}`;
}

function buildUsersCacheKey(limit: number, search: string, groupId: string, status: string) {
  return `${limit}:${search.trim().toLowerCase()}:${groupId}:${status}`;
}

function getUserStatusBadge(status: string) {
  if (status === "ACTIVE") return { className: "is-active", icon: CheckCircle2, label: "Ativo" };
  if (status === "INACTIVE") return { className: "is-inactive", icon: UserX, label: "Inativo" };
  return { className: "is-pending", icon: Clock3, label: "Pendente" };
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
  const groupsCacheRef = useRef(new Map<string, PaginatedAccessGroups>());
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [groups, setGroups] = useState<AccessGroup[]>([]);
  const [groupTotal, setGroupTotal] = useState(0);
  const [groupLimit, setGroupLimit] = useState(DEFAULT_GROUP_LIMIT);
  const [groupDrafts, setGroupDrafts] = useState<Record<string, string[]>>({});
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
    setSelectedGroupId((currentGroupId) => currentGroupId && nextGroupsPage.items.some((group) => group.id === currentGroupId) ? currentGroupId : nextGroupsPage.items[0]?.id ?? null);
  }, []);

  const fetchPermissions = useCallback(async () => {
    if (!token) return [];
    if (permissionsCacheRef.current) return permissionsCacheRef.current;

    const nextPermissions = await apiRequest<Permission[]>(token, "/api/access/permissions");
    permissionsCacheRef.current = nextPermissions;
    return nextPermissions;
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
    const [nextPermissions, nextGroupsPage] = await Promise.all([fetchPermissions(), fetchGroupsPage(limit, search, true)]);

    setPermissions(nextPermissions);
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

    Promise.all([fetchPermissions(), fetchGroupsPage(groupLimit, debouncedGroupSearch)]).then(([nextPermissions, nextGroupsPage]) => {
      if (!isCurrent) return;
      setPermissions(nextPermissions);
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
  }, [token, groupLimit, debouncedGroupSearch, applyGroupsPage, fetchGroupsPage, fetchPermissions]);

  const toggleValue = (values: string[], value: string) => (
    values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
  );

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
              const isSelected = selectedGroup?.id === group.id;

              return (
                <button className={`group-directory-item ${isSelected ? "is-selected" : ""}`} key={group.id} onClick={() => setSelectedGroupId(group.id)} type="button">
                  <strong>{group.name}</strong>
                  <span>{group.description || "Sem descrição"}</span>
                  <small>{permissionCount} permissões</small>
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
              <p>{savingGroupId === selectedGroup?.id ? "Salvando permissões..." : selectedGroup?.description || "Escolha um grupo para revisar e editar suas permissões."}</p>
            </div>
          </div>
          {selectedGroup ? (
            <PermissionPicker
              canManageGroups={canManageGroups}
              isSaving={savingGroupId === selectedGroup.id}
              permissionsByModule={permissionsByModule}
              selected={groupDrafts[selectedGroup.id] ?? []}
              onToggle={(permissionKey) => handleToggleGroupPermission(selectedGroup.id, permissionKey)}
            />
          ) : null}
        </section>
      </div>
    </section>
  );
}

export function AccessUsersAdminPage() {
  const { hasPermission, token } = useAuth();
  const canManageUsers = hasPermission("access.users.manage");
  const usersCacheRef = useRef(new Map<string, PaginatedAccessUsers>());
  const userGroupsCacheRef = useRef<AccessGroup[] | null>(null);
  const [users, setUsers] = useState<AccessUser[]>([]);
  const [userGroups, setUserGroups] = useState<AccessGroup[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [userLimit, setUserLimit] = useState(DEFAULT_USER_LIMIT);
  const [userSearch, setUserSearch] = useState("");
  const [debouncedUserSearch, setDebouncedUserSearch] = useState("");
  const [selectedUserGroupId, setSelectedUserGroupId] = useState("");
  const [selectedUserStatus, setSelectedUserStatus] = useState("");
  const [draftUserLimit, setDraftUserLimit] = useState(DEFAULT_USER_LIMIT);
  const [draftUserSearch, setDraftUserSearch] = useState("");
  const [draftSelectedUserGroupId, setDraftSelectedUserGroupId] = useState("");
  const [draftSelectedUserStatus, setDraftSelectedUserStatus] = useState("");
  const [isUserFiltersOpen, setIsUserFiltersOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUsersLoading, setIsUsersLoading] = useState(true);
  const [savingUserStatusId, setSavingUserStatusId] = useState<string | null>(null);
  const [statusConfirmation, setStatusConfirmation] = useState<{ user: AccessUser; nextStatus: AccessUser["status"] } | null>(null);

  const pendingUsersCount = users.filter((user) => user.status === "PENDING").length;
  const activeUserFilterCount = [userSearch.trim(), selectedUserGroupId, selectedUserStatus, userLimit !== DEFAULT_USER_LIMIT ? String(userLimit) : ""].filter(Boolean).length;
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

  const fetchUsersPage = useCallback(async (limit: number, search: string, groupId: string, status: string, bypassCache = false) => {
    if (!token) return { items: [], limit, total: 0 };

    const cacheKey = buildUsersCacheKey(limit, search, groupId, status);
    const cachedUsersPage = usersCacheRef.current.get(cacheKey);
    if (!bypassCache && cachedUsersPage) return cachedUsersPage;

    const nextUsersPayload = await apiRequest<PaginatedAccessUsers | AccessUser[]>(token, buildUsersPath(limit, search, groupId, status));
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
    if (!token) return;

    let isCurrent = true;
    const cacheKey = buildUsersCacheKey(userLimit, debouncedUserSearch, selectedUserGroupId, selectedUserStatus);
    const cachedUsersPage = usersCacheRef.current.get(cacheKey);

    Promise.resolve().then(() => {
      if (!isCurrent) return;
      setIsUsersLoading(!cachedUsersPage);
      if (!cachedUsersPage) setIsLoading(true);
    });

    Promise.all([fetchUserGroups(), fetchUsersPage(userLimit, debouncedUserSearch, selectedUserGroupId, selectedUserStatus)]).then(([nextGroups, nextUsersPage]) => {
      if (!isCurrent) return;
      setUserGroups(nextGroups);
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
  }, [token, userLimit, debouncedUserSearch, selectedUserGroupId, selectedUserStatus, applyUsersPage, fetchUserGroups, fetchUsersPage]);

  const handleClearUserFilters = () => {
    setUserSearch("");
    setDebouncedUserSearch("");
    setSelectedUserGroupId("");
    setSelectedUserStatus("");
    setUserLimit(DEFAULT_USER_LIMIT);
    setDraftUserSearch("");
    setDraftSelectedUserGroupId("");
    setDraftSelectedUserStatus("");
    setDraftUserLimit(DEFAULT_USER_LIMIT);
  };

  const handleOpenUserFilters = () => {
    setDraftUserSearch(userSearch);
    setDraftSelectedUserGroupId(selectedUserGroupId);
    setDraftSelectedUserStatus(selectedUserStatus);
    setDraftUserLimit(userLimit);
    setIsUserFiltersOpen(true);
  };

  const handleApplyUserFilters = () => {
    setUserSearch(draftUserSearch);
    setDebouncedUserSearch(draftUserSearch);
    setSelectedUserGroupId(draftSelectedUserGroupId);
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
      const nextUsersPage = await fetchUsersPage(userLimit, debouncedUserSearch, selectedUserGroupId, selectedUserStatus, true);
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
                    <span>Status</span>
                    <select aria-label="Filtrar por status" onChange={(event) => setDraftSelectedUserStatus(event.target.value)} value={draftSelectedUserStatus}>
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
                      onChange={(event) => setDraftUserLimit(Math.min(Math.max(Number(event.target.value) || DEFAULT_USER_LIMIT, 1), MAX_USER_LIMIT))}
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
            {users.map((user) => (
              <UserCard
                canManageUsers={canManageUsers}
                isSavingStatus={savingUserStatusId === user.id}
                key={user.id}
                onRequestStatusChange={handleRequestUserStatusChange}
                user={user}
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
    </section>
  );
}

function UserCard({
  canManageUsers,
  isSavingStatus,
  onRequestStatusChange,
  user
}: {
  canManageUsers: boolean;
  isSavingStatus: boolean;
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
        <div className="user-card-identity"><strong>{user.name}</strong><span>{userTypeLabels[user.userType]} - {user.login} {user.email ? `- ${user.email}` : ""}</span></div>
        <span className={`status-badge user-status-badge ${statusBadge.className}`}><StatusIcon aria-hidden="true" size={16} />{statusBadge.label}</span>
      </div>
      <p>{user.groups.map((group) => group.accessGroup.name).join(", ") || "Sem grupo vinculado"}</p>
      <div className="user-card-actions">
        {canManageUsers ? (
          <button className="secondary-button user-status-toggle" disabled={isSavingStatus} onClick={() => onRequestStatusChange(user)} type="button">
            <ToggleIcon aria-hidden="true" size={16} />
            {isSavingStatus ? "Atualizando..." : nextStatus === "ACTIVE" ? "Ativar" : "Inativar"}
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