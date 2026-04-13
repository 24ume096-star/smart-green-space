const { z } = require("zod");

const parkIdParamSchema = z.object({ parkId: z.string().min(1) });
const simulationIdParamSchema = z.object({ simulationId: z.string().min(1) });

const runSimulationBodySchema = z.object({
  scenario: z.enum(["FLOOD", "HEAT_WAVE", "TREE_GROWTH", "DROUGHT"]),
  parameters: z.record(z.any()).default({}),
});

module.exports = {
  parkIdParamSchema,
  simulationIdParamSchema,
  runSimulationBodySchema,
};

