# Điều hướng quan hệ trong Modal Sửa thành viên — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trong modal Sửa/Thêm thành viên (`PersonForm.tsx`), cho phép click vào tên của Bố, Mẹ, từng Vợ/Chồng, từng Anh/Chị/Em để chuyển modal sang xem/sửa người đó và tự focus người đó trên cây phía sau (giống hành vi tìm kiếm hiện tại) — có xác nhận lưu nếu đang có thay đổi chưa lưu. Đồng thời thêm danh sách "Con" (view + "+ Thêm con") vào modal, hoạt động tương tự Anh/Chị/Em.

**Architecture:** Toàn bộ thay đổi tập trung ở `src/components/PersonForm.tsx` (logic điều hướng, dirty-tracking, danh sách Con) và một sửa nhỏ tại `src/pages/HomePage.tsx` (thêm `key` để modal remount đúng khi chuyển người trong lúc đang mở). Không cần thay đổi store (`useGiaphaStore.selectPerson` đã set cả `selectedPersonId` và `focusedPersonId`, và `TreeView.tsx` đã có effect tự scroll/focus theo `focusedPersonId` — tái sử dụng nguyên trạng).

**Tech Stack:** React 19 + TypeScript, Zustand store (`useGiaphaStore`), Vitest + @testing-library/react.

**Lưu ý quan trọng so với spec gốc (`docs/superpowers/specs/2026-07-20-person-form-navigation-design.md`):** Spec liệt kê `excludeIds` của picker "+ Thêm con" gồm cả các con hiện có (`editPerson.conCaiIds`). Khi lập plan, đối chiếu với cách picker "+ Thêm anh/chị/em" hiện tại hoạt động (xem `PersonForm.tsx:403-415`) thì picker đó **không** loại các anh/chị/em đã có sẵn — nó dựa vào logic trong `handleAnhChiEmSelected` để tự phát hiện "đã là anh/chị/em" và hiển thị thông báo phù hợp. Để giữ nhất quán với pattern này (và để nhánh "đã là con" có thể test được qua UI), plan này **không loại `conCaiIds` khỏi `excludeIds`** của picker "Chọn con" — logic trùng lặp được xử lý trong `confirmLinkChild` (Task 7), tương đương thiết kế đã duyệt.

---

### Task 1: Refactor `handleSubmit` thành `trySave()`

**Files:**
- Modify: `src/components/PersonForm.tsx:158-196`

Đây là bước refactor thuần (không đổi hành vi), tạo hàm `trySave(): Promise<boolean>` để tái sử dụng cho cả nút Submit và luồng điều hướng ở các task sau.

- [ ] **Step 1: Thay `handleSubmit` hiện tại**

Tìm đoạn code này trong `src/components/PersonForm.tsx`:

```tsx
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.hoTen.trim()) return
    if (!editPerson && (!form.boId || !form.meId)) {
      const shouldContinue = confirm('Chưa nhập đủ thông tin bố và mẹ thành viên. Bạn có thể bổ sung sau. Bạn có chắc muốn lưu không?')
      if (!shouldContinue) return
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
      onClose()
    } catch (err) {
      alert('Không thể lưu: ' + (err as Error).message)
    } finally {
      setSaving(false)
    }
  }
```

Thay bằng:

```tsx
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
```

- [ ] **Step 2: Chạy bộ test hiện có để xác nhận không có gì bị hỏng (refactor thuần)**

Run: `npx vitest run src/components/PersonForm.test.tsx`
Expected: Toàn bộ test PASS (không có test nào bị thay đổi ở bước này).

- [ ] **Step 3: Commit**

```bash
git add src/components/PersonForm.tsx
git commit -m "refactor: extract trySave() from PersonForm's handleSubmit"
```

---

### Task 2: Thêm theo dõi thay đổi chưa lưu (`isDirty`) + `handleNavigateTo` + gắn vào trường Bố

**Files:**
- Modify: `src/components/PersonForm.tsx`
- Test: `src/components/PersonForm.test.tsx`

- [ ] **Step 1: Viết test thất bại cho điều hướng qua trường Bố**

Thêm vào cuối `src/components/PersonForm.test.tsx`:

