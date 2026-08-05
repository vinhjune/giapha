# Landing Page + Article CMS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an editorial landing page (split-hub layout, mockup 3) in front of the existing gia phả tree app, with an admin/editor-manageable article + category CMS and a minimal events feed, wired into the existing Control Panel.

**Architecture:** New D1 tables `article_categories` and `articles` (Drizzle schema + hand-written SQL migration), three new Hono route modules (`article-categories.ts`, `articles.ts`, `events.ts`) mounted in `worker/src/index.ts`, reusing the existing `requireRole`/`attachUser` auth middleware and the existing unused `events` table. Frontend gets new types + API client functions, two new Control Panel management views (`ArticleManagementView`, `EventManagementView`), and a new public `LandingPage` component. Routing changes so `/` serves the landing page and `/gia-pha/*` serves the existing tree app.

**Tech Stack:** Hono + Cloudflare Workers + D1 + Drizzle ORM (backend, tested with `@cloudflare/vitest-pool-workers`); React 19 + React Router 7 + Zustand + Tailwind (frontend, tested with Vitest + Testing Library).

---

## Reference: Design Spec

Full approved design spec: `docs/superpowers/specs/2026-08-05-landing-page-design.md`. Key decisions already locked in there:
- Routing: `/` → landing page, `/gia-pha` → existing tree view.
- Both `admin` and `editor` roles can create/edit/delete articles, categories, and events directly — **no approval queue** (deliberate divergence from the `persons` `editor_requests` pattern in `worker/src/routes/editor.ts`).
- Categories are admin/editor-managed via a new `article_categories` table (not a fixed enum).
- Events reuse the existing, currently-unused `events` table in `worker/src/db/schema.ts`.
- Article body is plain text for v1 (no Markdown/rich text).
- Cover images reuse the R2 avatar upload pattern (`giapha_avatars` bucket, served via existing `GET /api/avatars/:key{.+}`).
- Mockup 3 (split-hub layout) is the chosen visual design: `/Users/vj/.copilot/session-state/c69aff94-bca2-49d9-b428-d5383b00805a/files/mockups/mockup-3-split-hub.html`.

---

## File Structure

| File | Responsibility |
|---|---|
| `worker/migrations/0003_add_articles.sql` | Creates `article_categories` + `articles` tables, seeds 3 categories |
| `worker/test/migrations/0003_add_articles.sql` | Mirror of above for test DB |
| `worker/src/db/schema.ts` | Add `articleCategories`, `articles` Drizzle tables + relations |
| `worker/src/routes/article-categories.ts` | CRUD routes for categories |
| `worker/test/routes-article-categories.test.ts` | Tests for above |
| `worker/src/routes/articles.ts` | CRUD + cover upload routes for articles |
| `worker/test/routes-articles.test.ts` | Tests for above |
| `worker/src/routes/events.ts` | CRUD routes for events |
| `worker/test/routes-events.test.ts` | Tests for above |
| `worker/src/index.ts` | Mount new route modules |
| `src/types/giapha.ts` | Add `ArticleCategory`, `Article`, `EventItem` types |
| `src/services/api.ts` | Add API client functions |
| `src/components/ArticleManagementView.tsx` | Control Panel: list/create/edit/delete articles + inline category CRUD |
| `src/components/ArticleManagementView.test.tsx` | Tests for above |
| `src/components/EventManagementView.tsx` | Control Panel: list/create/edit/delete events |
| `src/components/EventManagementView.test.tsx` | Tests for above |
| `src/pages/ControlPanelPage.tsx` | Add "Bài viết" / "Sự kiện" tabs (visible to admin + editor) |
| `src/pages/LandingPage.tsx` | Public split-hub landing page |
| `src/pages/LandingPage.test.tsx` | Tests for above |
| `src/App.tsx` | Routing: `/` → `LandingPage`, `/gia-pha/*` → `AppRoot` |
| `src/components/Navbar.tsx` | Add "Trang chủ" link |

---

## Task 1: Database migration — `article_categories` and `articles` tables

**Files:**
- Create: `worker/migrations/0003_add_articles.sql`
- Create: `worker/test/migrations/0003_add_articles.sql`
- Modify: `worker/src/db/schema.ts`

- [ ] **Step 1: Write the migration SQL**

Create `worker/migrations/0003_add_articles.sql`:

```sql
-- Migration 0003: Add article categories and articles tables for the landing page CMS
CREATE TABLE article_categories (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE articles (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  category_id TEXT NOT NULL REFERENCES article_categories(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  body TEXT NOT NULL,
  cover_image_key TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  display_order INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  author_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_articles_category_id ON articles(category_id);
CREATE INDEX idx_articles_status ON articles(status);

INSERT INTO article_categories (id, slug, name, display_order) VALUES
  ('cat-gioi-thieu', 'gioi-thieu-dong-ho', 'Giới thiệu dòng họ', 1),
  ('cat-quy-uoc', 'quy-uoc-trong-ho', 'Quy ước trong họ', 2),
  ('cat-hieu-hoc', 'truyen-thong-hieu-hoc', 'Truyền thống hiếu học', 3);
```

- [ ] **Step 2: Copy the migration into the test migrations folder**

```bash
cp worker/migrations/0003_add_articles.sql worker/test/migrations/0003_add_articles.sql
```

- [ ] **Step 3: Add Drizzle schema definitions**

In `worker/src/db/schema.ts`, add near the existing `events` table definition:

```typescript
export const articleCategories = sqliteTable('article_categories', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  displayOrder: integer('display_order').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

export const articles = sqliteTable('articles', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  categoryId: text('category_id').notNull().references(() => articleCategories.id, { onDelete: 'restrict' }),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  body: text('body').notNull(),
  coverImageKey: text('cover_image_key'),
  status: text('status', { enum: ['draft', 'published'] }).notNull().default('draft'),
  displayOrder: integer('display_order').notNull().default(0),
  publishedAt: text('published_at'),
  authorId: text('author_id').notNull().references(() => users.id),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

export const articleCategoriesRelations = relations(articleCategories, ({ many }) => ({
  articles: many(articles),
}));

export const articlesRelations = relations(articles, ({ one }) => ({
  category: one(articleCategories, {
    fields: [articles.categoryId],
    references: [articleCategories.id],
  }),
  author: one(users, {
    fields: [articles.authorId],
    references: [users.id],
  }),
}));
```

Check the top of `worker/src/db/schema.ts` for existing imports (`sqliteTable`, `text`, `integer`, `relations`, `sql`) — reuse them, do not re-import.

- [ ] **Step 4: Verify migrations apply cleanly in tests**

Run: `cd worker && npm run test:worker -- --run routes-users.test.ts`
Expected: PASS (existing tests still pass with new migration applied via `apply-migrations.ts`)

- [ ] **Step 5: Commit**

```bash
git add worker/migrations/0003_add_articles.sql worker/test/migrations/0003_add_articles.sql worker/src/db/schema.ts
git commit -m "feat(db): add article_categories and articles tables"
```

---

## Task 2: Worker routes — article categories CRUD

**Files:**
- Create: `worker/src/routes/article-categories.ts`
- Create: `worker/test/routes-article-categories.test.ts`

- [ ] **Step 1: Write failing tests**

Create `worker/test/routes-article-categories.test.ts` (mirror the setup/imports/helpers used in `worker/test/routes-users.test.ts` — same `env`, `applyD1Migrations`, `createTestApp`/app-building helper, and JWT/session-cookie login helper used there):

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../src/index';
import { applyMigrations } from './apply-migrations';
import { createTestUser, loginAs } from './test-helpers';

