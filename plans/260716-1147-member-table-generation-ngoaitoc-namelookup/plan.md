# Plan: Member table — reorder Đời, flip to Ngoại tộc, name lookup for ID columns

Status: implemented, verified (tsc/lint/vitest clean, code-reviewed), pending user commit decision
Branch: master

## Scope

`src/components/MemberManagementView.tsx` ("Quản lý thành viên" screen) only, plus the
backend contract it depends on.

1. Move "Đời" (thuTuDoi) column to right after "Thành viên họ", make it editable.
2. Flip "Thành viên họ" checkbox into "Ngoại tộc" with inverted semantics (tick = married-in/outside clan).
3. Bố ID / Mẹ ID / Vợ-chồng IDs columns: show the person's name (resolved client-side from
   `data.persons`), edit via the existing `PersonPicker` modal instead of typing raw IDs.

## Decisions (confirmed with user)

- thuTuDoi becomes directly user-editable despite being documented as "computed and owned by
  the shared database" — user accepted the risk that giaphadongho (sibling app, same D1 DB)
  may recompute/overwrite it later.
- Bố/Mẹ/Vợ-chồng columns switch fully to PersonPicker-based selection (no more raw-ID typing),
  matching the pattern already used in `PersonForm.tsx`.
- `laThanhVienHo` stays the internal field name end-to-end (type, API payload, DB column
  `ngoai_toc` via `!laThanhVienHo`) — only the UI label/checkbox polarity flips. No type or
  API contract renames.

## Acceptance Criteria

- "Đời" column header appears immediately after "Ngoại tộc" column, as a numeric input.
- Editing Đời and clicking "Áp dụng thay đổi" persists thuTuDoi via PUT/POST `/persons`.
- Non-numeric Đời input is rejected client-side with an error message (matches existing
  batched-error UX), not silently sent as NaN.
- "Ngoại tộc" checkbox: checked means `laThanhVienHo=false` (ngoaiToc=true); unchecked means
  `laThanhVienHo=true`. Toggling and saving round-trips correctly.
- Bố ID / Mẹ ID cells show the linked person's full name (or "Chưa chọn" placeholder), each
  with a button opening PersonPicker (excluding self, and excluding the other parent already
  chosen) to reassign.
- Vợ/chồng IDs cell shows each spouse's name as a removable chip, with an "+" button opening
  PersonPicker (excluding self and already-chosen spouses) to add another.
- Existing three tests in `MemberManagementView.test.tsx` pass (rewritten where interaction
  model changed) plus `npm run build` / `tsc -b` and `npm run lint` are clean.
- No change to `/api/tree` response shape, `Person` type, or any other consumer of `laThanhVienHo`/`boId`/`meId`/`honNhan` (PersonForm, PersonCard, tree view, csv import/export all untouched).

## Out of Scope

- No change to `families`/`ngoaiToc` DB schema.
- No change to CSV import/export.
- No automatic recomputation of thuTuDoi for descendants when a person's own value changes.

## Touchpoints

- `worker/src/routes/editor.ts` — add `thuTuDoi` to `PersonPayload` + `toPersonRow`.
- `src/components/MemberManagementView.tsx` — column order/labels, checkbox polarity, ID→name+picker cells.
- `src/components/MemberManagementView.test.tsx` — update for new interaction model.
- Reused as-is (no edits): `src/components/PersonPicker.tsx`, `src/store/useGiaphaStore.ts`, `src/types/giapha.ts`.

See `phase-01-implementation.md` for step-by-step detail.
