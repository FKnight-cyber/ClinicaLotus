"use client";

import { ChevronLeft, ChevronRight, Eye, Filter, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import { createAnamneseRecord, deleteAnamneseDraftRecord, fetchAnamneseRecords, fetchAnamneseTemplates, formatDateTime, getPatientName, requiredProgress } from "./storage";
import { anamneseTemplates as fallbackTemplates } from "./templates";
import type { AnamneseRecord, FormTemplate } from "./types";

const pageSize = 6;

type StatusFilter = "all" | "draft" | "finalized";
type RequiredFilter = "all" | "complete" | "pending";

type ListFilters = {
  patient: string;
  code: string;
  status: StatusFilter;
  required: RequiredFilter;
  updatedFrom: string;
  updatedTo: string;
};

const emptyFilters: ListFilters = {
  patient: "",
  code: "",
  status: "all",
  required: "all",
  updatedFrom: "",
  updatedTo: ""
};

export function AnamneseListPage() {
  const router = useRouter();
  const { hasPermission, token } = useAuth();
  const canCreateAnamnese = hasPermission("anamnese.create");
  const canDeleteDraftAnamnese = hasPermission("admin.full_access");
  const [records, setRecords] = useState<AnamneseRecord[]>([]);
  const [templates, setTemplates] = useState<FormTemplate[]>(fallbackTemplates);
  const [filters, setFilters] = useState<ListFilters>(emptyFilters);
  const [recordPendingDeletion, setRecordPendingDeletion] = useState<AnamneseRecord | null>(null);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);
  const [message, setMessage] = useState("Registros disponíveis para consulta");

  useEffect(() => {
    if (!token) return;
    let isCurrent = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);

    Promise.all([fetchAnamneseRecords(token), fetchAnamneseTemplates(token)])
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
  }, [token]);

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const progress = requiredProgress(record, templates);
      const patientMatches = getPatientName(record).toLowerCase().includes(filters.patient.trim().toLowerCase());
      const codeMatches = record.code.toLowerCase().includes(filters.code.trim().toLowerCase());
      const statusMatches = filters.status === "all" || record.status === filters.status;
      const requiredMatches = filters.required === "all" || (filters.required === "complete" ? progress.complete === progress.total : progress.complete < progress.total);
      const updatedAt = record.updatedAt.slice(0, 10);
      const updatedFromMatches = !filters.updatedFrom || updatedAt >= filters.updatedFrom;
      const updatedToMatches = !filters.updatedTo || updatedAt <= filters.updatedTo;

      return patientMatches && codeMatches && statusMatches && requiredMatches && updatedFromMatches && updatedToMatches;
    });
  }, [filters, records, templates]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRecords = filteredRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const activeFilterCount = Object.entries(filters).filter(([key, value]) => key === "status" || key === "required" ? value !== "all" : Boolean(value)).length;

  async function createRecord() {
    if (!token) return;
    setMessage("Criando rascunho no banco...");
    const record = await createAnamneseRecord(token, { patientName: "Paciente sem nome" });
    setRecords((currentRecords) => [record, ...currentRecords]);
    router.push(`/anamnese/${record.id}`);
  }

  async function confirmDeleteDraft() {
    if (!token || !recordPendingDeletion || recordPendingDeletion.status !== "draft") return;

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

  function clearFilters() {
    setFilters(emptyFilters);
    setPage(1);
    setMessage("Filtros limpos");
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
            <button className="primary-button" onClick={createRecord} type="button">
              <Plus size={17} />
              Nova anamnese
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

      <div className="records-table-shell">
        <table className="records-table">
          <thead>
            <tr>
              <th>Paciente</th>
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
                <td colSpan={6}>Nenhum registro encontrado.</td>
              </tr>
            ) : (
              pageRecords.map((record) => {
                const progress = requiredProgress(record, templates);
                return (
                  <tr key={record.id}>
                    <td>
                      <strong>{getPatientName(record)}</strong>
                    </td>
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
                        <button className="table-action" onClick={() => router.push(`/anamnese/${record.id}`)} type="button">
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

      {recordPendingDeletion ? (
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
