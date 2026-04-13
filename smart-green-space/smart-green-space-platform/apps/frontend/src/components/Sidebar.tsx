import type { LucideIcon } from "lucide-react";
import {
  BarChart3, Bell, Bird, Bot, Box, Camera,
  Droplets, Home, Leaf, MapPin, Satellite, Settings,
  Users, Waves, Wifi, Wind, TreePine, ArrowLeft,
  Calculator,
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";

export type NavId =
  | "overview"
  | "map"
  | "gshi"
  | "sensors"
  | "satellite"
  | "vision"
  | "biodiversity"
  | "twin"
  | "irrigation"
  | "alerts"
  | "citizen"
  | "analytics"
  | "flood"
  | "carbon"
  | "budget-optimizer"
  | "helpdesk"
  | "settings";

export const NAV_ITEMS: { id: NavId; label: string; icon: LucideIcon }[] = [
  { id: "overview",     label: "Overview",             icon: Home      },
  { id: "map",          label: "Live Map / GIS",        icon: MapPin    },
  { id: "gshi",         label: "GSHI Score",            icon: Leaf      },
  { id: "sensors",      label: "Sensors & IoT",         icon: Wifi      },
  { id: "satellite",    label: "Satellite View",        icon: Satellite },
  { id: "vision",       label: "Computer Vision",       icon: Camera    },
  { id: "biodiversity", label: "Biodiversity",          icon: Bird      },
  { id: "twin",         label: "Digital Twin",          icon: Box       },
  { id: "irrigation",   label: "Smart Irrigation",      icon: Droplets  },
  { id: "carbon",       label: "Carbon & Thermal",      icon: Wind      },
  { id: "alerts",       label: "Alerts & Actions",      icon: Bell      },
  { id: "citizen",      label: "Citizen Reports",       icon: Users     },
  { id: "analytics",    label: "Analytics & Reports",   icon: BarChart3 },
  { id: "flood",        label: "Flood Monitoring",      icon: Waves     },
  { id: "budget-optimizer", label: "Budget Optimizer",  icon: Calculator },
  { id: "helpdesk",     label: "AI Help Desk",          icon: Bot       },
  { id: "settings",     label: "Settings",              icon: Settings  },
];

export function Sidebar() {
  const navigate = useNavigate();
  return (
    <aside
      className="fixed left-0 top-0 z-40 flex h-screen w-[240px] flex-col border-r border-accent/10 bg-[#0a1510]/95 backdrop-blur-xl"
      aria-label="Primary navigation"
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-accent/[0.04] via-transparent to-transparent" />
      <div className="relative flex h-16 shrink-0 items-center justify-between border-b border-white/5 px-4">
        <button type="button" onClick={() => navigate("/")} className="flex items-center gap-2 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 ring-1 ring-accent/30 group-hover:ring-accent/50 transition">
            <TreePine className="h-5 w-5 text-accent" strokeWidth={1.8} />
          </div>
          <div className="leading-tight text-left">
            <p className="font-display text-sm font-bold tracking-tight text-white/90">
              Smart Green Space<span className="text-accent">.</span>
            </p>
            <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-accent/70">
              Urban Intelligence
            </p>
          </div>
        </button>
        <button type="button" onClick={() => navigate("/")} className="flex items-center justify-center h-7 w-7 rounded-md text-white/30 hover:text-white/70 hover:bg-white/5 transition" title="Back to home">
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>
      </div>

      <nav className="relative flex-1 overflow-y-auto px-2 py-4">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-white/35">
          Command
        </p>
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const to = id === "overview" ? "/dashboard" : `/dashboard/${id}`;
            return (
              <li key={id}>
                <NavLink
                  to={to}
                  end={id === "overview"}
                  className={({ isActive }) => [
                    "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-all duration-200",
                    isActive
                      ? "bg-accent/15 text-white shadow-glow ring-1 ring-accent/35"
                      : "text-white/65 hover:bg-white/[0.06] hover:text-white",
                  ].join(" ")}
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={[
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors",
                          isActive
                            ? "bg-accent/25 text-accent"
                            : "bg-white/5 text-white/50 group-hover:bg-white/10 group-hover:text-white/80",
                        ].join(" ")}
                      >
                        <Icon className="h-4 w-4" strokeWidth={isActive ? 2.25 : 2} />
                      </span>
                      <span className="truncate font-medium">{label}</span>
                    </>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="relative shrink-0 border-t border-white/5 p-3">
        <div className="rounded-lg border border-accent/15 bg-canopy/80 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-40" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            <span className="text-[11px] font-medium text-white/80">Uplink stable</span>
          </div>
          <p className="mt-1 text-[10px] text-white/45">v2.4 · Smart Green Space AI mesh</p>
        </div>
      </div>
    </aside>
  );
}
