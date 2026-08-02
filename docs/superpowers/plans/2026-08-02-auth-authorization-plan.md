# Auth & Authorization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 2-tier user auth/authorization system (admin/editor roles) with session-cookie login, an editor-request/admin-approval workflow for member edits, admin-only CSV import/export, and a `/control-panel` admin page — while anonymous visitors keep read-only tree/list viewing.

**Architecture:** Cloudflare Worker (Hono) gets a new `attachUser` middleware (reads `giapha_session` cookie, loads session+user from D1) and a `requireRole()` guard used on protected routes. Editor mutations no longer write directly to `persons`/`families` — they insert an `editor_requests` row; admin mutations (and admin-approved requests) call shared internal functions that do the real write. Frontend gets a Zustand `useAuthStore`, a `LoginModal` opened from the Navbar, a route-guarded `/control-panel` page hosting Members/Requests/CSV/Users tabs, and pending-request badges on person cards.

**Tech Stack:** Hono ^4, Drizzle ORM ^0.38 + D1, Web Crypto (`crypto.subtle`) PBKDF2 for password hashing, hand-written SQL migration (no drizzle-kit push against the live DB), `@cloudflare/vitest-pool-workers` for worker tests, React 19 + Zustand + React Router v7 on the frontend.

**Spec:** `docs/superpowers/specs/2026-08-02-auth-authorization-design.md` (source of truth for all requirements below).

---

## File Structure

