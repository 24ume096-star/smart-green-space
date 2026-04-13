describe("Alerts service", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("createAlert publishes and emits (mock socket)", async () => {
    const emitted = [];
    const fakeIo = {
      to: () => ({ emit: (evt, payload) => emitted.push({ evt, payload }) }),
    };

    jest.doMock("../src/websocket/socketHandler", () => ({
      getIo: () => fakeIo,
    }));

    const published = [];
    jest.doMock("../src/config/redis", () => ({
      redis: { publish: async (ch, msg) => published.push({ ch, msg }) },
    }));

    jest.doMock("../src/config/prisma", () => ({
      prisma: {
        park: { findUnique: async () => ({ id: "p-1", cityId: "c-1", isActive: true }) },
        alert: { create: async ({ data }) => ({ id: "a-1", ...data }) },
      },
    }));

    const { createAlert } = require("../src/services/alertService");
    const alert = await createAlert({
      parkId: "p-1",
      severity: "CRITICAL",
      type: "FIRE_RISK",
      title: "Fire risk",
      description: "Test",
      aiConfidence: 0.9,
    });

    expect(alert.id).toBe("a-1");
    expect(published[0].ch).toBe("alerts:p-1");
    expect(emitted.some((e) => e.evt === "alert:new")).toBe(true);
  });

  it("auto-resolve: SENSOR_OFFLINE resolves when node is ONLINE and fresh", async () => {
    jest.doMock("../src/config/redis", () => ({ redis: {} }));
    jest.doMock("../src/websocket/socketHandler", () => ({ getIo: () => null }));
    jest.doMock("../src/config/prisma", () => ({
      prisma: {
        alert: {
          findMany: async () => [{ id: "a-1", type: "SENSOR_OFFLINE", parkId: "p-1", nodeId: "n-1", createdAt: new Date() }],
          update: async ({ data }) => ({ id: "a-1", ...data, parkId: "p-1", severity: "WARNING" }),
        },
        sensorNode: {
          findUnique: async () => ({ isActive: true, status: "ONLINE", lastPingAt: new Date() }),
        },
        actionLog: { create: async () => ({ id: "al-1" }) },
        park: { findUnique: async () => ({ cityId: "c-1" }) },
      },
    }));

    const { autoResolveCheck } = require("../src/services/alertService");
    const res = await autoResolveCheck();
    expect(res.resolved).toBe(1);
  });
});

