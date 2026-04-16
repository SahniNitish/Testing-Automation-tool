import { useRef, useEffect } from "react";
import { Play, Loader2 } from "lucide-react";

export default function LiveRunPanel({ selectedRepo, isRunning, logMessages, onRun }) {
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logMessages]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
          AI Engineer Runner
        </h3>
        {isRunning && (
          <span className="flex items-center gap-1.5 text-[11px] text-[#007AFF] font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-[#007AFF] animate-pulse-dot" />
            analyzing
          </span>
        )}
      </div>

      <div className="bg-[#121214] border border-white/[0.06] rounded-sm overflow-hidden">
        {/* Run button area */}
        <div className="p-4 border-b border-white/[0.06]">
          <div className="flex flex-wrap gap-2 mb-3">
            {["Find issues", "Explain fixes", "Write tests", "Draft PR"].map((label) => (
              <span
                key={label}
                className="text-[10px] uppercase tracking-[0.18em] text-zinc-400 border border-white/10 rounded-sm px-2 py-1 bg-black/20"
              >
                {label}
              </span>
            ))}
          </div>

          <button
            data-testid="live-run-button"
            onClick={onRun}
            disabled={!selectedRepo || isRunning}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-sm text-sm font-semibold transition-all duration-150 ${
              !selectedRepo
                ? "bg-zinc-800/50 text-zinc-600 cursor-not-allowed border border-white/5"
                : isRunning
                ? "bg-[#007AFF]/10 text-[#007AFF] border border-[#007AFF]/20 cursor-wait"
                : "bg-white text-black hover:bg-zinc-200 border border-transparent"
            }`}
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
                Running analysis...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" strokeWidth={2} />
                {selectedRepo
                  ? `Run AI engineer on ${selectedRepo.name}`
                  : "Select a repository first"}
              </>
            )}
          </button>

          {/* Progress bar */}
          {isRunning && (
            <div className="mt-3 h-1 rounded-full overflow-hidden bg-zinc-800">
              <div className="h-full progress-segments progress-glow rounded-full" />
            </div>
          )}
        </div>

        {/* Terminal log */}
        <div
          ref={logRef}
          data-testid="terminal-log"
          className="h-40 overflow-y-auto p-4"
          style={{ background: "#050505" }}
        >
          {logMessages.length === 0 ? (
            <div className="flex items-center h-full justify-center">
              <span className="text-xs text-zinc-600 font-mono">
                // waiting for the next AI engineer run
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
              {isRunning && (
                <div className="flex gap-2 items-start font-mono text-xs">
                  <span className="text-zinc-600 select-none flex-shrink-0">
                    {String(logMessages.length + 1).padStart(2, "0")}
                  </span>
                  <span className="text-zinc-500 blink-cursor" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
