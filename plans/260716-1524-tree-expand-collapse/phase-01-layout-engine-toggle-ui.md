---
phase: 1
title: Layout engine + toggle UI
status: completed
priority: P1
dependencies: []
---

# Phase 1: Layout engine + toggle UI

## Overview

Thêm `collapsedIds: Set<string>` state vào `TreeView.tsx`, cho `calcSubtreeWidth`/
`assignPositions`/`collect` biết bỏ qua children của node đang collapsed, và render
1 nút toggle (⊖ / +N) trên mỗi node có con.

## Requirements

- Functional:
  - Node có ít nhất 1 marriage với `childNodes.length > 0` hiển thị nút toggle.
  - Click toggle → ẩn/hiện toàn bộ childNodes của MỌI marriage thuộc node đó (không
    ẩn spouse card của chính node).
  - Khi collapsed: layout width/position coi node đó như không có children (giống
    leaf về mặt width), nên các subtree lân cận (siblings) co lại gần hơn.
  - Badge trên nút collapsed hiển thị `+N`, N = tổng số TreeNode hậu duệ (đệ quy qua
    mọi marriage) đang bị ẩn.
  - Click toggle không được trigger `selectPerson` (nút nằm chồng lên vùng card).
- Non-functional:
  - Không đổi output `cards`/`lines` khi `collapsedIds` rỗng (mặc định) — giữ nguyên
    layout hiện tại byte-for-byte để không phá test cũ.
  - Không đổi `PersonCard.tsx` — toggle là layer riêng trong `TreeView.tsx`.

## Architecture

Mở rộng 3 hàm layout hiện có bằng cách thêm tham số `collapsedIds: Set<string>`,
dùng nó làm guard để coi bề rộng/con của node collapsed = 0/không đệ quy. Thêm 1
hàm đếm hậu duệ thuần (`countDescendants`) và 1 mảng render mới `toggles[]` song
song với `cards[]`/`lines[]` đã có trong `collect()`.

```
calcSubtreeWidth(node, collapsedIds)   // zoneW dùng childrenW = 0 nếu collapsed
assignPositions(node, startX, depth, collapsedIds)  // không đệ quy vào childNodes nếu collapsed
collect(node, cards, lines, toggles, collapsedIds)  // không push child cards/lines nếu collapsed; luôn push 1 toggle nếu node có con
```

## Related Code Files

- Modify: `src/components/TreeView.tsx` (only file touched in this phase)

## Implementation Steps

1. **Thêm type `ToggleMarker`** cạnh `RenderCard`/`SvgLine` (khoảng dòng 51-63):
   ```ts
   interface ToggleMarker {
     personId: string
     x: number
     y: number
     hiddenCount: number
     collapsed: boolean
   }
   ```

2. **Thêm hàm đếm hậu duệ** cạnh `cW()` (khoảng dòng 167-169):
   ```ts
   function countDescendants(node: TreeNode): number {
     let count = 0
     for (const m of node.marriages) {
       count += m.childNodes.length
       for (const c of m.childNodes) count += countDescendants(c)
     }
     return count
   }
   ```

3. **Sửa `calcSubtreeWidth`** (dòng 206-230) — thêm param `collapsedIds`, dùng
   `collapsed = collapsedIds.has(node.person.id)` để zero-out `cW(childNodes)` ở
   cả 2 nhánh (single no-spouse group VÀ normal marriages loop). Giữ nguyên đệ quy
   post-order vào con (`for (const c of m.childNodes) calcSubtreeWidth(c, collapsedIds)`)
   — vẫn tính width của node con dù bị ẩn, để nếu user expand lại thì layout đã sẵn
   sàng, không cần tính lại từ đầu (memo vẫn phụ thuộc `collapsedIds` nên sẽ tính lại
   toàn bộ mỗi lần toggle — chấp nhận được vì cây gia phả nhỏ).

4. **Sửa `assignPositions`** (dòng 234-294) — thêm param `collapsedIds`, guard đệ quy
   `assignPositions(child, ...)` bằng `if (!collapsed && m.childNodes.length > 0)` ở
   cả 2 nhánh, và dùng `childrenW = collapsed ? 0 : cW(m.childNodes)` khi tính
   `zoneW`/`midX` centering.

