describe("gshiService.calculateGshi", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("calculates weighted GSHI and persists score", async () => {
    const mockPrisma = {
      park: {
        findUnique: jest.fn().mockResolvedValue({ id: "park-1", cityId: "city-1", name: "Park 1" }),
      },
      satelliteImage: {
        findFirst: jest.fn().mockResolvedValue({
          id: "sat-1",
          source: "SENTINEL2",
          capturedAt: new Date("2026-04-01T00:00:00.000Z"),
          ndviMean: 0.5,
        }),
      },
      sensorReading: {
        aggregate: jest.fn().mockResolvedValue({
          _avg: { temperature: 30, soilMoisture: 55 },
        }),
      },
      biodiversityLog: {
        findMany: jest.fn().mockResolvedValue([
          { speciesName: "sparrow", count: 10 },
          { speciesName: "crow", count: 8 },
          { speciesName: "myna", count: 6 },
        ]),
      },
      treeScan: {
        aggregate: jest.fn().mockResolvedValue({
          _avg: { aiHealthScore: 82 },
        }),
      },
      gshiScore: {
        findFirst: jest.fn().mockResolvedValue({
          id: "g-old",
          overallScore: 70,
          infrastructureScore: 60,
        }),
        create: jest.fn().mockImplementation(async ({ data }) => ({ id: "g-new", ...data })),
      },
      alert: {
        create: jest.fn(),
      },
    };

    jest.doMock("../src/config/prisma", () => ({ prisma: {} }));
    const { calculateGshi } = require("../src/services/gshiService");
    const result = await calculateGshi("park-1", { prismaClient: mockPrisma, infrastructureScore: 75 });

    expect(result.parkId).toBe("park-1");
    expect(result.overallScore).toBeGreaterThan(0);
    expect(result.vegetationScore).toBeGreaterThan(0);
    expect(result.treeHealthScore).toBe(82);
    expect(mockPrisma.gshiScore.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.alert.create).not.toHaveBeenCalled();
  });

  it("creates alert when GSHI drops more than 10 points", async () => {
    const mockPrisma = {
      park: {
        findUnique: jest.fn().mockResolvedValue({ id: "park-1", cityId: "city-1", name: "Park 1" }),
      },
      satelliteImage: {
        findFirst: jest.fn().mockResolvedValue({
          id: "sat-1",
          source: "SENTINEL2",
          capturedAt: new Date("2026-04-01T00:00:00.000Z"),
          ndviMean: -0.2,
        }),
      },
      sensorReading: {
        aggregate: jest.fn().mockResolvedValue({
          _avg: { temperature: 41, soilMoisture: 15 },
        }),
      },
      biodiversityLog: {
        findMany: jest.fn().mockResolvedValue([{ speciesName: "crow", count: 1 }]),
      },
      treeScan: {
        aggregate: jest.fn().mockResolvedValue({
          _avg: { aiHealthScore: 20 },
        }),
      },
      gshiScore: {
        findFirst: jest.fn().mockResolvedValue({
          id: "g-old",
          overallScore: 80,
          infrastructureScore: 50,
        }),
        create: jest.fn().mockImplementation(async ({ data }) => ({ id: "g-new", ...data })),
      },
      alert: {
        create: jest.fn().mockResolvedValue({ id: "a-1" }),
      },
    };

    jest.doMock("../src/config/prisma", () => ({ prisma: {} }));
    const { calculateGshi } = require("../src/services/gshiService");
    const result = await calculateGshi("park-1", { prismaClient: mockPrisma });

    expect(result.scoreDropFromLast).toBeGreaterThan(10);
    expect(mockPrisma.alert.create).toHaveBeenCalledTimes(1);
  });
});
