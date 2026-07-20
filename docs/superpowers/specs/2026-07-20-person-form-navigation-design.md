# Thiết kế: Danh sách "Con" và điều hướng nhanh trong modal Sửa thông tin

**Ngày:** 2026-07-20
**Trạng thái:** Đã duyệt

---

## 1. Tổng quan

Hiện tại modal `PersonForm` (Thêm/Sửa thành viên) hiển thị các trường quan hệ — **Bố**, **Mẹ**, **Vợ/Chồng**, **Anh/Chị/Em** — dưới dạng văn bản tĩnh, không có cách nào để nhảy nhanh sang xem/sửa một người liên quan. Ngoài ra modal chưa có danh sách **Con** — người dùng phải đóng modal, tìm người con trong cây/danh sách, mở lại modal của người đó, rồi tự chọn Bố/Mẹ để liên kết.

Thay đổi này bổ sung:

1. **Danh sách "Con"** trong modal Sửa (chỉ hiển thị khi sửa người đã tồn tại), hoạt động theo mẫu hình đã có của **Anh/Chị/Em**: xem danh sách + nút "+ Thêm con" để liên kết một người đã tồn tại làm con.
2. **Điều hướng nhanh**: bấm vào tên của **Bố, Mẹ, Vợ/Chồng, Anh/Chị/Em, hoặc Con** trong modal sẽ mở modal Sửa của người đó, đồng thời cây gia phả phía sau tự động cuộn tới và highlight người đó — giống hành vi khi dùng ô tìm kiếm.
3. **Bảo vệ dữ liệu chưa lưu**: nếu form đang có thay đổi chưa lưu, hệ thống hỏi xác nhận lưu trước khi điều hướng, tránh mất dữ liệu.

**Không thuộc phạm vi:** không đổi cách lưu trữ dữ liệu (`Person.conCaiIds` đã có sẵn), không đổi cơ chế focus/scroll của `TreeView` (đã đúng, chỉ cần tái sử dụng), không cho bỏ liên kết Con ngay trong modal (chỉ xem + thêm, giống Anh/Chị/Em).

---

## 2. Luồng điều hướng (áp dụng cho mọi trường: Bố/Mẹ/Vợ-Chồng/Anh-Chị-Em/Con)

### 2.1. Theo dõi trạng thái "đã sửa chưa lưu" (dirty-check)

- Khi `PersonForm` mount (bao gồm cả khi mount lại do chuyển sang sửa người khác — xem mục 4), lưu lại một **snapshot** của `FormState` khởi tạo vào một `ref` (`initialFormRef`), lấy đúng giá trị đã dùng để khởi tạo `useState<FormState>`.
- `isDirty` được tính bằng cách so sánh `JSON.stringify(form)` hiện tại với `JSON.stringify(initialFormRef.current)`. Khác nhau → có thay đổi chưa lưu.
- Chỉ so sánh trên `form` (state chính dùng để submit) — không tính các state phụ như `pickerOpen`, `multipleWives`, `anhChiEmFeedback`.

### 2.2. Hàm điều hướng `handleNavigateTo(targetPerson: Person)`

Được gọi khi người dùng bấm vào tên một người trong các trường Bố/Mẹ/Vợ-Chồng/Anh-Chị-Em/Con:

```
async function handleNavigateTo(targetPerson):
  if not isDirty:
    selectPerson(targetPerson.id)   # chuyển ngay, cây tự focus
    return

  confirmed = confirm(`Bạn có thay đổi chưa lưu cho "${tenNguoiDangSua}".
                        Lưu lại trước khi chuyển sang xem "${targetPerson.hoTen}"?`)
  if not confirmed:
    return   # ở lại, không mất gì, không chuyển

  saved = await trySave()   # logic lưu tái sử dụng từ handleSubmit (mục 2.3)
  if saved:
    selectPerson(targetPerson.id)
  # nếu lưu thất bại/bị hủy giữa đường (ví dụ thiếu bố/mẹ và người dùng bấm Hủy ở
  # confirm phụ, hoặc lỗi API) → ở lại, không chuyển.
```

`tenNguoiDangSua` = `editPerson.hoTen` khi đang Sửa, hoặc `form.hoTen || '(người mới)'` khi đang Thêm mới.

### 2.3. Tách logic lưu ra `trySave(): Promise<boolean>`

Refactor `handleSubmit` hiện tại thành:

```
async function trySave(): Promise<boolean> {
  if (!form.hoTen.trim()) return false
  if (!editPerson && (!form.boId || !form.meId)) {
    const shouldContinue = confirm('Chưa nhập đủ thông tin bố và mẹ thành viên...')
    if (!shouldContinue) return false
  }
  const personData = { ...xây dựng như hiện tại... }
  setSaving(true)
  try {
    if (editPerson) await suaNguoi(editPerson.id, personData)
    else await themNguoi(personData)
    return true
  } catch (err) {
    alert('Không thể lưu: ' + (err as Error).message)
    return false
  } finally {
    setSaving(false)
  }
}

async function handleSubmit(e) {
  e.preventDefault()
  const saved = await trySave()
  if (saved) onClose()
}
```

