import { spawnSync } from "node:child_process";
import { Client } from "pg";

const databaseUrl = process.env.DATABASE_URL ?? "postgresql://clinica:clinica_dev@localhost:5432/clinica";
const initMigrationName = "20260808223000_init";
const bootstrapMigrationName = "20260808224500_bootstrap_default_clinic_once";
const patientClinicLinksMigrationName = "20260811143000_add_patient_clinic_links";
const patientClinicStaysMigrationName = "20260811193000_add_patient_clinic_stays";
const bootstrapEntity = "system_bootstrap";
const bootstrapAction = "bootstrap_default_clinic_once";
const legacyClinicTables = ["Clinic", "UserClinic"];
const legacyClinicColumns = [
  ["Patient", "clinicId"],
  ["AnamnesisRecord", "clinicId"],
  ["MedicalEvolution", "clinicId"],
  ["MedicalRecordEntry", "clinicId"],
  ["ClinicalDocument", "clinicId"],
  ["AuditLog", "clinicId"]
];

function runPrismaCommand(args) {
  const result = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", ["prisma", ...args], {
    cwd: new URL(".", import.meta.url),
    stdio: "inherit",
    env: process.env
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function hasMigrationsTable(client) {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = '_prisma_migrations'
    ) AS exists
  `);

  return Boolean(result.rows[0]?.exists);
}

async function countApplicationTables(client) {
  const result = await client.query(`
    SELECT COUNT(*)::int AS total
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('User', 'Clinic', 'AuditLog', 'Patient', 'AccessGroup')
  `);

  return result.rows[0]?.total ?? 0;
}

async function hasTable(client, tableName) {
  const result = await client.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = $1
      ) AS exists
    `,
    [tableName]
  );

  return Boolean(result.rows[0]?.exists);
}

async function hasColumn(client, tableName, columnName) {
  const result = await client.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
          AND column_name = $2
      ) AS exists
    `,
    [tableName, columnName]
  );

  return Boolean(result.rows[0]?.exists);
}

async function hasConstraint(client, constraintName) {
  const result = await client.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = $1
      ) AS exists
    `,
    [constraintName]
  );

  return Boolean(result.rows[0]?.exists);
}

async function hasIndex(client, indexName) {
  const result = await client.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = $1
      ) AS exists
    `,
    [indexName]
  );

  return Boolean(result.rows[0]?.exists);
}

async function ensureEnum(client, enumName, values) {
  const result = await client.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = $1
      ) AS exists
    `,
    [enumName]
  );

  if (result.rows[0]?.exists) {
    return;
  }

  const enumValues = values.map((value) => `'${value}'`).join(", ");
  await client.query(`CREATE TYPE "${enumName}" AS ENUM (${enumValues})`);
}

async function getMissingLegacyClinicTables(client) {
  const missingTables = [];

  for (const tableName of legacyClinicTables) {
    if (!(await hasTable(client, tableName))) {
      missingTables.push(tableName);
    }
  }

  return missingTables;
}

async function getMissingLegacyClinicColumns(client) {
  const missingColumns = [];

  for (const [tableName, columnName] of legacyClinicColumns) {
    if (!(await hasColumn(client, tableName, columnName))) {
      missingColumns.push(`${tableName}.${columnName}`);
    }
  }

  return missingColumns;
}

async function ensureClinicCodeUniqueIndexIfNeeded() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    if (!(await hasTable(client, "Clinic")) || await hasIndex(client, "Clinic_code_key")) {
      return;
    }

    console.log("Tabela Clinic encontrada sem índice único em code. Criando Clinic_code_key antes de continuar o deploy.");
    await client.query(`CREATE UNIQUE INDEX "Clinic_code_key" ON "Clinic"("code")`);
  } finally {
    await client.end();
  }
}

async function shouldBaselineExistingDatabase() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    if (await hasMigrationsTable(client)) {
      return false;
    }

    return (await countApplicationTables(client)) > 0;
  } finally {
    await client.end();
  }
}

async function recoverBrokenEmptyDatabaseMigrationStateIfNeeded() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    if (!(await hasMigrationsTable(client))) {
      return;
    }

    if ((await countApplicationTables(client)) > 0) {
      return;
    }

    const result = await client.query(`SELECT COUNT(*)::int AS total FROM "_prisma_migrations"`);
    if ((result.rows[0]?.total ?? 0) === 0) {
      return;
    }

    console.log("Histórico Prisma encontrado sem tabelas da aplicação. Limpando _prisma_migrations para reaplicar migrations do zero.");
    await client.query(`DROP TABLE "_prisma_migrations"`);
  } finally {
    await client.end();
  }
}

