# Thiết kế: Sắp xếp theo cột tuỳ ý trong Quản lý thành viên

## Bối cảnh

Trang Quản lý thành viên (`src/components/MemberManagementView.tsx`) hiển thị toàn bộ thành viên trong một bảng có thể chỉnh sửa trực tiếp (inline edit). Hiện tại bảng không hỗ trợ sắp xếp — thứ tự hàng cố định theo thứ tự trả về từ `Object.values(data.persons)`.

Yêu cầu: thêm khả năng sắp xếp theo bất kỳ cột nào, theo chiều tăng (ASC) hoặc giảm (DESC), bằng cách click vào tiêu đề cột.

### Ràng buộc quan trọng đã phát hiện

Toàn bộ handler chỉnh sửa (`handleCellChange`, `handleDateChange`, `handleDeleteRow`, picker cho Bố/Mẹ/Vợ-chồng) nhận **index vị trí trong mảng `rows`** (state) làm tham số, và cập nhật bằng `prev.map((row, i) => i === index ? ... : row)`.

Ngoài ra, `computeThuTuAnhChi` (trong `src/utils/memberAutoCompute.ts`) dùng **thứ tự hiện tại của mảng `rows`** làm tiêu chí tie-break cuối cùng khi tính lại "Thứ tự anh/chị" (`birthOrderTiebreak`, dòng 118-125: "stable sort preserves current table row order as the final tiebreak").

⇒ **Sắp xếp phải là display-only**: không được đổi thứ tự mảng `rows` gốc. Chỉ thay đổi thứ tự *hiển thị*, đồng thời map lại đúng `originalIndex` (vị trí thật trong `rows`) cho mọi handler và `data-testid`/aria-label.

## Phạm vi

- **Trong phạm vi:** sắp xếp theo 1 cột tại một thời điểm, cho tất cả cột trừ Vợ/chồng (đa giá trị, không có ý nghĩa sắp xếp rõ ràng).
- **Ngoài phạm vi:** sắp xếp nhiều cột đồng thời (multi-column sort), lưu trạng thái sort vào URL/localStorage, sắp xếp theo cột Vợ/chồng.

## Thiết kế

### 1. State sort trong `MemberManagementView`

```ts
type SortState = { field: RowField; direction: 'asc' | 'desc' } | null
const [sortState, setSortState] = useState<SortState>(null)
```

Trạng thái này độc lập với `rows` — không bị reset khi thêm/xoá/sửa dòng, "Hoàn tác", "Tự động cập nhật" hay "Áp dụng thay đổi" (chỉ reset khi người dùng click cột 3 lần để tắt sort, hoặc chuyển cột khác).

### 2. Module comparator mới: `src/utils/memberRowSort.ts`

```ts
export const SORTABLE_FIELDS: ReadonlySet<RowField> // = tất cả field trong COLUMNS trừ 'voChongIds'

export type SortDirection = 'asc' | 'desc'
export type SortState = { field: RowField; direction: SortDirection } | null

export interface IndexedRow { row: EditableRow; originalIndex: number }

export function sortRowsForDisplay(
  rows: EditableRow[],
  sortState: SortState,
  getName: (id: string) => string,
): IndexedRow[]
```

**Sort key theo field** (hàm nội bộ `getSortKey(row, field, getName): string | number | null`):

| Field | Sort key | Giá trị "trống" |
|---|---|---|
| `id`, `hoTen`, `queQuan`, `tieuSu`, `email`, `soDienThoai`, `ghiChu` | chuỗi đã trim | `null` nếu rỗng |
| `thuTuDoi`, `thuTuAnhChi` | `Number(value)` | `null` nếu rỗng hoặc không phải số hợp lệ |
| `namSinh`, `namMat` | số tổng hợp `nam * 10000 + (thang ?? 0) * 100 + (ngay ?? 0)` | `null` nếu `undefined` |
| `boId`, `meId` | `getName(id) \|\| id` (khớp đúng text hiển thị trên UI) | `null` nếu id rỗng |
| `gioiTinh` | rank cố định: `nam` → 0, `nu` → 1, `khac` → 2 | không áp dụng (luôn có giá trị) |
| `laThanhVienHo` | rank: `'true'` → 0, `'false'` → 1 | không áp dụng (checkbox luôn có giá trị) |

**Hàm so sánh key** (`compareSortKeys(a, b): number`):
- `null` luôn được coi là **nhỏ nhất** (áp dụng cho cả ASC và DESC — theo quyết định: ASC thì trống lên đầu, DESC thì trống xuống cuối, tức "trống = giá trị nhỏ nhất" một cách nhất quán).
- Number so Number: trừ trực tiếp.
- String so String: `localeCompare(b, 'vi', { sensitivity: 'base', numeric: true })` (numeric: true giúp so `"2" < "10"` đúng thay vì theo alphabet).

