CREATE TYPE "PatientFileType" AS ENUM ('CONTRACT', 'MP', 'MEDICAL_PRESCRIPTION');

CREATE TABLE "PatientFile" (
  "id" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "type" "PatientFileType" NOT NULL,
  "storageKey" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PatientFile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PatientFile_storageKey_key" ON "PatientFile"("storageKey");
CREATE UNIQUE INDEX "PatientFile_patientId_type_key" ON "PatientFile"("patientId", "type");
CREATE INDEX "PatientFile_patientId_idx" ON "PatientFile"("patientId");

ALTER TABLE "PatientFile"
  ADD CONSTRAINT "PatientFile_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;