---
phase: 3
title: PersonForm integration
status: completed
priority: P1
dependencies:
  - 1
---

# Phase 3: PersonForm integration

## Overview

Replace `PersonForm.tsx`'s freeform "dd/mm/yyyy" text inputs with `NgayThangInput` (Phase 1). This is
the add/edit modal used from the family-tree view (`PersonPicker` → "Thêm người mới" / "Sửa thông
tin"). It currently has **no lunar checkbox at all** — `amLich` is silently dropped on save. This
phase both matches the grid's new UX and fixes that data-loss bug.

## Requirements

- Functional:
  - `FormState.namSinh: NgayThang | undefined` and `FormState.namMat: NgayThang | undefined` replace
    the current `ngaySinh: string` / `ngayMat: string`.
  - Form renders `NgayThangInput` for both "Ngày sinh" and "Ngày mất" fields, in the same form
    position as the current text inputs.
  - Editing an existing person pre-fills the segmented input + lunar checkbox from
    `editPerson.namSinh` / `editPerson.namMat` directly (no string round-trip).
  - Submitting the form sends `namSinh`/`namMat` as `NgayThang | undefined` unchanged — including
    `amLich` — to `themNguoi`/`suaNguoi`.
- Scope boundary: do not change any other field/behavior in `PersonForm.tsx` (Bố/Mẹ/Vợ-chồng pickers,
  giới tính, ngoại tộc logic, etc.) — this phase is strictly the 2 date fields.

## Architecture

Remove `ngayToStr()` and `strToNgay()` helper functions entirely — no longer needed since form state
holds `NgayThang` directly instead of a string.

`FormState` interface: replace

```ts
ngaySinh: string
ngayMat: string
```

with

```ts
namSinh: NgayThang | undefined
namMat: NgayThang | undefined
```

Initial state (`empty` object and `editPerson` branch in `useState` initializer):

```ts
// empty:
namSinh: undefined, namMat: undefined,

// editPerson branch:
namSinh: editPerson.namSinh,
namMat: editPerson.namMat,
```

Form JSX (replace the two `<input type="text">` blocks around line 227-240):

```tsx
<div className="flex flex-col gap-3 sm:flex-row">
  <div className="flex-1">
    <label className="text-sm font-medium text-gray-700">Ngày sinh</label>
    <div className="mt-1">
      <NgayThangInput value={form.namSinh} onChange={v => setForm(f => ({ ...f, namSinh: v }))} />
    </div>
  </div>
  <div className="flex-1">
    <label className="text-sm font-medium text-gray-700">Ngày mất</label>
    <div className="mt-1">
      <NgayThangInput value={form.namMat} onChange={v => setForm(f => ({ ...f, namMat: v }))} />
    </div>
  </div>
</div>
```

`handleSubmit`: replace `namSinh: strToNgay(form.ngaySinh), namMat: strToNgay(form.ngayMat),` with
`namSinh: form.namSinh, namMat: form.namMat,`.

## Related Code Files

- Modify: `src/components/PersonForm.tsx`
- Modify: `src/components/PersonForm.test.tsx` (only if it interacts with the old text inputs by
  placeholder/testid — verify during implementation; scout found no such references as of this plan's
  writing)

## Implementation Steps

1. Update `FormState` interface: swap `ngaySinh`/`ngayMat` strings for `namSinh`/`namMat`
   `NgayThang | undefined`.
2. Update `empty` constant and the `editPerson` branch of the `useState` initializer per Architecture.
3. Delete `ngayToStr()` and `strToNgay()` functions.
4. Replace the two date `<input type="text">` blocks with `<NgayThangInput>` per Architecture.
5. Update `handleSubmit`'s `personData` construction to pass `form.namSinh`/`form.namMat` directly.
6. Manually verify in the running app: open "Thêm người mới" from the tree view, enter a partial date
   (year only) with lunar checked, save, reopen the same person for edit, confirm the segmented input
   and checkbox pre-fill correctly.
7. Run `npm run lint`, `tsc -b`, and `npm run test:run -- PersonForm` — fix any breakage.

## Success Criteria

- [x] "Thêm người mới" modal: entering only a year, or year+month, saves successfully (day/month
      correctly omitted from the payload).
- [x] Checking "ÂL" on either date field and saving persists `amLich: true` — verified by reopening
      the person for edit and confirming the checkbox is still checked (this is the bug fix: currently
      this data is silently lost).
- [x] Editing an existing person with a lunar birth date pre-fills the checkbox as checked.
- [x] All other form fields/behaviors (Bố/Mẹ/Vợ-chồng pickers, ngoại tộc auto-mark, giới tính) remain
      unaffected — regression check only.
- [x] `npm run lint`, `tsc -b`, `npm run test:run -- PersonForm` all pass.

## Risk Assessment

- **Silent behavior change for existing lunar data entered via the grid but never via this form**: none
  — this phase only affects data entered through `PersonForm` going forward; existing DB data is
  unaffected either way since the DB always stored `isLunar` correctly, only this form's UI discarded
  it before now.
- **Test coverage gap**: if `PersonForm.test.tsx` has no existing date-field tests, this phase should
  add at least one covering the "enter partial date, save, payload has correct shape" path, and one
  covering "lunar checkbox reaches the save payload" (regression guard for the bug being fixed) —
  confirm current coverage during implementation and add if missing.
