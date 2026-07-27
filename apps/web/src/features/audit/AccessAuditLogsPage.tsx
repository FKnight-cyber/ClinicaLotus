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
  entity: "access_group" | "access_user" | "anamnesis_record" | "AnamnesisRecord" | "medical_evolution";
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
const DEFAULT_AUDIT_LIMIT = 40;
const MAX_AUDIT_LIMIT = 100;

type StoredAuditFilters = {
  search?: string;
  selectedEntity?: string;
  selectedAction?: string;
  limit?: number;
};

type AuditEntityFilter = "" | AccessAuditLog["entity"];

type AuditEntityOption = {
  value: Exclude<AuditEntityFilter, "">;
  label: string;
};

type AuditLogsPageConfig = {
  title: string;
  description: string;
  permission: string;
  permissionMessage: string;
  endpoint: string;
  entityOptions: AuditEntityOption[];
  actionLabels: Record<string, string>;
};

const accessAuditConfig: AuditLogsPageConfig = {
  title: "Logs do Controle de acessos",
  description: "Consulte o histórico permanente de alterações feitas em grupos, permissões e usuários.",
  permission: "audit.access.read",
  permissionMessage: "Seu usuário não possui permissão para visualizar logs do controle de acessos.",
  endpoint: "/api/access/audit-logs",
  entityOptions: [
    { value: "access_group", label: "Grupos e acessos" },
    { value: "access_user", label: "Gerenciar usuários" }
  ],
  actionLabels: {
  create_group: "Grupo criado",
  update_group_permissions: "Permissões do grupo atualizadas",
  create_user: "Usuário criado",
  update_user: "Dados do usuário atualizados",
  update_user_groups: "Grupos do usuário atualizados",
  update_user_status: "Status do usuário atualizado"
  }
};

export const anamnesisAuditConfig: AuditLogsPageConfig = {
  title: "Logs de Anamnese",
  description: "Consulte eventos relevantes do fluxo clínico sem registrar cada salvamento de rascunho.",
  permission: "audit.anamnesis.read",
  permissionMessage: "Seu usuário não possui permissão para visualizar logs de anamnese.",
  endpoint: "/api/access/audit-logs/anamnesis",
  entityOptions: [{ value: "anamnesis_record", label: "Anamnese" }],
  actionLabels: {
    create_anamnesis_template: "Ficha personalizada criada",
    complete_anamnesis_template: "Ficha concluída",
    finalize_anamnesis: "Anamnese finalizada",
    emit_anamnesis_pdf: "PDF completo emitido",
    emit_anamnesis_template_pdf: "PDF da ficha emitido",
    COMPLETE_TEMPLATE: "Ficha concluída",
    FINALIZE: "Anamnese finalizada",
    EMIT_PDF: "PDF completo emitido",
    EMIT_TEMPLATE_PDF: "PDF da ficha emitido"
  }
};

export const medicalEvolutionAuditConfig: AuditLogsPageConfig = {
  title: "Logs de Evoluções",
  description: "Consulte as finalizações de evoluções clínicas registradas no prontuário.",
  permission: "audit.medical_evolutions.read",
  permissionMessage: "Seu usuário não possui permissão para visualizar logs de evoluções.",
  endpoint: "/api/access/audit-logs/medical-evolutions",
  entityOptions: [{ value: "medical_evolution", label: "Evoluções" }],
  actionLabels: {
    finalize_medical_evolution: "Evolução finalizada"
  }
};

function buildAuditLogsPath(endpoint: string, limit: number, page: number, search: string, entity: string, action: string) {
  const params = new URLSearchParams({ limit: String(limit), page: String(page) });
  const normalizedSearch = search.trim();
  if (normalizedSearch) params.set("search", normalizedSearch);
  if (entity) params.set("entity", entity);
  if (action) params.set("action", action);
  return `${endpoint}?${params.toString()}`;
}

function buildAuditLogsCacheKey(limit: number, page: number, search: string, entity: string, action: string) {
  return `${limit}:${page}:${search.trim().toLowerCase()}:${entity}:${action}`;
}

function buildAuditFiltersStorageKey(endpoint: string) {
  return `audit-logs:filters:${endpoint}`;
}

function normalizeStoredLimit(limit?: number) {
  if (typeof limit !== "number" || !Number.isFinite(limit)) return DEFAULT_AUDIT_LIMIT;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_AUDIT_LIMIT);
}

