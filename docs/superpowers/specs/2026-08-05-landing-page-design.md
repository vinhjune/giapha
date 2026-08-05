# Landing Page & Article Management — Design

**Status:** Approved — owner picked **Mockup 3 (split-layout hub)** as the
landing page direction. Remaining open questions were resolved autonomously
with reasonable defaults (owner unavailable for live review); see
**Decisions** below and correct any before/after implementation as needed.

## Problem

Today `/` immediately loads gia phả data and renders the interactive family
tree (`HomePage`). There is no introduction to the family, its conventions, its
tradition of valuing education, or its events — a first-time visitor lands
straight in tree/list UI with no context. The owner wants a landing page with
a handful of editorial articles (family intro, quy ước, truyền thống hiếu học,
sự kiện, …) and a clear path from there into the existing tree view. The
number and content of articles will change over time, so this needs a real
content-management flow in the Control Panel, not hardcoded copy.

## Goals

- New landing page at `/` introducing the dòng họ through a small number of
  editorial "articles" plus an events section.
- One clear, prominent CTA ("Xem gia phả") that takes the visitor to the
  existing tree/list experience.
- Articles are dynamic: admins/editors can create, edit, publish/unpublish,
  reorder, and delete them from the Control Panel — no code deploy needed to
  add a new article.
- Reuse the existing (currently unused) `events` table for the "Các sự kiện"
  section instead of modeling events as articles.
- Keep the current tree/list feature fully intact — it just moves to its own
  route instead of living at `/`.

## Non-goals

- Rich WYSIWYG editing (a plain textarea with Markdown-like line breaks is
  enough for v1; a full rich-text editor can be a later iteration).
- Comments, likes, tags/search, or per-article view analytics.
- Multi-language content.

## Decisions

1. **Routing:** the interactive tree view moves from `/` to `/gia-pha`. `/`
   becomes the new landing page. Existing deep links to `/` will now show the
   landing page instead of the tree — acceptable, since "Xem gia phả" is one
   click away.
2. **Permissions:** unlike `persons` (where `editor` writes go through an
   `editor_requests` approval queue that `admin` must approve/reject — see
   `worker/src/routes/editor.ts`), articles/categories skip that queue:
   `admin` and `editor` both write directly. This is a deliberate
   simplification, not an oversight — the `status: draft/published` field
   already acts as a lightweight publish gate (a draft is invisible to the
   public regardless of who wrote it), and content articles carry much less
   risk than mutating genealogical records, so the heavier
   propose-then-approve workflow isn't justified here.
   `viewer`/anonymous visitors only ever see published articles.
3. **Events management UI:** since `events` has no UI yet, this project also
   adds a minimal "Sự kiện" management panel (reusing the existing table) so
   the landing page's events section isn't empty. Full event-editing UX
   parity with member management is out of scope — a simple list + form is
   enough.
4. **Content format:** article body is stored as plain text with line breaks
   preserved (`white-space: pre-wrap`), not Markdown/HTML rendering, to avoid
   introducing a sanitization/XSS surface for v1.
5. **Images:** article cover images are optional and, if present, reuse the
   existing R2 avatar-upload pattern (`avatarKey`-style: store an R2 object
   key rather than a raw URL).
6. **Landing page design direction:** owner reviewed three sub-agent-built
   mockups (one-page scroll, editorial bento-grid, split-layout hub) and
   **picked Mockup 3 (split-layout hub)**.
7. **Categories are admin-managed, not a fixed enum** (owner's explicit
   request): admins/editors can create, rename, reorder, and delete article
   categories from the Control Panel — matching the mockup's sidebar, which
   already showed categories beyond the original 3 examples (Ký ức & hình
   ảnh, Chuyên mục khác). See data model below. "Sự kiện" stays a distinct,
   non-deletable landing-page section backed by the `events` table, not an
   article category, so date/recurrence logic isn't duplicated.

## Approaches considered (landing page layout)

| # | Approach | Pros | Cons |
|---|---|---|---|
| 1 | **One-page scroll** — hero + anchor-nav'd sections (Giới thiệu, Quy ước, Truyền thống, Sự kiện) in a single narrative page | Feels cohesive/story-like, great for a small, fairly static set of articles, simple to build, good on mobile | Doesn't scale gracefully if the article count grows a lot; long page to maintain |
| 2 | **Editorial / bento-grid hub** — hero + featured article + asymmetric grid of previews, horizontal event strip | Modern, scales well as articles grow, avoids the "generic card grid" look via varied tile sizes | More complex CSS/layout logic; slightly more design upkeep |
| 3 | ✅ **Split layout hub** — sticky category sidebar (or mobile chip row) + scrolling feed per category | Wiki/journal feel, scales best for many articles/categories, clear IA | Least "landing page"-like, more like a mini-CMS/blog; weaker single strong first impression |

