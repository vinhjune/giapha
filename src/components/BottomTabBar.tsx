import { useGiaphaStore } from '../store/useGiaphaStore'

interface Props {
  onAddClick: () => void
  /** Whether the current user is allowed to add a person (logged in as
   * admin/editor). When false, the "Thêm mới" tab is hidden so it never
   * renders as a dead button that silently does nothing when tapped —
   * mirrors the desktop floating "+" button, which is likewise hidden
   * entirely for anonymous users. */
  canAdd: boolean
}

export default function BottomTabBar({ onAddClick, canAdd }: Props) {
  const { viewMode, setViewMode } = useGiaphaStore()

  return (
    <nav
      aria-label="Điều hướng chính"
      className="gp-tabbar"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <button
        type="button"
        onClick={() => setViewMode('tree')}
        aria-current={viewMode === 'tree' ? 'page' : undefined}
        className={`gp-tabbar-btn ${viewMode === 'tree' ? 'is-active' : ''}`}
      >
        Cây
      </button>
      <button
        type="button"
        onClick={() => setViewMode('list')}
        aria-current={viewMode === 'list' ? 'page' : undefined}
        className={`gp-tabbar-btn ${viewMode === 'list' ? 'is-active' : ''}`}
      >
        Danh sách
      </button>
      {canAdd && (
        <button
          type="button"
          onClick={onAddClick}
          className="gp-tabbar-btn"
        >
          Thêm mới
        </button>
      )}
    </nav>
  )
}
