import { VscGithub } from "react-icons/vsc";
import { FlaskConical, GitBranch, Code2, BarChart3 } from "lucide-react";

const steps = [
  { icon: VscGithub, label: "Connect", desc: "Link your GitHub account" },
  { icon: GitBranch, label: "Analyze", desc: "Inspect the selected branch" },
  { icon: Code2, label: "Fix", desc: "Generate code patches and explain them" },
  { icon: BarChart3, label: "Ship", desc: "Create tests and open a draft PR" },
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
    <div className="min-h-screen grid-bg flex items-center justify-center p-6">
      <div
        className="w-full max-w-md animate-fade-in-up"
        style={{ animationDelay: "0.1s" }}
      >
        {/* Logo + Title */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-sm border border-white/10 bg-[#121214] mb-5">
            <FlaskConical className="w-7 h-7 text-white" strokeWidth={1.5} />
          </div>
          <h1
            className="text-4xl sm:text-5xl font-black tracking-tighter text-white"
            style={{ fontFamily: "Chivo, sans-serif" }}
          >
            AI Test Lab
          </h1>
          <p className="mt-3 text-base text-zinc-400 leading-relaxed max-w-xs mx-auto">
            Analyze code, explain fixes, generate regression tests, and draft pull requests from one workflow.
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-[#121214] border border-white/10 rounded-sm p-8">
          <button
            data-testid="github-login-button"
            onClick={onLogin}
            className="w-full flex items-center justify-center gap-3 bg-white text-black font-semibold py-3 px-6 rounded-sm transition-all duration-150 hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#121214]"
          >
            <VscGithub className="w-5 h-5" />
            Continue with GitHub
          </button>

          <p className="text-xs text-zinc-500 text-center mt-4">
            Requires repo access to analyze your code
          </p>

          {errorMessage && (
            <p className="text-xs text-rose-400 text-center mt-3">
              {errorMessage}
            </p>
          )}
        </div>

        {/* Steps */}
        <div className="mt-10 grid grid-cols-4 gap-3">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <div
                key={step.label}
                className="animate-fade-in-up text-center"
                style={{ animationDelay: `${0.2 + i * 0.1}s` }}
              >
                <div className="flex items-center justify-center w-10 h-10 mx-auto rounded-sm border border-white/10 bg-[#121214] mb-2">
                  <Icon className="w-4 h-4 text-zinc-400" strokeWidth={1.5} />
                </div>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-300">
                  {step.label}
                </p>
                <p className="text-[10px] text-zinc-500 mt-0.5 leading-tight">
                  {step.desc}
                </p>
              </div>
            );
          })}
        </div>

        {/* Connector line between steps */}
        <div className="flex items-center justify-center mt-2 px-8">
          <div className="flex-1 h-px bg-white/5" />
          <div className="mx-2 text-[10px] text-zinc-600 font-mono">///</div>
          <div className="flex-1 h-px bg-white/5" />
        </div>

        <p className="text-center text-[11px] text-zinc-600 mt-6 font-mono">
          v1.1 — modern AI code analyzer
        </p>
      </div>
    </div>
  );
}
