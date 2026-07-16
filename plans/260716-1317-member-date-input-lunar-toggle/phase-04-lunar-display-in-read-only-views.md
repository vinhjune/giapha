---
phase: 4
title: Lunar display in read-only views
status: completed
priority: P2
dependencies: []
---

# Phase 4: Lunar display in read-only views

## Overview

Add a short "ÂL" label after birth/death dates in the read-only person views (`PersonDetail.tsx`,
`PersonCard.tsx`) when `amLich === true`, so lunar-vs-solar is visible outside the edit forms too.
Independent of Phases 1-3 (no shared code), can be done in parallel or standalone.

## Requirements

- Functional:
  - `PersonDetail.tsx`: when showing "Ngày sinh"/"Ngày mất", append a small "ÂL" marker if
    `person.namSinh?.amLich` / `person.namMat?.amLich` is `true`.
  - `PersonCard.tsx`: same, in its compact inline date display.
  - No marker shown when `amLich` is falsy/undefined (i.e. solar or unspecified — don't show "DL" for
    solar, only mark the lunar case, keeping the default view uncluttered).
- Non-negotiable constraints: do not change the underlying date-existence/formatting logic
  (`formatNgay` in `PersonDetail.tsx`, the inline join logic in `PersonCard.tsx`) beyond appending the
  marker — `PersonCard.test.tsx` already has a test asserting the "deceased" mark (`†`) shows/hides
  based on `namMat` presence; keep that behavior byte-for-byte unchanged.

## Architecture

`PersonDetail.tsx` — near the existing `<dd>{formatNgay(person.namSinh)}</dd>` (line 68) and
`<dd>{formatNgay(person.namMat)}</dd>` (line 73):

```tsx
<dd>
  {formatNgay(person.namSinh)}
  {person.namSinh?.amLich && <span className="ml-1 text-xs text-amber-600">ÂL</span>}
</dd>
```

(mirror for `namMat`, inside the existing `{person.namMat && (...)}` conditional block).

`PersonCard.tsx` — near the existing date-join logic (around line 55-62), append a similar small
marker after the joined date string, gated on `person.namSinh?.amLich` (and separately for `namMat` if
that component shows both dates independently — check current rendering during implementation).

## Related Code Files

- Modify: `src/components/PersonDetail.tsx`
- Modify: `src/components/PersonCard.tsx`

## Implementation Steps

1. In `PersonDetail.tsx`, add the "ÂL" marker span after each `formatNgay(...)` call, gated on the
   corresponding `amLich` flag.
2. In `PersonCard.tsx`, add the same marker in its compact date display, gated on `amLich`.
3. Manually verify in the running app: view a person with a lunar birth date, confirm "ÂL" appears next
   to the date in both the card and detail views; view a person with a solar (or unspecified) date,
   confirm no marker appears.
4. Run `npm run test:run -- PersonCard PersonDetail` to confirm the existing deceased-mark test
   (`PersonCard.test.tsx`) still passes unchanged.
5. Run `npm run lint` and `tsc -b`.

## Success Criteria

- [x] Person with `namSinh.amLich === true` shows "ÂL" next to birth date in `PersonDetail`.
- [x] Person with `namMat.amLich === true` shows "ÂL" next to death date in `PersonDetail`.
- [x] Same markers appear correctly in `PersonCard`'s compact view.
- [x] Person with no `amLich` set (or `false`) shows no marker — default view unchanged.
- [x] Existing `PersonCard.test.tsx` deceased-mark test still passes unmodified.
- [x] `npm run lint`, `tsc -b`, `npm run test:run -- PersonCard PersonDetail` all pass.

## Risk Assessment

- **Visual clutter**: minimal — single small text marker, low risk. If it looks off during manual
  check, adjust styling (color/size) without changing the underlying gating logic.
- **No dependency on Phases 1-3**: this phase reads `amLich` from data that already round-trips
  correctly through the DB/API regardless of which form wrote it, so it can land independently and
  isn't blocked by the input-side work.