**`sortRowsForDisplay`:**
```ts
function sortRowsForDisplay(rows, sortState, getName) {
  const indexed = rows.map((row, originalIndex) => ({ row, originalIndex }))
  if (!sortState) return indexed
  const { field, direction } = sortState
  const dir = direction === 'asc' ? 1 : -1
  return [...indexed].sort((a, b) => {
    const ka = getSortKey(a.row, field, getName)
    const kb = getSortKey(b.row, field, getName)
    return compareSortKeys(ka, kb) * dir
  })
  // Array.prototype.sort là stable theo ES2019+ (đảm bảo bởi Node/browser hiện đại)
}
```

### 3. Tích hợp vào component

- Thay `rows.map((row, rowIndex) => ...)` bằng:
  ```ts
  const displayRows = useMemo(
    () => sortRowsForDisplay(rows, sortState, getName),
    [rows, sortState, data],
  )
  ...
  displayRows.map(({ row, originalIndex }) => { ... })
  ```
- Mọi nơi đang dùng `rowIndex` để: gọi `handleCellChange`, `handleDateChange`, `handleDeleteRow`, `setPicker({ rowIndex, field })`, đọc `rowDirtyInfo[rowIndex]`, tạo `data-testid`/`aria-label` → đổi thành **`originalIndex`**.
- `getName` cần được định nghĩa trước `displayRows` (di chuyển lên nếu cần) vì dùng trong `useMemo`.

### 4. UI header — click để sort

Với mỗi `<th>` thuộc `SORTABLE_FIELDS`:
```ts
function handleHeaderSortClick(field: RowField) {
  if (!SORTABLE_FIELDS.has(field)) return
  setSortState(prev => {
    if (!prev || prev.field !== field) return { field, direction: 'asc' }
    if (prev.direction === 'asc') return { field, direction: 'desc' }
    return null
  })
}
```
- Click cột chưa active hoặc cột khác → nhảy thẳng `asc`.
- Click lại cùng cột: `asc → desc → none (bỏ sort)`.
- Hiển thị icon `▲` (asc) / `▼` (desc) cạnh label cột đang active; không icon khi không sort.
- Thêm `aria-sort="ascending" | "descending" | "none"`, `role="button"`, `tabIndex={0}`, `onKeyDown` (Enter/Space) cho accessibility.
- Cột **Vợ/chồng** giữ nguyên `<th>` tĩnh, không cursor-pointer, không click handler.

## Test matrix

**Unit test** (`src/utils/memberRowSort.test.ts` — file mới):
- String field: so sánh có dấu tiếng Việt đúng thứ tự, trống lên đầu khi ASC / xuống cuối khi DESC.
- Numeric field (`thuTuDoi`): "2" < "10" (không theo alphabet); giá trị không hợp lệ coi như trống.
- Date field (`namSinh`): so đúng theo năm/tháng/ngày; `undefined` xử lý như trống.
- Enum rank (`gioiTinh`): đúng thứ tự nam→nữ→khác và ngược lại khi DESC.
- Boolean rank (`laThanhVienHo`): thành viên họ trước ngoại tộc.
- `boId`/`meId`: sort theo tên đã resolve (`getName`), không theo ID thô.
- Stable sort: các dòng có key bằng nhau giữ nguyên thứ tự tương đối ban đầu.

**Component test** (bổ sung vào `MemberManagementView.test.tsx`):
- Click header → DOM hiển thị đúng thứ tự mới (kiểm tra qua `getByTestId('hoTen-<originalIndex>')` hoặc nội dung text theo thứ tự render).
- Click lại cùng header → đảo chiều DESC.
- Click lần 3 → về trạng thái không sort (thứ tự gốc).
- **Regression quan trọng nhất:** sau khi sort, sửa nội dung một ô hoặc xoá một dòng → đúng dữ liệu bị thay đổi (không lệch index).
- Toàn bộ test hiện có trong file phải pass không sửa đổi (mặc định không sort ⇒ thứ tự không đổi).

## Rủi ro & giảm thiểu

| Rủi ro | Khả năng | Tác động | Giảm thiểu |
|---|---|---|---|
| Sai `originalIndex` khi sort dẫn đến sửa/xoá nhầm dòng | Trung bình | Cao | Test regression edit/delete-after-sort; tách rõ `originalIndex` vs vị trí hiển thị trong toàn bộ code |
| Dòng mới thêm khi đang sort không nằm đầu bảng | Cao | Thấp | Chấp nhận — hành vi hợp lý (dòng mới rỗng sẽ theo đúng vị trí trống trong sort order), không cần xử lý đặc biệt |
| `computeThuTuAnhChi` bị ảnh hưởng bởi thứ tự hiển thị khi đang sort | Thấp (đã audit) | Cao nếu xảy ra | Đảm bảo `rows` gốc không đổi thứ tự — chỉ `displayRows` (biến cục bộ) bị sort |

## Tương thích & Rollback

- Không đổi data model, API, hay props ra ngoài component.
- Thêm 1 file mới (`memberRowSort.ts`) + sửa 1 file hiện có (`MemberManagementView.tsx`) + test files. Rollback = revert 2 file.
- Trạng thái sort không persist (mất khi reload trang) — chấp nhận được, không cần migration.
