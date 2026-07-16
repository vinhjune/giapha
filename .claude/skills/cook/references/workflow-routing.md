# Workflow Routing

Use this file when choosing the sequence for multi-step work. It is a routing
map only; load the owning `SKILL.md` before executing details.

## Core Sequences

| User intent | Sequence |
|---|---|
| Implement a feature | `/ck:plan` -> `/ck:cook` -> `/ck:test` -> `/ck:code-review` |
| Execute an existing plan | `/ck:cook <plan-path>` |
| Quick implementation | `/ck:cook --fast` |
| Bug, error, failed test, or CI failure | `/ck:fix` |
| Investigate before deciding | `/ck:scout` -> `/ck:debug` -> `/ck:brainstorm` -> `/ck:plan` |
| Review a PR | `/ck:review-pr <PR>` |
| Fix review feedback | `/ck:review-pr <PR> --fix` or `/ck:fix --parallel` |
| Ship a completed branch | `/ck:ship` |
| Explain work visually | `/ck:preview --explain` or `/ck:preview --html --diff` |
| Update project docs | `/ck:docs update` |

## Implementation Owner

- Use `/ck:cook` for known feature scope after requirements are clear.
- Use `/ck:fix` for concrete bugs, errors, test failures, and CI failures.
- Use `/ck:plan` when work needs architecture, phases, file ownership, or TDD
  structure.
- Use `/ck:test` for verification-only work.
- Use `/ck:ship` only after implementation, tests, and review are done.

## Handoff Rules

- Domain skill first, workflow skill second. Example: for a React feature,
  route to `/ck:frontend-development`, then execute through `/ck:plan` and
  `/ck:cook` if implementation is needed.
- For visual explanations, load
  `../../preview/references/visual-explanation-routing.md`.
- For documentation changes, load
  `../../docs/references/documentation-management.md` or invoke
  `/ck:docs update`.
- For ambiguous skill choice, load
  `../../find-skills/references/domain-routing.md`.

## Post-Implementation

- Review high-risk, cross-module, or public-contract changes before shipping.
- Update docs only when behavior, setup, commands, architecture, security
  posture, public contracts, or future maintainer decisions changed.
- Journal when a workflow creates durable decisions or debugging lessons.
