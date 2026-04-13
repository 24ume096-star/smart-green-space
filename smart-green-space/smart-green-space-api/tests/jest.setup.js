process.env.NODE_ENV = "test";
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";
process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://sgs:sgs_password@127.0.0.1:5432/greenspace?schema=public";
process.env.REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "test_access_secret_1234567890";
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "test_refresh_secret_1234567890";
process.env.SWAGGER_ENABLED = "false";

