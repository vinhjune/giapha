# Gia Phả App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Vietnamese family genealogy SPA (React 18 + TypeScript) hosted on GitHub Pages, storing data as `giapha/giapha.json` on the family head's Google Drive, with Google OAuth2 auth, tree + list views, full CRUD, search, and role-based access (admin/editor/viewer/public).

**Architecture:** Static SPA on GitHub Pages, zero server. All data in one JSON file on Google Drive (accessed via Google Drive API v3). Auth via Google Identity Services (OAuth2 PKCE). File ID injected at build time via GitHub Actions secret.

**Tech Stack:** Vite 5, React 18, TypeScript 5, Tailwind CSS 3, Zustand 4, React Router 6, relatives-tree (tree layout calc), @react-oauth/google (OAuth wrapper), Vitest + Testing Library

---

## File Structure

```
src/
  types/
    giapha.ts          # All TypeScript types (Person, Metadata, GiaphaData, roles)
  services/
    googleAuth.ts      # OAuth2 login/logout, token mgmt, scope per role
    googleDrive.ts     # Read/write/create giapha.json on Drive
  store/
    useGiaphaStore.ts  # Zustand global store
  utils/
    familyTree.ts      # Tree logic: auto-fill parent, sibling order, female-lineage rule
    conflict.ts        # Soft lock check, phienBan conflict detection
    search.ts          # Search persons by name (client-side)
    id.ts              # Generate unique person IDs
  components/
    Navbar.tsx         # Top bar: title, search input, save btn, user avatar
    SearchBar.tsx      # Debounced search input + results dropdown
    SearchResults.tsx  # Result list overlay, click → focus
    PersonCard.tsx     # Single person node rendered in tree
    PersonDetail.tsx   # Side panel: shows full info for selected person
    PersonPicker.tsx   # Modal to search + select an existing person by name
    PersonForm.tsx     # Modal: add/edit person, auto-fill parent logic
    ListView.tsx       # Hierarchical list view with indent + color coding
    TreeView.tsx       # relatives-tree calcTree + custom SVG/HTML renderer
    PermissionManager.tsx  # Admin: manage viewer/editor email list
    ConflictBanner.tsx # Banner shown when soft lock / version conflict detected
    AuthGate.tsx       # Wrapper: require login or show public view
    AdminSetup.tsx     # First-run: create Drive folder+file, display File ID
  pages/
    HomePage.tsx       # Main page: Navbar + TreeView/ListView switcher
    LoginPage.tsx      # OAuth login buttons
  App.tsx              # Router setup, auth state bootstrap
  main.tsx             # Vite entry point
  vite-env.d.ts        # VITE_GIAPHA_FILE_ID type declaration
.github/
  workflows/
    deploy.yml         # Build + deploy to GitHub Pages with secrets
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/vite-env.d.ts`

- [ ] **Step 1: Init Vite project**

```bash
cd /Users/vj/workspace/giapha
npm create vite@latest . -- --template react-ts --force
npm install
```

- [ ] **Step 2: Install dependencies**

```bash
npm install tailwindcss@3 postcss autoprefixer zustand react-router-dom @react-oauth/google relatives-tree
npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
npx tailwindcss init -p
```

- [ ] **Step 3: Configure Tailwind**

Edit `tailwind.config.ts`:
```ts
import type { Config } from 'tailwindcss'
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
} satisfies Config
```

Edit `src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 4: Configure Vite**

`vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/giapha/',
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
  },
})
```

Create `src/test-setup.ts`:
```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Add VITE_GIAPHA_FILE_ID type**

`src/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_GIAPHA_FILE_ID: string
  readonly VITE_GOOGLE_CLIENT_ID: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

- [ ] **Step 6: Minimal App.tsx**

`src/App.tsx`:
```tsx
export default function App() {
  return <div className="min-h-screen bg-gray-50">Gia Phả</div>
}
```

`src/main.tsx`:
```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename="/giapha">
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
```

- [ ] **Step 7: Verify build runs**

```bash
npm run build
```
Expected: `dist/` created, no errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: scaffold Vite + React + TS + Tailwind project"
```

---

### Task 2: TypeScript Types

**Files:**
- Create: `src/types/giapha.ts`
- Create: `src/utils/id.ts`

- [ ] **Step 1: Write types**

`src/types/giapha.ts`:
```ts
export type Role = 'admin' | 'editor' | 'viewer'

export type GioiTinh = 'nam' | 'nu' | 'khac'

export interface NgayThang {
  nam?: number      // year
  thang?: number    // month
  ngay?: number     // day
  amLich?: boolean  // true = lunar calendar
}

export interface HonNhan {
  voChongId: string
  batDau?: NgayThang
  ketThuc?: NgayThang
  ghiChu?: string
}

export interface Person {
  id: string
  hoTen: string                // Full name
  gioiTinh: GioiTinh
  namSinh?: NgayThang
  namMat?: NgayThang
  queQuan?: string             // Hometown
  tieuSu?: string              // Biography
  anhDaiDien?: string          // Avatar URL or base64
  laThanhVienHo: boolean       // false for women who marry out
  thuTuAnhChi?: number         // Sibling order (1-based)
  boId?: string                // Father ID
  meId?: string                // Mother ID
  honNhan: HonNhan[]           // Marriages (ordered)
  conCaiIds: string[]          // Children IDs (for this person as parent)
  ghiChu?: string
}

export interface NguoiDung {
  email: string
  role: Role
}

export interface SoftLock {
  email: string
  hoTen: string
  thoiGian: string             // ISO timestamp
}

export interface Metadata {
  tenDongHo: string            // Clan name
  moTa?: string
  ngayTao: string              // ISO
  nguoiTao: string             // email of admin
  phienBan: number             // increments on each save (conflict detection)
  cheDoCong: boolean           // true = public read
  danhSachNguoiDung: NguoiDung[]
  dangChinhSua?: SoftLock      // soft lock
}

export interface GiaphaData {
  metadata: Metadata
  persons: Record<string, Person>  // id → Person map
}
```

- [ ] **Step 2: Write ID utility**

`src/utils/id.ts`:
```ts
export function taoId(): string {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}
```

- [ ] **Step 3: Write test**

`src/utils/id.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { taoId } from './id'

describe('taoId', () => {
  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, taoId))
    expect(ids.size).toBe(100)
  })

  it('starts with p_', () => {
    expect(taoId()).toMatch(/^p_/)
  })
})
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/utils/id.test.ts
```
Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/types/giapha.ts src/utils/id.ts src/utils/id.test.ts
git commit -m "feat: add TypeScript types and ID utility"
```

---

### Task 3: Family Tree Utils

**Files:**
- Create: `src/utils/familyTree.ts`
- Create: `src/utils/familyTree.test.ts`

- [ ] **Step 1: Write tests first**

`src/utils/familyTree.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import type { GiaphaData, Person } from '../types/giapha'
import {
  timVoChong,
  tuDongDienMe,
  tuDongDienBo,
  sapXepAnhChiEm,
  laThanhVienThuocHo,
} from './familyTree'

const nguoiMau = (ghi: Partial<Person>): Person => ({
  id: 'x',
  hoTen: 'Test',
  gioiTinh: 'nam',
  laThanhVienHo: true,
  honNhan: [],
  conCaiIds: [],
  ...ghi,
})

describe('timVoChong', () => {
  it('returns spouse IDs of a person', () => {
    const data: GiaphaData = {
      metadata: {} as any,
      persons: {
        bo: nguoiMau({ id: 'bo', gioiTinh: 'nam', honNhan: [{ voChongId: 'me' }] }),
        me: nguoiMau({ id: 'me', gioiTinh: 'nu' }),
      },
    }
    expect(timVoChong('bo', data)).toEqual(['me'])
  })
})

describe('tuDongDienMe', () => {
  it('returns mother ID when father has exactly one wife', () => {
    const data: GiaphaData = {
      metadata: {} as any,
      persons: {
        bo: nguoiMau({ id: 'bo', honNhan: [{ voChongId: 'me' }] }),
        me: nguoiMau({ id: 'me' }),
      },
    }
    expect(tuDongDienMe('bo', data)).toBe('me')
  })

  it('returns null when father has multiple wives', () => {
    const data: GiaphaData = {
      metadata: {} as any,
      persons: {
        bo: nguoiMau({ id: 'bo', honNhan: [{ voChongId: 'me1' }, { voChongId: 'me2' }] }),
        me1: nguoiMau({ id: 'me1' }),
        me2: nguoiMau({ id: 'me2' }),
      },
    }
    expect(tuDongDienMe('bo', data)).toBeNull()
  })
})

describe('sapXepAnhChiEm', () => {
  it('sorts siblings by thuTuAnhChi ascending, undeclared last', () => {
    const a = nguoiMau({ id: 'a', thuTuAnhChi: 2 })
    const b = nguoiMau({ id: 'b', thuTuAnhChi: 1 })
    const c = nguoiMau({ id: 'c' }) // no order
    expect(sapXepAnhChiEm([a, b, c]).map(p => p.id)).toEqual(['b', 'a', 'c'])
  })
})

