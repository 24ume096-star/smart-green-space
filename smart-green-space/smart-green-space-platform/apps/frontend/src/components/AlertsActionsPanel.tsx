import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Flame,
  Leaf,
  MapPin,
  Radio,
  Siren,
  Waves,
  Bug,
  UserPlus,
} from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Severity = "Critical" | "Warning" | "Info";
type Status = "Unresolved" | "Resolved" | "Assigned";
type Category = "Heat" | "Flood" | "Disease" | "Pest" | "Sensor Offline";

type AlertItem = {
  id: string;
  severity: Severity;
  category: Category;
  title: string;
  description: string;
  park: string;
  zone: string;
  timestamp: string;
  status: Status;
  aiReasoning: string;
  recommended: string[];
};

const ALERTS_DEFAULT: AlertItem[] = [
  {
    id: "AL-1007", severity: "Critical", category: "Heat",
    title: "🔥 Heat Stress Detected — Lodhi Garden, Zone 3",
    description: "NDVI dropped 18% in 24 hours. Thermal sensor reads 41.3°C. AI confidence: 92%.",
    park: "Lodhi Garden", zone: "Zone 3", timestamp: "6 mins ago", status: "Unresolved",
    aiReasoning: "Rapid canopy cooling loss + temperature anomaly. NDVI decline exceeds seasonal baseline.",
    recommended: ["Trigger short-cycle irrigation (20–30 min).", "Deploy temporary shading.", "Field inspection within 4 hours."],
  },
  {
    id: "AL-1005", severity: "Critical", category: "Disease",
    title: "🌿 Disease Risk Cluster — Nehru Park, Zone 2",
    description: "CV model flags leaf blight across 5 trees. Spread probability: high. AI confidence: 89%.",
    park: "Nehru Park", zone: "Zone 2", timestamp: "22 mins ago", status: "Assigned",
    aiReasoning: "Patterned discoloration with necrotic edges detected by CV; spatial clustering suggests pathogen spread.",
    recommended: ["Assign arborist team for sampling.", "Apply fungicide within 7 days.", "Increase monitoring cadence for 72 hours."],
  },
  {
    id: "AL-0998", severity: "Warning", category: "Flood",
    title: "💧 Flood Risk Rising — Yamuna Belt, Zone 5",
    description: "Rainfall forecast + drainage model indicates waterlogging risk in low-lying corridor.",
    park: "Yamuna Belt", zone: "Zone 5", timestamp: "1 hr ago", status: "Unresolved",
    aiReasoning: "Hydrology model shows saturation approaching threshold. Historical overflow points align with current runoff.",
    recommended: ["Inspect and clear inlets.", "Pre-position signage; restrict access if water level crosses threshold."],
  },
  {
    id: "AL-0992", severity: "Warning", category: "Pest",
    title: "🐛 Pest Activity Spike — Central Park, Zone 1",
    description: "Acoustic + citizen reports indicate caterpillar activity; foliage damage risk moderate.",
    park: "Central Park", zone: "Zone 1", timestamp: "2 hrs ago", status: "Unresolved",
    aiReasoning: "Multi-source corroboration suggests active infestation. Early intervention reduces canopy loss.",
    recommended: ["Deploy targeted biological control.", "Inspect high-risk trees and prune affected branches."],
  },
  {
    id: "AL-0989", severity: "Info", category: "Sensor Offline",
    title: "📡 Sensor Offline — NODE-011, Nehru Park",
    description: "Last uplink 3h ago. Battery voltage trending low. Mesh rerouted through G-3.",
    park: "Nehru Park", zone: "Zone 4", timestamp: "3 hrs ago", status: "Assigned",
    aiReasoning: "Link quality degraded prior to drop; battery telemetry suggests imminent failure.",
    recommended: ["Schedule battery replacement.", "Validate enclosure seal and cable integrity."],
  },
];

const ACTION_LOG_DEFAULT = [
  { t: "10 mins ago", text: "Irrigation auto-triggered — Node 7 — cooling cycle executed" },
  { t: "2 hrs ago",   text: "Maintenance team assigned — Tree Disease Alert — Nehru Park" },
  { t: "6 hrs ago",   text: "Sensor battery replacement scheduled — NODE-011 — field visit queued" },
  { t: "1 day ago",   text: "Alert escalated to Municipal Commissioner — Flood Risk advisory issued" },
];

