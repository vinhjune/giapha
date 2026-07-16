import type { Person } from '../types/giapha'

interface Props {
  person: Person
  displayName?: string
  isSelected: boolean
  isHighlighted?: boolean
  isSpouse?: boolean
  onClick: () => void
}

const AVATAR_COLOR_BY_GENDER = { nam: 'bg-nam', nu: 'bg-nu', khac: 'bg-nam' } as const

function getInitial(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts[parts.length - 1]?.[0]?.toUpperCase() ?? '?'
}

export default function PersonCard({ person, displayName, isSelected, isHighlighted = false, isSpouse = false, onClick }: Props) {
  // Mirrors ListView: the badge marks an actual married-in spouse (honNhan link),
  // not any non-clan blood descendant (e.g. a granddaughter through a daughter's line).
  const isMarriedIn = isSpouse && !person.laThanhVienHo
  const name = displayName ?? person.hoTen
  const avatarColorClass = AVATAR_COLOR_BY_GENDER[person.gioiTinh] ?? AVATAR_COLOR_BY_GENDER.khac

  return (
    <div
      onClick={onClick}
      className={`
        relative w-full h-full rounded-xl border p-2 cursor-pointer text-left
        bg-card shadow-sm transition-all hover:shadow-md hover:-translate-y-px
        ${isSelected ? 'outline outline-2 outline-accent outline-offset-1 bg-accent-soft border-accent-soft' : 'border-card-border'}
        ${isHighlighted && !isSelected ? 'ring-2 ring-blue-400' : ''}
      `}
    >
      {isMarriedIn && (
        <span
          aria-label="Vợ/chồng"
          className="absolute -top-2 right-2 text-[11px] leading-none bg-card border border-card-border rounded-full px-1.5 py-0.5"
        >
          💍
        </span>
      )}
      <div className="flex items-center gap-2">
        <div
          data-testid="person-avatar"
          className={`w-6 h-6 rounded-full flex-none flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-card ${avatarColorClass}`}
        >
          {getInitial(name)}
        </div>
        <div className="text-xs font-semibold leading-tight text-ink whitespace-nowrap">
          {name}
        </div>
      </div>
      {(person.namSinh || person.namMat) && (
        <div className="text-[10px] text-muted mt-0.5 pl-8">
          {[
            person.namSinh?.ngay ? String(person.namSinh.ngay).padStart(2, '0') : null,
            person.namSinh?.thang ? String(person.namSinh.thang).padStart(2, '0') : null,
            person.namSinh?.nam ? String(person.namSinh.nam) : null,
          ].filter(Boolean).join('/')}
          {person.namMat && <span className="ml-1 text-slate-400">†</span>}
        </div>
      )}
    </div>
  )
}
