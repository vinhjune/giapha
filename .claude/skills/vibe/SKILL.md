---
name: ck:vibe
description: "Run the full vibe pipeline. Use for GitHub issues, feature requests, bug fixes, or autonomous ship runs. Supports worktree, reusable/TDD plan gates, cook or fix routing, ship PR, review-pr, merge/CI watch."
user-invocable: true
when_to_use: "Invoke when a user wants one command to take a GitHub issue or feature request from planning through implementation, PR review, shipping, and optional merge."
category: dev-tools
keywords: [vibe, pipeline, worktree, planning, tdd, cook, fix, ship, pr, ci, github]
argument-hint: "[--ship] [--beta] <github-issue-url | feature request>"
metadata:
  author: claudekit
  version: "1.0.0"
---

# Vibe Pipeline

Run a full autonomous product-development pipeline from request intake to PR readiness, with optional merge and post-merge CI convergence.

This skill handles orchestration across `/ck:worktree`, `/ck:plan`, `/ck:cook`, `/ck:fix`, `/ck:code-review`, `/ck:ship`, and `/ck:review-pr`.
Does NOT bypass those skills' approval gates, tests, code-review blockers, branch protections, or security policies.

## Inputs

Accepted forms:

```bash
/ck:vibe <github-issue-url>
/ck:vibe --ship --beta <github-issue-url>
/ck:vibe --ship <feature request>
```

Flags:

| Flag | Effect |
| --- | --- |
| `--beta` | Ship to beta/dev target via `/ck:ship beta`; final ready label is `ready to ship beta`. |
| `--ship` | After review/fix/reply, merge the PR and watch/fix CI until success or true external blocker. |
| no `--beta` | Ship stable via `/ck:ship official`; final ready label is `ready to ship stable`. |
| no `--ship` | Stop after PR is reviewed, fixed, replied, and labeled ready. |

## Pipeline

1. **Parse and analyze request**
   - Strip `--ship` and `--beta` from arguments.
   - If remaining input is a GitHub issue URL/number, treat that issue as the source of truth. Do not create a duplicate.
   - If remaining input is natural language, treat it as the feature request and create the GitHub issue after plan validation/red-team.
   - Resolve repo with `gh repo view --json nameWithOwner,defaultBranchRef`.
   - For GitHub issue URLs, parse `OWNER/REPO` from the URL and compare it with the current repo. If it differs, stop and ask the user to switch to the matching repo/worktree or provide an issue from the current repo.
   - For issue inputs, read the title, body, and comments with `gh issue view`. For natural-language inputs, use the text directly.
   - Extract concrete outcome, acceptance criteria, scope boundary, non-negotiable constraints, blockers, and likely touched surfaces.
   - Classify implementation route:
     - **Bugfix route** when the issue/request is a bug, regression, broken behavior, failing test/CI, production/staging incident, error log, or explicitly says fix/debug/repair.
     - **Feature route** for net-new capability, enhancement, refactor, or ambiguous product work.
   - Detect an existing plan if the user provides a plan path, the issue body/comments link a `plans/.../plan.md`, or a current worktree already contains a matching plan. Verify the file exists before treating it as reusable.
   - If any of those are ambiguous enough to change implementation, ask before worktree creation. Otherwise proceed and carry the extracted requirements into planning and issue updates.

2. **Create isolated worktree and branch**
   - Activate `/ck:worktree` to create an isolated worktree and branch.
   - Use a descriptive branch name derived from the issue/request.
   - If an existing clean feature worktree/branch already matches the request, reuse it and record why.
   - Never work directly on `main`, `master`, `dev`, `beta`, or `develop`.

3. **Plan intake and gates**
   - If a valid existing `plan.md` was detected, set `plan.md` to its absolute path, reuse it, and skip `/ck:plan --tdd`.
   - If no valid plan exists, in the new worktree activate:
     ```bash
     /ck:plan --tdd "<source issue or feature request>"
     ```
   - For newly created plans, capture the absolute `plan.md` path from `/ck:plan --tdd`.
   - Always run both gates, even when the plan already existed:
     ```bash
     /ck:plan validate <plan.md>
     /ck:plan red-team <plan.md>
     ```
   - Before implementation, perform the whole-plan consistency sweep required by `/ck:plan`.
   - Do not proceed to implementation while validation failures, accepted red-team findings, or unresolved contradictions remain.

4. **Create or update GitHub issue**
   - Ensure labels exist:
     ```bash
     gh label list --json name --jq '.[].name' | grep -Fx "ready to cook" >/dev/null \
       || gh label create "ready to cook" --color "0E8A16" --description "Plan validated; ready for ck:cook or ck:fix"
     gh label list --json name --jq '.[].name' | grep -Fx "in progress" >/dev/null \
       || gh label create "in progress" --color "FBCA04" --description "Implementation is in progress"
     gh label list --json name --jq '.[].name' | grep -Fx "ready to ship stable" >/dev/null \
       || gh label create "ready to ship stable" --color "5319E7" --description "PR reviewed and ready for stable merge"
     gh label list --json name --jq '.[].name' | grep -Fx "ready to ship beta" >/dev/null \
       || gh label create "ready to ship beta" --color "1D76DB" --description "PR reviewed and ready for beta merge"
     ```
   - If label creation fails for anything other than an existing label, stop and report the exact `gh` error.
   - Compute relative plan link from repo root.
   - If source issue exists, update/comment on it. If input was natural language, create a new issue.
   - Issue update must include:
     - branch name
     - implementation route (`feature` via `/ck:cook` or `bugfix` via `/ck:fix`)
     - implementation summary
     - relative plan link
     - ship mode (`official` or `beta`)
     - acceptance criteria from the plan
   - Add `ready to cook`; remove stale `ready to ship stable` and `ready to ship beta`.