const ALERT_ANALYTICS = [
  { week: "W-3", Heat: 4, Flood: 2, Disease: 2, Pest: 1, Sensor: 3 },
  { week: "W-2", Heat: 5, Flood: 1, Disease: 3, Pest: 2, Sensor: 4 },
  { week: "W-1", Heat: 6, Flood: 2, Disease: 2, Pest: 3, Sensor: 2 },
  { week: "W",   Heat: 3, Flood: 1, Disease: 2, Pest: 2, Sensor: 4 },
];

const LS_ALERTS = "sgs_alerts_v1";
const LS_ACTIONLOG = "sgs_action_log_v1";
const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:8080";

function loadAlerts(): AlertItem[] {
  try {
    const raw = localStorage.getItem(LS_ALERTS);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : ALERTS_DEFAULT;
  } catch { return ALERTS_DEFAULT; }
}

function saveAlerts(alerts: AlertItem[]) {
  try { localStorage.setItem(LS_ALERTS, JSON.stringify(alerts)); } catch {}
}

function loadActionLog(): typeof ACTION_LOG_DEFAULT {
  try {
    const raw = localStorage.getItem(LS_ACTIONLOG);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : ACTION_LOG_DEFAULT;
  } catch { return ACTION_LOG_DEFAULT; }
}

function saveActionLog(log: typeof ACTION_LOG_DEFAULT) {
  try { localStorage.setItem(LS_ACTIONLOG, JSON.stringify(log.slice(0, 20))); } catch {}
}

function appendAction(log: typeof ACTION_LOG_DEFAULT, text: string): typeof ACTION_LOG_DEFAULT {
  const entry = { t: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), text };
  const updated = [entry, ...log];
  saveActionLog(updated);
  return updated;
}

function severityStyles(sev: Severity) {
  if (sev === "Critical") return "border-red-500/50 bg-red-500/10 text-red-200";
  if (sev === "Warning")  return "border-amber-400/50 bg-amber-500/10 text-amber-200";
  return "border-sky-400/40 bg-sky-500/10 text-sky-200";
}

function categoryIcon(cat: Category) {
  if (cat === "Heat")           return <Flame   className="h-4 w-4 text-orange-300" />;
  if (cat === "Flood")          return <Waves   className="h-4 w-4 text-sky-300" />;
  if (cat === "Disease")        return <Leaf    className="h-4 w-4 text-emerald-300" />;
  if (cat === "Pest")           return <Bug     className="h-4 w-4 text-amber-300" />;
  return                               <Radio   className="h-4 w-4 text-white/65" />;
}

type FeedFilter = "All" | "Unresolved" | "Resolved" | "Assigned";

