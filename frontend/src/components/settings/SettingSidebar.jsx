import { useState, useEffect, useRef, useCallback } from "react";
import { ZoneIcon, DeviceIcon, UnassignedIcon, ChevronIcon, LoadingIcon } from "../ui/Icons";
import { StatusDot } from "../ui/StatusBadge";
import { cn } from "../../lib/utils";
import { io } from "socket.io-client";

import { getMonitoringData } from "../../services/apiSetting";  
import { decodeToken } from "../../services/apiAuth";

// ── Mock API — replace with real endpoint ─────────────────────────────────────
// GET /api/devices  →  Device[]
export async function fetchDevices() {
  //get data from api getSideBarData()
  const data = await getMonitoringData();
  //if have data running status and lastseen key si relation if lastseen > 1min activeDevice = 'inactive'
  const now = new Date();
  data.forEach((d) => {
    d.runningStatus = d.runningStatus !== "inactive" && now - new Date(d.lastSeen) < 60000 ? d.runningStatus : "inactive";
  });
  return data;
}

// ── Variant maps ──────────────────────────────────────────────────────────────

const deviceButtonBase = "relative flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-xs font-medium text-left transition-all duration-150";

const deviceButtonVariants = {
  active:   "bg-slate-800 text-white shadow-sm",
  inactive: "text-gray-500 hover:bg-gray-50 hover:text-gray-800",
};

const deviceIconVariants = {
  active:   "text-slate-300",
  inactive: "text-gray-300",
};

const deviceSubtextVariants = {
  active:   "text-slate-400",
  inactive: "text-gray-400",
};

const offBadgeVariants = {
  active:   "bg-slate-700 text-slate-300",
  inactive: "bg-gray-100 text-gray-400",
};

const footerStats = [
  { label: "Active",   dot: "bg-emerald-400", status: "active",   countClass: ""             },
  { label: "Error",    dot: "bg-red-400",     status: "error",    countClass: "text-red-500" },
  { label: "Inactive", dot: "bg-gray-300",    status: "inactive", countClass: ""             },
];

// ── Sidebar ───────────────────────────────────────────────────────────────────

