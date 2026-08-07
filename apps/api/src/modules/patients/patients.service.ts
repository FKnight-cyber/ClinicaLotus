import { createHash } from "node:crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { AnamnesisStatus, MedicalEvolutionStatus, PatientStatus, Prisma } from "@prisma/client";
import { AppCacheService } from "../../shared/cache/app-cache.service";
import { PrismaService } from "../../shared/prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CreatePatientDto } from "./dto/create-patient.dto";
import { UpdatePatientDto } from "./dto/update-patient.dto";

type ListQueryOptions = {
  clinicId?: string;
  status?: string;
  limit?: string;
  offset?: string;
};

const defaultListLimit = 5;
const maxListLimit = 100;
const patientStatuses = new Set(["ACTIVE", "INACTIVE"]);

function parsePatientStatusFilter(status?: string): PatientStatus | undefined {
  if (status === "ALL") return undefined;
  return patientStatuses.has(status ?? "") ? status as PatientStatus : "ACTIVE";
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

@Injectable()
export class PatientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: AppCacheService
  ) {}

  list(user: AuthenticatedUser, search?: string, options?: ListQueryOptions) {
    const clinicIds = this.resolveScopedClinicIds(user, options?.clinicId);
    const clinicScopeKey = this.buildClinicScopeKey(clinicIds);
    const normalizedSearch = search?.trim();
    const status = parsePatientStatusFilter(options?.status);
    const pagination = parsePaginationOptions(options);
    const cacheKey = `patients:list:${clinicScopeKey}:${normalizedSearch ? normalizedSearch.toLowerCase() : "all"}:${options?.status === "ALL" ? "all" : status ?? "all"}:${pagination ? `${pagination.limit}:${pagination.offset}` : "legacy"}`;

    const where: Prisma.PatientWhereInput = {
      ...(status ? { status } : {}),
      clinics: { some: { clinicId: { in: clinicIds }, status: "ACTIVE" } },
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
            take: pagination.limit
          }),
          this.prisma.patient.count({ where })
        ]);

        return { items, total, limit: pagination.limit, offset: pagination.offset };
      });
    }

    return this.cache.getOrSet(cacheKey, 15 * 1000, () => this.prisma.patient.findMany({
      where,
      orderBy: { name: "asc" },
      take: 30
    }));
  }

  private resolveScopedClinicId(user: AuthenticatedUser, requestedClinicId?: string) {
    const normalizedClinicId = requestedClinicId?.trim();
    if (!normalizedClinicId) return this.resolveDefaultClinicId(user);
    if (!this.hasPermission(user.permissions, "patients.clinic_filter")) throw new BadRequestException("Usuário sem permissão para filtrar pacientes por clínica.");
    if (!user.availableClinicIds.includes(normalizedClinicId)) throw new BadRequestException("Clínica fora do escopo do usuário.");
    return normalizedClinicId;
  }

  private resolveScopedClinicIds(user: AuthenticatedUser, requestedClinicId?: string) {
    const normalizedClinicId = requestedClinicId?.trim();
    if (normalizedClinicId) return [this.resolveScopedClinicId(user, normalizedClinicId)];
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
        include: { clinics: true },
        orderBy: { createdAt: "asc" }
      }) : null;

      if (existingPatient) {
        const existingClinicLink = existingPatient.clinics.find((clinic) => clinic.clinicId === clinicId);

        if (existingClinicLink?.status === "ACTIVE") {
          return { ...existingPatient, linkedExisting: false, existingInClinic: true };
        }

        if (existingClinicLink) {
          await tx.patientClinic.update({
            where: { patientId_clinicId: { patientId: existingPatient.id, clinicId } },
            data: { status: "ACTIVE", lastSeenAt: new Date() }
          });
        } else {
          await tx.patientClinic.create({
            data: { patientId: existingPatient.id, clinicId, status: "ACTIVE", lastSeenAt: new Date() }
          });
        }

        return { ...existingPatient, linkedExisting: true, existingInClinic: false };
      }

      const createdPatient = await tx.patient.create({
        data: {
          name: dto.name.trim(),
          birthDate: dto.birthDate ? new Date(`${dto.birthDate}T00:00:00`) : null,
          document,
          cpf,
          rg
        }
      });

      await tx.patientClinic.create({
        data: { patientId: createdPatient.id, clinicId, status: "ACTIVE", lastSeenAt: new Date() }
      });

      return { ...createdPatient, linkedExisting: false, existingInClinic: false };
    });

    this.invalidatePatientCaches(patient.id, clinicId);
    if (patient.linkedExisting) {
      await this.writeAuditLog(user.id, clinicId, "link_existing_patient", null, patient, `Paciente vinculado à clínica: ${patient.name}`);
    } else if (!patient.existingInClinic) {
      await this.writeAuditLog(user.id, clinicId, "create_patient", null, patient, `Paciente criado: ${patient.name}`);
    }
    return patient;
  }

  async getById(patientId: string, user: AuthenticatedUser, requestedClinicId?: string) {
    const clinicIds = this.resolveScopedClinicIds(user, requestedClinicId);
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
        where: { id: patientId, clinics: { some: { clinicId: { in: clinicIds }, status: "ACTIVE" } } }
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

  async update(user: AuthenticatedUser, patientId: string, dto: UpdatePatientDto) {
    const clinicId = this.resolveDefaultClinicId(user);
    const beforeData = await this.findPatientOrThrow(patientId, clinicId);
    const patient = await this.prisma.patient.update({
      where: { id: patientId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.birthDate !== undefined ? { birthDate: dto.birthDate ? new Date(`${dto.birthDate}T00:00:00`) : null } : {}),
        ...(dto.document !== undefined ? { document: dto.document?.trim() || null } : {}),
        ...(dto.cpf !== undefined ? { cpf: dto.cpf?.trim() || null } : {}),
        ...(dto.rg !== undefined ? { rg: dto.rg?.trim() || null } : {})
      }
    });

    this.invalidatePatientCaches(patient.id, clinicId);
    await this.writeAuditLog(user.id, clinicId, "update_patient", beforeData, patient, `Paciente atualizado: ${patient.name}`);
    return patient;
  }

  async updateStatus(user: AuthenticatedUser, patientId: string, status: PatientStatus) {
    const clinicId = this.resolveDefaultClinicId(user);
    const beforeData = await this.findPatientOrThrow(patientId, clinicId);
    const patient = await this.prisma.patient.update({
      where: { id: patientId },
      data: { status }
    });

    this.invalidatePatientCaches(patient.id, clinicId);
    await this.writeAuditLog(user.id, clinicId, status === "ACTIVE" ? "activate_patient" : "inactivate_patient", beforeData, patient, `${status === "ACTIVE" ? "Paciente ativado" : "Paciente inativado"}: ${patient.name}`);
    return patient;
  }

  async emitSummaryReportDocument(user: AuthenticatedUser, patientId: string) {
    const clinicId = this.resolveDefaultClinicId(user);
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

  getMedicalRecord(patientId: string, user: AuthenticatedUser, options?: ListQueryOptions) {
    const clinicIds = this.resolveScopedClinicIds(user, options?.clinicId);
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

  private async findPatientOrThrow(patientId: string, clinicId: string) {
    const patient = await this.prisma.patient.findFirst({ where: { id: patientId, clinics: { some: { clinicId, status: "ACTIVE" } } } });
    if (!patient) throw new NotFoundException("Paciente não encontrado.");
    return patient;
  }

  private async ensurePatientInClinic(patientId: string, clinicId: string) {
    const patientClinic = await this.prisma.patientClinic.findUnique({ where: { patientId_clinicId: { patientId, clinicId } }, select: { status: true } });
    if (!patientClinic || patientClinic.status !== "ACTIVE") throw new NotFoundException("Paciente não encontrado.");
  }

  private async ensurePatientInAnyClinic(patientId: string, clinicIds: string[]) {
    const patientClinic = await this.prisma.patientClinic.findFirst({ where: { patientId, clinicId: { in: clinicIds }, status: "ACTIVE" }, select: { clinicId: true } });
    if (!patientClinic) throw new NotFoundException("Paciente não encontrado.");
  }

  private resolveDefaultClinicId(user: AuthenticatedUser) {
    if (user.availableClinicIds.length === 1) return user.availableClinicIds[0];
    if (user.activeClinicId && user.availableClinicIds.includes(user.activeClinicId)) return user.activeClinicId;
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
