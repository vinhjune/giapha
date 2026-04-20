import { useGiaphaStore } from '../store/useGiaphaStore'

export default function CyclicRelationshipBanner() {
  const { cyclicRelationshipWarnings, dismissCyclicRelationshipWarnings } = useGiaphaStore()

  if (cyclicRelationshipWarnings.length === 0) return null
  const displayedWarnings = cyclicRelationshipWarnings.slice(0, 3)
  const hiddenCount = cyclicRelationshipWarnings.length - displayedWarnings.length

  return (
    <div className="bg-rose-50 border-b border-rose-200 px-4 py-2 text-sm text-rose-800 flex items-start justify-between gap-3">
      <div>
        <p className="font-medium">⚠️ Phát hiện quan hệ vòng lặp trong dữ liệu gia phả</p>
        <ul className="list-disc ml-5 mt-1">
          {displayedWarnings.map(warning => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
        {hiddenCount > 0 && (
          <p className="mt-1 text-xs">
            và {hiddenCount} cảnh báo khác.
          </p>
        )}
      </div>
      <button
        onClick={dismissCyclicRelationshipWarnings}
        className="px-2 py-1 bg-rose-100 rounded hover:bg-rose-200 whitespace-nowrap"
      >
        Đóng
      </button>
    </div>
  )
}
