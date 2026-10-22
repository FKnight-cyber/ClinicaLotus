"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Boxes, Check, ChevronLeft, ChevronRight, Edit3, Printer, Search, X } from "lucide-react";
import { ClearFiltersButton, FilterButton } from "@/components/filters/FilterActionButtons";
import { useAuth } from "@/features/auth/AuthProvider";

type InventoryEntry = {
  id: string;
  clinicId: string;
  productName: string;
  quantity: number;
  unitPrice: string | number;
  entryDate: string;
  clinic: { id: string; name: string };
};

type InventoryPageResult = {
  items: InventoryEntry[];
  total: number;
  limit: number;
  page: number;
  totalPages: number;
};

type InventoryFilters = {
  search: string;
  clinicId: string;
  from: string;
  to: string;
  limit: number;
};

type InventoryForm = {
  productName: string;
  quantity: string;
  unitPrice: string;
  entryDate: string;
  clinicId: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
const FILTER_STORAGE_KEY = "clinica.inventory.filters";
const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 100;
const SEARCH_DELAY_MS = 350;

function todayDateValue() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function readInventoryFilters(): InventoryFilters {
  const defaults = { search: "", clinicId: "", from: "", to: "", limit: DEFAULT_LIMIT };
  if (typeof window === "undefined") return defaults;
  try {
    const stored = window.localStorage.getItem(FILTER_STORAGE_KEY);
    if (!stored) return defaults;
    const value = JSON.parse(stored) as Partial<InventoryFilters>;
    return {
      search: typeof value.search === "string" ? value.search : "",
      clinicId: typeof value.clinicId === "string" ? value.clinicId : "",
      from: typeof value.from === "string" ? value.from : "",
      to: typeof value.to === "string" ? value.to : "",
      limit: typeof value.limit === "number" ? Math.min(Math.max(Math.trunc(value.limit), 1), MAX_LIMIT) : DEFAULT_LIMIT
    };
  } catch {
    window.localStorage.removeItem(FILTER_STORAGE_KEY);
    return defaults;
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(new Date(value));
}

function formatCurrency(value: string | number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}

function buildInventoryPath(filters: InventoryFilters, page: number, search: string) {
  const params = new URLSearchParams({ limit: String(filters.limit), page: String(page) });
  if (search.trim()) params.set("search", search.trim());
  if (filters.clinicId) params.set("clinicId", filters.clinicId);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  return `/api/inventory/entries?${params.toString()}`;
}

async function apiRequest<T>(token: string, path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...options.headers }
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message ?? "Não foi possível concluir a operação de estoque.");
  }
  return response.json() as Promise<T>;
}

