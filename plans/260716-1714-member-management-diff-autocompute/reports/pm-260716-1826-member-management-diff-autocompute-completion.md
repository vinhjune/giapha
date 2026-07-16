# PM Sync-Back: Member Management diff/autocompute

Plan: `plans/260716-1714-member-management-diff-autocompute/plan.md`
Status: completed (4/4 phases)

## Phase status

| Phase | Criteria | Checked |
|---|---|---|
| 1 Row diff utility | 4 | 4/4 |
| 2 Selective apply + single reload | 6 | 6/6 |
| 3 Highlight unsaved fields | 5 | 5/5 |
| 4 Auto-compute Đời + sibling order | 6 | 6/6 |

All 21 success-criteria checkboxes backfilled `[x]` across the 4 phase files based on verified evidence (own test runs + code-reviewer + tester subagent reports), not assumed.

## Delivered

- `src/utils/memberRowDiff.ts` + test — new
- `src/utils/memberAutoCompute.ts` + test — new
- `src/components/MemberManagementView.tsx` — modified (selective apply, highlight, auto-compute button/banner)
- `src/components/MemberManagementView.test.tsx` — 7 new tests

## Review cycle

- code-reviewer: DONE_WITH_CONCERNS → 1 high (missing spouse-Đời-conflict warning) + 2 medium (untrimmed id lookup, `_key` collision risk now load-bearing) + 1 low (redundant originalIds). All 4 fixed in this session, incl. a new test for the spouse-conflict warning.
- tester (independent re-verify post-fix): DONE, no concerns. 122/123 `src/` tests pass (1 pre-existing unrelated `PersonCard.test.tsx` failure, confirmed present on baseline before this work started). Hand-checked edge cases (empty rows, self-referential parent, full birth-year ties, idempotent double-run) — all safe.

## Verification (final state)

- `tsc -b`: clean
- `npm run lint`: 0 errors in touched files
- `npx vitest run src/`: 122/123 pass (1 pre-existing unrelated failure, out of scope)

## Known limitation (documented, not a defect)

Phase 2's fix (single reload, diff-gated mutations) cannot be exercised against the live Cloudflare Worker + D1 backend from this environment — no way to run `wrangler dev --remote` or hit the deployed site here. The user should re-test "Áp dụng thay đổi" on the deployed site to confirm the perceived hang is resolved in production.

## Unresolved questions

None.
