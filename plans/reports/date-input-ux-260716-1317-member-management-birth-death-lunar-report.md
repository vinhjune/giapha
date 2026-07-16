# Brainstorm: Simplify birth/death date entry (partial date + lunar toggle)

Date: 2026-07-16 | Mode: standard (no --html, no --wiki)

## Problem statement

User quản lý "Quản lý thành viên" (MemberManagementView.tsx) thấy nhập ngày sinh/mất phức tạp: hiện tách 4 cột riêng (Năm/Tháng/Ngày/Âm lịch) x 2 ngày (sinh, mất) = 8 cột. Muốn 1 ô nhập dạng `__/__/____`, gõ số tự vào, cho phép skip ngày/tháng, + 1 checkbox âm lịch.

## Scout findings

- Stack: React 19 + TS frontend, Cloudflare Worker + D1/Drizzle backend. `worker/src/db/schema.ts` là bản copy của schema từ dự án `giaphadongho` (dùng chung DB) — không được tự sửa lệch, không được chạy migration từ repo này.
- **DB đã sẵn sàng cho partial date + lunar**, không cần đổi schema:
  - `persons.birthYear/birthMonth/birthDay` (nullable integer) + `birthIsLunar` (boolean)
  - `persons.deathYear/deathMonth/deathDay` (nullable integer) + `deathIsLunar` (boolean)
- Frontend type `NgayThang { nam?, thang?, ngay?, amLich? }` (src/types/giapha.ts) map 1-1 qua `worker/src/lib/reshape.ts` (`toNgayThang`/`fromNgayThang`) — round-trip đã đúng, không mất dữ liệu ở tầng API.
- "Quản lý thành viên" = `src/components/MemberManagementView.tsx` — bảng spreadsheet-style, mỗi ngày tách 4 cột string riêng (`namSinh_nam/thang/ngay/amLich`), build lại `NgayThang` qua `buildNgay()` khi lưu.
- `src/components/PersonForm.tsx` (modal thêm/sửa 1 người dùng từ cây phả hệ) — hiện chỉ có 1 ô text tự do "dd/mm/yyyy" (`ngayToStr`/`strToNgay`), **không có checkbox âm lịch** → dữ liệu `amLich` bị mất khi lưu qua form này. Bug có sẵn, không liên quan yêu cầu gốc nhưng cùng vùng code.
- `PersonDetail.tsx`/`PersonCard.tsx` hiển thị ngày qua `formatNgay()` — không có dấu hiệu ngày âm/dương.
- Không có test hiện tại phụ thuộc cứng vào tên cột/testid cũ của các field ngày (`namSinh_nam-{i}` v.v.) trong `MemberManagementView.test.tsx`; `PersonCard.test.tsx` chỉ check tồn tại/không tồn tại `namMat`, không đụng testid ngày cụ thể.

## Approaches evaluated

**Input mask kiểu:**
- A. 3 ô riêng dd|mm|yyyy, auto-advance/backspace — **chọn**. Đơn giản implement/test, rõ ràng ô nào đang trống (= skip).
- B. 1 ô liền mask `__/__/____` — bị loại, logic xóa/parse từng phần phức tạp hơn không cần thiết.
- Native `<input type="date">` — bị loại, không cho phép thiếu ngày/tháng, không có khái niệm âm lịch.

**Cấu trúc cột trong bảng:**
- Gộp 8 cột date → 2 cột (Ngày sinh, Ngày mất), mỗi cột chứa input mask + checkbox ÂL trong cùng ô — **chọn**, gọn nhất, đúng yêu cầu "đơn giản hơn".

**Phạm vi sửa:**
- Chỉ MemberManagementView, hoặc cả PersonForm — **chọn cả 2**, vì PersonForm đang có bug mất dữ liệu âm lịch, cùng logic/component tái dùng được, effort thêm nhỏ.

**Hiển thị đọc (PersonDetail/PersonCard):**
- Thêm nhãn "ÂL" sau ngày khi `amLich === true` — **chọn**, nhỏ gọn, không đổi logic khác.

## Final design

