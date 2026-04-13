const {
  getLatestForPark,
  getHistoryForPark,
  manualIngest,
  getNdviTimeseries,
  getCityThermalZones,
  verifySentinelWebhookSignature,
  enqueueSentinelWebhookPayload,
} = require("../services/satelliteService");
const { prisma } = require("../config/prisma");

async function latest(req, res, next) {
  try {
    const row = await getLatestForPark(req.params.parkId);
    if (!row) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "No satellite capture for this park", details: null },
      });
    }
    return res.status(200).json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
}

async function history(req, res, next) {
  try {
    const data = await getHistoryForPark(req.params.parkId, req.query);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function ingest(req, res, next) {
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

    const data = await manualIngest(req.params.parkId, req.body);
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function ndviTimeseries(req, res, next) {
  try {
    const data = await getNdviTimeseries(req.params.parkId, req.query);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function thermalZones(req, res, next) {
  try {
    const city = await prisma.city.findUnique({ where: { id: req.params.cityId }, select: { id: true } });
    if (!city) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "City not found", details: null },
      });
    }
    const data = await getCityThermalZones(req.params.cityId);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function webhookSentinel(req, res, next) {
  try {
    const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body ?? {}));
    const sig = req.headers["x-sentinel-signature"] || req.headers["x-signature"];
    verifySentinelWebhookSignature(buf, sig);
    const payload = JSON.parse(buf.toString("utf8"));
    await enqueueSentinelWebhookPayload(payload);
    return res.status(200).json({ success: true, queued: true });
  } catch (err) {
    const code = err.statusCode || 500;
    if (code === 401 || code === 500) {
      return res.status(code).json({
        success: false,
        error: {
          code: code === 401 ? "UNAUTHORIZED" : "WEBHOOK_CONFIG",
          message: err.message,
          details: null,
        },
      });
    }
    return next(err);
  }
}

module.exports = {
  latest,
  history,
  ingest,
  ndviTimeseries,
  thermalZones,
  webhookSentinel,
};
