import { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Header } from "./components/Header";
import { GISMapPanel } from "./components/GISMapPanel";
import { GSHIDetail } from "./components/GSHIDetail";
import { OverviewGrid } from "./components/OverviewGrid";
import { PlaceholderPanel } from "./components/PlaceholderPanel";
import { SensorIotPanel } from "./components/SensorIotPanel";
import { ComputerVisionPanel } from "./components/ComputerVisionPanel";
import { BiodiversityPanel } from "./components/BiodiversityPanel";
import { DigitalTwinPanel } from "./components/DigitalTwinPanel";
import { SmartIrrigationPanel } from "./components/SmartIrrigationPanel";
import { AlertsActionsPanel } from "./components/AlertsActionsPanel";
import { CitizenReportsPanel } from "./components/CitizenReportsPanel";
import { AnalyticsReportsPanel } from "./components/AnalyticsReportsPanel";
import { FloodMonitoringPanel } from "./components/FloodMonitoringPanel";
import { CarbonPanel } from "./components/CarbonPanel";
import { AIHelpDeskPanel } from "./components/AIHelpDeskPanel";
import { SatellitePanel } from "./components/SatellitePanel";
import { Sidebar } from "./components/Sidebar";
import { LandingPage } from "./components/LandingPage";

function DashboardLayout({ city, setCity }: { city: string; setCity: (c: string) => void }) {
  return (
    <div className="flex h-screen min-h-0 w-full overflow-hidden bg-forest">
      <Sidebar />
      <div className="ml-[240px] flex min-h-0 min-w-0 flex-1 flex-col">
        <Header city={city} onCityChange={setCity} />
        <main className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8">
          <div className="mx-auto max-w-[1600px]">
            <Routes>
              <Route path="/" element={<OverviewGrid city={city} />} />
              <Route path="/map" element={<GISMapPanel city={city} />} />
              <Route path="/gshi" element={<GSHIDetail />} />
              <Route path="/sensors" element={<SensorIotPanel />} />
              <Route path="/vision" element={<ComputerVisionPanel />} />
              <Route path="/biodiversity" element={<BiodiversityPanel />} />
              <Route path="/twin" element={<DigitalTwinPanel />} />
              <Route path="/irrigation" element={<SmartIrrigationPanel />} />
              <Route path="/carbon" element={<CarbonPanel />} />
              <Route path="/alerts" element={<AlertsActionsPanel />} />
              <Route path="/citizen" element={<CitizenReportsPanel />} />
              <Route path="/analytics" element={<AnalyticsReportsPanel />} />
              <Route path="/satellite" element={<SatellitePanel />} />
              <Route path="/flood" element={<FloodMonitoringPanel city={city} />} />
              <Route path="/helpdesk" element={<AIHelpDeskPanel />} />
              <Route path="/*" element={<PlaceholderPanel id={"settings" as any} city={city} />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const [city, setCity] = useState("Delhi NCR");

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/dashboard/*" element={<DashboardLayout city={city} setCity={setCity} />} />
      {/* Catch-all: redirect any old / unknown URL to dashboard */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
