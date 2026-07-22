import { useState, useEffect, useRef, useCallback, memo } from "react";
import { StatusPill } from "../../components/ui/StatusBadge";
import { cn } from "../../lib/utils";
import { updateSettings } from '../../services/apiSetting'
import { decodeToken } from "../../services/apiAuth";


// ── Mock APIs ─────────────────────────────────────────────────────────────────

async function saveDevice(mcId, payload) {
  // console.log("saveDevice", mcId, payload);
  const res = await updateSettings(mcId, payload); // This was calling the wrong endpoint/payload
  //setOriginal(payload);
  return {
    id: mcId,
    ...payload,
  };

}

async function captureImage(mcId, cam) {
  await new Promise((r) => setTimeout(r, 1200));
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5050/api";
  return { imageUrl: `${apiUrl}/monitor/uploads/device_${mcId}_${cam.name}.jpg?t=${Date.now()}` };
}

// ── Variant maps ──────────────────────────────────────────────────────────────

const saveButtonVariants = {
  saved:    "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200",
  dirty:    "bg-slate-800 text-white hover:bg-slate-700 shadow-sm active:scale-95",
  disabled: "bg-gray-100 text-gray-400 cursor-not-allowed",
};

const thresholdVariants = {
  high:   "bg-red-50 text-red-600",
  medium: "bg-amber-50 text-amber-600",
  low:    "bg-gray-100 text-gray-500",
};

const camTabVariants = {
  active:   "bg-white text-gray-800 shadow-sm",
  inactive: "text-gray-400 hover:text-gray-600",
};

function getThresholdLevel(v) {
  if (v >= 85) return "high";
  if (v >= 65) return "medium";
  return "low";
}

function getSaveState(saved, dirty) {
  if (saved)  return "saved";
  if (dirty)  return "dirty";
  return "disabled";
}

// ── Shared UI pieces ──────────────────────────────────────────────────────────

function Section({ title, icon, badge, children }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-6 py-4 border-b border-gray-100">
        <span className="text-slate-400">{icon}</span>
        <h3 className="text-sm font-bold text-gray-800">{title}</h3>
        {badge}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-gray-400">{hint}</p>}
    </div>
  );
}

function Input({ value, onChange, placeholder, disabled, type = "text", ...props }) {
  return (
    <input
      type={type}
      value={value ?? ""}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-gray-50 disabled:text-gray-400 transition-all"
      {...props}
    />
  );
  }

const DeviceStatusCards = memo(function DeviceStatusCards({ status }) {
  const items = [
    { label: "CPU Temp", value: status.cpuTemp != null ? `${status.cpuTemp}°C` : "—", icon: "🔲" },
    { label: "GPU Temp", value: status.gpuTemp != null ? `${status.gpuTemp}°C` : "—", icon: "🤖" },
    { label: "Mem Free", value: status.memoryFree != null ? `${status.memoryFree} MB` : "—", icon: "💾" },
    { label: "Mem Used", value: status.memoryUsed != null ? `${status.memoryUsed} MB` : "—", icon: "🗃️"},
  ];

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map((s) => (
        <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <p className="text-base mb-1">{s.icon}</p>
          <p className="text-sm font-bold text-gray-700">{s.value}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{s.label}</p>
        </div>
      ))}
      </div>
      {status.lastSeen && (
        <p className="mt-3 text-xs text-gray-400 text-right">
          Last seen: <span className="font-semibold text-gray-600">{new Date(status.lastSeen).toLocaleString("en-GB")}</span>
        </p>
      )}
    </>
  );
});

const LiveDeviceStatus = ({ initialStatus, liveStatus }) => {
  const [status, setStatus] = useState(initialStatus);

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  useEffect(() => {
    if (liveStatus) setStatus(prev => ({ ...prev, ...liveStatus }));
  }, [liveStatus]);

  return <DeviceStatusCards status={status} />;
};
// ── Camera ROI panel ──────────────────────────────────────────────────────────