```tsx
describe('PersonForm relation navigation - Bố', () => {
  const initialState = useGiaphaStore.getState()

  afterEach(() => {
    act(() => {
      useGiaphaStore.setState(initialState, true)
    })
    vi.restoreAllMocks()
  })

  const relationData: GiaphaData = {
    metadata: {} as GiaphaData['metadata'],
    persons: {
      '1': { id: '1', hoTen: 'Ông Nội', gioiTinh: 'nam', laThanhVienHo: true, honNhan: [], conCaiIds: ['3'] },
      '2': { id: '2', hoTen: 'Bà Nội', gioiTinh: 'nu', laThanhVienHo: false, honNhan: [], conCaiIds: ['3'] },
      '3': { id: '3', hoTen: 'Con', gioiTinh: 'nam', laThanhVienHo: true, boId: '1', meId: '2', honNhan: [], conCaiIds: [] },
    },
  }
  const editPerson: Person = relationData.persons['3']

  it('navigates immediately to Bố when there are no unsaved changes', () => {
    const selectPerson = vi.fn()
    useGiaphaStore.setState({ data: relationData, selectPerson })

    const { getByRole } = render(<PersonForm editPerson={editPerson} onClose={() => {}} />)

    fireEvent.click(getByRole('button', { name: 'Ông Nội' }))

    expect(selectPerson).toHaveBeenCalledWith('1')
  })

  it('asks to save unsaved changes before navigating, and navigates after saving successfully', async () => {
    const selectPerson = vi.fn()
    const suaNguoi = vi.fn().mockResolvedValue(undefined)
    useGiaphaStore.setState({ data: relationData, selectPerson, suaNguoi })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    const { container, getByRole } = render(<PersonForm editPerson={editPerson} onClose={() => {}} />)
    const nameInput = container.querySelector('input[required]') as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: 'Con (đã sửa)' } })

    await act(async () => {
      fireEvent.click(getByRole('button', { name: 'Ông Nội' }))
    })

    expect(confirmSpy).toHaveBeenCalled()
    expect(suaNguoi).toHaveBeenCalledWith('3', expect.objectContaining({ hoTen: 'Con (đã sửa)' }))
    expect(selectPerson).toHaveBeenCalledWith('1')
  })

  it('stays on the current form and does not save when the user declines to navigate away', async () => {
    const selectPerson = vi.fn()
    const suaNguoi = vi.fn()
    useGiaphaStore.setState({ data: relationData, selectPerson, suaNguoi })
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    const { container, getByRole } = render(<PersonForm editPerson={editPerson} onClose={() => {}} />)
    const nameInput = container.querySelector('input[required]') as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: 'Con (đã sửa)' } })

    await act(async () => {
      fireEvent.click(getByRole('button', { name: 'Ông Nội' }))
    })

    expect(suaNguoi).not.toHaveBeenCalled()
    expect(selectPerson).not.toHaveBeenCalled()
    expect(nameInput.value).toBe('Con (đã sửa)')
  })
})
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run src/components/PersonForm.test.tsx -t "relation navigation - Bố"`
Expected: FAIL — chưa có `<button>` tên "Ông Nội" (trường Bố hiện render bằng `<div>`), và `handleNavigateTo` chưa tồn tại.

- [ ] **Step 3: Import `useRef`, lấy `selectPerson` từ store**

Đổi dòng 1:

```tsx
import { useState, useMemo } from 'react'
```

thành:

```tsx
import { useState, useMemo, useRef } from 'react'
```

Đổi dòng 37:

```tsx
  const { data, themNguoi, suaNguoi, xoaNguoi } = useGiaphaStore()
```

thành:

```tsx
  const { data, themNguoi, suaNguoi, xoaNguoi, selectPerson } = useGiaphaStore()
```

- [ ] **Step 4: Thêm `getPerson`, `initialFormRef`, `isDirty`, `handleNavigateTo`**

Ngay sau khối `const [form, setForm] = useState<FormState>(...)` (kết thúc ở dòng 60 hiện tại, trước dòng `const [pickerOpen, ...`), thêm:

```tsx
  const initialFormRef = useRef(form)
  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initialFormRef.current),
    [form],
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
```

- [ ] **Step 5: Gắn `handleNavigateTo` vào trường Bố (chuyển từ `<div>` sang `<button>` khi có người)**

Tìm khối này (dòng 285-296):

```tsx
            <div>
              <label className="text-sm font-medium text-gray-700">Bố</label>
              <div className="mt-1 flex flex-wrap gap-2">
                <div className="flex-1 px-3 py-1.5 text-sm border rounded bg-gray-50 text-gray-700">
                  {form.boId ? getName(form.boId) : <span className="text-gray-400">Chưa chọn</span>}
                </div>
                <button type="button" onClick={() => setPickerOpen('bo')}
                  className="px-3 py-1.5 text-sm bg-gray-100 border rounded hover:bg-gray-200">Chọn</button>
                {form.boId && <button type="button" onClick={() => setForm(f => ({ ...f, boId: undefined }))}
                  className="px-2 text-gray-400 hover:text-red-500">&times;</button>}
              </div>
            </div>
```

Thay bằng:

```tsx
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
```

- [ ] **Step 6: Chạy lại test, xác nhận PASS**

Run: `npx vitest run src/components/PersonForm.test.tsx`
Expected: Toàn bộ PASS, bao gồm 3 test mới.

- [ ] **Step 7: Commit**

```bash
git add src/components/PersonForm.tsx src/components/PersonForm.test.tsx
git commit -m "feat: navigate to Bố from PersonForm with unsaved-changes confirmation"
```

---

### Task 3: Gắn điều hướng vào trường Mẹ

**Files:**
- Modify: `src/components/PersonForm.tsx`
- Test: `src/components/PersonForm.test.tsx`

- [ ] **Step 1: Viết test thất bại**

Thêm vào `describe('PersonForm relation navigation - Bố', ...)` block đã tạo ở Task 2 (hoặc ngay sau nó) một test mới — chèn ngay sau test thứ 3 (trước dòng `})` đóng describe), sử dụng `relationData`/`editPerson` đã có sẵn trong scope:

```tsx
  it('navigates immediately to Mẹ when there are no unsaved changes', () => {
    const selectPerson = vi.fn()
    useGiaphaStore.setState({ data: relationData, selectPerson })

    const { getByRole } = render(<PersonForm editPerson={editPerson} onClose={() => {}} />)

    fireEvent.click(getByRole('button', { name: 'Bà Nội' }))

    expect(selectPerson).toHaveBeenCalledWith('2')
  })
```

