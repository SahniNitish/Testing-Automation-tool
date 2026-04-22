import { VscGithub } from "react-icons/vsc";
import { GitBranch, Code2, BarChart3 } from "lucide-react";
import LogoMark from "@/components/LogoMark";

const steps = [
  { icon: VscGithub, label: "Connect", desc: "Authorize GitHub" },
  { icon: GitBranch, label: "Analyze", desc: "Run MOSAIC on a repo" },
  { icon: Code2, label: "Fix", desc: "Generate targeted patches" },
  { icon: BarChart3, label: "Ship", desc: "Write tests and draft PRs" },
];

const featurePills = [
  "Multi-agent analysis",
  "Verified findings",
  "Auto-generated fixes",
];

const ERROR_MESSAGES = {
  invalid_callback: "GitHub sent an invalid callback. Try signing in again.",
  missing_access_token: "GitHub did not return an access token.",
  github_oauth_failed: "GitHub sign-in failed. Check your backend OAuth settings.",
  session_expired: "Your GitHub session expired, likely because the backend restarted. Sign in again to create the PR.",
};

export default function LoginPage({ onLogin, authError }) {
  const errorMessage = authError ? (ERROR_MESSAGES[authError] || "GitHub sign-in failed.") : null;

  return (
    <div className="min-h-screen grid-bg relative overflow-hidden flex items-center justify-center p-6">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-1/2 top-[44%] h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,oklch(0.72_0.16_192_/_0.12)_0%,transparent_68%)]" />
      </div>

      <div
        className="relative z-10 w-full max-w-lg animate-fade-in-up text-center"
        style={{ animationDelay: "0.1s" }}
      >
        <div className="mb-10">
          <div className="inline-flex items-center justify-center mb-6">
            <LogoMark size={72} className="glow-pulse" />
          </div>
          <h1
            className="text-5xl sm:text-6xl font-extrabold tracking-[-0.06em] text-[var(--text)]"
            style={{ fontFamily: "Syne, sans-serif" }}
          >
            AI Test Lab
          </h1>
          <p className="mt-4 text-[15px] leading-7 text-[var(--text-muted)] max-w-sm mx-auto">
            AI-powered code review.
            <br />
            Powered by MOSAIC agents.
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {featurePills.map((pill) => (
              <span
                key={pill}
                className="accent-pill px-3 py-1 text-[11px] font-medium tracking-[0.02em]"
              >
                {pill}
              </span>
            ))}
          </div>
        </div>

        <div className="surface-card-soft px-7 py-8 sm:px-9">
          <button
            data-testid="github-login-button"
            onClick={onLogin}
            className="w-full flex items-center justify-center gap-3 bg-[var(--text)] text-[var(--bg)] font-semibold py-3.5 px-6 rounded-2xl transition-all duration-150 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[var(--surface)]"
          >
            <VscGithub className="w-5 h-5" />
            Continue with GitHub
          </button>

          <p className="text-xs text-[var(--text-subtle)] text-center mt-4 leading-6">
            By signing in, you authorize read access to your repositories.
            <br />
            No code is stored.
          </p>

          {errorMessage && (
            <p className="text-xs text-[var(--danger)] text-center mt-4">
              {errorMessage}
            </p>
          )}
        </div>

        <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <div
                key={step.label}
                className="animate-fade-in-up text-center"
                style={{ animationDelay: `${0.2 + i * 0.1}s` }}
              >
                <div className="flex items-center justify-center w-11 h-11 mx-auto rounded-full border border-[color:var(--border)] bg-[rgba(13,17,23,0.84)] mb-3">
                  <Icon className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.5} />
                </div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                  {step.label}
                </p>
                <p className="text-[10px] text-[var(--text-subtle)] mt-1 leading-tight">
                  {step.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="fixed bottom-5 left-1/2 z-10 hidden -translate-x-1/2 text-[10px] uppercase tracking-[0.08em] text-[var(--text-subtle)] md:block">
        MOSAIC · Multi-agent Orchestrated Static Analysis &amp; Intelligence Core
      </div>
    </div>
  );
}
