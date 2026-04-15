import { FlaskConical, LogOut } from "lucide-react";

export default function TopBar({ user, onLogout }) {
  const initials = (user?.name || user?.login || "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <nav
      className="sticky top-0 z-50 border-b border-white/10"
      style={{ background: "rgba(10,10,10,0.85)", backdropFilter: "blur(20px)" }}
    >
      <div className="max-w-7xl mx-auto px-6 md:px-8 h-14 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-sm border border-white/10 bg-[#121214]">
            <FlaskConical className="w-4 h-4 text-white" strokeWidth={1.5} />
          </div>
          <span
            className="text-base font-bold tracking-tight text-white"
            style={{ fontFamily: "Chivo, sans-serif" }}
          >
            AI Test Lab
          </span>
          <span className="text-[10px] font-mono text-zinc-600 ml-1 hidden sm:inline">
            v1.0
          </span>
        </div>

        {/* User */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[#1C1C1F] border border-white/10 flex items-center justify-center text-[11px] font-bold text-zinc-300">
              {initials}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-zinc-200 leading-none">
                {user?.name || user?.login}
              </p>
              <p className="text-[11px] text-zinc-500 leading-none mt-0.5">
                @{user?.login}
              </p>
            </div>
          </div>
          <button
            data-testid="sign-out-button"
            onClick={onLogout}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors duration-150 px-2 py-1 rounded-sm hover:bg-white/5"
          >
            <LogOut className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
