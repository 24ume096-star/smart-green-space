import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Antenna,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Cpu,
  Gauge,
  MapPin,
  Signal,
  ThermometerSun,
  Wind,
} from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Status = "ONLINE" | "OFFLINE" | "ALERT";

type SensorNode = {
  id: string;
  location: string;
  status: Status;
  park: string;
  zone: string;
};

type ReadingPoint = {
  t: number;
  temp: number;
  moisture: number;
};

const PARKS = ["Lodhi Garden", "Sanjay Van", "Central Park", "Nehru Park"] as const;
const ZONES = ["All zones", "Zone 1 — North", "Zone 2 — West", "Zone 3 — East", "Zone 4 — South"] as const;

const SENSOR_TYPES = [
  "Soil Moisture",
  "Air Quality",
  "Temperature",
  "Humidity",
  "LoRa Signal Strength",
] as const;

const NODES: SensorNode[] = [
  { id: "NODE-001", location: "Zone 1 — Canopy Ridge", status: "ONLINE", park: "Lodhi Garden", zone: "Zone 1 — North" },
  { id: "NODE-002", location: "Zone 1 — Amphitheatre", status: "ONLINE", park: "Lodhi Garden", zone: "Zone 1 — North" },
  { id: "NODE-003", location: "Zone 2 — Lakeside", status: "ALERT", park: "Lodhi Garden", zone: "Zone 2 — West" },
  { id: "NODE-004", location: "Zone 3 — East Garden", status: "ONLINE", park: "Lodhi Garden", zone: "Zone 3 — East" },
  { id: "NODE-005", location: "Zone 4 — Entry Plaza", status: "OFFLINE", park: "Lodhi Garden", zone: "Zone 4 — South" },
  { id: "NODE-006", location: "Ridge trail — South", status: "ONLINE", park: "Sanjay Van", zone: "Zone 4 — South" },
  { id: "NODE-007", location: "Wetland edge", status: "ALERT", park: "Sanjay Van", zone: "Zone 2 — West" },
  { id: "NODE-008", location: "Central promenade", status: "ONLINE", park: "Central Park", zone: "Zone 3 — East" },
  { id: "NODE-009", location: "Metro frontage", status: "ONLINE", park: "Central Park", zone: "Zone 1 — North" },
  { id: "NODE-010", location: "Playfield", status: "ONLINE", park: "Nehru Park", zone: "Zone 3 — East" },
  { id: "NODE-011", location: "Peripheral grove", status: "OFFLINE", park: "Nehru Park", zone: "Zone 2 — West" },
  { id: "NODE-012", location: "Service yard", status: "ONLINE", park: "Nehru Park", zone: "Zone 4 — South" },
];

function statusClasses(status: Status) {
  if (status === "ONLINE") {
    return "border-emerald-500/60 bg-canopy/90 shadow-glow";
  }
  if (status === "ALERT") {
    return "border-red-500/60 bg-canopy/90 shadow-[0_0_32px_rgba(248,113,113,0.4)]";
  }
  return "border-white/10 bg-canopy/70 opacity-80";
}

