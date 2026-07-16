# Brainstorm: Expand/collapse subtrees in TreeView

Date: 2026-07-16 | Branch: improve-cay

## Problem

Cây gia phả có thể rất sâu/rộng, khó theo dõi (vd tìm anh/em của ai đó ở đời 3). Cần cách thu gọn/mở rộng nhánh theo ý muốn để các phần cây không liên quan co lại, giúp duyệt cây ở nhiều tầng dễ hơn.

## Codebase scout findings

- `src/components/TreeView.tsx`: toàn bộ layout tính trong 1 `useMemo` — `buildTree` (đệ quy) → `calcSubtreeWidth` (bottom-up) → `assignPositions` (top-down) → `collect` (flatten ra `cards[]`+`lines[]`). Chưa có khái niệm collapse.
- Không có state UI nào khác ngoài `selectedPersonId`/`focusedPersonId` và `hienThiThuTuDoi` (persist localStorage) trong `useGiaphaStore`.
- `TreeView` unmount khi chuyển tab (`HomePage.tsx`: `viewMode === 'tree' && <TreeView />`) → local state sẽ reset khi rời tab.
- `SearchBar`/`SearchResults` đã giải quyết phần "tìm theo tên" (gọi `focusPerson`/`selectPerson` → `TreeView` scroll+highlight). Không thuộc scope lần này.
- `PersonCard.tsx` thuần presentational, không cần sửa để thêm collapse (toggle sẽ là layer riêng trong `TreeView`).

## Approaches evaluated

| # | Approach | Verdict |
|---|---|---|
| A | Per-node manual collapse/expand, layout tự reflow | **Chọn** — đúng yêu cầu, tận dụng layout engine sẵn có |
| B | Generation-range filter (isolate gen N–M) | Loại — không có hiệu ứng "reflow anh em lại gần nhau", phá vỡ nối kết cha/con |
| C | Subtree re-root/focus + breadcrumb | Loại — mất ngữ cảnh anh/chị/em khi focus vào 1 nhánh, sai mục tiêu (tìm anh/em) |

## Final design (approved)

**State**: `collapsedIds: Set<string>` — local `useState` trong `TreeView.tsx`. Không persist qua tab switch / reload (YAGNI cho v1).

**Phạm vi collapse**: toàn bộ node — ẩn childNodes của TẤT CẢ các cuộc hôn nhân của người đó. Bản thân node + vợ/chồng vẫn hiển thị.

**Thay đổi layout engine** (mở rộng hàm hiện có, không thay thế):
1. `calcSubtreeWidth`: nếu `collapsedIds.has(node.person.id)` → coi `cW(childNodes)` của mọi marriage = 0.
2. `assignPositions`: cùng điều kiện → không đệ quy vào childNodes khi collapsed.
3. `collect`: khi collapsed → không push cards/lines của childNodes; thay vào đó push 1 entry vào `toggles[]`: `{ personId, x, y, hiddenCount, collapsed }`.

**Affordance**: nút tròn nhỏ ở đáy hàng của node (`−` khi mở, `+N` khi collapsed, N = số hậu duệ dang ẩn). Chỉ hiển thị với node có con. Render như layer riêng song song `cards`/`lines` (không sửa `PersonCard`). `stopPropagation()` để không trigger `selectPerson`.

**Tương thích ngược**: mặc định không collapse gì → output `cards`/`lines` giống hệt hiện tại, các test layout hiện có không cần sửa.

**Test mới cần thêm**: click toggle ẩn subtree + hiện badge đúng số; click lại (expand) trả về đúng vị trí như ban đầu; leaf node không có toggle.

## Explicitly out of scope (v1)

- Không persist collapse state qua tab switch/reload.
- Không collapse theo từng marriage zone riêng (chỉ toàn bộ node).
- Không thêm nút "Thu gọn tất cả"/"Mở rộng tất cả".
- Không động đến tính năng search hiện có.

## Unresolved questions

- Không có.
