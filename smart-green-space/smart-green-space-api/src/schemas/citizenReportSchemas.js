const { z } = require("zod");

const listQuerySchema = z
  .object({
    parkId: z.string().min(1).optional(),
    type: z.enum(["TREE_DAMAGE", "LITTER", "WILDLIFE", "FLOODING", "VANDALISM", "OTHER"]).optional(),
    status: z.enum(["PENDING", "VERIFIED", "REJECTED", "ACTIONED"]).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  })
  .refine((q) => (q.from && q.to ? q.from.getTime() <= q.to.getTime() : true), {
    message: "from must be before or equal to to",
  });

const createBodySchema = z.object({
  parkId: z.string().min(1),
  type: z.enum(["TREE_DAMAGE", "LITTER", "WILDLIFE", "FLOODING", "VANDALISM", "OTHER"]),
  description: z.string().min(3).max(2000),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
});

const reportIdParamSchema = z.object({ reportId: z.string().min(1) });
const parkIdParamSchema = z.object({ parkId: z.string().min(1) });

const verifyBodySchema = z.object({
  status: z.enum(["VERIFIED", "REJECTED"]),
  verificationNote: z.string().max(2000).optional(),
});

const leaderboardQuerySchema = z.object({
  parkId: z.string().min(1).optional(),
  cityId: z.string().min(1).optional(),
  timeRange: z.enum(["week", "month", "alltime"]).default("alltime"),
});

module.exports = {
  listQuerySchema,
  createBodySchema,
  reportIdParamSchema,
  parkIdParamSchema,
  verifyBodySchema,
  leaderboardQuerySchema,
};

