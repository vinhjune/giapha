-- Migration 0004: add password_reset_requested_at for forgot-password rate limiting.
-- Apply with: wrangler d1 execute giapha-db --local --file=worker/migrations/0004_add_password_reset_rate_limit.sql
--             wrangler d1 execute giapha-db --remote --file=worker/migrations/0004_add_password_reset_rate_limit.sql

ALTER TABLE users ADD COLUMN password_reset_requested_at TEXT;