async function applyLegacyClinicTransitionIfNeeded() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    if ((await countApplicationTables(client)) === 0) {
      return false;
    }

    const missingClinicTables = await getMissingLegacyClinicTables(client);
    const missingClinicColumns = await getMissingLegacyClinicColumns(client);
    if (missingClinicTables.length === 0 && missingClinicColumns.length === 0) {
      return false;
    }

    const missingTargets = [...missingClinicTables, ...missingClinicColumns];
    console.log(`Banco legado detectado sem estrutura de multiclínica (${missingTargets.join(", ")}). Aplicando transição SQL controlada antes das migrations.`);

    await ensureEnum(client, "ClinicStatus", ["ACTIVE", "INACTIVE"]);
    await ensureEnum(client, "UserClinicStatus", ["ACTIVE", "INACTIVE"]);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "Clinic" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "code" TEXT,
        "document" TEXT,
        "status" "ClinicStatus" NOT NULL DEFAULT 'ACTIVE',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Clinic_pkey" PRIMARY KEY ("id")
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "UserClinic" (
        "userId" TEXT NOT NULL,
        "clinicId" TEXT NOT NULL,
        "status" "UserClinicStatus" NOT NULL DEFAULT 'ACTIVE',
        "isDefault" BOOLEAN NOT NULL DEFAULT false,
        "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "UserClinic_pkey" PRIMARY KEY ("userId", "clinicId")
      )
    `);

    await client.query(`ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "clinicId" TEXT`);
    await client.query(`ALTER TABLE "AnamnesisRecord" ADD COLUMN IF NOT EXISTS "clinicId" TEXT`);
    await client.query(`ALTER TABLE "MedicalEvolution" ADD COLUMN IF NOT EXISTS "clinicId" TEXT`);
    await client.query(`ALTER TABLE "MedicalRecordEntry" ADD COLUMN IF NOT EXISTS "clinicId" TEXT`);
    await client.query(`ALTER TABLE "ClinicalDocument" ADD COLUMN IF NOT EXISTS "clinicId" TEXT`);
    await client.query(`ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "clinicId" TEXT`);

    let defaultClinicId = (await client.query(`SELECT "id" FROM "Clinic" WHERE "code" = 'CLINICA-1' ORDER BY "createdAt" ASC LIMIT 1`)).rows[0]?.id;

    if (!defaultClinicId) {
      const defaultClinicResult = await client.query(`
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
        RETURNING "id"
      `);

      defaultClinicId = defaultClinicResult.rows[0]?.id;
    } else {
      await client.query(`
        UPDATE "Clinic"
        SET
          "name" = 'Clínica 1',
          "document" = '00.000.000/0001-00',
          "status" = 'ACTIVE'::"ClinicStatus",
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = $1
      `, [defaultClinicId]);
    }

    if (!defaultClinicId) {
      throw new Error("Não foi possível obter a clínica padrão durante a transição legada.");
    }

    await client.query(`DELETE FROM "UserClinic"`);
    await client.query(
      `
        INSERT INTO "UserClinic" ("userId", "clinicId", "status", "isDefault", "assignedAt")
        SELECT "id", $1, 'ACTIVE'::"UserClinicStatus", true, CURRENT_TIMESTAMP
        FROM "User"
        ON CONFLICT ("userId", "clinicId") DO NOTHING
      `,
      [defaultClinicId]
    );

    await client.query(`UPDATE "Patient" SET "clinicId" = $1 WHERE "clinicId" IS NULL`, [defaultClinicId]);
    await client.query(`UPDATE "AnamnesisRecord" SET "clinicId" = $1 WHERE "clinicId" IS NULL`, [defaultClinicId]);
    await client.query(`UPDATE "MedicalEvolution" SET "clinicId" = $1 WHERE "clinicId" IS NULL`, [defaultClinicId]);
    await client.query(`UPDATE "MedicalRecordEntry" SET "clinicId" = $1 WHERE "clinicId" IS NULL`, [defaultClinicId]);
    await client.query(`UPDATE "ClinicalDocument" SET "clinicId" = $1 WHERE "clinicId" IS NULL`, [defaultClinicId]);
    await client.query(
      `
        UPDATE "AuditLog"
        SET "clinicId" = $1
        WHERE "clinicId" IS NULL
          AND "entity" IN ('patient', 'anamnesis_record', 'medical_evolution')
      `,
      [defaultClinicId]
    );

    await client.query(`ALTER TABLE "Patient" ALTER COLUMN "clinicId" SET NOT NULL`);
    await client.query(`ALTER TABLE "AnamnesisRecord" ALTER COLUMN "clinicId" SET NOT NULL`);
    await client.query(`ALTER TABLE "MedicalEvolution" ALTER COLUMN "clinicId" SET NOT NULL`);
    await client.query(`ALTER TABLE "MedicalRecordEntry" ALTER COLUMN "clinicId" SET NOT NULL`);
    await client.query(`ALTER TABLE "ClinicalDocument" ALTER COLUMN "clinicId" SET NOT NULL`);

    if (!(await hasIndex(client, "Clinic_code_key"))) await client.query(`CREATE UNIQUE INDEX "Clinic_code_key" ON "Clinic"("code")`);
    if (!(await hasIndex(client, "Clinic_status_name_idx"))) await client.query(`CREATE INDEX "Clinic_status_name_idx" ON "Clinic"("status", "name")`);
    if (!(await hasIndex(client, "UserClinic_clinicId_status_idx"))) await client.query(`CREATE INDEX "UserClinic_clinicId_status_idx" ON "UserClinic"("clinicId", "status")`);
    if (!(await hasIndex(client, "Patient_clinicId_status_idx"))) await client.query(`CREATE INDEX "Patient_clinicId_status_idx" ON "Patient"("clinicId", "status")`);
    if (!(await hasIndex(client, "AnamnesisRecord_clinicId_createdAt_idx"))) await client.query(`CREATE INDEX "AnamnesisRecord_clinicId_createdAt_idx" ON "AnamnesisRecord"("clinicId", "createdAt")`);
    if (!(await hasIndex(client, "MedicalRecordEntry_clinicId_createdAt_idx"))) await client.query(`CREATE INDEX "MedicalRecordEntry_clinicId_createdAt_idx" ON "MedicalRecordEntry"("clinicId", "createdAt")`);
    if (!(await hasIndex(client, "MedicalEvolution_clinicId_evolutionDate_idx"))) await client.query(`CREATE INDEX "MedicalEvolution_clinicId_evolutionDate_idx" ON "MedicalEvolution"("clinicId", "evolutionDate")`);
    if (!(await hasIndex(client, "ClinicalDocument_clinicId_emittedAt_idx"))) await client.query(`CREATE INDEX "ClinicalDocument_clinicId_emittedAt_idx" ON "ClinicalDocument"("clinicId", "emittedAt")`);
    if (!(await hasIndex(client, "AuditLog_clinicId_createdAt_idx"))) await client.query(`CREATE INDEX "AuditLog_clinicId_createdAt_idx" ON "AuditLog"("clinicId", "createdAt")`);

    if (!(await hasConstraint(client, "UserClinic_userId_fkey"))) await client.query(`ALTER TABLE "UserClinic" ADD CONSTRAINT "UserClinic_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    if (!(await hasConstraint(client, "UserClinic_clinicId_fkey"))) await client.query(`ALTER TABLE "UserClinic" ADD CONSTRAINT "UserClinic_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    if (!(await hasConstraint(client, "Patient_clinicId_fkey"))) await client.query(`ALTER TABLE "Patient" ADD CONSTRAINT "Patient_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE`);
    if (!(await hasConstraint(client, "AnamnesisRecord_clinicId_fkey"))) await client.query(`ALTER TABLE "AnamnesisRecord" ADD CONSTRAINT "AnamnesisRecord_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE`);
    if (!(await hasConstraint(client, "MedicalRecordEntry_clinicId_fkey"))) await client.query(`ALTER TABLE "MedicalRecordEntry" ADD CONSTRAINT "MedicalRecordEntry_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE`);
    if (!(await hasConstraint(client, "MedicalEvolution_clinicId_fkey"))) await client.query(`ALTER TABLE "MedicalEvolution" ADD CONSTRAINT "MedicalEvolution_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE`);
    if (!(await hasConstraint(client, "ClinicalDocument_clinicId_fkey"))) await client.query(`ALTER TABLE "ClinicalDocument" ADD CONSTRAINT "ClinicalDocument_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE`);
    if (!(await hasConstraint(client, "AuditLog_clinicId_fkey"))) await client.query(`ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE SET NULL ON UPDATE CASCADE`);

    if (await hasMigrationsTable(client)) {
      await client.query(`DROP TABLE "_prisma_migrations"`);
    }

    await client.query(
      `
        INSERT INTO "AuditLog" ("id", "entity", "entityId", "action", "beforeData", "afterData", "reason", "userId", "clinicId", "createdAt")
        SELECT
          md5(random()::text || clock_timestamp()::text),
          $1,
          $2,
          $3,
          NULL,
          json_build_object('clinic', json_build_object('id', $2, 'code', 'CLINICA-1', 'name', 'Clínica 1'))::text,
          'Bootstrap one-off da clínica padrão executado via transição legada.',
          NULL,
          $2,
          CURRENT_TIMESTAMP
        WHERE NOT EXISTS (
          SELECT 1
          FROM "AuditLog"
          WHERE "entity" = $1
            AND "action" = $3
        )
      `,
      [bootstrapEntity, defaultClinicId, bootstrapAction]
    );

    console.log(`Transição legada de multiclínica concluída. Marcando ${initMigrationName} e ${bootstrapMigrationName} como aplicadas.`);
    return true;
  } finally {
    await client.end();
  }
}

