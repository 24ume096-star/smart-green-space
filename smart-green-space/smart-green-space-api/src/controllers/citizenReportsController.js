const {
  listReports,
  createReport,
  verifyReport,
  actionReport,
  parkStats,
  leaderboard,
} = require("../services/citizenReportsService");

async function list(req, res, next) {
  try {
    const data = await listReports(req.query, req.user);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function create(req, res, next) {
  try {
    const data = await createReport({
      ...req.body,
      file: req.file || null,
      actor: req.user || null,
    });
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function verify(req, res, next) {
  try {
    const data = await verifyReport(req.params.reportId, req.body, req.user);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Report not found", details: null },
      });
    }
    return next(err);
  }
}

async function action(req, res, next) {
  try {
    const data = await actionReport(req.params.reportId, req.user);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Report not found", details: null },
      });
    }
    return next(err);
  }
}

async function stats(req, res, next) {
  try {
    const data = await parkStats(req.params.parkId);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function top(req, res, next) {
  try {
    const data = await leaderboard(req.query);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  list,
  create,
  verify,
  action,
  stats,
  top,
};

