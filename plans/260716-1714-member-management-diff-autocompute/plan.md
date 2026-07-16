---
title: 'Member Management: dirty-tracking, selective apply, auto-compute'
description: >-
  Highlight unsaved edits, diff-based selective save, and auto-compute Đời/Thứ
  tự anh/chị in the Quản lý thành viên table
status: completed
priority: P2
branch: master
tags: []
blockedBy: []
blocks: []
created: '2026-07-16T15:33:53.932Z'
createdBy: 'ck:plan'
source: skill
---

# Member Management: dirty-tracking, selective apply, auto-compute

## Overview

Four related changes to `src/components/MemberManagementView.tsx` ("Quản lý thành viên"):

1. Highlight cells/rows that were added or edited locally but not yet saved via "Áp dụng thay đổi".
2. Add a "Tự động cập nhật" button that computes `thuTuDoi` (Đời) and `thuTuAnhChi` (Thứ tự anh/chị) for members that need it, staged into the table (not saved to DB) so it benefits from highlighting.
3. Make "Áp dụng thay đổi" diff-based: only Insert/Update/Delete rows that actually changed, instead of touching every row.
4. Root-cause and fix "Áp dụng thay đổi" appearing broken/hung.

## Root Cause (confirmed, no further investigation needed)

The user confirmed testing happened on the already-deployed **Cloudflare Workers** site (not GitHub Pages, not local dev) — single-row edits via the "Sửa thông tin" form save successfully. So the Worker/D1 backend (`worker/src/routes/editor.ts`, `wrangler.jsonc`) is not broken.

The actual defect: `src/store/useGiaphaStore.ts` — `themNguoi`/`suaNguoi`/`xoaNguoi` each do one mutation **and then** a full `loadData()` (`GET /api/tree`, refetches and reshapes every person). `handleApplyChanges` in `MemberManagementView.tsx` currently calls one of these per row, for **every row in the table**, regardless of whether that row changed. For N members that's N sequential (mutation + full-tree-refetch) round trips — this is what "runs forever" and reads as "not working." Phase 2 fixes this directly: skip unchanged rows entirely, call the raw `api.*` functions (not the store wrappers) during the batch, and reload once at the end. No separate "item 4 bug fix" is needed beyond phase 2 — this note documents that decision so it isn't re-investigated.

Unrelated dead code found during research: `.github/workflows/deploy.yml` still deploys to GitHub Pages with stale Google OAuth env vars, untouched since the Cloudflare migration (`2c2463d`). Confirmed out of scope — the user deploys to Cloudflare separately (how is unspecified/out of band). Not touched by this plan.

## Confirmed Design Decisions (from user)