**Decision: Approach 3 (split-layout hub), per owner's explicit choice of
Mockup 3.** Layout: a left-hand sticky sidebar listing categories (with an
article count badge each) + a right-hand scrolling feed of article previews
for the active/all categories, collapsing to a horizontal scrollable chip row
on mobile. A small "sự kiện gần nhất" (nearest upcoming event) aside sits
near the top of the feed. Header keeps a persistent "Xem gia phả" CTA.

## Data model

New tables (new migration `0003_add_articles.sql`):

```
article_categories
  id            text PK (uuid)
  slug          text unique, not null      -- url-safe, used for anchor links
  name          text not null              -- display label, e.g. "Giới thiệu dòng họ"
  displayOrder  integer not null default 0 -- manual ordering in sidebar
  createdAt     text not null default CURRENT_TIMESTAMP
  updatedAt     text not null default CURRENT_TIMESTAMP

articles
  id            text PK (uuid)
  slug          text unique, not null      -- url-safe, used for anchors/links
  categoryId    text not null references article_categories(id) on delete restrict
  title         text not null
  summary       text                       -- short teaser for previews
  body          text not null              -- plain text, pre-wrap rendered
  coverImageKey text                       -- R2 object key, optional
  status        text enum('draft','published') not null default 'draft'
  displayOrder  integer not null default 0 -- manual ordering within category
  publishedAt   text
  authorId      text references users(id)
  createdAt     text not null default CURRENT_TIMESTAMP
  updatedAt     text not null default CURRENT_TIMESTAMP
```

`categoryId` uses `ON DELETE RESTRICT`: a category with existing articles
can't be deleted until those articles are moved or removed first (surfaced in
the UI as a validation error, not a silent cascade-delete of content).

Seed data (in the migration): pre-create the 3 categories the owner named
up front — "Giới thiệu dòng họ", "Quy ước trong họ", "Truyền thống hiếu học"
— so the landing page isn't empty on first deploy; admins can rename/add/
remove freely afterwards.

Note: "Sự kiện" is intentionally **not** an `article_categories` row — the
landing page's events section reads directly from the existing `events`
table so dates/recurrence aren't duplicated in two places, and it can't be
accidentally deleted the way a regular category can.

## API (worker)

New `worker/src/routes/articles.ts`, mounted alongside existing routes:
- `GET /api/articles` — public, published only, ordered by category +
  displayOrder, includes joined category name/slug.
- `GET /api/articles/all` — `requireRole('admin','editor')`, all statuses, for
  Control Panel list.
- `POST /api/articles`, `PUT /api/articles/:id`, `DELETE /api/articles/:id` —
  `requireRole('admin','editor')`.
- `POST /api/articles/:id/cover` — image upload, same R2 pattern as person
  avatars, `requireRole('admin','editor')`.
- `GET /api/article-categories` — public (needed to render the sidebar with
  its article counts).
- `POST /api/article-categories`, `PUT /api/article-categories/:id`,
  `DELETE /api/article-categories/:id` — `requireRole('admin','editor')`;
  delete returns `409` with a clear error if the category still has articles.

New `worker/src/routes/events.ts` (thin CRUD over the existing `events`
table, same role pattern), plus `GET /api/events` public for the landing
page's upcoming-events section.

## Frontend

- `src/pages/LandingPage.tsx` — new, renders the split-hub layout (sticky
  sidebar of categories + scrolling article feed, mobile chip row), fetches
  `/api/article-categories` + `/api/articles` + `/api/events`, "Xem gia phả"
  CTA navigates to `/gia-pha`.
- `App.tsx` routes become: `/` → `LandingPage`, `/gia-pha` → current
  `AppRoot` (tree view), `/privacy` and `/control-panel` unchanged.
- `src/components/ArticleManagementView.tsx` (includes inline category
  create/rename/reorder/delete, since categories are simple enough not to
  need their own tab) + `EventManagementView.tsx` — new Control Panel tabs
  ("Bài viết", "Sự kiện"), list + create/edit form, following
  `MemberManagementView`'s existing patterns (list on the left/top, form
  panel for the selected item).
- `ControlPanelPage.tsx` gains two tabs, visible to `admin`+`editor`.

## Testing

- Worker: route tests for `articles.ts`/`article-categories`/`events.ts`
  mirroring `routes-persons.test.ts` (auth-gating, CRUD, status filtering for
  public vs. authenticated fetch, category-delete-with-articles conflict).
- Frontend: component tests for `LandingPage`, `ArticleManagementView`,
  `EventManagementView` mirroring existing `*.test.tsx` conventions.
- Migration test: extend `worker/test/apply-migrations.ts` coverage to
  include `0003_add_articles.sql`.

## Open items for owner review

All previously open items are now resolved (see Decisions above). Any
further changes can be raised during plan/implementation review.
