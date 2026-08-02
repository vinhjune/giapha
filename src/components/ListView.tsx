import { Fragment, useEffect, useRef } from 'react'
import { useGiaphaStore } from '../store/useGiaphaStore'
import { useAuthStore } from '../store/useAuthStore'
import { sapXepAnhChiEm, laThanhVienThuocHo, dinhDangTenNguoi } from '../utils/familyTree'
import type { Person } from '../types/giapha'

interface RowProps {
  person: Person
  depth: number
  onSelect: (id: string) => void
  selectedId: string | null
  highlightId: string | null
  showGenerationOrder: boolean
  isSpouse?: boolean
  hideChildren?: boolean
  ancestorIds?: Set<string>
}

function PersonRow({
  person,
  depth,
  onSelect,
  selectedId,
  highlightId,
  showGenerationOrder,
  isSpouse = false,
  hideChildren = false,
  ancestorIds = new Set<string>(),
}: RowProps) {
  if (ancestorIds.has(person.id)) return null
  const nextAncestorIds = new Set(ancestorIds)
  nextAncestorIds.add(person.id)

  const data = useGiaphaStore(s => s.data)
  const { user } = useAuthStore()
  const isClan = laThanhVienThuocHo(person)
  const isSelected = person.id === selectedId
  const isHighlighted = person.id === highlightId

  const orderedChildren = data
    ? sapXepAnhChiEm(person.conCaiIds.map(id => data.persons[id]).filter(Boolean) as Person[])
    : []

  const matchedChildIds = new Set<string>()
  const marriageGroups = data
    ? person.honNhan.map(h => {
      const spouse = data.persons[h.voChongId]
      const childrenOfMarriage = orderedChildren.filter(c =>
        person.gioiTinh === 'nam'
          ? c.boId === person.id && c.meId === h.voChongId
          : c.meId === person.id && c.boId === h.voChongId
      )
      childrenOfMarriage.forEach(c => matchedChildIds.add(c.id))
      return { spouse: spouse && !spouse.laThanhVienHo ? spouse : null, voChongId: h.voChongId, childrenOfMarriage }
    })
    : []

  const unmatchedChildren = orderedChildren.filter(c => !matchedChildIds.has(c.id))

  return (
    <>
      <div
        data-person-id={person.id}
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
        {person.pendingRequestId && user && (
          <span aria-label="Đang chờ duyệt" title="Đang chờ duyệt" className="text-xs text-amber-600">⏳</span>
        )}
        <span className={`text-sm ${isClan ? 'text-gray-900' : 'text-gray-400'}`}>
          {dinhDangTenNguoi(person, showGenerationOrder)}
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
          {marriageGroups.map(group => (
            <Fragment key={`marriage-${person.id}-${group.voChongId}`}>
              {group.spouse && (
                <PersonRow
                  key={`spouse-${person.id}-${group.spouse.id}`}
                  person={group.spouse}
                  depth={depth + 1}
                  onSelect={onSelect}
                  selectedId={selectedId}
                  highlightId={highlightId}
                  showGenerationOrder={showGenerationOrder}
                  isSpouse
                  hideChildren
                  ancestorIds={nextAncestorIds}
                />
              )}
              {group.childrenOfMarriage.map(child => (
                <PersonRow key={child.id} person={child} depth={depth + 1}
                  onSelect={onSelect} selectedId={selectedId} highlightId={highlightId}
                  showGenerationOrder={showGenerationOrder}
                  ancestorIds={nextAncestorIds} />
              ))}
            </Fragment>
          ))}
          {unmatchedChildren.map(child => (
            <PersonRow key={child.id} person={child} depth={depth + 1}
              onSelect={onSelect} selectedId={selectedId} highlightId={highlightId}
              showGenerationOrder={showGenerationOrder}
              ancestorIds={nextAncestorIds} />
          ))}
        </>
      )}
    </>
  )
}

export default function ListView() {
  const { data, selectedPersonId, focusedPersonId, selectPerson, hienThiThuTuDoi } = useGiaphaStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const highlightedPersonId = focusedPersonId ?? selectedPersonId

  useEffect(() => {
    if (!highlightedPersonId || !containerRef.current) return
    const row = containerRef.current.querySelector(`[data-person-id="${highlightedPersonId}"]`)
    row?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlightedPersonId])

  if (!data) return <div className="p-4 text-gray-400">Chưa có dữ liệu</div>

  const roots = Object.values(data.persons).filter(p => p.laThanhVienHo && (!p.boId || !data.persons[p.boId]))
  const sortedRoots = sapXepAnhChiEm(roots)

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto bg-white p-2 touch-pan-y">
      {sortedRoots.map(root => (
        <PersonRow key={root.id} person={root} depth={0}
          onSelect={selectPerson} selectedId={selectedPersonId} highlightId={highlightedPersonId}
          showGenerationOrder={hienThiThuTuDoi} />
      ))}
      {sortedRoots.length === 0 && (
        <p className="text-center text-gray-400 py-8">Chưa có người nào. Hãy thêm người đầu tiên.</p>
      )}
    </div>
  )
}
