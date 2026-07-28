"use client";

import { useEffect, useState } from "react";
import { anamneseTemplates } from "./templates";
import type { AnamneseRecord, ClinicalDocumentSummary, FieldValue, FormTemplate, MedicalRecordEntry, PatientSummary, TemplateAnswers, TemplateId, ValidationIssue } from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
const templatesCacheTtlMs = 10 * 60 * 1000;
const recordCacheTtlMs = 5 * 1000;
const patientsCacheTtlMs = 15 * 1000;
const medicalRecordCacheTtlMs = 15 * 1000;

type CacheEntry<T> = {
  expiresAt: number;
  promise?: Promise<T>;
  value?: T;
};

type AnamnesePayload = {
  patientName: string;
  patientId?: string | null;
  answers?: Record<string, TemplateAnswers>;
  customFields?: AnamneseRecord["customFields"];
  templateConfig?: AnamneseRecord["templateConfig"];
};

const anamneseRecordsCache = new Map<string, CacheEntry<AnamneseRecord[]>>();
const anamneseRecordCache = new Map<string, CacheEntry<AnamneseRecord>>();
const anamneseTemplatesCache = new Map<string, CacheEntry<FormTemplate[]>>();
const patientsCache = new Map<string, CacheEntry<PatientSummary[]>>();
const medicalRecordCache = new Map<string, CacheEntry<MedicalRecordEntry[]>>();

function buildCacheKey(token: string, ...parts: string[]) {
  return [token, ...parts].join(":");
}

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string, ttlMs: number, loader: () => Promise<T>) {
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

function setCached<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T, ttlMs: number) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function invalidateAnamneseRecordCaches(token: string, record?: AnamneseRecord) {
  anamneseRecordsCache.delete(buildCacheKey(token, "records"));

  if (record) {
    setCached(anamneseRecordCache, buildCacheKey(token, "record", record.id), record, recordCacheTtlMs);
  }
}

function removeAnamneseRecordFromCache(token: string, recordId: string) {
  anamneseRecordsCache.delete(buildCacheKey(token, "records"));
  anamneseRecordCache.delete(buildCacheKey(token, "record", recordId));
}

function invalidatePatientCaches(token: string, patientId?: string | null) {
  for (const key of patientsCache.keys()) {
    if (key.startsWith(`${token}:patients:`)) {
      patientsCache.delete(key);
    }
  }

  if (patientId) {
    medicalRecordCache.delete(buildCacheKey(token, "medical-record", patientId));
  }
}

async function apiRequest<T>(token: string, path: string, options: RequestInit = {}) {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers
      }
    });
  } catch {
    throw new Error("Não foi possível conectar à API. Verifique a URL da API em produção e tente novamente.");
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message = Array.isArray(payload?.message) ? payload.message.join(" ") : payload?.message;
    throw new Error(message ?? "Não foi possível salvar a anamnese.");
  }

  return response.json() as Promise<T>;
}

export function createEmptyAnswers() {
  return Object.fromEntries(anamneseTemplates.map((template) => [template.id, {}])) as Record<TemplateId, TemplateAnswers>;
}

export function normalizeAnamneseRecord(record: AnamneseRecord): AnamneseRecord {
  return {
    ...record,
    answers: {
      ...createEmptyAnswers(),
      ...record.answers
    }
  };
}

export async function fetchAnamneseRecords(token: string) {
  return getCached(anamneseRecordsCache, buildCacheKey(token, "records"), recordCacheTtlMs, async () => {
    const records = await apiRequest<AnamneseRecord[]>(token, "/api/anamneses");
    return records.map(normalizeAnamneseRecord);
  });
}

export function fetchAnamneseTemplates(token: string) {
  return getCached(anamneseTemplatesCache, buildCacheKey(token, "templates"), templatesCacheTtlMs, () => apiRequest<FormTemplate[]>(token, "/api/anamneses/templates"));
}

export async function fetchAnamneseRecord(token: string, recordId: string) {
  return getCached(anamneseRecordCache, buildCacheKey(token, "record", recordId), recordCacheTtlMs, async () => {
    const record = await apiRequest<AnamneseRecord>(token, `/api/anamneses/${recordId}`);
    return normalizeAnamneseRecord(record);
  });
}

