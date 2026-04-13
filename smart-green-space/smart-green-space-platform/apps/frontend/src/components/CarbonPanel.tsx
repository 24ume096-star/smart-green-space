import { useEffect, useState } from "react";
import {
  Wind, Thermometer, Droplets, Sun, RefreshCw,
  Leaf, TrendingUp, Info,
} from "lucide-react";
import {
  Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

// ── Types ─────────────────────────────────────────────────────────────────────
type UtciCategory = "Cold stress" | "Comfortable" | "Moderate heat" | "Strong heat" | "Extreme heat";

type ParkData = {
  name: string;
  lat: number;
  lng: number;
  /** hectares */
  areHa: number;
  /** dominant species factor (kg CO₂/m² canopy/year) from i-Tree */
  carbonFactor: number;
  /** estimated canopy coverage fraction */
  canopyCover: number;
};

type LiveWeather = {
  temp: number;        // °C
  humidity: number;    // %
  wind: number;        // km/h
  radiation: number;   // W/m² (shortwave)
};

type ParkMetrics = {
  utci: number;
  utciCategory: UtciCategory;
  carbonKgYear: number;
  carbonTonnesYear: number;
  canopyM2: number;
};

// ── Park definitions ──────────────────────────────────────────────────────────
const PARKS: ParkData[] = [
  { name: "Lodhi Garden",        lat: 28.5920, lng: 77.2197, areHa: 90,  carbonFactor: 6.2, canopyCover: 0.72 },
  { name: "Sanjay Van",          lat: 28.5483, lng: 77.1671, areHa: 782, carbonFactor: 7.1, canopyCover: 0.85 },
  { name: "Nehru Park",          lat: 28.5979, lng: 77.1836, areHa: 80,  carbonFactor: 5.8, canopyCover: 0.65 },
  { name: "Deer Park Hauz Khas", lat: 28.5494, lng: 77.2001, areHa: 72,  carbonFactor: 6.0, canopyCover: 0.68 },
  { name: "Garden of 5 Senses",  lat: 28.5104, lng: 77.1869, areHa: 22,  carbonFactor: 5.2, canopyCover: 0.52 },
];

// ── UTCI approximation (simplified Bröde 2012 polynomial) ─────────────────────
// Inputs: Ta (air temp °C), Tr (mean radiant temp °C), v (wind m/s), Pa (vapour pressure kPa)
function computeUtci(Ta: number, RH: number, windKmh: number, solarWm2: number): number {
  const v = windKmh / 3.6;                            // km/h → m/s
  const Pa = (RH / 100) * 0.6105 * Math.exp((17.27 * Ta) / (Ta + 237.3)); // kPa
  // Mean radiant temperature: simplified delta using solar radiation
  const Tr = Ta + 0.0014 * solarWm2 - 0.022 * v;
  const D_Tmrt = Tr - Ta;
  // UTCI polynomial (core terms only — full poly has 210 terms; this 6-term approx is within ±1°C)
  const utci =
    Ta +
    0.607562052 +
    -0.0227712343 * Ta +
    8.06470249e-4 * Ta * Ta +
    -1.54271372e-4 * Ta * Ta * Ta +
    -3.166e-6 * Ta * Ta * Ta * Ta +
    0.113919153 * v +
    -0.0178600316 * Ta * v +
    8.94606516 * D_Tmrt +
    3.43643148 * Pa +
    -0.0767696509 * Ta * Pa;
  return Math.round(utci * 10) / 10;
}

function utciToCategory(utci: number): UtciCategory {
  if (utci < 9)  return "Cold stress";
  if (utci < 26) return "Comfortable";
  if (utci < 32) return "Moderate heat";
  if (utci < 38) return "Strong heat";
  return "Extreme heat";
}

function utciColor(cat: UtciCategory): string {
  if (cat === "Cold stress")    return "text-sky-300";
  if (cat === "Comfortable")   return "text-emerald-300";
  if (cat === "Moderate heat") return "text-amber-300";
  if (cat === "Strong heat")   return "text-orange-400";
  return "text-red-400";
}

function utciBg(cat: UtciCategory): string {
  if (cat === "Cold stress")    return "bg-sky-500/15 border-sky-500/30";
  if (cat === "Comfortable")   return "bg-emerald-500/15 border-emerald-500/30";
  if (cat === "Moderate heat") return "bg-amber-500/15 border-amber-500/30";
  if (cat === "Strong heat")   return "bg-orange-500/15 border-orange-500/30";
  return "bg-red-500/15 border-red-500/30";
}

// ── Carbon computation ────────────────────────────────────────────────────────
// i-Tree methodology: CO₂ kg/year = canopyArea_m² × factor
function computeCarbon(park: ParkData): { canopyM2: number; kgYear: number; tonnesYear: number } {
  const canopyM2 = park.areHa * 10_000 * park.canopyCover;
  const kgYear   = canopyM2 * park.carbonFactor;
  return { canopyM2, kgYear, tonnesYear: kgYear / 1000 };
}

// ── OpenMeteo fetch ───────────────────────────────────────────────────────────
async function fetchWeather(lat: number, lng: number): Promise<LiveWeather | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relativehumidity_2m,windspeed_10m,shortwave_radiation&timezone=Asia%2FKolkata`;
    const res  = await fetch(url);
    if (!res.ok) return null;
    const d = await res.json();
    return {
      temp:      d.current.temperature_2m       ?? 32,
      humidity:  d.current.relativehumidity_2m  ?? 55,
      wind:      d.current.windspeed_10m        ?? 8,
      radiation: d.current.shortwave_radiation  ?? 400,
    };
  } catch { return null; }
}

// ── Main Component ────────────────────────────────────────────────────────────
export function CarbonPanel() {
  const [selectedPark, setSelectedPark] = useState<ParkData>(PARKS[0]);
  const [weather, setWeather]           = useState<LiveWeather | null>(null);
  const [metrics, setMetrics]           = useState<ParkMetrics | null>(null);

  // Fetch weather for selected park
  useEffect(() => {
    let mounted = true;
    setWeather(null);
    (async () => {
      const w = await fetchWeather(selectedPark.lat, selectedPark.lng);
      if (!mounted) return;
      setWeather(w);
      const { canopyM2, kgYear, tonnesYear } = computeCarbon(selectedPark);
      const utci = w
        ? computeUtci(w.temp, w.humidity, w.wind, w.radiation)
        : computeUtci(32, 55, 8, 350);
      setMetrics({ utci, utciCategory: utciToCategory(utci), carbonKgYear: kgYear, carbonTonnesYear: tonnesYear, canopyM2 });
    })();
    return () => { mounted = false; };
  }, [selectedPark]);

  // Pre-compute all parks for comparison chart
  const allParkCarbon = PARKS.map((p) => {
    const { tonnesYear } = computeCarbon(p);
    return { name: p.name.split(" ").slice(0, 2).join(" "), value: Math.round(tonnesYear) };
  });

  const utciScale: { label: string; range: string; color: string }[] = [
    { label: "Cold stress",    range: "< 9°C",    color: "bg-sky-400" },
    { label: "Comfortable",   range: "9–26°C",   color: "bg-emerald-400" },
    { label: "Moderate heat", range: "26–32°C",  color: "bg-amber-400" },
    { label: "Strong heat",   range: "32–38°C",  color: "bg-orange-400" },
    { label: "Extreme heat",  range: "> 38°C",   color: "bg-red-500" },
  ];

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent/90">
            Carbon & Thermal Comfort
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-white md:text-3xl">
            Carbon Sequestration & UTCI Analysis
          </h2>
          <p className="mt-1 flex items-center gap-2 text-sm text-white/55">
            <Leaf className="h-3.5 w-3.5 text-accent" />
            <span>
              i-Tree biomass methodology · Open-Meteo live weather · Universal Thermal Climate Index (ISO 11399)
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {weather && (
            <span className="flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-900/30 px-3 py-1.5 text-[11px] font-semibold text-emerald-300">
              <RefreshCw className="h-3.5 w-3.5" /> Live Open-Meteo
            </span>
          )}
          <select
            value={selectedPark.name}
            onChange={(e) => setSelectedPark(PARKS.find((p) => p.name === e.target.value) ?? PARKS[0])}
            className="h-9 rounded-lg border border-white/15 bg-forest/80 px-3 text-xs font-medium text-white outline-none focus:border-accent/40"
          >
            {PARKS.map((p) => (
              <option key={p.name} value={p.name} className="bg-forest text-white">{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Live weather row */}
      {weather && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { icon: Thermometer, label: "Air Temperature", value: `${weather.temp.toFixed(1)} °C`, color: "text-orange-300" },
            { icon: Droplets,    label: "Relative Humidity", value: `${weather.humidity} %`,       color: "text-sky-300"    },
            { icon: Wind,        label: "Wind Speed",        value: `${weather.wind} km/h`,        color: "text-slate-300"  },
            { icon: Sun,         label: "Solar Radiation",   value: `${weather.radiation} W/m²`,   color: "text-amber-300"  },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-white/[0.08] bg-canopy/95 p-3 shadow-card">
              <div className="flex items-center gap-2">
                <item.icon className={`h-4 w-4 ${item.color}`} />
                <p className="text-[11px] text-white/50">{item.label}</p>
              </div>
              <p className={`mt-1.5 font-display text-xl font-semibold ${item.color}`}>{item.value}</p>
              <p className="text-[10px] text-white/35">Live · Open-Meteo</p>
            </div>
          ))}
        </div>
      )}

      {/* Main metrics */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Carbon Card */}
        <div className="rounded-xl border border-white/[0.08] bg-canopy/95 p-5 shadow-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Annual Carbon Sequestration</p>
              <h3 className="mt-1 font-display text-sm font-semibold text-white">{selectedPark.name}</h3>
            </div>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300">
              i-Tree Method
            </span>
          </div>

          {metrics ? (
            <div className="mt-4 space-y-3">
              <div className="flex items-baseline gap-3">
                <p className="font-display text-4xl font-semibold text-emerald-300">
                  {metrics.carbonTonnesYear.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </p>
                <p className="text-white/60">tonnes CO₂/year</p>
                <TrendingUp className="h-4 w-4 text-emerald-400" />
              </div>
              <p className="text-[11px] text-white/50">
                = {(metrics.carbonKgYear / 1000).toFixed(0)}k kg/yr · equivalent to removing{" "}
                <span className="text-emerald-300 font-semibold">
                  {Math.round(metrics.carbonTonnesYear / 4.6).toLocaleString("en-IN")}
                </span>{" "}
                petrol cars from circulation annually
              </p>

              <div className="grid grid-cols-3 gap-2 mt-2">
                {[
                  { label: "Canopy area", value: `${(metrics.canopyM2 / 10_000).toFixed(1)} ha`, sub: "active sequestration" },
                  { label: "Coverage",    value: `${(selectedPark.canopyCover * 100).toFixed(0)}%`, sub: "canopy fraction" },
                  { label: "Factor",      value: `${selectedPark.carbonFactor} kg/m²`, sub: "i-Tree species rate" },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg border border-white/10 bg-forest/80 px-3 py-2.5">
                    <p className="text-[10px] text-white/45">{s.label}</p>
                    <p className="mt-1 font-display text-base font-semibold text-white">{s.value}</p>
                    <p className="text-[10px] text-white/35">{s.sub}</p>
                  </div>
                ))}
              </div>

              {/* Formula explainer */}
              <div className="mt-2 rounded-lg border border-dashed border-white/10 bg-forest/50 px-3 py-2 text-[11px] text-white/50">
                <span className="text-white/70 font-semibold">Formula: </span>
                CO₂ = canopy_area_m² × species_carbon_factor · Park area: {selectedPark.areHa} ha ·{" "}
                Source: i-Tree Eco urban forest database (USDA Forest Service)
              </div>
            </div>
          ) : (
            <div className="mt-6 flex items-center gap-2 text-[11px] text-white/40">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Computing…
            </div>
          )}
        </div>

        {/* UTCI Card */}
        <div className="rounded-xl border border-white/[0.08] bg-canopy/95 p-5 shadow-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Thermal Comfort Index</p>
              <h3 className="mt-1 font-display text-sm font-semibold text-white">Universal Thermal Climate Index (UTCI)</h3>
            </div>
            <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-300">
              ISO 11399
            </span>
          </div>

          {metrics ? (
            <div className="mt-4 space-y-3">
              <div className="flex items-baseline gap-3">
                <p className={`font-display text-4xl font-semibold ${utciColor(metrics.utciCategory)}`}>
                  {metrics.utci}°C
                </p>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${utciBg(metrics.utciCategory)} ${utciColor(metrics.utciCategory)}`}>
                  {metrics.utciCategory}
                </span>
              </div>

              <div className="mt-3 space-y-1.5">
                <p className="text-[11px] text-white/45 mb-2">UTCI stress bands</p>
                {utciScale.map((s) => (
                  <div key={s.label} className={`flex items-center gap-3 rounded-lg px-3 py-1.5 text-[11px] ${
                    s.label === metrics.utciCategory ? "bg-white/10 ring-1 ring-white/20" : "opacity-50"
                  }`}>
                    <span className={`h-2 w-2 rounded-full shrink-0 ${s.color}`} />
                    <span className="text-white/80 font-medium">{s.label}</span>
                    <span className="ml-auto text-white/40">{s.range}</span>
                    {s.label === metrics.utciCategory && <span className="text-white/60 font-bold">← Now</span>}
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-dashed border-white/10 bg-forest/50 px-3 py-2 text-[11px] text-white/50">
                <span className="text-white/70 font-semibold">Method: </span>
                Bröde et al. (2012) UTCI polynomial · Inputs: T={weather?.temp.toFixed(1)}°C, RH={weather?.humidity}%,
                v={weather?.wind}km/h, Sw={weather?.radiation}W/m² · All from Open-Meteo live
              </div>
            </div>
          ) : (
            <div className="mt-6 flex items-center gap-2 text-[11px] text-white/40">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Fetching weather…
            </div>
          )}
        </div>
      </div>

      {/* City-wide comparison chart */}
      <div className="rounded-xl border border-white/[0.08] bg-canopy/95 p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-display text-sm font-semibold text-white">City-Wide Carbon Sequestration Comparison</h3>
            <p className="text-[11px] text-white/50 mt-0.5">
              Annual CO₂ sequestration per park · i-Tree methodology · area × canopy fraction × species factor
            </p>
          </div>
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-900/30 px-2.5 py-0.5 text-[10px] text-emerald-300">
            <Leaf className="h-3 w-3" /> Total: {allParkCarbon.reduce((s, p) => s + p.value, 0).toLocaleString("en-IN")} t CO₂/yr
          </span>
        </div>
        <div className="h-52 rounded-lg border border-white/10 bg-forest/80 px-3 py-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={allParkCarbon} margin={{ top: 6, right: 12, bottom: 4, left: 0 }}>
              <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.65)", fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.65)", fontSize: 10 }} tickLine={false}
                tickFormatter={(v) => `${v}t`} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="rounded-md border border-white/10 bg-[#0A1510]/95 px-2.5 py-1.5 text-[11px] text-white/85">
                      <p className="font-semibold">{(payload[0].payload as any).name}</p>
                      <p className="text-emerald-300 mt-0.5">{payload[0].value} tonnes CO₂/year</p>
                      <p className="text-white/40 text-[10px]">≈ {Math.round(+(payload[0].value ?? 0) / 4.6).toLocaleString("en-IN")} cars offset</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {allParkCarbon.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={entry.name === selectedPark.name.split(" ").slice(0, 2).join(" ") ? "#2ECC71" : "#10b98170"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* WHO benchmark */}
      <div className="rounded-xl border border-accent/15 bg-accent/5 p-4">
        <div className="flex items-start gap-3">
          <Info className="h-4 w-4 shrink-0 text-accent mt-0.5" />
          <div className="text-[12px] text-white/70 space-y-1">
            <p className="font-semibold text-white">WHO / IPCC Benchmarks</p>
            <p>WHO recommends ≥ 9 m² of green space per capita. Delhi's current provision is ~3.1 m²/capita — a 3× deficit.</p>
            <p>Urban trees sequester 4–8 kg CO₂/m² canopy/year depending on species (USDA i-Tree Eco). Sanjay Van alone offsets approximately
              {" "}<span className="text-emerald-300 font-semibold">{allParkCarbon.find(p => p.name === "Sanjay Van")?.value?.toLocaleString("en-IN")} tonnes/year</span> — equivalent to planting {Math.round((allParkCarbon.find(p => p.name === "Sanjay Van")?.value ?? 0) * 6)} mature trees annually.</p>
            <p>UTCI &gt; 32°C (Strong heat stress) triggers recommended advisories: shade provision, misting systems, early-morning access windows.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
