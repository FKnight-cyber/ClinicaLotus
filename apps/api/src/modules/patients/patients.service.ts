import { Injectable } from "@nestjs/common";
import { AppCacheService } from "../../shared/cache/app-cache.service";
import { PrismaService } from "../../shared/prisma/prisma.service";
import { CreatePatientDto } from "./dto/create-patient.dto";

type ListQueryOptions = {
  limit?: string;
  offset?: string;
};

const defaultListLimit = 5;
const maxListLimit = 100;

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
    const pagination = parsePaginationOptions(options);
    const cacheKey = `patients:list:${normalizedSearch ? normalizedSearch.toLowerCase() : "all"}:${pagination ? `${pagination.limit}:${pagination.offset}` : "legacy"}`;

    const where = normalizedSearch ? {
      OR: [
        { name: { contains: normalizedSearch, mode: "insensitive" as const } },
        { document: { contains: normalizedSearch, mode: "insensitive" as const } },
        { cpf: { contains: normalizedSearch, mode: "insensitive" as const } },
        { rg: { contains: normalizedSearch, mode: "insensitive" as const } }
      ]
    } : undefined;

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
    await this.writeAuditLog(actorUserId, patient);
    return patient;
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
