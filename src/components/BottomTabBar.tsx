import { useGiaphaStore } from '../store/useGiaphaStore'

interface Props {
  onAddClick: () => void
}

export default function BottomTabBar({ onAddClick }: Props) {
  const { viewMode, setViewMode } = useGiaphaStore()

  return (
    <nav
      aria-label="Điều hướng chính"
      className="flex border-t border-card-border bg-card"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <button
        type="button"
        onClick={() => setViewMode('tree')}
        aria-current={viewMode === 'tree' ? 'page' : undefined}
        className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs ${
          viewMode === 'tree' ? 'text-blue-600 font-semibold' : 'text-muted'
        }`}
      >
        <span aria-hidden="true">🌳</span>
        Cây
      </button>
      <button
        type="button"
        onClick={() => setViewMode('list')}
        aria-current={viewMode === 'list' ? 'page' : undefined}
        className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs ${
          viewMode === 'list' ? 'text-blue-600 font-semibold' : 'text-muted'
        }`}
      >
        <span aria-hidden="true">📋</span>
        Danh sách
      </button>
      <button
        type="button"
        onClick={onAddClick}
        className="flex-1 flex flex-col items-center gap-0.5 py-2 text-xs text-muted"
      >
        <span aria-hidden="true">➕</span>
        Thêm mới
      </button>
    </nav>
  )
}
