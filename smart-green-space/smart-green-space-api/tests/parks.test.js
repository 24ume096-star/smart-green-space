describe("Parks routes", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("GET /api/v1/parks returns paginated shape", async () => {
    const request = require("supertest");
    jest.doMock("../src/config/prisma", () => ({
      prisma: {
        park: {
          count: jest.fn(async () => 1),
          findMany: jest.fn(async () => [
            { id: "p-1", name: "Park", city: { id: "c-1", name: "City" }, gshiScores: [] },
          ]),
        },
      },
    }));

    const { createApp } = require("../src/app");
    const app = createApp();
    const res = await request(app).get("/api/v1/parks?page=1&limit=10");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("items");
    expect(res.body.data).toHaveProperty("pagination");
  });

  it("GET /api/v1/parks/:parkId 404 on missing", async () => {
    const request = require("supertest");
    jest.doMock("../src/config/prisma", () => ({
      prisma: {
        park: { findUnique: jest.fn(async () => null) },
        alert: { count: jest.fn(async () => 0) },
        satelliteImage: { findFirst: jest.fn(async () => null) },
      },
    }));

    const { createApp } = require("../src/app");
    const app = createApp();
    const res = await request(app).get("/api/v1/parks/p-404");
    expect(res.status).toBe(404);
  });
});

