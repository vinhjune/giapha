# Code Review: Member Date Input / Lunar Toggle

## Scope
- Files reviewed: `src/components/NgayThangInput.tsx` (new), `NgayThangInput.test.tsx` (new), `MemberManagementView.tsx`/`.test.tsx`, `PersonForm.tsx`/`.test.tsx`, `PersonDetail.tsx`/`.test.tsx`, `PersonCard.tsx`/`.test.tsx`, `src/types/giapha.ts`, `worker/src/lib/reshape.ts`
- LOC: ~463 insertions / 99 deletions across 9 tracked files + 2 new files
- Focus: uncommitted working-tree diff, advisory only (no edits made)
- Verification performed independently: `npx vitest run` (scoped to the 5 touched test files), `npx eslint` (scoped to the 10 touched source/test files), `npx tsc -b` (full project), `git stash`/`git log -p` to confirm pre-existing failure

## Overall Assessment
The implementation is clean and matches the stated acceptance criteria. `NgayThangInput` is a genuinely controlled component (no internal state mirroring, no stale-closure risk), the `amLich` flag propagation is correct end-to-end (component → `EditableRow`/`FormState` → `Person.namSinh/namMat` → `fromNgayThang` → DB columns), and no public contracts (`NgayThang` type, `themNguoi`/`suaNguoi`, worker routes) were touched. Test additions assert real emitted values (not phantom renders-only checks). No new lint or type errors were introduced.

## Critical Issues
None found.

## High Priority
None found.

## Medium Priority

