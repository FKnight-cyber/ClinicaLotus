import { createHash } from "node:crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { AnamnesisStatus, MedicalEvolutionStatus, PatientStatus, Prisma } from "@prisma/client";
import { AppCacheService } from "../../shared/cache/app-cache.service";
import { PrismaService } from "../../shared/prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CreatePatientDto } from "./dto/create-patient.dto";
import { UpdatePatientDto } from "./dto/update-patient.dto";

type ListQueryOptions = {
  clinicScope?: string;
  clinicId?: string;
  status?: string;
  limit?: string;
  offset?: string;
  admissionDate?: string;
  dischargeDate?: string;
};

type PatientTransferSummary = {
  sourceClinicId: string;
  targetClinicId: string;
  draftAnamnesesTransferred: number;
  draftEvolutionsTransferred: number;
};

type PatientMutationFlags = {
  linkedExisting?: boolean;
  existingInClinic?: boolean;
  transferSummary?: PatientTransferSummary | null;
};

const defaultListLimit = 5;
const maxListLimit = 100;
const patientClinicStatuses = new Set(["ACTIVE", "INACTIVE"]);

function parsePatientStatusFilter(status?: string): PatientStatus | undefined {
  if (status === "ALL") return undefined;
  return patientClinicStatuses.has(status ?? "") ? status as PatientStatus : "ACTIVE";
}

function parsePaginationOptions(options?: ListQueryOptions) {
  if (!options?.limit && !options?.offset) return null;

  const parsedLimit = Number.parseInt(options.limit ?? String(defaultListLimit), 10);
  const parsedOffset = Number.parseInt(options.offset ?? "0", 10);

  return {
    limit: Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), maxListLimit) : defaultListLimit,
    offset: Number.isFinite(parsedOffset) ? Math.max(parsedOffset, 0) : 0
  };
}

function parseIsoDateRange(value?: string) {
  const normalizedValue = value?.trim();
  if (!normalizedValue) return undefined;

  const startAt = new Date(`${normalizedValue}T00:00:00`);
  if (Number.isNaN(startAt.getTime())) return undefined;

  const endAt = new Date(startAt);
  endAt.setDate(endAt.getDate() + 1);

  return { gte: startAt, lt: endAt };
}

