---
phase: 3
title: Highlight unsaved fields
status: completed
priority: P2
dependencies:
  - 1
---

# Phase 3: Highlight unsaved fields

## Overview

Visually mark cells/rows in the member table that have local edits not yet persisted via "Áp dụng thay đổi", using the phase 1 diff utility. Clears automatically after a successful apply (since `loadData()` refreshes `data.persons`, `rows` gets reset via the existing reset-on-load pattern — verify this, see Risk section).

## Requirements

- Functional:
  - A brand-new row (per `isNewRow`) gets its entire row visually marked as "new/unsaved" (e.g. a distinct row background).
  - An existing row with 1+ changed fields (per `getChangedFields`) gets only those specific cells marked as "edited/unsaved" — not the whole row, so the user can see exactly which fields changed.
  - The marking must be visually distinct from the existing `hover:bg-blue-50/30` row-hover style and from the existing red error banner styling (no color collision).
  - Marking clears the moment the change is saved and `rows` resyncs from fresh `data.persons` — no stale highlight after a successful Apply.
  - Add a short inline legend near the table (matches the existing lightweight text style used for `saveMessage`/`errorMessages`) explaining the two highlight colors, since this is a new UI convention the user hasn't seen before.

## Architecture

Compute a per-render diff map with `useMemo`, keyed by row index (or `_key`), derived from `[rows, data.persons]`:

```ts
const originalIds = useMemo(() => new Set(Object.keys(data.persons)), [data.persons])
const rowDirtyInfo = useMemo(() => rows.map(row => {
  if (isNewRow(row, originalIds)) return { isNew: true, changedFields: new Set<RowField>() }
  const original = personToRow(data.persons[row.id])
  return { isNew: false, changedFields: new Set(getChangedFields(row, original)) }
}), [rows, data.persons, originalIds])
```

In the `<tr>`/`<td>` render loop, read `rowDirtyInfo[rowIndex]`:
- `isNew` → add a row-level background class (e.g. `bg-emerald-50/60`) to the `<tr>`.
- else, for each column, if `changedFields.has(col.key)` → add a cell-level highlight class (e.g. `bg-amber-50 ring-1 ring-inset ring-amber-300`) to that `<td>`.

Use a `data-testid` or `data-dirty` attribute alongside the class so tests assert on something more stable than a Tailwind class string (e.g. `data-dirty={changedFields.has(col.key) ? 'true' : undefined}` on the `<td>`).

## Related Code Files

- Modify: `src/components/MemberManagementView.tsx` (render loop only — no changes to state/handlers beyond the new `useMemo`)
- Modify: `src/components/MemberManagementView.test.tsx` (add highlight assertions)

## Implementation Steps

1. Add the `rowDirtyInfo` `useMemo` described above, importing `isNewRow`/`getChangedFields` from `src/utils/memberRowDiff.ts` and reusing the already-exported `personToRow`.
2. In the `<tr>` render, conditionally append the new-row background class based on `rowDirtyInfo[rowIndex].isNew`.
3. In the `<td>` render (inside the `COLUMNS.map` loop), conditionally append the changed-field highlight class + `data-dirty` attribute based on `rowDirtyInfo[rowIndex].changedFields.has(col.key)`. Skip this for the `isNew` row case (whole row already marked; don't double-mark individual cells).
4. Add a one-line legend under the table, near the existing `saveMessage`/`errorMessages` block: e.g. "🟩 Dòng mới · 🟨 Trường đã sửa, chưa lưu".
5. Add tests to `MemberManagementView.test.tsx`:
   - Editing a cell in an existing row marks that cell `data-dirty="true"` and does NOT mark a sibling untouched cell in the same row.
   - Adding a new row (via "Thêm dòng mới") marks the new row with the new-row background class/attribute.
   - After a successful "Áp dụng thay đổi" (mock `getTree` to return the updated data), the previously-dirty cell/row no longer carries the dirty marker.
6. Run `npm run test:run`, `npm run lint`, `tsc -b`.

## Success Criteria

- [x] New rows are visually distinguishable from saved rows.
- [x] Edited fields in existing rows are visually distinguishable at the cell level, not the whole row.
- [x] Highlight clears after a successful Apply.
- [x] Legend text present and matches actual colors used.
- [x] New tests pass; full suite + lint + typecheck clean.

## Risk Assessment

- **Risk:** confirm `rows` actually resyncs from `data.persons` after `loadData()` runs post-Apply. Re-reading current `MemberManagementView.tsx`: `rows` state is initialized once via `useState(() => ...)` and only otherwise updated via `handleResetRows` (manual "Hoàn tác" click) — it is **not** currently re-derived automatically when `data` changes after a successful Apply. This means today, after Apply succeeds, the table keeps showing the user's local edits (which happen to now match the server) rather than resetting — that's fine for the current UI since it looks the same either way. But for this phase's "highlight clears after save," if `rows` isn't resynced, the highlight also won't clear (it'll keep comparing against the now-updated `data.persons`, which SHOULD actually correctly show no diff once `data` reflects the save — so it clears anyway as a side effect of the diff being against live `data`, not a stale snapshot). Verify this reasoning empirically via the test in step 5 rather than assuming; if it doesn't clear, the fix is within this phase's scope (not a phase 2 defect) — do not silently change phase 2's reload behavior to "fix" this.
- **Risk:** performance of recomputing `getChangedFields` for every row on every render (e.g. on each keystroke, since `rows` changes) — for typical family sizes (tens to low hundreds of members) this is negligible; do not add memoized per-row diffing beyond the single `useMemo` above unless a real slowdown is observed (YAGNI).
