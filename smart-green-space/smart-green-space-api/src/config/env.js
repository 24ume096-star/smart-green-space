const dotenv = require("dotenv");
const { z } = require("zod");

dotenv.config();

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(8080),

    CORS_ORIGIN: z.string().min(1),

    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1),

    JWT_ACCESS_SECRET: z.string().min(16),
    JWT_REFRESH_SECRET: z.string().min(16),
    JWT_ACCESS_TTL_MIN: z.coerce.number().int().positive().default(15),
    JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(7),

    AWS_REGION: z.string().optional(),
    AWS_S3_BUCKET: z.string().optional(),
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),

    SWAGGER_ENABLED: z.coerce.boolean().default(true),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
    TRUST_PROXY: z.coerce.boolean().default(false),

    /** HMAC secret for Sentinel/Copernicus webhook signature verification */
    SENTINEL_WEBHOOK_SECRET: z.string().optional(),
    OPENROUTER_API_KEY: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const usingS3 =
      Boolean(data.AWS_S3_BUCKET) ||
      Boolean(data.AWS_ACCESS_KEY_ID) ||
      Boolean(data.AWS_SECRET_ACCESS_KEY);

    if (usingS3) {
      if (!data.AWS_REGION) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["AWS_REGION"],
          message: "AWS_REGION is required when S3 uploads are enabled",
        });
      }
      if (!data.AWS_S3_BUCKET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["AWS_S3_BUCKET"],
          message: "AWS_S3_BUCKET is required when S3 uploads are enabled",
        });
      }
      if (!data.AWS_ACCESS_KEY_ID) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["AWS_ACCESS_KEY_ID"],
          message: "AWS_ACCESS_KEY_ID is required when S3 uploads are enabled",
        });
      }
      if (!data.AWS_SECRET_ACCESS_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["AWS_SECRET_ACCESS_KEY"],
          message: "AWS_SECRET_ACCESS_KEY is required when S3 uploads are enabled",
        });
      }
    }
  })
  .passthrough();

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  // Throw hard on missing/invalid env vars
  const details = parsed.error.issues.map((i) => ({
    path: i.path.join("."),
    message: i.message,
  }));
  // eslint-disable-next-line no-console
  console.error("Invalid environment configuration:", details);
  throw new Error("Invalid environment configuration. See logs for details.");
}

const env = parsed.data;

module.exports = { env };