export async function createAnamneseRecord(token: string, payload: AnamnesePayload) {
  const record = await apiRequest<AnamneseRecord>(token, "/api/anamneses", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  const normalizedRecord = normalizeAnamneseRecord(record);
  invalidateAnamneseRecordCaches(token, normalizedRecord);
  return normalizedRecord;
}

export async function saveAnamneseRecord(token: string, recordId: string, payload: AnamnesePayload) {
  const record = await apiRequest<AnamneseRecord>(token, `/api/anamneses/${recordId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
  const normalizedRecord = normalizeAnamneseRecord(record);
  invalidateAnamneseRecordCaches(token, normalizedRecord);
  return normalizedRecord;
}

export async function deleteAnamneseDraftRecord(token: string, recordId: string) {
  await apiRequest<{ id: string }>(token, `/api/anamneses/${recordId}`, {
    method: "DELETE"
  });
  removeAnamneseRecordFromCache(token, recordId);
}

export async function finalizeAnamneseRecord(token: string, recordId: string) {
  const record = await apiRequest<AnamneseRecord>(token, `/api/anamneses/${recordId}/finalize`, {
    method: "POST"
  });
  const normalizedRecord = normalizeAnamneseRecord(record);
  invalidateAnamneseRecordCaches(token, normalizedRecord);
  if (normalizedRecord.patientId) {
    medicalRecordCache.delete(buildCacheKey(token, "medical-record", normalizedRecord.patientId));
  }
  return normalizedRecord;
}

export async function completeAnamneseTemplate(token: string, recordId: string, templateId: TemplateId) {
  const record = await apiRequest<AnamneseRecord>(token, `/api/anamneses/${recordId}/templates/${templateId}/complete`, {
    method: "POST"
  });
  const normalizedRecord = normalizeAnamneseRecord(record);
  invalidateAnamneseRecordCaches(token, normalizedRecord);
  return normalizedRecord;
}

export function fetchPatients(token: string, search = "") {
  const normalizedSearch = search.trim();
  const params = new URLSearchParams({ status: "ACTIVE" });
  if (normalizedSearch) params.set("search", normalizedSearch);
  const query = `?${params.toString()}`;
  return getCached(patientsCache, buildCacheKey(token, "patients", normalizedSearch.toLowerCase()), patientsCacheTtlMs, () => apiRequest<PatientSummary[]>(token, `/api/patients${query}`));
}

export function fetchPatientMedicalRecord(token: string, patientId: string) {
  return getCached(medicalRecordCache, buildCacheKey(token, "medical-record", patientId), medicalRecordCacheTtlMs, () => apiRequest<MedicalRecordEntry[]>(token, `/api/patients/${patientId}/prontuario`));
}

export function emitAnamnesePdfDocument(token: string, recordId: string) {
  return apiRequest<ClinicalDocumentSummary>(token, `/api/anamneses/${recordId}/documents/pdf`, {
    method: "POST"
  });
}

export function emitAnamneseTemplatePdfDocument(token: string, recordId: string, templateId: TemplateId) {
  return apiRequest<ClinicalDocumentSummary>(token, `/api/anamneses/${recordId}/templates/${templateId}/documents/pdf`, {
    method: "POST"
  });
}

export function createEmptyRecord(): AnamneseRecord {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    code: `ANA-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    patientName: "",
    answers: createEmptyAnswers()
  };
}

export function useHasMounted() {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasMounted(true);
  }, []);

  return hasMounted;
}

export function saveAnamneseRecords(records: AnamneseRecord[]) {
  return records;
}

export function upsertStoredRecord(recordToSave: AnamneseRecord, records: AnamneseRecord[]) {
  return [recordToSave, ...records.filter((record) => record.id !== recordToSave.id)];
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function isFilled(value: FieldValue | undefined) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === "object" && value !== null) {
    return Object.values(value).some((row) => {
      if (typeof row === "string") return row.trim().length > 0;
      if (typeof row === "object" && row !== null) return Object.values(row).some((cell) => typeof cell === "string" && cell.trim().length > 0);
      return false;
    });
  }

  return typeof value === "string" && value.trim().length > 0;
}

export function getPatientName(record: AnamneseRecord) {
  const nursingName = record.answers["nursing-admission"].patientName;
  const psychologicalName = record.answers.psychological.patient;
  const therapeuticName = record.answers["therapeutic-initial"].therapeuticPatientName;
  const consentName = record.answers["therapeutic-initial"].consentPatientName;

  if (typeof nursingName === "string" && nursingName.trim()) return nursingName.trim();
  if (typeof psychologicalName === "string" && psychologicalName.trim()) return psychologicalName.trim();
  if (typeof therapeuticName === "string" && therapeuticName.trim()) return therapeuticName.trim();
  if (typeof consentName === "string" && consentName.trim()) return consentName.trim();
  return record.patientName || "Paciente sem nome";
}

export function validateRecord(record: AnamneseRecord, templates: FormTemplate[] = anamneseTemplates): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const template of templates) {
    for (const section of template.sections) {
      for (const field of section.fields) {
        if (field.required && !isFilled(record.answers[template.id][field.id])) {
          issues.push({ templateTitle: template.shortTitle, sectionTitle: section.title, fieldLabel: field.label });
        }
      }
    }
  }

  return issues;
}

export function requiredProgress(record: AnamneseRecord, templates: FormTemplate[] = anamneseTemplates) {
  let total = 0;
  let complete = 0;

  for (const template of templates) {
    for (const section of template.sections) {
      for (const field of section.fields) {
        if (field.required) {
          total += 1;
          if (isFilled(record.answers[template.id][field.id])) complete += 1;
        }
      }
    }
  }

  return { complete, total };
}