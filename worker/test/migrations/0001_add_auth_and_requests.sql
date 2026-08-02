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
