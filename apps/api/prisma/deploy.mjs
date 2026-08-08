import { spawnSync } from "node:child_process";
import { PrismaPg } from "@prisma/adapter-pg";
import { Client } from "pg";

const databaseUrl = process.env.DATABASE_URL ?? "postgresql://clinica:clinica_dev@localhost:5432/clinica";
const initMigrationName = "20260808223000_init";

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
    const migrationsTableResult = await client.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = '_prisma_migrations'
      ) AS exists
    `);

    if (migrationsTableResult.rows[0]?.exists) {
      return false;
    }

    const applicationTablesResult = await client.query(`
      SELECT COUNT(*)::int AS total
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('User', 'Clinic', 'AuditLog', 'Patient', 'AccessGroup')
    `);

    return (applicationTablesResult.rows[0]?.total ?? 0) > 0;
  } finally {
    await client.end();
  }
}

async function main() {
  if (await shouldBaselineExistingDatabase()) {
    console.log(`Banco existente sem histórico Prisma detectado. Marcando ${initMigrationName} como aplicado.`);
    runPrismaCommand(["migrate", "resolve", "--applied", initMigrationName]);
  }

  runPrismaCommand(["migrate", "deploy"]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});