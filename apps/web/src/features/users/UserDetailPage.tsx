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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
const userTypeLabels: Record<AccessUser["userType"], string> = {
  MANAGER: "Gerente",
  PATIENT: "Paciente",
  NURSE: "Enfermeiro",
  DOCTOR: "Médico"
};

function normalizeGroupsPage(payload: PaginatedAccessGroups | AccessGroup[]): PaginatedAccessGroups {
  if (Array.isArray(payload)) {
    return { items: payload.slice(0, 100), limit: 100, total: payload.length };
  }

  return payload;
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
    throw new Error(payload?.message ?? "Não foi possível atualizar o usuário.");
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
  const [draft, setDraft] = useState<{ name: string; email: string; userType: AccessUser["userType"] }>({ name: "", email: "", userType: "MANAGER" });
  const [groupDraft, setGroupDraft] = useState<string[]>([]);
  const [statusDraft, setStatusDraft] = useState<AccessUser["status"]>("PENDING");
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!token || !user) return;

    let isCurrent = true;
    Promise.resolve().then(async () => {
      setIsLoading(true);

      if (canReadUsers) {
        const [nextUser, nextGroups] = await Promise.all([
          apiRequest<AccessUser>(token, `/api/access/users/${userId}`),
          canManageUsers ? apiRequest<PaginatedAccessGroups | AccessGroup[]>(token, "/api/access/groups?limit=100") : Promise.resolve({ items: [], limit: 100, total: 0 })
        ]);

        if (!isCurrent) return;
        const nextGroupsPage = normalizeGroupsPage(nextGroups);
        setTargetUser(nextUser);
        setGroups(nextGroupsPage.items);
        setDraft({ name: nextUser.name, email: nextUser.email ?? "", userType: nextUser.userType });
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
          userType: user.userType ?? "MANAGER",
          professionalArea: user.professionalArea,
          status: "ACTIVE",
          mustChangePassword: Boolean(user.mustChangePassword),
          groups: []
        };

        if (!isCurrent) return;
        setTargetUser(nextUser);
        setDraft({ name: nextUser.name, email: nextUser.email ?? "", userType: nextUser.userType });
        setIsLoading(false);
        return;
      }

      if (!isCurrent) return;
      setMessage("Você não possui permissão para visualizar este usuário.");
      setIsLoading(false);
    }).catch((error) => {
      if (!isCurrent) return;
      setMessage(error instanceof Error ? error.message : "Não foi possível carregar o usuário.");
      setIsLoading(false);
    });

    return () => {
      isCurrent = false;
    };
  }, [token, user, userId, canReadUsers, canManageUsers, isSelf]);

  const toggleGroup = (groupId: string) => {
    setGroupDraft((current) => current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId]);
  };

  const handleSaveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !targetUser) return;
    const formData = new FormData(event.currentTarget);
    const nextDraft = {
      name: String(formData.get("name") ?? draft.name),
      email: String(formData.get("email") ?? draft.email),
      userType: String(formData.get("userType") ?? draft.userType) as AccessUser["userType"]
    };

    if (canManageUsers) {
      const updatedUser = await apiRequest<AccessUser>(token, `/api/access/users/${targetUser.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: nextDraft.name, email: nextDraft.email || undefined, userType: nextDraft.userType })
      });
      setTargetUser(updatedUser);
      setDraft({ name: updatedUser.name, email: updatedUser.email ?? "", userType: updatedUser.userType });
      if (isSelf) await refreshProfile();
    } else if (isSelf) {
      await apiRequest(token, "/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ name: nextDraft.name, email: nextDraft.email || undefined })
      });
      await refreshProfile();
      setDraft(nextDraft);
    }

    setMessage("Dados do usuário atualizados.");
  };

  const handleSaveStatus = async (nextStatus = statusDraft) => {
    if (!token || !targetUser || !canManageUsers) return;
    const updatedUser = await apiRequest<AccessUser>(token, `/api/access/users/${targetUser.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: nextStatus })
    });
    setTargetUser(updatedUser);
    setStatusDraft(updatedUser.status);
    setMessage(nextStatus === "ACTIVE" ? "Usuário aprovado e liberado para login." : "Status do usuário atualizado.");
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
    return <div className="loading-panel">Carregando usuário...</div>;
  }

  if (!targetUser) {
    return <div className="loading-panel">{message ?? "Usuário não encontrado."}</div>;
  }

  return (
    <section className="user-detail-page">
      <div className="list-header">
        <div>
          <span className="eyebrow">Usuário</span>
          <h2>{targetUser.name}</h2>
          <p>{targetUser.login} {targetUser.email ? `- ${targetUser.email}` : ""}</p>
        </div>
        <div className="detail-heading-actions">
          {canReadUsers ? <Link className="back-link" href="/modulos/controle-acesso/gerenciar-usuarios"><ArrowLeft size={16} />Gerenciar usuários</Link> : null}
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
          <h3>Dados do usuário</h3>
          <form className="access-form" onSubmit={handleSaveProfile}>
            <label><span>Login</span><input disabled value={targetUser.login} /></label>
            <label><span>Nome</span><input name="name" onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} required value={draft.name} /></label>
            <label><span>Email</span><input name="email" onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))} type="email" value={draft.email} /></label>
            {canManageUsers ? <label><span>Tipo de usuário</span><select name="userType" onChange={(event) => setDraft((current) => ({ ...current, userType: event.target.value as AccessUser["userType"] }))} value={draft.userType}>
              {Object.entries(userTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label> : null}
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
              <p>Os acessos efetivos do usuário são definidos pelos grupos vinculados aqui.</p>
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