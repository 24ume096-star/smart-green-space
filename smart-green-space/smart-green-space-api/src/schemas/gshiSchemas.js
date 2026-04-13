const { z } = require("zod");

const parkIdParamSchema = z.object({
  parkId: z.string().min(1),
});

const cityIdParamSchema = z.object({
  cityId: z.string().min(1),
});

const historyQuerySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  interval: z.enum(["daily", "weekly", "monthly"]).default("daily"),
});

const calculateBodySchema = z.object({
  infrastructureScore: z.number().min(0).max(100).optional(),
});

module.exports = {
  parkIdParamSchema,
  cityIdParamSchema,
  historyQuerySchema,
  calculateBodySchema,
};