@Injectable()
export class PatientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: AppCacheService
  ) {}

  async list(user: AuthenticatedUser, search?: string, options?: ListQueryOptions) {
    const clinicIds = await this.resolveScopedClinicIds(user, options?.clinicId, options?.clinicScope);
    const clinicScopeKey = this.buildClinicScopeKey(clinicIds);
    const normalizedSearch = search?.trim();
    const status = parsePatientStatusFilter(options?.status);
    const pagination = parsePaginationOptions(options);
    const admissionDate = parseIsoDateRange(options?.admissionDate);
    const dischargeDate = parseIsoDateRange(options?.dischargeDate);
    const cacheKey = `patients:list:${clinicScopeKey}:${normalizedSearch ? normalizedSearch.toLowerCase() : "all"}:${options?.status === "ALL" ? "all" : status ?? "all"}:${options?.admissionDate?.trim() || "all"}:${options?.dischargeDate?.trim() || "all"}:${pagination ? `${pagination.limit}:${pagination.offset}` : "legacy"}`;

    const where: Prisma.PatientWhereInput = {
      OR: [
        { clinics: { some: { clinicId: { in: clinicIds }, ...(status ? { status } : {}) } } },
        { clinicId: { in: clinicIds } }
      ],
      ...(status ? { status } : {}),
      ...(admissionDate ? { admissionDate } : {}),
      ...(dischargeDate ? { dischargeDate } : {}),
      ...(normalizedSearch ? {
        OR: [
          { name: { contains: normalizedSearch, mode: "insensitive" as const } },
          { document: { contains: normalizedSearch, mode: "insensitive" as const } },
          { cpf: { contains: normalizedSearch, mode: "insensitive" as const } },
          { rg: { contains: normalizedSearch, mode: "insensitive" as const } }
        ]
      } : {})
    };

    if (pagination) {
      return this.cache.getOrSet(cacheKey, 15 * 1000, async () => {
        const [items, total] = await this.prisma.$transaction([
          this.prisma.patient.findMany({
            where,
            orderBy: { name: "asc" },
            skip: pagination.offset,
            take: pagination.limit,
            include: this.patientInclude(clinicIds)
          }),
          this.prisma.patient.count({ where })
        ]);

        return { items: items.map((patient) => this.toPatientListItem(patient, clinicIds)), total, limit: pagination.limit, offset: pagination.offset };
      });
    }

    return this.cache.getOrSet(cacheKey, 15 * 1000, () => this.prisma.patient.findMany({
      where,
      orderBy: { name: "asc" },
      take: 30,
      include: this.patientInclude(clinicIds)
    }).then((patients) => patients.map((patient) => this.toPatientListItem(patient, clinicIds))));
  }

  private resolveScopedClinicId(user: AuthenticatedUser, requestedClinicId?: string) {
    const normalizedClinicId = requestedClinicId?.trim();
    if (!normalizedClinicId) return this.resolveDefaultClinicId(user);
    if (!this.hasPermission(user.permissions, "patients.clinic_filter")) throw new BadRequestException("Usuário sem permissão para filtrar pacientes por clínica.");
    if (!user.availableClinicIds.includes(normalizedClinicId)) throw new BadRequestException("Clínica fora do escopo do usuário.");
    return normalizedClinicId;
  }

  private async resolveScopedClinicIds(user: AuthenticatedUser, requestedClinicId?: string, clinicScope?: string) {
    const normalizedClinicId = requestedClinicId?.trim();
    if (normalizedClinicId) return [this.resolveScopedClinicId(user, normalizedClinicId)];
    if (clinicScope === "network") {
      if (!this.hasPermission(user.permissions, "prontuario.read_network")) throw new BadRequestException("Usuário sem permissão para visualizar a rede consolidada.");
      const clinics = await this.prisma.clinic.findMany({ where: { status: "ACTIVE" }, select: { id: true } });
      if (clinics.length === 0) throw new BadRequestException("Nenhuma clínica ativa disponível.");
      return clinics.map((clinic) => clinic.id);
    }
    if (user.availableClinicIds.length === 0) throw new BadRequestException("Usuário sem clínica disponível.");
    return user.availableClinicIds;
  }

  async create(user: AuthenticatedUser, dto: CreatePatientDto) {
    const clinicId = this.resolveWriteClinicId(user, dto.clinicId);
    const cpf = dto.cpf?.trim() || null;
    const rg = dto.rg?.trim() || null;
    const document = dto.document?.trim() || null;
    const documentMatches = [
      ...(cpf ? [{ cpf }] : []),
      ...(rg ? [{ rg }] : []),
      ...(document ? [{ document }] : [])
    ];
    const patient = await this.prisma.$transaction(async (tx) => {
      const existingPatient = documentMatches.length > 0 ? await tx.patient.findFirst({
        where: { OR: documentMatches },
        orderBy: { createdAt: "asc" },
        include: { clinics: true }
      }) : null;

      if (existingPatient) {
        const existingClinicLink = existingPatient.clinics.find((clinicLink) => clinicLink.clinicId === clinicId);

        if (existingPatient.clinicId === clinicId && existingPatient.status === "ACTIVE" && existingClinicLink?.status === "ACTIVE") {
          return { ...existingPatient, linkedExisting: false, existingInClinic: true, transferSummary: null };
        }

        const transferSummary = await this.transferPatientClinicContext(tx, existingPatient.id, existingPatient.clinicId, clinicId);
        if (existingPatient.clinicId !== clinicId) {
          await tx.patientClinic.updateMany({
            where: { patientId: existingPatient.id, clinicId: existingPatient.clinicId },
            data: { status: "INACTIVE", lastSeenAt: new Date() }
          });
        }
        await tx.patient.update({
          where: { id: existingPatient.id },
          data: {
            clinicId,
            status: "ACTIVE",
            ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
            ...(dto.admissionDate !== undefined ? { admissionDate: dto.admissionDate ? new Date(`${dto.admissionDate}T00:00:00`) : null } : {}),
            ...(dto.dischargeDate !== undefined ? { dischargeDate: dto.dischargeDate ? new Date(`${dto.dischargeDate}T00:00:00`) : null } : {}),
            ...(dto.birthDate !== undefined ? { birthDate: dto.birthDate ? new Date(`${dto.birthDate}T00:00:00`) : null } : {}),
            document,
            cpf,
            rg
          }
        });

        await tx.patientClinic.upsert({
          where: { patientId_clinicId: { patientId: existingPatient.id, clinicId } },
          update: { status: "ACTIVE", lastSeenAt: new Date() },
          create: { patientId: existingPatient.id, clinicId, status: "ACTIVE", lastSeenAt: new Date() }
        });

        return { ...existingPatient, linkedExisting: !existingClinicLink, existingInClinic: Boolean(existingClinicLink), transferSummary };
      }

      const createdPatient = await tx.patient.create({
        data: {
          name: dto.name.trim(),
          clinicId,
          admissionDate: dto.admissionDate ? new Date(`${dto.admissionDate}T00:00:00`) : null,
          dischargeDate: dto.dischargeDate ? new Date(`${dto.dischargeDate}T00:00:00`) : null,
          birthDate: dto.birthDate ? new Date(`${dto.birthDate}T00:00:00`) : null,
          document,
          cpf,
          rg,
          clinics: {
            create: { clinicId, status: "ACTIVE", lastSeenAt: new Date() }
          }
        }
      });

      return { ...createdPatient, linkedExisting: false, existingInClinic: false, transferSummary: null };
    });

    this.invalidatePatientCaches(patient.id, clinicId);
    if (patient.linkedExisting) {
      await this.writeAuditLog(user.id, clinicId, "link_existing_patient", null, patient, `Paciente vinculado à clínica: ${patient.name}`);
    } else if (!patient.existingInClinic) {
      await this.writeAuditLog(user.id, clinicId, "create_patient", null, patient, `Paciente criado: ${patient.name}`);
    }
    return patient;
  }

  async getById(patientId: string, user: AuthenticatedUser, requestedClinicId?: string, clinicScope?: string) {
    const clinicIds = await this.resolveScopedClinicIds(user, requestedClinicId, clinicScope);
    return this.getByIdInClinics(patientId, clinicIds, user.permissions);
  }

  private getByIdInClinic(patientId: string, clinicId: string, userPermissions: string[] = []) {
    return this.getByIdInClinics(patientId, [clinicId], userPermissions);
  }

  private getByIdInClinics(patientId: string, clinicIds: string[], userPermissions: string[] = []) {
    const canReadEvolutions = this.hasPermission(userPermissions, "medical_evolutions.read");
    const clinicScopeKey = this.buildClinicScopeKey(clinicIds);
    const cacheKey = `patients:detail:${clinicScopeKey}:${patientId}:with-anamnesis-summary:${canReadEvolutions ? "with-evolutions" : "without-evolutions"}`;

    return this.cache.getOrSet(cacheKey, 15 * 1000, async () => {
      const patient = await this.prisma.patient.findFirst({
        where: { id: patientId, clinics: { some: { clinicId: { in: clinicIds } } } },
        include: this.patientInclude(clinicIds)
      });

      if (!patient) throw new NotFoundException("Paciente não encontrado.");

      const [anamneses, evolutions] = await Promise.all([
        this.prisma.anamnesisRecord.findMany({
          where: { patientId, clinicId: { in: clinicIds } },
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            code: true,
            status: true,
            patientName: true,
            finalizedAt: true,
            createdAt: true,
            updatedAt: true
          }
        }),
        canReadEvolutions ? this.prisma.medicalEvolution.findMany({
          where: { patientId, clinicId: { in: clinicIds } },
          orderBy: { evolutionDate: "desc" },
          select: {
            id: true,
            status: true,
            evolutionDate: true,
            text: true,
            professionalArea: true,
            professionalName: true,
            finalizedProfessionalName: true,
            finalizedAt: true,
            canceledAt: true,
            cancelReason: true,
            createdAt: true,
            updatedAt: true,
            createdBy: { select: { id: true, name: true, login: true } },
            finalizedBy: { select: { id: true, name: true, login: true } }
          }
        }) : Promise.resolve([])
      ]);

      return {
        id: patient.id,
        name: patient.name,
        status: patient.status,
        globalStatus: patient.status,
        admissionDate: patient.admissionDate?.toISOString() ?? null,
        dischargeDate: patient.dischargeDate?.toISOString() ?? null,
        clinics: patient.clinics.map((clinicLink) => this.toPatientClinicLink(clinicLink)),
        birthDate: patient.birthDate?.toISOString() ?? null,
        document: patient.document,
        cpf: patient.cpf,
        rg: patient.rg,
        createdAt: patient.createdAt.toISOString(),
        updatedAt: patient.updatedAt.toISOString(),
        anamneses: anamneses.map((record) => ({
          id: record.id,
          code: record.code,
          status: this.toAnamnesisStatusResponse(record.status),
          patientName: record.patientName,
          finalizedAt: record.finalizedAt?.toISOString() ?? null,
          createdAt: record.createdAt.toISOString(),
          updatedAt: record.updatedAt.toISOString()
        })),
        evolutions: evolutions.map((evolution) => ({
          id: evolution.id,
          status: this.toMedicalEvolutionStatusResponse(evolution.status),
          evolutionDate: evolution.evolutionDate.toISOString(),
          text: evolution.text,
          professionalArea: evolution.professionalArea,
          professionalName: evolution.professionalName,
          finalizedProfessionalName: evolution.finalizedProfessionalName,
          finalizedAt: evolution.finalizedAt?.toISOString() ?? null,
          canceledAt: evolution.canceledAt?.toISOString() ?? null,
          cancelReason: evolution.cancelReason,
          createdAt: evolution.createdAt.toISOString(),
          updatedAt: evolution.updatedAt.toISOString(),
          createdBy: evolution.createdBy,
          finalizedBy: evolution.finalizedBy
        }))
      };
    });
  }

  async update(user: AuthenticatedUser, patientId: string, dto: UpdatePatientDto, requestedClinicId?: string) {
    const beforeData = await this.findPatientOrThrow(patientId, await this.resolveScopedClinicIds(user, requestedClinicId));
    const sourceClinicId = beforeData.clinicId;
    const targetClinicId = dto.clinicId?.trim() ? this.resolveWriteClinicId(user, dto.clinicId) : sourceClinicId;
    const transferSummary = await this.prisma.$transaction(async (tx) => {
      const summary = await this.transferPatientClinicContext(tx, patientId, sourceClinicId, targetClinicId);
      if (targetClinicId !== sourceClinicId) {
        await tx.patientClinic.updateMany({
          where: { patientId, clinicId: sourceClinicId },
          data: { status: "INACTIVE", lastSeenAt: new Date() }
        });
      }
      await tx.patientClinic.upsert({
        where: { patientId_clinicId: { patientId, clinicId: targetClinicId } },
        update: { status: beforeData.status, lastSeenAt: new Date() },
        create: { patientId, clinicId: targetClinicId, status: beforeData.status, lastSeenAt: new Date() }
      });

      await tx.patient.update({
        where: { id: patientId },
        data: {
          clinicId: targetClinicId,
          status: beforeData.status,
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.admissionDate !== undefined ? { admissionDate: dto.admissionDate ? new Date(`${dto.admissionDate}T00:00:00`) : null } : {}),
          ...(dto.dischargeDate !== undefined ? { dischargeDate: dto.dischargeDate ? new Date(`${dto.dischargeDate}T00:00:00`) : null } : {}),
          ...(dto.birthDate !== undefined ? { birthDate: dto.birthDate ? new Date(`${dto.birthDate}T00:00:00`) : null } : {}),
          ...(dto.document !== undefined ? { document: dto.document?.trim() || null } : {}),
          ...(dto.cpf !== undefined ? { cpf: dto.cpf?.trim() || null } : {}),
          ...(dto.rg !== undefined ? { rg: dto.rg?.trim() || null } : {})
        }
      });

      return summary;
    });

    const response = await this.getPatientStatusResponse(patientId, targetClinicId, transferSummary);
    this.invalidatePatientCaches(patientId, sourceClinicId);
    if (targetClinicId !== sourceClinicId) this.invalidatePatientCaches(patientId, targetClinicId);
    if (targetClinicId !== sourceClinicId) this.invalidateTransferredClinicalCaches(patientId);
    await this.writeAuditLog(user.id, targetClinicId, "update_patient", beforeData, response, `Paciente atualizado: ${response.name}`);
    return response;
  }

  async updateStatus(user: AuthenticatedUser, patientId: string, status: PatientStatus, requestedClinicId?: string) {
    const beforeData = await this.findPatientOrThrow(patientId, await this.resolveScopedClinicIds(user, requestedClinicId));
    await this.prisma.$transaction([
      this.prisma.patient.update({
        where: { id: patientId },
        data: { status }
      }),
      this.prisma.patientClinic.updateMany({
        where: { patientId },
        data: { status }
      })
    ]);
    const patient = await this.getPatientStatusResponse(patientId, beforeData.clinicId);

    this.invalidatePatientCaches(patient.id, beforeData.clinicId);
    await this.writeAuditLog(user.id, beforeData.clinicId, status === "ACTIVE" ? "activate_patient" : "inactivate_patient", beforeData, patient, `${status === "ACTIVE" ? "Paciente ativado" : "Paciente inativado"}: ${patient.name}`);
    return patient;
  }

  async emitSummaryReportDocument(user: AuthenticatedUser, patientId: string, requestedClinicId?: string) {
    const clinicIds = await this.resolveScopedClinicIds(user, requestedClinicId);
    const patientAccess = await this.findPatientOrThrow(patientId, clinicIds);
    const clinicId = requestedClinicId?.trim() && clinicIds.includes(requestedClinicId.trim()) ? requestedClinicId.trim() : patientAccess.clinicId;
    const patient = await this.getByIdInClinic(patientId, clinicId, user.permissions);
    const contentHash = createHash("sha256").update(JSON.stringify(patient)).digest("hex");
    const document = await this.prisma.clinicalDocument.create({
      data: {
        code: await this.nextDocumentCode(),
        type: "PATIENT_SUMMARY_REPORT_PDF",
        fileName: `relatorio-paciente-${patient.id.slice(0, 8)}.pdf`,
        contentHash,
        metadataJson: JSON.stringify({ patientId: patient.id, patientName: patient.name, emittedFrom: "web-pdf-export", scope: "patient-summary" }),
        patientId: patient.id,
        clinicId,
        emittedById: user.id
      }
    });

    await this.writePatientDocumentAuditLog(user.id, clinicId, patient.id, "emit_patient_summary_report_pdf", document, `Relatório resumido emitido: ${patient.name}`);

    return {
      id: document.id,
      code: document.code,
      type: document.type,
      fileName: document.fileName,
      contentHash: document.contentHash,
      emittedAt: document.emittedAt.toISOString(),
      patientId: document.patientId
    };
  }

  async getMedicalRecord(patientId: string, user: AuthenticatedUser, options?: ListQueryOptions) {
    const clinicIds = await this.resolveScopedClinicIds(user, options?.clinicId, options?.clinicScope);
    const clinicScopeKey = this.buildClinicScopeKey(clinicIds);
    const canReadEvolutions = user.permissions.includes("admin.full_access") || user.permissions.includes("medical_evolutions.read");
    const pagination = parsePaginationOptions(options);
    const cacheKey = `patients:medical-record:${clinicScopeKey}:${patientId}:${canReadEvolutions ? "with-evolutions" : "without-evolutions"}:${pagination ? `${pagination.limit}:${pagination.offset}` : "legacy"}`;
    const where = canReadEvolutions ? { patientId, clinicId: { in: clinicIds } } : { patientId, clinicId: { in: clinicIds }, NOT: { type: "MEDICAL_EVOLUTION" as const } };

    if (pagination) {
      return this.cache.getOrSet(cacheKey, 15 * 1000, async () => {
        await this.ensurePatientInAnyClinic(patientId, clinicIds);
        const [items, total] = await this.prisma.$transaction([
          this.prisma.medicalRecordEntry.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: pagination.offset,
            take: pagination.limit,
            include: {
              anamnesisRecord: { select: { id: true, code: true, status: true } },
              medicalEvolution: { select: { id: true, status: true, professionalArea: true, cancelReason: true } },
              createdBy: { select: { id: true, name: true, login: true } }
            }
          }),
          this.prisma.medicalRecordEntry.count({ where })
        ]);

        return { items, total, limit: pagination.limit, offset: pagination.offset };
      });
    }

    return this.cache.getOrSet(cacheKey, 15 * 1000, async () => {
      await this.ensurePatientInAnyClinic(patientId, clinicIds);
      return this.prisma.medicalRecordEntry.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          anamnesisRecord: { select: { id: true, code: true, status: true } },
          medicalEvolution: { select: { id: true, status: true, professionalArea: true, cancelReason: true } },
          createdBy: { select: { id: true, name: true, login: true } }
        }
      });
    });
  }

  private async findPatientOrThrow(patientId: string, clinicIds: string[]) {
    const patient = await this.prisma.patient.findFirst({
      where: {
        id: patientId,
        OR: [
          { clinics: { some: { clinicId: { in: clinicIds } } } },
          { clinicId: { in: clinicIds } }
        ]
      },
      include: this.patientInclude(clinicIds)
    });

    if (!patient) throw new NotFoundException("Paciente não encontrado.");
    return patient;
  }

  private toPatientClinicLink(patient: {
    clinicId: string;
    status: "ACTIVE" | "INACTIVE";
    firstSeenAt: Date;
    lastSeenAt: Date | null;
    clinic: { id: string; name: string; code: string | null; status: "ACTIVE" | "INACTIVE" };
  }) {
    return {
      clinicId: patient.clinicId,
      status: patient.status,
      firstSeenAt: patient.firstSeenAt.toISOString(),
      lastSeenAt: patient.lastSeenAt?.toISOString() ?? null,
      clinic: patient.clinic
    };
  }

  private toPatientListItem(patient: {
    id: string;
    name: string;
    status: PatientStatus;
    clinicId: string;
    admissionDate: Date | null;
    dischargeDate: Date | null;
    birthDate: Date | null;
    document: string | null;
    cpf: string | null;
    rg: string | null;
    createdAt: Date;
    updatedAt: Date;
    clinic: { id: string; name: string; code: string | null; status: "ACTIVE" | "INACTIVE" };
    clinics: Array<{
      clinicId: string;
      status: "ACTIVE" | "INACTIVE";
      firstSeenAt: Date;
      lastSeenAt: Date | null;
      clinic: { id: string; name: string; code: string | null; status: "ACTIVE" | "INACTIVE" };
    }>;
  }, scopedClinicIds?: string[], flags?: PatientMutationFlags) {
    const visibleClinics = scopedClinicIds ? patient.clinics.filter((clinicLink) => scopedClinicIds.includes(clinicLink.clinicId)) : patient.clinics;
    const resolvedClinics = visibleClinics.length > 0 ? visibleClinics : [{
      clinicId: patient.clinicId,
      status: patient.status,
      firstSeenAt: patient.createdAt,
      lastSeenAt: patient.updatedAt,
      clinic: patient.clinic
    }];
    resolvedClinics.sort((leftClinic, rightClinic) => {
      if (leftClinic.clinicId === patient.clinicId) return -1;
      if (rightClinic.clinicId === patient.clinicId) return 1;
      if (leftClinic.status === "ACTIVE" && rightClinic.status !== "ACTIVE") return -1;
      if (rightClinic.status === "ACTIVE" && leftClinic.status !== "ACTIVE") return 1;
      return new Date(rightClinic.lastSeenAt ?? rightClinic.firstSeenAt).getTime() - new Date(leftClinic.lastSeenAt ?? leftClinic.firstSeenAt).getTime();
    });
    if (scopedClinicIds && resolvedClinics.length === 0) throw new NotFoundException("Paciente não encontrado.");
    return {
      id: patient.id,
      name: patient.name,
      status: patient.status,
      globalStatus: patient.status,
      admissionDate: patient.admissionDate?.toISOString() ?? null,
      dischargeDate: patient.dischargeDate?.toISOString() ?? null,
      birthDate: patient.birthDate?.toISOString() ?? null,
      document: patient.document,
      cpf: patient.cpf,
      rg: patient.rg,
      createdAt: patient.createdAt.toISOString(),
      updatedAt: patient.updatedAt.toISOString(),
      clinics: resolvedClinics.map((clinicLink) => this.toPatientClinicLink(clinicLink)),
      ...(flags?.linkedExisting !== undefined ? { linkedExisting: flags.linkedExisting } : {}),
      ...(flags?.existingInClinic !== undefined ? { existingInClinic: flags.existingInClinic } : {}),
      ...(flags?.transferSummary !== undefined ? { transferSummary: flags.transferSummary } : {})
    };
  }

  private async getPatientStatusResponse(patientId: string, clinicId: string, flags?: PatientMutationFlags["transferSummary"]) {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, OR: [{ clinics: { some: { clinicId } } }, { clinicId }] },
      include: this.patientInclude([clinicId])
    });

    if (!patient) throw new NotFoundException("Paciente não encontrado.");
    return this.toPatientListItem(patient, [clinicId], { transferSummary: flags ?? undefined });
  }

  private async ensurePatientInClinic(patientId: string, clinicId: string) {
    const patient = await this.prisma.patient.findFirst({ where: { id: patientId, status: "ACTIVE", OR: [{ clinics: { some: { clinicId, status: "ACTIVE" } } }, { clinicId }] }, select: { id: true } });
    if (!patient) throw new NotFoundException("Paciente não encontrado.");
  }

  private async ensurePatientInAnyClinic(patientId: string, clinicIds: string[]) {
    const patient = await this.prisma.patient.findFirst({ where: { id: patientId, status: "ACTIVE", OR: [{ clinics: { some: { clinicId: { in: clinicIds }, status: "ACTIVE" } } }, { clinicId: { in: clinicIds } }] }, select: { clinicId: true } });
    if (!patient) throw new NotFoundException("Paciente não encontrado.");
  }

  private patientInclude(clinicIds?: string[]) {
    return {
      clinic: { select: { id: true, name: true, code: true, status: true } },
      clinics: {
        where: clinicIds ? { clinicId: { in: clinicIds } } : undefined,
        orderBy: [{ firstSeenAt: "asc" }],
        include: { clinic: { select: { id: true, name: true, code: true, status: true } } }
      }
    } satisfies Prisma.PatientInclude;
  }

  private async transferPatientClinicContext(tx: Prisma.TransactionClient, patientId: string, sourceClinicId: string, targetClinicId: string): Promise<PatientTransferSummary | null> {
    if (sourceClinicId === targetClinicId) return null;

    await tx.patientClinic.upsert({
      where: { patientId_clinicId: { patientId, clinicId: sourceClinicId } },
      update: { lastSeenAt: new Date() },
      create: { patientId, clinicId: sourceClinicId, status: "ACTIVE", lastSeenAt: new Date() }
    });

    const [anamnesisTransfer, evolutionTransfer] = await Promise.all([
      tx.anamnesisRecord.updateMany({
        where: { patientId, clinicId: sourceClinicId, status: "DRAFT" },
        data: { clinicId: targetClinicId }
      }),
      tx.medicalEvolution.updateMany({
        where: { patientId, clinicId: sourceClinicId, status: "DRAFT" },
        data: { clinicId: targetClinicId }
      })
    ]);

    return {
      sourceClinicId,
      targetClinicId,
      draftAnamnesesTransferred: anamnesisTransfer.count,
      draftEvolutionsTransferred: evolutionTransfer.count
    };
  }

  private resolveDefaultClinicId(user: AuthenticatedUser) {
    if (user.availableClinicIds.length === 1) return user.availableClinicIds[0];
    throw new BadRequestException("Selecione uma clínica para continuar.");
  }

  private resolveWriteClinicId(user: AuthenticatedUser, requestedClinicId?: string) {
    const normalizedClinicId = requestedClinicId?.trim();
    if (normalizedClinicId) {
      if (!user.availableClinicIds.includes(normalizedClinicId)) throw new BadRequestException("Clínica fora do escopo do usuário.");
      return normalizedClinicId;
    }
    if (user.availableClinicIds.length === 1) return user.availableClinicIds[0];
    throw new BadRequestException("Informe a clínica do cadastro.");
  }

  private buildClinicScopeKey(clinicIds: string[]) {
    return [...clinicIds].sort().join(",");
  }

  private invalidateTransferredClinicalCaches(patientId: string) {
    this.cache.deleteByPrefix("anamnesis:records:list");
    this.cache.deleteByPrefix("anamnesis:record:");
    this.cache.deleteByPrefix("medical-evolutions:patient:");
    this.cache.deleteByPrefix(`patients:medical-record:`);
    this.cache.deleteByPrefix(`patients:detail:`);
  }

  private invalidatePatientCaches(patientId?: string | null, clinicId?: string | null) {
    this.cache.deleteByPrefix("patients:list:");
    if (patientId) {
      this.cache.deleteByPrefix("patients:detail:");
      this.cache.deleteByPrefix("patients:medical-record:");
    }
  }

  private hasPermission(userPermissions: string[], permission: string) {
    return userPermissions.includes("admin.full_access") || userPermissions.includes(permission);
  }

  private toAnamnesisStatusResponse(status: AnamnesisStatus) {
    if (status === "FINALIZED") return "finalized";
    if (status === "CANCELED") return "canceled";
    return "draft";
  }

  private toMedicalEvolutionStatusResponse(status: MedicalEvolutionStatus) {
    if (status === "FINALIZED") return "finalized";
    if (status === "CANCELED") return "canceled";
    return "draft";
  }

  private async nextDocumentCode() {
    const year = new Date().getFullYear();
    const prefix = `DOC-${year}-`;
    const latestDocument = await this.prisma.clinicalDocument.findFirst({
      where: { code: { startsWith: prefix } },
      orderBy: { code: "desc" },
      select: { code: true }
    });
    const latestSequence = Number.parseInt(latestDocument?.code.replace(prefix, "") ?? "0", 10);
    return `${prefix}${String((Number.isFinite(latestSequence) ? latestSequence : 0) + 1).padStart(4, "0")}`;
  }

  private async writePatientDocumentAuditLog(userId: string | undefined, clinicId: string, patientId: string, action: string, document: unknown, reason: string) {
    await this.prisma.auditLog.create({
      data: {
        entity: "patient",
        entityId: patientId,
        action,
        beforeData: null,
        afterData: JSON.stringify(document),
        reason,
        userId: userId ?? null,
        clinicId
      }
    });
    this.cache.deleteByPrefix("access:audit-logs:");
  }

  private async writeAuditLog(userId: string | undefined, clinicId: string, action: string, beforeData: unknown, afterData: unknown, reason: string) {
    await this.prisma.auditLog.create({
      data: {
        entity: "patient",
        entityId: typeof afterData === "object" && afterData && "id" in afterData ? String(afterData.id) : null,
        action,
        beforeData: beforeData ? JSON.stringify(beforeData) : null,
        afterData: afterData ? JSON.stringify(afterData) : null,
        reason,
        userId: userId ?? null,
        clinicId
      }
    });
    this.cache.deleteByPrefix("access:audit-logs:");
  }
}
