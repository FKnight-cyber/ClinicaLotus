"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { anamneseTemplates } from "./templates";
import type { AnamneseRecord, FieldValue, ValidationIssue } from "./types";

export const storageKey = "clinica.anamnese.records.v1";

const listeners = new Set<() => void>();
const serverSnapshot: AnamneseRecord[] = [];
let lastStoredValue: string | null = null;
let lastSnapshot: AnamneseRecord[] = [];

export function createEmptyRecord(): AnamneseRecord {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    code: `ANA-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    patientName: "",
    answers: {
      "nursing-admission": {},
      psychological: {},
      "therapeutic-initial": {}
    }
  };
}

export function readStoredRecords() {
  if (typeof window === "undefined") {
    return [];
  }

  const stored = window.localStorage.getItem(storageKey);

  if (!stored) {
    return [];
  }

  return JSON.parse(stored) as AnamneseRecord[];
}

export function writeStoredRecords(records: AnamneseRecord[]) {
  const nextValue = JSON.stringify(records);
  window.localStorage.setItem(storageKey, nextValue);
  lastStoredValue = nextValue;
  lastSnapshot = records;
  listeners.forEach((listener) => listener());
}

function getSnapshot() {
  if (typeof window === "undefined") {
    return serverSnapshot;
  }

  const stored = window.localStorage.getItem(storageKey);

  if (stored === lastStoredValue) {
    return lastSnapshot;
  }

  lastStoredValue = stored;
  lastSnapshot = stored ? JSON.parse(stored) as AnamneseRecord[] : [];
  return lastSnapshot;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAnamneseRecords() {
  return useSyncExternalStore(subscribe, getSnapshot, () => serverSnapshot);
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
  writeStoredRecords(records);
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

export function validateRecord(record: AnamneseRecord): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const template of anamneseTemplates) {
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

export function requiredProgress(record: AnamneseRecord) {
  let total = 0;
  let complete = 0;

  for (const template of anamneseTemplates) {
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