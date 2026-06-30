"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Save, ShieldCheck, UserPlus, UsersRound } from "lucide-react";
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
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [groups, setGroups] = useState<AccessGroup[]>([]);
  const [users, setUsers] = useState<AccessUser[]>([]);
  const [groupDrafts, setGroupDrafts] = useState<Record<string, string[]>>({});
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [newGroupPermissions, setNewGroupPermissions] = useState<string[]>([]);
  const [newUser, setNewUser] = useState({ login: "", name: "", email: "", password: "", groupIds: [] as string[] });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const permissionsByModule = useMemo(() => {
    return permissions.reduce<Record<string, Permission[]>>((accumulator, permission) => {
      accumulator[permission.module] = [...(accumulator[permission.module] ?? []), permission];
      return accumulator;
    }, {});
  }, [permissions]);

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
    if (!token || !newGroupName.trim()) return;

    await apiRequest<AccessGroup>(token, "/api/access/groups", {
      method: "POST",
      body: JSON.stringify({
        name: newGroupName.trim(),
        description: newGroupDescription.trim() || undefined,
        permissionKeys: newGroupPermissions
      })
    });
    setNewGroupName("");
    setNewGroupDescription("");
    setNewGroupPermissions([]);
    setStatusMessage("Grupo criado com sucesso.");
    await loadAccessData();
  };

  const handleSaveGroupPermissions = async (groupId: string) => {
    if (!token) return;
    await apiRequest<AccessGroup>(token, `/api/access/groups/${groupId}/permissions`, {
      method: "PATCH",
      body: JSON.stringify({ permissionKeys: groupDrafts[groupId] ?? [] })
    });
    setStatusMessage("Permissoes do grupo atualizadas.");
    await loadAccessData();
  };

  const handleCreateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;

    await apiRequest<AccessUser>(token, "/api/access/users", {
      method: "POST",
      body: JSON.stringify({
        login: newUser.login.trim(),
        name: newUser.name.trim(),
        email: newUser.email.trim() || undefined,
        password: newUser.password,
        groupIds: newUser.groupIds
      })
    });
    setNewUser({ login: "", name: "", email: "", password: "", groupIds: [] });
    setStatusMessage("Usuario criado com sucesso.");
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
          <p>Configure permissoes por grupo e vincule usuarios aos perfis internos.</p>
        </div>
        <span className="status-badge"><ShieldCheck aria-hidden="true" size={17} />{permissions.length} permissoes</span>
      </div>

      {statusMessage ? <div className="access-message">{statusMessage}</div> : null}
      {isLoading ? <div className="loading-panel">Carregando acessos...</div> : null}

      <div className="access-grid">
        <section className="plain-panel">
          <h3>Novo grupo</h3>
          <form className="access-form" onSubmit={handleCreateGroup}>
            <label><span>Nome</span><input onChange={(event) => setNewGroupName(event.target.value)} required value={newGroupName} /></label>
            <label><span>Descricao</span><textarea onChange={(event) => setNewGroupDescription(event.target.value)} value={newGroupDescription} /></label>
            <PermissionPicker
              permissionsByModule={permissionsByModule}
              selected={newGroupPermissions}
              onToggle={(permissionKey) => setNewGroupPermissions((current) => toggleValue(current, permissionKey))}
            />
            <button className="primary-button" type="submit"><ShieldCheck aria-hidden="true" size={17} />Criar grupo</button>
          </form>
        </section>

        <section className="plain-panel">
          <h3>Novo usuario</h3>
          <form className="access-form" onSubmit={handleCreateUser}>
            <label><span>Login</span><input onChange={(event) => setNewUser((current) => ({ ...current, login: event.target.value }))} required value={newUser.login} /></label>
            <label><span>Nome</span><input onChange={(event) => setNewUser((current) => ({ ...current, name: event.target.value }))} required value={newUser.name} /></label>
            <label><span>Email</span><input onChange={(event) => setNewUser((current) => ({ ...current, email: event.target.value }))} type="email" value={newUser.email} /></label>
            <label><span>Senha inicial</span><input minLength={6} onChange={(event) => setNewUser((current) => ({ ...current, password: event.target.value }))} required type="password" value={newUser.password} /></label>
            <div className="access-checklist">
              {groups.map((group) => (
                <label className="choice-pill" key={group.id}>
                  <input checked={newUser.groupIds.includes(group.id)} onChange={() => setNewUser((current) => ({ ...current, groupIds: toggleValue(current.groupIds, group.id) }))} type="checkbox" />
                  {group.name}
                </label>
              ))}
            </div>
            <button className="primary-button" type="submit"><UserPlus aria-hidden="true" size={17} />Criar usuario</button>
          </form>
        </section>
      </div>

      <div className="access-grid access-grid-wide">
        <section className="plain-panel">
          <h3>Grupos cadastrados</h3>
          <div className="access-list">
            {groups.map((group) => (
              <article className="access-card" key={group.id}>
                <div className="access-card-heading">
                  <div><strong>{group.name}</strong><span>{group.description || "Sem descricao"}</span></div>
                  <button className="secondary-button" onClick={() => handleSaveGroupPermissions(group.id)} type="button"><Save aria-hidden="true" size={16} />Salvar</button>
                </div>
                <PermissionPicker
                  permissionsByModule={permissionsByModule}
                  selected={groupDrafts[group.id] ?? []}
                  onToggle={(permissionKey) => setGroupDrafts((current) => ({ ...current, [group.id]: toggleValue(current[group.id] ?? [], permissionKey) }))}
                />
              </article>
            ))}
          </div>
        </section>

        <section className="plain-panel">
          <h3>Usuarios</h3>
          <div className="access-list">
            {users.map((user) => (
              <article className="access-card compact" key={user.id}>
                <div className="access-card-heading">
                  <div><strong>{user.name}</strong><span>{user.login} {user.email ? `- ${user.email}` : ""}</span></div>
                  <span className="status-badge"><UsersRound aria-hidden="true" size={16} />{user.status}</span>
                </div>
                <p>{user.groups.map((group) => group.accessGroup.name).join(", ") || "Sem grupo vinculado"}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function PermissionPicker({
  onToggle,
  permissionsByModule,
  selected
}: {
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
                <input checked={selected.includes(permission.key)} onChange={() => onToggle(permission.key)} type="checkbox" />
                {permission.description}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}