### 1. New component: `src/components/NgayThangInput.tsx`
- Props: `value: NgayThang | undefined`, `onChange: (v: NgayThang | undefined) => void`, `testIdPrefix?: string` (để giữ khả năng target từng ô trong test).
- 3 ô số `dd`/`mm`/`yyyy`, placeholder `__`/`__`/`____`, maxLength 2/2/4. Chỉ nhận digit. Gõ đủ ký tự → focus ô kế. Backspace ở ô rỗng → focus + xóa ký tự cuối ô trước.
- 1 checkbox "ÂL" trong cùng khối UI, bind `amLich`.
- Để trống hẳn 1 ô = field đó `undefined` trong `NgayThang` (giữ đúng semantics `buildNgay` cũ: nếu cả 3 phần ngày/tháng/năm đều rỗng → trả `undefined` toàn bộ, kể cả khi checkbox có tick).
- **Không validate range** (day≤31, month≤12) — chỉ giới hạn số ký tự nhập. Tránh over-engineering, tránh cản trở nhập ngày âm lịch (quy tắc số ngày khác dương lịch).

### 2. `MemberManagementView.tsx`
- `RowField`: xóa 8 key `namSinh_nam/thang/ngay/amLich`, `namMat_nam/thang/ngay/amLich` → thay bằng `namSinh: NgayThang | undefined`, `namMat: NgayThang | undefined` lưu thẳng trong `EditableRow` (không cần stringify).
- `COLUMNS`: 2 entries "Ngày sinh"/"Ngày mất" thay 8 entries cũ. Cập nhật `DEFAULT_COLUMN_WIDTHS` cho đủ chỗ 3 ô + checkbox (~200px).
- Cell render: `<NgayThangInput value={row.namSinh} onChange={v => handleDateChange(rowIndex, 'namSinh', v)} testIdPrefix={\`namSinh-${rowIndex}\`} />`
- Xóa `dateToParts()`, `buildNgay()` — không cần chuyển đổi string trung gian nữa. `personToRow`/`createEmptyRow`/`rowToPersonPayload` đơn giản hóa tương ứng.

### 3. `PersonForm.tsx`
- `FormState.ngaySinh/ngayMat: string` → `namSinh/namMat: NgayThang | undefined`.
- Xóa `ngayToStr()`, `strToNgay()`.
- Thay 2 ô text bằng `<NgayThangInput value={form.namSinh} onChange={v => setForm(f => ({ ...f, namSinh: v }))} />` (tương tự cho `namMat`).
- `handleSubmit`: `namSinh: form.namSinh, namMat: form.namMat` (bỏ `strToNgay(...)`).

### 4. `PersonDetail.tsx` + `PersonCard.tsx`
- Sau `formatNgay(...)`/phần hiển thị ngày, thêm `{d.amLich && <span className="...">ÂL</span>}` khi có ngày và `amLich === true`.

### 5. Không đổi
- DB schema, worker routes, `reshape.ts`, CSV import/export logic — dữ liệu đã đúng shape sẵn.

## Implementation risks

- Cần viết test mới cho `NgayThangInput` (auto-advance, backspace-lùi-ô, skip-ô-trống, checkbox toggle).
- Cập nhật test hiện có nếu đụng testid/field cũ trong `MemberManagementView.test.tsx` (data-testid đổi từ `namSinh_nam-{i}` sang prefix mới).
- `PersonForm.test.tsx` nếu có test gõ vào ô "dd/mm/yyyy" cũ cần cập nhật sang tương tác với ô mới (chưa thấy test loại này lúc scout, nhưng cần double-check lúc implement).

## Success metrics / validation

- Nhập ngày sinh/mất qua bảng Quản lý thành viên và qua PersonForm: gõ số tự nhảy ô, để trống ngày/tháng vẫn lưu được (chỉ có năm, hoặc năm+tháng), tick ÂL lưu đúng `amLich: true`.
- Dữ liệu cũ (đã có trong DB) hiển thị đúng khi load lại vào input mask.
- Trang chi tiết hiển thị "ÂL" đúng khi ngày là âm lịch.
- Không có thay đổi hành vi ở DB/API — kiểm bằng cách xem network payload gửi lên `/editor` giữ nguyên shape `namSinh`/`namMat`.

## Next steps

→ `/ck:plan` (mặc định, không TDD — tính năng mới, không sửa logic nghiệp vụ cũ cần bảo toàn hành vi qua test-first).

## Unresolved questions

Không có — mọi quyết định đã chốt qua AskUserQuestion trong phiên brainstorm này.
