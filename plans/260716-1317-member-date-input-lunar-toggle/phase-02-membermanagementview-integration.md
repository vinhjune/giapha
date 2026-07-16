---
phase: 2
title: MemberManagementView integration
status: completed
priority: P1
dependencies:
  - 1
---

# Phase 2: MemberManagementView integration

## Overview

Collapse the 8 flat date columns (`namSinh_nam/thang/ngay/amLich`, `namMat_nam/thang/ngay/amLich`) in
the "Quản lý thành viên" grid down to 2 columns ("Ngày sinh", "Ngày mất"), each rendering
`NgayThangInput` from Phase 1 and storing a `NgayThang | undefined` directly on the row — removing the
string-juggling helpers (`dateToParts`, `buildNgay`) that existed only to bridge the old flat-column
shape.

## Requirements

- Functional:
  - `EditableRow` stores `namSinh: NgayThang | undefined` and `namMat: NgayThang | undefined` instead
    of the 8 string fields.
  - `COLUMNS` array has 2 entries ("Ngày sinh", "Ngày mất") in place of the current 8 date entries,
    in the same table position (between "Thứ tự anh/chị" and "Bố").
  - Column widths sized to fit 3 segments + checkbox comfortably (~200px, replacing 4×110px = 440px
    per date — net width reduction).
  - `personToRow`, `createEmptyRow`, `rowToPersonPayload` updated for the 2-field shape.
  - Existing behaviors unaffected: add row, reset (hoàn tác), delete row, apply changes (save),
    thuTuDoi validation, Bố/Mẹ/Vợ-chồng picker columns.
- Non-negotiable constraints:
  - Do not touch `laThanhVienHo`/`thuTuDoi`/Bố-Mẹ-picker logic — that's owned by the already-shipped
    `260716-1147-member-table-generation-ngoaitoc-namelookup` plan (committed at `4aa3d59`); this
    phase only touches the date columns.
  - Keep the existing `handleCellChange(index, field, value: string)` signature for all non-date
    fields untouched; add a separate handler for date fields since their value type is `NgayThang`,
    not `string`.

## Architecture

`RowField` type: remove the 8 `namSinh_*`/`namMat_*` string keys, keep everything else. `EditableRow`
becomes:

```ts
interface EditableRow extends Record<Exclude<RowField, 'namSinh' | 'namMat'>, string> {
  _key: string
  namSinh: NgayThang | undefined
  namMat: NgayThang | undefined
}
```

(Or simplest: drop the `Record<RowField, string>` blanket extension and list every field explicitly —
whichever keeps the diff smallest; the blanket `Record` was already awkward once `namSinh`/`namMat`
aren't strings, so explicit fields are cleaner here.)

New date-specific handler alongside existing `handleCellChange`:

```ts
function handleDateChange(index: number, field: 'namSinh' | 'namMat', value: NgayThang | undefined) {
  setRows(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row))
  setErrorMessages([])
  setSaveMessage(null)
}
```

Cell render (replacing the 4 date `<td>` blocks per date with 1):

```tsx
<td ...>
  <NgayThangInput
    value={row.namSinh}
    onChange={v => handleDateChange(rowIndex, 'namSinh', v)}
    testIdPrefix={`namSinh-${rowIndex}`}
  />
</td>
```

(mirror for `namMat`).

## Related Code Files

- Modify: `src/components/MemberManagementView.tsx`
- Modify: `src/components/MemberManagementView.test.tsx` (only if it references the old 8 date
  fields/testids — verify during implementation; scout found no such references as of this plan's
  writing, but re-check before assuming no test changes needed)

## Implementation Steps

1. Update `RowField` type and `EditableRow` interface per Architecture above.
2. Update `COLUMNS` array: replace the 8 date entries with 2 (`{ key: 'namSinh', label: 'Ngày sinh' }`,
   `{ key: 'namMat', label: 'Ngày mất' }`).
3. Update `DEFAULT_COLUMN_WIDTHS`: replace the 8 date width entries with `namSinh: 200, namMat: 200`
   (adjust after visual check).
4. Delete `dateToParts()` and `buildNgay()` helpers (no longer needed).
5. Update `personToRow()`: `namSinh: person.namSinh, namMat: person.namMat` (direct passthrough, no
   conversion).
6. Update `createEmptyRow()`: `namSinh: undefined, namMat: undefined`.
7. Update `rowToPersonPayload()`: `namSinh: row.namSinh, namMat: row.namMat` (direct passthrough).
8. Add `handleDateChange()` handler (see Architecture).
9. Update the table cell rendering: replace the 8 per-date `<td>` blocks with 2, each rendering
   `<NgayThangInput>` bound via `handleDateChange` as shown above.
10. Manually verify in the running app (`npm run dev`): load existing members with dates, confirm
    values pre-fill correctly; edit a date, save, reload, confirm persistence round-trips.
11. Run `npm run lint`, `tsc -b`, and `npm run test:run -- MemberManagementView` — fix any breakage.

## Success Criteria

- [x] Grid shows exactly 2 date columns ("Ngày sinh", "Ngày mất") instead of 8.
- [x] Existing member dates (including partial dates and lunar dates already in the DB) load and
      display correctly in the new segmented inputs on page load.
- [x] Editing a date in the grid and clicking "Áp dụng thay đổi" persists correctly — verify via
      reload that year/month/day/lunar all round-trip.
- [x] Adding a new row with only a year (day/month left blank) saves successfully without validation
      errors.
- [x] "Hoàn tác" (reset) correctly restores original date values into the segmented inputs.
- [x] Deleting a row still works unaffected by the date column changes.
- [x] `thuTuDoi`, Bố/Mẹ/Vợ-chồng picker columns unaffected (regression check only, no changes made
      there).
- [x] `npm run lint`, `tsc -b`, `npm run test:run -- MemberManagementView` all pass.

## Risk Assessment

- **Existing test breakage**: if `MemberManagementView.test.tsx` references old field names/testids
  for dates, tests will fail after the column collapse — fix by updating to the new `NgayThangInput`
  testid pattern (`namSinh-{rowIndex}-ngay` etc.) rather than skipping/weakening the test.
- **Column width/layout shift**: collapsing 8→2 columns changes total table width; verify horizontal
  scroll behavior still works reasonably at `min-w-[2400px]` — may need to reduce that value slightly
  since 6 columns' worth of width (≈660px) is removed. Adjust `min-w` empirically during manual check.