`handleNavigateTo` gọi `trySave()` trực tiếp (không gọi `onClose()`), rồi tự `selectPerson(targetPerson.id)` khi thành công — modal không đóng, chỉ **chuyển nội dung** sang người khác.

### 2.4. Vì sao không cần sửa `TreeView`/store

`selectPerson(id)` trong `useGiaphaStore` đã set đồng thời `selectedPersonId` và `focusedPersonId`. `TreeView` đã dùng `highlightedPersonId = focusedPersonId ?? selectedPersonId` để tô sáng + có `useEffect` tự `scrollTo` tới thẻ đó (dòng ~527-536 trong `TreeView.tsx`) — đúng cơ chế mà ô tìm kiếm (`SearchBar`) dùng. Tái sử dụng nguyên trạng, không cần thay đổi.

`HomePage.tsx` đã tính `editPerson` từ `selectedPersonId`, nên khi `selectPerson(targetPerson.id)` được gọi, `HomePage` tự động render lại `PersonForm` với `editPerson` mới — không cần thêm state điều hướng ở `HomePage`.

---

## 3. Danh sách "Con" mới

### 3.1. Vị trí và điều kiện hiển thị

Thêm section "Con" trong `PersonForm`, đặt sau section "Anh/Chị/Em", **chỉ hiển thị khi `editPerson` tồn tại** (người mới thêm chưa có `conCaiIds`).

### 3.2. Hiển thị danh sách hiện tại

```
const currentChildren = useMemo(() => {
  if (!data || !editPerson) return []
  return sapXepAnhChiEm(
    editPerson.conCaiIds.map(id => data.persons[id]).filter(Boolean)
  )
}, [data, editPerson])
```

Mỗi người con hiển thị dạng hàng giống Anh/Chị/Em, tên có thể bấm để điều hướng (`handleNavigateTo`). **Không có nút bỏ liên kết** (theo quyết định thiết kế).

### 3.3. Thêm liên kết con — nút "+ Thêm con"

Mở `PersonPicker` với `excludeIds` gồm: `editPerson.id`, các con hiện có (`editPerson.conCaiIds`), `form.boId`, `form.meId`, và toàn bộ `form.voChongIds` (để tránh chọn nhầm bố/mẹ/vợ-chồng làm con).

Khi chọn được một người (`handleConSelected(person)`):

1. **Xác định "bố/mẹ còn lại"** (người ghép cặp với `editPerson` cho đứa con này):
   - `editPerson.honNhan.length === 0` → không có bố/mẹ còn lại (để trống).
   - `editPerson.honNhan.length === 1` → tự động lấy `honNhan[0].voChongId`.
   - `editPerson.honNhan.length >= 2` → hiển thị dropdown chọn 1 trong các vợ/chồng hiện có của `editPerson` (tái dùng mẫu UI của `multipleWives` cho trường Mẹ), lưu tạm ở state `pendingChild: { person, chonVoChongId? }` cho tới khi người dùng chọn xong.

2. **Xác định `boId`/`meId` mới cho người con** dựa trên giới tính của `editPerson`:
   - Nếu `editPerson.gioiTinh === 'nam'` → `boId = editPerson.id`, `meId = spouseIdDaChon`.
   - Ngược lại → `meId = editPerson.id`, `boId = spouseIdDaChon`.

3. **So khớp với dữ liệu hiện tại của người được chọn** (giống logic `handleAnhChiEmSelected`):
   - Nếu `person.boId`/`person.meId` đã khớp chính xác với cặp vừa xác định → hiển thị thông báo thành công "`{person.hoTen}` đã là con.", không gọi API.
   - Nếu cả `boId` và `meId` của `person` đều trống → hỏi xác nhận (`confirm`) "Bố/mẹ của `{person.hoTen}` đang trống. Cập nhật làm con của `{editPerson.hoTen}`?" → nếu đồng ý, gọi `suaNguoi(person.id, { ...person, boId, meId })`.
   - Nếu có xung đột (đã có bố/mẹ khác không khớp) → hiển thị lỗi "Bố/mẹ của `{person.hoTen}` không trùng khớp. Không thể thêm làm con.", không gọi API.

4. Thông báo kết quả dùng state feedback riêng (`conFeedback`, cùng kiểu `{ type, msg }` như `anhChiEmFeedback`), tránh lẫn giữa 2 khối.

### 3.4. Không cập nhật `conCaiIds` của `editPerson` trực tiếp

Việc liên kết chỉ cập nhật `boId`/`meId` của **người con** (giống cách Anh/Chị/Em chỉ cập nhật `boId`/`meId` của người được thêm). Trường `conCaiIds` của cha/mẹ được tính lại ở phía server/derive layer như hiện tại (không thuộc phạm vi thay đổi này) — cần xác nhận hành vi hiện tại của `suaNguoi`/`themNguoi` đã tự đồng bộ `conCaiIds` hai chiều (việc này áp dụng y hệt cơ chế đã hoạt động cho Anh/Chị/Em, không có gì mới).

