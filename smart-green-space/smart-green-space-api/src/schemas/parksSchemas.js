const { z } = require("zod");

const parkType = z.enum(["URBAN_PARK", "FOREST", "GARDEN", "WETLAND"]);

const parkIdParamSchema = z.object({
  parkId: z.string().min(1),
});

const listParksQuerySchema = z.object({
  cityId: z.string().min(1).optional(),
  type: parkType.optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().optional(),
});

const createParkSchema = z.object({
  cityId: z.string().min(1),
  name: z.string().trim().min(2).max(200),
  area: z.number().positive(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  geoJsonBoundary: z.any().optional(),
  type: parkType,
});

const updateParkSchema = createParkSchema.partial();

module.exports = {
  parkIdParamSchema,
  listParksQuerySchema,
  createParkSchema,
  updateParkSchema,
};
