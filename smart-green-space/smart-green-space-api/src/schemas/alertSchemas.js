const { z } = require("zod");

const listAlertsQuerySchema = z
  .object({
    parkId: z.string().min(1).optional(),
    cityId: z.string().min(1).optional(),
    severity: z.enum(["CRITICAL", "WARNING", "INFO"]).optional(),
    type: z
      .enum([
        "HEAT_STRESS",
        "FLOOD_RISK",
        "DISEASE",
        "PEST",
        "SENSOR_OFFLINE",
        "LOW_BIODIVERSITY",
        "IRRIGATION_FAILURE",
        "FIRE_RISK",
        "NDVI_DECLINE",
      ])
      .optional(),
    status: z.enum(["OPEN", "ASSIGNED", "RESOLVED", "ESCALATED"]).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  })
  .refine((q) => (q.from && q.to ? q.from.getTime() <= q.to.getTime() : true), {
    message: "from must be before or equal to to",
  });

const alertIdParamSchema = z.object({
  alertId: z.string().min(1),
});

const createAlertBodySchema = z.object({
  parkId: z.string().min(1),
  nodeId: z.string().min(1).optional(),
  severity: z.enum(["CRITICAL", "WARNING", "INFO"]),
  type: z.enum([
    "HEAT_STRESS",
    "FLOOD_RISK",
    "DISEASE",
    "PEST",
    "SENSOR_OFFLINE",
    "LOW_BIODIVERSITY",
    "IRRIGATION_FAILURE",
    "FIRE_RISK",
    "NDVI_DECLINE",
  ]),
  title: z.string().min(3).max(200),
  description: z.string().min(3).max(2000),
  aiConfidence: z.number().min(0).max(1).optional(),
});

const assignBodySchema = z.object({
  assignedTo: z.string().min(1),
});

const resolveBodySchema = z.object({
  resolutionNote: z.string().max(2000).optional(),
});

const escalateBodySchema = z.object({
  escalateTo: z.string().min(1),
  reason: z.string().max(2000).optional(),
});

const cityIdParamSchema = z.object({
  cityId: z.string().min(1),
});

module.exports = {
  listAlertsQuerySchema,
  alertIdParamSchema,
  createAlertBodySchema,
  assignBodySchema,
  resolveBodySchema,
  escalateBodySchema,
  cityIdParamSchema,
};