describe('Article categories routes', () => {
  beforeEach(async () => {
    await applyMigrations(env.giapha_db);
  });

  it('GET /api/article-categories returns seeded categories publicly (no auth)', async () => {
    const res = await app.request('/api/article-categories', {}, env);
    expect(res.status).toBe(200);
    const body = await res.json() as any[];
    expect(body.length).toBe(3);
    expect(body.map((c) => c.slug)).toContain('gioi-thieu-dong-ho');
  });

  it('POST /api/article-categories requires admin or editor role', async () => {
    const res = await app.request('/api/article-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'su-kien', name: 'Sự kiện đặc biệt', displayOrder: 4 }),
    }, env);
    expect(res.status).toBe(401);
  });

  it('POST /api/article-categories creates a category as admin', async () => {
    const cookie = await loginAs(env, 'admin');
    const res = await app.request('/api/article-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ slug: 'su-kien', name: 'Sự kiện đặc biệt', displayOrder: 4 }),
    }, env);
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.slug).toBe('su-kien');
  });

  it('POST /api/article-categories rejects duplicate slug with 409', async () => {
    const cookie = await loginAs(env, 'admin');
    const res = await app.request('/api/article-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ slug: 'gioi-thieu-dong-ho', name: 'Duplicate', displayOrder: 5 }),
    }, env);
    expect(res.status).toBe(409);
  });

  it('PUT /api/article-categories/:id updates a category as editor', async () => {
    const cookie = await loginAs(env, 'editor');
    const res = await app.request('/api/article-categories/cat-gioi-thieu', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Giới thiệu về dòng họ (updated)' }),
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.name).toBe('Giới thiệu về dòng họ (updated)');
  });

  it('DELETE /api/article-categories/:id returns 409 if category has articles', async () => {
    const cookie = await loginAs(env, 'admin');
    await app.request('/api/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        slug: 'bai-viet-test', categoryId: 'cat-gioi-thieu', title: 'Bài viết test',
        summary: 'Tóm tắt', body: 'Nội dung', status: 'draft', displayOrder: 1,
      }),
    }, env);
    const res = await app.request('/api/article-categories/cat-gioi-thieu', {
      method: 'DELETE', headers: { Cookie: cookie },
    }, env);
    expect(res.status).toBe(409);
  });

  it('DELETE /api/article-categories/:id succeeds if category has no articles', async () => {
    const cookie = await loginAs(env, 'admin');
    const res = await app.request('/api/article-categories/cat-hieu-hoc', {
      method: 'DELETE', headers: { Cookie: cookie },
    }, env);
    expect(res.status).toBe(204);
  });
});
```

Note: before writing this file for real, first open `worker/test/routes-users.test.ts` in full and copy its exact top-of-file imports and login/seed helper usage (env setup, `createTestUser`/`loginAs` function names may differ — match whatever helper names actually exist in that file and in `worker/test/test-helpers.ts` if present). Adjust the test code above to match the real helper signatures before running.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd worker && npm run test:worker -- --run routes-article-categories.test.ts`
Expected: FAIL (route module doesn't exist yet — import error or 404s)

- [ ] **Step 3: Implement the route module**

Create `worker/src/routes/article-categories.ts` (mirror `worker/src/routes/users.ts` structure: Hono instance typed with `HonoEnv`, `attachUser` + `requireRole` middleware usage, Drizzle `db` from `c.get('db')` or however `users.ts` accesses the DB client — match that exact pattern):

```typescript
import { Hono } from 'hono';
import { eq, asc, count } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { nanoid } from 'nanoid';
import type { HonoEnv } from '../types';
import { articleCategories, articles } from '../db/schema';
import { attachUser, requireRole } from '../middleware/auth';

const articleCategoriesRoutes = new Hono<HonoEnv>();

articleCategoriesRoutes.get('/article-categories', async (c) => {
  const db = drizzle(c.env.giapha_db);
  const categories = await db.select().from(articleCategories).orderBy(asc(articleCategories.displayOrder));
  const counts = await db.select({ categoryId: articles.categoryId, total: count() }).from(articles).groupBy(articles.categoryId);
  const countMap = new Map(counts.map((row) => [row.categoryId, row.total]));
  return c.json(categories.map((cat) => ({ ...cat, articleCount: countMap.get(cat.id) ?? 0 })));
});

articleCategoriesRoutes.post('/article-categories', attachUser, requireRole('admin', 'editor'), async (c) => {
  const db = drizzle(c.env.giapha_db);
  const payload = await c.req.json<{ slug: string; name: string; displayOrder?: number }>();
  if (!payload.slug || !payload.name) {
    return c.json({ error: 'slug and name are required' }, 400);
  }
  const existing = await db.select().from(articleCategories).where(eq(articleCategories.slug, payload.slug)).get();
  if (existing) {
    return c.json({ error: 'A category with this slug already exists' }, 409);
  }
  const id = `cat-${nanoid(10)}`;
  const now = new Date().toISOString();
  await db.insert(articleCategories).values({
    id, slug: payload.slug, name: payload.name, displayOrder: payload.displayOrder ?? 0,
    createdAt: now, updatedAt: now,
  });
  const created = await db.select().from(articleCategories).where(eq(articleCategories.id, id)).get();
  return c.json(created, 201);
});

articleCategoriesRoutes.put('/article-categories/:id', attachUser, requireRole('admin', 'editor'), async (c) => {
  const db = drizzle(c.env.giapha_db);
  const id = c.req.param('id');
  const payload = await c.req.json<{ slug?: string; name?: string; displayOrder?: number }>();
  const existing = await db.select().from(articleCategories).where(eq(articleCategories.id, id)).get();
  if (!existing) {
    return c.json({ error: 'Category not found' }, 404);
  }
  if (payload.slug && payload.slug !== existing.slug) {
    const dup = await db.select().from(articleCategories).where(eq(articleCategories.slug, payload.slug)).get();
    if (dup) {
      return c.json({ error: 'A category with this slug already exists' }, 409);
    }
  }
  await db.update(articleCategories).set({
    slug: payload.slug ?? existing.slug,
    name: payload.name ?? existing.name,
    displayOrder: payload.displayOrder ?? existing.displayOrder,
    updatedAt: new Date().toISOString(),
  }).where(eq(articleCategories.id, id));
  const updated = await db.select().from(articleCategories).where(eq(articleCategories.id, id)).get();
  return c.json(updated);
});

articleCategoriesRoutes.delete('/article-categories/:id', attachUser, requireRole('admin', 'editor'), async (c) => {
  const db = drizzle(c.env.giapha_db);
  const id = c.req.param('id');
  const existing = await db.select().from(articleCategories).where(eq(articleCategories.id, id)).get();
  if (!existing) {
    return c.json({ error: 'Category not found' }, 404);
  }
  const articleCount = await db.select({ total: count() }).from(articles).where(eq(articles.categoryId, id)).get();
  if (articleCount && articleCount.total > 0) {
    return c.json({ error: 'Cannot delete a category that still has articles' }, 409);
  }
  await db.delete(articleCategories).where(eq(articleCategories.id, id));
  return c.body(null, 204);
});

export default articleCategoriesRoutes;
```

Before finalizing, open `worker/src/routes/users.ts` and confirm: (a) how the DB client is actually obtained in this codebase (`drizzle(c.env.giapha_db)` vs. a shared `c.get('db')` helper), (b) the exact import path/name for `requireRole`/`attachUser`, (c) whether `nanoid` is already a dependency (check `worker/package.json`) — adjust the code above to match reality before running.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd worker && npm run test:worker -- --run routes-article-categories.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add worker/src/routes/article-categories.ts worker/test/routes-article-categories.test.ts
git commit -m "feat(worker): add article categories CRUD routes"
```

---

## Task 3: Worker routes — articles CRUD + cover upload

**Files:**
- Create: `worker/src/routes/articles.ts`
- Create: `worker/test/routes-articles.test.ts`

- [ ] **Step 1: Write failing tests**

Create `worker/test/routes-articles.test.ts` (again, copy real imports/helpers from `worker/test/routes-users.test.ts`):

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../src/index';
import { applyMigrations } from './apply-migrations';
import { loginAs } from './test-helpers';

describe('Articles routes', () => {
  beforeEach(async () => {
    await applyMigrations(env.giapha_db);
  });

  it('GET /api/articles returns only published articles, publicly', async () => {
    const cookie = await loginAs(env, 'admin');
    await app.request('/api/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        slug: 'draft-bai', categoryId: 'cat-gioi-thieu', title: 'Draft',
        summary: 'x', body: 'y', status: 'draft', displayOrder: 1,
      }),
    }, env);
    await app.request('/api/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        slug: 'published-bai', categoryId: 'cat-gioi-thieu', title: 'Published',
        summary: 'x', body: 'y', status: 'published', displayOrder: 2,
      }),
    }, env);
    const res = await app.request('/api/articles', {}, env);
    expect(res.status).toBe(200);
    const body = await res.json() as any[];
    expect(body.length).toBe(1);
    expect(body[0].slug).toBe('published-bai');
  });

  it('GET /api/articles/all requires admin or editor and returns all statuses', async () => {
    const unauth = await app.request('/api/articles/all', {}, env);
    expect(unauth.status).toBe(401);

    const cookie = await loginAs(env, 'editor');
    const res = await app.request('/api/articles/all', { headers: { Cookie: cookie } }, env);
    expect(res.status).toBe(200);
  });

  it('POST /api/articles rejects unknown categoryId with 400', async () => {
    const cookie = await loginAs(env, 'admin');
    const res = await app.request('/api/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        slug: 'bad-cat', categoryId: 'does-not-exist', title: 'x',
        summary: 'x', body: 'y', status: 'draft', displayOrder: 1,
      }),
    }, env);
    expect(res.status).toBe(400);
  });

  it('PUT /api/articles/:id sets publishedAt when status changes to published', async () => {
    const cookie = await loginAs(env, 'admin');
    const createRes = await app.request('/api/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        slug: 'to-publish', categoryId: 'cat-gioi-thieu', title: 'x',
        summary: 'x', body: 'y', status: 'draft', displayOrder: 1,
      }),
    }, env);
    const created = await createRes.json() as any;
    expect(created.publishedAt).toBeNull();

    const updateRes = await app.request(`/api/articles/${created.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ status: 'published' }),
    }, env);
    const updated = await updateRes.json() as any;
    expect(updated.status).toBe('published');
    expect(updated.publishedAt).not.toBeNull();
  });

  it('DELETE /api/articles/:id removes the article', async () => {
    const cookie = await loginAs(env, 'admin');
    const createRes = await app.request('/api/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        slug: 'to-delete', categoryId: 'cat-gioi-thieu', title: 'x',
        summary: 'x', body: 'y', status: 'draft', displayOrder: 1,
      }),
    }, env);
    const created = await createRes.json() as any;
    const res = await app.request(`/api/articles/${created.id}`, {
      method: 'DELETE', headers: { Cookie: cookie },
    }, env);
    expect(res.status).toBe(204);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd worker && npm run test:worker -- --run routes-articles.test.ts`
Expected: FAIL (route module doesn't exist)

- [ ] **Step 3: Implement the route module**

Create `worker/src/routes/articles.ts`:

```typescript
import { Hono } from 'hono';
import { eq, and, asc, desc } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { nanoid } from 'nanoid';
import type { HonoEnv } from '../types';
import { articles, articleCategories } from '../db/schema';
import { attachUser, requireRole } from '../middleware/auth';

