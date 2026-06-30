import { createHash } from "node:crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { AnamnesisRecord, AnamnesisStatus, QuestionType } from "@prisma/client";
import { PrismaService } from "../../shared/prisma/prisma.service";
import { CreateAnamnesisDto } from "./dto/create-anamnesis.dto";
import { UpdateAnamnesisDto } from "./dto/update-anamnesis.dto";

type FieldValue = unknown;
type TemplateAnswers = Record<string, FieldValue>;
type AnamnesisAnswers = Record<string, TemplateAnswers>;

type StoredAnswer = {
  valueText: string | null;
  question: {
    key: string;
    section: {
      template: {
        key: string;
      };
    };
  };
};

type RecordWithAnswers = AnamnesisRecord & {
  answers: StoredAnswer[];
};

const fieldTypeByQuestionType: Record<QuestionType, string> = {
  TEXT: "text",
  TEXTAREA: "textarea",
  DATE: "date",
  TIME: "time",
  NUMBER: "number",
  YES_NO: "yesNo",
  YES_NO_DETAILS: "yesNoDetails",
  SINGLE_CHOICE: "singleChoice",
  MULTI_CHOICE: "multiChoice",
  TABLE: "table"
};

@Injectable()
export class AnamnesisService {
  constructor(private readonly prisma: PrismaService) {}

  async getTemplates() {
    const templates = await this.prisma.anamnesisTemplate.findMany({
      where: { active: true },
      orderBy: { title: "asc" },
      include: {
        sections: {
          where: { active: true },
          orderBy: { sortOrder: "asc" },
          include: {
            questions: {
              where: { active: true },
              orderBy: { sortOrder: "asc" },
              include: {
                options: { where: { active: true }, orderBy: { sortOrder: "asc" } },
                templateRows: { where: { active: true }, orderBy: { sortOrder: "asc" } }
              }
            }
          }
        }
      }
    });

    return templates.map((template) => ({
      id: template.key,
      title: template.title,
      shortTitle: template.shortTitle,
      source: template.source,
      description: template.description,
      sections: template.sections.map((section) => ({
        id: section.key,
        title: section.title,
        description: section.description,
        fields: section.questions.map((question) => ({
          id: question.key,
          label: question.label,
          type: fieldTypeByQuestionType[question.type],
          required: question.required,
          placeholder: question.placeholder,
          helper: question.helper,
          options: question.options.map((option) => option.label),
          rows: question.templateRows.map((row) => row.label),
          columns: question.tableColumnsJson ? JSON.parse(question.tableColumnsJson) : undefined
        }))
      }))
    }));
  }