**Backend (`worker/`):**
- `worker/migrations/0001_add_auth_and_requests.sql` — new: hand-written SQL migration for the real D1 DB (email column, role enum widen via new column since SQLite can't alter CHECK easily, sessions table, editor_requests table).
- `worker/src/db/schema.ts` — modify: add `email` to `users`, widen `role` enum to `'admin' | 'editor' | 'viewer'`, add `sessions` and `editorRequests` tables.
- `worker/src/lib/password.ts` — new: PBKDF2 hash/verify helpers.
- `worker/src/lib/session.ts` — new: session token creation/lookup/deletion helpers.
- `worker/src/middleware/auth.ts` — new: `attachUser` (reads cookie, sets `c.set('user', ...)`) and `requireRole(...roles)` guard.
- `worker/src/types.ts` — modify: add `Variables: { user: AuthUser | null }` to `HonoEnv`.
- `worker/src/routes/auth.ts` — new: `GET /auth/me`, `POST /auth/setup`, `POST /auth/login`, `POST /auth/logout`.
- `worker/src/routes/editor.ts` — modify: extract `createPersonRecord`/`updatePersonRecord`/`deletePersonRecord` internal functions; route handlers branch on role (admin writes directly, editor inserts an `editor_requests` row and returns 202).
- `worker/src/routes/requests.ts` — new: `GET /requests` (own for editor, all for admin), `POST /requests/:id/approve`, `POST /requests/:id/reject`.
- `worker/src/routes/tree.ts` — modify: add `pendingRequestId` to each person's output.
- `worker/src/routes/csv.ts` — modify: add `requireRole('admin')` to both routes.
- `worker/src/routes/users.ts` — new: admin-only user CRUD (`GET/POST/PUT/DELETE /users`), with last-admin-delete protection.
- `worker/src/index.ts` — modify: mount `attachUser` middleware and new route files.
- `worker/vitest.config.ts` — new: `@cloudflare/vitest-pool-workers` config for worker tests.
- `worker/test/migrations/0001_add_auth_and_requests.sql` — new: copy of the real migration, applied to the isolated test D1 via `applyD1Migrations`.
- `worker/test/apply-migrations.ts` — new: test setup file that applies migrations before each test file.

**Frontend (`src/`):**
- `src/types/giapha.ts` — modify: add `pendingRequestId?: string` to `Person`; add `AuthUser`, `EditorRequest` types.
- `src/services/api.ts` — modify: add auth/requests/users API functions; update person-mutation return types.
- `src/store/useAuthStore.ts` — new: zustand store for `user`, `setupNeeded`, `checkAuth`, `login`, `logout`.
- `src/components/LoginModal.tsx` — new: login modal (normal login / first-admin-setup form), pattern mirrors `CsvImportModal.tsx`.
- `src/components/Navbar.tsx` — modify: auth-aware menu (hide Members/CSV items for anonymous, add Login/Logout, username+role badge, "Quản lý" link to Control Panel for admin/editor).
- `src/pages/ControlPanelPage.tsx` — new: route-guarded page with tab shell (Members / Requests / CSV / Users).
- `src/components/MemberManagementView.tsx` — modify: handle `{pending: true, requestId}` response from editor mutations, show pending state.
- `src/components/PendingRequestsPanel.tsx` — new: admin-only (all)/editor-only (own) list of pending requests with approve/reject buttons.
- `src/components/CsvPanel.tsx` — new: admin-only import/export panel (moves logic out of Navbar).
- `src/components/UserManagementPanel.tsx` — new: admin-only user CRUD UI.
- `src/components/PersonCard.tsx` — modify: show a pending badge when `pendingRequestId` is set.
- `src/components/ListView.tsx` — modify: show a pending badge on rows when `pendingRequestId` is set and `user !== null`.
- `src/components/PersonDetailPanel.tsx` — new: read-only person detail modal for anonymous/viewer clicks (no edit/delete controls).
- `src/store/useGiaphaStore.ts` — modify: drop `'members'` from `ViewMode` (member management now lives only in the Control Panel).
- `src/pages/HomePage.tsx` — modify: gate FAB and edit-on-click behind `user !== null`; open `PersonDetailPanel` instead of `PersonForm` for anonymous/viewer.
- `src/App.tsx` — modify: add `/control-panel` route.

Each task below is self-contained: write test → run (fail) → implement → run (pass) → commit.

---

## Task 1: Worker test infrastructure (`@cloudflare/vitest-pool-workers`)

**Files:**
- Create: `worker/vitest.config.ts`
- Create: `worker/test/apply-migrations.ts`
- Create: `worker/test/migrations/0001_add_auth_and_requests.sql` (copy of Task 2's migration — write as an empty placeholder for now, filled in Task 2)
- Modify: `package.json` (add devDependency + script)
- Test: `worker/test/health.test.ts`

- [ ] **Step 1: Install the worker test pool package**

Run: `npm install -D @cloudflare/vitest-pool-workers@0.20.1`
Expected: adds `@cloudflare/vitest-pool-workers` to `devDependencies` in `package.json` and installs without peer-dependency errors (it declares compatibility with `vitest ^4`, matching this repo's `vitest ^4.1.4`).

- [ ] **Step 2: Add empty placeholder migrations dir + apply-migrations helper**

`worker/test/migrations/0001_add_auth_and_requests.sql`:
```sql
-- Placeholder — filled in by Task 2. Test-only migrations dir, never touches production D1.
```

`worker/test/apply-migrations.ts`:
```typescript
import { applyD1Migrations, env } from 'cloudflare:test'

export default async function setup() {
  await applyD1Migrations(env.giapha_db, env.TEST_MIGRATIONS)
}
```

- [ ] **Step 3: Add `worker/vitest.config.ts`**

```typescript
import { defineWorkersConfig, readD1Migrations } from '@cloudflare/vitest-pool-workers/config'
import path from 'node:path'

export default defineWorkersConfig(async () => {
  const migrationsPath = path.join(__dirname, 'test/migrations')
  const migrations = await readD1Migrations(migrationsPath)
  return {
    test: {
      globalSetup: ['./test/apply-migrations.ts'],
      poolOptions: {
        workers: {
          singleWorker: true,
          wrangler: { configPath: path.join(__dirname, '../wrangler.jsonc') },
          miniflare: {
            bindings: { TEST_MIGRATIONS: migrations },
          },
        },
      },
    },
  }
})
```

- [ ] **Step 4: Add a root npm script for worker tests**

In `package.json`, add to `scripts`:
```json
"test:worker": "vitest run --config worker/vitest.config.ts"
```

- [ ] **Step 5: Write the failing smoke test**

`worker/test/health.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { SELF } from 'cloudflare:test'

describe('GET /api/health', () => {
  it('returns ok: true', async () => {
    const res = await SELF.fetch('http://example.com/api/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })
})
```

- [ ] **Step 6: Run the test**

Run: `npm run test:worker`
Expected: PASS — 1 test (`GET /api/health > returns ok: true`). This confirms the pool, migrations-apply hook, and existing `worker/src/index.ts` all work together before any schema changes.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json worker/vitest.config.ts worker/test/
git commit -m "test: add @cloudflare/vitest-pool-workers infra for worker tests"
```

---

## Task 2: DB schema changes + production migration

**Files:**
- Modify: `worker/src/db/schema.ts`
- Create: `worker/migrations/0001_add_auth_and_requests.sql`
- Modify: `worker/test/migrations/0001_add_auth_and_requests.sql` (replace placeholder with the real SQL, kept identical to the production migration)
- Test: `worker/test/schema.test.ts`

- [ ] **Step 1: Write the failing test (asserts new columns/tables are queryable)**

`worker/test/schema.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { env } from 'cloudflare:test'
import { users, sessions, editorRequests } from '../src/db/schema'

describe('auth schema', () => {
  it('users table accepts admin role and email', async () => {
    const db = drizzle(env.giapha_db)
    const id = crypto.randomUUID()
    await db.insert(users).values({
      id, username: 'admin1', passwordHash: 'x', role: 'admin', email: 'a@example.com',
    })
    const row = await db.select().from(users).where(eq(users.id, id)).get()
    expect(row?.role).toBe('admin')
    expect(row?.email).toBe('a@example.com')
  })

  it('sessions table links to users with cascade delete', async () => {
    const db = drizzle(env.giapha_db)
    const userId = crypto.randomUUID()
    await db.insert(users).values({ id: userId, username: 'admin2', passwordHash: 'x', role: 'admin', email: 'b@example.com' })
    await db.insert(sessions).values({ token: 'tok123', userId, expiresAt: new Date(Date.now() + 1000).toISOString() })
    const before = await db.select().from(sessions).all()
    expect(before).toHaveLength(1)
    await db.delete(users).where(eq(users.id, userId))
    const after = await db.select().from(sessions).all()
    expect(after).toHaveLength(0)
  })

  it('editorRequests table stores a pending create request', async () => {
    const db = drizzle(env.giapha_db)
    const userId = crypto.randomUUID()
    await db.insert(users).values({ id: userId, username: 'editor1', passwordHash: 'x', role: 'editor', email: 'e@example.com' })
    await db.insert(editorRequests).values({
      id: crypto.randomUUID(), type: 'create', personId: null,
      payload: JSON.stringify({ hoTen: 'Test' }), status: 'pending', submittedBy: userId,
    })
    const rows = await db.select().from(editorRequests).all()
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe('pending')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:worker`
Expected: FAIL — Drizzle import errors (`sessions`/`editorRequests` not exported from `../src/db/schema`) and/or SQLite errors (`no such table: sessions`, `no column named email`).

- [ ] **Step 3: Update `worker/src/db/schema.ts`**

Replace the top comment (the "shared DB, never migrate" warning is stale per repo owner — this worker now owns and independently migrates its own schema) and widen `users`, then add two new tables. Edit the top of the file:

```typescript
import { sqliteTable, text, integer, index, primaryKey } from 'drizzle-orm/sqlite-core'
import { relations, sql } from 'drizzle-orm'

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = sqliteTable('users', {
  id:           text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  username:     text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role:         text('role', { enum: ['admin', 'editor', 'viewer'] }).notNull().default('viewer'),
  email:        text('email').notNull(),
  isActive:     integer('is_active', { mode: 'boolean' }).notNull().default(true),
  personId:     text('person_id').unique().references(() => persons.id, { onDelete: 'set null' }),
  createdAt:    text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

// ─── Sessions ─────────────────────────────────────────────────────────────────
export const sessions = sqliteTable('sessions', {
  token:     text('token').primaryKey(),
  userId:    text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

// ─── Editor Requests ──────────────────────────────────────────────────────────
export const editorRequests = sqliteTable('editor_requests', {
  id:           text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  type:         text('type', { enum: ['create', 'update', 'delete'] }).notNull(),
  personId:     text('person_id').references(() => persons.id, { onDelete: 'set null' }),
  payload:      text('payload'),
  status:       text('status', { enum: ['pending', 'approved', 'rejected'] }).notNull().default('pending'),
  submittedBy:  text('submitted_by').notNull().references(() => users.id),
  resolvedBy:   text('resolved_by').references(() => users.id),
  resolvedAt:   text('resolved_at'),
  createdAt:    text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index('editor_requests_status_idx').on(t.status),
  index('editor_requests_pending_person_idx').on(t.personId, t.status),
])
```

(Leave `persons`, `families`, `familyMembers`, `events`, `settings`, and all `relations(...)` blocks below unchanged — only the `users` table and top comment change, and the two new tables are inserted after `users`.)

- [ ] **Step 4: Write the production migration**

`worker/migrations/0001_add_auth_and_requests.sql`:
```sql
-- Migration 0001: add auth (admin role, email) + sessions + editor_requests.
-- Apply with: wrangler d1 execute giapha-db --local --file=worker/migrations/0001_add_auth_and_requests.sql
--             wrangler d1 execute giapha-db --remote --file=worker/migrations/0001_add_auth_and_requests.sql

-- users: add email (backfill existing rows with a placeholder so NOT NULL can be added safely)
ALTER TABLE users ADD COLUMN email TEXT;
UPDATE users SET email = username || '@example.invalid' WHERE email IS NULL;
-- SQLite can't add a NOT NULL column without a default in one step if rows exist;
-- email is enforced at the application layer (Drizzle notNull()) for all new/updated rows.

CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE editor_requests (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('create', 'update', 'delete')),
  person_id TEXT REFERENCES persons(id) ON DELETE SET NULL,
  payload TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_by TEXT NOT NULL REFERENCES users(id),
  resolved_by TEXT REFERENCES users(id),
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX editor_requests_status_idx ON editor_requests(status);
CREATE UNIQUE INDEX editor_requests_pending_person_unique_idx
  ON editor_requests(person_id)
  WHERE status = 'pending' AND person_id IS NOT NULL;
```

- [ ] **Step 5: Copy the migration into the test migrations dir**

Run: `cp worker/migrations/0001_add_auth_and_requests.sql worker/test/migrations/0001_add_auth_and_requests.sql`
Expected: file replaced (overwrites Task 1's placeholder comment).

- [ ] **Step 6: Run test to verify it passes**

Run: `npm run test:worker`
Expected: PASS — all 3 tests in `schema.test.ts` plus the Task 1 health test (4 total).

- [ ] **Step 7: Apply the migration to local + remote D1**

Run: `npx wrangler d1 execute giapha-db --local --file=worker/migrations/0001_add_auth_and_requests.sql`
Expected: `🚣 Executed N commands` with no errors.

Run: `npx wrangler d1 execute giapha-db --remote --file=worker/migrations/0001_add_auth_and_requests.sql`
Expected: `🚣 Executed N commands` with no errors (applies to the live production DB — safe: additive only, no data loss).

- [ ] **Step 8: Commit**

```bash
git add worker/src/db/schema.ts worker/migrations/ worker/test/migrations/ worker/test/schema.test.ts
git commit -m "feat: add sessions and editor_requests tables, widen users role/email"
```

---

## Task 3: Password hashing (`worker/src/lib/password.ts`)

**Files:**
- Create: `worker/src/lib/password.ts`
- Test: `worker/test/password.test.ts`

- [ ] **Step 1: Write the failing test**

`worker/test/password.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from '../src/lib/password'

describe('password hashing', () => {
  it('hashes and verifies a correct password', async () => {
    const hash = await hashPassword('correct-horse-battery-staple')
    expect(hash).toMatch(/^pbkdf2:\d+:[0-9a-f]+:[0-9a-f]+$/)
    expect(await verifyPassword('correct-horse-battery-staple', hash)).toBe(true)
  })

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correct-horse-battery-staple')
    expect(await verifyPassword('wrong-password', hash)).toBe(false)
  })

  it('produces different hashes for the same password (random salt)', async () => {
    const hash1 = await hashPassword('same-password')
    const hash2 = await hashPassword('same-password')
    expect(hash1).not.toBe(hash2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:worker -- password.test.ts`
Expected: FAIL with "Cannot find module '../src/lib/password'".

- [ ] **Step 3: Implement `worker/src/lib/password.ts`**

```typescript
const ITERATIONS = 100_000
const HASH_ALGO = 'SHA-256'
const KEY_LENGTH_BITS = 256

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16)
  return bytes
}

async function deriveHash(password: string, salt: Uint8Array, iterations: number): Promise<ArrayBuffer> {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: HASH_ALGO },
    keyMaterial,
    KEY_LENGTH_BITS,
  )
}

/** Hashes a plaintext password into the storable format `pbkdf2:<iterations>:<saltHex>:<hashHex>`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const derived = await deriveHash(password, salt, ITERATIONS)
  return `pbkdf2:${ITERATIONS}:${toHex(salt.buffer)}:${toHex(derived)}`
}

/** Verifies a plaintext password against a stored `pbkdf2:...` hash. Returns false on any format mismatch. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
  const iterations = parseInt(parts[1], 10)
  if (!Number.isFinite(iterations) || iterations <= 0) return false
  const salt = fromHex(parts[2])
  const expectedHex = parts[3]
  const derived = await deriveHash(password, salt, iterations)
  const actualHex = toHex(derived)
  if (actualHex.length !== expectedHex.length) return false
  // Constant-time comparison to avoid timing side-channels.
  let diff = 0
  for (let i = 0; i < actualHex.length; i++) diff |= actualHex.charCodeAt(i) ^ expectedHex.charCodeAt(i)
  return diff === 0
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:worker -- password.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add worker/src/lib/password.ts worker/test/password.test.ts
git commit -m "feat: add PBKDF2 password hashing helpers"
```

---

## Task 4: Session helpers (`worker/src/lib/session.ts`)

**Files:**
- Create: `worker/src/lib/session.ts`
- Test: `worker/test/session.test.ts`

- [ ] **Step 1: Write the failing test**

`worker/test/session.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import { env } from 'cloudflare:test'
import { users } from '../src/db/schema'
import { createSession, getSessionUser, deleteSession, SESSION_COOKIE_NAME } from '../src/lib/session'

describe('session helpers', () => {
  async function makeUser() {
    const db = drizzle(env.giapha_db)
    const id = crypto.randomUUID()
    await db.insert(users).values({ id, username: `u-${id}`, passwordHash: 'x', role: 'admin', email: 'a@example.com' })
    return id
  }

  it('creates a session and resolves the user from its token', async () => {
    const db = drizzle(env.giapha_db)
    const userId = await makeUser()
    const token = await createSession(db, userId)
    expect(typeof token).toBe('string')
    expect(token.length).toBeGreaterThan(20)
    const user = await getSessionUser(db, token)
    expect(user?.id).toBe(userId)
  })

  it('returns null for an unknown token', async () => {
    const db = drizzle(env.giapha_db)
    const user = await getSessionUser(db, 'not-a-real-token')
    expect(user).toBeNull()
  })

  it('returns null for an expired session', async () => {
    const db = drizzle(env.giapha_db)
    const userId = await makeUser()
    const token = await createSession(db, userId, -1000)
    const user = await getSessionUser(db, token)
    expect(user).toBeNull()
  })

  it('deleteSession removes the session so lookups return null afterward', async () => {
    const db = drizzle(env.giapha_db)
    const userId = await makeUser()
    const token = await createSession(db, userId)
    await deleteSession(db, token)
    const user = await getSessionUser(db, token)
    expect(user).toBeNull()
  })

  it('exports a stable cookie name', () => {
    expect(SESSION_COOKIE_NAME).toBe('giapha_session')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:worker -- session.test.ts`
Expected: FAIL with "Cannot find module '../src/lib/session'".

- [ ] **Step 3: Implement `worker/src/lib/session.ts`**

```typescript
import { eq, and, gt } from 'drizzle-orm'
import { sessions, users } from '../db/schema'
import type { DB } from './reshape'

export const SESSION_COOKIE_NAME = 'giapha_session'
export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export interface AuthUser {
  id: string
  username: string
  role: 'admin' | 'editor' | 'viewer'
  email: string
  personId: string | null
}

/** Creates a session row and returns the raw token. `durationMs` overridable for tests (e.g. negative = already expired). */
export async function createSession(db: DB, userId: string, durationMs: number = SESSION_DURATION_MS): Promise<string> {
  const token = crypto.randomUUID() + crypto.randomUUID()
  const expiresAt = new Date(Date.now() + durationMs).toISOString()
  await db.insert(sessions).values({ token, userId, expiresAt })
  return token
}

/** Resolves a session token to its user, or null if the token is missing/expired/unknown. */
export async function getSessionUser(db: DB, token: string): Promise<AuthUser | null> {
  const nowIso = new Date().toISOString()
  const row = await db
    .select({
      id: users.id, username: users.username, role: users.role,
      email: users.email, personId: users.personId,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, nowIso)))
    .get()
  return row ?? null
}

export async function deleteSession(db: DB, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.token, token))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:worker -- session.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add worker/src/lib/session.ts worker/test/session.test.ts
git commit -m "feat: add session create/lookup/delete helpers"
```

---

## Task 5: Auth middleware (`attachUser`, `requireRole`)

**Files:**
- Modify: `worker/src/types.ts`
- Create: `worker/src/middleware/auth.ts`
- Test: `worker/test/middleware-auth.test.ts`

- [ ] **Step 1: Write the failing test**

`worker/test/middleware-auth.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { env } from 'cloudflare:test'
import { users } from '../src/db/schema'
import { createSession, SESSION_COOKIE_NAME } from '../src/lib/session'
import { attachUser, requireRole } from '../src/middleware/auth'
import type { HonoEnv } from '../src/types'

function buildApp() {
  const app = new Hono<HonoEnv>()
  app.use('*', attachUser)
  app.get('/whoami', (c) => c.json({ user: c.get('user') }))
  app.get('/admin-only', requireRole('admin'), (c) => c.json({ ok: true }))
  app.get('/editor-or-admin', requireRole('admin', 'editor'), (c) => c.json({ ok: true }))
  return app
}

async function makeUserAndToken(role: 'admin' | 'editor' | 'viewer') {
  const db = drizzle(env.giapha_db)
  const id = crypto.randomUUID()
  await db.insert(users).values({ id, username: `u-${id}`, passwordHash: 'x', role, email: 'a@example.com' })
  const token = await createSession(db, id)
  return token
}

describe('attachUser middleware', () => {
  it('sets user to null when there is no session cookie', async () => {
    const app = buildApp()
    const res = await app.request('/whoami')
    expect(await res.json()).toEqual({ user: null })
  })

  it('resolves the user from a valid session cookie', async () => {
    const app = buildApp()
    const token = await makeUserAndToken('editor')
    const res = await app.request('/whoami', { headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` } })
    const body = await res.json<{ user: { role: string } | null }>()
    expect(body.user?.role).toBe('editor')
  })
})

describe('requireRole middleware', () => {
  it('returns 401 for anonymous requests', async () => {
    const app = buildApp()
    const res = await app.request('/admin-only')
    expect(res.status).toBe(401)
  })

  it('returns 403 for a logged-in user with the wrong role', async () => {
    const app = buildApp()
    const token = await makeUserAndToken('editor')
    const res = await app.request('/admin-only', { headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` } })
    expect(res.status).toBe(403)
  })

  it('allows a user whose role matches one of the allowed roles', async () => {
    const app = buildApp()
    const token = await makeUserAndToken('editor')
    const res = await app.request('/editor-or-admin', { headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` } })
    expect(res.status).toBe(200)
  })

  it('allows admin through an admin-only route', async () => {
    const app = buildApp()
    const token = await makeUserAndToken('admin')
    const res = await app.request('/admin-only', { headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` } })
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:worker -- middleware-auth.test.ts`
Expected: FAIL — "Cannot find module '../src/middleware/auth'" (and `HonoEnv`'s `Variables` type doesn't yet include `user`).

- [ ] **Step 3: Update `worker/src/types.ts`**

```typescript
import type { AuthUser } from './lib/session'

export type Bindings = {
  giapha_db: D1Database
  giapha_avatars: R2Bucket
}

export type HonoEnv = {
  Bindings: Bindings
  Variables: {
    user: AuthUser | null
  }
}
```

- [ ] **Step 4: Implement `worker/src/middleware/auth.ts`**

```typescript
import { createMiddleware } from 'hono/factory'
import { getCookie } from 'hono/cookie'
import { drizzle } from 'drizzle-orm/d1'
import { getSessionUser, SESSION_COOKIE_NAME, type AuthUser } from '../lib/session'
import type { HonoEnv } from '../types'

/** Resolves the session cookie (if any) into `c.get('user')`, or sets it to null. Never blocks the request. */
export const attachUser = createMiddleware<HonoEnv>(async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE_NAME)
  if (!token) {
    c.set('user', null)
    await next()
    return
  }
  const db = drizzle(c.env.giapha_db)
  const user = await getSessionUser(db, token)
  c.set('user', user)
  await next()
})

/** Route guard: 401 if not logged in, 403 if logged in but role isn't in `allowedRoles`. */
export function requireRole(...allowedRoles: AuthUser['role'][]) {
  return createMiddleware<HonoEnv>(async (c, next) => {
    const user = c.get('user')
    if (!user) return c.json({ error: 'Cần đăng nhập' }, 401)
    if (!allowedRoles.includes(user.role)) return c.json({ error: 'Không có quyền truy cập' }, 403)
    await next()
  })
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test:worker -- middleware-auth.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 6: Commit**

```bash
git add worker/src/types.ts worker/src/middleware/auth.ts worker/test/middleware-auth.test.ts
git commit -m "feat: add attachUser and requireRole auth middleware"
```

---

## Task 6: Auth routes (`/auth/me`, `/auth/setup`, `/auth/login`, `/auth/logout`)

**Files:**
- Create: `worker/src/routes/auth.ts`
- Test: `worker/test/routes-auth.test.ts`

- [ ] **Step 1: Write the failing test**

`worker/test/routes-auth.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import { env, SELF } from 'cloudflare:test'
import { users } from '../src/db/schema'

function extractSessionCookie(res: Response): string {
  const setCookie = res.headers.get('set-cookie') ?? ''
  const match = setCookie.match(/giapha_session=([^;]+)/)
  if (!match) throw new Error(`No session cookie in: ${setCookie}`)
  return match[1]
}

beforeEach(async () => {
  const db = drizzle(env.giapha_db)
  await db.delete(users)
})

describe('GET /api/auth/me', () => {
  it('reports setupNeeded: true when there are no users yet', async () => {
    const res = await SELF.fetch('http://example.com/api/auth/me')
    const body = await res.json<{ user: null; setupNeeded: boolean }>()
    expect(body).toEqual({ user: null, setupNeeded: true })
  })
})

describe('POST /api/auth/setup', () => {
  it('creates the first admin user and logs them in', async () => {
    const res = await SELF.fetch('http://example.com/api/auth/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'supersecret1', email: 'admin@example.com' }),
    })
    expect(res.status).toBe(201)
    const body = await res.json<{ user: { username: string; role: string } }>()
    expect(body.user).toMatchObject({ username: 'admin', role: 'admin' })
    expect(res.headers.get('set-cookie')).toMatch(/giapha_session=/)
  })

  it('rejects setup if a user already exists', async () => {
    await SELF.fetch('http://example.com/api/auth/setup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'supersecret1', email: 'admin@example.com' }),
    })
    const res = await SELF.fetch('http://example.com/api/auth/setup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin2', password: 'supersecret1', email: 'admin2@example.com' }),
    })
    expect(res.status).toBe(409)
  })
})

describe('POST /api/auth/login', () => {
  async function setupAdmin() {
    await SELF.fetch('http://example.com/api/auth/setup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'supersecret1', email: 'admin@example.com' }),
    })
  }

  it('logs in with correct credentials', async () => {
    await setupAdmin()
    const res = await SELF.fetch('http://example.com/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'supersecret1' }),
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('set-cookie')).toMatch(/giapha_session=/)
  })

  it('rejects incorrect password with 401', async () => {
    await setupAdmin()
    const res = await SELF.fetch('http://example.com/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrong' }),
    })
    expect(res.status).toBe(401)
  })

  it('rejects an unknown username with 401', async () => {
    await setupAdmin()
    const res = await SELF.fetch('http://example.com/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'no-such-user', password: 'supersecret1' }),
    })
    expect(res.status).toBe(401)
  })

  it('logs in using the email address in place of the username', async () => {
    await setupAdmin()
    const res = await SELF.fetch('http://example.com/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin@example.com', password: 'supersecret1' }),
    })
    expect(res.status).toBe(200)
  })
})

describe('POST /api/auth/logout', () => {
  it('clears the session so /auth/me returns user: null again', async () => {
    await SELF.fetch('http://example.com/api/auth/setup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'supersecret1', email: 'admin@example.com' }),
    })
    const loginRes = await SELF.fetch('http://example.com/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'supersecret1' }),
    })
    const cookie = extractSessionCookie(loginRes)
    const meBefore = await SELF.fetch('http://example.com/api/auth/me', { headers: { Cookie: `giapha_session=${cookie}` } })
    expect((await meBefore.json<{ user: unknown }>()).user).not.toBeNull()

    await SELF.fetch('http://example.com/api/auth/logout', { method: 'POST', headers: { Cookie: `giapha_session=${cookie}` } })
    const meAfter = await SELF.fetch('http://example.com/api/auth/me', { headers: { Cookie: `giapha_session=${cookie}` } })
    expect((await meAfter.json<{ user: unknown }>()).user).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:worker -- routes-auth.test.ts`
Expected: FAIL — `/api/auth/me` returns 404 (route not mounted / doesn't exist yet).

- [ ] **Step 3: Implement `worker/src/routes/auth.ts`**

```typescript
import { Hono } from 'hono'
import { setCookie, deleteCookie } from 'hono/cookie'
import { getCookie } from 'hono/cookie'
import { drizzle } from 'drizzle-orm/d1'
import { eq, or, count } from 'drizzle-orm'
import { users } from '../db/schema'
import { hashPassword, verifyPassword } from '../lib/password'
import { createSession, deleteSession, SESSION_COOKIE_NAME, SESSION_DURATION_MS } from '../lib/session'
import type { HonoEnv } from '../types'

const authRoutes = new Hono<HonoEnv>()

function setSessionCookie(c: Parameters<Parameters<typeof authRoutes.get>[1]>[0], token: string) {
  setCookie(c, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_DURATION_MS / 1000,
  })
}

authRoutes.get('/auth/me', async (c) => {
  const db = drizzle(c.env.giapha_db)
  const [{ total }] = await db.select({ total: count() }).from(users)
  const user = c.get('user')
  return c.json({ user, setupNeeded: total === 0 })
})

authRoutes.post('/auth/setup', async (c) => {
  const db = drizzle(c.env.giapha_db)
  const [{ total }] = await db.select({ total: count() }).from(users)
  if (total > 0) return c.json({ error: 'Hệ thống đã có người quản trị' }, 409)

  const body = await c.req.json<{ username: string; password: string; email: string }>()
  if (!body.username?.trim() || !body.password || !body.email?.trim()) {
    return c.json({ error: 'Thiếu username, password hoặc email' }, 400)
  }
  const id = crypto.randomUUID()
  const passwordHash = await hashPassword(body.password)
  await db.insert(users).values({ id, username: body.username.trim(), passwordHash, role: 'admin', email: body.email.trim() })
  const token = await createSession(db, id)
  setSessionCookie(c, token)
  return c.json({ user: { id, username: body.username.trim(), role: 'admin', email: body.email.trim(), personId: null } }, 201)
})

authRoutes.post('/auth/login', async (c) => {
  const db = drizzle(c.env.giapha_db)
  const body = await c.req.json<{ username: string; password: string }>()
  const identifier = body.username ?? ''
  // Accepts either username or email in the same field, per spec ("username-hoặc-email + password").
  const row = await db.select().from(users)
    .where(or(eq(users.username, identifier), eq(users.email, identifier)))
    .get()
  if (!row || !row.isActive || !(await verifyPassword(body.password ?? '', row.passwordHash))) {
    return c.json({ error: 'Sai tên đăng nhập hoặc mật khẩu' }, 401)
  }
  const token = await createSession(db, row.id)
  setSessionCookie(c, token)
  return c.json({ user: { id: row.id, username: row.username, role: row.role, email: row.email, personId: row.personId } })
})

authRoutes.post('/auth/logout', async (c) => {
  const db = drizzle(c.env.giapha_db)
  const token = getCookie(c, SESSION_COOKIE_NAME)
  if (token) await deleteSession(db, token)
  deleteCookie(c, SESSION_COOKIE_NAME, { path: '/' })
  return c.json({ ok: true })
})

export default authRoutes
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:worker -- routes-auth.test.ts`
Expected: FAIL still — routes aren't mounted in `worker/src/index.ts` yet, which is Task 7. Confirm the failure is specifically 404s from unmounted routes (not a code error in `auth.ts` itself) by checking the error output mentions 404, then proceed to Task 7 before re-running.

- [ ] **Step 5: Commit**

```bash
git add worker/src/routes/auth.ts worker/test/routes-auth.test.ts
git commit -m "feat: add auth routes (me/setup/login/logout)"
```

---

## Task 7: Wire auth into `index.ts`; restrict CSV export/import to admin

**Files:**
- Modify: `worker/src/index.ts`
- Modify: `worker/src/routes/csv.ts`
- Test: `worker/test/routes-auth.test.ts` (re-run, should now pass), `worker/test/routes-csv-auth.test.ts` (new)

- [ ] **Step 1: Read current `worker/src/index.ts` route mounting**

It currently mounts routes roughly as:
```typescript
app.route('/api', treeRoutes)
app.route('/api', editorRoutes)
app.route('/api', csvRoutes)
```
(exact existing middleware/cors setup stays unchanged — only add `attachUser` and mount `authRoutes`).

- [ ] **Step 2: Modify `worker/src/index.ts`**

Add near the top of the file:
```typescript
import { attachUser } from './middleware/auth'
import authRoutes from './routes/auth'
```

Add the middleware before existing route mounts (after CORS middleware, before `app.route(...)` calls):
```typescript
app.use('*', attachUser)
app.route('/api', authRoutes)
```

- [ ] **Step 3: Run auth route tests to verify Task 6 now passes end-to-end**

Run: `npm run test:worker -- routes-auth.test.ts`
Expected: PASS — all 6 tests (setup/login/logout/me).

- [ ] **Step 4: Write the failing CSV-auth test**

`worker/test/routes-csv-auth.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import { env, SELF } from 'cloudflare:test'
import { users } from '../src/db/schema'
import { createSession, SESSION_COOKIE_NAME } from '../src/lib/session'

beforeEach(async () => {
  const db = drizzle(env.giapha_db)
  await db.delete(users)
})

async function tokenFor(role: 'admin' | 'editor' | 'viewer') {
  const db = drizzle(env.giapha_db)
  const id = crypto.randomUUID()
  await db.insert(users).values({ id, username: `u-${id}`, passwordHash: 'x', role, email: 'a@example.com' })
  return createSession(db, id)
}

describe('GET /api/export/csv authorization', () => {
  it('rejects anonymous requests with 401', async () => {
    const res = await SELF.fetch('http://example.com/api/export/csv')
    expect(res.status).toBe(401)
  })

  it('rejects editor requests with 403', async () => {
    const token = await tokenFor('editor')
    const res = await SELF.fetch('http://example.com/api/export/csv', { headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` } })
    expect(res.status).toBe(403)
  })

  it('allows admin requests', async () => {
    const token = await tokenFor('admin')
    const res = await SELF.fetch('http://example.com/api/export/csv', { headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` } })
    expect(res.status).toBe(200)
  })
})

describe('POST /api/import/csv authorization', () => {
  it('rejects editor requests with 403', async () => {
    const token = await tokenFor('editor')
    const formData = new FormData()
    formData.append('file', new Blob(['id,name\n']), 'test.csv')
    const res = await SELF.fetch('http://example.com/api/import/csv', {
      method: 'POST', headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` }, body: formData,
    })
    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npm run test:worker -- routes-csv-auth.test.ts`
Expected: FAIL — export/import currently return 200/other status for anonymous/editor (no guard yet).

- [ ] **Step 6: Modify `worker/src/routes/csv.ts`**

At the top of the file, add:
```typescript
import { requireRole } from '../middleware/auth'
```

Find the existing route definitions (e.g. `csvRoutes.get('/export/csv', async (c) => { ... })` and `csvRoutes.post('/import/csv', async (c) => { ... })`) and insert `requireRole('admin')` as middleware immediately before the handler:
```typescript
csvRoutes.get('/export/csv', requireRole('admin'), async (c) => {
  // ...existing handler body unchanged...
})

csvRoutes.post('/import/csv', requireRole('admin'), async (c) => {
  // ...existing handler body unchanged...
})
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm run test:worker -- routes-csv-auth.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 8: Run the full worker test suite to check for regressions**

Run: `npm run test:worker`
Expected: PASS — all suites (health, schema, password, session, middleware-auth, routes-auth, routes-csv-auth) green.

- [ ] **Step 9: Commit**

```bash
git add worker/src/index.ts worker/src/routes/csv.ts worker/test/routes-csv-auth.test.ts
git commit -m "feat: wire auth middleware into app; restrict CSV export/import to admin"
```

---

## Task 8: Refactor `editor.ts` — admin writes directly, editor creates `editor_requests`

**Files:**
- Modify: `worker/src/routes/editor.ts`
- Test: `worker/test/routes-editor-requests.test.ts`

This task extracts the existing direct-write logic into three reusable internal functions (`createPersonRecord`, `updatePersonRecord`, `deletePersonRecord`), then branches each route: **admin** calls the internal function directly (identical behavior to today); **editor** instead inserts a row into `editor_requests` and returns `202` without touching `persons`/`families`/`familyMembers`. The route also gains a `requireRole('admin', 'editor')` guard so anonymous/viewer requests are rejected before reaching this logic.

- [ ] **Step 1: Write the failing test**

`worker/test/routes-editor-requests.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import { env, SELF } from 'cloudflare:test'
import { users, persons, editorRequests } from '../src/db/schema'
import { eq } from 'drizzle-orm'
import { createSession, SESSION_COOKIE_NAME } from '../src/lib/session'

beforeEach(async () => {
  const db = drizzle(env.giapha_db)
  await db.delete(editorRequests)
  await db.delete(persons)
  await db.delete(users)
})

async function tokenFor(role: 'admin' | 'editor' | 'viewer') {
  const db = drizzle(env.giapha_db)
  const id = crypto.randomUUID()
  await db.insert(users).values({ id, username: `u-${id}`, passwordHash: 'x', role, email: 'a@example.com' })
  return { userId: id, token: await createSession(db, id) }
}

const samplePayload = {
  hoTen: 'Nguyễn Văn A', gioiTinh: 'nam' as const, laThanhVienHo: true, honNhan: [],
}

describe('POST /api/persons authorization + request flow', () => {
  it('rejects anonymous requests with 401', async () => {
    const res = await SELF.fetch('http://example.com/api/persons', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(samplePayload),
    })
    expect(res.status).toBe(401)
  })

  it('admin creates the person directly', async () => {
    const { token } = await tokenFor('admin')
    const res = await SELF.fetch('http://example.com/api/persons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: JSON.stringify(samplePayload),
    })
    expect(res.status).toBe(201)
    const db = drizzle(env.giapha_db)
    const rows = await db.select().from(persons).all()
    expect(rows).toHaveLength(1)
    const requests = await db.select().from(editorRequests).all()
    expect(requests).toHaveLength(0)
  })

  it('editor creates an editor_requests row instead of a person', async () => {
    const { token, userId } = await tokenFor('editor')
    const res = await SELF.fetch('http://example.com/api/persons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: JSON.stringify(samplePayload),
    })
    expect(res.status).toBe(202)
    const body = await res.json<{ requestId: string }>()
    expect(body.requestId).toBeTruthy()

    const db = drizzle(env.giapha_db)
    expect(await db.select().from(persons).all()).toHaveLength(0)
    const requests = await db.select().from(editorRequests).all()
    expect(requests).toHaveLength(1)
    expect(requests[0]).toMatchObject({ type: 'create', personId: null, submittedBy: userId, status: 'pending' })
    expect(JSON.parse(requests[0].payload!)).toMatchObject({ hoTen: 'Nguyễn Văn A' })
  })
})

describe('PUT /api/persons/:id authorization + request flow', () => {
  it('editor update creates a pending request tied to the person', async () => {
    const { token: adminToken } = await tokenFor('admin')
    const createRes = await SELF.fetch('http://example.com/api/persons', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${adminToken}` },
      body: JSON.stringify(samplePayload),
    })
    const { id: personId } = await createRes.json<{ id: string }>()

    const { token: editorToken } = await tokenFor('editor')
    const res = await SELF.fetch(`http://example.com/api/persons/${personId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${editorToken}` },
      body: JSON.stringify({ ...samplePayload, hoTen: 'Nguyễn Văn B' }),
    })
    expect(res.status).toBe(202)
    const db = drizzle(env.giapha_db)
    const unchanged = await db.select().from(persons).where(eq(persons.id, personId)).get()
    expect(unchanged?.name).toBe('Nguyễn Văn A')
    const requests = await db.select().from(editorRequests).all()
    expect(requests[0]).toMatchObject({ type: 'update', personId, status: 'pending' })
  })

  it('rejects a second pending edit request for the same person with 409', async () => {
    const { token: adminToken } = await tokenFor('admin')
    const createRes = await SELF.fetch('http://example.com/api/persons', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${adminToken}` },
      body: JSON.stringify(samplePayload),
    })
    const { id: personId } = await createRes.json<{ id: string }>()
    const { token: editorToken } = await tokenFor('editor')
    await SELF.fetch(`http://example.com/api/persons/${personId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${editorToken}` },
      body: JSON.stringify(samplePayload),
    })
    const secondRes = await SELF.fetch(`http://example.com/api/persons/${personId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${editorToken}` },
      body: JSON.stringify(samplePayload),
    })
    expect(secondRes.status).toBe(409)
  })
})

