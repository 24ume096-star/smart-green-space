import { useMemo, useState, useRef } from "react";
import L, { type LatLngTuple } from "leaflet";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { Bell, CheckCircle2, MapPin, MessageSquare, ShieldCheck, User, XCircle, Upload, Scan, Leaf } from "lucide-react";

type Verification = "Pending" | "Verified" | "Rejected";
type ReportKind = "Tree damage" | "Litter" | "Wildlife sighting" | "Flooding" | "Vandalism";
type PinTone = "damage" | "wildlife" | "suggestion";

type CitizenReport = {
  id: string;
  userId: string;
  kind: ReportKind;
  tone: PinTone;
  description: string;
  locationLabel: string;
  zone: string;
  time: string;
  verification: Verification;
  position: LatLngTuple;
};

const DELHI_CENTER: LatLngTuple = [28.6139, 77.209];

const REPORTS: CitizenReport[] = [
  {
    id: "CR-2011",
    userId: "User #4821",
    kind: "Tree damage",
    tone: "damage",
    description: "Large branch hanging low near the walking path; potential hazard for pedestrians.",
    locationLabel: "Lodhi Garden",
    zone: "Zone 3",
    time: "7 mins ago",
    verification: "Pending",
    position: [28.5942, 77.219],
  },
  {
    id: "CR-2008",
    userId: "User #1049",
    kind: "Wildlife sighting",
    tone: "wildlife",
    description: "Spotted a pair of Indian Flying Fox near the canopy edge at dawn.",
    locationLabel: "Sanjay Van",
    zone: "Zone 5",
    time: "18 mins ago",
    verification: "Verified",
    position: [28.5552, 77.1858],
  },
  {
    id: "CR-2004",
    userId: "User #3710",
    kind: "Litter",
    tone: "suggestion",
    description: "Overflowing trash bin near the east entrance; needs pickup and bin liner replacement.",
    locationLabel: "Central Park",
    zone: "Zone 1",
    time: "42 mins ago",
    verification: "Pending",
    position: [28.6324, 77.2209],
  },
  {
    id: "CR-1999",
    userId: "User #8820",
    kind: "Flooding",
    tone: "damage",
    description: "Waterlogging near the low-lying corridor after morning rain; path is slippery.",
    locationLabel: "Yamuna Belt",
    zone: "Zone 5",
    time: "1 hr ago",
    verification: "Verified",
    position: [28.6411, 77.2724],
  },
  {
    id: "CR-1996",
    userId: "User #2917",
    kind: "Vandalism",
    tone: "damage",
    description: "Graffiti on park signage and damaged irrigation control box cover.",
    locationLabel: "Nehru Park",
    zone: "Zone 2",
    time: "2 hrs ago",
    verification: "Rejected",
    position: [28.6007, 77.188],
  },
  {
    id: "CR-1988",
    userId: "User #4821",
    kind: "Wildlife sighting",
    tone: "wildlife",
    description: "Heard Asian Koel call repeatedly near grove; likely nesting nearby.",
    locationLabel: "Lodhi Garden",
    zone: "Zone 1",
    time: "5 hrs ago",
    verification: "Verified",
    position: [28.5962, 77.2178],
  },
];

const LEADERBOARD = [
  { id: "User #4821", reports: 42, badge: "Tree Guardian 🌳" },
  { id: "User #1049", reports: 33, badge: "Wildlife Spotter 🦅" },
  { id: "User #7712", reports: 28, badge: "Flood Watcher 💧" },
  { id: "User #3318", reports: 24, badge: "Tree Guardian 🌳" },
  { id: "User #9280", reports: 21, badge: "Wildlife Spotter 🦅" },
];

function pinColor(tone: PinTone) {
  if (tone === "damage") return "#EF4444";
  if (tone === "wildlife") return "#22C55E";
  return "#38BDF8";
}

function reportIcon(tone: PinTone) {
  const color = pinColor(tone);
  return L.divIcon({
    className: "citizen-report-pin",
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -10],
    html: `<span style="display:block;width:22px;height:22px;border-radius:9999px;background:${color};border:2px solid rgba(15,27,18,0.9);box-shadow:0 0 0 2px rgba(255,255,255,0.2),0 0 14px ${color};"></span>`,
  });
}

