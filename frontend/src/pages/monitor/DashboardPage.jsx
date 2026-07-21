import { useState, useEffect, useRef } from "react";
import {
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { io } from "socket.io-client";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { fetchDevices, fetchAlarms } from "../../services/monitor";
import { decodeToken } from "../../services/apiAuth";

function buildTrendData(alarms) {
  const today = new Date();
  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    return {
      key: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString("en-GB", { weekday: "short" }),
      date: d,
    };
  });

  return days.map(({ key, label }) => {
    const dayAlarms = alarms.filter((a) => a.timestamp?.slice(0, 10) === key);
    const counts = dayAlarms.reduce((acc, a) => {
      const status = a.status || "Uninspected";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
    return {
      day: label,
      Uninspected: counts.Uninspected || 0,
      Confirmed: counts.Confirmed || 0,
      "False Alarm": counts["False Alarm"] || 0,
    };
  });
}

function buildTypeData(alarms) {
  const counts = alarms.reduce((acc, a) => {
    const t = a.type || "Unknown";
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).map(([name, value]) => ({ name, value }));
}

function buildZoneData(alarms) {
  const counts = alarms.reduce((acc, a) => {
    const zone = a.zone || "Unknown";
    const key = `${zone} / ${a.mcId || ""}`;
    // console.log(`Processing alarm for zone: ${zone}, machine: ${a.mcId}, key: ${key}`);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const tokenData = decodeToken();
  const role = tokenData?.role;

  let sorted = Object.entries(counts).map(([zone, count]) => ({ zone, count }))
    .sort((a, b) => b.count - a.count); // เรียงตามจำนวน Alarm จากมากไปน้อยก่อน

  if (role === 'admin' || role === 'engineer') {
    // ถ้าเป็น Admin/Engineer ดึงกลุ่ม Unassigned มาฟิกไว้บนสุด
    const unassigned = sorted.filter(item => item.zone.startsWith("Unassigned") || item.zone.startsWith("unassigned"));
    const others = sorted.filter(item => !item.zone.startsWith("Unassigned") && !item.zone.startsWith("unassigned"));
    //console.log("Unassigned zones:", unassigned);
    //console.log("Other zones:", others);
    return [...unassigned, ...others];
  } else {
    // ถ้าเป็น User ตัด Unassigned ทิ้งไปเลยไม่ให้แสดง
    return sorted.filter(item => !item.zone.startsWith("Unassigned") && !item.zone.startsWith("unassigned"));
  }
}

function buildInspectionRate(alarms) {
  const counts = alarms.reduce(
    (acc, a) => {
      const status = a.status || "Uninspected";
      if (status === "Confirmed") acc.confirmed += 1;
      else if (status === "False Alarm") acc.falseAlarm += 1;
      else acc.uninspected += 1;
      acc.total += 1;
      return acc;
    },
    { confirmed: 0, falseAlarm: 0, uninspected: 0, total: 0 }
  );
  return counts;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(iso){return new Date(iso).toLocaleString("en-GB",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});}
function timeAgo(iso){const d=Math.floor((Date.now()-new Date(iso))/1000);if(d<60)return`${d}s ago`;if(d<3600)return`${Math.floor(d/60)}m ago`;return`${Math.floor(d/3600)}h ago`;}

// ── Stat cards ────────────────────────────────────────────────────────────────
function statCards(s){return[
  {key:"plant",label:"Plant",value:s.plant,bg:"bg-purple-100",iconColor:"text-purple-500",valueColor:"text-purple-700",border:"border-purple-100",icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="w-5 h-5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>},
  {key:"totalMachine",label:"Total Machines",value:s.totalMachine,bg:"bg-indigo-50",iconColor:"text-indigo-500",valueColor:"text-indigo-700",border:"border-indigo-100",icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="w-5 h-5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>},
  {key:"activeMachine",label:"Active",value:s.activeMachine,bg:"bg-emerald-50",iconColor:"text-emerald-500",valueColor:"text-emerald-700",border:"border-emerald-100",icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="w-5 h-5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>},
  {key:"inactiveMachine",label:"Inactive",value:s.inactiveMachine,bg:"bg-gray-100",iconColor:"text-gray-400",valueColor:"text-gray-600",border:"border-gray-200",icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="w-5 h-5"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>},
  {key:"allAlarm",label:"All Alarms",value:s.allAlarm,bg:"bg-blue-50",iconColor:"text-blue-500",valueColor:"text-blue-700",border:"border-blue-100",icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="w-5 h-5"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>},
  {key:"uninspectedAlarm",label:"Uninspected",value:s.uninspectedAlarm,bg:"bg-amber-50",iconColor:"text-amber-500",valueColor:"text-amber-700",border:"border-amber-100",icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="w-5 h-5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>},
  {key:"falseAlarm",label:"False Alarms",value:s.falseAlarm,bg:"bg-rose-50",iconColor:"text-rose-400",valueColor:"text-rose-600",border:"border-rose-100",icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="w-5 h-5"><polyline points="20 6 9 17 4 12"/></svg>},
];}

// ── Skeletons ─────────────────────────────────────────────────────────────────
function CardSkeleton(){return(<div className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse"><div className="w-9 h-9 rounded-xl bg-gray-100 mb-3"/><div className="w-12 h-8 rounded bg-gray-100 mb-1"/><div className="w-20 h-3 rounded bg-gray-100"/></div>);}
function ChartSkeleton({h="h-56"}){return <div className={`${h} bg-gray-100 rounded-xl animate-pulse`}/>;}

// ── Custom tooltip ────────────────────────────────────────────────────────────
function CustomTooltip({active,payload,label}){
  if(!active||!payload?.length)return null;
  return(<div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2.5 text-xs"><p className="font-bold text-gray-700 mb-1">{label}</p>{payload.map((p)=>(<div key={p.name} className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{background:p.color}}/><span className="text-gray-500">{p.name}:</span><span className="font-semibold text-gray-700">{p.value}</span></div>))}</div>);
}

// ── Circular gauge ────────────────────────────────────────────────────────────
function CircularGauge({pct,label,color,size=120}){
  const r=44,cx=60,cy=60,circ=2*Math.PI*r,dash=(pct/100)*circ;
  return(
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox="0 0 120 120">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f3f4f6" strokeWidth={10}/>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={10}
          strokeDasharray={`${dash} ${circ-dash}`} strokeDashoffset={circ/4} strokeLinecap="round"
          style={{transition:"stroke-dasharray 0.8s ease"}}/>
        <text x={cx} y={cy-6} textAnchor="middle" fontSize="18" fontWeight="700" fill="#1f2937">{pct}%</text>
        <text x={cx} y={cy+14} textAnchor="middle" fontSize="10" fill="#9ca3af">{label}</text>
      </svg>
    </div>
  );
}

const TREND_COLORS={"Uninspected":"#f59e0b","Confirmed":"#ef4444","False Alarm":"#9ca3af"};
const DONUT_COLORS=["#6366f1","#f59e0b","#ef4444","#10b981","#3b82f6"];
const ZONE_COLORS=["#ef4444","#f97316","#f59e0b","#6366f1","#3b82f6"];

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function DashboardPage(){
  const [stats,setStats]=useState(null);
  const [alarms,setAlarms]=useState([]);
  const [trendData,setTrendData]=useState([]);
  const [typeData,setTypeData]=useState([]);
  const [zoneData,setZoneData]=useState([]);
  const [inspectionRate,setInspectionRate]=useState(null);
  const [loadingStats,setLoadingStats]=useState(true);
  const [loadingAlarms,setLoadingAlarms]=useState(true);
  const [loadingCharts,setLoadingCharts]=useState(true);
  const [filterStatus,setFilterStatus]=useState("All");
  const socketRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let loadTimeout = null;

    // Full load: devices + alarms + charts
    async function load() {
      setLoadingStats(true);
      setLoadingAlarms(true);
      setLoadingCharts(true);

      try {
        const devices = await fetchDevices();
        if (!cancelled) {
          updateStatsFromDevices(devices);
        }
      } catch {
        if (!cancelled) setStats(null);
      } finally {
        if (!cancelled) setLoadingStats(false);
      }

      try {
        const alarms = await fetchAlarms();
        if (!cancelled) {
          const sortedAlarms = [...alarms].sort((a, b) => {
            const tA = new Date(a.timestamp || a.createdAt).getTime();
            const tB = new Date(b.timestamp || b.createdAt).getTime();
            return tB - tA;
          });

          setAlarms(sortedAlarms);
          const trend = buildTrendData(sortedAlarms);
          const types = buildTypeData(sortedAlarms);
          const zones = buildZoneData(sortedAlarms);
          const inspection = buildInspectionRate(sortedAlarms);

          setTrendData(trend);
          setTypeData(types);
          setZoneData(zones);
          setInspectionRate(inspection);

          setStats((prev) => ({
            ...(prev || {}),
            allAlarm: inspection.total,
            uninspectedAlarm: inspection.uninspected,
            falseAlarm: inspection.falseAlarm,
          }));
        }
      } catch {
        if (!cancelled) {
          setAlarms([]);
          setTrendData([]);
          setTypeData([]);
          setZoneData([]);
          setInspectionRate(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingAlarms(false);
          setLoadingCharts(false);
        }
      }
    }

    // Fast update: only device count (active/inactive) - no alarm reload
    async function updateStats() {
      try {
        const devices = await fetchDevices();
        if (!cancelled) {
          updateStatsFromDevices(devices);
        }
      } catch {
        // Silently fail
      }
    }

    // Helper: update device count stats
    function updateStatsFromDevices(devices) {
      const tokenData = decodeToken();
      const role = tokenData?.role;
      const userPlant = tokenData?.plant;
      const plant = role === 'admin' ? 'ALL' : (userPlant || devices[0]?.plant || "—");
      const totalMachine = devices.length;
      const activeMachine = devices.filter((d) => d.runningStatus === "active").length;
      const inactiveMachine = totalMachine - activeMachine;

      setStats((prev) => ({
        ...(prev || {}),
        plant,
        totalMachine,
        activeMachine,
        inactiveMachine,
      }));

      // Join rooms based on role (only once)
      if (socketRef.current && !socketRef.current.hasJoined) {
        socketRef.current.hasJoined = true;
        if (role === 'admin') {
          socketRef.current.emit('join-plant', 'ALL');
        } else {
          if (userPlant) socketRef.current.emit('join-plant', userPlant);
          if (role === 'engineer') socketRef.current.emit('join-plant', 'Unassigned', 'unassigned');
        }
      }
    }

    // Setup socket connection once
    function initSocket() {
      const apiUrl = (import.meta.env.VITE_API_URL || "http://localhost:5050/api").replace(/\/api$/, "");
      const socket = io(apiUrl, {
        auth: {
          token: sessionStorage.getItem('token') || localStorage.getItem('token'),
        },
      });

      socket.on('connect', () => {
        load();
        // console.log("connected");
      });

      socket.on('new-alarm', () => {
        // Full reload on new alarm (includes charts, stats, alarms)
        if (loadTimeout) clearTimeout(loadTimeout);
        loadTimeout = setTimeout(load, 1000);
        // console.log("new alarm");
      });

      socket.on('device-status', () => {
        // หน่วงเวลารอให้ Backend อัปเดตข้อมูลลง Database ให้เสร็จก่อนดึง API ใหม่
        setTimeout(updateStats, 500);
      });

      socketRef.current = socket;
    }

    initSocket();

    return () => {
      cancelled = true;
      if (loadTimeout) clearTimeout(loadTimeout);
      socketRef.current?.disconnect();
    };
  }, []);

  // const cards=stats?statCards(stats):[];
  // const filteredAlarms=filterStatus==="All"?alarms:alarms.filter((a)=>a.status===filterStatus);
  const cards=stats?statCards(stats):[];
  const filteredAlarms=(filterStatus==="All"?alarms:alarms.filter((a)=>a.status===filterStatus)).slice(0, 20);



  const inspected=inspectionRate?Math.round(((inspectionRate.confirmed+inspectionRate.falseAlarm)/inspectionRate.total)*100):0;
  const confirmedPct=inspectionRate?Math.round((inspectionRate.confirmed/inspectionRate.total)*100):0;
  const falsePct=inspectionRate?Math.round((inspectionRate.falseAlarm/inspectionRate.total)*100):0;
  const uninspPct=inspectionRate?Math.round((inspectionRate.uninspected/inspectionRate.total)*100):0;

  return(
    <div className="flex-1 overflow-y-auto bg-gray-50 min-h-0">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">Live overview of all machines and alarm activity</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
          {loadingStats?Array.from({length:6}).map((_,i)=><CardSkeleton key={i}/>):cards.map((card)=>(
            <div key={card.key} className={`bg-white rounded-2xl border ${card.border} p-5 hover:shadow-md transition-shadow duration-200`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${card.bg} ${card.iconColor}`}>{card.icon}</div>
              <p className={`text-3xl font-bold tracking-tight ${card.valueColor}`}>{card.value}</p>
              <p className="text-xs text-gray-400 mt-0.5 font-medium">{card.label}</p>
            </div>
          ))}
        </div>

        {/* ══ ANALYTICS ══ */}

        {/* Row 1 — Trend + Donut */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

          {/* 1. Alarm Trend Line */}
          <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="text-sm font-bold text-gray-800">Alarm Trend</h2>
                <p className="text-xs text-gray-400 mt-0.5">Daily alarm volume · last 7 days</p>
              </div>
              <div className="flex items-center gap-3">
                {Object.entries(TREND_COLORS).map(([k,c])=>(
                  <span key={k} className="flex items-center gap-1.5 text-[11px] text-gray-500 font-semibold">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{background:c}}/>{k}
                  </span>
                ))}
              </div>
            </div>
            {loadingCharts?<ChartSkeleton h="h-52"/>:(
              <ResponsiveContainer width="100%" height={210}>
                <AreaChart data={trendData} margin={{top:0,right:4,left:-20,bottom:0}}>
                  <defs>
                    {Object.entries(TREND_COLORS).map(([k,c])=>(
                      <linearGradient key={k} id={`grad-${k.replace(" ","-")}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={c} stopOpacity={0.15}/>
                        <stop offset="95%" stopColor={c} stopOpacity={0}/>
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false}/>
                  <XAxis dataKey="day" tick={{fontSize:11,fill:"#9ca3af"}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fontSize:11,fill:"#9ca3af"}} axisLine={false} tickLine={false}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  {Object.entries(TREND_COLORS).map(([k,c])=>(
                    <Area key={k} type="monotone" dataKey={k} stroke={c} strokeWidth={2}
                      fill={`url(#grad-${k.replace(" ","-")})`}
                      dot={{r:3,fill:c,strokeWidth:0}} activeDot={{r:5,fill:c,strokeWidth:2,stroke:"#fff"}}/>
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* 2. Alarm Type Donut */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="mb-5">
              <h2 className="text-sm font-bold text-gray-800">Alarm Types</h2>
              <p className="text-xs text-gray-400 mt-0.5">By event · last 7 days</p>
            </div>
            {loadingCharts?<ChartSkeleton h="h-52"/>:(
              <div>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={typeData} cx="50%" cy="50%" innerRadius={52} outerRadius={76} dataKey="value" paddingAngle={3}>
                      {typeData.map((_,i)=><Cell key={i} fill={DONUT_COLORS[i%DONUT_COLORS.length]}/>)}
                    </Pie>
                    <text x="50%" y="47%" textAnchor="middle" dominantBaseline="middle" fontSize="22" fontWeight="700" fill="#1f2937">
                      {typeData.reduce((a,d)=>a+d.value,0)}
                    </text>
                    <text x="50%" y="57%" textAnchor="middle" dominantBaseline="middle" fontSize="10" fill="#9ca3af">total</text>
                    <Tooltip contentStyle={{fontSize:12,borderRadius:10,border:"1px solid #e5e7eb"}}/>
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-2 space-y-1.5">
                  {typeData.map((d,i)=>(
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 text-gray-500">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{background:DONUT_COLORS[i%DONUT_COLORS.length]}}/>
                        {d.name}
                      </span>
                      <span className="font-semibold text-gray-700">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Row 2 — Zone heatmap + Inspection gauge */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

          {/* 3. Zone Heatmap */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="mb-5">
              <h2 className="text-sm font-bold text-gray-800">Zone Activity</h2>
              <p className="text-xs text-gray-400 mt-0.5">Top machines by alarm count · last 24 hours</p>
            </div>
            {loadingCharts?<ChartSkeleton h="h-56"/>:(
              <div>
                <div className="space-y-3 mb-5">
                  {zoneData.map((z,i)=>{
                    const pct=Math.round((z.count/zoneData[0].count)*100);
                    const colors=["bg-red-500","bg-orange-400","bg-amber-400","bg-indigo-400","bg-blue-300"];
                    return(
                      <div key={z.zone}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium text-gray-700">{z.zone}</span>
                          <span className="font-bold text-gray-500">{z.count} alarms</span>
                        </div>
                        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${colors[i]} transition-all duration-700`} style={{width:`${pct}%`}}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="border-t border-gray-100 pt-4">
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={zoneData} layout="vertical" margin={{top:0,right:10,left:85,bottom:0}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false}/>
                      <XAxis type="number" tick={{fontSize:10,fill:"#9ca3af"}} axisLine={false} tickLine={false}/>
                      <YAxis type="category" dataKey="zone" tick={{fontSize:10,fill:"#6b7280"}} axisLine={false} tickLine={false} width={83}/>
                      <Tooltip contentStyle={{fontSize:11,borderRadius:8,border:"1px solid #e5e7eb"}}/>
                      <Bar dataKey="count" radius={[0,4,4,0]}>
                        {zoneData.map((_,i)=><Cell key={i} fill={ZONE_COLORS[i%ZONE_COLORS.length]}/>)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* 4. Inspection Rate Gauge */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="mb-5">
              <h2 className="text-sm font-bold text-gray-800">Inspection Rate</h2>
              <p className="text-xs text-gray-400 mt-0.5">Team review performance · all time</p>
            </div>
            {loadingCharts||!inspectionRate?<ChartSkeleton h="h-56"/>:(
              <div>
                <div className="flex justify-center mb-4">
                  <CircularGauge pct={inspected > 0 ? inspected : 0} label="inspected" color="#6366f1" size={140}/>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <CircularGauge pct={confirmedPct > 0 ? confirmedPct : 0} label="confirmed" color="#ef4444" size={90}/>
                  <CircularGauge pct={falsePct > 0 ? falsePct : 0} label="false alarm" color="#9ca3af" size={90}/>
                  <CircularGauge pct={uninspPct > 0 ? uninspPct : 0} label="pending" color="#f59e0b" size={90}/>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-100">
                  {[
                    {label:"Confirmed",value:inspectionRate.confirmed,color:"text-red-600",bg:"bg-red-50"},
                    {label:"False Alarm",value:inspectionRate.falseAlarm,color:"text-gray-500",bg:"bg-gray-100"},
                    {label:"Uninspected",value:inspectionRate.uninspected,color:"text-amber-600",bg:"bg-amber-50"},
                  ].map((r)=>(
                    <div key={r.label} className={`${r.bg} rounded-xl p-3 text-center`}>
                      <p className={`text-xl font-bold ${r.color}`}>{r.value}</p>
                      <p className="text-[10px] text-gray-400 font-medium mt-0.5">{r.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ══ ALARM TABLE ══ */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-b border-gray-100">
            <div>
              <h2 className="text-sm font-bold text-gray-800">Recent Alarms</h2>
              <p className="text-xs text-gray-400 mt-0.5">Last 20 alarm events</p>
            </div>
            <div className="flex items-center gap-1.5">
              {["All","Uninspected","Confirmed","False Alarm"].map((f)=>(
                <button key={f} onClick={()=>setFilterStatus(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${filterStatus===f?"bg-indigo-600 text-white shadow-sm":"bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {["Alarm ID","Zone","Machine","Type","Confidence","Status","Time"].map((h)=>(
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loadingAlarms?Array.from({length:8}).map((_,i)=>(
                  <tr key={i} className="animate-pulse">{Array.from({length:7}).map((_,j)=><td key={j} className="px-5 py-4"><div className="h-3 bg-gray-100 rounded w-20"/></td>)}</tr>
                )):filteredAlarms.length===0?(
                  <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-gray-400">No alarms match this filter.</td></tr>
                ):filteredAlarms.map((alarm)=>(
                  <tr key={alarm.id} className="hover:bg-gray-50 transition-colors duration-100">
                    <td className="px-5 py-3.5"><span className="font-mono text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">{alarm.id}</span></td>
                    <td className="px-5 py-3.5 text-gray-600 font-medium text-xs">{alarm.zone}</td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs">{alarm.machine}</td>
                    <td className="px-5 py-3.5 text-gray-700 text-xs">{alarm.type}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full w-16 overflow-hidden">
                          <div className={`h-full rounded-full ${alarm.confidence>=85?"bg-red-400":alarm.confidence>=70?"bg-amber-400":"bg-gray-300"}`} style={{width:`${alarm.confidence}%`}}/>
                        </div>
                        <span className="text-xs text-gray-400">{alarm.confidence}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5"><StatusBadge status={alarm.status}/></td>
                    <td className="px-5 py-3.5">
                      <p className="text-xs text-gray-700">{formatTime(alarm.timestamp)}</p>
                      <p className="text-[10px] text-gray-400">{timeAgo(alarm.timestamp)}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loadingAlarms&&(
            <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-400">Showing {filteredAlarms.length} of {alarms.length} alarms</p>
              <span className="text-[10px] text-gray-300 font-medium uppercase tracking-widest">Last 20 events</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}