const articlesRoutes = new Hono<HonoEnv>();

articlesRoutes.get('/articles', async (c) => {
  const db = drizzle(c.env.giapha_db);
  const rows = await db.select().from(articles)
    .where(eq(articles.status, 'published'))
    .orderBy(asc(articles.displayOrder), desc(articles.publishedAt));
  return c.json(rows);
});

articlesRoutes.get('/articles/all', attachUser, requireRole('admin', 'editor'), async (c) => {
  const db = drizzle(c.env.giapha_db);
  const rows = await db.select().from(articles).orderBy(asc(articles.displayOrder));
  return c.json(rows);
});

articlesRoutes.post('/articles', attachUser, requireRole('admin', 'editor'), async (c) => {
  const db = drizzle(c.env.giapha_db);
  const user = c.get('user')!;
  const payload = await c.req.json<{
    slug: string; categoryId: string; title: string; summary: string;
    body: string; status?: 'draft' | 'published'; displayOrder?: number;
  }>();
  if (!payload.slug || !payload.categoryId || !payload.title || !payload.summary || !payload.body) {
    return c.json({ error: 'slug, categoryId, title, summary and body are required' }, 400);
  }
  const category = await db.select().from(articleCategories).where(eq(articleCategories.id, payload.categoryId)).get();
  if (!category) {
    return c.json({ error: 'Unknown categoryId' }, 400);
  }
  const existingSlug = await db.select().from(articles).where(eq(articles.slug, payload.slug)).get();
  if (existingSlug) {
    return c.json({ error: 'An article with this slug already exists' }, 409);
  }
  const id = `article-${nanoid(10)}`;
  const now = new Date().toISOString();
  const status = payload.status ?? 'draft';
  await db.insert(articles).values({
    id, slug: payload.slug, categoryId: payload.categoryId, title: payload.title,
    summary: payload.summary, body: payload.body, status,
    displayOrder: payload.displayOrder ?? 0,
    publishedAt: status === 'published' ? now : null,
    authorId: user.id, createdAt: now, updatedAt: now,
  });
  const created = await db.select().from(articles).where(eq(articles.id, id)).get();
  return c.json(created, 201);
});

articlesRoutes.put('/articles/:id', attachUser, requireRole('admin', 'editor'), async (c) => {
  const db = drizzle(c.env.giapha_db);
  const id = c.req.param('id');
  const payload = await c.req.json<Partial<{
    slug: string; categoryId: string; title: string; summary: string;
    body: string; status: 'draft' | 'published'; displayOrder: number;
  }>>();
  const existing = await db.select().from(articles).where(eq(articles.id, id)).get();
  if (!existing) {
    return c.json({ error: 'Article not found' }, 404);
  }
  if (payload.categoryId && payload.categoryId !== existing.categoryId) {
    const category = await db.select().from(articleCategories).where(eq(articleCategories.id, payload.categoryId)).get();
    if (!category) {
      return c.json({ error: 'Unknown categoryId' }, 400);
    }
  }
  if (payload.slug && payload.slug !== existing.slug) {
    const dup = await db.select().from(articles).where(eq(articles.slug, payload.slug)).get();
    if (dup) {
      return c.json({ error: 'An article with this slug already exists' }, 409);
    }
  }
  const now = new Date().toISOString();
  const nextStatus = payload.status ?? existing.status;
  const publishedAt = nextStatus === 'published'
    ? (existing.publishedAt ?? now)
    : null;
  await db.update(articles).set({
    slug: payload.slug ?? existing.slug,
    categoryId: payload.categoryId ?? existing.categoryId,
    title: payload.title ?? existing.title,
    summary: payload.summary ?? existing.summary,
    body: payload.body ?? existing.body,
    status: nextStatus,
    displayOrder: payload.displayOrder ?? existing.displayOrder,
    publishedAt,
    updatedAt: now,
  }).where(eq(articles.id, id));
  const updated = await db.select().from(articles).where(eq(articles.id, id)).get();
  return c.json(updated);
});

articlesRoutes.delete('/articles/:id', attachUser, requireRole('admin', 'editor'), async (c) => {
  const db = drizzle(c.env.giapha_db);
  const id = c.req.param('id');
  const existing = await db.select().from(articles).where(eq(articles.id, id)).get();
  if (!existing) {
    return c.json({ error: 'Article not found' }, 404);
  }
  await db.delete(articles).where(eq(articles.id, id));
  return c.body(null, 204);
});

