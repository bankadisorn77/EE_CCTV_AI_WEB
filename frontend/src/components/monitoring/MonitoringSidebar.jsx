import { useState, useEffect, useCallback, useRef } from "react";
import { useNotifications } from "../../context/NotificationContext";
import { DashboardIcon, ZoneIcon, MachineIcon, ChevronIcon, LoadingIcon } from "../ui/Icons";
import { Badge } from "../ui/StatusBadge";
import { cn } from "../../lib/utils";
import { fetchDevices, fetchAlarms } from "../../services/monitor";
import { decodeToken } from "../../services/apiAuth";

function buildZones(devices, alarms, role) {
  const zonesMap = new Map();

  // นับจำนวน alarm ที่ยังไม่ได้ตรวจสอบสำหรับแต่ละเครื่อง
  const uninspectedCounts = alarms.reduce((acc, alarm) => {
    if (alarm.status === 'Uninspected' || !alarm.status) {
      acc[alarm.mcId] = (acc[alarm.mcId] || 0) + 1;
    }
    return acc;
  }, {});

  // บังคับสร้างโซน Unassigned เตรียมไว้เสมอ เฉพาะ Admin/Engineer เท่านั้น
  if (role === "admin" || role === "engineer") {
    zonesMap.set("Unassigned", { id: "Unassigned", label: "Unassigned", machines: [] });
  }

  devices.forEach((d) => {
    const zoneId = d.zone || "Unassigned";
    const zoneLabel = d.zone || "Unassigned";

    if (!zonesMap.has(zoneId)) {
      zonesMap.set(zoneId, { id: zoneId, label: zoneLabel, machines: [] });
    }
    zonesMap.get(zoneId).machines.push({
      ...d,
      id: d.mcId,
      label: d.deviceName || d.mcId,
      uninspected: uninspectedCounts[d.mcId] || 0,
    });
  });

  const unassignedZone = zonesMap.get("Unassigned");
  const otherZones = Array.from(zonesMap.values())
    .filter((z) => z.id !== "Unassigned")
    .sort((a, b) => a.label.localeCompare(b.label)); // เรียงโซนอื่นๆ ตามตัวอักษร

  return unassignedZone ? [unassignedZone, ...otherZones] : otherZones;
}

// ── Variant maps — ALL the conditional classes live here, not inside JSX ──────

// Shared base for zone + dashboard nav buttons
const navButtonBase = "flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-all duration-150";

const navButtonVariants = {
  active:   "bg-indigo-50 text-indigo-600",
  inactive: "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
};

const navIconVariants = {
  active:   "text-indigo-500",
  inactive: "text-gray-400",
};

// Machine row button
const machineButtonBase = "relative flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium text-left transition-all duration-150";

const machineButtonVariants = {
  active:   "bg-indigo-50 text-indigo-600",
  inactive: "text-gray-500 hover:bg-gray-50 hover:text-gray-800",
};

const machineDotVariants = {
  active:   "bg-indigo-500",
  inactive: "bg-gray-200",
};

const machineIconVariants = {
  active:   "text-gre-400",
  inactive: "text-gray-300",
};

