import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  ArrowRight, Leaf, Satellite, Activity, Brain, Droplets,
  Shield, Zap, Globe, TreePine, ChevronRight, Star,
  BarChart3, Map, Sparkles
} from "lucide-react";

const STATS = [
  { value: "47", label: "Parks Monitored", suffix: "+" },
  { value: "2.3M", label: "Sensor Readings / Day", suffix: "" },
  { value: "98.7", label: "Uptime SLA", suffix: "%" },
  { value: "4.2T", label: "CO₂ Tracked", suffix: "kg" },
];

const FEATURES = [
  {
    icon: Brain,
    title: "Digital Twin Engine",
    desc: "Run hyperlocal what-if simulations — flood, drought, heat stress — layered over live Esri satellite imagery with procedural fluid heatmap overlays.",
    tag: "AI Simulation",
    color: "from-violet-500/20 to-violet-500/5",
    border: "border-violet-500/25",
    iconColor: "text-violet-400",
  },
  {
    icon: Leaf,
    title: "AI Flora Diagnostics",
    desc: "Upload any leaf or bark photo. Our edge-deployed MobileNetV2 CNN detects fungal blights, pathogens, and pest damage in under 3 seconds.",
    tag: "Computer Vision",
    color: "from-emerald-500/20 to-emerald-500/5",
    border: "border-emerald-500/25",
    iconColor: "text-emerald-400",
  },
  {
    icon: Satellite,
    title: "NASA NDVI Intelligence",
    desc: "Fuse NASA AppEEARS satellite imagery with ground-truth IoT sensor data to compute a composite Green Space Health Index per park.",
    tag: "Satellite Data",
    color: "from-sky-500/20 to-sky-500/5",
    border: "border-sky-500/25",
    iconColor: "text-sky-400",
  },
  {
    icon: Activity,
    title: "Flood Risk ML Pipeline",
    desc: "Random Forest model trained on NDVI + rainfall + drainage metrics. Predicts sector-level flood risk probability updated every 6 hours.",
    tag: "Predictive ML",
    color: "from-blue-500/20 to-blue-500/5",
    border: "border-blue-500/25",
    iconColor: "text-blue-400",
  },
  {
    icon: Droplets,
    title: "Smart Irrigation AI",
    desc: "Adaptive watering schedules generated from soil moisture telemetry, weather forecasts, and plant-specific demand curves. Cut water usage by up to 38%.",
    tag: "IoT Automation",
    color: "from-cyan-500/20 to-cyan-500/5",
    border: "border-cyan-500/25",
    iconColor: "text-cyan-400",
  },
  {
    icon: Globe,
    title: "Live Traffic & Noise",
    desc: "OpenStreetMap roads enriched with TomTom Traffic Flow API v4 telemetry. Real-time congestion, speed deltas, and noise pollution heatmaps.",
    tag: "Live API",
    color: "from-amber-500/20 to-amber-500/5",
    border: "border-amber-500/25",
    iconColor: "text-amber-400",
  },
];

const TESTIMONIALS = [
  {
    quote: "Smart Green Space gave us the situational awareness we needed to preempt a major flood event in Lodhi Garden. The satellite + ML combo is unlike anything we've seen.",
    name: "Priya Mehta",
    role: "Director, Delhi Parks Authority",
    initials: "PM",
  },
  {
    quote: "We went from reactive maintenance to predictive management in 6 weeks. The Digital Twin alone has saved us ₹2.4 Cr in emergency crew deployments.",
    name: "Arjun Rathore",
    role: "Sustainability Head, NDMC",
    initials: "AR",
  },
  {
    quote: "The AI flora scanner helps our field botanists triage disease outbreaks before they spread. It's a multiplier for a team of 12 managing 47 parks.",
    name: "Dr. Sonal Gupta",
    role: "Chief Botanist, Sanjay Van Reserve",
    initials: "SG",
  },
];

