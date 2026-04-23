import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Box,
  CheckCircle2,
  Code2,
  Cpu,
  ExternalLink,
  Eye,
  GitBranch,
  Shield,
  TestTube2,
  X,
  XCircle,
} from "lucide-react";
import AIChatPanel from "@/components/AIChatPanel";
import MosaicReportPanel from "@/components/MosaicReportPanel";

const SPINNER_FRAMES = ["[ / ]", "[ — ]", "[ \\ ]", "[ | ]"];

function useAsciiSpinner(active) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setFrame((f) => (f + 1) % SPINNER_FRAMES.length), 150);
    return () => clearInterval(id);
  }, [active]);
  return SPINNER_FRAMES[frame];
}

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

const VERIFIER_STYLES = {
  confirmed: "text-emerald-300 border-emerald-400/20 bg-emerald-400/10",
  plausible: "text-indigo-300 border-indigo-400/20 bg-indigo-400/10",
  unverified: "text-[var(--text-secondary)] border-[color:var(--border)] bg-[var(--surface)]",
  rejected: "text-red-300 border-red-400/20 bg-red-400/10",
};

const ACTION_STYLES = {
  safe: "text-emerald-300 border-emerald-400/20 bg-emerald-400/10",
  tests: "text-amber-300 border-amber-400/20 bg-amber-400/10",
  review: "text-[var(--text-secondary)] border-[color:var(--border)] bg-[var(--surface)]",
};

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "evidence", label: "Evidence" },
  { id: "fixes", label: "Fixes & Tests" },
  { id: "chat", label: "Chat" },
];

const SEVERITY_RANK = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function prettyLabel(value) {
  return (value || "n/a").replace(/_/g, " ");
}

function sortFindings(a, b) {
  return (
    (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0) ||
    (b.confidence || 0) - (a.confidence || 0)
  );
}

function getOverviewFindings(report, isMosaic) {
  if (isMosaic && report.consensus_findings?.length) {
    return [...report.consensus_findings].sort(sortFindings);
  }
  return [...(report.findings || [])].sort(sortFindings);
}

function buildActionState(report, isMosaic) {
  const prDraft = report.pr_draft || {};
  const testsGenerated = report.custom_tests?.length || 0;
  const testEligible = isMosaic
    ? (report.consensus_findings || []).some((finding) => finding.eligible_for_tests)
    : testsGenerated > 0;

  if (prDraft.created || prDraft.can_create) {
    return {
      label: "Safe to draft PR",
      tone: "safe",
      description: prDraft.created
        ? "This run already opened a draft pull request."
        : "This run produced a verified patch and can open a draft pull request.",
    };
  }

  if (testsGenerated > 0 || testEligible) {
    return {
      label: "Tests only",
      tone: "tests",
      description:
        prDraft.preview_only_reason || "This run was strong enough to generate tests, but not strong enough for an automatic PR.",
    };
  }

  return {
    label: "Needs review",
    tone: "review",
    description:
      prDraft.preview_only_reason || "The run produced review guidance, but not a safe patch for automatic PR creation.",
  };
}

