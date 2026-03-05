-- Adds geofence zone support for fleet safety and theft rules.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ZoneType') THEN
    CREATE TYPE "ZoneType" AS ENUM ('SLOW', 'NO_GO', 'PARK');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "GeofenceZone" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "fleetId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "type" "ZoneType" NOT NULL,
  "geojsonPolygon" JSONB NOT NULL,
  "speedLimitKph" DECIMAL(6,2),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GeofenceZone_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GeofenceZone_fleetId_fkey" FOREIGN KEY ("fleetId") REFERENCES "Fleet"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "GeofenceZone_fleetId_idx" ON "GeofenceZone"("fleetId");
CREATE INDEX IF NOT EXISTS "GeofenceZone_fleetId_active_type_idx" ON "GeofenceZone"("fleetId", "active", "type");
