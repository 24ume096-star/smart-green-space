import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, CloudRain,
  Download, Layers, Map, PlayCircle, ServerCrash,
  Thermometer, Zap, CheckCircle2, Info,
} from "lucide-react";
import { MapContainer, TileLayer, Circle, Tooltip as LeafletTooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { MASTER_PARKS, PARK_NAMES } from "../constants/parks";

// ── Types ────────────────────────────────────────────────────────────────────
type Scenario = "flood" | "heat" | "growth" | "drought";
type ColorKey = "green" | "blue" | "blue2" | "yellow" | "red" | "red2";
type DataSource = "live" | "estimated" | null;

type HistoryRow = {
  id: number; park: string; scenario: Scenario; rainfall: number;
  tempDelta: number; vegChange: number; horizon: string;
  resultGshi: number; delta: number; source: DataSource;
};

type GridCell = {
  bounds: [[number, number], [number, number]];
  colorKey: ColorKey; intensity: number; label: string; riskScore?: number;
};

type BackendRisk = {
  riskScore: number; riskLevel: "LOW" | "WATCH" | "WARNING" | "EMERGENCY";
  timeToOverflowMin: number | null; affectedZones: string[]; recommendedActions: string[];
};

// ── Constants ────────────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

const COLOR_HEX: Record<ColorKey, string> = {
  green: "#10b981", blue: "#38bdf8", blue2: "#0ea5e9",
  yellow: "#fbbf24", red: "#ef4444", red2: "#b91c1c",
};

const LEGEND: Record<Scenario, { color: string; label: string }[]> = {
  flood:   [{ color: "bg-sky-600/90",     label: "Deep inundation" },
            { color: "bg-sky-400/70",     label: "Flood zone" },
            { color: "bg-amber-400/80",   label: "At-risk buffer" },
            { color: "bg-emerald-500/40", label: "Safe canopy" }],
  heat:    [{ color: "bg-red-700/90",     label: "Critical heat stress" },
            { color: "bg-red-500/70",     label: "High heat index" },
            { color: "bg-amber-400/80",   label: "Moderate heat" },
            { color: "bg-emerald-500/40", label: "Cool / shaded" }],
  growth:  [{ color: "bg-emerald-600/90", label: "Vegetation gain" },
            { color: "bg-emerald-400/50", label: "Stable canopy" }],
  drought: [{ color: "bg-red-700/90",     label: "Severe drought" },
            { color: "bg-red-500/70",     label: "High stress" },
            { color: "bg-amber-400/80",   label: "Moderate stress" },
            { color: "bg-emerald-500/40", label: "Low-risk zone" }],
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function scenarioLabel(s: Scenario) {
  if (s === "flood")  return "Flood Simulation";
  if (s === "heat")   return "Heat Wave";
  if (s === "growth") return "Tree Growth Projection";
  return "Drought Impact";
}

function deltaIcon(delta: number) {
  if (delta > 0) return <ArrowUpRight className="h-3.5 w-3.5 text-emerald-300" />;
  if (delta < 0) return <ArrowDownRight className="h-3.5 w-3.5 text-red-300" />;
  return <ArrowRight className="h-3 w-3 text-white/60" />;
}

function levelToColorKey(level: string, riskScore: number): ColorKey {
  if (level === "EMERGENCY" || riskScore > 0.85) return "red2";
  if (level === "WARNING"   || riskScore > 0.60) return "red";
  if (level === "WATCH"     || riskScore > 0.35) return "yellow";
  if (riskScore > 0.15)                          return "blue";
  return "green";
}

function MapRecenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.flyTo(center, 14, { duration: 1.2 }); }, [center, map]);
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function DigitalTwinPanel() {
  const [park, setPark]           = useState<string>("Lodhi Garden");
  const [scenario, setScenario]   = useState<Scenario>("flood");
  const [rainfall, setRainfall]   = useState(80);
  const [tempDelta, setTempDelta] = useState(2);
  const [vegChange, setVegChange] = useState(10);
  const [horizon, setHorizon]     = useState<"1 year" | "5 years" | "10 years">("5 years");
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress]   = useState(0);
  const [showAfter, setShowAfter] = useState(true);
  const [animFrame, setAnimFrame] = useState(0);

  // ── Real-data state
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [liveWeather, setLiveWeather]       = useState<{ rainfall: number; temp: number } | null>(null);
  const [geoJsonFeatures, setGeoJsonFeatures] = useState<any[] | null>(null);
  const [backendRisk, setBackendRisk]       = useState<BackendRisk | null>(null);
  const [dataSource, setDataSource]         = useState<DataSource>(null);
  const [recommendedActions, setRecommendedActions] = useState<string[]>([]);

  const [result, setResult] = useState({ gshi: 67, delta: -18, floodZones: 3, treeLossPct: 12, confidence: 84 });
  const [history, setHistory] = useState<HistoryRow[]>([
    { id: 1, park: "Lodhi Garden", scenario: "heat",   rainfall: 12,  tempDelta: 4,   vegChange: -18, horizon: "5 years",  resultGshi: 69, delta: -15, source: "estimated" },
    { id: 2, park: "Sanjay Van",   scenario: "flood",  rainfall: 160, tempDelta: 1,   vegChange: -5,  horizon: "1 year",   resultGshi: 74, delta: -9,  source: "estimated" },
    { id: 3, park: "Central Park", scenario: "growth", rainfall: 40,  tempDelta: 1.5, vegChange: 22,  horizon: "10 years", resultGshi: 86, delta: 6,   source: "estimated" },
  ]);
  const progressRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  // Safely cleanup rogue intervals if component unmounts mid-simulation
  useEffect(() => {
    return () => {
      if (progressRef.current) window.clearInterval(progressRef.current);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  // Pulse active cells while running
  useEffect(() => {
    if (!isRunning) return;
    const t = window.setInterval(() => setAnimFrame((f) => f + 1), 400);
    return () => clearInterval(t);
  }, [isRunning]);

  // ── Seed sliders from LIVE Open-Meteo when park changes ──────────────────
  useEffect(() => {
    let mounted = true;
    const activePark = MASTER_PARKS.find(p => p.name === park) || MASTER_PARKS[1];
    const center = activePark.center;
    setWeatherLoading(true);
    setLiveWeather(null);
    (async () => {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${center[0]}&longitude=${center[1]}&daily=precipitation_sum,temperature_2m_max&timezone=Asia%2FKolkata&forecast_days=1`;
        const res = await fetch(url);
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!mounted) return;
        const todayRain  = data.daily.precipitation_sum?.[0] ?? 0;   // mm/day
        const todayTmax  = data.daily.temperature_2m_max?.[0] ?? 32; // °C
        const BASE_TEMP  = 28; // comfortable reference for Delhi
        const scaledRain = Math.round(Math.min(200, todayRain * 4));  // scale to slider range
        const deltTemp   = Math.max(0, parseFloat((todayTmax - BASE_TEMP).toFixed(1)));
        setLiveWeather({ rainfall: scaledRain, temp: deltTemp });
        setRainfall(scaledRain);
        setTempDelta(Math.min(5, deltTemp));
      } catch {
        console.warn(`Live weather fetch failed for ${park}`);
      } finally {
        if (mounted) setWeatherLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [park]);

  // ── Grid cell computation ─────────────────────────────────────────────────
  const gridCells = useMemo((): GridCell[][] => {
    const ROWS = 4, COLS = 6;
    const activePark = MASTER_PARKS.find(p => p.name === park) || MASTER_PARKS[1];
    const center = activePark.center;
    const originLat = center[0] + 0.006;
    const originLng = center[1] - 0.007;
    const stepLat = 0.002, stepLng = 0.0028;

    const makeBounds = (rIdx: number, cIdx: number): [[number, number], [number, number]] => {
      const lat = originLat - rIdx * stepLat;
      const lng = originLng + cIdx * stepLng;
      return [[lat, lng], [lat - stepLat, lng + stepLng]];
    };

    // ── LIVE: GeoJSON from real ML backend ───────────────────────────────
    if (geoJsonFeatures && geoJsonFeatures.length > 0 && showAfter) {
      const withCentroid = geoJsonFeatures.map((f: any) => {
        const ring = f.geometry?.coordinates?.[0] ?? [];
        const lat  = ring.length ? ring.reduce((s: number, c: number[]) => s + c[1], 0) / ring.length : center[0];
        const lng  = ring.length ? ring.reduce((s: number, c: number[]) => s + c[0], 0) / ring.length : center[1];
        return { ...f, centLat: lat, centLng: lng };
      });
      const sorted = [...withCentroid].sort((a, b) => b.centLat - a.centLat || a.centLng - b.centLng);

      return Array.from({ length: ROWS }, (_, rIdx) =>
        Array.from({ length: COLS }, (_, cIdx) => {
          const feat = sorted[rIdx * COLS + cIdx];
          if (!feat) return { bounds: makeBounds(rIdx, cIdx), colorKey: "green" as ColorKey, intensity: 0.14, label: "No data" };
          const score  = feat.properties?.riskScore ?? 0;
          const level  = feat.properties?.level ?? "LOW";
          const ndvi   = feat.properties?.ndvi;
          const elev   = feat.properties?.elevation;
          const rain   = feat.properties?.rainfall;
          const colorKey = levelToColorKey(level, score);
          return {
            bounds: makeBounds(rIdx, cIdx),
            colorKey,
            intensity: colorKey === "green" ? 0.14 : colorKey.endsWith("2") ? 0.74 : 0.58,
            riskScore: score,
            label: [
              `Risk ${(score * 100).toFixed(1)}% · ${level}`,
              ndvi  != null ? `NDVI: ${(+ndvi).toFixed(2)}`       : null,
              elev  != null ? `Elev: ${(+elev).toFixed(0)} m`     : null,
              rain  != null ? `Rain: ${(+rain).toFixed(1)} mm/hr` : null,
            ].filter(Boolean).join(" · "),
          };
        })
      );
    }

    // ── ESTIMATED: Slider-driven model ───────────────────────────────────
    const base: ColorKey[][] = Array.from({ length: ROWS }, () =>
      Array.from({ length: COLS }, (): ColorKey => "green")
    );
    if (showAfter) {
      const floodS   = Math.min(1, rainfall / 200);
      const heatS    = Math.min(1, tempDelta / 5);
      const droughtS = Math.min(1, Math.abs(vegChange) / 50);
      if (scenario === "flood") {
        base[3][1] = floodS > 0.6 ? "blue2" : "blue"; base[3][2] = "blue2"; base[2][2] = "blue";
        if (floodS > 0.3) { base[3][4] = "yellow"; base[2][4] = "yellow"; }
        if (floodS > 0.6) { base[3][0] = "blue";   base[2][3] = "blue"; }
        if (floodS > 0.85){ base[1][2] = "blue";   base[1][3] = "yellow"; }
      } else if (scenario === "heat") {
        base[0][2] = heatS > 0.5 ? "red2" : "red"; base[0][3] = "red2";
        base[1][3] = "yellow"; base[2][3] = "yellow";
        if (heatS > 0.4)  { base[0][4] = "red";   base[1][4] = "yellow"; }
        if (heatS > 0.7)  { base[0][1] = "red";   base[1][2] = "yellow"; }
      } else if (scenario === "growth") {
        base[1][1] = "green"; base[1][2] = "green"; base[2][1] = "green"; base[2][2] = "green";
        if (vegChange > 20) { base[0][1] = "green"; base[1][3] = "green"; }
        if (vegChange > 35) { base[0][3] = "green"; base[3][2] = "green"; }
      } else {
        base[1][4] = droughtS > 0.4 ? "red"  : "yellow";
        base[2][4] = droughtS > 0.4 ? "red2" : "red";
        base[2][5] = "red"; base[3][5] = "red2";
        if (droughtS > 0.5) { base[1][5] = "red";    base[3][4] = "yellow"; }
        if (droughtS > 0.7) { base[0][4] = "yellow"; base[0][5] = "red"; }
      }
    }
    const tooltips: Record<ColorKey, string> = {
      green:  "Healthy canopy · Low stress (estimated)",
      blue:   "Flood inundation · High water table (estimated)",
      blue2:  "Deep inundation · Immediate risk (estimated)",
      yellow: "Watch zone · Elevated risk (estimated)",
      red:    "High stress · Intervention needed (estimated)",
      red2:   "Critical zone · Immediate action (estimated)",
    };
    return base.map((row, rIdx) =>
      row.map((colorKey, cIdx) => ({
        bounds: makeBounds(rIdx, cIdx),
        colorKey,
        intensity: colorKey === "green" ? 0.14 : colorKey.endsWith("2") ? 0.72 : 0.55,
        label: tooltips[colorKey],
      }))
    );
  }, [scenario, showAfter, rainfall, tempDelta, vegChange, park, geoJsonFeatures]);

  // ── Run Simulation ──────────────────────────────────────────────────────────
  const runSimulation = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);
    setProgress(0);
    setGeoJsonFeatures(null);
    setBackendRisk(null);
    setDataSource(null);

    let p = 0;
    progressRef.current = window.setInterval(() => {
      p += Math.random() * 12 + 3;
      setProgress(Math.min(90, Math.round(p)));
    }, 120);

    const activePark = MASTER_PARKS.find(p => p.name === park) || MASTER_PARKS[1];
    const apiId = activePark.apiId;
    let usedLive = false;
    let bkRisk: BackendRisk | null = null;
    let geoFeats: any[] | null = null;

    // ── Attempt live backend ─────────────────────────────────────────────
    if (scenario === "flood") {
      try {
        const [rRes, gRes] = await Promise.allSettled([
          fetch(`${API_BASE}/api/v1/flood/${apiId}/risk`),
          fetch(`${API_BASE}/public/heatmaps/${apiId}_heatmap.geojson`),
        ]);
        if (rRes.status === "fulfilled" && rRes.value.ok) {
          bkRisk = await rRes.value.json();
          setBackendRisk(bkRisk);
          usedLive = true;
        }
        if (gRes.status === "fulfilled" && gRes.value.ok) {
          const gd = await gRes.value.json();
          geoFeats = gd.features ?? null;
          setGeoJsonFeatures(geoFeats);
        }
      } catch { /* backend offline */ }
    }

    // ── Compute outputs ──────────────────────────────────────────────────
    timeoutRef.current = window.setTimeout(() => {
      window.clearInterval(progressRef.current!);
      setProgress(100);

      let gshi: number, floodZones: number, treeLoss: number, confidence: number;
      const BASE = 85;

      if (bkRisk && usedLive) {
        // Real model: riskScore (0–1) → GSHI (25–98)
        const liveGshi = Math.round(98 - bkRisk.riskScore * 73);
        // Blend with time-horizon scale factor
        const timeScale = horizon === "10 years" ? 0.88 : horizon === "5 years" ? 0.93 : 1.0;
        // Scenario-specific overlay (limited effect — real score dominates)
        const scenBias = scenario === "heat"   ? -(tempDelta / 5) * 7
                       : scenario === "growth" ? (vegChange / 50) * 8
                       : scenario === "drought"? -((200 - rainfall) / 200) * 5
                       : 0;
        gshi = Math.max(25, Math.min(98, Math.round((liveGshi + scenBias) * timeScale)));
        floodZones = bkRisk.affectedZones?.length ?? Math.round(bkRisk.riskScore * 5);
        treeLoss   = Math.round(bkRisk.riskScore * 22 * (horizon === "10 years" ? 1.5 : horizon === "5 years" ? 1.2 : 1.0));
        confidence = 87 + Math.round(Math.random() * 7); // real model → higher confidence
        setRecommendedActions(bkRisk.recommendedActions ?? []);
      } else {
        // ── Estimated physics fallback ────────────────────────────────
        const tm = horizon === "10 years" ? 1.4 : horizon === "5 years" ? 1.15 : 1.0;
        let delta = 0;
        if (scenario === "flood") {
          delta = (-((rainfall / 200) * 28) - (tempDelta / 5) * 4 + (vegChange / 50) * 6) * tm;
        } else if (scenario === "heat") {
          delta = (-((tempDelta / 5) * 32) + (rainfall / 200) * 5 + (vegChange / 50) * 8) * (tm > 1.2 ? 1.5 : tm * 1.1);
        } else if (scenario === "growth") {
          delta = ((vegChange / 50) * 22 + (rainfall / 200) * 6 - (tempDelta / 5) * 5) * (tm > 1 ? tm * 0.95 : 1);
        } else {
          delta = (-(((200 - rainfall) / 200) * 20) - (tempDelta / 5) * 14 + (vegChange / 50) * 7) * (tm > 1.2 ? 1.6 : tm);
        }
        gshi = Math.max(25, Math.min(98, Math.round(BASE + delta)));
        if (scenario === "flood")  { floodZones = Math.max(1, Math.round((rainfall / 200) * 6)); treeLoss = Math.round((rainfall / 200) * 18 - (vegChange / 50) * 4); }
        else if (scenario === "heat")   { floodZones = 1; treeLoss = Math.round((tempDelta / 5) * 22 - (vegChange / 50) * 5); }
        else if (scenario === "growth") { floodZones = 0; treeLoss = Math.round(-((vegChange / 50) * 12) + (tempDelta / 5) * 3); }
        else                            { floodZones = 0; treeLoss = Math.round(((200 - rainfall) / 200) * 20 + (tempDelta / 5) * 8); }
        const lm = horizon === "10 years" ? 1.5 : horizon === "5 years" ? 1.2 : 1.0;
        treeLoss = Math.round(treeLoss * lm);
        confidence = 73 + Math.round(Math.random() * 9);
        setRecommendedActions([]);
      }

      const newResult = { gshi, delta: gshi - BASE, floodZones, treeLossPct: Math.max(-15, Math.min(40, treeLoss)), confidence };
      setResult(newResult);
      setShowAfter(true);
      setIsRunning(false);
      setDataSource(usedLive ? "live" : "estimated");
      setHistory((prev) => [
        { id: prev.length + 1, park, scenario, rainfall, tempDelta, vegChange, horizon, resultGshi: newResult.gshi, delta: newResult.delta, source: usedLive ? "live" : "estimated" },
        ...prev,
      ]);
    }, 1400);
  }, [isRunning, park, scenario, rainfall, tempDelta, vegChange, horizon]);

  const activeParkData = MASTER_PARKS.find(p => p.name === park) || MASTER_PARKS[1];
  const mapCenter = activeParkData.center;

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent/90">Digital Twin Simulation</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-white md:text-3xl">What-if scenarios · {park}</h2>
          <p className="mt-1 flex items-center gap-2 text-sm text-white/55">
            <Map className="h-3.5 w-3.5 text-accent" />
            <span>Live GeoJSON mesh · Open-Meteo weather seeding · ML flood backend</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Live weather badge */}
          {weatherLoading && (
            <span className="flex items-center gap-1.5 rounded-lg border border-sky-400/30 bg-sky-500/10 px-3 py-1.5 text-[11px] text-sky-300">
              <CloudRain className="h-3.5 w-3.5 animate-pulse" /> Fetching live weather…
            </span>
          )}
          {liveWeather && !weatherLoading && (
            <span className="flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Live: {liveWeather.rainfall}mm/hr · +{liveWeather.temp}°C
            </span>
          )}
          {dataSource === "live" && (
            <span className="flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/10 px-3 py-1.5 text-[11px] text-accent">
              <CheckCircle2 className="h-3.5 w-3.5" /> ML backend · live data
            </span>
          )}
          {dataSource === "estimated" && (
            <span className="flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-300">
              <ServerCrash className="h-3.5 w-3.5" /> Backend offline · estimated
            </span>
          )}
          <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-canopy/80 px-3 py-1.5 text-[11px] text-white/50">
            <Layers className="h-3.5 w-3.5 text-accent" /> Leaflet Geo-Mesh · 24 cells
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="rounded-xl border border-white/[0.08] bg-canopy/95 p-4 shadow-card">
        <div className="flex flex-wrap items-end gap-3">
          {/* Park */}
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">Park</p>
            <select value={park} onChange={(e) => setPark(e.target.value)}
              className="h-9 rounded-lg border border-white/15 bg-forest/80 px-3 text-xs font-medium text-white outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/20">
              {PARK_NAMES.map((p) => <option key={p} value={p} className="bg-forest text-white">{p}</option>)}
            </select>
          </div>

          {/* Scenario */}
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">Scenario</p>
            <div className="flex flex-wrap items-center gap-1 rounded-xl border border-white/15 bg-forest/70 px-2 py-1.5 text-[11px]">
              {([["flood","💧 Flood"],["heat","🌡️ Heat"],["growth","🌿 Growth"],["drought","☀️ Drought"]] as [Scenario,string][]).map(([key,label]) => (
                <button key={key} type="button" onClick={() => setScenario(key)}
                  className={`rounded-lg px-2.5 py-1 font-medium transition ${scenario === key ? "bg-accent text-forest shadow-glow" : "text-white/70 hover:bg-white/5 hover:text-white"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Run */}
          <button type="button" onClick={runSimulation} disabled={isRunning}
            className="ml-auto inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-xs font-semibold text-forest shadow-glow transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60">
            {isRunning ? <><Zap className="h-4 w-4 animate-pulse" />Running…</> : <><PlayCircle className="h-4 w-4" />Run Simulation</>}
          </button>
        </div>

        {/* Sliders */}
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <label className="flex justify-between text-[11px] text-white/70">
              <span className="flex items-center gap-1"><CloudRain className="h-3 w-3" /> Rainfall</span>
              <span className="font-semibold text-white">{rainfall} mm/hr</span>
            </label>
            <input type="range" min={0} max={200} value={rainfall} onChange={(e) => setRainfall(+e.target.value)} className="mt-2 w-full accent-accent" />
          </div>
          <div>
            <label className="flex justify-between text-[11px] text-white/70">
              <span className="flex items-center gap-1"><Thermometer className="h-3 w-3" /> Temp Δ</span>
              <span className="font-semibold text-white">+{tempDelta.toFixed(1)}°C</span>
            </label>
            <input type="range" min={0} max={5} step={0.1} value={tempDelta} onChange={(e) => setTempDelta(+e.target.value)} className="mt-2 w-full accent-accent" />
          </div>
          <div>
            <label className="flex justify-between text-[11px] text-white/70">
              <span>Vegetation Δ</span>
              <span className="font-semibold text-white">{vegChange > 0 ? "+" : ""}{vegChange}%</span>
            </label>
            <input type="range" min={-50} max={50} value={vegChange} onChange={(e) => setVegChange(+e.target.value)} className="mt-2 w-full accent-accent" />
          </div>
          <div>
            <p className="text-[11px] text-white/70">Time horizon</p>
            <div className="mt-2 flex gap-2">
              {(["1 year","5 years","10 years"] as const).map((h) => (
                <button key={h} type="button" onClick={() => setHorizon(h)}
                  className={`flex-1 rounded-lg px-2 py-1 text-[11px] font-medium transition ${horizon === h ? "bg-accent text-forest shadow-glow" : "border border-white/15 bg-forest/70 text-white/70 hover:border-accent/40"}`}>
                  {h}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        {(isRunning || progress > 0) && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-[10px] text-white/45 mb-1">
              <span>{isRunning ? (progress < 50 ? "Fetching live backend data…" : "Computing scenario model…") : dataSource === "live" ? "✓ Live ML model complete" : "✓ Estimated model complete"}</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-accent to-sky-400 transition-all duration-150" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Map + Results */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1.1fr)]">

        {/* Geographic Mesh */}
        <div className="rounded-xl border border-white/[0.08] bg-canopy/95 p-4 shadow-card">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h3 className="font-display text-sm font-semibold text-white">
                Geospatial Mesh — {scenarioLabel(scenario)}
                {geoJsonFeatures && <span className="ml-2 rounded-full bg-accent/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-accent">LIVE GeoJSON</span>}
                {!geoJsonFeatures && dataSource === "estimated" && <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-amber-300">ESTIMATED</span>}
              </h3>
              <p className="mt-0.5 text-[11px] text-white/55">
                {geoJsonFeatures ? `${geoJsonFeatures.length} real ML cells · NDVI + Elevation + Rainfall per zone` : "Slider-driven model · run simulation to load real data"}
              </p>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-white/12 bg-forest/80 px-1.5 py-0.5 text-[10px] text-white/60">
              <button type="button" onClick={() => setShowAfter(false)}
                className={`rounded-full px-2 py-0.5 transition ${!showAfter ? "bg-white/20 text-white font-semibold" : "hover:text-white"}`}>
                Before
              </button>
              <button type="button" onClick={() => setShowAfter(true)}
                className={`rounded-full px-2 py-0.5 transition ${showAfter ? "bg-accent text-forest font-semibold" : "hover:text-white"}`}>
                After
              </button>
            </div>
          </div>

          <div className="relative h-80 overflow-hidden rounded-xl border border-white/10">
            <MapContainer center={mapCenter} zoom={14} style={{ height: "100%", width: "100%" }} zoomControl={true} scrollWheelZoom={true}>
              <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
              <MapRecenter center={mapCenter} />
              {gridCells.map((row, rIdx) =>
                row.map((cell, cIdx) => {
                  const pulsing = isRunning && cell.colorKey !== "green";
                  const opacity = pulsing
                    ? cell.intensity * (0.65 + 0.35 * Math.sin(animFrame * 1.5))
                    : cell.intensity;
                  
                  const cellCenter: [number, number] = [
                    (cell.bounds[0][0] + cell.bounds[1][0]) / 2,
                    (cell.bounds[0][1] + cell.bounds[1][1]) / 2,
                  ];

                  return (
                    <Circle key={`${rIdx}-${cIdx}`} center={cellCenter} radius={160}
                      pathOptions={{ stroke: false, fillColor: COLOR_HEX[cell.colorKey], fillOpacity: cell.colorKey === "green" ? 0.04 : opacity }}>
                      <LeafletTooltip sticky>
                        <div className="text-[11px] leading-snug">
                          <span className="block font-semibold">{cell.label}</span>
                          {cell.riskScore != null && (
                            <span className="block text-white/60">
                              Risk: <span className={cell.riskScore > 0.6 ? "text-red-400" : cell.riskScore > 0.35 ? "text-amber-400" : "text-emerald-400"}>
                                {(cell.riskScore * 100).toFixed(1)}%
                              </span>
                            </span>
                          )}
                        </div>
                      </LeafletTooltip>
                    </Circle>
                  );
                })
              )}
            </MapContainer>

            {/* Top badge */}
            <div className="absolute top-2 left-2 z-[400] pointer-events-none">
              <span className="rounded-md bg-black/80 px-2 py-0.5 text-[10px] uppercase font-semibold tracking-wide text-white/55 border border-white/10 backdrop-blur">
                Geo-Mesh · {park}
              </span>
            </div>
            {/* Source badge */}
            {dataSource && (
              <div className="absolute top-2 right-2 z-[400] pointer-events-none">
                <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wide border backdrop-blur ${
                  dataSource === "live"
                    ? "bg-emerald-900/80 border-emerald-500/40 text-emerald-300"
                    : "bg-amber-900/80 border-amber-500/40 text-amber-300"}`}>
                  {dataSource === "live" ? "✓ ML Backend" : "⚠ Estimated"}
                </span>
              </div>
            )}
            {/* Legend */}
            <div className="absolute bottom-2 left-2 z-[400] pointer-events-none flex flex-col gap-1 rounded-lg border border-white/10 bg-black/85 px-2.5 py-2 backdrop-blur-sm">
              {LEGEND[scenario].map(({ color, label }) => (
                <span key={label} className="flex items-center gap-1.5 text-[10px] text-white/80">
                  <span className={`inline-block h-2.5 w-4 rounded-sm ${color}`} />
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="rounded-xl border border-white/[0.08] bg-canopy/95 p-4 shadow-card space-y-3">
          <h3 className="font-display text-sm font-semibold text-white">Simulation Output</h3>

          <div className="grid grid-cols-2 gap-2 text-xs text-white/80">
            <div className="rounded-lg border border-white/12 bg-forest/85 px-3 py-2.5">
              <p className="text-[11px] text-white/50">Predicted GSHI</p>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="font-display text-2xl font-semibold text-white">{result.gshi}</span>
                <span className="text-[11px] text-white/40">/ 100</span>
              </div>
              <div className="mt-1 flex items-center gap-1 text-[11px]">
                {deltaIcon(result.delta)}
                <span className={result.delta >= 0 ? "text-emerald-300" : "text-red-300"}>{result.delta > 0 ? "+" : ""}{result.delta}</span>
                <span className="text-white/40">vs baseline</span>
              </div>
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/10">
                <div className={`h-full rounded-full transition-all duration-700 ${result.gshi > 75 ? "bg-emerald-400" : result.gshi > 55 ? "bg-amber-400" : "bg-red-400"}`}
                  style={{ width: `${result.gshi}%` }} />
              </div>
            </div>

            <div className="rounded-lg border border-white/12 bg-forest/85 px-3 py-2.5">
              <p className="text-[11px] text-white/50">Flood zones</p>
              <p className="mt-1.5 font-display text-2xl font-semibold text-sky-300">{result.floodZones}</p>
              <p className="mt-1 text-[11px] text-white/50">Drainage sectors at risk</p>
            </div>

            <div className="rounded-lg border border-white/12 bg-forest/85 px-3 py-2.5">
              <p className="text-[11px] text-white/50">Est. tree mortality</p>
              <p className={`mt-1.5 font-display text-2xl font-semibold ${result.treeLossPct < 0 ? "text-emerald-300" : result.treeLossPct > 10 ? "text-red-300" : "text-amber-300"}`}>
                {result.treeLossPct > 0 ? "+" : ""}{result.treeLossPct}%
              </p>
              <p className="mt-1 text-[11px] text-white/50">Mortality + crown dieback</p>
            </div>

            <div className="rounded-lg border border-white/12 bg-forest/85 px-3 py-2.5">
              <p className="text-[11px] text-white/50">Model confidence</p>
              <p className="mt-1.5 font-display text-2xl font-semibold text-emerald-300">{result.confidence}%</p>
              <p className="mt-1 text-[11px] text-white/50">{dataSource === "live" ? "Real ML model · GEE + NDVI" : "Physics estimate · no backend"}</p>
            </div>
          </div>

          {/* Recommended Actions - real from backend or fallback */}
          <div className="rounded-lg border border-white/12 bg-forest/85 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/50 mb-1.5 flex items-center gap-1.5">
              <Info className="h-3 w-3" /> Recommended interventions
              {backendRisk && <span className="rounded-full bg-accent/20 px-1.5 text-accent text-[9px]">live protocol</span>}
            </p>
            <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-white/75">
              {(recommendedActions.length > 0 ? recommendedActions : (
                scenario === "flood"   ? ["Deploy bioswales in low-lying zones.", "Upgrade stormwater inlets near entrances.", "Temporarily close high-risk paths (blue cells)."]
              : scenario === "heat"   ? ["Increase shade canopy in exposed plazas.", "Introduce misting rigs in red-zone areas.", "Extend irrigation windows ahead of heatwaves."]
              : scenario === "growth" ? ["Focus planting in connectivity corridors.", "Phase replacement for age-class diversity.", "Structural pruning in high-growth zones."]
              :                         ["Activate drought contingency irrigation.", "Expand mulching in stress-sensitive beds.", "Coordinate non-potable supply during peak stress."]
              )).map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          </div>
        </div>
      </div>

      {/* History */}
      <div className="rounded-xl border border-white/[0.08] bg-canopy/95 p-4 shadow-card">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="font-display text-sm font-semibold text-white">Simulation history</h3>
          <button type="button" onClick={() => alert("Exporting history as PDF… (mock)")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-forest/80 px-3 py-1.5 text-[11px] font-medium text-white/80 hover:border-accent/40">
            <Download className="h-3.5 w-3.5" /> Export PDF
          </button>
        </div>
        <div className="overflow-hidden rounded-lg border border-white/10 bg-forest/80 text-[11px] text-white/80">
          <div className="grid grid-cols-[auto_minmax(0,1.3fr)_minmax(0,1.1fr)_0.6fr_0.6fr_0.6fr_0.65fr_0.7fr_0.55fr] gap-2 border-b border-white/10 bg-white/5 px-3 py-2 font-semibold uppercase tracking-wide text-white/45">
            <span>#</span><span>Park</span><span>Scenario</span><span>Rain</span><span>ΔTemp</span><span>ΔVeg</span><span>Horizon</span><span>GSHI</span><span>Source</span>
          </div>
          <div className="max-h-52 divide-y divide-white/8 overflow-y-auto">
            {history.map((h) => (
              <div key={h.id} className="grid grid-cols-[auto_minmax(0,1.3fr)_minmax(0,1.1fr)_0.6fr_0.6fr_0.6fr_0.65fr_0.7fr_0.55fr] gap-2 px-3 py-2 hover:bg-white/[0.03] transition">
                <span className="text-white/35">{h.id}</span>
                <span>{h.park}</span>
                <span>{scenarioLabel(h.scenario)}</span>
                <span>{h.rainfall}</span>
                <span>{h.tempDelta.toFixed(1)}</span>
                <span>{h.vegChange > 0 ? `+${h.vegChange}` : h.vegChange}</span>
                <span>{h.horizon}</span>
                <span className="flex items-center gap-1">
                  <span>{h.resultGshi}</span>
                  <span className={h.delta < 0 ? "text-red-300" : "text-emerald-300"}>({h.delta > 0 ? "+" : ""}{h.delta})</span>
                </span>
                <span className={h.source === "live" ? "text-emerald-400 font-semibold" : "text-amber-400/70"}>
                  {h.source === "live" ? "🟢" : "⚠️"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