describe('DELETE /api/persons/:id authorization + request flow', () => {
  it('editor delete creates a pending request; person still exists', async () => {
    const { token: adminToken } = await tokenFor('admin')
    const createRes = await SELF.fetch('http://example.com/api/persons', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${adminToken}` },
      body: JSON.stringify(samplePayload),
    })
    const { id: personId } = await createRes.json<{ id: string }>()
    const { token: editorToken } = await tokenFor('editor')
    const res = await SELF.fetch(`http://example.com/api/persons/${personId}`, {
      method: 'DELETE', headers: { Cookie: `${SESSION_COOKIE_NAME}=${editorToken}` },
    })
    expect(res.status).toBe(202)
    const db = drizzle(env.giapha_db)
    expect(await db.select().from(persons).where(eq(persons.id, personId)).get()).toBeTruthy()
    const requests = await db.select().from(editorRequests).all()
    expect(requests[0]).toMatchObject({ type: 'delete', personId, payload: null, status: 'pending' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:worker -- routes-editor-requests.test.ts`
Expected: FAIL — currently every request writes directly regardless of role (no auth guard, no request-branching logic yet).

- [ ] **Step 3: Rewrite `worker/src/routes/editor.ts`**

Keep `syncParents`, `syncMarriages`, `FamilyHasChildrenError`, `PersonPayload`, and `toPersonRow` exactly as they are today (unchanged — shown above in the codebase reconnaissance). Replace everything from the `editorRoutes.post('/persons', ...)` line to the end of the file with:

```typescript
import { requireRole } from '../middleware/auth'
import { editorRequests } from '../db/schema'

// ─── Internal record operations (reused by both direct-admin-write and the
// approve-request flow in requests.ts) ─────────────────────────────────────

export async function createPersonRecord(db: DB, body: PersonPayload): Promise<string> {
  const id = crypto.randomUUID()
  await db.insert(persons).values({ id, ...toPersonRow(body) })
  await syncParents(db, id, body.boId ?? null, body.meId ?? null, body.thuTuAnhChi ?? null)
  await syncMarriages(db, id, mapGioiTinhToGender(body.gioiTinh), body.honNhan ?? [])
  return id
}

export async function updatePersonRecord(db: DB, id: string, body: PersonPayload): Promise<void> {
  await db.update(persons)
    .set({ ...toPersonRow(body), updatedAt: new Date().toISOString() })
    .where(eq(persons.id, id))
  await syncParents(db, id, body.boId ?? null, body.meId ?? null, body.thuTuAnhChi ?? null)
  await syncMarriages(db, id, mapGioiTinhToGender(body.gioiTinh), body.honNhan ?? [])
}

export async function deletePersonRecord(db: DB, personId: string): Promise<void> {
  const membership = await db.select({ familyId: familyMembers.familyId }).from(familyMembers)
    .where(eq(familyMembers.personId, personId)).get()
  const [parentFamilies1, parentFamilies2] = await Promise.all([
    db.select({ id: families.id }).from(families).where(eq(families.parent1Id, personId)).all(),
    db.select({ id: families.id }).from(families).where(eq(families.parent2Id, personId)).all(),
  ])
  const parentFamilyIds = [...parentFamilies1, ...parentFamilies2].map(f => f.id)

  await db.delete(persons).where(eq(persons.id, personId))

  if (membership) {
    const [{ remaining }] = await db.select({ remaining: count() }).from(familyMembers)
      .where(eq(familyMembers.familyId, membership.familyId))
    if (remaining === 0) await db.delete(families).where(eq(families.id, membership.familyId))
  }

  for (const familyId of parentFamilyIds) {
    const family = await db.select({ p1: families.parent1Id, p2: families.parent2Id }).from(families)
      .where(eq(families.id, familyId)).get()
    if (family && family.p1 === null && family.p2 === null) {
      await db.delete(families).where(eq(families.id, familyId))
    }
  }
}

async function hasPendingRequest(db: DB, personId: string): Promise<boolean> {
  const existing = await db.select({ id: editorRequests.id }).from(editorRequests)
    .where(and(eq(editorRequests.personId, personId), eq(editorRequests.status, 'pending'))).get()
  return !!existing
}

// ─── Routes ────────────────────────────────────────────────────────────────

editorRoutes.post('/persons', requireRole('admin', 'editor'), async (c) => {
  const body = await c.req.json<PersonPayload>()
  if (!body.hoTen?.trim()) return c.json({ error: 'hoTen is required' }, 400)
  const db = drizzle(c.env.giapha_db) as DB
  const user = c.get('user')!

  if (user.role === 'admin') {
    try {
      const id = await createPersonRecord(db, body)
      return c.json({ id }, 201)
    } catch (err) {
      if (err instanceof FamilyHasChildrenError) return c.json({ error: err.message }, 409)
      throw err
    }
  }

  const requestId = crypto.randomUUID()
  await db.insert(editorRequests).values({
    id: requestId, type: 'create', personId: null,
    payload: JSON.stringify(body), submittedBy: user.id, status: 'pending',
  })
  return c.json({ pending: true, requestId }, 202)
})

editorRoutes.put('/persons/:id', requireRole('admin', 'editor'), async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json<PersonPayload>()
  if (!body.hoTen?.trim()) return c.json({ error: 'hoTen is required' }, 400)
  const db = drizzle(c.env.giapha_db) as DB
  const user = c.get('user')!

  if (user.role === 'admin') {
    try {
      await updatePersonRecord(db, id, body)
      return c.json({ ok: true })
    } catch (err) {
      if (err instanceof FamilyHasChildrenError) return c.json({ error: err.message }, 409)
      throw err
    }
  }

  if (await hasPendingRequest(db, id)) {
    return c.json({ error: 'Người này đã có một yêu cầu đang chờ duyệt' }, 409)
  }
  const requestId = crypto.randomUUID()
  await db.insert(editorRequests).values({
    id: requestId, type: 'update', personId: id,
    payload: JSON.stringify(body), submittedBy: user.id, status: 'pending',
  })
  return c.json({ pending: true, requestId }, 202)
})

editorRoutes.delete('/persons/:id', requireRole('admin', 'editor'), async (c) => {
  const personId = c.req.param('id')
  const db = drizzle(c.env.giapha_db) as DB
  const user = c.get('user')!

  if (user.role === 'admin') {
    await deletePersonRecord(db, personId)
    return c.json({ ok: true })
  }

  if (await hasPendingRequest(db, personId)) {
    return c.json({ error: 'Người này đã có một yêu cầu đang chờ duyệt' }, 409)
  }
  const requestId = crypto.randomUUID()
  await db.insert(editorRequests).values({
    id: requestId, type: 'delete', personId, payload: null, submittedBy: user.id, status: 'pending',
  })
  return c.json({ pending: true, requestId }, 202)
})

editorRoutes.post('/persons/:id/avatar', requireRole('admin', 'editor'), async (c) => {
  const db = drizzle(c.env.giapha_db) as DB
  const personId = c.req.param('id')
  const user = c.get('user')!
  const formData = await c.req.formData()
  const file = formData.get('file') as File | null
  if (!file) return c.json({ error: 'Missing file' }, 400)

  const ext = file.name.split('.').pop() ?? 'jpg'
  const key = `avatars/${personId}.${ext}`
  await c.env.giapha_avatars.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  })

  if (user.role === 'admin') {
    await db.update(persons).set({ avatarKey: key, updatedAt: new Date().toISOString() }).where(eq(persons.id, personId))
    return c.json({ avatarUrl: `/api/avatars/${key}` })
  }

  // Editor: file is already uploaded to its final R2 key (harmless if the
  // request is later rejected — it simply becomes an orphaned object), but
  // the `persons` row is only updated once an admin approves the request.
  if (await hasPendingRequest(db, personId)) {
    return c.json({ error: 'Người này đã có một yêu cầu đang chờ duyệt' }, 409)
  }
  const requestId = crypto.randomUUID()
  await db.insert(editorRequests).values({
    id: requestId, type: 'update', personId,
    payload: JSON.stringify({ avatarKey: key }), submittedBy: user.id, status: 'pending',
  })
  return c.json({ pending: true, requestId, avatarUrl: `/api/avatars/${key}` }, 202)
})

export default editorRoutes
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:worker -- routes-editor-requests.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Run the full worker test suite to check for regressions**

Run: `npm run test:worker`
Expected: PASS — all suites green (including previously-passing editor tests, if any existed before this feature; re-check any pre-existing `worker/test/editor*.test.ts` files for role-based fixture updates if they fail due to the new `requireRole` guard).

- [ ] **Step 6: Commit**

```bash
git add worker/src/routes/editor.ts worker/test/routes-editor-requests.test.ts
git commit -m "feat: editor mutations create editor_requests; admin writes directly"
```

---

## Task 9: Request review routes (`worker/src/routes/requests.ts`)

**Files:**
- Create: `worker/src/routes/requests.ts`
- Modify: `worker/src/index.ts`
- Test: `worker/test/routes-requests.test.ts`

Editors see only their own requests; admins see all. Approve applies the stored payload via the Task 8 internal functions (`createPersonRecord`/`updatePersonRecord`/`deletePersonRecord`) and marks the row `approved`. Reject just marks it `rejected` — no data changes.

- [ ] **Step 1: Write the failing test**

`worker/test/routes-requests.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import { env, SELF } from 'cloudflare:test'
import { eq } from 'drizzle-orm'
import { users, persons, editorRequests } from '../src/db/schema'
import { createSession, SESSION_COOKIE_NAME } from '../src/lib/session'

beforeEach(async () => {
  const db = drizzle(env.giapha_db)
  await db.delete(editorRequests)
  await db.delete(persons)
  await db.delete(users)
})

async function tokenFor(role: 'admin' | 'editor' | 'viewer') {
  const db = drizzle(env.giapha_db)
  const id = crypto.randomUUID()
  await db.insert(users).values({ id, username: `u-${id}`, passwordHash: 'x', role, email: 'a@example.com' })
  return { userId: id, token: await createSession(db, id) }
}

const samplePayload = { hoTen: 'Nguyễn Văn A', gioiTinh: 'nam' as const, laThanhVienHo: true, honNhan: [] }

describe('GET /api/requests', () => {
  it('rejects anonymous and returns 401', async () => {
    const res = await SELF.fetch('http://example.com/api/requests')
    expect(res.status).toBe(401)
  })

  it('editor sees only their own requests', async () => {
    const editor1 = await tokenFor('editor')
    const editor2 = await tokenFor('editor')
    await SELF.fetch('http://example.com/api/persons', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${editor1.token}` },
      body: JSON.stringify(samplePayload),
    })
    await SELF.fetch('http://example.com/api/persons', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${editor2.token}` },
      body: JSON.stringify(samplePayload),
    })
    const res = await SELF.fetch('http://example.com/api/requests', { headers: { Cookie: `${SESSION_COOKIE_NAME}=${editor1.token}` } })
    const body = await res.json<{ requests: { submittedBy: string }[] }>()
    expect(body.requests).toHaveLength(1)
    expect(body.requests[0].submittedBy).toBe(editor1.userId)
  })

  it('admin sees all pending requests', async () => {
    const editor1 = await tokenFor('editor')
    const editor2 = await tokenFor('editor')
    const admin = await tokenFor('admin')
    await SELF.fetch('http://example.com/api/persons', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${editor1.token}` },
      body: JSON.stringify(samplePayload),
    })
    await SELF.fetch('http://example.com/api/persons', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${editor2.token}` },
      body: JSON.stringify(samplePayload),
    })
    const res = await SELF.fetch('http://example.com/api/requests', { headers: { Cookie: `${SESSION_COOKIE_NAME}=${admin.token}` } })
    const body = await res.json<{ requests: unknown[] }>()
    expect(body.requests).toHaveLength(2)
  })
})

describe('POST /api/requests/:id/approve', () => {
  it('rejects non-admin with 403', async () => {
    const editor = await tokenFor('editor')
    const createRes = await SELF.fetch('http://example.com/api/persons', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${editor.token}` },
      body: JSON.stringify(samplePayload),
    })
    const { requestId } = await createRes.json<{ requestId: string }>()
    const res = await SELF.fetch(`http://example.com/api/requests/${requestId}/approve`, {
      method: 'POST', headers: { Cookie: `${SESSION_COOKIE_NAME}=${editor.token}` },
    })
    expect(res.status).toBe(403)
  })

  it('approving a create request inserts the person and marks the request approved', async () => {
    const editor = await tokenFor('editor')
    const admin = await tokenFor('admin')
    const createRes = await SELF.fetch('http://example.com/api/persons', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${editor.token}` },
      body: JSON.stringify(samplePayload),
    })
    const { requestId } = await createRes.json<{ requestId: string }>()
    const res = await SELF.fetch(`http://example.com/api/requests/${requestId}/approve`, {
      method: 'POST', headers: { Cookie: `${SESSION_COOKIE_NAME}=${admin.token}` },
    })
    expect(res.status).toBe(200)

    const db = drizzle(env.giapha_db)
    const rows = await db.select().from(persons).all()
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Nguyễn Văn A')
    const request = await db.select().from(editorRequests).where(eq(editorRequests.id, requestId)).get()
    expect(request?.status).toBe('approved')
    expect(request?.resolvedBy).toBe(admin.userId)
    expect(request?.personId).toBe(rows[0].id)
  })

  it('approving an update request applies changes to the existing person', async () => {
    const editor = await tokenFor('editor')
    const admin = await tokenFor('admin')
    const createRes = await SELF.fetch('http://example.com/api/persons', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${admin.token}` },
      body: JSON.stringify(samplePayload),
    })
    const { id: personId } = await createRes.json<{ id: string }>()
    const updateRes = await SELF.fetch(`http://example.com/api/persons/${personId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${editor.token}` },
      body: JSON.stringify({ ...samplePayload, hoTen: 'Nguyễn Văn B' }),
    })
    const { requestId } = await updateRes.json<{ requestId: string }>()
    await SELF.fetch(`http://example.com/api/requests/${requestId}/approve`, {
      method: 'POST', headers: { Cookie: `${SESSION_COOKIE_NAME}=${admin.token}` },
    })
    const db = drizzle(env.giapha_db)
    const row = await db.select().from(persons).where(eq(persons.id, personId)).get()
    expect(row?.name).toBe('Nguyễn Văn B')
  })

  it('approving a delete request removes the person', async () => {
    const editor = await tokenFor('editor')
    const admin = await tokenFor('admin')
    const createRes = await SELF.fetch('http://example.com/api/persons', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${admin.token}` },
      body: JSON.stringify(samplePayload),
    })
    const { id: personId } = await createRes.json<{ id: string }>()
    const deleteRes = await SELF.fetch(`http://example.com/api/persons/${personId}`, {
      method: 'DELETE', headers: { Cookie: `${SESSION_COOKIE_NAME}=${editor.token}` },
    })
    const { requestId } = await deleteRes.json<{ requestId: string }>()
    await SELF.fetch(`http://example.com/api/requests/${requestId}/approve`, {
      method: 'POST', headers: { Cookie: `${SESSION_COOKIE_NAME}=${admin.token}` },
    })
    const db = drizzle(env.giapha_db)
    expect(await db.select().from(persons).where(eq(persons.id, personId)).get()).toBeUndefined()

    // The request row itself must survive (for audit), with its personId nulled out by
    // the FK's ON DELETE SET NULL rather than being cascade-deleted along with the person.
    const request = await db.select().from(editorRequests).where(eq(editorRequests.id, requestId)).get()
    expect(request?.status).toBe('approved')
    expect(request?.resolvedBy).toBe(admin.userId)
    expect(request?.personId).toBeNull()
  })
})

