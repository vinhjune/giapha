import type { Person } from '../types/giapha'

interface Props {
  person: Person
  onClose: () => void
}

function formatNgayThang(nt?: Person['namSinh']): string | null {
  if (!nt) return null
  const parts = [nt.ngay, nt.thang, nt.nam].filter(Boolean)
  if (parts.length === 0) return null
  return parts.join('/') + (nt.amLich ? ' (Âm lịch)' : '')
}

export default function PersonDetailPanel({ person, onClose }: Props) {
  const birth = formatNgayThang(person.namSinh)
  const death = formatNgayThang(person.namMat)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 flex flex-col gap-3 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{person.hoTen}</h2>
          <button aria-label="Đóng" onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>
        </div>

        {birth && <p className="text-sm text-gray-600">Sinh: {birth}</p>}
        {death && <p className="text-sm text-gray-600">Mất: {death}</p>}
        {person.queQuan && <p className="text-sm text-gray-600">Quê quán/Nơi ở: {person.queQuan}</p>}
        {person.tieuSu && <p className="text-sm text-gray-700 whitespace-pre-wrap">{person.tieuSu}</p>}

        <div className="flex justify-end pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50">
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