describe('laThanhVienThuocHo', () => {
  it('male is always clan member', () => {
    expect(laThanhVienThuocHo(nguoiMau({ gioiTinh: 'nam' }))).toBe(true)
  })

  it('female with laThanhVienHo false is not clan member', () => {
    expect(laThanhVienThuocHo(nguoiMau({ gioiTinh: 'nu', laThanhVienHo: false }))).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/utils/familyTree.test.ts
```
Expected: FAIL (module not found).

- [ ] **Step 3: Implement familyTree.ts**

`src/utils/familyTree.ts`:
```ts
import type { GiaphaData, Person } from '../types/giapha'

export function timVoChong(personId: string, data: GiaphaData): string[] {
  const person = data.persons[personId]
  if (!person) return []
  return person.honNhan.map(h => h.voChongId)
}

/**
 * Given a fatherId, if father has exactly one wife, return her ID.
 * If multiple wives, return null (caller must show dropdown).
 */
export function tuDongDienMe(boId: string, data: GiaphaData): string | null {
  const bo = data.persons[boId]
  if (!bo) return null
  if (bo.honNhan.length === 1) return bo.honNhan[0].voChongId
  return null
}

/**
 * Given a motherId, if mother has exactly one husband, return his ID.
 */
export function tuDongDienBo(meId: string, data: GiaphaData): string | null {
  const me = data.persons[meId]
  if (!me) return null
  if (me.honNhan.length === 1) return me.honNhan[0].voChongId
  return null
}

export function sapXepAnhChiEm(persons: Person[]): Person[] {
  return [...persons].sort((a, b) => {
    if (a.thuTuAnhChi == null && b.thuTuAnhChi == null) return 0
    if (a.thuTuAnhChi == null) return 1
    if (b.thuTuAnhChi == null) return -1
    return a.thuTuAnhChi - b.thuTuAnhChi
  })
}

export function laThanhVienThuocHo(person: Person): boolean {
  if (person.gioiTinh === 'nu' && !person.laThanhVienHo) return false
  return true
}

/** Get all children of a person */
export function layConCai(personId: string, data: GiaphaData): Person[] {
  const person = data.persons[personId]
  if (!person) return []
  return person.conCaiIds.map(id => data.persons[id]).filter(Boolean) as Person[]
}

/** Get both parents of a person */
export function layBoCMe(person: Person, data: GiaphaData): { bo?: Person; me?: Person } {
  return {
    bo: person.boId ? data.persons[person.boId] : undefined,
    me: person.meId ? data.persons[person.meId] : undefined,
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/utils/familyTree.test.ts
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/familyTree.ts src/utils/familyTree.test.ts
git commit -m "feat: add family tree utility functions"
```

---

### Task 4: Search Utility

**Files:**
- Create: `src/utils/search.ts`
- Create: `src/utils/search.test.ts`

- [ ] **Step 1: Write test**

`src/utils/search.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { timKiemTheoTen } from './search'
import type { GiaphaData, Person } from '../types/giapha'

const p = (id: string, hoTen: string): Person => ({
  id, hoTen, gioiTinh: 'nam', laThanhVienHo: true, honNhan: [], conCaiIds: [],
})

const data: GiaphaData = {
  metadata: {} as any,
  persons: {
    p1: p('p1', 'Nguyễn Văn An'),
    p2: p('p2', 'Nguyễn Thị Bình'),
    p3: p('p3', 'Trần Văn An'),
  },
}

describe('timKiemTheoTen', () => {
  it('returns all persons matching name (case insensitive, accent insensitive)', () => {
    const results = timKiemTheoTen('an', data)
    expect(results.map(p => p.id)).toContain('p1')
    expect(results.map(p => p.id)).toContain('p3')
    expect(results.map(p => p.id)).not.toContain('p2')
  })

  it('returns empty array for no match', () => {
    expect(timKiemTheoTen('xyz', data)).toHaveLength(0)
  })

  it('matches Vietnamese accented characters', () => {
    const results = timKiemTheoTen('binh', data)
    expect(results.map(p => p.id)).toContain('p2')
  })
})
```

- [ ] **Step 2: Implement**

`src/utils/search.ts`:
```ts
import type { GiaphaData, Person } from '../types/giapha'

function chuanHoa(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function timKiemTheoTen(tuKhoa: string, data: GiaphaData): Person[] {
  if (!tuKhoa.trim()) return []
  const normalized = chuanHoa(tuKhoa)
  return Object.values(data.persons).filter(p =>
    chuanHoa(p.hoTen).includes(normalized)
  )
}
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run src/utils/search.test.ts
```
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/utils/search.ts src/utils/search.test.ts
git commit -m "feat: add name search utility with accent normalization"
```

---

### Task 5: Conflict Utility

**Files:**
- Create: `src/utils/conflict.ts`
- Create: `src/utils/conflict.test.ts`

- [ ] **Step 1: Write test**

`src/utils/conflict.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { kiemTraSoftLock, softLockHetHan, SOFT_LOCK_MINUTES } from './conflict'
import type { SoftLock } from '../types/giapha'

describe('softLockHetHan', () => {
  it('returns true if lock is older than SOFT_LOCK_MINUTES', () => {
    const old = new Date(Date.now() - (SOFT_LOCK_MINUTES + 1) * 60_000).toISOString()
    const lock: SoftLock = { email: 'a@b.com', hoTen: 'A', thoiGian: old }
    expect(softLockHetHan(lock)).toBe(true)
  })

  it('returns false if lock is recent', () => {
    const recent = new Date().toISOString()
    const lock: SoftLock = { email: 'a@b.com', hoTen: 'A', thoiGian: recent }
    expect(softLockHetHan(lock)).toBe(false)
  })
})

describe('kiemTraSoftLock', () => {
  it('returns null if no lock present', () => {
    expect(kiemTraSoftLock(undefined, 'me@me.com')).toBeNull()
  })

  it('returns null if current user holds the lock', () => {
    const lock: SoftLock = { email: 'me@me.com', hoTen: 'Me', thoiGian: new Date().toISOString() }
    expect(kiemTraSoftLock(lock, 'me@me.com')).toBeNull()
  })

  it('returns lock if another user holds it and it is not expired', () => {
    const lock: SoftLock = { email: 'other@me.com', hoTen: 'Other', thoiGian: new Date().toISOString() }
    expect(kiemTraSoftLock(lock, 'me@me.com')).toBe(lock)
  })
})
```

- [ ] **Step 2: Implement**

`src/utils/conflict.ts`:
```ts
import type { SoftLock } from '../types/giapha'

export const SOFT_LOCK_MINUTES = 10

export function softLockHetHan(lock: SoftLock): boolean {
  const lockTime = new Date(lock.thoiGian).getTime()
  return Date.now() - lockTime > SOFT_LOCK_MINUTES * 60_000
}

export function kiemTraSoftLock(lock: SoftLock | undefined, currentEmail: string): SoftLock | null {
  if (!lock) return null
  if (lock.email === currentEmail) return null
  if (softLockHetHan(lock)) return null
  return lock
}

export function taoSoftLock(email: string, hoTen: string): SoftLock {
  return { email, hoTen, thoiGian: new Date().toISOString() }
}
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run src/utils/conflict.test.ts
```
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/utils/conflict.ts src/utils/conflict.test.ts
git commit -m "feat: add soft lock and conflict detection utilities"
```

---

### Task 6: Google Auth Service

**Files:**
- Create: `src/services/googleAuth.ts`

- [ ] **Step 1: Implement**

`src/services/googleAuth.ts`:
```ts
// Google Identity Services (GIS) token flow
// Docs: https://developers.google.com/identity/oauth2/web/guides/use-token-model

declare const google: any

export const SCOPE_DRIVE = 'https://www.googleapis.com/auth/drive'
export const SCOPE_DRIVE_READONLY = 'https://www.googleapis.com/auth/drive.readonly'

export interface AuthToken {
  access_token: string
  expires_in: number
  expiresAt: number  // Date.now() + expires_in * 1000
}

let tokenClient: any = null
let currentToken: AuthToken | null = null

export function khoiTaoAuth(clientId: string, scope: string, callback: (token: AuthToken | null) => void) {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope,
    callback: (response: any) => {
      if (response.error) {
        callback(null)
        return
      }
      currentToken = {
        access_token: response.access_token,
        expires_in: response.expires_in,
        expiresAt: Date.now() + response.expires_in * 1000,
      }
      callback(currentToken)
    },
  })
}

export function dangNhap() {
  if (!tokenClient) throw new Error('Auth chưa được khởi tạo')
  tokenClient.requestAccessToken({ prompt: '' })
}

export function dangXuat() {
  if (currentToken) {
    google.accounts.oauth2.revoke(currentToken.access_token, () => {})
    currentToken = null
  }
}

export function layToken(): AuthToken | null {
  return currentToken
}

export function tokenConHan(): boolean {
  if (!currentToken) return false
  return Date.now() < currentToken.expiresAt - 60_000  // 1 min buffer
}

export function layAccessToken(): string | null {
  if (!tokenConHan()) return null
  return currentToken!.access_token
}
```

- [ ] **Step 2: Add Google Identity script to index.html**

`index.html` — add inside `<head>`:
```html
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

- [ ] **Step 3: Commit**

```bash
git add src/services/googleAuth.ts index.html
git commit -m "feat: add Google OAuth2 auth service"
```

---

### Task 7: Google Drive Service

**Files:**
- Create: `src/services/googleDrive.ts`

- [ ] **Step 1: Implement**

`src/services/googleDrive.ts`:
```ts
import type { GiaphaData } from '../types/giapha'
import { layAccessToken } from './googleAuth'

const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'
const FOLDER_NAME = 'giapha'
const FILE_NAME = 'giapha.json'

function headers(): HeadersInit {
  const token = layAccessToken()
  if (!token) throw new Error('Chưa đăng nhập')
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

/** Read the giapha.json file using its file ID */
export async function docFile(fileId: string): Promise<GiaphaData> {
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${layAccessToken()}` },
  })
  if (!res.ok) throw new Error(`Không đọc được file: ${res.status}`)
  return res.json()
}

/** Read file without auth (public mode via API key) */
export async function docFileCong(fileId: string, apiKey: string): Promise<GiaphaData> {
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media&key=${apiKey}`)
  if (!res.ok) throw new Error(`Không đọc được file công khai: ${res.status}`)
  return res.json()
}

/** Write (update) existing file */
export async function ghiFile(fileId: string, data: GiaphaData): Promise<void> {
  const body = JSON.stringify(data)
  const res = await fetch(`${UPLOAD_API}/files/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${layAccessToken()}`, 'Content-Type': 'application/json' },
    body,
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Lưu thất bại: ${err}`)
  }
}