function CameraROIPanel({ mcId, cam, onCamChange }) {
  const canvasRef  = useRef(null);
  const imgRef     = useRef(null);
  const dragging   = useRef(null);
  const [imgLoaded,  setImgLoaded]  = useState(false);
  const [capturing,  setCapturing]  = useState(false);
  const [snapshot,   setSnapshot]   = useState(cam.snapshotUrl ?? null);
  const [crop,       setCrop]       = useState(cam.roi ?? { row1: 0, col1: 0, row2: 0, col2: 0 });

  async function handleCapture() {
    setCapturing(true);
    try {
      const res = await captureImage(mcId, cam);
      setSnapshot(res.imageUrl);
      setImgLoaded(false);
    } finally { setCapturing(false); }
  }

  function canvasToImg(cx, cy) {
    const canvas = canvasRef.current;
    const iw = imgRef.current?.naturalWidth  || canvas.width;
    const ih = imgRef.current?.naturalHeight || canvas.height;
    return { col: Math.round(cx * (iw / canvas.width)), row: Math.round(cy * (ih / canvas.height)) };
  }
  function imgToCanvas(col, row) {
    const canvas = canvasRef.current;
    const iw = imgRef.current?.naturalWidth  || canvas.width;
    const ih = imgRef.current?.naturalHeight || canvas.height;
    return { x: col * (canvas.width / iw), y: row * (canvas.height / ih) };
  }
  function getCanvasXY(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: Math.round((e.clientX - rect.left) * (canvasRef.current.width  / rect.width)),
      y: Math.round((e.clientY - rect.top)  * (canvasRef.current.height / rect.height)),
    };
  }

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    if (imgRef.current && imgLoaded) {
      ctx.drawImage(imgRef.current, 0, 0, W, H);
    } else {
      ctx.fillStyle = "#0f172a"; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
      for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
      ctx.fillStyle = "#475569"; ctx.font = "12px monospace"; ctx.textAlign = "center";
      ctx.fillText(snapshot ? "Loading snapshot…" : "No snapshot — click Capture Image", W/2, H/2 - 6);
      ctx.fillStyle = "#334155"; ctx.font = "10px monospace";
      ctx.fillText("Then drag to draw crop rectangle", W/2, H/2 + 12);
    }

    const { row1, col1, row2, col2 } = crop;
    if (col2 > col1 && row2 > row1) {
      const p1 = imgToCanvas(col1, row1);
      const p2 = imgToCanvas(col2, row2);
      const rw = p2.x - p1.x, rh = p2.y - p1.y;
      ctx.fillStyle = "rgba(0,0,0,0.40)";
      ctx.fillRect(0,0,W,p1.y); ctx.fillRect(0,p1.y,p1.x,rh);
      ctx.fillRect(p2.x,p1.y,W-p2.x,rh); ctx.fillRect(0,p2.y,W,H-p2.y);
      ctx.strokeStyle = "#6366f1"; ctx.lineWidth = 2; ctx.strokeRect(p1.x,p1.y,rw,rh);
      const hs = 8;
      [[p1.x,p1.y],[p2.x,p1.y],[p2.x,p2.y],[p1.x,p2.y]].forEach(([hx,hy]) => {
        ctx.fillStyle = "#6366f1"; ctx.fillRect(hx-hs/2,hy-hs/2,hs,hs);
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.strokeRect(hx-hs/2,hy-hs/2,hs,hs);
      });
      const label = `${col2-col1} × ${row2-row1} px`;
      ctx.font = "bold 11px monospace";
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = "rgba(99,102,241,0.9)";
      ctx.beginPath(); ctx.roundRect(p1.x+4,p1.y+4,tw+12,20,4); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.fillText(label, p1.x+10, p1.y+16);
    }
  }, [crop, imgLoaded, snapshot]);

  useEffect(() => { draw(); }, [draw]);

  function handleMouseDown(e) {
    const { x, y } = getCanvasXY(e);
    const { col, row } = canvasToImg(x, y);
    dragging.current = { startCol: col, startRow: row };
  }
  function handleMouseMove(e) {
    if (!dragging.current) return;
    const { x, y } = getCanvasXY(e);
    const { col, row } = canvasToImg(x, y);
    const { startCol, startRow } = dragging.current;
    setCrop({ col1: Math.min(startCol,col), row1: Math.min(startRow,row), col2: Math.max(startCol,col), row2: Math.max(startRow,row) });
  }
  function handleMouseUp() {
    if (!dragging.current) return;
    dragging.current = null;
    onCamChange({ ...cam, roi: crop });
  }
  function handleClear() {
    const cleared = { row1: null, col1: null, row2: null, col2: null };
    setCrop(cleared);
    onCamChange({ ...cam, roi: cleared });
  }

  const hasROI = crop.col2 > crop.col1 && crop.row2 > crop.row1;

  return (
    <div className="space-y-3">
      {/* Camera header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-slate-800 text-white text-[10px] font-bold flex items-center justify-center">
            {cam.name.replace("cam", "")}
          </span>
          <span className="text-sm font-bold text-gray-700 capitalize">{cam.name}</span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">crop</span>
          {hasROI && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
              {crop.col2 - crop.col1} × {crop.row2 - crop.row1}px
            </span>
          )}
        </div>
        <button
          onClick={handleCapture}
          disabled={capturing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-sm"
        >
          {capturing
            ? <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4}/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg>
            : <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>}
          {capturing ? "Capturing…" : "Capture Image"}
        </button>
      </div>

      {/* Canvas */}
      <div className="relative rounded-xl overflow-hidden border border-gray-200 cursor-crosshair select-none">
        {snapshot && <img ref={imgRef} src={snapshot} alt="" className="hidden" onLoad={() => setImgLoaded(true)} />}
        <canvas
          ref={canvasRef} width={960} height={540}
          onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}    onMouseLeave={handleMouseUp}
          className="w-full block"
        />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={handleClear}
          disabled={!hasROI}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ring-1 ring-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
          Clear ROI
        </button>
        <span className="ml-auto text-[10px] text-gray-400">Drag on image to set crop rectangle</span>
      </div>

      {/* Settings inputs */}
      <div className="pt-3 border-t border-gray-100 space-y-4">
        <div className="w-full sm:w-1/2">
          <Field label="Machine Count" hint="Number of machines monitored by this camera">
            <Input 
              type="text" 
              inputMode="numeric"
              value={cam.machineCount ?? 0} 
              onChange={(v) => {
                const digits = v.replace(/\D/g, "");
                onCamChange({ ...cam, machineCount: digits ? parseInt(digits, 10) : 0 });
              }} 
              placeholder="0" 
            />
          </Field>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {[{key:"row1",label:"Row Start"},{key:"col1",label:"Col Start"},{key:"row2",label:"Row End"},{key:"col2",label:"Col End"}].map(({ key, label }) => (
            <Field key={key} label={label}>
              <input
                type="number"
                value={crop[key] ?? 0}
                onChange={(e) => {
                  const u = { ...crop, [key]: Number(e.target.value) };
                  setCrop(u); onCamChange({ ...cam, roi: u });
                }}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </Field>
          ))}
        </div>
      </div>

      {/* JSON preview */}
      <details>
        <summary className="text-[10px] text-gray-400 cursor-pointer select-none hover:text-gray-600 w-fit">View raw config JSON</summary>
        <pre className="mt-1.5 p-3 bg-gray-900 text-emerald-400 text-[10px] rounded-xl overflow-x-auto leading-relaxed">
          {JSON.stringify({ name: cam.name, type: "crop", machineCount: cam.machineCount ?? 0, roi: crop, sourcePoint: null, destinationPoint: null, cropSize: null }, null, 2)}
        </pre>
      </details>
    </div>
  );
}

