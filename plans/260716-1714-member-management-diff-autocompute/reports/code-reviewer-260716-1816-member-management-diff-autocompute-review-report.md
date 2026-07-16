# Code Review: Member Management diff/autocompute (4-phase plan)

## Scope

- Files changed: `src/components/MemberManagementView.tsx` (modified), `src/components/MemberManagementView.test.tsx` (modified, +117 lines), `src/utils/memberRowDiff.ts` (new), `src/utils/memberRowDiff.test.ts` (new), `src/utils/memberAutoCompute.ts` (new), `src/utils/memberAutoCompute.test.ts` (new).
- Out of scope / noise: `.claude/hooks/.logs/hook-log.jsonl` (tooling log, unrelated).
- LOC: ~440 new/changed lines across the 6 relevant files.
- Verification performed: full read of all 4 phase docs + plan.md, full diff read, targeted test run (`npx vitest run src/utils/memberRowDiff.test.ts src/utils/memberAutoCompute.test.ts src/components/MemberManagementView.test.tsx` — 32/32 pass), full `src/` suite run (121/122 pass, 1 pre-existing unrelated `PersonCard.test.tsx` failure as documented), `npm run lint` (0 errors in touched files; 26 pre-existing errors in unrelated files), `tsc -b` (clean, no output).

## Overall Assessment

Solid, well-scoped implementation. All 4 phases' Success Criteria and the plan-level Acceptance Criteria are met by the actual code, not just asserted by matching-sounding tests — I traced the logic by hand for the trickiest parts (fixed-point convergence, conflict-warning timing, hooks ordering, `loadData()` error propagation) rather than trusting test names. One real spec gap found (missing spouse-conflict warning), one narrow latent inconsistency (untrimmed `id` indexing), and one pre-existing (not introduced by this diff) latent bug newly relevant to this diff's logic (`_key` collision risk). No blocking defects.

## Critical Issues

None.

## High Priority

**1. Missing spouse-conflict warning (phase 4 spec gap).**
Phase 4 requirement (phase-04-auto-compute-doi-and-sibling-order.md line 21): "If multiple spouses have different known Đời values, prefer the first `honNhan` entry's spouse and warn about the conflict." `resolveThuTuDoiCandidate` (`src/utils/memberAutoCompute.ts:10-30`) correctly implements "prefer first spouse with known Đời" but never emits a warning when multiple spouses disagree — contrast with the boId/meId conflict path (lines 77-85), which does warn. There is also no test covering this case (`memberAutoCompute.test.ts` has no multi-spouse-conflict scenario). This is a real, silent gap versus the written spec — a user relying on the warning banner to catch data inconsistencies won't be told about a spouse Đời mismatch.

Fix: after the fixed-point loop converges, for each row with 2+ `voChongIds`, look up each spouse's converged Đời and warn if they disagree (mirroring the existing boId/meId block), same style: `` `${row.hoTen}: Đời của các vợ/chồng không khớp nhau (đã ưu tiên theo người đầu tiên).` ``

## Medium Priority

**2. Untrimmed `id` used to index `data.persons` in `rowDirtyInfo` (`MemberManagementView.tsx:125`).**
```ts
const rowDirtyInfo = useMemo(() => rows.map(row => {
  if (!data || isNewRow(row, originalIds)) return { isNew: true, changedFields: new Set<RowField>() }
  const original = personToRow(data.persons[row.id])   // <- row.id, not row.id.trim()
  ...
```
`isNewRow` (memberRowDiff.ts:45-48) trims `row.id` before checking `originalIds.has(...)`, so if `row.id` ever carried incidental whitespace, `isNewRow` would say "not new" (trim matches) but `data.persons[row.id]` (untrimmed) would resolve to `undefined`, and `personToRow(undefined)` would throw inside a `useMemo`, crashing the render. Same untrimmed-index pattern exists in `handleApplyChanges` at `personToRow(data.persons[trimmedId])` — but there it correctly uses `trimmedId`, so only the `rowDirtyInfo` memo has the mismatch.

**Not currently exploitable**: the `id` column is rendered as a `disabled` input (`MemberManagementView.tsx:341`) and every row's `id` is either set once from `personToRow(person.id)` (server value, not user-editable) or is empty for new rows — so whitespace can't actually get into `row.id` through this UI today. Flagging as a latent defensive-coding gap, not a live bug: if `id` ever becomes editable or is populated from another input path, this becomes a real crash. Recommend using `row.id.trim()` consistently for the lookup to match `isNewRow`'s semantics.

