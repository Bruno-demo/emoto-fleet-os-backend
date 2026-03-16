-- CreateEnum
CREATE TYPE "RoadFeatureType" AS ENUM ('SCHOOL', 'HOSPITAL', 'MARKET', 'TRAFFIC_SIGN', 'SPEED_LIMIT');

-- CreateEnum
CREATE TYPE "RoadFeatureSource" AS ENUM ('OSM');

-- CreateEnum
CREATE TYPE "RoadFeatureOsmType" AS ENUM ('NODE', 'WAY', 'RELATION');

-- AlterEnum
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'SPEED_LIMIT_VIOLATION';
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'SCHOOL_ZONE_SPEED';
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'HOSPITAL_ZONE_SPEED';
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'MARKET_ZONE_SPEED';

-- CreateTable
CREATE TABLE "RoadFeature" (
    "id" UUID NOT NULL ,
    "source" "RoadFeatureSource" NOT NULL DEFAULT 'OSM',
    "osmId" TEXT NOT NULL,
    "osmType" "RoadFeatureOsmType" NOT NULL,
    "type" "RoadFeatureType" NOT NULL,
    "name" TEXT,
    "speedLimitKph" INTEGER,
    "lat" DECIMAL(9,6) NOT NULL,
    "lng" DECIMAL(9,6) NOT NULL,
    "tagsJson" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoadFeature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoadFeature_source_osmId_osmType_key" ON "RoadFeature"("source", "osmId", "osmType");

-- CreateIndex
CREATE INDEX "RoadFeature_type_idx" ON "RoadFeature"("type");

-- CreateIndex
CREATE INDEX "RoadFeature_lat_lng_idx" ON "RoadFeature"("lat", "lng");

