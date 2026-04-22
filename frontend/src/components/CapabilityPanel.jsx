import { Code2, Eye, GitBranch, TestTube2 } from "lucide-react";

const capabilities = [
  {
    title: "Deep analysis",
    description: "Runs correctness, security, edge-case, and performance review in one pass.",
    icon: Eye,
    accent: "text-sky-400",
    border: "border-sky-400/20",
    bg: "bg-sky-400/10",
  },
  {
    title: "Fix packs",
    description: "Generates code-level fixes with plain-English explanations of what changed.",
    icon: Code2,
    accent: "text-emerald-400",
    border: "border-emerald-400/20",
    bg: "bg-emerald-400/10",
  },
  {
    title: "Custom tests",
    description: "Creates focused regression tests around the exact failure modes it found.",
    icon: TestTube2,
    accent: "text-amber-400",
    border: "border-amber-400/20",
    bg: "bg-amber-400/10",
  },
  {
    title: "Draft PR",
    description: "Packages changes into a branch-ready pull request draft when code patches are available.",
    icon: GitBranch,
    accent: "text-fuchsia-400",
    border: "border-fuchsia-400/20",
    bg: "bg-fuchsia-400/10",
  },
];

export default function CapabilityPanel({ selectedRepo, latestReport, analysisMode }) {
  const prStatus = latestReport?.pr_draft?.created
    ? "Draft PR opened"
    : latestReport?.pr_draft?.can_create
    ? "Draft PR ready"
    : "Preview mode";
  const effectiveMode = latestReport?.analysis_mode || analysisMode || "classic";
  const headline =
    effectiveMode === "mosaic"
      ? "One run finds the top problem, verifies it, suggests tests and fixes, and prepares a draft PR when it is safe."
      : "One run reviews the code, explains the issue, suggests fixes, and drafts the next steps.";
  const subheadline = selectedRepo
    ? effectiveMode === "mosaic"
      ? `Ready for ${selectedRepo.full_name}. MOSAIC will compare specialist viewpoints, verify the strongest finding, and only move to PR-ready changes when the evidence is strong enough.`
      : `Ready for ${selectedRepo.full_name}. Classic mode will run the original single-pass workflow for a faster, simpler review.`
    : "Select a repository to see the top issue, confidence level, generated tests, and PR readiness in one professor-friendly report.";

  return (
    <section className="overflow-hidden rounded-[24px] border border-[color:var(--border)] bg-[linear-gradient(180deg,rgba(13,17,23,0.96),rgba(10,14,20,0.96))]">
      <div className="border-b border-[color:var(--border)] bg-[radial-gradient(circle_at_top_left,oklch(0.72_0.16_192_/_0.16),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))] px-5 py-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
              Modern Code Analyzer
            </h3>
            <p className="mt-3 text-2xl font-bold tracking-[-0.05em] text-[var(--text)]" style={{ fontFamily: "Syne, sans-serif" }}>
              {headline}
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--text-muted)]">
              {subheadline}
            </p>
          </div>

          <div className="min-w-[240px] rounded-[18px] border border-[color:var(--border)] bg-[rgba(18,24,32,0.82)] px-4 py-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
              Latest Report
            </div>
            <div className="mt-2 text-sm text-[var(--text)]">
              {latestReport?.engineer_summary || "No AI engineer run yet."}
            </div>
            <div className="mt-4 flex items-center justify-between text-[11px] font-mono">
              <span className="text-[var(--text-subtle)]">Workflow</span>
              <span className="uppercase text-[var(--text-secondary)]">{effectiveMode}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] font-mono">
              <span className="text-[var(--text-subtle)]">PR state</span>
              <span className="text-[var(--text-secondary)]">{prStatus}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        {capabilities.map((capability, index) => {
          const Icon = capability.icon;
          return (
            <div
              key={capability.title}
              className={`border-r border-b border-[color:var(--border)] last:border-r-0 xl:[&:nth-child(4)]:border-r-0 md:[&:nth-child(2)]:border-r-0 xl:[&:nth-child(2)]:border-r md:[&:nth-child(n+3)]:border-b-0 xl:[&:nth-child(n+3)]:border-b-0 p-4 animate-fade-in-up`}
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="flex items-center gap-2">
                <div className={`flex h-9 w-9 items-center justify-center rounded-full border ${capability.border} ${capability.bg}`}>
                  <Icon className={`w-4 h-4 ${capability.accent}`} strokeWidth={1.8} />
                </div>
                <span className="text-sm font-semibold text-[var(--text)]">{capability.title}</span>
              </div>
              <p className="mt-3 text-xs leading-6 text-[var(--text-muted)]">
                {capability.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