- **Đời root/no-basis case:** if a member has no blood parent (boId/meId) and no spouse with a known Đời, leave Đời blank and surface a warning — do not default to 1.
- **Đời cascading:** compute Đời via whole-graph fixed-point propagation (parent Đời + 1, or spouse's Đời when no blood parent), not scoped only to "target" rows. Any row whose freshly-computed Đời differs from its current value gets updated — this naturally covers newly-added members, edited members, missing-field members, *and* cascading descendants when an ancestor's Đời shifts (e.g. inserting a newly-discovered senior ancestor pushes the previous "Đời 1" ancestor to Đời 2, which then must ripple down their whole branch).
- **Thứ tự anh/chị scope:** for any family (same boId+meId pair) that contains at least one "target" child (newly added / edited this session / missing thuTuAnhChi) among its `laThanhVienHo === true` children, recompute sibling order for **all** `laThanhVienHo === true` children in that family by birth year — not just the target children. Families with no target child are left untouched. `laThanhVienHo === false` (ngoại tộc) children are never assigned an order and are excluded from the sibling count.
- **Apply mode:** "Tự động cập nhật" only stages computed values into the editable table rows (feeds phase 3's highlight); the user still clicks "Áp dụng thay đổi" to persist.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Row diff utility](./phase-01-row-diff-utility.md) | Completed |
| 2 | [Selective apply and single reload](./phase-02-selective-apply-and-single-reload.md) | Completed |
| 3 | [Highlight unsaved fields](./phase-03-highlight-unsaved-fields.md) | Completed |
| 4 | [Auto-compute Doi and sibling order](./phase-04-auto-compute-doi-and-sibling-order.md) | Completed |

Phase 2 depends on phase 1 (reuses the diff util to decide which rows to skip). Phase 3 depends on phase 1 (reuses the same diff util to decide what to highlight). Phase 4 is independent of phases 2-3 but should land last since it's the highest-complexity, highest-review-risk piece, and benefits from phase 3's highlight already being in place to visually verify its output.

## Dependencies

None — self-contained within this repo, no cross-plan overlap found in `plans/` (the three other unfinished plans touch tree view zoom/expand, date-input lunar toggle, and member-table column layout/name-lookup — none overlap `handleApplyChanges`, the store's `loadData` batching, or Đời/Thứ tự anh/chị computation).

## Validation Log

### Session 1 — 2026-07-16
**Trigger:** Post-plan validation interview (Standard tier, 4 phases)
**Questions asked:** 4

#### Verification Results
- **Tier:** Standard (Fact Checker + Contract Verifier)
- **Claims checked:** 12
- **Verified:** 12 | **Failed:** 0 | **Unverified:** 0
- Confirmed via grep: `themNguoi`/`suaNguoi`/`xoaNguoi` have exactly 2 real call sites — `MemberManagementView.tsx` (changes in phase 2) and `PersonForm.tsx` (unchanged, still needs the store wrapper's single-mutation-plus-reload behavior).
- Confirmed via grep: `personToRow`/`EditableRow` have no consumers outside `MemberManagementView.tsx` — safe to export with no missed callers.
- Confirmed via read: schema comment on spouse-fallback Đời, `PersonPicker` listing only `data.persons`, existing row-hover/banner styling — all match plan claims.

#### Questions & Answers

1. **[Assumptions]** If a member already has a manually-typed Đời but their parent's Đời implies a different value, should "Tự động cập nhật" overwrite it or just warn?
   - Options: Overwrite from parent computation (Recommended) | Leave as-is, warn only
   - **Answer:** Overwrite from parent computation
   - **Rationale:** Consistent with the already-confirmed whole-graph cascading design (plan.md's "Đời cascading" decision) — blood lineage is always the source of truth when a parent link exists; the overwritten value is staged (not saved) and highlighted by phase 3, so the user reviews before Apply.

2. **[Risks]** When boId and meId both resolve to a known but conflicting Đời, which wins?
   - Options: Prefer boId, warn (Recommended) | Skip entirely, warn only
   - **Answer:** Prefer boId, warn
   - **Rationale:** Deterministic default; the warning still surfaces the underlying data inconsistency for the user to fix at the source.

3. **[Architecture]** How should auto-compute warnings (e.g. "can't compute Đời for X") be displayed?
   - Options: Separate amber banner (Recommended) | Reuse existing red error banner
   - **Answer:** Separate amber banner
   - **Rationale:** Avoids conflating "informational, couldn't resolve" with "Apply failed" (red banner is reserved for actual save failures).

4. **[Scope]** Should the post-Apply success message report skip counts (updated vs. unchanged)?
   - Options: Report both counts (Recommended) | Keep current "Đã cập nhật N thành viên" wording
   - **Answer:** Report both counts
   - **Rationale:** Directly addresses the user's original concern ("is this button actually working") by making the diff mechanism's effect visible.

#### Confirmed Decisions
- Đời conflict (parent computation vs. existing manual value): overwrite, staged not saved.
- boId/meId Đời conflict: prefer boId, add warning.
- Auto-compute warnings: dedicated amber banner, separate from the red Apply-error banner.
- Apply success message: "Đã cập nhật {updated} thành viên, bỏ qua {skipped} không đổi." (exact wording finalized during implementation, must convey both counts).

#### Action Items
- [x] Phase 4: replace "Open Question" section with confirmed conflict-resolution behavior.
- [x] Phase 4: add dedicated `autoComputeWarnings` state + amber banner to Architecture/Implementation Steps.
- [x] Phase 2: update success-message requirement to report both updated and skipped counts.

#### Impact on Phases
- Phase 2: success message wording requirement updated.
- Phase 4: Open Question resolved and removed; conflict-resolution rule now a confirmed Requirement; amber warning banner now a concrete Implementation Step instead of a suggestion.

### Whole-Plan Consistency Sweep
- Files reread: plan.md, phase-01-row-diff-utility.md, phase-02-selective-apply-and-single-reload.md, phase-03-highlight-unsaved-fields.md, phase-04-auto-compute-doi-and-sibling-order.md
- Decision deltas checked: 4 (Đời overwrite-on-conflict, boId/meId tiebreak, warning banner styling, success-message wording)
- Reconciled stale references: 2 (phase-02 success message, phase-04 Open Question section)
- Unresolved contradictions: 0

## Acceptance Criteria (plan-level)

- `npm run test:run`, `npm run lint`, `tsc -b` all clean.
- Editing a single cell in one row and clicking "Áp dụng thay đổi" issues exactly one `PUT` (or `POST`/`DELETE` as applicable) plus one `GET /api/tree` — not N.
- Untouched existing rows never trigger any network call on Apply.
- A cell/row with unsaved local changes is visually distinguishable from saved ones, and the distinction clears after a successful Apply.
- "Tự động cập nhật" fills Đời/Thứ tự anh/chị into the table per the rules above without any network call, and surfaces a warning list for members it could not resolve.
