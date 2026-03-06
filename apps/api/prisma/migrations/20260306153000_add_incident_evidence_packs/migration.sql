-- CreateTable
CREATE TABLE "EvidencePack" (
    "id" UUID NOT NULL,
    "incidentId" UUID NOT NULL,
    "s3KeyJson" TEXT NOT NULL,
    "s3KeyCsv" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidencePack_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EvidencePack_incidentId_key" ON "EvidencePack"("incidentId");

-- CreateIndex
CREATE INDEX "EvidencePack_createdAt_idx" ON "EvidencePack"("createdAt");

-- AddForeignKey
ALTER TABLE "EvidencePack" ADD CONSTRAINT "EvidencePack_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

