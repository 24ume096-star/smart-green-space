const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();
  try {
    const parks = await prisma.park.count();
    const satCount = await prisma.satelliteImage.count();
    const latest = await prisma.satelliteImage.findMany({
      take: 10,
      orderBy: { capturedAt: "desc" },
      select: {
        id: true,
        parkId: true,
        source: true,
        capturedAt: true,
        ndviMean: true,
        ndviMin: true,
        ndviMax: true,
      },
    });
    console.log(JSON.stringify({ parks, satCount, latest }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
