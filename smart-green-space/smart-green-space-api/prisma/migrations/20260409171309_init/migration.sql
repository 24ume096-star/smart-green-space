-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'CITY_OFFICER', 'RESEARCHER', 'CITIZEN');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('BASIC', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'TRIAL', 'PAST_DUE', 'CANCELED');

-- CreateEnum
CREATE TYPE "ParkType" AS ENUM ('URBAN_PARK', 'FOREST', 'GARDEN', 'WETLAND');

-- CreateEnum
CREATE TYPE "SensorNodeStatus" AS ENUM ('ONLINE', 'OFFLINE', 'ALERT', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "SatelliteSource" AS ENUM ('SENTINEL2', 'LANDSAT');

-- CreateEnum
CREATE TYPE "TreeScanType" AS ENUM ('DRONE', 'MOBILE', 'CAMERA_TRAP');

-- CreateEnum
CREATE TYPE "TreeHealthStatus" AS ENUM ('HEALTHY', 'AT_RISK', 'CRITICAL', 'DEAD');

-- CreateEnum
CREATE TYPE "SpeciesType" AS ENUM ('BIRD', 'MAMMAL', 'INSECT', 'REPTILE', 'AMPHIBIAN');

-- CreateEnum
CREATE TYPE "DetectionMethod" AS ENUM ('ACOUSTIC', 'CAMERA_TRAP', 'CITIZEN', 'DRONE');

-- CreateEnum
CREATE TYPE "IrrigationTriggerType" AS ENUM ('AUTO', 'MANUAL', 'SCHEDULED', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('CRITICAL', 'WARNING', 'INFO');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('HEAT_STRESS', 'FLOOD_RISK', 'DISEASE', 'PEST', 'SENSOR_OFFLINE', 'LOW_BIODIVERSITY', 'IRRIGATION_FAILURE', 'FIRE_RISK');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'ASSIGNED', 'RESOLVED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('IRRIGATION_TRIGGERED', 'MAINTENANCE_ASSIGNED', 'ALERT_ESCALATED', 'SCAN_INITIATED', 'REPORT_GENERATED');

-- CreateEnum
CREATE TYPE "CitizenReportType" AS ENUM ('TREE_DAMAGE', 'LITTER', 'WILDLIFE', 'FLOODING', 'VANDALISM', 'OTHER');

-- CreateEnum
CREATE TYPE "CitizenReportStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'ACTIONED');

-- CreateEnum
CREATE TYPE "DigitalTwinScenario" AS ENUM ('FLOOD', 'HEAT_WAVE', 'TREE_GROWTH', 'DROUGHT');

-- CreateEnum
CREATE TYPE "DigitalTwinStatus" AS ENUM ('RUNNING', 'COMPLETE', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'CITIZEN',
    "cityId" TEXT,
    "name" TEXT,
    "phone" TEXT,
    "avatarUrl" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "refreshToken" TEXT,
    "passwordResetTokenHash" TEXT,
    "passwordResetExpiresAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "City" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "timezone" TEXT NOT NULL,
    "subscriptionPlan" "SubscriptionPlan" NOT NULL,
    "subscriptionStatus" "SubscriptionStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Park" (
    "id" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "area" DOUBLE PRECISION NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "geoJsonBoundary" JSONB,
    "establishedYear" INTEGER,
    "type" "ParkType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Park_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SensorNode" (
    "id" TEXT NOT NULL,
    "parkId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "nodeCode" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "model" TEXT,
    "firmwareVersion" TEXT,
    "status" "SensorNodeStatus" NOT NULL DEFAULT 'OFFLINE',
    "lastPingAt" TIMESTAMP(3),
    "batteryLevel" DOUBLE PRECISION,
    "signalStrength" INTEGER,
    "edgeAiEnabled" BOOLEAN NOT NULL DEFAULT false,
    "installationDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SensorNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SensorReading" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "soilMoisture" DOUBLE PRECISION,
    "temperature" DOUBLE PRECISION,
    "humidity" DOUBLE PRECISION,
    "airQualityPM25" DOUBLE PRECISION,
    "airQualityPM10" DOUBLE PRECISION,
    "co2Level" DOUBLE PRECISION,
    "lightIntensity" DOUBLE PRECISION,
    "windSpeed" DOUBLE PRECISION,
    "isAnomaly" BOOLEAN NOT NULL DEFAULT false,
    "anomalyScore" DOUBLE PRECISION,
    "anomalyType" TEXT,

    CONSTRAINT "SensorReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GshiScore" (
    "id" TEXT NOT NULL,
    "parkId" TEXT NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "vegetationScore" DOUBLE PRECISION,
    "thermalScore" DOUBLE PRECISION,
    "waterScore" DOUBLE PRECISION,
    "biodiversityScore" DOUBLE PRECISION,
    "infrastructureScore" DOUBLE PRECISION,
    "treeHealthScore" DOUBLE PRECISION,
    "ndviValue" DOUBLE PRECISION,
    "dataSourcesUsed" JSONB,

    CONSTRAINT "GshiScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SatelliteImage" (
    "id" TEXT NOT NULL,
    "parkId" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "source" "SatelliteSource" NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "ndviMapUrl" TEXT,
    "thermalMapUrl" TEXT,
    "cloudCoverage" DOUBLE PRECISION,
    "ndviMean" DOUBLE PRECISION,
    "ndviMin" DOUBLE PRECISION,
    "ndviMax" DOUBLE PRECISION,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "SatelliteImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreeScan" (
    "id" TEXT NOT NULL,
    "parkId" TEXT NOT NULL,
    "treeId" TEXT,
    "scanType" "TreeScanType" NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL,
    "scannedBy" TEXT,
    "aiHealthScore" DOUBLE PRECISION,
    "diseasesDetected" JSONB,
    "recommendedAction" TEXT,
    "confidence" DOUBLE PRECISION,
    "modelVersion" TEXT,

    CONSTRAINT "TreeScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tree" (
    "id" TEXT NOT NULL,
    "parkId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "species" TEXT NOT NULL,
    "estimatedAge" INTEGER,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "canopyDiameterM" DOUBLE PRECISION,
    "heightM" DOUBLE PRECISION,
    "healthStatus" "TreeHealthStatus" NOT NULL DEFAULT 'HEALTHY',
    "lastScannedAt" TIMESTAMP(3),
    "plantedAt" TIMESTAMP(3),

    CONSTRAINT "Tree_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BiodiversityLog" (
    "id" TEXT NOT NULL,
    "parkId" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "speciesName" TEXT NOT NULL,
    "speciesType" "SpeciesType" NOT NULL,
    "detectionMethod" "DetectionMethod" NOT NULL,
    "confidence" DOUBLE PRECISION,
    "count" INTEGER,
    "imageUrl" TEXT,
    "audioUrl" TEXT,
    "isEndangered" BOOLEAN NOT NULL DEFAULT false,
    "conservationStatus" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,

    CONSTRAINT "BiodiversityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IrrigationZone" (
    "id" TEXT NOT NULL,
    "parkId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "zoneCode" TEXT NOT NULL,
    "areaM2" DOUBLE PRECISION NOT NULL,
    "isAutoMode" BOOLEAN NOT NULL DEFAULT true,
    "targetMoisture" DOUBLE PRECISION,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "geoJsonBoundary" JSONB,

    CONSTRAINT "IrrigationZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IrrigationEvent" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "waterUsedLiters" DOUBLE PRECISION,
    "triggerType" "IrrigationTriggerType" NOT NULL,
    "soilMoistureAtStart" DOUBLE PRECISION,
    "soilMoistureAtEnd" DOUBLE PRECISION,
    "triggeredBy" TEXT,
    "weatherForecastData" JSONB,

    CONSTRAINT "IrrigationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "parkId" TEXT NOT NULL,
    "nodeId" TEXT,
    "severity" "AlertSeverity" NOT NULL,
    "type" "AlertType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "aiConfidence" DOUBLE PRECISION,
    "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "assignedTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionLog" (
    "id" TEXT NOT NULL,
    "alertId" TEXT,
    "parkId" TEXT NOT NULL,
    "actionType" "ActionType" NOT NULL,
    "description" TEXT NOT NULL,
    "performedBy" TEXT,
    "isAutomated" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CitizenReport" (
    "id" TEXT NOT NULL,
    "parkId" TEXT NOT NULL,
    "submittedBy" TEXT,
    "type" "CitizenReportType" NOT NULL,
    "description" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "photoUrl" TEXT,
    "status" "CitizenReportStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CitizenReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DigitalTwinSimulation" (
    "id" TEXT NOT NULL,
    "parkId" TEXT NOT NULL,
    "runBy" TEXT NOT NULL,
    "scenario" "DigitalTwinScenario" NOT NULL,
    "parameters" JSONB NOT NULL,
    "result" JSONB,
    "predictedGshi" DOUBLE PRECISION,
    "confidenceScore" DOUBLE PRECISION,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "DigitalTwinStatus" NOT NULL,

    CONSTRAINT "DigitalTwinSimulation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "City_name_idx" ON "City"("name");

-- CreateIndex
CREATE INDEX "City_createdAt_idx" ON "City"("createdAt");

-- CreateIndex
CREATE INDEX "Park_cityId_idx" ON "Park"("cityId");

-- CreateIndex
CREATE INDEX "Park_createdAt_idx" ON "Park"("createdAt");

-- CreateIndex
CREATE INDEX "Park_updatedAt_idx" ON "Park"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SensorNode_nodeCode_key" ON "SensorNode"("nodeCode");

-- CreateIndex
CREATE INDEX "SensorNode_parkId_idx" ON "SensorNode"("parkId");

-- CreateIndex
CREATE INDEX "SensorNode_zoneId_idx" ON "SensorNode"("zoneId");

-- CreateIndex
CREATE INDEX "SensorNode_status_idx" ON "SensorNode"("status");

-- CreateIndex
CREATE INDEX "SensorNode_isActive_idx" ON "SensorNode"("isActive");

-- CreateIndex
CREATE INDEX "SensorNode_lastPingAt_idx" ON "SensorNode"("lastPingAt");

-- CreateIndex
CREATE INDEX "SensorReading_nodeId_idx" ON "SensorReading"("nodeId");

-- CreateIndex
CREATE INDEX "SensorReading_timestamp_idx" ON "SensorReading"("timestamp");

-- CreateIndex
CREATE INDEX "SensorReading_nodeId_timestamp_idx" ON "SensorReading"("nodeId", "timestamp");

-- CreateIndex
CREATE INDEX "SensorReading_isAnomaly_idx" ON "SensorReading"("isAnomaly");

-- CreateIndex
CREATE INDEX "GshiScore_parkId_idx" ON "GshiScore"("parkId");

-- CreateIndex
CREATE INDEX "GshiScore_calculatedAt_idx" ON "GshiScore"("calculatedAt");

-- CreateIndex
CREATE INDEX "SatelliteImage_parkId_idx" ON "SatelliteImage"("parkId");

-- CreateIndex
CREATE INDEX "SatelliteImage_capturedAt_idx" ON "SatelliteImage"("capturedAt");

-- CreateIndex
CREATE INDEX "SatelliteImage_source_idx" ON "SatelliteImage"("source");

-- CreateIndex
CREATE INDEX "TreeScan_parkId_idx" ON "TreeScan"("parkId");

-- CreateIndex
CREATE INDEX "TreeScan_treeId_idx" ON "TreeScan"("treeId");

-- CreateIndex
CREATE INDEX "TreeScan_scannedBy_idx" ON "TreeScan"("scannedBy");

-- CreateIndex
CREATE INDEX "TreeScan_scannedAt_idx" ON "TreeScan"("scannedAt");

-- CreateIndex
CREATE INDEX "Tree_parkId_idx" ON "Tree"("parkId");

-- CreateIndex
CREATE INDEX "Tree_zoneId_idx" ON "Tree"("zoneId");

-- CreateIndex
CREATE INDEX "Tree_healthStatus_idx" ON "Tree"("healthStatus");

-- CreateIndex
CREATE INDEX "Tree_lastScannedAt_idx" ON "Tree"("lastScannedAt");

-- CreateIndex
CREATE INDEX "BiodiversityLog_parkId_idx" ON "BiodiversityLog"("parkId");

-- CreateIndex
CREATE INDEX "BiodiversityLog_detectedAt_idx" ON "BiodiversityLog"("detectedAt");

-- CreateIndex
CREATE INDEX "BiodiversityLog_speciesType_idx" ON "BiodiversityLog"("speciesType");

-- CreateIndex
CREATE INDEX "IrrigationZone_parkId_idx" ON "IrrigationZone"("parkId");

-- CreateIndex
CREATE UNIQUE INDEX "IrrigationZone_parkId_zoneCode_key" ON "IrrigationZone"("parkId", "zoneCode");

-- CreateIndex
CREATE INDEX "IrrigationEvent_zoneId_idx" ON "IrrigationEvent"("zoneId");

-- CreateIndex
CREATE INDEX "IrrigationEvent_triggeredBy_idx" ON "IrrigationEvent"("triggeredBy");

-- CreateIndex
CREATE INDEX "IrrigationEvent_triggeredAt_idx" ON "IrrigationEvent"("triggeredAt");

-- CreateIndex
CREATE INDEX "IrrigationEvent_triggerType_idx" ON "IrrigationEvent"("triggerType");

-- CreateIndex
CREATE INDEX "Alert_parkId_idx" ON "Alert"("parkId");

-- CreateIndex
CREATE INDEX "Alert_nodeId_idx" ON "Alert"("nodeId");

-- CreateIndex
CREATE INDEX "Alert_status_idx" ON "Alert"("status");

-- CreateIndex
CREATE INDEX "Alert_severity_idx" ON "Alert"("severity");

-- CreateIndex
CREATE INDEX "Alert_createdAt_idx" ON "Alert"("createdAt");

-- CreateIndex
CREATE INDEX "ActionLog_alertId_idx" ON "ActionLog"("alertId");

-- CreateIndex
CREATE INDEX "ActionLog_parkId_idx" ON "ActionLog"("parkId");

-- CreateIndex
CREATE INDEX "ActionLog_performedBy_idx" ON "ActionLog"("performedBy");

-- CreateIndex
CREATE INDEX "ActionLog_createdAt_idx" ON "ActionLog"("createdAt");

-- CreateIndex
CREATE INDEX "ActionLog_actionType_idx" ON "ActionLog"("actionType");

-- CreateIndex
CREATE INDEX "CitizenReport_parkId_idx" ON "CitizenReport"("parkId");

-- CreateIndex
CREATE INDEX "CitizenReport_status_idx" ON "CitizenReport"("status");

-- CreateIndex
CREATE INDEX "CitizenReport_submittedBy_idx" ON "CitizenReport"("submittedBy");

-- CreateIndex
CREATE INDEX "CitizenReport_verifiedBy_idx" ON "CitizenReport"("verifiedBy");

-- CreateIndex
CREATE INDEX "CitizenReport_createdAt_idx" ON "CitizenReport"("createdAt");

-- CreateIndex
CREATE INDEX "DigitalTwinSimulation_parkId_idx" ON "DigitalTwinSimulation"("parkId");

-- CreateIndex
CREATE INDEX "DigitalTwinSimulation_runBy_idx" ON "DigitalTwinSimulation"("runBy");

-- CreateIndex
CREATE INDEX "DigitalTwinSimulation_status_idx" ON "DigitalTwinSimulation"("status");

-- CreateIndex
CREATE INDEX "DigitalTwinSimulation_runAt_idx" ON "DigitalTwinSimulation"("runAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Park" ADD CONSTRAINT "Park_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensorNode" ADD CONSTRAINT "SensorNode_parkId_fkey" FOREIGN KEY ("parkId") REFERENCES "Park"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensorNode" ADD CONSTRAINT "SensorNode_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "IrrigationZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensorReading" ADD CONSTRAINT "SensorReading_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "SensorNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GshiScore" ADD CONSTRAINT "GshiScore_parkId_fkey" FOREIGN KEY ("parkId") REFERENCES "Park"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SatelliteImage" ADD CONSTRAINT "SatelliteImage_parkId_fkey" FOREIGN KEY ("parkId") REFERENCES "Park"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreeScan" ADD CONSTRAINT "TreeScan_parkId_fkey" FOREIGN KEY ("parkId") REFERENCES "Park"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreeScan" ADD CONSTRAINT "TreeScan_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreeScan" ADD CONSTRAINT "TreeScan_scannedBy_fkey" FOREIGN KEY ("scannedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tree" ADD CONSTRAINT "Tree_parkId_fkey" FOREIGN KEY ("parkId") REFERENCES "Park"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tree" ADD CONSTRAINT "Tree_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "IrrigationZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiodiversityLog" ADD CONSTRAINT "BiodiversityLog_parkId_fkey" FOREIGN KEY ("parkId") REFERENCES "Park"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IrrigationZone" ADD CONSTRAINT "IrrigationZone_parkId_fkey" FOREIGN KEY ("parkId") REFERENCES "Park"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IrrigationEvent" ADD CONSTRAINT "IrrigationEvent_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "IrrigationZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IrrigationEvent" ADD CONSTRAINT "IrrigationEvent_triggeredBy_fkey" FOREIGN KEY ("triggeredBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_parkId_fkey" FOREIGN KEY ("parkId") REFERENCES "Park"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "SensorNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_resolvedBy_fkey" FOREIGN KEY ("resolvedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionLog" ADD CONSTRAINT "ActionLog_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionLog" ADD CONSTRAINT "ActionLog_parkId_fkey" FOREIGN KEY ("parkId") REFERENCES "Park"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionLog" ADD CONSTRAINT "ActionLog_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CitizenReport" ADD CONSTRAINT "CitizenReport_parkId_fkey" FOREIGN KEY ("parkId") REFERENCES "Park"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CitizenReport" ADD CONSTRAINT "CitizenReport_submittedBy_fkey" FOREIGN KEY ("submittedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CitizenReport" ADD CONSTRAINT "CitizenReport_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalTwinSimulation" ADD CONSTRAINT "DigitalTwinSimulation_parkId_fkey" FOREIGN KEY ("parkId") REFERENCES "Park"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalTwinSimulation" ADD CONSTRAINT "DigitalTwinSimulation_runBy_fkey" FOREIGN KEY ("runBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