// ── Sidebar ───────────────────────────────────────────────────────────────────
export default function MonitoringSidebar({ onSelect, selectedKey }) {
  const [zones, setZones]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [openZones, setOpenZones] = useState({});
  const reloadTimeoutRef = useRef(null);

  const { unreadAlarms, unreadCount } = useNotifications();

  const unreadByMachine = unreadAlarms.reduce((acc, a) => {
    const key = `${a.zoneId}__${a.machineId}`;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const unreadByZone = unreadAlarms.reduce((acc, a) => {
    acc[a.zoneId] = (acc[a.zoneId] ?? 0) + 1;
    return acc;
  }, {});

  const loadData = useCallback((isInitialLoad = false) => {
    if (isInitialLoad) {
      setLoading(true);
    }
    
    const tokenData = decodeToken();
    const role = tokenData?.role;
    const userPlant = tokenData?.plant;

    Promise.all([fetchDevices(), fetchAlarms()])
      .then(([devices, alarms]) => {
        let displayDevices;
        if (role === 'admin') {
          displayDevices = devices;
        } else if (role === 'engineer') {
          displayDevices = devices.filter(d => d.plant === userPlant || !d.plant || d.plant === 'Unassigned' || d.plant === 'unassigned');
        } else {
          displayDevices = devices.filter(d => d.plant === userPlant && d.plant !== 'Unassigned' && d.plant !== 'unassigned');
        }

        const data = buildZones(displayDevices, alarms, role);
        setZones(data);
        if (isInitialLoad && data.length > 0) {
          setOpenZones({ [data[0].id]: true });
        }
      })
      .catch(() => setError("Failed to load zones."))
      .finally(() => {
        if (isInitialLoad) setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadData(true); // Initial load

    // Debounced handler to reload data for the sidebar
    const handleDataUpdate = () => {
      if (reloadTimeoutRef.current) {
        clearTimeout(reloadTimeoutRef.current);
      }
      reloadTimeoutRef.current = setTimeout(() => {
        loadData(); // Reloads data without showing the main loading spinner
      }, 500); // Debounce for 500ms
    };

    window.addEventListener('alarm-status-updated', handleDataUpdate);
    window.addEventListener('new-alarm-received', handleDataUpdate); // Listen for new alarms

    return () => {
      window.removeEventListener('alarm-status-updated', handleDataUpdate);
      window.removeEventListener('new-alarm-received', handleDataUpdate);
      if (reloadTimeoutRef.current) clearTimeout(reloadTimeoutRef.current);
    };
  }, [loadData]);

  function toggleZone(zoneId) {
    setOpenZones((prev) => ({ ...prev, [zoneId]: !prev[zoneId] }));
  }

  const isDashboard = selectedKey === "dashboard";

  return (
    <aside className="flex flex-col w-56 min-h-0 h-full bg-white border-r border-gray-100 shadow-sm flex-shrink-0">

      {/* Header */}
      <div className="flex items-center gap-2 h-14 px-4 border-b border-gray-100">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
        </span>
        <span className="text-xs font-bold tracking-widest uppercase text-gray-400">Monitoring</span>

        {/* {unreadCount > 0 && (
          <span className="ml-auto min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )} */}
          
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 flex flex-col gap-0.5">

        {/* ── Dashboard button ── */}
        <button
          onClick={() => onSelect?.("dashboard")}
          className={cn(navButtonBase, navButtonVariants[isDashboard ? "active" : "inactive"])}
        >
          <span className={cn(navIconVariants[isDashboard ? "active" : "inactive"])}>
            <DashboardIcon />
          </span>
          Dashboard
        </button>

        <div className="my-2 mx-3 border-t border-gray-100" />
        <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Zones</p>

        {loading && (
          <div className="flex items-center gap-2 px-3 py-3 text-xs text-gray-400">
            <LoadingIcon /> Loading zones…
          </div>
        )}

        {error && (
          <div className="mx-2 px-3 py-2.5 rounded-xl bg-red-50 text-xs text-red-500 font-medium">{error}</div>
        )}

        {!loading && !error && zones.map((zone) => {
          const isZoneOpen   = !!openZones[zone.id];
          const isZoneActive = selectedKey === zone.id;
          const zoneUnread   = unreadByZone[zone.id] ?? 0;
          const zoneState    = isZoneActive ? "active" : "inactive";

          return (
            <div key={zone.id}>

              {/* ── Zone row ── */}
              <button
                onClick={() => toggleZone(zone.id)}
                className={cn(navButtonBase, navButtonVariants[zoneState])}
              >
                <span className={cn(navIconVariants[zoneState])}>
                  <ZoneIcon />
                </span>
                <span className="flex-1 truncate">{zone.label}</span>
                {!isZoneOpen && zoneUnread > 0 && <Badge count={zoneUnread} />}
                <ChevronIcon open={isZoneOpen} />
              </button>

              {/* ── Machine list ── */}
              <div
                className="overflow-hidden transition-all duration-300 ease-in-out"
                style={{ maxHeight: isZoneOpen ? `${zone.machines.length * 44}px` : "0px" }}
              >
                <div className="ml-4 pl-3 border-l-2 border-gray-100 my-1 flex flex-col gap-0.5">
                  {zone.machines.map((mc) => {
                    const mcKey    = `${zone.id}__${mc.id}`;
                    const isActive = selectedKey === mcKey;
                    const mcState  = isActive ? "active" : "inactive";
                    const mcUnread = unreadByMachine[mcKey] ?? 0;

                    return (
                      <button
                        key={mc.id}
                        onClick={() => onSelect?.(mcKey)}
                        className={cn(machineButtonBase, machineButtonVariants[mcState])}
                      >
                        <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", machineDotVariants[mcState])} />
                        <span className={cn(machineIconVariants[mcState])}>
                          <MachineIcon />
                        </span>
                        <span className="flex-1 truncate">{mc.label}</span>
                        <span className="flex items-center gap-1">
                          {mc.uninspected > 0 && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700" title={`${mc.uninspected} uninspected items`}>{ mc.uninspected > 99 ? "99+" : mc.uninspected}</span>
                          )}
                        </span>
                        <Badge count={mcUnread} />
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
        <div className="px-4 py-3 border-t border-gray-100">
          <p className="text-[10px] text-gray-400">
            {zones.length} zones · {zones.reduce((acc, z) => acc + z.machines.length, 0)} machines
          </p>
        </div>
      )}
    </aside>
  );
}