  async list() {
    const records = await this.prisma.anamnesisRecord.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        answers: {
          include: {
            question: {
              include: {
                section: {
                  include: {
                    template: true
                  }
                }
              }
            }
          }
        }
      }
    });

    return records.map((record) => this.toRecordResponse(record));
  }

  async getById(id: string) {
    const record = await this.findRecord(id);
    return this.toRecordResponse(record);
  }

  async create(userId: string, dto: CreateAnamnesisDto) {
    const record = await this.prisma.anamnesisRecord.create({
      data: {
        code: await this.nextCode(),
        patientName: dto.patientName,
        patientId: dto.patientId || null,
        status: "DRAFT",
        createdById: userId,
        updatedById: userId
      }
    });

    if (dto.answers) {
      await this.replaceAnswers(record.id, dto.answers);
    }

    const createdRecord = await this.getById(record.id);
    await this.writeAuditLog(userId, "CREATE", record.id, null, createdRecord);
    return createdRecord;
  }

  async update(userId: string, id: string, dto: UpdateAnamnesisDto) {
    const existingRecord = await this.findRecord(id);

    if (existingRecord.status === "FINALIZED") {
      throw new BadRequestException("Anamnese finalizada não pode ser editada.");
    }

    const beforeData = this.toRecordResponse(existingRecord);

    await this.prisma.anamnesisRecord.update({
      where: { id },
      data: {
        patientName: dto.patientName ?? existingRecord.patientName,
        patientId: dto.patientId === undefined ? existingRecord.patientId : dto.patientId || null,
        updatedById: userId
      }
    });

    if (dto.answers) {
      await this.replaceAnswers(id, dto.answers);
    }

    const updatedRecord = await this.getById(id);
    await this.writeAuditLog(userId, "UPDATE", id, beforeData, updatedRecord);
    return updatedRecord;
  }

  async finalize(userId: string, id: string) {
    const record = await this.findRecord(id);

    if (record.status === "FINALIZED") {
      return this.toRecordResponse(record);
    }

    const answers = this.answersFromRecord(record);
    const missingRequiredFields = await this.getMissingRequiredFields(answers);

    if (missingRequiredFields.length > 0) {
      throw new BadRequestException({
        message: "Existem campos obrigatórios pendentes.",
        missingRequiredFields
      });
    }

    const beforeData = this.toRecordResponse(record);

    await this.prisma.anamnesisRecord.update({
      where: { id },
      data: {
        status: "FINALIZED",
        finalizedAt: new Date(),
        updatedById: userId
      }
    });

    const finalizedRecord = await this.getById(id);
    await this.createMedicalRecordEntry(userId, finalizedRecord);
    await this.writeAuditLog(userId, "FINALIZE", id, beforeData, finalizedRecord);
    return finalizedRecord;
  }

  async emitPdfDocument(userId: string, id: string) {
    const record = await this.findRecord(id);

    if (record.status !== "FINALIZED") {
      throw new BadRequestException("Apenas anamneses finalizadas podem gerar documento rastreável.");
    }

    const snapshot = this.toRecordResponse(record);
    const contentHash = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
    const document = await this.prisma.clinicalDocument.create({
      data: {
        code: await this.nextDocumentCode(),
        type: "ANAMNESIS_PDF",
        fileName: `${record.code}.pdf`,
        contentHash,
        metadataJson: JSON.stringify({ recordCode: record.code, emittedFrom: "web-pdf-export" }),
        patientId: record.patientId,
        anamnesisRecordId: record.id,
        emittedById: userId
      }
    });

    await this.writeAuditLog(userId, "EMIT_PDF", id, null, document);

    return {
      id: document.id,
      code: document.code,
      type: document.type,
      fileName: document.fileName,
      contentHash: document.contentHash,
      emittedAt: document.emittedAt.toISOString(),
      patientId: document.patientId,
      anamnesisRecordId: document.anamnesisRecordId
    };
  }

  private async findRecord(id: string) {
    const record = await this.prisma.anamnesisRecord.findUnique({
      where: { id },
      include: {
        answers: {
          include: {
            question: {
              include: {
                section: {
                  include: {
                    template: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!record) {
      throw new NotFoundException("Anamnese não encontrada.");
    }

    return record;
  }

  private async replaceAnswers(recordId: string, answers: AnamnesisAnswers) {
    const questions = await this.prisma.anamnesisQuestion.findMany({
      where: { active: true },
      include: {
        section: {
          include: {
            template: true
          }
        }
      }
    });
    const questionsByTemplateAndKey = new Map(questions.map((question) => [`${question.section.template.key}:${question.key}`, question]));
    const answerWrites = [];

    for (const [templateKey, templateAnswers] of Object.entries(answers)) {
      for (const [fieldKey, value] of Object.entries(templateAnswers)) {
        const question = questionsByTemplateAndKey.get(`${templateKey}:${fieldKey}`);

        if (!question) {
          throw new BadRequestException(`Campo de anamnese desconhecido: ${templateKey}.${fieldKey}`);
        }

        answerWrites.push(this.prisma.anamnesisAnswer.create({
          data: {
            recordId,
            questionId: question.id,
            valueText: JSON.stringify(value)
          }
        }));
      }
    }

    await this.prisma.$transaction([
      this.prisma.anamnesisAnswer.deleteMany({ where: { recordId } }),
      ...answerWrites
    ]);
  }

  private async getMissingRequiredFields(answers: AnamnesisAnswers) {
    const requiredQuestions = await this.prisma.anamnesisQuestion.findMany({
      where: { active: true, required: true },
      orderBy: { sortOrder: "asc" },
      include: {
        section: {
          include: {
            template: true
          }
        }
      }
    });

    return requiredQuestions
      .filter((question) => !this.isFilled(answers[question.section.template.key]?.[question.key]))
      .map((question) => ({
        templateTitle: question.section.template.title,
        sectionTitle: question.section.title,
        fieldLabel: question.label
      }));
  }

  private isFilled(value: unknown) {
    if (value === undefined || value === null) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object") return Object.keys(value).length > 0;
    return true;
  }

  private answersFromRecord(record: RecordWithAnswers) {
    return record.answers.reduce<AnamnesisAnswers>((accumulator, answer) => {
      const templateKey = answer.question.section.template.key;
      accumulator[templateKey] = accumulator[templateKey] ?? {};
      accumulator[templateKey][answer.question.key] = answer.valueText ? JSON.parse(answer.valueText) : null;
      return accumulator;
    }, {});
  }

  private toRecordResponse(record: RecordWithAnswers) {
    return {
      ...this.toListItem(record),
      answers: this.answersFromRecord(record)
    };
  }

  private toListItem(record: {
    id: string;
    code: string;
    status: AnamnesisStatus;
    patientName: string;
    patientId: string | null;
    finalizedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: record.id,
      code: record.code,
      status: this.toApiStatus(record.status),
      patientName: record.patientName,
      patientId: record.patientId,
      finalizedAt: record.finalizedAt?.toISOString(),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString()
    };
  }

  private toApiStatus(status: AnamnesisStatus) {
    if (status === "FINALIZED") return "finalized";
    if (status === "CANCELED") return "canceled";
    return "draft";
  }

  private async nextCode() {
    const year = new Date().getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const recordsThisYear = await this.prisma.anamnesisRecord.count({ where: { createdAt: { gte: startOfYear } } });
    return `ANA-${year}-${String(recordsThisYear + 1).padStart(4, "0")}`;
  }

  private async nextDocumentCode() {
    const year = new Date().getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const documentsThisYear = await this.prisma.clinicalDocument.count({ where: { emittedAt: { gte: startOfYear } } });
    return `DOC-${year}-${String(documentsThisYear + 1).padStart(4, "0")}`;
  }

  private async createMedicalRecordEntry(userId: string, record: ReturnType<AnamnesisService["toRecordResponse"]>) {
    if (!record.patientId) return;

    const existingEntry = await this.prisma.medicalRecordEntry.findFirst({
      where: { anamnesisRecordId: record.id, type: "ANAMNESIS_FINALIZED" }
    });

    if (existingEntry) return;

    await this.prisma.medicalRecordEntry.create({
      data: {
        patientId: record.patientId,
        anamnesisRecordId: record.id,
        type: "ANAMNESIS_FINALIZED",
        title: `Anamnese finalizada ${record.code}`,
        summary: `Anamnese finalizada para ${record.patientName}.`,
        createdById: userId
      }
    });
  }

  private async writeAuditLog(userId: string, action: string, entityId: string, beforeData: unknown, afterData: unknown) {
    await this.prisma.auditLog.create({
      data: {
        entity: "AnamnesisRecord",
        entityId,
        action,
        beforeData: beforeData ? JSON.stringify(beforeData) : null,
        afterData: afterData ? JSON.stringify(afterData) : null,
        userId
      }
    });
  }
}