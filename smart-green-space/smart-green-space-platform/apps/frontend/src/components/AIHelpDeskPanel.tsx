import { useEffect, useRef, useState } from "react";
import { APPEEARS_NDVI_POINTS } from "../data/appeearsNdvi";
import {
  Bot, Send, Trash2, RefreshCw, Leaf,
  Thermometer, Droplets, Wind, Zap, MapPin, Cpu,
  MessageSquare, Sparkles,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type Role = "user" | "assistant" | "system";
type Message = { role: Role; content: string; ts: number };

type ParkOption = { id: string; name: string; city: string };
type ModelOption = { id: string; label: string };

type LiveContext = {
  park: string;
  weather?: { temperature_2m?: number; relativehumidity_2m?: number; windspeed_10m?: number };
  flood?: { riskScore?: number; riskLevel?: string };
  gbif?: { count?: number };
};

// ── Constants ─────────────────────────────────────────────────────────────────
const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:8080";

const PARKS: ParkOption[] = [
  { id: "lodhi",      name: "Lodhi Garden",          city: "New Delhi"    },
  { id: "deer",       name: "Deer Park Hauz Khas",   city: "South Delhi"  },
  { id: "nehru",      name: "Nehru Park",             city: "Chanakyapuri" },
  { id: "garden",     name: "Garden of Five Senses",  city: "South Delhi"  },
  { id: "millennium", name: "Millennium Park",        city: "East Delhi"   },
  { id: "sunder",     name: "Sunder Nursery",         city: "New Delhi"    },
];

const SUGGESTED_QUESTIONS = [
  "What is the current thermal comfort level here?",
  "How does flood risk look for this park?",
  "What is the carbon sequestration capacity?",
  "Which bird species are most common?",
  "What are the GSHI sub-index scores?",
  "How does NDVI indicate vegetation health?",
  "Is this park meeting WHO green space standards?",
  "What maintenance actions are recommended today?",
];

const DEFAULT_MODEL = "arcee-ai/trinity-large-preview:free";

const FALLBACK_MODELS: ModelOption[] = [
  { id: "arcee-ai/trinity-large-preview:free", label: "Arcee Trinity Large (Free)"              },
  { id: "google/gemini-flash-1.5",             label: "Gemini Flash 1.5 (Fast · Free)"         },
  { id: "meta-llama/llama-4-maverick",          label: "Llama 4 Maverick (Powerful · Free)"    },
  { id: "anthropic/claude-3-haiku",             label: "Claude 3 Haiku (Precise)"              },
  { id: "openai/gpt-4o-mini",                  label: "GPT-4o Mini (Balanced)"                },
  { id: "mistralai/mistral-7b-instruct:free",  label: "Mistral 7B (Free)"                     },
];

const LS_HISTORY = "sgs_ai_history_v1";

// ── Park coordinate lookup ────────────────────────────────────────────────────
const PARK_COORDS: Record<string, { lat: number; lng: number; ndviKey: string }> = {
  lodhi:       { lat: 28.5920, lng: 77.2197, ndviKey: "lodhi_garden"           },
  deer:        { lat: 28.5494, lng: 77.2001, ndviKey: "deer_park_hauz_khas"    },
  nehru:       { lat: 28.5979, lng: 77.1836, ndviKey: "nehru_park"             },
  garden:      { lat: 28.5104, lng: 77.1869, ndviKey: "garden_of_five_senses"  },
  millennium:  { lat: 28.6418, lng: 77.2466, ndviKey: ""                       },
  sunder:      { lat: 28.5934, lng: 77.2437, ndviKey: ""                       },
};

// UTCI → thermal comfort label
function utciLabel(temp: number, rh: number, wind: number, solar: number): { utci: number; label: string } {
  const v    = wind / 3.6;
  const Pa   = (rh / 100) * 0.6105 * Math.exp((17.27 * temp) / (temp + 237.3));
  const Tr   = temp + 0.0014 * solar - 0.022 * v;
  const DMrt = Tr - temp;
  const utci = temp + 0.607562052 - 0.0227712343*temp + 8.06470249e-4*temp*temp
    + 0.113919153*v - 0.0178600316*temp*v
    + 8.94606516*DMrt + 3.43643148*Pa - 0.0767696509*temp*Pa;
  const label =
    utci < 9   ? "No thermal stress"        :
    utci < 26  ? "No thermal stress (warm)" :
    utci < 32  ? "Moderate heat stress"     :
    utci < 38  ? "Strong heat stress"       : "Very strong heat stress";
  return { utci: Math.round(utci * 10) / 10, label };
}

// Fetch all real data for a park before calling the LLM
async function fetchRealParkContext(parkId: string) {
  const coords = PARK_COORDS[parkId] ?? PARK_COORDS.lodhi;

  // 1. NASA AppEEARS NDVI — use most recent reading for this park
  const ndviPoints = APPEEARS_NDVI_POINTS
    .filter(p => p.parkKey === coords.ndviKey)
    .sort((a, b) => b.date.localeCompare(a.date));
  const latestNdvi   = ndviPoints[0];
  const ndviValue    = latestNdvi ? latestNdvi.ndvi.toFixed(4) : "N/A";
  const ndviDate     = latestNdvi ? latestNdvi.date : "N/A";
  const ndviStatus   = latestNdvi
    ? latestNdvi.ndvi > 0.5 ? "Healthy (High)" : latestNdvi.ndvi > 0.3 ? "Moderate" : "Low/Stressed"
    : "N/A";

  // 2. Backend API — fetch GSHI scores, carbon, flood risk, sensors
  let gshiData: Record<string, any> = {};
  let carbonData: Record<string, any> = {};
  let floodData: Record<string, any> = {};
  try {
    // Map frontend park ID to backend park ID
    const backendParkId = parkId === "lodhi" ? "delhi-lodhi-garden" :
                          parkId === "deer" ? "delhi-deer-park-hauz-khas" :
                          parkId === "nehru" ? "delhi-nehru-park-delhi" :
                          parkId === "garden" ? "delhi-garden-of-five-senses" :
                          parkId === "sunder" ? "delhi-sunder-nursery" :
                          parkId === "millennium" ? "delhi-millennium-park-delhi" : "delhi-lodhi-garden";

    // Fetch GSHI scores
    const gshiRes = await fetch(`${API_BASE}/api/v1/analytics/parks/${backendParkId}/overview`);
    if (gshiRes.ok) {
      const gshiPayload = await gshiRes.json();
      gshiData = gshiPayload.data ?? {};
    }

    // Fetch carbon data
    const carbRes = await fetch(`${API_BASE}/api/v1/analytics/parks/${backendParkId}/carbon`);
    if (carbRes.ok) {
      const carbPayload = await carbRes.json();
      carbonData = carbPayload.data ?? {};
    }
  } catch { /* skip backend — continue with external APIs */ }

  // 3. Open-Meteo live weather
  let weather: Record<string, number | string> = {};
  let utciInfo: { utci: number; label: string } | null = null;
  try {
    const wRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}` +
      `&current=temperature_2m,relativehumidity_2m,windspeed_10m,shortwave_radiation,precipitation&timezone=Asia%2FKolkata`
    );
    if (wRes.ok) {
      const wData = await wRes.json();
      const c = wData.current ?? {};
      weather = {
        temp:       c.temperature_2m       ?? "N/A",
        humidity:   c.relativehumidity_2m  ?? "N/A",
        wind:       c.windspeed_10m        ?? "N/A",
        solar:      c.shortwave_radiation  ?? "N/A",
        precip:     c.precipitation        ?? 0,
      };
      if (typeof weather.temp === "number") {
        utciInfo = utciLabel(
          weather.temp as number,
          weather.humidity as number,
          weather.wind as number,
          weather.solar as number,
        );
      }
    }
  } catch { /* skip */ }

  // 4. GBIF live species count
  let speciesCount = "N/A";
  try {
    const gRes = await fetch(
      `https://api.gbif.org/v1/occurrence/search?decimalLatitude=${coords.lat}` +
      `&decimalLongitude=${coords.lng}&radius=0.8&taxonKey=6&limit=0`
    );
    if (gRes.ok) {
      const gData = await gRes.json();
      speciesCount = String(gData?.count ?? "N/A");
    }
  } catch { /* skip */ }

  return { ndviValue, ndviDate, ndviStatus, weather, utciInfo, speciesCount, gshiData, carbonData };
}


