const {
  listSensors,
  getSensorNode,
  createSensorNode,
  updateSensorNode,
  createSensorReading,
  getAggregatedReadings,
  getLatestReading,
  softDeleteSensor,
} = require("../services/sensorsService");

async function list(req, res, next) {
  try {
    const data = await listSensors(req.query);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function detail(req, res, next) {
  try {
    const node = await getSensorNode(req.params.nodeId);
    if (!node) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Sensor node not found", details: null },
      });
    }
    return res.status(200).json({ success: true, data: node });
  } catch (err) {
    return next(err);
  }
}

async function create(req, res, next) {
  try {
    const node = await createSensorNode(req.body);
    return res.status(201).json({ success: true, data: node });
  } catch (err) {
    return next(err);
  }
}

async function update(req, res, next) {
  try {
    const node = await updateSensorNode(req.params.nodeId, req.body);
    return res.status(200).json({ success: true, data: node });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Sensor node not found", details: null },
      });
    }
    return next(err);
  }
}

async function createReading(req, res, next) {
  try {
    const result = await createSensorReading(req.params.nodeId, req.body);
    if (!result) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Sensor node not found", details: null },
      });
    }
    return res.status(201).json({
      success: true,
      data: {
        reading: result.reading,
        anomalyDetected: result.anomalyDetected,
        alertCreated: result.alertCreated,
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function readings(req, res, next) {
  try {
    const data = await getAggregatedReadings(req.params.nodeId, req.query);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function latestReading(req, res, next) {
  try {
    const data = await getLatestReading(req.params.nodeId);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function remove(req, res, next) {
  try {
    await softDeleteSensor(req.params.nodeId);
    return res.status(200).json({
      success: true,
      data: { message: "Sensor node deactivated successfully" },
    });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Sensor node not found", details: null },
      });
    }
    return next(err);
  }
}

module.exports = {
  list,
  detail,
  create,
  update,
  createReading,
  readings,
  latestReading,
  remove,
};
