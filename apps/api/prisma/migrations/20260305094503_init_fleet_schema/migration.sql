-- CreateEnum
CREATE TYPE "FleetType" AS ENUM ('COOP', 'DELIVERY');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN', 'DISPATCHER', 'TECH', 'INSURER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'DISABLED');

-- CreateEnum
CREATE TYPE "BikeStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'RETIRED');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "EventSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ScoreScope" AS ENUM ('RIDER', 'BIKE', 'FLEET');

-- CreateTable
CREATE TABLE "Fleet" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FleetType" NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fleet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "fleetId" UUID NOT NULL,
    "role" "UserRole" NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bike" (
    "id" UUID NOT NULL,
    "fleetId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "plate" TEXT,
    "serial" TEXT,
    "model" TEXT,
    "status" "BikeStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Bike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" UUID NOT NULL,
    "imei" TEXT,
    "deviceUid" TEXT NOT NULL,
    "bikeId" UUID,
    "secretHash" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMPTZ(6),
    "fwVersion" TEXT,
    "status" "DeviceStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelemetryPoint" (
    "id" BIGSERIAL NOT NULL,
    "deviceId" UUID NOT NULL,
    "ts" TIMESTAMPTZ(6) NOT NULL,
    "lat" DECIMAL(9,6) NOT NULL,
    "lng" DECIMAL(9,6) NOT NULL,
    "speedKph" DECIMAL(6,2) NOT NULL,
    "heading" DECIMAL(6,2),
    "accelX" DECIMAL(8,4),
    "accelY" DECIMAL(8,4),
    "accelZ" DECIMAL(8,4),
    "batteryV" DECIMAL(8,3),
    "ignition" BOOLEAN,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelemetryPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" BIGSERIAL NOT NULL,
    "fleetId" UUID NOT NULL,
    "bikeId" UUID,
    "deviceId" UUID NOT NULL,
    "ts" TIMESTAMPTZ(6) NOT NULL,
    "type" TEXT NOT NULL,
    "severity" "EventSeverity" NOT NULL,
    "metaJson" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" UUID NOT NULL,
    "fleetId" UUID NOT NULL,
    "bikeId" UUID NOT NULL,
    "riderId" UUID,
    "startTs" TIMESTAMPTZ(6) NOT NULL,
    "endTs" TIMESTAMPTZ(6),
    "distanceKm" DECIMAL(10,3) NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "score" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreSummary" (
    "id" UUID NOT NULL,
    "fleetId" UUID NOT NULL,
    "scope" "ScoreScope" NOT NULL,
    "refId" UUID,
    "periodStart" TIMESTAMPTZ(6) NOT NULL,
    "periodEnd" TIMESTAMPTZ(6) NOT NULL,
    "score" DECIMAL(5,2) NOT NULL,
    "breakdownJson" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "User_fleetId_idx" ON "User"("fleetId");

-- CreateIndex
CREATE INDEX "User_fleetId_role_idx" ON "User"("fleetId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "User_fleetId_email_key" ON "User"("fleetId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "User_fleetId_phone_key" ON "User"("fleetId", "phone");

-- CreateIndex
CREATE INDEX "Bike_fleetId_idx" ON "Bike"("fleetId");

-- CreateIndex
CREATE INDEX "Bike_fleetId_status_idx" ON "Bike"("fleetId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Bike_fleetId_label_key" ON "Bike"("fleetId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "Bike_fleetId_plate_key" ON "Bike"("fleetId", "plate");

-- CreateIndex
CREATE UNIQUE INDEX "Bike_serial_key" ON "Bike"("serial");

-- CreateIndex
CREATE UNIQUE INDEX "Device_deviceUid_key" ON "Device"("deviceUid");

-- CreateIndex
CREATE INDEX "Device_bikeId_idx" ON "Device"("bikeId");

-- CreateIndex
CREATE UNIQUE INDEX "Device_imei_key" ON "Device"("imei");

-- CreateIndex
CREATE INDEX "TelemetryPoint_deviceId_idx" ON "TelemetryPoint"("deviceId");

-- CreateIndex
CREATE INDEX "TelemetryPoint_ts_idx" ON "TelemetryPoint"("ts");

-- CreateIndex
CREATE INDEX "TelemetryPoint_deviceId_ts_idx" ON "TelemetryPoint"("deviceId", "ts");

-- CreateIndex
CREATE INDEX "Event_fleetId_idx" ON "Event"("fleetId");

-- CreateIndex
CREATE INDEX "Event_deviceId_idx" ON "Event"("deviceId");

-- CreateIndex
CREATE INDEX "Event_ts_idx" ON "Event"("ts");

-- CreateIndex
CREATE INDEX "Event_fleetId_ts_idx" ON "Event"("fleetId", "ts");

-- CreateIndex
CREATE INDEX "Event_deviceId_ts_idx" ON "Event"("deviceId", "ts");

-- CreateIndex
CREATE INDEX "Trip_fleetId_idx" ON "Trip"("fleetId");

-- CreateIndex
CREATE INDEX "Trip_bikeId_idx" ON "Trip"("bikeId");

-- CreateIndex
CREATE INDEX "Trip_startTs_idx" ON "Trip"("startTs");

-- CreateIndex
CREATE INDEX "Trip_fleetId_startTs_idx" ON "Trip"("fleetId", "startTs");

-- CreateIndex
CREATE INDEX "Trip_bikeId_startTs_idx" ON "Trip"("bikeId", "startTs");

-- CreateIndex
CREATE INDEX "ScoreSummary_fleetId_idx" ON "ScoreSummary"("fleetId");

-- CreateIndex
CREATE INDEX "ScoreSummary_scope_refId_idx" ON "ScoreSummary"("scope", "refId");

-- CreateIndex
CREATE INDEX "ScoreSummary_periodStart_periodEnd_idx" ON "ScoreSummary"("periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "ScoreSummary_fleetId_scope_periodStart_periodEnd_idx" ON "ScoreSummary"("fleetId", "scope", "periodStart", "periodEnd");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_fleetId_fkey" FOREIGN KEY ("fleetId") REFERENCES "Fleet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bike" ADD CONSTRAINT "Bike_fleetId_fkey" FOREIGN KEY ("fleetId") REFERENCES "Fleet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_bikeId_fkey" FOREIGN KEY ("bikeId") REFERENCES "Bike"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelemetryPoint" ADD CONSTRAINT "TelemetryPoint_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_fleetId_fkey" FOREIGN KEY ("fleetId") REFERENCES "Fleet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_bikeId_fkey" FOREIGN KEY ("bikeId") REFERENCES "Bike"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_fleetId_fkey" FOREIGN KEY ("fleetId") REFERENCES "Fleet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_bikeId_fkey" FOREIGN KEY ("bikeId") REFERENCES "Bike"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreSummary" ADD CONSTRAINT "ScoreSummary_fleetId_fkey" FOREIGN KEY ("fleetId") REFERENCES "Fleet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