// ── Markdown-lite renderer ────────────────────────────────────────────────────
function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code class='rounded bg-white/10 px-1 text-[11px] font-mono text-emerald-300'>$1</code>")
    .replace(/^#{3} (.+)$/gm, "<p class='font-semibold text-white mt-2 mb-0.5'>$1</p>")
    .replace(/^#{2} (.+)$/gm, "<p class='font-bold text-accent mt-3 mb-1 text-sm'>$1</p>")
    .replace(/^## (.+)$/gm, "<p class='font-bold text-accent mt-3 mb-1 text-sm'>$1</p>")
    .replace(/^- (.+)$/gm, "<li class='ml-4 list-disc text-white/80'>$1</li>")
    .replace(/\n\n/g, "</p><p class='mt-2'>")
    .replace(/\n/g, "<br/>");
}

// ── Context pills ─────────────────────────────────────────────────────────────
function ContextPills({ ctx, loading }: { ctx: LiveContext | null; loading: boolean }) {
  if (!ctx && !loading) return null;
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[11px] text-white/40">
        <RefreshCw className="h-3 w-3 animate-spin" /> Fetching live context…
      </div>
    );
  }
  const pills = [
    ctx?.weather?.temperature_2m   != null && { icon: Thermometer, val: `${ctx.weather.temperature_2m}°C`, label: "Air Temp",  color: "text-orange-300" },
    ctx?.weather?.relativehumidity_2m != null && { icon: Droplets, val: `${ctx.weather.relativehumidity_2m}%`, label: "Humidity", color: "text-sky-300"    },
    ctx?.weather?.windspeed_10m    != null && { icon: Wind,        val: `${ctx.weather.windspeed_10m} km/h`,  label: "Wind",     color: "text-slate-300"  },
    ctx?.flood?.riskScore          != null && { icon: Zap,         val: `${(ctx.flood.riskScore * 100).toFixed(0)}% risk`, label: "Flood", color: "text-amber-300" },
    ctx?.gbif?.count               != null && { icon: Leaf,        val: `${ctx.gbif.count} spp`,              label: "Species",  color: "text-emerald-300"},
  ].filter(Boolean) as { icon: any; val: string; label: string; color: string }[];

  return (
    <div className="flex flex-wrap gap-1.5">
      {pills.map((p) => (
        <span key={p.label} className={`inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-forest/80 px-2 py-0.5 text-[10px] font-medium ${p.color}`}>
          <p.icon className="h-2.5 w-2.5" />
          <span className="text-white/50">{p.label}:</span> {p.val}
        </span>
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export function AIHelpDeskPanel() {
  const [park, setPark]       = useState<ParkOption>(PARKS[0]);
  const [model, setModel]     = useState<string>(DEFAULT_MODEL);
  const [models, setModels]   = useState<ModelOption[]>(FALLBACK_MODELS);
  const [input, setInput]     = useState("");
  const [thinking, setThinking] = useState(false);
  const [ctxLoading, setCtxLoading] = useState(false);
  const [liveCtx, setLiveCtx] = useState<LiveContext | null>(null);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [history, setHistory] = useState<Message[]>(() => {
    try {
      const raw = localStorage.getItem(LS_HISTORY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, thinking]);

  // Persist history
  useEffect(() => {
    try { localStorage.setItem(LS_HISTORY, JSON.stringify(history.slice(-40))); } catch {} 
  }, [history]);

  // Load available models from backend
  useEffect(() => {
    fetch(`${API_BASE}/api/v1/ai/models`)
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.models)) setModels(d.models);
        setBackendOnline(true);
      })
      .catch(() => setBackendOnline(false));
  }, []);

  // Load live context when park changes
  useEffect(() => {
    setCtxLoading(true);
    setLiveCtx(null);
    fetchRealParkContext(park.id)
      .then(ctx => setLiveCtx(ctx as any))
      .catch(() => setLiveCtx(null))
      .finally(() => setCtxLoading(false));
  }, [park]);

  async function sendMessage(text: string = input.trim()) {
    if (!text || thinking) return;
    setInput("");

    const userMsg: Message = { role: "user", content: text, ts: Date.now() };
    setHistory(prev => [...prev, userMsg]);
    setThinking(true);

    try {
      // ── Mode 1: Backend proxy (preferred — key stays secret on server) ────────
      if (backendOnline !== false) {
        try {
          const res = await fetch(`${API_BASE}/api/v1/ai/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: text,
              parkId: park.id,
              model,
              context: liveCtx,
              history: history.slice(-8).map(h => ({ role: h.role, content: h.content })),
            }),
            signal: AbortSignal.timeout(8000),
          });

          if (res.ok) {
            const data = await res.json();
            setLiveCtx(data.context ?? null);
            setHistory(prev => [...prev, { role: "assistant", content: data.reply ?? "No response.", ts: Date.now() }]);
            setBackendOnline(true);
            return; // ✅ done
          }
          // Non-OK response — fall through to direct mode
          setBackendOnline(false);
        } catch {
          // Network error / timeout → backend offline, fall through to direct mode
          setBackendOnline(false);
        }
      }

      // ── Mode 2: Direct OpenRouter (uses VITE_OPENROUTER_API_KEY) ─────────────
      const directKey = (import.meta as any).env?.VITE_OPENROUTER_API_KEY as string | undefined;
      if (!directKey) {
        throw new Error(
          "No VITE_OPENROUTER_API_KEY found.\n\n" +
          "Open smart-green-space/.env and add:\n" +
          "VITE_OPENROUTER_API_KEY=sk-or-xxxx\n\n" +
          "Get a FREE key at https://openrouter.ai/keys — then restart npm run dev"
        );
      }

      // Fetch real data BEFORE calling the LLM (parallel: weather + GBIF + backend)
      const ctx = await fetchRealParkContext(park.id);

      const systemPrompt = `You are the AI assistant for the Smart Green Space Digital Twin (Delhi NCR).
You are answering questions about ${park.name} (${park.city}).

## ⚡ REAL LIVE DATA FOR ${park.name.toUpperCase()}

### NASA MODIS/AppEEARS Satellite NDVI (MOD13Q1 · 250 m)
- Latest NDVI Value: **${ctx.ndviValue}** (measured ${ctx.ndviDate})
- Vegetation Status: **${ctx.ndviStatus}**

### Smart Green Space Backend — GSHI Scores
${ctx.gshiData?.gshiCurrent ? `- Overall GSHI Score: **${ctx.gshiData.gshiCurrent.overallScore}/100**
- Vegetation Index: **${ctx.gshiData.gshiCurrent.vegetationIndex ?? "N/A"}**
- Thermal Comfort: **${ctx.gshiData.gshiCurrent.thermalComfort ?? "N/A"}**
- Water Health: **${ctx.gshiData.gshiCurrent.waterHealth ?? "N/A"}**
- Biodiversity Score: **${ctx.gshiData.gshiCurrent.biodiversityScore ?? "N/A"}/100**
- Active Alerts: **${ctx.gshiData.activeAlerts ?? 0}**
- Online Sensors: **${ctx.gshiData.onlineSensors ?? 0}**
- Unique Species Detected: **${ctx.gshiData.speciesCount ?? "N/A"}**` : "- GSHI data not yet available (no active sensors)"}

### Carbon Sequestration & Tree Health
${ctx.carbonData?.annualCo2SequestrationTonnes ? `- Annual CO₂ Sequestration: **${ctx.carbonData.annualCo2SequestrationTonnes} tonnes/year**
- Tree Canopy Coverage: **${ctx.carbonData.treeCanopyCoveragePercent ?? "N/A"}%**
- Vegetation Health Status: **${ctx.carbonData.vegetationHealthStatus ?? "N/A"}**
- Unique Tree Species: **${ctx.carbonData.dataPoints?.uniqueSpeciesCount ?? "N/A"}**` : "- Carbon data pending sensor data integration"}

### Open-Meteo Live Weather
- Air Temperature: **${ctx.weather.temp}°C**
- Relative Humidity: **${ctx.weather.humidity}%**
- Wind Speed: **${ctx.weather.wind} km/h**
- Precipitation: **${ctx.weather.precip} mm**

### UTCI Thermal Comfort 
- UTCI Index: **${ctx.utciInfo?.utci ?? "N/A"}°C**
- Comfort Assessment: **${ctx.utciInfo?.label ?? "N/A"}**

### GBIF Biodiversity (Bird Species in 0.8km radius)
- Documented Species Occurrences: **${ctx.speciesCount}**

## Platform Methodology (For your knowledge)
If asked how the Green Space Health Index (GSHI) is calculated, explain that it is our proprietary composite metric (scored 0-100) combining 7 components:
1. Vegetation Health (NDVI) - 22% weight
2. Thermal Comfort (Heat Index/UTCI) - 18% weight
3. Water/Irrigation - 17% weight
4. Biodiversity (Shannon Index) - 15% weight
5. Air Quality (PM2.5/PM10/CO2) - 10% weight
6. Infrastructure Quality - 9% weight
7. Tree Health (AI Scans) - 9% weight

Carbon sequestration calculation: Area (ha) × NDVI vegetation index × 2.5 tonnes CO₂/hectare/year

Current time: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`;


      const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${directKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://smart-green-space.delhi.gov.in",
          "X-Title": "Smart Green Space AI Help Desk",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            ...history.slice(-8).map(h => ({ role: h.role, content: h.content })),
            { role: "user", content: text },
          ],
          max_tokens: 1024,
          temperature: 0.4,
        }),
      });

      if (!orRes.ok) {
        const errData = await orRes.json().catch(() => ({}));
        throw new Error(errData?.error?.message ?? `OpenRouter error ${orRes.status}`);
      }

      const orData = await orRes.json();
      const reply = orData.choices?.[0]?.message?.content ?? "No response received.";
      setHistory(prev => [...prev, {
        role: "assistant",
        content: reply,
        ts: Date.now(),
      }]);

    } catch (err: any) {
      setHistory(prev => [
        ...prev,
        {
          role: "assistant",
          content:
            `⚠️ **${err?.message ?? "Could not reach AI."}**\n\n` +
            `**Quick fix:** Open \`smart-green-space/.env\` → add \`VITE_OPENROUTER_API_KEY=sk-or-xxxx\` → restart \`npm run dev\`.\n\n` +
            `Get a free key at [openrouter.ai/keys](https://openrouter.ai/keys).`,
          ts: Date.now(),
        },
      ]);
    } finally {
      setThinking(false);
      inputRef.current?.focus();
    }
  }


  function clearHistory() {
    setHistory([]);
    setLiveCtx(null);
    try { localStorage.removeItem(LS_HISTORY); } catch {}
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <section className="flex h-[calc(100vh-6rem)] flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between shrink-0">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent/90">AI Help Desk</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-white md:text-3xl">
            Park Intelligence Assistant
          </h2>
          <p className="mt-1 text-sm text-white/55 flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            Ask anything about a park — powered by live sensor data + OpenRouter LLMs
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* AI / Backend status */}
          {(() => {
            const hasFrontendKey = Boolean((import.meta as any).env?.VITE_OPENROUTER_API_KEY);
            if (backendOnline === true) {
              return (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-900/30 px-3 py-1 text-[11px] font-semibold text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Backend Live
                </span>
              );
            }
            if (hasFrontendKey) {
              return (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/30 bg-sky-900/30 px-3 py-1 text-[11px] font-semibold text-sky-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse" />
                  AI Ready · Direct Mode
                </span>
              );
            }
            return (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-red-400/30 bg-red-900/30 px-3 py-1 text-[11px] font-semibold text-red-300">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                No API Key Set
              </span>
            );
          })()}


          {/* Park selector */}
          <div className="flex items-center gap-2 rounded-lg border border-white/12 bg-forest/80 px-2 py-1.5">
            <MapPin className="h-3.5 w-3.5 text-accent shrink-0" />
            <select
              value={park.id}
              onChange={(e) => setPark(PARKS.find(p => p.id === e.target.value) ?? PARKS[0])}
              className="border-none bg-transparent text-xs font-medium text-white outline-none"
            >
              {PARKS.map(p => (
                <option key={p.id} value={p.id} className="bg-forest text-white">{p.name}</option>
              ))}
            </select>
          </div>

          {/* Model selector */}
          <div className="flex items-center gap-2 rounded-lg border border-white/12 bg-forest/80 px-2 py-1.5">
            <Cpu className="h-3.5 w-3.5 text-sky-400 shrink-0" />
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              className="border-none bg-transparent text-xs font-medium text-white outline-none max-w-[160px]"
            >
              {models.map(m => (
                <option key={m.id} value={m.id} className="bg-forest text-white">{m.label}</option>
              ))}
            </select>
          </div>

          {history.length > 0 && (
            <button
              type="button"
              onClick={clearHistory}
              className="rounded-lg border border-white/12 bg-forest/80 px-3 py-1.5 text-[11px] text-white/60 hover:border-red-400/30 hover:text-red-300 transition"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Live context strip */}
      <div className="rounded-xl border border-white/[0.07] bg-canopy/80 px-4 py-2.5 shadow-card shrink-0">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[11px] text-white/40 font-semibold uppercase tracking-wider">Live context</span>
          <span className="text-white/30">·</span>
          <span className="text-[11px] text-white/60 font-medium flex items-center gap-1">
            <MapPin className="h-3 w-3 text-accent" />{park.name} · {park.city}
          </span>
          <ContextPills ctx={liveCtx} loading={ctxLoading} />
          {!liveCtx && !ctxLoading && (
            <span className="text-[11px] text-white/30">Context updates after first message</span>
          )}
        </div>
      </div>

      {/* Chat window */}
      <div className="flex-1 min-h-0 rounded-xl border border-white/[0.07] bg-canopy/80 shadow-card overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
          {history.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-full gap-6 py-8">
              <div className="relative">
                <div className="h-20 w-20 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center shadow-glow">
                  <Bot className="h-10 w-10 text-accent" />
                </div>
                <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-emerald-400 border-2 border-canopy animate-pulse" />
              </div>
              <div className="text-center max-w-md">
                <h3 className="font-display text-lg font-semibold text-white">
                  AI Park Intelligence
                </h3>
                <p className="mt-2 text-sm text-white/55">
                  Ask me anything about <span className="text-accent font-semibold">{park.name}</span> —
                  from thermal comfort and carbon sequestration to flood risk and biodiversity.
                  I have access to live sensor data.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => sendMessage(q)}
                    className="group flex items-center gap-2 rounded-lg border border-white/[0.07] bg-forest/60 px-3 py-2 text-left text-[11px] text-white/65 hover:border-accent/25 hover:text-white/90 hover:bg-forest/90 transition"
                  >
                    <MessageSquare className="h-3.5 w-3.5 text-accent/70 shrink-0 group-hover:text-accent" />
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            history.map((msg) => (
              <div key={msg.ts} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="h-7 w-7 rounded-full bg-accent/15 border border-accent/25 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="h-3.5 w-3.5 text-accent" />
                  </div>
                )}
                <div className={`max-w-[82%] rounded-xl px-4 py-3 text-sm shadow-card ${
                  msg.role === "user"
                    ? "bg-accent/20 border border-accent/25 text-white rounded-tr-sm"
                    : "bg-forest/80 border border-white/[0.07] text-white/85 rounded-tl-sm"
                }`}>
                  {msg.role === "assistant" ? (
                    <div
                      className="prose-sm text-white/85 leading-relaxed space-y-1"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                    />
                  ) : (
                    <p className="text-white">{msg.content}</p>
                  )}
                  <p className={`mt-1.5 text-[10px] ${msg.role === "user" ? "text-accent/50 text-right" : "text-white/30"}`}>
                    {new Date(msg.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {msg.role === "user" && (
                  <div className="h-7 w-7 rounded-full bg-white/10 border border-white/15 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold text-white/60">
                    U
                  </div>
                )}
              </div>
            ))
          )}

          {/* Thinking indicator */}
          {thinking && (
            <div className="flex gap-3 justify-start">
              <div className="h-7 w-7 rounded-full bg-accent/15 border border-accent/25 flex items-center justify-center shrink-0">
                <Bot className="h-3.5 w-3.5 text-accent" />
              </div>
              <div className="rounded-xl rounded-tl-sm bg-forest/80 border border-white/[0.07] px-4 py-3 shadow-card">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="h-2 w-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="h-2 w-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: "300ms" }} />
                  <span className="ml-2 text-[11px] text-white/40">Analysing {park.name}…</span>
                </div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Input bar */}
        <div className="shrink-0 border-t border-white/[0.07] bg-forest/60 p-3">
          {/* Quick suggestions (shown only when there's history) */}
          {history.length > 0 && history.length % 3 === 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {SUGGESTED_QUESTIONS.slice(0, 3).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => sendMessage(q)}
                  className="rounded-full border border-white/10 bg-forest/80 px-2.5 py-0.5 text-[10px] text-white/55 hover:border-accent/25 hover:text-white/85 transition"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ask about ${park.name}… (Enter to send, Shift+Enter for new line)`}
              rows={1}
              className="flex-1 resize-none overflow-hidden rounded-xl border border-white/15 bg-canopy/90 px-4 py-2.5 text-[13px] text-white placeholder:text-white/30 outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10 transition"
              style={{ minHeight: "2.75rem", maxHeight: "8rem" }}
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = "auto";
                t.style.height = Math.min(t.scrollHeight, 128) + "px";
              }}
            />
            <button
              type="button"
              onClick={() => sendMessage()}
              disabled={!input.trim() || thinking}
              className="h-11 w-11 shrink-0 rounded-xl bg-accent text-forest flex items-center justify-center shadow-glow hover:brightness-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {thinking ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-1.5 text-[10px] text-white/30 text-center">
            Powered by OpenRouter · {models.find(m => m.id === model)?.label ?? model} · 
            Context: {park.name} live telemetry
          </p>
        </div>
      </div>
    </section>
  );
}