5. **Sửa `collect`** (dòng 307-370) — thêm params `toggles: ToggleMarker[]`,
   `collapsedIds: Set<string>`.
   - Sau khi push person card + spouse cards (logic hiện tại giữ nguyên, không đổi):
     tính `hasChildren = node.marriages.some(m => m.childNodes.length > 0)`.
   - Nếu `hasChildren`: tính anchor `(anchorX, anchorY)` = `personCenterX` (đã có
     sẵn ở trong hàm), `anchorY = spouseMarriages.length > 0 ? spouseBotY : node.y + NODE_H`.
     Push `{ personId: node.person.id, x: anchorX, y: anchorY, hiddenCount: collapsed ? countDescendants(node) : 0, collapsed }`.
   - Trong vòng `for (const m of node.marriages)`: thêm `if (collapsed) continue`
     ngay sau `if (m.childNodes.length === 0) continue` — bỏ hoàn toàn việc push
     lines/cards và đệ quy `collect(child, ...)` cho marriage đó khi node collapsed.

6. **Thêm state + callback trong component** (gần dòng 389-391, cạnh
   `const [zoom, setZoom] = useState(1)`):
   ```ts
   const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())
   const toggleCollapse = useCallback((personId: string) => {
     setCollapsedIds(prev => {
       const next = new Set(prev)
       if (next.has(personId)) next.delete(personId)
       else next.add(personId)
       return next
     })
   }, [])
   ```

7. **Cập nhật `useMemo` layout** (dòng 403-454):
   - Thêm `collapsedIds` vào dependency array.
   - Khởi tạo `const toggles: ToggleMarker[] = []` cạnh `cards`/`lines`.
   - Cập nhật 3 call site để truyền `collapsedIds`:
     `calcSubtreeWidth(tree, collapsedIds)`, `assignPositions(tree, startX, 0, collapsedIds)`,
     `collect(tree, cards, lines, toggles, collapsedIds)`.
   - Return thêm `toggles` từ memo: `{ cards, lines, toggles, width, height }`.
   - Destructure `toggles` ở nơi gọi memo (khoảng dòng 403).

8. **Render toggle buttons trong JSX** (ngay sau khối `{cards.map(...)}`, trước
   `</div>` đóng scale layer, khoảng dòng 689):
   ```tsx
   {toggles.map(t => (
     <button
       key={`toggle-${t.personId}`}
       type="button"
       data-testid={`tree-toggle-${t.personId}`}
       aria-label={t.collapsed ? 'Mở rộng nhánh con' : 'Thu gọn nhánh con'}
       onClick={(e) => { e.stopPropagation(); toggleCollapse(t.personId) }}
       style={{ position: 'absolute', left: t.x - 12, top: t.y - 10, zIndex: 2 }}
       className="h-5 min-w-5 px-1 rounded-full border border-card-border bg-card text-[10px] font-semibold text-muted leading-5 text-center shadow-sm hover:bg-slate-50"
     >
       {t.collapsed ? `+${t.hiddenCount}` : '−'}
     </button>
   ))}
   ```

## Success Criteria

- [x] `npx tsc --noEmit` sạch (hoặc `npm run build`).
- [x] `npm run lint` sạch.
- [x] Với `collapsedIds` rỗng, `cards`/`lines` output không đổi so với trước khi sửa
      (verify bằng cách chạy lại toàn bộ `TreeView.test.tsx` hiện có — không sửa gì
      ở phase này, phải pass nguyên trạng).
- [x] Node có con hiển thị nút toggle; node lá (không con) không có nút.
- [x] Click toggle ẩn card/line của nhánh con, hiện badge `+N` đúng số hậu duệ.
- [x] Click lại (expand) → card/line quay lại y hệt trạng thái ban đầu.
- [x] Click toggle không đổi `selectedPersonId` (không trigger chọn person).

## Risk Assessment

- **Risk:** Quên guard 1 trong 2 nhánh của `calcSubtreeWidth`/`assignPositions`
  (single no-spouse group vs normal marriages loop) → lệch width khi collapse node
  không có spouse. **Mitigation:** test riêng cho cả 2 trường hợp ở Phase 2.
- **Risk:** `toggles[]` đè lên `cards[]` về mặt click target (nút nằm trên card).
  **Mitigation:** `stopPropagation()` trong onClick đã che; test click toggle rồi
  assert `selectedPersonId` không đổi.
- **Risk:** Memo tính lại toàn bộ layout mỗi lần toggle (không chỉ subtree bị ảnh
  hưởng) — với cây vài trăm người vẫn rẻ, không cần tối ưu thêm (YAGNI).
