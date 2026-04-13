describe("gshiService.calculateGshi (unit)", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("weights sum to 1.0", async () => {
    const { __private } = require("../src/services/gshiService");
    const parts = {
      vegetationScore: 100,
      thermalScore: 100,
      waterScore: 100,
      biodiversityScore: 100,
      infrastructureScore: 100,
      treeHealthScore: 100,
    };
    const overall = __private.computeWeightedOverall(parts);
    expect(overall).toBe(100);
  });

  it("handles missing sources (no satellite) by scoring vegetation 0", async () => {
    const mockPrisma = {
      park: { findUnique: jest.fn().mockResolvedValue({ id: "p-1", cityId: "c-1", name: "Park" }) },
      satelliteImage: { findFirst: jest.fn().mockResolvedValue(null) },
      sensorReading: { aggregate: jest.fn().mockResolvedValue({ _avg: { temperature: null, soilMoisture: null } }) },
      biodiversityLog: { findMany: jest.fn().mockResolvedValue([]) },
      treeScan: { aggregate: jest.fn().mockResolvedValue({ _avg: { aiHealthScore: null } }) },
      gshiScore: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }) => ({ id: "g-1", ...data })),
      },
      alert: { create: jest.fn() },
    };

    jest.doMock("../src/config/prisma", () => ({ prisma: {} }));
    jest.doMock("../src/config/redis", () => ({ redis: { publish: async () => {} } }));
    jest.doMock("../src/utils/cache", () => ({
      bumpVersion: async () => {},
      parkVersionKey: () => "k1",
      cityVersionKey: () => "k2",
    }));

    const { calculateGshi } = require("../src/services/gshiService");
    const r = await calculateGshi("p-1", { prismaClient: mockPrisma });
    expect(r.vegetationScore).toBe(0);
    expect(mockPrisma.gshiScore.create).toHaveBeenCalledTimes(1);
  });
});

