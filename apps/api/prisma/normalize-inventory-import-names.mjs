import { PrismaPg } from "@prisma/adapter-pg";
import prismaClientPackage from "@prisma/client";

const { PrismaClient } = prismaClientPackage;
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "postgresql://clinica:clinica_dev@localhost:5432/clinica" });
const prisma = new PrismaClient({ adapter });
const normalizationAction = "normalize_inventory_import_names_once";

async function main() {
  const updatedCount = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(7410211022) IS NULL AS locked`;
    const existingNormalization = await tx.auditLog.findFirst({
      where: { entity: "inventory_import", action: normalizationAction },
      select: { id: true }
    });
    if (existingNormalization) throw new Error("Os nomes desta carga já foram normalizados.");

    const importedEntries = await tx.auditLog.findMany({
      where: { entity: "inventory_entry", action: "import_inventory_entry" },
      select: { entityId: true, afterData: true, userId: true, clinicId: true }
    });
    const updatedEntries = [];

    for (const importLog of importedEntries) {
      if (!importLog.entityId || !importLog.afterData) continue;
      const importSnapshot = JSON.parse(importLog.afterData);
      const sourceItem = importSnapshot.sourceItem;
      const entry = await tx.inventoryEntry.findUnique({ where: { id: importLog.entityId } });
      if (!entry) continue;
      const productName = entry.productName.replace(/^\d+\.\d+[a-z]?\s+-\s+/i, "");
      if (productName === entry.productName) continue;

      const updatedEntry = await tx.inventoryEntry.update({ where: { id: entry.id }, data: { productName } });
      await tx.auditLog.create({
        data: {
          entity: "inventory_entry",
          entityId: updatedEntry.id,
          action: "normalize_imported_inventory_product_name",
          beforeData: JSON.stringify({ ...entry, unitPrice: entry.unitPrice.toString() }),
          afterData: JSON.stringify({ ...updatedEntry, unitPrice: updatedEntry.unitPrice.toString(), sourceItem }),
          reason: `Código de origem removido do nome do produto importado: ${sourceItem}`,
          userId: importLog.userId,
          clinicId: importLog.clinicId
        }
      });
      updatedEntries.push(updatedEntry.id);
    }

    await tx.auditLog.create({
      data: {
        entity: "inventory_import",
        action: normalizationAction,
        afterData: JSON.stringify({ updatedCount: updatedEntries.length, entryIds: updatedEntries }),
        reason: `Prefixos de item removidos de ${updatedEntries.length} produtos importados`
      }
    });
    return updatedEntries.length;
  });

  console.log(`Nomes corrigidos: ${updatedCount} produtos.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());