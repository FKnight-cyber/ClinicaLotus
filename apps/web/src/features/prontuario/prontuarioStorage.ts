import type { ClinicalDocumentSummary, MedicalEvolution, MedicalEvolutionPayload, MedicalRecordEntry, PaginatedResponse, PatientSummary } from "./prontuarioTypes";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
const patientsCacheTtlMs = 15 * 1000;
const evolutionsCacheTtlMs = 15 * 1000;
const patientsCache = new Map<string, { expiresAt: number; promise?: Promise<PaginatedResponse<PatientSummary>>; value?: PaginatedResponse<PatientSummary> }>();
const evolutionsCache = new Map<string, { expiresAt: number; promise?: Promise<PaginatedResponse<MedicalEvolution>>; value?: PaginatedResponse<MedicalEvolution> }>();

type ListQueryOptions = {
  clinicScope?: "network";
  clinicId?: string;
  scopeKey?: string;
  limit: number;
  offset: number;
};

function buildPatientsCacheKey(token: string, search: string, options: ListQueryOptions) {
  return `${token}:prontuario-patients:${options.scopeKey || options.clinicScope || options.clinicId || "active"}:${search.trim().toLowerCase()}:${options.limit}:${options.offset}`;
}

function buildEvolutionsCacheKey(token: string, patientId: string, options: ListQueryOptions) {
  return `${token}:medical-evolutions:${options.scopeKey || options.clinicScope || options.clinicId || "active"}:${patientId}:${options.limit}:${options.offset}`;
}

function buildListQuery(options: ListQueryOptions, search?: string) {
  const params = new URLSearchParams({
    limit: String(options.limit),
    offset: String(options.offset)
  });

  if (search?.trim()) {
    params.set("search", search.trim());
  }

  if (options.clinicId) {
    params.set("clinicId", options.clinicId);
  }

  if (options.clinicScope) {
    params.set("clinicScope", options.clinicScope);
  }

  return params.toString();
}

function buildClinicQuery(clinicId?: string) {
  const params = new URLSearchParams();
  if (clinicId) params.set("clinicId", clinicId);
  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

function normalizePaginatedResponse<T>(payload: PaginatedResponse<T> | T[], options: ListQueryOptions): PaginatedResponse<T> {
  if (Array.isArray(payload)) {
    return {
      items: payload,
      total: payload.length,
      limit: options.limit,
      offset: options.offset
    };
  }

  return payload;
}

function getCached<T>(cache: Map<string, { expiresAt: number; promise?: Promise<T>; value?: T }>, key: string, ttlMs: number, loader: () => Promise<T>) {
  const now = Date.now();
  const cached = cache.get(key);

  if (cached?.value && cached.expiresAt > now) {
    return Promise.resolve(cached.value);
  }

  if (cached?.promise && cached.expiresAt > now) {
    return cached.promise;
  }

  const promise = loader().then((value) => {
    cache.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  }).catch((error) => {
    cache.delete(key);
    throw error;
  });

  cache.set(key, { promise, expiresAt: now + ttlMs });
  return promise;
}

function getCachedEvolutions(token: string, patientId: string, options: ListQueryOptions, loader: () => Promise<PaginatedResponse<MedicalEvolution>>) {
  return getCached(evolutionsCache, buildEvolutionsCacheKey(token, patientId, options), evolutionsCacheTtlMs, loader);
}

function invalidateEvolutions(token: string, patientId: string) {
  for (const key of evolutionsCache.keys()) {
    if (key.startsWith(`${token}:medical-evolutions:`) && key.includes(`:${patientId}:`)) {
      evolutionsCache.delete(key);
    }
  }
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
    throw new Error(payload?.message ?? "Não foi possível concluir a operação.");
  }

  return response.json() as Promise<T>;
}

export function fetchProntuarioPatients(token: string, search = "", options: ListQueryOptions): Promise<PaginatedResponse<PatientSummary>> {
  const params = new URLSearchParams(buildListQuery(options, search));
  params.set("status", "ACTIVE");

  return getCached(patientsCache, buildPatientsCacheKey(token, search, options), patientsCacheTtlMs, () => (
    apiRequest<PaginatedResponse<PatientSummary> | PatientSummary[]>(token, `/api/patients?${params.toString()}`)
      .then((payload) => normalizePaginatedResponse(payload, options))
  ));
}

export function fetchProntuarioTimeline(token: string, patientId: string, options: ListQueryOptions): Promise<PaginatedResponse<MedicalRecordEntry>> {
  return apiRequest<PaginatedResponse<MedicalRecordEntry> | MedicalRecordEntry[]>(token, `/api/patients/${patientId}/prontuario?${buildListQuery(options)}`)
    .then((payload) => normalizePaginatedResponse(payload, options));
}

export function fetchMedicalEvolutions(token: string, patientId: string, options: ListQueryOptions) {
  return getCachedEvolutions(token, patientId, options, () => apiRequest<PaginatedResponse<MedicalEvolution> | MedicalEvolution[]>(token, `/api/patients/${patientId}/evolutions?${buildListQuery(options)}`)
    .then((payload) => normalizePaginatedResponse(payload, options)));
}

export function fetchMedicalEvolution(token: string, evolutionId: string, clinicId?: string) {
  return apiRequest<MedicalEvolution>(token, `/api/medical-evolutions/${evolutionId}${buildClinicQuery(clinicId)}`);
}

export async function createMedicalEvolution(token: string, patientId: string, payload: MedicalEvolutionPayload) {
  const evolution = await apiRequest<MedicalEvolution>(token, `/api/patients/${patientId}/evolutions`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
  invalidateEvolutions(token, patientId);
  return evolution;
}

export async function updateMedicalEvolution(token: string, evolutionId: string, patientId: string, payload: MedicalEvolutionPayload, clinicId?: string) {
  const evolution = await apiRequest<MedicalEvolution>(token, `/api/medical-evolutions/${evolutionId}${buildClinicQuery(clinicId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
  invalidateEvolutions(token, patientId);
  return evolution;
}

export async function finalizeMedicalEvolution(token: string, evolution: MedicalEvolution, clinicId?: string) {
  const finalizedEvolution = await apiRequest<MedicalEvolution>(token, `/api/medical-evolutions/${evolution.id}/finalize${buildClinicQuery(clinicId)}`, {
    method: "POST"
  });
  invalidateEvolutions(token, evolution.patientId);
  return finalizedEvolution;
}

export async function cancelMedicalEvolution(token: string, evolution: MedicalEvolution, reason: string, clinicId?: string) {
  const canceledEvolution = await apiRequest<MedicalEvolution>(token, `/api/medical-evolutions/${evolution.id}/cancel${buildClinicQuery(clinicId)}`, {
    method: "POST",
    body: JSON.stringify({ reason })
  });
  invalidateEvolutions(token, evolution.patientId);
  return canceledEvolution;
}

export function emitMedicalEvolutionPdfDocument(token: string, evolutionId: string, clinicId?: string) {
  return apiRequest<ClinicalDocumentSummary>(token, `/api/medical-evolutions/${evolutionId}/documents/pdf${buildClinicQuery(clinicId)}`, {
    method: "POST"
  });
}