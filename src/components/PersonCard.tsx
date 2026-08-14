import type { Person } from '../types/giapha'
import { useAuthStore } from '../store/useAuthStore'

interface Props {
  person: Person
  displayName?: string
  isSelected: boolean
  isHighlighted?: boolean
  isSpouse?: boolean
  onClick: () => void
}

const AVATAR_COLOR_BY_GENDER = { nam: 'bg-nam', nu: 'bg-nu', khac: 'bg-nam' } as const

export default function PersonCard({ person, displayName, isSelected, isHighlighted = false, isSpouse = false, onClick }: Props) {
  // Mirrors ListView: the badge marks an actual married-in spouse (honNhan link),
  // not any non-clan blood descendant (e.g. a granddaughter through a daughter's line).
  const isMarriedIn = isSpouse && !person.laThanhVienHo
  const { user } = useAuthStore()
  const showPendingBadge = !!person.pendingRequestId && !!user
  const name = displayName ?? person.hoTen
  const avatarColorClass = AVATAR_COLOR_BY_GENDER[person.gioiTinh] ?? AVATAR_COLOR_BY_GENDER.khac

  return (
    <div
      onClick={onClick}
      className={`
        relative w-full h-full rounded-xl border p-2 cursor-pointer text-left
        ${isSpouse ? 'bg-card-spouse' : 'bg-card'} shadow-sm transition-all hover:shadow-md hover:-translate-y-px
        ${isSelected ? 'outline outline-2 outline-accent outline-offset-1 bg-accent-soft border-accent-soft' : 'border-card-border'}
        ${isHighlighted && !isSelected ? 'ring-2 ring-highlight' : ''}
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
      {showPendingBadge && (
        <span
          aria-label="Đang chờ duyệt"
          title="Đang chờ duyệt"
          className="absolute -top-2 left-2 text-[11px] leading-none bg-amber-100 text-amber-700 border border-amber-300 rounded-full px-1.5 py-0.5"
        >
          ⏳
        </span>
      )}
      <div className="flex items-center gap-2">
        {person.anhDaiDien ? (
          <img
            data-testid="person-avatar"
            src={person.anhDaiDien}
            alt=""
            className={`w-6 h-6 rounded-full flex-none object-cover ring-2 ring-card ${avatarColorClass}`}
          />
        ) : (
          // No photo yet: show a plain color dot (nam/nu) instead of a
          // letter — an initial-letter badge was removed because it was
          // computed from the display name (which can include a "(...)"
          // note or a "(#N)" generation suffix), making it show a
          // meaningless "(" for most people instead of a real initial.
          <div
            data-testid="person-avatar"
            aria-hidden="true"
            className={`w-6 h-6 rounded-full flex-none ring-2 ring-card ${avatarColorClass}`}
          />
        )}
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
          {person.namSinh?.amLich && <span className="ml-0.5 text-amber-600">ÂL</span>}
          {person.namMat && <span className="ml-1 text-muted">†</span>}
        </div>
      )}
    </div>
  )
}
