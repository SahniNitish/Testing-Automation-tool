import { useState, useEffect, useCallback } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import axios from "axios";
import LoginPage from "@/components/LoginPage";
import Dashboard from "@/components/Dashboard";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("aitestlab_token");
    if (token) {
      axios.get(`${API}/auth/me`)
        .then(res => {
          setUser(res.data);
          setIsAuthenticated(true);
        })
        .catch(() => {
          localStorage.removeItem("aitestlab_token");
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogin = useCallback(async () => {
    try {
      const callbackRes = await axios.get(`${API}/auth/github/callback?code=mock_code`);
      if (callbackRes.data.success) {
        localStorage.setItem("aitestlab_token", callbackRes.data.token);
        setUser(callbackRes.data.user);
        setIsAuthenticated(true);
      }
    } catch (err) {
      console.error("Login failed:", err);
    }
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem("aitestlab_token");
    setIsAuthenticated(false);
    setUser(null);
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
              <LoginPage onLogin={handleLogin} />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
