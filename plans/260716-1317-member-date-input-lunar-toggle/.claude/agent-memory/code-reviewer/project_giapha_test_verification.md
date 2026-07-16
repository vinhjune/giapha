---
name: project-giapha-test-verification
description: How to scope test/lint/typecheck runs in the giapha repo without picking up unrelated tooling noise
metadata:
  type: project
---

The giapha repo root contains `.claude/hooks/` with its own test suite that has pre-existing failures unrelated to app code. Running `npx vitest run` or `npx eslint .` unscoped picks these up as noise.

**Why:** A prior review (date-input-lunar-toggle, 2026-07-16) was explicitly instructed to scope verification to `src/` and `worker/`, or to the specific touched files, rather than running repo-wide commands — confirmed this is the correct approach since `.claude/hooks` tooling tests are known-broken and out of scope for app-code reviews.

**How to apply:** When verifying a frontend/worker change in this repo, run `npx vitest run <specific test files>`, `npx eslint <specific files>`, and `npx tsc -b` (project-wide tsc is fine/fast and scoped correctly via tsconfig project references) rather than blanket `npx vitest run` or `npx eslint .`.

Also: `src/components/PersonCard.test.tsx` has one known pre-existing failing test ("gives spouse-slot cards a solid distinct background...", expects class `bg-card-border`, component renders `bg-card-spouse`) traced to commit `8909f7f` ("fix spouse node background"). Verify via `git stash` + rerun if it resurfaces in a future diff, rather than assuming it's a new regression.
