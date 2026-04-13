const {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  forgotPassword,
  resetPassword,
  getMe,
} = require("../services/authService");

async function register(req, res, next) {
  try {
    const result = await registerUser(req.body);
    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
}

async function login(req, res, next) {
  try {
    const result = await loginUser(req.body);
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const result = await refreshAccessToken(req.body.refreshToken);
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
}

async function logout(req, res, next) {
  try {
    await logoutUser(req.user.userId);
    return res.status(200).json({
      success: true,
      data: { message: "Logged out successfully" },
    });
  } catch (err) {
    return next(err);
  }
}

async function forgotPasswordHandler(req, res, next) {
  try {
    await forgotPassword(req.body.email);
    return res.status(200).json({
      success: true,
      data: { message: "If the email exists, a reset link has been sent" },
    });
  } catch (err) {
    return next(err);
  }
}

async function resetPasswordHandler(req, res, next) {
  try {
    await resetPassword(req.body);
    return res.status(200).json({
      success: true,
      data: { message: "Password reset successful" },
    });
  } catch (err) {
    return next(err);
  }
}

async function me(req, res, next) {
  try {
    const user = await getMe(req.user.userId);
    return res.status(200).json({ success: true, data: user });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  forgotPasswordHandler,
  resetPasswordHandler,
  me,
};
