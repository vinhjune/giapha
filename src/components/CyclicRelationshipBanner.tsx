import { useGiaphaStore } from '../store/useGiaphaStore'

export default function CyclicRelationshipBanner() {
  const { cyclicRelationshipWarnings, dismissCyclicRelationshipWarnings } = useGiaphaStore()

  if (cyclicRelationshipWarnings.length === 0) return null

  return (
    <div className="bg-rose-50 border-b border-rose-200 px-4 py-2 text-sm text-rose-800 flex items-start justify-between gap-3">
      <div>
        <p className="font-medium">⚠️ Phát hiện quan hệ vòng lặp trong dữ liệu gia phả</p>
        <ul className="list-disc ml-5 mt-1">
          {cyclicRelationshipWarnings.slice(0, 3).map((warning, idx) => (
            <li key={idx}>{warning}</li>
          ))}
        </ul>
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