function extractImportantLine(text) {
  const lines = (text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const highlighted =
    lines.find((line) => /(fail|bug|error|critical|warning|exception|vulnerab|rejected)/i.test(line)) ||
    lines[0] ||
    "";
  return highlighted.length > 220 ? `${highlighted.slice(0, 217)}...` : highlighted;
}

function buildPrimaryIssue(report, topFinding) {
  const priorityResult =
    (report.results || []).find((result) => result.status === "failed") ||
    (report.results || []).find((result) => result.status === "warning") ||
    report.results?.[0] ||
    null;

  if (topFinding) {
    return {
      title: topFinding.title,
      summary: topFinding.explanation || report.engineer_summary,
      detail:
        topFinding.reproduction_hint ||
        topFinding.recommendation ||
        extractImportantLine(priorityResult?.details) ||
        "Review the file and the generated fix suggestion before making changes.",
      location: topFinding.file_path,
      source: "Top finding",
    };
  }

  if (priorityResult) {
    return {
      title: `${priorityResult.test_name} found a likely problem`,
      summary: priorityResult.summary || report.engineer_summary,
      detail: extractImportantLine(priorityResult.details) || "Open the detailed result to see the full explanation.",
      location: null,
      source: priorityResult.test_name,
    };
  }

  return {
    title: "No clear issue surfaced",
    summary: report.engineer_summary || "The analysis did not return a strong error signal.",
    detail: "You can still inspect the detailed findings and specialist checks below.",
    location: null,
    source: "Analysis summary",
  };
}

function buildPrExplanation(report) {
  const prDraft = report.pr_draft || {};

  if (prDraft.created) {
    return {
      title: "Draft PR already opened",
      detail: "This run already produced a branch and draft pull request.",
    };
  }

  if (prDraft.can_create) {
    return {
      title: "Draft PR is ready",
      detail: "The finding was strong enough and a concrete code patch is available, so the app can create a draft PR.",
    };
  }

  return {
    title: "Why PR is unavailable",
    detail:
      prDraft.preview_only_reason ||
      "The app found a problem, but it is not safe enough yet to open an automatic draft PR.",
  };
}

function buildAgentOverview(report, isMosaic) {
  if (isMosaic) {
    const specialistRuns = (report.agent_runs || []).filter(
      (run) => run.agent !== "critic_agent" && run.agent !== "consensus_orchestrator",
    );
    return {
      title: "Specialist agents used",
      summary: `Yes. MOSAIC used ${specialistRuns.length} specialist agents, then added a verifier and a consensus step.`,
      items: specialistRuns.map((run) => ({
        label: run.label,
        detail: run.focus,
      })),
    };
  }

  const reviewRuns = (report.results || []).map((result) => ({
    label: result.test_name || result.test_type,
    detail: "AI review lane",
  }));

  return {
    title: "Review lanes used",
    summary: "This run used AI review lanes, not the full MOSAIC multi-agent pipeline.",
    items: reviewRuns,
  };
}

function EmptyState({ message }) {
  return (
    <div className="surface-card p-8 text-center">
      <p className="font-mono text-sm text-[var(--text-subtle)]">{message}</p>
    </div>
  );
}

function SummaryTile({ label, value, detail }) {
  return (
    <div className="surface-card-soft p-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {label}
      </div>
      <div
        className="mt-3 text-2xl font-semibold text-[var(--text)]"
        style={{ fontFamily: "Syne, sans-serif" }}
      >
        {value}
      </div>
      <p className="mt-2 text-xs leading-6 text-[var(--text-muted)]">{detail}</p>
    </div>
  );
}

function ResultCard({ result, index }) {
  const TestIcon = TEST_ICONS[result.test_type] || TestTube2;
  const statusStyle = STATUS_STYLES[result.status] || STATUS_STYLES.failed;
  const StatusIcon = statusStyle.icon;

  return (
    <div
      key={result.test_type}
      data-testid={`test-result-${result.test_type}`}
      className="surface-card animate-fade-in-up p-4"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className="flex items-start justify-between mb-2 gap-3">
        <div className="flex items-center gap-2">
          <TestIcon className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.5} />
          <span className="text-sm font-medium text-[var(--text)]">
            {result.test_name || result.test_type}
          </span>
        </div>
        <div className={`flex items-center gap-1 rounded-full border px-2 py-0.5 ${statusStyle.bg} ${statusStyle.border}`}>
          <StatusIcon className={`w-3 h-3 ${statusStyle.color}`} strokeWidth={2} />
          <span className={`text-[11px] font-medium ${statusStyle.color}`}>
            {result.status}
          </span>
        </div>
      </div>
      <p className="mb-3 text-xs text-[var(--text-muted)] line-clamp-2">{result.summary}</p>
      <details className="group">
        <summary className="cursor-pointer text-[11px] text-[var(--text-muted)] transition-colors duration-150 hover:text-[var(--text)]">
          View full analysis
        </summary>
        <pre
          className="mt-2 max-h-60 overflow-x-auto overflow-y-auto rounded-[18px] border border-[color:var(--border)] bg-[#05070b] p-3 font-mono text-[11px] leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap"
        >
          {result.details}
        </pre>
      </details>
    </div>
  );
}

