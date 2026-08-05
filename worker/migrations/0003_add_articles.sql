-- Migration 0003: add article_categories + articles for the landing page CMS.
-- Apply with: wrangler d1 execute giapha-db --local --file=worker/migrations/0003_add_articles.sql
--             wrangler d1 execute giapha-db --remote --file=worker/migrations/0003_add_articles.sql

CREATE TABLE article_categories (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_articles_category_id ON articles(category_id);
CREATE INDEX idx_articles_status ON articles(status);

INSERT INTO article_categories (id, slug, name, display_order) VALUES
  ('cat-gioi-thieu', 'gioi-thieu-dong-ho', 'Giới thiệu dòng họ', 1),
  ('cat-quy-uoc', 'quy-uoc-trong-ho', 'Quy ước trong họ', 2),
  ('cat-hieu-hoc', 'truyen-thong-hieu-hoc', 'Truyền thống hiếu học', 3);
