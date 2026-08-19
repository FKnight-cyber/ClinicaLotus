INSERT INTO "UserClinic" ("userId", "clinicId", "status", "isDefault", "assignedAt")
SELECT
  u."id",
  c."id",
  'ACTIVE'::"UserClinicStatus",
  NOT EXISTS (
    SELECT 1
    FROM "UserClinic" uc
    WHERE uc."userId" = u."id" AND uc."isDefault" = true
  ),
  CURRENT_TIMESTAMP
FROM "User" u
JOIN "Clinic" c ON c."code" = 'CLINICA-1' AND c."status" = 'ACTIVE'::"ClinicStatus"
ON CONFLICT ("userId", "clinicId") DO UPDATE
SET "status" = 'ACTIVE'::"UserClinicStatus";