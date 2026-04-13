import { useEffect, useMemo, useState } from "react";
import L, { type LatLngTuple } from "leaflet";
import {
  FeatureGroup,
  LayersControl,
  MapContainer,
  Marker,
  Polygon,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";

type Park = {
  id: string;
  name: string;
  gshi: number;
  alerts: number;
  updated: string;
  position: LatLngTuple;
};

type NdviRasterZone = {
  id: string;
  parkName: string;
  latestNdvi: number;
  position: LatLngTuple;
  polygon: LatLngTuple[];
  sourceFiles: string[];
};

const DELHI_CENTER: LatLngTuple = [28.6139, 77.209];

const FALLBACK_PARKS: Park[] = [
  { id: "deer", name: "Deer Park Hauz Khas", gshi: 26.59, alerts: 0, updated: "recent", position: [28.5534, 77.2001] },
  { id: "garden", name: "Garden of Five Senses", gshi: 22.62, alerts: 0, updated: "recent", position: [28.5133, 77.2349] },
  { id: "lodhi", name: "Lodhi Garden", gshi: 26.38, alerts: 0, updated: "recent", position: [28.5933, 77.2197] },
  { id: "nehru", name: "Nehru Park Delhi", gshi: 26.09, alerts: 0, updated: "recent", position: [28.6006, 77.1902] },
  { id: "millennium", name: "Millennium Park Delhi", gshi: 7, alerts: 0, updated: "recent", position: [28.6135, 77.2476] },
  { id: "sunder", name: "Sunder Nursery", gshi: 7, alerts: 0, updated: "recent", position: [28.5931, 77.2461] },
];

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:8080";

const NDVI_RASTER_ZONES: NdviRasterZone[] = [
  {
    id: "aid0003",
    parkName: "Deer Park Hauz Khas",
    latestNdvi: 0.5669,
    position: [28.5534, 77.2001],
    polygon: [
      [28.562, 77.188],
      [28.561, 77.209],
      [28.546, 77.212],
      [28.545, 77.191],
    ],
    sourceFiles: [
      "MOD13Q1.061__250m_16_days_NDVI_doy2026017000000_aid0003.tif",
      "MOD13Q1.061__250m_16_days_NDVI_doy2026033000000_aid0003.tif",
      "MOD13Q1.061__250m_16_days_NDVI_doy2026049000000_aid0003.tif",
      "MOD13Q1.061__250m_16_days_NDVI_doy2026065000000_aid0003.tif",
      "MOD13Q1.061__250m_16_days_NDVI_doy2026081000000_aid0003.tif",
    ],
  },
  {
    id: "aid0004",
    parkName: "Garden of Five Senses",
    latestNdvi: 0.2498,
    position: [28.5133, 77.2349],
    polygon: [
      [28.521, 77.224],
      [28.521, 77.243],
      [28.506, 77.245],
      [28.506, 77.226],
    ],
    sourceFiles: [
      "MOD13Q1.061__250m_16_days_NDVI_doy2026017000000_aid0004.tif",
      "MOD13Q1.061__250m_16_days_NDVI_doy2026033000000_aid0004.tif",
      "MOD13Q1.061__250m_16_days_NDVI_doy2026049000000_aid0004.tif",
      "MOD13Q1.061__250m_16_days_NDVI_doy2026065000000_aid0004.tif",
      "MOD13Q1.061__250m_16_days_NDVI_doy2026081000000_aid0004.tif",
    ],
  },
];

function parseDoyToDateLabel(token: string) {
  const m = token.match(/^(\d{4})(\d{3})/);
  if (!m) return token;
  const year = Number(m[1]);
  const day = Number(m[2]);
  const dt = new Date(Date.UTC(year, 0, 1));
  dt.setUTCDate(day);
  return dt.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

function sceneDateFromName(name: string) {
  const m = name.match(/doy(\d{7})/i);
  if (!m) return "Unknown date";
  return parseDoyToDateLabel(m[1]);
}

function getParkColor(score: number) {
  if (score > 25) return "#22C55E";
  if (score >= 15) return "#FACC15";
  return "#EF4444";
}

function getParkIcon(score: number) {
  const color = getParkColor(score);
  return L.divIcon({
    className: "park-marker-icon",
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10],
    html: `<span style="display:block;width:20px;height:20px;border-radius:9999px;background:${color};border:2px solid rgba(15,27,18,0.9);box-shadow:0 0 0 2px rgba(255,255,255,0.2),0 0 14px ${color};"></span>`,
  });
}

function getNdviHeatColor(ndvi: number) {
  if (ndvi >= 0.55) return { stroke: "#15803D", fill: "#22C55E", opacity: 0.72 };
  if (ndvi >= 0.45) return { stroke: "#4D7C0F", fill: "#84CC16", opacity: 0.68 };
  if (ndvi >= 0.3) return { stroke: "#A16207", fill: "#EAB308", opacity: 0.66 };
  return { stroke: "#B91C1C", fill: "#EF4444", opacity: 0.68 };
}

function MapAutoFocus({
  selectedZoneId,
  zones,
}: {
  selectedZoneId: string | null;
  zones: NdviRasterZone[];
}) {
  const map = useMap();

  useEffect(() => {
    if (!selectedZoneId) return;
    const zone = zones.find((z) => z.id === selectedZoneId);
    if (!zone) return;
    map.fitBounds(zone.polygon, { padding: [40, 40], maxZoom: 15 });
  }, [map, selectedZoneId, zones]);

  return null;
}

function getAlertPulseIcon() {
  return L.divIcon({
    className: "park-alert-pulse-icon",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    html: `<span class="sgs-alert-pulse"><span class="sgs-alert-pulse-core"></span></span>`,
  });
}

export function GISMapPanel({ city }: { city: string }) {
  const [query, setQuery] = useState("");
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedSceneFile, setSelectedSceneFile] = useState<string | null>(null);
  const [parks, setParks] = useState<Park[]>(FALLBACK_PARKS);
  const normalized = query.trim().toLowerCase();
  const visibleParks = useMemo(() => parks.filter((p) => p.name.toLowerCase().includes(normalized)), [normalized, parks]);
  const pulseIcon = useMemo(() => getAlertPulseIcon(), []);
  const selectedSceneDate = selectedSceneFile ? sceneDateFromName(selectedSceneFile) : null;

  useEffect(() => {
    let mounted = true;

    async function loadLiveParks() {
      try {
        const resp = await fetch(`${API_BASE}/api/v1/parks?cityId=delhi-city&limit=100`);
        if (!resp.ok) return;
        const json = await resp.json();
        const items = json?.data?.items;
        if (!Array.isArray(items) || items.length === 0) return;

        const mapped: Park[] = items
          .filter((p) => typeof p?.lat === "number" && typeof p?.lng === "number")
          .map((p) => ({
            id: p.id,
            name: p.name,
            gshi: Number(p?.latestGshi?.overallScore ?? 0),
            alerts: 0,
            updated: "live",
            position: [Number(p.lat), Number(p.lng)] as LatLngTuple,
          }));

        if (mounted && mapped.length > 0) {
          setParks(mapped);
        }
      } catch {
        // Keep fallback parks on API/network failures.
      }
    }

    loadLiveParks();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section className="relative overflow-hidden rounded-xl border border-white/[0.07] bg-canopy/80 shadow-card">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[401] h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" />

      <div className="relative h-[calc(100vh-170px)] min-h-[560px] w-full">
        <MapContainer center={DELHI_CENTER} zoom={12} scrollWheelZoom className="h-full w-full z-10">
          <MapAutoFocus selectedZoneId={selectedZoneId} zones={NDVI_RASTER_ZONES} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <LayersControl position="topright">
            <LayersControl.Overlay checked name="NDVI Raster Heatmap (Real Data)">
              <FeatureGroup>
                {NDVI_RASTER_ZONES.map((zone) => {
                  const style = getNdviHeatColor(zone.latestNdvi);
                  const isSelected = selectedZoneId === zone.id;
                  if (selectedZoneId && !isSelected) return null;
                  return (
                  <Polygon
                    key={`ndvi-${zone.id}`}
                    positions={zone.polygon}
                    pathOptions={{
                      color: isSelected ? "#38BDF8" : style.stroke,
                      fillColor: isSelected ? "#38BDF8" : style.fill,
                      fillOpacity: isSelected ? 0.52 : style.opacity,
                      weight: isSelected ? 2.5 : 1.5,
                    }}
                  >
                    <Popup>
                      <div className="min-w-[280px] text-[#0F1B12]">
                        <p className="text-sm font-semibold">{zone.parkName}</p>
                        <p className="mt-1 text-xs">
                          <strong>Latest NDVI:</strong> {zone.latestNdvi.toFixed(4)}
                        </p>
                        <p className="mt-2 text-xs font-semibold">Source NDVI rasters</p>
                        <ul className="mt-1 list-disc pl-4 text-[11px]">
                          {zone.sourceFiles.slice(0, 3).map((f) => (
                            <li key={f}>{f}</li>
                          ))}
                        </ul>
                        <p className="mt-1 text-[11px] text-black/65">
                          +{zone.sourceFiles.length - 3} more scenes in `image/`
                        </p>
                      </div>
                    </Popup>
                  </Polygon>
                  );
                })}
              </FeatureGroup>
            </LayersControl.Overlay>
          </LayersControl>

          {visibleParks.map((park) => (
            <Marker key={park.id} position={park.position} icon={getParkIcon(park.gshi)}>
              <Popup>
                <div className="min-w-[220px] text-[#0F1B12]">
                  <p className="text-sm font-semibold">{park.name}</p>
                  <div className="mt-2 space-y-1 text-xs">
                    <p>
                      <strong>GSHI Score:</strong> {park.gshi}
                    </p>
                    <p>
                      <strong>Active Alerts:</strong> {park.alerts}
                    </p>
                    <p>
                      <strong>Last Updated:</strong> {park.updated}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="mt-3 w-full rounded-md bg-[#2ECC71] px-3 py-1.5 text-xs font-semibold text-[#0F1B12] transition hover:brightness-95"
                  >
                    View Details
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}

          {visibleParks
            .filter((park) => park.alerts > 0)
            .map((park) => (
              <Marker key={`${park.id}-pulse`} position={park.position} icon={pulseIcon} interactive={false} />
            ))}
        </MapContainer>

        <div className="absolute left-4 top-4 z-[500] w-[320px] rounded-lg border border-white/10 bg-[#0F1B12]/92 p-3 shadow-card backdrop-blur">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent/90">{city}</p>
          <h3 className="mt-1 font-display text-base font-semibold text-white">Live Map / GIS</h3>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search parks..."
            className="mt-3 h-10 w-full rounded-lg border border-white/10 bg-canopy/70 px-3 text-sm text-white outline-none ring-0 placeholder:text-white/35 focus:border-accent/50 focus:ring-2 focus:ring-accent/20"
          />
          <p className="mt-2 text-xs text-white/50">{visibleParks.length} parks matched</p>
        </div>

        <div className="absolute bottom-4 left-4 z-[500] rounded-lg border border-white/10 bg-[#0F1B12]/92 p-3 shadow-card backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/70">Real Data Legend</p>
          <div className="mt-2 space-y-1.5 text-xs text-white/80">
            <p className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#22C55E]" /> Dense Green = NDVI &gt;= 0.55
            </p>
            <p className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#EAB308]" /> Dense Yellow = NDVI 0.30-0.54
            </p>
            <p className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#EF4444]" /> Dense Red = NDVI &lt; 0.30
            </p>
          </div>
        </div>

        <div className="absolute bottom-4 left-1/2 z-[500] flex -translate-x-1/2 items-center gap-4 rounded-full border border-white/10 bg-[#0F1B12]/92 px-5 py-2 text-sm text-white/85 shadow-card backdrop-blur">
          <span className="font-medium">{parks.length} Parks</span>
          <span className="text-white/30">•</span>
          <span className="font-medium text-red-300">0 Alerts</span>
          <span className="text-white/30">•</span>
          <span className="font-medium text-orange-300">{NDVI_RASTER_ZONES.length} NDVI Raster Zones</span>
          {selectedSceneDate ? (
            <>
              <span className="text-white/30">•</span>
              <span className="font-medium text-sky-300">Date Filter: {selectedSceneDate}</span>
            </>
          ) : null}
        </div>
      </div>

      <div className="border-t border-white/10 bg-[#0F1B12]/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent/90">
              NDVI Raster Gallery
            </p>
            <h3 className="mt-1 font-display text-base font-semibold text-white">
              Uploaded TIFF scenes grouped by park
            </h3>
          </div>
          <span className="text-xs text-white/60">Source folder: `image/`</span>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          {NDVI_RASTER_ZONES.map((zone) => (
            <div
              key={`gallery-${zone.id}`}
              className="rounded-lg border border-white/10 bg-forest/70 p-3 shadow-card"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-white">{zone.parkName}</p>
                <span className="rounded-full border border-white/15 bg-white/[0.04] px-2 py-0.5 text-[11px] text-white/70">
                  NDVI {zone.latestNdvi.toFixed(4)}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-white/55">{zone.sourceFiles.length} scenes</p>
              <div className="mt-2 max-h-36 overflow-y-auto pr-1">
                <ul className="space-y-1 text-[11px] text-white/75">
                  {zone.sourceFiles.map((file) => (
                    <li key={file}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedZoneId(zone.id);
                          setSelectedSceneFile(file);
                        }}
                        className={[
                          "w-full rounded border px-2 py-1 text-left transition",
                          selectedSceneFile === file
                            ? "border-sky-400/50 bg-sky-500/15"
                            : "border-white/10 bg-black/20 hover:border-accent/35",
                        ].join(" ")}
                      >
                        <span className="font-medium text-accent">{sceneDateFromName(file)}</span>
                        <span className="mx-1 text-white/40">-</span>
                        <span className="break-all">{file}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedZoneId(zone.id);
                    setSelectedSceneFile(zone.sourceFiles[zone.sourceFiles.length - 1] || null);
                  }}
                  className="rounded border border-accent/30 bg-accent/10 px-2 py-1 text-[11px] text-accent"
                >
                  Focus Park
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedZoneId(null);
                    setSelectedSceneFile(null);
                  }}
                  className="rounded border border-white/15 bg-white/[0.04] px-2 py-1 text-[11px] text-white/75"
                >
                  Clear Filter
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
