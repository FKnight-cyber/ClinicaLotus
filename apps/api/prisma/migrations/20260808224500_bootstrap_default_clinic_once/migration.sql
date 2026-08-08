DO $$
DECLARE
  default_clinic_id TEXT;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "AuditLog"
    WHERE "entity" = 'system_bootstrap'
      AND "action" = 'bootstrap_default_clinic_once'
  ) THEN
    RAISE NOTICE 'Bootstrap da clínica padrão já registrado. Nenhuma alteração aplicada.';
    RETURN;
  END IF;

  INSERT INTO "Clinic" ("id", "name", "code", "document", "status", "createdAt", "updatedAt")
  VALUES (
    md5(random()::text || clock_timestamp()::text),
    'Clínica 1',
    'CLINICA-1',
    '00.000.000/0001-00',
    'ACTIVE'::"ClinicStatus",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
  ON CONFLICT ("code") DO UPDATE
  SET
    "name" = EXCLUDED."name",
    "document" = EXCLUDED."document",
    "status" = EXCLUDED."status",
    "updatedAt" = CURRENT_TIMESTAMP
  RETURNING "id" INTO default_clinic_id;

  DELETE FROM "UserClinic";

  INSERT INTO "AccessGroupClinic" ("accessGroupId", "clinicId", "assignedAt")
  SELECT "id", default_clinic_id, CURRENT_TIMESTAMP
  FROM "AccessGroup"
  ON CONFLICT ("accessGroupId", "clinicId") DO NOTHING;

  UPDATE "Patient" SET "clinicId" = default_clinic_id;
  UPDATE "AnamnesisRecord" SET "clinicId" = default_clinic_id;
  UPDATE "MedicalEvolution" SET "clinicId" = default_clinic_id;
  UPDATE "MedicalRecordEntry" SET "clinicId" = default_clinic_id;
  UPDATE "ClinicalDocument" SET "clinicId" = default_clinic_id;
  UPDATE "AuditLog"
  SET "clinicId" = default_clinic_id
  WHERE "entity" IN ('patient', 'anamnesis_record', 'medical_evolution');

  INSERT INTO "AuditLog" ("id", "entity", "entityId", "action", "beforeData", "afterData", "reason", "userId", "clinicId", "createdAt")
  VALUES (
    md5(random()::text || clock_timestamp()::text),
    'system_bootstrap',
    default_clinic_id,
    'bootstrap_default_clinic_once',
    NULL,
    json_build_object(
      'clinic', json_build_object('id', default_clinic_id, 'code', 'CLINICA-1', 'name', 'Clínica 1')
    )::text,
    'Bootstrap one-off da clínica padrão executado via migration.',
    NULL,
    default_clinic_id,
    CURRENT_TIMESTAMP
  );
END $$;