articlesRoutes.post('/articles/:id/cover', attachUser, requireRole('admin', 'editor'), async (c) => {
  const db = drizzle(c.env.giapha_db);
  const id = c.req.param('id');
  const existing = await db.select().from(articles).where(eq(articles.id, id)).get();
  if (!existing) {
    return c.json({ error: 'Article not found' }, 404);
  }
  const formData = await c.req.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return c.json({ error: 'file is required' }, 400);
  }
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const key = `article-covers/${id}.${ext}`;
  await c.env.giapha_avatars.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type || 'image/jpeg' },
  });
  await db.update(articles).set({ coverImageKey: key, updatedAt: new Date().toISOString() }).where(eq(articles.id, id));
  const updated = await db.select().from(articles).where(eq(articles.id, id)).get();
  return c.json(updated);
});

export default articlesRoutes;
```

Before finalizing, open `worker/src/routes/editor.ts` and confirm the exact R2 bucket binding name (`c.env.giapha_avatars` vs. something else) and the exact multipart/form-data parsing pattern used for the existing avatar upload handler — match it exactly instead of assuming.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd worker && npm run test:worker -- --run routes-articles.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add worker/src/routes/articles.ts worker/test/routes-articles.test.ts
git commit -m "feat(worker): add articles CRUD and cover upload routes"
```

---

## Task 4: Worker routes — events CRUD

**Files:**
- Create: `worker/src/routes/events.ts`
- Create: `worker/test/routes-events.test.ts`

- [ ] **Step 1: Write failing tests**