function readStoredAuditFilters(endpoint: string, entityOptions: AuditEntityOption[], actionLabels: Record<string, string>) {
  if (typeof window === "undefined") return null;

  try {
    const storedValue = window.localStorage.getItem(buildAuditFiltersStorageKey(endpoint));
    if (!storedValue) return null;

    const storedFilters = JSON.parse(storedValue) as StoredAuditFilters;
    const allowedEntities = entityOptions.map((entityOption) => entityOption.value);
    const allowedActions = Object.keys(actionLabels);
    return {
      search: typeof storedFilters.search === "string" ? storedFilters.search : "",
      selectedEntity: storedFilters.selectedEntity && allowedEntities.includes(storedFilters.selectedEntity as Exclude<AuditEntityFilter, "">) ? storedFilters.selectedEntity as AuditEntityFilter : "",
      selectedAction: storedFilters.selectedAction && allowedActions.includes(storedFilters.selectedAction) ? storedFilters.selectedAction : "",
      limit: normalizeStoredLimit(storedFilters.limit)
    };
  } catch {
    return null;
  }
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function formatEntity(entity: AccessAuditLog["entity"]) {
  if (entity === "access_group") return "Grupos e acessos";
  if (entity === "anamnesis_record" || entity === "AnamnesisRecord") return "Anamnese";
  if (entity === "medical_evolution") return "Evoluções";
  return "Gerenciar usuários";
}

function getActionLabel(action: string, actionLabels: Record<string, string>) {
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
      code?: string;
      patientName?: string;
      fileName?: string;
      professionalArea?: string | null;
      professionalName?: string | null;
      finalizedAt?: string | null;
      record?: { code?: string; patientName?: string };
      createdTemplates?: Array<{ title?: string; shortTitle?: string }>;
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

  if (log.action === "create_anamnesis_template") {
    const createdTemplates = afterPayload?.createdTemplates?.map((template) => template.title ?? template.shortTitle).filter(Boolean) ?? [];
    return createdTemplates.length > 0 ? `Ficha criada: ${createdTemplates.join(", ")}.` : "Ficha personalizada criada.";
  }

  if (log.action === "complete_anamnesis_template" || log.action === "COMPLETE_TEMPLATE") return "Ficha concluída e bloqueada como marco clínico.";
  if (log.action === "finalize_anamnesis" || log.action === "FINALIZE") return "Anamnese completa finalizada e enviada ao prontuário.";
  if (log.action === "emit_anamnesis_pdf" || log.action === "EMIT_PDF") return `PDF completo emitido${afterPayload?.fileName ? `: ${afterPayload.fileName}` : ""}.`;
  if (log.action === "emit_anamnesis_template_pdf" || log.action === "EMIT_TEMPLATE_PDF") return `PDF parcial emitido${afterPayload?.fileName ? `: ${afterPayload.fileName}` : ""}.`;

  if (log.action === "finalize_medical_evolution") {
    const professional = afterPayload?.professionalName ? ` por ${afterPayload.professionalName}` : "";
    const area = afterPayload?.professionalArea ? ` (${afterPayload.professionalArea})` : "";
    const finalizedAt = afterPayload?.finalizedAt ? ` em ${formatDateTime(afterPayload.finalizedAt)}` : "";
    return `Evolução finalizada${professional}${area}${finalizedAt}.`;
  }

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
    const parsed = JSON.parse(payload) as { name?: string; login?: string; code?: string; patientName?: string; professionalName?: string | null; professionalArea?: string | null; record?: { code?: string; patientName?: string } };
    if (parsed.record?.code) return `${parsed.record.code}${parsed.record.patientName ? ` - ${parsed.record.patientName}` : ""}`;
    if (parsed.code) return `${parsed.code}${parsed.patientName ? ` - ${parsed.patientName}` : ""}`;
    if (parsed.professionalName) return `${parsed.professionalName}${parsed.professionalArea ? ` - ${parsed.professionalArea}` : ""}`;
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

type AccessAuditLogsPageProps = {
  config?: AuditLogsPageConfig;
};

export function AccessAuditLogsPage({ config = accessAuditConfig }: AccessAuditLogsPageProps) {
  const { hasPermission, token } = useAuth();
  const logsCacheRef = useRef(new Map<string, PaginatedAccessAuditLogs>());
  const [initialFilters] = useState(() => readStoredAuditFilters(config.endpoint, config.entityOptions, config.actionLabels));
  const auditActionOptions = Object.entries(config.actionLabels).map(([value, label]) => ({ value, label }));
  const [logs, setLogs] = useState<AccessAuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(initialFilters?.limit ?? DEFAULT_AUDIT_LIMIT);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(initialFilters?.search ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(initialFilters?.search ?? "");
  const [selectedEntity, setSelectedEntity] = useState<AuditEntityFilter>(initialFilters?.selectedEntity ?? "");
  const [selectedAction, setSelectedAction] = useState(initialFilters?.selectedAction ?? "");
  const [draftSearch, setDraftSearch] = useState(initialFilters?.search ?? "");
  const [draftSelectedEntity, setDraftSelectedEntity] = useState<AuditEntityFilter>(initialFilters?.selectedEntity ?? "");
  const [draftSelectedAction, setDraftSelectedAction] = useState(initialFilters?.selectedAction ?? "");
  const [draftLimit, setDraftLimit] = useState(initialFilters?.limit ?? DEFAULT_AUDIT_LIMIT);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLogsLoading, setIsLogsLoading] = useState(true);

  const canReadAuditLogs = hasPermission(config.permission);
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

    const nextLogsPage = await apiRequest<PaginatedAccessAuditLogs>(token, buildAuditLogsPath(config.endpoint, nextLimit, nextPage, nextSearch, nextEntity, nextAction));
    logsCacheRef.current.set(cacheKey, nextLogsPage);
    return nextLogsPage;
  }, [token, config.endpoint]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    window.localStorage.setItem(buildAuditFiltersStorageKey(config.endpoint), JSON.stringify({
      search,
      selectedEntity,
      selectedAction,
      limit
    }));
  }, [config.endpoint, search, selectedEntity, selectedAction, limit]);

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
            <p>{config.permissionMessage}</p>
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
          <h2>{config.title}</h2>
          <p>{config.description}</p>
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
                    {config.entityOptions.map((entityOption) => <option key={entityOption.value} value={entityOption.value}>{entityOption.label}</option>)}
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
                  <td><span className="table-status is-finalized">{getActionLabel(log.action, config.actionLabels)}</span></td>
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