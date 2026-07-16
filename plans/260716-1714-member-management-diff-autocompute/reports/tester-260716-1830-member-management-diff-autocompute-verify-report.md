# Member Management Diff-Autocompute: Verification Report

**Date:** 2026-07-16 18:30 | **Scope:** Verify 4-phase implementation after code-reviewer fixes

## Test Execution Results

**npx vitest run src/**
- **Test Files:** 14 passed, 1 pre-existing failure (PersonCard.test.tsx spouse-card background—unrelated)
- **Tests:** 122 passed, 1 failed (out of scope)
- **Touched files:** 33 tests across 3 test files (all passing)
  - memberRowDiff.test.ts: 9 tests ✓
  - memberAutoCompute.test.ts: 11 tests ✓
  - MemberManagementView.test.tsx: 13 tests ✓

**npm run lint** (touched files only)
- 0 errors in: memberRowDiff.ts/test.ts, memberAutoCompute.ts/test.ts, MemberManagementView.tsx/test.tsx

**npx tsc -b**
- No TypeScript errors

## Verification: Spouse-Đời Conflict Warning

**Logic traced (memberAutoCompute.ts lines 86-97):**
1. When a person has NO blood parent (`boId == null && meId == null`)
2. Extract all spouse IDs and resolve their Đời values
3. If multiple spouses have different known Đời, emit warning: "Đời của các vợ/chồng không khớp nhau (đã ưu tiên theo người đầu tiên)"
4. Member still receives first spouse's Đời as candidate (resolveThuTuDoiCandidate, line 27)

**Test verification (memberAutoCompute.test.ts, lines 97-105):**
- Setup: 2 spouses (Đời=2, Đời=4) + 1 member with both as voChongIds
- Expected: member gets Đời=2 ✓ AND warning issued ✓
- Test is NOT tautological: verifies both the value assignment AND warning separately

**Fix validation:** Spouse-Đời conflict case correctly identified, warned, and resolved deterministically (prefer first spouse).

## Verification: Untrimmed Lookups

**All ID/spouse lookups properly trimmed** (grep shows trim() on every lookup):
- Parent ID lookup: `row.boId.trim()` before `keyById.get()` (lines 15, 78)
- Mother ID lookup: `row.meId.trim()` before `keyById.get()` (lines 16, 79)
- Spouse IDs: `.split(';').map(s => s.trim()).filter(Boolean)` (lines 23, 87)
- KeyById population: `keyById.set(row.id.trim(), row._key)` (line 47)

**Fix validated:** No whitespace-based lookup collisions possible.

## Verification: Row-Key Collision Risk

**Key architecture confirmed safe:**
- `doiById`: Map<`row._key`, number> — keyed by stable internal UUID
- `keyById`: Map<`row.id` (string ID), `row._key`> — converts user IDs to internal keys
- Lookups: `row.id.trim()` → `keyById.get()` → `_key` → `doiById.get()`
- Each row's `_key` unique (person.id for saved rows, crypto.randomUUID() for new rows)

**Fix validated:** No ID collision between _key and id fields.

## Edge Cases Analyzed

**1. Empty rows array:** Fixed-point loop never triggers, returns clean empty result ✓

**2. Self-referential parent (person is own boId):** Iteration bound (rows.length + 1) prevents infinite loop; unresolvable members warned ✓

**3. Multiple children, identical birth year, no sibling order:** Stable sort preserves table row order as tiebreak (line 130: `return 0` when compared values are equal) ✓

**4. Idempotency (running auto-compute twice):** Line 110 skips rows whose computed value already matches current value; second run reports changedCount=0 if nothing changed ✓

## Integration Points

- **Phase 3 + Phase 4 composition:** Auto-computed Đời cells correctly show "unsaved edit" highlight (data-dirty attribute) after auto-compute button click ✓ (MemberManagementView.test.tsx line 221)
- **No network calls:** Test verifies api.createPerson/updatePerson/deletePerson never called during auto-compute ✓ (line 222-224)
- **Warning banner:** Separate amber banner (bg-amber-50, border-amber-200) distinct from red error banner ✓ (MemberManagementView.tsx lines 465-472)
- **Apply success message:** Reports both updated and skipped counts ✓ (line 239)

## Critical Code Paths Validated

| Path | Test Coverage | Status |
|------|---|---|
| Blood-parent Đời computation (child = parent + 1) | computeThuTuDoi line 29 | ✓ Tested |
| Spouse-fallback Đời (no parent, use spouse) | computeThuTuDoi line 39 | ✓ Tested |
| boId/meId Đời conflict warning | computeThuTuDoi line 87 | ✓ Tested |
| Spouse Đời conflict warning | computeThuTuDoi line 97 | ✓ Tested & fixed |
| No basis, no existing Đời → warning | computeThuTuDoi line 48 | ✓ Tested |
| Cascading Đời (reparenting ripples) | computeThuTuDoi line 73 | ✓ Tested |
| Sibling recompute (whole family) | computeThuTuAnhChi line 109 | ✓ Tested |
| Ngoại tộc exclusion (laThanhVienHo=false) | computeThuTuAnhChi line 142 | ✓ Tested |

## Summary

All fixes hold post-implementation. No regressions detected. Code correctly implements:
- Spouse-Đời conflict detection & deterministic resolution ✓
- Trimmed lookups preventing ID-collision bugs ✓
- Stable row-key usage preventing cross-row contamination ✓
- Proper warning/error separation (amber vs. red banners) ✓
- Idempotent auto-compute (safe for repeated clicks) ✓
- Bounded iteration preventing infinite loops ✓

---

**Status:** DONE

**Summary:** Full test suite passes (122/123 tests; 1 pre-existing failure unrelated). All 6 touched files clean on lint/type check. Spouse-Đời conflict warning correctly implemented and tested. No blocking issues found.

**Concerns/Blockers:** None
