describe("Auth routes", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("POST /api/v1/auth/register happy path", async () => {
    const request = require("supertest");

    const users = new Map();
    jest.doMock("../src/config/prisma", () => ({
      prisma: {
        user: {
          findUnique: jest.fn(async ({ where }) => users.get(where.email) || null),
          create: jest.fn(async ({ data }) => {
            const u = { id: "u-1", createdAt: new Date(), updatedAt: new Date(), lastLoginAt: null, ...data };
            users.set(u.email, u);
            return u;
          }),
          update: jest.fn(async ({ where, data }) => {
            const u = Array.from(users.values()).find((x) => x.id === where.id);
            Object.assign(u, data);
            return u;
          }),
        },
        city: { findUnique: jest.fn(async () => ({ id: "city-1" })) },
      },
    }));

    const { createApp } = require("../src/app");
    const app = createApp();

    const res = await request(app).post("/api/v1/auth/register").send({
      name: "Test",
      email: "test@example.com",
      password: "password123",
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("accessToken");
    expect(res.body.data).toHaveProperty("refreshToken");
    expect(res.body.data.user.email).toBe("test@example.com");
  });

  it("POST /api/v1/auth/register duplicate email", async () => {
    const request = require("supertest");

    jest.doMock("../src/config/prisma", () => ({
      prisma: {
        user: {
          findUnique: jest.fn(async () => ({ id: "u-1", email: "test@example.com" })),
        },
      },
    }));

    const { createApp } = require("../src/app");
    const app = createApp();

    const res = await request(app).post("/api/v1/auth/register").send({
      name: "Test",
      email: "test@example.com",
      password: "password123",
    });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it("POST /api/v1/auth/login wrong password", async () => {
    const request = require("supertest");
    const bcrypt = require("bcrypt");

    const hash = await bcrypt.hash("password123", 12);

    jest.doMock("../src/config/prisma", () => ({
      prisma: {
        user: {
          findUnique: jest.fn(async () => ({
            id: "u-1",
            email: "test@example.com",
            passwordHash: hash,
            role: "CITIZEN",
            cityId: null,
            name: "Test",
            phone: null,
            avatarUrl: null,
            isVerified: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastLoginAt: null,
          })),
          update: jest.fn(async ({ data }) => ({ ...data })),
        },
      },
    }));

    const { createApp } = require("../src/app");
    const app = createApp();

    const res = await request(app).post("/api/v1/auth/login").send({
      email: "test@example.com",
      password: "wrong",
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("POST /api/v1/auth/refresh expired/invalid token", async () => {
    const request = require("supertest");
    jest.doMock("../src/config/prisma", () => ({ prisma: { user: { findUnique: jest.fn() } } }));
    const { createApp } = require("../src/app");
    const app = createApp();

    const res = await request(app).post("/api/v1/auth/refresh").send({ refreshToken: "bad" });
    expect(res.status).toBe(401);
  });
});

