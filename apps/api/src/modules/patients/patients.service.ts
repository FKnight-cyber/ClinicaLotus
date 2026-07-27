import { createHash } from "node:crypto";
import { Injectable, NotFoundException } from "@nestjs/common";
import type { AnamnesisStatus, MedicalEvolutionStatus, PatientStatus, Prisma } from "@prisma/client";
import { AppCacheService } from "../../shared/cache/app-cache.service";
import { PrismaService } from "../../shared/prisma/prisma.service";
import { CreatePatientDto } from "./dto/create-patient.dto";
import { UpdatePatientDto } from "./dto/update-patient.dto";

type ListQueryOptions = {
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

  list(search?: string, options?: ListQueryOptions) {
    const normalizedSearch = search?.trim();
    const status = parsePatientStatusFilter(options?.status);
    const pagination = parsePaginationOptions(options);
    const cacheKey = `patients:list:${normalizedSearch ? normalizedSearch.toLowerCase() : "all"}:${options?.status === "ALL" ? "all" : status ?? "all"}:${pagination ? `${pagination.limit}:${pagination.offset}` : "legacy"}`;

    const where: Prisma.PatientWhereInput = {
      ...(status ? { status } : {}),
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

  async create(actorUserId: string | undefined, dto: CreatePatientDto) {
    const cpf = dto.cpf?.trim() || null;
    const rg = dto.rg?.trim() || null;
    const document = dto.document?.trim() || null;
    const patient = await this.prisma.patient.create({
      data: {
        name: dto.name.trim(),
        birthDate: dto.birthDate ? new Date(`${dto.birthDate}T00:00:00`) : null,
        document,
        cpf,
        rg
      }
    });

    this.cache.deleteByPrefix("patients:list:");
    await this.writeAuditLog(actorUserId, "create_patient", null, patient, `Paciente criado: ${patient.name}`);
    return patient;
  }

  async getById(patientId: string, userPermissions: string[] = []) {
    const canReadEvolutions = this.hasPermission(userPermissions, "medical_evolutions.read");
    const cacheKey = `patients:detail:${patientId}:with-anamnesis-summary:${canReadEvolutions ? "with-evolutions" : "without-evolutions"}`;

    return this.cache.getOrSet(cacheKey, 15 * 1000, async () => {
      const patient = await this.prisma.patient.findUnique({
        where: { id: patientId }
      });

      if (!patient) throw new NotFoundException("Paciente não encontrado.");

      const [anamneses, evolutions] = await Promise.all([
        this.prisma.anamnesisRecord.findMany({
          where: { patientId },
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
          where: { patientId },
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

  async update(actorUserId: string | undefined, patientId: string, dto: UpdatePatientDto) {
    const beforeData = await this.findPatientOrThrow(patientId);
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

    this.invalidatePatientCaches(patient.id);
    await this.writeAuditLog(actorUserId, "update_patient", beforeData, patient, `Paciente atualizado: ${patient.name}`);
    return patient;
  }

  async updateStatus(actorUserId: string | undefined, patientId: string, status: PatientStatus) {
    const beforeData = await this.findPatientOrThrow(patientId);
    const patient = await this.prisma.patient.update({
      where: { id: patientId },
      data: { status }
    });

    this.invalidatePatientCaches(patient.id);
    await this.writeAuditLog(actorUserId, status === "ACTIVE" ? "activate_patient" : "inactivate_patient", beforeData, patient, `${status === "ACTIVE" ? "Paciente ativado" : "Paciente inativado"}: ${patient.name}`);
    return patient;
  }

  async emitSummaryReportDocument(actorUserId: string | undefined, patientId: string, userPermissions: string[] = []) {
    const patient = await this.getById(patientId, userPermissions);
    const contentHash = createHash("sha256").update(JSON.stringify(patient)).digest("hex");
    const document = await this.prisma.clinicalDocument.create({
      data: {
        code: await this.nextDocumentCode(),
        type: "PATIENT_SUMMARY_REPORT_PDF",
        fileName: `relatorio-paciente-${patient.id.slice(0, 8)}.pdf`,
        contentHash,
        metadataJson: JSON.stringify({ patientId: patient.id, patientName: patient.name, emittedFrom: "web-pdf-export", scope: "patient-summary" }),
        patientId: patient.id,
        emittedById: actorUserId
      }
    });

    await this.writePatientDocumentAuditLog(actorUserId, patient.id, "emit_patient_summary_report_pdf", document, `Relatório resumido emitido: ${patient.name}`);

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

  getMedicalRecord(patientId: string, userPermissions: string[] = [], options?: ListQueryOptions) {
    const canReadEvolutions = userPermissions.includes("admin.full_access") || userPermissions.includes("medical_evolutions.read");
    const pagination = parsePaginationOptions(options);
    const cacheKey = `patients:medical-record:${patientId}:${canReadEvolutions ? "with-evolutions" : "without-evolutions"}:${pagination ? `${pagination.limit}:${pagination.offset}` : "legacy"}`;
    const where = canReadEvolutions ? { patientId } : { patientId, NOT: { type: "MEDICAL_EVOLUTION" as const } };

    if (pagination) {
      return this.cache.getOrSet(cacheKey, 15 * 1000, async () => {
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

    return this.cache.getOrSet(cacheKey, 15 * 1000, () => this.prisma.medicalRecordEntry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        anamnesisRecord: { select: { id: true, code: true, status: true } },
        medicalEvolution: { select: { id: true, status: true, professionalArea: true, cancelReason: true } },
        createdBy: { select: { id: true, name: true, login: true } }
      }
    }));
  }

  private async findPatientOrThrow(patientId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) throw new NotFoundException("Paciente não encontrado.");
    return patient;
  }

  private invalidatePatientCaches(patientId?: string | null) {
    this.cache.deleteByPrefix("patients:list:");
    if (patientId) {
      this.cache.deleteByPrefix(`patients:detail:${patientId}:`);
      this.cache.deleteByPrefix(`patients:medical-record:${patientId}:`);
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

  private async writePatientDocumentAuditLog(userId: string | undefined, patientId: string, action: string, document: unknown, reason: string) {
    await this.prisma.auditLog.create({
      data: {
        entity: "patient",
        entityId: patientId,
        action,
        beforeData: null,
        afterData: JSON.stringify(document),
        reason,
        userId: userId ?? null
      }
    });
    this.cache.deleteByPrefix("access:audit-logs:");
  }

  private async writeAuditLog(userId: string | undefined, action: string, beforeData: unknown, afterData: unknown, reason: string) {
    await this.prisma.auditLog.create({
      data: {
        entity: "patient",
        entityId: typeof afterData === "object" && afterData && "id" in afterData ? String(afterData.id) : null,
        action,
        beforeData: beforeData ? JSON.stringify(beforeData) : null,
        afterData: afterData ? JSON.stringify(afterData) : null,
        reason,
        userId: userId ?? null
      }
    });
    this.cache.deleteByPrefix("access:audit-logs:");
  }
}
