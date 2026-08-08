import { spawnSync } from "node:child_process";
import { Client } from "pg";

const databaseUrl = process.env.DATABASE_URL ?? "postgresql://clinica:clinica_dev@localhost:5432/clinica";
const initMigrationName = "20260808223000_init";
const bootstrapMigrationName = "20260808224500_bootstrap_default_clinic_once";
const bootstrapEntity = "system_bootstrap";
const bootstrapAction = "bootstrap_default_clinic_once";
const legacyClinicTables = ["Clinic", "UserClinic", "AccessGroupClinic"];

async function hasMigrationsTable(client) {
  const migrationsTableResult = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = '_prisma_migrations'
    ) AS exists
  `);

  return Boolean(migrationsTableResult.rows[0]?.exists);
}

async function countApplicationTables(client) {
  const applicationTablesResult = await client.query(`
    SELECT COUNT(*)::int AS total
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('User', 'Clinic', 'AuditLog', 'Patient', 'AccessGroup')
  `);

  return applicationTablesResult.rows[0]?.total ?? 0;
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

async function getMissingLegacyClinicTables(client) {
  const missingTables = [];

  for (const tableName of legacyClinicTables) {
    if (!(await hasTable(client, tableName))) {
      missingTables.push(tableName);
    }
  }

  return missingTables;
}

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
    const migrationsTableExists = await hasMigrationsTable(client);
    if (!migrationsTableExists) {
      return;
    }

    const applicationTablesCount = await countApplicationTables(client);
    if (applicationTablesCount > 0) {
      return;
    }

    const migrationCountResult = await client.query(`SELECT COUNT(*)::int AS total FROM "_prisma_migrations"`);
    const migrationCount = migrationCountResult.rows[0]?.total ?? 0;
    if (migrationCount === 0) {
      return;
    }

    console.log("Histórico Prisma encontrado sem tabelas da aplicação. Limpando _prisma_migrations para reaplicar migrations do zero.");
    await client.query(`DROP TABLE "_prisma_migrations"`);
  } finally {
    await client.end();
  }
}

async function syncLegacySchemaIfNeeded() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const applicationTablesCount = await countApplicationTables(client);
    if (applicationTablesCount === 0) {
      return;
    }

    const missingClinicTables = await getMissingLegacyClinicTables(client);
    if (missingClinicTables.length === 0) {
      return;
    }

    console.log(`Banco legado detectado sem tabelas de multiclínica (${missingClinicTables.join(", ")}). Sincronizando schema atual com prisma db push antes das migrations.`);
    runPrismaCommand(["db", "push"]);

    if (!(await hasMigrationsTable(client))) {
      console.log(`Schema legado sincronizado. Marcando ${initMigrationName} como aplicado para iniciar o fluxo versionado.`);
      runPrismaCommand(["migrate", "resolve", "--applied", initMigrationName]);
    }
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
    const migrationsTableResult = await client.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = '_prisma_migrations'
      ) AS exists
    `);

    if (!migrationsTableResult.rows[0]?.exists) {
      return;
    }

    const failedMigration = await getFailedMigrationState(client, bootstrapMigrationName);
    if (!failedMigration) {
      return;
    }

    const bootstrapApplied = await hasBootstrapMarker(client);

    if (bootstrapApplied) {
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

async function main() {
  await recoverBrokenEmptyDatabaseMigrationStateIfNeeded();
  await syncLegacySchemaIfNeeded();

  if (await shouldBaselineExistingDatabase()) {
    console.log(`Banco existente sem histórico Prisma detectado. Marcando ${initMigrationName} como aplicado.`);
    runPrismaCommand(["migrate", "resolve", "--applied", initMigrationName]);
  }

  await recoverFailedBootstrapMigrationIfNeeded();
  runPrismaCommand(["migrate", "deploy"]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});