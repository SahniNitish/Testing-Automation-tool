import { Activity, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

const metrics = [
  { key: "total_runs", label: "Total Runs", icon: Activity, color: "#007AFF" },
  { key: "passed", label: "Passed", icon: CheckCircle2, color: "#10B981" },
  { key: "failed", label: "Issues Found", icon: XCircle, color: "#EF4444" },
  { key: "warnings", label: "Warnings", icon: AlertTriangle, color: "#F59E0B" },
];

export default function StatsBar({ stats, isRunning }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[24px] border border-[color:var(--border)] bg-[color:var(--border)] md:grid-cols-4">
      {metrics.map((m, i) => {
        const Icon = m.icon;
        const value = stats[m.key] || 0;
        return (
          <div
            key={m.key}
            data-testid={`stats-${m.key}`}
            className="animate-fade-in-up bg-[linear-gradient(180deg,rgba(13,17,23,0.96),rgba(10,14,20,0.96))] p-5"
            style={{ animationDelay: `${i * 0.05}s` }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
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
                style={{ fontFamily: "Syne, sans-serif", color: m.color }}
              >
                {value}
              </span>
              {m.key === "total_runs" && isRunning && (
                <span className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] pb-1">
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