1. **`.claude/hooks/.logs/hook-log.jsonl` is included in the working tree diff** (322 lines added). This is an auto-appended tooling log, unrelated to the date-input feature. Not a code defect, but it should not be committed alongside this feature — recommend excluding it from the commit (`git restore` or add to `.gitignore` if it's meant to be ephemeral).

## Low Priority

1. **`PersonCard`'s "ÂL" marker only covers `namSinh`, never `namMat`.** This is consistent with pre-existing behavior (the compact card only ever rendered the birth date inline, showing just a "†" dagger for death without full date), so it's not a regression — but it does mean a person marked as dying on a lunar date shows no lunar indicator in the compact card view, only in `PersonDetail`. Worth confirming this asymmetry is intentional product scope rather than an oversight, since the plan's stated goal was surfacing the lunar flag consistently.

## Edge Cases Found by Scout

Checked and found no defects in:
- **Race/ordering**: `handleSegmentChange` calls `emit()` (sync `onChange`) then `nextRef?.current?.focus()` synchronously in the same handler — the target DOM node already exists from the prior render, so focus-after-update is not a race under React 19's batching.
- **`amLich`-only toggle preserving prior date parts**: `handleSegmentChange` spreads `...parts` (which includes current `amLich`) before overwriting the changed segment — checkbox state survives concurrent digit entry and vice versa. Verified via test `checking ÂL with a year filled emits amLich: true` and store round-trip test.
- **`fromNgayThang` (worker, untouched)**: confirmed `isLunar: ngayThang?.amLich ?? false` still correctly persists `amLich` independent of which date parts are set — the pre-existing `PersonForm` bug (freeform text input with no lunar checkbox, silently defaulting `isLunar` to `false` on every save) is fixed by routing through `NgayThangInput`, verified by the new `PersonForm.test.tsx` round-trip test asserting `amLich: true` is included in the `themNguoi` payload.
- **Type narrowing in `MemberManagementView`**: `row[col.key]` inside the `col.key === 'namSinh' || col.key === 'namMat'` branch narrows correctly to `NgayThang | undefined`; confirmed clean via `tsc -b` (no errors).
- **Test-file state pollution**: new `describe('PersonForm date entry')` block follows the existing `afterEach(() => useGiaphaStore.setState(initialState, true))` reset pattern used by sibling describe blocks in the same file — no cross-test pollution.
- **`PersonCard.test.tsx` pre-existing failure**: confirmed via `git stash` + rerun that `gives spouse-slot cards a solid distinct background...` (expects `bg-card-border`, component renders `bg-card-spouse`) fails identically with and without this diff applied. Traced via `git log -p` to commit `8909f7f` ("fix spouse node background"), which predates and is unrelated to this session's changes. **Confirmed pre-existing / out of scope, not a regression.**

## Acceptance Criteria Check

1. **`NgayThangInput` behavior** — PASS. Auto-advance on 2-digit fill, backspace-to-previous on empty segment, blank day/month with year-only persists, checkbox-alone emits `undefined`, checkbox+date emits `amLich: true`, no range validation (intentional, confirmed not flagged). All covered by 11 passing unit tests.
2. **`MemberManagementView` round-trip** — PASS. Existing partial/lunar dates load via `personToRow` (direct passthrough, no lossy string conversion). New save-round-trip test confirms year+lunar-only payload reaches `updatePerson` correctly. Reset/delete/thuTuDoi/picker tests all still pass (5/6 pre-existing tests pass, 1 new test passes — no regressions).
3. **`PersonForm` lunar-loss bug fix** — PASS, verified at the code level, not just "checkbox renders". `form.namSinh`/`form.namMat` are `NgayThang | undefined` end-to-end; `personData.namSinh = form.namSinh` passed directly to `themNguoi`/`suaNguoi`, no lossy intermediate string parsing (the old `ngayToStr`/`strToNgay` helpers that dropped `amLich` are removed). Confirmed via new round-trip and pre-fill tests.
4. **"ÂL" marker correctness** — PASS. Both `PersonDetail` and `PersonCard` gate the marker on `=== true`-ish truthy check of `amLich` (`boolean | undefined`), so solar/unset dates never render the marker. Verified by explicit positive/negative test cases in both files.
5. **No new lint/type errors** — CONFIRMED independently. `npx eslint` on all 10 touched files: clean. `npx tsc -b`: clean.
6. **Public contracts unchanged** — CONFIRMED. `git diff --stat` against `src/store/`, `src/services/`, `worker/`, and `src/types/giapha.ts` shows zero changes. `NgayThang` shape, `themNguoi`/`suaNguoi` signatures, and worker routes untouched.

## Positive Observations
- The `NgayThangInput.test.tsx` `Controlled` wrapper is a deliberate, well-justified pattern (documented in a comment) for testing a fully-controlled component through multi-step interactions — avoids the common phantom-test trap of asserting only against a bare `onChange` spy that can't compose sequential state changes.
- The `PersonForm.test.tsx` drive-by fix of `metadata: {} as any` → `metadata: {} as GiaphaData['metadata']` is scoped to a file already being touched for this feature and is a legitimate lint-debt cleanup, not scope creep.

## Recommended Actions
1. Exclude `.claude/hooks/.logs/hook-log.jsonl` from any commit of this change set (unrelated tooling artifact).
2. Optional/product decision: confirm whether `PersonCard`'s lunar marker should also reflect `namMat.amLich`, or whether birth-date-only is acceptable given the card's existing compact-display convention (death date already only shows a dagger, no digits). Not blocking.

## Metrics
- Type Coverage: `tsc -b` clean (0 errors) across full project
- Test Coverage (scoped run): 41/42 passing; 1 pre-existing, confirmed-unrelated failure (`PersonCard.test.tsx` background-class assertion, traced to commit `8909f7f`)
- Linting Issues: 0 (scoped `eslint` run across 10 touched files)

## Unresolved Questions
- Whether the `PersonCard` "ÂL" marker's birth-date-only scope (no death-date lunar marker in the compact card) is accepted product scope or should be extended — flagged as Low priority, non-blocking.

---
Status: DONE
Summary: Implementation matches all 6 acceptance criteria with no critical or high-priority defects; independently verified clean eslint/tsc and 41/42 passing tests, with the single failure confirmed pre-existing and unrelated via git stash/git log.
Concerns/Blockers: None blocking. Two minor items: (1) unrelated hook-log.jsonl diff noise should be excluded from any commit, (2) optional product question on whether death-date lunar marker should also appear in the compact PersonCard view.