const PRICING = [
  {
    name: "Starter",
    price: "₹49,000",
    period: "/ month",
    desc: "For municipal wards managing up to 5 parks.",
    features: ["5 park nodes", "GSHI dashboard", "IoT sensor hub", "Alert engine", "Email support"],
    cta: "Start Free Trial",
    highlight: false,
  },
  {
    name: "Professional",
    price: "₹1,49,000",
    period: "/ month",
    desc: "For city departments with advanced AI needs.",
    features: ["25 park nodes", "Digital Twin simulator", "AI flora diagnostics", "Flood ML pipeline", "NASA NDVI feed", "Priority support"],
    cta: "Request Demo",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    desc: "Full-stack deployment for state governments.",
    features: ["Unlimited parks", "On-premise deployment", "Custom ML models", "White-label UI", "SLA guarantee", "Dedicated CSM"],
    cta: "Contact Sales",
    highlight: false,
  },
];

function CountUp({ target, suffix }: { target: string; suffix: string }) {
  return (
    <span className="font-display text-4xl font-bold text-white md:text-5xl">
      {target}
      <span className="text-accent">{suffix}</span>
    </span>
  );
}

export function LandingPage() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen w-full bg-[#080F09] text-white overflow-x-hidden">

      {/* ── Navbar ─────────────────────────────────────────────────────── */}
      <nav className={`fixed top-0 inset-x-0 z-50 flex h-16 items-center justify-between px-6 md:px-12 transition-all duration-300 ${scrolled ? "bg-[#080F09]/95 backdrop-blur-xl border-b border-white/[0.06]" : ""}`}>
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent/40 via-accent/20 to-transparent ring-1 ring-accent/30">
            <TreePine className="h-5 w-5 text-accent" strokeWidth={1.8} />
          </div>
          <span className="font-display text-xl font-bold tracking-tight text-white">
            Smart Green Space
            <span className="ml-0.5 text-accent">.</span>
          </span>
        </div>

        <div className="hidden items-center gap-8 md:flex">
          {["Product", "Solutions", "Pricing", "Docs"].map((item) => (
            <a key={item} href={`#${item.toLowerCase()}`} className="text-sm text-white/55 transition hover:text-white">
              {item}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="hidden text-sm font-medium text-white/70 transition hover:text-white md:block"
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-[#080F09] shadow-[0_0_20px_rgba(56,189,248,0.3)] transition hover:brightness-110"
          >
            Launch App <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-6 pt-24 pb-16 text-center">
        {/* Radial glows */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-1/3 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/6 blur-[120px]" />
          <div className="absolute left-1/4 top-2/3 h-[400px] w-[400px] rounded-full bg-emerald-500/6 blur-[100px]" />
          <div className="absolute right-1/4 top-1/4 h-[350px] w-[350px] rounded-full bg-violet-500/5 blur-[90px]" />
        </div>

        {/* Grid overlay */}
        <div className="pointer-events-none absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22%3E%3Cpath d=%22M 40 0 L 0 0 0 40%22 fill=%22none%22 stroke=%22rgba(255,255,255,0.03)%22 stroke-width=%221%22/%3E%3C/svg%3E')]" />

        {/* Badge */}
        <div className="relative mb-6 inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/8 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-accent">
          <Sparkles className="h-3.5 w-3.5" />
          Now with AI Flora Diagnostics · MobileNetV2
        </div>

        {/* Headline */}
        <h1 className="relative mx-auto max-w-5xl font-display text-5xl font-bold leading-[1.05] tracking-tight text-white md:text-7xl lg:text-8xl">
          The Operating System
          <br />
          for{" "}
          <span className="bg-gradient-to-r from-accent via-emerald-300 to-accent bg-clip-text text-transparent">
            Urban Green Space
          </span>
        </h1>

        <p className="relative mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/55 md:text-xl">
          Smart Green Space fuses NASA satellite imagery, real-time IoT telemetry, and deep learning into a command-center intelligence platform that helps cities manage parks at scale — before problems become crises.
        </p>

        <div className="relative mt-10 flex flex-wrap items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2.5 rounded-2xl bg-accent px-7 py-3.5 text-base font-bold text-[#080F09] shadow-[0_0_40px_rgba(56,189,248,0.4)] transition hover:brightness-110 hover:scale-105 active:scale-100"
          >
            Launch Dashboard <ArrowRight className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="flex items-center gap-2.5 rounded-2xl border border-white/15 bg-white/5 px-7 py-3.5 text-base font-semibold text-white/85 backdrop-blur transition hover:border-white/30 hover:bg-white/10"
          >
            Watch Demo <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Trust bar */}
        <div className="relative mt-14 flex flex-wrap items-center justify-center gap-6 text-xs text-white/35">
          {["Trusted by NDMC", "Delhi Parks Authority", "IIT Delhi Urban Lab", "Ministry of Environment"].map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <Shield className="h-3 w-3 text-accent/60" /> {t}
            </span>
          ))}
        </div>

        {/* Dashboard preview mockup */}
        <div className="relative mx-auto mt-16 w-full max-w-5xl">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent shadow-[0_0_80px_rgba(0,0,0,0.8)]">
            <div className="flex h-8 items-center gap-2 border-b border-white/10 bg-white/[0.03] px-4">
              {["bg-red-400/70", "bg-amber-400/70", "bg-emerald-400/70"].map((c, i) => (
                <span key={i} className={`h-3 w-3 rounded-full ${c}`} />
              ))}
              <span className="ml-3 text-xs text-white/25">smart-green-space.gov.in/dashboard</span>
            </div>
            <div className="grid grid-cols-4 gap-2 bg-[#0A1510] p-4">
              {/* Fake dashboard tiles */}
              {[
                { label: "GSHI Score", val: "78.4", sub: "Delhi NCR Avg", color: "text-emerald-400" },
                { label: "Active Alerts", val: "12", sub: "3 critical", color: "text-red-400" },
                { label: "Parks Online", val: "47/47", sub: "All operational", color: "text-accent" },
                { label: "CO₂ Offset", val: "4.2T", sub: "This month", color: "text-violet-400" },
              ].map((tile) => (
                <div key={tile.label} className="rounded-xl border border-white/[0.07] bg-[#0F1B12]/80 p-3">
                  <p className="text-[10px] text-white/40">{tile.label}</p>
                  <p className={`mt-1 font-display text-xl font-bold ${tile.color}`}>{tile.val}</p>
                  <p className="text-[9px] text-white/30">{tile.sub}</p>
                </div>
              ))}
            </div>
            <div className="h-40 bg-gradient-to-b from-[#0A1510] to-[#080F09] px-4 pb-4">
              <div className="h-full rounded-xl border border-white/[0.06] bg-[#0A1510]/40 flex items-center justify-center">
                <span className="flex items-center gap-2 text-xs text-white/25">
                  <Map className="h-4 w-4" /> Live Satellite Intelligence Map — Delhi NCR
                </span>
              </div>
            </div>
          </div>
          {/* Glow under the card */}
          <div className="absolute -bottom-12 left-1/2 h-24 w-3/4 -translate-x-1/2 rounded-full bg-accent/10 blur-3xl" />
        </div>
      </section>

      {/* ── Stats ───────────────────────────────────────────────────────── */}
      <section className="border-y border-white/[0.06] bg-[#0A1510]/60 py-16">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <CountUp target={s.value} suffix={s.suffix} />
                <p className="mt-2 text-sm text-white/45">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────── */}
      <section id="product" className="py-24 px-6">
        <div className="mx-auto max-w-6xl">
          <p className="text-center text-xs font-bold uppercase tracking-[0.25em] text-accent/80">Platform Capabilities</p>
          <h2 className="mt-3 text-center font-display text-4xl font-bold text-white md:text-5xl">
            Intelligence at every layer
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-lg text-white/50">
            From satellite orbits to individual leaf pixels — Smart Green Space covers the full environmental sensing stack.
          </p>

          <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className={`group relative overflow-hidden rounded-2xl border ${f.border} bg-gradient-to-br ${f.color} p-6 transition hover:-translate-y-1 hover:shadow-[0_0_40px_rgba(0,0,0,0.5)]`}
              >
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white/50">
                  <Zap className="h-2.5 w-2.5" /> {f.tag}
                </span>
                <div className={`mt-4 h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center ${f.iconColor}`}>
                  <f.icon className="h-5 w-5" strokeWidth={1.8} />
                </div>
                <h3 className="mt-3 font-display text-lg font-bold text-white">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/55">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Social Proof ─────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-[#0A1510]/40">
        <div className="mx-auto max-w-6xl">
          <p className="text-center text-xs font-bold uppercase tracking-[0.25em] text-accent/80">Testimonials</p>
          <h2 className="mt-3 text-center font-display text-4xl font-bold text-white">
            Trusted by city leaders
          </h2>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="rounded-2xl border border-white/[0.08] bg-[#0F1B12]/80 p-6">
                <div className="flex gap-0.5 mb-4">
                  {Array(5).fill(0).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-accent text-accent" />
                  ))}
                </div>
                <p className="text-sm leading-relaxed text-white/70 italic">"{t.quote}"</p>
                <div className="mt-5 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-accent/40 to-accent/10 text-sm font-bold text-[#080F09]">
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{t.name}</p>
                    <p className="text-xs text-white/40">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 px-6">
        <div className="mx-auto max-w-5xl">
          <p className="text-center text-xs font-bold uppercase tracking-[0.25em] text-accent/80">Pricing</p>
          <h2 className="mt-3 text-center font-display text-4xl font-bold text-white">
            Transparent, scalable pricing
          </h2>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {PRICING.map((p) => (
              <div
                key={p.name}
                className={`relative rounded-2xl border p-6 flex flex-col ${
                  p.highlight
                    ? "border-accent/40 bg-gradient-to-b from-accent/10 to-[#0A1510] shadow-[0_0_50px_rgba(56,189,248,0.12)]"
                    : "border-white/[0.08] bg-[#0F1B12]/80"
                }`}
              >
                {p.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-[#080F09]">
                    Most Popular
                  </span>
                )}
                <h3 className="font-display text-lg font-bold text-white">{p.name}</h3>
                <p className="mt-1 text-xs text-white/45">{p.desc}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="font-display text-3xl font-bold text-white">{p.price}</span>
                  <span className="text-sm text-white/40">{p.period}</span>
                </div>
                <ul className="mt-6 flex-1 space-y-2.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-white/70">
                      <span className="h-4 w-4 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                        <ChevronRight className="h-2.5 w-2.5 text-accent" />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => navigate("/dashboard")}
                  className={`mt-8 w-full rounded-xl py-3 text-sm font-bold transition ${
                    p.highlight
                      ? "bg-accent text-[#080F09] shadow-[0_0_20px_rgba(56,189,248,0.3)] hover:brightness-110"
                      : "border border-white/15 bg-white/5 text-white hover:bg-white/10"
                  }`}
                >
                  {p.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ──────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-accent/20 bg-gradient-to-br from-accent/10 via-[#0A1510] to-emerald-900/20 p-12 text-center relative">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(56,189,248,0.12),transparent_70%)]" />
          </div>
          <TreePine className="mx-auto h-12 w-12 text-accent opacity-80" strokeWidth={1.5} />
          <h2 className="mt-4 font-display text-4xl font-bold text-white md:text-5xl">
            Your city's green spaces<br />deserve real intelligence.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-lg text-white/55">
            Start your 30-day free trial. No credit card required. Full platform access from day one.
          </p>
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="mt-8 inline-flex items-center gap-3 rounded-2xl bg-accent px-8 py-4 text-base font-bold text-[#080F09] shadow-[0_0_50px_rgba(56,189,248,0.4)] transition hover:brightness-110 hover:scale-105"
          >
            <BarChart3 className="h-5 w-5" />
            Launch Smart Green Space Now
          </button>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.06] py-12 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-2">
              <TreePine className="h-5 w-5 text-accent" strokeWidth={1.8} />
              <span className="font-display text-lg font-bold text-white">Smart Green Space<span className="text-accent">.</span></span>
            </div>
            <p className="text-xs text-white/30 text-center md:text-left">
              © 2026 Smart Green Space · Delhi Government Urban Ecosystem Lab
            </p>
            <div className="flex items-center gap-4 text-xs text-white/35">
              <a href="#" className="hover:text-white transition">Privacy</a>
              <a href="#" className="hover:text-white transition">Terms</a>
              <a href="#" className="hover:text-white transition">Security</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
