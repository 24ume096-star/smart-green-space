const { z } = require("zod");

const nodeStatus = z.enum(["ONLINE", "OFFLINE", "ALERT", "MAINTENANCE"]);
const intervalEnum = z.enum(["1min", "5min", "1hour", "1day"]);

const nodeIdParamSchema = z.object({
  nodeId: z.string().min(1),
});

const listSensorsQuerySchema = z.object({
  parkId: z.string().min(1).optional(),
  zoneId: z.string().min(1).optional(),
  status: nodeStatus.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const createSensorSchema = z.object({
  parkId: z.string().min(1),
  zoneId: z.string().min(1),
  nodeCode: z.string().trim().min(3).max(64),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  model: z.string().trim().max(120).optional(),
  firmwareVersion: z.string().trim().max(60).optional(),
});

const updateSensorSchema = z.object({
  zoneId: z.string().min(1).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  model: z.string().trim().max(120).optional(),
  firmwareVersion: z.string().trim().max(60).optional(),
  status: nodeStatus.optional(),
  batteryLevel: z.number().min(0).max(100).optional(),
  signalStrength: z.number().int().optional(),
  edgeAiEnabled: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

const readingBodySchema = z.object({
  soilMoisture: z.number().min(0).max(100).optional(),
  temperature: z.number().min(-50).max(80).optional(),
  humidity: z.number().min(0).max(100).optional(),
  airQualityPM25: z.number().min(0).max(1000).optional(),
  airQualityPM10: z.number().min(0).max(1000).optional(),
  co2Level: z.number().min(0).max(10000).optional(),
  lightIntensity: z.number().min(0).max(250000).optional(),
  windSpeed: z.number().min(0).max(150).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "At least one reading metric is required",
});

const readingsQuerySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  interval: intervalEnum.default("5min"),
});

module.exports = {
  nodeIdParamSchema,
  listSensorsQuerySchema,
  createSensorSchema,
  updateSensorSchema,
  readingBodySchema,
  readingsQuerySchema,
};
