const {
  getParkOverview,
  getParkGshiTrend,
  getCityParkRankings,
  getParkAlertAnalytics,
  getParkAiForecast,
  getCityDashboardSummary,
} = require("../services/analyticsService");

const { calculateParkCarbon } = require("../services/carbonService");

async function parkOverview(req, res, next) {
  try {
    const data = await getParkOverview(req.params.parkId);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function parkCarbonStats(req, res, next) {
  try {
    const data = await calculateParkCarbon(req.params.parkId);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function parkGshiTrend(req, res, next) {
  try {
    const data = await getParkGshiTrend(req.params.parkId, req.query);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function cityParkRankings(req, res, next) {
  try {
    const data = await getCityParkRankings(req.params.cityId);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function parkAlertAnalytics(req, res, next) {
  try {
    const data = await getParkAlertAnalytics(req.params.parkId, req.query);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function parkAiForecast(req, res, next) {
  try {
    const data = await getParkAiForecast(req.params.parkId);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function cityDashboardSummary(req, res, next) {
  try {
    const data = await getCityDashboardSummary(req.params.cityId);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  parkOverview,
  parkCarbonStats,
  parkGshiTrend,
  cityParkRankings,
  parkAlertAnalytics,
  parkAiForecast,
  cityDashboardSummary,
};

