import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { getToken } from "./services/apiAuth"

import MainLayout from './components/layout/MainLayout'

import HomePage from "./pages/HomePage"
import LoginPage from "./pages/LoginPage"
import RegisterPage from "./pages/RegisterPage"
import MonitorPage from "./pages/monitor/MonitorPage"
import SettingsPage from "./pages/settings/SettingPage"

import { NotificationProvider } from "./context/NotificationContext"
import { TokenExpiredProvider, useTokenExpired } from "./context/TokenExpiredContext"
import TokenExpiredDialog from "./components/TokenExpiredDialog"

/* Protected */
function ProtectedRoute() {
  const token = getToken()
  return token ? <Outlet /> : <Navigate to="/login" replace />
}

/* Public */
function PublicRoute() {
  const token = getToken()
  return !token ? <Outlet /> : <Navigate to="/" replace />
}

const WS_URL = "ws://your-server.com/ws";

// Inner app component ที่ใช้ useTokenExpired hook
function AppContent() {
  const { showDialog } = useTokenExpired();

  // Listen to tokenExpired event from api.js interceptor
  useEffect(() => {
    const handleTokenExpired = () => {
      showDialog();
    };

    window.addEventListener('tokenExpired', handleTokenExpired);
    return () => window.removeEventListener('tokenExpired', handleTokenExpired);
  }, [showDialog]);

  return (
    <>
      <TokenExpiredDialog />
      <Routes>

        {/* Normal Pages */}
        <Route element={<MainLayout />}>
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>
        </Route>

        {/* Monitoring Section (has Sidebar) */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/monitoring" element={<MonitorPage />} />
          </Route>
        </Route>

        {/* Settings Page */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>

        {/* Login */}
        <Route element={<PublicRoute />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </>
  );
}

function App() {
  return (
    <TokenExpiredProvider>
      <NotificationProvider wsUrl={WS_URL}>
        <AppContent />
      </NotificationProvider>
    </TokenExpiredProvider>
  )
}

export default App