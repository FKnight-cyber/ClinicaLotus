"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Eye, Save, ShieldCheck, UsersRound } from "lucide-react";
import Link from "next/link";
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
  status: string;
  mustChangePassword: boolean;
  groups: { accessGroup: AccessGroup }[];
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
    throw new Error(payload?.message ?? "Nao foi possivel atualizar os acessos.");
  }

  return response.json() as Promise<T>;
}

export function AccessAdminPage() {
  const { hasPermission, token } = useAuth();
  const canManageGroups = hasPermission("access.groups.manage");
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [groups, setGroups] = useState<AccessGroup[]>([]);
  const [users, setUsers] = useState<AccessUser[]>([]);
  const [groupDrafts, setGroupDrafts] = useState<Record<string, string[]>>({});
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [groupSearch, setGroupSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const permissionsByModule = useMemo(() => {
    return permissions.reduce<Record<string, Permission[]>>((accumulator, permission) => {
      accumulator[permission.module] = [...(accumulator[permission.module] ?? []), permission];
      return accumulator;
    }, {});
  }, [permissions]);

  const filteredGroups = useMemo(() => {
    const normalizedSearch = groupSearch.trim().toLowerCase();

    if (!normalizedSearch) {
      return groups;
    }

    return groups.filter((group) => (
      group.name.toLowerCase().includes(normalizedSearch) || (group.description ?? "").toLowerCase().includes(normalizedSearch)
    ));
  }, [groupSearch, groups]);

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? filteredGroups[0] ?? groups[0] ?? null;

  const filteredUsers = useMemo(() => {
    const normalizedSearch = userSearch.trim().toLowerCase();

    if (!normalizedSearch) {
      return users;
    }

    return users.filter((user) => (
      user.name.toLowerCase().includes(normalizedSearch)
      || user.login.toLowerCase().includes(normalizedSearch)
      || (user.email ?? "").toLowerCase().includes(normalizedSearch)
    ));
  }, [userSearch, users]);

  const loadAccessData = async () => {
    if (!token) return;
    setIsLoading(true);
    const [nextPermissions, nextGroups, nextUsers] = await Promise.all([
      apiRequest<Permission[]>(token, "/api/access/permissions"),
      apiRequest<AccessGroup[]>(token, "/api/access/groups"),
      apiRequest<AccessUser[]>(token, "/api/access/users")
    ]);

    setPermissions(nextPermissions);
    setGroups(nextGroups);
    setUsers(nextUsers);
    setGroupDrafts(Object.fromEntries(
      nextGroups.map((group) => [group.id, group.permissions.map((item) => item.permission.key)])
    ));
    setSelectedGroupId((currentGroupId) => currentGroupId && nextGroups.some((group) => group.id === currentGroupId) ? currentGroupId : nextGroups[0]?.id ?? null);
    setIsLoading(false);
  };

  useEffect(() => {
    loadAccessData().catch((error) => {
      setStatusMessage(error instanceof Error ? error.message : "Nao foi possivel carregar os acessos.");
      setIsLoading(false);
    });
  }, [token]);

  const toggleValue = (values: string[], value: string) => (
    values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
  );

  const handleCreateGroup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !canManageGroups || !newGroupName.trim()) return;

    const createdGroup = await apiRequest<AccessGroup>(token, "/api/access/groups", {
      method: "POST",
      body: JSON.stringify({
        name: newGroupName.trim(),
        description: newGroupDescription.trim() || undefined
      })
    });
    setNewGroupName("");
    setNewGroupDescription("");
    setSelectedGroupId(createdGroup.id);
    setStatusMessage("Grupo criado com sucesso.");
    await loadAccessData();
  };

  const handleSaveGroupPermissions = async (groupId: string) => {
    if (!token || !canManageGroups) return;
    await apiRequest<AccessGroup>(token, `/api/access/groups/${groupId}/permissions`, {
      method: "PATCH",
      body: JSON.stringify({ permissionKeys: groupDrafts[groupId] ?? [] })
    });
    setStatusMessage("Permissoes do grupo atualizadas.");
    await loadAccessData();
  };

  if (!hasPermission("access.groups.read") || !hasPermission("access.users.read")) {
    return (
      <section className="placeholder-page">
        <div className="page-intro">
          <div className="intro-icon" aria-hidden="true"><ShieldCheck size={28} /></div>
          <div>
            <span className="eyebrow">Acessos</span>
            <h2>Permissao necessaria</h2>
            <p>Seu usuario nao possui permissao para gerenciar grupos e usuarios.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="access-page">
      <div className="list-header">
        <div>
          <span className="eyebrow">Administracao</span>
          <h2>Grupos e acessos</h2>
          <p>Configure permissoes por grupo. A aprovacao e os acessos de cada usuario ficam na tela de detalhes do usuario.</p>
        </div>
        <span className="status-badge"><ShieldCheck aria-hidden="true" size={17} />{permissions.length} permissoes</span>
      </div>

      {statusMessage ? <div className="access-message">{statusMessage}</div> : null}
      {isLoading ? <div className="loading-panel">Carregando acessos...</div> : null}

      <div className="access-management-layout">
        <section className="plain-panel access-groups-panel">
          <h3>Grupos</h3>
          {canManageGroups ? (
            <form className="access-form compact-form" onSubmit={handleCreateGroup}>
              <label><span>Novo grupo</span><input onChange={(event) => setNewGroupName(event.target.value)} placeholder="Nome do grupo" required value={newGroupName} /></label>
              <label><span>Descricao</span><input onChange={(event) => setNewGroupDescription(event.target.value)} placeholder="Opcional" value={newGroupDescription} /></label>
              <button className="primary-button" type="submit"><ShieldCheck aria-hidden="true" size={17} />Criar grupo</button>
            </form>
          ) : null}

          <div className="access-search-box">
            <input onChange={(event) => setGroupSearch(event.target.value)} placeholder="Buscar grupo" value={groupSearch} />
            <span>{filteredGroups.length} de {groups.length} grupos</span>
          </div>

          <div className="group-directory" aria-label="Grupos cadastrados">
            {filteredGroups.map((group) => {
              const permissionCount = groupDrafts[group.id]?.length ?? 0;
              const isSelected = selectedGroup?.id === group.id;

              return (
                <button className={`group-directory-item ${isSelected ? "is-selected" : ""}`} key={group.id} onClick={() => setSelectedGroupId(group.id)} type="button">
                  <strong>{group.name}</strong>
                  <span>{group.description || "Sem descricao"}</span>
                  <small>{permissionCount} permissoes</small>
                </button>
              );
            })}
            {filteredGroups.length === 0 ? <div className="empty-state">Nenhum grupo encontrado.</div> : null}
          </div>
        </section>

        <section className="plain-panel access-permissions-panel">
          <div className="access-card-heading">
            <div>
              <h3>{selectedGroup ? selectedGroup.name : "Selecione um grupo"}</h3>
              <p>{selectedGroup?.description || "Escolha um grupo para revisar e editar suas permissoes."}</p>
            </div>
            {selectedGroup && canManageGroups ? <button className="secondary-button" onClick={() => handleSaveGroupPermissions(selectedGroup.id)} type="button"><Save aria-hidden="true" size={16} />Salvar</button> : null}
          </div>
          {selectedGroup ? (
            <PermissionPicker
              canManageGroups={canManageGroups}
              permissionsByModule={permissionsByModule}
              selected={groupDrafts[selectedGroup.id] ?? []}
              onToggle={(permissionKey) => setGroupDrafts((current) => ({ ...current, [selectedGroup.id]: toggleValue(current[selectedGroup.id] ?? [], permissionKey) }))}
            />
          ) : null}
        </section>

        <section className="plain-panel access-users-panel">
          <div className="access-section-heading">
            <h3>Usuarios e solicitacoes</h3>
            <input aria-label="Buscar usuario" onChange={(event) => setUserSearch(event.target.value)} placeholder="Buscar por nome, login ou email" value={userSearch} />
            <p>{filteredUsers.length} de {users.length} usuarios exibidos</p>
          </div>
          <div className="access-user-list">
            {filteredUsers.map((user) => (
              <article className="access-card compact user-card" key={user.id}>
                <div className="access-card-heading user-card-heading">
                  <div className="user-card-identity"><strong>{user.name}</strong><span>{user.login} {user.email ? `- ${user.email}` : ""}</span></div>
                  <span className="status-badge"><UsersRound aria-hidden="true" size={16} />{user.status}</span>
                </div>
                <p>{user.groups.map((group) => group.accessGroup.name).join(", ") || "Sem grupo vinculado"}</p>
                <Link className="secondary-button" href={`/usuarios/${user.id}`}><Eye aria-hidden="true" size={16} />Abrir detalhes</Link>
              </article>
            ))}
            {filteredUsers.length === 0 ? <div className="empty-state">Nenhum usuario encontrado.</div> : null}
          </div>
        </section>
      </div>
    </section>
  );
}

function PermissionPicker({
  canManageGroups,
  onToggle,
  permissionsByModule,
  selected
}: {
  canManageGroups: boolean;
  onToggle: (permissionKey: string) => void;
  permissionsByModule: Record<string, Permission[]>;
  selected: string[];
}) {
  return (
    <div className="permission-picker">
      {Object.entries(permissionsByModule).map(([module, modulePermissions]) => (
        <fieldset key={module}>
          <legend>{module}</legend>
          <div className="access-checklist">
            {modulePermissions.map((permission) => (
              <label className="choice-pill" key={permission.key} title={permission.key}>
                <input checked={selected.includes(permission.key)} disabled={!canManageGroups} onChange={() => onToggle(permission.key)} type="checkbox" />
                {permission.description}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}