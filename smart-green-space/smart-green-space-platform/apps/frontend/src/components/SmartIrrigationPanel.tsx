import { useState, useEffect } from "react";
import { AlertTriangle, Droplets, Loader2, Map, Settings2, ToggleLeft, ToggleRight } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type ZoneStatus = "IRRIGATING" | "OPTIMAL" | "SCHEDULED" | "CRITICAL";

type Zone = {
  id: string;
  name: string;
  status: ZoneStatus;
};

const ZONES: Zone[] = [
  { id: "Z1", name: "Zone 1 — North Lawn", status: "OPTIMAL" },
  { id: "Z2", name: "Zone 2 — Central Grove", status: "IRRIGATING" },
  { id: "Z3", name: "Zone 3 — East Garden", status: "SCHEDULED" },
  { id: "Z4", name: "Zone 4 — Playfield Edge", status: "CRITICAL" },
  { id: "Z5", name: "Zone 5 — Lakeside", status: "IRRIGATING" },
  { id: "Z6", name: "Zone 6 — Woodland", status: "OPTIMAL" },
  { id: "Z7", name: "Zone 7 — Entry Plaza", status: "SCHEDULED" },
  { id: "Z8", name: "Zone 8 — Service Yard", status: "OPTIMAL" },
];

const WATER_USAGE = Array.from({ length: 14 }).map((_, i) => {
  const day = `D-${13 - i}`;
  const base = 2100 + (i % 5) * 120;
  const weatherAdj = base - (i % 3) * 80;
  return {
    day,
    actual: base + (i % 2 ? 90 : -60),
    target: weatherAdj,
  };
});



const SCHEDULE = ["05:30 AM", "11:15 AM", "07:45 PM"];

function zoneFill(status: ZoneStatus) {
  if (status === "IRRIGATING") return "fill-sky-500/80";
  if (status === "OPTIMAL") return "fill-emerald-500/75";
  if (status === "SCHEDULED") return "fill-amber-400/80";
  return "fill-red-500/85";
}

function zoneStroke(status: ZoneStatus) {
  if (status === "IRRIGATING") return "stroke-sky-200/80";
  if (status === "OPTIMAL") return "stroke-emerald-200/80";
  if (status === "SCHEDULED") return "stroke-amber-200/80";
  return "stroke-red-200/90";
}

