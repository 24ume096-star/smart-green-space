-- CreateEnum
CREATE TYPE "DrainNodeType" AS ENUM ('DRAIN_CHANNEL', 'POND', 'CULVERT', 'LOW_LYING');

-- CreateEnum
CREATE TYPE "FloodSeverity" AS ENUM ('WATCH', 'WARNING', 'EMERGENCY');

-- AlterTable
ALTER TABLE "CitizenReport" ALTER COLUMN "actionedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Notification" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "readAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PushSubscription" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "UserBadge" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- CreateTable
CREATE TABLE "DrainNode" (
    "id" TEXT NOT NULL,
    "parkId" TEXT NOT NULL,
    "zoneId" TEXT,
    "nodeCode" TEXT NOT NULL,
    "type" "DrainNodeType" NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "currentWaterLevelCm" DOUBLE PRECISION,
    "maxCapacityCm" DOUBLE PRECISION NOT NULL,
    "flowRateLPerMin" DOUBLE PRECISION,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "status" "SensorNodeStatus" NOT NULL DEFAULT 'ONLINE',
    "lastReadingAt" TIMESTAMP(3),

    CONSTRAINT "DrainNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrainReading" (
    "id" TEXT NOT NULL,
    "drainNodeId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "waterLevelCm" DOUBLE PRECISION NOT NULL,
    "flowRateLPerMin" DOUBLE PRECISION,
    "rainfallMmHr" DOUBLE PRECISION,
    "pressurePascal" DOUBLE PRECISION,
    "isAnomalous" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DrainReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FloodEvent" (
    "id" TEXT NOT NULL,
    "parkId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "severity" "FloodSeverity" NOT NULL,
    "peakWaterLevelCm" DOUBLE PRECISION,
    "estimatedVolumeLiters" DOUBLE PRECISION,
    "affectedZones" JSONB,
    "responseActions" JSONB,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "FloodEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrainageValve" (
    "id" TEXT NOT NULL,
    "parkId" TEXT NOT NULL,
    "zoneId" TEXT,
    "valveCode" TEXT NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT false,
    "isAutoMode" BOOLEAN NOT NULL DEFAULT true,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "lastActuatedAt" TIMESTAMP(3),
    "actuatedBy" TEXT,

    CONSTRAINT "DrainageValve_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DrainNode_nodeCode_key" ON "DrainNode"("nodeCode");

-- CreateIndex
CREATE INDEX "DrainNode_parkId_idx" ON "DrainNode"("parkId");

-- CreateIndex
CREATE INDEX "DrainNode_zoneId_idx" ON "DrainNode"("zoneId");

-- CreateIndex
CREATE INDEX "DrainNode_isBlocked_idx" ON "DrainNode"("isBlocked");

-- CreateIndex
CREATE INDEX "DrainReading_drainNodeId_idx" ON "DrainReading"("drainNodeId");

-- CreateIndex
CREATE INDEX "DrainReading_timestamp_idx" ON "DrainReading"("timestamp");

-- CreateIndex
CREATE INDEX "DrainReading_drainNodeId_timestamp_idx" ON "DrainReading"("drainNodeId", "timestamp");

-- CreateIndex
CREATE INDEX "FloodEvent_parkId_idx" ON "FloodEvent"("parkId");

-- CreateIndex
CREATE INDEX "FloodEvent_severity_idx" ON "FloodEvent"("severity");

-- CreateIndex
CREATE INDEX "FloodEvent_isResolved_idx" ON "FloodEvent"("isResolved");

-- CreateIndex
CREATE UNIQUE INDEX "DrainageValve_valveCode_key" ON "DrainageValve"("valveCode");

-- CreateIndex
CREATE INDEX "DrainageValve_parkId_idx" ON "DrainageValve"("parkId");

-- CreateIndex
CREATE INDEX "DrainageValve_zoneId_idx" ON "DrainageValve"("zoneId");

-- AddForeignKey
ALTER TABLE "DrainNode" ADD CONSTRAINT "DrainNode_parkId_fkey" FOREIGN KEY ("parkId") REFERENCES "Park"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrainNode" ADD CONSTRAINT "DrainNode_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "IrrigationZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrainReading" ADD CONSTRAINT "DrainReading_drainNodeId_fkey" FOREIGN KEY ("drainNodeId") REFERENCES "DrainNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FloodEvent" ADD CONSTRAINT "FloodEvent_parkId_fkey" FOREIGN KEY ("parkId") REFERENCES "Park"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrainageValve" ADD CONSTRAINT "DrainageValve_parkId_fkey" FOREIGN KEY ("parkId") REFERENCES "Park"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrainageValve" ADD CONSTRAINT "DrainageValve_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "IrrigationZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrainageValve" ADD CONSTRAINT "DrainageValve_actuatedBy_fkey" FOREIGN KEY ("actuatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
