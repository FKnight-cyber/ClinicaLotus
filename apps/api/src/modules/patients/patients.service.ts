import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../shared/prisma/prisma.service";
import { CreatePatientDto } from "./dto/create-patient.dto";

@Injectable()
export class PatientsService {
  constructor(private readonly prisma: PrismaService) {}

  list(search?: string) {
    const normalizedSearch = search?.trim();

    return this.prisma.patient.findMany({
      where: normalizedSearch ? {
        OR: [
          { name: { contains: normalizedSearch, mode: "insensitive" } },
          { document: { contains: normalizedSearch, mode: "insensitive" } }
        ]
      } : undefined,
      orderBy: { name: "asc" },
      take: 30
    });
  }

  create(dto: CreatePatientDto) {
    return this.prisma.patient.create({
      data: {
        name: dto.name.trim(),
        birthDate: dto.birthDate ? new Date(`${dto.birthDate}T00:00:00`) : null,
        document: dto.document?.trim() || null
      }
    });
  }

  getMedicalRecord(patientId: string) {
    return this.prisma.medicalRecordEntry.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
      include: {
        anamnesisRecord: { select: { id: true, code: true, status: true } },
        createdBy: { select: { id: true, name: true, login: true } }
      }
    });
  }
}