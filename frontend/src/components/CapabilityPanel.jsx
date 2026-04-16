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

export default function CapabilityPanel({ selectedRepo, latestReport }) {
  const prStatus = latestReport?.pr_draft?.created
    ? "Draft PR opened"
    : latestReport?.pr_draft?.can_create
    ? "Draft PR ready"
    : "Preview mode";

  return (
    <section className="bg-[#121214] border border-white/[0.06] rounded-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-white/[0.06] bg-[radial-gradient(circle_at_top_left,rgba(0,122,255,0.16),transparent_35%),linear-gradient(135deg,rgba(255,255,255,0.02),rgba(255,255,255,0))]">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
              Modern Code Analyzer
            </h3>
            <p className="mt-2 text-xl font-bold tracking-tight text-white" style={{ fontFamily: "Chivo, sans-serif" }}>
              Analyze, explain, patch, test, and draft a PR from one run.
            </p>
            <p className="mt-2 text-sm text-zinc-400 max-w-2xl">
              {selectedRepo
                ? `Ready for ${selectedRepo.full_name}. The analyzer will inspect the selected branch, explain the riskiest issues, generate fix packs, and build targeted tests.`
                : "Select a repository to run the full AI engineer workflow. The app will surface findings, code fixes, custom tests, and a draft pull request plan."}
            </p>
          </div>

          <div className="min-w-[220px] bg-black/30 border border-white/10 rounded-sm px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
              Latest AI Brief
            </div>
            <div className="mt-2 text-sm text-zinc-200">
              {latestReport?.engineer_summary || "No AI engineer run yet."}
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] font-mono">
              <span className="text-zinc-500">PR state</span>
              <span className="text-zinc-300">{prStatus}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 p-4">
        {capabilities.map((capability, index) => {
          const Icon = capability.icon;
          return (
            <div
              key={capability.title}
              className={`rounded-sm border ${capability.border} ${capability.bg} p-4 animate-fade-in-up`}
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-sm border border-white/10 bg-black/20 flex items-center justify-center">
                  <Icon className={`w-4 h-4 ${capability.accent}`} strokeWidth={1.8} />
                </div>
                <span className="text-sm font-semibold text-white">{capability.title}</span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-zinc-300">
                {capability.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
