---
phase: 2
title: Selective apply and single reload
status: completed
priority: P1
dependencies:
  - 1
---

# Phase 2: Selective apply and single reload

## Overview

Rewrite `handleApplyChanges` so it (a) skips rows with no actual change — no network call at all — and (b) performs exactly one `loadData()` refresh after all mutations, instead of one per row. This is the fix for both requirement 3 (diff-based apply) and requirement 4 (the button "not working" — confirmed in `plan.md` to be this same N-reload performance bug, not a separate backend defect).

## Requirements

- Functional:
  - Deleted rows (id present in `data.persons` but no longer in the table): unchanged behavior — `api.deletePerson(id)` for each, collecting errors same as today.
  - New rows (per `isNewRow` from phase 1) with a non-empty `hoTen`: `api.createPerson(payload)`, same validation as today (Đời/Thứ tự anh/chị must be integers if present).
  - Existing rows whose id is in `originalIds`: compute `getChangedFields(row, personToRow(data.persons[row.id]))`. If empty, **skip entirely** — do not call `api.updatePerson`, do not count it in `savedCount`. If non-empty, call `api.updatePerson(id, payload)` as today.
  - After all deletes/creates/updates finish (success or partial failure), call `loadData()` from the store **exactly once** — not inside the per-row loop.
  - Keep existing behavior: a validation error on one row (e.g. non-numeric Đời) doesn't block other valid rows in the same batch; errors accumulate into `errorMessages` same as today.
  - `savedCount` in the success message should reflect actual mutations performed (creates + updates that ran), not total row count.
  - **[Validation Session 1]** The success message must report both the updated count and the skipped-unchanged count, e.g. "Đã cập nhật {updated} thành viên, bỏ qua {skipped} không đổi." — this makes the new diff behavior visible to the user rather than looking identical to the old "update everything" message. Compute `skipped` as the number of existing rows whose `getChangedFields` returned empty (i.e. rows that had a valid `hoTen` and an id in `originalIds` but no diff) — do not count deleted or newly-created rows in `skipped`.
- Non-functional: no change to `useGiaphaStore.ts`'s `themNguoi`/`suaNguoi`/`xoaNguoi` — those are still used by other single-edit call sites (e.g. `PersonForm.tsx` via whatever it uses) where one mutation + one reload is correct UX. Only `MemberManagementView.tsx`'s batch path changes to call `api.*` directly and `loadData` once.

## Architecture

