import { useGiaphaStore } from '../store/useGiaphaStore'

/**
 * Prominent pill-tab switch between "Cây gia phả" and "Danh sách", shown in
 * the content area on desktop (mirrors the approved gia-pha mockup). On
 * mobile the same switching is already handled by BottomTabBar, so this is
 * not rendered there to avoid two redundant controls on a small screen.
 */
export default function ViewToggle() {
  const { viewMode, setViewMode } = useGiaphaStore()

  return (
    <div className="gp-view-toggle" role="tablist" aria-label="Chọn chế độ xem">
      <button
        type="button"
        role="tab"
        aria-selected={viewMode === 'tree'}
        onClick={() => setViewMode('tree')}
        className={`gp-view-toggle-btn ${viewMode === 'tree' ? 'is-active' : ''}`}
      >
        Cây gia phả
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={viewMode === 'list'}
        onClick={() => setViewMode('list')}
        className={`gp-view-toggle-btn ${viewMode === 'list' ? 'is-active' : ''}`}
      >
        Danh sách
      </button>
    </div>
  )
}
