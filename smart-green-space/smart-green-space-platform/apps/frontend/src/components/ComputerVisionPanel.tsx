import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import {
  Activity, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp,
  MapPin, PlayCircle, RefreshCw, ServerCrash, Truck, Video, Volume2, Zap,
} from "lucide-react";
import {
  Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

// ── Types ─────────────────────────────────────────────────────────────────────
type TrafficStatus = "Heavy Flow" | "Moderate" | "Clear";
type DataSource = "tomtom" | "estimated";

type CameraNode = {
  id: string;
  roadName: string;
  lat: number;
  lng: number;
  date: string;
  // TomTom live data
  currentSpeed: number | null;    // km/h
  freeFlowSpeed: number | null;   // km/h
  congestionPct: number;          // 0–100, derived
  confidence: number | null;      // 0–1
  volume: number;                 // alias congestionPct for UI compat
  status: TrafficStatus;
  noiseDb: number;
  source: DataSource;
};

type TrendPoint = { hour: string; value: number };

// ── Constants ─────────────────────────────────────────────────────────────────
const TOMTOM_KEY = import.meta.env.VITE_TOMTOM_API_KEY ?? "";
const TOMTOM_FLOW_URL = (lat: number, lng: number) =>
  `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?key=${TOMTOM_KEY}&point=${lat},${lng}&unit=KMPH`;

// Known Delhi NCR road coordinates to supplement OSM (pre-seeded so we always
// have lat/lng to pass to TomTom even if OSM doesn't return node coords)
const DELHI_ROAD_COORDS: Record<string, [number, number]> = {
  "Mahatma Gandhi Marg":    [28.5921, 77.2072],
  "Aurobindo Marg":         [28.5496, 77.2014],
  "Ring Road":              [28.5700, 77.2100],
  "Lodhi Road":             [28.5844, 77.2248],
  "Mathura Road":           [28.5700, 77.2500],
  "Bhishma Pitamah Marg":  [28.5940, 77.2350],
  "Willingdon Crescent":   [28.6010, 77.1990],
  "Shri Jagannath Marg":   [28.5531, 77.2167],
  "Raj Nagar Flyover":     [28.5781, 77.1950],
  "AIIMS Flyover":         [28.5672, 77.2079],
};

// Fallback: Generated hourly trend for 24h when TomTom not available
function buildFallbackTrend(): TrendPoint[] {
  return [
    { hour: "00:00", value: 12 }, { hour: "02:00", value: 8  },
    { hour: "04:00", value: 6  }, { hour: "06:00", value: 28 },
    { hour: "08:00", value: 87 }, { hour: "09:00", value: 94 },
    { hour: "10:00", value: 72 }, { hour: "12:00", value: 61 },
    { hour: "14:00", value: 55 }, { hour: "16:00", value: 60 },
    { hour: "17:00", value: 88 }, { hour: "18:00", value: 91 },
    { hour: "20:00", value: 58 }, { hour: "22:00", value: 34 },
  ];
}

// Derive TrafficStatus from congestion %
function statusFromCongestion(pct: number): TrafficStatus {
  if (pct >= 70) return "Heavy Flow";
  if (pct >= 35) return "Moderate";
  return "Clear";
}

// Estimate noise from congestion
function noiseFromCongestion(pct: number): number {
  return 38 + pct * 0.38 + Math.random() * 4;
}

// ── Status badge ───────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: TrafficStatus }) {
  if (status === "Heavy Flow") return (
    <span className="inline-flex items-center gap-1 rounded-full border border-red-400/40 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-200">
      <span className="relative inline-flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-red-400 opacity-70" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-red-300 shadow-[0_0_10px_rgba(248,113,113,0.75)]" />
      </span>
      Heavy Flow
    </span>
  );
  if (status === "Moderate") return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
      <Activity className="h-3 w-3" /> Moderate
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200">
      <CheckCircle2 className="h-3 w-3" /> Clear Flow
    </span>
  );
}

