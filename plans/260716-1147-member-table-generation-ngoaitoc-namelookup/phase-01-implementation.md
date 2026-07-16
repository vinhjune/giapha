# Phase 01: Implementation

## 1. Backend — `worker/src/routes/editor.ts`

- Add `thuTuDoi?: number` to `PersonPayload` interface.
- In `toPersonRow`, add `thuTuDoi: body.thuTuDoi ?? null` to the returned object (schema
  column `persons.thuTuDoi` is nullable integer, already exists — no migration needed).
- No change to POST/PUT route bodies otherwise; `toPersonRow(body)` is spread into both
  insert and update, so this one change covers create + edit.

## 2. Frontend — `src/components/MemberManagementView.tsx`

### 2a. Types & row shape

- Add `'thuTuDoi'` to `RowField` union.
- Add `thuTuDoi: string` handling in `personToRow` (`person.thuTuDoi != null ? String(person.thuTuDoi) : ''`),
  `createEmptyRow` (`''`), and `rowToPersonPayload` (`row.thuTuDoi ? Number(row.thuTuDoi) : undefined`).

### 2b. Column order + labels

- In `COLUMNS`, reorder so `thuTuDoi` (label `'Đời'`) sits immediately after `laThanhVienHo`.
- Rename `laThanhVienHo` column label from `'Thành viên họ'` to `'Ngoại tộc'`.
- Remove the standalone "Đời" `<th>` (line ~275) and `<td>` (line ~294-296) that currently
  render outside the `COLUMNS.map` — thuTuDoi now flows through the normal column loop.
- Add `thuTuDoi` to `DEFAULT_COLUMN_WIDTHS` (~90px, matches old standalone column).

### 2c. Ngoại tộc checkbox (inverted polarity)

- Keep `col.key === 'laThanhVienHo'` branch, but:
  - `checked={row.laThanhVienHo === 'false'}` (checked = ngoại tộc = NOT a blood member)
  - `onChange={e => handleCellChange(rowIndex, col.key, String(!e.target.checked))}`
  - `aria-label` → `` `Ngoại tộc dòng ${rowIndex + 1}` ``
- `createEmptyRow` keeps `laThanhVienHo: 'true'` (new person defaults to blood member →
  Ngoại tộc checkbox unchecked by default) — no change needed there.

### 2d. Đời numeric input + validation

- New `col.key === 'thuTuDoi'` branch: plain text/number input, same styling as other cells.
- In `handleApplyChanges`, before building payload for a row, validate: if
  `row.thuTuDoi.trim()` is non-empty and `Number.isNaN(Number(row.thuTuDoi))`, push an error
  (`` `${row.hoTen || row._key}: Đời phải là số` ``) and `continue` (skip save for that row),
  matching the existing per-row try/catch error-collection pattern.

### 2e. Bố ID / Mẹ ID / Vợ-chồng IDs → name + PersonPicker

- Import `PersonPicker` from `./PersonPicker`.
- Add local state: `const [picker, setPicker] = useState<{ rowIndex: number; field: 'boId' | 'meId' | 'voChongIds' } | null>(null)`.
- Helper `getName(id: string) { return data?.persons[id]?.hoTen || '' }` (mirrors `PersonForm.tsx:162`).
- `boId`/`meId` cell rendering: show `getName(row.boId) || 'Chưa chọn'` (gray placeholder text
  when empty) + a small "Đổi"/"Chọn" button that opens the picker for that row/field. If a
  value is set, also show a small "×" clear button (mirrors `PersonForm.tsx:257,280`) that
  calls `handleCellChange(rowIndex, field, '')`.
- `voChongIds` cell rendering: split `row.voChongIds` by `;`, render each as a small chip with
  name + remove button (mirrors `PersonForm.tsx:288-291`), plus a compact "+" button opening
  the picker for `field: 'voChongIds'`.
- Picker `excludeIds`:
  - boId picker: `[row.id, ...(row.meId ? [row.meId] : [])]`
  - meId picker: `[row.id, ...(row.boId ? [row.boId] : [])]`
  - voChongIds picker: `[row.id, ...currentSpouseIds]`
- `onSelect`:
  - boId/meId: `handleCellChange(rowIndex, field, person.id); setPicker(null)`
  - voChongIds: append `person.id` to the `;`-joined list via `handleCellChange`, close picker.
- Render `{picker && <PersonPicker title=... excludeIds=... onSelect=... onClose={() => setPicker(null)} />}`
  once, outside the table (modal is fixed/overlay positioned already).

## 3. Tests — `src/components/MemberManagementView.test.tsx`

- Test 1 (`shows all members...`): still checks header text `'Đời'` — passes unchanged
  (header text unchanged, only position moves). Also assert `'Ngoại tộc'` header now present
  instead of `'Thành viên họ'` if that string was asserted (it wasn't — no change needed there,
  but double check no stray assertion breaks).
- Test 2 (`allows adding a new row...`): replace `user.type(getByTestId('boId-2'), '1')` with:
  click the boId cell's "Chọn" button for row 2, type `'Ông Tổ'` (or leave empty to show
  default list) in the PersonPicker search box, click the `Ông Tổ` result. Assert
  `api.createPerson` called with `boId: '1'` as before.
- Test 3 (`allows checkbox toggle...`): person `'1'` has `laThanhVienHo: true` → with inverted
  polarity, `laThanhVienHo-1` checkbox now starts **unchecked** (blood member ⇒ not ngoại tộc).
  Update assertions: `expect(memberCheckbox).not.toBeChecked()`, click it, then
  `expect(memberCheckbox).toBeChecked()`. Keep delete-row assertion as-is.
- Add one new test: entering a non-numeric value in `thuTuDoi-<row>` and clicking "Áp dụng
  thay đổi" shows the "Đời phải là số" error and does not call `api.updatePerson`/`createPerson`
  for that row.

## 4. Verification

- `npm run test:run` (vitest) — MemberManagementView.test.tsx and full suite (catch any other
  test importing this component or asserting on `laThanhVienHo` semantics).
- `npm run lint` and `tsc -b` (via `npm run build`) — no new errors.
- Manual check via dev server: load `/`, open Quản lý thành viên, verify column order, toggle
  Ngoại tộc, edit Đời, reassign Bố/Mẹ/Vợ-chồng via picker, Áp dụng thay đổi, reload to confirm
  persistence against local D1 (already synced from remote in the prior session).

## Risks / Rollback

- thuTuDoi edits could be silently overwritten later if giaphadongho recomputes this column —
  accepted by user, no mitigation implemented this round.
- If PersonPicker-only editing turns out too slow for bulk data entry, revert 2e only (keep
  raw-ID inputs) — the other two changes (2b-2d) are independent and don't need to be reverted
  together.
