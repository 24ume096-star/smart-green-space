import type { NavId } from "./Sidebar";

const TITLES: Record<NavId, { title: string; desc: string }> = {
  overview:     { title: "Overview",              desc: "Command overview" },
  map:          { title: "Live Map / GIS",        desc: "Geospatial layers & live asset tracking" },
  gshi:         { title: "GSHI Score",            desc: "Green Space Health Index analytics" },
  sensors:      { title: "Sensors & IoT",         desc: "Edge devices, telemetry, and health" },
  satellite:    { title: "Satellite View",        desc: "Orbital imagery & change detection" },
  vision:       { title: "Computer Vision",       desc: "On-site cameras & model outputs" },
  biodiversity: { title: "Biodiversity",          desc: "Species richness & corridor mapping" },
  twin:         { title: "Digital Twin",          desc: "3D urban ecosystem simulation" },
  irrigation:   { title: "Smart Irrigation",      desc: "Zones, schedules, and water budgets" },
  carbon:       { title: "Carbon & Thermal",      desc: "Sequestration modeling & UTCI comfort" },
  alerts:       { title: "Alerts & Actions",      desc: "Escalations and playbooks" },
  citizen:      { title: "Citizen Reports",       desc: "Crowdsourced observations" },
  analytics:    { title: "Analytics & Reports",   desc: "Exports & executive summaries" },
  flood:        { title: "Flood Monitoring",      desc: "ML flood risk heatmaps & drainage" },
  helpdesk:     { title: "AI Help Desk",          desc: "Ask anything about any park using live data" },
  settings:     { title: "Settings",              desc: "Tenants, API keys, and roles" },
};



export function PlaceholderPanel({ id, city }: { id: NavId; city: string }) {
  const meta = TITLES[id];
  return (
    <div className="rounded-xl border border-white/[0.07] bg-canopy/80 p-8 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent/90">{city}</p>
      <h2 className="mt-2 font-display text-2xl font-semibold text-white">{meta.title}</h2>
      <p className="mt-2 max-w-xl text-sm text-white/50">{meta.desc}</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="h-36 rounded-lg border border-dashed border-white/10 bg-forest/50" />
        <div className="h-36 rounded-lg border border-dashed border-white/10 bg-forest/50" />
      </div>
      <p className="mt-4 text-xs text-white/35">
        Connect data sources to replace this placeholder with live modules.
      </p>
    </div>
  );
}
