"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ClipboardList, ScrollText, ShieldCheck, X } from "lucide-react";
import { ClearFiltersButton, FilterButton } from "@/components/filters/FilterActionButtons";
import { useAuth } from "@/features/auth/AuthProvider";

type AuditUser = {
  id: string;
  login: string;
  name: string;
  email?: string | null;
};

type AccessAuditLog = {
  id: string;
  entity: "access_group" | "access_user";
  entityId?: string | null;
  action: string;
  beforeData?: string | null;
  afterData?: string | null;
  reason?: string | null;
  createdAt: string;
  user?: AuditUser | null;
};

type PaginatedAccessAuditLogs = {
  items: AccessAuditLog[];
  limit: number;
  page: number;
  total: number;
  totalPages: number;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
const DEFAULT_AUDIT_LIMIT = 5;
const MAX_AUDIT_LIMIT = 100;

type AuditEntityFilter = "" | AccessAuditLog["entity"];

const actionLabels: Record<string, string> = {
  create_group: "Grupo criado",
  update_group_permissions: "Permissões do grupo atualizadas",
  create_user: "Usuário criado",
  update_user: "Dados do usuário atualizados",
  update_user_groups: "Grupos do usuário atualizados",
  update_user_status: "Status do usuário atualizado"
};

const auditActionOptions = Object.entries(actionLabels).map(([value, label]) => ({ value, label }));

function buildAuditLogsPath(limit: number, page: number, search: string, entity: string, action: string) {
  const params = new URLSearchParams({ limit: String(limit), page: String(page) });
  const normalizedSearch = search.trim();
  if (normalizedSearch) params.set("search", normalizedSearch);
  if (entity) params.set("entity", entity);
  if (action) params.set("action", action);
  return `/api/access/audit-logs?${params.toString()}`;
}

function buildAuditLogsCacheKey(limit: number, page: number, search: string, entity: string, action: string) {
  return `${limit}:${page}:${search.trim().toLowerCase()}:${entity}:${action}`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function formatEntity(entity: AccessAuditLog["entity"]) {
  if (entity === "access_group") return "Grupos e acessos";
  return "Gerenciar usuários";
}

function getActionLabel(action: string) {
  return actionLabels[action] ?? action;
}

function parseAuditPayload(payload?: string | null) {
  if (!payload) return null;

  try {
    return JSON.parse(payload) as {
      name?: string;
      login?: string;
      email?: string | null;
      status?: string;
      permissions?: { permission: { key: string; description?: string | null } }[];
      groups?: { accessGroup: { id: string; name: string } }[];
    };
  } catch {
    return null;
  }
}

function formatStatus(status?: string) {
  if (status === "ACTIVE") return "Ativo";
  if (status === "INACTIVE") return "Inativo";
  if (status === "PENDING") return "Pendente";
  return status ?? "não informado";
}

function formatListDiff(beforeValues: string[], afterValues: string[], emptyMessage: string) {
  const addedValues = afterValues.filter((value) => !beforeValues.includes(value));
  const removedValues = beforeValues.filter((value) => !afterValues.includes(value));
  const parts = [
    addedValues.length > 0 ? `Adicionado: ${addedValues.join(", ")}` : "",
    removedValues.length > 0 ? `Removido: ${removedValues.join(", ")}` : ""
  ].filter(Boolean);

  return parts.join(". ") || emptyMessage;
}

function readAuditDetails(log: AccessAuditLog) {
  const beforePayload = parseAuditPayload(log.beforeData);
  const afterPayload = parseAuditPayload(log.afterData);

  if (log.action === "update_user_status") {
    return `Status alterado de ${formatStatus(beforePayload?.status)} para ${formatStatus(afterPayload?.status)}.`;
  }

  if (log.action === "update_group_permissions") {
    const beforePermissions = beforePayload?.permissions?.map((item) => item.permission.description ?? item.permission.key) ?? [];
    const afterPermissions = afterPayload?.permissions?.map((item) => item.permission.description ?? item.permission.key) ?? [];
    return formatListDiff(beforePermissions, afterPermissions, "Permissões regravadas sem mudança de itens.");
  }

  if (log.action === "update_user_groups") {
    const beforeGroups = beforePayload?.groups?.map((item) => item.accessGroup.name) ?? [];
    const afterGroups = afterPayload?.groups?.map((item) => item.accessGroup.name) ?? [];
    return formatListDiff(beforeGroups, afterGroups, "Grupos regravados sem mudança de itens.");
  }

  if (log.action === "update_user") {
    const changes = [
      beforePayload?.name !== afterPayload?.name ? `Nome: ${beforePayload?.name ?? "não informado"} -> ${afterPayload?.name ?? "não informado"}` : "",
      beforePayload?.email !== afterPayload?.email ? `Email: ${beforePayload?.email ?? "não informado"} -> ${afterPayload?.email ?? "não informado"}` : ""
    ].filter(Boolean);
    return changes.join(". ") || "Dados regravados sem mudança visível.";
  }

  if (log.action === "create_group") return `Grupo criado com o nome ${afterPayload?.name ?? readAuditTarget(log)}.`;
  if (log.action === "create_user") return `Usuário criado com status ${formatStatus(afterPayload?.status)}.`;

  return log.reason ?? "Alteração registrada.";
}

function readAuditTarget(log: AccessAuditLog) {
  const payload = log.afterData ?? log.beforeData;
  if (!payload) return log.entityId ?? "Registro não informado";

  try {
    const parsed = JSON.parse(payload) as { name?: string; login?: string };
    if (parsed.name && parsed.login) return `${parsed.name} (${parsed.login})`;
    if (parsed.name) return parsed.name;
  } catch {
    return log.entityId ?? "Registro não informado";
  }

  return log.entityId ?? "Registro não informado";
}

async function apiRequest<T>(token: string, path: string) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message ?? "Não foi possível carregar os logs de auditoria.");
  }

  return response.json() as Promise<T>;
}

