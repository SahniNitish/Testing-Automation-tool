import { Activity, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

const metrics = [
  { key: "total_runs", label: "Total Runs", icon: Activity, color: "#007AFF" },
  { key: "passed", label: "Passed", icon: CheckCircle2, color: "#10B981" },
  { key: "failed", label: "Issues Found", icon: XCircle, color: "#EF4444" },
  { key: "warnings", label: "Warnings", icon: AlertTriangle, color: "#F59E0B" },
];

export default function StatsBar({ stats, isRunning }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {metrics.map((m, i) => {
        const Icon = m.icon;
        const value = stats[m.key] || 0;
        return (
          <div
            key={m.key}
            data-testid={`stats-${m.key}`}
            className="bg-[#121214] border border-white/[0.06] rounded-sm p-4 animate-fade-in-up"
            style={{ animationDelay: `${i * 0.05}s` }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                {m.label}
              </span>
              <Icon
                className="w-4 h-4"
                style={{ color: m.color }}
                strokeWidth={1.5}
              />
            </div>
            <div className="flex items-end gap-2">
              <span
                className="text-2xl font-black tracking-tight"
                style={{ fontFamily: "Chivo, sans-serif", color: m.color }}
              >
                {value}
              </span>
              {m.key === "total_runs" && isRunning && (
                <span className="flex items-center gap-1 text-[10px] text-zinc-500 pb-1">
                  <span
                    className="w-1.5 h-1.5 rounded-full animate-pulse-dot"
                    style={{ backgroundColor: m.color }}
                  />
                  running
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
