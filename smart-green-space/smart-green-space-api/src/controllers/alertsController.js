const {
  createAlert,
  listAlerts,
  getAlertDetail,
  assignAlert,
  resolveAlert,
  escalateAlert,
  getCityAlertSummary,
} = require("../services/alertService");
const { prisma } = require("../config/prisma");

async function list(req, res, next) {
  try {
    const data = await listAlerts(req.query);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function detail(req, res, next) {
  try {
    const row = await getAlertDetail(req.params.alertId);
    if (!row) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Alert not found", details: null },
      });
    }
    return res.status(200).json({ success: true, data: row });
  } catch (err) {
    return next(err);
  }
}

async function create(req, res, next) {
  try {
    // CITY_OFFICER can only create alerts within their city
    if (req.user.role === "CITY_OFFICER") {
      const park = await prisma.park.findUnique({
        where: { id: req.body.parkId },
        select: { cityId: true },
      });
      if (!park) {
        return res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Park not found", details: null },
        });
      }
      if (park.cityId !== req.user.cityId) {
        return res.status(403).json({
          success: false,
          error: { code: "FORBIDDEN", message: "City access denied for this park", details: null },
        });
      }
    }

    const alert = await createAlert(req.body);
    return res.status(201).json({ success: true, data: alert });
  } catch (err) {
    return next(err);
  }
}

async function assign(req, res, next) {
  try {
    const updated = await assignAlert(req.params.alertId, {
      assignedTo: req.body.assignedTo,
      performedBy: req.user.userId,
    });
    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Alert not found", details: null },
      });
    }
    return next(err);
  }
}

async function resolve(req, res, next) {
  try {
    const updated = await resolveAlert(req.params.alertId, {
      resolutionNote: req.body.resolutionNote,
      performedBy: req.user.userId,
    });
    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Alert not found", details: null },
      });
    }
    return next(err);
  }
}

async function escalate(req, res, next) {
  try {
    const updated = await escalateAlert(req.params.alertId, {
      escalateTo: req.body.escalateTo,
      reason: req.body.reason,
      performedBy: req.user.userId,
    });
    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Alert not found", details: null },
      });
    }
    return next(err);
  }
}

async function citySummary(req, res, next) {
  try {
    const data = await getCityAlertSummary(req.params.cityId);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  list,
  detail,
  create,
  assign,
  resolve,
  escalate,
  citySummary,
};

