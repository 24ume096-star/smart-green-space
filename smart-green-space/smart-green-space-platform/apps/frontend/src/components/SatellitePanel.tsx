import { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, Circle, useMap } from "react-leaflet";
import { RefreshCw, Satellite, Map, CloudRain, AlertTriangle, Sparkles } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:8080";

type Park = { id: string; name: string; lat: number; lng: number };

type SatelliteLatest = {
  id: string;
  capturedAt: string;
  source: string;
  imageUrl: string;
  ndviMapUrl: string;
  thermalMapUrl: string;
  cloudCoverage: number;
  ndviMean: number;
  ndviMin: number;
  ndviMax: number;
};

type TimeseriesData = {
  bucket: string;
  ndviMean: number;
};

export function SatellitePanel() {
  const [parks, setParks] = useState<Park[]>([]);

  // Leaflet map helpers
  function MapRefocus({ center }: { center: [number, number] }) {
    const map = useMap();
    useEffect(() => {
      map.flyTo(center, 15, { animate: true, duration: 1.5 });
    }, [center, map]);
    return null;
  }

  function getNdviColor(val: number) {
    if (val > 0.6) return "#00ff88"; // Dense/Healthy
    if (val > 0.45) return "#88ff00"; // Moderate
    if (val > 0.3) return "#ffff00";  // Sparse/Stressed
    return "#ff4400"; // Built-up / Dead
  }

  // Generates a mock "heatmap" distribution over the actual satellite tile based on live API parameters
  function generateHeatmapCircles(lat: number, lng: number, baseNdvi: number) {
    return Array.from({ length: 65 }).map((_, i) => {
      const angle = i * 137.5; // Golden angle spiral
      const radiusLog = Math.sqrt(i) * 0.0012; // Doubled spread to cover large parks
      const variation = Math.sin(i * 3) * 0.15;
      const localNdvi = Math.max(0, Math.min(1, baseNdvi + variation));
      return {
         lat: lat + radiusLog * Math.cos(angle) - 0.0005, // Shifted slightly west to align with canopy center
         lng: lng + radiusLog * Math.sin(angle) - 0.0025, // Shifted west into the deep forest, away from urban edge
         radius: 120 + (i % 3) * 40, // Much larger radiuses for smooth blending
         color: getNdviColor(localNdvi),
         opacity: 0.15 + (i % 10) * 0.02 // Lower opacity for beautiful soft blending
      };
    });
  }
  const [activeParkId, setActiveParkId] = useState<string>("");
  const [latestData, setLatestData] = useState<SatelliteLatest | null>(null);
  const [timeseries, setTimeseries] = useState<TimeseriesData[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [aiSummary, setAiSummary] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);

  // Load parks
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/parks?cityId=delhi-city&limit=100`);
        const json = await res.json();
        if (mounted && json.data?.items) {
          const list = json.data.items;
          setParks(list);
          if (list.length > 0) setActiveParkId(list[0].id);
        }
      } catch (err) {
        console.error("Failed to load parks", err);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Load satellite data for active park
  const loadSatelliteData = async (parkId: string) => {
    setLoading(true);
    try {
      const [latestRes, seriesRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/satellite/parks/${parkId}/latest`),
        fetch(
          `${API_BASE}/api/v1/satellite/parks/${parkId}/ndvi-timeseries?from=${new Date(
            Date.now() - 180 * 24 * 60 * 60 * 1000
          ).toISOString()}&to=${new Date().toISOString()}&interval=weekly`
        ),
      ]);

      if (latestRes.ok) {
        const json = await latestRes.json();
        setLatestData(json.data ?? null);
      } else {
        setLatestData(null);
      }

      if (seriesRes.ok) {
        const json = await seriesRes.json();
        const mapped = (json.data ?? []).map((row: any) => ({
          bucket: new Date(row.bucket).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          ndviMean: Number(row.ndviMean.toFixed(3)),
        }));
        setTimeseries(mapped);
      } else {
        setTimeseries([]);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (activeParkId) {
      loadSatelliteData(activeParkId);
    }
  }, [activeParkId]);

  const activePark = useMemo(() => parks.find(p => p.id === activeParkId), [parks, activeParkId]);

  // Command AI Help Desk to analyze satellite data
  useEffect(() => {
    let mounted = true;
    if (latestData && activePark) {
      (async () => {
        setAiLoading(true);
        setAiSummary("");
        try {
          const prompt = `Analyze this satellite remote-sensing data for ${activePark.name}: Mean NDVI is ${latestData.ndviMean.toFixed(3)} and Cloud coverage is ${latestData.cloudCoverage}%. Give an extremely concise 3-to-4 sentence summary of the canopy health and any warnings. Highlight positive or negative indicators clearly. Do not use asterisks or markdown bolding.`;
          
          const res = await fetch(`${API_BASE}/api/v1/ai/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: prompt, parkId: activePark.id })
          });
          
          if (res.ok) {
            const json = await res.json();
            if (mounted) setAiSummary(json.reply);
          } else {
             if (mounted) setAiSummary("Failed to generate AI insights due to an API error.");
          }
        } catch {
          if (mounted) setAiSummary("System failed to connect to AI Help Desk.");
        }
        if (mounted) setAiLoading(false);
      })();
    }
    return () => { mounted = false; };
  }, [latestData, activePark]);

  const handleManualSync = async () => {
    if (!activeParkId) return;
    setSyncing(true);
    try {
      const dummyPayload = {
        capturedAt: new Date().toISOString(),
        source: "SENTINEL2",
        ndviMean: 0.55 + Math.random() * 0.1, // simulated fresh data
        ndviMax: 0.7,
        ndviMin: 0.3,
        cloudCoverage: Math.floor(Math.random() * 10),
      };
      
      const res = await fetch(`${API_BASE}/api/v1/satellite/parks/${activeParkId}/ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer ADMIN_MOCK", // Matches requireRole("ADMIN")
        },
        body: JSON.stringify(dummyPayload)
      });
      if (res.ok) {
        await loadSatelliteData(activeParkId);
      }
    } catch {
      // Ignored for demo
    }
    setSyncing(false);
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent/90">
            Orbital Imagery & GIS
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-white md:text-3xl">
            Satellite View
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="rounded-lg border border-white/10 bg-canopy px-4 py-2 text-sm text-white"
            value={activeParkId}
            onChange={(e) => setActiveParkId(e.target.value)}
          >
            {parks.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button 
            onClick={handleManualSync}
            disabled={syncing}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-forest shadow-glow transition-all hover:bg-accent/90 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${syncing && "animate-spin"}`} />
            {syncing ? "Syncing..." : "Manual Ingest"}
          </button>
        </div>
      </div>

      {!loading && !latestData ? (
        <div className="rounded-xl border border-white/10 bg-error/10 p-6 text-center text-error">
          <AlertTriangle className="mx-auto mb-2 h-8 w-8" />
          <p className="font-semibold">No remote sensing data found</p>
          <p className="text-sm opacity-80">Trigger a manual ingest or check Earthdata API connection.</p>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Real-time telemetry summary */}
        <div className="flex flex-col gap-4 lg:col-span-1">
          <div className="rounded-xl border border-white/10 bg-canopy/80 p-6 shadow-card">
            <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold text-white">
              <Satellite className="h-5 w-5 text-accent" /> Scan Metadata
            </h3>
            {loading ? <div className="h-40 animate-pulse rounded bg-white/5" /> : latestData ? (
              <div className="space-y-4">
                <div className="flex justify-between border-b border-white/10 pb-2">
                  <span className="text-sm text-white/50">Source</span>
                  <span className="text-sm font-medium text-white">{latestData.source}</span>
                </div>
                <div className="flex justify-between border-b border-white/10 pb-2">
                  <span className="text-sm text-white/50">Captured At</span>
                  <span className="text-sm font-medium text-white">
                    {new Date(latestData.capturedAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between border-b border-white/10 pb-2">
                  <span className="text-sm text-white/50">Cloud Cover</span>
                  <span className="flex items-center gap-2 text-sm font-medium text-white">
                    <CloudRain className="h-4 w-4 text-sky-400" /> {latestData.cloudCoverage}%
                  </span>
                </div>
                <div className="flex justify-between pb-1">
                  <span className="text-sm text-white/50">Mean NDVI</span>
                  <span className="text-sm font-medium text-accent">{latestData.ndviMean.toFixed(3)}</span>
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-white/10 bg-canopy/80 p-6 shadow-card flex-1 flex flex-col min-h-[220px]">
             <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold text-white">
              <Sparkles className="h-5 w-5 text-accent" /> AI Insight
            </h3>
            <div className="flex-1 custom-scrollbar overflow-y-auto pr-2">
              {aiLoading ? (
                <div className="flex flex-col gap-3 animate-pulse">
                  <div className="h-2.5 w-full rounded bg-white/10" />
                  <div className="h-2.5 w-5/6 rounded bg-white/10" />
                  <div className="h-2.5 w-full rounded bg-white/10" />
                  <div className="h-2.5 w-4/6 rounded bg-white/10 mt-2" />
                </div>
              ) : (
                <div className="text-white/80 leading-relaxed text-[13px] whitespace-pre-wrap font-sans">
                  {aiSummary || <span className="text-white/40 italic">Waiting for satellite telemetry input...</span>}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Map view & Timeseries */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Timeseries Graph */}
          <div className="rounded-xl border border-white/10 bg-canopy/80 p-6 shadow-card h-[300px] flex flex-col">
            <h3 className="mb-4 font-display text-lg font-semibold text-white">NDVI 6-Month Trend</h3>
            <div className="flex-1 min-h-0">
              {loading ? <div className="h-full w-full animate-pulse rounded bg-white/5" /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeseries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                    <XAxis dataKey="bucket" stroke="#ffffff40" tick={{ fill: "#ffffff80", fontSize: 12 }} />
                    <YAxis domain={['dataMin - 0.05', 'dataMax + 0.05']} stroke="#ffffff40" tick={{ fill: "#ffffff80", fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "#1e2e1e", borderColor: "#ffffff10", borderRadius: "8px" }}
                      itemStyle={{ color: "#78E378" }}
                    />
                    <Line type="monotone" dataKey="ndviMean" name="Mean NDVI" stroke="#78E378" strokeWidth={3} dot={{ fill: "#78E378", r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Geospatial Map Overlay Preview */}
          <div className="rounded-xl border border-white/10 bg-canopy/80 p-6 shadow-card flex-1 flex flex-col min-h-[350px] relative z-0">
            <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold text-white">
              <Map className="h-5 w-5 text-accent" /> Live Map Overlay
            </h3>
            <div className="relative flex-1 rounded-lg overflow-hidden border border-white/5 bg-forest z-0">
               {activePark ? (
                 <MapContainer 
                   center={[activePark.lat, activePark.lng]} 
                   zoom={15} 
                   scrollWheelZoom={false} 
                   className="h-full w-full z-0"
                   zoomControl={false}
                 >
                   <MapRefocus center={[activePark.lat, activePark.lng]} />
                   
                   {/* True-color Esri Satellite Imagery */}
                   <TileLayer
                     url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                     maxZoom={18}
                   />
                   
                   {/* Data-driven NDVI Overlay Nodes */}
                   {latestData && generateHeatmapCircles(activePark.lat, activePark.lng, latestData.ndviMean).map((c, i) => (
                      <Circle 
                        key={i}
                        center={[c.lat, c.lng]}
                        radius={c.radius}
                        pathOptions={{ 
                          color: c.color, 
                          fillColor: c.color, 
                          fillOpacity: c.opacity, 
                          stroke: false 
                        }}
                      />
                   ))}
                 </MapContainer>
               ) : (
                 <div className="flex-1 h-full flex items-center justify-center border border-dashed border-white/10 bg-forest/50 text-white/40 text-sm">
                   Loading spatial coordinates...
                 </div>
               )}
               
               <div className="absolute bottom-4 right-4 bg-black/70 px-4 py-2 rounded-lg text-white text-xs z-[1000] backdrop-blur-md border border-white/10 shadow-lg pointer-events-none">
                 <p className="font-semibold text-sm mb-1">{activePark?.name}</p>
                 <p className="text-white/60">{latestData ? `Sensor Array Active • ${latestData.cloudCoverage}% Clouds` : "Initializing..."}</p>
               </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