export function AccessAuditLogsPage() {
  const { hasPermission, token } = useAuth();
  const logsCacheRef = useRef(new Map<string, PaginatedAccessAuditLogs>());
  const [logs, setLogs] = useState<AccessAuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(DEFAULT_AUDIT_LIMIT);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedEntity, setSelectedEntity] = useState<AuditEntityFilter>("");
  const [selectedAction, setSelectedAction] = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  const [draftSelectedEntity, setDraftSelectedEntity] = useState<AuditEntityFilter>("");
  const [draftSelectedAction, setDraftSelectedAction] = useState("");
  const [draftLimit, setDraftLimit] = useState(DEFAULT_AUDIT_LIMIT);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLogsLoading, setIsLogsLoading] = useState(true);

  const canReadAuditLogs = hasPermission("audit.access.read");
  const activeFilterCount = [search.trim(), selectedEntity, selectedAction, limit !== DEFAULT_AUDIT_LIMIT ? String(limit) : ""].filter(Boolean).length;
  const hasActiveFilters = activeFilterCount > 0;

  const applyLogsPage = useCallback((nextLogsPage: PaginatedAccessAuditLogs) => {
    setLogs(nextLogsPage.items);
    setTotal(nextLogsPage.total);
    setLimit(nextLogsPage.limit);
    setPage(nextLogsPage.page);
    setTotalPages(nextLogsPage.totalPages);
  }, []);

  const fetchLogsPage = useCallback(async (nextLimit: number, nextPage: number, nextSearch: string, nextEntity: string, nextAction: string) => {
    if (!token) return { items: [], limit: nextLimit, page: nextPage, total: 0, totalPages: 1 };

    const cacheKey = buildAuditLogsCacheKey(nextLimit, nextPage, nextSearch, nextEntity, nextAction);
    const cachedLogsPage = logsCacheRef.current.get(cacheKey);
    if (cachedLogsPage) return cachedLogsPage;

    const nextLogsPage = await apiRequest<PaginatedAccessAuditLogs>(token, buildAuditLogsPath(nextLimit, nextPage, nextSearch, nextEntity, nextAction));
    logsCacheRef.current.set(cacheKey, nextLogsPage);
    return nextLogsPage;
  }, [token]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    if (!token || !canReadAuditLogs) return;

    let isCurrent = true;
    const cacheKey = buildAuditLogsCacheKey(limit, page, debouncedSearch, selectedEntity, selectedAction);
    const cachedLogsPage = logsCacheRef.current.get(cacheKey);

    Promise.resolve().then(() => {
      if (!isCurrent) return;
      setIsLogsLoading(!cachedLogsPage);
      if (!cachedLogsPage) setIsLoading(true);
    });

    fetchLogsPage(limit, page, debouncedSearch, selectedEntity, selectedAction).then((nextLogsPage) => {
      if (!isCurrent) return;
      applyLogsPage(nextLogsPage);
      setIsLogsLoading(false);
      setIsLoading(false);
    }).catch((error) => {
      if (!isCurrent) return;
      setMessage(error instanceof Error ? error.message : "Não foi possível carregar os logs de auditoria.");
      setIsLogsLoading(false);
      setIsLoading(false);
    });

    return () => {
      isCurrent = false;
    };
  }, [token, canReadAuditLogs, limit, page, debouncedSearch, selectedEntity, selectedAction, applyLogsPage, fetchLogsPage]);

  const handleOpenFilters = () => {
    setDraftSearch(search);
    setDraftSelectedEntity(selectedEntity);
    setDraftSelectedAction(selectedAction);
    setDraftLimit(limit);
    setIsFiltersOpen(true);
  };

  const handleApplyFilters = () => {
    setSearch(draftSearch);
    setDebouncedSearch(draftSearch);
    setSelectedEntity(draftSelectedEntity);
    setSelectedAction(draftSelectedAction);
    setLimit(draftLimit);
    setPage(1);
    setIsFiltersOpen(false);
  };

  const handleClearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setSelectedEntity("");
    setSelectedAction("");
    setLimit(DEFAULT_AUDIT_LIMIT);
    setPage(1);
    setDraftSearch("");
    setDraftSelectedEntity("");
    setDraftSelectedAction("");
    setDraftLimit(DEFAULT_AUDIT_LIMIT);
  };

  if (!canReadAuditLogs) {
    return (
      <section className="placeholder-page">
        <div className="page-intro">
          <div className="intro-icon" aria-hidden="true"><ScrollText size={28} /></div>
          <div>
            <span className="eyebrow">Auditoria</span>
            <h2>Permissão necessária</h2>
            <p>Seu usuário não possui permissão para visualizar logs do controle de acessos.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="access-page audit-page">
      <div className="list-header">
        <div>
          <span className="eyebrow">Auditoria</span>
          <h2>Logs do Controle de acessos</h2>
          <p>Consulte o histórico permanente de alterações feitas em grupos, permissões e usuários.</p>
        </div>
        <span className="status-badge"><ClipboardList aria-hidden="true" size={17} />{total} logs</span>
      </div>

      {message ? <div className="access-message">{message}</div> : null}
      {isLoading ? <div className="loading-panel">Carregando logs de auditoria...</div> : null}

      <section className="plain-panel audit-logs-panel">
        <div className="access-section-heading audit-logs-heading">
          <div>
            <h3>Alterações registradas</h3>
            <p>{logs.length} de {total} logs exibidos</p>
          </div>
          <div className="filter-actions-row">
            <FilterButton activeCount={activeFilterCount} onClick={handleOpenFilters} />
            <ClearFiltersButton disabled={!hasActiveFilters} onClick={handleClearFilters} />
          </div>
        </div>

        {isFiltersOpen ? (
          <div className="filter-drawer-layer" role="presentation">
            <button aria-label="Fechar filtros" className="filter-drawer-backdrop" onClick={() => setIsFiltersOpen(false)} type="button" />
            <aside aria-label="Filtros dos logs de auditoria" className="filter-drawer-panel">
              <div className="filter-drawer-heading">
                <div>
                  <span className="eyebrow">Filtros</span>
                </div>
                <button className="icon-button" onClick={() => setIsFiltersOpen(false)} title="Fechar filtros" type="button"><X aria-hidden="true" size={18} /></button>
              </div>
              <div className="filter-drawer-fields">
                <label>
                  <span>Buscar log</span>
                  <input aria-label="Buscar log" onChange={(event) => setDraftSearch(event.target.value)} placeholder="Registro, ação ou dado alterado" value={draftSearch} />
                </label>
                <label>
                  <span>Tela</span>
                  <select aria-label="Filtrar por tela" onChange={(event) => setDraftSelectedEntity(event.target.value as AuditEntityFilter)} value={draftSelectedEntity}>
                    <option value="">Todas as telas</option>
                    <option value="access_group">Grupos e acessos</option>
                    <option value="access_user">Gerenciar usuários</option>
                  </select>
                </label>
                <label>
                  <span>Ação</span>
                  <select aria-label="Filtrar por ação" onChange={(event) => setDraftSelectedAction(event.target.value)} value={draftSelectedAction}>
                    <option value="">Todas as ações</option>
                    {auditActionOptions.map((actionOption) => <option key={actionOption.value} value={actionOption.value}>{actionOption.label}</option>)}
                  </select>
                </label>
                <label>
                  <span>Nº de logs exibidos</span>
                  <input
                    max={MAX_AUDIT_LIMIT}
                    min={1}
                    onChange={(event) => setDraftLimit(Math.min(Math.max(Number(event.target.value) || DEFAULT_AUDIT_LIMIT, 1), MAX_AUDIT_LIMIT))}
                    type="number"
                    value={draftLimit}
                  />
                </label>
              </div>
              <div className="filter-drawer-actions">
                <ClearFiltersButton disabled={!hasActiveFilters} onClick={handleClearFilters} />
                <button className="primary-button" onClick={handleApplyFilters} type="button">Aplicar filtros</button>
              </div>
            </aside>
          </div>
        ) : null}

        <div className="audit-retention-note">
          <ShieldCheck aria-hidden="true" size={17} />
          Estes registros são permanentes e não podem ser apagados pelo sistema.
        </div>

        {isLogsLoading ? <div className="inline-loading">Atualizando logs...</div> : null}
        <div className={`records-table-shell ${isLogsLoading ? "is-loading" : ""}`}>
          <table className="records-table audit-logs-table">
            <thead>
              <tr>
                <th>Data e hora</th>
                <th>Tela</th>
                <th>Ação</th>
                <th>Registro</th>
                <th>Detalhes da alteração</th>
                <th>Operador</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6}>Nenhum log encontrado.</td>
                </tr>
              ) : logs.map((log) => (
                <tr key={log.id}>
                  <td>{formatDateTime(log.createdAt)}</td>
                  <td>{formatEntity(log.entity)}</td>
                  <td><span className="table-status is-finalized">{getActionLabel(log.action)}</span></td>
                  <td>{readAuditTarget(log)}</td>
                  <td className="audit-details-cell">{readAuditDetails(log)}</td>
                  <td>{log.user ? `${log.user.name} (${log.user.login})` : "Sistema"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pagination-bar">
          <span>Página {page} de {totalPages}</span>
          <div>
            <button disabled={page === 1 || isLogsLoading} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button">
              <ChevronLeft size={16} />
              Anterior
            </button>
            <button disabled={page === totalPages || isLogsLoading} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} type="button">
              Próxima
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>
    </section>
  );
}