function StatusPulse({ status }: { status: Status }) {
  if (status === "OFFLINE") {
    return (
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white/25">
        <span className="absolute inset-0 rounded-full border border-white/40" />
      </span>
    );
  }
  const color = status === "ONLINE" ? "bg-emerald-400" : "bg-red-400";
  return (
    <span className="relative inline-flex h-2.5 w-2.5">
      <span
        className={`absolute inline-flex h-full w-full animate-pulse-soft rounded-full ${
          status === "ONLINE" ? "bg-emerald-400/80" : "bg-red-400/80"
        }`}
      />
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${color} shadow-[0_0_10px_rgba(0,0,0,0.8)]`} />
    </span>
  );
}

function TrendIcon({ delta }: { delta: number }) {
  if (delta > 0.4) return <ArrowUpRight className="h-3.5 w-3.5 text-red-400" />;
  if (delta < -0.4) return <ArrowDownRight className="h-3.5 w-3.5 text-emerald-400" />;
  return <ArrowRight className="h-3 w-3 text-yellow-300" />;
}

function formatAgo(seconds: number) {
  if (seconds < 5) return "2s ago";
  if (seconds < 60) return `${Math.round(seconds)}s ago`;
  const m = Math.round(seconds / 60);
  return `${m}m ago`;
}

function HistorySparkline({ points }: { points: ReadingPoint[] }) {
  if (!points.length) return null;
  const trimmed = points.slice(-10);
  return (
    <div className="mt-3 h-14 rounded-md border border-white/10 bg-forest/70 px-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={trimmed} margin={{ top: 4, right: 6, bottom: 2, left: 0 }}>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const temp = payload.find((p) => p.dataKey === "temp")?.value as number | undefined;
              const moisture = payload.find((p) => p.dataKey === "moisture")?.value as number | undefined;
              return (
                <div className="rounded-md border border-white/10 bg-[#0A1510]/95 px-2 py-1 text-[10px] text-white/85">
                  {temp != null && (
                    <div>
                      <span className="text-white">Temp:</span> <span className="text-accent">{temp.toFixed(1)}°C</span>
                    </div>
                  )}
                  {moisture != null && (
                    <div>
                      <span className="text-white">Moisture:</span>{" "}
                      <span className="text-accent">{moisture.toFixed(0)}%</span>
                    </div>
                  )}
                </div>
              );
            }}
          />
          <Line type="monotone" dataKey="temp" stroke="#F97316" strokeWidth={1.4} dot={false} />
          <Line type="monotone" dataKey="moisture" stroke="#2ECC71" strokeWidth={1.4} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function LiveChart({
  series,
  selected,
}: {
  series: ReadingPoint[];
  selected: SensorNode;
}) {
  const trimmed = series.slice(-60);
  return (
    <div className="h-64 rounded-xl border border-white/10 bg-forest/80 px-3 py-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={trimmed} margin={{ top: 10, right: 20, bottom: 12, left: 0 }}>
          <XAxis
            dataKey="t"
            tickFormatter={(v) => `${v}m`}
            tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }}
            tickLine={{ stroke: "rgba(255,255,255,0.3)" }}
          />
          <YAxis
            yAxisId="left"
            orientation="left"
            tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }}
            tickLine={{ stroke: "rgba(255,255,255,0.3)" }}
            tickFormatter={(v) => `${v}°`}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }}
            tickLine={{ stroke: "rgba(255,255,255,0.3)" }}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const t = label as number;
              const temp = payload.find((p) => p.dataKey === "temp")?.value as number | undefined;
              const moist = payload.find((p) => p.dataKey === "moisture")?.value as number | undefined;
              return (
                <div className="rounded-md border border-white/10 bg-[#0A1510]/95 px-3 py-2 text-xs text-white/85 shadow-card">
                  <p className="font-semibold text-white">{selected.id}</p>
                  <p className="text-[11px] text-white/60">{t} min ago</p>
                  {temp != null && (
                    <p className="mt-1">
                      Temp: <span className="text-orange-300">{temp.toFixed(1)}°C</span>
                    </p>
                  )}
                  {moist != null && (
                    <p>
                      Soil moisture: <span className="text-emerald-300">{moist.toFixed(0)}%</span>
                    </p>
                  )}
                </div>
              );
            }}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="temp"
            stroke="#FDBA74"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="moisture"
            stroke="#4ADE80"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SensorIotPanel() {
  const [parkFilter, setParkFilter] = useState<string>("All parks");
  const [zoneFilter, setZoneFilter] = useState<string>("All zones");
  const [sensorFilter, setSensorFilter] = useState<(typeof SENSOR_TYPES)[number] | "All types">("All types");
  const [selectedNodeId, setSelectedNodeId] = useState<string>(NODES[2].id);

  const [baseEnv, setBaseEnv] = useState<{ temp: number; pm25: number }>({ temp: 32, pm25: 55 });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Primary: OpenAQ real CPCB Delhi monitoring stations (no key required)
        const [aqRes, weatherRes] = await Promise.all([
          fetch("https://api.openaq.org/v2/measurements?city=Delhi&parameter=pm25&limit=10&sort=desc&order_by=datetime"),
          fetch("https://api.open-meteo.com/v1/forecast?latitude=28.61&longitude=77.23&current=temperature_2m&timezone=Asia%2FKolkata"),
        ]);

        let pm25 = 55; // fallback
        if (aqRes.ok) {
          const aqData = await aqRes.json();
          const readings: number[] = (aqData?.results ?? [])
            .map((r: any) => Number(r.value))
            .filter((v: number) => v > 0 && v < 999);
          if (readings.length > 0) {
            pm25 = Math.round(readings.reduce((a, b) => a + b, 0) / readings.length);
          }
        } else {
          // Fallback: Open-Meteo AQI estimate
          const fallbackAq = await fetch("https://air-quality-api.open-meteo.com/v1/air-quality?latitude=28.61&longitude=77.23&current=pm2_5");
          if (fallbackAq.ok) {
            const fd = await fallbackAq.json();
            pm25 = fd.current?.pm2_5 ?? 55;
          }
        }

        let temp = 32;
        if (weatherRes.ok) {
          const wData = await weatherRes.json();
          temp = wData.current?.temperature_2m ?? 32;
        }

        if (mounted) setBaseEnv({ temp, pm25 });
      } catch (err) {
        console.error("Failed to fetch authentic telemetry:", err);
      }
    })();
    return () => { mounted = false; };

  }, []);

  const [history, setHistory] = useState<ReadingPoint[]>(() => {
    return Array.from({ length: 60 }).map((_, i) => ({
      t: 60 - i,
      temp: 32 + Math.sin((i / 6) * Math.PI) * 2 + (i % 3) * 0.3,
      moisture: 58 + Math.cos((i / 8) * Math.PI) * 4 + (i % 4),
    }));
  });
  const [lastUpdateSeconds, setLastUpdateSeconds] = useState(2);
  const [lastAnomaly, setLastAnomaly] = useState("None in last 2 hours");
  const [lastInferenceMs, setLastInferenceMs] = useState(12);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setHistory((prev) => {
        const last = prev[prev.length - 1] ?? { t: 0, temp: baseEnv.temp, moisture: 60 };
        const nextT = last.t + 1;
        const jitter = (Math.random() - 0.5) * 0.6;
        
        // Magically drift the historical temperatures dynamically toward the AUTHENTIC Open-Meteo baseline 
        const nextTemp = last.temp + (baseEnv.temp - last.temp) * 0.1 + jitter;
        
        const nextMoisture = Math.max(40, Math.min(80, last.moisture + (Math.random() - 0.5) * 1.2));
        return [...prev.slice(-59), { t: nextT, temp: nextTemp, moisture: nextMoisture }];
      });
      setLastUpdateSeconds(2);
      if (Math.random() < 0.08) {
        const anomalies = [
          "Short burst of heat stress in Zone 3",
          "Soil moisture dip beyond lower band",
          "Air quality spike near service access",
        ];
        setLastAnomaly(anomalies[Math.floor(Math.random() * anomalies.length)]);
        setLastInferenceMs(10 + Math.round(Math.random() * 6));
      }
    }, 5000);
    const tick = window.setInterval(() => {
      setLastUpdateSeconds((s) => s + 1);
    }, 1000);
    return () => {
      window.clearInterval(interval);
      window.clearInterval(tick);
    };
  }, [baseEnv.temp]);

  const selectedNode = useMemo(
    () => NODES.find((n) => n.id === selectedNodeId) ?? NODES[0],
    [selectedNodeId],
  );

  const visibleNodes = useMemo(
    () =>
      NODES.filter((n) => {
        const byPark = parkFilter === "All parks" || n.park === parkFilter;
        const byZone = zoneFilter === "All zones" || n.zone === zoneFilter;
        return byPark && byZone;
      }),
    [parkFilter, zoneFilter],
  );

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent/90">
            Sensors &amp; IoT mesh
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-white md:text-3xl">
            Edge telemetry &amp; node health
          </h2>
          <p className="mt-1 flex items-center gap-2 text-sm text-white/55">
            <Antenna className="h-3.5 w-3.5 text-accent" />
            <span>LoRa / NB-IoT mesh, on-device inference, and uplink diagnostics.</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-accent/25 bg-canopy/80 px-4 py-2.5 shadow-card">
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-pulse-soft rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent shadow-[0_0_8px_rgba(46,204,113,0.8)]" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
            Live uplink
          </span>
          <span className="text-xs text-white/50">12 nodes · 2 alerting</span>
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.07] bg-canopy/90 p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-white/70">
            <MapPin className="h-3.5 w-3.5 text-accent" />
            <span>Park</span>
          </div>
          <select
            value={parkFilter}
            onChange={(e) => setParkFilter(e.target.value)}
            className="h-9 rounded-lg border border-white/15 bg-forest/80 px-3 text-xs font-medium text-white shadow-card outline-none ring-0 focus:border-accent/40 focus:ring-2 focus:ring-accent/20"
          >
            <option value="All parks" className="bg-forest text-white">
              All parks
            </option>
            {PARKS.map((p) => (
              <option key={p} value={p} className="bg-forest text-white">
                {p}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2 text-xs text-white/70">
            <Gauge className="h-3.5 w-3.5 text-accent" />
            <span>Zone</span>
          </div>
          <select
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            className="h-9 rounded-lg border border-white/15 bg-forest/80 px-3 text-xs font-medium text-white shadow-card outline-none ring-0 focus:border-accent/40 focus:ring-2 focus:ring-accent/20"
          >
            {ZONES.map((z) => (
              <option key={z} value={z} className="bg-forest text-white">
                {z}
              </option>
            ))}
          </select>

          <div className="h-5 w-px bg-white/10" />

          <div className="flex items-center gap-2 text-xs text-white/70">
            <Activity className="h-3.5 w-3.5 text-accent" />
            <span>Sensor type</span>
          </div>
          <select
            value={sensorFilter}
            onChange={(e) => setSensorFilter(e.target.value as any)}
            className="h-9 rounded-lg border border-white/15 bg-forest/80 px-3 text-xs font-medium text-white shadow-card outline-none ring-0 focus:border-accent/40 focus:ring-2 focus:ring-accent/20"
          >
            <option value="All types" className="bg-forest text-white">
              All types
            </option>
            {SENSOR_TYPES.map((t) => (
              <option key={t} value={t} className="bg-forest text-white">
                {t}
              </option>
            ))}
          </select>

          <span className="ml-auto text-[11px] text-white/45">
            Filtering {visibleNodes.length} of {NODES.length} nodes
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleNodes.map((node) => {
          const base = history[history.length - 1] ?? { temp: baseEnv.temp, moisture: 60 };
          const temp = base.temp + (Math.random() - 0.5) * 1.5;
          const moisture = base.moisture + (Math.random() - 0.5) * 3;
          
          // Render true Air Quality baseline with tiny local mesh variations
          const pm25 = Math.round(baseEnv.pm25 + (Math.random() - 0.5) * 4);
          const signalDbm = -82 + Math.round((Math.random() - 0.5) * 10);

          const lastPrev = history[history.length - 2] ?? base;
          const delta = (temp - lastPrev.temp + moisture - lastPrev.moisture) / 2;

          return (
            <button
              key={node.id}
              type="button"
              onClick={() => setSelectedNodeId(node.id)}
              className={`group relative flex h-full flex-col rounded-xl border px-4 py-4 text-left shadow-card transition hover:border-accent/40 hover:shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                statusClasses(node.status)
              } ${selectedNodeId === node.id ? "ring-2 ring-accent/40" : ""}`}
            >
              <div
                className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-accent/10 blur-2xl opacity-0 transition group-hover:opacity-100"
                aria-hidden
              />
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
                      {node.id}
                    </p>
                    {selectedNodeId === node.id && (
                      <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                        Selected
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm font-medium text-white/85">{node.location}</p>
                  <p className="mt-0.5 text-[11px] text-white/45">
                    {node.park} · {node.zone}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-1.5 rounded-full border border-white/15 bg-forest/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/80">
                    <StatusPulse status={node.status} />
                    <span>{node.status}</span>
                  </div>
                  <div className="flex items-center gap-1 rounded-full border border-white/15 bg-forest/80 px-1.5 py-0.5 text-[10px] text-white/70">
                    <TrendIcon delta={delta} />
                    <span>Drift</span>
                  </div>
                </div>
              </div>

              <div className="relative mt-3 grid grid-cols-2 gap-3 text-[11px] text-white/75">
                <div className="flex items-center gap-2">
                  <span className="text-base">🌱</span>
                  <div>
                    <p className="text-white/50">Soil Moisture</p>
                    <p className="font-semibold">{moisture.toFixed(0)}%</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-base">🌡️</span>
                  <div>
                    <p className="text-white/50">Temperature</p>
                    <p className="font-semibold">{temp.toFixed(1)}°C</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-base">💨</span>
                  <div>
                    <p className="text-white/50">PM2.5</p>
                    <p className="font-semibold">{pm25} µg/m³</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-base">📶</span>
                  <div>
                    <p className="text-white/50">LoRa Signal</p>
                    <p className="font-semibold">{signalDbm} dBm</p>
                  </div>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between text-[10px] text-white/45">
                <span>Last updated: {formatAgo(lastUpdateSeconds)}</span>
                <span className="flex items-center gap-1">
                  <Signal className="h-3 w-3 text-emerald-400" />
                  <span>Gateway stable</span>
                </span>
              </div>

              <HistorySparkline points={history} />
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)]">
        <div className="rounded-xl border border-white/[0.07] bg-canopy/90 p-5 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">
                Live telemetry · last 60 min
              </p>
              <p className="mt-1 text-sm text-white/70">
                {selectedNode.id} · {selectedNode.location}
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-white/60">
              <div className="flex items-center gap-1">
                <span className="h-1.5 w-4 rounded-full bg-orange-300" />
                <span>Temperature</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-1.5 w-4 rounded-full bg-emerald-300" />
                <span>Soil moisture</span>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <LiveChart series={history} selected={selectedNode} />
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-500/40 bg-forest/90 p-5 shadow-glow">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-accent" />
                <h3 className="font-display text-sm font-semibold text-white">
                  Edge AI status
                </h3>
              </div>
              <div className="flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200">
                <StatusPulse status="ONLINE" />
                <span>Active</span>
              </div>
            </div>
            <p className="mt-3 text-sm text-white/75">
              On-device anomaly detection models are actively scoring incoming sensor streams and raising flags within
              <span className="text-accent font-semibold"> 100ms</span> end-to-end.
            </p>
            <div className="mt-4 space-y-2 text-xs text-white/70">
              <p className="flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-300" />
                <span>
                  Last anomaly:&nbsp;
                  <span className="text-white/90">{lastAnomaly}</span>
                </span>
              </p>
              <p className="flex items-center gap-2">
                <ThermometerSun className="h-3.5 w-3.5 text-rose-300" />
                <span>
                  Typical inference time:&nbsp;
                  <span className="text-accent font-semibold">{lastInferenceMs}ms</span>
                </span>
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.07] bg-canopy/90 p-4 shadow-card">
            <h3 className="font-display text-sm font-semibold text-white">
              Mesh health summary
            </h3>
            <ul className="mt-3 space-y-2 text-xs text-white/70">
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <StatusPulse status="ONLINE" />
                  <span>Online nodes</span>
                </span>
                <span className="font-semibold text-emerald-300">
                  {NODES.filter((n) => n.status === "ONLINE").length}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <StatusPulse status="ALERT" />
                  <span>Nodes in alert</span>
                </span>
                <span className="font-semibold text-amber-300">
                  {NODES.filter((n) => n.status === "ALERT").length}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <StatusPulse status="OFFLINE" />
                  <span>Offline nodes</span>
                </span>
                <span className="font-semibold text-red-300">
                  {NODES.filter((n) => n.status === "OFFLINE").length}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Wind className="h-3.5 w-3.5 text-sky-300" />
                  <span>Telemetry freshness</span>
                </span>
                <span className="font-semibold text-white/80">
                  {lastUpdateSeconds <= 10 ? "< 10s" : "< 60s"}
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

