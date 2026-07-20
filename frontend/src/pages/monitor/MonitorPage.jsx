import { useState } from "react";
import MonitoringSidebar from '../../components/monitoring/MonitoringSidebar';
import DashboardPage from './DashboardPage';
import MachinePage from './MachinePage';

export default function MonitoringPage() {
  const [selectedKey, setSelectedKey] = useState("dashboard");

  // Parse selected key → "zone-a__mc01" → zoneId="zone-a", machineId="mc01"
  const [zoneId, machineId] = selectedKey.includes("__")
    ? selectedKey.split("__")
    : [null, null];

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">

      {/* ── Sidebar ── */}
      <MonitoringSidebar
        selectedKey={selectedKey}
        onSelect={setSelectedKey}
      />

      {/* ── Main content ── */}
      {selectedKey === "dashboard" && <DashboardPage />}
      {machineId && <MachinePage zoneId={zoneId} machineId={machineId} />}

    </div>
  );
}