import { useGiaphaStore } from '../store/useGiaphaStore'
import { sapXepAnhChiEm, laThanhVienThuocHo } from '../utils/familyTree'
import type { Person } from '../types/giapha'

interface RowProps {
  person: Person
  depth: number
  onSelect: (id: string) => void
  selectedId: string | null
  highlightId: string | null
}

function PersonRow({ person, depth, onSelect, selectedId, highlightId }: RowProps) {
  const data = useGiaphaStore(s => s.data)
  const isClan = laThanhVienThuocHo(person)
  const isSelected = person.id === selectedId
  const isHighlighted = person.id === highlightId

  const children = data
    ? sapXepAnhChiEm(person.conCaiIds.map(id => data.persons[id]).filter(Boolean) as Person[])
    : []

  return (
    <>
      <div
        className={`flex items-center gap-2 py-1.5 px-2 cursor-pointer rounded transition-colors
          ${isSelected ? 'bg-blue-100' : ''}
          ${isHighlighted && !isSelected ? 'ring-2 ring-blue-400' : ''}
          hover:bg-gray-50`}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => onSelect(person.id)}
      >
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isClan ? 'bg-blue-500' : 'bg-gray-300'}`} />
        <span className={`text-sm ${isClan ? 'text-gray-900' : 'text-gray-400'}`}>
          {person.hoTen}
        </span>
        {person.namSinh?.nam && (
          <span className="text-xs text-gray-400">({person.namSinh.nam})</span>
        )}
        {person.namMat && (
          <span className="text-xs text-gray-300 ml-auto">†</span>
        )}
      </div>
      {children.map(child => (
        <PersonRow key={child.id} person={child} depth={depth + 1}
          onSelect={onSelect} selectedId={selectedId} highlightId={highlightId} />
      ))}
    </>
  )
}

export default function ListView() {
  const { data, selectedPersonId, selectPerson } = useGiaphaStore()
  if (!data) return <div className="p-4 text-gray-400">Chưa có dữ liệu</div>

  const roots = Object.values(data.persons).filter(p => {
    if (!p.boId) return true
    return !data.persons[p.boId]
  })
  const sortedRoots = sapXepAnhChiEm(roots)

  return (
    <div className="flex-1 overflow-y-auto bg-white p-2">
      {sortedRoots.map(root => (
        <PersonRow key={root.id} person={root} depth={0}
          onSelect={selectPerson} selectedId={selectedPersonId} highlightId={selectedPersonId} />
      ))}
      {sortedRoots.length === 0 && (
        <p className="text-center text-gray-400 py-8">Chưa có người nào. Hãy thêm người đầu tiên.</p>
      )}
    </div>
  )
}