export function InventoryPage() {
  const { clinics, hasPermission, token } = useAuth();
  const canRead = hasPermission("inventory.read");
  const canManage = hasPermission("inventory.manage");
  const canReport = hasPermission("inventory.report");
  const cacheRef = useRef(new Map<string, InventoryPageResult>());
  const [filters, setFilters] = useState(readInventoryFilters);
  const [draftFilters, setDraftFilters] = useState(filters);
  const [page, setPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search);
  const [entries, setEntries] = useState<InventoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<InventoryEntry | null>(null);
  const [editDraft, setEditDraft] = useState({ productName: "", quantity: "1", unitPrice: "", entryDate: "" });
  const [receiptDate, setReceiptDate] = useState(todayDateValue);
  const [form, setForm] = useState<InventoryForm>({ productName: "", quantity: "1", unitPrice: "", entryDate: todayDateValue(), clinicId: "" });
  const selectedClinicId = form.clinicId || clinics.find((clinic) => clinic.isDefault)?.id || clinics[0]?.id || "";

  const activeFilterCount = [filters.search.trim(), filters.clinicId, filters.from, filters.to, filters.limit !== DEFAULT_LIMIT ? String(filters.limit) : ""].filter(Boolean).length;
  const selectedEntries = useMemo(() => entries.filter((entry) => selectedIds.includes(entry.id)), [entries, selectedIds]);
  const selectedTotal = selectedEntries.reduce((sum, entry) => sum + Number(entry.unitPrice) * entry.quantity, 0);
  const allVisibleSelected = entries.length > 0 && entries.every((entry) => selectedIds.includes(entry.id));

  useEffect(() => {
    window.localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
  }, [filters]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedSearch(filters.search), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timeoutId);
  }, [filters.search]);

  useEffect(() => {
    if (!token || !canRead) return;
    let isCurrent = true;
    const path = buildInventoryPath(filters, page, debouncedSearch);
    const cached = cacheRef.current.get(path);
    setIsLoading(!cached);
    if (cached) {
      setEntries(cached.items);
      setTotal(cached.total);
      setTotalPages(cached.totalPages);
      setIsLoading(false);
    }
    apiRequest<InventoryPageResult>(token, path).then((result) => {
      if (!isCurrent) return;
      cacheRef.current.set(path, result);
      setEntries(result.items);
      setTotal(result.total);
      setTotalPages(result.totalPages);
      setSelectedIds([]);
      setIsLoading(false);
    }).catch((error) => {
      if (!isCurrent) return;
      setMessage(error instanceof Error ? error.message : "Não foi possível carregar o estoque.");
      setIsLoading(false);
    });
    return () => { isCurrent = false; };
  }, [canRead, debouncedSearch, filters, page, token]);

  const handleCreateEntry = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !canManage || !selectedClinicId) return;
    setIsSaving(true);
    setMessage(null);
    try {
      await apiRequest<InventoryEntry>(token, "/api/inventory/entries", {
        method: "POST",
        body: JSON.stringify({
          clinicId: selectedClinicId,
          productName: form.productName.trim(),
          quantity: Number(form.quantity),
          unitPrice: Number(form.unitPrice),
          entryDate: `${form.entryDate}T00:00:00.000Z`
        })
      });
      cacheRef.current.clear();
      setPage(1);
      setMessage("Entrada de produto registrada.");
      setForm((current) => ({ ...current, productName: "", quantity: "1", unitPrice: "", entryDate: todayDateValue() }));
      const result = await apiRequest<InventoryPageResult>(token, buildInventoryPath(filters, 1, debouncedSearch));
      setEntries(result.items);
      setTotal(result.total);
      setTotalPages(result.totalPages);
      cacheRef.current.set(buildInventoryPath(filters, 1, debouncedSearch), result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível registrar a entrada.");
    } finally {
      setIsSaving(false);
    }
  };

  const openEditEntry = (entry: InventoryEntry) => {
    setEditingEntry(entry);
    setEditDraft({
      productName: entry.productName,
      quantity: String(entry.quantity),
      unitPrice: String(entry.unitPrice),
      entryDate: entry.entryDate.slice(0, 10)
    });
  };

  const handleSaveEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !editingEntry || !canManage) return;
    setIsSavingEdit(true);
    setMessage(null);
    try {
      await apiRequest<InventoryEntry>(token, `/api/inventory/entries/${editingEntry.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          productName: editDraft.productName.trim(),
          quantity: Number(editDraft.quantity),
          unitPrice: Number(editDraft.unitPrice),
          entryDate: `${editDraft.entryDate}T00:00:00.000Z`
        })
      });
      cacheRef.current.clear();
      const path = buildInventoryPath(filters, page, debouncedSearch);
      const result = await apiRequest<InventoryPageResult>(token, path);
      cacheRef.current.set(path, result);
      setEntries(result.items);
      setTotal(result.total);
      setTotalPages(result.totalPages);
      setEditingEntry(null);
      setMessage("Entrada de estoque atualizada.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível atualizar a entrada.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const openFilters = () => {
    setDraftFilters(filters);
    setIsFilterOpen(true);
  };

  const applyFilters = () => {
    setFilters(draftFilters);
    setPage(1);
    setSelectedIds([]);
    setIsFilterOpen(false);
  };

  const clearFilters = () => {
    const emptyFilters = { search: "", clinicId: "", from: "", to: "", limit: DEFAULT_LIMIT };
    setFilters(emptyFilters);
    setDraftFilters(emptyFilters);
    setPage(1);
    setSelectedIds([]);
    setIsFilterOpen(false);
  };

  const toggleAllVisible = () => setSelectedIds(allVisibleSelected ? [] : entries.map((entry) => entry.id));
  const toggleEntry = (entryId: string) => setSelectedIds((current) => current.includes(entryId) ? current.filter((id) => id !== entryId) : [...current, entryId]);

  if (!canRead) {
    return <section className="placeholder-page"><div className="page-intro"><div className="intro-icon"><Boxes size={28} /></div><div><span className="eyebrow">Estoque</span><h2>Permissão necessária</h2><p>Seu usuário não possui permissão para visualizar as entradas de estoque.</p></div></div></section>;
  }

  return (
    <section className="access-page inventory-page">
      <div className="list-header">
        <div><span className="eyebrow">Operação</span><h2>Estoque</h2><p>Registro de entradas de produtos por clínica.</p></div>
        <span className="status-badge"><Boxes aria-hidden="true" size={17} />{total} entradas</span>
      </div>

      {message ? <div className="access-message" role="status">{message}</div> : null}

      {canManage ? (
        <section className="plain-panel inventory-entry-panel">
          <h3>Registrar entrada</h3>
          <form className="inventory-entry-form" onSubmit={handleCreateEntry}>
            <label className="inventory-product-field"><span>Produto</span><input maxLength={160} onChange={(event) => setForm((current) => ({ ...current, productName: event.target.value }))} required value={form.productName} /></label>
            <label><span>Quantidade</span><input min="1" onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))} required type="number" value={form.quantity} /></label>
            <label><span>Preço unitário</span><input min="0" onChange={(event) => setForm((current) => ({ ...current, unitPrice: event.target.value }))} required step="0.01" type="number" value={form.unitPrice} /></label>
            <label><span>Data de entrada</span><input onChange={(event) => setForm((current) => ({ ...current, entryDate: event.target.value }))} required type="date" value={form.entryDate} /></label>
            <label><span>Clínica</span><select onChange={(event) => setForm((current) => ({ ...current, clinicId: event.target.value }))} required value={selectedClinicId}><option value="" disabled>Selecione uma clínica</option>{clinics.map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.name}</option>)}</select></label>
            <button className="primary-button" disabled={isSaving || clinics.length === 0} type="submit"><Check aria-hidden="true" size={17} />{isSaving ? "Salvando..." : "Registrar entrada"}</button>
          </form>
        </section>
      ) : null}

      <section className="plain-panel inventory-list-panel">
        <div className="access-section-title-row inventory-list-heading">
          <div><h3>Entradas registradas</h3><p>{entries.length} de {total} entradas exibidas</p></div>
          <div className="filter-actions-row">
            <FilterButton activeCount={activeFilterCount} onClick={openFilters} />
            <ClearFiltersButton disabled={!activeFilterCount} onClick={clearFilters} />
          </div>
        </div>

        {canReport ? (
          <div className="inventory-report-controls">
            <label><span>Data do recibo</span><input aria-label="Data do recibo" onChange={(event) => setReceiptDate(event.target.value)} type="date" value={receiptDate} /></label>
            <button className="secondary-button" disabled={selectedEntries.length === 0 || !receiptDate} onClick={() => window.print()} type="button"><Printer aria-hidden="true" size={16} />Imprimir recibo ({selectedEntries.length})</button>
          </div>
        ) : null}

        {isLoading ? <div className="inline-loading">Atualizando entradas...</div> : null}
        <div className={`records-table-shell inventory-table-shell ${isLoading ? "is-loading" : ""}`}>
          <table className="records-table inventory-table">
            <thead><tr><th><input aria-label="Selecionar todas as entradas exibidas" checked={allVisibleSelected} onChange={toggleAllVisible} type="checkbox" /></th><th>Produto</th><th>Clínica</th><th>Quantidade</th><th>Preço unitário</th><th>Data de entrada</th><th>Ação</th></tr></thead>
            <tbody>
              {entries.length === 0 ? <tr><td colSpan={7}>Nenhuma entrada encontrada.</td></tr> : entries.map((entry) => (
                <tr key={entry.id}>
                  <td><input aria-label={`Selecionar ${entry.productName}`} checked={selectedIds.includes(entry.id)} onChange={() => toggleEntry(entry.id)} type="checkbox" /></td>
                  <td><strong>{entry.productName}</strong></td><td>{entry.clinic.name}</td><td>{entry.quantity}</td><td>{formatCurrency(entry.unitPrice)}</td><td>{formatDate(entry.entryDate)}</td>
                  <td>{canManage ? <button aria-label={`Editar ${entry.productName}`} className="table-action" onClick={() => openEditEntry(entry)} title="Editar entrada" type="button"><Edit3 aria-hidden="true" size={16} />Editar</button> : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 ? <div className="password-change-pagination"><button aria-label="Página anterior" className="secondary-button" disabled={page <= 1 || isLoading} onClick={() => { setSelectedIds([]); setPage((current) => Math.max(1, current - 1)); }} type="button"><ChevronLeft size={17} />Anterior</button><span>Página {page} de {totalPages}</span><button aria-label="Próxima página" className="secondary-button" disabled={page >= totalPages || isLoading} onClick={() => { setSelectedIds([]); setPage((current) => Math.min(totalPages, current + 1)); }} type="button">Próxima<ChevronRight size={17} /></button></div> : null}
      </section>

      {isFilterOpen ? (
        <div className="filter-drawer-layer" role="presentation">
          <button aria-label="Fechar filtros" className="filter-drawer-backdrop" onClick={() => setIsFilterOpen(false)} type="button" />
          <aside aria-label="Filtros de estoque" className="filter-drawer-panel">
            <div className="filter-drawer-heading"><div><span className="eyebrow">Filtros</span></div><button aria-label="Fechar filtros" className="icon-button" onClick={() => setIsFilterOpen(false)} title="Fechar filtros" type="button"><X aria-hidden="true" size={18} /></button></div>
            <div className="filter-drawer-fields">
              <label><span>Buscar produto</span><div className="inventory-search-input"><Search aria-hidden="true" size={16} /><input onChange={(event) => setDraftFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Nome do produto" value={draftFilters.search} /></div></label>
              <label><span>Clínica</span><select onChange={(event) => setDraftFilters((current) => ({ ...current, clinicId: event.target.value }))} value={draftFilters.clinicId}><option value="">Todas as clínicas</option>{clinics.map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.name}</option>)}</select></label>
              <label><span>Entrada a partir de</span><input onChange={(event) => setDraftFilters((current) => ({ ...current, from: event.target.value }))} type="date" value={draftFilters.from} /></label>
              <label><span>Entrada até</span><input onChange={(event) => setDraftFilters((current) => ({ ...current, to: event.target.value }))} type="date" value={draftFilters.to} /></label>
              <label><span>Nº de entradas exibidas</span><input max={MAX_LIMIT} min={1} onChange={(event) => setDraftFilters((current) => ({ ...current, limit: Math.min(Math.max(Number(event.target.value) || DEFAULT_LIMIT, 1), MAX_LIMIT) }))} type="number" value={draftFilters.limit} /></label>
            </div>
            <div className="filter-drawer-actions"><ClearFiltersButton disabled={!activeFilterCount} onClick={clearFilters} /><button className="primary-button" onClick={applyFilters} type="button">Aplicar filtros</button></div>
          </aside>
        </div>
      ) : null}

      {editingEntry ? (
        <div className="confirmation-modal-layer" role="presentation">
          <button aria-label="Cancelar edição da entrada" className="confirmation-modal-backdrop" disabled={isSavingEdit} onClick={() => setEditingEntry(null)} type="button" />
          <section aria-labelledby="inventory-edit-title" aria-modal="true" className="confirmation-modal-panel inventory-edit-modal" role="dialog">
            <div className="confirmation-modal-heading">
              <span className="confirmation-modal-icon is-primary"><Edit3 aria-hidden="true" size={20} /></span>
              <div><span className="eyebrow">Estoque</span><h3 id="inventory-edit-title">Editar entrada</h3></div>
              <button aria-label="Fechar edição" className="icon-button" disabled={isSavingEdit} onClick={() => setEditingEntry(null)} title="Fechar" type="button"><X aria-hidden="true" size={18} /></button>
            </div>
            <form className="inventory-edit-form" onSubmit={handleSaveEdit}>
              <label><span>Produto</span><input autoFocus maxLength={160} onChange={(event) => setEditDraft((current) => ({ ...current, productName: event.target.value }))} required value={editDraft.productName} /></label>
              <div className="inventory-edit-fields">
                <label><span>Quantidade</span><input min="1" onChange={(event) => setEditDraft((current) => ({ ...current, quantity: event.target.value }))} required type="number" value={editDraft.quantity} /></label>
                <label><span>Preço unitário</span><input min="0" onChange={(event) => setEditDraft((current) => ({ ...current, unitPrice: event.target.value }))} required step="0.01" type="number" value={editDraft.unitPrice} /></label>
              </div>
              <label><span>Data de entrada</span><input onChange={(event) => setEditDraft((current) => ({ ...current, entryDate: event.target.value }))} required type="date" value={editDraft.entryDate} /></label>
              <div className="confirmation-modal-actions">
                <button className="secondary-button" disabled={isSavingEdit} onClick={() => setEditingEntry(null)} type="button">Cancelar</button>
                <button className="primary-button" disabled={isSavingEdit || !editDraft.productName.trim()} type="submit">{isSavingEdit ? "Salvando..." : "Salvar alterações"}</button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {typeof document !== "undefined" ? createPortal(<section className="inventory-print-receipt" aria-label="Recibo de entrada de produtos">
        <header>
          <span>CLÍNICA PSIQUIATRA FLOR DE LOTUS LTDA.</span>
          <p>CNPJ nº 49.447.025/0001-27</p>
          <p>Estrada Eusébio – Lagoa do Mato – Gibóia, s/n, Parque do Castelo, Aquiraz/CE, CEP 61.700-000</p>
          <h1>Recibo de entrada de produtos</h1>
          <p>Data do recibo: {receiptDate ? formatDate(`${receiptDate}T00:00:00.000Z`) : "-"}</p>
        </header>
        <table><thead><tr><th>Produto</th><th>Quantidade</th><th>Preço unitário</th><th>Total</th></tr></thead><tbody>{selectedEntries.map((entry) => <tr key={entry.id}><td>{entry.productName}</td><td>{entry.quantity}</td><td>{formatCurrency(entry.unitPrice)}</td><td>{formatCurrency(Number(entry.unitPrice) * entry.quantity)}</td></tr>)}</tbody></table>
        <p className="inventory-print-count">{selectedEntries.length} {selectedEntries.length === 1 ? "item" : "itens"}</p>
        <p className="inventory-print-grand-total"><strong>Valor total:</strong> {formatCurrency(selectedTotal)}</p>
        <footer><span>Assinatura: __________________________________</span></footer>
      </section>, document.body) : null}
    </section>
  );
}