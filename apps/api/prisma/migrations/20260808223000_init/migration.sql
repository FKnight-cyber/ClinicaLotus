-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PasswordChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'CANCELED');

-- CreateEnum
CREATE TYPE "PatientStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ClinicStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "UserClinicStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "AnamnesisStatus" AS ENUM ('DRAFT', 'FINALIZED', 'CANCELED');

-- CreateEnum
CREATE TYPE "MedicalEvolutionStatus" AS ENUM ('DRAFT', 'FINALIZED', 'CANCELED');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('TEXT', 'TEXTAREA', 'DATE', 'TIME', 'NUMBER', 'YES_NO', 'YES_NO_DETAILS', 'SINGLE_CHOICE', 'MULTI_CHOICE', 'TABLE');

-- CreateEnum
CREATE TYPE "TableRowSource" AS ENUM ('TEMPLATE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('MANAGER', 'PATIENT', 'NURSE', 'DOCTOR');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "userType" "UserType" NOT NULL DEFAULT 'MANAGER',
    "professionalArea" TEXT,
    "professionalCouncil" TEXT,
    "professionalRegistration" TEXT,
    "professionalCouncilState" TEXT,
    "professionalSpecialty" TEXT,
    "passwordHash" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Clinic" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "document" TEXT,
    "status" "ClinicStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Clinic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserClinic" (
    "userId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "status" "UserClinicStatus" NOT NULL DEFAULT 'ACTIVE',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserClinic_pkey" PRIMARY KEY ("userId","clinicId")
);

-- CreateTable
CREATE TABLE "PasswordChangeRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestedPasswordHash" TEXT,
    "status" "PasswordChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PasswordChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessGroupClinic" (
    "accessGroupId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessGroupClinic_pkey" PRIMARY KEY ("accessGroupId","clinicId")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAccessGroup" (
    "userId" TEXT NOT NULL,
    "accessGroupId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAccessGroup_pkey" PRIMARY KEY ("userId","accessGroupId")
);

-- CreateTable
CREATE TABLE "AccessGroupPermission" (
    "accessGroupId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessGroupPermission_pkey" PRIMARY KEY ("accessGroupId","permissionId")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "PatientStatus" NOT NULL DEFAULT 'ACTIVE',
    "clinicId" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3),
    "document" TEXT,
    "cpf" TEXT,
    "rg" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnamnesisTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "shortTitle" TEXT,
    "source" TEXT,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnamnesisTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnamnesisSection" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AnamnesisSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnamnesisQuestion" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "placeholder" TEXT,
    "helper" TEXT,
    "tableColumnsJson" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AnamnesisQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnamnesisQuestionOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AnamnesisQuestionOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnamnesisQuestionTableRow" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AnamnesisQuestionTableRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnamnesisRecord" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "AnamnesisStatus" NOT NULL DEFAULT 'DRAFT',
    "patientName" TEXT NOT NULL,
    "patientId" TEXT,
    "clinicId" TEXT NOT NULL,
    "customFieldsJson" TEXT,
    "customAnswersJson" TEXT,
    "templateConfigJson" TEXT,
    "templateStatusesJson" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnamnesisRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalRecordEntry" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "anamnesisRecordId" TEXT,
    "medicalEvolutionId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedicalRecordEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalEvolution" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "status" "MedicalEvolutionStatus" NOT NULL DEFAULT 'DRAFT',
    "evolutionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "text" TEXT NOT NULL,
    "professionalArea" TEXT,
    "professionalName" TEXT,
    "finalizedProfessionalName" TEXT,
    "finalizedProfessionalCouncil" TEXT,
    "finalizedProfessionalRegistration" TEXT,
    "finalizedProfessionalCouncilState" TEXT,
    "finalizedProfessionalSpecialty" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "finalizedById" TEXT,
    "canceledById" TEXT,
    "finalizedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicalEvolution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalDocument" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "metadataJson" TEXT,
    "patientId" TEXT,
    "clinicId" TEXT NOT NULL,
    "anamnesisRecordId" TEXT,
    "medicalEvolutionId" TEXT,
    "emittedById" TEXT,
    "emittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClinicalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnamnesisAnswer" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "valueText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnamnesisAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnamnesisTableRow" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "source" "TableRowSource" NOT NULL DEFAULT 'TEMPLATE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AnamnesisTableRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnamnesisTableCell" (
    "id" TEXT NOT NULL,
    "rowId" TEXT NOT NULL,
    "columnKey" TEXT NOT NULL,
    "valueText" TEXT,

    CONSTRAINT "AnamnesisTableCell_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "action" TEXT NOT NULL,
    "beforeData" TEXT,
    "afterData" TEXT,
    "reason" TEXT,
    "userId" TEXT,
    "clinicId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_login_key" ON "User"("login");

-- CreateIndex
CREATE UNIQUE INDEX "User_name_key" ON "User"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Clinic_code_key" ON "Clinic"("code");

-- CreateIndex
CREATE INDEX "Clinic_status_name_idx" ON "Clinic"("status", "name");

-- CreateIndex
CREATE INDEX "UserClinic_clinicId_status_idx" ON "UserClinic"("clinicId", "status");

-- CreateIndex
CREATE INDEX "PasswordChangeRequest_status_requestedAt_idx" ON "PasswordChangeRequest"("status", "requestedAt");

-- CreateIndex
CREATE INDEX "PasswordChangeRequest_userId_status_idx" ON "PasswordChangeRequest"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AccessGroup_name_key" ON "AccessGroup"("name");

-- CreateIndex
CREATE INDEX "AccessGroupClinic_clinicId_idx" ON "AccessGroupClinic"("clinicId");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE INDEX "Patient_clinicId_status_idx" ON "Patient"("clinicId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AnamnesisTemplate_key_key" ON "AnamnesisTemplate"("key");

-- CreateIndex
CREATE UNIQUE INDEX "AnamnesisSection_templateId_key_key" ON "AnamnesisSection"("templateId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "AnamnesisQuestion_sectionId_key_key" ON "AnamnesisQuestion"("sectionId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "AnamnesisRecord_code_key" ON "AnamnesisRecord"("code");

-- CreateIndex
CREATE INDEX "AnamnesisRecord_clinicId_createdAt_idx" ON "AnamnesisRecord"("clinicId", "createdAt");

-- CreateIndex
CREATE INDEX "MedicalRecordEntry_clinicId_createdAt_idx" ON "MedicalRecordEntry"("clinicId", "createdAt");

-- CreateIndex
CREATE INDEX "MedicalEvolution_patientId_evolutionDate_idx" ON "MedicalEvolution"("patientId", "evolutionDate");

-- CreateIndex
CREATE INDEX "MedicalEvolution_clinicId_evolutionDate_idx" ON "MedicalEvolution"("clinicId", "evolutionDate");

-- CreateIndex
CREATE INDEX "MedicalEvolution_status_idx" ON "MedicalEvolution"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalDocument_code_key" ON "ClinicalDocument"("code");

-- CreateIndex
CREATE INDEX "ClinicalDocument_clinicId_emittedAt_idx" ON "ClinicalDocument"("clinicId", "emittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AnamnesisAnswer_recordId_questionId_key" ON "AnamnesisAnswer"("recordId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "AnamnesisTableCell_rowId_columnKey_key" ON "AnamnesisTableCell"("rowId", "columnKey");

-- CreateIndex
CREATE INDEX "AuditLog_entity_createdAt_idx" ON "AuditLog"("entity", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_clinicId_createdAt_idx" ON "AuditLog"("clinicId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- AddForeignKey
ALTER TABLE "UserClinic" ADD CONSTRAINT "UserClinic_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserClinic" ADD CONSTRAINT "UserClinic_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordChangeRequest" ADD CONSTRAINT "PasswordChangeRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordChangeRequest" ADD CONSTRAINT "PasswordChangeRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessGroupClinic" ADD CONSTRAINT "AccessGroupClinic_accessGroupId_fkey" FOREIGN KEY ("accessGroupId") REFERENCES "AccessGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessGroupClinic" ADD CONSTRAINT "AccessGroupClinic_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAccessGroup" ADD CONSTRAINT "UserAccessGroup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAccessGroup" ADD CONSTRAINT "UserAccessGroup_accessGroupId_fkey" FOREIGN KEY ("accessGroupId") REFERENCES "AccessGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessGroupPermission" ADD CONSTRAINT "AccessGroupPermission_accessGroupId_fkey" FOREIGN KEY ("accessGroupId") REFERENCES "AccessGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessGroupPermission" ADD CONSTRAINT "AccessGroupPermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnamnesisSection" ADD CONSTRAINT "AnamnesisSection_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AnamnesisTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnamnesisQuestion" ADD CONSTRAINT "AnamnesisQuestion_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "AnamnesisSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnamnesisQuestionOption" ADD CONSTRAINT "AnamnesisQuestionOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "AnamnesisQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnamnesisQuestionTableRow" ADD CONSTRAINT "AnamnesisQuestionTableRow_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "AnamnesisQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnamnesisRecord" ADD CONSTRAINT "AnamnesisRecord_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnamnesisRecord" ADD CONSTRAINT "AnamnesisRecord_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnamnesisRecord" ADD CONSTRAINT "AnamnesisRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnamnesisRecord" ADD CONSTRAINT "AnamnesisRecord_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalRecordEntry" ADD CONSTRAINT "MedicalRecordEntry_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalRecordEntry" ADD CONSTRAINT "MedicalRecordEntry_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalRecordEntry" ADD CONSTRAINT "MedicalRecordEntry_anamnesisRecordId_fkey" FOREIGN KEY ("anamnesisRecordId") REFERENCES "AnamnesisRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalRecordEntry" ADD CONSTRAINT "MedicalRecordEntry_medicalEvolutionId_fkey" FOREIGN KEY ("medicalEvolutionId") REFERENCES "MedicalEvolution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalRecordEntry" ADD CONSTRAINT "MedicalRecordEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalEvolution" ADD CONSTRAINT "MedicalEvolution_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalEvolution" ADD CONSTRAINT "MedicalEvolution_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalEvolution" ADD CONSTRAINT "MedicalEvolution_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalEvolution" ADD CONSTRAINT "MedicalEvolution_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalEvolution" ADD CONSTRAINT "MedicalEvolution_finalizedById_fkey" FOREIGN KEY ("finalizedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalEvolution" ADD CONSTRAINT "MedicalEvolution_canceledById_fkey" FOREIGN KEY ("canceledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalDocument" ADD CONSTRAINT "ClinicalDocument_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalDocument" ADD CONSTRAINT "ClinicalDocument_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalDocument" ADD CONSTRAINT "ClinicalDocument_anamnesisRecordId_fkey" FOREIGN KEY ("anamnesisRecordId") REFERENCES "AnamnesisRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalDocument" ADD CONSTRAINT "ClinicalDocument_medicalEvolutionId_fkey" FOREIGN KEY ("medicalEvolutionId") REFERENCES "MedicalEvolution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalDocument" ADD CONSTRAINT "ClinicalDocument_emittedById_fkey" FOREIGN KEY ("emittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnamnesisAnswer" ADD CONSTRAINT "AnamnesisAnswer_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "AnamnesisRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnamnesisAnswer" ADD CONSTRAINT "AnamnesisAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "AnamnesisQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnamnesisTableRow" ADD CONSTRAINT "AnamnesisTableRow_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "AnamnesisRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnamnesisTableRow" ADD CONSTRAINT "AnamnesisTableRow_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "AnamnesisQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnamnesisTableCell" ADD CONSTRAINT "AnamnesisTableCell_rowId_fkey" FOREIGN KEY ("rowId") REFERENCES "AnamnesisTableRow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