export default function SettingsSidebar({ selectedId, onSelect, reloadKey = 0 }) {
  const [devices,    setDevices]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [openGroups, setOpenGroups] = useState({});
  const socketRef = useRef(null);
  
  const load = useCallback(async (isCancelled) => {
    setLoading(true);
    try {
      const allDevices = await fetchDevices();
      const tokenData = decodeToken();
      const role = tokenData?.role;
      const userPlant = tokenData?.plant;

      let data;
      if (role === 'admin') {
        data = allDevices;
      } else if (role === 'engineer') {
        data = allDevices.filter(d => d.plant === userPlant || d.plant === 'Unassigned' || d.plant === 'unassigned');
      } else {
        data = allDevices.filter(d => d.plant === userPlant && d.plant !== 'Unassigned');
      }
      if (isCancelled()) return;
      // console.log("Fetched devices:", data);
      setDevices(data);
      // On first load auto-open first group; on reload keep groups as-is
      if (reloadKey === 0) {
        const firstGroup = data.find((d) => d.zone === "Unassigned") ? "Unassigned" : data[0]?.zone;
  
        if (firstGroup) setOpenGroups((prev) => ({ ...prev, [firstGroup]: true }));
      }
    } catch {
      if (!isCancelled()) setError("Failed to load devices.");
    } finally {
      if (!isCancelled()) setLoading(false);
    }
  }, [reloadKey]);
  
  // 1. ดึงข้อมูลเมื่อโหลดหน้าจอ หรือเมื่อมีการกด Save (reloadKey อัปเดต)
  useEffect(() => {
    let cancelled = false;
    const isCancelled = () => cancelled;
    load(isCancelled);
  
    return () => {
      cancelled = true;
    };
  }, [load]);

  // 2. จัดการ Socket.io (สร้างท่อเชื่อมต่อแค่ครั้งเดียวเมื่อโหลด Sidebar)
  useEffect(() => {
    let cancelled = false;
    const isCancelled = () => cancelled;
    // Fast update: only refresh device statuses (active/inactive)
    async function updateDeviceStatuses() {
      try {
        const data = await fetchDevices();
        if (!cancelled) {
          // Update statuses without resetting group open state
          setDevices((prev) =>
            prev.map((p) => {
              const updated = data.find((d) => d.mcId === p.mcId);
              return updated ? { ...p, runningStatus: updated.runningStatus, lastSeen: updated.lastSeen } : p;
            })
          );
        }
      } catch {
        // Silently fail
      }
    }

    function initSocket() {
      const apiUrl = (import.meta.env.VITE_API_URL || "http://localhost:5050/api").replace(/\/api$/, "");
      const socket = io(apiUrl, {
        auth: {
          token: sessionStorage.getItem('token') || localStorage.getItem('token'),
        },
      });

      socket.on('connect', () => {
        const tokenData = decodeToken();
        if (tokenData) {
          const role = tokenData.role;
          const plantName = tokenData.plant;
          // console.log(`Socket connected. Role: ${role}, Plant: ${plantName}`);
          if (role === 'admin') {
            socket.emit('join-plant', 'ALL');
          } else {
            if (plantName) socket.emit('join-plant', plantName);
            if (role === 'engineer') socket.emit('join-plant', 'Unassigned');
          }
        }
      });

      socket.on('device-status', (data) => {
        // console.log(`Received device status update:`, data);
        // ใช้อัปเดตจาก payload โดยตรง เพื่อหลีกเลี่ยง Race Condition ที่ API อาจจะยังคืนค่าสถานะเดิม
        if (data) {
          setDevices((prev) => {
            const dataArray = Array.isArray(data) ? data : [data];
            return prev.map((p) => {
              const updated = dataArray.find((d) => d.mcId === p.mcId);
              if (updated) {
                return { ...p, ...updated };
              }
              return p;
            });
          });
        } else {
          // ถ้าไม่มี payload ให้หน่วงเวลารอ API บันทึกข้อมูลลงฐานข้อมูลให้เสร็จก่อนดึงใหม่
          setTimeout(updateDeviceStatuses, 500);
        }
      });

      socket.on('new-device', () => {
        // console.log('New device registered, reloading device list.');
        load(isCancelled);
      });

      socketRef.current = socket;
    }

    initSocket();

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
    };
  }, [load]); // <--- เพิ่ม load เข้าไปใน dependency array

  const grouped = devices.reduce((acc, d) => {
    // If device's plant is 'Unassigned', force it into the 'Unassigned' group regardless of its zone.
    // Otherwise, group by zone, defaulting to 'Unassigned' if zone is not set.
    const key = d.plant === 'Unassigned' ? 'Unassigned' : (d.zone || "Unassigned");
    if (!acc[key]) acc[key] = [];
    acc[key].push(d);
    return acc;
  }, {});

  const tokenData = decodeToken();
  const role = tokenData?.role;

  // Admin/Engineer see "Unassigned" first. Users only see assigned zones.
  const groupKeys = (role === 'admin' || role === 'engineer')
    ? [
        "Unassigned",
        ...Object.keys(grouped).filter((k) => k !== "Unassigned").sort(),
      ]
    : Object.keys(grouped).filter((k) => k !== "Unassigned").sort();


  function toggleGroup(key) {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <aside className="flex flex-col w-60 min-h-0 h-full bg-white border-r border-gray-100 shadow-sm flex-shrink-0">

      {/* Header */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="w-4 h-4 text-slate-400">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
          </svg>
          <span className="text-xs font-bold tracking-widest uppercase text-gray-400">Settings</span>
        </div>
        <span className="text-[10px] text-gray-300 font-semibold">{devices.length} devices</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 flex flex-col gap-0.5">

        {loading && (
          <div className="flex items-center gap-2 px-3 py-4 text-xs text-gray-400">
            <LoadingIcon /> Loading devices…
          </div>
        )}
        {error && (
          <div className="mx-2 px-3 py-2.5 rounded-xl bg-red-50 text-xs text-red-500 font-medium">{error}</div>
        )}

        {!loading && !error && groupKeys.map((groupKey) => {
          const isOpen       = !!openGroups[groupKey];
          const isUnassigned = groupKey === "Unassigned";
          const groupDevices = grouped[groupKey] ?? [];
          const errorCount   = groupDevices.filter((d) => d.runningStatus === "error").length;

          return (
            <div key={groupKey}>

              {/* ── Group header ── */}
              <button
                onClick={() => toggleGroup(groupKey)}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-left text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all duration-150"
              >
                <span className={cn(isUnassigned ? "text-amber-400" : "text-slate-400")}>
                  {isUnassigned ? <UnassignedIcon /> : <ZoneIcon />}
                </span>
                <span className="flex-1 truncate">{groupKey}</span>
                {errorCount > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">
                    {errorCount}
                  </span>
                )}
                <span className="text-[10px] text-gray-300 font-semibold mr-0.5">{groupDevices.length}</span>
                <ChevronIcon open={isOpen} />
              </button>

              {/* ── Device list ── */}
              <div
                className="overflow-hidden transition-all duration-300 ease-in-out"
                style={{ maxHeight: isOpen ? `${groupDevices.length * 65}px` : "0px" }}
              >
                <div className="ml-4 pl-3 border-l-2 border-gray-100 my-1 flex flex-col gap-0.5">
                  {groupDevices.map((device) => {
                    const isActive = selectedId === device.mcId;
                    const state    = isActive ? "active" : "inactive";

                    return (
                      <button
                        key={device.mcId}
                        onClick={() => onSelect?.(device.mcId, device)}
                        className={cn(deviceButtonBase, deviceButtonVariants[state])}
                      >
                        <StatusDot status={device.runningStatus} />
                        <span className={cn("flex-shrink-0", deviceIconVariants[state])}>
                          <DeviceIcon />
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-semibold">{device.deviceName}</p>
                          <p className={cn("text-[10px] truncate", deviceSubtextVariants[state])}>
                            {device.mcId}
                          </p>
                        </div>
                        {!device.activeDevice && (
                          <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded", offBadgeVariants[state])}>
                            OFF
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          );
        })}
      </nav>

      {/* Footer */}
      {!loading && !error && (
        <div className="px-4 py-3 border-t border-gray-100 space-y-1">
          {footerStats.map(({ label, dot, status, countClass }) => (
            <div key={label} className="flex items-center justify-between text-[10px] text-gray-400">
              <span className="flex items-center gap-1">
                <span className={cn("w-1.5 h-1.5 rounded-full", dot)} />
                {label}
              </span>
              <span className={cn("font-semibold", countClass)}>
                {devices.filter((d) => d.runningStatus === status).length}
              </span>
            </div>
          ))}
        </div>
      )}

    </aside>
  );
}