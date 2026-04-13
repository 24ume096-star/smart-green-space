function validate(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request body",
          details: parsed.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
      });
    }

    req.body = parsed.data;
    return next();
  };
}

function validateRequest({ body, query, params }) {
  return (req, res, next) => {
    const issues = [];

    if (body) {
      const parsedBody = body.safeParse(req.body);
      if (!parsedBody.success) {
        issues.push(
          ...parsedBody.error.issues.map((i) => ({
            path: `body.${i.path.join(".")}`,
            message: i.message,
          })),
        );
      } else {
        req.body = parsedBody.data;
      }
    }

    if (query) {
      const parsedQuery = query.safeParse(req.query);
      if (!parsedQuery.success) {
        issues.push(
          ...parsedQuery.error.issues.map((i) => ({
            path: `query.${i.path.join(".")}`,
            message: i.message,
          })),
        );
      } else {
        req.query = parsedQuery.data;
      }
    }

    if (params) {
      const parsedParams = params.safeParse(req.params);
      if (!parsedParams.success) {
        issues.push(
          ...parsedParams.error.issues.map((i) => ({
            path: `params.${i.path.join(".")}`,
            message: i.message,
          })),
        );
      } else {
        req.params = parsedParams.data;
      }
    }

    if (issues.length > 0) {
      return res.status(422).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request",
          details: issues,
        },
      });
    }

    return next();
  };
}

module.exports = { validate, validateRequest };
