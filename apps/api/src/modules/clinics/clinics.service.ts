import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { AppCacheService } from "../../shared/cache/app-cache.service";
import { PrismaService } from "../../shared/prisma/prisma.service";
import { CreateClinicDto } from "./dto/create-clinic.dto";
import { ListClinicsQueryDto } from "./dto/list-clinics-query.dto";
import { UpdateClinicDto } from "./dto/update-clinic.dto";
import { UpdateClinicStatusDto } from "./dto/update-clinic-status.dto";

const defaultListLimit = 5;
const maxListLimit = 100;
type NormalizedClinicData = {
  name?: string;
  code?: string | null;
  document?: string | null;
};

@Injectable()
export class ClinicsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: AppCacheService
  ) {}

  list(query: ListClinicsQueryDto = {}) {
    const limit = this.normalizeListLimit(query.limit);
    const page = this.normalizePage(query.page);
    const skip = (page - 1) * limit;
    const search = query.search?.trim();
    const status = query.status === "ALL" ? undefined : query.status ?? "ACTIVE";
    const where: Prisma.ClinicWhereInput = {
      ...(status ? { status } : {}),
      ...(search ? {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { code: { contains: search, mode: "insensitive" } },
          { document: { contains: search, mode: "insensitive" } }
        ]
      } : {})
    };

    return this.cache.getOrSet(`clinics:list:${limit}:${page}:${search ?? ""}:${status ?? "ALL"}`, 30 * 1000, async () => {
      const [items, total] = await this.prisma.$transaction([
        this.prisma.clinic.findMany({
          where,
          orderBy: [{ status: "asc" }, { name: "asc" }],
          skip,
          take: limit,
          include: this.clinicRelations()
        }),
        this.prisma.clinic.count({ where })
      ]);

      return { items, limit, page, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
    });
  }

  async getById(clinicId: string) {
    const clinic = await this.cache.getOrSet(`clinics:detail:${clinicId}`, 30 * 1000, () => this.prisma.clinic.findUnique({
      where: { id: clinicId },
      include: this.clinicRelations()
    }));

    if (!clinic) throw new NotFoundException("Clínica não encontrada.");
    return clinic;
  }

  async create(dto: CreateClinicDto, actorUserId?: string) {
    const data = this.normalizeClinicData(dto, true);
    await this.ensureUniqueCode(data.code ?? null);

    const clinic = await this.prisma.clinic.create({
      data: {
        name: data.name!,
        code: data.code ?? null,
        document: data.document ?? null
      }
    });
    this.invalidateClinicCaches(clinic.id);
    const nextClinic = await this.getById(clinic.id);
    await this.writeAuditLog(actorUserId, "create_clinic", clinic.id, null, nextClinic, `Clínica criada: ${nextClinic.name}`);
    return nextClinic;
  }

  async update(clinicId: string, dto: UpdateClinicDto, actorUserId?: string) {
    const previousClinic = await this.getById(clinicId);
    const data = this.normalizeClinicData(dto, false);

    if (Object.keys(data).length === 0) {
      throw new BadRequestException("Informe ao menos um campo para atualizar.");
    }

    if (Object.prototype.hasOwnProperty.call(data, "code")) {
      await this.ensureUniqueCode(data.code ?? null, clinicId);
    }

    await this.prisma.clinic.update({ where: { id: clinicId }, data });
    this.invalidateClinicCaches(clinicId);
    const nextClinic = await this.getById(clinicId);
    await this.writeAuditLog(actorUserId, "update_clinic", clinicId, previousClinic, nextClinic, `Clínica atualizada: ${nextClinic.name}`);
    return nextClinic;
  }

  async updateStatus(clinicId: string, dto: UpdateClinicStatusDto, actorUserId?: string) {
    const previousClinic = await this.getById(clinicId);
    const clinic = await this.prisma.clinic.update({ where: { id: clinicId }, data: { status: dto.status } });
    this.invalidateClinicCaches(clinicId);
    const nextClinic = await this.getById(clinicId);
    await this.writeAuditLog(actorUserId, dto.status === "ACTIVE" ? "activate_clinic" : "inactivate_clinic", clinicId, previousClinic, nextClinic, `${dto.status === "ACTIVE" ? "Clínica ativada" : "Clínica inativada"}: ${clinic.name}`);
    return nextClinic;
  }

  private normalizeClinicData(dto: CreateClinicDto | UpdateClinicDto, requireName: boolean): NormalizedClinicData {
    const name = dto.name?.trim();
    const code = dto.code?.trim().toUpperCase() || null;
    const document = dto.document?.trim() || null;
    const data: NormalizedClinicData = {};

    if (requireName && !name) throw new BadRequestException("Informe o nome da clínica.");
    if (name !== undefined) data.name = name;
    if (dto.code !== undefined) data.code = code;
    if (dto.document !== undefined) data.document = document;

    return data;
  }

  private async ensureUniqueCode(code: string | null, ignoredClinicId?: string) {
    if (!code) return;

    const existingClinic = await this.prisma.clinic.findFirst({
      where: { code, ...(ignoredClinicId ? { id: { not: ignoredClinicId } } : {}) },
      select: { id: true }
    });

    if (existingClinic) throw new BadRequestException("Já existe uma clínica com este código.");
  }

  private clinicRelations() {
    return {
      _count: { select: { users: true, patients: true } }
    };
  }

  private invalidateClinicCaches(clinicId?: string) {
    this.cache.deleteByPrefix("clinics:list:");
    this.cache.deleteByPrefix("auth:profile:");
    this.cache.deleteByPrefix("access:groups:");
    this.cache.deleteByPrefix("access:users:");
    this.cache.delete("access:clinic-options");
    if (clinicId) this.cache.delete(`clinics:detail:${clinicId}`);
  }

  private normalizeListLimit(limit?: number) {
    if (typeof limit !== "number" || !Number.isFinite(limit)) return defaultListLimit;
    return Math.min(Math.max(Math.trunc(limit), 1), maxListLimit);
  }

  private normalizePage(page?: number) {
    if (typeof page !== "number" || !Number.isFinite(page)) return 1;
    return Math.max(Math.trunc(page), 1);
  }

  private async writeAuditLog(userId: string | undefined, action: string, entityId: string, beforeData: unknown, afterData: unknown, reason: string) {
    await this.prisma.auditLog.create({
      data: {
        entity: "clinic",
        entityId,
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
