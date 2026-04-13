import {
  Activity,
  AlertTriangle,
  Droplet,
  Droplets,
  Leaf,
  PawPrint,
  Trees,
  ThermometerSun,
  Wind,
} from "lucide-react";
import {
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { useEffect, useState, useCallback } from "react";

function LiveDot() {
  return (
    <span className="relative inline-flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-pulse-soft rounded-full bg-accent opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-accent shadow-[0_0_8px_rgba(46,204,113,0.8)]" />
    </span>
  );
}

function formatCompact(n: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
}

type Kpi = {
  label: string;
  value: string;
  sub?: string;
  icon: typeof Leaf;
  live?: boolean;
  badge?: { text: string; tone: "danger" | "ok" };
};

const KPIS: Kpi[] = [
  {
    label: "Total Parks Monitored",
    value: "47",
    sub: "City-wide coverage",
    icon: Trees,
    live: true,
  },
  {
    label: "Active Sensor Nodes",
    value: formatCompact(312),
    sub: "Edge mesh online",
    icon: Activity,
    live: true,
  },
  {
    label: "Average GSHI Score",
    value: "85/100",
    sub: "Stable +0.6",
    icon: Leaf,
    live: true,
  },
  {
    label: "Active Alerts",
    value: "3",
    sub: "Needs triage",
    icon: AlertTriangle,
    badge: { text: "3", tone: "danger" },
    live: true,
  },
  {
    label: "Species Detected Today",
    value: "28",
    sub: "Across all parks",
    icon: PawPrint,
    live: true,
  },
  {
    label: "Water Saved This Month",
    value: "1,240 KL",
    sub: "Smart irrigation",
    icon: Droplet,
    live: true,
  },
];

const ALERT_FEED = [
  "🔥 Heat stress detected — Lodhi Garden Zone 3",
  "💧 Irrigation triggered — Central Park Node 7",
  "🌿 New species logged — Sanjay Van",
];

const GSHI_TREND_30D = Array.from({ length: 30 }, (_, i) => {
  const base = 79 + i * 0.12;
  const wave = Math.sin(i / 3.2) * 1.8;
  const noise = (i % 5) * 0.15;
  const score = Math.max(70, Math.min(92, base + wave + noise));
  return { day: i + 1, score: Number(score.toFixed(1)) };
});

const ALERTS_BY_CATEGORY = [
  { name: "Irrigation", value: 9, color: "#2ECC71" },
  { name: "Disease", value: 4, color: "#EAB308" },
  { name: "Biodiversity", value: 3, color: "#22C55E" },
  { name: "Heat", value: 6, color: "#F97316" },
  { name: "Flood Risk", value: 2, color: "#38BDF8" },
];

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:8080";

function StatCard({ k }: { k: Kpi }) {
  const Icon = k.icon;
  const badge =
    k.badge?.tone === "danger" ? (
      <span className="inline-flex items-center justify-center rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-300 ring-1 ring-red-500/25">
        {k.badge.text}
      </span>
    ) : k.badge ? (
      <span className="inline-flex items-center justify-center rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent ring-1 ring-accent/25">
        {k.badge.text}
      </span>
    ) : null;

  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/[0.07] bg-canopy p-5 shadow-card border-accent-glow transition hover:border-accent/25 hover:shadow-glow">
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/10 blur-3xl transition group-hover:bg-accent/15"
        aria-hidden
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-xs font-medium uppercase tracking-wide text-white/45">
              {k.label}
            </p>
            {badge}
          </div>
          <p className="mt-2 font-display text-3xl font-semibold tracking-tight text-white">
            {k.value}
          </p>
          {k.sub ? <p className="mt-1 text-xs text-white/45">{k.sub}</p> : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 ring-1 ring-accent/20">
            <Icon className="h-5 w-5 text-accent" />
          </div>
          {k.live && (
            <div className="flex items-center gap-1.5 rounded-full border border-accent/20 bg-forest/80 px-2 py-0.5">
              <LiveDot />
              <span className="text-[10px] font-semibold uppercase tracking-wide text-accent">
                Live
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GshiGauge({ value }: { value: number }) {
  const size = 220;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const dash = (pct / 100) * c;
  const gap = c - dash;

  return (
    <div className="relative grid place-items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id="gshiGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#2ECC71" />
            <stop offset="55%" stopColor="#EAB308" />
            <stop offset="100%" stopColor="#EF4444" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#gshiGrad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${gap}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="drop-shadow-[0_0_18px_rgba(46,204,113,0.35)]"
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">
          City-wide GSHI
        </p>
        <p className="mt-2 font-display text-4xl font-semibold tracking-tight text-white">
          {pct.toFixed(0)}%
        </p>
        <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-forest/60 px-3 py-1">
          <LiveDot />
          <span className="text-[11px] font-medium text-white/75">Synced · live</span>
        </div>
      </div>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ value?: number }>;
}) {
  if (!active || !payload?.length) return null;
  const v = payload[0]?.value;
  if (typeof v !== "number") return null;
  return (
    <div className="rounded-lg border border-white/10 bg-[#0a1510]/95 px-3 py-2 text-xs text-white/85 shadow-card">
      <span className="font-semibold text-white">GSHI</span>{" "}
      <span className="text-accent">{v.toFixed(1)}</span>
    </div>
  );
}

export function OverviewGrid({ city }: { city: string }) {
  const [kpis, setKpis] = useState<Kpi[]>(KPIS);
  const [gaugeValue, setGaugeValue] = useState(85);
  const [gshiTrend30d, setGshiTrend30d] = useState(GSHI_TREND_30D);
  const [liveAlertFeed, setLiveAlertFeed] = useState(ALERT_FEED);
  const [alertsByCategory, setAlertsByCategory] = useState(ALERTS_BY_CATEGORY);

  // Dynamic AI Summary States
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiTime, setAiTime] = useState<string>("Waiting for data...");
  const [parksList, setParksList] = useState<{id: string, name: string}[]>([]);
  const [aiTarget, setAiTarget] = useState<string>("city-wide");
  const [globalAiData, setGlobalAiData] = useState<{avg: number, feed: string[], alertsCount: string}>({avg: 0, feed: [], alertsCount: "0"});

  const fetchAiSummary = useCallback(async (targetId: string, globalData: {avg: number, feed: string[], alertsCount: string}) => {
    const directKey = (import.meta as any).env?.VITE_OPENROUTER_API_KEY as string | undefined;
    if (!directKey) {
      setAiTime("Static fallback");
      return; 
    }
    
    // Don't fire if no real data yet
    if (targetId === "city-wide" && globalData.avg === 0) return;

    setAiLoading(true);
    setAiTime("Synthesizing metrics...");
    
    let targetName = "Delhi NCR City-wide";
    let avg = globalData.avg;
    let alertsCount = globalData.alertsCount;
    let feed = globalData.feed;

    if (targetId !== "city-wide") {
       try {
          const detailRes = await fetch(`${API_BASE}/api/v1/parks/${targetId}`);
          if (detailRes.ok) {
             const detail = await detailRes.json();
             targetName = detail?.data?.name || targetId;
             alertsCount = String(detail?.data?.activeAlertCount || 0);
             const gRes = await fetch(`${API_BASE}/api/v1/gshi/parks/${targetId}/latest`);
             if (gRes.ok) {
                const gData = await gRes.json();
                avg = Number(gData?.data?.overallScore || 0);
             }
             feed = Number(alertsCount) > 0 ? [`Alerts active for ${targetName}`] : ["No local alerts"];
          }
       } catch {}
    }

    const prompt = `You are the executive AI for the Smart Green Space Digital Twin.
Write a highly professional, 3-to-4 sentence executive summary and triage action plan for: ${targetName}

CURRENT LIVE DATA (${targetName}):
- Green Space Health Index (GSHI): ${avg.toFixed(1)}/100
- Active Sensor Alerts: ${alertsCount}
- Context: ${feed.length > 0 ? feed.join("; ") : "No active critical issues"}

FORMAT RULES:
- Return ONLY the text. No greetings.
- First 2 sentences: Synthesize the ecosystem health based on the GSHI score.
- Next 1-2 sentences: INVESTIGATE the alerts and provide concrete, actionable SOLUTIONS (e.g. "Recommend deploying maintenance crew for zone inspection" or "Increase irrigation schedules").
- Use HTML <span> tags with the class "text-accent font-semibold" for metric numbers or key solutions.`;

    try {
      const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${directKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://smart-green-space.delhi.gov.in",
          "X-Title": "Smart Green Space Dashboard Overview",
        },
        body: JSON.stringify({
          model: "arcee-ai/trinity-large-preview:free",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 200,
          temperature: 0.4,
        }),
      });

      if (orRes.ok) {
        const data = await orRes.json();
        const reply = data.choices?.[0]?.message?.content;
        if (reply) {
          setAiSummary(reply);
          setAiTime("Live now");
        }
      } else {
         setAiTime("Failed to fetch");
      }
    } catch {
      setAiTime("Offline");
    } finally {
      setAiLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAiSummary(aiTarget, globalAiData);
  }, [aiTarget, globalAiData, fetchAiSummary]);


  useEffect(() => {
    let mounted = true;
    async function loadOverview() {
      try {
        const [parksRes, avgRes, rankingsRes] = await Promise.all([
          fetch(`${API_BASE}/api/v1/parks?cityId=delhi-city&limit=100`),
          fetch(`${API_BASE}/api/v1/gshi/cities/delhi-city/average`),
          fetch(`${API_BASE}/api/v1/gshi/cities/delhi-city/rankings`),
        ]);
        if (!parksRes.ok || !avgRes.ok || !rankingsRes.ok) return;
        const parksJson = await parksRes.json();
        const avgJson = await avgRes.json();
        const rankingsJson = await rankingsRes.json();

        const parks = Array.isArray(parksJson?.data?.items) ? parksJson.data.items : [];
        const rankings = Array.isArray(rankingsJson?.data) ? rankingsJson.data : [];
        const avgGshi = Number(avgJson?.data?.averageGshi ?? 0);
        const change = Number(avgJson?.data?.trend?.change ?? 0);

        let activeAlerts = 0;
        const feed: string[] = [];
        for (const p of parks.slice(0, 12)) {
          try {
            const detailRes = await fetch(`${API_BASE}/api/v1/parks/${p.id}`);
            if (!detailRes.ok) continue;
            const detail = await detailRes.json();
            const count = Number(detail?.data?.activeAlertCount ?? 0);
            activeAlerts += count;
            if (count > 0) {
              feed.push(`Alert activity - ${p.name} (${count} open)`);
            }
          } catch {
            // ignore per-park failures
          }
        }

        let trend = GSHI_TREND_30D;
        const topParkId = rankings[0]?.parkId;
        if (topParkId) {
          const to = new Date();
          const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
          const trendRes = await fetch(
            `${API_BASE}/api/v1/gshi/parks/${topParkId}/history?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}&interval=daily`,
          );
          if (trendRes.ok) {
            const trendJson = await trendRes.json();
            const rows = Array.isArray(trendJson?.data) ? trendJson.data : [];
            const mapped = rows.map((r: any, idx: number) => ({
              day: idx + 1,
              score: Number(r.overallScore || 0),
            }));
            if (mapped.length > 0) trend = mapped;
          }
        }

        const typeCounts: Record<string, number> = {};
        for (const line of feed) {
          if (line.toLowerCase().includes("irrig")) typeCounts.Irrigation = (typeCounts.Irrigation || 0) + 1;
          else if (line.toLowerCase().includes("heat")) typeCounts.Heat = (typeCounts.Heat || 0) + 1;
          else typeCounts.Other = (typeCounts.Other || 0) + 1;
        }

        const liveKpis: Kpi[] = [
          { label: "Total Parks Monitored", value: String(parks.length), sub: "City-wide coverage", icon: Trees, live: true },
          { label: "Active Sensor Nodes", value: formatCompact(0), sub: "Node KPI pending public endpoint", icon: Activity, live: true },
          { label: "Average GSHI Score", value: `${avgGshi.toFixed(2)}/100`, sub: `${change >= 0 ? "+" : ""}${change.toFixed(2)} vs prev`, icon: Leaf, live: true },
          { label: "Active Alerts", value: String(activeAlerts), sub: "Needs triage", icon: AlertTriangle, badge: { text: String(activeAlerts), tone: activeAlerts > 0 ? "danger" : "ok" }, live: true },
          { label: "Species Detected Today", value: "0", sub: "Public KPI endpoint pending", icon: PawPrint, live: true },
          { label: "Water Saved This Month", value: "N/A", sub: "Water KPI endpoint pending", icon: Droplet, live: true },
        ];

        const liveCategories =
          Object.keys(typeCounts).length > 0
            ? Object.entries(typeCounts).map(([name, value], idx) => ({
                name,
                value,
                color: ["#2ECC71", "#F97316", "#38BDF8", "#EAB308"][idx % 4],
              }))
            : ALERTS_BY_CATEGORY;

        if (mounted) {
          setKpis(liveKpis);
          setGaugeValue(avgGshi > 0 ? avgGshi : 0);
          setGshiTrend30d(trend);
          setLiveAlertFeed(feed.length > 0 ? feed : ALERT_FEED);
          setAlertsByCategory(liveCategories);
          
          // Store parks and global stats so the AI can react to them
          setParksList(parks.map((p: any) => ({ id: p.id, name: p.name })));
          const alertCount = liveKpis.find(k => k.label.includes("Alerts"))?.value || "0";
          setGlobalAiData({ avg: avgGshi, feed, alertsCount: alertCount });
        }
      } catch {
        // fallback to defaults
      }
    }
    loadOverview();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent/90">
            Operations · {city}
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-white md:text-3xl">
            Ecosystem command overview
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-white/50">
            Real-time synthesis of urban green infrastructure, hydrology, and citizen-facing
            intelligence — unified for decision support.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-accent/20 bg-canopy/60 px-3 py-2">
          <LiveDot />
          <span className="text-xs font-medium text-white/80">Live mesh active</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {kpis.map((k) => (
          <StatCard key={k.label} k={k} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="group relative overflow-hidden rounded-xl border border-white/[0.07] bg-canopy/90 p-6 shadow-card transition hover:border-accent/25 hover:shadow-glow">
          <div
            className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/10 blur-3xl transition group-hover:bg-accent/15"
            aria-hidden
          />
          <div className="relative flex items-center justify-between gap-3">
            <h3 className="font-display text-lg font-semibold text-white">
              City-wide GSHI Score Gauge
            </h3>
            <div className="flex items-center gap-2 text-xs text-white/50">
              <ThermometerSun className="h-4 w-4 text-accent" />
              <span>Composite · 24h</span>
            </div>
          </div>
          <div className="relative mt-6 flex items-center justify-center">
            <GshiGauge value={gaugeValue} />
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-xl border border-white/[0.07] bg-canopy/90 p-6 shadow-card transition hover:border-accent/25 hover:shadow-glow">
          <div
            className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/10 blur-3xl transition group-hover:bg-accent/15"
            aria-hidden
          />
          <div className="relative flex items-center justify-between gap-3">
            <h3 className="font-display text-lg font-semibold text-white">Alert Feed</h3>
            <div className="flex items-center gap-2 rounded-full border border-accent/20 bg-forest/60 px-3 py-1 text-[11px] text-white/70">
              <LiveDot />
              <span className="font-medium">Live</span>
            </div>
          </div>

          <div className="relative mt-5 overflow-hidden rounded-lg border border-white/10 bg-forest/30">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-[#0F1B12] to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#0F1B12] to-transparent" />
            <div className="h-44">
              <div className="animate-marquee-up space-y-3 p-4">
                {[...liveAlertFeed, ...liveAlertFeed, ...liveAlertFeed].map((t, i) => (
                  <div
                    key={`${t}-${i}`}
                    className="flex items-start gap-2 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2"
                  >
                    <span className="mt-1 shrink-0">
                      <LiveDot />
                    </span>
                    <p className="text-sm text-white/80">{t}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-xl border border-white/[0.07] bg-canopy/90 p-6 shadow-card transition hover:border-accent/25 hover:shadow-glow">
          <div
            className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/10 blur-3xl transition group-hover:bg-accent/15"
            aria-hidden
          />
          <div className="relative flex items-center justify-between gap-3 flex-wrap">
            <h3 className="font-display text-lg font-semibold text-white">Actionable AI Insights</h3>
            <div className="flex items-center gap-2">
              <select 
                value={aiTarget} 
                onChange={e => setAiTarget(e.target.value)}
                className="bg-forest/80 border border-white/10 text-white text-[11px] rounded px-2 py-1 outline-none cursor-pointer hover:border-white/20 transition"
              >
                <option value="city-wide">City-wide (Delhi NCR)</option>
                {parksList.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <div className="flex items-center gap-1.5 text-xs text-white/50 bg-canopy/60 px-2 py-1 rounded border border-white/5">
                <Leaf className="h-3 w-3 text-accent" />
                 <span>AI engine</span>
              </div>
            </div>
          </div>
          <div className="relative mt-5 rounded-lg border border-white/10 bg-forest/30 p-4">
            <p className="text-sm leading-relaxed text-white/75 min-h-[5rem]">
              {aiLoading ? (
                <span className="flex items-center gap-2 animate-pulse text-accent/80">
                  Synthesizing live metrics across the edge mesh...
                </span>
              ) : aiSummary ? (
                <span dangerouslySetInnerHTML={{ __html: aiSummary }} />
              ) : (
                /* Fallback if no key or error */
                <>
                  Today’s city-wide ecosystem health is trending{" "}
                  <span className="text-accent font-semibold">stable-to-improving</span>. 
                  GSHI remains strong across most parks with localized heat-stress pockets detected in high-footfall zones. 
                  Smart irrigation optimizations reduced water draw while maintaining soil moisture within target bands. 
                  AI flagged a small cluster of disease-risk indicators for field verification.
                </>
              )}
            </p>
            <div className="mt-4 flex items-center justify-between gap-3 text-xs text-white/45">
              <span className="flex items-center gap-2">
                <LiveDot /> {aiLoading ? "Model computing" : "Arcee AI Confidence: 0.94"}
              </span>
              <span>{aiTime}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="group relative overflow-hidden rounded-xl border border-white/[0.07] bg-canopy/90 p-6 shadow-card transition hover:border-accent/25 hover:shadow-glow lg:col-span-2">
          <div
            className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/10 blur-3xl transition group-hover:bg-accent/15"
            aria-hidden
          />
          <div className="relative flex items-center justify-between gap-3">
            <h3 className="font-display text-lg font-semibold text-white">GSHI trend · last 30 days</h3>
            <div className="flex items-center gap-2 text-xs text-white/50">
              <Wind className="h-4 w-4 text-accent" />
              <span>Sparkline</span>
            </div>
          </div>
          <div className="relative mt-4 h-36 rounded-lg border border-white/10 bg-forest/30 px-2 py-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={gshiTrend30d} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
                <Tooltip content={<ChartTooltip />} />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#2ECC71"
                  strokeWidth={2.25}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="relative mt-3 flex items-center justify-between text-[10px] uppercase tracking-wider text-white/35">
            <span>Day 1</span>
            <span className="text-accent/80">Day 30</span>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-xl border border-white/[0.07] bg-canopy/90 p-6 shadow-card transition hover:border-accent/25 hover:shadow-glow">
          <div
            className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/10 blur-3xl transition group-hover:bg-accent/15"
            aria-hidden
          />
          <div className="relative flex items-center justify-between gap-3">
            <h3 className="font-display text-lg font-semibold text-white">Alerts by category</h3>
            <div className="flex items-center gap-2 text-xs text-white/50">
              <Droplets className="h-4 w-4 text-accent" />
              <span>Distribution</span>
            </div>
          </div>

          <div className="relative mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div className="h-40 rounded-lg border border-white/10 bg-forest/30 p-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={alertsByCategory}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={42}
                    outerRadius={64}
                    paddingAngle={3}
                    stroke="rgba(255,255,255,0.08)"
                  >
                    {alertsByCategory.map((c) => (
                      <Cell key={c.name} fill={c.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0] as unknown as { name?: string; value?: number };
                      if (!p?.name || typeof p.value !== "number") return null;
                      return (
                        <div className="rounded-lg border border-white/10 bg-[#0a1510]/95 px-3 py-2 text-xs text-white/85 shadow-card">
                          <span className="font-semibold text-white">{p.name}</span>{" "}
                          <span className="text-accent">{p.value}</span>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2 rounded-lg border border-white/10 bg-forest/30 p-4">
              {alertsByCategory.map((c) => (
                <div key={c.name} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: c.color }}
                      aria-hidden
                    />
                    <span className="text-xs font-medium text-white/75">{c.name}</span>
                  </div>
                  <span className="text-xs font-semibold text-white/70">{c.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
