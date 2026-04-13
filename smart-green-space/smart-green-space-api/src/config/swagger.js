const swaggerJSDoc = require("swagger-jsdoc");
const { env } = require("./env");

function buildOpenApiSpec() {
  return swaggerJSDoc({
    definition: {
      openapi: "3.0.0",
      info: {
        title: "Smart Green Space API",
        version: "1.0.0",
        description:
          "Urban ecosystem intelligence API with real-time sensor streams, alerts, and AI processing.",
      },
      servers: [{ url: "/" }],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
    },
    apis: [
      "./src/routes/**/*.js",
      "./src/controllers/**/*.js",
    ],
  });
}

module.exports = { buildOpenApiSpec, swaggerEnabled: env.SWAGGER_ENABLED };

