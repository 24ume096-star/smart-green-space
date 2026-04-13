describe("Sensors service", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("POST reading creates anomaly score and may create alert", async () => {
    jest.doMock("../src/config/redis", () => ({ redis: { publish: async () => {} } }));
    const created = { reading: null, alert: null };

    jest.doMock("../src/services/alertService", () => ({
      createAlert: async () => {
        created.alert = { id: "a-1" };
        return created.alert;
      },
    }));

    jest.doMock("../src/utils/cache", () => ({
      bumpVersion: async () => {},
      parkVersionKey: () => "k1",
      cityVersionKey: () => "k2",
    }));

    jest.doMock("../src/config/prisma", () => ({
      prisma: {
        sensorNode: {
          findUnique: async () => ({ id: "n-1", parkId: "p-1", isActive: true }),
          update: async () => ({}),
        },
        sensorReading: {
          findMany: async () =>
            Array.from({ length: 100 }).map((_, i) => ({
              soilMoisture: 50,
              temperature: 30,
              humidity: 50,
              airQualityPM25: 10 + (i % 10),
              airQualityPM10: 20,
              co2Level: 500,
              lightIntensity: 200,
              windSpeed: 2,
            })),
          create: async ({ data }) => {
            created.reading = { id: "r-1", ...data };
            return created.reading;
          },
        },
        park: { findUnique: async () => ({ cityId: "c-1" }) },
      },
    }));

    const { createSensorReading } = require("../src/services/sensorsService");
    const result = await createSensorReading("n-1", { airQualityPM25: 100 });
    expect(result.reading).toBeTruthy();
    expect(result.anomalyDetected).toBe(true);
  });
});

