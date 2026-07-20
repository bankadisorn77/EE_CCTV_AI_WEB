import { cn } from "../../lib/utils";

export function Badge({ count }) {
  if (!count) return null;
  return (
    <span className="ml-auto flex-shrink-0 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none animate-pulse">
      {count > 99 ? "99+" : count}
    </span>
  );
}

// ── Status variant maps ───────────────────────────────────────────────────────
//
// One flat string per status instead of { bg, text, dot } objects.
// cn() joins base classes + variant string in one call — no more ${s.bg} ${s.text}

const badgeVariants = {
  "Uninspected": "bg-amber-50 text-amber-700",
  "Confirmed":   "bg-red-50 text-red-700",
  "False Alarm": "bg-gray-100 text-gray-500",
  active:        "bg-emerald-50 text-emerald-700",
  inactive:      "bg-gray-100 text-gray-500",
  error:         "bg-red-50 text-red-600",
};

const dotVariants = {
  "Uninspected": "bg-amber-400",
  "Confirmed":   "bg-red-500",
  "False Alarm": "bg-gray-400",
  active:        "bg-emerald-400",
  inactive:      "bg-gray-400",
  error:         "bg-red-500 animate-pulse",
};

// ── Status components ─────────────────────────────────────────────────────────

export function StatusDot({ status }) {
  return (
    <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", dotVariants[status] ?? "bg-gray-300")} />
  );
}

export function StatusBadge({ status }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold", badgeVariants[status] ?? badgeVariants["Uninspected"])}>
      <span className={cn("w-1.5 h-1.5 rounded-full", dotVariants[status] ?? dotVariants["Uninspected"])} />
      {status}
    </span>
  );
}

export function StatusPill({ status }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold", badgeVariants[status] ?? badgeVariants.inactive)}>
      <span className={cn("w-2 h-2 rounded-full", dotVariants[status] ?? dotVariants.inactive)} />
      {status}
    </span>
  );
}