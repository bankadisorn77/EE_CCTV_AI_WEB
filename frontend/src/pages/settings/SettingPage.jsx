import { useState } from "react";
import SettingsSidebar from '../../components/settings/SettingSidebar'
import DeviceSettingsPage from "./DeviceSettingPage";

export default function SettingsPage() {
  const [selectedId,     setSelectedId]     = useState(null);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [selectedIP, setSelectedIP] = useState(null);
  const [reloadKey,      setReloadKey]      = useState(0);

  function handleSelect(mcId, device,ip) {
    setSelectedId(mcId);
    setSelectedDevice(device);
    setSelectedIP(ip);
  }

  function handleSaved(updatedDevice) {
    // Update the sidebar's local copy so zone/name reflects immediately
    setSelectedDevice(updatedDevice);
    setReloadKey((k) => k + 1); // ← tells sidebar to re-fetch
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">

      {/* ── Sidebar ── */}
      <SettingsSidebar
        selectedId={selectedId}
        onSelect={handleSelect}
        reloadKey={reloadKey}
      />

      {/* ── Detail panel ── */}
      <DeviceSettingsPage
        device={selectedDevice}
        onSaved={handleSaved}
      />

    </div>
  );
}