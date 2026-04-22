import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Gauge,
  Scale,
  ShieldCheck,
  Users2,
  XCircle,
} from "lucide-react";

const STATUS_STYLES = {
  passed: "text-emerald-300 border-emerald-400/20 bg-emerald-400/10",
  warning: "text-amber-300 border-amber-400/20 bg-amber-400/10",
  failed: "text-red-300 border-red-400/20 bg-red-400/10",
};

const RESOLUTION_STYLES = {
  confirmed: "text-emerald-300 border-emerald-400/20 bg-emerald-400/10",
  contested: "text-amber-300 border-amber-400/20 bg-amber-400/10",
  rejected: "text-red-300 border-red-400/20 bg-red-400/10",
};

const CRITIC_STYLES = {
  confirmed: "text-sky-300 border-sky-400/20 bg-sky-400/10",
  plausible: "text-indigo-300 border-indigo-400/20 bg-indigo-400/10",
  unverified: "text-[var(--text-secondary)] border-[color:var(--border)] bg-[var(--surface)]",
  rejected: "text-red-300 border-red-400/20 bg-red-400/10",
};

function confidenceColor(confidence) {
  if (confidence >= 80) return "bg-emerald-400";
  if (confidence >= 60) return "bg-amber-400";
  return "bg-red-400";
}

function prettyLabel(value) {
  return (value || "unknown").replace(/_/g, " ");
}

