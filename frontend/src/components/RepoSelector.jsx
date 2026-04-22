import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
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
    <section className="surface-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-[color:var(--border)] px-5 py-4">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
            Your repositories
          </h3>
          <p className="mt-1 text-sm text-[var(--text-subtle)]">
            Pick a codebase to analyze.
          </p>
        </div>
        <span className="text-[11px] text-[var(--text-subtle)] font-mono">
          {repos.length} repos
        </span>
      </div>

      <div className="relative border-b border-[color:var(--border)] px-5 py-4">
        <Search className="absolute left-8 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-subtle)]" strokeWidth={1.5} />
        <input
          data-testid="repo-search-input"
          type="text"
          placeholder="Search repositories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-2xl border border-[color:var(--border)] bg-[rgba(18,24,32,0.8)] pl-10 pr-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--text-subtle)] focus:outline-none focus:border-[var(--accent)] transition-colors duration-150"
        />
      </div>

      <div className="max-h-[560px] overflow-y-auto p-2">
        {filtered.map((repo) => {
          const isSelected = selectedRepo?.id === repo.id;
          const updatedLabel = repo.updated_at
            ? `${formatDistanceToNow(new Date(repo.updated_at), { addSuffix: true })}`
            : null;
          return (
            <button
              key={repo.id}
              data-testid={`repo-select-card-${repo.name}`}
              onClick={() => onSelectRepo(repo)}
              className={`w-full text-left rounded-[18px] border p-4 transition-all duration-150 ${
                isSelected
                  ? "bg-[var(--accent-dim)] border-[color:color-mix(in_srgb,var(--accent)_28%,transparent)]"
                  : "bg-transparent border-transparent hover:bg-[rgba(18,24,32,0.76)] hover:border-[color:var(--border)]"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor: LANGUAGE_COLORS[repo.language] || "#5a6e82",
                      }}
                    />
                    <span className={`truncate text-sm font-medium font-mono ${isSelected ? "text-[var(--accent)]" : "text-[var(--text)]"}`}>
                      {repo.name}
                    </span>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-[var(--accent)] flex-shrink-0" strokeWidth={2} />
                    )}
                  </div>
                  {repo.description && (
                    <p className="mt-1 truncate text-[12px] leading-5 text-[var(--text-muted)]">
                      {repo.description}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  {typeof repo.open_issues_count === "number" && repo.open_issues_count > 0 ? (
                    <span className="rounded-full border border-[color:color-mix(in_srgb,var(--warning)_24%,transparent)] bg-[var(--warning-dim)] px-2 py-0.5 text-[10px] font-medium text-[var(--warning)]">
                      {repo.open_issues_count} issues
                    </span>
                  ) : null}
                  {updatedLabel ? (
                    <span className="text-[11px] text-[var(--text-subtle)]">{updatedLabel}</span>
                  ) : null}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                {repo.language ? (
                  <span className="text-[11px] text-[var(--text-secondary)]">
                    {repo.language}
                  </span>
                ) : null}
                <div className="flex items-center gap-1">
                  <GitBranch className="w-3 h-3 text-[var(--text-subtle)]" strokeWidth={1.5} />
                  <span className="text-[11px] text-[var(--text-muted)] font-mono">
                    {repo.default_branch}
                  </span>
                </div>
              </div>
            </button>
          );
        })}

        {filtered.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">
            No repositories match your search.
          </div>
        ) : null}
      </div>
    </section>
  );
}
