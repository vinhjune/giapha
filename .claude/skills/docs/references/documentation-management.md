# Documentation Management Routing

Use this file when another skill needs to decide whether docs should be created
or updated. For full doc operations, use `/ck:docs init`, `/ck:docs update`, or
`/ck:docs summarize`.

## When To Update Docs

Update docs only when the change affects:

- user-visible behavior
- setup, install, or CLI commands
- architecture, data flow, or public contracts
- security posture or operational procedures
- future maintainer decisions that should not be rediscovered

Do not add documentation noise for purely internal edits unless the repo already
requires it.

## Common Docs

- `docs/project-overview-pdr.md`
- `docs/codebase-summary.md`
- `docs/code-standards.md`
- `docs/system-architecture.md`
- `docs/project-roadmap.md` or `docs/development-roadmap.md`
- `docs/project-changelog.md` when present

## Plan and Report Locations

Save plans under `plans/<timestamp>-<descriptive-slug>/`.

```text
plans/<slug>/
  plan.md
  phase-01-<name>.md
  reports/
  visuals/
```

Keep `plan.md` short: status, phases, dependencies, acceptance criteria, and
links to phase files. Put execution detail in phase files.

## Cross-Skill Handoffs

- `/ck:cook` and `/ck:fix`: invoke docs update during finalize only when docs
  are warranted by the criteria above.
- `/ck:plan`: read existing docs before creating architecture or phase plans.
- `/ck:preview`: save generated visuals under the active plan's `visuals/`
  folder when possible, then link them from docs only if they remain useful.
- `/ck:tech-graph`: use for publish-grade architecture diagrams before adding
  diagrams to docs.

Before updating a doc, read it first. After updating, verify dates, links, and
claims match the actual change.

