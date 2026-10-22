CREATE TABLE "InventoryEntry" (
  "id" TEXT NOT NULL,
  "clinicId" TEXT NOT NULL,
  "productName" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPrice" DECIMAL(12,2) NOT NULL,
  "entryDate" TIMESTAMP(3) NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InventoryEntry_clinicId_entryDate_idx" ON "InventoryEntry"("clinicId", "entryDate");
CREATE INDEX "InventoryEntry_clinicId_productName_idx" ON "InventoryEntry"("clinicId", "productName");

ALTER TABLE "InventoryEntry"
  ADD CONSTRAINT "InventoryEntry_clinicId_fkey"
  FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;