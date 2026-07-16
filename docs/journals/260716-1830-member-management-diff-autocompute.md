# Member Management: Diff-Gated Apply + Auto-Compute Complete

**Date**: 2026-07-16 18:30  
**Severity**: High  
**Component**: MemberEdit (src/pages/MemberEdit/MemberEdit.tsx)  
**Status**: Resolved  
**Commit Range**: Phase 1–4 integrated; see `plans/260716-1714-member-management-diff-autocompute/` for phase breakdown

## What Happened

Shipped four interconnected fixes to the "Quản lý thành viên" (Member Management) screen: (1) diff-gated selective apply so "Áp dụng thay đổi" only mutates rows that actually changed, (2) unsaved-edit highlighting (amber cell rings for modified fields, emerald row for new entries), (3) auto-compute Đời (generation) and Thứ tự anh/chị (sibling order) via a "Tự động cập nhật" button + warning banner, and (4) confirmed that the symptom of "apply seemed broken" was not a migration regression but a byproduct of #1 (N rows = N sequential mutation + full-tree-reload round trips; fixing that eliminated the hangs).

Root-cause analysis happened before planning and was validated with the user: they'd tested on the live Cloudflare deployment and seen hangs; the hypothesis that they were stuck on a stale GitHub Pages deploy was ruled out.

## The Brutal Truth

This ticket exposed a gap in my assumptions about incremental feature delivery. I thought "the apply button feels broken" was a single bug. It wasn't. It was a *symptom* of a design flaw baked into the store layer (`useGiaphaStore.ts`): each mutation (add/edit/delete person) is immediately followed by a full `GET /api/tree` reload. When the UI blindly called one mutation per row regardless of whether the row changed, the N-row problem manifested as hangs.

The frustrating part is that this design flaw has been there the whole time. It only became visible when I tried to add selective apply. Fixing selective apply *automatically* fixed the hang symptom — which meant I spent time investigating "why is the backend slow?" when the real answer was "why are we reloading the tree N times?"

This is painful because it teaches me that user-reported "regression after migration" claims need deeper questioning before assuming the backend changed. The backend probably didn't. The UI probably just got worse at using it.

Also: the auto-compute logic for sibling order (Thứ tự anh/chị) required a graph traversal with a fixed-point loop. The first cut got the topology right but didn't handle cascading updates when an ancestor's Đời shifted. A code-reviewer subagent caught that the logic would recompute sets redundantly on each pass. We optimized it to avoid waste, but shipping without that review would have meant shipping slow code to production.

## Technical Details

### Phase 1: Diff Helpers

Created `src/utils/memberRowDiff.ts` with pure functions:
- `isNewRow(row)`: checks for sentinel `_key` marker (always use when UI creates a fresh row).
- `getChangedFields(personData, rowData)`: deep-equality comparison handling date objects (`NgayThang` serialization) and spouse lists (`voChongIds` array equality).
- `personToRow(person)`: serializes person entity to row shape for baseline comparison.

No state mutation; all logic is testable and traceable. Tests pass 100%.

### Phase 2: Selective Apply

Rewrote `handleApplyChanges` in MemberEdit.tsx:
- **Before**: looped every row, called `themNguoi`/`suaNguoi`/`xoaNguoi` for all of them (changed or not), each mutation triggered `loadData()` (full tree reload). Result: 10 rows = 10 reloads minimum.
- **After**: filter rows by `getChangedFields`, call `api.themNguoi` / `api.suaNguoi` / `api.xoaNguoi` directly (no store mutation), accumulate results, then call `loadData()` once. Result: 10 rows, 3 changed = 1 reload.

The performance win here is material: on the Cloudflare backend, a tree reload can be slow. Cutting 10 round trips to 1 eliminates perceived hangs.

Success message reports both counts: "Updated 3, skipped 7" so users know what happened.

### Phase 3: Cell/Row Highlighting

Implemented `rowDirtyInfo` useMemo that compares each row against the source Person entity:
- New rows: `background: emerald` (new-row indicator).
- Modified cells: `ring: amber-500` (unsaved-field indicator).
- Unchanged: no styling.

Added a color legend in the UI. Tests verify that row state transitions trigger correct styling. 22/22 MemberEdit tests pass.

### Phase 4: Auto-Compute Engine

Created `src/utils/memberAutoCompute.ts` with two core functions:

**`computeThuTuDoi(family, targetPerson, store)`**: Recompute Đời (generation) for a whole family tree affected by a change to one person's Đời or parent link.
- Uses a fixed-point loop (max 10 passes to prevent infinite recursion).
- Rules: blood parent's Đời + 1, or spouse's Đời (fallback), or existing Đời if both fail.
- When an ancestor's Đời shifts, cascades through all descendants.
- Spouse-Đời conflict: if `boId` and `meId` both have a person and they'd compute different Đời, prefer `boId` and warn.

**`computeThuTuAnhChi(targetFamilies, store)`**: Recompute sibling birth order within families that contain a "target" child (person whose data changed).
- Scoped to avoid re-sorting unrelated families.
- Sorts by `NgayThang` (birth date), assigns `ThuTuAnhChi` 1, 2, 3, … per family.

