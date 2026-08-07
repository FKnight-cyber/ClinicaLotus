import { createHash } from "node:crypto";
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { AnamnesisRecord, AnamnesisStatus, QuestionType } from "@prisma/client";
import { AppCacheService } from "../../shared/cache/app-cache.service";
import { PrismaService } from "../../shared/prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CreateAnamnesisDto } from "./dto/create-anamnesis.dto";
import { UpdateAnamnesisDto } from "./dto/update-anamnesis.dto";

type FieldValue = unknown;
type TemplateAnswers = Record<string, FieldValue>;
type AnamnesisAnswers = Record<string, TemplateAnswers>;
type TemplateStatus = {
  status: "draft" | "completed";
  completedAt?: string;
  completedById?: string;
};
type TemplateStatuses = Record<string, TemplateStatus>;
type CustomFieldsJson = Record<string, Record<string, Array<{ id?: string }>>>;
type TemplateConfigItem = { id?: string; title?: string; shortTitle?: string; isCustom?: boolean };

const templatePermissionById: Record<string, string> = {
  "nursing-admission": "anamnese.templates.nursing.read",
  psychological: "anamnese.templates.psychological.read",
  "therapeutic-initial": "anamnese.templates.therapeutic.read"
};

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: AppCacheService
  ) {}

  async getTemplates(userPermissions: string[] = []) {
    const templates = await this.cache.getOrSet("anamnesis:templates", 10 * 60 * 1000, () => this.loadTemplates());
    return templates.filter((template) => this.canAccessTemplate(template.id, userPermissions));
  }

  private canAccessTemplate(templateId: string | undefined, userPermissions: string[] = []) {
    if (!templateId) return true;
    const permission = templatePermissionById[templateId];
    if (!permission) return true;
    return userPermissions.includes("admin.full_access") || userPermissions.includes(permission);
  }

  private ensureTemplateAccess(templateId: string, userPermissions: string[] = []) {
    if (!this.canAccessTemplate(templateId, userPermissions)) {
      throw new ForbiddenException("Usuário sem permissão para acessar esta ficha de anamnese.");
    }
  }

  private async loadTemplates() {
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

  async list(user: AuthenticatedUser, requestedClinicId?: string) {
    const clinicIds = this.resolveScopedClinicIds(user, requestedClinicId);
    const clinicScopeKey = this.buildClinicScopeKey(clinicIds);
    return this.cache.getOrSet(`anamnesis:records:list:${clinicScopeKey}`, 5 * 1000, () => this.loadRecords(clinicIds));
  }

  private async loadRecords(clinicIds: string[]) {
    const records = await this.prisma.anamnesisRecord.findMany({
      where: { clinicId: { in: clinicIds } },
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

  async getById(user: AuthenticatedUser, id: string, requestedClinicId?: string) {
    const clinicId = this.resolveScopedClinicId(user, requestedClinicId);
    return this.getByIdInClinic(id, clinicId);
  }

  private async getByIdInClinic(id: string, clinicId: string) {
    return this.cache.getOrSet(`anamnesis:record:${clinicId}:${id}`, 5 * 1000, async () => {
      const record = await this.findRecord(id, clinicId);
      return this.toRecordResponse(record);
    });
  }

  async create(user: AuthenticatedUser, dto: CreateAnamnesisDto) {
    const clinicId = this.resolveWriteClinicId(user, dto.clinicId);
    if (dto.patientId) await this.ensurePatientInClinic(dto.patientId, clinicId);
    const maxCreateAttempts = 5;
    let record: AnamnesisRecord | null = null;

    for (let attempt = 1; attempt <= maxCreateAttempts; attempt += 1) {
      try {
        record = await this.prisma.anamnesisRecord.create({
          data: {
            code: await this.nextCode(),
            patientName: dto.patientName,
            patientId: dto.patientId || null,
            clinicId,
            customFieldsJson: dto.customFields ? JSON.stringify(dto.customFields) : null,
            templateConfigJson: dto.templateConfig ? JSON.stringify(dto.templateConfig) : null,
            status: "DRAFT",
            createdById: user.id,
            updatedById: user.id
          }
        });
        break;
      } catch (error) {
        if (attempt === maxCreateAttempts || !this.isUniqueConstraintError(error)) throw error;
      }
    }

    if (!record) {
      throw new BadRequestException("Não foi possível gerar um código único para a anamnese.");
    }

    if (dto.answers) {
      await this.replaceAnswers(record.id, dto.answers);
    }

    this.invalidateRecordCaches(record.id, clinicId);
    const createdRecord = await this.getByIdInClinic(record.id, clinicId);
    return createdRecord;
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateAnamnesisDto) {
    const clinicId = this.resolveDefaultClinicId(user);
    const existingRecord = await this.findRecord(id, clinicId);
    if (dto.patientId) await this.ensurePatientInClinic(dto.patientId, clinicId);

    if (existingRecord.status === "FINALIZED") {
      throw new BadRequestException("Anamnese finalizada não pode ser editada.");
    }

    this.ensureCompletedTemplatesAreUnchanged(existingRecord, dto);

    const beforeData = this.toRecordResponse(existingRecord);
    const createdTemplates = this.getCreatedCustomTemplates(existingRecord.templateConfigJson, dto.templateConfig);

    await this.prisma.anamnesisRecord.update({
      where: { id },
      data: {
        patientName: dto.patientName ?? existingRecord.patientName,
        patientId: dto.patientId === undefined ? existingRecord.patientId : dto.patientId || null,
        customFieldsJson: dto.customFields === undefined ? existingRecord.customFieldsJson : JSON.stringify(dto.customFields),
        templateConfigJson: dto.templateConfig === undefined ? existingRecord.templateConfigJson : JSON.stringify(dto.templateConfig),
        updatedById: user.id
      }
    });

    if (dto.answers) {
      await this.replaceAnswers(id, dto.answers);
    }

    this.invalidateRecordCaches(id, clinicId);
    const updatedRecord = await this.getByIdInClinic(id, clinicId);
    if (createdTemplates.length > 0) {
      await this.writeAuditLog(user.id, clinicId, "create_anamnesis_template", id, beforeData, { record: updatedRecord, createdTemplates });
    }
    return updatedRecord;
  }

  async deleteDraft(user: AuthenticatedUser, id: string) {
    const clinicId = this.resolveDefaultClinicId(user);
    const record = await this.findRecord(id, clinicId);

    if (record.status !== "DRAFT") {
      throw new BadRequestException("Apenas rascunhos de anamnese podem ser excluídos.");
    }

    const beforeData = this.toRecordResponse(record);
    await this.prisma.anamnesisRecord.delete({ where: { id } });
    this.invalidateRecordCaches(id, clinicId);
    if (beforeData.patientId) {
      this.cache.deleteByPrefix(`patients:detail:${clinicId}:${beforeData.patientId}:`);
      this.cache.deleteByPrefix(`patients:medical-record:${clinicId}:${beforeData.patientId}:`);
    }
    await this.writeAuditLog(user.id, clinicId, "delete_draft_anamnesis", id, beforeData, null);
    return { id };
  }

  async finalize(user: AuthenticatedUser, id: string) {
    const clinicId = this.resolveDefaultClinicId(user);
    const record = await this.findRecord(id, clinicId);

    if (record.status === "FINALIZED") {
      return this.toRecordResponse(record);
    }

    const answers = this.answersFromRecord(record);
    const incompleteTemplates = await this.getIncompleteTemplates(this.templateStatusesFromRecord(record), record.templateConfigJson, user.permissions);

    if (incompleteTemplates.length > 0) {
      throw new BadRequestException({
        message: "Conclua todas as fichas antes de finalizar a anamnese completa.",
        incompleteTemplates
      });
    }

    const missingRequiredFields = await this.getMissingRequiredFields(answers, undefined, user.permissions);

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
        updatedById: user.id
      }
    });

    this.invalidateRecordCaches(id, clinicId);
    const finalizedRecord = await this.getByIdInClinic(id, clinicId);
    await this.createMedicalRecordEntry(user.id, finalizedRecord);
    if (finalizedRecord.patientId) {
      this.cache.deleteByPrefix(`patients:detail:${clinicId}:${finalizedRecord.patientId}:`);
      this.cache.deleteByPrefix(`patients:medical-record:${clinicId}:${finalizedRecord.patientId}:`);
    }
    await this.writeAuditLog(user.id, clinicId, "finalize_anamnesis", id, beforeData, finalizedRecord);
    return finalizedRecord;
  }

  async completeTemplate(user: AuthenticatedUser, id: string, templateId: string) {
    const clinicId = this.resolveDefaultClinicId(user);
    const record = await this.findRecord(id, clinicId);

    if (record.status === "FINALIZED") {
      throw new BadRequestException("Anamnese finalizada não pode ser editada.");
    }

    await this.ensureRecordTemplateExists(record, templateId);
  this.ensureTemplateAccess(templateId, user.permissions);
    const answers = this.answersFromRecord(record);
  const missingRequiredFields = await this.getMissingRequiredFields(answers, templateId, user.permissions);

    if (missingRequiredFields.length > 0) {
      throw new BadRequestException({
        message: "Existem campos obrigatórios pendentes nesta ficha.",
        missingRequiredFields
      });
    }

    const beforeData = this.toRecordResponse(record);
    const templateStatuses: TemplateStatuses = {
      ...this.templateStatusesFromRecord(record),
      [templateId]: {
        status: "completed",
        completedAt: new Date().toISOString(),
        completedById: user.id
      }
    };

    await this.prisma.anamnesisRecord.update({
      where: { id },
      data: {
        templateStatusesJson: JSON.stringify(templateStatuses),
        updatedById: user.id
      }
    });

    this.invalidateRecordCaches(id, clinicId);
    const completedRecord = await this.getByIdInClinic(id, clinicId);
    await this.writeAuditLog(user.id, clinicId, "complete_anamnesis_template", id, beforeData, completedRecord);
    return completedRecord;
  }

  private invalidateRecordCaches(recordId: string, clinicId?: string | null) {
    this.cache.deleteByPrefix("anamnesis:records:list");
    this.cache.delete(`anamnesis:record:${recordId}`);
    if (clinicId) this.cache.delete(`anamnesis:record:${clinicId}:${recordId}`);
  }

  async emitPdfDocument(user: AuthenticatedUser, id: string) {
    const clinicId = this.resolveDefaultClinicId(user);
    const record = await this.findRecord(id, clinicId);

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
        clinicId,
        anamnesisRecordId: record.id,
        emittedById: user.id
      }
    });

    await this.writeAuditLog(user.id, clinicId, "emit_anamnesis_pdf", id, null, document);

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

  async emitTemplatePdfDocument(user: AuthenticatedUser, id: string, templateId: string) {
    const clinicId = this.resolveDefaultClinicId(user);
    const record = await this.findRecord(id, clinicId);
    const template = await this.ensureRecordTemplateExists(record, templateId);
    this.ensureTemplateAccess(templateId, user.permissions);
    const templateStatus = this.templateStatusesFromRecord(record)[templateId];

    if (templateStatus?.status !== "completed") {
      throw new BadRequestException("Apenas fichas concluídas podem gerar documento parcial rastreável.");
    }

    const snapshot = this.toRecordResponse(record);
    const contentHash = createHash("sha256").update(JSON.stringify({ record: snapshot, templateId })).digest("hex");
    const document = await this.prisma.clinicalDocument.create({
      data: {
        code: await this.nextDocumentCode(),
        type: "ANAMNESIS_TEMPLATE_PDF",
        fileName: `${record.code}-${templateId}.pdf`,
        contentHash,
        metadataJson: JSON.stringify({ recordCode: record.code, templateId, templateTitle: template.title, scope: "template", emittedFrom: "web-pdf-export" }),
        patientId: record.patientId,
        clinicId,
        anamnesisRecordId: record.id,
        emittedById: user.id
      }
    });

    await this.writeAuditLog(user.id, clinicId, "emit_anamnesis_template_pdf", id, null, document);

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

  private async findRecord(id: string, clinicId: string) {
    const record = await this.prisma.anamnesisRecord.findFirst({
      where: { id, clinicId },
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
    const record = await this.prisma.anamnesisRecord.findUnique({ where: { id: recordId }, select: { customFieldsJson: true } });
    const allowedCustomFields = this.getAllowedCustomAnswerKeys(record?.customFieldsJson ?? null);
    const questions = await this.cache.getOrSet("anamnesis:questions:active", 10 * 60 * 1000, () => this.prisma.anamnesisQuestion.findMany({
      where: { active: true },
      include: {
        section: {
          include: {
            template: true
          }
        }
      }
    }));
    const questionsByTemplateAndKey = new Map(questions.map((question) => [`${question.section.template.key}:${question.key}`, question]));
    const answerWrites = [];
    const customAnswers: AnamnesisAnswers = {};

    for (const [templateKey, templateAnswers] of Object.entries(answers)) {
      for (const [fieldKey, value] of Object.entries(templateAnswers)) {
        const question = questionsByTemplateAndKey.get(`${templateKey}:${fieldKey}`);

        if (!question) {
          if (allowedCustomFields.has(`${templateKey}:${fieldKey}`)) {
            customAnswers[templateKey] = customAnswers[templateKey] ?? {};
            customAnswers[templateKey][fieldKey] = value;
            continue;
          }

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
      this.prisma.anamnesisRecord.update({ where: { id: recordId }, data: { customAnswersJson: Object.keys(customAnswers).length > 0 ? JSON.stringify(customAnswers) : null } }),
      ...answerWrites
    ]);
  }

  private getAllowedCustomAnswerKeys(customFieldsJson: string | null) {
    const allowedKeys = new Set<string>();
    if (!customFieldsJson) return allowedKeys;

    const customFields = JSON.parse(customFieldsJson) as CustomFieldsJson;

    for (const [templateKey, sections] of Object.entries(customFields)) {
      for (const [sectionKey, fields] of Object.entries(sections)) {
        if (sectionKey.startsWith("__overrides__")) continue;
        for (const field of fields) {
          if (field.id) allowedKeys.add(`${templateKey}:${field.id}`);
        }
      }
    }

    return allowedKeys;
  }

  private getCreatedCustomTemplates(beforeTemplateConfigJson: string | null, afterTemplateConfig: TemplateConfigItem[] | undefined) {
    if (!afterTemplateConfig) return [];

    const beforeTemplateConfig = beforeTemplateConfigJson ? JSON.parse(beforeTemplateConfigJson) as TemplateConfigItem[] : [];
    const beforeTemplateIds = new Set(beforeTemplateConfig.map((templateConfig) => templateConfig.id).filter(Boolean));

    return afterTemplateConfig.filter((templateConfig) => {
      const isCustomTemplate = templateConfig.isCustom || templateConfig.id?.startsWith("custom-template-");
      return isCustomTemplate && templateConfig.id && !beforeTemplateIds.has(templateConfig.id);
    }).map((templateConfig) => ({
      id: templateConfig.id,
      title: templateConfig.title,
      shortTitle: templateConfig.shortTitle
    }));
  }

  private ensureCompletedTemplatesAreUnchanged(record: RecordWithAnswers, dto: UpdateAnamnesisDto) {
    const completedTemplateIds = Object.entries(this.templateStatusesFromRecord(record))
      .filter(([, templateStatus]) => templateStatus.status === "completed")
      .map(([templateId]) => templateId);

    if (completedTemplateIds.length === 0) return;

    const existingAnswers = dto.answers ? this.answersFromRecord(record) : null;
    const existingCustomFields = record.customFieldsJson ? JSON.parse(record.customFieldsJson) as Record<string, unknown> : {};
    const existingTemplateConfig = record.templateConfigJson ? JSON.parse(record.templateConfigJson) as TemplateConfigItem[] : [];

    for (const templateId of completedTemplateIds) {
      if (dto.answers && Object.prototype.hasOwnProperty.call(dto.answers, templateId) && this.stableStringify(dto.answers[templateId] ?? {}) !== this.stableStringify(existingAnswers?.[templateId] ?? {})) {
        throw new BadRequestException("Ficha concluída não pode ser editada.");
      }

      if (dto.customFields && Object.prototype.hasOwnProperty.call(dto.customFields, templateId) && this.stableStringify(dto.customFields[templateId] ?? {}) !== this.stableStringify(existingCustomFields[templateId] ?? {})) {
        throw new BadRequestException("Ficha concluída não pode ser editada.");
      }

      if (dto.templateConfig) {
        const nextTemplateConfig = dto.templateConfig.find((templateConfig) => templateConfig.id === templateId);
        const currentTemplateConfig = existingTemplateConfig.find((templateConfig) => templateConfig.id === templateId);

        if (this.stableStringify(nextTemplateConfig ?? null) !== this.stableStringify(currentTemplateConfig ?? null)) {
          throw new BadRequestException("Ficha concluída não pode ser editada.");
        }
      }
    }
  }

  private stableStringify(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map((item) => this.stableStringify(item)).join(",")}]`;
    if (value && typeof value === "object") {
      return `{${Object.entries(value as Record<string, unknown>)
        .sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey))
        .map(([key, item]) => `${JSON.stringify(key)}:${this.stableStringify(item)}`)
        .join(",")}}`;
    }

    return JSON.stringify(value);
  }

  private async getMissingRequiredFields(answers: AnamnesisAnswers, templateId?: string, userPermissions: string[] = []) {
    const requiredQuestions = await this.cache.getOrSet("anamnesis:questions:required", 10 * 60 * 1000, () => this.prisma.anamnesisQuestion.findMany({
      where: { active: true, required: true },
      orderBy: { sortOrder: "asc" },
      include: {
        section: {
          include: {
            template: true
          }
        }
      }
    }));

    return requiredQuestions
      .filter((question) => !templateId || question.section.template.key === templateId)
      .filter((question) => this.canAccessTemplate(question.section.template.key, userPermissions))
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
    const customAnswers = record.customAnswersJson ? JSON.parse(record.customAnswersJson) as AnamnesisAnswers : {};
    return record.answers.reduce<AnamnesisAnswers>((accumulator, answer) => {
      const templateKey = answer.question.section.template.key;
      accumulator[templateKey] = accumulator[templateKey] ?? {};
      accumulator[templateKey][answer.question.key] = answer.valueText ? JSON.parse(answer.valueText) : null;
      return accumulator;
    }, customAnswers);
  }

  private templateStatusesFromRecord(record: { templateStatusesJson?: string | null }) {
    return record.templateStatusesJson ? JSON.parse(record.templateStatusesJson) as TemplateStatuses : {};
  }

  private async ensureRecordTemplateExists(record: { templateConfigJson?: string | null }, templateId: string) {
    const configuredTemplate = this.templateConfigFromRecord(record).find((template) => template.id === templateId);

    if (configuredTemplate?.id) {
      return {
        key: configuredTemplate.id,
        title: configuredTemplate.title || configuredTemplate.shortTitle || configuredTemplate.id
      };
    }

    const template = await this.prisma.anamnesisTemplate.findUnique({ where: { key: templateId } });

    if (!template || !template.active) {
      throw new BadRequestException("Ficha de anamnese desconhecida.");
    }

    return template;
  }

  private templateConfigFromRecord(record: { templateConfigJson?: string | null }) {
    return record.templateConfigJson ? JSON.parse(record.templateConfigJson) as TemplateConfigItem[] : [];
  }

  private async getIncompleteTemplates(templateStatuses: TemplateStatuses, templateConfigJson?: string | null, userPermissions: string[] = []) {
    const configuredTemplates = templateConfigJson ? JSON.parse(templateConfigJson) as TemplateConfigItem[] : [];
    const templates = configuredTemplates.length > 0 ? configuredTemplates : await this.getTemplates(userPermissions);
    return templates
      .map((template) => ({ id: template.id ?? "", title: template.title ?? template.shortTitle ?? template.id ?? "Ficha" }))
      .filter((template) => template.id.length > 0)
      .filter((template) => this.canAccessTemplate(template.id, userPermissions))
      .filter((template) => templateStatuses[template.id]?.status !== "completed")
      .map((template) => ({ templateId: template.id, templateTitle: template.title }));
  }

  private toRecordResponse(record: RecordWithAnswers) {
    return {
      ...this.toListItem(record),
      answers: this.answersFromRecord(record),
      customFields: record.customFieldsJson ? JSON.parse(record.customFieldsJson) : undefined,
      templateConfig: record.templateConfigJson ? JSON.parse(record.templateConfigJson) : undefined,
      templateStatuses: this.templateStatusesFromRecord(record)
    };
  }

  private toListItem(record: {
    id: string;
    code: string;
    status: AnamnesisStatus;
    patientName: string;
    patientId: string | null;
    clinicId: string | null;
    customFieldsJson?: string | null;
    customAnswersJson?: string | null;
    templateConfigJson?: string | null;
    templateStatusesJson?: string | null;
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
      clinicId: record.clinicId,
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
    const prefix = `ANA-${year}-`;
    const latestRecord = await this.prisma.anamnesisRecord.findFirst({
      where: { code: { startsWith: prefix } },
      orderBy: { code: "desc" },
      select: { code: true }
    });
    const latestSequence = Number.parseInt(latestRecord?.code.replace(prefix, "") ?? "0", 10);
    return `${prefix}${String((Number.isFinite(latestSequence) ? latestSequence : 0) + 1).padStart(4, "0")}`;
  }

  private isUniqueConstraintError(error: unknown) {
    return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
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

  private async createMedicalRecordEntry(userId: string, record: ReturnType<AnamnesisService["toRecordResponse"]>) {
    if (!record.patientId || !record.clinicId) return;

    const existingEntry = await this.prisma.medicalRecordEntry.findFirst({
      where: { anamnesisRecordId: record.id, clinicId: record.clinicId, type: "ANAMNESIS_FINALIZED" }
    });

    if (existingEntry) return;

    await this.prisma.medicalRecordEntry.create({
      data: {
        patientId: record.patientId,
        clinicId: record.clinicId,
        anamnesisRecordId: record.id,
        type: "ANAMNESIS_FINALIZED",
        title: `Anamnese finalizada ${record.code}`,
        summary: `Anamnese finalizada para ${record.patientName}.`,
        createdById: userId
      }
    });
  }

  private getAuditReason(action: string, afterData: unknown) {
    if (action === "create_anamnesis_template") {
      const payload = afterData as { createdTemplates?: Array<{ title?: string; shortTitle?: string }> };
      const templateNames = payload.createdTemplates?.map((template) => template.title ?? template.shortTitle).filter(Boolean).join(", ");
      return `Ficha personalizada criada${templateNames ? `: ${templateNames}` : ""}`;
    }

    if (action === "complete_anamnesis_template") return "Ficha de anamnese concluída";
    if (action === "finalize_anamnesis") return "Anamnese completa finalizada";
    if (action === "delete_draft_anamnesis") return "Rascunho de anamnese excluído";
    if (action === "emit_anamnesis_pdf") return "PDF completo de anamnese emitido";
    if (action === "emit_anamnesis_template_pdf") return "PDF parcial de ficha emitido";
    return "Evento de anamnese registrado";
  }

  private async writeAuditLog(userId: string, clinicId: string, action: string, entityId: string, beforeData: unknown, afterData: unknown) {
    await this.prisma.auditLog.create({
      data: {
        entity: "anamnesis_record",
        entityId,
        action,
        beforeData: beforeData ? JSON.stringify(beforeData) : null,
        afterData: afterData ? JSON.stringify(afterData) : null,
        reason: this.getAuditReason(action, afterData),
        userId,
        clinicId
      }
    });
    this.cache.deleteByPrefix("access:audit-logs:");
  }

  private async ensurePatientInClinic(patientId: string, clinicId: string) {
    const patientClinic = await this.prisma.patientClinic.findUnique({ where: { patientId_clinicId: { patientId, clinicId } }, select: { status: true } });
    if (!patientClinic || patientClinic.status !== "ACTIVE") throw new NotFoundException("Paciente não encontrado.");
  }

  private resolveScopedClinicId(user: AuthenticatedUser, requestedClinicId?: string) {
    const normalizedClinicId = requestedClinicId?.trim();
    if (!normalizedClinicId) return this.resolveDefaultClinicId(user);
    if (!this.hasPermission(user.permissions, "anamnese.clinic_filter")) throw new BadRequestException("Usuário sem permissão para filtrar anamneses por clínica.");
    if (!user.availableClinicIds.includes(normalizedClinicId)) throw new BadRequestException("Clínica fora do escopo do usuário.");
    return normalizedClinicId;
  }

  private resolveScopedClinicIds(user: AuthenticatedUser, requestedClinicId?: string) {
    const normalizedClinicId = requestedClinicId?.trim();
    if (normalizedClinicId) return [this.resolveScopedClinicId(user, normalizedClinicId)];
    if (user.availableClinicIds.length === 0) throw new BadRequestException("Usuário sem clínica disponível.");
    return user.availableClinicIds;
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

  private hasPermission(userPermissions: string[], permission: string) {
    return userPermissions.includes("admin.full_access") || userPermissions.includes(permission);
  }
}