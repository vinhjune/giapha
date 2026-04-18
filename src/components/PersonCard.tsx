import type { Person } from '../types/giapha'

interface Props {
  person: Person
  isSelected: boolean
  onClick: () => void
}

const CLAN_BACKGROUND_BY_GENDER = { nam: 'bg-blue-100', nu: 'bg-pink-100', khac: 'bg-blue-100' } as const
const NON_CLAN_BACKGROUND_BY_GENDER = { nam: 'bg-purple-100', nu: 'bg-yellow-100', khac: 'bg-yellow-100' } as const

export default function PersonCard({ person, isSelected, onClick }: Props) {
  const isClan = person.laThanhVienHo
  const backgroundByGroup = isClan
    ? CLAN_BACKGROUND_BY_GENDER
    : NON_CLAN_BACKGROUND_BY_GENDER
  const backgroundClass = backgroundByGroup[person.gioiTinh] ?? backgroundByGroup.khac
  return (
    <div
      onClick={onClick}
      className={`
        w-full min-h-[56px] rounded-lg border-2 px-2 py-1.5 cursor-pointer text-center shadow-sm transition-all
        ${backgroundClass}
        ${isSelected ? 'border-blue-500' : isClan ? 'border-gray-300 hover:border-blue-300' : 'border-dashed border-gray-200'}
      `}
    >
      <div className="text-xs font-semibold leading-tight text-gray-800 whitespace-nowrap">
        {person.hoTen}
      </div>
      {person.namSinh && (
        <div className="text-[10px] text-gray-400 mt-0.5">
          {[
            person.namSinh.ngay  ? String(person.namSinh.ngay).padStart(2,'0')  : null,
            person.namSinh.thang ? String(person.namSinh.thang).padStart(2,'0') : null,
            person.namSinh.nam   ? String(person.namSinh.nam) : null,
          ].filter(Boolean).join('/')}
        </div>
      )}
      {person.namMat && (
        <div className="text-[10px] text-gray-300">†</div>
      )}
    </div>
  )
}
