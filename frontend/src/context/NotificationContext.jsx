import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";

// ── Context ───────────────────────────────────────────────────────────────────
const NotificationContext = createContext(null);

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used inside <NotificationProvider>");
  return ctx;
}

// ── Provider ──────────────────────────────────────────────────────────────────
// Wrap your entire app with this — one WebSocket connection for the whole app.
//
// Usage in App.jsx / main layout:
//   <NotificationProvider wsUrl="ws://your-server/ws">
//     <Navbar />
//     <Routes>...</Routes>
//   </NotificationProvider>
//
// WebSocket message shape expected from server:
//   {
//     type: "new_alarm",
//     alarm: {
//       id: "ALM-0001",
//       zoneId: "zone-a",
//       machineId: "mc01",
//       zoneLabel: "Zone A",
//       machineLabel: "MC01",
//       eventType: "Motion Detected",
//       confidence: 87,
//       timestamp: "2026-03-04T10:00:00Z"
//     }
//   }

export function NotificationProvider({ children, wsUrl }) {
  // All unread alarms (newest first)
  const [unreadAlarms, setUnreadAlarms] = useState([]);

  // Listeners registered by MachinePage: Map<listenerId, fn>
  const listenersRef = useRef(new Map());
  const wsRef        = useRef(null);
  const reconnectRef = useRef(null);

  // ── Derived: total unread count ───────────────────────────────────────────
  const unreadCount = unreadAlarms.length;

  // ── Register/unregister a page-level listener ─────────────────────────────
  // MachinePage uses this to receive toasts for its specific zone+machine
  const subscribe = useCallback((id, fn) => {
    listenersRef.current.set(id, fn);
    return () => listenersRef.current.delete(id);
  }, []);

  // ── Mark alarms as read (call when user opens/reviews an alarm) ───────────
  const markRead = useCallback((alarmId) => {
    setUnreadAlarms((prev) => prev.filter((a) => a.id !== alarmId));
  }, []);

  const markAllRead = useCallback(() => {
    setUnreadAlarms([]);
  }, []);

  // ── Handle incoming message ───────────────────────────────────────────────
  function handleMessage(raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type !== "new_alarm" || !msg.alarm) return;

    const alarm = msg.alarm;

    // 1. Add to global unread list (newest first)
    setUnreadAlarms((prev) => [alarm, ...prev]);

    // 2. Notify any active page listeners (MachinePage toast)
    listenersRef.current.forEach((fn) => fn(alarm));
  }

  // ── WebSocket connect with auto-reconnect ─────────────────────────────────
  function connect() {
    if (!wsUrl) return;

    // Uncomment when ready for real WebSocket:
    // const ws = new WebSocket(wsUrl);
    // ws.onmessage = (e) => handleMessage(e.data);
    // ws.onclose   = () => { reconnectRef.current = setTimeout(connect, 3000); };
    // ws.onerror   = () => ws.close();
    // wsRef.current = ws;

    // ── MOCK: simulate incoming alarms every 12s for development ──────────
    const zones    = [{ id: "zone-a", label: "Zone A" }, { id: "zone-b", label: "Zone B" }];
    const machines = [{ id: "mc01", label: "MC01" }, { id: "mc02", label: "MC02" }];
    const types    = ["Motion Detected", "Intrusion Alert", "Perimeter Breach"];

    let counter = 1;
    const interval = setInterval(() => {
      const zone    = zones[Math.floor(Math.random() * zones.length)];
      const machine = machines[Math.floor(Math.random() * machines.length)];
      handleMessage(JSON.stringify({
        type: "new_alarm",
        alarm: {
          id:           `ALM-LIVE-${String(counter++).padStart(3, "0")}`,
          zoneId:       zone.id,
          machineId:    machine.id,
          zoneLabel:    zone.label,
          machineLabel: machine.label,
          eventType:    types[Math.floor(Math.random() * types.length)],
          confidence:   Math.floor(65 + Math.random() * 35),
          timestamp:    new Date().toISOString(),
        },
      }));
    }, 12000);

    wsRef.current = { close: () => clearInterval(interval) };
    // ── END MOCK ──────────────────────────────────────────────────────────
  }

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      clearTimeout(reconnectRef.current);
    };
  }, [wsUrl]);

  return (
    <NotificationContext.Provider value={{ unreadCount, unreadAlarms, subscribe, markRead, markAllRead }}>
      {children}
    </NotificationContext.Provider>
  );
}