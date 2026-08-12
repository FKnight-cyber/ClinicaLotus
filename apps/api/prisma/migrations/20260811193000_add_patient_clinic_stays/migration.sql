CREATE TYPE "PatientClinicStayStatus" AS ENUM ('ACTIVE', 'DISCHARGED');

CREATE TABLE "PatientClinicStay" (
  "id" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "clinicId" TEXT NOT NULL,
  "status" "PatientClinicStayStatus" NOT NULL DEFAULT 'ACTIVE',
  "admissionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dischargeDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PatientClinicStay_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PatientClinicStay"
  ADD CONSTRAINT "PatientClinicStay_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PatientClinicStay"
  ADD CONSTRAINT "PatientClinicStay_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "PatientClinicStay_patientId_status_admissionDate_idx" ON "PatientClinicStay"("patientId", "status", "admissionDate");
CREATE INDEX "PatientClinicStay_clinicId_status_admissionDate_idx" ON "PatientClinicStay"("clinicId", "status", "admissionDate");

INSERT INTO "PatientClinicStay" ("id", "patientId", "clinicId", "status", "admissionDate", "dischargeDate", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  pc."patientId",
  pc."clinicId",
  CASE
    WHEN pc."status" = 'ACTIVE' AND p."status" = 'ACTIVE' AND p."dischargeDate" IS NULL THEN 'ACTIVE'::"PatientClinicStayStatus"
    ELSE 'DISCHARGED'::"PatientClinicStayStatus"
  END,
  COALESCE(p."admissionDate", pc."firstSeenAt", p."createdAt"),
  CASE
    WHEN pc."status" = 'ACTIVE' AND p."status" = 'ACTIVE' AND p."dischargeDate" IS NULL THEN NULL
    ELSE COALESCE(p."dischargeDate", pc."lastSeenAt", p."updatedAt")
  END,
  pc."firstSeenAt",
  GREATEST(COALESCE(pc."lastSeenAt", pc."firstSeenAt"), p."updatedAt", pc."firstSeenAt")
FROM "PatientClinic" pc
JOIN "Patient" p ON p."id" = pc."patientId";

INSERT INTO "PatientClinicStay" ("id", "patientId", "clinicId", "status", "admissionDate", "dischargeDate", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  p."id",
  p."clinicId",
  CASE
    WHEN p."status" = 'ACTIVE' AND p."dischargeDate" IS NULL THEN 'ACTIVE'::"PatientClinicStayStatus"
    ELSE 'DISCHARGED'::"PatientClinicStayStatus"
  END,
  COALESCE(p."admissionDate", p."createdAt"),
  CASE
    WHEN p."status" = 'ACTIVE' AND p."dischargeDate" IS NULL THEN NULL
    ELSE COALESCE(p."dischargeDate", p."updatedAt")
  END,
  p."createdAt",
  p."updatedAt"
FROM "Patient" p
WHERE NOT EXISTS (
  SELECT 1
  FROM "PatientClinic" pc
  WHERE pc."patientId" = p."id"
);