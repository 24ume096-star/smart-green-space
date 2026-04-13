-- AlterEnum
ALTER TYPE "AlertType" ADD VALUE 'NDVI_DECLINE';

-- AlterTable
ALTER TABLE "SatelliteImage" ADD COLUMN "ndviStdDev" DOUBLE PRECISION;
ALTER TABLE "SatelliteImage" ADD COLUMN "ndviZones" JSONB;
ALTER TABLE "SatelliteImage" ADD COLUMN "thermalMeanC" DOUBLE PRECISION;
