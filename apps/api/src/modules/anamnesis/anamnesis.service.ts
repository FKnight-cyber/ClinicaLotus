import { Injectable, NotFoundException } from "@nestjs/common";
import { CreateAnamnesisDto } from "./dto/create-anamnesis.dto";

type StoredAnamnesis = CreateAnamnesisDto & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class AnamnesisService {
  private readonly records = new Map<string, StoredAnamnesis>();

  getTemplates() {
    return {
      templates: [
        "Admissão de Enfermagem",
        "Anamnese Psicológica",
        "Anamnese Terapêutica Inicial"
      ],
      persistence: "mock-memory",
      nextStep: "Persistir em PostgreSQL via repositório dedicado quando a integração for ativada."
    };
  }

  getById(id: string) {
    const record = this.records.get(id);

    if (!record) {
      throw new NotFoundException("Anamnese não encontrada.");
    }

    return record;
  }

  create(dto: CreateAnamnesisDto) {
    const now = new Date().toISOString();
    const record: StoredAnamnesis = {
      ...dto,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now
    };
    this.records.set(record.id, record);
    return record;
  }
}