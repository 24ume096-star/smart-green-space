const { z } = require("zod");

const parkIdParamSchema = z.object({ parkId: z.string().min(1) });
const cityIdParamSchema = z.object({ cityId: z.string().min(1) });

const pushBodySchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  type: z.string().min(1).max(64),
  data: z.record(z.any()).optional(),
});

const subscribeBodySchema = z.object({
  parkId: z.string().min(1),
  deviceToken: z.string().min(8),
  platform: z.enum(["ios", "android", "web"]),
});

const unsubscribeBodySchema = z.object({
  parkId: z.string().min(1),
  deviceToken: z.string().min(8),
});

module.exports = {
  parkIdParamSchema,
  cityIdParamSchema,
  pushBodySchema,
  subscribeBodySchema,
  unsubscribeBodySchema,
};