**3. Pre-existing `_key` collision risk, now load-bearing for phases 3/4's Map-keyed logic.**
`createEmptyRow(prev.length + 1)` (`MemberManagementView.tsx:67-87`, unchanged by this diff) generates `_key: 'new-${index}'` from array length at insertion time. Since `handleAddRow` prepends (`[createEmptyRow(prev.length+1), ...prev]`, changed in a prior committed commit `2522b9e`, not part of this diff) and length changes as rows are added/removed, two different new rows can end up with the same `_key` (e.g., add a row at length 3 → `new-4`; delete a row, add another at length 2 → `new-3`; if an earlier not-yet-applied `new-3` row still exists, collision). This was always a React `key` prop hazard, but this diff makes it functionally load-bearing: `memberAutoCompute.ts`'s `doiById`/`updatedByKey` Maps are keyed by `_key` (lines 41, 46, 58, 157, 167), so a collision would silently merge two distinct rows' computed Đời/Thứ tự anh/chị into one Map entry, corrupting the auto-compute result for one of them without any error or warning.
Out of scope for this diff to fix (pre-existing, not introduced here), but worth a follow-up ticket — the risk surface just grew from "React render key warning" to "silent wrong-data staging in auto-compute."

## Low Priority

**4. Redundant `originalIds` recomputation in `handleApplyChanges` (`MemberManagementView.tsx:193`).**
The component already computes a memoized `originalIds` at line 122 (`useMemo(() => new Set(...), [data])`), but `handleApplyChanges` recomputes an equivalent local `const originalIds = new Set(Object.keys(data.persons))` at line 193, shadowing the outer one. Functionally identical, negligible cost (runs once per Apply click), but it's needless duplication that a future reader might assume is intentionally different from the outer one. Minor DRY nit, not worth blocking on.

## Edge Cases Found by Scout

