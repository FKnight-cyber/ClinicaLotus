"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Save, ShieldCheck, UserCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/AuthProvider";

type AccessGroup = {
  id: string;
  name: string;
  description?: string | null;
  active: boolean;
};

type AccessUser = {
  id: string;
  login: string;
  name: string;
  email?: string | null;
  status: "PENDING" | "ACTIVE" | "INACTIVE";
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
    throw new Error(payload?.message ?? "Nao foi possivel atualizar o usuario.");
  }

  return response.json() as Promise<T>;
}

export function UserDetailPage({ userId }: { userId: string }) {
  const { hasPermission, refreshProfile, token, user } = useAuth();
  const router = useRouter();
  const canReadUsers = hasPermission("access.users.read");
  const canManageUsers = hasPermission("access.users.manage");
  const isSelf = user?.id === userId;
  const [targetUser, setTargetUser] = useState<AccessUser | null>(null);
  const [groups, setGroups] = useState<AccessGroup[]>([]);
  const [draft, setDraft] = useState({ name: "", email: "" });
  const [groupDraft, setGroupDraft] = useState<string[]>([]);
  const [statusDraft, setStatusDraft] = useState<AccessUser["status"]>("PENDING");
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUser = async () => {
    if (!token || !user) return;
    setIsLoading(true);

    if (canReadUsers) {
      const [nextUser, nextGroups] = await Promise.all([
        apiRequest<AccessUser>(token, `/api/access/users/${userId}`),
        canManageUsers ? apiRequest<AccessGroup[]>(token, "/api/access/groups") : Promise.resolve([])
      ]);
      setTargetUser(nextUser);
      setGroups(nextGroups);
      setDraft({ name: nextUser.name, email: nextUser.email ?? "" });
      setGroupDraft(nextUser.groups.map((group) => group.accessGroup.id));
      setStatusDraft(nextUser.status);
      setIsLoading(false);
      return;
    }

    if (isSelf) {
      const nextUser: AccessUser = {
        id: user.id,
        login: user.login,
        name: user.name,
        email: user.email,
        status: "ACTIVE",
        mustChangePassword: Boolean(user.mustChangePassword),
        groups: []
      };
      setTargetUser(nextUser);
      setDraft({ name: nextUser.name, email: nextUser.email ?? "" });
      setIsLoading(false);
      return;
    }

    setMessage("Voce nao possui permissao para visualizar este usuario.");
    setIsLoading(false);
  };

  useEffect(() => {
    loadUser().catch((error) => {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel carregar o usuario.");
      setIsLoading(false);
    });
  }, [token, userId, user?.id, canReadUsers, canManageUsers]);

  const toggleGroup = (groupId: string) => {
    setGroupDraft((current) => current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId]);
  };

  const handleSaveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !targetUser) return;

    if (canManageUsers && !isSelf) {
      const updatedUser = await apiRequest<AccessUser>(token, `/api/access/users/${targetUser.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: draft.name, email: draft.email || undefined })
      });
      setTargetUser(updatedUser);
    } else if (isSelf) {
      await apiRequest(token, "/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ name: draft.name, email: draft.email || undefined })
      });
      await refreshProfile();
    }

    setMessage("Dados do usuario atualizados.");
  };

  const handleSaveStatus = async (nextStatus = statusDraft) => {
    if (!token || !targetUser || !canManageUsers) return;
    const updatedUser = await apiRequest<AccessUser>(token, `/api/access/users/${targetUser.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: nextStatus })
    });
    setTargetUser(updatedUser);
    setStatusDraft(updatedUser.status);
    setMessage(nextStatus === "ACTIVE" ? "Usuario aprovado e liberado para login." : "Status do usuario atualizado.");
  };

  const handleSaveGroups = async () => {
    if (!token || !targetUser || !canManageUsers) return;
    const updatedUser = await apiRequest<AccessUser>(token, `/api/access/users/${targetUser.id}/groups`, {
      method: "PATCH",
      body: JSON.stringify({ groupIds: groupDraft })
    });
    setTargetUser(updatedUser);
    setMessage("Grupos de acesso atualizados.");
  };

  if (isLoading) {
    return <div className="loading-panel">Carregando usuario...</div>;
  }

  if (!targetUser) {
    return <div className="loading-panel">{message ?? "Usuario nao encontrado."}</div>;
  }

  return (
    <section className="user-detail-page">
      <div className="list-header">
        <div>
          <span className="eyebrow">Usuario</span>
          <h2>{targetUser.name}</h2>
          <p>{targetUser.login} {targetUser.email ? `- ${targetUser.email}` : ""}</p>
        </div>
        <div className="detail-heading-actions">
          {canReadUsers ? <Link className="back-link" href="/modulos/controle-acesso"><ArrowLeft size={16} />Controle de acesso</Link> : null}
          {canManageUsers ? (
            <span className={`status-badge ${targetUser.status === "ACTIVE" ? "is-finalized" : ""}`}>
              <UserCheck aria-hidden="true" size={16} />{targetUser.status}
            </span>
          ) : null}
        </div>
      </div>

      {message ? <div className="access-message">{message}</div> : null}

      <div className="access-grid">
        <section className="plain-panel">
          <h3>Dados do usuario</h3>
          <form className="access-form" onSubmit={handleSaveProfile}>
            <label><span>Login</span><input disabled value={targetUser.login} /></label>
            <label><span>Nome</span><input onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} required value={draft.name} /></label>
            <label><span>Email</span><input onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))} type="email" value={draft.email} /></label>
            {isSelf || canManageUsers ? <button className="primary-button" type="submit"><Save aria-hidden="true" size={17} />Salvar dados</button> : null}
          </form>
        </section>

        {canManageUsers ? (
          <section className="plain-panel">
            <h3>Aprovacao e status</h3>
            <div className="access-form">
              <label><span>Status</span><select onChange={(event) => setStatusDraft(event.target.value as AccessUser["status"])} value={statusDraft}>
                <option value="PENDING">Pendente</option>
                <option value="ACTIVE">Ativo</option>
                <option value="INACTIVE">Inativo</option>
              </select></label>
              <button className="secondary-button" onClick={() => handleSaveStatus()} type="button"><Save aria-hidden="true" size={17} />Salvar status</button>
              {targetUser.status === "PENDING" ? <button className="primary-button" onClick={() => handleSaveStatus("ACTIVE")} type="button"><CheckCircle2 aria-hidden="true" size={17} />Aprovar cadastro</button> : null}
            </div>
          </section>
        ) : null}
      </div>

      {canManageUsers ? (
        <section className="plain-panel user-access-panel">
          <div className="access-card-heading">
            <div>
              <h3>Grupos e funcionalidades</h3>
              <p>Os acessos efetivos do usuario sao definidos pelos grupos vinculados aqui.</p>
            </div>
            <button className="primary-button" onClick={handleSaveGroups} type="button"><ShieldCheck aria-hidden="true" size={17} />Salvar acessos</button>
          </div>
          <div className="access-checklist">
            {groups.map((group) => (
              <label className="choice-pill" key={group.id}>
                <input checked={groupDraft.includes(group.id)} onChange={() => toggleGroup(group.id)} type="checkbox" />
                {group.name}
              </label>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}