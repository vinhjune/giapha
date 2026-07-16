---
name: feedback-hand-trace-fixed-point-logic
description: how to verify fixed-point/convergence algorithm claims (e.g. warning-must-reflect-final-state) instead of trusting matching test names
metadata:
  type: feedback
---

When a plan/task asks to verify that a warning or side-effect in an iterative fixed-point
computation "reflects final converged state, not a transient mid-propagation value," don't just
check that a test with a matching name passes — hand-trace the loop's exit condition against the
warning-emission code's placement.

**Why:** in `giapha`'s `computeThuTuDoi` (`src/utils/memberAutoCompute.ts`), the review task
specifically flagged this as a risk. The actual verification required: (1) confirming the
`while (changed && iterations < maxIterations)` loop only exits with `changed === true` when the
iteration bound was hit (not via any other path), and (2) confirming the conflict-warning block
runs strictly after the loop, reading the final `doiById` map, not a value captured mid-pass. A
matching test name ("prefers boId and warns when boId/meId Đời disagree") only proves the happy
path produces *a* warning — it doesn't prove the timing/placement is structurally correct for edge
cases like a true cycle with no seed values (which stalls at `undefined`, not oscillation, and
should NOT hit the "unstable/cyclic" warning path — it should hit the separate "no basis" warning).

**How to apply:** for any bounded-iteration convergence loop, trace at least one scenario that
exits via the bound (non-convergence) and one that exits via true stability, and check which
warning path (if any) each takes. Don't accept "there's a test for it" as sufficient when the task
explicitly calls out timing/placement as the risk.
