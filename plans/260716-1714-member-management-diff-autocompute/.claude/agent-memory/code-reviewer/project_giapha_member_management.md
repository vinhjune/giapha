---
name: project-giapha-member-management
description: giapha repo's MemberManagementView.tsx architecture — diff/highlight/auto-compute layering, known latent risks
metadata:
  type: project
---

`src/components/MemberManagementView.tsx` (the "Quản lý thành viên" table screen) uses a layered
pure-utility architecture that later reviews should expect to see reused, not reimplemented:

- `src/utils/memberRowDiff.ts` — `isNewRow`, `getChangedFields`, `personToRow`. Canonical diff
  between an `EditableRow` (all-string table row shape) and a saved `Person`. Handles `NgayThang`
  deep-equality and `voChongIds` (semicolon-joined spouse ids) set-equality specially. Both
  selective-apply (skip no-op rows) and cell-highlighting reuse this same util — if a future change
  touches one without the other, check both call sites.
- `src/utils/memberAutoCompute.ts` — `computeThuTuDoi` (whole-graph fixed-point propagation of
  generation number via blood-parent+1 or spouse fallback) and `computeThuTuAnhChi` (sibling
  birth-order recompute scoped to families with a "target member"). Both are pure, client-side only
  (no network calls), staged into `rows` via `setRows`, never touching `data`/the store.
- `handleApplyChanges` in the component calls `api.*` functions directly (not the zustand store's
  `themNguoi`/`suaNguoi`/`xoaNguoi` wrappers) and does exactly one `loadData()` at the end of the
  batch — this is deliberate (avoids N sequential mutation+full-reload round trips). The store
  wrappers are still correct and still used by `PersonForm.tsx`'s single-edit flow; don't "fix" one
  to match the other, they're different call patterns for different UX needs.

**Known latent risks in this file (not necessarily fixed, check before assuming stale):**
- `createEmptyRow(prev.length + 1)` generates `_key: 'new-${index}'` from array length at insertion
  time; combined with prepend-on-add, two different new rows can end up with the same `_key`
  (delete + re-add cycling through the same length value). This became more consequential once
  `memberAutoCompute.ts` started keying correctness-critical Maps (`doiById`, `updatedByKey`) by
  `_key` — a collision would silently merge two distinct rows' computed values. Was pre-existing
  before the diff-autocompute plan (260716-1714), not introduced by it. See if this has been fixed
  by checking `createEmptyRow`'s key generation scheme.
- `data.persons[row.id]` lookups (indexing without `.trim()`) exist alongside `isNewRow`'s trimmed
  comparison in a couple of spots — currently unreachable since the `id` column is a disabled input
  (never user-edited, always server-supplied or empty), but worth re-checking if `id` editability
  ever changes.

See [[feedback-hand-trace-fixed-point-logic]] for how I verify convergence/warning-timing claims
in this kind of algorithm rather than trusting test names.