describe('POST /api/requests/:id/reject', () => {
  it('marks the request rejected without changing data', async () => {
    const editor = await tokenFor('editor')
    const admin = await tokenFor('admin')
    const createRes = await SELF.fetch('http://example.com/api/persons', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${editor.token}` },
      body: JSON.stringify(samplePayload),
    })
    const { requestId } = await createRes.json<{ requestId: string }>()
    const res = await SELF.fetch(`http://example.com/api/requests/${requestId}/reject`, {
      method: 'POST', headers: { Cookie: `${SESSION_COOKIE_NAME}=${admin.token}` },
    })
    expect(res.status).toBe(200)
    const db = drizzle(env.giapha_db)
    expect(await db.select().from(persons).all()).toHaveLength(0)
    const request = await db.select().from(editorRequests).where(eq(editorRequests.id, requestId)).get()
    expect(request?.status).toBe('rejected')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:worker -- routes-requests.test.ts`
Expected: FAIL — `/api/requests*` routes return 404 (not created/mounted yet).

- [ ] **Step 3: Implement `worker/src/routes/requests.ts`**

```typescript
import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { eq, desc } from 'drizzle-orm'
import { editorRequests } from '../db/schema'
import { requireRole } from '../middleware/auth'
import { createPersonRecord, updatePersonRecord, deletePersonRecord } from './editor'
import type { PersonPayload } from './editor'
import type { HonoEnv } from '../types'
import type { DB } from '../lib/reshape'

const requestRoutes = new Hono<HonoEnv>()

requestRoutes.get('/requests', requireRole('admin', 'editor'), async (c) => {
  const db = drizzle(c.env.giapha_db) as DB
  const user = c.get('user')!
  const rows = user.role === 'admin'
    ? await db.select().from(editorRequests).orderBy(desc(editorRequests.createdAt)).all()
    : await db.select().from(editorRequests).where(eq(editorRequests.submittedBy, user.id)).orderBy(desc(editorRequests.createdAt)).all()
  return c.json({ requests: rows })
})

requestRoutes.post('/requests/:id/approve', requireRole('admin'), async (c) => {
  const db = drizzle(c.env.giapha_db) as DB
  const user = c.get('user')!
  const id = c.req.param('id')
  const request = await db.select().from(editorRequests).where(eq(editorRequests.id, id)).get()
  if (!request) return c.json({ error: 'Không tìm thấy yêu cầu' }, 404)
  if (request.status !== 'pending') return c.json({ error: 'Yêu cầu đã được xử lý' }, 409)

  // For 'delete', mark the request approved *before* removing the person: `editor_requests.person_id`
  // has ON DELETE SET NULL, so deleting the person first would just null the column (harmless), but
  // updating the status afterward would still work fine too — this order simply keeps things predictable
  // and avoids ever reading a stale `request.personId` after the person row is gone.
  if (request.type === 'delete') {
    await db.update(editorRequests)
      .set({ status: 'approved', resolvedBy: user.id, resolvedAt: new Date().toISOString() })
      .where(eq(editorRequests.id, id))
    await deletePersonRecord(db, request.personId!)
    return c.json({ ok: true })
  }

  let createdPersonId: string | null = null
  if (request.type === 'create') {
    createdPersonId = await createPersonRecord(db, JSON.parse(request.payload!) as PersonPayload)
  } else {
    await updatePersonRecord(db, request.personId!, JSON.parse(request.payload!) as PersonPayload)
  }

  await db.update(editorRequests)
    .set({
      status: 'approved', resolvedBy: user.id, resolvedAt: new Date().toISOString(),
      ...(createdPersonId ? { personId: createdPersonId } : {}),
    })
    .where(eq(editorRequests.id, id))
  return c.json({ ok: true })
})

requestRoutes.post('/requests/:id/reject', requireRole('admin'), async (c) => {
  const db = drizzle(c.env.giapha_db) as DB
  const user = c.get('user')!
  const id = c.req.param('id')
  const request = await db.select().from(editorRequests).where(eq(editorRequests.id, id)).get()
  if (!request) return c.json({ error: 'Không tìm thấy yêu cầu' }, 404)
  if (request.status !== 'pending') return c.json({ error: 'Yêu cầu đã được xử lý' }, 409)

  await db.update(editorRequests)
    .set({ status: 'rejected', resolvedBy: user.id, resolvedAt: new Date().toISOString() })
    .where(eq(editorRequests.id, id))
  return c.json({ ok: true })
})

export default requestRoutes
```

- [ ] **Step 4: Export `PersonPayload` type from `editor.ts`**

In `worker/src/routes/editor.ts`, change the interface declaration line from `interface PersonPayload {` to `export interface PersonPayload {` (needed for the import in Step 3).

- [ ] **Step 5: Mount the routes in `worker/src/index.ts`**

Add near the other route imports:
```typescript
import requestRoutes from './routes/requests'
```
Add near the other `app.route('/api', ...)` calls:
```typescript
app.route('/api', requestRoutes)
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm run test:worker -- routes-requests.test.ts`
Expected: PASS — 7 tests.

- [ ] **Step 7: Run the full worker test suite to check for regressions**

Run: `npm run test:worker`
Expected: PASS — all suites green.

- [ ] **Step 8: Commit**

```bash
git add worker/src/routes/requests.ts worker/src/routes/editor.ts worker/src/index.ts worker/test/routes-requests.test.ts
git commit -m "feat: add editor_requests list/approve/reject routes"
```

---

## Task 10: Expose `pendingRequestId` on `GET /api/tree`

**Files:**
- Modify: `worker/src/routes/tree.ts`
- Test: `worker/test/routes-tree-pending.test.ts`

Each person in the tree response gets an optional `pendingRequestId` field, populated only when there is a pending `update` or `delete` editor request for that person (not `create`, since a create request has no existing `personId` to attach to).

- [ ] **Step 1: Write the failing test**

`worker/test/routes-tree-pending.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import { env, SELF } from 'cloudflare:test'
import { persons, editorRequests, users } from '../src/db/schema'

beforeEach(async () => {
  const db = drizzle(env.giapha_db)
  await db.delete(editorRequests)
  await db.delete(persons)
  await db.delete(users)
})

describe('GET /api/tree pendingRequestId', () => {
  it('omits pendingRequestId when there is no pending request', async () => {
    const db = drizzle(env.giapha_db)
    const id = crypto.randomUUID()
    await db.insert(persons).values({ id, name: 'A', gender: 'male', isAlive: true, ngoaiToc: false })
    const res = await SELF.fetch('http://example.com/api/tree')
    const body = await res.json<{ persons: Record<string, { pendingRequestId?: string }> }>()
    expect(body.persons[id].pendingRequestId).toBeUndefined()
  })

  it('includes pendingRequestId for a person with a pending update request', async () => {
    const db = drizzle(env.giapha_db)
    const personId = crypto.randomUUID()
    await db.insert(persons).values({ id: personId, name: 'A', gender: 'male', isAlive: true, ngoaiToc: false })
    const requestId = crypto.randomUUID()
    await db.insert(editorRequests).values({
      id: requestId, type: 'update', personId, payload: '{}', submittedBy: 'x', status: 'pending',
    })
    const res = await SELF.fetch('http://example.com/api/tree')
    const body = await res.json<{ persons: Record<string, { pendingRequestId?: string }> }>()
    expect(body.persons[personId].pendingRequestId).toBe(requestId)
  })

  it('does not include an approved request', async () => {
    const db = drizzle(env.giapha_db)
    const personId = crypto.randomUUID()
    await db.insert(persons).values({ id: personId, name: 'A', gender: 'male', isAlive: true, ngoaiToc: false })
    await db.insert(editorRequests).values({
      id: crypto.randomUUID(), type: 'update', personId, payload: '{}', submittedBy: 'x', status: 'approved',
    })
    const res = await SELF.fetch('http://example.com/api/tree')
    const body = await res.json<{ persons: Record<string, { pendingRequestId?: string }> }>()
    expect(body.persons[personId].pendingRequestId).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:worker -- routes-tree-pending.test.ts`
Expected: FAIL — `pendingRequestId` is never set today (test 2 fails).

- [ ] **Step 3: Modify `worker/src/routes/tree.ts`**

Add the import:
```typescript
import { eq } from 'drizzle-orm'
import { editorRequests } from '../db/schema'
```

Inside `treeRoutes.get('/tree', ...)`, add a query alongside the existing `Promise.all` (fetch pending requests keyed by `personId`), then attach the field when building `outPersons`:

```typescript
treeRoutes.get('/tree', async (c) => {
  const db = drizzle(c.env.giapha_db) as DB

  const [allPersons, allFamilies, allMembers, pendingRequests] = await Promise.all([
    db.select().from(persons).all(),
    db.select().from(families).all(),
    db.select().from(familyMembers).all(),
    db.select({ id: editorRequests.id, personId: editorRequests.personId })
      .from(editorRequests)
      .where(eq(editorRequests.status, 'pending'))
      .all(),
  ])
  const pendingRequestByPersonId = new Map(
    pendingRequests.filter(r => r.personId).map(r => [r.personId as string, r.id]),
  )

  // ...unchanged childOf/childrenOf/familyById/marriagesOf setup...

  const outPersons: Record<string, unknown> = {}
  for (const p of allPersons) {
    // ...unchanged membership/family/marriages setup...

    outPersons[p.id] = {
      // ...all existing fields unchanged...
      ghiChu: p.notes ?? undefined,
      pendingRequestId: pendingRequestByPersonId.get(p.id),
    }
  }

  return c.json({ metadata: await buildMetadata(db), persons: outPersons })
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:worker -- routes-tree-pending.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 5: Run the full worker test suite to check for regressions**

Run: `npm run test:worker`
Expected: PASS — all suites green.

- [ ] **Step 6: Commit**

```bash
git add worker/src/routes/tree.ts worker/test/routes-tree-pending.test.ts
git commit -m "feat: expose pendingRequestId on GET /api/tree"
```

---

## Task 11: User management routes (`worker/src/routes/users.ts`, admin-only)

**Files:**
- Create: `worker/src/routes/users.ts`
- Modify: `worker/src/index.ts`
- Test: `worker/test/routes-users.test.ts`

Admin-only CRUD over the `users` table. A user can optionally be linked 1-1 to a `person` via `personId` (nullable, unique). The last remaining admin cannot be deleted or demoted — this guards against the family losing all admin access.

- [ ] **Step 1: Write the failing test**

`worker/test/routes-users.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import { env, SELF } from 'cloudflare:test'
import { eq } from 'drizzle-orm'
import { users } from '../src/db/schema'
import { createSession, SESSION_COOKIE_NAME } from '../src/lib/session'
import { hashPassword } from '../src/lib/password'

beforeEach(async () => {
  const db = drizzle(env.giapha_db)
  await db.delete(users)
})

async function makeAdmin() {
  const db = drizzle(env.giapha_db)
  const id = crypto.randomUUID()
  await db.insert(users).values({ id, username: 'root-admin', passwordHash: await hashPassword('x'), role: 'admin', email: 'a@example.com' })
  return { userId: id, token: await createSession(db, id) }
}

async function makeEditorToken() {
  const db = drizzle(env.giapha_db)
  const id = crypto.randomUUID()
  await db.insert(users).values({ id, username: 'ed', passwordHash: 'x', role: 'editor', email: 'e@example.com' })
  return createSession(db, id)
}

describe('GET /api/users', () => {
  it('rejects non-admin with 403', async () => {
    const token = await makeEditorToken()
    const res = await SELF.fetch('http://example.com/api/users', { headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` } })
    expect(res.status).toBe(403)
  })

  it('admin lists users without exposing passwordHash', async () => {
    const { token } = await makeAdmin()
    const res = await SELF.fetch('http://example.com/api/users', { headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` } })
    const body = await res.json<{ users: Record<string, unknown>[] }>()
    expect(body.users).toHaveLength(1)
    expect(body.users[0]).not.toHaveProperty('passwordHash')
  })
})

describe('POST /api/users', () => {
  it('admin creates an editor user', async () => {
    const { token } = await makeAdmin()
    const res = await SELF.fetch('http://example.com/api/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: JSON.stringify({ username: 'editor1', password: 'password123', role: 'editor', email: 'ed1@example.com' }),
    })
    expect(res.status).toBe(201)
    const body = await res.json<{ user: { username: string; role: string } }>()
    expect(body.user).toMatchObject({ username: 'editor1', role: 'editor' })
    expect(body.user).not.toHaveProperty('passwordHash')
  })

  it('rejects a duplicate username with 409', async () => {
    const { token } = await makeAdmin()
    await SELF.fetch('http://example.com/api/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: JSON.stringify({ username: 'dup', password: 'password123', role: 'editor', email: 'a@example.com' }),
    })
    const res = await SELF.fetch('http://example.com/api/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: JSON.stringify({ username: 'dup', password: 'password123', role: 'editor', email: 'b@example.com' }),
    })
    expect(res.status).toBe(409)
  })
})

describe('PUT /api/users/:id', () => {
  it('admin updates a user role', async () => {
    const { token } = await makeAdmin()
    const createRes = await SELF.fetch('http://example.com/api/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: JSON.stringify({ username: 'promote-me', password: 'password123', role: 'editor', email: 'p@example.com' }),
    })
    const { user } = await createRes.json<{ user: { id: string } }>()
    const res = await SELF.fetch(`http://example.com/api/users/${user.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: JSON.stringify({ role: 'admin' }),
    })
    expect(res.status).toBe(200)
    const db = drizzle(env.giapha_db)
    const row = await db.select().from(users).where(eq(users.id, user.id)).get()
    expect(row?.role).toBe('admin')
  })

  it('rejects demoting the last remaining admin with 409', async () => {
    const { token, userId } = await makeAdmin()
    const res = await SELF.fetch(`http://example.com/api/users/${userId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: JSON.stringify({ role: 'editor' }),
    })
    expect(res.status).toBe(409)
  })
})

describe('DELETE /api/users/:id', () => {
  it('rejects deleting the last remaining admin with 409', async () => {
    const { token, userId } = await makeAdmin()
    const res = await SELF.fetch(`http://example.com/api/users/${userId}`, {
      method: 'DELETE', headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` },
    })
    expect(res.status).toBe(409)
  })

  it('deletes a non-last-admin user', async () => {
    const { token } = await makeAdmin()
    const createRes = await SELF.fetch('http://example.com/api/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: JSON.stringify({ username: 'remove-me', password: 'password123', role: 'editor', email: 'r@example.com' }),
    })
    const { user } = await createRes.json<{ user: { id: string } }>()
    const res = await SELF.fetch(`http://example.com/api/users/${user.id}`, {
      method: 'DELETE', headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` },
    })
    expect(res.status).toBe(200)
    const db = drizzle(env.giapha_db)
    expect(await db.select().from(users).where(eq(users.id, user.id)).get()).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:worker -- routes-users.test.ts`
Expected: FAIL — `/api/users*` routes return 404 (not created yet).

- [ ] **Step 3: Implement `worker/src/routes/users.ts`**

```typescript
import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'
import { eq, and, ne, count } from 'drizzle-orm'
import { users } from '../db/schema'
import { requireRole } from '../middleware/auth'
import { hashPassword } from '../lib/password'
import type { HonoEnv } from '../types'

const userRoutes = new Hono<HonoEnv>()

function toPublicUser(row: typeof users.$inferSelect) {
  const { passwordHash: _passwordHash, ...rest } = row
  return rest
}

async function countOtherAdmins(db: ReturnType<typeof drizzle>, excludeUserId: string): Promise<number> {
  const [{ total }] = await db.select({ total: count() }).from(users)
    .where(and(eq(users.role, 'admin'), ne(users.id, excludeUserId)))
  return total
}

userRoutes.get('/users', requireRole('admin'), async (c) => {
  const db = drizzle(c.env.giapha_db)
  const rows = await db.select().from(users).all()
  return c.json({ users: rows.map(toPublicUser) })
})

userRoutes.post('/users', requireRole('admin'), async (c) => {
  const db = drizzle(c.env.giapha_db)
  const body = await c.req.json<{ username: string; password: string; role: 'admin' | 'editor' | 'viewer'; email: string; personId?: string }>()
  if (!body.username?.trim() || !body.password || !body.email?.trim()) {
    return c.json({ error: 'Thiếu username, password hoặc email' }, 400)
  }
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.username, body.username.trim())).get()
  if (existing) return c.json({ error: 'Tên đăng nhập đã tồn tại' }, 409)

  const id = crypto.randomUUID()
  const passwordHash = await hashPassword(body.password)
  await db.insert(users).values({
    id, username: body.username.trim(), passwordHash, role: body.role,
    email: body.email.trim(), personId: body.personId ?? null,
  })
  const row = await db.select().from(users).where(eq(users.id, id)).get()
  return c.json({ user: toPublicUser(row!) }, 201)
})

userRoutes.put('/users/:id', requireRole('admin'), async (c) => {
  const db = drizzle(c.env.giapha_db)
  const id = c.req.param('id')
  const target = await db.select().from(users).where(eq(users.id, id)).get()
  if (!target) return c.json({ error: 'Không tìm thấy người dùng' }, 404)

  const body = await c.req.json<{ role?: 'admin' | 'editor' | 'viewer'; email?: string; personId?: string | null; isActive?: boolean; password?: string }>()

  if (body.role && body.role !== 'admin' && target.role === 'admin') {
    const otherAdmins = await countOtherAdmins(db, id)
    if (otherAdmins === 0) return c.json({ error: 'Không thể hạ quyền admin cuối cùng' }, 409)
  }

  const updates: Partial<typeof users.$inferInsert> = {}
  if (body.role !== undefined) updates.role = body.role
  if (body.email !== undefined) updates.email = body.email.trim()
  if (body.personId !== undefined) updates.personId = body.personId
  if (body.isActive !== undefined) updates.isActive = body.isActive
  if (body.password) updates.passwordHash = await hashPassword(body.password)

  await db.update(users).set(updates).where(eq(users.id, id))
  const row = await db.select().from(users).where(eq(users.id, id)).get()
  return c.json({ user: toPublicUser(row!) })
})

userRoutes.delete('/users/:id', requireRole('admin'), async (c) => {
  const db = drizzle(c.env.giapha_db)
  const id = c.req.param('id')
  const target = await db.select().from(users).where(eq(users.id, id)).get()
  if (!target) return c.json({ error: 'Không tìm thấy người dùng' }, 404)

  if (target.role === 'admin') {
    const otherAdmins = await countOtherAdmins(db, id)
    if (otherAdmins === 0) return c.json({ error: 'Không thể xóa admin cuối cùng' }, 409)
  }

  await db.delete(users).where(eq(users.id, id))
  return c.json({ ok: true })
})

export default userRoutes
```

- [ ] **Step 4: Mount the routes in `worker/src/index.ts`**

Add near the other route imports:
```typescript
import userRoutes from './routes/users'
```
Add near the other `app.route('/api', ...)` calls:
```typescript
app.route('/api', userRoutes)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test:worker -- routes-users.test.ts`
Expected: PASS — 8 tests.

- [ ] **Step 6: Run the full worker test suite to check for regressions**

Run: `npm run test:worker`
Expected: PASS — all suites green. This completes all backend work.

- [ ] **Step 7: Commit**

```bash
git add worker/src/routes/users.ts worker/src/index.ts worker/test/routes-users.test.ts
git commit -m "feat: add admin-only user management routes"
```

---

## Task 12: Frontend types + API client additions

**Files:**
- Modify: `src/types/giapha.ts`
- Modify: `src/services/api.ts`
- Test: `src/services/api.test.ts`

- [ ] **Step 1: Modify `src/types/giapha.ts`**

Add `pendingRequestId` to `Person` (after `ghiChu`):
```typescript
  ghiChu?: string
  pendingRequestId?: string    // set when an update/delete request is awaiting admin approval
```

Append new types at the end of the file:
```typescript
export type UserRole = 'admin' | 'editor' | 'viewer'

export interface AuthUser {
  id: string
  username: string
  email: string
  role: UserRole
  personId: string | null
}

export interface EditorRequest {
  id: string
  type: 'create' | 'update' | 'delete'
  personId: string | null
  payload: string | null
  submittedBy: string
  status: 'pending' | 'approved' | 'rejected'
  resolvedBy: string | null
  resolvedAt: string | null
  createdAt: string
}

export interface ManagedUser {
  id: string
  username: string
  email: string
  role: UserRole
  personId: string | null
  isActive: boolean
  createdAt: string
}

export interface MutationResult {
  id?: string
  pending?: boolean
  requestId?: string
}
```

- [ ] **Step 2: Write the failing test**

`src/services/api.test.ts` (new file — no existing tests for `api.ts` today):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as api from './api'

describe('api.ts auth/requests/users functions', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('getAuthMe calls GET /api/auth/me and returns the parsed body', async () => {
    const mockBody = { user: null, setupNeeded: true }
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(mockBody), { status: 200 }))
    const result = await api.getAuthMe()
    expect(fetch).toHaveBeenCalledWith('/api/auth/me', undefined)
    expect(result).toEqual(mockBody)
  })

  it('login posts credentials as JSON to /api/auth/login', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ user: { id: '1' } }), { status: 200 }))
    await api.login('admin', 'secret')
    expect(fetch).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'secret' }),
    })
  })

  it('createPerson resolves with a pending response for editors', async () => {
    const mockBody = { pending: true, requestId: 'req-1' }
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(mockBody), { status: 202 }))
    const result = await api.createPerson({} as never)
    expect(result).toEqual(mockBody)
  })

  it('listRequests calls GET /api/requests', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ requests: [] }), { status: 200 }))
    await api.listRequests()
    expect(fetch).toHaveBeenCalledWith('/api/requests', undefined)
  })

  it('approveRequest posts to /api/requests/:id/approve', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    await api.approveRequest('req-1')
    expect(fetch).toHaveBeenCalledWith('/api/requests/req-1/approve', { method: 'POST' })
  })

  it('listUsers calls GET /api/users', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ users: [] }), { status: 200 }))
    await api.listUsers()
    expect(fetch).toHaveBeenCalledWith('/api/users', undefined)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/services/api.test.ts`
Expected: FAIL — `getAuthMe`, `login`, `listRequests`, `approveRequest`, `listUsers` don't exist yet (and `createPerson`'s return type doesn't yet allow a `pending`/`requestId` shape).

- [ ] **Step 4: Modify `src/services/api.ts`**

Update the import line and mutation return types, then append the new functions:
```typescript
import type { GiaphaData, Person, AuthUser, EditorRequest, ManagedUser, MutationResult } from '../types/giapha'
```

Change the mutation signatures to return `MutationResult`:
```typescript
export function createPerson(person: Omit<Person, 'id'>): Promise<MutationResult> {
  return request<MutationResult>('/api/persons', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(person),
  })
}

