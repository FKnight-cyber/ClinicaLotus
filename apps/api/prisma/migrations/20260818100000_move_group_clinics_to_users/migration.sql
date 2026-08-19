INSERT INTO "UserClinic" ("userId", "clinicId", "status", "isDefault", "assignedAt")
SELECT DISTINCT ON (uag."userId", agc."clinicId")
  uag."userId",
  agc."clinicId",
  'ACTIVE'::"UserClinicStatus",
  false,
  agc."assignedAt"
FROM "UserAccessGroup" uag
JOIN "AccessGroup" ag ON ag."id" = uag."accessGroupId" AND ag."active" = true
JOIN "AccessGroupClinic" agc ON agc."accessGroupId" = ag."id"
JOIN "Clinic" c ON c."id" = agc."clinicId" AND c."status" = 'ACTIVE'::"ClinicStatus"
ORDER BY uag."userId", agc."clinicId", agc."assignedAt" ASC
ON CONFLICT ("userId", "clinicId") DO NOTHING;

DROP TABLE "AccessGroupClinic";