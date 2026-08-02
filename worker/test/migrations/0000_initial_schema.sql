-- Test-only baseline schema (0000). Mirrors the production D1 schema as it
-- existed before migration 0001, so that migration 0001's ALTER/CREATE
-- statements apply cleanly against a fresh Miniflare D1 instance in tests.
-- Production already has these tables from earlier (untracked) setup — this
-- file exists only so `npm run test:worker` can build the schema from
-- scratch. Never applied against the real D1 database.

CREATE TABLE persons (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  gender TEXT,
  nickname TEXT,
  bio TEXT,
  address TEXT,
  email TEXT,
  phone TEXT,
  avatar_key TEXT,
  birth_year INTEGER,
  birth_month INTEGER,
  birth_day INTEGER,
  birth_is_lunar INTEGER DEFAULT 0,
  death_year INTEGER,
  death_month INTEGER,
  death_day INTEGER,
  death_is_lunar INTEGER DEFAULT 0,
  is_alive INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  ngoai_toc INTEGER NOT NULL DEFAULT 0,
  thu_tu_doi INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX persons_name_idx ON persons(name);

CREATE TABLE families (
  id TEXT PRIMARY KEY,
  parent1_id TEXT REFERENCES persons(id) ON DELETE SET NULL,
  parent2_id TEXT REFERENCES persons(id) ON DELETE SET NULL,
  order_p1 INTEGER NOT NULL DEFAULT 1,
  order_p2 INTEGER NOT NULL DEFAULT 1,
  status TEXT DEFAULT 'active',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE family_members (
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL UNIQUE REFERENCES persons(id) ON DELETE CASCADE,
  child_order INTEGER,
  PRIMARY KEY (family_id, person_id)
);

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  date_text TEXT,
  year INTEGER,
  month INTEGER,
  day INTEGER,
  is_lunar INTEGER DEFAULT 0,
  is_recurring INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  is_active INTEGER NOT NULL DEFAULT 1,
  person_id TEXT UNIQUE REFERENCES persons(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
