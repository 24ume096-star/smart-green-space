describe("GET /health", () => {
  it(
    "returns health shape",
    async () => {
    // Provide minimal env for app init (tests typically set these in CI)
    process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";
    process.env.DATABASE_URL =
      process.env.DATABASE_URL || "postgresql://sgs:sgs_password@127.0.0.1:5432/sgs?schema=public";
    process.env.REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
    process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "test_access_secret_123456";
    process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "test_refresh_secret_123456";

    const request = require("supertest");
    const { createApp } = require("../src/app");
    const { prisma } = require("../src/config/prisma");
    const { redis } = require("../src/config/redis");

    const app = createApp();
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status");
    expect(res.body).toHaveProperty("db");
    expect(res.body).toHaveProperty("redis");
    expect(res.body).toHaveProperty("uptime");
    await prisma.$disconnect().catch(() => {});
    if (redis.status !== "end") {
      await redis.disconnect();
    }
    },
    15000,
  );
});

