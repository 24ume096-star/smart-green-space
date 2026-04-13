const { prisma } = require("../config/prisma");
const { runSimulationAsync, getSimulation, getParkSimulations } = require("../services/simulationService");

async function run(req, res, next) {
  try {
    const park = await prisma.park.findUnique({
      where: { id: req.params.parkId },
      select: { id: true, cityId: true },
    });
    if (!park) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Park not found", details: null },
      });
    }

    if (req.user.role === "CITY_OFFICER" && req.user.cityId !== park.cityId) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "City access denied for this park", details: null },
      });
    }

    const data = await runSimulationAsync({
      parkId: req.params.parkId,
      runBy: req.user.userId,
      scenario: req.body.scenario,
      parameters: req.body.parameters,
    });
    return res.status(202).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function detail(req, res, next) {
  try {
    const row = await getSimulation(req.params.simulationId);
    if (!row) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Simulation not found", details: null },
      });
    }

    if (req.user.role === "CITY_OFFICER" && req.user.cityId && row.park?.cityId !== req.user.cityId) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "City access denied for this simulation", details: null },
      });
    }

    return res.status(200).json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
}

async function history(req, res, next) {
  try {
    const data = await getParkSimulations(req.params.parkId);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  run,
  detail,
  history,
};