export function updatePerson(id: string, person: Omit<Person, 'id'>): Promise<MutationResult> {
  return request<MutationResult>(`/api/persons/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(person),
  })
}

export function deletePerson(id: string): Promise<MutationResult> {
  return request<MutationResult>(`/api/persons/${id}`, { method: 'DELETE' })
}
```

Append at the end of the file:
```typescript
// ─── Auth ──────────────────────────────────────────────────────────────────

export function getAuthMe(): Promise<{ user: AuthUser | null; setupNeeded: boolean }> {
  return request<{ user: AuthUser | null; setupNeeded: boolean }>('/api/auth/me')
}

export function login(username: string, password: string): Promise<{ user: AuthUser }> {
  return request<{ user: AuthUser }>('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
}

export function setupFirstAdmin(username: string, password: string, email: string): Promise<{ user: AuthUser }> {
  return request<{ user: AuthUser }>('/api/auth/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, email }),
  })
}

export function logout(): Promise<{ ok: true }> {
  return request<{ ok: true }>('/api/auth/logout', { method: 'POST' })
}

// ─── Editor requests ─────────────────────────────────────────────────────────

export function listRequests(): Promise<{ requests: EditorRequest[] }> {
  return request<{ requests: EditorRequest[] }>('/api/requests')
}

export function approveRequest(id: string): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/api/requests/${id}/approve`, { method: 'POST' })
}

export function rejectRequest(id: string): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/api/requests/${id}/reject`, { method: 'POST' })
}

// ─── User management (admin-only) ───────────────────────────────────────────

export function listUsers(): Promise<{ users: ManagedUser[] }> {
  return request<{ users: ManagedUser[] }>('/api/users')
}

export function createUser(input: { username: string; password: string; role: string; email: string; personId?: string }): Promise<{ user: ManagedUser }> {
  return request<{ user: ManagedUser }>('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function updateUser(id: string, input: Partial<{ role: string; email: string; personId: string | null; isActive: boolean; password: string }>): Promise<{ user: ManagedUser }> {
  return request<{ user: ManagedUser }>(`/api/users/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function deleteUser(id: string): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/api/users/${id}`, { method: 'DELETE' })
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/services/api.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 6: Commit**

```bash
git add src/types/giapha.ts src/services/api.ts src/services/api.test.ts
git commit -m "feat: add frontend types and API client functions for auth/requests/users"
```

---

## Task 13: `useAuthStore` (zustand)

**Files:**
- Create: `src/store/useAuthStore.ts`
- Test: `src/store/useAuthStore.test.ts`

- [ ] **Step 1: Write the failing test**

`src/store/useAuthStore.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAuthStore } from './useAuthStore'
import * as api from '../services/api'

vi.mock('../services/api')

const sampleUser = { id: '1', username: 'admin', email: 'a@example.com', role: 'admin' as const, personId: null }

beforeEach(() => {
  useAuthStore.setState({ user: null, setupNeeded: false, loading: false, error: null })
  vi.clearAllMocks()
})

