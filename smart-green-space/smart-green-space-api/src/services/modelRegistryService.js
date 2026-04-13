const { prisma } = require("../config/prisma");

/**
 * Register a new model version in the platform's registry.
 */
async function registerModel({ modelName, version, filePath, accuracy, userId, metadata }) {
  return prisma.modelRegistry.create({
    data: {
      modelName,
      version,
      filePath,
      accuracy,
      registeredBy: userId,
      trainingMetadata: metadata || {},
    },
  });
}

/**
 * Retrieve the current production model path for a given model identity.
 */
async function getProductionModelPath(modelName) {
  const model = await prisma.modelRegistry.findFirst({
    where: { modelName, isProduction: true },
    orderBy: { createdAt: "desc" },
  });
  return model?.filePath || null;
}

/**
 * Promote a specific model version to production.
 */
async function promoteToProduction(modelId) {
  const model = await prisma.modelRegistry.findUnique({ where: { id: modelId } });
  if (!model) throw new Error("Model not found");

  // Atomic update: demote others of same name, promote this one
  await prisma.$transaction([
    prisma.modelRegistry.updateMany({
      where: { modelName: model.modelName, isProduction: true },
      data: { isProduction: false },
    }),
    prisma.modelRegistry.update({
      where: { id: modelId },
      data: { isProduction: true },
    }),
  ]);

  return true;
}

module.exports = {
  registerModel,
  getProductionModelPath,
  promoteToProduction,
};
