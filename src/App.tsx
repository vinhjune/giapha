import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import PrivacyPolicyPage from './pages/PrivacyPolicyPage'
import ControlPanelPage from './pages/ControlPanelPage'
import { useGiaphaStore } from './store/useGiaphaStore'
import { useAuthStore } from './store/useAuthStore'

function AppRoot() {
  const { data, loading, error, loadData } = useGiaphaStore()
  const { checkAuth } = useAuthStore()

  useEffect(() => {
    loadData()
    checkAuth()
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
  return (
    <Routes>
      <Route path="/privacy" element={<PrivacyPolicyPage />} />
      <Route path="/control-panel" element={<ControlPanelPage />} />
      <Route path="/*" element={<AppRoot />} />
    </Routes>
  )
}
