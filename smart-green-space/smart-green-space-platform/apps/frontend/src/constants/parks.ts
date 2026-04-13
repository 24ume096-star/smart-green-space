export type SubIndex = {
  key: string;
  label: string;
  emoji: string;
  value: number;
  trend: "up" | "down" | "flat";
};

export type ParkConfig = {
  id: string;
  apiId: string;
  name: string;
  cityLabel: string;
  overall: number;
  center: [number, number];
  subIndices: SubIndex[];
};

export const MASTER_PARKS: ParkConfig[] = [
  {
    id: "deer",
    apiId: "delhi-deer-park-hauz-khas",
    name: "Deer Park Hauz Khas",
    cityLabel: "South Delhi",
    overall: 26.59,
    center: [28.5494, 77.2001],
    subIndices: [
      { key: "vegetation", label: "Vegetation Health (NDVI)", emoji: "🌱", value: 78.34, trend: "up" },
      { key: "thermal", label: "Thermal Comfort Index", emoji: "🌡️", value: 0, trend: "flat" },
      { key: "water", label: "Water Resilience Score", emoji: "💧", value: 0, trend: "flat" },
      { key: "biodiversity", label: "Biodiversity Index", emoji: "🌿", value: 0, trend: "flat" },
      { key: "airQuality", label: "Air Quality (PM2.5)", emoji: "💨", value: 0, trend: "flat" },
      { key: "infra", label: "Infrastructure Health", emoji: "🏗️", value: 70, trend: "flat" },
      { key: "tree", label: "Tree Health Score (CV)", emoji: "📷", value: 0, trend: "flat" },
    ],
  },
  {
    id: "lodhi",
    apiId: "delhi-lodhi-garden",
    name: "Lodhi Garden",
    cityLabel: "New Delhi",
    overall: 26.38,
    center: [28.5920, 77.2197],
    subIndices: [
      { key: "vegetation", label: "Vegetation Health (NDVI)", emoji: "🌱", value: 77.52, trend: "up" },
      { key: "thermal", label: "Thermal Comfort Index", emoji: "🌡️", value: 0, trend: "flat" },
      { key: "water", label: "Water Resilience Score", emoji: "💧", value: 0, trend: "flat" },
      { key: "biodiversity", label: "Biodiversity Index", emoji: "🌿", value: 0, trend: "flat" },
      { key: "airQuality", label: "Air Quality (PM2.5)", emoji: "💨", value: 0, trend: "flat" },
      { key: "infra", label: "Infrastructure Health", emoji: "🏗️", value: 70, trend: "flat" },
      { key: "tree", label: "Tree Health Score (CV)", emoji: "📷", value: 0, trend: "flat" },
    ],
  },
  {
    id: "nehru",
    apiId: "delhi-nehru-park-delhi",
    name: "Nehru Park Delhi",
    cityLabel: "Chanakyapuri",
    overall: 26.09,
    center: [28.5979, 77.1836],
    subIndices: [
      { key: "vegetation", label: "Vegetation Health (NDVI)", emoji: "🌱", value: 76.38, trend: "up" },
      { key: "thermal", label: "Thermal Comfort Index", emoji: "🌡️", value: 0, trend: "flat" },
      { key: "water", label: "Water Resilience Score", emoji: "💧", value: 0, trend: "flat" },
      { key: "biodiversity", label: "Biodiversity Index", emoji: "🌿", value: 0, trend: "flat" },
      { key: "airQuality", label: "Air Quality (PM2.5)", emoji: "💨", value: 0, trend: "flat" },
      { key: "infra", label: "Infrastructure Health", emoji: "🏗️", value: 70, trend: "flat" },
      { key: "tree", label: "Tree Health Score (CV)", emoji: "📷", value: 0, trend: "flat" },
    ],
  },
  {
    id: "sunder",
    apiId: "delhi-sunder-nursery",
    name: "Sunder Nursery",
    cityLabel: "New Delhi",
    overall: 7.0,
    center: [28.5934, 77.2437],
    subIndices: [
      { key: "vegetation", label: "Vegetation Health (NDVI)", emoji: "🌱", value: 0, trend: "flat" },
      { key: "thermal", label: "Thermal Comfort Index", emoji: "🌡️", value: 0, trend: "flat" },
      { key: "water", label: "Water Resilience Score", emoji: "💧", value: 0, trend: "flat" },
      { key: "biodiversity", label: "Biodiversity Index", emoji: "🌿", value: 0, trend: "flat" },
      { key: "airQuality", label: "Air Quality (PM2.5)", emoji: "💨", value: 0, trend: "flat" },
      { key: "infra", label: "Infrastructure Health", emoji: "🏗️", value: 70, trend: "flat" },
      { key: "tree", label: "Tree Health Score (CV)", emoji: "📷", value: 0, trend: "flat" },
    ],
  },
  {
    id: "garden",
    apiId: "delhi-garden-of-five-senses",
    name: "Garden of Five Senses",
    cityLabel: "South Delhi",
    overall: 22.62,
    center: [28.5104, 77.1869],
    subIndices: [
      { key: "vegetation", label: "Vegetation Health (NDVI)", emoji: "🌱", value: 62.49, trend: "down" },
      { key: "thermal", label: "Thermal Comfort Index", emoji: "🌡️", value: 0, trend: "flat" },
      { key: "water", label: "Water Resilience Score", emoji: "💧", value: 0, trend: "flat" },
      { key: "biodiversity", label: "Biodiversity Index", emoji: "🌿", value: 0, trend: "flat" },
      { key: "airQuality", label: "Air Quality (PM2.5)", emoji: "💨", value: 0, trend: "flat" },
      { key: "infra", label: "Infrastructure Health", emoji: "🏗️", value: 70, trend: "flat" },
      { key: "tree", label: "Tree Health Score (CV)", emoji: "📷", value: 0, trend: "flat" },
    ],
  },
  {
    id: "millennium",
    apiId: "delhi-millennium-park-delhi",
    name: "Millennium Park Delhi",
    cityLabel: "East Delhi",
    overall: 7.0,
    center: [28.6418, 77.2466],
    subIndices: [
      { key: "vegetation", label: "Vegetation Health (NDVI)", emoji: "🌱", value: 0, trend: "flat" },
      { key: "thermal", label: "Thermal Comfort Index", emoji: "🌡️", value: 0, trend: "flat" },
      { key: "water", label: "Water Resilience Score", emoji: "💧", value: 0, trend: "flat" },
      { key: "biodiversity", label: "Biodiversity Index", emoji: "🌿", value: 0, trend: "flat" },
      { key: "airQuality", label: "Air Quality (PM2.5)", emoji: "💨", value: 0, trend: "flat" },
      { key: "infra", label: "Infrastructure Health", emoji: "🏗️", value: 70, trend: "flat" },
      { key: "tree", label: "Tree Health Score (CV)", emoji: "📷", value: 0, trend: "flat" },
    ],
  }
];

export const PARK_NAMES = MASTER_PARKS.map(p => p.name);
