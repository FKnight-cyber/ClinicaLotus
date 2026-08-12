DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PatientClinicStatus') THEN
    CREATE TYPE "PatientClinicStatus" AS ENUM ('ACTIVE', 'INACTIVE');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "PatientClinic" (
  "patientId" TEXT NOT NULL,
  "clinicId" TEXT NOT NULL,
  "status" "PatientClinicStatus" NOT NULL DEFAULT 'ACTIVE',
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3),
  CONSTRAINT "PatientClinic_pkey" PRIMARY KEY ("patientId", "clinicId")
);

CREATE INDEX IF NOT EXISTS "PatientClinic_clinicId_status_idx" ON "PatientClinic"("clinicId", "status");

ALTER TABLE "PatientClinic"
  ADD CONSTRAINT "PatientClinic_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PatientClinic"
  ADD CONSTRAINT "PatientClinic_clinicId_fkey"
  FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "PatientClinic" ("patientId", "clinicId", "status", "firstSeenAt", "lastSeenAt")
SELECT "id", "clinicId", CASE WHEN "status" = 'ACTIVE' THEN 'ACTIVE'::"PatientClinicStatus" ELSE 'INACTIVE'::"PatientClinicStatus" END, "createdAt", "updatedAt"
FROM "Patient"
ON CONFLICT ("patientId", "clinicId") DO UPDATE
SET
  "status" = EXCLUDED."status",
  "firstSeenAt" = LEAST("PatientClinic"."firstSeenAt", EXCLUDED."firstSeenAt"),
  "lastSeenAt" = GREATEST(COALESCE("PatientClinic"."lastSeenAt", EXCLUDED."lastSeenAt"), COALESCE(EXCLUDED."lastSeenAt", "PatientClinic"."lastSeenAt"));