import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useGiaphaStore } from '../store/useGiaphaStore'
import { useAuthStore } from '../store/useAuthStore'
import SearchBar from './SearchBar'
import LoginModal from './LoginModal'
import { useIsMobile } from '../utils/useIsMobile'
import '../styles/gia-pha-theme.css'

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
    <nav className="gp-header relative flex flex-col">
      <div className="gp-header-inner">
        <button
          type="button"
          aria-label="Mở menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(v => !v)}
          className="gp-seal-button"
        >
          黃
        </button>
        <a href="/" className="gp-brand min-w-0">
          <strong>{data?.metadata.tenDongHo || 'Gia phả họ Hoàng'}</strong>
        </a>

        {!isMobile && <SearchBar className="gp-search" />}

        {user ? (
          <div className="gp-user-badge">
            <span className="text-sm font-medium hidden sm:inline">{user.username}</span>
            <span className="gp-role-pill">
              {ROLE_LABELS[user.role] ?? user.role}
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setLoginModalOpen(true)}
            className="gp-login-link ml-auto"
          >
            Đăng nhập
          </button>
        )}
      </div>

      {isMobile && (
        <div data-testid="navbar-search-row-mobile" className="gp-search-row">
          <SearchBar className="gp-search" />
        </div>
      )}

      {menuOpen && (
        <>
          <div
            aria-hidden="true"
            onClick={() => setMenuOpen(false)}
            className="gp-dropdown-backdrop"
          />
          <div className="gp-dropdown">
            <div className="px-2 pt-1 pb-2">
              <label htmlFor="navbar-view-mode" className="block text-xs text-[#d5c9b6] mb-1">Chế độ xem</label>
              <select
                id="navbar-view-mode"
                aria-label="Chế độ xem"
                value={selectableViewMode}
                onChange={e => setViewMode(e.target.value as 'tree' | 'list')}
                className="w-full px-2 py-1.5 text-sm rounded-md border border-white/20 bg-white/10 text-inherit"
              >
                <option value="" disabled className="text-ink">Chế độ xem</option>
                <option value="tree" className="text-ink">Cây</option>
                <option value="list" className="text-ink">Danh sách</option>
              </select>
            </div>

            <Link
              to="/"
              onClick={() => setMenuOpen(false)}
              className="gp-dropdown-item"
            >
              Trang chủ
            </Link>

            {user && (
              <Link
                to="/control-panel"
                onClick={() => setMenuOpen(false)}
                className="gp-dropdown-item"
              >
                Quản lý
              </Link>
            )}

            <button
              onClick={() => {
                toggleGenerationOrder()
                setMenuOpen(false)
              }}
              className="gp-dropdown-item"
            >
              Thứ tự đời: {hienThiThuTuDoi ? 'Bật' : 'Tắt'}
            </button>

            {user && (
              <>
                <div className="gp-dropdown-divider" />
                <button
                  onClick={() => {
                    logout()
                    setMenuOpen(false)
                  }}
                  className="gp-dropdown-item"
                >
                  Đăng xuất
                </button>
              </>
            )}
          </div>
        </>
      )}
    </nav>

    {loginModalOpen && <LoginModal onClose={() => setLoginModalOpen(false)} />}
    </>
  )
}
