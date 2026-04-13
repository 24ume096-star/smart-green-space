function notFound() {
  return (req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Route not found",
        details: { path: req.originalUrl },
      },
    });
  };
}

module.exports = { notFound };