`MemberManagementView.tsx` currently destructures `{ data, themNguoi, suaNguoi, xoaNguoi } = useGiaphaStore()`. Change to `{ data, loadData } = useGiaphaStore()` and `import * as api from '../services/api'` (already imported as a pattern in `api.ts`'s own consumers — check `useGiaphaStore.ts` for the exact import style and mirror it).

```ts
async function handleApplyChanges() {
  if (!data) return
  setSaving(true)
  setErrorMessages([])
  const errors: string[] = []
  const originalIds = new Set(Object.keys(data.persons))
  const remainingIds = new Set(rows.map(r => r.id.trim()).filter(Boolean))
  const deletedIds = [...originalIds].filter(id => !remainingIds.has(id))

  for (const id of deletedIds) {
    try { await api.deletePerson(id) } catch (e) { errors.push(`Xóa ${id}: ${(e as Error).message}`) }
  }

  let savedCount = 0
  let skippedCount = 0
  for (const row of rows) {
    if (!row.hoTen.trim()) continue
    if (row.thuTuDoi.trim() && !Number.isInteger(Number(row.thuTuDoi))) {
      errors.push(`${row.hoTen || row._key}: Đời phải là số`)
      continue
    }
    const payload = rowToPersonPayload(row)
    const trimmedId = row.id.trim()
    try {
      if (trimmedId && originalIds.has(trimmedId)) {
        const changed = getChangedFields(row, personToRow(data.persons[trimmedId]))
        if (changed.length === 0) { skippedCount++; continue } // no-op, no network call
        await api.updatePerson(trimmedId, payload)
      } else {
        await api.createPerson(payload)
      }
      savedCount++
    } catch (e) {
      errors.push(`${row.hoTen || row._key}: ${(e as Error).message}`)
    }
  }

  await loadData()
  setSaving(false)
  // on success: setSaveMessage(`Đã cập nhật ${savedCount} thành viên, bỏ qua ${skippedCount} không đổi.`)
  ...
}
```

Note: `savedCount` now excludes deletes (matches current behavior — deletes were never counted in `savedCount` today either, confirm this by re-reading current `handleApplyChanges` before changing the message copy).

## Related Code Files

- Modify: `src/components/MemberManagementView.tsx` (`handleApplyChanges`, imports)
- Modify: `src/components/MemberManagementView.test.tsx` (add coverage for the skip-unchanged-row case; existing tests must still pass since they only assert calls happen for rows that DID change)

## Implementation Steps

1. Add `import * as api from '../services/api'` and `import { isNewRow, getChangedFields } from '../utils/memberRowDiff'` to `MemberManagementView.tsx`.
2. Change the store destructure from `{ data, themNguoi, suaNguoi, xoaNguoi }` to `{ data, loadData }`.
3. Rewrite `handleApplyChanges` per the Architecture section: replace `xoaNguoi(id)` → `api.deletePerson(id)`, replace `suaNguoi(row.id.trim(), payload)` → gate on `getChangedFields` first then `api.updatePerson(...)`, replace `themNguoi(payload)` → `api.createPerson(payload)`, move the reload to a single `await loadData()` after the loops.
4. Re-check `rowToPersonPayload` is still called for every row that needs a mutation (both create and update paths) — no change needed there, just confirm it's still wired the same way.
5. Add a new test to `MemberManagementView.test.tsx`: render with two existing rows, edit only one field on one row, click "Áp dụng thay đổi", assert `api.updatePerson` was called exactly once and NOT for the untouched row's id.
6. Add a test asserting `api.updatePerson`/`api.createPerson`/`api.deletePerson` are followed by exactly one `api.getTree` call (mock `getTree` and count invocations) regardless of how many rows were mutated in the batch — this is the regression guard for the N-reload bug.
7. Run `npm run test:run`, `npm run lint`, `tsc -b`.

## Success Criteria

- [x] Editing 1 of N rows and applying triggers exactly 1 `updatePerson` call and exactly 1 `getTree` call (new test asserts this).
- [x] Success message reports both updated and skipped counts (e.g. "Đã cập nhật 1 thành viên, bỏ qua 1 không đổi.") — new test asserts the skipped count is non-zero when at least one existing row was left untouched.
- [x] Deleting a row still triggers `deletePerson`; adding a new row still triggers `createPerson`; both still followed by exactly 1 `getTree`.
- [x] All pre-existing `MemberManagementView.test.tsx` cases pass without modification to their assertions (only new tests added, unless an existing test's premise no longer holds — e.g. a test that asserted `updatePerson` was called for an untouched row would need updating; check the "allows toggling ngoại tộc and deleting a row" test doesn't also expect updates for rows it doesn't touch).
- [x] `npm run test:run`, `npm run lint`, `tsc -b` clean.
- [x] Manual smoke test note in the PR/summary: this phase cannot be verified end-to-end against the live Cloudflare+D1 backend from this environment — ask the user to re-test "Áp dụng thay đổi" on the deployed site after this ships, since that's the only way to confirm the perceived "hang" is resolved in production.

## Risk Assessment

- **Risk:** skipping unchanged rows relies entirely on phase 1's `getChangedFields` correctness. If it has a false-negative (says unchanged when it actually changed), a real edit silently fails to save. Mitigated by phase 1's explicit test coverage of the trickiest fields (dates, spouse list) plus this phase's own regression test asserting the touched row IS updated.
- **Risk:** removing per-row `loadData()` means `data.persons` used inside the loop (for `getChangedFields`'s "original" side) is a single snapshot taken before the loop starts, not updated as mutations happen. This is correct and intentional — the diff must be against the pre-batch state, not a state mutated mid-loop — but call this out explicitly so a future reviewer doesn't "fix" it back to per-row reload.
- **Risk:** sequential (not parallel) execution of creates/updates is preserved deliberately — `worker/src/routes/editor.ts`'s `syncParents`/`syncMarriages` do read-then-write find-or-create on the shared `families` table, which is not safe under concurrent requests. Do not parallelize this loop even though it would be faster; that's a separate, riskier change out of scope here.
