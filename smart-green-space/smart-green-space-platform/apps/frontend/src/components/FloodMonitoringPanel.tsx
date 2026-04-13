import { useEffect, useState, useMemo } from "react";
import { Waves, AlertTriangle, Clock, Map, CheckCircle, Navigation, ShieldAlert, Cpu } from "lucide-react";
import { FloodMapbox3D } from "./FloodMapbox3D";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
const CITY_ID = "delhi-city";

type FloodRiskData = {
  riskScore: number;
  riskLevel: "LOW" | "WATCH" | "WARNING" | "EMERGENCY";
  timeToOverflowMin: number | null;
  affectedZones: string[];
  recommendedActions: string[];
};

type ParkRow = { id: string; name: string; lat?: number; lng?: number };

export function FloodMonitoringPanel({ city: _city }: { city: string }) {
  const [parkId, setParkId] = useState<string>("");
  const [parks, setParks] = useState<ParkRow[]>([]);
  const [riskData, setRiskData] = useState<FloodRiskData | null>(null);
  const [loading, setLoading] = useState(true);
  const [geojsonData, setGeojsonData] = useState<GeoJSON.FeatureCollection | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/parks?cityId=${CITY_ID}&limit=100`);
        const data = await res.json();
        if (!mounted) return;
        const items: ParkRow[] = Array.isArray(data?.data?.items) ? data.data.items : [];
        setParks(items);
        if (items.length > 0) {
          const preferred = items.find((p) => p.id === "delhi-lodhi-garden");
          setParkId((prev) => {
            if (prev && items.some((x) => x.id === prev)) return prev;
            return (preferred ?? items[0]).id;
          });
        }
      } catch (err) {
        console.error("Failed to fetch parks", err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!parkId) return;
    let mounted = true;

    const fetchRisk = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/v1/flood/${parkId}/risk`).catch(() => null);
        if (res && res.ok && mounted) {
          const data = await res.json();
          setRiskData(data);
        }

        const geoRes = await fetch(`${API_BASE}/public/heatmaps/${parkId}_heatmap.geojson`).catch(() => null);
        if (geoRes && geoRes.ok && mounted) {
          const gdata = await geoRes.json();
          setGeojsonData(gdata);
        }
      } catch (err) {
        console.error("Failed to fetch risk", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchRisk();
    const interval = setInterval(fetchRisk, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [parkId]);

  const selectedPark = useMemo(
    () => parks.find((p) => p.id === parkId),
    [parks, parkId]
  );

  const mapCenter = useMemo((): [number, number] => {
    if (selectedPark && typeof selectedPark.lng === "number" && typeof selectedPark.lat === "number") {
      return [selectedPark.lng, selectedPark.lat];
    }
    return [77.2197, 28.5934];
  }, [selectedPark]);

  const rainfallMm = useMemo(() => {
    // Neutral baseline 65mm, increase with risk to visualize storm escalation
    const risk = Number(riskData?.riskScore ?? 0);
    return Math.max(0, Math.min(200, 65 + risk * 0.9));
  }, [riskData?.riskScore]);

  const riverLevel = useMemo(() => {
    // River level signal normalized 0-100, anchored at a typical safe band
    const risk = Number(riskData?.riskScore ?? 0);
    return Math.max(0, Math.min(100, 30 + risk * 0.7));
  }, [riskData?.riskScore]);

  const triggerResponse = async () => {
    if (!parkId || !riskData) return;
    if (riskData.riskLevel === "LOW") {
      alert("Cannot trigger workflow for LOW risk.");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/v1/flood/${parkId}/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riskLevel: riskData.riskLevel }),
      });
      const data = await res.json();
      alert(data.message || "Trigger response initiated.");
    } catch (err) {
      console.error("Failed to trigger", err);
      alert("Failed to trigger response workflow.");
    }
  };

  const getRiskColor = (level?: string) => {
    if (level === "EMERGENCY") return "text-red-400 bg-red-400/10 border-red-400/30";
    if (level === "WARNING") return "text-orange-400 bg-orange-400/10 border-orange-400/30";
    if (level === "WATCH") return "text-yellow-400 bg-yellow-400/10 border-yellow-400/30";
    return "text-accent bg-accent/10 border-accent/30";
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Flood Monitoring
          </h1>
          <p className="mt-1 text-sm text-white/50">
            3D hydrology view (Mapbox terrain) · RF model: NDVI, rainfall intensity, 72h accumulation, water
            proximity, elevation
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={parkId}
            onChange={(e) => setParkId(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 py-2 pl-3 pr-8 text-sm font-medium text-white shadow-sm outline-none transition-all hover:bg-white/10 focus:ring-2 focus:ring-accent/50"
          >
            {parks.length === 0 ? (
              <option value="" className="bg-forest">
                Loading parks…
              </option>
            ) : null}
            {parks.map((p) => (
              <option key={p.id} value={p.id} className="bg-forest">
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={triggerResponse}
            disabled={!riskData || riskData.riskLevel === "LOW"}
            className="flex items-center gap-2 rounded-lg bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-400 outline-none ring-1 ring-red-500/40 transition-all hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ShieldAlert className="h-4 w-4" />
            Trigger Workflow
          </button>
        </div>
      </header>

      {loading && !riskData && !geojsonData ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-3 text-white/40">
            <Cpu className="h-5 w-5 animate-pulse" />
            <span className="text-sm font-medium">Calculating hydrological models…</span>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5 shadow-glass">
              <div className="mb-4 flex items-center gap-3">
                <div className={`rounded-lg border p-2 ${getRiskColor(riskData?.riskLevel)}`}>
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-white/60">Risk Status</h3>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">
                    Current Level
                  </p>
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-4xl font-bold tracking-tight text-white">
                  {riskData?.riskLevel || "LOW"}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5 shadow-glass">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-lg border border-accent/20 bg-accent/10 p-2 text-accent">
                  <Waves className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-white/60">Calculated Score</h3>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">
                    Index (0-100)
                  </p>
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-4xl font-bold tracking-tight text-white">
                  {riskData?.riskScore ?? 0}
                </span>
                <span className="text-sm font-medium text-white/40">/ 100</span>
              </div>
            </div>

            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5 shadow-glass">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-lg border border-blue-400/20 bg-blue-400/10 p-2 text-blue-400">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-white/60">Time to Overflow</h3>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Est. Arrival</p>
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-4xl font-bold tracking-tight text-white">
                  {riskData?.timeToOverflowMin === null ||
                  riskData?.timeToOverflowMin === Infinity ||
                  !riskData
                    ? "Safe"
                    : riskData?.timeToOverflowMin?.toFixed(0)}
                </span>
                {riskData?.timeToOverflowMin &&
                  riskData?.timeToOverflowMin !== Infinity &&
                  Number.isFinite(riskData.timeToOverflowMin) && (
                    <span className="text-sm font-medium text-white/40">mins</span>
                  )}
              </div>
            </div>

            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5 shadow-glass">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/70">
                  <Map className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-white/60">Affected Zones</h3>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">
                    Drainage Sectors
                  </p>
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-4xl font-bold tracking-tight text-white">
                  {riskData?.affectedZones?.length ?? 0}
                </span>
                <span className="text-sm font-medium text-white/40">sectors</span>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="flex h-[520px] flex-col overflow-hidden rounded-xl border border-white/10 bg-black/40 shadow-glass backdrop-blur-xl lg:col-span-2">
              <div className="border-b border-white/10 bg-white/[0.02] p-4">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
                  <Map className="h-4 w-4 text-accent" />
                  3D flood risk (Mapbox terrain + extrusion)
                </h3>
                <p className="mt-1 text-xs text-white/45">
                  ML heatmap extruded by risk; tilt/pan with controls. Click a cell for rainfall &amp; proximity
                  breakdown.
                </p>
              </div>
              <div className="relative min-h-0 flex-1">
                <FloodMapbox3D
                  geojson={geojsonData}
                  center={mapCenter}
                  zoom={13}
                  pitch={58}
                  rainfallMm={rainfallMm}
                  riverLevel={riverLevel}
                />
              </div>
            </div>

            <div className="flex h-[520px] flex-col rounded-xl border border-white/10 bg-black/40 p-6 shadow-glass backdrop-blur-xl">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
                <Navigation className="h-4 w-4 text-accent" />
                Recommended Protocol
              </h3>
              {riskData?.recommendedActions && riskData.recommendedActions.length > 0 ? (
                <ul className="flex flex-1 flex-col gap-4 overflow-y-auto pt-2">
                  {riskData.recommendedActions.map((action, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-4 rounded-lg border border-white/5 bg-white/5 p-4"
                    >
                      <div className="mt-0.5 rounded-full bg-accent/20 p-1 text-accent ring-1 ring-accent/30">
                        <CheckCircle className="h-4 w-4" />
                      </div>
                      <p className="text-sm font-medium leading-relaxed text-white/80">{action}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-white/10 text-sm text-white/40">
                  System nominal. No actions required.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
