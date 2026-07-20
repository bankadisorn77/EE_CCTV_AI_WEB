import { useState, useEffect, useRef, useCallback } from "react";
import AlarmToast from "../../components/monitoring/AlarmToast";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { useNotifications } from "../../context/NotificationContext";
import { fetchMachineAlarms } from "../../services/monitor";
import { updateAlarmStatus } from "../../services/monitor";
import { decodeToken } from "../../services/apiAuth";
import { ClearAlarms } from "../../services/monitor";
import { io } from "socket.io-client";

// ── Mock API ──────────────────────────────────────────────────────────────────
// async function fetchMachineAlarms(zoneId, machineId) {
//   await new Promise((r) => setTimeout(r, 600));
//   const types = ["Motion Detected", "Intrusion Alert", "Perimeter Breach", "Loitering", "Object Left"];
//   const statuses = ["Uninspected", "Confirmed", "False Alarm"];
//   return Array.from({ length: 45 }, (_, i) => ({
//     id: `ALM-${String(2000 + i).padStart(4, "0")}`,
//     zoneId,
//     machineId,
//     type: types[i % types.length],
//     status: statuses[i % statuses.length],
//     confidence: Math.floor(60 + Math.random() * 40),
//     timestamp: new Date(Date.now() - i * 18 * 60 * 1000).toISOString(),
//     // Placeholder image URLs (replace with real snapshot URLs from API)
//     images: Array.from({ length: 4 }, (_, j) => ({
//       id: `img-${i}-${j}`,
//       url: `https://placehold.co/960x540/1e1e2e/6366f1?text=Snapshot+${i + 1}-${j + 1}`,
//       thumb: `https://placehold.co/160x90/1e1e2e/6366f1?text=${j + 1}`,
//       capturedAt: new Date(Date.now() - i * 18 * 60 * 1000 - j * 3000).toISOString(),
//     })),
//   }));
// }

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(iso) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}
function timeAgo(iso) {
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const ROWS_PER_PAGE = 15;

// ── MachinePage ───────────────────────────────────────────────────────────────
export default function MachinePage({ zoneId, machineId }) {
  const [alarms, setAlarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlarm, setSelectedAlarm] = useState(null);
  const [activeImage, setActiveImage] = useState(0);
  const [page, setPage] = useState(1);
  const [updatingId, setUpdatingId] = useState(null);
  const socketRef = useRef(null);
  const cancelledRef = useRef(false);
  const loadTimeoutRef = useRef(null);

  const selectedIndex = alarms.findIndex((a) => a.id === selectedAlarm?.id);
  const { markRead } = useNotifications();
  const currentRole = decodeToken()?.role?.toLowerCase();
  const canClearFalseAlarms = ["admin", "engineer"].includes(currentRole);

  // When user selects an alarm, mark it read in the global context
  function selectAlarm(alarm) {
    setSelectedAlarm(alarm);
    setActiveImage(0);
    if (alarm?.id) markRead(alarm.id);
  }

  // Handle "Jump to Alarm" from toast — prepend new alarm and select it
  function handleJumpToAlarm(newAlarm) {
    setAlarms((prev) => {
      const exists = prev.find((a) => a.id === newAlarm.id);
      if (exists) {
        selectAlarm(exists);
        return prev;
      }
      // Build a full alarm object from the websocket payload
      const full = {
        id: newAlarm.id,
        zoneId: newAlarm.zoneId,
        machineId: newAlarm.machineId,
        type: newAlarm.eventType,
        status: "Uninspected",
        confidence: newAlarm.confidence,
        timestamp: newAlarm.timestamp,
        images: newAlarm.image, // will load when API supports it
      };
      selectAlarm(full);
      return [full, ...prev];
    });
    setPage(1);
  }

  function goToAlarm(index) {
    const clamped = Math.max(0, Math.min(alarms.length - 1, index));
    const alarm = alarms[clamped];
    if (!alarm) return;
    selectAlarm(alarm);
    // Auto-flip table page so the highlighted row stays visible
    setPage(Math.floor(clamped / ROWS_PER_PAGE) + 1);
  }

  // ← → keyboard navigation
  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "ArrowLeft") goToAlarm(selectedIndex - 1);
      if (e.key === "ArrowRight") goToAlarm(selectedIndex + 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedIndex, alarms]);

  const load = useCallback(async () => {
    setLoading(true);
    setPage(1);
    setSelectedAlarm(null);
    setActiveImage(0);

    try {
      const data = await fetchMachineAlarms(machineId);
      if (cancelledRef.current) return;

      setAlarms(data);
      setSelectedAlarm((prev) => {
        if (!prev) return data[0] ?? null;
        return data.find((a) => String(a.id) === String(prev.id)) || prev;
      });
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }, [machineId]);

  useEffect(() => {
    cancelledRef.current = false;

    function initSocket() {
      const apiUrl = (import.meta.env.VITE_API_URL || "http://localhost:5050/api").replace(/\/api$/, "");
      const socket = io(apiUrl, {
        auth: { token: sessionStorage.getItem('token') || localStorage.getItem('token') },
      });

      socket.on('connect', () => {
        load();
        socket.emit('join-plant', 'ALL');
        console.log("Connected and Joined Room");
      });

      socket.on('new-alarm', (data) => {
        if (String(data.alarm.mcId) === String(machineId)) {
          if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
          loadTimeoutRef.current = setTimeout(() => load(), 500);
        }
      });

      socketRef.current = socket;
    }

    initSocket();

    return () => {
      cancelledRef.current = true;
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
      socketRef.current?.disconnect();
    };
  }, [machineId, load]);

  // ── Action handlers ───────────────────────────────────────────────────────
  // async function handleAction(alarmId, newStatus) {
  //   console.log(`Updating alarm ${alarmId} to status: ${newStatus}`);
  //   setUpdatingId(alarmId);
  //   await new Promise((r) => setTimeout(r, 600)); // TODO: real API call
  //   setAlarms((prev) =>
  //     prev.map((a) => a.id === alarmId ? { ...a, status: newStatus } : a)
  //   );
  //   if (selectedAlarm?.id === alarmId) {
  //     setSelectedAlarm((prev) => ({ ...prev, status: newStatus }));
  //   }
  //   setUpdatingId(null);
  // }
  // ── Action handlers ───────────────────────────────────────────────────────
  async function handleAction(alarmId, newStatus) {
    // console.log(`Updating alarm ${alarmId} to status: ${newStatus}`);
    setUpdatingId(alarmId);

    try {
      // 1. เรียกใช้งาน API ของจริงแทน setTimeout
      await updateAlarmStatus(alarmId, newStatus);

      // 2. ถ้า API ทำงานสำเร็จ ค่อยมาอัปเดตหน้าตาเว็บ (State)
      setAlarms((prev) =>
        prev.map((a) => a.id === alarmId ? { ...a, status: newStatus } : a)
      );

      if (selectedAlarm?.id === alarmId) {
        setSelectedAlarm((prev) => ({ ...prev, status: newStatus }));
      }
    } catch (error) {
      // 3. ดักจับ Error เผื่อเซิร์ฟเวอร์มีปัญหา
      console.error("Failed to update alarm status:", error);
      // ตรงนี้คุณอาจจะเรียกใช้ Toast แจ้งเตือน user ว่า "อัปเดตไม่สำเร็จ" ได้ครับ
    } finally {
      // 4. ปิดสถานะ Loading ไม่ว่าจะสำเร็จหรือพังก็ตาม
      setUpdatingId(null);
    }
  }

  // ── Filter + counts ───────────────────────────────────────────────────────
  const [activeFilter, setActiveFilter] = useState("All");

  const counts = {
    All: alarms.length,
    Uninspected: alarms.filter((a) => a.status === "Uninspected").length,
    Confirmed: alarms.filter((a) => a.status === "Confirmed").length,
    "False Alarm": alarms.filter((a) => a.status === "False Alarm").length,
  };

  const filteredAlarms = activeFilter === "All"
    ? alarms
    : alarms.filter((a) => a.status === activeFilter);

  // Reset to page 1 when filter changes (handled via useEffect)
  useEffect(() => { setPage(1); }, [activeFilter]);

  // ── Pagination ────────────────────────────────────────────────────────────
  const totalPages = Math.ceil(filteredAlarms.length / ROWS_PER_PAGE);
  const pageAlarms = filteredAlarms.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

  // ── Skeleton ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto bg-gray-50 p-6 animate-pulse">
        <div className="h-6 w-48 bg-gray-200 rounded mb-6" />
        <div className="flex gap-5">
          <div className="flex-1 bg-gray-200 rounded-2xl aspect-video" />
          <div className="w-72 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-10 bg-gray-200 rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  const images = selectedAlarm?.images ?? [];
  const currentImg = images[activeImage];

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 min-h-0">
      {/* Live alarm toast — only for this machine */}
      <AlarmToast
        zoneId={zoneId}
        machineId={machineId}
        onJumpToAlarm={handleJumpToAlarm}
      />
      <div className="px-6 py-6 max-w-screen-xl mx-auto space-y-6">

        {/* ── Breadcrumb header ── */}
        <div className="flex items-center justify-between gap-2" >
          <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-widest text-indigo-400">
                {zoneId?.replace(/-/g, " ")}
              </span>
              <svg className="w-3 h-3 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="9 18 15 12 9 6" /></svg>
              <span className="text-xs font-bold uppercase tracking-widest text-gray-700">
                {machineId?.toUpperCase()}
              </span>

          </div>
          <button
            onClick={async () => {
              if (!canClearFalseAlarms) return;
              const updateState = await ClearAlarms(machineId, counts["False Alarm"]);
              if (updateState?.success) {
                await load();
              }
            }}
            disabled={!canClearFalseAlarms}
            title={canClearFalseAlarms ? "" : "Only admin or engineer can clear false alarms"}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 ${canClearFalseAlarms
              ? "text-red-600 hover:bg-gray-100" 
              : "text-gray-400 cursor-not-allowed"
              }`}
          >
            Clear False Alarms
          </button>
        </div>

        {/* ══ TOP SECTION: image viewer + detail panel ══════════════════════ */}
        <div className="flex gap-5 items-start">

          {/* ── LEFT: image viewer ── */}
          <div className="flex-1 min-w-0 space-y-3">


            {/* Alarm navigator bar */}
            <div className="flex items-center justify-between bg-white rounded-xl border border-gray-100 shadow-sm px-3 py-2">
              <button
                onClick={() => goToAlarm(selectedIndex - 1)}
                disabled={selectedIndex <= 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-25 disabled:cursor-not-allowed transition-all active:scale-95"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
                Prev
              </button>

              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-1">
                  {alarms.slice(Math.max(0, selectedIndex - 2), selectedIndex + 3).map((a, i) => {
                    const realIdx = Math.max(0, selectedIndex - 2) + i;
                    const isCurrent = realIdx === selectedIndex;
                    return (
                      <button key={a.id} onClick={() => goToAlarm(realIdx)} title={a.id}
                        className={`rounded-full transition-all duration-150 ${isCurrent ? "w-6 h-2.5 bg-indigo-500" : "w-2.5 h-2.5 bg-gray-200 hover:bg-gray-400"
                          }`}
                      />
                    );
                  })}
                </div>
                <span className="text-xs font-semibold text-gray-500">
                  <span className="text-indigo-600 font-bold">{selectedIndex + 1}</span>
                  <span className="text-gray-300 mx-1">/</span>
                  {alarms.length}
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-gray-300 font-medium">
                  <kbd className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 font-mono">←</kbd>
                  <kbd className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 font-mono">→</kbd>
                </span>
              </div>

              <button
                onClick={() => goToAlarm(selectedIndex + 1)}
                disabled={selectedIndex >= alarms.length - 1}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-25 disabled:cursor-not-allowed transition-all active:scale-95"
              >
                Next
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            </div>

            {/* Main image */}
            <div className="relative w-full aspect-video bg-[#0f0f1a] rounded-2xl overflow-hidden shadow-lg ring-1 ring-white/5">
              {currentImg ? (
                <img
                  key={currentImg.id}
                  src={currentImg.url}
                  alt="Alarm snapshot"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-600 text-sm">
                  No snapshot available
                </div>
              )}

              {/* Overlay: alarm ID + timestamp */}
              {selectedAlarm && (
                <div className="absolute bottom-0 left-0 right-0 px-4 py-3 bg-gradient-to-t from-black/70 to-transparent">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-white font-mono text-xs font-bold">{selectedAlarm.id}</p>
                      <p className="text-white/60 text-[10px]">{formatTime(selectedAlarm.timestamp)}</p>
                    </div>
                    <StatusBadge status={selectedAlarm.status} />
                  </div>
                </div>
              )}

              {/* Image counter */}
              {images.length > 1 && (
                <div className="absolute top-3 right-3 bg-black/50 text-white text-[10px] font-bold px-2 py-1 rounded-full">
                  {activeImage + 1} / {images.length}
                </div>
              )}
            </div>

            {/* Thumbnail strip */}
            {/*
            {images.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((img, idx) => (
                  <button
                    key={img.id}
                    onClick={() => setActiveImage(idx)}
                    className={`
                      flex-shrink-0 w-24 aspect-video rounded-xl overflow-hidden ring-2 transition-all duration-150
                      ${activeImage === idx ? "ring-indigo-500 scale-105 shadow-md" : "ring-transparent opacity-60 hover:opacity-90"}
                    `}
                  >
                    <img src={img.thumb} alt={`Snapshot ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            */}
          </div>

          {/* ── RIGHT: detail + action panel ── */}
          <div className="w-72 flex-shrink-0 space-y-4">

            {selectedAlarm ? (
              <>
                {/* Alarm info card */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-gray-800">Alarm Detail</h2>
                    <span className="font-mono text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-semibold">
                      {selectedAlarm.id}
                    </span>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    {[
                      { label: "Zone", value: zoneId?.replace(/-/g, " ") },
                      { label: "Machine", value: machineId?.toUpperCase() },
                      { label: "Event Type", value: selectedAlarm.type },
                      { label: "Time", value: formatTime(selectedAlarm.timestamp) },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between gap-2">
                        <span className="text-gray-400 font-medium">{label}</span>
                        <span className="text-gray-700 text-right font-semibold">{value}</span>
                      </div>
                    ))}

                    {/* Confidence bar */}
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-gray-400 font-medium">Confidence</span>
                        <span className="text-gray-700 font-bold">{selectedAlarm.confidence}%</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${selectedAlarm.confidence >= 85 ? "bg-red-400" :
                              selectedAlarm.confidence >= 70 ? "bg-amber-400" : "bg-gray-300"
                            }`}
                          style={{ width: `${selectedAlarm.confidence}%` }}
                        />
                      </div>
                    </div>

                    {/* Status */}
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 font-medium">Status</span>
                      <StatusBadge status={selectedAlarm.status} />
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-2.5">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Actions</h3>

                  <button
                    disabled={selectedAlarm.status === "Confirmed" || updatingId === selectedAlarm.id}
                    onClick={() => handleAction(selectedAlarm.id, "Confirmed")}
                    className={`
                      w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold
                      transition-all duration-200
                      ${selectedAlarm.status === "Confirmed"
                        ? "bg-red-50 text-red-300 cursor-not-allowed ring-1 ring-red-100"
                        : "bg-red-500 hover:bg-red-600 text-white shadow-sm hover:shadow-md active:scale-95"
                      }
                    `}
                  >
                    {updatingId === selectedAlarm.id ? (
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></svg>
                    )}
                    {selectedAlarm.status === "Confirmed" ? "Already Confirmed" : "Confirm Alarm"}
                  </button>

                  <button
                    disabled={selectedAlarm.status === "False Alarm" || updatingId === selectedAlarm.id}
                    onClick={() => handleAction(selectedAlarm.id, "False Alarm")}
                    className={`
                      w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold
                      transition-all duration-200
                      ${selectedAlarm.status === "False Alarm"
                        ? "bg-gray-50 text-gray-300 cursor-not-allowed ring-1 ring-gray-100"
                        : "bg-white hover:bg-gray-50 text-gray-700 ring-1 ring-gray-200 hover:ring-gray-300 shadow-sm active:scale-95"
                      }
                    `}
                  >
                    {updatingId === selectedAlarm.id ? (
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                    )}
                    {selectedAlarm.status === "False Alarm" ? "Marked False Alarm" : "Mark as False Alarm"}
                  </button>
                </div>

                {/* Image timestamps */}
                {images.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Snapshots</h3>
                    <div className="space-y-1.5">
                      {images.map((img, idx) => (
                        <button
                          key={img.id}
                          onClick={() => setActiveImage(idx)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${activeImage === idx ? "bg-indigo-50 text-indigo-600 font-semibold" : "text-gray-500 hover:bg-gray-50"
                            }`}
                        >
                          <span>Snapshot {idx + 1}</span>
                          <span className="text-[10px] opacity-70">{timeAgo(img.capturedAt)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-sm text-gray-400">
                Select an alarm to view details
              </div>
            )}
          </div>
        </div>

        {/* ══ BOTTOM: alarm history table ═══════════════════════════════════ */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

          {/* ── Stat summary cards ── */}
          <div className="grid grid-cols-4 divide-x divide-gray-100 border-b border-gray-100">
            {[
              {
                key: "All",
                label: "Total Alarms",
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="w-4 h-4">
                    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" />
                  </svg>
                ),
                bg: "bg-indigo-50", iconColor: "text-indigo-400", value: "text-indigo-700", border: "border-indigo-200",
              },
              {
                key: "Uninspected",
                label: "Uninspected",
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="w-4 h-4">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                ),
                bg: "bg-amber-50", iconColor: "text-amber-400", value: "text-amber-700", border: "border-amber-200",
              },
              {
                key: "Confirmed",
                label: "Confirmed",
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="w-4 h-4">
                    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" />
                  </svg>
                ),
                bg: "bg-red-50", iconColor: "text-red-400", value: "text-red-700", border: "border-red-200",
              },
              {
                key: "False Alarm",
                label: "False Alarms",
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="w-4 h-4">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ),
                bg: "bg-gray-50", iconColor: "text-gray-400", value: "text-gray-600", border: "border-gray-200",
              },
            ].map((card) => {
              const isActive = activeFilter === card.key;
              return (
                <button
                  key={card.key}
                  onClick={() => setActiveFilter(card.key)}
                  className={`
                    relative flex flex-col items-start px-5 py-4 text-left transition-all duration-150
                    hover:bg-gray-50 group
                    ${isActive ? card.bg : ""}
                  `}
                >
                  {/* Active bottom border indicator */}
                  {isActive && (
                    <span className={`absolute bottom-0 left-0 right-0 h-0.5 ${card.bg.replace("bg-", "bg-").replace("50", "500")} rounded-t`}
                      style={{
                        background: isActive && card.key === "All" ? "#6366f1"
                          : card.key === "Uninspected" ? "#f59e0b"
                            : card.key === "Confirmed" ? "#ef4444"
                              : "#9ca3af"
                      }}
                    />
                  )}
                  <div className={`mb-2 ${isActive ? card.iconColor : "text-gray-300 group-hover:text-gray-400"} transition-colors`}>
                    {card.icon}
                  </div>
                  <p className={`text-2xl font-bold tracking-tight ${isActive ? card.value : "text-gray-700"}`}>
                    {counts[card.key]}
                  </p>
                  <p className={`text-[11px] font-semibold mt-0.5 ${isActive ? card.iconColor : "text-gray-400"}`}>
                    {card.label}
                  </p>
                </button>
              );
            })}
          </div>

          {/* ── Filter tabs + page info ── */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-1.5">
              {["All", "Uninspected", "Confirmed", "False Alarm"].map((f) => {
                const dotColor = f === "Uninspected" ? "bg-amber-400"
                  : f === "Confirmed" ? "bg-red-500"
                    : f === "False Alarm" ? "bg-gray-400"
                      : "bg-indigo-500";
                return (
                  <button
                    key={f}
                    onClick={() => setActiveFilter(f)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${activeFilter === f
                        ? "bg-white text-gray-800 shadow-sm ring-1 ring-gray-200"
                        : "text-gray-400 hover:text-gray-700 hover:bg-white/60"
                      }`}
                  >
                    {f !== "All" && <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />}
                    {f}
                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${activeFilter === f ? "bg-gray-100 text-gray-600" : "bg-gray-100/0 text-gray-400"
                      }`}>
                      {counts[f]}
                    </span>
                  </button>
                );
              })}
            </div>
            <span className="text-xs text-gray-400">
              {filteredAlarms.length} results · page {page} of {totalPages || 1}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {["Alarm ID", "Event Type", "Confidence", "Status", "Time", "Action"].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pageAlarms.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-sm text-gray-400">
                      No {activeFilter !== "All" ? activeFilter.toLowerCase() : ""} alarms found.
                    </td>
                  </tr>
                )}
                {pageAlarms.map((alarm) => {
                  const isSelected = selectedAlarm?.id === alarm.id;
                  return (
                    <tr
                      key={alarm.id}
                      onClick={() => { selectAlarm(alarm); }}
                      className={`cursor-pointer transition-colors duration-100 ${isSelected ? "bg-indigo-50/60" : "hover:bg-gray-50"
                        }`}
                    >
                      <td className="px-5 py-3">
                        <span className={`font-mono text-xs font-semibold px-2 py-0.5 rounded ${isSelected ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-600"}`}>
                          {alarm.id}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-700">{alarm.type}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-14 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${alarm.confidence >= 85 ? "bg-red-400" : alarm.confidence >= 70 ? "bg-amber-400" : "bg-gray-300"}`}
                              style={{ width: `${alarm.confidence}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-400">{alarm.confidence}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3"><StatusBadge status={alarm.status} /></td>
                      <td className="px-5 py-3">
                        <p className="text-xs text-gray-700">{formatTime(alarm.timestamp)}</p>
                        <p className="text-[10px] text-gray-400">{timeAgo(alarm.timestamp)}</p>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            disabled={alarm.status === "Confirmed" || updatingId === alarm.id}
                            onClick={() => handleAction(alarm.id, "Confirmed")}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-red-500 text-white hover:bg-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
                          >
                            Confirm
                          </button>
                          <button
                            disabled={alarm.status === "False Alarm" || updatingId === alarm.id}
                            onClick={() => handleAction(alarm.id, "False Alarm")}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-bold ring-1 ring-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
                          >
                            False
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
              Previous
            </button>

            {/* Page numbers */}
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .reduce((acc, p, idx, arr) => {
                  if (idx > 0 && p - arr[idx - 1] > 1) acc.push("…");
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, idx) =>
                  p === "…" ? (
                    <span key={`ellipsis-${idx}`} className="px-2 text-xs text-gray-300">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${page === p
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "text-gray-500 hover:bg-gray-100"
                        }`}
                    >
                      {p}
                    </button>
                  )
                )}
            </div>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}