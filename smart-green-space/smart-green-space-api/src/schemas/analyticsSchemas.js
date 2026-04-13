const { z } = require("zod");

const parkIdParamSchema = z.object({ parkId: z.string().min(1) });
const cityIdParamSchema = z.object({ cityId: z.string().min(1) });

const gshiTrendQuerySchema = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
    interval: z.enum(["daily", "weekly", "monthly"]).default("daily"),
  })
  .refine((q) => q.from.getTime() <= q.to.getTime(), { message: "from must be before or equal to to" });

const alertsAnalyticsQuerySchema = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
  })
  .refine((q) => q.from.getTime() <= q.to.getTime(), { message: "from must be before or equal to to" });

const aiForecastQuerySchema = z.object({}).passthrough();

module.exports = {
  parkIdParamSchema,
  cityIdParamSchema,
  gshiTrendQuerySchema,
  alertsAnalyticsQuerySchema,
  aiForecastQuerySchema,
};

