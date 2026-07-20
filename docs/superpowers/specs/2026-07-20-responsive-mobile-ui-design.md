# Responsive Mobile UI — Design Spec

Date: 2026-07-20

## Context

The app (React + Tailwind, `relatives-tree`-style family tree) is desktop-first
today. It needs to work well on mobile too, with different primary use cases
per device:

- **Mobile**: mainly "Cây" (tree) and "Danh sách" (list) views.
- **Laptop/desktop**: mainly "Quản lý thành viên" (member management table).

Desktop layout and behavior are **not** changing. This spec covers what's
added/adjusted for viewports below the `sm` (640px) breakpoint.

## Breakpoint

Single breakpoint: Tailwind's `sm:` (640px), matching the convention already
used in `PersonForm.tsx` (`items-end justify-center p-2 sm:items-center
sm:p-4`, `max-h-[100dvh] sm:max-h-[90vh]`). No new breakpoint is introduced.

- `< 640px` → mobile chrome (bottom tab bar, full-screen modal, full-width
  search, shrunk top bar).
- `>= 640px` → today's desktop layout, unchanged.

## Components affected

### `Navbar.tsx`

- **Desktop (`sm:` and up)**: unchanged — title, inline `SearchBar` (`w-64`),
  `☰` dropdown menu with Chế độ xem / Quản lý thành viên / Nhập CSV / Xuất
  CSV / Thứ tự đời, exactly as today.
- **Mobile (`< sm`)**:
  - Top bar collapses to one row: `☰` + title only.
  - `SearchBar` renders full-width (`w-full`) on its own row directly below
    the title row, with standard horizontal margin (matches existing `px-4`
    container padding).
  - The `☰` dropdown menu itself is unchanged in content and behavior — it
    remains the way to reach Quản lý thành viên, Nhập/Xuất CSV, and Thứ tự
    đời toggle on mobile. No new menu items.

### New: mobile bottom tab bar

- Rendered only when `< sm`, fixed to the bottom of the viewport
  (`fixed bottom-0 inset-x-0`), safe-area aware (`env(safe-area-inset-bottom)`
  padding for notched devices).
- Three tabs: **Cây**, **Danh sách**, **Thêm mới**.
  - Cây / Danh sách call `setViewMode('tree' | 'list')`. Active tab is
    highlighted based on `viewMode`; when `viewMode === 'members'` neither
    tab is highlighted (bar stays visible per decision below, no highlight
    is misleading otherwise).
  - Thêm mới opens the "add person" flow — same action the current floating
    `+` button (FAB) triggers today (`openAdd()` in `HomePage.tsx`).
- The bar **stays visible** even while viewing Quản lý thành viên on mobile
  (reached via `☰`), so the user can tap back to Cây/Danh sách in one tap,
  even though that view is desktop-first.
- The existing floating `+` FAB (`HomePage.tsx`, `fixed bottom-6 right-6`) is
  **hidden on mobile** (`hidden sm:flex` or equivalent) since "Thêm mới"
  replaces it there. It remains exactly as-is on desktop.
- Content areas (`TreeView`, `ListView`, `MemberManagementView`) get bottom
  padding/inset on mobile equal to the tab bar's height so content isn't
  hidden behind it.

### `SearchBar.tsx`

- Add a `fullWidth`-style variant (or simply responsive classes: `w-full
  sm:w-64`) so it fills its row on mobile and keeps its fixed desktop width.
- No changes to search logic — `timKiemTheoTen` / `focusPerson` are unchanged
  and already work for both Cây and Danh sách, since the bar lives in the
  fixed navbar chrome, not inside `TreeView`'s scrollable canvas. Because of
  that placement, the bar is always full width "no matter where the user
  moves the tree" — panning/zooming the tree canvas has no effect on it.

### `PersonForm.tsx` — full-screen mobile modal

