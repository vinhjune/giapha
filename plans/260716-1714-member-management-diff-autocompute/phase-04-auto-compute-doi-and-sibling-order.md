---
phase: 4
title: Auto-compute Doi and sibling order
status: completed
priority: P2
dependencies: []
---

# Phase 4: Auto-compute Đời and sibling order

## Overview

Add a "Tự động cập nhật" button that computes `thuTuDoi` (Đời) and `thuTuAnhChi` (Thứ tự anh/chị) for members that need it and stages the results into the editable table (no network calls — the user still clicks "Áp dụng thay đổi" to persist, per the confirmed design decision in `plan.md`).

## Requirements

Functional — Đời (generation number):

- Operates on the live `rows` state (including any unsaved edits made this session — e.g. a boId/meId change picked via `PersonPicker` earlier in the same editing session must feed into this computation), not the stale `data.persons`.
- For a person with a blood parent (`boId` or `meId` set) whose Đời is known (or becomes known during propagation): `thuTuDoi = parentThuTuDoi + 1`. **[Validation Session 1, confirmed]** If both parents are set and both have a known Đời that disagree (data inconsistency), prefer `boId`'s value and add a warning noting the conflict (does not block other computations) — this is a confirmed decision, not an open question.
- For a person with no blood parent but at least one spouse (`honNhan`) whose Đời is known: `thuTuDoi = spouseThuTuDoi` (matches the existing DB schema comment in `worker/src/db/schema.ts` — "thuTuDoi ... resolved via parent OR spouse ... set for ngoại tộc members too"). If multiple spouses have different known Đời values, prefer the first `honNhan` entry's spouse and warn about the conflict.
- For a person with neither a resolvable blood parent nor a resolvable spouse Đời: if they already have a manually-entered Đời, leave it untouched (this is a root/anchor, e.g. the founding ancestor) — do not overwrite. If they have no Đời at all, leave it blank and add them to a warnings list ("Không thể tính Đời cho {tên}: thiếu thông tin bố/mẹ hoặc vợ/chồng có Đời").
- **[Validation Session 1, confirmed]** For a person WHO DOES have a resolvable blood-parent basis but ALREADY has a manually-typed Đời that disagrees with the parent-derived value: overwrite with the parent-derived value (blood lineage always wins when a parent link exists). This is staged into `rows`, not saved — phase 3's highlight makes the overwritten cell visible so the user can review it before clicking "Áp dụng thay đổi". No warning needed for this case (it's not an unresolvable conflict, just a stale value getting corrected).
- Compute via **whole-graph fixed-point propagation**: seed a working map with every row's current `thuTuDoi` (if numeric), then repeatedly pass over all rows recomputing from parent/spouse until no value changes (or a max-iteration bound equal to the row count is hit, to guarantee termination even against a cyclic/malformed graph — on hitting the bound without convergence, add an explicit warning naming the still-unresolved rows rather than looping forever or throwing).
- After convergence, for every row whose newly-computed Đời differs from its current value (including rows not otherwise "new" or "edited" this session — this is the deliberate cascading behavior confirmed with the user: shifting one ancestor's Đời ripples to their entire branch), stage the new value into `rows`.
- Do not touch rows whose computed value already matches their current value (avoids spurious highlight/no-op writes).

Functional — Thứ tự anh/chị (sibling order):

- Group rows by `(boId, meId)` pair (a "family"); skip rows with both `boId` and `meId` empty (no family to order within).
- Within a family, only consider children with `laThanhVienHo === 'true'` for ordering; `laThanhVienHo === 'false'` (ngoại tộc) children are never assigned a `thuTuAnhChi` and are excluded from the sibling count entirely (per explicit requirement — "bỏ qua không cần tính Thứ tự anh/chị của các thành viên ngoại tộc").
- A family is "in scope" if at least one of its `laThanhVienHo === 'true'` children is a "target member": newly added this session, edited this session (any field, not just sibling-order-related), or currently missing `thuTuAnhChi`.
- For every in-scope family, recompute `thuTuAnhChi` for **all** `laThanhVienHo === 'true'` children in that family (confirmed with user: full family recompute, not just the target children) — sort by birth year ascending (`namSinh.nam`, then `namSinh.thang ?? 0`, then `namSinh.ngay ?? 0`), children with no birth year sort last, and among those tied (no birth year, or fully identical birth date), keep their current relative order stable (use current `thuTuAnhChi` if set, else current table row order as the final tiebreak — do not randomize). Assign 1..N sequentially per the sorted order.
- Families with no in-scope target child are left completely untouched, even if their children's birth-year-implied order would differ from current `thuTuAnhChi` values.
- Stage only the rows whose computed `thuTuAnhChi` differs from their current value.

Non-functional:

- Pure computation, no network calls, no mutation of `data` — only `setRows(...)`.
- Runs entirely client-side against the current `rows` array at the moment the button is clicked.

## Architecture

New file `src/utils/memberAutoCompute.ts`, taking `EditableRow[]` (imported from `MemberManagementView.tsx`, same pattern as phase 1's `memberRowDiff.ts`) and returning staged updates + warnings, kept as two separate pure functions so each is independently testable:

```ts
export interface AutoComputeResult {
  updatedRows: EditableRow[]   // same array, with thuTuDoi/thuTuAnhChi patched where changed
  warnings: string[]            // Vietnamese, human-readable, same style as existing errorMessages
}

export function computeThuTuDoi(rows: EditableRow[]): AutoComputeResult { ... }
export function computeThuTuAnhChi(rows: EditableRow[]): AutoComputeResult { ... }
```

`MemberManagementView.tsx`'s new handler composes both:

```ts
function handleAutoCompute() {
  const doiResult = computeThuTuDoi(rows)
  const anhChiResult = computeThuTuAnhChi(doiResult.updatedRows) // chain: sibling order may as well see freshly-computed Đời, though it doesn't depend on it
  setRows(anhChiResult.updatedRows)
  setSaveMessage(...) // summary: "Đã tính lại Đời cho X thành viên, Thứ tự anh/chị cho Y thành viên."
  setErrorMessages([...doiResult.warnings, ...anhChiResult.warnings]) // reuse existing warning-banner UI, or a separate amber (not red) banner since these are warnings, not apply failures — see Implementation Steps
}
```

Reuse `boId`/`meId`/`voChongIds`/`laThanhVienHo`/`namSinh`/`thuTuDoi`/`thuTuAnhChi`/`id` fields already present on `EditableRow` — no new fields needed.

New unresolvable-member note: since `PersonPicker` (confirmed via `src/components/PersonPicker.tsx`) only lists `data.persons` (already-saved persons), a brand-new unsaved row can never be selected as another row's `boId`/`meId`/spouse within the same editing session. This means new rows are always graph leaves relative to each other — no temp-ID resolution logic is needed for cross-referencing two new rows. Document this as a known limitation rather than building around it (YAGNI): if a user wants to insert a new senior ancestor above an existing root, they must Apply the new ancestor first (to get a real id), then in a follow-up edit re-parent the existing root to them, then run "Tự động cập nhật" again — this second run is what triggers the cascading recompute described in `plan.md`.

## Related Code Files

- Create: `src/utils/memberAutoCompute.ts`
- Create: `src/utils/memberAutoCompute.test.ts`
- Modify: `src/components/MemberManagementView.tsx` (new "Tự động cập nhật" button + handler, warning banner display)
- Modify: `src/components/MemberManagementView.test.tsx` (new test cases)

## Implementation Steps

1. Create `src/utils/memberAutoCompute.ts` with `computeThuTuDoi`.
   - Build `originalIds`-independent lookup: `Map<id, EditableRow>` from `rows` (only rows with a non-empty `id` — new rows can't be referenced by others, per Architecture note, but still need their own Đời computed as leaves).
   - Seed `doiById: Map<string, number>` from every row's current numeric `thuTuDoi` (both saved and new rows — a new row might have had Đời typed in manually already).
   - Fixed-point loop (bounded by `rows.length` iterations): for each row, compute candidate Đời from `boId`'s known value +1, else `meId`'s known value +1, else first spouse-in-`voChongIds`-with-known-Đời's value; if candidate differs from `doiById.get(rowKey)`, update and mark changed; repeat until a full pass makes no changes or the bound is hit.
   - After convergence: for each row, if `doiById` has a value different from the row's current `thuTuDoi` string, stage it; if a row has no resolvable value AND no existing value, push a warning.
2. Add `computeThuTuAnhChi` to the same file: group by `(boId, meId)`, filter `laThanhVienHo === 'true'`, determine in-scope families via the target-member rule, sort and assign per the Requirements section, stage diffs, no warnings needed for this half (there's no "unresolvable" case — everyone in an in-scope family gets a number).
3. Write `src/utils/memberAutoCompute.test.ts` covering:
   - Simple 2-generation chain: child's Đời computed from parent's Đời + 1.
   - Ngoại tộc spouse with no blood parent: Đời computed from spouse's Đời.
   - Person with neither parent nor spouse basis and no existing Đời → warning, left blank.
   - Person with neither basis but an existing manually-set Đời → left untouched, no warning (this is the anchor case).
   - Cascading case: a root ancestor (existing Đời=1, no parent) gets a `boId` pointing to a brand-new row with Đời=1 (manually typed) → after compute, the old root's Đời becomes 2 (propagation triggers even though the old root wasn't otherwise "edited" in the `getChangedFields` sense — it WAS edited, since its `boId` changed, which is what feeds this computation; confirm the test setup actually changes `boId` on that row to be accurate).
   - Sibling order: 3 children of the same parents, 2 already have `thuTuAnhChi` set correctly, 1 new child added with only a birth year → recompute renumbers all 3 by birth year (confirm this matches the "recompute whole family" decision, i.e. even the 2 already-correct siblings get rewritten, though their values shouldn't change if they were already correct).
   - Sibling order: family with no target child → left completely untouched even if birth-year order would imply a different sequence.
   - Sibling order: `laThanhVienHo === 'false'` child in the same family → never gets a `thuTuAnhChi`, not counted among siblings.
4. Add the "Tự động cập nhật" button to `MemberManagementView.tsx`'s toolbar (next to "Thêm dòng mới"/"Hoàn tác"/"Áp dụng thay đổi"), wired to the composed handler from the Architecture section.
5. **[Validation Session 1, confirmed]** Add a dedicated `autoComputeWarnings: string[]` state (separate from `errorMessages`) and render it as its own amber banner (e.g. `bg-amber-50 border-amber-200 text-amber-800`, structurally similar to `CyclicRelationshipBanner.tsx`'s rose/red banner but amber) below the toolbar. This is a confirmed decision — do not reuse the red `errorMessages` banner, since amber ("couldn't compute, informational") must stay visually distinct from red ("Apply failed").
6. Add tests to `MemberManagementView.test.tsx`:
   - Clicking "Tự động cập nhật" fills a blank Đời cell for a row with a known parent, and the cell shows the phase-3 "unsaved edit" highlight afterward (integration check that phases 3 and 4 compose correctly).
   - Clicking it does NOT call any `api.*` function (no network calls).
   - A member with no resolvable basis produces a warning message containing their name.
7. Run `npm run test:run`, `npm run lint`, `tsc -b`.

## Success Criteria

- [x] "Tự động cập nhật" button present, staged results appear only in the table (no network calls triggered).
- [x] Đời computed correctly for blood-lineage and spouse-fallback cases; unresolvable members warned, not silently defaulted.
- [x] Cascading Đời shift (root ancestor reparented) correctly ripples through descendants.
- [x] Thứ tự anh/chị recomputed for whole family only when a target child exists in that family; ngoại tộc children never assigned an order.
- [x] `memberAutoCompute.test.ts` covers all cases listed in Implementation Steps.
- [x] `npm run test:run`, `npm run lint`, `tsc -b` clean.

## Risk Assessment

- **Risk (business logic correctness):** this is the highest-complexity phase in the plan and encodes several nuanced, user-confirmed rules (spouse fallback, cascading, family-scoped sibling recompute) that are easy to get subtly wrong. Mitigate with the explicit test matrix above before considering this phase done — do not rely on manual QA alone for the algorithm correctness (manual QA against the live site is still needed for the UI wiring, per phase 2's note that this repo can't exercise the real D1 backend).
- **Risk (parent Đời conflict):** confirmed in Validation Session 1 — prefer `boId` + warning, not a hard-stop. No longer an open item.
- **Risk (silent overwrite of manual values):** confirmed in Validation Session 1 that a parent-derivable Đời always overwrites an existing manually-typed value that disagrees. Since this is staged (not saved directly), the phase 3 highlight is the safety net — if that highlight ever regresses, this becomes a silent-data-loss risk. Cross-reference: this is exactly why phase 3 landing before phase 4 (per `plan.md`'s phase ordering) matters, even though phase 4 has no hard code dependency on phase 3.
- **Risk (performance):** fixed-point propagation is O(rows × iterations) with iterations bounded by row count — worst case O(n²) for a long unbranched lineage chain. For realistic family sizes (hundreds, not tens of thousands) this is fine; do not pre-optimize into a topological sort unless a real family tree hits a noticeable delay (YAGNI).
