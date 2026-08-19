UPDATE "Patient" p
SET "admissionDate" = COALESCE(
  (
    SELECT pcs."admissionDate"
    FROM "PatientClinicStay" pcs
    WHERE pcs."patientId" = p."id"
      AND pcs."clinicId" = p."clinicId"
      AND pcs."status" = 'ACTIVE'
    ORDER BY pcs."admissionDate" DESC, pcs."createdAt" DESC
    LIMIT 1
  ),
  (
    SELECT pcs."admissionDate"
    FROM "PatientClinicStay" pcs
    WHERE pcs."patientId" = p."id"
      AND pcs."status" = 'ACTIVE'
    ORDER BY pcs."admissionDate" DESC, pcs."createdAt" DESC
    LIMIT 1
  ),
  (
    SELECT pcs."admissionDate"
    FROM "PatientClinicStay" pcs
    WHERE pcs."patientId" = p."id"
    ORDER BY pcs."admissionDate" DESC, pcs."createdAt" DESC
    LIMIT 1
  )
)
WHERE p."admissionDate" IS NULL;