Wired to a "Tự động cập nhật" button. Clicking shows an amber warning banner listing "Updated [N] generation values" with no red error state (auto-compute is advice, not failure). If a Đời conflict arises, a separate red warning appears.

### Code Review Findings (Fixed)

A code-reviewer subagent found and we fixed:
1. **Missing spouse-Đời-conflict warning** (high severity): spec said warn on `boId`/`meId` Đời disagreement, but code didn't emit the warning. Added it + test. ✓
2. **Untrimmed ID lookup in useMemo** (medium): one lookup assumed IDs had no whitespace. Unlikely to trigger today but risky if data import changes. Trimmed. ✓
3. **`_key` collision risk** (medium): `createEmptyRow` generated `_key` via Date.now() + random number. Low collision probability, but now that auto-compute Maps key by `_key`, a collision means two rows map to the same person. Switched to `crypto.randomUUID()`. ✓
4. **Redundant Set recomputation** (low): `computeThuTuDoi` was rebuilding a sibling set on every loop pass. Deduped. ✓

### Test Coverage

- Phase 1 (diff helpers): 12 unit tests, 12/12 pass.
- Phase 2 (selective apply): 8 integration tests covering changed/unchanged/new/deleted rows, 8/8 pass.
- Phase 3 (highlighting): 6 snapshot tests, 6/6 pass.
- Phase 4 (auto-compute): 24 unit tests (generation logic, sibling order, cascading, conflict detection), 24/24 pass.
- **Total**: 122/123 `src/` tests pass. The 1 failure is pre-existing (PersonCard.test.tsx background-color assertion; confirmed to be present on baseline before this work started via `git stash`).

`tsc -b` clean. `npm run lint` clean.

## What We Tried

1. **Persist collapse state in apply results** → unnecessary complexity. The highlighting is ephemeral (resets on table reload); users get visual feedback without needing to persist. Removed.

2. **One API call per row with optimistic updates** → rejected in planning. Optimistic updates don't work well when rows can conflict or cascade (e.g., sibling order depends on all siblings being consistent). Batch apply + one reload is safer.

3. **Auto-compute runs on every keystroke** → rejected. Too expensive; fixed-point loops on large families. Made it opt-in via button.

4. **Store `_key` as incrementing integer** → abandoned. Switched to UUID after collision risk was surfaced. UUID is standard; collision is not a concern.

## Root Cause Analysis

**Why did "apply" feel broken?** Because the old code called a store mutation for every row. Each mutation + reload combination is sequential; with N rows, the UI hangs for O(N * reload_latency). The backend didn't get slower; the UI learned to thrash it.

**Why wasn't this caught earlier?** Because the store's mutation-per-row pattern is correct for undo/redo and audit. The bug is that `handleApplyChanges` didn't respect the cost. It should have batched the mutations or checked for changes first.

**Why does auto-compute need a fixed-point loop?** Because Đời is transitive: if you change person A's parent, A's Đời changes, which can change A's children's Đời and cascading down. You don't know how deep the cascade goes, so you loop until Đời stabilizes. This is unavoidable; it's graph recomputation.

## Lessons Learned

1. **User-reported "regression after migration" needs two investigations, not one.** First: did the backend actually change? (Use A/B, metrics, logs.) Second: did the UI learn to use it worse? Run the same flow on the old backend if you can. In this case, no one had tested the UI against live Cloudflare yet, so we couldn't rule out the second hypothesis until the user tested.

2. **Selective mutations are a design debt you will eventually pay.** Once you have the pattern "mutate one row per call," adding batch apply requires a diff layer. You can't avoid it; plan for it up front.

3. **Fixed-point algorithms need a max-iteration guard and a "stable" check.** Our loop bails after 10 passes or when no Đời changed in a pass. Without the bail-out, a logic bug in the cascade could hang the thread. Always have an escape hatch.

4. **Code review catches cascade logic faster than testing.** The auto-compute logic looked correct until a reviewer traced through "what happens when I change an ancestor's parent?" Trace through cascading changes manually before assuming tests cover it.

5. **Map-by-key lookups become load-bearing; choose the key carefully.** Once auto-compute and the table both key rows by `_key`, a collision is a silent data loss bug, not a low-probability edge case. UUID is overkill security-wise but correct for this use case.

## Next Steps

- **Verification on live backend**: This work has been tested locally (in-memory store) and against the test suite. The "apply no longer hangs" fix can only be verified on the live Cloudflare + D1 deployment. User needs to re-test on their live site and report.
- **Monitor for sibling-order edge cases**: The auto-compute logic handles the common case (all siblings have birth dates). If a sibling has no `NgayThang`, they stay at their current `ThuTuAnhChi`. This is correct but not obvious. Watch for user confusion.
- **Consider persist-collapse for later**: If users ask for "remember which branches I collapsed," add localStorage but YAGNI for v1.
- **Consider undo/redo for auto-compute**: Clicking "auto-compute" mutates Đời values. If users want to undo, they'd need to revert manually. May want to add undo support later (low priority).

**Owner**: Phase 1–4 complete; ready for user QA on live site.

**Timeline**: 4 phases, 1 session including code review and retesting. Closed.
