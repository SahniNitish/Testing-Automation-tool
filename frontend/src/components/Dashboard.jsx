import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import TopBar from "@/components/TopBar";
import RepoSelector from "@/components/RepoSelector";
import StatsBar from "@/components/StatsBar";
import LiveRunPanel from "@/components/LiveRunPanel";
import RunHistory from "@/components/RunHistory";
import ReportDetail from "@/components/ReportDetail";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Dashboard({ user, onLogout }) {
  const [repos, setRepos] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [stats, setStats] = useState({ total_runs: 0, passed: 0, failed: 0, warnings: 0, running: 0 });
  const [reports, setReports] = useState([]);
  const [activeReport, setActiveReport] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [currentRunId, setCurrentRunId] = useState(null);
  const [logMessages, setLogMessages] = useState([]);

  const fetchRepos = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/repos`);
      setRepos(res.data);
    } catch (err) {
      console.error("Failed to fetch repos:", err);
    }
  }, []);

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

        if (report.status !== "queued" && report.status !== "running") {
          setIsRunning(false);
          setCurrentRunId(null);
          fetchStats();
          fetchReports();
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [currentRunId, isRunning, fetchStats, fetchReports]);

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
      console.error("Run failed:", err);
      setIsRunning(false);
      setLogMessages(prev => [...prev, `Error: ${err.message}`]);
    }
  }, [selectedRepo, isRunning]);

  const handleViewReport = useCallback(async (runId) => {
    try {
      const res = await axios.get(`${API}/reports/${runId}`);
      setActiveReport(res.data);
    } catch (err) {
      console.error("Failed to fetch report:", err);
    }
  }, []);

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
          onClose={() => setActiveReport(null)}
        />
      )}
    </div>
  );
}