function FindingCard({ finding, compact = false }) {
  const style = FINDING_STYLES[finding.severity] || FINDING_STYLES.low;

  return (
    <div className="surface-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--text)]">{finding.title}</p>
          <p className="mt-1 text-[11px] font-mono text-[var(--text-muted)]">
            {finding.file_path}
            {finding.symbol ? ` :: ${finding.symbol}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <span className={`rounded-full border px-2 py-1 text-[11px] font-medium uppercase ${style.badge}`}>
            {finding.severity}
          </span>
          {finding.resolution ? (
            <span className="rounded-full border border-[color:var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] font-medium uppercase text-[var(--text-secondary)]">
              {finding.resolution}
            </span>
          ) : null}
          {typeof finding.confidence === "number" ? (
            <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-2 py-1 text-[11px] font-medium uppercase text-sky-300">
              {finding.confidence}%
            </span>
          ) : null}
        </div>
      </div>

      <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
        {finding.explanation || finding.claim || finding.summary || "No explanation was provided."}
      </p>

      {compact ? null : (
        <>
          {finding.recommendation ? (
            <div className="mt-3 text-xs text-[var(--text-muted)]">
              <span className="text-[var(--text-subtle)]">Recommendation:</span> {finding.recommendation}
            </div>
          ) : null}
          {finding.critic_verdict ? (
            <div className="mt-2 text-xs text-[var(--text-muted)]">
              <span className="text-[var(--text-subtle)]">Verifier:</span> {finding.critic_verdict}
            </div>
          ) : null}
          {finding.supporting_agents?.length ? (
            <div className="mt-2 text-xs text-[var(--text-muted)]">
              <span className="text-[var(--text-subtle)]">Supporting agents:</span> {finding.supporting_agents.join(", ")}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function DraftPullRequestPanel({ report, onCreatePullRequest, isCreatingPullRequest }) {
  const prDraft = report.pr_draft || {};
  const canCreatePr = Boolean(prDraft.can_create) && !prDraft.created;
  const spinner = useAsciiSpinner(isCreatingPullRequest);

  return (
    <div className="surface-card p-5">
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
          Draft Pull Request
        </div>
        <span
          className={`rounded-full border px-2 py-1 text-[11px] font-medium ${
            prDraft.created
              ? "text-emerald-300 border-emerald-400/20 bg-emerald-400/10"
              : prDraft.can_create
              ? "text-sky-300 border-sky-400/20 bg-sky-400/10"
              : "text-[var(--text-muted)] border-[color:var(--border)] bg-[var(--surface)]"
          }`}
        >
          {prDraft.created ? "opened" : prDraft.can_create ? "ready" : "preview"}
        </span>
      </div>

      <div className="mt-4 space-y-2 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[var(--text-muted)]">Branch</span>
          <span className="text-right font-mono text-[var(--text-secondary)]">{prDraft.branch_name || "pending"}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[var(--text-muted)]">Base</span>
          <span className="text-right font-mono text-[var(--text-secondary)]">{prDraft.base_branch || report.branch}</span>
        </div>
      </div>

      <p className="mt-4 text-sm leading-7 text-[var(--text-muted)]">
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
            className="inline-flex items-center gap-2 rounded-2xl bg-[var(--text)] px-4 py-2.5 text-sm font-semibold text-[var(--bg)] transition-colors duration-150 hover:opacity-90"
          >
            <ExternalLink className="w-4 h-4" strokeWidth={1.8} />
            Open Draft PR
          </a>
        ) : (
          <button
            data-testid="create-pr-button"
            onClick={() => onCreatePullRequest?.(report.id)}
            disabled={!canCreatePr || isCreatingPullRequest}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[var(--surface)] ${
              canCreatePr
                ? "border border-transparent bg-[var(--text)] text-[var(--bg)] hover:opacity-90"
                : "cursor-not-allowed border border-[color:var(--border)] bg-[var(--surface)] text-[var(--text-subtle)]"
            }`}
          >
            {isCreatingPullRequest ? (
              <>
                <span className="font-mono text-xs w-10 text-center">{spinner}</span>
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

      {prDraft.title || prDraft.body ? (
        <div className="mt-4 overflow-hidden rounded-[20px] border border-[color:var(--border)]">
          <div className="border-b border-[color:var(--border)] bg-[rgba(18,24,32,0.78)] px-3 py-2">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
              Draft PR Preview
            </div>
          </div>

          <div className="p-3 space-y-3">
            {prDraft.title ? (
              <div>
                <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  Title
                </div>
                <div className="break-words text-sm font-semibold text-[var(--text)]">
                  {prDraft.title}
                </div>
              </div>
            ) : null}

            {prDraft.body ? (
              <div>
                <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  Body
                </div>
                <pre
                  className="max-h-72 overflow-x-auto overflow-y-auto rounded-[18px] border border-[color:var(--border)] bg-[#05070b] p-3 font-mono text-[11px] leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap"
                >
                  {prDraft.body}
                </pre>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function ReportDetail({
  report,
  onClose,
  onCreatePullRequest,
  isCreatingPullRequest,
  onSendChat,
  isChatting,
}) {
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    setActiveTab("overview");
  }, [report?.id]);

  if (!report) return null;

  const overallStatusMap = {
    passed: { label: "NO MAJOR ISSUES FOUND", color: "text-emerald-400" },
    warnings: { label: "REVIEW WARNINGS FOUND", color: "text-amber-400" },
    failed: { label: "LIKELY ISSUES FOUND", color: "text-red-400" },
  };

  const overall = overallStatusMap[report.status] || { label: report.status?.toUpperCase(), color: "text-[var(--text-muted)]" };
  const isMosaic = report.analysis_mode === "mosaic";

  const overviewFindings = getOverviewFindings(report, isMosaic);
  const topFinding = overviewFindings[0] || null;
  const topThreeFindings = overviewFindings.slice(0, 3);
  const actionState = buildActionState(report, isMosaic);
  const consensusFindings = report.consensus_findings || [];
  const confirmedFindings = isMosaic
    ? consensusFindings.filter((finding) => finding.resolution === "confirmed").length
    : report.findings?.length || 0;
  const verifierConfirmed = isMosaic
    ? consensusFindings.filter((finding) => finding.critic_verdict === "confirmed").length
    : report.results?.filter((result) => result.status === "passed").length || 0;
  const prReadyCount = isMosaic
    ? consensusFindings.filter((finding) => finding.eligible_for_fix).length
    : report.pr_draft?.can_create
    ? 1
    : 0;
  const testsGenerated = report.custom_tests?.length || 0;
  const primaryIssue = buildPrimaryIssue(report, topFinding);
  const prExplanation = buildPrExplanation(report);
  const agentOverview = buildAgentOverview(report, isMosaic);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 pb-8 pt-8">
      <div className="fixed inset-0 bg-[rgba(4,6,10,0.84)] backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-6xl animate-fade-in-up overflow-hidden rounded-[28px] border border-[color:var(--border)] bg-[linear-gradient(180deg,rgba(10,14,20,0.98),rgba(7,9,16,0.98))] shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between border-b border-[color:var(--border)] px-6 py-5">
          <div>
            <h2
              className="text-2xl font-bold tracking-[-0.05em] text-[var(--text)]"
              style={{ fontFamily: "Syne, sans-serif" }}
            >
              AI Code Engineer Report
            </h2>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              <span className="text-xs text-[var(--text-muted)]">{report.repo_full_name}</span>
              <span className="text-xs text-[var(--text-subtle)]">|</span>
              <span className="flex items-center gap-1 text-xs font-mono text-[var(--text-muted)]">
                <GitBranch className="w-3 h-3" strokeWidth={1.5} />
                {report.branch}
              </span>
              <span className="text-xs text-[var(--text-subtle)]">|</span>
              <span className="text-xs font-mono text-[var(--text-muted)]">
                {(report.commit_sha || "").slice(0, 7)}
              </span>
              <span className="text-xs text-[var(--text-subtle)]">|</span>
              <span className="rounded-full border border-[color:var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[10px] font-mono uppercase text-[var(--text-secondary)]">
                {report.analysis_mode || "classic"}
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
              className="rounded-full border border-[color:var(--border)] p-2 transition-colors duration-150 hover:bg-[var(--surface)]"
            >
              <X className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        <div className="border-b border-[color:var(--border)] px-6 pt-4">
          <div className="flex flex-wrap gap-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                data-testid={`report-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-t-2xl border px-4 py-2.5 text-sm font-medium transition-colors duration-150 ${
                  activeTab === tab.id
                    ? "border-b-transparent border-[color:var(--border)] bg-[rgba(18,24,32,0.92)] text-[var(--text)]"
                    : "border-transparent text-[var(--text-muted)] hover:bg-[rgba(18,24,32,0.52)] hover:text-[var(--text)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {activeTab === "overview" ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 xl:grid-cols-[1.35fr,1fr] gap-4">
                <div className="surface-card-soft p-6">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Main issue
                  </div>
                  <h3
                    className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[var(--text)]"
                    style={{ fontFamily: "Syne, sans-serif" }}
                  >
                    {topFinding?.title || "No major issue was surfaced in this run"}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
                    {topFinding?.explanation ||
                      report.engineer_summary ||
                      "The analysis completed without a clear top issue."}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className={`rounded-full border px-2.5 py-1.5 text-[11px] font-medium uppercase ${topFinding ? (FINDING_STYLES[topFinding.severity] || FINDING_STYLES.low).badge : "border-[color:var(--border)] bg-[var(--surface)] text-[var(--text-secondary)]"}`}>
                      severity {topFinding?.severity || "n/a"}
                    </span>
                    <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-2.5 py-1.5 text-[11px] font-medium uppercase text-sky-300">
                      confidence {typeof topFinding?.confidence === "number" ? `${topFinding.confidence}%` : "not scored"}
                    </span>
                    <span className={`rounded-full border px-2.5 py-1.5 text-[11px] font-medium uppercase ${VERIFIER_STYLES[topFinding?.critic_verdict] || "border-[color:var(--border)] bg-[var(--surface)] text-[var(--text-secondary)]"}`}>
                      verifier {prettyLabel(topFinding?.critic_verdict)}
                    </span>
                    <span className={`rounded-full border px-2.5 py-1.5 text-[11px] font-medium uppercase ${ACTION_STYLES[actionState.tone]}`}>
                      {actionState.label}
                    </span>
                  </div>

                  <p className="mt-4 text-sm leading-7 text-[var(--text-muted)]">
                    {actionState.description}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <SummaryTile
                    label={isMosaic ? "Confirmed issues" : "Issues found"}
                    value={confirmedFindings}
                    detail={isMosaic ? "Findings MOSAIC kept after consensus." : "Issues highlighted in this report."}
                  />
                  <SummaryTile
                    label={isMosaic ? "Verifier confirmed" : "Review lanes clear"}
                    value={verifierConfirmed}
                    detail={isMosaic ? "Findings the verifier backed." : "AI review lanes that returned a clean result."}
                  />
                  <SummaryTile
                    label="PR readiness"
                    value={report.pr_draft?.can_create || report.pr_draft?.created ? "Ready" : "Review"}
                    detail={
                      report.pr_draft?.created
                        ? "A draft pull request has already been opened."
                        : isMosaic && prReadyCount > 0
                        ? `${prReadyCount} finding(s) reached PR-ready confidence.`
                        : actionState.description
                    }
                  />
                  <SummaryTile
                    label="Tests generated"
                    value={testsGenerated}
                    detail="Custom regression tests created for this run."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr,0.95fr,1.1fr]">
                <div className="surface-card p-5">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Likely Error
                  </div>
                  <h4 className="mt-3 text-lg font-semibold text-[var(--text)]">{primaryIssue.title}</h4>
                  <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">{primaryIssue.summary}</p>
                  <div className="mt-4 rounded-[18px] border border-[color:var(--border)] bg-[#05070b] p-3">
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      What the app found
                    </div>
                    <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">{primaryIssue.detail}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-[11px] font-mono text-[var(--text-muted)]">
                    <span>Source: {primaryIssue.source}</span>
                    {primaryIssue.location ? <span>File: {primaryIssue.location}</span> : null}
                  </div>
                </div>

                <div className="surface-card p-5">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    PR Status
                  </div>
                  <h4 className="mt-3 text-lg font-semibold text-[var(--text)]">{prExplanation.title}</h4>
                  <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">{prExplanation.detail}</p>
                  <div className="mt-4 rounded-[18px] border border-[color:var(--border)] bg-[var(--surface)] p-3">
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      Simple rule
                    </div>
                    <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
                      A PR is only enabled when the issue is strong enough and the app has a safe concrete patch to apply.
                    </p>
                  </div>
                </div>

                <div className="surface-card p-5">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    {agentOverview.title}
                  </div>
                  <h4 className="mt-3 text-lg font-semibold text-[var(--text)]">{agentOverview.summary}</h4>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {agentOverview.items.map((item) => (
                      <span
                        key={`${item.label}-${item.detail}`}
                        className="rounded-full border border-[color:var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[11px] font-medium text-[var(--text-secondary)]"
                        title={item.detail}
                      >
                        {item.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="surface-card p-5">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Plain-English Summary
                </div>
                <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
                  {report.engineer_summary || "The report summary will appear here after the analysis finishes."}
                </p>
              </div>

              <div>
                <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  Top Findings
                </h3>

                {topThreeFindings.length ? (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    {topThreeFindings.map((finding) => (
                      <FindingCard key={`${finding.file_path}-${finding.title}`} finding={finding} compact />
                    ))}
                  </div>
                ) : (
                  <EmptyState message="// no priority findings to show" />
                )}
              </div>
            </div>
          ) : null}

          {activeTab === "evidence" ? (
            <div className="space-y-6">
              {isMosaic ? <MosaicReportPanel report={report} /> : null}

              <div>
                <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  Detailed Findings
                </h3>

                {report.findings?.length ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {report.findings.map((finding) => (
                      <FindingCard key={`${finding.file_path}-${finding.title}`} finding={finding} />
                    ))}
                  </div>
                ) : (
                  <EmptyState message="// no AI findings yet" />
                )}
              </div>

              <div>
                <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  Specialist Check Results
                </h3>

                {report.results?.length ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {report.results.map((result, index) => (
                      <ResultCard key={`${result.test_type}-${index}`} result={result} index={index} />
                    ))}
                  </div>
                ) : (
                  <EmptyState message="// results pending..." />
                )}
              </div>
            </div>
          ) : null}

          {activeTab === "fixes" ? (
            <div className="space-y-6">
              <DraftPullRequestPanel
                report={report}
                onCreatePullRequest={onCreatePullRequest}
                isCreatingPullRequest={isCreatingPullRequest}
              />

              <div>
                <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  Suggested Fix Packs
                </h3>

                {report.suggested_fixes?.length ? (
                  <div className="space-y-3">
                    {report.suggested_fixes.map((fix, index) => (
                      <div
                        key={`${fix.file_path}-${fix.title}`}
                        className="surface-card animate-fade-in-up p-4"
                        style={{ animationDelay: `${index * 0.05}s` }}
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Code2 className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.6} />
                              <p className="text-sm font-semibold text-[var(--text)]">{fix.title}</p>
                            </div>
                            <p className="mt-1 text-[11px] font-mono text-[var(--text-muted)]">{fix.file_path}</p>
                          </div>
                          <span className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                            {fix.language || "text"}
                          </span>
                        </div>

                        <p className="mt-3 text-sm text-[var(--text-secondary)]">{fix.summary}</p>
                        <p className="mt-2 text-xs leading-6 text-[var(--text-muted)]">{fix.explanation}</p>

                        <div className="mt-4 space-y-2">
                          <details className="group">
                            <summary className="cursor-pointer text-[11px] text-[var(--text-muted)] transition-colors duration-150 hover:text-[var(--text)]">
                              View patch preview
                            </summary>
                            <pre
                              className="mt-2 max-h-72 overflow-x-auto overflow-y-auto rounded-[18px] border border-[color:var(--border)] bg-[#05070b] p-3 font-mono text-[11px] leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap"
                            >
                              {fix.patch}
                            </pre>
                          </details>

                          {fix.updated_code ? (
                            <details className="group">
                              <summary className="cursor-pointer text-[11px] text-[var(--text-muted)] transition-colors duration-150 hover:text-[var(--text)]">
                                View generated code
                              </summary>
                              <pre
                                className="mt-2 max-h-80 overflow-x-auto overflow-y-auto rounded-[18px] border border-[color:var(--border)] bg-[#05070b] p-3 font-mono text-[11px] leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap"
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
                  <EmptyState message="// no fix packs generated yet" />
                )}
              </div>

              <div>
                <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  Custom Tests
                </h3>

                {report.custom_tests?.length ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {report.custom_tests.map((test, index) => (
                      <div
                        key={`${test.file_path}-${test.title}`}
                        className="surface-card animate-fade-in-up p-4"
                        style={{ animationDelay: `${index * 0.05}s` }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-[var(--text)]">{test.title}</p>
                            <p className="mt-1 text-[11px] font-mono text-[var(--text-muted)]">{test.file_path}</p>
                          </div>
                          <span className="rounded-full border border-[color:var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)]">
                            {test.framework}
                          </span>
                        </div>

                        <p className="mt-3 text-xs leading-6 text-[var(--text-secondary)]">{test.purpose}</p>
                        <div className="mt-3 text-[11px] font-mono text-[var(--text-muted)]">
                          Run: {test.command}
                        </div>

                        <details className="group mt-3">
                          <summary className="cursor-pointer text-[11px] text-[var(--text-muted)] transition-colors duration-150 hover:text-[var(--text)]">
                            View generated test file
                          </summary>
                          <pre
                            className="mt-2 max-h-72 overflow-x-auto overflow-y-auto rounded-[18px] border border-[color:var(--border)] bg-[#05070b] p-3 font-mono text-[11px] leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap"
                          >
                            {test.code}
                          </pre>
                        </details>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState message="// no custom tests generated yet" />
                )}
              </div>

              {report.pr_comment ? (
                <div>
                  <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                    PR Comment Preview
                  </h3>
                  <div className="surface-card overflow-x-auto p-4">
                    <pre className="font-mono text-xs leading-relaxed text-[var(--text-muted)] whitespace-pre-wrap">
                      {report.pr_comment}
                    </pre>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {activeTab === "chat" ? (
            <AIChatPanel
              report={report}
              isChatting={isChatting}
              onSendChat={onSendChat}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
