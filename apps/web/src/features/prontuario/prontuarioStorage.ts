import type { ClinicalDocumentSummary, MedicalEvolution, MedicalEvolutionPayload, MedicalRecordEntry, PaginatedResponse, PatientSummary } from "./prontuarioTypes";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
const evolutionsCacheTtlMs = 15 * 1000;
const evolutionsCache = new Map<string, { expiresAt: number; promise?: Promise<PaginatedResponse<MedicalEvolution>>; value?: PaginatedResponse<MedicalEvolution> }>();

type ListQueryOptions = {
  limit: number;
  offset: number;
};

function buildCacheKey(token: string, patientId: string, options: ListQueryOptions) {
  return `${token}:medical-evolutions:${patientId}:${options.limit}:${options.offset}`;
}

function buildListQuery(options: ListQueryOptions, search?: string) {
  const params = new URLSearchParams({
    limit: String(options.limit),
    offset: String(options.offset)
  });

  if (search?.trim()) {
    params.set("search", search.trim());
  }

  return params.toString();
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

function getCachedEvolutions(token: string, patientId: string, options: ListQueryOptions, loader: () => Promise<PaginatedResponse<MedicalEvolution>>) {
  const key = buildCacheKey(token, patientId, options);
  const now = Date.now();
  const cached = evolutionsCache.get(key);

  if (cached?.value && cached.expiresAt > now) {
    return Promise.resolve(cached.value);
  }

  if (cached?.promise && cached.expiresAt > now) {
    return cached.promise;
  }

  const promise = loader().then((value) => {
    evolutionsCache.set(key, { value, expiresAt: Date.now() + evolutionsCacheTtlMs });
    return value;
  }).catch((error) => {
    evolutionsCache.delete(key);
    throw error;
  });

  evolutionsCache.set(key, { promise, expiresAt: now + evolutionsCacheTtlMs });
  return promise;
}

function invalidateEvolutions(token: string, patientId: string) {
  const cachePrefix = `${token}:medical-evolutions:${patientId}:`;
  for (const key of evolutionsCache.keys()) {
    if (key.startsWith(cachePrefix)) {
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
    throw new Error(payload?.message ?? "Nao foi possivel concluir a operacao.");
  }

  return response.json() as Promise<T>;
}

export function fetchProntuarioPatients(token: string, search = "", options: ListQueryOptions): Promise<PaginatedResponse<PatientSummary>> {
  return apiRequest<PaginatedResponse<PatientSummary> | PatientSummary[]>(token, `/api/patients?${buildListQuery(options, search)}`)
    .then((payload) => normalizePaginatedResponse(payload, options));
}

export function fetchProntuarioTimeline(token: string, patientId: string, options: ListQueryOptions): Promise<PaginatedResponse<MedicalRecordEntry>> {
  return apiRequest<PaginatedResponse<MedicalRecordEntry> | MedicalRecordEntry[]>(token, `/api/patients/${patientId}/prontuario?${buildListQuery(options)}`)
    .then((payload) => normalizePaginatedResponse(payload, options));
}

export function fetchMedicalEvolutions(token: string, patientId: string, options: ListQueryOptions) {
  return getCachedEvolutions(token, patientId, options, () => apiRequest<PaginatedResponse<MedicalEvolution> | MedicalEvolution[]>(token, `/api/patients/${patientId}/evolutions?${buildListQuery(options)}`)
    .then((payload) => normalizePaginatedResponse(payload, options)));
}

export async function createMedicalEvolution(token: string, patientId: string, payload: MedicalEvolutionPayload) {
  const evolution = await apiRequest<MedicalEvolution>(token, `/api/patients/${patientId}/evolutions`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
  invalidateEvolutions(token, patientId);
  return evolution;
}

export async function updateMedicalEvolution(token: string, evolutionId: string, patientId: string, payload: MedicalEvolutionPayload) {
  const evolution = await apiRequest<MedicalEvolution>(token, `/api/medical-evolutions/${evolutionId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
  invalidateEvolutions(token, patientId);
  return evolution;
}

export async function finalizeMedicalEvolution(token: string, evolution: MedicalEvolution) {
  const finalizedEvolution = await apiRequest<MedicalEvolution>(token, `/api/medical-evolutions/${evolution.id}/finalize`, {
    method: "POST"
  });
  invalidateEvolutions(token, evolution.patientId);
  return finalizedEvolution;
}

export async function cancelMedicalEvolution(token: string, evolution: MedicalEvolution, reason: string) {
  const canceledEvolution = await apiRequest<MedicalEvolution>(token, `/api/medical-evolutions/${evolution.id}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason })
  });
  invalidateEvolutions(token, evolution.patientId);
  return canceledEvolution;
}

export function emitMedicalEvolutionPdfDocument(token: string, evolutionId: string) {
  return apiRequest<ClinicalDocumentSummary>(token, `/api/medical-evolutions/${evolutionId}/documents/pdf`, {
    method: "POST"
  });
}