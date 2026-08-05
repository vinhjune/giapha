import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import LandingPage from './pages/LandingPage'
import PrivacyPolicyPage from './pages/PrivacyPolicyPage'
import ControlPanelPage from './pages/ControlPanelPage'
import { useGiaphaStore } from './store/useGiaphaStore'
import { useAuthStore } from './store/useAuthStore'

function AppRoot() {
  const { data, loading, error, loadData } = useGiaphaStore()

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400 animate-pulse">Đang tải...</div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500">Lỗi tải dữ liệu: {error}</div>
      </div>
    )
  }

  return <HomePage />
}

export default function App() {
  const { checkAuth } = useAuthStore()

  // Runs once at app startup, regardless of which route the user lands on first (e.g. a
  // fresh load or refresh of /control-panel), so the session cookie is always resolved
  // before any route-level auth checks run.
  useEffect(() => {
    checkAuth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/bai-viet/:slug" element={<LandingPage />} />
      <Route path="/privacy" element={<PrivacyPolicyPage />} />
      <Route path="/control-panel" element={<ControlPanelPage />} />
      <Route path="/gia-pha/*" element={<AppRoot />} />
    </Routes>
  )
}
