import { useGiaphaStore } from '../store/useGiaphaStore'
import type { Person } from '../types/giapha'

function formatNgay(d?: { nam?: number; thang?: number; ngay?: number }) {
  if (!d) return '—'
  const parts = []
  if (d.ngay)  parts.push(String(d.ngay).padStart(2, '0'))
  if (d.thang) parts.push(String(d.thang).padStart(2, '0'))
  if (d.nam)   parts.push(d.nam)
  return parts.join('/') || '—'
}

interface Props {
  onEdit: (person: Person) => void
}

export default function PersonDetail({ onEdit }: Props) {
  const { data, selectedPersonId, currentRole, selectPerson, xoaNguoi } = useGiaphaStore()
  if (!selectedPersonId || !data) return null
  const person = data.persons[selectedPersonId]
  if (!person) return null

  const canEdit = currentRole === 'admin' || currentRole === 'editor'
  const personId = selectedPersonId // capture non-null value for closure

  const bo = person.boId ? data.persons[person.boId] : null
  const me = person.meId ? data.persons[person.meId] : null
  const voChong = person.honNhan.map(h => data.persons[h.voChongId]).filter(Boolean)
  const conCai = person.conCaiIds.map(id => data.persons[id]).filter(Boolean)

  function handleDelete() {
    if (!confirm(`Xóa ${person.hoTen}?`)) return
    xoaNguoi(personId)
    selectPerson(null)
  }

  return (
    <aside className="w-80 bg-white border-l border-gray-200 p-4 overflow-y-auto">
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-lg font-bold text-gray-800">{person.hoTen}</h2>
        <button onClick={() => selectPerson(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
      </div>

      <dl className="space-y-2 text-sm">
        <div className="flex gap-2">
          <dt className="text-gray-500 w-24">Giới tính:</dt>
          <dd>{person.gioiTinh === 'nam' ? 'Nam' : person.gioiTinh === 'nu' ? 'Nữ' : 'Khác'}</dd>
        </div>
        {person.email && (
          <div className="flex gap-2">
            <dt className="text-gray-500 w-24">Email:</dt>
            <dd>{person.email}</dd>
          </div>
        )}
        {person.soDienThoai && (
          <div className="flex gap-2">
            <dt className="text-gray-500 w-24">Điện thoại:</dt>
            <dd>{person.soDienThoai}</dd>
          </div>
        )}
        <div className="flex gap-2">
          <dt className="text-gray-500 w-24">Ngày sinh:</dt>
          <dd>{formatNgay(person.namSinh)}</dd>
        </div>
        {person.namMat && (
          <div className="flex gap-2">
            <dt className="text-gray-500 w-24">Ngày mất:</dt>
            <dd>{formatNgay(person.namMat)}</dd>
          </div>
        )}
        {person.queQuan && (
          <div className="flex gap-2">
            <dt className="text-gray-500 w-24">Quê quán:</dt>
            <dd>{person.queQuan}</dd>
          </div>
        )}
        {bo && (
          <div className="flex gap-2">
            <dt className="text-gray-500 w-24">Bố:</dt>
            <dd><button className="text-blue-600 hover:underline" onClick={() => selectPerson(bo.id)}>{bo.hoTen}</button></dd>
          </div>
        )}
        {me && (
          <div className="flex gap-2">
            <dt className="text-gray-500 w-24">Mẹ:</dt>
            <dd><button className="text-blue-600 hover:underline" onClick={() => selectPerson(me.id)}>{me.hoTen}</button></dd>
          </div>
        )}
        {voChong.length > 0 && (
          <div className="flex gap-2">
            <dt className="text-gray-500 w-24">Vợ/Chồng:</dt>
            <dd className="flex flex-col gap-0.5">
              {voChong.map(v => (
                <button key={v!.id} className="text-blue-600 hover:underline text-left" onClick={() => selectPerson(v!.id)}>{v!.hoTen}</button>
              ))}
            </dd>
          </div>
        )}
        {conCai.length > 0 && (
          <div className="flex gap-2">
            <dt className="text-gray-500 w-24">Con cái:</dt>
            <dd className="flex flex-col gap-0.5">
              {conCai.map(c => (
                <button key={c!.id} className="text-blue-600 hover:underline text-left" onClick={() => selectPerson(c!.id)}>{c!.hoTen}</button>
              ))}
            </dd>
          </div>
        )}
        {person.tieuSu && (
          <div>
            <dt className="text-gray-500 mb-1">Tiểu sử:</dt>
            <dd className="text-gray-700 whitespace-pre-wrap">{person.tieuSu}</dd>
          </div>
        )}
      </dl>

      {canEdit && (
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => onEdit(person)}
            className="flex-1 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          >
            Sửa
          </button>
          <button
            onClick={handleDelete}
            className="flex-1 py-1.5 bg-red-50 text-red-600 text-sm rounded border border-red-200 hover:bg-red-100"
          >
            Xóa
          </button>
        </div>
      )}
    </aside>
  )
}
