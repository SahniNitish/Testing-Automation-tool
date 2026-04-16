import {
  X,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Shield,
  Cpu,
  GitBranch,
  TestTube2,
  Eye,
  Box,
  Code2,
  ExternalLink,
  Loader2,
} from "lucide-react";

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

const FINDING_STYLES = {
  critical: { color: "text-red-300", badge: "bg-red-400/10 border-red-400/20 text-red-300" },
  high: { color: "text-rose-300", badge: "bg-rose-400/10 border-rose-400/20 text-rose-300" },
  medium: { color: "text-amber-300", badge: "bg-amber-400/10 border-amber-400/20 text-amber-300" },
  low: { color: "text-sky-300", badge: "bg-sky-400/10 border-sky-400/20 text-sky-300" },
};

export default function ReportDetail({
  report,
  onClose,
  onCreatePullRequest,
  isCreatingPullRequest,
}) {
  if (!report) return null;

  const overallStatusMap = {
    passed: { label: "ALL TESTS PASSED", color: "text-emerald-400" },
    warnings: { label: "WARNINGS DETECTED", color: "text-amber-400" },
    failed: { label: "ISSUES FOUND", color: "text-red-400" },
  };
  const overall = overallStatusMap[report.status] || { label: report.status?.toUpperCase(), color: "text-zinc-400" };
  const prDraft = report.pr_draft || {};
  const canCreatePr = Boolean(prDraft.can_create) && !prDraft.created;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8 px-4 overflow-y-auto">
      <div className="fixed inset-0 bg-black/80" onClick={onClose} />

      <div className="relative w-full max-w-6xl bg-[#0A0A0A] border border-white/10 rounded-sm animate-fade-in-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div>
            <h2
              className="text-xl font-bold tracking-tight text-white"
              style={{ fontFamily: "Chivo, sans-serif" }}
            >
              AI Code Engineer Report
            </h2>
            <div className="flex flex-wrap items-center gap-3 mt-1">
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

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-[1.5fr,1fr] gap-4">
            <div className="bg-[#121214] border border-white/[0.06] rounded-sm p-5">
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
                AI Engineer Summary
              </div>
              <p className="mt-3 text-sm leading-relaxed text-zinc-300">
                {report.engineer_summary || "The AI engineer summary will appear after the analysis finishes."}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="px-2 py-1 rounded-sm border border-white/10 bg-black/20 text-[11px] font-mono text-zinc-300">
                  {report.findings?.length || 0} findings
                </span>
                <span className="px-2 py-1 rounded-sm border border-white/10 bg-black/20 text-[11px] font-mono text-zinc-300">
                  {report.suggested_fixes?.length || 0} fix packs
                </span>
                <span className="px-2 py-1 rounded-sm border border-white/10 bg-black/20 text-[11px] font-mono text-zinc-300">
                  {report.custom_tests?.length || 0} custom tests
                </span>
              </div>
            </div>

            <div className="bg-[#121214] border border-white/[0.06] rounded-sm p-5">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
                  Draft Pull Request
                </div>
                <span
                  className={`text-[11px] font-medium px-2 py-1 rounded-sm border ${
                    prDraft.created
                      ? "text-emerald-300 border-emerald-400/20 bg-emerald-400/10"
                      : prDraft.can_create
                      ? "text-sky-300 border-sky-400/20 bg-sky-400/10"
                      : "text-zinc-400 border-white/10 bg-black/20"
                  }`}
                >
                  {prDraft.created ? "opened" : prDraft.can_create ? "ready" : "preview"}
                </span>
              </div>

              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-zinc-500">Branch</span>
                  <span className="text-zinc-300 font-mono text-right">{prDraft.branch_name || "pending"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-zinc-500">Base</span>
                  <span className="text-zinc-300 font-mono text-right">{prDraft.base_branch || report.branch}</span>
                </div>
              </div>

              <p className="mt-4 text-xs leading-relaxed text-zinc-400">
                {prDraft.created
                  ? "The AI-generated fixes have already been pushed into a draft pull request."
                  : prDraft.can_create
                  ? "This run generated concrete file updates and custom tests, so the app can open a draft PR."
                  : prDraft.preview_only_reason || "This report includes a review plan, but not a safe patch yet."}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {prDraft.created && prDraft.url ? (
                  <a
                    href={prDraft.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-sm bg-white text-black text-sm font-semibold hover:bg-zinc-200 transition-colors duration-150"
                  >
                    <ExternalLink className="w-4 h-4" strokeWidth={1.8} />
                    Open Draft PR
                  </a>
                ) : (
                  <button
                    onClick={() => onCreatePullRequest?.(report.id)}
                    disabled={!canCreatePr || isCreatingPullRequest}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-sm text-sm font-semibold transition-colors duration-150 ${
                      canCreatePr
                        ? "bg-white text-black hover:bg-zinc-200"
                        : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                    }`}
                  >
                    {isCreatingPullRequest ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.8} />
                        Creating draft PR...
                      </>
                    ) : (
                      <>
                        <GitBranch className="w-4 h-4" strokeWidth={1.8} />
                        {prDraft.can_create ? "Create Draft PR" : "Draft PR Unavailable"}
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500 mb-4">
              Test Results
            </h3>

            {report.results && report.results.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {report.results.map((result, index) => {
                  const TestIcon = TEST_ICONS[result.test_type] || TestTube2;
                  const statusStyle = STATUS_STYLES[result.status] || STATUS_STYLES.failed;
                  const StatusIcon = statusStyle.icon;

                  return (
                    <div
                      key={result.test_type}
                      data-testid={`test-result-${result.test_type}`}
                      className="bg-[#121214] border border-white/[0.06] rounded-sm p-4 animate-fade-in-up"
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      <div className="flex items-start justify-between mb-2 gap-3">
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
                        <pre
                          className="mt-2 p-3 rounded-sm text-[11px] text-zinc-400 font-mono whitespace-pre-wrap overflow-x-auto max-h-60 overflow-y-auto leading-relaxed"
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
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500 mb-4">
              Findings
            </h3>

            {report.findings?.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {report.findings.map((finding, index) => {
                  const style = FINDING_STYLES[finding.severity] || FINDING_STYLES.low;
                  return (
                    <div
                      key={`${finding.file_path}-${finding.title}`}
                      className="bg-[#121214] border border-white/[0.06] rounded-sm p-4 animate-fade-in-up"
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{finding.title}</p>
                          <p className="mt-1 text-[11px] font-mono text-zinc-500">{finding.file_path}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-sm border text-[11px] font-medium uppercase ${style.badge}`}>
                          {finding.severity}
                        </span>
                      </div>
                      <p className="mt-3 text-xs leading-relaxed text-zinc-300">
                        {finding.explanation}
                      </p>
                      <div className="mt-3 text-xs text-zinc-400">
                        <span className="text-zinc-500">Recommendation:</span> {finding.recommendation}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-[#121214] border border-white/[0.06] rounded-sm p-8 text-center">
                <p className="text-sm text-zinc-600 font-mono">
                  // no AI findings yet
                </p>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500 mb-4">
              Suggested Fix Packs
            </h3>

            {report.suggested_fixes?.length ? (
              <div className="space-y-3">
                {report.suggested_fixes.map((fix, index) => (
                  <div
                    key={`${fix.file_path}-${fix.title}`}
                    className="bg-[#121214] border border-white/[0.06] rounded-sm p-4 animate-fade-in-up"
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Code2 className="w-4 h-4 text-zinc-400" strokeWidth={1.6} />
                          <p className="text-sm font-semibold text-white">{fix.title}</p>
                        </div>
                        <p className="mt-1 text-[11px] font-mono text-zinc-500">{fix.file_path}</p>
                      </div>
                      <span className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                        {fix.language || "text"}
                      </span>
                    </div>

                    <p className="mt-3 text-sm text-zinc-300">
                      {fix.summary}
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                      {fix.explanation}
                    </p>

                    <div className="mt-4 space-y-2">
                      <details className="group">
                        <summary className="text-[11px] text-zinc-500 cursor-pointer hover:text-zinc-300 transition-colors duration-150">
                          View patch preview
                        </summary>
                        <pre
                          className="mt-2 p-3 rounded-sm text-[11px] text-zinc-300 font-mono whitespace-pre-wrap overflow-x-auto max-h-72 overflow-y-auto leading-relaxed"
                          style={{ background: "#050505" }}
                        >
                          {fix.patch}
                        </pre>
                      </details>

                      {fix.updated_code ? (
                        <details className="group">
                          <summary className="text-[11px] text-zinc-500 cursor-pointer hover:text-zinc-300 transition-colors duration-150">
                            View generated code
                          </summary>
                          <pre
                            className="mt-2 p-3 rounded-sm text-[11px] text-zinc-300 font-mono whitespace-pre-wrap overflow-x-auto max-h-80 overflow-y-auto leading-relaxed"
                            style={{ background: "#050505" }}
                          >
                            {fix.updated_code}
                          </pre>
                        </details>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-[#121214] border border-white/[0.06] rounded-sm p-8 text-center">
                <p className="text-sm text-zinc-600 font-mono">
                  // no fix packs generated yet
                </p>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500 mb-4">
              Custom Tests
            </h3>

            {report.custom_tests?.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {report.custom_tests.map((test, index) => (
                  <div
                    key={`${test.file_path}-${test.title}`}
                    className="bg-[#121214] border border-white/[0.06] rounded-sm p-4 animate-fade-in-up"
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{test.title}</p>
                        <p className="mt-1 text-[11px] font-mono text-zinc-500">{test.file_path}</p>
                      </div>
                      <span className="px-2 py-1 rounded-sm border border-white/10 bg-black/20 text-[11px] font-medium text-zinc-300">
                        {test.framework}
                      </span>
                    </div>

                    <p className="mt-3 text-xs leading-relaxed text-zinc-300">
                      {test.purpose}
                    </p>
                    <div className="mt-3 text-[11px] font-mono text-zinc-500">
                      Run: {test.command}
                    </div>

                    <details className="group mt-3">
                      <summary className="text-[11px] text-zinc-500 cursor-pointer hover:text-zinc-300 transition-colors duration-150">
                        View generated test file
                      </summary>
                      <pre
                        className="mt-2 p-3 rounded-sm text-[11px] text-zinc-300 font-mono whitespace-pre-wrap overflow-x-auto max-h-72 overflow-y-auto leading-relaxed"
                        style={{ background: "#050505" }}
                      >
                        {test.code}
                      </pre>
                    </details>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-[#121214] border border-white/[0.06] rounded-sm p-8 text-center">
                <p className="text-sm text-zinc-600 font-mono">
                  // no custom tests generated yet
                </p>
              </div>
            )}
          </div>

          {report.pr_comment ? (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500 mb-4">
                PR Comment Preview
              </h3>
              <div className="bg-[#121214] border border-white/[0.06] rounded-sm p-4 overflow-x-auto">
                <pre className="text-xs text-zinc-400 font-mono whitespace-pre-wrap leading-relaxed">
                  {report.pr_comment}
                </pre>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
