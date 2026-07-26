import { createHash } from "node:crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { MedicalEvolution, MedicalEvolutionStatus } from "@prisma/client";
import { AppCacheService } from "../../shared/cache/app-cache.service";
import { PrismaService } from "../../shared/prisma/prisma.service";
import { CancelMedicalEvolutionDto } from "./dto/cancel-medical-evolution.dto";
import { CreateMedicalEvolutionDto } from "./dto/create-medical-evolution.dto";
import { UpdateMedicalEvolutionDto } from "./dto/update-medical-evolution.dto";

type MedicalEvolutionWithRelations = MedicalEvolution & {
  createdBy?: MedicalEvolutionUserRelation | null;
  updatedBy?: MedicalEvolutionUserRelation | null;
  finalizedBy?: MedicalEvolutionUserRelation | null;
  canceledBy?: MedicalEvolutionUserRelation | null;
};

type MedicalEvolutionUserRelation = {
  id: string;
  name: string;
  login: string;
  professionalCouncil: string | null;
  professionalRegistration: string | null;
  professionalCouncilState: string | null;
  professionalSpecialty: string | null;
};

type ListQueryOptions = {
  limit?: string;
  offset?: string;
};

const defaultListLimit = 5;
const maxListLimit = 100;

function parsePaginationOptions(options?: ListQueryOptions) {
  const parsedLimit = Number.parseInt(options?.limit ?? String(defaultListLimit), 10);
  const parsedOffset = Number.parseInt(options?.offset ?? "0", 10);

  return {
    limit: Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), maxListLimit) : defaultListLimit,
    offset: Number.isFinite(parsedOffset) ? Math.max(parsedOffset, 0) : 0
  };
}