Create `worker/test/routes-events.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../src/index';
import { applyMigrations } from './apply-migrations';
import { loginAs } from './test-helpers';

describe('Events routes', () => {
  beforeEach(async () => {
    await applyMigrations(env.giapha_db);
  });

  it('GET /api/events is public and returns empty list initially', async () => {
    const res = await app.request('/api/events', {}, env);
    expect(res.status).toBe(200);
    const body = await res.json() as any[];
    expect(body).toEqual([]);
  });

  it('POST /api/events requires admin or editor role', async () => {
    const res = await app.request('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Giỗ tổ', dateText: '10/3 âm lịch', isLunar: true, isRecurring: true }),
    }, env);
    expect(res.status).toBe(401);
  });

  it('POST /api/events creates an event as editor', async () => {
    const cookie = await loginAs(env, 'editor');
    const res = await app.request('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'Giỗ tổ', dateText: '10/3 âm lịch', isLunar: true, isRecurring: true }),
    }, env);
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.title).toBe('Giỗ tổ');
  });

  it('PUT /api/events/:id updates an event', async () => {
    const cookie = await loginAs(env, 'admin');
    const createRes = await app.request('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'Giỗ tổ', dateText: '10/3 âm lịch', isLunar: true, isRecurring: true }),
    }, env);
    const created = await createRes.json() as any;
    const res = await app.request(`/api/events/${created.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'Giỗ tổ họ Nguyễn' }),
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.title).toBe('Giỗ tổ họ Nguyễn');
  });

  it('DELETE /api/events/:id removes the event', async () => {
    const cookie = await loginAs(env, 'admin');
    const createRes = await app.request('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ title: 'Giỗ tổ', dateText: '10/3 âm lịch', isLunar: true, isRecurring: true }),
    }, env);
    const created = await createRes.json() as any;
    const res = await app.request(`/api/events/${created.id}`, {
      method: 'DELETE', headers: { Cookie: cookie },
    }, env);
    expect(res.status).toBe(204);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd worker && npm run test:worker -- --run routes-events.test.ts`
Expected: FAIL (route module doesn't exist)

- [ ] **Step 3: Implement the route module**

First open `worker/src/db/schema.ts` lines defining the `events` table to get the exact column names (`dateText`, `year`, `month`, `day`, `isLunar`, `isRecurring`, etc.) and confirm they match what's used below — adjust field names if they differ.

Create `worker/src/routes/events.ts`:

```typescript
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { nanoid } from 'nanoid';
import type { HonoEnv } from '../types';
import { events } from '../db/schema';
import { attachUser, requireRole } from '../middleware/auth';

const eventsRoutes = new Hono<HonoEnv>();

eventsRoutes.get('/events', async (c) => {
  const db = drizzle(c.env.giapha_db);
  const rows = await db.select().from(events);
  return c.json(rows);
});

eventsRoutes.post('/events', attachUser, requireRole('admin', 'editor'), async (c) => {
  const db = drizzle(c.env.giapha_db);
  const payload = await c.req.json<{
    title: string; description?: string; dateText: string;
    year?: number; month?: number; day?: number;
    isLunar?: boolean; isRecurring?: boolean;
  }>();
  if (!payload.title || !payload.dateText) {
    return c.json({ error: 'title and dateText are required' }, 400);
  }
  const id = `event-${nanoid(10)}`;
  const now = new Date().toISOString();
  await db.insert(events).values({
    id, title: payload.title, description: payload.description ?? null,
    dateText: payload.dateText, year: payload.year ?? null,
    month: payload.month ?? null, day: payload.day ?? null,
    isLunar: payload.isLunar ?? false, isRecurring: payload.isRecurring ?? false,
    createdAt: now, updatedAt: now,
  });
  const created = await db.select().from(events).where(eq(events.id, id)).get();
  return c.json(created, 201);
});

eventsRoutes.put('/events/:id', attachUser, requireRole('admin', 'editor'), async (c) => {
  const db = drizzle(c.env.giapha_db);
  const id = c.req.param('id');
  const payload = await c.req.json<Partial<{
    title: string; description: string; dateText: string;
    year: number; month: number; day: number;
    isLunar: boolean; isRecurring: boolean;
  }>>();
  const existing = await db.select().from(events).where(eq(events.id, id)).get();
  if (!existing) {
    return c.json({ error: 'Event not found' }, 404);
  }
  await db.update(events).set({
    title: payload.title ?? existing.title,
    description: payload.description ?? existing.description,
    dateText: payload.dateText ?? existing.dateText,
    year: payload.year ?? existing.year,
    month: payload.month ?? existing.month,
    day: payload.day ?? existing.day,
    isLunar: payload.isLunar ?? existing.isLunar,
    isRecurring: payload.isRecurring ?? existing.isRecurring,
    updatedAt: new Date().toISOString(),
  }).where(eq(events.id, id));
  const updated = await db.select().from(events).where(eq(events.id, id)).get();
  return c.json(updated);
});

eventsRoutes.delete('/events/:id', attachUser, requireRole('admin', 'editor'), async (c) => {
  const db = drizzle(c.env.giapha_db);
  const id = c.req.param('id');
  const existing = await db.select().from(events).where(eq(events.id, id)).get();
  if (!existing) {
    return c.json({ error: 'Event not found' }, 404);
  }
  await db.delete(events).where(eq(events.id, id));
  return c.body(null, 204);
});

export default eventsRoutes;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd worker && npm run test:worker -- --run routes-events.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add worker/src/routes/events.ts worker/test/routes-events.test.ts
git commit -m "feat(worker): add events CRUD routes"
```

---

## Task 5: Mount new route modules

**Files:**
- Modify: `worker/src/index.ts`

- [ ] **Step 1: Add imports and mount routes**

Open `worker/src/index.ts`, find where existing routers (`treeRoutes`, `editorRoutes`, `csvRoutes`, `requestRoutes`, `userRoutes`) are imported and mounted with `app.route('/api', xRoutes)`. Add, following the exact same pattern:

```typescript
import articleCategoriesRoutes from './routes/article-categories';
import articlesRoutes from './routes/articles';
import eventsRoutes from './routes/events';
```

and alongside the existing `app.route('/api', ...)` calls:

```typescript
app.route('/api', articleCategoriesRoutes);
app.route('/api', articlesRoutes);
app.route('/api', eventsRoutes);
```

- [ ] **Step 2: Run the full worker test suite**

Run: `cd worker && npm run test:worker`
Expected: PASS (all existing + new tests green)

- [ ] **Step 3: Commit**

```bash
git add worker/src/index.ts
git commit -m "feat(worker): mount article categories, articles, and events routes"
```

---

## Task 6: Frontend types and API client functions

**Files:**
- Modify: `src/types/giapha.ts`
- Modify: `src/services/api.ts`

- [ ] **Step 1: Add TypeScript types**

In `src/types/giapha.ts`, add:

```typescript
export interface ArticleCategory {
  id: string;
  slug: string;
  name: string;
  displayOrder: number;
  articleCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Article {
  id: string;
  slug: string;
  categoryId: string;
  title: string;
  summary: string;
  body: string;
  coverImageKey: string | null;
  status: 'draft' | 'published';
  displayOrder: number;
  publishedAt: string | null;
  authorId: string;
  createdAt: string;
  updatedAt: string;
}

export interface EventItem {
  id: string;
  title: string;
  description: string | null;
  dateText: string;
  year: number | null;
  month: number | null;
  day: number | null;
  isLunar: boolean;
  isRecurring: boolean;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: Add API client functions**

Open `src/services/api.ts`, find the generic `request<T>()` helper and an existing function (e.g. `listUsers`/`createUser`) to copy the exact call signature (base URL, credentials, error handling). Add:

```typescript
import type { ArticleCategory, Article, EventItem } from '../types/giapha';

export function listArticleCategories() {
  return request<ArticleCategory[]>('/api/article-categories');
}

export function createArticleCategory(data: { slug: string; name: string; displayOrder?: number }) {
  return request<ArticleCategory>('/api/article-categories', { method: 'POST', body: JSON.stringify(data) });
}

export function updateArticleCategory(id: string, data: Partial<{ slug: string; name: string; displayOrder: number }>) {
  return request<ArticleCategory>(`/api/article-categories/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deleteArticleCategory(id: string) {
  return request<void>(`/api/article-categories/${id}`, { method: 'DELETE' });
}

export function listArticles() {
  return request<Article[]>('/api/articles');
}

export function listAllArticles() {
  return request<Article[]>('/api/articles/all');
}

export function createArticle(data: {
  slug: string; categoryId: string; title: string; summary: string;
  body: string; status?: 'draft' | 'published'; displayOrder?: number;
}) {
  return request<Article>('/api/articles', { method: 'POST', body: JSON.stringify(data) });
}

export function updateArticle(id: string, data: Partial<{
  slug: string; categoryId: string; title: string; summary: string;
  body: string; status: 'draft' | 'published'; displayOrder: number;
}>) {
  return request<Article>(`/api/articles/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deleteArticle(id: string) {
  return request<void>(`/api/articles/${id}`, { method: 'DELETE' });
}

export function uploadArticleCover(id: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return request<Article>(`/api/articles/${id}/cover`, { method: 'POST', body: formData });
}

export function listEvents() {
  return request<EventItem[]>('/api/events');
}

export function createEvent(data: {
  title: string; description?: string; dateText: string;
  year?: number; month?: number; day?: number; isLunar?: boolean; isRecurring?: boolean;
}) {
  return request<EventItem>('/api/events', { method: 'POST', body: JSON.stringify(data) });
}

export function updateEvent(id: string, data: Partial<{
  title: string; description: string; dateText: string;
  year: number; month: number; day: number; isLunar: boolean; isRecurring: boolean;
}>) {
  return request<EventItem>(`/api/events/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deleteEvent(id: string) {
  return request<void>(`/api/events/${id}`, { method: 'DELETE' });
}
```

Before finalizing, check the real `request<T>()` signature in `src/services/api.ts` — confirm whether it sets `Content-Type: application/json` automatically (if so, don't set it manually for the FormData upload call, since the browser must set its own multipart boundary) and whether it already handles `credentials: 'include'`.

- [ ] **Step 3: Verify the frontend type-checks**

Run: `npm run build` (or `npx tsc --noEmit` if that's the existing type-check script — check `package.json` scripts first)
Expected: no new TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add src/types/giapha.ts src/services/api.ts
git commit -m "feat(frontend): add article/category/event types and API client functions"
```

---

## Task 7: Article management view (Control Panel)

**Files:**
- Create: `src/components/ArticleManagementView.tsx`
- Create: `src/components/ArticleManagementView.test.tsx`

- [ ] **Step 1: Write a failing test**

First open `src/components/UserManagementPanel.test.tsx` in full to copy its exact test setup (mocking `src/services/api.ts`, rendering conventions, Testing Library queries used). Then create `src/components/ArticleManagementView.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ArticleManagementView } from './ArticleManagementView';
import * as api from '../services/api';

vi.mock('../services/api');

const mockCategories = [
  { id: 'cat-1', slug: 'gioi-thieu', name: 'Giới thiệu', displayOrder: 1, articleCount: 1, createdAt: '', updatedAt: '' },
];
const mockArticles = [
  { id: 'a1', slug: 'bai-1', categoryId: 'cat-1', title: 'Bài viết 1', summary: 'Tóm tắt', body: 'Nội dung', coverImageKey: null, status: 'published', displayOrder: 1, publishedAt: '2026-01-01', authorId: 'u1', createdAt: '', updatedAt: '' },
];

describe('ArticleManagementView', () => {
  beforeEach(() => {
    vi.mocked(api.listAllArticles).mockResolvedValue(mockArticles as any);
    vi.mocked(api.listArticleCategories).mockResolvedValue(mockCategories as any);
  });

  it('renders the list of articles with their category name', async () => {
    render(<ArticleManagementView />);
    await waitFor(() => {
      expect(screen.getByText('Bài viết 1')).toBeInTheDocument();
    });
    expect(screen.getByText('Giới thiệu')).toBeInTheDocument();
  });

  it('creates a new article when the form is submitted', async () => {
    vi.mocked(api.createArticle).mockResolvedValue({ ...mockArticles[0], id: 'a2', title: 'Bài mới' } as any);
    const user = userEvent.setup();
    render(<ArticleManagementView />);
    await waitFor(() => expect(screen.getByText('Bài viết 1')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /thêm bài viết/i }));
    await user.type(screen.getByLabelText(/tiêu đề/i), 'Bài mới');
    await user.type(screen.getByLabelText(/slug/i), 'bai-moi');
    await user.type(screen.getByLabelText(/tóm tắt/i), 'Tóm tắt mới');
    await user.type(screen.getByLabelText(/nội dung/i), 'Nội dung mới');
    await user.click(screen.getByRole('button', { name: /^lưu$/i }));

    await waitFor(() => {
      expect(api.createArticle).toHaveBeenCalledWith(expect.objectContaining({ title: 'Bài mới', slug: 'bai-moi' }));
    });
  });

  it('creates a new category via the inline category form', async () => {
    vi.mocked(api.createArticleCategory).mockResolvedValue({ id: 'cat-2', slug: 'su-kien', name: 'Sự kiện', displayOrder: 2, articleCount: 0, createdAt: '', updatedAt: '' });
    const user = userEvent.setup();
    render(<ArticleManagementView />);
    await waitFor(() => expect(screen.getByText('Giới thiệu')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /quản lý chuyên mục/i }));
    await user.type(screen.getByLabelText(/tên chuyên mục/i), 'Sự kiện');
    await user.type(screen.getByLabelText(/slug chuyên mục/i), 'su-kien');
    await user.click(screen.getByRole('button', { name: /thêm chuyên mục/i }));

    await waitFor(() => {
      expect(api.createArticleCategory).toHaveBeenCalledWith(expect.objectContaining({ name: 'Sự kiện', slug: 'su-kien' }));
    });
  });

  it('deletes an article after confirmation', async () => {
    vi.mocked(api.deleteArticle).mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    render(<ArticleManagementView />);
    await waitFor(() => expect(screen.getByText('Bài viết 1')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /xoá bài viết 1/i }));

    await waitFor(() => {
      expect(api.deleteArticle).toHaveBeenCalledWith('a1');
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- ArticleManagementView.test.tsx`
Expected: FAIL (module doesn't exist)

- [ ] **Step 3: Implement the component**

Open `src/components/UserManagementPanel.tsx` in full first and copy its exact structural pattern (functional component, `useState` for list/loading/form-visibility/edit-target, `useEffect` to fetch on mount, a `refetch()` helper called after every mutation, Tailwind class conventions, button/label styling). Then create `src/components/ArticleManagementView.tsx`:

```tsx
import { useState, useEffect, useCallback, FormEvent } from 'react';
import {
  listAllArticles, createArticle, updateArticle, deleteArticle,
  listArticleCategories, createArticleCategory, updateArticleCategory, deleteArticleCategory,
} from '../services/api';
import type { Article, ArticleCategory } from '../types/giapha';

export function ArticleManagementView() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<ArticleCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArticleForm, setShowArticleForm] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [showCategoryPanel, setShowCategoryPanel] = useState(false);

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [summary, setSummary] = useState('');
  const [body, setBody] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');

  const [categoryName, setCategoryName] = useState('');
  const [categorySlug, setCategorySlug] = useState('');

  const refetch = useCallback(async () => {
    setLoading(true);
    const [articleRows, categoryRows] = await Promise.all([listAllArticles(), listArticleCategories()]);
    setArticles(articleRows);
    setCategories(categoryRows);
    setLoading(false);
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const categoryNameById = (id: string) => categories.find((c) => c.id === id)?.name ?? id;

  function resetArticleForm() {
    setTitle(''); setSlug(''); setCategoryId(categories[0]?.id ?? ''); setSummary(''); setBody(''); setStatus('draft');
    setEditingArticle(null);
  }

  function startEdit(article: Article) {
    setEditingArticle(article);
    setTitle(article.title); setSlug(article.slug); setCategoryId(article.categoryId);
    setSummary(article.summary); setBody(article.body); setStatus(article.status);
    setShowArticleForm(true);
  }

  async function handleArticleSubmit(e: FormEvent) {
    e.preventDefault();
    if (editingArticle) {
      await updateArticle(editingArticle.id, { title, slug, categoryId, summary, body, status });
    } else {
      await createArticle({ title, slug, categoryId, summary, body, status });
    }
    setShowArticleForm(false);
    resetArticleForm();
    await refetch();
  }

  async function handleDeleteArticle(article: Article) {
    if (!window.confirm(`Xoá bài viết "${article.title}"?`)) return;
    await deleteArticle(article.id);
    await refetch();
  }

  async function handleCategorySubmit(e: FormEvent) {
    e.preventDefault();
    await createArticleCategory({ name: categoryName, slug: categorySlug });
    setCategoryName(''); setCategorySlug('');
    await refetch();
  }

  async function handleDeleteCategory(category: ArticleCategory) {
    if (!window.confirm(`Xoá chuyên mục "${category.name}"?`)) return;
    try {
      await deleteArticleCategory(category.id);
      await refetch();
    } catch {
      window.alert('Không thể xoá chuyên mục còn bài viết.');
    }
  }

  if (loading) {
    return <p>Đang tải...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Quản lý bài viết</h2>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded bg-gray-200 px-3 py-1.5 text-sm"
            onClick={() => setShowCategoryPanel((v) => !v)}
          >
            Quản lý chuyên mục
          </button>
          <button
            type="button"
            className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white"
            onClick={() => { resetArticleForm(); setShowArticleForm((v) => !v); }}
          >
            Thêm bài viết
          </button>
        </div>
      </div>

      {showCategoryPanel && (
        <div className="rounded border p-4 space-y-3">
          <h3 className="font-medium">Chuyên mục</h3>
          <ul className="space-y-1">
            {categories.map((cat) => (
              <li key={cat.id} className="flex items-center justify-between text-sm">
                <span>{cat.name} ({cat.articleCount ?? 0})</span>
                <button type="button" className="text-red-600" onClick={() => handleDeleteCategory(cat)}>
                  Xoá
                </button>
              </li>
            ))}
          </ul>
          <form onSubmit={handleCategorySubmit} className="flex gap-2 items-end">
            <div>
              <label htmlFor="category-name" className="block text-xs">Tên chuyên mục</label>
              <input id="category-name" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} className="border rounded px-2 py-1 text-sm" />
            </div>
            <div>
              <label htmlFor="category-slug" className="block text-xs">Slug chuyên mục</label>
              <input id="category-slug" value={categorySlug} onChange={(e) => setCategorySlug(e.target.value)} className="border rounded px-2 py-1 text-sm" />
            </div>
            <button type="submit" className="rounded bg-blue-600 px-3 py-1 text-sm text-white">Thêm chuyên mục</button>
          </form>
        </div>
      )}

      {showArticleForm && (
        <form onSubmit={handleArticleSubmit} className="rounded border p-4 space-y-3">
          <div>
            <label htmlFor="article-title" className="block text-xs">Tiêu đề</label>
            <input id="article-title" value={title} onChange={(e) => setTitle(e.target.value)} className="border rounded px-2 py-1 text-sm w-full" />
          </div>
          <div>
            <label htmlFor="article-slug" className="block text-xs">Slug</label>
            <input id="article-slug" value={slug} onChange={(e) => setSlug(e.target.value)} className="border rounded px-2 py-1 text-sm w-full" />
          </div>
          <div>
            <label htmlFor="article-category" className="block text-xs">Chuyên mục</label>
            <select id="article-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="border rounded px-2 py-1 text-sm w-full">
              {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="article-summary" className="block text-xs">Tóm tắt</label>
            <textarea id="article-summary" value={summary} onChange={(e) => setSummary(e.target.value)} className="border rounded px-2 py-1 text-sm w-full" />
          </div>
          <div>
            <label htmlFor="article-body" className="block text-xs">Nội dung</label>
            <textarea id="article-body" value={body} onChange={(e) => setBody(e.target.value)} className="border rounded px-2 py-1 text-sm w-full" rows={6} />
          </div>
          <div>
            <label htmlFor="article-status" className="block text-xs">Trạng thái</label>
            <select id="article-status" value={status} onChange={(e) => setStatus(e.target.value as 'draft' | 'published')} className="border rounded px-2 py-1 text-sm w-full">
              <option value="draft">Nháp</option>
              <option value="published">Đã đăng</option>
            </select>
          </div>
          <button type="submit" className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white">Lưu</button>
        </form>
      )}

      <ul className="divide-y">
        {articles.map((article) => (
          <li key={article.id} className="flex items-center justify-between py-2">
            <div>
              <p className="font-medium">{article.title}</p>
              <p className="text-xs text-gray-500">{categoryNameById(article.categoryId)} · {article.status === 'published' ? 'Đã đăng' : 'Nháp'}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="text-sm text-blue-600" onClick={() => startEdit(article)}>Sửa</button>
              <button
                type="button"
                aria-label={`Xoá ${article.title}`}
                className="text-sm text-red-600"
                onClick={() => handleDeleteArticle(article)}
              >
                Xoá
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- ArticleManagementView.test.tsx`
Expected: PASS. If the delete button's accessible name test fails because of the `aria-label` text mismatch (test expects `/xoá bài viết 1/i`, component renders `Xoá ${article.title}` = "Xoá Bài viết 1"), fix the mismatch by aligning the test regex or the aria-label text — case-insensitive Vietnamese matching should already work since `/xoá bài viết 1/i` matches "Xoá Bài viết 1".

- [ ] **Step 5: Commit**

```bash
git add src/components/ArticleManagementView.tsx src/components/ArticleManagementView.test.tsx
git commit -m "feat(frontend): add ArticleManagementView with inline category management"
```

---

## Task 8: Event management view (Control Panel)

**Files:**
- Create: `src/components/EventManagementView.tsx`
- Create: `src/components/EventManagementView.test.tsx`

- [ ] **Step 1: Write a failing test**

Create `src/components/EventManagementView.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EventManagementView } from './EventManagementView';
import * as api from '../services/api';

vi.mock('../services/api');

const mockEvents = [
  { id: 'e1', title: 'Giỗ tổ', description: null, dateText: '10/3 âm lịch', year: null, month: 3, day: 10, isLunar: true, isRecurring: true, createdAt: '', updatedAt: '' },
];

describe('EventManagementView', () => {
  beforeEach(() => {
    vi.mocked(api.listEvents).mockResolvedValue(mockEvents as any);
  });

  it('renders the list of events', async () => {
    render(<EventManagementView />);
    await waitFor(() => {
      expect(screen.getByText('Giỗ tổ')).toBeInTheDocument();
    });
  });

  it('creates a new event when the form is submitted', async () => {
    vi.mocked(api.createEvent).mockResolvedValue({ ...mockEvents[0], id: 'e2', title: 'Tết Nguyên Đán' } as any);
    const user = userEvent.setup();
    render(<EventManagementView />);
    await waitFor(() => expect(screen.getByText('Giỗ tổ')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /thêm sự kiện/i }));
    await user.type(screen.getByLabelText(/tiêu đề/i), 'Tết Nguyên Đán');
    await user.type(screen.getByLabelText(/mô tả ngày/i), 'Mùng 1 Tết');
    await user.click(screen.getByRole('button', { name: /^lưu$/i }));

    await waitFor(() => {
      expect(api.createEvent).toHaveBeenCalledWith(expect.objectContaining({ title: 'Tết Nguyên Đán', dateText: 'Mùng 1 Tết' }));
    });
  });

  it('deletes an event after confirmation', async () => {
    vi.mocked(api.deleteEvent).mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    render(<EventManagementView />);
    await waitFor(() => expect(screen.getByText('Giỗ tổ')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /xoá giỗ tổ/i }));

    await waitFor(() => {
      expect(api.deleteEvent).toHaveBeenCalledWith('e1');
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- EventManagementView.test.tsx`
Expected: FAIL (module doesn't exist)

- [ ] **Step 3: Implement the component**

Create `src/components/EventManagementView.tsx`:

```tsx
import { useState, useEffect, useCallback, FormEvent } from 'react';
import { listEvents, createEvent, deleteEvent } from '../services/api';
import type { EventItem } from '../types/giapha';

export function EventManagementView() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [dateText, setDateText] = useState('');
  const [isLunar, setIsLunar] = useState(false);
  const [isRecurring, setIsRecurring] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    setEvents(await listEvents());
    setLoading(false);
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await createEvent({ title, dateText, isLunar, isRecurring });
    setTitle(''); setDateText(''); setIsLunar(false); setIsRecurring(true);
    setShowForm(false);
    await refetch();
  }

  async function handleDelete(event: EventItem) {
    if (!window.confirm(`Xoá sự kiện "${event.title}"?`)) return;
    await deleteEvent(event.id);
    await refetch();
  }

  if (loading) {
    return <p>Đang tải...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Quản lý sự kiện</h2>
        <button
          type="button"
          className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white"
          onClick={() => setShowForm((v) => !v)}
        >
          Thêm sự kiện
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded border p-4 space-y-3">
          <div>
            <label htmlFor="event-title" className="block text-xs">Tiêu đề</label>
            <input id="event-title" value={title} onChange={(e) => setTitle(e.target.value)} className="border rounded px-2 py-1 text-sm w-full" />
          </div>
          <div>
            <label htmlFor="event-date-text" className="block text-xs">Mô tả ngày</label>
            <input id="event-date-text" value={dateText} onChange={(e) => setDateText(e.target.value)} className="border rounded px-2 py-1 text-sm w-full" placeholder="VD: 10/3 âm lịch" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isLunar} onChange={(e) => setIsLunar(e.target.checked)} />
            Âm lịch
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} />
            Lặp lại hằng năm
          </label>
          <button type="submit" className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white">Lưu</button>
        </form>
      )}

      <ul className="divide-y">
        {events.map((event) => (
          <li key={event.id} className="flex items-center justify-between py-2">
            <div>
              <p className="font-medium">{event.title}</p>
              <p className="text-xs text-gray-500">{event.dateText}</p>
            </div>
            <button
              type="button"
              aria-label={`Xoá ${event.title}`}
              className="text-sm text-red-600"
              onClick={() => handleDelete(event)}
            >
              Xoá
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- EventManagementView.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/EventManagementView.tsx src/components/EventManagementView.test.tsx
git commit -m "feat(frontend): add EventManagementView"
```

---

## Task 9: Wire new tabs into Control Panel

**Files:**
- Modify: `src/pages/ControlPanelPage.tsx`

- [ ] **Step 1: Add the new tabs**

Open `src/pages/ControlPanelPage.tsx` in full first. Find the tabs array/config and the `isAdmin ? [...] : []` gating pattern used for `csv`/`users` tabs. Add two new tab entries for `articles` (label "Bài viết") and `events` (label "Sự kiện") that are **always included regardless of `isAdmin`** (visible to both admin and editor), rendering `<ArticleManagementView />` and `<EventManagementView />` respectively. Import both components at the top of the file:

```typescript
import { ArticleManagementView } from '../components/ArticleManagementView';
import { EventManagementView } from '../components/EventManagementView';
```

Add the tab objects to the unconditional part of the tabs list (not inside the `isAdmin` spread), matching whatever shape the existing tab objects use (e.g. `{ key: 'articles', label: 'Bài viết', content: <ArticleManagementView /> }` — match the exact existing shape/prop names found in the file).

- [ ] **Step 2: Verify manually**

Run: `npm run build`
Expected: no TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add src/pages/ControlPanelPage.tsx
git commit -m "feat(frontend): add Bài viết and Sự kiện tabs to Control Panel"
```

---

## Task 10: Landing page

**Files:**
- Create: `src/pages/LandingPage.tsx`
- Create: `src/pages/LandingPage.test.tsx`

- [ ] **Step 1: Write a failing test**

Create `src/pages/LandingPage.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LandingPage } from './LandingPage';
import * as api from '../services/api';

vi.mock('../services/api');

const mockCategories = [
  { id: 'cat-1', slug: 'gioi-thieu', name: 'Giới thiệu dòng họ', displayOrder: 1, articleCount: 1, createdAt: '', updatedAt: '' },
];
const mockArticles = [
  { id: 'a1', slug: 'bai-1', categoryId: 'cat-1', title: 'Bài viết nổi bật', summary: 'Tóm tắt bài viết', body: 'Nội dung', coverImageKey: null, status: 'published', displayOrder: 1, publishedAt: '2026-01-01', authorId: 'u1', createdAt: '', updatedAt: '' },
];
const mockEvents = [
  { id: 'e1', title: 'Giỗ tổ', description: null, dateText: '10/3 âm lịch', year: null, month: 3, day: 10, isLunar: true, isRecurring: true, createdAt: '', updatedAt: '' },
];

describe('LandingPage', () => {
  beforeEach(() => {
    vi.mocked(api.listArticleCategories).mockResolvedValue(mockCategories as any);
    vi.mocked(api.listArticles).mockResolvedValue(mockArticles as any);
    vi.mocked(api.listEvents).mockResolvedValue(mockEvents as any);
  });

  it('renders categories, featured article, and events', async () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Bài viết nổi bật')).toBeInTheDocument();
    });
    expect(screen.getByText('Giới thiệu dòng họ')).toBeInTheDocument();
    expect(screen.getByText('Giỗ tổ')).toBeInTheDocument();
  });

  it('has a CTA link to the family tree view', async () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Bài viết nổi bật')).toBeInTheDocument());
    const cta = screen.getByRole('link', { name: /xem gia phả/i });
    expect(cta).toHaveAttribute('href', '/gia-pha');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- LandingPage.test.tsx`
Expected: FAIL (module doesn't exist)

- [ ] **Step 3: Implement the component**

First open the full mockup file `mockup-3-split-hub.html` (session path noted in the design spec) to confirm the exact section order and copy text one more time, then create `src/pages/LandingPage.tsx` translating its structure to Tailwind + React Router `Link`:

```tsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { listArticleCategories, listArticles, listEvents } from '../services/api';
import type { ArticleCategory, Article, EventItem } from '../types/giapha';

export function LandingPage() {
  const [categories, setCategories] = useState<ArticleCategory[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listArticleCategories(), listArticles(), listEvents()]).then(([cats, arts, evs]) => {
      setCategories(cats);
      setArticles(arts);
      setEvents(evs);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="min-h-screen bg-[#f5efdf]" />;
  }

  const [featured, ...rest] = articles;

  return (
    <div className="min-h-screen bg-[#f5efdf] text-[#2e281f]">
      <header className="flex items-center justify-between px-8 py-6 border-b border-[#e2d8bd]">
        <h1 className="text-xl font-serif font-semibold text-[#4a2c24]">Gia Phả Dòng Họ</h1>
        <Link to="/gia-pha" className="rounded-full bg-[#8e342b] px-5 py-2 text-sm font-medium text-white hover:bg-[#7a2c24]">
          Xem gia phả
        </Link>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-8 py-10 md:grid-cols-[240px_1fr_260px]">
        <aside className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[#756c5e]">Chuyên mục</h2>
          <ul className="space-y-1">
            {categories.map((cat) => (
              <li key={cat.id} className="flex items-center justify-between text-sm text-[#4a2c24]">
                <span>{cat.name}</span>
                <span className="text-[#756c5e]">{cat.articleCount ?? 0}</span>
              </li>
            ))}
          </ul>
        </aside>

        <section className="space-y-8">
          {featured && (
            <article className="rounded-lg border border-[#e2d8bd] bg-[#fbf7ec] p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#c18b2c]">Bài viết nổi bật</p>
              <h2 className="mt-2 text-2xl font-serif font-semibold text-[#4a2c24]">{featured.title}</h2>
              <p className="mt-2 text-sm text-[#756c5e]">{featured.summary}</p>
            </article>
          )}

          <ul className="space-y-4">
            {rest.map((article) => (
              <li key={article.id} className="border-b border-[#e2d8bd] pb-4">
                <h3 className="text-lg font-serif font-semibold text-[#4a2c24]">{article.title}</h3>
                <p className="mt-1 text-sm text-[#756c5e]">{article.summary}</p>
              </li>
            ))}
          </ul>
        </section>

        <aside className="space-y-3 rounded-lg border border-[#e2d8bd] bg-[#fbf7ec] p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[#68735b]">Sự kiện sắp tới</h2>
          <ul className="space-y-2">
            {events.map((event) => (
              <li key={event.id} className="text-sm">
                <p className="font-medium text-[#4a2c24]">{event.title}</p>
                <p className="text-xs text-[#756c5e]">{event.dateText}</p>
              </li>
            ))}
          </ul>
        </aside>
      </main>

      <section className="border-t border-[#e2d8bd] bg-[#fbf7ec] px-8 py-12 text-center">
        <h2 className="text-2xl font-serif font-semibold text-[#4a2c24]">Khám phá cây gia phả đầy đủ</h2>
        <Link to="/gia-pha" className="mt-4 inline-block rounded-full bg-[#8e342b] px-6 py-3 text-sm font-medium text-white hover:bg-[#7a2c24]">
          Xem gia phả
        </Link>
      </section>

      <footer className="px-8 py-6 text-center text-xs text-[#756c5e]">
        © {new Date().getFullYear()} Gia Phả Dòng Họ
      </footer>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- LandingPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/LandingPage.tsx src/pages/LandingPage.test.tsx
git commit -m "feat(frontend): add LandingPage with split-hub layout"
```

---

## Task 11: Routing changes

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Update routes**

Open `src/App.tsx` in full. It currently routes `/*` to `AppRoot` and has separate routes for `/privacy` and `/control-panel`. Change the root route so `/` renders the new `LandingPage`, and `/gia-pha/*` renders the existing `AppRoot` (preserving all of `AppRoot`'s internal routing, which depends on relative paths — mount it under a `/gia-pha/*` parent route using the same nested-route pattern already used for `AppRoot`, just with the new path prefix). Add the import:

```typescript
import { LandingPage } from './pages/LandingPage';
```

Change the route definitions so that where `<Route path="/*" element={<AppRoot />} />` (or equivalent) currently exists, it becomes:

```tsx
<Route path="/" element={<LandingPage />} />
<Route path="/gia-pha/*" element={<AppRoot />} />
```

keeping `/privacy` and `/control-panel` routes unchanged. Verify `AppRoot`'s internal `<Routes>` use relative paths (no leading `/`) so the `/gia-pha` prefix works transparently; if `AppRoot` uses absolute paths internally, adjust those to relative paths so nesting works.

- [ ] **Step 2: Verify manually**

Run: `npm run build`
Expected: no TypeScript errors

Run: `npm run test`
Expected: all frontend tests still pass

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat(frontend): route / to LandingPage and /gia-pha to the tree app"
```

---

## Task 12: Navbar "Trang chủ" link

**Files:**
- Modify: `src/components/Navbar.tsx`

- [ ] **Step 1: Add the link**

Open `src/components/Navbar.tsx`, find the hamburger dropdown block (`menuOpen && (...)`) that currently renders a "Quản lý" link to `/control-panel`. Add a new unconditional link (not gated behind a `user` truthy check) above or below it:

```tsx
<Link to="/" className="block px-4 py-2 text-sm hover:bg-gray-100">
  Trang chủ
</Link>
```

Match the exact existing className/structure used by the neighboring "Quản lý" link instead of inventing new styling.

- [ ] **Step 2: Verify manually**

Run: `npm run test -- Navbar`
Expected: existing Navbar tests (if any) still pass; if no test file exists for Navbar, just run `npm run build` to confirm no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/Navbar.tsx
git commit -m "feat(frontend): add Trang chủ link to navbar"
```

---

## Task 13: Full verification pass

- [ ] **Step 1: Run the full worker test suite**

Run: `cd worker && npm run test:worker`
Expected: all tests pass

- [ ] **Step 2: Run the full frontend test suite**

Run: `npm run test`
Expected: all tests pass

- [ ] **Step 3: Run the frontend build**

Run: `npm run build`
Expected: build succeeds with no TypeScript errors

- [ ] **Step 4: Manual smoke test (if a local dev environment is available)**

Start the worker (`cd worker && npm run dev`) and frontend (`npm run dev`) locally, then in a browser:
- Visit `/` → confirm the landing page renders categories, a featured article, and events (seed some via Control Panel first if empty).
- Click "Xem gia phả" → confirm it navigates to `/gia-pha` and the existing tree view renders correctly.
- Log in as admin/editor, go to Control Panel → "Bài viết" tab → create, edit, delete an article and a category; confirm deleting a category with articles is blocked with an error message.
- Go to "Sự kiện" tab → create, edit, delete an event.

- [ ] **Step 5: Final commit (if any smoke-test fixes were needed)**

```bash
git add -A
git commit -m "fix: address issues found during landing page CMS smoke testing"
```

---

## Self-Review Notes

- **Spec coverage:** Routing (Task 11), permissions/no-approval-queue (Tasks 2-4 use `requireRole('admin', 'editor')` directly, no `editor_requests`), admin-managed categories (Task 2 + inline UI in Task 7), category assignment on articles (Task 3's `categoryId` field, confirmed required), minimal events UI (Task 8), plain-text body (Task 3, `body: text` no markdown parsing), R2 cover images (Task 3's `/articles/:id/cover`), Mockup 3 layout (Task 10) — all covered.
- **Placeholder scan:** No TBD/TODO markers; all code blocks are complete. A few steps explicitly instruct the implementer to open a reference file first and adjust names/imports to match reality (unavoidable since exact helper names in `test-helpers.ts`/`request()` signature were not directly re-confirmed line-by-line in this plan) — these are verification instructions, not placeholders, and each gives a concrete fallback expectation.
- **Type consistency:** `ArticleCategory`, `Article`, `EventItem` names and fields are consistent across Tasks 1, 3, 6, 7, 8, 10. Function names (`listArticles` vs `listAllArticles`, `createArticleCategory`, `updateArticleCategory`, `deleteArticleCategory`, `createEvent`, `updateEvent`, `deleteEvent`) are used identically in Task 6 (definitions) and Tasks 7/8/10 (usage).
