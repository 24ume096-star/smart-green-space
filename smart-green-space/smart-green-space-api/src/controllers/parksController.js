const { prisma } = require("../config/prisma");
const {
  listParks,
  getParkById,
  createPark,
  updatePark,
  listParkZones,
  parkStatsSummary,
} = require("../services/parksService");

function forbidden(message = "You are not allowed to access this resource") {
  const err = new Error(message);
  err.statusCode = 403;
  err.code = "FORBIDDEN";
  return err;
}

async function list(req, res, next) {
  try {
    const data = await listParks(req.query);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function detail(req, res, next) {
  try {
    const park = await getParkById(req.params.parkId);
    if (!park) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Park not found", details: null },
      });
    }
    return res.status(200).json({ success: true, data: park });
  } catch (err) {
    return next(err);
  }
}

async function create(req, res, next) {
  try {
    if (req.user.role === "CITY_OFFICER" && req.user.cityId !== req.body.cityId) {
      throw forbidden("City access denied for this resource");
    }
    const city = await prisma.city.findUnique({ where: { id: req.body.cityId } });
    if (!city) {
      return res.status(422).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Invalid cityId", details: null },
      });
    }
    const park = await createPark(req.body);
    return res.status(201).json({ success: true, data: park });
  } catch (err) {
    return next(err);
  }
}

async function update(req, res, next) {
  try {
    const existing = await prisma.park.findUnique({ where: { id: req.params.parkId } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Park not found", details: null },
      });
    }
    if (req.user.role === "CITY_OFFICER" && req.user.cityId !== existing.cityId) {
      throw forbidden("City access denied for this resource");
    }
    const park = await updatePark(req.params.parkId, req.body);
    return res.status(200).json({ success: true, data: park });
  } catch (err) {
    return next(err);
  }
}

async function zones(req, res, next) {
  try {
    const park = await prisma.park.findUnique({ where: { id: req.params.parkId }, select: { id: true } });
    if (!park) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Park not found", details: null },
      });
    }
    const data = await listParkZones(req.params.parkId);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function statsSummary(req, res, next) {
  try {
    const park = await prisma.park.findUnique({ where: { id: req.params.parkId }, select: { id: true } });
    if (!park) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Park not found", details: null },
      });
    }
    const data = await parkStatsSummary(req.params.parkId);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  list,
  detail,
  create,
  update,
  zones,
  statsSummary,
};
