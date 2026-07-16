---
phase: 2
title: Tests and verification
status: completed
priority: P2
dependencies:
  - 1
---

# Phase 2: Tests and verification

## Overview

Thêm test regression cho hành vi collapse/expand vào `TreeView.test.tsx`, chạy
toàn bộ quality gates (typecheck, lint, test) để xác nhận Phase 1 không phá vỡ
layout hiện có và hành vi mới đúng như thiết kế đã duyệt.

## Requirements

- Functional: mọi success criteria của Phase 1 phải có test tự động phủ, không chỉ
  kiểm tra thủ công.
- Non-functional: test dùng data setup + helper render đã có sẵn trong
  `TreeView.test.tsx` (xem `describe('TreeView', ...)` ở đầu file) — không tạo
  fixture/mock mới nếu tái dùng được cái cũ.

## Related Code Files

- Modify: `src/components/TreeView.test.tsx`

## Implementation Steps

1. Đọc phần đầu `TreeView.test.tsx` (setup data, `beforeEach`, cách các test khác
   render và query DOM) để tái dùng đúng pattern hiện có (vd cách tạo persons giả,
   cách query bằng `screen.getByText`/`getByTestId`).

2. Thêm test: **leaf node không có toggle** — chọn 1 person không có `conCaiIds`
   trong data test, assert `queryByTestId('tree-toggle-{id}')` là `null`.

3. Thêm test: **node có con hiển thị toggle ở trạng thái mở** — assert
   `getByTestId('tree-toggle-{id}')` tồn tại và text là `−`.

4. Thêm test: **click toggle ẩn nhánh con + hiện badge đúng số** — với 1 person có
   N hậu duệ đã biết trước (đếm thủ công từ data test), click toggle, assert:
   - Các card con (theo tên) không còn trong DOM (`queryByText` trả null).
   - Toggle button đổi text thành `+N` đúng số.
   - Card của chính node đó và spouse (nếu có) vẫn còn trong DOM.

5. Thêm test: **expand lại trả về đúng vị trí ban đầu** — lấy `left`/`top` style
   (hoặc bounding rect nếu jsdom hỗ trợ) của 1 vài card trước khi collapse, collapse,
   rồi expand lại, assert style position bằng với giá trị ban đầu (regression-proof
   cho width math ở `calcSubtreeWidth`/`assignPositions`).

6. Thêm test: **siblings co lại gần hơn khi collapse** — so sánh `left` của 1
   sibling subtree trước/sau khi collapse subtree bên cạnh nó; assert khoảng cách
   giảm đi (subtree co lại đúng như mô tả gốc của user).

7. Thêm test: **click toggle không đổi selection** — click toggle, assert
   `selectedPersonId`/highlight style của các card khác không đổi (không có card
   nào bật `outline-accent` do click toggle gây ra).

8. Nếu data test hiện có không có person nào với 2+ cuộc hôn nhân đủ để test case
   "collapse ẩn TOÀN BỘ marriage" — thêm 1 person đa thê/đa phu tối thiểu vào fixture
   test (tái dùng helper tạo person đã có), assert cả 2 nhánh con (của cả 2 vợ/chồng)
   đều ẩn khi collapse node cha.

## Verification Commands

Chạy lần lượt, dừng và sửa nếu bất kỳ lệnh nào fail trước khi chạy lệnh tiếp theo:

```bash
npx tsc --noEmit
npm run lint
npx vitest run src/components/TreeView.test.tsx
npm run test:run
```

## Success Criteria

- [x] Tất cả test mới ở bước 2-8 pass.
- [x] Toàn bộ `TreeView.test.tsx` (test cũ + mới) pass — không sửa/xoá test cũ để
      né lỗi (theo development-rules.md: "Do not hide failing tests").
- [x] `npm run test:run` (toàn bộ test suite) pass.
- [x] `npx tsc --noEmit` và `npm run lint` sạch.

## Risk Assessment

- **Risk:** jsdom không tính layout thật (không có real CSS/measureText) nên assert
  bằng pixel tuyệt đối có thể fragile. **Mitigation:** ưu tiên assert bằng style
  props (`left`/`top` set qua inline style trong `TreeView.tsx`, không phải computed
  style từ CSS) — các test layout hiện có trong file đã dùng cách này thành công,
  tái dùng đúng pattern đó.
- **Risk:** Test data hiện tại có thể không đủ sâu/rộng để test rõ hiệu ứng "reflow
  siblings gần hơn". **Mitigation:** bước 6 có thể cần mở rộng fixture test (thêm
  1-2 người) nếu data hiện có không đủ minh hoạ.
