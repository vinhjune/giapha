import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useGiaphaStore } from '../store/useGiaphaStore'
import { useAuthStore } from '../store/useAuthStore'
import SearchBar from './SearchBar'
import LoginModal from './LoginModal'
import { useIsMobile } from '../utils/useIsMobile'

const ROLE_LABELS: Record<string, string> = { admin: 'Admin', editor: 'Editor', viewer: 'Viewer' }

export default function Navbar() {
  const { data, viewMode, setViewMode, hienThiThuTuDoi, toggleGenerationOrder } = useGiaphaStore()
  const { user, logout } = useAuthStore()
  const isMobile = useIsMobile()
  const [loginModalOpen, setLoginModalOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const selectableViewMode = viewMode === 'list' || viewMode === 'tree' ? viewMode : ''

  useEffect(() => {
    if (!menuOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])

  return (
    <>
    <nav className="relative bg-card border-b border-card-border flex flex-col">
      <div className="px-4 py-2 flex items-center gap-4">
        <button
          type="button"
          aria-label="Mở menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(v => !v)}
          className="px-2 py-1.5 text-lg leading-none text-muted rounded-md border border-card-border hover:bg-slate-50"
        >
          ☰
        </button>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-ink whitespace-nowrap">
            {data?.metadata.tenDongHo || 'Gia phả họ Hoàng'}
          </h1>
        </div>

        {!isMobile && <SearchBar />}

        {user && (
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <span className="text-sm text-ink font-medium hidden sm:inline">{user.username}</span>
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
              {ROLE_LABELS[user.role] ?? user.role}
            </span>
          </div>
        )}
      </div>

      {isMobile && (
        <div data-testid="navbar-search-row-mobile" className="px-4 pb-2">
          <SearchBar />
        </div>
      )}

      {menuOpen && (
        <>
          <div
            aria-hidden="true"
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-30"
          />
          <div className="absolute top-full left-4 mt-2 z-40 w-72 bg-card border border-card-border rounded-lg shadow-lg p-3 space-y-2">
            <div>
              <label htmlFor="navbar-view-mode" className="block text-xs text-muted mb-1">Chế độ xem</label>
              <select
                id="navbar-view-mode"
                aria-label="Chế độ xem"
                value={selectableViewMode}
                onChange={e => setViewMode(e.target.value as 'tree' | 'list')}
                className="w-full px-2 py-1.5 text-sm border border-card-border rounded-md bg-card"
              >
                <option value="" disabled>Chế độ xem</option>
                <option value="tree">Cây</option>
                <option value="list">Danh sách</option>
              </select>
            </div>

            <Link
              to="/"
              onClick={() => setMenuOpen(false)}
              className="block w-full px-3 py-1.5 text-sm rounded-md border border-card-border hover:bg-slate-50 text-left"
            >
              Trang chủ
            </Link>

            {user && (
              <Link
                to="/control-panel"
                onClick={() => setMenuOpen(false)}
                className="block w-full px-3 py-1.5 text-sm rounded-md border border-card-border hover:bg-slate-50 text-left"
              >
                Quản lý
              </Link>
            )}

            <button
              onClick={() => {
                toggleGenerationOrder()
                setMenuOpen(false)
              }}
              className="w-full px-3 py-1.5 text-sm rounded-md border border-card-border hover:bg-slate-50 text-left"
            >
              Thứ tự đời: {hienThiThuTuDoi ? 'Bật' : 'Tắt'}
            </button>

            {user ? (
              <button
                onClick={() => {
                  logout()
                  setMenuOpen(false)
                }}
                className="w-full px-3 py-1.5 text-sm rounded-md border border-card-border hover:bg-slate-50 text-left"
              >
                Đăng xuất
              </button>
            ) : (
              <button
                onClick={() => {
                  setLoginModalOpen(true)
                  setMenuOpen(false)
                }}
                className="w-full px-3 py-1.5 text-sm rounded-md border border-card-border hover:bg-slate-50 text-left"
              >
                Đăng nhập
              </button>
            )}
          </div>
        </>
      )}
    </nav>

    {loginModalOpen && <LoginModal onClose={() => setLoginModalOpen(false)} />}
    </>
  )
}
