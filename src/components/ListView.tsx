import { useMemo } from 'react'
import { useGiaphaStore } from '../store/useGiaphaStore'
import { sapXepAnhChiEm, laThanhVienThuocHo, tinhThuTuDoi, dinhDangTenNguoi } from '../utils/familyTree'
import type { Person } from '../types/giapha'

interface RowProps {
  person: Person
  depth: number
  onSelect: (id: number) => void
  selectedId: number | null
  highlightId: number | null
  generationById: Record<number, number>
  showGenerationOrder: boolean
  isSpouse?: boolean
  hideChildren?: boolean
}

function PersonRow({
  person,
  depth,
  onSelect,
  selectedId,
  highlightId,
  generationById,
  showGenerationOrder,
  isSpouse = false,
  hideChildren = false,
}: RowProps) {
  const data = useGiaphaStore(s => s.data)
  const isClan = laThanhVienThuocHo(person)
  const isSelected = person.id === selectedId
  const isHighlighted = person.id === highlightId

  const spouses = data
    ? person.honNhan
      .map(h => data.persons[h.voChongId])
      .filter((p): p is Person => Boolean(p) && !p.laThanhVienHo)
    : []

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
        {isSpouse && (
          <span aria-label="Vợ/chồng" className="text-xs text-amber-500">💍</span>
        )}
        <span className={`text-sm ${isClan ? 'text-gray-900' : 'text-gray-400'}`}>
          {dinhDangTenNguoi(person, generationById, showGenerationOrder)}
        </span>
        {person.namSinh?.nam && (
          <span className="text-xs text-gray-400">({person.namSinh.nam})</span>
        )}
        {person.namMat && (
          <span className="text-xs text-gray-300 ml-auto">†</span>
        )}
      </div>
      {!hideChildren && (
        <>
          {spouses.map(spouse => (
            <PersonRow
              key={`spouse-${person.id}-${spouse.id}`}
              person={spouse}
              depth={depth + 1}
              onSelect={onSelect}
              selectedId={selectedId}
              highlightId={highlightId}
              generationById={generationById}
              showGenerationOrder={showGenerationOrder}
              isSpouse
              hideChildren
            />
          ))}
          {children.map(child => (
            <PersonRow key={child.id} person={child} depth={depth + 1}
              onSelect={onSelect} selectedId={selectedId} highlightId={highlightId}
              generationById={generationById} showGenerationOrder={showGenerationOrder} />
          ))}
        </>
      )}
    </>
  )
}

export default function ListView() {
  const { data, selectedPersonId, focusedPersonId, selectPerson } = useGiaphaStore()
  const generationById = useMemo(() => (data ? tinhThuTuDoi(data) : {}), [data])
  if (!data) return <div className="p-4 text-gray-400">Chưa có dữ liệu</div>
  const highlightedPersonId = focusedPersonId ?? selectedPersonId
  const showGenerationOrder = Boolean(data.metadata.hienThiThuTuDoi)

  const roots = Object.values(data.persons).filter(p => p.laThanhVienHo && (!p.boId || !data.persons[p.boId]))
  const sortedRoots = sapXepAnhChiEm(roots)

  return (
    <div className="flex-1 overflow-y-auto bg-white p-2">
      {sortedRoots.map(root => (
        <PersonRow key={root.id} person={root} depth={0}
          onSelect={selectPerson} selectedId={selectedPersonId} highlightId={highlightedPersonId}
          generationById={generationById} showGenerationOrder={showGenerationOrder} />
      ))}
      {sortedRoots.length === 0 && (
        <p className="text-center text-gray-400 py-8">Chưa có người nào. Hãy thêm người đầu tiên.</p>
      )}
    </div>
  )
}