5. **Implement or fix**
   - Before activating `/ck:cook` or `/ck:fix`, update the pipeline GitHub issue:
     ```bash
     gh issue edit <issue-number-or-url> --add-label "in progress" --remove-label "ready to cook"
     ```
   - If `ready to cook` is not currently on the issue, use `--add-label "in progress"` without `--remove-label`.
   - If the label update fails for any other reason, stop and report the exact `gh` error. Do not start implementation while the issue state still says `ready to cook`.
   - If the request is on the bugfix route, activate:
     ```bash
     /ck:fix --auto <plan.md>
     ```
   - Pass the source issue/request, failure evidence, validated plan path, scope boundary, and acceptance criteria into `/ck:fix`.
   - If the request is on the feature route, activate:
     ```bash
     /ck:cook --tdd --auto <plan.md>
     ```
   - Honor every hard gate in `/ck:cook`.
   - Honor every hard gate in `/ck:fix` on the bugfix route.
   - If implementation stops for user/business decision, update the GitHub issue with blocker details and stop.

6. **Review local implementation**
   - Activate:
     ```bash
     /ck:code-review --pending
     ```
   - Fix Critical and Important findings before shipping.
   - Re-run relevant validation after fixes.

7. **Ship PR**
   - If `--beta` is present:
     ```bash
     /ck:ship beta
     ```
   - Otherwise:
     ```bash
     /ck:ship official
     ```
   - Capture PR URL/number from `/ck:ship` output.

8. **Review/fix/reply PR**
   - Activate:
     ```bash
     /ck:review-pr <pr-url-or-number> --fix --reply
     ```
   - Do not continue until actionable findings are resolved or an external blocker is documented.
   - PR checks must be terminal and green unless the blocker is external and recorded.

9. **Apply ready label**
   - If beta mode: add `ready to ship beta`.
   - Otherwise: add `ready to ship stable`.
   - Add the label to both the source issue and PR when possible.
   - Remove `ready to cook` and `in progress` after PR review/fix succeeds.

10. **Optional merge and CI convergence**
    - Only run this step when `--ship` is present.
    - Merge via GitHub using repository convention and branch protection. Prefer `gh pr merge --auto` when required checks are still pending; otherwise use the repo's allowed merge method.
    - Never force push. Never direct-push to protected target branches.
    - After merge, watch target-branch CI/deploy workflows for the merge commit.
    - If CI fails with a deterministic repo-fixable error:
      1. Inspect the failed run/job logs with `gh run view`.
      2. Create a follow-up fix branch/worktree from the target branch.
      3. Activate `/ck:fix --auto` with exact failing command/error evidence.
      4. Ship the follow-up in the same mode, run `/ck:review-pr --fix --reply`, merge, and watch again.
    - Stop only when target-branch CI succeeds, an external blocker remains, or the same blocker survives 3 fix attempts.

## GitHub Issue Body

Use this body when creating a new issue or updating an execution section:

```markdown
## Outcome
<user-visible outcome>

## Implementation
- Branch: `<branch-name>`
- Plan: `<relative/path/to/plan.md>`
- Mode: `<official|beta>`
- Route: `<feature|bugfix>`
- PR: `<url once created>`

## Acceptance Criteria
- [ ] <criterion from plan>

## Pipeline State
- [x] Worktree and branch created
- [x] TDD plan created or existing plan reused
- [x] Plan validated
- [x] Plan red-teamed
- [x] Issue labeled `in progress` before implementation
- [ ] Implementation complete
- [ ] PR reviewed and fixed
- [ ] Merged and CI green (only when --ship)
```

## Security

- Never write secrets, tokens, customer data, or private env values into issues, PRs, comments, plans, or logs.
- Redact sensitive command output before posting to GitHub.
- If `gh` auth lacks permission to create labels, issues, PRs, reviews, or merges, stop and report the exact missing capability.
- If CI fails because of missing secrets, unavailable services, or required human approval, record it as an external blocker. Do not weaken tests or hide failures.

## Completion Report

End with:

```markdown
**Vibe Result**
- Source: <issue/request>
- Branch/worktree: <branch> | <path>
- Plan: <relative path>
- Issue: <url>
- PR: <url>
- Mode: official|beta
- Route: feature|bugfix
- Review: <approve/request-changes/comment + fix iterations>
- Merge: skipped|merged|blocked
- CI: green|failed|blocked

Unresolved questions:
- None
```
