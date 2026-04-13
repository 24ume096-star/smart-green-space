import { Bell, ChevronDown, TreePine, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const CITIES = [
  "Bengaluru",
  "Hyderabad",
  "Pune",
  "Chennai",
  "Mumbai",
  "Delhi NCR",
];

type Props = {
  city: string;
  onCityChange: (city: string) => void;
};

export function Header({ city, onCityChange }: Props) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#0F1B12]/90 px-6 backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" />

      <div className="flex min-w-0 items-center gap-4">
        <div className="hidden items-center gap-3 sm:flex">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent/30 to-accent/5 ring-1 ring-accent/25">
            <TreePine className="h-5 w-5 text-accent" strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-lg font-bold tracking-tight text-white md:text-xl">
              Smart Green Space<span className="text-accent">.</span>
            </h1>
            <p className="truncate text-xs text-white/40">
              Urban Ecosystem Intelligence
            </p>
          </div>
        </div>
        <button type="button" onClick={() => navigate("/")} className="hidden items-center gap-1 rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-white/35 transition hover:border-white/20 hover:text-white/60 md:flex">
          <ArrowLeft className="h-3 w-3" /> Home
        </button>
      </div>

      <div className="flex items-center gap-3 md:gap-4">
        <div className="relative">
          <label htmlFor="city-select" className="sr-only">
            City
          </label>
          <select
            id="city-select"
            value={city}
            onChange={(e) => onCityChange(e.target.value)}
            className="h-10 cursor-pointer appearance-none rounded-lg border border-white/10 bg-canopy/90 pl-3 pr-9 text-sm font-medium text-white/90 shadow-card outline-none ring-0 transition hover:border-accent/30 focus:border-accent/50 focus:ring-2 focus:ring-accent/20"
          >
            {CITIES.map((c) => (
              <option key={c} value={c} className="bg-canopy text-white">
                {c}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40"
            aria-hidden
          />
        </div>

        <button
          type="button"
          className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/80 transition hover:border-accent/25 hover:bg-accent/10 hover:text-accent"
          aria-label="Notifications"
        >
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-forest">
            7
          </span>
        </button>

        <button
          type="button"
          className="flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] pl-1 pr-2 transition hover:border-accent/25"
          aria-label="Account menu"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-accent/40 to-accent/10 text-sm font-semibold text-forest">
            AD
          </span>
          <span className="hidden text-left text-xs font-medium text-white/70 sm:block">
            Admin
          </span>
        </button>
      </div>
    </header>
  );
}
