---
title: 'Tree view: per-node expand/collapse with reflow'
description: >-
  Add manual collapse/expand toggle per node in TreeView so hidden subtrees
  reflow siblings closer, per approved brainstorm design.
status: completed
priority: P2
branch: improve-cay
tags:
  - tree-view
  - ux
blockedBy: []
blocks: []
created: '2026-07-16T13:54:00.766Z'
createdBy: 'ck:plan'
source: skill
---

# Tree view: per-node expand/collapse with reflow

## Overview

Cây gia phả sâu/rộng khó duyệt. Thêm nút thu gọn/mở rộng trên mỗi node có con trong
`TreeView.tsx`: thu gọn ẩn hết nhánh con (mọi cuộc hôn nhân) của node đó, layout tự
reflow để các node anh/em (và các subtree lân cận) co lại gần nhau hơn — tái dùng
layout engine bottom-up/top-down sẵn có, chỉ thêm 1 guard theo `collapsedIds`.

Full design + approaches đã cân nhắc: xem
`plans/reports/brainstorm-260716-1524-tree-expand-collapse-navigation-report.md`.

Scope đã chốt (không mở rộng thêm ở plan này):
- Local state trong `TreeView.tsx`, KHÔNG persist qua tab switch / reload.
- Collapse toàn bộ node (mọi marriage), KHÔNG theo từng marriage zone riêng.
- Badge `+N` = số hậu duệ đang ẩn.
- KHÔNG thêm nút "Thu gọn tất cả" / "Mở rộng tất cả".
- KHÔNG đụng vào `SearchBar`/`SearchResults`.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Layout engine + toggle UI](./phase-01-layout-engine-toggle-ui.md) | Completed |
| 2 | [Tests and verification](./phase-02-tests-and-verification.md) | Completed |

## Dependencies

None. Scanned other in-flight plans (`260716-0921-frontend-modernization`,
`260716-1147-member-table-generation-ngoaitoc-namelookup`,
`260716-1317-member-date-input-lunar-toggle`) — none touch `TreeView.tsx` or
`PersonCard.tsx`, no blocking relationship.
