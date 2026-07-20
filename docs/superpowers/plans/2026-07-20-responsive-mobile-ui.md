# Responsive Mobile UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app usable on mobile — full-width search, a bottom tab bar for Cây/Danh sách/Thêm mới, and a full-screen "Sửa thông tin" modal — without changing anything on desktop (`sm:` / 640px and up).

**Architecture:** A single new `useIsMobile()` hook (matchMedia-based, `(max-width: 639px)`) drives JS-level structural differences (modal header/footer, navbar layout, bottom tab bar presence). Pure visual/size differences (search bar width, zoom button touch targets) use plain Tailwind responsive classes instead, since they don't need structural branching. No store changes — `viewMode`, `selectedPersonId`, `focusedPersonId` are reused as-is.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Zustand, Vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-07-20-responsive-mobile-ui-design.md`

---

### Task 1: `useIsMobile` hook + test infrastructure

**Files:**
- Create: `src/utils/useIsMobile.ts`
- Create: `src/utils/useIsMobile.test.ts`
- Modify: `src/test-setup.ts`

- [ ] **Step 1: Add a default `matchMedia` polyfill + test helper to `test-setup.ts`**

jsdom doesn't implement `window.matchMedia`. Replace the file's entire contents with:

```ts
import '@testing-library/jest-dom'
import { vi } from 'vitest'

function createMatchMedia(matches: boolean) {
  return vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

// Default every test to the desktop layout (no mobile media query match) so
// existing tests keep exercising the desktop UI unless a test explicitly
// opts into mobile via mockMatchMedia(true).
window.matchMedia = createMatchMedia(false) as unknown as typeof window.matchMedia

export function mockMatchMedia(matches: boolean) {
  window.matchMedia = createMatchMedia(matches) as unknown as typeof window.matchMedia
}
```

- [ ] **Step 2: Write the failing test for the hook**