---

## 4. Đảm bảo modal "làm mới sạch" khi điều hướng

`PersonForm` giữ state nội bộ (`form`, `pickerOpen`, `multipleWives`, `anhChiEmFeedback`, `conFeedback`, `pendingChild`, `saving`) được khởi tạo một lần bằng `useState(() => ...)`. Nếu `editPerson` prop đổi (do `selectPerson` gọi từ `handleNavigateTo`) mà component không remount, các state cũ sẽ không tự làm mới theo người mới → hiển thị sai dữ liệu.

**Giải pháp:** tại `HomePage.tsx`, thêm `key` cho `<PersonForm>` để buộc React remount hoàn toàn mỗi khi người được sửa thay đổi:

```tsx
<PersonForm key={editPerson?.id ?? 'new'} editPerson={editPerson} onClose={closeForm} />
```

Việc remount cũng tự động đóng mọi `PersonPicker` đang mở và xóa mọi feedback message còn sót của người trước đó — không cần logic dọn dẹp thủ công.

---

## 5. Giao diện (UI)

Áp dụng nhất quán cho mọi trường có thể điều hướng:

- **Bố / Mẹ** (khối hiển thị `bg-gray-50` hiện có): khi có giá trị, thêm `cursor-pointer hover:bg-blue-50 hover:text-blue-700` và `onClick={() => handleNavigateTo(person)}` lên khối tên (không đụng tới nút "Chọn"/"x" cạnh bên — vẫn là các phần tử riêng, không lồng trong vùng click).
- **Vợ/Chồng** (mỗi dòng có tên + nút "x"): tên chuyển thành `<button type="button">` với style `text-blue-600 hover:underline`, tách biệt khỏi nút "x" bỏ liên kết.
- **Anh/Chị/Em**: mỗi dòng tên hiện là `<div>` tĩnh → chuyển thành phần tử có thể bấm (`<button type="button">`), style tương tự Vợ/Chồng.
- **Con** (mới): dùng đúng style vừa thêm cho Anh/Chị/Em.

Không cần `aria-label` mới vì đã có text tên hiển thị đủ để test/screen reader nhận diện; thêm `title="Xem/sửa {hoTen}"` cho rõ ý định khi hover.

---

## 6. Kiểm thử (test cases dự kiến trong `PersonForm.test.tsx`)

1. **Điều hướng không có thay đổi** — bấm tên Bố/Mẹ/Vợ-Chồng/Anh-Chị-Em/Con khi form "sạch" (chưa sửa gì) → gọi `selectPerson` ngay với đúng ID, không hiện `confirm`.
2. **Điều hướng có thay đổi, người dùng đồng ý lưu** — sửa một trường rồi bấm tên người liên quan → hiện `confirm` đúng nội dung → giả lập chọn "OK" → `suaNguoi`/`themNguoi` được gọi, sau đó `selectPerson` được gọi với ID đích.
3. **Điều hướng có thay đổi, người dùng từ chối lưu** → `confirm` trả `false` → không gọi `suaNguoi`/`themNguoi`, không gọi `selectPerson`, form vẫn giữ nguyên giá trị đã sửa.
4. **Danh sách Con hiển thị đúng** khi sửa người có `conCaiIds`, đúng thứ tự theo `thuTuAnhChi`.
5. **Con field không hiển thị khi Thêm mới** (`editPerson` undefined).
6. **"+ Thêm con" với 1 vợ/chồng** — tự gán `meId`/`boId` còn lại không cần hỏi.
7. **"+ Thêm con" với ≥2 vợ/chồng** — hiện dropdown chọn vợ/chồng trước khi xác nhận liên kết.
8. **"+ Thêm con" khi người được chọn đã có bố/mẹ khác** → hiển thị lỗi, không gọi API.
9. **`HomePage` remount theo `key`** — test rằng khi `selectedPersonId` đổi, `PersonForm` nhận `editPerson` mới và không giữ state cũ (có thể test gián tiếp qua hành vi điều hướng ở test 1-3, không cần test riêng cho `HomePage` nếu đã cover qua các luồng trên).

---

## 7. Tổng kết thay đổi file

| File | Thay đổi |
|---|---|
| `src/components/PersonForm.tsx` | Thêm `initialFormRef`, `isDirty`, `trySave()`, `handleNavigateTo()`, section "Con" (`currentChildren`, `handleConSelected`, `conFeedback`, `pendingChild`), làm tên Bố/Mẹ/Vợ-Chồng/Anh-Chị-Em/Con có thể bấm. |
| `src/pages/HomePage.tsx` | Thêm `key={editPerson?.id ?? 'new'}` cho `<PersonForm>`. |
| `src/components/PersonForm.test.tsx` | Thêm các test case ở mục 6. |

Không thay đổi: `TreeView.tsx`, `ListView.tsx`, `useGiaphaStore.ts`, `familyTree.ts`, API/worker layer.
