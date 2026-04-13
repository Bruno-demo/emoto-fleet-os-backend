-- Ensures only one active bike assignment exists per bike at any given time.
-- Uses a partial unique index since Prisma does not support filtered unique constraints.
CREATE UNIQUE INDEX IF NOT EXISTS "BikeAssignment_bikeId_active_unique"
  ON "BikeAssignment" ("bikeId")
  WHERE "active" = true;