export default function MosaicReportPanel({ report }) {
  if (report?.analysis_mode !== "mosaic") return null;

  const agentRuns = report.agent_runs || [];
  const consensusFindings = report.consensus_findings || [];
  const explainabilityFindings = consensusFindings.filter(
    (finding) => finding.resolution !== "confirmed" || finding.critic_verdict !== "confirmed",
  );
  const benchmarkCase = report.benchmark_metadata?.case_id;

  return (
    <section className="space-y-6">
      <div className="surface-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--border)] px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--border)] bg-[var(--surface)]">
              <BrainCircuit className="h-4 w-4 text-[var(--accent)]" strokeWidth={1.8} />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                How MOSAIC Reached This
              </h3>
              <p className="text-sm text-[var(--text-secondary)]">
                Specialist agents compared notes, a verifier checked the strongest claims, and only the trustworthy findings moved forward.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px] font-mono">
            <span className="rounded-full border border-[color:var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[var(--text-secondary)]">
              {agentRuns.length} agents
            </span>
            <span className="rounded-full border border-[color:var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[var(--text-secondary)]">
              {(report.claim_groups || []).length} claim groups
            </span>
            <span className="rounded-full border border-[color:var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[var(--text-secondary)]">
              {(report.consensus_rounds || []).length} consensus rounds
            </span>
            {benchmarkCase ? (
              <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-2.5 py-1 text-sky-300">
                benchmark {benchmarkCase}
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="surface-card-soft p-4">
            <div className="flex items-center gap-2 text-[var(--text)]">
              <Users2 className="h-4 w-4 text-[var(--accent)]" strokeWidth={1.8} />
              <span className="text-sm font-semibold">Confirmed findings</span>
            </div>
            <p className="mt-3 text-xs leading-6 text-[var(--text-muted)]">
              {consensusFindings.filter((item) => item.resolution === "confirmed").length} confirmed,{" "}
              {consensusFindings.filter((item) => item.resolution === "contested").length} contested,{" "}
              {consensusFindings.filter((item) => item.resolution === "rejected").length} rejected.
            </p>
          </div>

          <div className="surface-card-soft p-4">
            <div className="flex items-center gap-2 text-[var(--text)]">
              <ShieldCheck className="h-4 w-4 text-[var(--success)]" strokeWidth={1.8} />
              <span className="text-sm font-semibold">Verifier Confirmed</span>
            </div>
            <p className="mt-3 text-xs leading-6 text-[var(--text-muted)]">
              {consensusFindings.filter((item) => item.critic_verdict === "confirmed").length} findings survived verifier
              review.
            </p>
          </div>

          <div className="surface-card-soft p-4">
            <div className="flex items-center gap-2 text-[var(--text)]">
              <Gauge className="h-4 w-4 text-[var(--warning)]" strokeWidth={1.8} />
              <span className="text-sm font-semibold">Safe for PR</span>
            </div>
            <p className="mt-3 text-xs leading-6 text-[var(--text-muted)]">
              {consensusFindings.filter((item) => item.eligible_for_fix).length} findings reached the 80% confirmed fix
              threshold.
            </p>
          </div>

          <div className="surface-card-soft p-4">
            <div className="flex items-center gap-2 text-[var(--text)]">
              <Scale className="h-4 w-4 text-indigo-300" strokeWidth={1.8} />
              <span className="text-sm font-semibold">Tests only</span>
            </div>
            <p className="mt-3 text-xs leading-6 text-[var(--text-muted)]">
              {consensusFindings.filter((item) => item.eligible_for_tests).length} findings cleared the test-generation
              threshold.
            </p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
          Agent Runs
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {agentRuns.map((run) => (
            <div key={run.agent} className="surface-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--text)]">{run.label}</p>
                  <p className="mt-1 text-[11px] text-[var(--text-muted)]">{run.focus}</p>
                </div>
                <span className={`rounded-full border px-2 py-1 text-[11px] font-medium uppercase ${STATUS_STYLES[run.status] || STATUS_STYLES.warning}`}>
                  {run.status}
                </span>
              </div>
              <p className="mt-3 text-xs leading-6 text-[var(--text-secondary)]">{run.summary}</p>
              <div className="mt-3 text-[11px] font-mono text-[var(--text-muted)]">{run.claim_count} claim(s)</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
          Why MOSAIC Believes This
        </h3>

        {consensusFindings.length ? (
          <div className="space-y-3">
            {consensusFindings.map((finding) => (
              <div key={finding.id} className="surface-card p-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-[var(--text)]">{finding.title}</p>
                      <span className={`rounded-full border px-2 py-1 text-[11px] font-medium uppercase ${RESOLUTION_STYLES[finding.resolution] || RESOLUTION_STYLES.contested}`}>
                        {prettyLabel(finding.resolution)}
                      </span>
                      <span className={`rounded-full border px-2 py-1 text-[11px] font-medium uppercase ${CRITIC_STYLES[finding.critic_verdict] || CRITIC_STYLES.unverified}`}>
                        verifier {prettyLabel(finding.critic_verdict)}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] font-mono text-[var(--text-muted)]">
                      {finding.file_path}
                      {finding.symbol ? ` :: ${finding.symbol}` : ""}
                    </p>
                  </div>

                  <div className="min-w-[220px]">
                    <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)]">
                      <span>confidence</span>
                      <span>{finding.confidence}%</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
                      <div
                        className={`h-full ${confidenceColor(finding.confidence)}`}
                        style={{ width: `${finding.confidence}%` }}
                      />
                    </div>
                  </div>
                </div>

                <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">{finding.explanation}</p>

                <div className="mt-4 grid grid-cols-1 xl:grid-cols-3 gap-3 text-xs">
                  <div className="surface-card-soft p-3">
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      Supporting Agents
                    </div>
                    <p className="mt-2 leading-6 text-[var(--text-secondary)]">
                      {finding.supporting_agents?.join(", ") || "None"}
                    </p>
                  </div>

                  <div className="surface-card-soft p-3">
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      Challenging Agents
                    </div>
                    <p className="mt-2 leading-6 text-[var(--text-secondary)]">
                      {finding.opposing_agents?.join(", ") || "None"}
                    </p>
                  </div>

                  <div className="surface-card-soft p-3">
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      Output Policy
                    </div>
                    <p className="mt-2 leading-6 text-[var(--text-secondary)]">
                      {finding.eligible_for_fix
                        ? "Eligible for fix packs and draft PR generation."
                        : finding.eligible_for_tests
                        ? "Eligible for custom tests, but not strong enough for automatic code changes."
                        : "Visible for explainability only; not used for tests or patches."}
                    </p>
                  </div>
                </div>

                {finding.evidence?.length ? (
                  <details className="group mt-4">
                    <summary className="cursor-pointer text-[11px] text-[var(--text-muted)] transition-colors duration-150 hover:text-[var(--text)]">
                      View supporting evidence
                    </summary>
                    <div className="mt-2 space-y-2 rounded-[18px] border border-[color:var(--border)] bg-[#05070b] p-3">
                      {finding.evidence.map((line, index) => (
                        <pre
                          key={`${finding.id}-evidence-${index}`}
                          className="overflow-x-auto font-mono text-[11px] text-[var(--text-secondary)] whitespace-pre-wrap"
                        >
                          {line}
                        </pre>
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="surface-card p-8 text-center">
            <p className="font-mono text-sm text-[var(--text-subtle)]">
              // no consensus findings yet
            </p>
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
          Needs Review
        </h3>

        {explainabilityFindings.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {explainabilityFindings.map((finding) => {
              const Icon = finding.resolution === "rejected" || finding.critic_verdict === "rejected" ? XCircle : AlertTriangle;
              return (
                <div key={`${finding.id}-explainability`} className="surface-card p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--border)] bg-[var(--surface)]">
                      <Icon
                        className={
                          finding.resolution === "rejected" || finding.critic_verdict === "rejected"
                            ? "h-4 w-4 text-red-300"
                            : "h-4 w-4 text-amber-300"
                        }
                        strokeWidth={1.8}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--text)]">{finding.title}</p>
                      <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                        {prettyLabel(finding.resolution)} / verifier {prettyLabel(finding.critic_verdict)}
                      </p>
                    </div>
                  </div>

                  <p className="mt-3 text-xs leading-6 text-[var(--text-secondary)]">{finding.critic_reason || finding.explanation}</p>
                  <p className="mt-3 text-[11px] text-[var(--text-muted)]">
                    Confidence stayed at {finding.confidence}% so MOSAIC kept this out of automatic patch generation.
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="surface-card p-8 text-center">
            <div className="flex items-center justify-center gap-2 text-[var(--success)]">
              <CheckCircle2 className="h-4 w-4" strokeWidth={1.8} />
              <span className="text-sm font-medium">No contested or rejected findings in this run.</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