/** Find or create the 'giapha' folder, then create giapha.json inside it. Returns file ID. */
export async function khoiTaoFile(): Promise<string> {
  const token = layAccessToken()
  if (!token) throw new Error('Chưa đăng nhập')
  const authHeader = { Authorization: `Bearer ${token}` }

  // Find existing folder
  const folderSearch = await fetch(
    `${DRIVE_API}/files?q=name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id)`,
    { headers: authHeader }
  )
  const { files: folders } = await folderSearch.json()
  let folderId: string

  if (folders.length > 0) {
    folderId = folders[0].id
  } else {
    // Create folder
    const createFolder = await fetch(`${DRIVE_API}/files`, {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
    })
    const folder = await createFolder.json()
    folderId = folder.id
  }

  // Create giapha.json in the folder
  const meta = { name: FILE_NAME, parents: [folderId] }
  const initData: GiaphaData = {
    metadata: {
      tenDongHo: 'Gia Phả',
      ngayTao: new Date().toISOString(),
      nguoiTao: '',
      phienBan: 1,
      cheDoCong: false,
      danhSachNguoiDung: [],
    },
    persons: {},
  }
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }))
  form.append('file', new Blob([JSON.stringify(initData)], { type: 'application/json' }))

  const createRes = await fetch(`${UPLOAD_API}/files?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: authHeader,
    body: form,
  })
  const { id } = await createRes.json()
  return id
}

/** Share file publicly (anyone with link can view) */
export async function chiaSeCong(fileId: string): Promise<void> {
  await fetch(`${DRIVE_API}/files/${fileId}/permissions`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  })
}

/** Remove public sharing */
export async function xoaChiaSeCong(fileId: string): Promise<void> {
  // Get permission ID first
  const res = await fetch(`${DRIVE_API}/files/${fileId}/permissions?fields=permissions(id,type)`, {
    headers: { Authorization: `Bearer ${layAccessToken()}` },
  })
  const { permissions } = await res.json()
  const anyonePerm = permissions.find((p: any) => p.type === 'anyone')
  if (!anyonePerm) return
  await fetch(`${DRIVE_API}/files/${fileId}/permissions/${anyonePerm.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${layAccessToken()}` },
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/googleDrive.ts
git commit -m "feat: add Google Drive service (read/write/create/share)"
```

---

### Task 8: Zustand Store

**Files:**
- Create: `src/store/useGiaphaStore.ts`

- [ ] **Step 1: Implement**

`src/store/useGiaphaStore.ts`:
```ts
import { create } from 'zustand'
import type { GiaphaData, Person, NguoiDung, Role } from '../types/giapha'
import { taoId } from '../utils/id'
import { taoSoftLock } from '../utils/conflict'

export type ViewMode = 'tree' | 'list'

interface GiaphaState {
  data: GiaphaData | null
  fileId: string | null
  currentUserEmail: string | null
  currentRole: Role | 'public'
  viewMode: ViewMode
  selectedPersonId: string | null
  isDirty: boolean
  isSaving: boolean
  conflictDetected: boolean

  // Actions
  setData: (data: GiaphaData) => void
  setFileId: (id: string) => void
  setUser: (email: string, role: Role | 'public') => void
  setViewMode: (mode: ViewMode) => void
  selectPerson: (id: string | null) => void

  themNguoi: (person: Omit<Person, 'id'>) => string
  suaNguoi: (id: string, updates: Partial<Person>) => void
  xoaNguoi: (id: string) => void

  setIsSaving: (v: boolean) => void
  setConflictDetected: (v: boolean) => void
  markSaved: () => void

  acquireSoftLock: () => void
  releaseSoftLock: () => void
}

export const useGiaphaStore = create<GiaphaState>((set, get) => ({
  data: null,
  fileId: import.meta.env.VITE_GIAPHA_FILE_ID || null,
  currentUserEmail: null,
  currentRole: 'public',
  viewMode: 'tree',
  selectedPersonId: null,
  isDirty: false,
  isSaving: false,
  conflictDetected: false,

  setData: (data) => set({ data, isDirty: false }),
  setFileId: (id) => set({ fileId: id }),
  setUser: (email, role) => set({ currentUserEmail: email, currentRole: role }),
  setViewMode: (mode) => set({ viewMode: mode }),
  selectPerson: (id) => set({ selectedPersonId: id }),

  themNguoi: (personData) => {
    const id = taoId()
    const person: Person = { id, ...personData }
    set(state => {
      if (!state.data) return {}
      return {
        data: {
          ...state.data,
          persons: { ...state.data.persons, [id]: person },
        },
        isDirty: true,
      }
    })
    return id
  },

  suaNguoi: (id, updates) => {
    set(state => {
      if (!state.data) return {}
      const existing = state.data.persons[id]
      if (!existing) return {}
      return {
        data: {
          ...state.data,
          persons: { ...state.data.persons, [id]: { ...existing, ...updates } },
        },
        isDirty: true,
      }
    })
  },

  xoaNguoi: (id) => {
    set(state => {
      if (!state.data) return {}
      const persons = { ...state.data.persons }
      delete persons[id]
      // Clean up references
      Object.values(persons).forEach(p => {
        if (p.boId === id) p.boId = undefined
        if (p.meId === id) p.meId = undefined
        p.conCaiIds = p.conCaiIds.filter(c => c !== id)
        p.honNhan = p.honNhan.filter(h => h.voChongId !== id)
      })
      return { data: { ...state.data, persons }, isDirty: true }
    })
  },

  setIsSaving: (v) => set({ isSaving: v }),
  setConflictDetected: (v) => set({ conflictDetected: v }),
  markSaved: () => set(state => ({
    isDirty: false,
    data: state.data
      ? { ...state.data, metadata: { ...state.data.metadata, phienBan: state.data.metadata.phienBan + 1 } }
      : null,
  })),

  acquireSoftLock: () => {
    const { data, currentUserEmail } = get()
    if (!data || !currentUserEmail) return
    // Find display name from user list
    const user = data.metadata.danhSachNguoiDung.find(u => u.email === currentUserEmail)
    const hoTen = user ? currentUserEmail : currentUserEmail
    set(state => ({
      data: state.data ? {
        ...state.data,
        metadata: { ...state.data.metadata, dangChinhSua: taoSoftLock(currentUserEmail, hoTen) },
      } : null,
    }))
  },

  releaseSoftLock: () => {
    set(state => ({
      data: state.data ? {
        ...state.data,
        metadata: { ...state.data.metadata, dangChinhSua: undefined },
      } : null,
    }))
  },
}))
```

- [ ] **Step 2: Commit**

```bash
git add src/store/useGiaphaStore.ts
git commit -m "feat: add Zustand store with CRUD actions and soft lock"
```

---

### Task 9: Navbar + SearchBar Components

**Files:**
- Create: `src/components/Navbar.tsx`
- Create: `src/components/SearchBar.tsx`
- Create: `src/components/SearchResults.tsx`

- [ ] **Step 1: Implement SearchBar**

`src/components/SearchBar.tsx`:
```tsx
import { useState, useCallback, useRef, useEffect } from 'react'
import { timKiemTheoTen } from '../utils/search'
import { useGiaphaStore } from '../store/useGiaphaStore'
import SearchResults from './SearchResults'
import type { Person } from '../types/giapha'

export default function SearchBar() {
  const data = useGiaphaStore(s => s.data)
  const selectPerson = useGiaphaStore(s => s.selectPerson)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Person[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    if (!data || !val.trim()) { setResults([]); setOpen(false); return }
    const found = timKiemTheoTen(val, data)
    setResults(found)
    if (found.length === 1) {
      selectPerson(found[0].id)
      setQuery('')
      setOpen(false)
    } else {
      setOpen(found.length > 0)
    }
  }, [data, selectPerson])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative w-64">
      <input
        type="text"
        value={query}
        onChange={handleChange}
        placeholder="Tìm kiếm theo tên..."
        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      {open && <SearchResults results={results} onSelect={id => { selectPerson(id); setQuery(''); setOpen(false) }} />}
    </div>
  )
}
```

- [ ] **Step 2: Implement SearchResults**

`src/components/SearchResults.tsx`:
```tsx
import type { Person } from '../types/giapha'

interface Props {
  results: Person[]
  onSelect: (id: string) => void
}

export default function SearchResults({ results, onSelect }: Props) {
  return (
    <ul className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
      {results.map(p => (
        <li
          key={p.id}
          className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm"
          onClick={() => onSelect(p.id)}
        >
          <span className="font-medium">{p.hoTen}</span>
          {p.namSinh?.nam && <span className="text-gray-400 ml-2">({p.namSinh.nam})</span>}
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 3: Implement Navbar**

`src/components/Navbar.tsx`:
```tsx
import { useGiaphaStore } from '../store/useGiaphaStore'
import SearchBar from './SearchBar'
import { ghiFile } from '../services/googleDrive'

export default function Navbar() {
  const { data, fileId, isDirty, isSaving, currentRole, currentUserEmail, viewMode, setViewMode, setIsSaving, markSaved, setConflictDetected } = useGiaphaStore()

  async function handleSave() {
    if (!data || !fileId) return
    setIsSaving(true)
    try {
      await ghiFile(fileId, data)
      markSaved()
    } catch (e: any) {
      if (e.message.includes('412') || e.message.includes('conflict')) {
        setConflictDetected(true)
      } else {
        alert('Lưu thất bại: ' + e.message)
      }
    } finally {
      setIsSaving(false)
    }
  }

  const canEdit = currentRole === 'admin' || currentRole === 'editor'

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-4">
      <h1 className="text-lg font-bold text-red-700 mr-4">
        {data?.metadata.tenDongHo || 'Gia Phả'}
      </h1>

      <div className="flex gap-1 bg-gray-100 rounded-md p-0.5">
        <button
          onClick={() => setViewMode('tree')}
          className={`px-3 py-1 text-sm rounded ${viewMode === 'tree' ? 'bg-white shadow text-blue-600 font-medium' : 'text-gray-600'}`}
        >
          Cây
        </button>
        <button
          onClick={() => setViewMode('list')}
          className={`px-3 py-1 text-sm rounded ${viewMode === 'list' ? 'bg-white shadow text-blue-600 font-medium' : 'text-gray-600'}`}
        >
          Danh sách
        </button>
      </div>

      <SearchBar />

      <div className="ml-auto flex items-center gap-3">
        {canEdit && isDirty && (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? 'Đang lưu...' : 'Lưu'}
          </button>
        )}
        {currentUserEmail && (
          <span className="text-sm text-gray-600">{currentUserEmail}</span>
        )}
      </div>
    </nav>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/Navbar.tsx src/components/SearchBar.tsx src/components/SearchResults.tsx
git commit -m "feat: add Navbar, SearchBar, SearchResults components"
```

---

### Task 10: PersonDetail Panel

**Files:**
- Create: `src/components/PersonDetail.tsx`

- [ ] **Step 1: Implement**

`src/components/PersonDetail.tsx`:
```tsx
import { useGiaphaStore } from '../store/useGiaphaStore'
import type { Person } from '../types/giapha'

function formatNgay(d?: { nam?: number; thang?: number; ngay?: number }) {
  if (!d) return '—'
  const parts = []
  if (d.ngay) parts.push(d.ngay)
  if (d.thang) parts.push(d.thang)
  if (d.nam) parts.push(d.nam)
  return parts.join('/') || '—'
}

interface Props {
  onEdit: (person: Person) => void
}

export default function PersonDetail({ onEdit }: Props) {
  const { data, selectedPersonId, currentRole, selectPerson, xoaNguoi } = useGiaphaStore()
  if (!selectedPersonId || !data) return null
  const person = data.persons[selectedPersonId]
  if (!person) return null

  const canEdit = currentRole === 'admin' || currentRole === 'editor'

  const bo = person.boId ? data.persons[person.boId] : null
  const me = person.meId ? data.persons[person.meId] : null
  const voChong = person.honNhan.map(h => data.persons[h.voChongId]).filter(Boolean)
  const conCai = person.conCaiIds.map(id => data.persons[id]).filter(Boolean)

  function handleDelete() {
    if (!confirm(`Xóa ${person.hoTen}?`)) return
    xoaNguoi(selectedPersonId)
    selectPerson(null)
  }

  return (
    <aside className="w-80 bg-white border-l border-gray-200 p-4 overflow-y-auto">
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-lg font-bold text-gray-800">{person.hoTen}</h2>
        <button onClick={() => selectPerson(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
      </div>

      <dl className="space-y-2 text-sm">
        <div className="flex gap-2">
          <dt className="text-gray-500 w-24">Giới tính:</dt>
          <dd>{person.gioiTinh === 'nam' ? 'Nam' : person.gioiTinh === 'nu' ? 'Nữ' : 'Khác'}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-gray-500 w-24">Năm sinh:</dt>
          <dd>{formatNgay(person.namSinh)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-gray-500 w-24">Năm mất:</dt>
          <dd>{formatNgay(person.namMat)}</dd>
        </div>
        {person.queQuan && (
          <div className="flex gap-2">
            <dt className="text-gray-500 w-24">Quê quán:</dt>
            <dd>{person.queQuan}</dd>
          </div>
        )}
        {bo && (
          <div className="flex gap-2">
            <dt className="text-gray-500 w-24">Bố:</dt>
            <dd><button className="text-blue-600 hover:underline" onClick={() => selectPerson(bo.id)}>{bo.hoTen}</button></dd>
          </div>
        )}
        {me && (
          <div className="flex gap-2">
            <dt className="text-gray-500 w-24">Mẹ:</dt>
            <dd><button className="text-blue-600 hover:underline" onClick={() => selectPerson(me.id)}>{me.hoTen}</button></dd>
          </div>
        )}
        {voChong.length > 0 && (
          <div className="flex gap-2">
            <dt className="text-gray-500 w-24">Vợ/Chồng:</dt>
            <dd className="flex flex-col gap-0.5">
              {voChong.map(v => (
                <button key={v!.id} className="text-blue-600 hover:underline text-left" onClick={() => selectPerson(v!.id)}>{v!.hoTen}</button>
              ))}
            </dd>
          </div>
        )}
        {conCai.length > 0 && (
          <div className="flex gap-2">
            <dt className="text-gray-500 w-24">Con cái:</dt>
            <dd className="flex flex-col gap-0.5">
              {conCai.map(c => (
                <button key={c!.id} className="text-blue-600 hover:underline text-left" onClick={() => selectPerson(c!.id)}>{c!.hoTen}</button>
              ))}
            </dd>
          </div>
        )}
        {person.tieuSu && (
          <div>
            <dt className="text-gray-500 mb-1">Tiểu sử:</dt>
            <dd className="text-gray-700 whitespace-pre-wrap">{person.tieuSu}</dd>
          </div>
        )}
      </dl>

      {canEdit && (
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => onEdit(person)}
            className="flex-1 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          >
            Sửa
          </button>
          <button
            onClick={handleDelete}
            className="flex-1 py-1.5 bg-red-50 text-red-600 text-sm rounded border border-red-200 hover:bg-red-100"
          >
            Xóa
          </button>
        </div>
      )}
    </aside>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/PersonDetail.tsx
git commit -m "feat: add PersonDetail side panel"
```

---

### Task 11: PersonPicker Modal

**Files:**
- Create: `src/components/PersonPicker.tsx`

- [ ] **Step 1: Implement**

`src/components/PersonPicker.tsx`:
```tsx
import { useState, useMemo } from 'react'
import { timKiemTheoTen } from '../utils/search'
import { useGiaphaStore } from '../store/useGiaphaStore'
import type { Person } from '../types/giapha'

interface Props {
  title: string
  excludeIds?: string[]
  onSelect: (person: Person) => void
  onClose: () => void
}

export default function PersonPicker({ title, excludeIds = [], onSelect, onClose }: Props) {
  const data = useGiaphaStore(s => s.data)
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    if (!data) return []
    const all = Object.values(data.persons).filter(p => !excludeIds.includes(p.id))
    if (!query.trim()) return all.slice(0, 20)
    return timKiemTheoTen(query, { ...data, persons: Object.fromEntries(all.map(p => [p.id, p])) })
  }, [data, query, excludeIds])

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-96 max-h-[70vh] flex flex-col">
        <div className="flex justify-between items-center px-4 py-3 border-b">
          <h3 className="font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div className="px-4 py-2 border-b">
          <input
            autoFocus
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Tìm theo tên..."
            className="w-full px-3 py-1.5 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <ul className="overflow-y-auto flex-1">
          {results.map(p => (
            <li
              key={p.id}
              onClick={() => onSelect(p)}
              className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-50"
            >
              <div className="font-medium">{p.hoTen}</div>
              <div className="text-gray-400 text-xs">
                {p.gioiTinh === 'nam' ? 'Nam' : p.gioiTinh === 'nu' ? 'Nữ' : 'Khác'}
                {p.namSinh?.nam ? ` · ${p.namSinh.nam}` : ''}
              </div>
            </li>
          ))}
          {results.length === 0 && (
            <li className="px-4 py-4 text-sm text-gray-400 text-center">Không tìm thấy</li>
          )}
        </ul>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/PersonPicker.tsx
git commit -m "feat: add PersonPicker modal with search"
```

---

### Task 12: PersonForm Modal

**Files:**
- Create: `src/components/PersonForm.tsx`

- [ ] **Step 1: Write test for auto-fill logic integration**

`src/components/PersonForm.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { tuDongDienMe, tuDongDienBo } from '../utils/familyTree'
import type { GiaphaData } from '../types/giapha'

// Test that auto-fill selects correct spouse
const data: GiaphaData = {
  metadata: {} as any,
  persons: {
    bo1: { id: 'bo1', hoTen: 'Bố', gioiTinh: 'nam', laThanhVienHo: true, honNhan: [{ voChongId: 'me1' }], conCaiIds: [] },
    me1: { id: 'me1', hoTen: 'Mẹ', gioiTinh: 'nu', laThanhVienHo: false, honNhan: [{ voChongId: 'bo1' }], conCaiIds: [] },
  },
}

describe('PersonForm auto-fill', () => {
  it('selecting father with one wife auto-fills mother', () => {
    expect(tuDongDienMe('bo1', data)).toBe('me1')
  })

  it('selecting mother with one husband auto-fills father', () => {
    expect(tuDongDienBo('me1', data)).toBe('bo1')
  })
})
```

- [ ] **Step 2: Run test**

```bash
npx vitest run src/components/PersonForm.test.tsx
```
Expected: pass (uses already-implemented utils).

- [ ] **Step 3: Implement PersonForm**

`src/components/PersonForm.tsx`:
```tsx
import { useState, useEffect } from 'react'
import { useGiaphaStore } from '../store/useGiaphaStore'
import PersonPicker from './PersonPicker'
import { tuDongDienMe, tuDongDienBo, timVoChong } from '../utils/familyTree'
import type { Person, GioiTinh } from '../types/giapha'

interface Props {
  editPerson?: Person | null
  defaultBoId?: string
  onClose: () => void
}

interface FormState {
  hoTen: string
  gioiTinh: GioiTinh
  namSinh: string
  namMat: string
  queQuan: string
  tieuSu: string
  laThanhVienHo: boolean
  thuTuAnhChi: string
  boId: string
  meId: string
  voChongIds: string[]
}

const empty: FormState = {
  hoTen: '', gioiTinh: 'nam', namSinh: '', namMat: '',
  queQuan: '', tieuSu: '', laThanhVienHo: true, thuTuAnhChi: '',
  boId: '', meId: '', voChongIds: [],
}

export default function PersonForm({ editPerson, defaultBoId, onClose }: Props) {
  const { data, themNguoi, suaNguoi, acquireSoftLock, releaseSoftLock } = useGiaphaStore()
  const [form, setForm] = useState<FormState>(empty)
  const [pickerOpen, setPickerOpen] = useState<null | 'bo' | 'me' | 'vochong'>(null)
  const [multipleWives, setMultipleWives] = useState<string[]>([])

  useEffect(() => {
    if (editPerson) {
      setForm({
        hoTen: editPerson.hoTen,
        gioiTinh: editPerson.gioiTinh,
        namSinh: editPerson.namSinh?.nam?.toString() || '',
        namMat: editPerson.namMat?.nam?.toString() || '',
        queQuan: editPerson.queQuan || '',
        tieuSu: editPerson.tieuSu || '',
        laThanhVienHo: editPerson.laThanhVienHo,
        thuTuAnhChi: editPerson.thuTuAnhChi?.toString() || '',
        boId: editPerson.boId || '',
        meId: editPerson.meId || '',
        voChongIds: editPerson.honNhan.map(h => h.voChongId),
      })
    } else if (defaultBoId) {
      setForm(f => ({ ...f, boId: defaultBoId }))
    }
    acquireSoftLock()
    return () => releaseSoftLock()
  }, [])

  function handleBoSelected(person: Person) {
    if (!data) return
    setForm(f => ({ ...f, boId: person.id }))
    // Auto-fill me
    const wives = timVoChong(person.id, data)
    if (wives.length === 1) {
      setForm(f => ({ ...f, meId: wives[0] }))
    } else if (wives.length > 1) {
      setMultipleWives(wives)
    }
    setPickerOpen(null)
  }

  function handleMeSelected(person: Person) {
    if (!data) return
    setForm(f => ({ ...f, meId: person.id }))
    // Auto-fill bo
    const husbands = timVoChong(person.id, data)
    if (husbands.length === 1) {
      setForm(f => ({ ...f, boId: husbands[0] }))
    }
    setPickerOpen(null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.hoTen.trim()) return

    const personData: Omit<Person, 'id'> = {
      hoTen: form.hoTen.trim(),
      gioiTinh: form.gioiTinh,
      namSinh: form.namSinh ? { nam: parseInt(form.namSinh) } : undefined,
      namMat: form.namMat ? { nam: parseInt(form.namMat) } : undefined,
      queQuan: form.queQuan || undefined,
      tieuSu: form.tieuSu || undefined,
      laThanhVienHo: form.gioiTinh === 'nu' ? form.laThanhVienHo : true,
      thuTuAnhChi: form.thuTuAnhChi ? parseInt(form.thuTuAnhChi) : undefined,
      boId: form.boId || undefined,
      meId: form.meId || undefined,
      honNhan: form.voChongIds.map(id => ({ voChongId: id })),
      conCaiIds: editPerson?.conCaiIds || [],
    }

    if (editPerson) {
      suaNguoi(editPerson.id, personData)
    } else {
      themNguoi(personData)
    }
    onClose()
  }

  const getName = (id: string) => data?.persons[id]?.hoTen || ''

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-xl w-[480px] max-h-[90vh] flex flex-col">
          <div className="flex justify-between items-center px-4 py-3 border-b">
            <h3 className="font-semibold">{editPerson ? 'Sửa thông tin' : 'Thêm người mới'}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
          </div>

          <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-4 py-3 space-y-3">
            {/* Họ tên */}
            <div>
              <label className="text-sm font-medium text-gray-700">Họ tên *</label>
              <input
                autoFocus
                required
                value={form.hoTen}
                onChange={e => setForm(f => ({ ...f, hoTen: e.target.value }))}
                className="mt-1 w-full px-3 py-1.5 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            {/* Giới tính */}
            <div>
              <label className="text-sm font-medium text-gray-700">Giới tính</label>
              <div className="mt-1 flex gap-3">
                {(['nam', 'nu', 'khac'] as GioiTinh[]).map(g => (
                  <label key={g} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="radio" name="gioiTinh" value={g} checked={form.gioiTinh === g}
                      onChange={() => setForm(f => ({ ...f, gioiTinh: g }))} />
                    {g === 'nam' ? 'Nam' : g === 'nu' ? 'Nữ' : 'Khác'}
                  </label>
                ))}
              </div>
            </div>

            {/* Female clan membership */}
            {form.gioiTinh === 'nu' && (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.laThanhVienHo}
                  onChange={e => setForm(f => ({ ...f, laThanhVienHo: e.target.checked }))} />
                Thuộc dòng họ (không lấy chồng ngoài)
              </label>
            )}

            {/* Năm sinh / mất */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700">Năm sinh</label>
                <input type="number" value={form.namSinh} min={1800} max={new Date().getFullYear()}
                  onChange={e => setForm(f => ({ ...f, namSinh: e.target.value }))}
                  className="mt-1 w-full px-3 py-1.5 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700">Năm mất</label>
                <input type="number" value={form.namMat} min={1800} max={new Date().getFullYear()}
                  onChange={e => setForm(f => ({ ...f, namMat: e.target.value }))}
                  className="mt-1 w-full px-3 py-1.5 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
            </div>

            {/* Thứ tự anh chị */}
            <div>
              <label className="text-sm font-medium text-gray-700">Thứ tự anh chị em</label>
              <input type="number" value={form.thuTuAnhChi} min={1}
                onChange={e => setForm(f => ({ ...f, thuTuAnhChi: e.target.value }))}
                className="mt-1 w-24 px-3 py-1.5 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>

            {/* Bố */}
            <div>
              <label className="text-sm font-medium text-gray-700">Bố</label>
              <div className="mt-1 flex gap-2">
                <div className="flex-1 px-3 py-1.5 text-sm border rounded bg-gray-50 text-gray-700">
                  {form.boId ? getName(form.boId) : <span className="text-gray-400">Chưa chọn</span>}
                </div>
                <button type="button" onClick={() => setPickerOpen('bo')}
                  className="px-3 py-1.5 text-sm bg-gray-100 border rounded hover:bg-gray-200">Chọn</button>
                {form.boId && <button type="button" onClick={() => setForm(f => ({ ...f, boId: '' }))}
                  className="px-2 text-gray-400 hover:text-red-500">&times;</button>}
              </div>
            </div>

            {/* Mẹ */}
            <div>
              <label className="text-sm font-medium text-gray-700">Mẹ</label>
              <div className="mt-1 flex gap-2">
                {/* Multiple wives dropdown */}
                {multipleWives.length > 1 && !form.meId ? (
                  <select onChange={e => setForm(f => ({ ...f, meId: e.target.value }))}
                    className="flex-1 px-3 py-1.5 text-sm border rounded">
                    <option value="">-- Chọn mẹ --</option>
                    {multipleWives.map(id => (
                      <option key={id} value={id}>{getName(id)}</option>
                    ))}
                  </select>
                ) : (
                  <div className="flex-1 px-3 py-1.5 text-sm border rounded bg-gray-50 text-gray-700">
                    {form.meId ? getName(form.meId) : <span className="text-gray-400">Chưa chọn</span>}
                  </div>
                )}
                <button type="button" onClick={() => setPickerOpen('me')}
                  className="px-3 py-1.5 text-sm bg-gray-100 border rounded hover:bg-gray-200">Chọn</button>
                {form.meId && <button type="button" onClick={() => setForm(f => ({ ...f, meId: '' }))}
                  className="px-2 text-gray-400 hover:text-red-500">&times;</button>}
              </div>
            </div>

            {/* Vợ/Chồng */}
            <div>
              <label className="text-sm font-medium text-gray-700">Vợ/Chồng</label>
              <div className="mt-1 space-y-1">
                {form.voChongIds.map(id => (
                  <div key={id} className="flex items-center gap-2">
                    <span className="flex-1 text-sm px-3 py-1 border rounded bg-gray-50">{getName(id)}</span>
                    <button type="button" onClick={() => setForm(f => ({ ...f, voChongIds: f.voChongIds.filter(v => v !== id) }))}
                      className="text-gray-400 hover:text-red-500">&times;</button>
                  </div>
                ))}
                <button type="button" onClick={() => setPickerOpen('vochong')}
                  className="text-sm text-blue-600 hover:underline">+ Thêm vợ/chồng</button>
              </div>
            </div>

            {/* Quê quán, tiểu sử */}
            <div>
              <label className="text-sm font-medium text-gray-700">Quê quán</label>
              <input value={form.queQuan} onChange={e => setForm(f => ({ ...f, queQuan: e.target.value }))}
                className="mt-1 w-full px-3 py-1.5 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Tiểu sử</label>
              <textarea value={form.tieuSu} onChange={e => setForm(f => ({ ...f, tieuSu: e.target.value }))} rows={3}
                className="mt-1 w-full px-3 py-1.5 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit"
                className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700">
                {editPerson ? 'Lưu thay đổi' : 'Thêm'}
              </button>
              <button type="button" onClick={onClose}
                className="flex-1 py-2 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200">
                Hủy
              </button>
            </div>
          </form>
        </div>
      </div>

      {pickerOpen === 'bo' && (
        <PersonPicker title="Chọn bố" excludeIds={[...(form.meId ? [form.meId] : [])]}
          onSelect={handleBoSelected} onClose={() => setPickerOpen(null)} />
      )}
      {pickerOpen === 'me' && (
        <PersonPicker title="Chọn mẹ" excludeIds={[...(form.boId ? [form.boId] : [])]}
          onSelect={handleMeSelected} onClose={() => setPickerOpen(null)} />
      )}
      {pickerOpen === 'vochong' && (
        <PersonPicker title="Chọn vợ/chồng" excludeIds={[editPerson?.id || '', ...form.voChongIds].filter(Boolean)}
          onSelect={p => { setForm(f => ({ ...f, voChongIds: [...f.voChongIds, p.id] })); setPickerOpen(null) }}
          onClose={() => setPickerOpen(null)} />
      )}
    </>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/PersonForm.tsx src/components/PersonForm.test.tsx
git commit -m "feat: add PersonForm with auto-fill parent logic"
```

---

### Task 13: ListView Component

**Files:**
- Create: `src/components/ListView.tsx`

- [ ] **Step 1: Implement**

`src/components/ListView.tsx`:
```tsx
import { useGiaphaStore } from '../store/useGiaphaStore'
import { sapXepAnhChiEm, laThanhVienThuocHo } from '../utils/familyTree'
import type { Person } from '../types/giapha'

interface RowProps {
  person: Person
  depth: number
  onSelect: (id: string) => void
  selectedId: string | null
  highlightId: string | null
}

function PersonRow({ person, depth, onSelect, selectedId, highlightId }: RowProps) {
  const data = useGiaphaStore(s => s.data)
  const isClan = laThanhVienThuocHo(person)
  const isSelected = person.id === selectedId
  const isHighlighted = person.id === highlightId

  const children = data
    ? sapXepAnhChiEm(person.conCaiIds.map(id => data.persons[id]).filter(Boolean) as Person[])
    : []

  return (
    <>
      <div
        className={`flex items-center gap-2 py-1.5 px-2 cursor-pointer rounded transition-colors
          ${isSelected ? 'bg-blue-100' : ''}
          ${isHighlighted ? 'ring-2 ring-blue-400' : ''}
          hover:bg-gray-50`}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => onSelect(person.id)}
      >
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isClan ? 'bg-blue-500' : 'bg-gray-300'}`} />
        <span className={`text-sm ${isClan ? 'text-gray-900' : 'text-gray-400'}`}>
          {person.hoTen}
        </span>
        {person.namSinh?.nam && (
          <span className="text-xs text-gray-400">({person.namSinh.nam})</span>
        )}
        {person.namMat && (
          <span className="text-xs text-gray-300 ml-auto">†</span>
        )}
      </div>
      {children.map(child => (
        <PersonRow key={child.id} person={child} depth={depth + 1}
          onSelect={onSelect} selectedId={selectedId} highlightId={highlightId} />
      ))}
    </>
  )
}

export default function ListView() {
  const { data, selectedPersonId, selectPerson } = useGiaphaStore()
  if (!data) return <div className="p-4 text-gray-400">Chưa có dữ liệu</div>

  // Find roots: persons with no father (or father not in data)
  const roots = Object.values(data.persons).filter(p => {
    if (!p.boId) return true
    return !data.persons[p.boId]
  })
  const sortedRoots = sapXepAnhChiEm(roots)

  return (
    <div className="flex-1 overflow-y-auto bg-white p-2">
      {sortedRoots.map(root => (
        <PersonRow key={root.id} person={root} depth={0}
          onSelect={selectPerson} selectedId={selectedPersonId} highlightId={selectedPersonId} />
      ))}
      {sortedRoots.length === 0 && (
        <p className="text-center text-gray-400 py-8">Chưa có người nào. Hãy thêm người đầu tiên.</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ListView.tsx
git commit -m "feat: add hierarchical ListView component"
```

---

### Task 14: TreeView Component

**Files:**
- Create: `src/components/TreeView.tsx`
- Create: `src/components/PersonCard.tsx`

- [ ] **Step 1: Implement PersonCard**

`src/components/PersonCard.tsx`:
```tsx
import type { Person } from '../types/giapha'
import { laThanhVienThuocHo } from '../utils/familyTree'

interface Props {
  person: Person
  isSelected: boolean
  onClick: () => void
}

export default function PersonCard({ person, isSelected, onClick }: Props) {
  const isClan = laThanhVienThuocHo(person)
  return (
    <div
      onClick={onClick}
      className={`
        w-28 min-h-[56px] rounded-lg border-2 px-2 py-1.5 cursor-pointer text-center shadow-sm transition-all
        ${isSelected ? 'border-blue-500 bg-blue-50' : isClan ? 'border-gray-300 bg-white hover:border-blue-300' : 'border-dashed border-gray-200 bg-gray-50'}
      `}
    >
      <div className={`text-xs font-semibold leading-tight ${isClan ? 'text-gray-800' : 'text-gray-400'}`}>
        {person.hoTen}
      </div>
      {person.namSinh?.nam && (
        <div className="text-[10px] text-gray-400 mt-0.5">{person.namSinh.nam}</div>
      )}
      {person.namMat && (
        <div className="text-[10px] text-gray-300">†</div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Implement TreeView**

`src/components/TreeView.tsx`:
```tsx
import { useMemo, useRef, useEffect } from 'react'
import { useGiaphaStore } from '../store/useGiaphaStore'
import PersonCard from './PersonCard'
import type { Person } from '../types/giapha'

// Node dimensions
const NODE_W = 120
const NODE_H = 64
const H_GAP = 20
const V_GAP = 80

interface TreeNode {
  person: Person
  x: number
  y: number
  children: TreeNode[]
}

function buildTree(rootId: string, persons: Record<string, Person>, visited = new Set<string>()): TreeNode | null {
  if (visited.has(rootId)) return null
  visited.add(rootId)
  const person = persons[rootId]
  if (!person) return null
  const children = person.conCaiIds
    .map(id => buildTree(id, persons, visited))
    .filter(Boolean) as TreeNode[]
  return { person, x: 0, y: 0, children }
}

function layoutTree(node: TreeNode, depth: number, counter: { x: number }): void {
  if (node.children.length === 0) {
    node.x = counter.x * (NODE_W + H_GAP)
    node.y = depth * (NODE_H + V_GAP)
    counter.x++
    return
  }
  for (const child of node.children) {
    layoutTree(child, depth + 1, counter)
  }
  const first = node.children[0]
  const last = node.children[node.children.length - 1]
  node.x = (first.x + last.x) / 2
  node.y = depth * (NODE_H + V_GAP)
}

function collectNodes(node: TreeNode, acc: TreeNode[] = []): TreeNode[] {
  acc.push(node)
  for (const c of node.children) collectNodes(c, acc)
  return acc
}

function collectEdges(node: TreeNode, acc: { x1: number; y1: number; x2: number; y2: number }[] = []) {
  for (const child of node.children) {
    acc.push({
      x1: node.x + NODE_W / 2,
      y1: node.y + NODE_H,
      x2: child.x + NODE_W / 2,
      y2: child.y,
    })
    collectEdges(child, acc)
  }
  return acc
}

export default function TreeView() {
  const { data, selectedPersonId, selectPerson } = useGiaphaStore()
  const containerRef = useRef<HTMLDivElement>(null)

  const { nodes, edges, width, height } = useMemo(() => {
    if (!data) return { nodes: [], edges: [], width: 0, height: 0 }
    const persons = data.persons
    // Find root: person with no father in the dataset
    const root = Object.values(persons).find(p => !p.boId || !persons[p.boId])
    if (!root) return { nodes: [], edges: [], width: 0, height: 0 }

    const tree = buildTree(root.id, persons)
    if (!tree) return { nodes: [], edges: [], width: 0, height: 0 }

    const counter = { x: 0 }
    layoutTree(tree, 0, counter)

    const allNodes = collectNodes(tree)
    const allEdges = collectEdges(tree)

    const maxX = Math.max(...allNodes.map(n => n.x)) + NODE_W + 40
    const maxY = Math.max(...allNodes.map(n => n.y)) + NODE_H + 40

    return { nodes: allNodes, edges: allEdges, width: maxX, height: maxY }
  }, [data])

  // Scroll selected node into view
  useEffect(() => {
    if (!selectedPersonId || !containerRef.current) return
    const node = nodes.find(n => n.person.id === selectedPersonId)
    if (!node) return
    containerRef.current.scrollTo({
      left: node.x - containerRef.current.clientWidth / 2 + NODE_W / 2,
      top: node.y - containerRef.current.clientHeight / 2 + NODE_H / 2,
      behavior: 'smooth',
    })
  }, [selectedPersonId, nodes])

  if (!data) return <div className="flex-1 flex items-center justify-center text-gray-400">Chưa có dữ liệu</div>

  return (
    <div ref={containerRef} className="flex-1 overflow-auto bg-gray-50 relative">
      <div style={{ width, height, position: 'relative' }}>
        {/* SVG edges */}
        <svg style={{ position: 'absolute', top: 0, left: 0, width, height, pointerEvents: 'none' }}>
          {edges.map((e, i) => (
            <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
              stroke="#CBD5E1" strokeWidth={1.5} />
          ))}
        </svg>
        {/* Person cards */}
        {nodes.map(node => (
          <div key={node.person.id} style={{ position: 'absolute', left: node.x, top: node.y, width: NODE_W }}>
            <PersonCard
              person={node.person}
              isSelected={node.person.id === selectedPersonId}
              onClick={() => selectPerson(node.person.id)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/TreeView.tsx src/components/PersonCard.tsx
git commit -m "feat: add TreeView with custom layout renderer"
```

---

### Task 15: ConflictBanner + PermissionManager

**Files:**
- Create: `src/components/ConflictBanner.tsx`
- Create: `src/components/PermissionManager.tsx`

- [ ] **Step 1: Implement ConflictBanner**

`src/components/ConflictBanner.tsx`:
```tsx
import { useGiaphaStore } from '../store/useGiaphaStore'
import { kiemTraSoftLock, softLockHetHan } from '../utils/conflict'

export default function ConflictBanner() {
  const { data, currentUserEmail, conflictDetected, setConflictDetected } = useGiaphaStore()

  const softLock = data?.metadata.dangChinhSua
  const activeLock = currentUserEmail ? kiemTraSoftLock(softLock, currentUserEmail) : null

  if (!activeLock && !conflictDetected) return null

  return (
    <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-sm text-yellow-800 flex items-center justify-between">
      {conflictDetected ? (
        <span>⚠️ Dữ liệu đã bị thay đổi từ thiết bị khác. Vui lòng tải lại trang để lấy bản mới nhất.</span>
      ) : activeLock ? (
        <span>🔒 <strong>{activeLock.hoTen}</strong> đang chỉnh sửa (từ {new Date(activeLock.thoiGian).toLocaleTimeString('vi-VN')})</span>
      ) : null}
      {conflictDetected && (
        <button onClick={() => { setConflictDetected(false); window.location.reload() }}
          className="ml-4 px-3 py-1 bg-yellow-200 rounded hover:bg-yellow-300">Tải lại</button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Implement PermissionManager**

`src/components/PermissionManager.tsx`:
```tsx
import { useState } from 'react'
import { useGiaphaStore } from '../store/useGiaphaStore'
import type { Role, NguoiDung } from '../types/giapha'

export default function PermissionManager() {
  const { data, currentRole, suaNguoi } = useGiaphaStore()
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState<Role>('viewer')

  if (currentRole !== 'admin' || !data) return null

  const users = data.metadata.danhSachNguoiDung

  function addUser() {
    if (!newEmail.trim()) return
    const updated: NguoiDung[] = [...users.filter(u => u.email !== newEmail.trim()), { email: newEmail.trim(), role: newRole }]
    // Update metadata via store (patch metadata directly)
    useGiaphaStore.getState().setData({
      ...data,
      metadata: { ...data.metadata, danhSachNguoiDung: updated },
    })
    setNewEmail('')
  }

  function removeUser(email: string) {
    const updated = users.filter(u => u.email !== email)
    useGiaphaStore.getState().setData({
      ...data,
      metadata: { ...data.metadata, danhSachNguoiDung: updated },
    })
  }

  return (
    <div className="p-4 max-w-lg">
      <h3 className="font-semibold text-gray-800 mb-3">Quản lý quyền truy cập</h3>
      <div className="space-y-2 mb-4">
        {users.map(u => (
          <div key={u.email} className="flex items-center gap-3 text-sm">
            <span className="flex-1 text-gray-700">{u.email}</span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium
              ${u.role === 'admin' ? 'bg-red-100 text-red-700' :
                u.role === 'editor' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
              {u.role}
            </span>
            {u.role !== 'admin' && (
              <button onClick={() => removeUser(u.email)} className="text-gray-400 hover:text-red-500">&times;</button>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Email"
          className="flex-1 px-3 py-1.5 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-400" />
        <select value={newRole} onChange={e => setNewRole(e.target.value as Role)}
          className="px-2 py-1.5 text-sm border rounded">
          <option value="viewer">Viewer</option>
          <option value="editor">Editor</option>
        </select>
        <button onClick={addUser} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Thêm</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ConflictBanner.tsx src/components/PermissionManager.tsx
git commit -m "feat: add ConflictBanner and PermissionManager components"
```

---

### Task 16: AdminSetup + AuthGate + LoginPage

**Files:**
- Create: `src/components/AdminSetup.tsx`
- Create: `src/components/AuthGate.tsx`
- Create: `src/pages/LoginPage.tsx`

- [ ] **Step 1: Implement AdminSetup**

`src/components/AdminSetup.tsx`:
```tsx
import { useState } from 'react'
import { khoiTaoFile } from '../services/googleDrive'
import { useGiaphaStore } from '../store/useGiaphaStore'

export default function AdminSetup() {
  const { setFileId } = useGiaphaStore()
  const [loading, setLoading] = useState(false)
  const [fileId, setFileIdLocal] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    setLoading(true)
    setError(null)
    try {
      const id = await khoiTaoFile()
      setFileIdLocal(id)
      setFileId(id)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Thiết lập gia phả lần đầu</h2>
        <p className="text-sm text-gray-500 mb-6">
          Nhấn nút bên dưới để tạo thư mục <code>giapha/</code> và file <code>giapha.json</code> trên Google Drive của bạn.
        </p>

        {fileId ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-700 font-medium text-sm mb-2">✅ Đã tạo thành công!</p>
            <p className="text-sm text-gray-600 mb-2">File ID:</p>
            <code className="block text-xs bg-gray-100 px-3 py-2 rounded break-all">{fileId}</code>
            <p className="text-xs text-gray-500 mt-3">
              Lưu File ID này vào GitHub Actions secret <code>VITE_GIAPHA_FILE_ID</code> rồi chạy lại workflow deploy.
            </p>
          </div>
        ) : (
          <button onClick={handleCreate} disabled={loading}
            className="w-full py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Đang tạo...' : 'Tạo file gia phả trên Drive'}
          </button>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Implement LoginPage**

`src/pages/LoginPage.tsx`:
```tsx
import { useGiaphaStore } from '../store/useGiaphaStore'
import { dangNhap } from '../services/googleAuth'

interface Props {
  publicModeAvailable: boolean
  onPublicMode: () => void
}

export default function LoginPage({ publicModeAvailable, onPublicMode }: Props) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50">
      <div className="bg-white rounded-2xl shadow-xl p-10 max-w-sm w-full text-center">
        <div className="text-5xl mb-4">🏮</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Gia Phả</h1>
        <p className="text-gray-500 text-sm mb-8">Quản lý cây gia phả dòng họ</p>

        <button
          onClick={dangNhap}
          className="w-full flex items-center justify-center gap-3 py-2.5 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors mb-3"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
          <span className="text-sm font-medium text-gray-700">Đăng nhập bằng Google</span>
        </button>

        {publicModeAvailable && (
          <button onClick={onPublicMode} className="w-full py-2 text-sm text-gray-500 hover:text-gray-700">
            Xem không cần đăng nhập
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Implement AuthGate**

`src/components/AuthGate.tsx`:
```tsx
import { useEffect, useState } from 'react'
import { useGiaphaStore } from '../store/useGiaphaStore'
import { khoiTaoAuth, dangNhap, layToken } from '../services/googleAuth'
import { docFile } from '../services/googleDrive'
import LoginPage from '../pages/LoginPage'
import AdminSetup from './AdminSetup'
import { SCOPE_DRIVE } from '../services/googleAuth'

interface Props {
  children: React.ReactNode
}

export default function AuthGate({ children }: Props) {
  const { data, fileId, setData, setUser, currentRole } = useGiaphaStore()
  const [loading, setLoading] = useState(true)
  const [publicMode, setPublicMode] = useState(false)

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

  useEffect(() => {
    khoiTaoAuth(clientId, SCOPE_DRIVE, async (token) => {
      if (!token) { setLoading(false); return }

      // Determine role from file's user list (or default admin if first run)
      // For simplicity: load file first, then check role
      // (In prod, admin email is stored in metadata)
      try {
        if (fileId) {
          const d = await docFile(fileId)
          setData(d)
          const email = (window as any).__googleEmail || ''
          const user = d.metadata.danhSachNguoiDung.find(u => u.email === email)
          const role = user?.role || (d.metadata.nguoiTao === email ? 'admin' : 'viewer')
          setUser(email, role)
        }
      } catch {
        // ignore
      }
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400 animate-pulse">Đang tải...</div>
      </div>
    )
  }

  if (!layToken() && !publicMode) {
    return (
      <LoginPage
        publicModeAvailable={data?.metadata.cheDoCong ?? false}
        onPublicMode={() => { setPublicMode(true); setUser('', 'public') }}
      />
    )
  }

  if (!fileId) {
    return <AdminSetup />
  }

  return <>{children}</>
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/AdminSetup.tsx src/components/AuthGate.tsx src/pages/LoginPage.tsx
git commit -m "feat: add AdminSetup, AuthGate, LoginPage"
```

---

### Task 17: HomePage + App Shell

**Files:**
- Create: `src/pages/HomePage.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Implement HomePage**

`src/pages/HomePage.tsx`:
```tsx
import { useState } from 'react'
import Navbar from '../components/Navbar'
import TreeView from '../components/TreeView'
import ListView from '../components/ListView'
import PersonDetail from '../components/PersonDetail'
import PersonForm from '../components/PersonForm'
import ConflictBanner from '../components/ConflictBanner'
import { useGiaphaStore } from '../store/useGiaphaStore'
import type { Person } from '../types/giapha'

export default function HomePage() {
  const { viewMode, currentRole } = useGiaphaStore()
  const [formOpen, setFormOpen] = useState(false)
  const [editPerson, setEditPerson] = useState<Person | null>(null)

  const canEdit = currentRole === 'admin' || currentRole === 'editor'

  function openAdd() { setEditPerson(null); setFormOpen(true) }
  function openEdit(person: Person) { setEditPerson(person); setFormOpen(true) }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Navbar />
      <ConflictBanner />

      <div className="flex flex-1 overflow-hidden">
        {viewMode === 'tree' ? <TreeView /> : <ListView />}
        <PersonDetail onEdit={openEdit} />
      </div>

      {canEdit && (
        <button
          onClick={openAdd}
          className="fixed bottom-6 right-6 w-12 h-12 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 text-2xl flex items-center justify-center z-30"
          title="Thêm người mới"
        >
          +
        </button>
      )}

      {formOpen && (
        <PersonForm editPerson={editPerson} onClose={() => setFormOpen(false)} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update App.tsx**

`src/App.tsx`:
```tsx
import { Routes, Route } from 'react-router-dom'
import AuthGate from './components/AuthGate'
import HomePage from './pages/HomePage'

export default function App() {
  return (
    <AuthGate>
      <Routes>
        <Route path="/" element={<HomePage />} />
      </Routes>
    </AuthGate>
  )
}
```

- [ ] **Step 3: Build to verify no TS errors**

```bash
npm run build
```
Expected: success, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/HomePage.tsx src/App.tsx
git commit -m "feat: add HomePage and App shell with routing"
```

---

### Task 18: GitHub Actions Deploy Workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create workflow**

`.github/workflows/deploy.yml`:
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - run: npm run build
        env:
          VITE_GOOGLE_CLIENT_ID: ${{ secrets.VITE_GOOGLE_CLIENT_ID }}
          VITE_GIAPHA_FILE_ID: ${{ secrets.VITE_GIAPHA_FILE_ID }}

      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/deploy-pages@v4
        id: deployment
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "feat: add GitHub Actions deploy workflow"
```

---

### Task 19: Run Full Test Suite + Final Build

- [ ] **Step 1: Run all tests**

```bash
npx vitest run
```
Expected: all tests pass (id, familyTree, search, conflict, PersonForm auto-fill).

- [ ] **Step 2: Full build**

```bash
npm run build
```
Expected: no errors, `dist/` contains the app.

- [ ] **Step 3: Local preview**

```bash
npm run preview
```
Open http://localhost:4173/giapha/ — verify the login page renders.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: all tests passing, production build verified"
```

---

## Setup Checklist (after deploy)

1. Admin đăng nhập → app hiển thị AdminSetup → nhấn "Tạo file" → nhận File ID
2. Vào GitHub repo → Settings → Secrets → thêm:
   - `VITE_GOOGLE_CLIENT_ID`: từ Google Cloud Console OAuth2 credentials
   - `VITE_GIAPHA_FILE_ID`: File ID từ bước 1
3. Trigger workflow lại → app deployed với đúng File ID
4. Admin thêm editor/viewer qua PermissionManager

## Google Cloud Console Checklist

- Tạo OAuth2 Client ID (Web application)
- Authorized JavaScript origins: `https://<username>.github.io`
- Authorized redirect URIs: `https://<username>.github.io/giapha/`
- Enable Google Drive API