- **Mobile (`< sm`)**:
  - Backdrop wrapper becomes `fixed inset-0` with the dialog itself filling
    `100dvh` x full width, no rounded corners, no outer padding
    (edge-to-edge).
  - Header replaces the current "×" close button with a **`←` back arrow**
    (left-aligned) next to the person's name / "Thêm người mới" title.
  - Footer becomes two buttons: **Lưu** (primary, `flex-1`) and **Xoá**
    (destructive, only rendered when `editPerson` is set — same condition as
    today). The **Hủy** button is removed on mobile; `←` covers that role.
  - Both `←` and Xoá require confirmation before discarding/deleting:
    - `←` reuses the existing `isDirty` computation (already used by
      `handleNavigateTo`): if `isDirty`, show the same-style `confirm()`
      dialog asking to discard changes before closing; if not dirty, close
      immediately.
    - Xoá keeps its existing `confirm()` call in `handleXoaNguoi` — no
      change needed, it already confirms.
- **Desktop (`sm:` and up)**: unchanged — centered dialog, rounded corners,
  header with "×" close, footer with Lưu / Hủy / Xoá as today.
- **Centering-on-select is untouched.** `selectPerson`/`focusPerson` in the
  store and `TreeView`'s existing `useEffect` (the one calling
  `containerRef.current.scrollTo(...)` centered on the highlighted card) are
  not modified. Because `closeForm` in `HomePage.tsx` only clears
  `selectedPersonId`/`focusedPersonId` (it does not scroll), the tree stays
  visually centered on that member after the modal closes/backs out, on both
  mobile and desktop.

### `TreeView.tsx` — zoom controls

- No functional or structural change. The zoom control panel
  (`absolute top-3 right-3` inside the `relative overflow-auto` container)
  already stays anchored on screen through panning/zooming, because it's
  positioned relative to the container's padding box, which doesn't move
  when the inner content scrolls.
- Mobile-only tweak: bump the −/percentage/+ buttons to a 44×44px minimum
  touch target (currently `h-8 w-8` on the +/− buttons), via responsive
  sizing classes, to meet accessible touch-target guidance.

### `MemberManagementView.tsx`

- No layout changes. Stays desktop-first with its existing horizontal-scroll
  wide table (`min-w-[2400px]`). Reachable on mobile via `☰` → "Quản lý
  thành viên" exactly as today; the new bottom tab bar remains visible while
  there (see above) so users can navigate back easily.

## Data flow

No store (`useGiaphaStore`) changes. `viewMode`, `selectedPersonId`,
`focusedPersonId`, `selectPerson`, `focusPerson` are all reused as-is by the
new mobile chrome.

## Error handling

No new error states introduced. Existing `confirm()`-based guards (unsaved
changes, delete confirmation) are reused, just re-wired to the new mobile
header/footer buttons.

## Testing

- `PersonForm.test.tsx`: add cases for mobile back-arrow (confirms only when
  `isDirty`), mobile footer showing only Lưu/Xoá (no Hủy), desktop footer
  unchanged.
- `Navbar.test.tsx`: mobile top bar collapses to `☰` + title, full-width
  `SearchBar` renders below it on mobile; desktop layout unchanged.
- New test file for the bottom tab bar component: renders 3 tabs, switches
  `viewMode` on tap, stays visible and unhighlighted in `members` mode,
  triggers add-person flow from "Thêm mới".
- `SearchBar.test.tsx`: full-width class applied in mobile context.
- `HomePage.test.tsx`: FAB hidden / tab bar's "Thêm mới" triggers `openAdd()`
  on mobile; FAB still present on desktop.
- `TreeView.test.tsx`: no behavior change expected; optionally add a touch
  target size assertion for zoom buttons on mobile.

## Out of scope

- Any redesign of `MemberManagementView` for mobile (kept desktop-first per
  explicit product decision).
- Any change to search matching logic (`timKiemTheoTen`).
- Any change to the `☰` dropdown menu's contents/behavior.
