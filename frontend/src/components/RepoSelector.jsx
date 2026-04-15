import { useState } from "react";
import { GitBranch, Check, Search } from "lucide-react";

const LANGUAGE_COLORS = {
  Python: "#3572A5",
  TypeScript: "#3178C6",
  JavaScript: "#F7DF1E",
  Go: "#00ADD8",
  Java: "#B07219",
  Rust: "#DEA584",
  Ruby: "#701516",
  C: "#555555",
  "C++": "#F34B7D",
  "C#": "#178600",
};

export default function RepoSelector({ repos, selectedRepo, onSelectRepo }) {
  const [search, setSearch] = useState("");

  const filtered = repos.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.language || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3
          className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500"
        >
          Repositories
        </h3>
        <span className="text-[11px] text-zinc-600 font-mono">
          {repos.length} repos
        </span>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" strokeWidth={1.5} />
        <input
          data-testid="repo-search-input"
          type="text"
          placeholder="Filter repos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[#121214] border border-white/10 rounded-sm pl-9 pr-3 py-2 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-white/20 transition-colors duration-150"
        />
      </div>

      {/* Repo list */}
      <div className="space-y-1 max-h-[420px] overflow-y-auto pr-1">
        {filtered.map((repo) => {
          const isSelected = selectedRepo?.id === repo.id;
          return (
            <button
              key={repo.id}
              data-testid={`repo-select-card-${repo.name}`}
              onClick={() => onSelectRepo(repo)}
              className={`w-full text-left p-3 rounded-sm border transition-all duration-150 ${
                isSelected
                  ? "bg-white/5 border-white/20"
                  : "bg-[#121214] border-white/[0.06] hover:border-white/10 hover:bg-[#1C1C1F]"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-zinc-200 truncate">
                      {repo.name}
                    </span>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" strokeWidth={2} />
                    )}
                  </div>
                  {repo.description && (
                    <p className="text-[11px] text-zinc-500 mt-0.5 truncate">
                      {repo.description}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 mt-2">
                {repo.language && (
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: LANGUAGE_COLORS[repo.language] || "#888",
                      }}
                    />
                    <span className="text-[11px] text-zinc-400">
                      {repo.language}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <GitBranch className="w-3 h-3 text-zinc-600" strokeWidth={1.5} />
                  <span className="text-[11px] text-zinc-500 font-mono">
                    {repo.default_branch}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
