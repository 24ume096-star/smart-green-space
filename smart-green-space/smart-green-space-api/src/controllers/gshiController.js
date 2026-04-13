const { prisma } = require("../config/prisma");
const {
  calculateGshi,
  getCurrentGshi,
  getGshiHistory,
  getCityRankings,
  getParkForecast,
  getCityAverage,
} = require("../services/gshiService");

async function current(req, res, next) {
  try {
    const row = await getCurrentGshi(req.params.parkId);
    if (!row) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "GSHI not found for park", details: null },
      });
    }
    return res.status(200).json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
}

async function history(req, res, next) {
  try {
    const data = await getGshiHistory(req.params.parkId, req.query);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function calculate(req, res, next) {
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
        error: { code: "FORBIDDEN", message: "City access denied for this resource", details: null },
      });
    }

    const data = await calculateGshi(req.params.parkId, {
      infrastructureScore: req.body.infrastructureScore,
    });
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function rankings(req, res, next) {
  try {
    const data = await getCityRankings(req.params.cityId);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function forecast(req, res, next) {
  try {
    const data = await getParkForecast(req.params.parkId);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function cityAverage(req, res, next) {
  try {
    const data = await getCityAverage(req.params.cityId);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  current,
  history,
  calculate,
  rankings,
  forecast,
  cityAverage,
};