export function AlertsActionsPanel() {
  const [tab, setTab]           = useState<FeedFilter>("All");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [alerts, setAlerts]     = useState<AlertItem[]>(loadAlerts);
  const [actionLog, setActionLog] = useState(loadActionLog);

  // Auto-ingest live flood alert from ML backend on mount
  useEffect(() => {
    (async () => {
      try {
        const parks = ["deer", "lodhi", "nehru"];
        for (const parkId of parks) {
          const res = await fetch(`${API_BASE_URL}/api/v1/flood/${parkId}/risk`);
          if (!res.ok) continue;
          const data = await res.json();
          const risk = Number(data?.data?.riskScore ?? data?.riskScore ?? 0);
          const level = data?.data?.riskLevel ?? data?.riskLevel ?? "";
          if (risk > 0.65 || level === "WARNING" || level === "EMERGENCY") {
            const newId = `AL-LIVE-${parkId.toUpperCase()}`;
            setAlerts((prev) => {
              if (prev.some((a) => a.id === newId)) return prev;
              const newAlert: AlertItem = {
                id: newId, severity: risk > 0.8 ? "Critical" : "Warning", category: "Flood",
                title: `💧 Live Flood Risk — ${parkId.charAt(0).toUpperCase() + parkId.slice(1)} Park (ML Backend)`,
                description: `Real-time ML model: riskScore=${(risk * 100).toFixed(0)}%, level=${level}. GEE + NDVI pipeline active.`,
                park: parkId, zone: "Auto-detected", timestamp: "Just now", status: "Unresolved",
                aiReasoning: `Live Random Forest inference from GEE terrain + NDVI + soil saturation. Score: ${(risk * 100).toFixed(1)}%.`,
                recommended: ["Review GeoJSON heatmap in Flood Monitoring panel.", "Pre-position field teams.", "Send drainage advisory."],
              };
              const updated = [newAlert, ...prev];
              saveAlerts(updated);
              return updated;
            });
          }
        }
      } catch { /* backend offline — silently skip */ }
    })();
  }, []);

  function markResolved(id: string) {
    setAlerts((prev) => {
      const updated = prev.map((a) => a.id === id ? { ...a, status: "Resolved" as Status } : a);
      saveAlerts(updated);
      return updated;
    });
    setActionLog((prev) => appendAction(prev, `Alert ${id} marked resolved`));
  }

  function assignTask(id: string) {
    const name = window.prompt("Assign to (name/team):", "Field Team A");
    if (!name) return;
    setAlerts((prev) => {
      const updated = prev.map((a) => a.id === id ? { ...a, status: "Assigned" as Status, description: `${a.description} — Assigned to: ${name}` } : a);
      saveAlerts(updated);
      return updated;
    });
    setActionLog((prev) => appendAction(prev, `Alert ${id} assigned to ${name}`));
  }

  function escalate(id: string) {
    setAlerts((prev) => {
      const updated = prev.map((a) => a.id === id ? { ...a, severity: "Critical" as Severity, status: "Unresolved" as Status } : a);
      saveAlerts(updated);
      return updated;
    });
    setActionLog((prev) => appendAction(prev, `Alert ${id} escalated to Critical`));
  }

  const visible = useMemo(() => {
    if (tab === "All") return alerts;
    return alerts.filter((a) => a.status === tab);
  }, [tab, alerts]);

  const counts = useMemo(() => {
    const c = { Critical: 0, Warning: 0, Info: 0 };
    for (const a of alerts) c[a.severity] += 1;
    return c;
  }, [alerts]);



  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-white/[0.08] bg-canopy/95 px-4 py-3 shadow-card">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-3 text-xs text-white/80">
            <span className="inline-flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1">
              <span className="h-2 w-2 rounded-full bg-red-400" />
              <span className="font-semibold">Critical</span>
              <span className="text-white/60">({counts.Critical})</span>
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1">
              <span className="h-2 w-2 rounded-full bg-amber-300" />
              <span className="font-semibold">Warning</span>
              <span className="text-white/60">({counts.Warning})</span>
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/35 bg-emerald-500/10 px-3 py-1">
              <span className="h-2 w-2 rounded-full bg-emerald-300" />
              <span className="font-semibold">Info</span>
              <span className="text-white/60">({counts.Info})</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(["All", "Unresolved", "Resolved", "Assigned"] as FeedFilter[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={[
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                  tab === t
                    ? "bg-accent text-forest shadow-glow"
                    : "border border-white/15 bg-forest/70 text-white/75 hover:border-accent/35",
                ].join(" ")}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        <div className="rounded-xl border border-white/[0.08] bg-canopy/95 p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-sm font-semibold text-white">Alert feed</h3>
              <p className="mt-0.5 text-[11px] text-white/55">
                Scrollable feed · {visible.length} alerts shown
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-accent/20 bg-forest/70 px-3 py-1 text-[11px] text-white/70">
              <span className="relative inline-flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-pulse-soft rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
              </span>
              <span className="font-semibold uppercase tracking-wide">Live</span>
            </div>
          </div>

          <div className="custom-scrollbar mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-1">
            {visible.map((a) => {
              const isExpanded = !!expanded[a.id];
              return (
                <div
                  key={a.id}
                  className="group relative overflow-hidden rounded-xl border border-white/[0.08] bg-forest/75 p-4 shadow-card transition hover:border-accent/25 hover:shadow-glow"
                >
                  <div
                    className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-accent/10 blur-2xl opacity-0 transition group-hover:opacity-100"
                    aria-hidden
                  />

                  <div className="relative flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${severityStyles(
                            a.severity,
                          )}`}
                        >
                          {a.severity}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-black/20 px-2 py-0.5 text-[10px] text-white/70">
                          {categoryIcon(a.category)}
                          <span>{a.category}</span>
                        </span>
                        <span className="text-[10px] text-white/40">#{a.id}</span>
                      </div>

                      <p className="mt-2 text-sm font-semibold text-white/90">{a.title}</p>
                      <p className="mt-1 text-xs text-white/65">{a.description}</p>

                      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-white/55">
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-accent" />
                          <span>
                            {a.park} · {a.zone}
                          </span>
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <AlertCircle className="h-3.5 w-3.5 text-white/45" />
                          <span>{a.timestamp}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => assignTask(a.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[11px] font-semibold text-forest hover:brightness-95"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        Assign Task
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-white/15 bg-forest/70 px-3 py-1.5 text-[11px] font-semibold text-white/80 hover:border-accent/35"
                      >
                        View on Map
                      </button>
                      <button
                        type="button"
                        onClick={() => markResolved(a.id)}
                        disabled={a.status === "Resolved"}
                        className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-200 hover:border-emerald-400/50 disabled:opacity-40"
                      >
                        {a.status === "Resolved" ? "✓ Resolved" : "Mark Resolved"}
                      </button>
                      <button
                        type="button"
                        onClick={() => escalate(a.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-[11px] font-semibold text-red-200 hover:border-red-400/50"
                      >
                        <Siren className="h-3.5 w-3.5" />
                        Escalate
                      </button>
                    </div>
                  </div>

                  <div className="relative mt-3">
                    <button
                      type="button"
                      onClick={() => setExpanded((p) => ({ ...p, [a.id]: !p[a.id] }))}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-black/20 px-2.5 py-1 text-[11px] text-white/70 hover:border-accent/30"
                    >
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      {isExpanded ? "Hide AI reasoning" : "Show AI reasoning + recommended action"}
                    </button>

                    {isExpanded ? (
                      <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-white/75">
                        <p className="font-semibold text-white/85">AI reasoning</p>
                        <p className="mt-1 text-white/70">{a.aiReasoning}</p>
                        <p className="mt-3 font-semibold text-white/85">Recommended action</p>
                        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-white/70">
                          {a.recommended.map((r) => (
                            <li key={r}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-white/[0.08] bg-canopy/95 p-4 shadow-card">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display text-sm font-semibold text-white">Action log</h3>
              <span className="text-[11px] text-white/55">Automated + manual</span>
            </div>
            <div className="mt-3 space-y-2">
              {actionLog.slice(0, 6).map((a, i) => (
                <div
                  key={`${a.t}-${i}`}
                  className="relative rounded-lg border border-white/10 bg-forest/75 px-3 py-2 text-xs text-white/80"
                >
                  <p className="text-[11px] text-white/50">{a.t}</p>
                  <p className="mt-0.5">{a.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-canopy/95 p-4 shadow-card">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display text-sm font-semibold text-white">Alert analytics</h3>
              <span className="rounded-full border border-white/12 bg-forest/70 px-3 py-1 text-[11px] text-white/70">
                Avg resolution time: <span className="font-semibold text-white">4.2 hours</span>
              </span>
            </div>
            <div className="mt-3 h-44 rounded-lg border border-white/10 bg-forest/80 px-2 py-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ALERT_ANALYTICS} margin={{ top: 10, right: 12, bottom: 6, left: 0 }}>
                  <XAxis
                    dataKey="week"
                    tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 10 }}
                    tickLine={{ stroke: "rgba(255,255,255,0.3)" }}
                  />
                  <YAxis
                    tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 10 }}
                    tickLine={{ stroke: "rgba(255,255,255,0.3)" }}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="rounded-md border border-white/10 bg-[#0A1510]/95 px-2.5 py-1.5 text-[11px] text-white/85">
                          <p className="font-semibold text-white">{String(label)}</p>
                          {payload.map((p, i) => (
                            <p key={`${String(p.name ?? p.dataKey)}-${i}`}>
                              {String(p.name ?? p.dataKey)}:{" "}
                              <span className="text-accent">{String(p.value)}</span>
                            </p>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="Heat" stackId="a" fill="#F97316" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Flood" stackId="a" fill="#38BDF8" />
                  <Bar dataKey="Disease" stackId="a" fill="#22C55E" />
                  <Bar dataKey="Pest" stackId="a" fill="#FACC15" />
                  <Bar dataKey="Sensor" stackId="a" fill="#A78BFA" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-white/60">
              <span className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-forest/70 px-2 py-0.5">
                <span className="h-2 w-2 rounded-full bg-orange-400" /> Heat
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-forest/70 px-2 py-0.5">
                <span className="h-2 w-2 rounded-full bg-sky-400" /> Flood
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-forest/70 px-2 py-0.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400" /> Disease
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-forest/70 px-2 py-0.5">
                <span className="h-2 w-2 rounded-full bg-amber-300" /> Pest
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-forest/70 px-2 py-0.5">
                <span className="h-2 w-2 rounded-full bg-violet-400" /> Sensor Offline
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

