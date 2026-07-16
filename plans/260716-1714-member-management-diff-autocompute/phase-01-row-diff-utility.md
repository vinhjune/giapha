---
phase: 1
title: Row diff utility
status: completed
priority: P1
dependencies: []
---

# Phase 1: Row diff utility

## Overview

Extract a pure, unit-testable diff helper that answers, for any row currently in the editable table: is it new (unsaved insert), and if not, which fields differ from the last-loaded server value. Phase 2 (selective apply) and phase 3 (highlight) both consume this — building it once avoids duplicating comparison logic (namely: `NgayThang` deep-equality and `voChongIds` set-equality, both of which are easy to get wrong with a naive string/reference comparison).

## Requirements

- Functional:
  - `isNewRow(row, originalIds)` → true when the row has no id, or its id isn't a key in `originalIds` (mirrors the existing `originalIds`/`remainingIds` computation already in `handleApplyChanges`).
  - `getChangedFields(row, originalRow)` → array of `RowField` keys whose value differs from the original. Must special-case:
    - `namSinh`/`namMat` (type `NgayThang | undefined`): compare `nam`/`thang`/`ngay`/`amLich`, not object reference.
    - `voChongIds` (semicolon-joined string): compare as sets (sort both sides' split id arrays before comparing) so re-adding/removing spouses in a different order doesn't falsely flag "changed" when the resulting set is identical.
    - All other fields: plain string equality (already trimmed/normalized the same way `rowToPersonPayload` does, so the comparison basis matches what actually gets sent).
- Non-functional: pure functions, no React/store imports, so they're trivially testable in isolation and reusable from both the render path (phase 3) and the apply handler (phase 2).

## Architecture

New file `src/utils/memberRowDiff.ts`. It needs the `EditableRow`/`RowField`/`StringRowField`/`DateRowField` types currently defined locally in `src/components/MemberManagementView.tsx` (lines 7-20). Export those types from `MemberManagementView.tsx` (add `export` to the existing declarations — no shape changes) and import them into the new util file. Do not move the types into `src/types/giapha.ts`; `EditableRow` is a UI-editing concern (all-string fields for `<input>` binding), not a domain type, so it stays component-adjacent.

Also export a `personToRow` — it's already the canonical way to build an "original" row snapshot from a saved `Person`; the diff util's callers pass `personToRow(data.persons[row.id])` as the `originalRow` argument rather than duplicating that mapping.

```ts
// src/utils/memberRowDiff.ts
import type { EditableRow, RowField, DateRowField } from '../components/MemberManagementView'

const DATE_FIELDS: DateRowField[] = ['namSinh', 'namMat']

function ngayThangEqual(a: NgayThang | undefined, b: NgayThang | undefined): boolean { ... }
function voChongIdsEqual(a: string, b: string): boolean { ... } // split(';').trim().filter(Boolean).sort() then compare

export function isNewRow(row: EditableRow, originalIds: Set<string>): boolean {
  return !row.id.trim() || !originalIds.has(row.id.trim())
}

export function getChangedFields(row: EditableRow, originalRow: EditableRow): RowField[] { ... }
```

## Related Code Files

- Create: `src/utils/memberRowDiff.ts`
- Create: `src/utils/memberRowDiff.test.ts`
- Modify: `src/components/MemberManagementView.tsx` (export `EditableRow`, `RowField`, `StringRowField`, `DateRowField`, `personToRow` — no behavioral change in this phase)

## Implementation Steps

1. Add `export` to the type declarations and `personToRow` function in `MemberManagementView.tsx`. Run `tsc -b` to confirm nothing else needs to change (this is a pure export addition).
2. Create `src/utils/memberRowDiff.ts` with `isNewRow`, `getChangedFields`, and the two private equality helpers described above.
3. Write `src/utils/memberRowDiff.test.ts` covering:
   - `isNewRow` true for a row with empty `id`, true for a row whose `id` isn't in `originalIds`, false otherwise.
   - `getChangedFields` returns `[]` for two identical rows.
   - `getChangedFields` detects a changed plain string field (e.g. `hoTen`).
   - `getChangedFields` does NOT flag `namSinh` as changed when both sides represent the same date via different `undefined` vs missing-key shapes (guard against a naive `JSON.stringify` comparison bug).
   - `getChangedFields` DOES flag `namSinh` as changed when `amLich` differs but year/month/day are identical.
   - `getChangedFields` does NOT flag `voChongIds` as changed when the same two ids appear in a different order.
   - `getChangedFields` DOES flag `voChongIds` as changed when the set of ids differs.

## Success Criteria

- [x] `src/utils/memberRowDiff.ts` exists with `isNewRow` and `getChangedFields`, no React/store imports.
- [x] `src/utils/memberRowDiff.test.ts` passes and covers the date/voChongIds edge cases listed above.
- [x] `MemberManagementView.tsx` behavior is unchanged (this phase only adds exports) — existing `MemberManagementView.test.tsx` suite still passes unmodified.
- [x] `tsc -b` and `npm run lint` clean.

## Risk Assessment

Low risk — additive-only phase, no behavior change to the component. The main risk is under-covering the `NgayThang`/`voChongIds` equality edge cases, which would surface as false-positive "changed" flags later (spurious highlight in phase 3, spurious network calls in phase 2) — mitigated by the explicit test cases above.
