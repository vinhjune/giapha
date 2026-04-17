import { useState, useEffect } from 'react'
import { useGiaphaStore } from '../store/useGiaphaStore'
import PersonPicker from './PersonPicker'
import { timVoChong } from '../utils/familyTree'
import type { Person, GioiTinh } from '../types/giapha'

interface Props {
  editPerson?: Person | null
  defaultBoId?: string
  onClose: () => void
}

interface FormState {
  hoTen: string
  gioiTinh: GioiTinh
  namSinh: string
  namMat: string
  queQuan: string
  tieuSu: string
  laThanhVienHo: boolean
  thuTuAnhChi: string
  boId: string
  meId: string
  voChongIds: string[]
}

const empty: FormState = {
  hoTen: '', gioiTinh: 'nam', namSinh: '', namMat: '',
  queQuan: '', tieuSu: '', laThanhVienHo: true, thuTuAnhChi: '',
  boId: '', meId: '', voChongIds: [],
}

export default function PersonForm({ editPerson, defaultBoId, onClose }: Props) {
  const { data, themNguoi, suaNguoi, acquireSoftLock, releaseSoftLock } = useGiaphaStore()
  const [form, setForm] = useState<FormState>(empty)
  const [pickerOpen, setPickerOpen] = useState<null | 'bo' | 'me' | 'vochong'>(null)
  const [multipleWives, setMultipleWives] = useState<string[]>([])

  useEffect(() => {
    if (editPerson) {
      setForm({
        hoTen: editPerson.hoTen,
        gioiTinh: editPerson.gioiTinh,
        namSinh: editPerson.namSinh?.nam?.toString() || '',
        namMat: editPerson.namMat?.nam?.toString() || '',
        queQuan: editPerson.queQuan || '',
        tieuSu: editPerson.tieuSu || '',
        laThanhVienHo: editPerson.laThanhVienHo,
        thuTuAnhChi: editPerson.thuTuAnhChi?.toString() || '',
        boId: editPerson.boId || '',
        meId: editPerson.meId || '',
        voChongIds: editPerson.honNhan.map(h => h.voChongId),
      })
    } else if (defaultBoId) {
      setForm(f => ({ ...f, boId: defaultBoId }))
    }
    acquireSoftLock()
    return () => releaseSoftLock()
  }, [])

  function handleBoSelected(person: Person) {
    if (!data) return
    setForm(f => ({ ...f, boId: person.id }))
    const wives = timVoChong(person.id, data)
    if (wives.length === 1) {
      setForm(f => ({ ...f, meId: wives[0] }))
    } else if (wives.length > 1) {
      setMultipleWives(wives)
    }
    setPickerOpen(null)
  }

  function handleMeSelected(person: Person) {
    if (!data) return
    setForm(f => ({ ...f, meId: person.id }))
    const husbands = timVoChong(person.id, data)
    if (husbands.length === 1) {
      setForm(f => ({ ...f, boId: husbands[0] }))
    }
    setPickerOpen(null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.hoTen.trim()) return

    const personData: Omit<Person, 'id'> = {
      hoTen: form.hoTen.trim(),
      gioiTinh: form.gioiTinh,
      namSinh: form.namSinh ? { nam: parseInt(form.namSinh) } : undefined,
      namMat: form.namMat ? { nam: parseInt(form.namMat) } : undefined,
      queQuan: form.queQuan || undefined,
      tieuSu: form.tieuSu || undefined,
      laThanhVienHo: form.gioiTinh === 'nu' ? form.laThanhVienHo : true,
      thuTuAnhChi: form.thuTuAnhChi ? parseInt(form.thuTuAnhChi) : undefined,
      boId: form.boId || undefined,
      meId: form.meId || undefined,
      honNhan: form.voChongIds.map(id => ({ voChongId: id })),
      conCaiIds: editPerson?.conCaiIds || [],
    }

    if (editPerson) {
      suaNguoi(editPerson.id, personData)
    } else {
      themNguoi(personData)
    }
    onClose()
  }

  const getName = (id: string) => data?.persons[id]?.hoTen || ''

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-xl w-[480px] max-h-[90vh] flex flex-col">
          <div className="flex justify-between items-center px-4 py-3 border-b">
            <h3 className="font-semibold">{editPerson ? 'Sửa thông tin' : 'Thêm người mới'}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
          </div>

          <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-4 py-3 space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Họ tên *</label>
              <input
                autoFocus
                required
                value={form.hoTen}
                onChange={e => setForm(f => ({ ...f, hoTen: e.target.value }))}
                className="mt-1 w-full px-3 py-1.5 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Giới tính</label>
              <div className="mt-1 flex gap-3">
                {(['nam', 'nu', 'khac'] as GioiTinh[]).map(g => (
                  <label key={g} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="radio" name="gioiTinh" value={g} checked={form.gioiTinh === g}
                      onChange={() => setForm(f => ({ ...f, gioiTinh: g }))} />
                    {g === 'nam' ? 'Nam' : g === 'nu' ? 'Nữ' : 'Khác'}
                  </label>
                ))}
              </div>
            </div>

            {form.gioiTinh === 'nu' && (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.laThanhVienHo}
                  onChange={e => setForm(f => ({ ...f, laThanhVienHo: e.target.checked }))} />
                Thuộc dòng họ (không lấy chồng ngoài)
              </label>
            )}

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700">Năm sinh</label>
                <input type="number" value={form.namSinh} min={1800} max={new Date().getFullYear()}
                  onChange={e => setForm(f => ({ ...f, namSinh: e.target.value }))}
                  className="mt-1 w-full px-3 py-1.5 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700">Năm mất</label>
                <input type="number" value={form.namMat} min={1800} max={new Date().getFullYear()}
                  onChange={e => setForm(f => ({ ...f, namMat: e.target.value }))}
                  className="mt-1 w-full px-3 py-1.5 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Thứ tự anh chị em</label>
              <input type="number" value={form.thuTuAnhChi} min={1}
                onChange={e => setForm(f => ({ ...f, thuTuAnhChi: e.target.value }))}
                className="mt-1 w-24 px-3 py-1.5 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Bố</label>
              <div className="mt-1 flex gap-2">
                <div className="flex-1 px-3 py-1.5 text-sm border rounded bg-gray-50 text-gray-700">
                  {form.boId ? getName(form.boId) : <span className="text-gray-400">Chưa chọn</span>}
                </div>
                <button type="button" onClick={() => setPickerOpen('bo')}
                  className="px-3 py-1.5 text-sm bg-gray-100 border rounded hover:bg-gray-200">Chọn</button>
                {form.boId && <button type="button" onClick={() => setForm(f => ({ ...f, boId: '' }))}
                  className="px-2 text-gray-400 hover:text-red-500">&times;</button>}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Mẹ</label>
              <div className="mt-1 flex gap-2">
                {multipleWives.length > 1 && !form.meId ? (
                  <select onChange={e => setForm(f => ({ ...f, meId: e.target.value }))}
                    className="flex-1 px-3 py-1.5 text-sm border rounded">
                    <option value="">-- Chọn mẹ --</option>
                    {multipleWives.map(id => (
                      <option key={id} value={id}>{getName(id)}</option>
                    ))}
                  </select>
                ) : (
                  <div className="flex-1 px-3 py-1.5 text-sm border rounded bg-gray-50 text-gray-700">
                    {form.meId ? getName(form.meId) : <span className="text-gray-400">Chưa chọn</span>}
                  </div>
                )}
                <button type="button" onClick={() => setPickerOpen('me')}
                  className="px-3 py-1.5 text-sm bg-gray-100 border rounded hover:bg-gray-200">Chọn</button>
                {form.meId && <button type="button" onClick={() => setForm(f => ({ ...f, meId: '' }))}
                  className="px-2 text-gray-400 hover:text-red-500">&times;</button>}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Vợ/Chồng</label>
              <div className="mt-1 space-y-1">
                {form.voChongIds.map(id => (
                  <div key={id} className="flex items-center gap-2">
                    <span className="flex-1 text-sm px-3 py-1 border rounded bg-gray-50">{getName(id)}</span>
                    <button type="button" onClick={() => setForm(f => ({ ...f, voChongIds: f.voChongIds.filter(v => v !== id) }))}
                      className="text-gray-400 hover:text-red-500">&times;</button>
                  </div>
                ))}
                <button type="button" onClick={() => setPickerOpen('vochong')}
                  className="text-sm text-blue-600 hover:underline">+ Thêm vợ/chồng</button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Quê quán</label>
              <input value={form.queQuan} onChange={e => setForm(f => ({ ...f, queQuan: e.target.value }))}
                className="mt-1 w-full px-3 py-1.5 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Tiểu sử</label>
              <textarea value={form.tieuSu} onChange={e => setForm(f => ({ ...f, tieuSu: e.target.value }))} rows={3}
                className="mt-1 w-full px-3 py-1.5 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit"
                className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700">
                {editPerson ? 'Lưu thay đổi' : 'Thêm'}
              </button>
              <button type="button" onClick={onClose}
                className="flex-1 py-2 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200">
                Hủy
              </button>
            </div>
          </form>
        </div>
      </div>

      {pickerOpen === 'bo' && (
        <PersonPicker title="Chọn bố" excludeIds={[...(form.meId ? [form.meId] : [])]}
          onSelect={handleBoSelected} onClose={() => setPickerOpen(null)} />
      )}
      {pickerOpen === 'me' && (
        <PersonPicker title="Chọn mẹ" excludeIds={[...(form.boId ? [form.boId] : [])]}
          onSelect={handleMeSelected} onClose={() => setPickerOpen(null)} />
      )}
      {pickerOpen === 'vochong' && (
        <PersonPicker title="Chọn vợ/chồng" excludeIds={[editPerson?.id || '', ...form.voChongIds].filter(Boolean)}
          onSelect={p => { setForm(f => ({ ...f, voChongIds: [...f.voChongIds, p.id] })); setPickerOpen(null) }}
          onClose={() => setPickerOpen(null)} />
      )}
    </>
  )
}
