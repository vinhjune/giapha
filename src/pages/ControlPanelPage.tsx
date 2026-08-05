import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'
import Navbar from '../components/Navbar'
import MemberManagementView from '../components/MemberManagementView'
import PendingRequestsPanel from '../components/PendingRequestsPanel'
import CsvPanel from '../components/CsvPanel'
import UserManagementPanel from '../components/UserManagementPanel'
import EventManagementView from '../components/EventManagementView'
import ArticleManagementView from '../components/ArticleManagementView'

type Tab = 'members' | 'requests' | 'csv' | 'articles' | 'events' | 'users'

export default function ControlPanelPage() {
  const { user, authChecked } = useAuthStore()
  const [tab, setTab] = useState<Tab>('members')

  // Wait for the initial session check (fired once at app startup) to resolve before
  // deciding to redirect — otherwise a fresh load/refresh of this route would bounce a
  // logged-in user back to "/" before their session cookie has been verified.
  if (!authChecked) {
    return (
      <div className="h-dvh flex items-center justify-center text-muted animate-pulse">Đang kiểm tra đăng nhập...</div>
    )
  }

  if (!user) return <Navigate to="/" replace />

  const isAdmin = user.role === 'admin'
  const tabs: { key: Tab; label: string }[] = [
    { key: 'members', label: 'Thành viên' },
    { key: 'requests', label: isAdmin ? 'Yêu cầu chờ duyệt' : 'Yêu cầu của tôi' },
    { key: 'articles', label: 'Bài viết' },
    { key: 'events', label: 'Sự kiện' },
    ...(isAdmin
      ? [
          { key: 'csv' as Tab, label: 'CSV' },
          { key: 'users' as Tab, label: 'Quản lý User' },
        ]
      : []),
  ]

  return (
    <div className="h-dvh flex flex-col overflow-hidden bg-white">
      <Navbar />
      <div className="border-b border-gray-200 px-4 py-3">
        <h1 className="text-lg font-bold text-ink">Quản lý</h1>
      </div>
      <div className="border-b border-gray-200 px-4 flex gap-1 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm border-b-2 whitespace-nowrap ${
              tab === t.key ? 'border-blue-600 text-blue-700 font-medium' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {tab === 'members' && <MemberManagementView />}
        {tab !== 'members' && (
          <div className="flex-1 min-h-0 overflow-auto">
            {tab === 'requests' && <PendingRequestsPanel />}
            {tab === 'csv' && isAdmin && <CsvPanel />}
            {tab === 'articles' && <ArticleManagementView />}
            {tab === 'events' && <EventManagementView />}
            {tab === 'users' && isAdmin && <UserManagementPanel />}
          </div>
        )}
      </div>
    </div>
  )
}
