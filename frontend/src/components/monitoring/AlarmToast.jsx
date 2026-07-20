import { useState, useEffect, useRef } from "react";
import { cn } from "../../lib/utils";
import { io } from "socket.io-client";



// ── Variant maps ──────────────────────────────────────────────────────────────

const confBarVariants = {
  high:   "bg-red-400",
  medium: "bg-amber-400",
  low:    "bg-gray-300",
};

function getConfLevel(confidence) {
  if (confidence >= 85) return "high";
  if (confidence >= 70) return "medium";
  return "low";
}

// ── Single toast item ─────────────────────────────────────────────────────────
function ToastItem({ toast, onJump, onDismiss }) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    timerRef.current = setTimeout(() => dismiss(), 6000);
    return () => clearTimeout(timerRef.current);
  }, []);

  function dismiss() {
    clearTimeout(timerRef.current);
    setLeaving(true);
    setTimeout(() => onDismiss(toast.id), 350);
  }

  function handleJump() {
    onJump(toast.alarm);
    dismiss();
  }

  const { confidence } = toast.alarm;

  return (
    <div className={cn(
      "w-80 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden transition-all duration-350 ease-out",
      visible && !leaving ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
    )}>
      {/* Top accent */}
      <div className="h-1 bg-gradient-to-r from-red-500 via-orange-400 to-amber-400" />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5 flex-shrink-0 mt-0.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
            </span>
            <span className="text-xs font-bold text-red-600 uppercase tracking-wider">New Alarm</span>
          </div>
          <button onClick={dismiss} className="text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0 mt-0.5">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Info */}
        <div className="space-y-1 mb-3">
          <p className="text-sm font-bold text-gray-900">{toast.alarm.eventType}</p>
          <p className="text-xs text-gray-500">
            <span className="font-semibold text-gray-700">{toast.alarm.zoneLabel}</span>
            <span className="mx-1 text-gray-300">·</span>
            <span className="font-semibold text-gray-700">{toast.alarm.machineLabel}</span>
            <span className="mx-1 text-gray-300">·</span>
            <span className="font-mono text-gray-400">{toast.alarm.id}</span>
          </p>
          {/* Confidence bar */}
          <div className="flex items-center gap-2 pt-1">
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full", confBarVariants[getConfLevel(confidence)])}
                style={{ width: `${confidence}%` }}
              />
            </div>
            <span className="text-[10px] text-gray-400 font-semibold">{confidence}%</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleJump}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all active:scale-95 shadow-sm"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
            Jump to Alarm
          </button>
          <button onClick={dismiss} className="px-3 py-2 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-100 transition-colors">
            Ignore
          </button>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-0.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-300 rounded-full" style={{ animation: "shrink 6s linear forwards" }} />
        </div>
      </div>

      <style>{`@keyframes shrink { from { width: 100% } to { width: 0% } }`}</style>
    </div>
  );
}

// ── Toast container ───────────────────────────────────────────────────────────

let toastIdCounter = 0;

export default function AlarmToast({ zoneId, machineId, onJumpToAlarm }) {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const apiUrl = (import.meta.env.VITE_API_URL || "http://localhost:5050/api").replace(/\/api$/, "");
    const socket = io(apiUrl, {
      auth: { token: sessionStorage.getItem('token') || localStorage.getItem('token') },
    });

    socket.on('new-alarm', (alarm) => {
      // ตรวจสอบว่าแจ้งเตือนเป็นของเครื่องที่เรากำลังดูอยู่หรือไม่
      if (alarm && alarm.zoneId === zoneId && alarm.machineId === machineId) {
        setToasts((prev) => [{ id: ++toastIdCounter, alarm }, ...prev.slice(0, 2)]);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [zoneId, machineId]);

  function dismiss(toastId) {
    setToasts((prev) => prev.filter((t) => t.id !== toastId));
  }

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 items-end pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onJump={onJumpToAlarm} onDismiss={dismiss} />
        </div>
      ))}
    </div>
  );
}