describe('useAuthStore', () => {
  it('checkAuth populates user and setupNeeded from the API', async () => {
    vi.mocked(api.getAuthMe).mockResolvedValue({ user: sampleUser, setupNeeded: false })
    await useAuthStore.getState().checkAuth()
    expect(useAuthStore.getState().user).toEqual(sampleUser)
    expect(useAuthStore.getState().setupNeeded).toBe(false)
  })

  it('login sets the user on success', async () => {
    vi.mocked(api.login).mockResolvedValue({ user: sampleUser })
    await useAuthStore.getState().login('admin', 'secret')
    expect(useAuthStore.getState().user).toEqual(sampleUser)
    expect(useAuthStore.getState().error).toBeNull()
  })

  it('login sets an error message and leaves user null on failure', async () => {
    vi.mocked(api.login).mockRejectedValue(new Error('Sai tên đăng nhập hoặc mật khẩu'))
    await useAuthStore.getState().login('admin', 'wrong')
    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().error).toBe('Sai tên đăng nhập hoặc mật khẩu')
  })

  it('setupFirstAdmin sets the user on success', async () => {
    vi.mocked(api.setupFirstAdmin).mockResolvedValue({ user: sampleUser })
    await useAuthStore.getState().setupFirstAdmin('admin', 'secret', 'a@example.com')
    expect(useAuthStore.getState().user).toEqual(sampleUser)
  })

  it('logout clears the user', async () => {
    useAuthStore.setState({ user: sampleUser })
    vi.mocked(api.logout).mockResolvedValue({ ok: true })
    await useAuthStore.getState().logout()
    expect(useAuthStore.getState().user).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/store/useAuthStore.test.ts`
Expected: FAIL — "Cannot find module './useAuthStore'".

- [ ] **Step 3: Implement `src/store/useAuthStore.ts`**

```typescript
import { create } from 'zustand'
import type { AuthUser } from '../types/giapha'
import * as api from '../services/api'

interface AuthState {
  user: AuthUser | null
  setupNeeded: boolean
  loading: boolean
  error: string | null

  checkAuth: () => Promise<void>
  login: (username: string, password: string) => Promise<void>
  setupFirstAdmin: (username: string, password: string, email: string) => Promise<void>
  logout: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setupNeeded: false,
  loading: false,
  error: null,

  checkAuth: async () => {
    set({ loading: true })
    try {
      const { user, setupNeeded } = await api.getAuthMe()
      set({ user, setupNeeded, loading: false })
    } catch {
      set({ user: null, loading: false })
    }
  },

  login: async (username, password) => {
    set({ loading: true, error: null })
    try {
      const { user } = await api.login(username, password)
      set({ user, loading: false, setupNeeded: false })
    } catch (e) {
      set({ loading: false, error: (e as Error).message })
    }
  },

  setupFirstAdmin: async (username, password, email) => {
    set({ loading: true, error: null })
    try {
      const { user } = await api.setupFirstAdmin(username, password, email)
      set({ user, loading: false, setupNeeded: false })
    } catch (e) {
      set({ loading: false, error: (e as Error).message })
    }
  },

  logout: async () => {
    await api.logout()
    set({ user: null })
  },

  clearError: () => set({ error: null }),
}))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/store/useAuthStore.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/store/useAuthStore.ts src/store/useAuthStore.test.ts
git commit -m "feat: add useAuthStore for login/logout/session state"
```

---

## Task 14: `LoginModal.tsx`

**Files:**
- Create: `src/components/LoginModal.tsx`
- Test: `src/components/LoginModal.test.tsx`

Same modal shell pattern as `CsvImportModal.tsx` (fixed overlay, click-outside-to-close, `onClose` prop). Shows a normal login form, or — when `useAuthStore().setupNeeded` is true — a "create first admin account" form instead.

- [ ] **Step 1: Write the failing test**

`src/components/LoginModal.test.tsx`:
```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import LoginModal from './LoginModal'
import { useAuthStore } from '../store/useAuthStore'

beforeEach(() => {
  useAuthStore.setState({ user: null, setupNeeded: false, loading: false, error: null })
})

describe('LoginModal', () => {
  it('renders username/password fields and calls login on submit', async () => {
    const onClose = vi.fn()
    const loginSpy = vi.spyOn(useAuthStore.getState(), 'login').mockImplementation(async () => {
      useAuthStore.setState({ user: { id: '1', username: 'admin', email: 'a@example.com', role: 'admin', personId: null } })
    })
    render(<LoginModal onClose={onClose} />)

    fireEvent.change(screen.getByLabelText('Tên đăng nhập'), { target: { value: 'admin' } })
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }))

    await waitFor(() => expect(loginSpy).toHaveBeenCalledWith('admin', 'secret'))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('shows the first-admin setup form when setupNeeded is true', () => {
    useAuthStore.setState({ setupNeeded: true })
    render(<LoginModal onClose={vi.fn()} />)
    expect(screen.getByText('Tạo tài khoản Admin đầu tiên')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })

  it('displays an error message from the store', () => {
    useAuthStore.setState({ error: 'Sai tên đăng nhập hoặc mật khẩu' })
    render(<LoginModal onClose={vi.fn()} />)
    expect(screen.getByText('Sai tên đăng nhập hoặc mật khẩu')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/LoginModal.test.tsx`
Expected: FAIL — "Cannot find module './LoginModal'".

- [ ] **Step 3: Implement `src/components/LoginModal.tsx`**

```typescript
import { useState } from 'react'
import { useAuthStore } from '../store/useAuthStore'

interface Props {
  onClose: () => void
}

export default function LoginModal({ onClose }: Props) {
  const { setupNeeded, loading, error, login, setupFirstAdmin, clearError } = useAuthStore()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    clearError()
    if (setupNeeded) {
      await setupFirstAdmin(username, password, email)
    } else {
      await login(username, password)
    }
    if (!useAuthStore.getState().error) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6 flex flex-col gap-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {setupNeeded ? 'Tạo tài khoản Admin đầu tiên' : 'Đăng nhập'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label htmlFor="login-username" className="block text-sm text-gray-600 mb-1">Tên đăng nhập</label>
            <input
              id="login-username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
            />
          </div>

          {setupNeeded && (
            <div>
              <label htmlFor="login-email" className="block text-sm text-gray-600 mb-1">Email</label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
              />
            </div>
          )}

          <div>
            <label htmlFor="login-password" className="block text-sm text-gray-600 mb-1">Mật khẩu</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50">
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {setupNeeded ? 'Tạo tài khoản' : 'Đăng nhập'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/LoginModal.test.tsx`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/LoginModal.tsx src/components/LoginModal.test.tsx
git commit -m "feat: add LoginModal (login + first-admin setup)"
```

---

## Task 15: Navbar auth-aware updates

**Files:**
- Modify: `src/components/Navbar.tsx`
- Test: `src/components/Navbar.test.tsx`

Removes "Quản lý thành viên"/"Nhập CSV"/"Xuất CSV" from the dropdown (they move into the Control Panel in later tasks). Anonymous users see only "Chế độ xem", "Thứ tự đời", and "Đăng nhập" (opens `LoginModal`). Logged-in users see a username + role badge in the navbar bar itself, plus "Control Panel" and "Đăng xuất" in the dropdown.

- [ ] **Step 1: Write the failing test**

`src/components/Navbar.test.tsx` (new file — no existing tests for `Navbar.tsx` today):
```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import Navbar from './Navbar'
import { useAuthStore } from '../store/useAuthStore'
import { useGiaphaStore } from '../store/useGiaphaStore'

beforeEach(() => {
  useAuthStore.setState({ user: null, setupNeeded: false, loading: false, error: null })
  useGiaphaStore.setState({ data: { metadata: { tenDongHo: 'Họ Test' }, persons: {} }, viewMode: 'list' })
})

function renderNavbar() {
  render(<MemoryRouter><Navbar /></MemoryRouter>)
}

describe('Navbar (anonymous)', () => {
  it('shows "Đăng nhập" and hides member/CSV actions in the dropdown', () => {
    renderNavbar()
    fireEvent.click(screen.getByLabelText('Mở menu'))
    expect(screen.getByText('Đăng nhập')).toBeInTheDocument()
    expect(screen.queryByText('Quản lý thành viên')).not.toBeInTheDocument()
    expect(screen.queryByText('Nhập CSV')).not.toBeInTheDocument()
    expect(screen.queryByText('Xuất CSV')).not.toBeInTheDocument()
    expect(screen.queryByText('Control Panel')).not.toBeInTheDocument()
  })

  it('opens the LoginModal when "Đăng nhập" is clicked', () => {
    renderNavbar()
    fireEvent.click(screen.getByLabelText('Mở menu'))
    fireEvent.click(screen.getByText('Đăng nhập'))
    expect(screen.getByLabelText('Tên đăng nhập')).toBeInTheDocument()
  })
})

describe('Navbar (logged in)', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: '1', username: 'admin1', email: 'a@example.com', role: 'admin', personId: null } })
  })

  it('shows username, role badge, and Control Panel + Đăng xuất in the dropdown', () => {
    renderNavbar()
    expect(screen.getByText('admin1')).toBeInTheDocument()
    expect(screen.getByText('Admin')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Mở menu'))
    expect(screen.getByText('Control Panel')).toBeInTheDocument()
    expect(screen.getByText('Đăng xuất')).toBeInTheDocument()
    expect(screen.queryByText('Đăng nhập')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Navbar.test.tsx`
Expected: FAIL — dropdown still shows "Quản lý thành viên"/"Nhập CSV"/"Xuất CSV" and there's no "Đăng nhập"/"Control Panel"/user badge yet.

- [ ] **Step 3: Rewrite `src/components/Navbar.tsx`**

```typescript
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useGiaphaStore } from '../store/useGiaphaStore'
import { useAuthStore } from '../store/useAuthStore'
import SearchBar from './SearchBar'
import LoginModal from './LoginModal'
import { useIsMobile } from '../utils/useIsMobile'

const ROLE_LABELS: Record<string, string> = { admin: 'Admin', editor: 'Editor', viewer: 'Viewer' }

export default function Navbar() {
  const { data, viewMode, setViewMode, hienThiThuTuDoi, toggleGenerationOrder } = useGiaphaStore()
  const { user, logout } = useAuthStore()
  const isMobile = useIsMobile()
  const [loginModalOpen, setLoginModalOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const selectableViewMode = viewMode === 'list' || viewMode === 'tree' ? viewMode : ''

  useEffect(() => {
    if (!menuOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])

  return (
    <>
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
            {data?.metadata.tenDongHo || 'Gia phả họ Hoàng'}
          </h1>
        </div>

        {!isMobile && <SearchBar />}

        <div className="ml-auto flex items-center gap-2 shrink-0">
          {user ? (
            <>
              <span className="text-sm text-ink font-medium hidden sm:inline">{user.username}</span>
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                {ROLE_LABELS[user.role] ?? user.role}
              </span>
            </>
          ) : (
            <button
              onClick={() => setLoginModalOpen(true)}
              className="px-3 py-1.5 text-sm rounded-md border border-card-border hover:bg-slate-50"
            >
              Đăng nhập
            </button>
          )}
        </div>
      </div>

      {isMobile && (
        <div data-testid="navbar-search-row-mobile" className="px-4 pb-2">
          <SearchBar />
        </div>
      )}

      {menuOpen && (
        <>
          <div
            aria-hidden="true"
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-30"
          />
          <div className="absolute top-full left-4 mt-2 z-40 w-72 bg-card border border-card-border rounded-lg shadow-lg p-3 space-y-2">
            <div>
              <label htmlFor="navbar-view-mode" className="block text-xs text-muted mb-1">Chế độ xem</label>
              <select
                id="navbar-view-mode"
                aria-label="Chế độ xem"
                value={selectableViewMode}
                onChange={e => setViewMode(e.target.value as 'tree' | 'list')}
                className="w-full px-2 py-1.5 text-sm border border-card-border rounded-md bg-card"
              >
                <option value="" disabled>Chế độ xem</option>
                <option value="tree">Cây</option>
                <option value="list">Danh sách</option>
              </select>
            </div>

            {user && (
              <Link
                to="/control-panel"
                onClick={() => setMenuOpen(false)}
                className="block w-full px-3 py-1.5 text-sm rounded-md border border-card-border hover:bg-slate-50 text-left"
              >
                Control Panel
              </Link>
            )}

            <button
              onClick={() => {
                toggleGenerationOrder()
                setMenuOpen(false)
              }}
              className="w-full px-3 py-1.5 text-sm rounded-md border border-card-border hover:bg-slate-50 text-left"
            >
              Thứ tự đời: {hienThiThuTuDoi ? 'Bật' : 'Tắt'}
            </button>

            {user ? (
              <button
                onClick={() => {
                  logout()
                  setMenuOpen(false)
                }}
                className="w-full px-3 py-1.5 text-sm rounded-md border border-card-border hover:bg-slate-50 text-left"
              >
                Đăng xuất
              </button>
            ) : (
              <button
                onClick={() => {
                  setLoginModalOpen(true)
                  setMenuOpen(false)
                }}
                className="w-full px-3 py-1.5 text-sm rounded-md border border-card-border hover:bg-slate-50 text-left"
              >
                Đăng nhập
              </button>
            )}
          </div>
        </>
      )}
    </nav>

    {loginModalOpen && <LoginModal onClose={() => setLoginModalOpen(false)} />}
    </>
  )
}
```

Note: `viewMode === 'members'` is no longer a dropdown-selectable option here — Task 22 removes the `'members'` `ViewMode` entirely from `useGiaphaStore` once its content has moved to the Control Panel's Thành viên tab (Task 17).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/Navbar.test.tsx`
Expected: PASS — 3 tests.

- [ ] **Step 5: Run the existing Navbar-adjacent test suites to check for regressions**

Run: `npx vitest run src/components/Navbar.test.tsx src/components/CsvImportModal.test.tsx 2>/dev/null; npx vitest run --passWithNoTests src/components`
Expected: PASS. If any existing test elsewhere referenced the now-removed "Quản lý thành viên"/"Nhập CSV"/"Xuất CSV" navbar buttons (e.g. an old E2E-ish navbar test or a HomePage integration test), update that test's expectations to match the new dropdown contents rather than deleting the assertion outright — search with `grep -rn "Quản lý thành viên\|Nhập CSV\|Xuất CSV" src/` and fix each hit found outside of `MemberManagementView.tsx`/`CsvImportModal.tsx`/the new Control Panel components (those are handled in Tasks 17/19).

- [ ] **Step 6: Commit**

```bash
git add src/components/Navbar.tsx src/components/Navbar.test.tsx
git commit -m "feat: make Navbar auth-aware (login button, user badge, Control Panel link)"
```

---

## Task 16: `ControlPanelPage` — routed, guarded, tabbed shell

**Files:**
- Create: `src/pages/ControlPanelPage.tsx`
- Modify: `src/App.tsx`
- Test: `src/pages/ControlPanelPage.test.tsx`

Route `/control-panel`, redirects to `/` if `user === null` once `checkAuth()` has resolved. Tabs shown depend on role: editor sees **Thành viên** + **Yêu cầu của tôi**; admin additionally sees **Yêu cầu chờ duyệt**, **CSV**, **Quản lý User**. (Admin doesn't need a separate "Yêu cầu chờ duyệt" vs "Yêu cầu của tôi" distinction — for admin the single "Yêu cầu chờ duyệt" tab already shows everyone's requests per Task 9's `GET /api/requests` role branching.)

- [ ] **Step 1: Write the failing test**

`src/pages/ControlPanelPage.test.tsx`:
```typescript
import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ControlPanelPage from './ControlPanelPage'
import { useAuthStore } from '../store/useAuthStore'

vi.mock('../components/MemberManagementView', () => ({ default: () => <div>MemberManagementView stub</div> }))
vi.mock('../components/PendingRequestsPanel', () => ({ default: () => <div>PendingRequestsPanel stub</div> }))
vi.mock('../components/CsvPanel', () => ({ default: () => <div>CsvPanel stub</div> }))
vi.mock('../components/UserManagementPanel', () => ({ default: () => <div>UserManagementPanel stub</div> }))

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/control-panel" element={<ControlPanelPage />} />
        <Route path="/" element={<div>HomePage stub</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useAuthStore.setState({ user: null, setupNeeded: false, loading: false, error: null })
})

describe('ControlPanelPage', () => {
  it('redirects to / when there is no logged-in user', () => {
    renderAt('/control-panel')
    expect(screen.getByText('HomePage stub')).toBeInTheDocument()
  })

  it('editor sees Thành viên and Yêu cầu của tôi tabs only', () => {
    useAuthStore.setState({ user: { id: '1', username: 'ed1', email: 'e@example.com', role: 'editor', personId: null } })
    renderAt('/control-panel')
    expect(screen.getByText('Thành viên')).toBeInTheDocument()
    expect(screen.getByText('Yêu cầu của tôi')).toBeInTheDocument()
    expect(screen.queryByText('CSV')).not.toBeInTheDocument()
    expect(screen.queryByText('Quản lý User')).not.toBeInTheDocument()
  })

  it('admin sees all tabs including CSV and Quản lý User', () => {
    useAuthStore.setState({ user: { id: '2', username: 'admin1', email: 'a@example.com', role: 'admin', personId: null } })
    renderAt('/control-panel')
    expect(screen.getByText('Thành viên')).toBeInTheDocument()
    expect(screen.getByText('Yêu cầu chờ duyệt')).toBeInTheDocument()
    expect(screen.getByText('CSV')).toBeInTheDocument()
    expect(screen.getByText('Quản lý User')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/ControlPanelPage.test.tsx`
Expected: FAIL — "Cannot find module './ControlPanelPage'".

- [ ] **Step 3: Implement `src/pages/ControlPanelPage.tsx`**

```typescript
import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'
import MemberManagementView from '../components/MemberManagementView'
import PendingRequestsPanel from '../components/PendingRequestsPanel'
import CsvPanel from '../components/CsvPanel'
import UserManagementPanel from '../components/UserManagementPanel'

type Tab = 'members' | 'requests' | 'csv' | 'users'

export default function ControlPanelPage() {
  const { user } = useAuthStore()
  const [tab, setTab] = useState<Tab>('members')

  if (!user) return <Navigate to="/" replace />

  const isAdmin = user.role === 'admin'
  const tabs: { key: Tab; label: string }[] = [
    { key: 'members', label: 'Thành viên' },
    { key: 'requests', label: isAdmin ? 'Yêu cầu chờ duyệt' : 'Yêu cầu của tôi' },
    ...(isAdmin ? [{ key: 'csv' as Tab, label: 'CSV' }, { key: 'users' as Tab, label: 'Quản lý User' }] : []),
  ]

  return (
    <div className="h-dvh flex flex-col overflow-hidden bg-white">
      <div className="border-b border-gray-200 px-4 py-3">
        <h1 className="text-lg font-bold text-ink">Control Panel</h1>
      </div>
      <div className="border-b border-gray-200 px-4 flex gap-1 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm border-b-2 whitespace-nowrap ${
              tab === t.key ? 'border-blue-600 text-blue-700 font-medium' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto">
        {tab === 'members' && <MemberManagementView />}
        {tab === 'requests' && <PendingRequestsPanel />}
        {tab === 'csv' && isAdmin && <CsvPanel />}
        {tab === 'users' && isAdmin && <UserManagementPanel />}
      </div>
    </div>
  )
}
```

- [ ] **Step 3b: Create minimal placeholder components so the app compiles before Tasks 18-20 build them out**

`PendingRequestsPanel.tsx`, `CsvPanel.tsx`, and `UserManagementPanel.tsx` are fully implemented in Tasks 18, 19, and 20 respectively. To keep `ControlPanelPage.tsx` compiling and runnable in the meantime, create minimal-but-real components now (each renders a heading and a "loading" state — not a `TODO` stub, just not-yet-feature-complete):

`src/components/PendingRequestsPanel.tsx`:
```typescript
export default function PendingRequestsPanel() {
  return <div className="p-4 text-sm text-gray-500">Đang tải danh sách yêu cầu…</div>
}
```

`src/components/CsvPanel.tsx`:
```typescript
export default function CsvPanel() {
  return <div className="p-4 text-sm text-gray-500">Đang tải công cụ CSV…</div>
}
```

`src/components/UserManagementPanel.tsx`:
```typescript
export default function UserManagementPanel() {
  return <div className="p-4 text-sm text-gray-500">Đang tải danh sách người dùng…</div>
}
```

These three files are fully rewritten (not just extended) in Tasks 18, 19, and 20.

- [ ] **Step 4: Modify `src/App.tsx`**

Add the import and route, and kick off `checkAuth()` alongside `loadData()`:
```typescript
import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import PrivacyPolicyPage from './pages/PrivacyPolicyPage'
import ControlPanelPage from './pages/ControlPanelPage'
import { useGiaphaStore } from './store/useGiaphaStore'
import { useAuthStore } from './store/useAuthStore'

function AppRoot() {
  const { data, loading, error, loadData } = useGiaphaStore()
  const { checkAuth } = useAuthStore()

  useEffect(() => {
    loadData()
    checkAuth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400 animate-pulse">Đang tải...</div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500">Lỗi tải dữ liệu: {error}</div>
      </div>
    )
  }

  return <HomePage />
}

export default function App() {
  return (
    <Routes>
      <Route path="/privacy" element={<PrivacyPolicyPage />} />
      <Route path="/control-panel" element={<ControlPanelPage />} />
      <Route path="/*" element={<AppRoot />} />
    </Routes>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/pages/ControlPanelPage.test.tsx`
Expected: PASS — 3 tests (component stubs for `PendingRequestsPanel`/`CsvPanel`/`UserManagementPanel` are created in Tasks 18-20; the stub mocks in this test file are enough to make this task pass standalone).

- [ ] **Step 6: Commit**

```bash
git add src/pages/ControlPanelPage.tsx src/App.tsx src/pages/ControlPanelPage.test.tsx
git commit -m "feat: add ControlPanelPage with role-based tabs, route-guard it"
```

---

## Task 17: `MemberManagementView` — adapt to the pending-request flow

**Files:**
- Modify: `src/components/MemberManagementView.tsx:210-260` (the `handleApplyChanges` function)
- Test: `src/components/MemberManagementView.test.tsx` (add cases to the existing test file)

When the logged-in user is an editor, `api.createPerson`/`updatePerson`/`deletePerson` return `{ pending: true, requestId }` (202) instead of writing directly. `handleApplyChanges` needs to track how many changes were applied directly vs. sent as pending requests, and phrase the success message accordingly.

- [ ] **Step 1: Write the failing test**

Add to `src/components/MemberManagementView.test.tsx` (check the existing file first for its current mocking setup of `../services/api` and `useGiaphaStore`, and follow the same pattern):
```typescript
import { useAuthStore } from '../store/useAuthStore'

// ...alongside existing imports/mocks in the file...

describe('MemberManagementView — editor pending-request flow', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: 'editor-1', username: 'ed1', email: 'e@example.com', role: 'editor', personId: null } })
  })

  it('shows a "sent for approval" message when api.createPerson returns pending:true', async () => {
    vi.mocked(api.createPerson).mockResolvedValue({ pending: true, requestId: 'req-1' })
    // ... render MemberManagementView with a store already containing a new unsaved row (add a row via
    // the existing "Thêm dòng mới" button, fill hoTen, then click "Áp dụng thay đổi") ...
    // Assert the resulting message contains "Đã gửi" (not "Đã cập nhật") and mentions "chờ admin duyệt".
  })
})
```

Since the exact rendering/interaction helpers depend on the file's existing test setup (row-editing helpers, `data-testid`s), inspect `src/components/MemberManagementView.test.tsx` in full before writing this test, and reuse whatever row-add/row-edit helper functions it already defines rather than duplicating them.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/MemberManagementView.test.tsx`
Expected: FAIL — current success message always says "Đã cập nhật N thành viên..." regardless of role/response shape.

- [ ] **Step 3: Modify `handleApplyChanges` in `src/components/MemberManagementView.tsx`**

Add the import:
```typescript
import { useAuthStore } from '../store/useAuthStore'
```

Inside the component, read the current role:
```typescript
const { user } = useAuthStore()
```

Replace the body of `handleApplyChanges` (the counting/message logic only — the deletion loop and error handling stay the same) with:

```typescript
  async function handleApplyChanges() {
    if (!data) return
    setSaving(true)
    setErrorMessages([])
    setAutoComputeWarnings([])
    const errors: string[] = []
    const remainingIds = new Set(rows.map(r => r.id.trim()).filter(Boolean))
    const deletedIds = [...originalIds].filter(id => !remainingIds.has(id))

    let deletedDirect = 0
    let deletedPending = 0
    for (const id of deletedIds) {
      try {
        const result = await api.deletePerson(id)
        if (result.pending) deletedPending++
        else deletedDirect++
      } catch (e) {
        errors.push(`Xóa ${id}: ${(e as Error).message}`)
      }
    }

    let savedDirect = 0
    let savedPending = 0
    let skippedCount = 0
    for (const row of rows) {
      if (!row.hoTen.trim()) continue
      if (row.thuTuDoi.trim() && !Number.isInteger(Number(row.thuTuDoi))) {
        errors.push(`${row.hoTen || row._key}: Đời phải là số`)
        continue
      }
      const payload = rowToPersonPayload(row)
      const trimmedId = row.id.trim()
      try {
        let result: { pending?: boolean }
        if (!isNewRow(row, originalIds)) {
          const changed = getChangedFields(row, personToRow(data.persons[trimmedId]))
          if (changed.length === 0) {
            skippedCount++
            continue
          }
          result = await api.updatePerson(trimmedId, payload)
        } else {
          result = await api.createPerson(payload)
        }
        if (result.pending) savedPending++
        else savedDirect++
      } catch (e) {
        errors.push(`${row.hoTen || row._key}: ${(e as Error).message}`)
      }
    }

    await loadData()
    setSaving(false)
    if (errors.length > 0) {
      setErrorMessages(errors)
      setSaveMessage(null)
      return
    }
    setErrorMessages([])

    const totalPending = savedPending + deletedPending
    const totalDirect = savedDirect + deletedDirect
    if (totalPending > 0 && user?.role === 'editor') {
      const directPart = totalDirect > 0 ? `Đã cập nhật ${totalDirect} thành viên. ` : ''
      setSaveMessage(`${directPart}Đã gửi ${totalPending} thay đổi để chờ admin duyệt. Bỏ qua ${skippedCount} không đổi.`)
    } else {
      setSaveMessage(`Đã cập nhật ${totalDirect} thành viên, bỏ qua ${skippedCount} không đổi.`)
    }
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/MemberManagementView.test.tsx`
Expected: PASS — all existing tests plus the new pending-request test.

- [ ] **Step 5: Commit**

```bash
git add src/components/MemberManagementView.tsx src/components/MemberManagementView.test.tsx
git commit -m "feat: MemberManagementView reports pending-approval count for editors"
```

---

## Task 18: `PendingRequestsPanel.tsx`

**Files:**
- Modify (full rewrite): `src/components/PendingRequestsPanel.tsx`
- Test: `src/components/PendingRequestsPanel.test.tsx`

Lists editor_requests (own for editors, all for admins per Task 9's backend role branching). Admin sees Approve/Reject buttons; editor sees status only. Renders a human-readable summary of each request's payload (name + action type).

- [ ] **Step 1: Write the failing test**

`src/components/PendingRequestsPanel.test.tsx`:
```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import PendingRequestsPanel from './PendingRequestsPanel'
import { useAuthStore } from '../store/useAuthStore'
import * as api from '../services/api'

vi.mock('../services/api')

const sampleRequest = {
  id: 'req-1', type: 'create' as const, personId: null,
  payload: JSON.stringify({ hoTen: 'Nguyễn Văn A' }), submittedBy: 'editor-1',
  status: 'pending' as const, resolvedBy: null, resolvedAt: null, createdAt: '2024-01-01T00:00:00.000Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.listRequests).mockResolvedValue({ requests: [sampleRequest] })
})

describe('PendingRequestsPanel (admin)', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: 'admin-1', username: 'admin1', email: 'a@example.com', role: 'admin', personId: null } })
  })

  it('lists requests and shows a readable summary', async () => {
    render(<PendingRequestsPanel />)
    await waitFor(() => expect(screen.getByText(/Nguyễn Văn A/)).toBeInTheDocument())
    expect(screen.getByText(/Thêm mới/)).toBeInTheDocument()
  })

  it('approves a request and refreshes the list', async () => {
    vi.mocked(api.approveRequest).mockResolvedValue({ ok: true })
    render(<PendingRequestsPanel />)
    await waitFor(() => screen.getByText('Duyệt'))
    fireEvent.click(screen.getByText('Duyệt'))
    await waitFor(() => expect(api.approveRequest).toHaveBeenCalledWith('req-1'))
    await waitFor(() => expect(api.listRequests).toHaveBeenCalledTimes(2))
  })

  it('rejects a request and refreshes the list', async () => {
    vi.mocked(api.rejectRequest).mockResolvedValue({ ok: true })
    render(<PendingRequestsPanel />)
    await waitFor(() => screen.getByText('Từ chối'))
    fireEvent.click(screen.getByText('Từ chối'))
    await waitFor(() => expect(api.rejectRequest).toHaveBeenCalledWith('req-1'))
  })
})

describe('PendingRequestsPanel (editor)', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: 'editor-1', username: 'ed1', email: 'e@example.com', role: 'editor', personId: null } })
  })

  it('does not show Approve/Reject buttons', async () => {
    render(<PendingRequestsPanel />)
    await waitFor(() => expect(screen.getByText(/Nguyễn Văn A/)).toBeInTheDocument())
    expect(screen.queryByText('Duyệt')).not.toBeInTheDocument()
    expect(screen.queryByText('Từ chối')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/PendingRequestsPanel.test.tsx`
Expected: FAIL — current placeholder component (from Task 16) renders only a loading message and never calls `api.listRequests`.

- [ ] **Step 3: Implement `src/components/PendingRequestsPanel.tsx`**

```typescript
import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/useAuthStore'
import * as api from '../services/api'
import type { EditorRequest } from '../types/giapha'

const TYPE_LABELS: Record<EditorRequest['type'], string> = {
  create: 'Thêm mới', update: 'Cập nhật', delete: 'Xóa',
}

function summarize(request: EditorRequest): string {
  if (request.type === 'delete') return `${TYPE_LABELS.delete} thành viên #${request.personId}`
  try {
    const payload = JSON.parse(request.payload ?? '{}') as { hoTen?: string }
    return `${TYPE_LABELS[request.type]}: ${payload.hoTen ?? '(không rõ tên)'}`
  } catch {
    return `${TYPE_LABELS[request.type]} thành viên`
  }
}

export default function PendingRequestsPanel() {
  const { user } = useAuthStore()
  const [requests, setRequests] = useState<EditorRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    setLoading(true)
    try {
      const { requests } = await api.listRequests()
      setRequests(requests)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])

  async function handleApprove(id: string) {
    await api.approveRequest(id)
    await refresh()
  }

  async function handleReject(id: string) {
    await api.rejectRequest(id)
    await refresh()
  }

  const isAdmin = user?.role === 'admin'

  return (
    <div className="p-4">
      <h2 className="text-base font-semibold text-gray-800 mb-3">
        {isAdmin ? 'Yêu cầu chờ duyệt' : 'Yêu cầu của tôi'}
      </h2>
      {loading && <p className="text-sm text-gray-400">Đang tải…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && requests.length === 0 && <p className="text-sm text-gray-500">Không có yêu cầu nào.</p>}
      <ul className="space-y-2">
        {requests.map(request => (
          <li key={request.id} className="border border-gray-200 rounded-lg p-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-gray-800">{summarize(request)}</p>
              <p className="text-xs text-gray-500">
                Trạng thái: {request.status === 'pending' ? 'Đang chờ' : request.status === 'approved' ? 'Đã duyệt' : 'Đã từ chối'}
              </p>
            </div>
            {isAdmin && request.status === 'pending' && (
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => handleApprove(request.id)}
                  className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Duyệt
                </button>
                <button
                  onClick={() => handleReject(request.id)}
                  className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Từ chối
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/PendingRequestsPanel.test.tsx`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/PendingRequestsPanel.tsx src/components/PendingRequestsPanel.test.tsx
git commit -m "feat: implement PendingRequestsPanel (list/approve/reject)"
```

---

## Task 19: `CsvPanel.tsx` (admin-only, replaces `Navbar`'s old export/import buttons)

**Files:**
- Modify (full rewrite): `src/components/CsvPanel.tsx`
- Delete: `src/components/CsvImportModal.tsx`, `src/components/CsvImportModal.test.tsx` (logic fully absorbed into `CsvPanel`)
- Test: `src/components/CsvPanel.test.tsx`

Combines the old `Navbar`'s "Xuất CSV" button logic and the old `CsvImportModal`'s import logic into a single panel, inline (not a modal) inside the Control Panel.

- [ ] **Step 1: Write the failing test**

`src/components/CsvPanel.test.tsx`:
```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import CsvPanel from './CsvPanel'
import * as api from '../services/api'
import { useGiaphaStore } from '../store/useGiaphaStore'

vi.mock('../services/api')

beforeEach(() => {
  vi.clearAllMocks()
  useGiaphaStore.setState({ data: { metadata: { tenDongHo: 'Họ Test' }, persons: {} } })
})

describe('CsvPanel', () => {
  it('exports CSV when the export button is clicked', async () => {
    const blob = new Blob(['id,name'], { type: 'text/csv' })
    vi.mocked(api.exportCsv).mockResolvedValue(blob)
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() })
    render(<CsvPanel />)
    fireEvent.click(screen.getByText('Xuất CSV'))
    await waitFor(() => expect(api.exportCsv).toHaveBeenCalled())
  })

  it('imports a CSV file and shows the result summary', async () => {
    vi.mocked(api.importCsv).mockResolvedValue({ imported: { persons: 3, families: 1 } })
    render(<CsvPanel />)
    const file = new File(['id,name\n1,A'], 'test.csv', { type: 'text/csv' })
    const input = screen.getByLabelText('Chọn file CSV để nhập') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => expect(screen.getByText(/Đã nhập/)).toBeInTheDocument())
    expect(screen.getByText(/3/)).toBeInTheDocument()
  })

  it('shows an error message when import fails', async () => {
    vi.mocked(api.importCsv).mockRejectedValue(new Error('Sai định dạng'))
    render(<CsvPanel />)
    const file = new File(['bad'], 'test.csv', { type: 'text/csv' })
    const input = screen.getByLabelText('Chọn file CSV để nhập') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => expect(screen.getByText('Sai định dạng')).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/CsvPanel.test.tsx`
Expected: FAIL — placeholder `CsvPanel` (from Task 16) has no export/import UI.

- [ ] **Step 3: Implement `src/components/CsvPanel.tsx`**

```typescript
import { useRef, useState } from 'react'
import { useGiaphaStore } from '../store/useGiaphaStore'
import { exportCsv, importCsv } from '../services/api'

export default function CsvPanel() {
  const { loadData } = useGiaphaStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ persons: number; families: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleExportCsv() {
    const blob = await exportCsv()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const date = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = `gia-pha-export-${date}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setResult(null)
    setError(null)
    setImporting(true)
    importCsv(file)
      .then(res => {
        setResult(res.imported)
        loadData()
      })
      .catch(e => setError((e as Error).message))
      .finally(() => setImporting(false))
  }

  return (
    <div className="p-4 flex flex-col gap-6 max-w-lg">
      <section>
        <h2 className="text-base font-semibold text-gray-800 mb-2">Xuất dữ liệu ra CSV</h2>
        <button
          onClick={handleExportCsv}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Xuất CSV
        </button>
      </section>

      <section>
        <h2 className="text-base font-semibold text-gray-800 mb-2">Nhập dữ liệu từ CSV</h2>
        <p className="text-sm text-gray-500 mb-3">
          Chọn file CSV theo định dạng chuẩn. Dữ liệu hiện tại sẽ bị <strong>thay thế hoàn toàn</strong> sau khi nhập.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300 disabled:opacity-50"
          >
            Chọn file…
          </button>
          {fileName && <span className="text-sm text-gray-600 truncate">{fileName}</span>}
          <input
            ref={fileInputRef}
            type="file"
            aria-label="Chọn file CSV để nhập"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {importing && <p className="text-sm text-gray-400 mt-2">Đang nhập dữ liệu…</p>}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-2">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {result && !error && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-2">
            <p className="text-sm text-green-700">
              Đã nhập <strong>{result.persons}</strong> người và <strong>{result.families}</strong> gia đình.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/CsvPanel.test.tsx`
Expected: PASS — 3 tests.

- [ ] **Step 5: Remove the now-unused `CsvImportModal`**

```bash
git rm src/components/CsvImportModal.tsx src/components/CsvImportModal.test.tsx
```
Search for any remaining imports of it (`grep -rn "CsvImportModal" src/`) and remove them — by Task 15, `Navbar.tsx` no longer imports it, so this should find zero remaining references.

- [ ] **Step 6: Run the full frontend test suite to check for regressions**

Run: `npx vitest run`
Expected: PASS — all suites green, no leftover references to `CsvImportModal`.

- [ ] **Step 7: Commit**

```bash
git add src/components/CsvPanel.tsx src/components/CsvPanel.test.tsx
git commit -m "feat: implement CsvPanel (admin-only export/import), remove CsvImportModal"
```

---

## Task 20: `UserManagementPanel.tsx` (admin-only)

**Files:**
- Modify (full rewrite): `src/components/UserManagementPanel.tsx`
- Test: `src/components/UserManagementPanel.test.tsx`

Lists all users (username/email/role/active), lets admin create a new user, change a user's role/active flag, or delete a user. Relies on the backend's last-admin protection (Task 11) — surfaces its 409 error message directly rather than re-implementing the check client-side.

- [ ] **Step 1: Write the failing test**

`src/components/UserManagementPanel.test.tsx`:
```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import UserManagementPanel from './UserManagementPanel'
import * as api from '../services/api'

vi.mock('../services/api')

const sampleUsers = [
  { id: 'u1', username: 'admin1', email: 'a@example.com', role: 'admin' as const, personId: null, isActive: true, createdAt: '2024-01-01T00:00:00.000Z' },
  { id: 'u2', username: 'ed1', email: 'e@example.com', role: 'editor' as const, personId: null, isActive: true, createdAt: '2024-01-02T00:00:00.000Z' },
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.listUsers).mockResolvedValue({ users: sampleUsers })
})

describe('UserManagementPanel', () => {
  it('lists existing users', async () => {
    render(<UserManagementPanel />)
    await waitFor(() => expect(screen.getByText('admin1')).toBeInTheDocument())
    expect(screen.getByText('ed1')).toBeInTheDocument()
  })

  it('creates a new user', async () => {
    vi.mocked(api.createUser).mockResolvedValue({ user: { id: 'u3', username: 'ed2', email: 'e2@example.com', role: 'editor', personId: null, isActive: true, createdAt: '2024-01-03T00:00:00.000Z' } })
    render(<UserManagementPanel />)
    await waitFor(() => screen.getByText('admin1'))
    fireEvent.click(screen.getByText('Thêm người dùng'))
    fireEvent.change(screen.getByLabelText('Tên đăng nhập'), { target: { value: 'ed2' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'e2@example.com' } })
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tạo' }))
    await waitFor(() => expect(api.createUser).toHaveBeenCalledWith({
      username: 'ed2', password: 'password123', role: 'editor', email: 'e2@example.com',
    }))
  })

  it('deletes a user', async () => {
    vi.mocked(api.deleteUser).mockResolvedValue({ ok: true })
    render(<UserManagementPanel />)
    await waitFor(() => screen.getByText('ed1'))
    fireEvent.click(screen.getAllByText('Xóa')[1])
    await waitFor(() => expect(api.deleteUser).toHaveBeenCalledWith('u2'))
  })

  it('shows the backend error when deleting the last admin fails', async () => {
    vi.mocked(api.deleteUser).mockRejectedValue(new Error('Không thể xóa admin cuối cùng'))
    render(<UserManagementPanel />)
    await waitFor(() => screen.getByText('admin1'))
    fireEvent.click(screen.getAllByText('Xóa')[0])
    await waitFor(() => expect(screen.getByText('Không thể xóa admin cuối cùng')).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/UserManagementPanel.test.tsx`
Expected: FAIL — placeholder `UserManagementPanel` (from Task 16) has no list/create/delete UI.

- [ ] **Step 3: Implement `src/components/UserManagementPanel.tsx`**

```typescript
import { useEffect, useState } from 'react'
import * as api from '../services/api'
import type { ManagedUser, UserRole } from '../types/giapha'

export default function UserManagementPanel() {
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('editor')

  async function refresh() {
    setLoading(true)
    try {
      const { users } = await api.listUsers()
      setUsers(users)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await api.createUser({ username, password, role, email })
      setFormOpen(false)
      setUsername(''); setEmail(''); setPassword(''); setRole('editor')
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function handleDelete(id: string) {
    setError(null)
    try {
      await api.deleteUser(id)
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function handleRoleChange(id: string, newRole: UserRole) {
    setError(null)
    try {
      await api.updateUser(id, { role: newRole })
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-800">Quản lý người dùng</h2>
        <button
          onClick={() => setFormOpen(v => !v)}
          className="px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
        >
          Thêm người dùng
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {formOpen && (
        <form onSubmit={handleCreate} className="border border-gray-200 rounded-lg p-3 mb-4 flex flex-col gap-3 max-w-sm">
          <div>
            <label htmlFor="new-user-username" className="block text-sm text-gray-600 mb-1">Tên đăng nhập</label>
            <input id="new-user-username" value={username} onChange={e => setUsername(e.target.value)} required className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md" />
          </div>
          <div>
            <label htmlFor="new-user-email" className="block text-sm text-gray-600 mb-1">Email</label>
            <input id="new-user-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md" />
          </div>
          <div>
            <label htmlFor="new-user-password" className="block text-sm text-gray-600 mb-1">Mật khẩu</label>
            <input id="new-user-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md" />
          </div>
          <div>
            <label htmlFor="new-user-role" className="block text-sm text-gray-600 mb-1">Vai trò</label>
            <select id="new-user-role" value={role} onChange={e => setRole(e.target.value as UserRole)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md">
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50">Hủy</button>
            <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">Tạo</button>
          </div>
        </form>
      )}

      {loading && <p className="text-sm text-gray-400">Đang tải…</p>}

      <ul className="space-y-2">
        {users.map(u => (
          <li key={u.id} className="border border-gray-200 rounded-lg p-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-800">{u.username}</p>
              <p className="text-xs text-gray-500">{u.email}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <select
                aria-label={`Vai trò của ${u.username}`}
                value={u.role}
                onChange={e => handleRoleChange(u.id, e.target.value as UserRole)}
                className="px-2 py-1 text-sm border border-gray-300 rounded-md"
              >
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                onClick={() => handleDelete(u.id)}
                className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Xóa
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/UserManagementPanel.test.tsx`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/UserManagementPanel.tsx src/components/UserManagementPanel.test.tsx
git commit -m "feat: implement UserManagementPanel (admin-only user CRUD)"
```

---

## Task 21: "Đang chờ duyệt" badge on `PersonCard` and `ListView`

**Files:**
- Modify: `src/components/PersonCard.tsx`
- Modify: `src/components/ListView.tsx`
- Test: `src/components/PersonCard.test.tsx` (add cases to the existing test file), `src/components/ListView.test.tsx` (add cases to the existing test file)

Badge shows only when `person.pendingRequestId` is set **and** the viewer is logged in (`useAuthStore().user !== null`) — anonymous/viewer visitors never see it, per spec.

- [ ] **Step 1: Write the failing test**

Add to `src/components/PersonCard.test.tsx` (inspect the existing file's mocking conventions first, then add):
```typescript
import { useAuthStore } from '../store/useAuthStore'

describe('PersonCard pending-request badge', () => {
  const personWithPending = { ...basePerson, pendingRequestId: 'req-1' } // reuse whatever base fixture the file already defines

  it('shows the badge when logged in and pendingRequestId is set', () => {
    useAuthStore.setState({ user: { id: '1', username: 'ed1', email: 'e@example.com', role: 'editor', personId: null } })
    render(<PersonCard person={personWithPending} isSelected={false} onClick={vi.fn()} />)
    expect(screen.getByLabelText('Đang chờ duyệt')).toBeInTheDocument()
  })

  it('hides the badge when logged out even if pendingRequestId is set', () => {
    useAuthStore.setState({ user: null })
    render(<PersonCard person={personWithPending} isSelected={false} onClick={vi.fn()} />)
    expect(screen.queryByLabelText('Đang chờ duyệt')).not.toBeInTheDocument()
  })
})
```

Add to `src/components/ListView.test.tsx` similarly:
```typescript
it('shows a pending badge on a row when logged in and the person has pendingRequestId', () => {
  useAuthStore.setState({ user: { id: '1', username: 'ed1', email: 'e@example.com', role: 'editor', personId: null } })
  // ...render ListView with a store/data fixture where one person has pendingRequestId: 'req-1'...
  expect(screen.getByLabelText('Đang chờ duyệt')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/PersonCard.test.tsx src/components/ListView.test.tsx`
Expected: FAIL — no badge rendering exists yet in either component.

- [ ] **Step 3: Modify `src/components/PersonCard.tsx`**

Add the import:
```typescript
import { useAuthStore } from '../store/useAuthStore'
```

Inside the component, read auth state and add the badge markup right after the existing `isMarriedIn` badge block:
```typescript
  const { user } = useAuthStore()
  const showPendingBadge = !!person.pendingRequestId && !!user
```
```typescript
      {showPendingBadge && (
        <span
          aria-label="Đang chờ duyệt"
          title="Đang chờ duyệt"
          className="absolute -top-2 left-2 text-[11px] leading-none bg-amber-100 text-amber-700 border border-amber-300 rounded-full px-1.5 py-0.5"
        >
          ⏳
        </span>
      )}
```
(Place it as a sibling of the existing `isMarriedIn` `<span>`, inside the same top-level `<div>`.)

- [ ] **Step 4: Modify `src/components/ListView.tsx`**

Add the import:
```typescript
import { useAuthStore } from '../store/useAuthStore'
```

Inside the row-rendering function/component, read auth state and add a badge next to the existing 💍 spouse badge:
```typescript
  const { user } = useAuthStore()
```
```typescript
        {person.pendingRequestId && user && (
          <span aria-label="Đang chờ duyệt" title="Đang chờ duyệt" className="text-xs text-amber-600">⏳</span>
        )}
```
(Insert this JSX right after the existing `{isSpouse && (<span aria-label="Vợ/chồng" ...>💍</span>)}` block, before the person name `<span>`.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/PersonCard.test.tsx src/components/ListView.test.tsx`
Expected: PASS — all existing tests plus the new badge tests.

- [ ] **Step 6: Commit**

```bash
git add src/components/PersonCard.tsx src/components/ListView.tsx src/components/PersonCard.test.tsx src/components/ListView.test.tsx
git commit -m "feat: show pending-approval badge on PersonCard/ListView for logged-in users"
```

---

## Task 22: Read-only access for anonymous/viewer; gate FAB and edit-on-click; retire the old `members` view mode

**Files:**
- Create: `src/components/PersonDetailPanel.tsx`
- Modify: `src/pages/HomePage.tsx`
- Modify: `src/store/useGiaphaStore.ts` (remove `'members'` from `ViewMode`)
- Test: `src/components/PersonDetailPanel.test.tsx`, `src/pages/HomePage.test.tsx` (add cases to the existing test file)

Logged-out (or `viewer`-role) users clicking a person in Tree/List get a read-only `PersonDetailPanel` (name, dates, bio, contact info — no inputs, no Sửa/Xóa buttons). Logged-in `admin`/`editor` users keep today's behavior (`PersonForm` opens directly on click). The FAB "+" only renders when `user !== null`.

- [ ] **Step 1: Write the failing test**

`src/components/PersonDetailPanel.test.tsx`:
```typescript
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import PersonDetailPanel from './PersonDetailPanel'
import type { Person } from '../types/giapha'

const person: Person = {
  id: '1', hoTen: 'Nguyễn Văn A', gioiTinh: 'nam', laThanhVienHo: true,
  honNhan: [], conCaiIds: [], tieuSu: 'Một người tốt bụng', queQuan: 'Hà Nội',
}

describe('PersonDetailPanel', () => {
  it('renders person info without any edit/delete controls', () => {
    render(<PersonDetailPanel person={person} onClose={vi.fn()} />)
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument()
    expect(screen.getByText('Một người tốt bụng')).toBeInTheDocument()
    expect(screen.getByText('Hà Nội')).toBeInTheDocument()
    expect(screen.queryByText('Sửa')).not.toBeInTheDocument()
    expect(screen.queryByText('Xóa')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn()
    render(<PersonDetailPanel person={person} onClose={onClose} />)
    screen.getByLabelText('Đóng').click()
    expect(onClose).toHaveBeenCalled()
  })
})
```

Add to `src/pages/HomePage.test.tsx` (inspect the existing file's store-mocking conventions first, then add):
```typescript
import { useAuthStore } from '../store/useAuthStore'

describe('HomePage — anonymous access', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, setupNeeded: false, loading: false, error: null })
  })

  it('does not render the FAB "+" button when logged out', () => {
    // ...render HomePage with the existing store fixture used elsewhere in this file...
    expect(screen.queryByTitle('Thêm người mới')).not.toBeInTheDocument()
  })

  it('opens PersonDetailPanel (not PersonForm) when a person is selected while logged out', () => {
    // ...render HomePage, select a person via the store (selectPerson(id))...
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument() // PersonForm would render text inputs
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/PersonDetailPanel.test.tsx src/pages/HomePage.test.tsx`
Expected: FAIL — `PersonDetailPanel` doesn't exist; `HomePage` always renders the FAB and always opens `PersonForm` on selection regardless of auth state.

- [ ] **Step 3: Implement `src/components/PersonDetailPanel.tsx`**

```typescript
import type { Person } from '../types/giapha'

interface Props {
  person: Person
  onClose: () => void
}

function formatNgayThang(nt?: Person['namSinh']): string | null {
  if (!nt) return null
  const parts = [nt.ngay, nt.thang, nt.nam].filter(Boolean)
  if (parts.length === 0) return null
  return parts.join('/') + (nt.amLich ? ' (Âm lịch)' : '')
}

export default function PersonDetailPanel({ person, onClose }: Props) {
  const birth = formatNgayThang(person.namSinh)
  const death = formatNgayThang(person.namMat)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 flex flex-col gap-3 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{person.hoTen}</h2>
          <button aria-label="Đóng" onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>
        </div>

        {birth && <p className="text-sm text-gray-600">Sinh: {birth}</p>}
        {death && <p className="text-sm text-gray-600">Mất: {death}</p>}
        {person.queQuan && <p className="text-sm text-gray-600">Quê quán: {person.queQuan}</p>}
        {person.tieuSu && <p className="text-sm text-gray-700 whitespace-pre-wrap">{person.tieuSu}</p>}

        <div className="flex justify-end pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50">
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Modify `src/store/useGiaphaStore.ts`**

Change the `ViewMode` type to drop `'members'`:
```typescript
export type ViewMode = 'tree' | 'list'
```
Set the initial `viewMode` default and any references accordingly (it already defaults to `'list'`, so no further change needed there since `'members'` was never the default). Since `MemberManagementView` is now only ever rendered inside `ControlPanelPage` (Task 16), the `viewMode === 'members'` branch in `HomePage.tsx` (removed in Step 5 below) is the only other place that referenced it.

- [ ] **Step 5: Modify `src/pages/HomePage.tsx`**

```typescript
import { useState } from 'react'
import Navbar from '../components/Navbar'
import TreeView from '../components/TreeView'
import ListView from '../components/ListView'
import PersonForm from '../components/PersonForm'
import PersonDetailPanel from '../components/PersonDetailPanel'
import CyclicRelationshipBanner from '../components/CyclicRelationshipBanner'
import BottomTabBar from '../components/BottomTabBar'
import { useGiaphaStore } from '../store/useGiaphaStore'
import { useAuthStore } from '../store/useAuthStore'
import { useIsMobile } from '../utils/useIsMobile'

export default function HomePage() {
  const { viewMode, data, selectedPersonId, selectPerson } = useGiaphaStore()
  const { user } = useAuthStore()
  const [isAddOpen, setIsAddOpen] = useState(false)
  const isMobile = useIsMobile()
  const canEdit = user !== null

  const selectedPerson = selectedPersonId && data ? data.persons[selectedPersonId] ?? null : null
  // Logged-in admin/editor: clicking a person opens the editable PersonForm directly.
  // Anonymous/viewer: clicking a person opens a read-only detail panel instead.
  const editPerson = canEdit && !isAddOpen ? selectedPerson : null
  const readOnlyPerson = !canEdit ? selectedPerson : null
  const formOpen = isAddOpen || !!editPerson

  function openAdd() {
    if (!canEdit) return
    setIsAddOpen(true)
  }

  function closeForm() {
    setIsAddOpen(false)
    if (selectedPersonId) selectPerson(null)
  }

  return (
    <div className="h-dvh flex flex-col overflow-hidden">
      <Navbar />
      <CyclicRelationshipBanner />

      <div className="flex flex-1 overflow-hidden">
        {viewMode === 'tree' && <TreeView />}
        {viewMode === 'list' && <ListView />}
      </div>

      {isMobile && <BottomTabBar onAddClick={openAdd} />}

      {canEdit && (
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

      {readOnlyPerson && (
        <PersonDetailPanel person={readOnlyPerson} onClose={closeForm} />
      )}
    </div>
  )
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/components/PersonDetailPanel.test.tsx src/pages/HomePage.test.tsx`
Expected: PASS — all existing `HomePage` tests plus the new anonymous-access tests.

- [ ] **Step 7: Search for any other now-dangling references to the removed `'members'` view mode**

Run: `grep -rn "'members'" src/ | grep -v test`
Expected: No remaining references outside of comments; if any UI still tries to set `viewMode` to `'members'` (e.g. a leftover `BottomTabBar` tab), update it to navigate to `/control-panel` instead using `useNavigate()` from `react-router-dom`.

- [ ] **Step 8: Run the full frontend test suite to check for regressions**

Run: `npx vitest run`
Expected: PASS — all suites green. This completes all frontend work.

- [ ] **Step 9: Commit**

```bash
git add src/components/PersonDetailPanel.tsx src/pages/HomePage.tsx src/store/useGiaphaStore.ts src/components/PersonDetailPanel.test.tsx src/pages/HomePage.test.tsx
git commit -m "feat: read-only person detail for anonymous/viewer; gate FAB and edit-on-click; retire members view mode"
```

---

## Final verification

- [ ] **Run the entire test suite (frontend + worker) once more end-to-end**

```bash
npx vitest run
npm run test:worker
```
Expected: All suites pass with zero failures.

- [ ] **Manually smoke-test against local `wrangler dev` once, covering the full authorization matrix from the spec:**
  1. Apply the migration to the local D1 DB (`wrangler d1 execute giapha-db --local --file=worker/migrations/0001_add_auth_and_requests.sql`), then `npm run dev` (or the project's existing dev script).
  2. As an anonymous visitor: confirm Tree/List/generation-order-toggle work, FAB is absent, clicking a person opens the read-only panel, dropdown shows only "Chế độ xem"/"Thứ tự đời"/"Đăng nhập".
  3. Click "Đăng nhập" → since no users exist yet, confirm the modal shows "Tạo tài khoản Admin đầu tiên"; create the first admin.
  4. As admin: confirm FAB appears, add/edit/delete a person writes directly, Control Panel shows all 4 tabs, CSV export/import works, create an editor user via Quản lý User.
  5. Log out, log back in as the new editor: confirm add/edit/delete a person returns "gửi yêu cầu chờ duyệt", Control Panel shows only Thành viên + Yêu cầu của tôi (no CSV/Quản lý User tabs), CSV export/import routes are inaccessible (no UI entry point, and a direct `fetch` returns 403).
  6. Back as admin: open Yêu cầu chờ duyệt, approve one request and reject another; confirm the tree updates only for the approved one.

---
