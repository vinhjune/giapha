-- Migration 0002: enforce email uniqueness at the DB layer (backstop for the
-- application-level uniqueness check in worker/src/routes/users.ts).
-- Apply with: wrangler d1 execute giapha-db --local --file=worker/migrations/0002_unique_email.sql
--             wrangler d1 execute giapha-db --remote --file=worker/migrations/0002_unique_email.sql

CREATE UNIQUE INDEX users_email_unique_idx ON users(email);
