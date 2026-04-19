import type { Person } from '../types/giapha'
import { useGiaphaStore } from '../store/useGiaphaStore'
import { dinhDangTenNguoi, tinhThuTuDoi } from '../utils/familyTree'

interface Props {
  results: Person[]
  onSelect: (id: number) => void
}

export default function SearchResults({ results, onSelect }: Props) {
  const data = useGiaphaStore(s => s.data)
  const showGenerationOrder = Boolean(data?.metadata.hienThiThuTuDoi)
  const generationById = data ? tinhThuTuDoi(data) : {}

  return (
    <ul className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
      {results.map(p => (
        <li
          key={p.id}
          className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm"
          onClick={() => onSelect(p.id)}
        >
          <span className="font-medium">{dinhDangTenNguoi(p, generationById, showGenerationOrder)}</span>
          {p.namSinh?.nam && <span className="text-gray-400 ml-2">({p.namSinh.nam})</span>}
        </li>
      ))}
    </ul>
  )
}
