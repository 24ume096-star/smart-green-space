const {
  subscribe,
  unsubscribe,
  myNotifications,
  pushToPark,
  pushToCity,
} = require("../services/notificationService");

async function pushPark(req, res, next) {
  try {
    const data = await pushToPark({ parkId: req.params.parkId, actor: req.user, ...req.body });
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function pushCity(req, res, next) {
  try {
    const data = await pushToCity({ cityId: req.params.cityId, actor: req.user, ...req.body });
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function mine(req, res, next) {
  try {
    const data = await myNotifications(req.user.userId);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function sub(req, res, next) {
  try {
    const data = await subscribe({ userId: req.user.userId, ...req.body });
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function unsub(req, res, next) {
  try {
    const data = await unsubscribe(req.body);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Subscription not found", details: null },
      });
    }
    return next(err);
  }
}

module.exports = {
  pushPark,
  pushCity,
  mine,
  sub,
  unsub,
};

