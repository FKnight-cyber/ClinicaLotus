import type { MedicalRecordEntry, PatientSummary } from "@/features/anamnese/types";

export type { MedicalRecordEntry, PatientSummary };

export type PaginatedResponse<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

export type MedicalEvolutionStatus = "draft" | "finalized" | "canceled";

export const professionalAreaOptions = ["Médico", "Terapeuta", "Psicólogo", "Psiquiatra", "Assistente social", "Enfermagem"] as const;

export type ProfessionalArea = typeof professionalAreaOptions[number];

export type MedicalEvolutionUser = {
  id: string;
  name: string;
  login: string;
  professionalCouncil?: string | null;
  professionalRegistration?: string | null;
  professionalCouncilState?: string | null;
  professionalSpecialty?: string | null;
};

export type MedicalEvolution = {
  id: string;
  patientId: string;
  status: MedicalEvolutionStatus;
  evolutionDate: string;
  text: string;
  professionalArea?: ProfessionalArea | null;
  professionalName?: string | null;
  finalizedProfessionalName?: string | null;
  finalizedProfessionalCouncil?: string | null;
  finalizedProfessionalRegistration?: string | null;
  finalizedProfessionalCouncilState?: string | null;
  finalizedProfessionalSpecialty?: string | null;
  finalizedAt?: string | null;
  canceledAt?: string | null;
  cancelReason?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: MedicalEvolutionUser | null;
  updatedBy?: MedicalEvolutionUser | null;
  finalizedBy?: MedicalEvolutionUser | null;
  canceledBy?: MedicalEvolutionUser | null;
};

export type MedicalEvolutionPayload = {
  text: string;
  evolutionDate?: string;
  professionalArea: ProfessionalArea | "";
  professionalName?: string;
  clinicId?: string;
};

export type ClinicalDocumentSummary = {
  id: string;
  code: string;
  type: string;
  fileName: string;
  contentHash: string;
  emittedAt: string;
  patientId?: string | null;
  medicalEvolutionId?: string | null;
};