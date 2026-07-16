---
phase: 1
title: NgayThangInput component
status: completed
priority: P1
dependencies: []
---

# Phase 1: NgayThangInput component

## Overview

Build the reusable masked date input that both `MemberManagementView.tsx` and `PersonForm.tsx`
will consume in later phases. Consumes/produces `NgayThang` (`{ nam?, thang?, ngay?, amLich? }`)
directly — no string intermediate.

**Revision note:** shipped first as 3 separate bordered `<input>` boxes (dd | mm | yyyy). After user
review, revised to a single merged `dd/mm/yyyy` masked `<input>` (the "1 ô liền mask" option from the
original brainstorm) — the 3-box layout looked visually cluttered. Final implementation keeps the same
`NgayThang` in/out contract and skip/lunar semantics described below, but renders one text input
(`data-testid="${testIdPrefix}-date"`) instead of three, using local component state as the display
source of truth (not derived fresh from `value` each render) so leading zeros ("03") survive the
round-trip through `NgayThang`'s plain-number storage — deriving straight from `value` on every render
loses the leading zero once a segment reaches its numeric value (e.g. `Number("03") = 3` renders back
as `"3"`, breaking the fixed-width mask). The local buffer resyncs from `value` only when the prop
changes for a reason other than this component's own last `onChange` call (tracked via a ref), so
external resets (row reset, loading a different person) still refresh correctly.

## Requirements

- Functional:
  - 3 numeric segments `ngay` (dd) / `thang` (mm) / `nam` (yyyy), placeholders `__` / `__` / `____`.
  - Digit-only input (strip non-digit chars on change).
  - `maxLength` 2 / 2 / 4 per segment. Typing a full segment auto-focuses the next segment.
  - Backspace on an empty segment focuses the previous segment (standard OTP-input pattern). Do not
    auto-delete the previous segment's content on that backspace press — just move focus, matching
    common OTP-input UX (second backspace then clears).
  - A single checkbox labeled "ÂL" (âm lịch) next to the 3 segments, bound to `amLich`.
  - Leaving a segment fully empty means that part is unset (`undefined`) in the emitted `NgayThang`.
  - If `ngay`, `thang`, and `nam` are ALL empty, emit `undefined` for the whole value — regardless of
    checkbox state (mirrors existing `buildNgay()` semantics in `MemberManagementView.tsx`: a lunar
    flag alone with no date parts is meaningless to persist).
- Non-functional:
  - No calendar validation (no day ≤ 31 / month ≤ 12 checks). Only the maxLength digit caps constrain
    input. Rationale: lunar months can have 29 or 30 days depending on the lunar calendar; enforcing
    solar-calendar bounds would reject valid lunar entries. This is a deliberate scope boundary, not
    an oversight — do not add it back during review.
  - No new npm dependency.

## Architecture

New file `src/components/NgayThangInput.tsx`:

```tsx
import { useRef } from 'react'
import type { NgayThang } from '../types/giapha'

interface Props {
  value: NgayThang | undefined
  onChange: (value: NgayThang | undefined) => void
  testIdPrefix?: string
}

export default function NgayThangInput({ value, onChange, testIdPrefix }: Props) {
  // 3 refs (ngay, thang, nam) for focus management on auto-advance / backspace.
  // Local segment strings derived from `value` on each render (controlled component,
  // no internal state duplication beyond what's needed for the empty-vs-unset distinction).
  // ...
}
```

Segment change handler shape (pseudocode):

```
function handleSegmentChange(segment: 'ngay' | 'thang' | 'nam', raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, maxLenFor(segment))
  const next = { ...currentParts, [segment]: digits }
  emit(next)
  if (digits.length === maxLenFor(segment)) focusNextSegment(segment)
}

function emit(parts: { ngay: string; thang: string; nam: string; amLich: boolean }) {
  if (!parts.ngay && !parts.thang && !parts.nam) { onChange(undefined); return }
  onChange({
    ngay: parts.ngay ? Number(parts.ngay) : undefined,
    thang: parts.thang ? Number(parts.thang) : undefined,
    nam: parts.nam ? Number(parts.nam) : undefined,
    amLich: parts.amLich || undefined,
  })
}
```

Backspace handling: `onKeyDown` on each segment input — if `key === 'Backspace'` and the segment's
current value is empty, `preventDefault` is not needed; just call `focusPrevSegment()`.

## Related Code Files

- Create: `src/components/NgayThangInput.tsx`
- Create: `src/components/NgayThangInput.test.tsx`

## Implementation Steps

1. Create `NgayThangInput.tsx` with 3 controlled `<input>` segments (type="text", `inputMode="numeric"`,
   `maxLength` 2/2/4) rendered inline (dd / mm / yyyy separated by `/` text), plus the "ÂL" checkbox.
2. Derive segment display strings from `value` prop on each render (no local `useState` mirroring
   `value` — keep it a fully controlled component to avoid stale-state bugs when parent resets a row).
3. Wire `onChange` per segment: filter non-digits, cap length, call parent `onChange` with the
   recomputed `NgayThang | undefined` per the `emit()` logic above.
4. Wire auto-advance: when a segment reaches its max digit count, focus the next segment ref. When the
   `nam` (year) segment is filled, do nothing further (no submit-on-complete behavior — this is a
   plain input, not an OTP flow).
5. Wire backspace-to-previous: `onKeyDown` handler checks `e.key === 'Backspace'` and current segment
   value is empty → focus previous segment.
6. Wire checkbox `onChange` → recompute and emit via the same `emit()` path (so the all-empty-date
   guard still applies).
7. Add `data-testid` attributes using `testIdPrefix` when provided (e.g. `${testIdPrefix}-ngay`,
   `${testIdPrefix}-thang`, `${testIdPrefix}-nam`, `${testIdPrefix}-amLich`) so grid/form tests can
   target individual segments.
8. Write component tests covering: typing digits fills segment and auto-advances; backspace on empty
   segment moves focus back; leaving day/month blank while year is set produces `{ nam: N }`; checking
   "ÂL" with no date parts entered does not emit a value (stays `undefined`); checking "ÂL" plus a
   filled year emits `{ nam: N, amLich: true }`; loading an existing partial+lunar `NgayThang` value
   pre-fills the correct segments and checkbox state.

## Success Criteria

- [x] Typing 2 digits in the day segment moves focus to the month segment automatically.
- [x] Typing 2 digits in the month segment moves focus to the year segment automatically.
- [x] Backspace in an empty day/month/year segment moves focus to the previous segment.
- [x] Leaving day and/or month empty while year is filled produces a `NgayThang` with only `nam` set.
- [x] Toggling "ÂL" with at least one date part filled sets `amLich: true` in the emitted value.
- [x] Toggling "ÂL" alone (no date parts filled) does not produce a truthy `NgayThang` — value stays
      `undefined`.
- [x] Component re-renders correctly from an externally-changed `value` prop (e.g. parent resets row) —
      no stale segment display.
- [x] `npm run test:run -- NgayThangInput` passes.
- [x] `npm run lint` and `tsc -b` clean for the new file.

## Risk Assessment

- **Focus-management edge cases** (e.g. rapid typing, paste with a full "dd/mm/yyyy" string into one
  segment): out of scope for this phase — segments only accept up to their maxLength of pasted content
  via the same digit-filter path, no special multi-segment paste parsing. Acceptable per KISS; can be
  revisited if users report friction.
- **Controlled-component re-render cost**: negligible — this is a small form component, not a
  performance-sensitive list of hundreds of rows rendered simultaneously (grid rows are typically low
  hundreds at most for a family tree; revisit only if profiling shows an issue).
