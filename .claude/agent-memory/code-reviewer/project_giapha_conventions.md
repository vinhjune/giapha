---
name: project-giapha-conventions
description: giapha repo structure, trust model, and recurring validation gaps in editor routes/MemberManagementView
metadata:
  type: project
---

giapha is a React 19 + TS + Vite frontend, Hono + Cloudflare Workers + D1/Drizzle backend genealogy app. Auth was removed repo-wide (commit 2c2463d, "Migrate to Cloudflare Worker + shared D1 database, remove auth") — `worker/src/routes/editor.ts` has no identity/permission checks on any mutating route. This is intentional per project history, not a gap to re-flag per-review.

`worker/src/routes/editor.ts` `PersonPayload` is a bare TypeScript interface with **no runtime validation** (no zod/similar) — `c.req.json<PersonPayload>()` trusts the client completely for shape and type. This is a pre-existing, repo-wide pattern for this route, not specific to any one field. When reviewing new fields added to this payload, check whether the *client-side* form (`MemberManagementView.tsx`, `PersonForm.tsx`) is the only validation layer, and flag genuinely new gaps (e.g. accepting `Infinity`/decimals into an `integer()` D1 column) rather than the general lack of server validation, since that's already an accepted baseline.

`thuTuDoi` (generation number) column: DB schema `worker/src/db/schema.ts` — nullable `integer('thu_tu_doi')`. This column is documented in `src/types/giapha.ts` as "computed and owned by the shared database" — the same D1 database is shared with a sibling Cloudflare Worker app "giaphadongho" outside this repo. User has explicitly accepted the risk that manual edits to `thuTuDoi` via this app's UI may later be overwritten by the sibling app. Do not re-litigate that decision in future reviews; only flag genuinely new issues (crash, data corruption into that shared column, or an unrelated invariant broken).

Recurring gap pattern to watch for in `MemberManagementView.tsx`: numeric text-input cells validate with `Number.isNaN(Number(value))` only, which accepts decimals, `Infinity`/`-Infinity`, hex strings (`0x10`), and leading-`+` forms as "valid". None of the numeric fields in this file (`thuTuDoi`, `thuTuAnhChi`) use `Number.isInteger`/`Number.isFinite` guards. `thuTuAnhChi` has zero validation at all (pre-existing baseline); `thuTuDoi` added a `Number.isNaN`-only check as of 2026-07-16 — better than the baseline but still lets `1.5`/`Infinity` through into an integer DB column. Worth flagging as Medium (not Critical) if untouched by a future diff, since it doesn't regress anything but is an incomplete fix relative to its own stated acceptance criteria.

Test pattern to check for in this file: `handleApplyChanges` in `MemberManagementView.tsx` iterates all rows and `continue`s past per-row validation failures (partial-batch-save semantics: invalid rows are skipped, others still save). Existing tests as of 2026-07-16 only assert the invalid row was *not* saved — no test exercises a mixed batch (one invalid + one valid row) to confirm the valid row *was* still saved. A regression that `return`s early on first error instead of `continue`-ing would pass all current tests undetected.
