import { X, CheckCircle2, AlertTriangle, XCircle, Shield, Cpu, GitBranch, TestTube2, Eye, Box } from "lucide-react";

const TEST_ICONS = {
  unit_tests: TestTube2,
  black_box: Box,
  edge_cases: AlertTriangle,
  security: Shield,
  white_box: Eye,
  performance: Cpu,
};

const STATUS_STYLES = {
  passed: { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20" },
  warning: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-400/20" },
  failed: { icon: XCircle, color: "text-red-400", bg: "bg-red-400/10", border: "border-red-400/20" },
};

export default function ReportDetail({ report, onClose }) {
  if (!report) return null;

  const overallStatusMap = {
    passed: { label: "ALL TESTS PASSED", color: "text-emerald-400" },
    warnings: { label: "WARNINGS DETECTED", color: "text-amber-400" },
    failed: { label: "ISSUES FOUND", color: "text-red-400" },
  };
  const overall = overallStatusMap[report.status] || { label: report.status?.toUpperCase(), color: "text-zinc-400" };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8 px-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-4xl bg-[#0A0A0A] border border-white/10 rounded-sm animate-fade-in-up"
        style={{ animationDelay: "0s" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div>
            <h2
              className="text-xl font-bold tracking-tight text-white"
              style={{ fontFamily: "Chivo, sans-serif" }}
            >
              Test Report
            </h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-zinc-500">{report.repo_full_name}</span>
              <span className="text-xs text-zinc-600">|</span>
              <span className="text-xs text-zinc-500 font-mono flex items-center gap-1">
                <GitBranch className="w-3 h-3" strokeWidth={1.5} />
                {report.branch}
              </span>
              <span className="text-xs text-zinc-600">|</span>
              <span className="text-xs text-zinc-500 font-mono">
                {(report.commit_sha || "").slice(0, 7)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className={`text-xs font-bold tracking-wide ${overall.color}`}>
              {overall.label}
            </span>
            <button
              data-testid="close-report-button"
              onClick={onClose}
              className="p-1.5 rounded-sm hover:bg-white/5 transition-colors duration-150"
            >
              <X className="w-4 h-4 text-zinc-400" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Test Results Grid */}
        <div className="p-6">
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500 mb-4">
            Test Results
          </h3>

          {report.results && report.results.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {report.results.map((result, i) => {
                const TestIcon = TEST_ICONS[result.test_type] || TestTube2;
                const statusStyle = STATUS_STYLES[result.status] || STATUS_STYLES.failed;
                const StatusIcon = statusStyle.icon;

                return (
                  <div
                    key={result.test_type}
                    data-testid={`test-result-${result.test_type}`}
                    className="bg-[#121214] border border-white/[0.06] rounded-sm p-4 animate-fade-in-up"
                    style={{ animationDelay: `${i * 0.05}s` }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <TestIcon className="w-4 h-4 text-zinc-400" strokeWidth={1.5} />
                        <span className="text-sm font-medium text-zinc-200">
                          {result.test_name || result.test_type}
                        </span>
                      </div>
                      <div className={`flex items-center gap-1 px-2 py-0.5 rounded-sm border ${statusStyle.bg} ${statusStyle.border}`}>
                        <StatusIcon className={`w-3 h-3 ${statusStyle.color}`} strokeWidth={2} />
                        <span className={`text-[11px] font-medium ${statusStyle.color}`}>
                          {result.status}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-zinc-400 mb-3 line-clamp-2">
                      {result.summary}
                    </p>
                    <details className="group">
                      <summary className="text-[11px] text-zinc-500 cursor-pointer hover:text-zinc-300 transition-colors duration-150">
                        View full analysis
                      </summary>
                      <pre className="mt-2 p-3 rounded-sm text-[11px] text-zinc-400 font-mono whitespace-pre-wrap overflow-x-auto max-h-60 overflow-y-auto leading-relaxed"
                        style={{ background: "#050505" }}
                      >
                        {result.details}
                      </pre>
                    </details>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-[#121214] border border-white/[0.06] rounded-sm p-8 text-center">
              <p className="text-sm text-zinc-600 font-mono">
                // results pending...
              </p>
            </div>
          )}

          {/* PR Comment Preview */}
          {report.pr_comment && (
            <div className="mt-6">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500 mb-4">
                PR Comment Preview
              </h3>
              <div className="bg-[#121214] border border-white/[0.06] rounded-sm p-4 overflow-x-auto">
                <pre className="text-xs text-zinc-400 font-mono whitespace-pre-wrap leading-relaxed">
                  {report.pr_comment}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
