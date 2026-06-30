"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Search, UserRound } from "lucide-react";
import { useAuth } from "@/features/auth/AuthProvider";
import { fetchPatientMedicalRecord, fetchPatients } from "@/features/anamnese/storage";
import type { MedicalRecordEntry, PatientSummary } from "@/features/anamnese/types";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function ProntuarioPage() {
  const { hasPermission, token } = useAuth();
  const canReadPatients = hasPermission("patients.read");
  const canReadProntuario = hasPermission("prontuario.read");
  const [search, setSearch] = useState("");
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [entries, setEntries] = useState<MedicalRecordEntry[]>([]);
  const [message, setMessage] = useState("Busque um paciente para abrir o prontuario.");

  useEffect(() => {
    if (!token || !canReadPatients) return;
    let isCurrent = true;

    fetchPatients(token, search)
      .then((nextPatients) => {
        if (!isCurrent) return;
        setPatients(nextPatients);
        setSelectedPatientId((currentId) => currentId && nextPatients.some((patient) => patient.id === currentId) ? currentId : nextPatients[0]?.id ?? null);
      })
      .catch((error) => {
        if (isCurrent) setMessage(error instanceof Error ? error.message : "Nao foi possivel carregar pacientes.");
      });

    return () => {
      isCurrent = false;
    };
  }, [canReadPatients, search, token]);

  useEffect(() => {
    if (!token || !selectedPatientId || !canReadProntuario) {
      setEntries([]);
      return;
    }
    let isCurrent = true;

    fetchPatientMedicalRecord(token, selectedPatientId)
      .then((nextEntries) => {
        if (!isCurrent) return;
        setEntries(nextEntries);
        setMessage(nextEntries.length > 0 ? "Eventos carregados do prontuario." : "Paciente sem eventos no prontuario.");
      })
      .catch((error) => {
        if (isCurrent) setMessage(error instanceof Error ? error.message : "Nao foi possivel carregar o prontuario.");
      });

    return () => {
      isCurrent = false;
    };
  }, [canReadProntuario, selectedPatientId, token]);

  const selectedPatient = useMemo(() => patients.find((patient) => patient.id === selectedPatientId) ?? null, [patients, selectedPatientId]);

  if (!canReadPatients || !canReadProntuario) {
    return (
      <section className="placeholder-page">
        <div className="page-intro">
          <div className="intro-icon" aria-hidden="true"><UserRound size={28} /></div>
          <div>
            <span className="eyebrow">Prontuario</span>
            <h2>Permissao necessaria</h2>
            <p>Seu usuario nao possui permissao para visualizar pacientes e prontuario.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="prontuario-page">
      <div className="list-header">
        <div>
          <span className="eyebrow">Prontuario</span>
          <h2>Timeline clinica do paciente</h2>
          <p>Consulte os eventos clinicos gerados a partir das anamneses finalizadas.</p>
        </div>
        <span className="status-badge"><CalendarClock aria-hidden="true" size={17} />{entries.length} evento(s)</span>
      </div>

      <div className="prontuario-layout">
        <aside className="plain-panel prontuario-patients-panel">
          <label className="prontuario-search">
            <span>Buscar paciente</span>
            <div>
              <Search aria-hidden="true" size={16} />
              <input onChange={(event) => setSearch(event.target.value)} placeholder="Nome ou documento" value={search} />
            </div>
          </label>
          <div className="prontuario-patient-list" aria-label="Pacientes">
            {patients.map((patient) => (
              <button className={patient.id === selectedPatientId ? "is-selected" : ""} key={patient.id} onClick={() => setSelectedPatientId(patient.id)} type="button">
                <strong>{patient.name}</strong>
                <span>{patient.document || "Sem documento"}</span>
              </button>
            ))}
            {patients.length === 0 ? <div className="empty-state">Nenhum paciente encontrado.</div> : null}
          </div>
        </aside>

        <section className="plain-panel prontuario-timeline-panel">
          <div className="access-card-heading">
            <div>
              <h3>{selectedPatient?.name ?? "Selecione um paciente"}</h3>
              <p>{selectedPatient?.document || message}</p>
            </div>
          </div>

          <div className="prontuario-timeline">
            {entries.map((entry) => (
              <article className="prontuario-entry" key={entry.id}>
                <span>{formatDateTime(entry.createdAt)}</span>
                <strong>{entry.title}</strong>
                {entry.summary ? <p>{entry.summary}</p> : null}
                {entry.anamnesisRecord ? <small>{entry.anamnesisRecord.code}</small> : null}
              </article>
            ))}
            {entries.length === 0 ? <div className="empty-state">{message}</div> : null}
          </div>
        </section>
      </div>
    </section>
  );
}
