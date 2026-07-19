import { Injectable } from "@nestjs/common";
import { AppCacheService } from "../../shared/cache/app-cache.service";
import { PrismaService } from "../../shared/prisma/prisma.service";
import { CreatePatientDto } from "./dto/create-patient.dto";

@Injectable()
export class PatientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: AppCacheService
  ) {}

  list(search?: string) {
    const normalizedSearch = search?.trim();
    const cacheKey = `patients:list:${normalizedSearch ? normalizedSearch.toLowerCase() : "all"}`;

    return this.cache.getOrSet(cacheKey, 15 * 1000, () => this.prisma.patient.findMany({
      where: normalizedSearch ? {
        OR: [
          { name: { contains: normalizedSearch, mode: "insensitive" } },
          { document: { contains: normalizedSearch, mode: "insensitive" } },
          { cpf: { contains: normalizedSearch, mode: "insensitive" } },
          { rg: { contains: normalizedSearch, mode: "insensitive" } }
        ]
      } : undefined,
      orderBy: { name: "asc" },
      take: 30
    }));
  }

  async create(actorUserId: string | undefined, dto: CreatePatientDto) {
    const cpf = dto.cpf?.trim() || null;
    const rg = dto.rg?.trim() || null;
    const document = dto.document?.trim() || [cpf, rg].filter(Boolean).join(" / ") || null;
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
    await this.writeAuditLog(actorUserId, patient);
    return patient;
  }

  getMedicalRecord(patientId: string) {
    return this.cache.getOrSet(`patients:medical-record:${patientId}`, 15 * 1000, () => this.prisma.medicalRecordEntry.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
      include: {
        anamnesisRecord: { select: { id: true, code: true, status: true } },
        createdBy: { select: { id: true, name: true, login: true } }
      }
    }));
  }

  private async writeAuditLog(userId: string | undefined, patient: unknown) {
    await this.prisma.auditLog.create({
      data: {
        entity: "patient",
        entityId: typeof patient === "object" && patient && "id" in patient ? String(patient.id) : null,
        action: "create_patient",
        beforeData: null,
        afterData: JSON.stringify(patient),
        reason: typeof patient === "object" && patient && "name" in patient ? `Paciente criado: ${String(patient.name)}` : "Paciente criado",
        userId: userId ?? null
      }
    });
    this.cache.deleteByPrefix("access:audit-logs:");
  }
}