@Injectable()
export class MedicalEvolutionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: AppCacheService
  ) {}

  async listByPatient(patientId: string, options?: ListQueryOptions) {
    await this.ensurePatientExists(patientId);
    const pagination = parsePaginationOptions(options);

    return this.cache.getOrSet(`medical-evolutions:patient:${patientId}:${pagination.limit}:${pagination.offset}`, 15 * 1000, async () => {
      const [evolutions, total] = await this.prisma.$transaction([
        this.prisma.medicalEvolution.findMany({
          where: { patientId },
          orderBy: { evolutionDate: "desc" },
          skip: pagination.offset,
          take: pagination.limit,
          include: this.userRelations()
        }),
        this.prisma.medicalEvolution.count({ where: { patientId } })
      ]);

      return { items: evolutions.map((evolution) => this.toResponse(evolution)), total, limit: pagination.limit, offset: pagination.offset };
    });
  }

  async getById(id: string) {
    const evolution = await this.findEvolution(id);
    return this.toResponse(evolution);
  }

  async create(userId: string, patientId: string, dto: CreateMedicalEvolutionDto) {
    await this.ensurePatientExists(patientId);
    const text = dto.text.trim();

    if (!text) {
      throw new BadRequestException("Informe o texto da evolução.");
    }

    const evolution = await this.prisma.medicalEvolution.create({
      data: {
        patientId,
        text,
        professionalArea: dto.professionalArea,
        evolutionDate: this.parseDate(dto.evolutionDate),
        professionalName: this.normalizeOptionalText(dto.professionalName),
        createdById: userId,
        updatedById: userId
      },
      include: this.userRelations()
    });

    this.invalidateCaches(patientId);
    const response = this.toResponse(evolution);
    await this.writeAuditLog(userId, "create_medical_evolution", evolution.id, null, response);
    return response;
  }

  async update(userId: string, id: string, dto: UpdateMedicalEvolutionDto) {
    const existingEvolution = await this.findEvolution(id);

    if (existingEvolution.status !== "DRAFT") {
      throw new BadRequestException("Apenas rascunhos de evolução podem ser editados.");
    }

    const beforeData = this.toResponse(existingEvolution);
    const text = dto.text === undefined ? existingEvolution.text : dto.text.trim();

    if (!text) {
      throw new BadRequestException("Informe o texto da evolução.");
    }

    const updatedEvolution = await this.prisma.medicalEvolution.update({
      where: { id },
      data: {
        text,
        professionalArea: dto.professionalArea === undefined ? existingEvolution.professionalArea : dto.professionalArea,
        evolutionDate: dto.evolutionDate === undefined ? existingEvolution.evolutionDate : this.parseDate(dto.evolutionDate),
        professionalName: dto.professionalName === undefined ? existingEvolution.professionalName : this.normalizeOptionalText(dto.professionalName),
        updatedById: userId
      },
      include: this.userRelations()
    });

    this.invalidateCaches(updatedEvolution.patientId);
    const response = this.toResponse(updatedEvolution);
    await this.writeAuditLog(userId, "update_medical_evolution", id, beforeData, response);
    return response;
  }

  async finalize(userId: string, id: string) {
    const existingEvolution = await this.findEvolution(id);

    if (existingEvolution.status === "FINALIZED") {
      return this.toResponse(existingEvolution);
    }

    if (existingEvolution.status === "CANCELED") {
      throw new BadRequestException("Evolução cancelada não pode ser finalizada.");
    }

    if (!existingEvolution.text.trim()) {
      throw new BadRequestException("Informe o texto da evolução antes de finalizar.");
    }

    if (!existingEvolution.professionalArea) {
      throw new BadRequestException("Informe a área profissional antes de finalizar.");
    }

    const beforeData = this.toResponse(existingEvolution);
    const finalizedEvolution = await this.prisma.medicalEvolution.update({
      where: { id },
      data: {
        status: "FINALIZED",
        finalizedAt: new Date(),
        finalizedById: userId,
        updatedById: userId
      },
      include: this.userRelations()
    });

    await this.createMedicalRecordEntry(userId, finalizedEvolution);
    this.invalidateCaches(finalizedEvolution.patientId);
    const response = this.toResponse(finalizedEvolution);
    await this.writeAuditLog(userId, "finalize_medical_evolution", id, beforeData, response);
    return response;
  }

  async cancel(userId: string, id: string, dto: CancelMedicalEvolutionDto) {
    const reason = dto.reason.trim();

    if (!reason) {
      throw new BadRequestException("Informe o motivo do cancelamento.");
    }

    const existingEvolution = await this.findEvolution(id);

    if (existingEvolution.status === "CANCELED") {
      return this.toResponse(existingEvolution);
    }

    if (existingEvolution.status === "FINALIZED") {
      throw new BadRequestException("Evolução finalizada não pode ser cancelada.");
    }

    const beforeData = this.toResponse(existingEvolution);
    const canceledEvolution = await this.prisma.medicalEvolution.update({
      where: { id },
      data: {
        status: "CANCELED",
        canceledAt: new Date(),
        canceledById: userId,
        cancelReason: reason,
        updatedById: userId
      },
      include: this.userRelations()
    });

    await this.markMedicalRecordEntryCanceled(canceledEvolution.id, reason);
    this.invalidateCaches(canceledEvolution.patientId);
    const response = this.toResponse(canceledEvolution);
    await this.writeAuditLog(userId, "cancel_medical_evolution", id, beforeData, response);
    return response;
  }

  async emitPdfDocument(userId: string, id: string) {
    const evolution = await this.findEvolution(id);

    if (evolution.status !== "FINALIZED") {
      throw new BadRequestException("Apenas evoluções finalizadas podem gerar documento rastreável.");
    }

    const snapshot = this.toResponse(evolution);
    const contentHash = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
    const document = await this.prisma.clinicalDocument.create({
      data: {
        code: await this.nextDocumentCode(),
        type: "MEDICAL_EVOLUTION_PDF",
        fileName: `evolucao-${evolution.id.slice(0, 8)}.pdf`,
        contentHash,
        metadataJson: JSON.stringify({ evolutionId: evolution.id, emittedFrom: "web-pdf-export" }),
        patientId: evolution.patientId,
        medicalEvolutionId: evolution.id,
        emittedById: userId
      }
    });

    await this.writeAuditLog(userId, "emit_medical_evolution_pdf", id, null, document);

    return {
      id: document.id,
      code: document.code,
      type: document.type,
      fileName: document.fileName,
      contentHash: document.contentHash,
      emittedAt: document.emittedAt.toISOString(),
      patientId: document.patientId,
      medicalEvolutionId: document.medicalEvolutionId
    };
  }

  private async ensurePatientExists(patientId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { id: patientId }, select: { id: true } });

    if (!patient) {
      throw new NotFoundException("Paciente não encontrado.");
    }
  }

  private async findEvolution(id: string) {
    const evolution = await this.prisma.medicalEvolution.findUnique({
      where: { id },
      include: this.userRelations()
    });

    if (!evolution) {
      throw new NotFoundException("Evolução não encontrada.");
    }

    return evolution;
  }

  private async createMedicalRecordEntry(userId: string, evolution: MedicalEvolution) {
    const existingEntry = await this.prisma.medicalRecordEntry.findFirst({
      where: { medicalEvolutionId: evolution.id, type: "MEDICAL_EVOLUTION" }
    });

    if (existingEntry) return;

    await this.prisma.medicalRecordEntry.create({
      data: {
        patientId: evolution.patientId,
        medicalEvolutionId: evolution.id,
        type: "MEDICAL_EVOLUTION",
        title: `Evolução${evolution.professionalArea ? ` - ${evolution.professionalArea}` : ""}`,
        summary: this.buildSummary(evolution.text),
        createdById: userId,
        createdAt: evolution.evolutionDate
      }
    });
  }

  private async markMedicalRecordEntryCanceled(evolutionId: string, reason: string) {
    await this.prisma.medicalRecordEntry.updateMany({
      where: { medicalEvolutionId: evolutionId, type: "MEDICAL_EVOLUTION" },
      data: {
        title: "Evolução cancelada",
        summary: `Registro cancelado. Motivo: ${reason}`
      }
    });
  }

  private invalidateCaches(patientId: string) {
    this.cache.deleteByPrefix(`medical-evolutions:patient:${patientId}:`);
    this.cache.deleteByPrefix(`patients:medical-record:${patientId}:`);
  }

  private parseDate(value?: string) {
    return value ? new Date(value) : new Date();
  }

  private normalizeOptionalText(value?: string | null) {
    const normalizedValue = value?.trim();
    return normalizedValue ? normalizedValue : null;
  }

  private buildSummary(text: string) {
    const normalizedText = text.replace(/\s+/g, " ").trim();
    return normalizedText.length > 180 ? `${normalizedText.slice(0, 177)}...` : normalizedText;
  }

  private async nextDocumentCode() {
    const year = new Date().getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const documentsThisYear = await this.prisma.clinicalDocument.count({ where: { emittedAt: { gte: startOfYear } } });
    return `DOC-${year}-${String(documentsThisYear + 1).padStart(4, "0")}`;
  }

  private userRelations() {
    const userSelect = {
      id: true,
      name: true,
      login: true,
      professionalCouncil: true,
      professionalRegistration: true,
      professionalCouncilState: true,
      professionalSpecialty: true
    };

    return {
      createdBy: { select: userSelect },
      updatedBy: { select: userSelect },
      finalizedBy: { select: userSelect },
      canceledBy: { select: userSelect }
    };
  }

  private toResponse(evolution: MedicalEvolutionWithRelations) {
    return {
      id: evolution.id,
      patientId: evolution.patientId,
      status: this.toStatusResponse(evolution.status),
      evolutionDate: evolution.evolutionDate.toISOString(),
      text: evolution.text,
      professionalArea: evolution.professionalArea,
      professionalName: evolution.professionalName,
      finalizedAt: evolution.finalizedAt?.toISOString() ?? null,
      canceledAt: evolution.canceledAt?.toISOString() ?? null,
      cancelReason: evolution.cancelReason,
      createdAt: evolution.createdAt.toISOString(),
      updatedAt: evolution.updatedAt.toISOString(),
      createdBy: evolution.createdBy ?? null,
      updatedBy: evolution.updatedBy ?? null,
      finalizedBy: evolution.finalizedBy ?? null,
      canceledBy: evolution.canceledBy ?? null
    };
  }

  private toStatusResponse(status: MedicalEvolutionStatus) {
    if (status === "FINALIZED") return "finalized";
    if (status === "CANCELED") return "canceled";
    return "draft";
  }

  private getAuditReason(action: string, afterData: unknown) {
    const evolution = afterData as { professionalName?: string | null } | null;
    const professional = evolution?.professionalName ? ` por ${evolution.professionalName}` : "";

    if (action === "create_medical_evolution") return `Evolução criada${professional}`;
    if (action === "update_medical_evolution") return `Evolução atualizada${professional}`;
    if (action === "finalize_medical_evolution") return `Evolução finalizada${professional}`;
    if (action === "cancel_medical_evolution") return `Evolução cancelada${professional}`;
    if (action === "emit_medical_evolution_pdf") return `PDF de evolução emitido${professional}`;
    return "Evento de evolução registrado";
  }

  private async writeAuditLog(userId: string, action: string, entityId: string, beforeData: unknown, afterData: unknown) {
    await this.prisma.auditLog.create({
      data: {
        entity: "medical_evolution",
        entityId,
        action,
        beforeData: beforeData ? JSON.stringify(beforeData) : null,
        afterData: afterData ? JSON.stringify(afterData) : null,
        reason: this.getAuditReason(action, afterData),
        userId
      }
    });
    this.cache.deleteByPrefix("access:audit-logs:");
  }
}