export function SmartIrrigationPanel() {
  const [selectedId, setSelectedId] = useState<string>("Z3");
  const [autoMode, setAutoMode] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [rainProb, setRainProb] = useState<{day: string, p: number}[]>([
    { day: "...", p: 0 }, { day: "...", p: 0 }, { day: "...", p: 0 }, 
    { day: "...", p: 0 }, { day: "...", p: 0 }, { day: "...", p: 0 }, { day: "...", p: 0 }
  ]);
  const [liveMoisture, setLiveMoisture] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=28.58&longitude=77.21&daily=precipitation_probability_max&timezone=auto&current=soil_moisture_1_to_3cm');
        if (!res.ok) throw new Error("Weather fetch failed");
        const data = await res.json();
        
        if (!mounted) return;

        // Pulling Live Soil Moisture fraction directly from atmospheric sensing arrays
        if (data.current && data.current.soil_moisture_1_to_3cm !== undefined && data.current.soil_moisture_1_to_3cm !== null) {
            setLiveMoisture(data.current.soil_moisture_1_to_3cm * 100);
        }
        
        if (data && data.daily) {
           const times = data.daily.time;
           const probs = data.daily.precipitation_probability_max;
           const mappedProb = times.map((t: string, i: number) => {
               // Format ISO date (e.g. 2026-04-11) into short day (e.g. "Thu")
               const dateObj = new Date(t);
               const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
               return { day: dayName, p: probs[i] ?? 0 };
           });
           setRainProb(mappedProb.slice(0, 7)); // guaranteed max 7 items mapped
        }
      } catch (err) {
        console.error("Failed to fetch genuine rain probabilities:", err);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const imminentRain = rainProb.find(r => r.p > 50);

  const selected = ZONES.find((z) => z.id === selectedId) ?? ZONES[0];

  function handleIrrigateNow() {
    if (isRunning) return;
    setShowConfirm(true);
  }

  function confirmIrrigation() {
    setShowConfirm(false);
    setIsRunning(true);
    window.setTimeout(() => {
      setIsRunning(false);
    }, 1500);
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent/90">
            Smart irrigation
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-white md:text-3xl">
            Precise water control &amp; scheduling
          </h2>
          <p className="mt-1 flex items-center gap-2 text-sm text-white/55">
            <Droplets className="h-3.5 w-3.5 text-accent" />
            <span>Zone-based irrigation with weather-aware automation and live overrides.</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.3fr)_minmax(0,1.1fr)]">
        <div className="rounded-xl border border-white/[0.08] bg-canopy/95 p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-sm font-semibold text-white">Zone map</h3>
              <p className="mt-0.5 text-[11px] text-white/60">
                Click a zone to inspect moisture, schedule, and overrides.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-white/15 bg-forest/80 px-2 py-0.5 text-[10px] text-white/70">
              <Map className="h-3 w-3 text-accent" />
              <span>8 irrigation zones</span>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            <div className="relative h-56 rounded-xl border border-white/12 bg-forest/90 p-3">
              <svg viewBox="0 0 100 80" className="h-full w-full">
                {ZONES.map((zone, idx) => {
                  const row = Math.floor(idx / 4);
                  const col = idx % 4;
                  const x = 5 + col * 23;
                  const y = 8 + row * 30;
                  const isSelected = zone.id === selected.id;
                  const status = zone.status;
                  const baseFill = zoneFill(status);
                  const stroke = zoneStroke(status);
                  const isIrrigating = status === "IRRIGATING";
                  const pulseClass = isIrrigating ? "animate-pulse-soft" : "";
                  return (
                    <g key={zone.id} onClick={() => setSelectedId(zone.id)} className="cursor-pointer">
                      <rect
                        x={x}
                        y={y}
                        width={20}
                        height={24}
                        rx={3}
                        className={`${baseFill} ${stroke} ${pulseClass}`}
                        opacity={isSelected ? 0.95 : 0.8}
                      />
                      <rect
                        x={x}
                        y={y}
                        width={20}
                        height={24}
                        rx={3}
                        className={`fill-none stroke-[1.5] ${
                          isSelected ? "stroke-white" : "stroke-black/40"
                        }`}
                        strokeDasharray={isSelected ? "0" : "2 2"}
                      />
                      <text
                        x={x + 10}
                        y={y + 13}
                        textAnchor="middle"
                        alignmentBaseline="middle"
                        fontSize="6"
                        fill="#0F1B12"
                        fontWeight={700}
                      >
                        {zone.id}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px] text-white/70">
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-sky-500" /> Blue = currently irrigating
              </div>
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Green = optimal moisture
              </div>
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-400" /> Yellow = low, scheduled
              </div>
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-red-500" /> Red = critically dry
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-canopy/95 p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">
                Zone detail
              </p>
              <h3 className="mt-1 font-display text-lg font-semibold text-white">
                {selected.id} · {selected.name}
              </h3>
              <p className="mt-0.5 text-[11px] text-white/60">Soil, weather, and schedule for this zone.</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)]">
            <div className="flex flex-col gap-3">
              <div className="rounded-lg border border-white/12 bg-forest/85 px-3 py-3">
                <p className="text-[11px] text-white/60">Current soil moisture</p>
                <div className="mt-2 flex items-center gap-3">
                  <div className="relative h-20 w-20 rounded-full border border-white/15 bg-forest/90">
                    <div className={`absolute inset-2 rounded-full bg-gradient-to-b ${liveMoisture && liveMoisture < 30 ? "from-red-400/80 to-red-600/90" : liveMoisture && liveMoisture > 45 ? "from-sky-400/80 to-sky-600/90" : "from-emerald-400/80 to-emerald-600/90"}`}>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="font-display text-xl font-semibold text-emerald-50">
                          {liveMoisture !== null ? `${liveMoisture.toFixed(0)}%` : "38%"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1 text-[11px] text-white/70">
                    <p>Target band: 30% – 45%</p>
                    <p>
                      Status: <span className={`font-semibold ${liveMoisture && liveMoisture < 30 ? "text-red-400" : liveMoisture && liveMoisture > 45 ? "text-sky-300" : "text-emerald-300"}`}>
                        {liveMoisture && liveMoisture < 30 ? "Critically dry" : liveMoisture && liveMoisture > 45 ? "Saturated" : "Optimal"}
                      </span>
                    </p>
                    <p>Last irrigated: 6 hours ago</p>
                    <p>
                      Water used today: <span className="font-semibold text-white/85">240 L</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-sky-400/40 bg-sky-900/40 px-3 py-2.5 text-[11px] text-sky-100">
                <p className="font-semibold uppercase tracking-wide">Weather forecast</p>
                <p className="mt-1">
                  {imminentRain ? (
                    <>
                      Rain expected soon <span className="font-semibold">({imminentRain.p}% chance)</span> —{" "}
                      <span className="font-semibold text-sky-50">irrigation paused</span> for this zone.
                    </>
                  ) : (
                    <>
                      Clear skies expected ahead —{" "}
                      <span className="font-semibold text-emerald-100">automated schedule proceeding</span> safely.
                    </>
                  )}
                </p>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-lg border border-white/12 bg-forest/85 px-3 py-2.5">
                <div className="flex items-center gap-2 text-[11px] text-white/70">
                  <Settings2 className="h-3.5 w-3.5 text-accent" />
                  <div>
                    <p className="font-semibold text-white/80">Auto mode</p>
                    <p className="text-[10px] text-white/55">Weather &amp; soil driven scheduling.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoMode((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-forest/80 px-2 py-1 text-[10px] font-semibold text-white/80"
                >
                  {autoMode ? (
                    <>
                      <ToggleRight className="h-4 w-4 text-emerald-400" />
                      <span>ON</span>
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="h-4 w-4 text-white/40" />
                      <span>OFF</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleIrrigateNow}
                  disabled={!autoMode || isRunning}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-forest shadow-glow transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Droplets className="h-4 w-4" />}
                  {isRunning ? "Irrigating…" : "Irrigate Now"}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="rounded-lg border border-white/12 bg-forest/85 px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-white/60">
                  Scheduled irrigation
                </p>
                <ul className="mt-1 space-y-1.5 text-[11px] text-white/75">
                  {SCHEDULE.map((t) => (
                    <li
                      key={t}
                      className="flex items-center justify-between rounded-md border border-white/10 bg-black/20 px-2 py-1"
                    >
                      <span>{t}</span>
                      <span className="text-white/45">Weather-adjusted</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-white/12 bg-forest/85 px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-white/60">
                  Rain probability · next 7 days
                </p>
                <div className="mt-2 flex gap-2 text-[10px] text-white/70">
                  {rainProb.map((d, idx) => (
                    <div key={idx} className="flex-1 space-y-1">
                      <div className="h-14 rounded-full border border-white/10 bg-black/40 p-1">
                        <div
                          className="h-full w-full rounded-full bg-gradient-to-t from-sky-500 to-sky-300"
                          style={{ clipPath: `inset(${100 - d.p}% 0 0 0)` }}
                          aria-hidden
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-white/60">{d.day}</span>
                        <span className="font-semibold text-sky-200">{d.p}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-canopy/95 p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-sm font-semibold text-white">
              System summary
            </h3>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-white/80">
            <div className="rounded-lg border border-white/12 bg-forest/85 px-3 py-2">
              <p className="text-[11px] text-white/60">Total water used today</p>
              <p className="mt-1 font-display text-xl font-semibold text-white">
                2,840 L
              </p>
            </div>
            <div className="rounded-lg border border-white/12 bg-forest/85 px-3 py-2">
              <p className="text-[11px] text-white/60">Water saved vs manual</p>
              <p className="mt-1 font-display text-xl font-semibold text-emerald-300">
                34%
              </p>
            </div>
            <div className="rounded-lg border border-white/12 bg-forest/85 px-3 py-2">
              <p className="text-[11px] text-white/60">Active zones</p>
              <p className="mt-1 font-display text-xl font-semibold text-sky-300">
                2
              </p>
            </div>
            <div className="rounded-lg border border-white/12 bg-forest/85 px-3 py-2">
              <p className="text-[11px] text-white/60">Zones in auto mode</p>
              <p className="mt-1 font-display text-xl font-semibold text-white">
                6
              </p>
            </div>
            <div className="rounded-lg border border-white/12 bg-forest/85 px-3 py-2">
              <p className="text-[11px] text-white/60">Next scheduled run</p>
              <p className="mt-1 font-display text-xl font-semibold text-white">
                05:30 AM
              </p>
            </div>
            {liveMoisture && liveMoisture < 30 ? (
              <div className="rounded-lg border border-red-500/50 bg-red-900/40 px-3 py-2 text-red-100">
                <p className="text-[11px] font-semibold uppercase tracking-wide">
                  System Alert
                </p>
                <p className="mt-1 flex items-start gap-1.5 text-[11px]">
                  <AlertTriangle className="mt-[2px] h-3.5 w-3.5" />
                  <span>Soil moisture critically low ({liveMoisture.toFixed(1)}%) — auto irrigation triggered globally.</span>
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-emerald-500/50 bg-emerald-900/40 px-3 py-2 text-emerald-100">
                <p className="text-[11px] font-semibold uppercase tracking-wide">
                  System Nominal
                </p>
                <p className="mt-1 flex items-start gap-1.5 text-[11px]">
                  <span>Soil moisture levels optimally saturated. Background scheduling maintained safely.</span>
                </p>
              </div>
            )}
          </div>

          <div className="mt-4 h-40 rounded-lg border border-white/12 bg-forest/85 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/60">
              Daily water usage (last 14 days)
            </p>
            <div className="mt-1 h-32">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={WATER_USAGE} margin={{ top: 6, right: 12, bottom: 4, left: 0 }}>
                  <XAxis
                    dataKey="day"
                    tick={{ fill: "rgba(255,255,255,0.75)", fontSize: 10 }}
                    tickLine={{ stroke: "rgba(255,255,255,0.3)" }}
                  />
                  <YAxis
                    tick={{ fill: "rgba(255,255,255,0.75)", fontSize: 10 }}
                    tickLine={{ stroke: "rgba(255,255,255,0.3)" }}
                    tickFormatter={(v) => `${(v / 1000).toFixed(1)}kL`}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const actual = payload.find((p) => p.dataKey === "actual")?.value as number | undefined;
                      const target = payload.find((p) => p.dataKey === "target")?.value as number | undefined;
                      return (
                        <div className="rounded-md border border-white/10 bg-[#0A1510]/95 px-2.5 py-1.5 text-[11px] text-white/85">
                          {actual != null && (
                            <div>
                              Actual: <span className="text-accent">{actual.toFixed(0)} L</span>
                            </div>
                          )}
                          {target != null && (
                            <div>
                              Target: <span className="text-sky-300">{target.toFixed(0)} L</span>
                            </div>
                          )}
                        </div>
                      );
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="actual"
                    stroke="#2ECC71"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="target"
                    stroke="#38BDF8"
                    strokeDasharray="4 3"
                    strokeWidth={1.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-xl border border-white/15 bg-forest/95 p-4 shadow-glow">
            <p className="text-sm font-semibold text-white">Start manual irrigation?</p>
            <p className="mt-1 text-xs text-white/70">
              You are about to trigger irrigation in {selected.id} · {selected.name}. This will temporarily override the
              automated schedule.
            </p>
            <div className="mt-4 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="rounded-lg border border-white/20 bg-forest/80 px-3 py-1.5 text-white/80 hover:border-accent/40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmIrrigation}
                className="rounded-lg bg-accent px-3 py-1.5 font-semibold text-forest hover:brightness-95"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

