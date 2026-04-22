import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Clock3, Grid2x2, LogOut, Settings2 } from "lucide-react";
import RepoSelector from "@/components/RepoSelector";
import StatsBar from "@/components/StatsBar";
import CapabilityPanel from "@/components/CapabilityPanel";
import LiveRunPanel from "@/components/LiveRunPanel";
import RunHistory from "@/components/RunHistory";
import ReportDetail from "@/components/ReportDetail";
import LogoMark from "@/components/LogoMark";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const sidebarItems = [
  { label: "Dashboard", icon: Grid2x2, active: true },
  { label: "History", icon: Clock3, active: false },
  { label: "Settings", icon: Settings2, active: false },
];

function StatusPill({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[color:color-mix(in_srgb,var(--accent)_24%,transparent)] bg-[var(--accent-dim)] px-3 py-1 text-[11px] font-medium text-[var(--accent)]">
      {children}
    </span>
  );
}

export default function Dashboard({ user, onLogout, onSessionExpired }) {
  const [repos, setRepos] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [analysisMode, setAnalysisMode] = useState("mosaic");
  const [stats, setStats] = useState({ total_runs: 0, passed: 0, failed: 0, warnings: 0, running: 0 });
  const [reports, setReports] = useState([]);
  const [activeReport, setActiveReport] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [currentRunId, setCurrentRunId] = useState(null);
  const [logMessages, setLogMessages] = useState([]);
  const [isCreatingPullRequest, setIsCreatingPullRequest] = useState(false);
  const [isChatting, setIsChatting] = useState(false);

  const handleUnauthorized = useCallback((err) => {
    if (axios.isAxiosError(err) && err.response?.status === 401) {
      onSessionExpired?.();
      return true;
    }
    return false;
  }, [onSessionExpired]);

  const fetchRepos = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/repos`);
      setRepos(res.data);
    } catch (err) {
      if (handleUnauthorized(err)) return;
      console.error("Failed to fetch repos:", err);
    }
  }, [handleUnauthorized]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/stats`);
      setStats(res.data);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  }, []);

  const fetchReports = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/reports`);
      setReports(res.data);
    } catch (err) {
      console.error("Failed to fetch reports:", err);
    }
  }, []);

  useEffect(() => {
    fetchRepos();
    fetchStats();
    fetchReports();
  }, [fetchRepos, fetchStats, fetchReports]);

  // Poll for running report updates
  useEffect(() => {
    if (!currentRunId || !isRunning) return;
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${API}/reports/${currentRunId}`);
        const report = res.data;
        setLogMessages(report.log_messages || []);
        if (activeReport?.id === report.id) {
          setActiveReport(report);
        }

        if (report.status !== "queued" && report.status !== "running") {
          setIsRunning(false);
          setCurrentRunId(null);
          fetchStats();
          fetchReports();
        }
      } catch (err) {
        if (handleUnauthorized(err)) return;
        console.error("Polling error:", err);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [activeReport, currentRunId, handleUnauthorized, isRunning, fetchStats, fetchReports]);

  const handleRunAnalysis = useCallback(async () => {
    if (!selectedRepo || isRunning) return;
    setIsRunning(true);
    setLogMessages(["Initializing analysis..."]);

    try {
      const res = await axios.post(`${API}/analysis/run`, {
        repo_full_name: selectedRepo.full_name,
        repo_name: selectedRepo.name,
        branch: selectedRepo.default_branch,
        analysis_mode: analysisMode,
      });
      setCurrentRunId(res.data.run_id);
    } catch (err) {
      if (handleUnauthorized(err)) {
        setIsRunning(false);
        return;
      }
      console.error("Run failed:", err);
      setIsRunning(false);
      setLogMessages(prev => [...prev, `Error: ${err.message}`]);
    }
  }, [selectedRepo, isRunning, handleUnauthorized, analysisMode]);

  const handleViewReport = useCallback(async (runId) => {
    try {
      const res = await axios.get(`${API}/reports/${runId}`);
      setActiveReport(res.data);
    } catch (err) {
      if (handleUnauthorized(err)) return;
      console.error("Failed to fetch report:", err);
    }
  }, [handleUnauthorized]);

  const handleCreatePullRequest = useCallback(async (runId) => {
    setIsCreatingPullRequest(true);
    try {
      const res = await axios.post(`${API}/reports/${runId}/pull-request`);
      const refreshed = await axios.get(`${API}/reports/${runId}`);
      setActiveReport(refreshed.data);
      fetchReports();
      if (res.data?.url) {
        window.open(res.data.url, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      if (handleUnauthorized(err)) return;
      console.error("Failed to create pull request:", err);
    } finally {
      setIsCreatingPullRequest(false);
    }
  }, [fetchReports, handleUnauthorized]);

  const handleReportChat = useCallback(async (runId, message) => {
    setIsChatting(true);
    try {
      const res = await axios.post(`${API}/reports/${runId}/chat`, { message });
      setActiveReport(res.data.report);
      fetchReports();
      return res.data.report;
    } catch (err) {
      if (handleUnauthorized(err)) return null;
      console.error("Failed to send chat message:", err);
      return null;
    } finally {
      setIsChatting(false);
    }
  }, [fetchReports, handleUnauthorized]);

  const latestSelectedReport = selectedRepo
    ? reports.find((report) => report.repo_full_name === selectedRepo.full_name)
    : reports[0] || null;

  const initials = (user?.name || user?.login || "U")
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] lg:grid lg:grid-cols-[260px,1fr]">
      <aside className="hidden border-r border-[color:var(--border)] bg-[rgba(10,14,20,0.88)] lg:flex lg:flex-col">
        <div className="px-6 py-7">
          <div className="flex items-center gap-3">
            <LogoMark size={34} className="glow-pulse" />
            <div>
              <div className="text-base font-bold tracking-[-0.04em] text-[var(--text)]" style={{ fontFamily: "Syne, sans-serif" }}>
                AI Test Lab
              </div>
              <div className="text-[11px] text-[var(--text-subtle)]">
                MOSAIC workspace
              </div>
            </div>
          </div>
        </div>

        <nav className="px-4">
          <div className="flex flex-col gap-2">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
                    item.active
                      ? "border-[color:color-mix(in_srgb,var(--accent)_30%,transparent)] bg-[var(--accent-dim)] text-[var(--text)]"
                      : "border-transparent text-[var(--text-muted)]"
                  }`}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.7} />
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
              );
            })}
          </div>
        </nav>

        <div className="mt-auto px-5 pb-6 pt-8">
          <div className="surface-card-soft p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--border)] bg-[var(--surface-3)] text-sm font-bold text-[var(--text)]">
                {initials}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-[var(--text)]">
                  {user?.name || user?.login}
                </div>
                <div className="truncate text-[11px] text-[var(--text-muted)]">
                  @{user?.login}
                </div>
              </div>
            </div>

            <button
              data-testid="sign-out-button"
              onClick={onLogout}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[color:var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors duration-150 hover:border-[color:var(--surface-3)] hover:text-[var(--text)]"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.7} />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <main className="mx-auto max-w-[1440px] p-5 md:p-8">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-3 lg:hidden">
                <LogoMark size={28} />
                <span className="text-base font-bold tracking-[-0.04em] text-[var(--text)]" style={{ fontFamily: "Syne, sans-serif" }}>
                  AI Test Lab
                </span>
              </div>
              <h1 className="mt-3 text-3xl font-bold tracking-[-0.05em] text-[var(--text)]" style={{ fontFamily: "Syne, sans-serif" }}>
                Repository workspace
              </h1>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                Select a repository, run MOSAIC analysis, and review the verified findings, fixes, and tests in one flow.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <StatusPill>{analysisMode === "mosaic" ? "MOSAIC ready" : "Classic mode"}</StatusPill>
              <button
                onClick={onLogout}
                className="inline-flex items-center gap-2 rounded-2xl border border-[color:var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] lg:hidden"
              >
                <LogOut className="h-4 w-4" strokeWidth={1.7} />
                Sign out
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <StatsBar stats={stats} isRunning={isRunning} />

            <div className="grid gap-6 xl:grid-cols-[minmax(320px,0.95fr),minmax(0,1.45fr)]">
              <div className="space-y-6">
                <RepoSelector
                  repos={repos}
                  selectedRepo={selectedRepo}
                  onSelectRepo={setSelectedRepo}
                />
              </div>

              <div className="space-y-6">
                <CapabilityPanel
                  selectedRepo={selectedRepo}
                  latestReport={latestSelectedReport}
                  analysisMode={analysisMode}
                />
                <LiveRunPanel
                  selectedRepo={selectedRepo}
                  isRunning={isRunning}
                  logMessages={logMessages}
                  analysisMode={analysisMode}
                  onChangeAnalysisMode={setAnalysisMode}
                  onRun={handleRunAnalysis}
                />
              </div>
            </div>

            <RunHistory
              reports={reports}
              onViewReport={handleViewReport}
            />
          </div>
        </main>
      </div>

      {activeReport && (
        <ReportDetail
          report={activeReport}
          isCreatingPullRequest={isCreatingPullRequest}
          isChatting={isChatting}
          onCreatePullRequest={handleCreatePullRequest}
          onSendChat={handleReportChat}
          onClose={() => setActiveReport(null)}
        />
      )}
    </div>
  );
}
