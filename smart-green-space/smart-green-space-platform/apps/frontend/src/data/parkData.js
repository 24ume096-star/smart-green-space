const TWO_PI = Math.PI * 2;

function circlePolygon([lng, lat], radiusDeg, points = 16) {
  const ring = [];
  for (let i = 0; i < points; i += 1) {
    const theta = (i / points) * TWO_PI;
    ring.push([lng + Math.cos(theta) * radiusDeg, lat + Math.sin(theta) * radiusDeg]);
  }
  ring.push(ring[0]);
  return [ring];
}

const PARKS = [
  { id: "lodhi-garden", name: "Lodhi Garden", center: [77.22, 28.591], radius: 0.004, resilienceScore: 88, ndvi: 0.58 },
  { id: "nehru-park", name: "Nehru Park", center: [77.174, 28.589], radius: 0.003, resilienceScore: 82, ndvi: 0.52 },
  { id: "sanjay-van", name: "Sanjay Van", center: [77.186, 28.527], radius: 0.005, resilienceScore: 91, ndvi: 0.61 },
  { id: "india-gate-lawns", name: "India Gate Lawns", center: [77.229, 28.612], radius: 0.004, resilienceScore: 79, ndvi: 0.52 },
  { id: "deer-park", name: "Deer Park", center: [77.204, 28.563], radius: 0.003, resilienceScore: 85, ndvi: 0.55 },
  { id: "yamuna-biodiversity-park", name: "Yamuna Biodiversity Park", center: [77.152, 28.713], radius: 0.006, resilienceScore: 76, ndvi: 0.48 },
  { id: "aravalli-biodiversity-park", name: "Aravalli Biodiversity Park", center: [77.128, 28.551], radius: 0.007, resilienceScore: 89, ndvi: 0.63 },
  { id: "okhla-bird-sanctuary", name: "Okhla Bird Sanctuary", center: [77.308, 28.528], radius: 0.005, resilienceScore: 84, ndvi: 0.57 },
];

export const parkPolygons = {
  type: "FeatureCollection",
  features: PARKS.map((p) => ({
    type: "Feature",
    id: p.id,
    properties: {
      id: p.id,
      name: p.name,
      resilienceScore: p.resilienceScore,
      ndvi: p.ndvi,
      floodBufferNote: "Reduces peak runoff by ~28%",
    },
    geometry: {
      type: "Polygon",
      coordinates: circlePolygon(p.center, p.radius, 16),
    },
  })),
};

export const parkNdviPoints = {
  type: "FeatureCollection",
  features: PARKS.map((p) => ({
    type: "Feature",
    id: `${p.id}-pt`,
    properties: {
      id: p.id,
      name: p.name,
      ndvi: p.ndvi,
      resilienceScore: p.resilienceScore,
    },
    geometry: {
      type: "Point",
      coordinates: p.center,
    },
  })),
};