// ── Default cam configs ───────────────────────────────────────────────────────

const DEFAULT_ROIS = [
  { name: "cam1", machineCount: 0, roi: { row1:  null, col1: null,  row2: null, col2: null }},
  { name: "cam2", machineCount: 0, roi: { row1: null, col1: null,  row2: null, col2: null }},
  { name: "cam3", machineCount: 0, roi: { row1: null, col1: null,  row2: null, col2: null }},
  { name: "cam4", machineCount: 0, roi: { row1: null, col1: null,  row2: null, col2: null }},
];

function normalizeROIs(value) {
  const fallback = DEFAULT_ROIS.map((cam) => ({ ...cam, roi: { ...cam.roi } }));

  if (!value) return fallback;

  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;

    if (Array.isArray(parsed)) {
      return parsed.map((cam, index) => ({
        name: cam?.name ?? fallback[index]?.name ?? `cam${index + 1}`,
        machineCount: cam?.machineCount ?? 0,
        roi: cam?.roi ?? { row1: null, col1: null, row2: null, col2: null },
      }));
    }

    if (parsed && typeof parsed === "object") {
      return Object.entries(parsed).map(([name, cam]) => ({
        name,
        machineCount: cam?.machineCount ?? 0,
        roi: cam?.roi ?? { row1: null, col1: null, row2: null, col2: null },
      }));
    }
  } catch {
    // fall back to default ROI layout
  }

  return fallback;
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function DeviceSettingsPanel({ device, onSaved, liveStatus = null }) {
  const [form,      setForm]      = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [dirty,     setDirty]     = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [ROIs,      setROIs]      = useState(DEFAULT_ROIS);
  const [activeCam, setActiveCam] = useState(0);


  const ZONES        = ["Unassigned", "Zone A", "Zone B", "Zone C"];
  const isUnassigned = !device?.zone || device?.zone === "Unassigned";

  // Get user role from token
  const tokenData = decodeToken();
  const userRole = tokenData?.role?.toLowerCase();


  useEffect(() => {
    if (device) {
      setForm({ ...device }); setDirty(false); setSaved(false); setErrorMessage(null); setActiveCam(0);
      setROIs(normalizeROIs(device.roiData));
    }
  }, [device?.mcId]);

  function update(key, value) { setForm((p) => ({ ...p, [key]: value })); setDirty(true); setSaved(false); }
  function updateCam(i, updated) 
  {  
    setROIs((p) => p.map((c, idx) => idx === i ? updated : c)); 
    setDirty(true); 
    setSaved(false); 
  }

  async function handleSave() {
    if (!form?.mcId) return;
    setSaving(true);
    setSaved(false);

    try {
      const payload = {
        ...form,
        roiData: ROIs,
      };
      const updatedDevice = await saveDevice(form.mcId, payload);

      setForm(updatedDevice);
      setDirty(false);
      setSaved(true);
      setErrorMessage(null); // Clear any previous error on success
      onSaved?.(updatedDevice);
    } catch (error) {
      console.error("Failed to save device settings:", error);
      setErrorMessage(error.message || "An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  }

  if (!device || !form) return (
    <div className="flex-1 overflow-y-auto bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" className="w-8 h-8 text-gray-300">
            <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>
          </svg>
        </div>
        <p className="text-sm font-semibold text-gray-400">Select a device to configure</p>
        <p className="text-xs text-gray-300 mt-1">Choose from the sidebar on the left</p>
      </div>
    </div>
  );

  const confidentLevel  = form.confidentLevel ?? 0.7;
  const saveState  = getSaveState(saved, dirty);
  const headerStatus = liveStatus?.runningStatus ?? form.runningStatus;

  const SaveIcon = saving
    ? <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4}/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg>
    : saved
    ? <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
    : <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>;

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 min-h-0">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{form.deviceName}</h1>
              <StatusPill status={headerStatus} />
              {isUnassigned && <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-700">UNASSIGNED</span>}
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-500">{form.mcId}</span>
              <span>{form.ip}</span>
              <span>{form.plant}</span>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className={cn("flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200", saveButtonVariants[saveState])}
          >
            {SaveIcon}
            {saving ? "Saving…" : saved ? "Saved!" : "Save Changes"}
          </button>
        </div>

        {dirty && (
          <div className="flex items-center gap-2.5 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 font-medium">
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            You have unsaved changes
          </div>
        )}

        {errorMessage && (
          <div className="flex items-center gap-2.5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {errorMessage}
          </div>
        )}


        {/* 1. Device Identity */}
        <Section title="Device Identity" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="w-4 h-4"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field label="Device Name" hint={userRole === 'user' ? "Locked for user role" : ""}>
              <Input value={form.deviceName} onChange={(v) => update("deviceName", v)} placeholder="e.g. Camera North Gate" disabled={userRole === 'user'} />
            </Field>
            <Field label="Plant" hint={userRole === 'user' ? "Locked for user role" : (isUnassigned ? "Editable while device is Unassigned" : "Locked — assign back to Unassigned to change")}>
              <Input value={form.plant} onChange={isUnassigned && userRole !== 'user' ? (v) => update("plant", v) : undefined} disabled={!isUnassigned || userRole === 'user'} placeholder="e.g. Plant A" />
            </Field>
            <Field label="IP Address" hint="Read-only — reported by device">
              <Input value={form.ip} disabled placeholder="192.168.1.xxx" />
            </Field>
            <Field label="MAC Address" hint="Read-only — assigned by hardware">
              <Input value={form.mac} disabled placeholder="—" />
            </Field>
          </div>
          {!isUnassigned && (
            <div className="mt-5 flex items-center gap-2 px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-600 font-medium">
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              Plant is locked once assigned to a zone. Change Zone back to Unassigned to edit it.
            </div>
          )}
        </Section>

        {/* 2. Zone Assignment */}
        <Section title="Zone Assignment" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="w-4 h-4"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5"> 
            <Field label="Zone" hint={userRole === 'user' ? "Locked for user role" : "Select an existing zone or type a new one"}>
              <input
                list="zone-list"
                value={form.zone ?? ""}
                onChange={(e) => update("zone", e.target.value)}
                placeholder="Select or type zone..."
                disabled={userRole === 'user'}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white"
              />
              <datalist id="zone-list">
                {ZONES.map((z) => (
                  <option key={z} value={z} />
                ))}
              </datalist>
            </Field>
            <Field label="AI Version" hint="Read-only">
              <Input value={form.aiVersion} disabled placeholder="—" />
            </Field>
          </div>
        </Section>

        {/* 3. Device Control */}
        <Section title="Device Control" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="w-4 h-4"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-gray-50 gap-4">
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-700">Active Device</p>
                <p className="text-xs text-gray-400 mt-0.5">Enable or disable alarm sending</p>
              </div>
              <button
                onClick={() => update("activeDevice", !form.activeDevice)}
                role="switch"
                aria-checked={form.activeDevice}
                className={cn("relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-emerald-400", form.activeDevice ? "bg-emerald-500" : "bg-gray-300")}
              >
                <span className={cn("absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200", form.activeDevice ? "translate-x-5" : "translate-x-0")} />
              </button>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-gray-50">
              <div>
                <p className="text-sm font-bold text-gray-700">Running Status</p>
                <p className="text-xs text-gray-400 mt-0.5">Reported by device (read-only)</p>
              </div>
              <StatusPill status={headerStatus} />
            </div>
          </div>
          <div className="mt-5">
            <LiveDeviceStatus
              initialStatus={{
                cpuTemp: form.cpuTemp,
                gpuTemp: form.gpuTemp,
                memoryFree: form.memoryFree,
                memoryUsed: form.memoryUsed,
                lastSeen: form.lastSeen,
              }}
              liveStatus={liveStatus} />
          </div>
        </Section>

        {/* 4. Alert Sensitivity */}
        <Section title="Alert Sensitivity" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="w-4 h-4"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>}>
          <Field label="Confidence Threshold" hint={`Alarms below ${confidentLevel*100}% confidence will be suppressed`}>
            <div className="flex items-center gap-4">
              <input
                type="range" min={0} max={100} step={5} value={confidentLevel*100}
                onChange={(e) => update("confidentLevel", Number(e.target.value/100.0))}
                className="flex-1 h-2 rounded-full accent-slate-700 cursor-pointer"
              />
              <span className={cn("w-14 text-center text-sm font-bold rounded-lg px-2 py-1", thresholdVariants[getThresholdLevel(confidentLevel*100)])}>
                {confidentLevel*100}%
              </span>
            </div>
            <div className="flex justify-between text-[10px] text-gray-300 px-0.5">
              <span>Low sensitivity</span><span>High sensitivity</span>
            </div>
          </Field>
        </Section>

        {/* 5. Camera ROI */}
        <Section
          title="Camera ROI Configuration"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="w-4 h-4"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>}
          badge={<span className="ml-auto text-[10px] text-gray-400 font-semibold">4 cameras</span>}
        >

          <p className="text-xs text-gray-400 mb-5">
            Capture a snapshot then draw the detection region. Drag to set crop rectangle.
          </p>
          <div className="flex gap-1.5 mb-6 p-1 bg-gray-100 rounded-xl">
            {ROIs.map((cam, i) => (
              <button
                key={cam.name}
                onClick={() => setActiveCam(i)}
                className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all", camTabVariants[activeCam === i ? "active" : "inactive"])}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                {cam.name.toUpperCase()}
              </button>
            ))}
          </div>
          <CameraROIPanel
            key={`${device?.mcId}-cam${activeCam}`}
            // ip={form.ip}
            mcId={form.mcId}
            cam={ROIs[activeCam]}
            onCamChange={(updated) => updateCam(activeCam, updated)}
          />
        </Section>

      </div>
    </div>
  );
}