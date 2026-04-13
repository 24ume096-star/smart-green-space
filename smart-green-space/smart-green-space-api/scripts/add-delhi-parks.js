const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const delhiParks = [
  {
    name: "Lodhi Garden",
    area: 36.0,
    lat: 28.5933,
    lng: 77.2197,
    establishedYear: 1936,
    type: "GARDEN",
  },
  {
    name: "Nehru Park Delhi",
    area: 32.0,
    lat: 28.6006,
    lng: 77.1902,
    establishedYear: 1969,
    type: "URBAN_PARK",
  },
  {
    name: "Sunder Nursery",
    area: 36.4,
    lat: 28.5931,
    lng: 77.2461,
    establishedYear: 2018,
    type: "GARDEN",
  },
  {
    name: "Deer Park Hauz Khas",
    area: 24.0,
    lat: 28.5534,
    lng: 77.2001,
    establishedYear: 1960,
    type: "URBAN_PARK",
  },
  {
    name: "Garden of Five Senses",
    area: 20.0,
    lat: 28.5133,
    lng: 77.2349,
    establishedYear: 2003,
    type: "GARDEN",
  },
  {
    name: "Millennium Park Delhi",
    area: 16.0,
    lat: 28.6135,
    lng: 77.2476,
    establishedYear: 2004,
    type: "URBAN_PARK",
  },
];

async function main() {
  const city = await prisma.city.upsert({
    where: {
      id: "delhi-city",
    },
    update: {
      name: "Delhi",
      state: "Delhi",
      country: "India",
      lat: 28.6139,
      lng: 77.209,
      timezone: "Asia/Kolkata",
      subscriptionPlan: "PRO",
      subscriptionStatus: "ACTIVE",
    },
    create: {
      id: "delhi-city",
      name: "Delhi",
      state: "Delhi",
      country: "India",
      lat: 28.6139,
      lng: 77.209,
      timezone: "Asia/Kolkata",
      subscriptionPlan: "PRO",
      subscriptionStatus: "ACTIVE",
    },
  });

  const created = [];
  for (const park of delhiParks) {
    const row = await prisma.park.upsert({
      where: {
        id: `delhi-${park.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      },
      update: {
        cityId: city.id,
        area: park.area,
        lat: park.lat,
        lng: park.lng,
        establishedYear: park.establishedYear,
        type: park.type,
        isActive: true,
      },
      create: {
        id: `delhi-${park.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        cityId: city.id,
        name: park.name,
        area: park.area,
        lat: park.lat,
        lng: park.lng,
        geoJsonBoundary: { type: "Polygon", coordinates: [] },
        establishedYear: park.establishedYear,
        type: park.type,
        isActive: true,
      },
      select: { id: true, name: true, type: true },
    });
    created.push(row);
  }

  console.log(
    JSON.stringify(
      {
        city: { id: city.id, name: city.name },
        parksInsertedOrUpdated: created.length,
        parks: created,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
