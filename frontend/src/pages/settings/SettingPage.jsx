import { useState, useEffect, Component } from "react";
import { io } from "socket.io-client";
import SettingsSidebar from '../../components/settings/SettingSidebar'
import DeviceSettingsPage from "./DeviceSettingPage";
import { decodeToken } from "../../services/apiAuth";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Settings page crashed:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex items-center justify-center bg-gray-50 p-8">
          <div className="max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm">
            <p className="text-sm font-bold text-red-600">Something went wrong</p>
            <p className="mt-2 text-sm text-gray-600">The settings page could not render properly. Please try again.</p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-4 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function SettingsPage() {
  const [selectedId,     setSelectedId]     = useState(null);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [selectedIP, setSelectedIP] = useState(null);
  const [reloadKey,      setReloadKey]      = useState(0);
  const [liveStatus, setLiveStatus] = useState(null);

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

  useEffect(() => {
    const apiUrl = (import.meta.env.VITE_API_URL || "http://localhost:5050/api").replace(/\/api$/, "");
    const socket = io(apiUrl, {
      auth: {
        token: sessionStorage.getItem("token") || localStorage.getItem("token"),
      },
    });

    socket.on("connect", () => {
      const tokenData = decodeToken();
      if (tokenData) {
        const role = tokenData.role;
        const plantName = tokenData.plant;

        if (role === "admin") {
          socket.emit("join-plant", "ALL");
        } else {
          if (plantName) socket.emit("join-plant", plantName);
          if (role === "engineer") socket.emit("join-plant", "Unassigned");
        }
      }
    });

    socket.on("device-status", (data) => {
      const updates = Array.isArray(data) ? data : [data];
      // console.log("Received device status updates:", updates);
      if (!updates.length) return;

      if (!selectedDevice) return;

      const match = updates.find((item) => String(item?.mcId ?? "") === String(selectedDevice?.mcId ?? ""));
      if (!match) return;

      setLiveStatus((prev) => ({
        ...(prev || {}),
        mcId: match.mcId,
        runningStatus: match.runningStatus ?? prev?.runningStatus ?? selectedDevice?.runningStatus,
        cpuTemp: match.cpuTemp ?? prev?.cpuTemp ?? selectedDevice?.cpuTemp,
        gpuTemp: match.gpuTemp ?? prev?.gpuTemp ?? selectedDevice?.gpuTemp,
        memoryFree: match.memoryFree ?? prev?.memoryFree ?? selectedDevice?.memoryFree,
        memoryUsed: match.memoryUsed ?? prev?.memoryUsed ?? selectedDevice?.memoryUsed,
        lastSeen: match.lastSeen ?? prev?.lastSeen ?? selectedDevice?.lastSeen,
      }));
    });

    return () => {
      socket.off("connect");
      socket.off("device-status");
      socket.disconnect();
    };
  }, [selectedDevice]);

  return (
    <ErrorBoundary>
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
          liveStatus={liveStatus}
          onSaved={handleSaved}
        />

      </div>
    </ErrorBoundary>
  );
}