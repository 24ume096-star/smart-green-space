const { z } = require("zod");

const parkIdParamSchema = z.object({
  parkId: z.string().min(1),
});

const cityIdParamSchema = z.object({
  cityId: z.string().min(1),
});

const historyQuerySchema = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
  })
  .refine((q) => q.from.getTime() <= q.to.getTime(), { message: "from must be before or equal to to" });

const ndviTimeseriesQuerySchema = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
    interval: z.enum(["weekly", "monthly"]).default("weekly"),
  })
  .refine((q) => q.from.getTime() <= q.to.getTime(), { message: "from must be before or equal to to" });

const manualIngestBodySchema = z.object({
  capturedAt: z.coerce.date(),
  source: z.enum(["SENTINEL2", "LANDSAT"]).optional(),
  ndviMean: z.number(),
  ndviMin: z.number().optional(),
  ndviMax: z.number().optional(),
  ndviMapUrl: z.string().url().optional(),
  thermalMapUrl: z.string().url().optional(),
  cloudCoverage: z.number().min(0).max(100).optional(),
  thermalMeanC: z.number().optional(),
  imageUrl: z.string().url().optional(),
});

module.exports = {
  parkIdParamSchema,
  cityIdParamSchema,
  historyQuerySchema,
  ndviTimeseriesQuerySchema,
  manualIngestBodySchema,
};
