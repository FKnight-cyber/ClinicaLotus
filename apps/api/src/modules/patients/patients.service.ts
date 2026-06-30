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
          { document: { contains: normalizedSearch, mode: "insensitive" } }
        ]
      } : undefined,
      orderBy: { name: "asc" },
      take: 30
    }));
  }

  async create(dto: CreatePatientDto) {
    const patient = await this.prisma.patient.create({
      data: {
        name: dto.name.trim(),
        birthDate: dto.birthDate ? new Date(`${dto.birthDate}T00:00:00`) : null,
        document: dto.document?.trim() || null
      }
    });

    this.cache.deleteByPrefix("patients:list:");
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
}
