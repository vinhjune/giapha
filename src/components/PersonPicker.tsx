import { useState, useMemo } from 'react'
import { timKiemTheoTen } from '../utils/search'
import { useGiaphaStore } from '../store/useGiaphaStore'
import type { Person } from '../types/giapha'

interface Props {
  title: string
  excludeIds?: string[]
  onSelect: (person: Person) => void
  onClose: () => void
}

export default function PersonPicker({ title, excludeIds = [], onSelect, onClose }: Props) {
  const data = useGiaphaStore(s => s.data)
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    if (!data) return []
    const all = Object.values(data.persons).filter(p => !excludeIds.includes(p.id))
    if (!query.trim()) return all.slice(0, 20)
    return timKiemTheoTen(query, { ...data, persons: Object.fromEntries(all.map(p => [p.id, p])) })
  }, [data, query, excludeIds])

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-96 max-h-[70vh] flex flex-col">
        <div className="flex justify-between items-center px-4 py-3 border-b">
          <h3 className="font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div className="px-4 py-2 border-b">
          <input
            autoFocus
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Tìm theo tên..."
            className="w-full px-3 py-1.5 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <ul className="overflow-y-auto flex-1">
          {results.map(p => (
            <li
              key={p.id}
              onClick={() => onSelect(p)}
              className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-50"
            >
              <div className="font-medium">{p.hoTen}</div>
              <div className="text-gray-400 text-xs">
                {p.gioiTinh === 'nam' ? 'Nam' : p.gioiTinh === 'nu' ? 'Nữ' : 'Khác'}
                {p.namSinh?.nam ? ` · ${p.namSinh.nam}` : ''}
              </div>
            </li>
          ))}
          {results.length === 0 && (
            <li className="px-4 py-4 text-sm text-gray-400 text-center">Không tìm thấy</li>
          )}
        </ul>
      </div>
    </div>
  )
}
