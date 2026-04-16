import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import TopBar from "@/components/TopBar";
import RepoSelector from "@/components/RepoSelector";
import StatsBar from "@/components/StatsBar";
import CapabilityPanel from "@/components/CapabilityPanel";
import LiveRunPanel from "@/components/LiveRunPanel";
import RunHistory from "@/components/RunHistory";
import ReportDetail from "@/components/ReportDetail";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Dashboard({ user, onLogout, onSessionExpired }) {
  const [repos, setRepos] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [stats, setStats] = useState({ total_runs: 0, passed: 0, failed: 0, warnings: 0, running: 0 });
  const [reports, setReports] = useState([]);
  const [activeReport, setActiveReport] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [currentRunId, setCurrentRunId] = useState(null);
  const [logMessages, setLogMessages] = useState([]);
  const [isCreatingPullRequest, setIsCreatingPullRequest] = useState(false);

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
  }, [selectedRepo, isRunning, handleUnauthorized]);

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

  const latestSelectedReport = selectedRepo
    ? reports.find((report) => report.repo_full_name === selectedRepo.full_name)
    : reports[0] || null;

  return (
    <div className="min-h-screen" style={{ background: "#0A0A0A" }}>
      <TopBar user={user} onLogout={onLogout} />

      <main className="max-w-7xl mx-auto px-6 md:px-8 py-6 space-y-6">
        <StatsBar stats={stats} isRunning={isRunning} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: Repos */}
          <div className="lg:col-span-1 space-y-6">
            <RepoSelector
              repos={repos}
              selectedRepo={selectedRepo}
              onSelectRepo={setSelectedRepo}
            />
          </div>

          {/* Right column: Run + History */}
          <div className="lg:col-span-2 space-y-6">
            <CapabilityPanel
              selectedRepo={selectedRepo}
              latestReport={latestSelectedReport}
            />
            <LiveRunPanel
              selectedRepo={selectedRepo}
              isRunning={isRunning}
              logMessages={logMessages}
              onRun={handleRunAnalysis}
            />
            <RunHistory
              reports={reports}
              onViewReport={handleViewReport}
            />
          </div>
        </div>
      </main>

      {activeReport && (
        <ReportDetail
          report={activeReport}
          isCreatingPullRequest={isCreatingPullRequest}
          onCreatePullRequest={handleCreatePullRequest}
          onClose={() => setActiveReport(null)}
        />
      )}
    </div>
  );
}