- [ ] **Step 2: Chạy test, xác nhận thất bại**

Run: `npx vitest run src/components/PersonForm.test.tsx -t "navigates immediately to Mẹ"`
Expected: FAIL — trường Mẹ vẫn render bằng `<div>`.

- [ ] **Step 3: Gắn `handleNavigateTo` vào nhánh hiển thị (không phải nhánh `<select>` chọn mẹ khi có nhiều vợ) của trường Mẹ**

Tìm khối này (dòng 298-319):

```tsx
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
                ) : (
                  <div className="flex-1 px-3 py-1.5 text-sm border rounded bg-gray-50 text-gray-700">
                    {form.meId ? getName(form.meId) : <span className="text-gray-400">Chưa chọn</span>}
                  </div>
                )}
                <button type="button" onClick={() => setPickerOpen('me')}
                  className="px-3 py-1.5 text-sm bg-gray-100 border rounded hover:bg-gray-200">Chọn</button>
                {form.meId && <button type="button" onClick={() => setForm(f => ({ ...f, meId: undefined }))}
                  className="px-2 text-gray-400 hover:text-red-500">&times;</button>}
              </div>
            </div>
```

Thay bằng:

```tsx
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
```

- [ ] **Step 4: Chạy lại test, xác nhận PASS**

Run: `npx vitest run src/components/PersonForm.test.tsx`
Expected: Toàn bộ PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/PersonForm.tsx src/components/PersonForm.test.tsx
git commit -m "feat: navigate to Mẹ from PersonForm with unsaved-changes confirmation"
```

---

### Task 4: Gắn điều hướng vào từng Vợ/Chồng

**Files:**
- Modify: `src/components/PersonForm.tsx`
- Test: `src/components/PersonForm.test.tsx`

- [ ] **Step 1: Viết test thất bại**

Thêm describe mới vào cuối `src/components/PersonForm.test.tsx`:

```tsx
describe('PersonForm relation navigation - Vợ/Chồng', () => {
  const initialState = useGiaphaStore.getState()

  afterEach(() => {
    act(() => {
      useGiaphaStore.setState(initialState, true)
    })
  })

  const voChongData: GiaphaData = {
    metadata: {} as GiaphaData['metadata'],
    persons: {
      '1': { id: '1', hoTen: 'Chồng', gioiTinh: 'nam', laThanhVienHo: true, honNhan: [{ voChongId: '2' }], conCaiIds: [] },
      '2': { id: '2', hoTen: 'Vợ', gioiTinh: 'nu', laThanhVienHo: false, honNhan: [{ voChongId: '1' }], conCaiIds: [] },
    },
  }

  it('navigates to a spouse when their name is clicked, and the × button still removes without navigating', () => {
    const selectPerson = vi.fn()
    useGiaphaStore.setState({ data: voChongData, selectPerson })
    const editPerson = voChongData.persons['1']

    const { getByRole } = render(<PersonForm editPerson={editPerson} onClose={() => {}} />)

    fireEvent.click(getByRole('button', { name: 'Vợ' }))

    expect(selectPerson).toHaveBeenCalledWith('2')
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận thất bại**

Run: `npx vitest run src/components/PersonForm.test.tsx -t "navigates to a spouse"`
Expected: FAIL — tên vợ/chồng hiện render bằng `<span>`, không phải `<button>`.

- [ ] **Step 3: Gắn `handleNavigateTo` vào tên từng Vợ/Chồng**

Tìm khối này (dòng 321-334):

```tsx
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
```

Thay bằng:

```tsx
            <div>
              <label className="text-sm font-medium text-gray-700">Vợ/Chồng</label>
              <div className="mt-1 space-y-1">
                {form.voChongIds.map(id => {
                  const spouse = getPerson(id)
                  return (
                    <div key={id} className="flex items-center gap-2">
                      {spouse ? (
                        <button
                          type="button"
                          title={`Xem/sửa ${spouse.hoTen}`}
                          onClick={() => handleNavigateTo(spouse)}
                          className="flex-1 text-left text-sm px-3 py-1 border rounded bg-gray-50 text-gray-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
                        >
                          {spouse.hoTen}
                        </button>
                      ) : (
                        <span className="flex-1 text-sm px-3 py-1 border rounded bg-gray-50 text-gray-400">{getName(id)}</span>
                      )}
                      <button type="button" onClick={() => setForm(f => ({ ...f, voChongIds: f.voChongIds.filter(v => v !== id) }))}
                        className="text-gray-400 hover:text-red-500">&times;</button>
                    </div>
                  )
                })}
                <button type="button" onClick={() => setPickerOpen('vochong')}
                  className="text-sm text-blue-600 hover:underline">+ Thêm vợ/chồng</button>
              </div>
            </div>
```

- [ ] **Step 4: Chạy lại test, xác nhận PASS**

Run: `npx vitest run src/components/PersonForm.test.tsx`
Expected: Toàn bộ PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/PersonForm.tsx src/components/PersonForm.test.tsx
git commit -m "feat: navigate to a spouse from PersonForm's Vợ/Chồng list"
```

---

### Task 5: Gắn điều hướng vào từng Anh/Chị/Em

**Files:**
- Modify: `src/components/PersonForm.tsx`
- Test: `src/components/PersonForm.test.tsx`

- [ ] **Step 1: Viết test thất bại**

Thêm describe mới:

```tsx
describe('PersonForm relation navigation - Anh/Chị/Em', () => {
  const initialState = useGiaphaStore.getState()

  afterEach(() => {
    act(() => {
      useGiaphaStore.setState(initialState, true)
    })
  })

  const anhChiEmData: GiaphaData = {
    metadata: {} as GiaphaData['metadata'],
    persons: {
      '1': { id: '1', hoTen: 'Bố', gioiTinh: 'nam', laThanhVienHo: true, honNhan: [], conCaiIds: ['3', '4'] },
      '3': { id: '3', hoTen: 'Anh Cả', gioiTinh: 'nam', laThanhVienHo: true, boId: '1', honNhan: [], conCaiIds: [] },
      '4': { id: '4', hoTen: 'Em Út', gioiTinh: 'nu', laThanhVienHo: true, boId: '1', honNhan: [], conCaiIds: [] },
    },
  }

  it('navigates to a sibling when their name is clicked', () => {
    const selectPerson = vi.fn()
    useGiaphaStore.setState({ data: anhChiEmData, selectPerson })
    const editPerson = anhChiEmData.persons['3']

    const { getByRole } = render(<PersonForm editPerson={editPerson} onClose={() => {}} />)

    fireEvent.click(getByRole('button', { name: 'Em Út' }))

    expect(selectPerson).toHaveBeenCalledWith('4')
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận thất bại**

Run: `npx vitest run src/components/PersonForm.test.tsx -t "navigates to a sibling"`
Expected: FAIL — tên anh/chị/em hiện render bằng `<div>`.

- [ ] **Step 3: Gắn `handleNavigateTo` vào tên từng Anh/Chị/Em**

Tìm khối này (dòng 336-343):

```tsx
                {currentSiblings.map(p => (
                  <div key={p.id} className="text-sm px-3 py-1 border rounded bg-gray-50 text-gray-700">
                    {p.hoTen}
                  </div>
                ))}
```

Thay bằng:

```tsx
                {currentSiblings.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    title={`Xem/sửa ${p.hoTen}`}
                    onClick={() => handleNavigateTo(p)}
                    className="block w-full text-left text-sm px-3 py-1 border rounded bg-gray-50 text-gray-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
                  >
                    {p.hoTen}
                  </button>
                ))}
```

- [ ] **Step 4: Chạy lại test, xác nhận PASS**

Run: `npx vitest run src/components/PersonForm.test.tsx`
Expected: Toàn bộ PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/PersonForm.tsx src/components/PersonForm.test.tsx
git commit -m "feat: navigate to a sibling from PersonForm's Anh/Chị/Em list"
```

---

### Task 6: Hiển thị danh sách "Con" (chỉ xem + điều hướng)

**Files:**
- Modify: `src/components/PersonForm.tsx`
- Test: `src/components/PersonForm.test.tsx`

- [ ] **Step 1: Viết test thất bại**

Thêm describe mới:

```tsx
describe('PersonForm Con (children) list display', () => {
  const initialState = useGiaphaStore.getState()

  afterEach(() => {
    act(() => {
      useGiaphaStore.setState(initialState, true)
    })
  })

  const conData: GiaphaData = {
    metadata: {} as GiaphaData['metadata'],
    persons: {
      '1': { id: '1', hoTen: 'Cha', gioiTinh: 'nam', laThanhVienHo: true, honNhan: [{ voChongId: '2' }], conCaiIds: ['3', '4'] },
      '2': { id: '2', hoTen: 'Mẹ Của Cha', gioiTinh: 'nu', laThanhVienHo: false, honNhan: [{ voChongId: '1' }], conCaiIds: ['3', '4'] },
      '3': { id: '3', hoTen: 'Con Út', gioiTinh: 'nu', laThanhVienHo: true, boId: '1', meId: '2', thuTuAnhChi: 2, honNhan: [], conCaiIds: [] },
      '4': { id: '4', hoTen: 'Con Cả', gioiTinh: 'nam', laThanhVienHo: true, boId: '1', meId: '2', thuTuAnhChi: 1, honNhan: [], conCaiIds: [] },
    },
  }

  it('shows children sorted by Thứ tự anh/chị when editing a person with children', () => {
    useGiaphaStore.setState({ data: conData })
    const editPerson = conData.persons['1']

    const { getByRole } = render(<PersonForm editPerson={editPerson} onClose={() => {}} />)

    const conCa = getByRole('button', { name: 'Con Cả' })
    const conUt = getByRole('button', { name: 'Con Út' })
    // Con Cả (thuTuAnhChi 1) phải render trước Con Út (thuTuAnhChi 2) trong DOM.
    expect(conCa.compareDocumentPosition(conUt) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('navigates to a child when its name is clicked', () => {
    const selectPerson = vi.fn()
    useGiaphaStore.setState({ data: conData, selectPerson })
    const editPerson = conData.persons['1']

    const { getByRole } = render(<PersonForm editPerson={editPerson} onClose={() => {}} />)
    fireEvent.click(getByRole('button', { name: 'Con Cả' }))

    expect(selectPerson).toHaveBeenCalledWith('4')
  })

  it('does not show the Con field when adding a new person', () => {
    useGiaphaStore.setState({ data: conData })

    const { queryByText } = render(<PersonForm onClose={() => {}} />)

    expect(queryByText('Con')).toBeNull()
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận thất bại**

Run: `npx vitest run src/components/PersonForm.test.tsx -t "Con (children) list display"`
Expected: FAIL — chưa có danh sách "Con" trong modal.

- [ ] **Step 3: Thêm import `sapXepAnhChiEm`, `currentChildren`, và JSX hiển thị danh sách Con**

Đổi dòng 5:

```tsx
import { timVoChong } from '../utils/familyTree'
```

thành:

```tsx
import { timVoChong, sapXepAnhChiEm } from '../utils/familyTree'
```

Ngay sau khối `currentSiblings` (dòng 67-73), thêm:

```tsx
  const currentChildren = useMemo(() => {
    if (!data || !editPerson) return []
    return sapXepAnhChiEm(
      editPerson.conCaiIds.map(id => data.persons[id]).filter((p): p is Person => !!p),
    )
  }, [data, editPerson])
```

Trong JSX, ngay sau khối Anh/Chị/Em (đóng ở dòng 357, trước khối Quê quán ở dòng 359), thêm:

```tsx
            {editPerson && (
              <div>
                <label className="text-sm font-medium text-gray-700">Con</label>
                <div className="mt-1 space-y-1">
                  {currentChildren.map(child => (
                    <button
                      key={child.id}
                      type="button"
                      title={`Xem/sửa ${child.hoTen}`}
                      onClick={() => handleNavigateTo(child)}
                      className="block w-full text-left text-sm px-3 py-1 border rounded bg-gray-50 text-gray-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
                    >
                      {child.hoTen}
                    </button>
                  ))}
                </div>
              </div>
            )}
```

- [ ] **Step 4: Chạy lại test, xác nhận PASS**

Run: `npx vitest run src/components/PersonForm.test.tsx`
Expected: Toàn bộ PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/PersonForm.tsx src/components/PersonForm.test.tsx
git commit -m "feat: show a person's children (read-only) in PersonForm"
```

---

### Task 7: Thêm "+ Thêm con" (liên kết con qua PersonPicker)

**Files:**
- Modify: `src/components/PersonForm.tsx`
- Test: `src/components/PersonForm.test.tsx`

Hỗ trợ cả 2 nhánh: chỉ 1 vợ/chồng (tự gán làm bố/mẹ còn lại) và ≥2 vợ/chồng (chọn qua dropdown), cùng với các thông báo "đã là con" / lỗi xung đột bố mẹ.

- [ ] **Step 1: Viết các test thất bại**

Thêm describe mới:

```tsx
describe('PersonForm add Con via picker', () => {
  const initialState = useGiaphaStore.getState()

  afterEach(() => {
    act(() => {
      useGiaphaStore.setState(initialState, true)
    })
    vi.restoreAllMocks()
  })

  const oneSpouseData: GiaphaData = {
    metadata: {} as GiaphaData['metadata'],
    persons: {
      '1': { id: '1', hoTen: 'Cha Một Vợ', gioiTinh: 'nam', laThanhVienHo: true, honNhan: [{ voChongId: '2' }], conCaiIds: [] },
      '2': { id: '2', hoTen: 'Vợ Cha', gioiTinh: 'nu', laThanhVienHo: false, honNhan: [{ voChongId: '1' }], conCaiIds: [] },
      '5': { id: '5', hoTen: 'Người Chưa Liên Kết', gioiTinh: 'nu', laThanhVienHo: true, honNhan: [], conCaiIds: [] },
      '6': { id: '6', hoTen: 'Người Đã Có Bố Mẹ Khác', gioiTinh: 'nam', laThanhVienHo: true, boId: '2', honNhan: [], conCaiIds: [] },
      '7': { id: '7', hoTen: 'Con Đã Có', gioiTinh: 'nu', laThanhVienHo: true, boId: '1', meId: '2', honNhan: [], conCaiIds: [] },
    },
  }

  it('links an unlinked person as a child, auto-filling the single spouse as the other parent', async () => {
    const suaNguoi = vi.fn().mockResolvedValue(undefined)
    useGiaphaStore.setState({ data: oneSpouseData, suaNguoi })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const editPerson = oneSpouseData.persons['1']

    const { getByText } = render(<PersonForm editPerson={editPerson} onClose={() => {}} />)

    fireEvent.click(getByText('+ Thêm con'))
    fireEvent.click(getByText('Chọn con'))
    await act(async () => {
      fireEvent.click(getByText('Người Chưa Liên Kết'))
    })

    expect(suaNguoi).toHaveBeenCalledWith('5', expect.objectContaining({ boId: '1', meId: '2' }))
    expect(getByText('Đã cập nhật Người Chưa Liên Kết làm con của Cha Một Vợ.')).toBeInTheDocument()
  })

  it('shows a success message without calling the API when the person is already a child', () => {
    useGiaphaStore.setState({ data: oneSpouseData, suaNguoi: vi.fn() })
    const editPerson: Person = { ...oneSpouseData.persons['1'], conCaiIds: ['7'] }

    const { getByText } = render(<PersonForm editPerson={editPerson} onClose={() => {}} />)

    fireEvent.click(getByText('+ Thêm con'))
    fireEvent.click(getByText('Chọn con'))
    fireEvent.click(getByText('Con Đã Có'))

    expect(getByText('Con Đã Có đã là con.')).toBeInTheDocument()
  })

  it('shows an error and does not call the API when the selected person already has a conflicting parent', () => {
    const suaNguoi = vi.fn()
    useGiaphaStore.setState({ data: oneSpouseData, suaNguoi })
    const editPerson = oneSpouseData.persons['1']

    const { getByText } = render(<PersonForm editPerson={editPerson} onClose={() => {}} />)

    fireEvent.click(getByText('+ Thêm con'))
    fireEvent.click(getByText('Chọn con'))
    fireEvent.click(getByText('Người Đã Có Bố Mẹ Khác'))

    expect(suaNguoi).not.toHaveBeenCalled()
    expect(getByText('Bố/mẹ của Người Đã Có Bố Mẹ Khác không trùng khớp. Không thể thêm làm con.')).toBeInTheDocument()
  })
})

describe('PersonForm add Con with multiple spouses', () => {
  const initialState = useGiaphaStore.getState()

  afterEach(() => {
    act(() => {
      useGiaphaStore.setState(initialState, true)
    })
    vi.restoreAllMocks()
  })

  const twoSpouseData: GiaphaData = {
    metadata: {} as GiaphaData['metadata'],
    persons: {
      '1': { id: '1', hoTen: 'Cha Nhiều Vợ', gioiTinh: 'nam', laThanhVienHo: true, honNhan: [{ voChongId: '2' }, { voChongId: '3' }], conCaiIds: [] },
      '2': { id: '2', hoTen: 'Vợ Cả', gioiTinh: 'nu', laThanhVienHo: false, honNhan: [{ voChongId: '1' }], conCaiIds: [] },
      '3': { id: '3', hoTen: 'Vợ Hai', gioiTinh: 'nu', laThanhVienHo: false, honNhan: [{ voChongId: '1' }], conCaiIds: [] },
      '4': { id: '4', hoTen: 'Con Chưa Liên Kết', gioiTinh: 'nam', laThanhVienHo: true, honNhan: [], conCaiIds: [] },
    },
  }

  it('shows a spouse-choice dropdown before linking when the person has multiple spouses', async () => {
    const suaNguoi = vi.fn().mockResolvedValue(undefined)
    useGiaphaStore.setState({ data: twoSpouseData, suaNguoi })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const editPerson = twoSpouseData.persons['1']

    const { getByText, getByRole } = render(<PersonForm editPerson={editPerson} onClose={() => {}} />)

    fireEvent.click(getByText('+ Thêm con'))
    fireEvent.click(getByText('Chọn con'))
    fireEvent.click(getByText('Con Chưa Liên Kết'))

    expect(getByText(/Chọn vợ\/chồng là bố\/mẹ còn lại/)).toBeInTheDocument()
    expect(suaNguoi).not.toHaveBeenCalled()

    await act(async () => {
      fireEvent.change(getByRole('combobox'), { target: { value: '3' } })
    })

    expect(suaNguoi).toHaveBeenCalledWith('4', expect.objectContaining({ boId: '1', meId: '3' }))
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận thất bại**

Run: `npx vitest run src/components/PersonForm.test.tsx -t "add Con"`
Expected: FAIL — chưa có nút "+ Thêm con", picker 'con', hay logic liên kết.

- [ ] **Step 3: Mở rộng `pickerOpen`, thêm state, `handleConSelected`, `confirmLinkChild`**

Đổi dòng 62:

```tsx
  const [pickerOpen, setPickerOpen] = useState<null | 'bo' | 'me' | 'vochong' | 'anhchiem'>(null)
```

thành:

```tsx
  const [pickerOpen, setPickerOpen] = useState<null | 'bo' | 'me' | 'vochong' | 'anhchiem' | 'con'>(null)
```

Sau dòng khai báo `anhChiEmFeedback` (dòng 65), thêm:

```tsx
  const [conFeedback, setConFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [pendingChild, setPendingChild] = useState<{ person: Person; voChongOptions: string[] } | null>(null)
```

Ngay sau `handleAnhChiEmSelected` (kết thúc ở dòng 156, trước `async function handleSubmit`... — hiện đã là `trySave`/`handleSubmit` sau Task 1), thêm 2 hàm mới:

```tsx
  function handleConSelected(person: Person) {
    setPickerOpen(null)
    setConFeedback(null)
    if (!editPerson) return

    const spouseIds = editPerson.honNhan.map(h => h.voChongId)
    if (spouseIds.length >= 2) {
      setPendingChild({ person, voChongOptions: spouseIds })
      return
    }
    void confirmLinkChild(person, spouseIds[0])
  }

  async function confirmLinkChild(child: Person, otherParentId: string | undefined) {
    if (!editPerson) return
    const boId = editPerson.gioiTinh === 'nam' ? editPerson.id : otherParentId
    const meId = editPerson.gioiTinh === 'nam' ? otherParentId : editPerson.id

    if (child.boId === boId && child.meId === meId) {
      setConFeedback({ type: 'success', msg: `${child.hoTen} đã là con.` })
      return
    }

    if (!child.boId && !child.meId) {
      const confirmed = confirm(`Bố/mẹ của ${child.hoTen} đang trống. Cập nhật làm con của ${editPerson.hoTen}?`)
      if (!confirmed) return
      const { id: _id, ...childRest } = child
      try {
        await suaNguoi(child.id, { ...childRest, boId, meId })
        setConFeedback({ type: 'success', msg: `Đã cập nhật ${child.hoTen} làm con của ${editPerson.hoTen}.` })
      } catch (err) {
        setConFeedback({ type: 'error', msg: 'Không thể cập nhật: ' + (err as Error).message })
      }
      return
    }

    setConFeedback({ type: 'error', msg: `Bố/mẹ của ${child.hoTen} không trùng khớp. Không thể thêm làm con.` })
  }
```

- [ ] **Step 4: Thêm nút "+ Thêm con", feedback, dropdown chọn vợ/chồng vào JSX danh sách Con**

Tìm khối JSX của danh sách Con vừa thêm ở Task 6:

```tsx
            {editPerson && (
              <div>
                <label className="text-sm font-medium text-gray-700">Con</label>
                <div className="mt-1 space-y-1">
                  {currentChildren.map(child => (
                    <button
                      key={child.id}
                      type="button"
                      title={`Xem/sửa ${child.hoTen}`}
                      onClick={() => handleNavigateTo(child)}
                      className="block w-full text-left text-sm px-3 py-1 border rounded bg-gray-50 text-gray-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
                    >
                      {child.hoTen}
                    </button>
                  ))}
                </div>
              </div>
            )}
```

Thay bằng:

```tsx
            {editPerson && (
              <div>
                <label className="text-sm font-medium text-gray-700">Con</label>
                <div className="mt-1 space-y-1">
                  {currentChildren.map(child => (
                    <button
                      key={child.id}
                      type="button"
                      title={`Xem/sửa ${child.hoTen}`}
                      onClick={() => handleNavigateTo(child)}
                      className="block w-full text-left text-sm px-3 py-1 border rounded bg-gray-50 text-gray-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
                    >
                      {child.hoTen}
                    </button>
                  ))}
                  {conFeedback && (
                    <div className={`text-sm px-3 py-1.5 rounded ${conFeedback.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                      {conFeedback.msg}
                    </div>
                  )}
                  {pendingChild && (
                    <div className="text-sm px-3 py-2 border rounded bg-yellow-50 space-y-2">
                      <div>Chọn vợ/chồng là bố/mẹ còn lại của <strong>{pendingChild.person.hoTen}</strong>:</div>
                      <select
                        defaultValue=""
                        onChange={e => {
                          const voChongId = e.target.value
                          const chosen = pendingChild.person
                          setPendingChild(null)
                          if (voChongId) void confirmLinkChild(chosen, voChongId)
                        }}
                        className="w-full px-3 py-1.5 text-sm border rounded"
                      >
                        <option value="" disabled>-- Chọn vợ/chồng --</option>
                        {pendingChild.voChongOptions.map(id => (
                          <option key={id} value={id}>{getName(id)}</option>
                        ))}
                      </select>
                      <button type="button" onClick={() => setPendingChild(null)} className="text-xs text-gray-500 hover:underline">
                        Hủy
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => { setConFeedback(null); setPendingChild(null); setPickerOpen('con') }}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    + Thêm con
                  </button>
                </div>
              </div>
            )}
```

- [ ] **Step 5: Render `PersonPicker` cho `pickerOpen === 'con'`**

Ngay sau khối `{pickerOpen === 'anhchiem' && (...)}` (kết thúc ở dòng 415, trước `</>`), thêm:

```tsx
      {pickerOpen === 'con' && editPerson && (
        <PersonPicker
          title="Chọn con"
          excludeIds={[
            editPerson.id,
            ...(form.boId ? [form.boId] : []),
            ...(form.meId ? [form.meId] : []),
            ...form.voChongIds,
          ]}
          onSelect={handleConSelected}
          onClose={() => setPickerOpen(null)}
        />
      )}
```

- [ ] **Step 6: Chạy lại test, xác nhận PASS**

Run: `npx vitest run src/components/PersonForm.test.tsx`
Expected: Toàn bộ PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/PersonForm.tsx src/components/PersonForm.test.tsx
git commit -m "feat: add + Thêm con to link a child from PersonForm"
```

---

### Task 8: Sửa `HomePage.tsx` để modal remount đúng khi điều hướng (thêm `key`)

**Files:**
- Modify: `src/pages/HomePage.tsx:50`
- Test: `src/pages/HomePage.test.tsx`

Đây là bug tiềm ẩn đã phát hiện trong lúc brainstorm: `<PersonForm editPerson={editPerson} onClose={closeForm} />` không có `key`, nên khi `selectedPersonId` đổi trong lúc modal đang mở (do click điều hướng), state nội bộ của `PersonForm` (bao gồm `form`) không reset — modal vẫn hiển thị dữ liệu người cũ.

- [ ] **Step 1: Viết test thất bại thể hiện đúng bug**

Thêm vào cuối `src/pages/HomePage.test.tsx` (dùng import/pattern đã có ở đầu file: `useGiaphaStore`, `render`, `screen`, `fireEvent`, `GiaphaData`):

```tsx
describe('HomePage in-modal relation navigation', () => {
  beforeEach(() => {
    Element.prototype.scrollTo = vi.fn()
  })

  const navData: GiaphaData = {
    metadata: { tenDongHo: 'Dòng họ mẫu' },
    persons: {
      '1': { id: '1', hoTen: 'Ông Nội', gioiTinh: 'nam', laThanhVienHo: true, honNhan: [], conCaiIds: ['2'] },
      '2': { id: '2', hoTen: 'Con Trai', gioiTinh: 'nam', laThanhVienHo: true, boId: '1', honNhan: [], conCaiIds: [] },
    },
  }

  it('navigating to a related member inside the edit modal fully switches the modal content and focuses them in the tree', () => {
    useGiaphaStore.setState({
      data: navData,
      viewMode: 'tree',
      selectedPersonId: null,
      focusedPersonId: null,
      hienThiThuTuDoi: false,
      cyclicRelationshipWarnings: [],
    })

    render(<HomePage />)

    fireEvent.click(screen.getByText('Con Trai'))
    expect(screen.getByDisplayValue('Con Trai')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Ông Nội' }))

    expect(useGiaphaStore.getState().selectedPersonId).toBe('1')
    expect(useGiaphaStore.getState().focusedPersonId).toBe('1')
    expect(screen.getByDisplayValue('Ông Nội')).toBeInTheDocument()
    // Ông Nội không có Bố — nếu modal không remount, tên "Ông Nội" cũ (nút Bố của Con Trai) sẽ còn sót lại.
    expect(screen.queryByRole('button', { name: 'Ông Nội' })).toBeNull()
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận thất bại**

Run: `npx vitest run src/pages/HomePage.test.tsx -t "fully switches the modal content"`
Expected: FAIL — `selectedPersonId`/`focusedPersonId` chuyển đúng thành `'1'`, nhưng input tên vẫn hiển thị "Con Trai" vì `PersonForm` không remount.

- [ ] **Step 3: Thêm `key` vào `<PersonForm>`**

Đổi dòng 50 của `src/pages/HomePage.tsx`:

```tsx
        <PersonForm editPerson={editPerson} onClose={closeForm} />
```

thành:

```tsx
        <PersonForm key={editPerson?.id ?? 'new'} editPerson={editPerson} onClose={closeForm} />
```

- [ ] **Step 4: Chạy lại test, xác nhận PASS**

Run: `npx vitest run src/pages/HomePage.test.tsx`
Expected: Toàn bộ PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/HomePage.tsx src/pages/HomePage.test.tsx
git commit -m "fix: remount PersonForm when the target person changes so in-modal navigation shows fresh state"
```

---

### Task 9: Kiểm tra toàn diện cuối cùng

**Files:** không thay đổi file nào — chỉ chạy kiểm tra.

- [ ] **Step 1: Chạy toàn bộ test suite của app**

Run: `npx vitest run src`
Expected: PASS toàn bộ, ngoại trừ 1 lỗi tồn tại từ trước không liên quan (`PersonCard.test.tsx` — kỳ vọng class `bg-card-border` nhưng component render `bg-card-spouse`; đã xác nhận lỗi này tồn tại độc lập với các thay đổi trong session debug trước, không thuộc phạm vi plan này).

- [ ] **Step 2: Kiểm tra kiểu (typecheck)**

Run: `npx tsc -b`
Expected: Không có lỗi.

- [ ] **Step 3: Xác nhận thủ công trên local (tuỳ chọn nếu có `wrangler dev` + `vite` đang chạy)**

Mở modal Sửa của một người có Bố/Mẹ/Vợ-Chồng/Anh-Chị-Em/Con, thử:
- Click tên Bố/Mẹ/một Vợ-Chồng/một Anh-Chị-Em/một Con → modal chuyển đúng người, cây phía sau tự cuộn/focus.
- Sửa 1 trường rồi click điều hướng → xuất hiện `confirm()`; chọn "Cancel" → ở lại, giữ nguyên thay đổi; chọn "OK" → lưu rồi chuyển.
- Với người có ≥2 vợ/chồng, bấm "+ Thêm con" chọn một người chưa có bố/mẹ → xuất hiện dropdown chọn vợ/chồng còn lại.

- [ ] **Step 4: Commit cuối (nếu có thay đổi phát sinh từ việc sửa lỗi phát hiện lúc kiểm tra thủ công)**

```bash
git add -A
git commit -m "chore: final verification pass for PersonForm navigation feature"
```

(Bỏ qua bước này nếu không có thay đổi nào.)

---

## Tổng kết file thay đổi

| File | Thay đổi |
|---|---|
| `src/components/PersonForm.tsx` | `trySave()`, `isDirty`, `handleNavigateTo`, click-điều-hướng trên Bố/Mẹ/Vợ-Chồng/Anh-Chị-Em, danh sách "Con" + "+ Thêm con" (`handleConSelected`, `confirmLinkChild`, dropdown đa vợ/chồng) |
| `src/components/PersonForm.test.tsx` | Test cho từng nhánh điều hướng, danh sách Con, và luồng "+ Thêm con" (đơn/đa vợ chồng, đã-là-con, xung đột bố mẹ) |
| `src/pages/HomePage.tsx` | Thêm `key={editPerson?.id ?? 'new'}` vào `<PersonForm>` |
| `src/pages/HomePage.test.tsx` | Test tích hợp xác nhận modal remount đúng và tree được focus khi điều hướng trong modal |