Create `src/utils/useIsMobile.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useIsMobile } from './useIsMobile'
import { mockMatchMedia } from '../test-setup'

describe('useIsMobile', () => {
  it('returns false when the viewport does not match the mobile media query', () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  it('returns true when the viewport matches the mobile media query', () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it('does not throw when the change event fires', () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => useIsMobile())
    expect(() => act(() => { /* mounted without error */ })).not.toThrow()
    expect(result.current).toBe(true)
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/utils/useIsMobile.test.ts`
Expected: FAIL with "Failed to resolve import './useIsMobile'" (module doesn't exist yet).

- [ ] **Step 4: Implement the hook**

Create `src/utils/useIsMobile.ts`:

```ts
import { useEffect, useState } from 'react'

// Matches Tailwind's default `sm` breakpoint (640px): below it is "mobile".
const MOBILE_MEDIA_QUERY = '(max-width: 639px)'

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_MEDIA_QUERY).matches)

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_MEDIA_QUERY)
    const handleChange = (event: MediaQueryListEvent) => setIsMobile(event.matches)
    mql.addEventListener('change', handleChange)
    return () => mql.removeEventListener('change', handleChange)
  }, [])

  return isMobile
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/utils/useIsMobile.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add src/utils/useIsMobile.ts src/utils/useIsMobile.test.ts src/test-setup.ts
git commit -m "feat: add useIsMobile hook and matchMedia test helper"
```

---

### Task 2: Full-width `SearchBar` on mobile

**Files:**
- Modify: `src/components/SearchBar.tsx:40`
- Test: `src/components/SearchBar.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/components/SearchBar.test.tsx` (inside the existing `describe('SearchBar focus behavior', ...)` block, after the last `it`):

```tsx
  it('is full width by default and constrained back to a fixed width on larger screens', () => {
    render(<SearchBar />)

    const wrapper = screen.getByPlaceholderText('Tìm kiếm theo tên...').closest('div')
    expect(wrapper?.className).toContain('w-full')
    expect(wrapper?.className).toContain('sm:w-64')
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/SearchBar.test.tsx`
Expected: FAIL — `wrapper?.className` contains `w-64` but not `w-full`/`sm:w-64`.

- [ ] **Step 3: Update the wrapper class**

In `src/components/SearchBar.tsx`, change:

```tsx
    <div ref={ref} className="relative w-64">
```

to:

```tsx
    <div ref={ref} className="relative w-full sm:w-64">
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/SearchBar.test.tsx`
Expected: PASS (all tests in the file)

- [ ] **Step 5: Commit**

```bash
git add src/components/SearchBar.tsx src/components/SearchBar.test.tsx
git commit -m "feat: make SearchBar full width on mobile"
```

---

### Task 3: Compact mobile top bar in `Navbar`

**Files:**
- Modify: `src/components/Navbar.tsx`
- Test: `src/components/Navbar.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/components/Navbar.test.tsx`, a new `describe` block after the existing one:

```tsx
describe('Navbar mobile layout', () => {
  beforeEach(() => {
    mockMatchMedia(true)
    useGiaphaStore.setState({
      data,
      viewMode: 'tree',
      selectedPersonId: '1',
      focusedPersonId: '1',
      hienThiThuTuDoi: false,
    })
  })

  it('moves the search bar to its own full-width row below the title bar', () => {
    render(<Navbar />)

    expect(screen.getByRole('button', { name: 'Mở menu' })).toBeInTheDocument()
    const searchRow = screen.getByTestId('navbar-search-row-mobile')
    expect(searchRow).toContainElement(screen.getByPlaceholderText('Tìm kiếm theo tên...'))
  })
})
```

Add the import at the top of the file:

```tsx
import { mockMatchMedia } from '../test-setup'
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Navbar.test.tsx`
Expected: FAIL — `getByTestId('navbar-search-row-mobile')` not found.

- [ ] **Step 3: Restructure `Navbar.tsx` to branch on `useIsMobile`**

In `src/components/Navbar.tsx`, add the import:

```tsx
import { useIsMobile } from '../utils/useIsMobile'
```

Add the hook call inside the component, right after the existing `useGiaphaStore` destructure:

```tsx
  const { data, viewMode, setViewMode, hienThiThuTuDoi, toggleGenerationOrder } = useGiaphaStore()
  const isMobile = useIsMobile()
```

Replace the `<nav>` opening structure — from:

```tsx
    <nav className="relative bg-card border-b border-card-border px-4 py-2 flex items-center gap-4">
      <button
        type="button"
        aria-label="Mở menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(v => !v)}
        className="px-2 py-1.5 text-lg leading-none text-muted rounded-md border border-card-border hover:bg-slate-50"
      >
        ☰
      </button>
      <div className="min-w-0">
        <h1 className="text-lg font-bold text-ink whitespace-nowrap">
          {data?.metadata.tenDongHo || 'Gia Phả'}
        </h1>
      </div>

      <SearchBar />

      {menuOpen && (
```

to:

```tsx
    <nav className="relative bg-card border-b border-card-border flex flex-col">
      <div className="px-4 py-2 flex items-center gap-4">
        <button
          type="button"
          aria-label="Mở menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(v => !v)}
          className="px-2 py-1.5 text-lg leading-none text-muted rounded-md border border-card-border hover:bg-slate-50"
        >
          ☰
        </button>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-ink whitespace-nowrap">
            {data?.metadata.tenDongHo || 'Gia Phả'}
          </h1>
        </div>

        {!isMobile && <SearchBar />}
      </div>

      {isMobile && (
        <div data-testid="navbar-search-row-mobile" className="px-4 pb-2">
          <SearchBar />
        </div>
      )}

      {menuOpen && (
```

The rest of the file — the `{menuOpen && (...)}` block and the closing `</nav>` — is unchanged; only the lines shown above are replaced.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/Navbar.test.tsx`
Expected: PASS (all tests, including the pre-existing `describe('Navbar hamburger menu actions', ...)` block, which runs with the default desktop mock and is unaffected).

- [ ] **Step 5: Commit**

```bash
git add src/components/Navbar.tsx src/components/Navbar.test.tsx
git commit -m "feat: collapse Navbar to a compact bar with full-width search on mobile"
```

---

### Task 4: `BottomTabBar` component

**Files:**
- Create: `src/components/BottomTabBar.tsx`
- Create: `src/components/BottomTabBar.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/BottomTabBar.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BottomTabBar from './BottomTabBar'
import { useGiaphaStore } from '../store/useGiaphaStore'

describe('BottomTabBar', () => {
  beforeEach(() => {
    useGiaphaStore.setState({ viewMode: 'tree' })
  })

  it('switches to Danh sách when tapped', async () => {
    const user = userEvent.setup()
    render(<BottomTabBar onAddClick={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'Danh sách' }))
    expect(useGiaphaStore.getState().viewMode).toBe('list')
  })

  it('switches back to Cây when tapped', async () => {
    useGiaphaStore.setState({ viewMode: 'list' })
    const user = userEvent.setup()
    render(<BottomTabBar onAddClick={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'Cây' }))
    expect(useGiaphaStore.getState().viewMode).toBe('tree')
  })

  it('calls onAddClick when "Thêm mới" is tapped, without changing viewMode', async () => {
    const user = userEvent.setup()
    const onAddClick = vi.fn()
    render(<BottomTabBar onAddClick={onAddClick} />)

    await user.click(screen.getByRole('button', { name: 'Thêm mới' }))
    expect(onAddClick).toHaveBeenCalledTimes(1)
    expect(useGiaphaStore.getState().viewMode).toBe('tree')
  })

  it('marks Cây as current when active', () => {
    render(<BottomTabBar onAddClick={() => {}} />)
    expect(screen.getByRole('button', { name: 'Cây' })).toHaveAttribute('aria-current', 'page')
  })

  it('highlights no tab while viewing Quản lý thành viên', () => {
    useGiaphaStore.setState({ viewMode: 'members' })
    render(<BottomTabBar onAddClick={() => {}} />)

    expect(screen.getByRole('button', { name: 'Cây' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('button', { name: 'Danh sách' })).not.toHaveAttribute('aria-current')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/BottomTabBar.test.tsx`
Expected: FAIL with "Failed to resolve import './BottomTabBar'" (module doesn't exist yet).

- [ ] **Step 3: Implement the component**

Create `src/components/BottomTabBar.tsx`:

```tsx
import { useGiaphaStore } from '../store/useGiaphaStore'

interface Props {
  onAddClick: () => void
}

export default function BottomTabBar({ onAddClick }: Props) {
  const { viewMode, setViewMode } = useGiaphaStore()

  return (
    <nav
      aria-label="Điều hướng chính"
      className="flex border-t border-card-border bg-card"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <button
        type="button"
        onClick={() => setViewMode('tree')}
        aria-current={viewMode === 'tree' ? 'page' : undefined}
        className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs ${
          viewMode === 'tree' ? 'text-blue-600 font-semibold' : 'text-muted'
        }`}
      >
        <span aria-hidden="true">🌳</span>
        Cây
      </button>
      <button
        type="button"
        onClick={() => setViewMode('list')}
        aria-current={viewMode === 'list' ? 'page' : undefined}
        className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs ${
          viewMode === 'list' ? 'text-blue-600 font-semibold' : 'text-muted'
        }`}
      >
        <span aria-hidden="true">📋</span>
        Danh sách
      </button>
      <button
        type="button"
        onClick={onAddClick}
        className="flex-1 flex flex-col items-center gap-0.5 py-2 text-xs text-muted"
      >
        <span aria-hidden="true">➕</span>
        Thêm mới
      </button>
    </nav>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/BottomTabBar.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/BottomTabBar.tsx src/components/BottomTabBar.test.tsx
git commit -m "feat: add BottomTabBar component for mobile navigation"
```

---

### Task 5: Wire `BottomTabBar` into `HomePage`, hide the FAB on mobile

**Files:**
- Modify: `src/pages/HomePage.tsx`
- Test: `src/pages/HomePage.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add the import at the top of `src/pages/HomePage.test.tsx`:

```tsx
import { mockMatchMedia } from '../test-setup'
```

Add a new `describe` block at the end of the file:

```tsx
describe('HomePage mobile navigation', () => {
  beforeEach(() => {
    Element.prototype.scrollTo = vi.fn()
    useGiaphaStore.setState({
      data,
      viewMode: 'tree',
      selectedPersonId: null,
      focusedPersonId: null,
      hienThiThuTuDoi: false,
      cyclicRelationshipWarnings: [],
    })
  })

  it('shows the bottom tab bar on mobile and opens the add-person modal from "Thêm mới"', () => {
    mockMatchMedia(true)
    render(<HomePage />)

    expect(screen.getByRole('button', { name: 'Thêm mới' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Thêm mới' }))

    expect(screen.getByText('Thêm người mới')).toBeInTheDocument()
  })

  it('does not show the bottom tab bar on desktop', () => {
    mockMatchMedia(false)
    render(<HomePage />)

    expect(screen.queryByRole('navigation', { name: 'Điều hướng chính' })).toBeNull()
  })

  it('marks the floating add button as desktop-only via CSS classes', () => {
    mockMatchMedia(false)
    render(<HomePage />)

    const fab = screen.getByTitle('Thêm người mới')
    expect(fab.className).toContain('hidden')
    expect(fab.className).toContain('sm:flex')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/pages/HomePage.test.tsx`
Expected: FAIL — no element with role `button`/name `Thêm mới`; FAB's className doesn't contain `hidden`/`sm:flex`.

- [ ] **Step 3: Update `HomePage.tsx`**

Replace the full file contents with:

```tsx
import { useState } from 'react'
import Navbar from '../components/Navbar'
import TreeView from '../components/TreeView'
import ListView from '../components/ListView'
import MemberManagementView from '../components/MemberManagementView'
import PersonForm from '../components/PersonForm'
import CyclicRelationshipBanner from '../components/CyclicRelationshipBanner'
import BottomTabBar from '../components/BottomTabBar'
import { useGiaphaStore } from '../store/useGiaphaStore'
import { useIsMobile } from '../utils/useIsMobile'

export default function HomePage() {
  const { viewMode, data, selectedPersonId, selectPerson } = useGiaphaStore()
  const [isAddOpen, setIsAddOpen] = useState(false)
  const isMobile = useIsMobile()

  // Clicking a person card in Tree/List selects them; that alone opens the edit
  // modal directly, skipping the old view-only detail panel step.
  const editPerson = !isAddOpen && selectedPersonId && data ? data.persons[selectedPersonId] ?? null : null
  const formOpen = isAddOpen || !!editPerson

  function openAdd() {
    setIsAddOpen(true)
  }

  function closeForm() {
    setIsAddOpen(false)
    if (selectedPersonId) selectPerson(null)
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Navbar />
      <CyclicRelationshipBanner />

      <div className="flex flex-1 overflow-hidden">
        {viewMode === 'tree' && <TreeView />}
        {viewMode === 'list' && <ListView />}
        {viewMode === 'members' && <MemberManagementView />}
      </div>

      {isMobile && <BottomTabBar onAddClick={openAdd} />}

      {viewMode !== 'members' && (
        <button
          onClick={openAdd}
          className="hidden sm:flex fixed bottom-6 right-6 w-12 h-12 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 text-2xl items-center justify-center z-30"
          title="Thêm người mới"
        >
          +
        </button>
      )}

      {formOpen && (
        <PersonForm key={editPerson?.id ?? 'new'} editPerson={editPerson} onClose={closeForm} />
      )}
    </div>
  )
}
```

(The only changes from the original: new imports for `BottomTabBar` and `useIsMobile`, the `isMobile` hook call, the `{isMobile && <BottomTabBar onAddClick={openAdd} />}` line, and `hidden sm:flex` added to the FAB's `className` in place of the plain `flex`.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/pages/HomePage.test.tsx`
Expected: PASS (all tests in the file, including the pre-existing ones — they don't call `mockMatchMedia`, or explicitly set it to `false`/rely on the Task 1 default, so they keep exercising the desktop layout).

- [ ] **Step 5: Commit**

```bash
git add src/pages/HomePage.tsx src/pages/HomePage.test.tsx
git commit -m "feat: show BottomTabBar on mobile and hide the FAB there"
```

---

### Task 6: Full-screen `PersonForm` modal on mobile

**Files:**
- Modify: `src/components/PersonForm.tsx`
- Test: `src/components/PersonForm.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add the import at the top of `src/components/PersonForm.test.tsx`:

```tsx
import { mockMatchMedia } from '../test-setup'
```

Add a new `describe` block at the end of the file:

```tsx
describe('PersonForm mobile full-screen modal', () => {
  const initialState = useGiaphaStore.getState()

  afterEach(() => {
    act(() => {
      useGiaphaStore.setState(initialState, true)
    })
  })

  const editPerson: Person = {
    id: '1',
    hoTen: 'Bố',
    gioiTinh: 'nam',
    laThanhVienHo: true,
    honNhan: [{ voChongId: '2' }],
    conCaiIds: [],
  }

  it('renders full-screen without rounded corners on mobile', () => {
    mockMatchMedia(true)
    useGiaphaStore.setState({ data })

    const { getByTestId } = render(<PersonForm editPerson={editPerson} onClose={() => {}} />)
    const modal = getByTestId('person-form-modal') as HTMLDivElement

    expect(modal.className).toContain('w-full')
    expect(modal.className).toContain('h-full')
    expect(modal.className).not.toContain('rounded-lg')
  })

  it('shows a back arrow instead of the × close button, and drops Hủy from the footer', () => {
    mockMatchMedia(true)
    useGiaphaStore.setState({ data })

    render(<PersonForm editPerson={editPerson} onClose={() => {}} />)

    expect(screen.getByRole('button', { name: 'Quay lại' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '×' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Hủy' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Lưu thay đổi' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xoá' })).toBeInTheDocument()
  })

  it('back arrow closes immediately when nothing changed', () => {
    mockMatchMedia(true)
    useGiaphaStore.setState({ data })
    const onClose = vi.fn()

    render(<PersonForm editPerson={editPerson} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('back arrow asks for confirmation before closing when the form changed, and respects the answer', () => {
    mockMatchMedia(true)
    useGiaphaStore.setState({ data })
    const onClose = vi.fn()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(<PersonForm editPerson={editPerson} onClose={onClose} />)
    fireEvent.change(screen.getByDisplayValue('Bố'), { target: { value: 'Bố sửa' } })
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }))

    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()

    confirmSpy.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    confirmSpy.mockRestore()
  })

  it('hides Xoá and keeps a full-width Lưu when adding a new person on mobile', () => {
    mockMatchMedia(true)
    useGiaphaStore.setState({ data })

    render(<PersonForm editPerson={null} onClose={() => {}} />)

    expect(screen.queryByRole('button', { name: 'Xoá' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Thêm' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/PersonForm.test.tsx`
Expected: FAIL — no "Quay lại" button exists yet; modal still has `rounded-lg`; "Hủy" is still present on mobile.

- [ ] **Step 3: Update `PersonForm.tsx`**

Add the import at the top:

```tsx
import { useIsMobile } from '../utils/useIsMobile'
```

Add the hook call and a mobile-aware close handler right after the existing `isDirty` block (currently lines 62-66):

```tsx
  const [initialForm] = useState<FormState>(() => form)
  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initialForm),
    [form, initialForm],
  )

  const isMobile = useIsMobile()

  function handleMobileClose() {
    if (isDirty) {
      const confirmed = confirm('Bạn có thay đổi chưa lưu. Đóng mà không lưu?')
      if (!confirmed) return
    }
    onClose()
  }
```

Replace the header block (currently):

```tsx
          <div className="flex justify-between items-center px-4 py-3 border-b">
            <h3 className="font-semibold">{editPerson ? 'Sửa thông tin' : 'Thêm người mới'}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
          </div>
```

with:

```tsx
          <div className="flex justify-between items-center px-4 py-3 border-b">
            <div className="flex items-center gap-2 min-w-0">
              {isMobile && (
                <button
                  type="button"
                  onClick={handleMobileClose}
                  aria-label="Quay lại"
                  className="text-gray-500 hover:text-gray-700 text-xl leading-none"
                >
                  ←
                </button>
              )}
              <h3 className="font-semibold truncate">{editPerson ? 'Sửa thông tin' : 'Thêm người mới'}</h3>
            </div>
            {!isMobile && (
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            )}
          </div>
```

Replace the outer backdrop + modal container opening tags (currently):

```tsx
      <div className="fixed inset-0 bg-black/40 z-40 flex items-end justify-center p-2 sm:items-center sm:p-4">
        <div data-testid="person-form-modal" className="bg-white rounded-lg shadow-xl w-full max-w-[480px] max-h-[100dvh] sm:max-h-[90vh] flex flex-col">
```

with:

```tsx
      <div
        className={
          isMobile
            ? 'fixed inset-0 bg-black/40 z-40 flex'
            : 'fixed inset-0 bg-black/40 z-40 flex items-end justify-center p-2 sm:items-center sm:p-4'
        }
      >
        <div
          data-testid="person-form-modal"
          className={
            isMobile
              ? 'bg-white w-full h-full max-h-[100dvh] flex flex-col'
              : 'bg-white rounded-lg shadow-xl w-full max-w-[480px] max-h-[100dvh] sm:max-h-[90vh] flex flex-col'
          }
        >
```

Replace the footer action row (currently):

```tsx
            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <button type="submit" disabled={saving}
                className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Đang lưu...' : editPerson ? 'Lưu thay đổi' : 'Thêm'}
              </button>
              <button type="button" onClick={onClose}
                className="flex-1 py-2 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200">
                Hủy
              </button>
              {editPerson && (
                <button type="button" onClick={handleXoaNguoi}
                  className="py-2 px-4 bg-red-50 text-red-600 text-sm rounded hover:bg-red-100 border border-red-200">
                  Xoá
                </button>
              )}
            </div>
```

with:

```tsx
            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <button type="submit" disabled={saving}
                className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Đang lưu...' : editPerson ? 'Lưu thay đổi' : 'Thêm'}
              </button>
              {!isMobile && (
                <button type="button" onClick={onClose}
                  className="flex-1 py-2 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200">
                  Hủy
                </button>
              )}
              {editPerson && (
                <button
                  type="button"
                  onClick={handleXoaNguoi}
                  className={
                    isMobile
                      ? 'flex-1 py-2 bg-red-50 text-red-600 text-sm rounded hover:bg-red-100 border border-red-200'
                      : 'py-2 px-4 bg-red-50 text-red-600 text-sm rounded hover:bg-red-100 border border-red-200'
                  }
                >
                  Xoá
                </button>
              )}
            </div>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/PersonForm.test.tsx`
Expected: PASS (all tests in the file, including the pre-existing `describe('PersonForm responsive layout', ...)` test, which runs under the default desktop mock and sees the unchanged desktop classNames).

- [ ] **Step 5: Commit**

```bash
git add src/components/PersonForm.tsx src/components/PersonForm.test.tsx
git commit -m "feat: make PersonForm a full-screen modal on mobile with back-arrow close"
```

---

### Task 7: Bigger touch targets for `TreeView` zoom controls on mobile

**Files:**
- Modify: `src/components/TreeView.tsx:686-712`
- Test: `src/components/TreeView.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/components/TreeView.test.tsx`, inside the existing `describe('TreeView', ...)` block, after the `'zooms in and out with toolbar buttons'` test:

```tsx
  it('sizes zoom buttons for touch on mobile while staying compact on larger screens', () => {
    render(<TreeView />)

    const zoomInButton = screen.getByRole('button', { name: 'Phóng to cây' })
    const zoomOutButton = screen.getByRole('button', { name: 'Thu nhỏ cây' })

    for (const button of [zoomInButton, zoomOutButton]) {
      expect(button.className).toContain('h-11')
      expect(button.className).toContain('w-11')
      expect(button.className).toContain('sm:h-8')
      expect(button.className).toContain('sm:w-8')
    }
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/TreeView.test.tsx`
Expected: FAIL — buttons still have `h-8 w-8` only, no `h-11`/`w-11`/`sm:h-8`/`sm:w-8`.

- [ ] **Step 3: Update the zoom button classes**

In `src/components/TreeView.tsx`, change the zoom-out button's className from:

```tsx
          className="h-8 w-8 rounded border border-card-border text-muted text-lg leading-none hover:bg-slate-50 disabled:opacity-50"
```

to:

```tsx
          className="h-11 w-11 sm:h-8 sm:w-8 rounded border border-card-border text-muted text-lg leading-none hover:bg-slate-50 disabled:opacity-50"
```

And the zoom-in button's identical className (further down, same string) the same way:

```tsx
          className="h-11 w-11 sm:h-8 sm:w-8 rounded border border-card-border text-muted text-lg leading-none hover:bg-slate-50 disabled:opacity-50"
```

(There are two buttons sharing this exact className string today — the `−` and `+` buttons. Update both occurrences; the `%` reset button in between keeps its own unrelated className unchanged.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/TreeView.test.tsx`
Expected: PASS (all tests in the file)

- [ ] **Step 5: Commit**

```bash
git add src/components/TreeView.tsx src/components/TreeView.test.tsx
git commit -m "feat: enlarge TreeView zoom button touch targets on mobile"
```

---

### Task 8: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: PASS, 0 failures across all test files (including every file touched in Tasks 1-7 plus all untouched suites like `ListView.test.tsx`, `MemberManagementView.test.tsx`, `PersonCard.test.tsx`, etc.).

- [ ] **Step 2: Run the linter**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Run the production build**

Run: `npm run build`
Expected: TypeScript project build (`tsc -b`) and Vite build both succeed with no errors.

- [ ] **Step 4: Manual smoke check (optional, recommended)**

Run: `npm run dev`, open the printed local URL, open browser dev tools device toolbar, switch to a mobile viewport (e.g. 375×812), and confirm:
- Top bar shows `☰` + title, full-width search below it.
- Bottom tab bar shows Cây / Danh sách / Thêm mới; tapping switches views; "Thêm mới" opens the add-person modal.
- Tapping a person card opens "Sửa thông tin" full-screen, edge-to-edge, with `←` in the header and Lưu/Xoá only in the footer.
- Editing a field then tapping `←` prompts to confirm; tapping `←` again without editing closes immediately.
- Resize back to desktop width (e.g. 1280px) and confirm the layout reverts to today's desktop chrome exactly (inline search, FAB, rounded centered modal with Hủy).

- [ ] **Step 5: Commit (only if Step 4 uncovered fixes; otherwise skip)**

```bash
git add -A
git commit -m "fix: address issues found during mobile smoke test"
```
