import { formatDistanceToNow } from "date-fns";
import { ExternalLink } from "lucide-react";

const STATUS_MAP = {
  passed: { dot: "bg-emerald-400", text: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20", label: "Passed" },
  warnings: { dot: "bg-amber-400", text: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-400/20", label: "Warnings" },
  failed: { dot: "bg-red-400", text: "text-red-400", bg: "bg-red-400/10", border: "border-red-400/20", label: "Failed" },
  running: { dot: "bg-blue-400 animate-pulse-dot", text: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400/20", label: "Running" },
  queued: { dot: "bg-zinc-400 animate-pulse-dot", text: "text-zinc-400", bg: "bg-zinc-400/10", border: "border-zinc-400/20", label: "Queued" },
};

export default function RunHistory({ reports, onViewReport }) {
  if (!reports || reports.length === 0) {
    return (
      <div>
        <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
          Run History
        </h3>
        <div className="surface-card rounded-[24px] p-8 text-center">
          <p className="text-sm text-[var(--text-subtle)] font-mono">
            // no runs yet — select a repo and run analysis
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
          Run History
        </h3>
        <span className="text-[11px] text-[var(--text-subtle)] font-mono">
          {reports.length} runs
        </span>
      </div>

      <div className="overflow-hidden rounded-[24px] border border-[color:var(--border)] bg-[linear-gradient(180deg,rgba(13,17,23,0.96),rgba(10,14,20,0.96))]">
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="run-history-table">
            <thead>
              <tr className="border-b border-[color:var(--border)]">
                <th className="text-left text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--text-subtle)] px-4 py-3">
                  Status
                </th>
                <th className="text-left text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--text-subtle)] px-4 py-3">
                  Repository
                </th>
                <th className="text-left text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--text-subtle)] px-4 py-3 hidden sm:table-cell">
                  Branch
                </th>
                <th className="text-left text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--text-subtle)] px-4 py-3 hidden md:table-cell">
                  Commit
                </th>
                <th className="text-left text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--text-subtle)] px-4 py-3">
                  Time
                </th>
                <th className="text-right text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--text-subtle)] px-4 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => {
                const s = STATUS_MAP[report.status] || STATUS_MAP.queued;
                let timeAgo = "";
                try {
                  timeAgo = formatDistanceToNow(new Date(report.timestamp), { addSuffix: true });
                } catch {
                  timeAgo = "just now";
                }

                return (
                  <tr
                    key={report.id}
                    data-testid={`run-row-${report.id}`}
                    className="cursor-pointer border-b border-[color:rgba(28,38,54,0.5)] last:border-0 transition-colors duration-150 hover:bg-[rgba(18,24,32,0.72)]"
                    onClick={() => onViewReport(report.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-sm border ${s.text} ${s.bg} ${s.border}`}
                        >
                          {s.label}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm text-[var(--text)]">
                            {report.repo_name}
                          </span>
                          <span className="rounded-full border border-[color:var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10px] font-mono uppercase text-[var(--text-muted)]">
                            {report.analysis_mode || "classic"}
                          </span>
                        </div>
                        {report.pr_draft?.created ? (
                          <span className="text-[10px] font-medium text-[var(--success)]">
                            draft PR opened
                          </span>
                        ) : report.pr_draft?.can_create ? (
                          <span className="text-[10px] font-medium text-[var(--accent)]">
                            PR-ready fix pack
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-xs text-[var(--text-muted)] font-mono">
                        {report.branch}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-[var(--text-muted)] font-mono">
                        {(report.commit_sha || "").slice(0, 7)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-[var(--text-muted)] font-mono">
                        {timeAgo}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        data-testid={`view-report-${report.id}`}
                        className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] transition-colors duration-150 hover:text-[var(--text)]"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewReport(report.id);
                        }}
                      >
                        <ExternalLink className="w-3 h-3" strokeWidth={1.5} />
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