- **Hooks-order**: Verified no violation — both `useMemo` calls (lines 122, 123-127) execute unconditionally before the `if (!data) return` early-return at line 129. `rowDirtyInfo`'s memo body itself internally guards `!data` per-row (returns `isNew: true` placeholder) rather than skipping the hook, which is correct and avoids a conditional-hook-call bug.
- **`await loadData()` unhandled-rejection risk (explicitly called out in the task brief) — verified NOT a regression.** `loadData` in `src/store/useGiaphaStore.ts:51-59` wraps its own `api.getTree()` call in try/catch and always resolves (failure path sets `error` state, never rejects). `await loadData()` at `MemberManagementView.tsx:232` therefore cannot throw, so `setSaving(false)` on the next line is safe and `saving` cannot get stuck `true`. This holds regardless of backend failures.
- **Fixed-point convergence correctness**: hand-traced the `computeThuTuDoi` loop (`memberAutoCompute.ts:50-63`) against (a) a true A↔B mutual-parent cycle with no seed values — correctly stalls at `undefined` and reports "no basis" rather than the cyclic-warning path (accurate, since there's no oscillation, just no information); (b) the "unstable" warning check at line 65 correctly only fires when the loop exits via hitting `maxIterations` while `changed` was still `true` on the last pass (not a transient mid-loop state) — the `while (changed && iterations < maxIterations)` condition guarantees `changed === true` after the loop only means "bound hit, not converged."
- **boId/meId conflict-warning timing**: confirmed the warning block (lines 77-85) runs strictly after the fixed-point loop converges, reading final `doiById` state — not a transient mid-propagation snapshot. No false-positive/false-negative found in the traced "prefers boId and warns" test scenario.
- **`isTargetMember`/`originalById` freshness** (phase 4's most subtle correctness requirement): `originalById` is rebuilt fresh from `data.persons` inside `handleAutoCompute` on every click (`MemberManagementView.tsx:173`), not memoized/stale — correctly reflects "last saved to DB," not some earlier snapshot. `isNewRow`/`getChangedFields` reuse from phase 1 is direct and correct in this context (no divergent reimplementation).
- **`personToRow` single-source-of-truth**: confirmed no duplicate definition remains in `MemberManagementView.tsx` — moved cleanly to `memberRowDiff.ts`, all 5 call sites in the component import and use the moved version.
- **`PersonPicker` "no temp-ID resolution needed" claim**: confirmed via `src/components/PersonPicker.tsx:19` — it only lists `Object.values(data.persons)`, so new unsaved rows genuinely cannot be selected as another row's parent/spouse. Phase 4's YAGNI decision to skip temp-ID resolution logic is justified by the actual code, not just asserted.
- **ngoại tộc Đời semantics**: confirmed against `worker/src/db/schema.ts:44-49`'s comment ("thuTuDoi ... resolved via parent OR spouse ... set for ngoại tộc members too") — `resolveThuTuDoiCandidate` does not filter by `laThanhVienHo`, so ngoại tộc rows still get Đời computed via spouse fallback, while `computeThuTuAnhChi` correctly does filter them out of sibling ordering. Matches spec precisely.

## Positive Observations

- `handleApplyChanges`'s diff-gating (`getChangedFields(...).length === 0` → skip, no network call) directly and verifiably fixes the documented N-reload root cause; a dedicated regression test (`reloads exactly once per Apply regardless of how many rows were mutated`) asserts `api.getTree` is called exactly once regardless of mutation count — this is a real (not phantom) regression guard.
- Test suite for the diff/auto-compute utilities is substantive: covers the specifically-called-out tricky cases (NgayThang `undefined`-vs-missing-key equality, `voChongIds` set-vs-order equality, cascading ancestor reparenting, boId/meId conflict, whole-family sibling recompute with tiebreak stability) rather than shallow happy-path-only assertions.

## Recommended Actions

1. (High) Add the missing spouse-Đời-conflict warning in `resolveThuTuDoiCandidate`/`computeThuTuDoi` to match the written phase-04 spec, plus a test case for it.
2. (Medium) Use `data.persons[row.id.trim()]` in the `rowDirtyInfo` useMemo (`MemberManagementView.tsx:125`) to match `isNewRow`'s trim semantics — currently latent/unreachable given the `id` column is disabled, but cheap to fix and removes a crash-on-whitespace footgun.
3. (Medium, follow-up ticket not blocking this diff) Fix `createEmptyRow`'s length-based `_key` generation to avoid collisions (e.g. a monotonically increasing counter or `crypto.randomUUID()`), since `memberAutoCompute.ts` now keys correctness-critical Maps by `_key`.
4. (Low, optional) Reuse the component-level memoized `originalIds` in `handleApplyChanges` instead of recomputing locally.

## Plan Acceptance Criteria — Verified Status

All plan-level and phase-level criteria confirmed met by code (not just by test presence):

- `npm run test:run` scope (`src/` only, per task constraints): clean except the pre-existing, out-of-scope `PersonCard.test.tsx` failure.
- `npm run lint`: 0 errors in any file touched by this diff.
- `tsc -b`: clean.
- Single-cell edit + Apply issues exactly 1 update call + 1 `getTree` call: verified by test and by reading `handleApplyChanges`.
- Untouched rows never trigger network calls on Apply: verified (`getChangedFields(...).length === 0` skip path).
- Unsaved cell/row visual distinction, clearing after Apply: verified by test and by tracing that `rowDirtyInfo` is derived live from `data.persons` (not a stale snapshot), so it naturally clears once `loadData()` refreshes `data` to match.
- "Tự động cập nhật" stages Đời/Thứ tự anh/chị with no network calls, surfaces warnings for unresolvable members: verified — except the spouse-conflict warning subcase noted in High Priority above, which is a real, narrow spec gap.

## Unresolved Questions

None — all items above are actionable findings, not open questions requiring user input.

Status: DONE_WITH_CONCERNS
Summary: Implementation correctly fixes the confirmed N-reload root cause, and the diff/highlight/auto-compute logic is sound under hand-traced edge cases (convergence, conflict-warning timing, hooks order, loadData error propagation); one real spec gap (missing spouse-Đời-conflict warning) and one latent defensive-coding inconsistency (untrimmed id lookup) should be fixed before considering phase 4 fully done, neither is a blocking regression risk today.
Concerns/Blockers: High-priority item 1 (missing spouse-conflict warning) is a genuine deviation from the written phase-04 spec and should be fixed or explicitly descoped by the user before sign-off; Medium items 2-3 are worth quick follow-up but don't block landing.
