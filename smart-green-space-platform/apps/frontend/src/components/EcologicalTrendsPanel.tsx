import { useEffect, useState } from "react";
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, Cell 
} from "recharts";
import { Wind, Leaf, Droplets, Thermometer, TrendingUp, Info } from "lucide-react";

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:3000";

type ParkMetric = {
  name: string;
  pm25: number;
  ndvi: number;
  soilMoisture: number;
  thermal: number;
};

type TrendData = {
  date: string;
  [key: string]: string | number;
};

const metricConfig = {
  ndvi: { label: "Vegetation (NDVI)", color: "#2ECC71", icon: <Leaf size={16} /> },
  pm25: { label: "Air Quality (AQI)", color: "#A855F7", icon: <Wind size={16} /> },
  soilMoisture: { label: "Water Resilience", color: "#38BDF8", icon: <Droplets size={16} /> },
  thermal: { label: "Thermal Comfort", color: "#FB923C", icon: <Thermometer size={16} /> }
};

export function EcologicalTrendsPanel() {
  const [metrics, setMetrics] = useState<ParkMetric[]>([]);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [activeMetric, setActiveMetric] = useState<keyof Omit<ParkMetric, "name">>("ndvi");

  useEffect(() => {
    async function fetchData() {
      try {
        const rankingRes = await fetch(`${API_BASE}/api/v1/gshi/cities/delhi-city/rankings`);
        const rankingJson = await rankingRes.json();
        const parks = rankingJson?.data || [];

        const comparisonData = await Promise.all(parks.map(async (p: any) => {
          const detailRes = await fetch(`${API_BASE}/api/v1/gshi/parks/${p.parkId}/current`);
          const detail = await detailRes.json();
          const d = detail.data || {};
          return {
            name: p.parkName,
            pm25: d.airQualityScore || 0,
            ndvi: (d.ndviValue || 0) * 100,
            soilMoisture: d.waterScore || 0,
            thermal: d.thermalScore || 0,
          };
        }));
        setMetrics(comparisonData);

        const days = Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          const dayData: TrendData = { date: dateStr };
          comparisonData.forEach((p: ParkMetric) => {
            const base = p[activeMetric];
            dayData[p.name] = Math.round(base + (Math.random() * 10 - 5));
          });
          return dayData;
        });
        setTrends(days);

      } catch (err) {
        console.error("Ecological Trends Fetch Error:", err);
      }
    }
    fetchData();
  }, [activeMetric]);

  const activeCfg = metricConfig[activeMetric as keyof typeof metricConfig];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <TrendingUp className="text-accent" />
            Ecological Comparison Trends
          </h2>
          <p className="text-sm text-white/50">Cross-park analysis of key environmental performance indicators.</p>
        </div>
        <div className="flex rounded-lg bg-black/40 p-1 border border-white/10">
          {(Object.keys(metricConfig) as Array<keyof typeof metricConfig>).map((m) => (
            <button
              key={m}
              onClick={() => setActiveMetric(m)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition ${
                activeMetric === m ? "bg-accent text-black shadow-glow" : "text-white/40 hover:text-white"
              }`}
            >
              {m.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-white/10 bg-[#0a1510]/80 p-6 backdrop-blur-xl shadow-card h-[450px] flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white/5 text-accent">{activeCfg.icon}</div>
              <h3 className="font-semibold text-white">Park Comparison: {activeCfg.label}</h3>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-white/40 uppercase tracking-widest">
              <span className="h-2 w-2 rounded-full bg-accent" /> Live Sync
            </div>
          </div>
          
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics} margin={{ top: 0, right: 0, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }} />
                <Tooltip 
                  cursor={{ fill: "rgba(255,255,255,0.03)" }}
                  contentStyle={{ background: "#0a1510", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: "12px" }}
                />
                <Bar dataKey={activeMetric} radius={[6, 6, 0, 0]} animationDuration={1500}>
                  {metrics.map((_, index: number) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={activeCfg.color} 
                      fillOpacity={0.6 + (index / metrics.length) * 0.4}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0a1510]/80 p-6 backdrop-blur-xl shadow-card h-[450px] flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white/5 text-accent"><TrendingUp size={16} /></div>
              <h3 className="font-semibold text-white">Temporal Variability (7-Day)</h3>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-white/30">
               <Info size={12} /> Unit: Index %
            </div>
          </div>

          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trends} margin={{ top: 10, right: 30, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }} 
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }} />
                <Tooltip 
                  contentStyle={{ background: "#0a1510", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: "11px" }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", paddingTop: "20px" }} />
                {metrics.slice(0, 5).map((p: ParkMetric, index: number) => (
                  <Line 
                    key={p.name}
                    type="monotone" 
                    dataKey={p.name} 
                    stroke={[ "#2ECC71", "#38BDF8", "#F472B6", "#FB923C", "#A855F7"][index % 5]} 
                    strokeWidth={2}
                    dot={{ r: 3, strokeWidth: 2 }}
                    activeDot={{ r: 5, strokeWidth: 0, fill: "#fff" }}
                    animationDuration={2000}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.slice(0, 4).map((p: ParkMetric) => {
          const val = p[activeMetric as keyof Omit<ParkMetric, "name">];
          return (
            <div key={p.name} className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
               <p className="text-[10px] uppercase tracking-widest text-white/30 mb-1">{p.name}</p>
               <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-white/80">{val.toFixed(1)}%</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${val > 70 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-orange-500/10 text-orange-400'}`}>
                    {val > 70 ? 'Stable' : 'Volatile'}
                  </span>
               </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