async function getFailedMigrationState(client, migrationName) {
  const result = await client.query(
    `
      SELECT id, migration_name, started_at, finished_at, rolled_back_at, logs
      FROM "_prisma_migrations"
      WHERE migration_name = $1
      ORDER BY started_at DESC
      LIMIT 1
    `,
    [migrationName]
  );

  const migration = result.rows[0];
  if (!migration) return null;
  if (migration.finished_at || migration.rolled_back_at) return null;
  return migration;
}

async function hasBootstrapMarker(client) {
  const result = await client.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM "AuditLog"
        WHERE "entity" = $1
          AND "action" = $2
      ) AS exists
    `,
    [bootstrapEntity, bootstrapAction]
  );

  return Boolean(result.rows[0]?.exists);
}

async function recoverFailedBootstrapMigrationIfNeeded() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    if (!(await hasMigrationsTable(client))) {
      return;
    }

    const failedMigration = await getFailedMigrationState(client, bootstrapMigrationName);
    if (!failedMigration) {
      return;
    }

    if (await hasBootstrapMarker(client)) {
      console.log(`Migration ${bootstrapMigrationName} falhou anteriormente, mas o marcador de bootstrap já existe. Marcando como aplicada.`);
      runPrismaCommand(["migrate", "resolve", "--applied", bootstrapMigrationName]);
      return;
    }

    if (failedMigration.logs) {
      console.log(`Migration ${bootstrapMigrationName} falhou anteriormente. Logs do Prisma:\n${failedMigration.logs}`);
    }

    console.log(`Migration ${bootstrapMigrationName} falhou anteriormente sem concluir o bootstrap. Marcando como rollback para nova tentativa.`);
    runPrismaCommand(["migrate", "resolve", "--rolled-back", bootstrapMigrationName]);
  } finally {
    await client.end();
  }
}

async function hasPatientClinicLinksStructure(client) {
  return (await hasTable(client, "PatientClinic"))
    && (await hasColumn(client, "PatientClinic", "patientId"))
    && (await hasColumn(client, "PatientClinic", "clinicId"))
    && (await hasConstraint(client, "PatientClinic_patientId_fkey"))
    && (await hasConstraint(client, "PatientClinic_clinicId_fkey"))
    && (await hasIndex(client, "PatientClinic_clinicId_status_idx"));
}

async function backfillPatientClinicLinks(client) {
  await client.query(`
    INSERT INTO "PatientClinic" ("patientId", "clinicId", "status", "firstSeenAt", "lastSeenAt")
    SELECT "id", "clinicId", CASE WHEN "status" = 'ACTIVE' THEN 'ACTIVE'::"PatientClinicStatus" ELSE 'INACTIVE'::"PatientClinicStatus" END, "createdAt", "updatedAt"
    FROM "Patient"
    ON CONFLICT ("patientId", "clinicId") DO UPDATE
    SET
      "status" = EXCLUDED."status",
      "firstSeenAt" = LEAST("PatientClinic"."firstSeenAt", EXCLUDED."firstSeenAt"),
      "lastSeenAt" = GREATEST(COALESCE("PatientClinic"."lastSeenAt", EXCLUDED."lastSeenAt"), COALESCE(EXCLUDED."lastSeenAt", "PatientClinic"."lastSeenAt"))
  `);
}

async function recoverFailedPatientClinicLinksMigrationIfNeeded() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const failedMigration = await getFailedMigrationState(client, patientClinicLinksMigrationName);
    if (!failedMigration) return;

    if (!(await hasPatientClinicLinksStructure(client))) {
      throw new Error(`A migration ${patientClinicLinksMigrationName} falhou e a estrutura de vínculos de pacientes está incompleta.`);
    }

    await backfillPatientClinicLinks(client);
    console.log(`Migration ${patientClinicLinksMigrationName} recuperada com backfill dos vínculos de pacientes.`);
    runPrismaCommand(["migrate", "resolve", "--applied", patientClinicLinksMigrationName]);
  } finally {
    await client.end();
  }
}

async function hasPatientClinicStaysStructure(client) {
  return (await hasTable(client, "PatientClinicStay"))
    && (await hasColumn(client, "PatientClinicStay", "patientId"))
    && (await hasColumn(client, "PatientClinicStay", "clinicId"))
    && (await hasColumn(client, "PatientClinicStay", "admissionDate"))
    && (await hasConstraint(client, "PatientClinicStay_patientId_fkey"))
    && (await hasConstraint(client, "PatientClinicStay_clinicId_fkey"))
    && (await hasIndex(client, "PatientClinicStay_patientId_status_admissionDate_idx"))
    && (await hasIndex(client, "PatientClinicStay_clinicId_status_admissionDate_idx"));
}

async function resolvePatientClinicStaysMigrationIfNeeded() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    if (!(await hasMigrationsTable(client)) || await getFailedMigrationState(client, patientClinicStaysMigrationName)) return;

    const migration = await client.query(`SELECT finished_at FROM "_prisma_migrations" WHERE migration_name = $1 LIMIT 1`, [patientClinicStaysMigrationName]);
    if (migration.rows[0]?.finished_at || !(await hasPatientClinicStaysStructure(client))) return;

    await client.query(`
      INSERT INTO "PatientClinicStay" ("id", "patientId", "clinicId", "status", "admissionDate", "dischargeDate", "createdAt", "updatedAt")
      SELECT
        gen_random_uuid()::text,
        pc."patientId",
        pc."clinicId",
        CASE WHEN pc."status" = 'ACTIVE' AND p."status" = 'ACTIVE' AND p."dischargeDate" IS NULL THEN 'ACTIVE'::"PatientClinicStayStatus" ELSE 'DISCHARGED'::"PatientClinicStayStatus" END,
        COALESCE(p."admissionDate", pc."firstSeenAt", p."createdAt"),
        CASE WHEN pc."status" = 'ACTIVE' AND p."status" = 'ACTIVE' AND p."dischargeDate" IS NULL THEN NULL ELSE COALESCE(p."dischargeDate", pc."lastSeenAt", p."updatedAt") END,
        pc."firstSeenAt",
        GREATEST(COALESCE(pc."lastSeenAt", pc."firstSeenAt"), p."updatedAt", pc."firstSeenAt")
      FROM "PatientClinic" pc
      JOIN "Patient" p ON p."id" = pc."patientId"
      WHERE NOT EXISTS (
        SELECT 1 FROM "PatientClinicStay" pcs WHERE pcs."patientId" = pc."patientId" AND pcs."clinicId" = pc."clinicId"
      )
    `);
    console.log(`Migration ${patientClinicStaysMigrationName} recuperada com backfill das permanências de pacientes.`);
    runPrismaCommand(["migrate", "resolve", "--applied", patientClinicStaysMigrationName]);
  } finally {
    await client.end();
  }
}

async function main() {
  await recoverBrokenEmptyDatabaseMigrationStateIfNeeded();
  await ensureClinicCodeUniqueIndexIfNeeded();

  const transitionedLegacyDatabase = await applyLegacyClinicTransitionIfNeeded();
  if (transitionedLegacyDatabase) {
    runPrismaCommand(["migrate", "resolve", "--applied", initMigrationName]);
    runPrismaCommand(["migrate", "resolve", "--applied", bootstrapMigrationName]);
  }

  if (!transitionedLegacyDatabase && await shouldBaselineExistingDatabase()) {
    console.log(`Banco existente sem histórico Prisma detectado. Marcando ${initMigrationName} como aplicado.`);
    runPrismaCommand(["migrate", "resolve", "--applied", initMigrationName]);
  }

  if (!transitionedLegacyDatabase) {
    await recoverFailedBootstrapMigrationIfNeeded();
    await recoverFailedPatientClinicLinksMigrationIfNeeded();
    await resolvePatientClinicStaysMigrationIfNeeded();
  }

  runPrismaCommand(["migrate", "deploy"]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
