import { useState, useEffect, useCallback } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import axios from "axios";
import LoginPage from "@/components/LoginPage";
import Dashboard from "@/components/Dashboard";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:8000";
const API = `${BACKEND_URL}/api`;

axios.defaults.withCredentials = true;

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const authError = new URLSearchParams(window.location.search).get("auth_error");

  useEffect(() => {
    axios.get(`${API}/auth/me`)
      .then(res => {
        setUser(res.data);
        setIsAuthenticated(true);
      })
      .catch(() => {
        setIsAuthenticated(false);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLogin = useCallback(() => {
    window.location.assign(`${API}/auth/github`);
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await axios.post(`${API}/auth/logout`);
    } catch (err) {
      console.error("Logout failed:", err);
    } finally {
      setIsAuthenticated(false);
      setUser(null);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0A0A0A' }}>
        <div className="font-mono text-zinc-500 text-sm">[ loading... ]</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/*"
          element={
            isAuthenticated && user ? (
              <Dashboard user={user} onLogout={handleLogout} />
            ) : (
              <LoginPage onLogin={handleLogin} authError={authError} />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
