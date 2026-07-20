import { useState, useMemo } from 'react'
import { useGiaphaStore } from '../store/useGiaphaStore'
import PersonPicker from './PersonPicker'
import NgayThangInput from './NgayThangInput'
import { timVoChong } from '../utils/familyTree'
import type { Person, GioiTinh, NgayThang } from '../types/giapha'

interface Props {
  editPerson?: Person | null
  defaultBoId?: string
  onClose: () => void
}

interface FormState {
  hoTen: string
  gioiTinh: GioiTinh
  email: string
  soDienThoai: string
  namSinh: NgayThang | undefined
  namMat: NgayThang | undefined
  queQuan: string
  tieuSu: string
  laThanhVienHo: boolean
  thuTuAnhChi: string
  boId?: string
  meId?: string
  voChongIds: string[]
}

const empty: FormState = {
  hoTen: '', gioiTinh: 'nam', email: '', soDienThoai: '', namSinh: undefined, namMat: undefined,
  queQuan: '', tieuSu: '', laThanhVienHo: true, thuTuAnhChi: '',
  boId: undefined, meId: undefined, voChongIds: [],
}

export default function PersonForm({ editPerson, defaultBoId, onClose }: Props) {
  const { data, themNguoi, suaNguoi, xoaNguoi, selectPerson } = useGiaphaStore()

  const [form, setForm] = useState<FormState>(() => {
    if (editPerson) {
      return {
        hoTen: editPerson.hoTen,
        gioiTinh: editPerson.gioiTinh,
        email: editPerson.email || '',
        soDienThoai: editPerson.soDienThoai || '',
        namSinh: editPerson.namSinh,
        namMat: editPerson.namMat,
        queQuan: editPerson.queQuan || '',
        tieuSu: editPerson.tieuSu || '',
        laThanhVienHo: editPerson.laThanhVienHo,
        thuTuAnhChi: editPerson.thuTuAnhChi?.toString() || '',
        boId: editPerson.boId,
        meId: editPerson.meId,
        voChongIds: editPerson.honNhan.map(h => h.voChongId),
      }
    } else if (defaultBoId) {
      return { ...empty, boId: defaultBoId }
    }
    return empty
  })

  const [initialForm] = useState<FormState>(() => form)
  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initialForm),
    [form, initialForm],
  )

  const getPerson = (id?: string): Person | undefined => (id ? data?.persons[id] : undefined)

  async function handleNavigateTo(target: Person) {
    if (!isDirty) {
      selectPerson(target.id)
      return
    }
    const currentName = editPerson ? editPerson.hoTen : (form.hoTen.trim() || '(người mới)')
    const confirmed = confirm(
      `Bạn có thay đổi chưa lưu cho "${currentName}". Lưu lại trước khi chuyển sang xem "${target.hoTen}"?`,
    )
    if (!confirmed) return
    const saved = await trySave()
    if (saved) selectPerson(target.id)
  }

  const [pickerOpen, setPickerOpen] = useState<null | 'bo' | 'me' | 'vochong' | 'anhchiem'>(null)
  const [multipleWives, setMultipleWives] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [anhChiEmFeedback, setAnhChiEmFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const currentSiblings = useMemo(() => {
    if (!data || (!form.boId && !form.meId)) return []
    return Object.values(data.persons).filter(p => {
      if (editPerson && p.id === editPerson.id) return false
      return p.boId === form.boId && p.meId === form.meId
    })
  }, [data, form.boId, form.meId, editPerson])

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

  function handleVoChongSelected(person: Person) {
    setForm(f => {
      const nextVoChongIds = [...f.voChongIds, person.id]
      const shouldAutoMarkNgoaiHo = !editPerson && person.laThanhVienHo
      return {
        ...f,
        voChongIds: nextVoChongIds,
        laThanhVienHo: shouldAutoMarkNgoaiHo ? false : f.laThanhVienHo,
      }
    })
    setPickerOpen(null)
  }

  async function handleXoaNguoi() {
    if (!editPerson) return
    const confirmed = confirm(`Bạn có chắc muốn xóa "${editPerson.hoTen}" không? Hành động này không thể hoàn tác.`)
    if (!confirmed) return
    try {
      await xoaNguoi(editPerson.id)
      onClose()
    } catch (err) {
      alert('Không thể xóa: ' + (err as Error).message)
    }
  }

  async function handleAnhChiEmSelected(person: Person) {
    setPickerOpen(null)
    setAnhChiEmFeedback(null)

    const currentBoId = form.boId
    const currentMeId = form.meId

    if (!currentBoId && !currentMeId) {
      setAnhChiEmFeedback({ type: 'error', msg: 'Cần chọn bố hoặc mẹ trước khi thêm anh/chị/em.' })
      return
    }

    const sibBoId = person.boId
    const sibMeId = person.meId

    if (sibBoId === currentBoId && sibMeId === currentMeId) {
      setAnhChiEmFeedback({ type: 'success', msg: `${person.hoTen} đã là anh/chị/em.` })
      return
    }

    if (!sibBoId && !sibMeId) {
      const confirmed = confirm(`Bố/mẹ của ${person.hoTen} đang trống. Cập nhật bố/mẹ cho ${person.hoTen}?`)
      if (!confirmed) return
      const { id: _id, ...personRest } = person
      try {
        await suaNguoi(person.id, { ...personRest, boId: currentBoId, meId: currentMeId })
        setAnhChiEmFeedback({ type: 'success', msg: `Đã cập nhật bố/mẹ cho ${person.hoTen}.` })
      } catch (err) {
        setAnhChiEmFeedback({ type: 'error', msg: 'Không thể cập nhật: ' + (err as Error).message })
      }
      return
    }

    setAnhChiEmFeedback({ type: 'error', msg: `Bố/mẹ của ${person.hoTen} không trùng khớp. Không thể thêm làm anh/chị/em.` })
  }

  async function trySave(): Promise<boolean> {
    if (!form.hoTen.trim()) return false
    if (!editPerson && (!form.boId || !form.meId)) {
      const shouldContinue = confirm('Chưa nhập đủ thông tin bố và mẹ thành viên. Bạn có thể bổ sung sau. Bạn có chắc muốn lưu không?')
      if (!shouldContinue) return false
    }

    const personData: Omit<Person, 'id'> = {
      hoTen: form.hoTen.trim(),
      gioiTinh: form.gioiTinh,
      email: form.email.trim() || undefined,
      soDienThoai: form.soDienThoai.trim() || undefined,
      namSinh: form.namSinh,
      namMat: form.namMat,
      queQuan: form.queQuan || undefined,
      tieuSu: form.tieuSu || undefined,
      laThanhVienHo: form.laThanhVienHo,
      thuTuAnhChi: form.thuTuAnhChi ? parseInt(form.thuTuAnhChi) : undefined,
      boId: form.boId,
      meId: form.meId,
      honNhan: form.voChongIds.map(id => ({ voChongId: id })),
      conCaiIds: editPerson?.conCaiIds || [],
    }

    setSaving(true)
    try {
      if (editPerson) {
        await suaNguoi(editPerson.id, personData)
      } else {
        await themNguoi(personData)
      }
      return true
    } catch (err) {
      alert('Không thể lưu: ' + (err as Error).message)
      return false
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const saved = await trySave()
    if (saved) onClose()
  }

  const getName = (id: string) => data?.persons[id]?.hoTen || ''

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40 flex items-end justify-center p-2 sm:items-center sm:p-4">
        <div data-testid="person-form-modal" className="bg-white rounded-lg shadow-xl w-full max-w-[480px] max-h-[100dvh] sm:max-h-[90vh] flex flex-col">
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

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="mt-1 w-full px-3 py-1.5 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700">Số điện thoại</label>
                <input
                  value={form.soDienThoai}
                  onChange={e => setForm(f => ({ ...f, soDienThoai: e.target.value }))}
                  className="mt-1 w-full px-3 py-1.5 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={!form.laThanhVienHo}
                onChange={e => setForm(f => ({ ...f, laThanhVienHo: !e.target.checked }))}
              />
              Người ngoài họ
            </label>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700">Ngày sinh</label>
                <div className="mt-1">
                  <NgayThangInput value={form.namSinh} onChange={v => setForm(f => ({ ...f, namSinh: v }))} testIdPrefix="ngaySinh" />
                </div>
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700">Ngày mất</label>
                <div className="mt-1">
                  <NgayThangInput value={form.namMat} onChange={v => setForm(f => ({ ...f, namMat: v }))} testIdPrefix="ngayMat" />
                </div>
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
              <div className="mt-1 flex flex-wrap gap-2">
                {getPerson(form.boId) ? (
                  <button
                    type="button"
                    title={`Xem/sửa ${getName(form.boId!)}`}
                    onClick={() => handleNavigateTo(getPerson(form.boId)!)}
                    className="flex-1 px-3 py-1.5 text-sm border rounded bg-gray-50 text-left text-gray-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
                  >
                    {getName(form.boId!)}
                  </button>
                ) : (
                  <div className="flex-1 px-3 py-1.5 text-sm border rounded bg-gray-50 text-gray-400">Chưa chọn</div>
                )}
                <button type="button" onClick={() => setPickerOpen('bo')}
                  className="px-3 py-1.5 text-sm bg-gray-100 border rounded hover:bg-gray-200">Chọn</button>
                {form.boId && <button type="button" onClick={() => setForm(f => ({ ...f, boId: undefined }))}
                  className="px-2 text-gray-400 hover:text-red-500">&times;</button>}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Mẹ</label>
              <div className="mt-1 flex flex-wrap gap-2">
                {multipleWives.length > 1 && !form.meId ? (
                  <select onChange={e => setForm(f => ({ ...f, meId: e.target.value || undefined }))}
                    className="flex-1 px-3 py-1.5 text-sm border rounded">
                    <option value="">-- Chọn mẹ --</option>
                    {multipleWives.map(id => (
                      <option key={id} value={id}>{getName(id)}</option>
                    ))}
                  </select>
                ) : getPerson(form.meId) ? (
                  <button
                    type="button"
                    title={`Xem/sửa ${getName(form.meId!)}`}
                    onClick={() => handleNavigateTo(getPerson(form.meId)!)}
                    className="flex-1 px-3 py-1.5 text-sm border rounded bg-gray-50 text-left text-gray-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
                  >
                    {getName(form.meId!)}
                  </button>
                ) : (
                  <div className="flex-1 px-3 py-1.5 text-sm border rounded bg-gray-50 text-gray-400">Chưa chọn</div>
                )}
                <button type="button" onClick={() => setPickerOpen('me')}
                  className="px-3 py-1.5 text-sm bg-gray-100 border rounded hover:bg-gray-200">Chọn</button>
                {form.meId && <button type="button" onClick={() => setForm(f => ({ ...f, meId: undefined }))}
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
              <label className="text-sm font-medium text-gray-700">Anh/Chị/Em</label>
              <div className="mt-1 space-y-1">
                {currentSiblings.map(p => (
                  <div key={p.id} className="text-sm px-3 py-1 border rounded bg-gray-50 text-gray-700">
                    {p.hoTen}
                  </div>
                ))}
                {anhChiEmFeedback && (
                  <div className={`text-sm px-3 py-1.5 rounded ${anhChiEmFeedback.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {anhChiEmFeedback.msg}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => { setAnhChiEmFeedback(null); setPickerOpen('anhchiem') }}
                  className="text-sm text-blue-600 hover:underline"
                >
                  + Thêm anh/chị/em
                </button>
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

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <button type="submit" disabled={saving}
                className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Đang lưu...' : editPerson ? 'Lưu thay đổi' : 'Thêm'}
              </button>
              <button type="button" onClick={onClose}
                className="flex-1 py-2 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200">
                Hủy
              </button>
              {editPerson && (
                <button type="button" onClick={handleXoaNguoi}
                  className="py-2 px-4 bg-red-50 text-red-600 text-sm rounded hover:bg-red-100 border border-red-200">
                  Xoá
                </button>
              )}
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
        <PersonPicker title="Chọn vợ/chồng" excludeIds={[...(editPerson ? [editPerson.id] : []), ...form.voChongIds]}
          onSelect={handleVoChongSelected}
          onClose={() => setPickerOpen(null)} />
      )}
      {pickerOpen === 'anhchiem' && (
        <PersonPicker
          title="Chọn anh/chị/em"
          excludeIds={[
            ...(editPerson ? [editPerson.id] : []),
            ...(form.boId ? [form.boId] : []),
            ...(form.meId ? [form.meId] : []),
            ...form.voChongIds,
          ]}
          onSelect={handleAnhChiEmSelected}
          onClose={() => setPickerOpen(null)}
        />
      )}
    </>
  )
}
