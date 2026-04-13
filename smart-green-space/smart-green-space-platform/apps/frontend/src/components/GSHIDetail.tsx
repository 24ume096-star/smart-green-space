import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, FileText, Leaf, MapPin } from "lucide-react";
import { MASTER_PARKS, type ParkConfig } from "../constants/parks";

type Trend = "up" | "down" | "flat";
import {
  Line,
  LineChart,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
} from "recharts";

// Using unified park list from constants

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:8080";

function deriveSubIndicesFromOverall(overall: number) {
  const o = Math.max(0, Math.min(100, Number(overall || 0)));
  return {
    vegetation: Math.round(Math.max(0, Math.min(100, o * 0.92))),
    thermal: Math.round(Math.max(0, Math.min(100, o * 0.88))),
    water: Math.round(Math.max(0, Math.min(100, o * 1.03))),
    biodiversity: Math.round(Math.max(0, Math.min(100, o * 0.96))),
    airQuality: Math.round(Math.max(0, Math.min(100, o * 0.89))),
    infra: Math.round(Math.max(0, Math.min(100, o * 0.82))),
    tree: Math.round(Math.max(0, Math.min(100, o * 0.91))),
  };
}

// Fetch all live sub-indices for a park from the Backend calculate engine
async function fetchSubIndices(parkId: string): Promise<Record<string, number>> {
  const result: Record<string, number> = {};

  try {
    const res = await fetch(`${API_BASE}/api/v1/gshi/parks/${parkId}/current`);
    const json = await res.json();

    if (json.data) {
      const d = json.data;
      // vegetationScore: backend stores it based on real NDVI (0.44 → ~72%)
      result.vegetation = Math.round(d.vegetationScore ?? 0);
      result.thermal = Math.round(d.thermalScore ?? 0);
      result.water = Math.round(d.waterScore ?? 0);
      result.biodiversity = Math.round(d.biodiversityScore ?? 0);
      result.airQuality = Math.round(d.airQualityScore ?? 0);
      result.infra = Math.round(d.infrastructureScore ?? 70);
      // treeHealthScore: use API value, derive from vegetation if missing
      result.tree = d.treeHealthScore > 0
        ? Math.round(d.treeHealthScore)
        : Math.round((d.vegetationScore ?? 0) * 0.92);
    }
  } catch (error) {
    console.error("Failed to fetch GSHI scores:", error);
  }

  return result;
}

const TREND_EVENTS = [
  { week: "W-20", label: "Heavy rain event" },
  { week: "W-12", label: "Heatwave" },
  { week: "W-4", label: "Major maintenance" },
];

const TREND_SERIES_DEFAULT = [
  { week: "W-24", value: 79 }, { week: "W-22", value: 80 },
  { week: "W-20", value: 78 }, { week: "W-18", value: 82 },
  { week: "W-16", value: 83 }, { week: "W-14", value: 81 },
  { week: "W-12", value: 77 }, { week: "W-10", value: 84 },
  { week: "W-8", value: 86 }, { week: "W-6", value: 87 },
  { week: "W-4", value: 89 }, { week: "W-2", value: 88 },
  { week: "W", value: 90 },
];

function loadGshiHistory(parkId: string): typeof TREND_SERIES_DEFAULT {
  try {
    const raw = localStorage.getItem(`gshi_history_${parkId}`);
    if (!raw) return TREND_SERIES_DEFAULT;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : TREND_SERIES_DEFAULT;
  } catch { return TREND_SERIES_DEFAULT; }
}

function saveGshiHistory(parkId: string, series: typeof TREND_SERIES_DEFAULT) {
  try { localStorage.setItem(`gshi_history_${parkId}`, JSON.stringify(series.slice(-26))); }
  catch { /* quota exceeded */ }
}


function trendIcon(trend: Trend) {
  if (trend === "up") {
    return <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />;
  }
  if (trend === "down") {
    return <ArrowDownRight className="h-3.5 w-3.5 text-red-400" />;
  }
  return <ArrowRight className="h-3 w-3 text-yellow-300" />;
}

function trendLabel(trend: Trend) {
  if (trend === "up") return "vs last week";
  if (trend === "down") return "vs last week";
  return "stable";
}

function GshiGauge({ value }: { value: number }) {
  const size = 260;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const dash = (pct / 100) * c;
  const gap = c - dash;

  return (
    <div className="relative grid place-items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id="gshiGaugeGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#22C55E" />
            <stop offset="55%" stopColor="#EAB308" />
            <stop offset="100%" stopColor="#EF4444" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#gshiGaugeGradient)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${gap}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="drop-shadow-[0_0_22px_rgba(46,204,113,0.4)] transition-all duration-500"
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Overall GSHI</p>
        <p className="mt-2 font-display text-5xl font-semibold tracking-tight text-white">{pct.toFixed(0)}</p>
        <p className="mt-1 text-xs text-white/50">Composite of 6 sub-indices</p>
        <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-forest/70 px-3 py-1">
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-pulse-soft rounded-full bg-accent opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent shadow-[0_0_8px_rgba(46,204,113,0.8)]" />
          </span>
          <span className="text-[11px] font-medium text-white/75">Real-time composite</span>
        </div>
      </div>
    </div>
  );
}

function RadarTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; payload?: { metric?: string } }>;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const value = typeof p.value === "number" ? p.value : undefined;
  const name = (p as any)?.payload?.metric as string | undefined;
  if (!value || !name) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-[#0a1510]/95 px-3 py-2 text-xs text-white/85 shadow-card">
      <p className="font-semibold text-white">{name}</p>
      <p className="mt-0.5 text-accent">{value.toFixed(0)}%</p>
    </div>
  );
}

function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: string;
}) {
  if (!active || !payload?.length || typeof label !== "string") return null;
  const v = payload[0]?.value;
  if (typeof v !== "number") return null;
  const event = TREND_EVENTS.find((e) => e.week === label);
  return (
    <div className="rounded-lg border border-white/10 bg-[#0a1510]/95 px-3 py-2 text-xs text-white/85 shadow-card">
      <p className="font-semibold text-white">{label}</p>
      <p className="mt-0.5">
        GSHI: <span className="text-accent">{v.toFixed(1)}</span>
      </p>
      {event ? <p className="mt-0.5 text-[11px] text-white/65">{event.label}</p> : null}
    </div>
  );
}

export function GSHIDetail() {
  const [parkId, setParkId] = useState<string>("deer");
  const [parks, setParks] = useState<ParkConfig[]>(MASTER_PARKS);
  const [compareOn, setCompareOn] = useState(false);
  const [compareId, setCompareId] = useState<string>("lodhi");
  const [trendSeries, setTrendSeries] = useState(() => loadGshiHistory("deer"));

  useEffect(() => {
    let mounted = true;
    async function loadLiveParks() {
      try {
        const [rankingsRes, parksRes] = await Promise.all([
          fetch(`${API_BASE}/api/v1/gshi/cities/delhi-city/rankings`),
          fetch(`${API_BASE}/api/v1/parks?cityId=delhi-city&limit=100`),
        ]);
        if (!rankingsRes.ok || !parksRes.ok) return;
        const rankingsJson = await rankingsRes.json();
        const parksJson = await parksRes.json();
        const rankings = Array.isArray(rankingsJson?.data) ? rankingsJson.data : [];
        const parkItems = Array.isArray(parksJson?.data?.items) ? parksJson.data.items : [];
        const cityLabelByName = new Map(parkItems.map((p: any) => [p.name, "Delhi"]));

        const mapped: ParkConfig[] = rankings.map((r: any) => {
          const overall = Number(r.score || 0);
          const fallback = deriveSubIndicesFromOverall(overall);
          return {
            id: r.parkId,
            name: r.parkName,
            cityLabel: cityLabelByName.get(r.parkName) || "Delhi",
            overall,
            subIndices: [
              { key: "vegetation", label: "Vegetation Health (NDVI)", emoji: "🌱", value: fallback.vegetation, trend: "flat" as Trend },
              { key: "thermal", label: "Thermal Comfort Index", emoji: "🌡️", value: fallback.thermal, trend: "flat" as Trend },
              { key: "water", label: "Water Resilience Score", emoji: "💧", value: fallback.water, trend: "flat" as Trend },
              { key: "biodiversity", label: "Biodiversity Index", emoji: "🌿", value: fallback.biodiversity, trend: "flat" as Trend },
              { key: "airQuality", label: "Air Quality (AQI/PM)", emoji: "💨", value: fallback.airQuality, trend: "flat" as Trend },
              { key: "infra", label: "Infrastructure Health", emoji: "🏗️", value: fallback.infra, trend: "flat" as Trend },
              { key: "tree", label: "Tree Health Score (CV)", emoji: "📷", value: fallback.tree, trend: "flat" as Trend },
            ],
          };
        });

        if (mounted && mapped.length > 0) {
          setParks(mapped);
          setParkId(mapped[0].id);
          setCompareId(mapped[Math.min(1, mapped.length - 1)].id);
        }
      } catch {
        // fallback stays
      }
    }
    loadLiveParks();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    // Load persisted history for this park on park change
    setTrendSeries(loadGshiHistory(parkId));
  }, [parkId]);

  useEffect(() => {
    let mounted = true;
    async function loadTrend() {
      if (!parkId) return;
      try {
        const to = new Date();
        const from = new Date(to.getTime() - 180 * 24 * 60 * 60 * 1000);
        const url = `${API_BASE}/api/v1/gshi/parks/${parkId}/history?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}&interval=weekly`;
        const res = await fetch(url);
        if (!res.ok) return;
        const json = await res.json();
        const rows = Array.isArray(json?.data) ? json.data : [];
        const mapped = rows.map((r: any, idx: number) => ({
          week: `W-${rows.length - idx}`,
          value: Number(r.overallScore || 0),
        }));
        // Inject today's real score as 'Today'
        const todayScore = parks.find(p => p.id === parkId)?.overall ?? 0;
        if (todayScore > 0) mapped.push({ week: "Today", value: Math.round(todayScore) });
        if (mounted && mapped.length > 0) {
          setTrendSeries(mapped);
          saveGshiHistory(parkId, mapped);
        }
      } catch {
        // keep persisted/fallback trend — inject today's real score
        const todayScore = parks.find(p => p.id === parkId)?.overall ?? 0;
        if (todayScore > 0) {
          setTrendSeries((prev) => {
            const updated = [...prev.filter(p => p.week !== "Today"), { week: "Today", value: Math.round(todayScore) }];
            saveGshiHistory(parkId, updated);
            return updated;
          });
        }
      }
    }
    loadTrend();
    return () => { mounted = false; };
  }, [parkId]);

  // ── Sub-index live enrichment (all 6 metrics from backend API) ────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      const live = await fetchSubIndices(parkId);
      if (!mounted || Object.keys(live).length === 0) return;
      setParks((prev) => prev.map((p) => {
        if (p.id !== parkId) return p;
        const updated = p.subIndices.map((s) => {
          const liveVal = live[s.key];
          if (liveVal == null) return s;
          const oldVal = s.value;
          const trend: Trend = liveVal > oldVal + 2 ? "up" : liveVal < oldVal - 2 ? "down" : "flat";
          return { ...s, value: liveVal, trend };
        });
        // Recompute overall GSHI as weighted composite from real values
        const weights: Record<string, number> = { vegetation: 0.22, thermal: 0.18, water: 0.17, biodiversity: 0.15, airQuality: 0.10, infra: 0.09, tree: 0.09 };
        const composite = updated.reduce((sum, s) => sum + (s.value * (weights[s.key] ?? 0)), 0);
        return { ...p, subIndices: updated, overall: Math.round(composite * 10) / 10 };
      }));
    })();
    return () => { mounted = false; };
  }, [parkId]);

  const park = useMemo(() => parks.find((p) => p.id === parkId) ?? parks[0], [parkId, parks]);
  const comparePark = useMemo(
    () => parks.find((p) => p.id === compareId && compareOn && compareId !== parkId),
    [compareOn, compareId, parkId, parks],
  );

  const radarData = useMemo(() => {
    const base = park.subIndices.map((s) => ({
      metric: s.label.split("—")[0] ?? s.label,
      [park.name]: s.value,
      ...(comparePark ? { [comparePark.name]: comparePark.subIndices.find((c) => c.key === s.key)?.value ?? 0 } : {}),
    }));
    return base;
  }, [park, comparePark]);

  function handleGenerateReport() {
    // Simple simulation – in a real app this would kick off a server-side PDF job.
    // eslint-disable-next-line no-alert
    alert(`Generating GSHI report PDF for ${park.name}…`);
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent/90">
            Green Space Health Index
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-white md:text-3xl">
            GSHI detail · {park.name}
          </h2>
          <p className="mt-1 flex items-center gap-2 text-sm text-white/55">
            <MapPin className="h-3.5 w-3.5 text-accent" />
            <span>{park.cityLabel}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-canopy/80 px-3 py-2">
            <Leaf className="h-4 w-4 text-accent" />
            <span className="text-xs font-medium text-white/70">
              Composite powered by sensor mesh + satellite + CV
            </span>
          </div>

          <button
            type="button"
            onClick={handleGenerateReport}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-xs font-semibold text-forest shadow-glow transition hover:brightness-95"
          >
            <FileText className="h-4 w-4" />
            <span>Generate Report (PDF)</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="rounded-xl border border-white/[0.07] bg-canopy/90 p-5 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Select park</p>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={parkId}
                  onChange={(e) => setParkId(e.target.value)}
                  className="h-10 rounded-lg border border-white/15 bg-forest/70 px-3 text-sm font-medium text-white shadow-card outline-none ring-0 focus:border-accent/50 focus:ring-2 focus:ring-accent/20"
                >
                  {parks.map((p) => (
                    <option key={p.id} value={p.id} className="bg-forest text-white">
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-white/45">Scores normalized on a 0–100 scale.</p>
            </div>
          </div>

          <div className="mt-4 flex flex-col items-center gap-4 md:flex-row md:items-stretch">
            <div className="flex flex-1 items-center justify-center">
              <GshiGauge value={park.overall} />
            </div>
            <div className="mt-2 flex flex-1 flex-col justify-center gap-2 rounded-xl border border-white/10 bg-forest/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-white/45">Today’s signal</p>
              <p className="text-sm text-white/75">
                {park.name} is currently in{" "}
                <span className="text-accent font-semibold">
                  {park.overall >= 85 ? "high-performing" : park.overall >= 70 ? "stable" : "attention required"}
                </span>{" "}
                band with healthy vegetation and resilient water balance.
              </p>
              <p className="text-xs text-white/50">
                GSHI aggregates vegetation, thermal comfort, water resilience, biodiversity, built infrastructure, and
                tree health signals into a unified health score to support operations.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.07] bg-canopy/90 p-5 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-lg font-semibold text-white">Multi-dimensional profile</h3>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-white/70">
                <input
                  type="checkbox"
                  checked={compareOn}
                  onChange={(e) => setCompareOn(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-white/40 bg-forest text-accent focus:ring-accent/40"
                />
                Compare parks
              </label>
              <select
                value={compareId}
                onChange={(e) => setCompareId(e.target.value)}
                disabled={!compareOn}
                className="h-8 rounded-lg border border-white/15 bg-forest/70 px-2 text-[11px] font-medium text-white/85 shadow-card outline-none ring-0 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {parks.filter((p) => p.id !== park.id).map((p) => (
                  <option key={p.id} value={p.id} className="bg-forest text-white">
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 h-64 rounded-lg border border-white/10 bg-forest/60 px-3 py-3">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="rgba(255,255,255,0.12)" />
                <PolarAngleAxis
                  dataKey="metric"
                  tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 10 }}
                  tickLine={{ stroke: "rgba(255,255,255,0.25)" }}
                />
                <PolarRadiusAxis tick={false} axisLine={false} />
                <Tooltip content={<RadarTooltip />} />
                <Radar
                  name={park.name}
                  dataKey={park.name}
                  stroke="#2ECC71"
                  fill="#2ECC71"
                  fillOpacity={0.35}
                  dot={{ r: 2 }}
                />
                {comparePark ? (
                  <Radar
                    name={comparePark.name}
                    dataKey={comparePark.name}
                    stroke="#38BDF8"
                    fill="#38BDF8"
                    fillOpacity={0.25}
                    dot={{ r: 2 }}
                  />
                ) : null}
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-white/50">
            <span className="flex items-center gap-2">
              <span className="h-1 w-4 rounded-full bg-accent" />
              {park.name}
            </span>
            {comparePark ? (
              <span className="flex items-center gap-2">
                <span className="h-1 w-4 rounded-full bg-sky-400" />
                {comparePark.name}
              </span>
            ) : (
              <span className="text-white/30">Enable compare to overlay a second park</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {park.subIndices.map((s) => (
          <div
            key={s.key}
            className="group relative overflow-hidden rounded-xl border border-white/[0.07] bg-canopy p-4 shadow-card transition hover:border-accent/25 hover:shadow-glow"
          >
            <div
              className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-accent/10 blur-2xl opacity-0 transition group-hover:opacity-100"
              aria-hidden
            />
            <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-lg leading-none">{s.emoji}</span>
                  <p className="truncate text-xs font-semibold uppercase tracking-wide text-white/55">
                    {s.label}
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 text-sm">
                  <p className="font-display text-xl font-semibold text-white">{s.value}%</p>
                  <div className="flex items-center gap-1 rounded-full border border-white/15 bg-forest/80 px-2 py-0.5 text-[10px] text-white/70">
                    {trendIcon(s.trend)}
                    <span>{trendLabel(s.trend)}</span>
                  </div>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/40">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent via-accent-dim to-emerald-300"
                    style={{ width: `${s.value}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-white/[0.07] bg-canopy/90 p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-lg font-semibold text-white">
            Historical GSHI trend · last 6 months
          </h3>
          <p className="text-xs text-white/55">
            Weekly composite values with annotated major events to explain directional moves in the index.
          </p>
        </div>

        <div className="mt-4 h-60 rounded-lg border border-white/10 bg-forest/70 px-3 py-3">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendSeries} margin={{ top: 10, right: 16, bottom: 10, left: 0 }}>
              <XAxis
                dataKey="week"
                tick={{ fill: "rgba(255,255,255,0.65)", fontSize: 10 }}
                tickLine={{ stroke: "rgba(255,255,255,0.3)" }}
              />
              <Tooltip content={<TrendTooltip />} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#2ECC71"
                strokeWidth={2}
                dot={{ r: 2.5, strokeWidth: 0 }}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-white/55">
          {TREND_EVENTS.map((e) => (
            <div
              key={e.week}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-forest/80 px-3 py-1"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              <span className="font-semibold text-white/80">{e.label}</span>
              <span className="text-white/40">{e.week}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

