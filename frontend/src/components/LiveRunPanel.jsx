import { useRef, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Play, Settings2 } from "lucide-react";

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

export default function LiveRunPanel({
  selectedRepo,
  isRunning,
  logMessages,
  onRun,
  analysisMode,
  onChangeAnalysisMode,
}) {
  const logRef = useRef(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const spinner = useAsciiSpinner(isRunning);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logMessages]);

  const isClassicMode = analysisMode === "classic";

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
          Run Analysis
        </h3>
        {isRunning && (
          <span className="flex items-center gap-1.5 text-[11px] text-[var(--accent)] font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse-dot" />
            analyzing
          </span>
        )}
      </div>

      <div className="overflow-hidden rounded-[24px] border border-[color:var(--border)] bg-[linear-gradient(180deg,rgba(13,17,23,0.96),rgba(10,14,20,0.96))]">
        <div className="border-b border-[color:var(--border)] p-5">
          <div className="rounded-[20px] border border-[color:var(--border)] bg-[rgba(18,24,32,0.78)] p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Default Flow
                </div>
                <h4 className="mt-2 text-lg font-semibold text-[var(--text)]">
                  {isClassicMode ? "Run classic analysis" : "Run MOSAIC analysis"}
                </h4>
                <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
                  {isClassicMode
                    ? "Classic mode runs the original single-pass AI engineer workflow for a simpler review and fix summary."
                    : "The app finds the top issue, verifies it, suggests tests and fixes, and prepares a draft PR when it is safe to do so."}
                </p>
                {selectedRepo ? (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[var(--surface)] px-3 py-1 text-[11px] font-mono text-[var(--text-secondary)]">
                    <span>{selectedRepo.name}</span>
                    <span className="text-[var(--text-subtle)]">/</span>
                    <span>{selectedRepo.default_branch}</span>
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                onClick={onRun}
                disabled={!selectedRepo || isRunning}
                data-testid="live-run-button"
                className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#0A0A0A] ${
                  !selectedRepo
                    ? "bg-zinc-800/50 text-zinc-600 cursor-not-allowed border border-white/5"
                    : isRunning
                    ? "bg-[var(--accent-dim)] text-[var(--accent)] border border-[color:color-mix(in_srgb,var(--accent)_30%,transparent)] cursor-wait"
                    : "bg-[var(--text)] text-[var(--bg)] hover:opacity-90 hover:text-[var(--bg)] border border-transparent"
                }`}
              >
                {isRunning ? (
                  <>
                    <span className="font-mono text-xs w-10 text-center">{spinner}</span>
                    Running analysis...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" strokeWidth={2} />
                    {selectedRepo
                      ? `Run ${isClassicMode ? "Classic" : "MOSAIC"} Analysis`
                      : "Select a repository first"}
                  </>
                )}
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {[
                "Find the top issue",
                "Verify the finding",
                "Suggest fixes and tests",
                "Draft a PR when safe",
              ].map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-[color:var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-[var(--text-secondary)]"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-[20px] border border-[color:var(--border)] bg-[rgba(18,24,32,0.62)]">
            <button
              type="button"
              data-testid="advanced-toggle-button"
              onClick={() => setShowAdvanced((current) => !current)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.8} />
                <div>
                  <div className="text-xs font-semibold text-[var(--text)]">Advanced</div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    {isClassicMode
                      ? "Classic mode is selected for this run."
                      : "MOSAIC is selected. Classic is available if you need the older workflow."}
                  </div>
                </div>
              </div>
              {showAdvanced ? (
                <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.8} />
              ) : (
                <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.8} />
              )}
            </button>

            {showAdvanced ? (
              <div className="px-4 pb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <button
                    type="button"
                    data-testid="mode-select-mosaic"
                    onClick={() => onChangeAnalysisMode?.("mosaic")}
                    disabled={isRunning}
                    className={`text-left rounded-2xl border px-3 py-3 transition-colors duration-150 ${
                      !isClassicMode
                        ? "border-[color:color-mix(in_srgb,var(--accent)_30%,transparent)] bg-[var(--accent-dim)]"
                        : "border-[color:var(--border)] bg-[rgba(13,17,23,0.8)] hover:border-[var(--text-subtle)]"
                    } ${isRunning ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className={`text-sm font-semibold ${!isClassicMode ? "text-[var(--text)]" : "text-[var(--text-secondary)]"}`}>
                        MOSAIC
                      </span>
                      {!isClassicMode ? (
                        <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">
                          recommended
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-xs text-[var(--text-muted)] leading-relaxed">
                      Multi-agent review with verification and confidence-based PR gating.
                    </p>
                  </button>

                  <button
                    type="button"
                    data-testid="mode-select-classic"
                    onClick={() => onChangeAnalysisMode?.("classic")}
                    disabled={isRunning}
                    className={`text-left rounded-2xl border px-3 py-3 transition-colors duration-150 ${
                      isClassicMode
                        ? "border-[color:color-mix(in_srgb,var(--accent)_30%,transparent)] bg-[var(--accent-dim)]"
                        : "border-[color:var(--border)] bg-[rgba(13,17,23,0.8)] hover:border-[var(--text-subtle)]"
                    } ${isRunning ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className={`text-sm font-semibold ${isClassicMode ? "text-[var(--text)]" : "text-[var(--text-secondary)]"}`}>
                        Classic
                      </span>
                      {isClassicMode ? (
                        <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">
                          selected
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-xs text-[var(--text-muted)] leading-relaxed">
                      Original single-pass AI engineer workflow with simpler review output.
                    </p>
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {isRunning && (
            <div className="mt-3 h-1 rounded-full overflow-hidden bg-[rgba(255,255,255,0.06)]">
              <div className="h-full progress-segments progress-glow rounded-full" />
            </div>
          )}
        </div>

        <div className="border-t border-[color:var(--border)] bg-[rgba(6,10,16,0.72)]">
          <div className="px-4 pt-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-subtle)]">
              Live Progress
            </div>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Useful if you want the step-by-step details while the run is in progress.
            </p>
          </div>

          <div
            ref={logRef}
            data-testid="terminal-log"
            className="h-32 overflow-y-auto p-4 pt-3"
            style={{ background: "#050505" }}
          >
            {logMessages.length === 0 ? (
              <div className="flex items-center h-full justify-center">
                <span className="text-xs text-[var(--text-subtle)] font-mono">
                  // waiting for the next analysis run
                </span>
              </div>
            ) : (
              <div className="space-y-1">
                {logMessages.map((msg, i) => (
                  <div key={i} className="flex gap-2 items-start font-mono text-xs">
                    <span className="text-zinc-600 select-none flex-shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span
                      className={
                        msg.toLowerCase().includes("error")
                          ? "text-red-400"
                          : msg.toLowerCase().includes("complete") || msg.toLowerCase().includes("passed")
                          ? "text-emerald-400"
                          : msg.toLowerCase().includes("warning")
                          ? "text-amber-400"
                          : "text-zinc-400"
                      }
                    >
                      {msg}
                    </span>
                  </div>
                ))}
                {isRunning ? (
                  <div className="flex gap-2 items-start font-mono text-xs">
                    <span className="text-zinc-600 select-none flex-shrink-0">
                      {String(logMessages.length + 1).padStart(2, "0")}
                    </span>
                    <span className="text-zinc-500 blink-cursor" />
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
