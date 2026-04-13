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

function areaKm2FromRadiusDeg(radiusDeg, lat) {
  const metersPerDegLat = 111320;
  const metersPerDegLng = 111320 * Math.cos((lat * Math.PI) / 180);
  const avgMetersPerDeg = (metersPerDegLat + metersPerDegLng) / 2;
  const rMeters = radiusDeg * avgMetersPerDeg;
  const area = Math.PI * rMeters * rMeters;
  return `${(area / 1_000_000).toFixed(2)} km²`;
}

const ZONES = [
  {
    id: "yamuna-civil-lines",
    name: "Yamuna Floodplain Civil Lines",
    center: [77.228, 28.682],
    radius: 0.009,
    riskScore: 88,
    population: "380K",
    cause: "Yamuna floodplain overflow and drainage congestion",
    ndvi: 0.31,
    elevation: 208,
  },
  {
    id: "mayur-vihar-phase-1",
    name: "Mayur Vihar Phase 1",
    center: [77.296, 28.607],
    radius: 0.007,
    riskScore: 82,
    population: "210K",
    cause: "Backflow from drains and low-lying streets",
    ndvi: 0.36,
    elevation: 205,
  },
  {
    id: "loni-road-shahdara",
    name: "Loni Road Shahdara",
    center: [77.298, 28.673],
    radius: 0.008,
    riskScore: 85,
    population: "290K",
    cause: "Dense built-up runoff and channel choke points",
    ndvi: 0.28,
    elevation: 206,
  },
  {
    id: "okhla-jasola",
    name: "Okhla Jasola",
    center: [77.292, 28.548],
    radius: 0.007,
    riskScore: 78,
    population: "175K",
    cause: "Floodplain adjacency and stormwater bottlenecks",
    ndvi: 0.34,
    elevation: 203,
  },
  {
    id: "wazirabad-barrage",
    name: "Wazirabad Barrage",
    center: [77.237, 28.727],
    radius: 0.006,
    riskScore: 91,
    population: "95K",
    cause: "Barrage release surges and embankment pressure",
    ndvi: 0.29,
    elevation: 207,
  },
  {
    id: "geeta-colony",
    name: "Geeta Colony",
    center: [77.274, 28.649],
    radius: 0.007,
    riskScore: 76,
    population: "160K",
    cause: "Internal waterlogging and overloaded drains",
    ndvi: 0.33,
    elevation: 206,
  },
  {
    id: "dwarka-sector-23",
    name: "Dwarka Sector 23",
    center: [77.023, 28.545],
    radius: 0.007,
    riskScore: 62,
    population: "220K",
    cause: "Localized ponding during heavy bursts",
    ndvi: 0.42,
    elevation: 221,
  },
  {
    id: "rohini-sector-18",
    name: "Rohini Sector 18",
    center: [77.089, 28.738],
    radius: 0.007,
    riskScore: 58,
    population: "280K",
    cause: "Surface runoff concentration in flat sectors",
    ndvi: 0.44,
    elevation: 224,
  },
  {
    id: "patparganj",
    name: "Patparganj",
    center: [77.308, 28.627],
    radius: 0.006,
    riskScore: 73,
    population: "120K",
    cause: "Drainage stress and high impervious cover",
    ndvi: 0.35,
    elevation: 206,
  },
  {
    id: "badarpur",
    name: "Badarpur",
    center: [77.287, 28.506],
    radius: 0.006,
    riskScore: 67,
    population: "145K",
    cause: "Low-lying edges and drain backwater effect",
    ndvi: 0.38,
    elevation: 204,
  },
  {
    id: "lodhi-garden",
    name: "Lodhi Garden",
    center: [77.22, 28.59],
    radius: 0.005,
    riskScore: 22,
    population: "40K",
    cause: "Localized puddling only under intense bursts",
    ndvi: 0.56,
    elevation: 214,
  },
  {
    id: "sanjay-van",
    name: "Sanjay Van",
    center: [77.186, 28.527],
    radius: 0.005,
    riskScore: 18,
    population: "30K",
    cause: "High infiltration and canopy buffering",
    ndvi: 0.61,
    elevation: 219,
  },
];

export const floodZones = {
  type: "FeatureCollection",
  features: ZONES.map((zone) => {
    const [lng, lat] = zone.center;
    return {
      type: "Feature",
      id: zone.id,
      properties: {
        id: zone.id,
        name: zone.name,
        riskScore: zone.riskScore,
        baseRisk: zone.riskScore,
        population: zone.population,
        area: areaKm2FromRadiusDeg(zone.radius, lat),
        cause: zone.cause,
        ndvi: zone.ndvi,
        elevation: zone.elevation,
      },
      geometry: {
        type: "Polygon",
        coordinates: circlePolygon([lng, lat], zone.radius, 16),
      },
    };
  }),
};

