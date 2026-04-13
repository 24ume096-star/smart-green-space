const { PrismaClient } = require("@prisma/client");
const { calculateGshi } = require("../src/services/gshiService");

const prisma = new PrismaClient();

async function main() {
  const parks = await prisma.park.findMany({
    where: { cityId: "delhi-city", isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const output = [];
  for (const park of parks) {
    const result = await calculateGshi(park.id, {
      infrastructureScore: 70,
      prismaClient: prisma,
    });
    output.push({
      parkId: park.id,
      parkName: park.name,
      overallScore: result.overallScore,
      vegetationScore: result.vegetationScore,
      ndviValue: result.ndviValue,
      alertCreated: Boolean(result.alertCreated),
    });
  }

  console.log(JSON.stringify(output, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