// ── Fetch TomTom data for a road coordinate ────────────────────────────────────
async function fetchTomTomFlow(lat: number, lng: number): Promise<{
  currentSpeed: number; freeFlowSpeed: number; confidence: number;
} | null> {
  if (!TOMTOM_KEY || TOMTOM_KEY === "your_tomtom_key_here") return null;
  try {
    const res = await fetch(TOMTOM_FLOW_URL(lat, lng));
    if (!res.ok) return null;
    const data = await res.json();
    const fd = data.flowSegmentData;
    if (!fd) return null;
    return {
      currentSpeed:  fd.currentSpeed  ?? 0,
      freeFlowSpeed: fd.freeFlowSpeed ?? fd.currentSpeed ?? 50,
      confidence:    fd.confidence    ?? 0.8,
    };
  } catch {
    return null;
  }
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function ComputerVisionPanel() {
  const [statusFilter, setStatusFilter]     = useState<TrafficStatus | "All">("All");
  const [locationFilter, setLocationFilter] = useState("All");
  const [dateFilterOpen, setDateFilterOpen] = useState(false);
  const [selectedId, setSelectedId]         = useState<string>("");
  const [cameras, setCameras]               = useState<CameraNode[]>([]);
  const [loading, setLoading]               = useState(true);
  const [dataSource, setDataSource]         = useState<DataSource>("estimated");
  const [lastUpdated, setLastUpdated]       = useState<string | null>(null);
  const [trend, setTrend]                   = useState<TrendPoint[]>(buildFallbackTrend());
  const refreshRef                          = useRef<number | null>(null);

  // ── Fetch OSM roads → enrich with TomTom live speeds ──────────────────────
  const fetchTrafficData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch real road names from OpenStreetMap Overpass
      const query = `[out:json];way(around:2000,28.58,77.21)[highway~"^(primary|secondary|tertiary)$"];out tags center;`;
      const osmRes = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
      const osmData = await osmRes.json();

      const uniqueRoads = new Map<string, { lat: number; lng: number }>();
      if (osmData.elements) {
        for (const el of osmData.elements) {
          const name = el.tags?.name;
          if (!name || uniqueRoads.has(name)) continue;
          // OSM way center gives us lat/lng if `-out center` is used
          const lat = el.center?.lat ?? DELHI_ROAD_COORDS[name]?.[0];
          const lng = el.center?.lon ?? DELHI_ROAD_COORDS[name]?.[1];
          if (lat && lng) uniqueRoads.set(name, { lat, lng });
        }
      }

      // Fallback to pre-seeded coords if OSM returned nothing
      if (uniqueRoads.size === 0) {
        Object.entries(DELHI_ROAD_COORDS).forEach(([name, [lat, lng]]) =>
          uniqueRoads.set(name, { lat, lng })
        );
      }

      // 2. Take first 8 roads and call TomTom for each
      const roadEntries = [...uniqueRoads.entries()].slice(0, 8);
      let anyLive = false;

      const nodes: CameraNode[] = await Promise.all(
        roadEntries.map(async ([name, { lat, lng }], _idx) => {
          const tomtom = await fetchTomTomFlow(lat, lng);

          let congestionPct: number;
          let currentSpeed: number | null = null;
          let freeFlowSpeed: number | null = null;
          let confidence: number | null = null;
          let source: DataSource = "estimated";

          if (tomtom) {
            // Real data: congestion = reduction in speed vs free-flow
            currentSpeed  = tomtom.currentSpeed;
            freeFlowSpeed = tomtom.freeFlowSpeed;
            confidence    = tomtom.confidence;
            congestionPct = Math.round(Math.max(0, Math.min(100,
              (1 - tomtom.currentSpeed / Math.max(tomtom.freeFlowSpeed, 1)) * 100
            )));
            source   = "tomtom";
            anyLive  = true;
          } else {
            // Fallback: time-of-day model
            const hour = new Date().getHours();
            const isRushHour = (hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 19);
            congestionPct = isRushHour
              ? Math.round(60 + Math.random() * 35)
              : Math.round(15 + Math.random() * 45);
          }

          return {
            id: `CAM-${String(name).replace(/[^a-zA-Z0-9]/g, "").substring(0, 8).toUpperCase()}`,
            roadName: name,
            lat, lng,
            date: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            currentSpeed,
            freeFlowSpeed,
            congestionPct,
            confidence,
            volume: congestionPct,
            status: statusFromCongestion(congestionPct),
            noiseDb: noiseFromCongestion(congestionPct),
            source,
          };
        })
      );

      setCameras(nodes);
      setDataSource(anyLive ? "tomtom" : "estimated");
      setLastUpdated(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      // Preserve selection across refreshes — set default only if nothing is selected yet
      setSelectedId((prev) => {
        if (prev && nodes.some((n) => n.id === prev)) return prev; // already valid
        return nodes[0]?.id ?? "";
      });

      // 3. Build live trend from current congestions if we have TomTom data
      if (anyLive) {
        const avgNow = Math.round(nodes.reduce((s, c) => s + c.congestionPct, 0) / nodes.length);
        const hour   = new Date().getHours();
        const hourStr = `${String(hour).padStart(2,"0")}:00`;
        setTrend((prev) => {
          const updated = [...prev];
          const existing = updated.findIndex((p) => p.hour === hourStr);
          if (existing >= 0) updated[existing] = { hour: hourStr, value: avgNow };
          else updated.push({ hour: hourStr, value: avgNow });
          return updated.sort((a, b) => a.hour.localeCompare(b.hour));
        });
      }
    } catch (err) {
      console.error("Traffic fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []); // no selectedId dep — selection changes must NOT re-trigger API fetches

  // Initial fetch + 60s refresh
  useEffect(() => {
    fetchTrafficData();
    refreshRef.current = window.setInterval(fetchTrafficData, 60_000);
    return () => clearInterval(refreshRef.current!);
  }, []);

  const locations = useMemo(() => cameras.map((c) => c.roadName), [cameras]);
  const selected  = useMemo(
    () => cameras.find((c) => c.id === selectedId) ?? cameras[0] ?? null,
    [selectedId, cameras],
  );
  const visible = useMemo(
    () => cameras.filter((c) => {
      const byStatus = statusFilter === "All" || c.status === statusFilter;
      const byLoc    = locationFilter === "All" || c.roadName === locationFilter;
      return byStatus && byLoc;
    }),
    [statusFilter, locationFilter, cameras],
  );

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent/90">Computer Vision Edge Mesh</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-white md:text-3xl">
            Metropolitan Traffic & Flow Density
          </h2>
          <p className="mt-1 flex items-center gap-2 text-sm text-white/55">
            <Video className="h-3.5 w-3.5 text-accent" />
            <span>OpenStreetMap roads · {dataSource === "tomtom" ? "TomTom live speed telemetry" : "Time-of-day estimated model"}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Data source badge */}
          {dataSource === "tomtom" ? (
            <span className="flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-900/40 px-3 py-1.5 text-[11px] font-semibold text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" /> TomTom Live · {lastUpdated}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-900/30 px-3 py-1.5 text-[11px] font-semibold text-amber-300">
              <ServerCrash className="h-3.5 w-3.5" /> No API key · Estimated model
            </span>
          )}
          <button
            type="button"
            onClick={fetchTrafficData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-forest/80 px-3 py-1.5 text-[11px] font-semibold text-white/80 hover:border-accent/40 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,2.1fr)]">
        {/* Camera Queue */}
        <div className="rounded-xl border border-white/[0.08] bg-canopy/95 p-4 shadow-card">
          <div>
            <h3 className="font-display text-sm font-semibold text-white">Live Camera Queue</h3>
            <p className="mt-0.5 text-[11px] text-white/55">
              {loading ? "Fetching traffic…" : `${visible.length} of ${cameras.length} active edge zones`}
            </p>
          </div>

          {/* Filters */}
          <div className="mt-3 space-y-2 text-xs text-white/70">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-white/45">Status</span>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}
                className="h-8 rounded-lg border border-white/15 bg-forest/80 px-2 text-[11px] font-medium text-white outline-none focus:border-accent/40">
                {["All","Heavy Flow","Moderate","Clear"].map((v) => (
                  <option key={v} value={v} className="bg-forest text-white">{v}</option>
                ))}
              </select>
              <span className="ml-2 text-[11px] text-white/45">Location</span>
              <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}
                className="h-8 rounded-lg border border-white/15 bg-forest/80 px-2 text-[11px] font-medium text-white outline-none focus:border-accent/40">
                <option value="All" className="bg-forest text-white">All</option>
                {locations.map((loc) => <option key={loc} value={loc} className="bg-forest text-white">{loc}</option>)}
              </select>
              <button type="button" onClick={() => setDateFilterOpen((v) => !v)}
                className="ml-auto inline-flex items-center gap-1 rounded-lg border border-white/10 bg-forest/80 px-2 py-1 text-[11px] text-white/70 hover:border-accent/30">
                {dateFilterOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />} Date range
              </button>
            </div>
            {dateFilterOpen && (
              <p className="rounded-lg border border-dashed border-white/12 bg-forest/70 px-2.5 py-1.5 text-[11px] text-white/55">
                Date picker — attach from/to controls for temporal filtering.
              </p>
            )}
          </div>

          {/* Camera list */}
          <div className="mt-3 space-y-2">
            {loading && cameras.length === 0 ? (
              <div className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-forest/60 py-8 text-[11px] text-white/50">
                <Zap className="h-4 w-4 animate-pulse text-accent" /> Fetching live road data…
              </div>
            ) : visible.map((cam) => (
              <button key={cam.id} type="button" onClick={() => setSelectedId(cam.id)}
                className={`group flex w-full items-center gap-3 rounded-lg border px-2.5 py-2 text-left text-xs transition hover:border-accent/35 hover:bg-forest/80 ${
                  selectedId === cam.id ? "border-accent/50 bg-forest/85 shadow-glow" : "border-white/10 bg-forest/60"}`}>
                <div className="relative h-10 w-12 shrink-0 overflow-hidden rounded-md border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent">
                  <Video className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-white/55" />
                  <span className="absolute left-1 top-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-white/80">
                    {cam.source === "tomtom" ? "TT" : "CV"}
                  </span>
                  {cam.status === "Heavy Flow" && (
                    <span className="absolute inset-x-0 bottom-0 h-1 animate-pulse bg-gradient-to-r from-red-600 via-red-400 to-red-500" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[11px] font-semibold text-white/85">{cam.id}</p>
                    <StatusBadge status={cam.status} />
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 text-[10px] text-white/60">
                    <MapPin className="h-2.5 w-2.5 text-accent" />
                    <span className="truncate">{cam.roadName}</span>
                  </p>
                </div>
                <div className="flex flex-col items-end gap-0.5 text-[10px] text-white/50">
                  <span>{cam.date}</span>
                  {cam.source === "tomtom" && <span className="text-emerald-400">●live</span>}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Detail panel */}
        <div className="space-y-4">
          <div className="rounded-xl border border-white/[0.08] bg-canopy/95 p-4 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Flow Analytics</p>
                <h3 className="mt-1 font-display text-lg font-semibold text-white">
                  Urban Mesh — {selected ? selected.id : "Loading…"}
                  {selected?.source === "tomtom" && (
                    <span className="ml-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-emerald-300">LIVE</span>
                  )}
                </h3>
                <p className="mt-0.5 flex items-center gap-2 text-[11px] text-white/60">
                  <MapPin className="h-3 w-3 text-accent" />
                  <span>{selected?.roadName}</span>
                </p>
              </div>
              <button type="button" onClick={fetchTrafficData} disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-forest/80 px-3 py-1.5 text-[11px] font-medium text-white/80 hover:border-accent/35">
                <PlayCircle className="h-3.5 w-3.5 text-accent" />
                {loading ? "Refreshing…" : "Refresh data"}
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              {/* Simulated camera view */}
              <div className="relative overflow-hidden rounded-xl border border-white/10 bg-forest/80">
                <div className="relative h-64 w-full bg-gradient-to-br from-black/80 via-forest/80 to-black/60">
                  <Truck className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 text-white/20" />
                  <svg className="pointer-events-none absolute inset-3" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <rect x="10" y="38" width="52" height="24" fill="none"
                      stroke={selected?.status === "Heavy Flow" ? "#ef4444" : selected?.status === "Moderate" ? "#fbbf24" : "#10b981"}
                      strokeWidth="1.2" strokeDasharray="3 2" />
                    <text x="12" y="47" fontSize="5" fill="#fef3c7">Vehicle Cluster</text>
                    <text x="12" y="56" fontSize="4.5" fill="#fef3c7">
                      {selected?.source === "tomtom"
                        ? `Live Conf. ${selected.confidence != null ? (selected.confidence * 100).toFixed(0) : 80}%`
                        : "Conf. 84% (est.)"}
                    </text>
                  </svg>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-between px-3 pb-2 text-[10px] text-white/50">
                    <span>Edge Computer Vision</span>
                    <span>{selected?.source === "tomtom" ? "TomTom Live Frames" : "Estimated Bounding Frames"}</span>
                  </div>
                </div>
              </div>

              {/* Congestion Telemetry */}
              <div className="space-y-3">
                <div className="rounded-xl border border-white/12 bg-forest/85 p-4">
                  <h4 className="font-display text-sm font-semibold text-white">Congestion Telemetry</h4>
                  <dl className="mt-3 space-y-2 text-xs text-white/80">
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-white/50">Route Vector</dt>
                      <dd className="truncate text-right">{selected?.roadName ?? "—"}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-white/50">Congestion</dt>
                      <dd>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          (selected?.congestionPct ?? 0) >= 70 ? "bg-red-500/15 text-red-300"
                          : (selected?.congestionPct ?? 0) >= 35 ? "bg-amber-500/15 text-amber-300"
                          : "bg-emerald-500/15 text-emerald-300"
                        }`}>
                          {selected?.congestionPct ?? "—"}% saturation
                        </span>
                      </dd>
                    </div>
                    {selected?.source === "tomtom" && (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <dt className="text-white/50">Live Speed</dt>
                          <dd className="font-semibold text-sky-300">{selected.currentSpeed} km/h</dd>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <dt className="text-white/50">Free-Flow Speed</dt>
                          <dd>{selected.freeFlowSpeed} km/h</dd>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <dt className="text-white/50">Data Confidence</dt>
                          <dd className="text-emerald-300">{selected.confidence != null ? (selected.confidence * 100).toFixed(0) : 80}%</dd>
                        </div>
                      </>
                    )}
                    {selected?.source === "estimated" && (
                      <div className="flex items-center justify-between gap-2">
                        <dt className="text-white/50">Flow State</dt>
                        <dd>{selected.status}</dd>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-white/50">Noise Impact</dt>
                      <dd className="flex items-center gap-1">
                        <Volume2 className="h-3 w-3 text-red-300" />
                        <span className={selected && selected.noiseDb > 70 ? "font-semibold text-red-300" : "font-semibold text-emerald-300"}>
                          {selected?.noiseDb.toFixed(1)} dB
                        </span>
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-white/50">Data Source</dt>
                      <dd className={selected?.source === "tomtom" ? "text-emerald-400 font-semibold" : "text-amber-400"}>
                        {selected?.source === "tomtom" ? "✓ TomTom API" : "⚠ Estimated"}
                      </dd>
                    </div>
                  </dl>

                  {/* Speed bar */}
                  {selected?.source === "tomtom" && selected.freeFlowSpeed && (
                    <div className="mt-3">
                      <p className="mb-1 text-[10px] text-white/40">Speed vs free-flow</p>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            (selected.congestionPct ?? 0) >= 70 ? "bg-red-400"
                            : (selected.congestionPct ?? 0) >= 35 ? "bg-amber-400"
                            : "bg-emerald-400"
                          }`}
                          style={{ width: `${Math.round((selected.currentSpeed ?? 0) / selected.freeFlowSpeed * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <button type="button" className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-[11px] font-semibold text-forest shadow-glow transition hover:brightness-95">
                    Ping Camera
                  </button>
                  <button type="button" className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/18 bg-forest/80 px-3 py-2 text-[11px] font-semibold text-white/85 hover:border-accent/40">
                    Broadcast Warning
                  </button>
                  <button type="button" className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/18 bg-forest/60 px-3 py-2 text-[11px] font-semibold text-white/70 hover:border-emerald-400/40">
                    Adjust Signal
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Trend chart */}
          <div className="rounded-xl border border-white/[0.08] bg-canopy/95 p-4 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-sm font-semibold text-white">Metropolitan Temporal Flow · Volume</h3>
                <p className="text-[11px] text-white/55">
                  {dataSource === "tomtom"
                    ? "Current hour injected from live TomTom speeds · historical is estimated baseline"
                    : "Time-of-day estimated model · add TomTom key for live data"}
                </p>
              </div>
              {dataSource === "tomtom" && (
                <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-900/30 px-2.5 py-0.5 text-[10px] text-emerald-300">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Live injected
                </span>
              )}
            </div>
            <div className="mt-3 h-44 rounded-lg border border-white/10 bg-forest/80 px-3 py-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend} margin={{ top: 6, right: 10, bottom: 4, left: 0 }}>
                  <XAxis dataKey="hour" tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }} tickLine={false} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }} tickLine={false} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const v = payload[0].value as number;
                      return (
                        <div className="rounded-md border border-white/10 bg-[#0A1510]/95 px-2.5 py-1.5 text-[11px] text-white/85">
                          Congestion: <span className={v >= 70 ? "text-red-300" : v >= 35 ? "text-amber-300" : "text-emerald-300"}>{v.toFixed(0)}%</span>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {trend.map((entry) => (
                      <Cell
                        key={entry.hour}
                        fill={entry.value >= 70 ? "#ef4444" : entry.value >= 35 ? "#fbbf24" : "#38bdf8"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Footer stats */}
      <div className="rounded-xl border border-white/[0.08] bg-canopy/95 px-4 py-2.5 text-xs text-white/80 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5">
              <Video className="h-3.5 w-3.5 text-accent" />
              Active Zones: <span className="font-semibold text-white">{cameras.length}</span>
            </span>
            <span className="flex items-center gap-1.5 text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Clear: {cameras.filter((c) => c.status === "Clear").length}
            </span>
            <span className="flex items-center gap-1.5 text-amber-300">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Moderate: {cameras.filter((c) => c.status === "Moderate").length}
            </span>
            <span className="flex items-center gap-1.5 text-red-300">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              Heavy: {cameras.filter((c) => c.status === "Heavy Flow").length}
            </span>
            {dataSource === "tomtom" && (
              <span className="flex items-center gap-1.5 text-emerald-300">
                <AlertTriangle className="h-3 w-3" />
                {cameras.filter((c) => c.source === "tomtom").length} nodes on live TomTom feed
              </span>
            )}
          </div>
          <span className="text-[10px] text-white/35">
            OSM roads · {dataSource === "tomtom" ? "TomTom Traffic Flow API v4" : "Time-of-day model"} · auto-refresh 60s
          </span>
        </div>
      </div>
    </section>
  );
}