function verificationPill(v: Verification) {
  if (v === "Verified") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/35 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200">
        <ShieldCheck className="h-3 w-3" />
        Verified
      </span>
    );
  }
  if (v === "Rejected") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-red-400/35 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-200">
        <XCircle className="h-3 w-3" />
        Rejected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/35 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
      <MessageSquare className="h-3 w-3" />
      Pending
    </span>
  );
}

export function CitizenReportsPanel() {
  const [selectedId, setSelectedId] = useState<string>(REPORTS[0].id);
  const [zoneBroadcast, setZoneBroadcast] = useState<string>("Zone 3");
  const [showPushModal, setShowPushModal] = useState(false);

  // AI Uploader state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [aiResult, setAiResult] = useState<{diagnosis: string, confidence: number, action: string} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
    setAiResult(null);

    setIsScanning(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("http://localhost:8000/api/analyze-flora", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setAiResult(data);
    } catch (err) {
      console.error("ML API Error:", err);
      setAiResult({ diagnosis: "ML Engine Offline", confidence: 0, action: "Boot Python container on port 8000." });
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const selected = useMemo(
    () => REPORTS.find((r) => r.id === selectedId) ?? REPORTS[0],
    [selectedId],
  );

  const monthTotal = 847;
  const verified = 623;
  const topContributor = "User #4821";

  function pushNotification() {
    setShowPushModal(false);
    // eslint-disable-next-line no-alert
    alert(`Broadcasting push notification to ${zoneBroadcast}… (mock)`);
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent/90">Citizen reports</p>
        <h2 className="mt-1 font-display text-2xl font-semibold text-white md:text-3xl">
          Citizen Science / Citizen Reports
        </h2>
        <p className="mt-1 text-sm text-white/55">
          Community-submitted observations fused into operational workflows.
        </p>
      </div>
      
      <style>{`
        @keyframes scan {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .animate-scan { animation: scan 2s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
      `}</style>
      
      {/* AI Botany Lab Widget */}
      <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-forest/95 to-[#0A1510] p-5 shadow-card relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 h-48 w-48 rounded-full bg-emerald-500/5 blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-stretch relative z-10">
          <div className="flex-1 space-y-2">
            <h3 className="font-display text-lg font-semibold text-emerald-50 text-glow">AI Flora Diagnostic Lab</h3>
            <p className="text-xs text-white/60 leading-relaxed md:max-w-2xl">
              Upload a photograph of a canopy leaf, bark, or stem to run it through our edge-deployed MobileNetV2 Deep Learning Engine. The system analyzes visual features for fungal blights, pathogens, and pest damage signatures.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-black/40 border border-white/10 px-3 py-2 cursor-pointer hover:bg-black/60 hover:border-accent/40 transition" onClick={() => fileInputRef.current?.click()}>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
              <Upload className="h-4 w-4 text-accent" />
              <span className="text-[11px] font-semibold text-white/80">Upload Photo for AI Diagnostics</span>
            </div>
          </div>

          <div className="w-full lg:w-72 mt-2 lg:mt-0 flex-shrink-0">
            {previewUrl ? (
              <div className="relative h-32 w-full rounded-lg overflow-hidden border border-white/20 bg-black/50">
                <img src={previewUrl} alt="Analyzed Flora" className="object-cover w-full h-full opacity-70" />
                {isScanning && (
                  <div className="absolute inset-0 overflow-hidden rounded-lg pointer-events-none">
                    <div className="absolute inset-x-0 h-[2px] bg-accent shadow-[0_0_12px_#38BDF8] animate-scan" />
                    <div className="absolute inset-0 bg-accent/5 animate-pulse" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-[1px]">
                      <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-accent drop-shadow-md">
                        <Scan className="h-4 w-4 animate-[spin_3s_linear_infinite]" /> Analyzing Tensor...
                      </span>
                    </div>
                  </div>
                )}
                {aiResult && !isScanning && (
                  <div className="absolute inset-x-0 bottom-0 bg-black/85 backdrop-blur px-3 py-2 border-t border-white/10">
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${aiResult.diagnosis.includes("Healthy") ? "text-emerald-400" : "text-red-400"}`}>
                        {aiResult.diagnosis}
                      </span>
                      <span className="text-[10px] font-semibold text-white/50">{aiResult.confidence}%</span>
                    </div>
                    <p className="mt-1 text-[9px] text-white/60 leading-tight line-clamp-1">{aiResult.action}</p>
                  </div>
                )}
              </div>
            ) : (
               <div className="h-32 w-full rounded-lg border border-dashed border-white/15 bg-white/5 flex flex-col items-center justify-center gap-2 text-white/40 cursor-pointer hover:bg-white/10 hover:border-accent/30 hover:text-white/60 transition" onClick={() => fileInputRef.current?.click()}>
                 <Leaf className="h-6 w-6 mb-1 opacity-70" />
                 <span className="text-[10px] uppercase font-semibold tracking-wider">Awaiting Specimen</span>
               </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-white/[0.08] bg-canopy/95 p-4 shadow-card">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
            Total reports this month
          </p>
          <p className="mt-2 font-display text-3xl font-semibold text-white">{monthTotal}</p>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-canopy/95 p-4 shadow-card">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">Verified reports</p>
          <p className="mt-2 font-display text-3xl font-semibold text-emerald-300">{verified}</p>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-canopy/95 p-4 shadow-card">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">Top contributor</p>
          <p className="mt-2 font-display text-2xl font-semibold text-white">{topContributor}</p>
          <p className="mt-1 text-xs text-white/45">(42 reports)</p>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-canopy/95 p-4 shadow-card">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">Report types</p>
          <p className="mt-2 text-sm text-white/75">
            Tree damage, Litter, Wildlife sighting, Flooding, Vandalism
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="rounded-xl border border-white/[0.08] bg-canopy/95 p-4 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-sm font-semibold text-white">Reports map</h3>
              <p className="mt-0.5 text-[11px] text-white/60">
                Red = damage/emergency · Green = wildlife · Blue = suggestion
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowPushModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-[11px] font-semibold text-forest shadow-glow transition hover:brightness-95"
            >
              <Bell className="h-4 w-4" />
              Push Notification
            </button>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-forest/80">
            <div className="h-80 w-full">
              <MapContainer center={DELHI_CENTER} zoom={12} scrollWheelZoom className="h-full w-full">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {REPORTS.map((r) => (
                  <Marker
                    key={r.id}
                    position={r.position}
                    icon={reportIcon(r.tone)}
                    eventHandlers={{
                      click: () => setSelectedId(r.id),
                    }}
                  >
                    <Popup>
                      <div className="min-w-[220px] text-[#0F1B12]">
                        <p className="text-sm font-semibold">{r.kind}</p>
                        <p className="mt-1 text-xs">{r.description}</p>
                        <p className="mt-2 text-xs">
                          <strong>{r.locationLabel}</strong> · {r.zone}
                        </p>
                        <p className="mt-1 text-[11px] text-[#0F1B12]/70">{r.time}</p>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>

            <div className="border-t border-white/10 bg-black/20 px-3 py-2 text-[11px] text-white/70">
              Selected: <span className="font-semibold text-white/85">{selected.id}</span> ·{" "}
              <span className="text-white/60">{selected.kind}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-canopy/95 p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-sm font-semibold text-white">Reports feed</h3>
              <p className="mt-0.5 text-[11px] text-white/60">Recent reports awaiting triage.</p>
            </div>
            <span className="text-[11px] text-white/50">{REPORTS.length} recent</span>
          </div>

          <div className="custom-scrollbar mt-4 max-h-[380px] space-y-3 overflow-y-auto pr-1">
            {REPORTS.map((r) => (
              <div
                key={r.id}
                className={`rounded-xl border bg-forest/75 p-3 shadow-card transition hover:border-accent/25 hover:shadow-glow ${
                  selectedId === r.id ? "border-accent/45" : "border-white/[0.08]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/10">
                      <User className="h-4 w-4 text-white/60" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-semibold text-white/85">{r.userId}</span>
                        <span className="rounded-full border border-white/12 bg-black/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/70">
                          {r.kind}
                        </span>
                        {verificationPill(r.verification)}
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-white/70">{r.description}</p>
                      <p className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-white/55">
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-accent" />
                          <span>
                            {r.locationLabel} · {r.zone}
                          </span>
                        </span>
                        <span className="text-white/35">•</span>
                        <span>{r.time}</span>
                      </p>
                    </div>
                  </div>

                  <div className="h-12 w-12 shrink-0 rounded-lg border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent" />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 font-semibold text-forest hover:brightness-95"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Verify
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-white/15 bg-forest/70 px-3 py-1.5 font-semibold text-white/80 hover:border-accent/35"
                  >
                    Assign
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-1.5 font-semibold text-red-200 hover:border-red-400/50"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-white/15 bg-forest/60 px-3 py-1.5 font-semibold text-white/70 hover:border-accent/35"
                  >
                    View Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedId(r.id)}
                    className="ml-auto rounded-lg border border-white/12 bg-black/20 px-2.5 py-1.5 text-[11px] text-white/70 hover:border-accent/30"
                  >
                    Focus on map
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="rounded-xl border border-white/[0.08] bg-canopy/95 p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-sm font-semibold text-white">Gamification</h3>
            <span className="text-[11px] text-white/60">Top contributors (anonymized)</span>
          </div>
          <div className="mt-3 overflow-hidden rounded-lg border border-white/10 bg-forest/80">
            <div className="grid grid-cols-[minmax(0,1.3fr)_0.6fr_1fr] border-b border-white/10 bg-white/5 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-white/60">
              <span>Contributor</span>
              <span>Reports</span>
              <span>Badge</span>
            </div>
            <div className="divide-y divide-white/8">
              {LEADERBOARD.map((u, idx) => (
                <div
                  key={u.id}
                  className="grid grid-cols-[minmax(0,1.3fr)_0.6fr_1fr] items-center px-3 py-2 text-[11px] text-white/80"
                >
                  <span className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/5 ring-1 ring-white/10 text-[10px] font-semibold text-white/75">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-white/85">{u.id}</span>
                  </span>
                  <span className="font-semibold text-accent">{u.reports}</span>
                  <span className="text-white/70">{u.badge}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-canopy/95 p-4 shadow-card">
          <h3 className="font-display text-sm font-semibold text-white">Community impact</h3>
          <p className="mt-2 text-sm text-white/70">
            Citizen reports led to{" "}
            <span className="font-semibold text-accent">47 maintenance actions</span> this month.
          </p>
          <div className="mt-4 rounded-lg border border-white/10 bg-forest/80 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">
              Broadcast alerts
            </p>
            <p className="mt-1 text-xs text-white/60">
              Push operational updates to app users in a selected zone.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <select
                value={zoneBroadcast}
                onChange={(e) => setZoneBroadcast(e.target.value)}
                className="h-9 flex-1 rounded-lg border border-white/15 bg-forest/80 px-3 text-xs font-medium text-white outline-none ring-0 focus:border-accent/40 focus:ring-2 focus:ring-accent/20"
              >
                {["Zone 1", "Zone 2", "Zone 3", "Zone 4", "Zone 5"].map((z) => (
                  <option key={z} value={z} className="bg-forest text-white">
                    {z}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowPushModal(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-[11px] font-semibold text-forest shadow-glow transition hover:brightness-95"
              >
                <Bell className="h-4 w-4" />
                Push
              </button>
            </div>
          </div>
        </div>
      </div>

      {showPushModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-xl border border-white/15 bg-forest/95 p-4 shadow-glow">
            <p className="text-sm font-semibold text-white">Broadcast push notification?</p>
            <p className="mt-1 text-xs text-white/70">
              This will send an alert to all app users in <span className="font-semibold text-white">{zoneBroadcast}</span>.
            </p>
            <div className="mt-4 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setShowPushModal(false)}
                className="rounded-lg border border-white/20 bg-forest/80 px-3 py-1.5 text-white/80 hover:border-accent/40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={pushNotification}
                className="rounded-lg bg-accent px-3 py-1.5 font-semibold text-forest hover:brightness-95"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

