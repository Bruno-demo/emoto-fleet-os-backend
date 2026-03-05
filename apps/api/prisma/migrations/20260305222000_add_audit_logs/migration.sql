-- Adds audit logs for privileged fleet actions.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AuditActionType') THEN
    CREATE TYPE "AuditActionType" AS ENUM (
      'DEVICE_SECRET_ROTATED',
      'ZONE_CREATED',
      'ZONE_UPDATED',
      'ZONE_DELETED',
      'LOCK_ACTION_REQUESTED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" BIGSERIAL NOT NULL,
  "fleetId" UUID NOT NULL,
  "actorUserId" UUID,
  "actionType" "AuditActionType" NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT,
  "metaJson" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AuditLog_fleetId_fkey" FOREIGN KEY ("fleetId") REFERENCES "Fleet"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "AuditLog_fleetId_createdAt_idx" ON "AuditLog"("fleetId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");
CREATE INDEX IF NOT EXISTS "AuditLog_actionType_idx" ON "AuditLog"("actionType");
