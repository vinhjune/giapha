---
name: ck:review-pr
description: "Review GitHub PRs for duplicate prior work, project standards, strategic necessity, correctness, security, breaking changes, code quality, and AI-slop patterns. Supports --fix and --reply."
user-invocable: true
when_to_use: "Invoke to review a GitHub PR by number/URL, optionally fix findings, conflicts, and CI blockers, optionally post the review back to GitHub."
category: utilities
keywords: [pr, pull request, review, github, gh, fix, reply, ci, conflicts, standards, duplicate, roadmap, value, anti-slop, ai-slop]
argument-hint: "<PR number or URL> [--fix] [--reply]"
allowed-tools:
  - Bash(gh pr view *)
  - Bash(gh pr list *)
  - Bash(gh pr diff *)
  - Bash(gh pr checks *)
  - Bash(gh pr checkout *)
  - Bash(gh pr review *)
  - Bash(gh pr comment *)
  - Bash(gh issue list *)
  - Bash(gh api *)
  - Bash(gh run view *)
  - Bash(gh run watch *)
  - Bash(gh run rerun *)
  - Bash(gh auth status *)
  - Bash(command *)
  - Bash(git fetch *)
  - Bash(git log *)
  - Bash(git diff *)
  - Bash(git status *)
  - Bash(git branch *)
  - Bash(git rev-parse *)
  - Bash(git checkout *)
  - Bash(git merge *)
  - Bash(git rebase *)
  - Bash(git add *)
  - Bash(git commit *)
  - Bash(git push *)
  - Bash(date *)
  - Bash(mkdir *)
  - Read
  - Edit
  - MultiEdit
  - Write
  - Glob
  - Grep
  - Task
metadata:
  author: claudekit
  version: "2.0.0"
---

# Review Pull Request

Review PR `$ARGUMENTS` in this repository.

## Modes

- **Review-only** (default): review the PR and print findings to chat. Do not edit, commit, or push the PR branch. Exception: if no project standards doc exists, create a local `docs/code-standards.md` from codebase scan, report that local doc change, and do not push it.
- **Fix loop** (`--fix`): review, fix actionable findings, resolve conflicts, commit+push, watch PR checks to terminal state, then re-review. Repeat until no actionable findings remain and required CI is green, or a true external blocker remains.
- **Reply** (`--reply`): after the review (or after the fix loop converges), post the final review back to the PR via `gh pr review`.

Flags compose: `review-pr 123 --fix --reply` runs the fix loop and posts the final re-review at the end. Flag order does not matter.

## Argument parsing

Derive `PR_REF` from `$ARGUMENTS` by stripping `--fix` and `--reply` flags:

```
!`PR_REF="$(printf '%s\n' "$ARGUMENTS" | awk '{ for (i = 1; i <= NF; i++) if ($i != "--fix" && $i != "--reply") out = (out ? out OFS : "") $i } END { print out }')" && printf 'PR_REF=%s\n' "$PR_REF"`
```

Detect flags (the substring match below is intentional — flags may appear in any order):

- `--fix` present → fix-loop mode active
- `--reply` present → reply mode active

## Context

PR metadata:
```
!`PR_REF="$(printf '%s\n' "$ARGUMENTS" | awk '{ for (i = 1; i <= NF; i++) if ($i != "--fix" && $i != "--reply") out = (out ? out OFS : "") $i } END { print out }')" && gh pr view "$PR_REF" --json title,body,author,baseRefName,headRefName,headRefOid,mergeStateStatus,files,additions,deletions,changedFiles,statusCheckRollup`
```

PR diff:
```
!`PR_REF="$(printf '%s\n' "$ARGUMENTS" | awk '{ for (i = 1; i <= NF; i++) if ($i != "--fix" && $i != "--reply") out = (out ? out OFS : "") $i } END { print out }')" && gh pr diff "$PR_REF"`
```

CI check status:
```
!`PR_REF="$(printf '%s\n' "$ARGUMENTS" | awk '{ for (i = 1; i <= NF; i++) if ($i != "--fix" && $i != "--reply") out = (out ? out OFS : "") $i } END { print out }')" && gh pr checks "$PR_REF" 2>/dev/null || echo "No checks found"`
```

Diff stat (use to gauge scope vs description claims):
```
!`PR_REF="$(printf '%s\n' "$ARGUMENTS" | awk '{ for (i = 1; i <= NF; i++) if ($i != "--fix" && $i != "--reply") out = (out ? out OFS : "") $i } END { print out }')" && gh pr diff "$PR_REF" --name-only 2>/dev/null | head -50`
```

## Instructions

Perform a thorough code review of this PR. Follow these steps:

### 1. Understand the PR
- Read the PR title, description, and linked issues
- Understand the intent and scope of the changes
- Compare stated scope vs `additions`/`deletions`/`changedFiles` — a wide gap is itself a signal (see anti-slop reference)
- Extract 3-7 concrete search terms from title/body/changed API names/routes/files. Use them for duplicate and prior-work checks.

### 2. Run mandatory gates

Run these gates before final verdict. They can produce findings even when the code itself is correct.

**Duplicate / prior implementation gate**
- Check whether the same outcome was already implemented, merged, opened, or rejected by someone else.
- Search GitHub PRs/issues and git history with the extracted terms:
  - `gh pr list --state all --search "<terms>" --json number,title,state,mergedAt,author,headRefName,url`
  - `gh issue list --state all --search "<terms>" --json number,title,state,closedAt,url`
  - `git log --all --grep="<terms>" --oneline --decorate -20`
- Exclude the current PR from duplicate results before judging overlap.
- Grep the codebase for touched symbols, routes, command names, config keys, or UI labels that may indicate existing implementation.
- If a merged PR already satisfies the outcome, mark an **Important** duplicate finding and request closing or retargeting the PR.
- If an open PR overlaps materially, mark **Important** unless this PR is clearly the chosen successor and explains why.
- If there is partial prior art, review whether the PR extends it instead of creating a parallel implementation.

**Project standards gate**
- Prefer existing project docs in this order: `CLAUDE.md`, `AGENTS.md`, `docs/code-standards.md`, `docs/system-architecture.md`, `docs/project-overview-pdr.md`, `docs/project-roadmap.md`, then nearby package/module docs.
- If no standards doc exists, scan the codebase for naming, structure, package manager, test commands, error handling, file-size limits, i18n, security, and architecture patterns. Create `docs/code-standards.md` with a concise baseline before continuing. In review-only mode, leave it local and report it; in `--fix`, commit it only if it is in scope or required to unblock the review.
- Check the PR against the discovered or generated standards. Do not rely on generic best practices when project standards are available.
- If standards conflict or are stale, cite the conflict and use current code plus repo docs as evidence.

**Strategic necessity gate**
- Review as the project owner/creator/senior maintainer, not only as a code reviewer.
- Ask whether the PR creates clear value: user outcome, roadmap alignment, revenue/profit potential, security improvement, price-positioning leverage, maintainer toil reduction, reliability, or compliance.
- Do not require every PR to make money; bug fixes, security fixes, support-cost reductions, and cleanup with measurable maintenance value count.
- If the PR is correct but unnecessary, duplicates roadmap work, expands scope away from the product direction, or adds maintenance burden without clear value, mark an **Important** product-risk finding.
- If value depends on a business call the code cannot answer, list it as an unresolved question at the end.

### 3. Analyze the diff
- Read every changed file carefully
- For modified files, read the full file (not just the diff) to understand surrounding context
- Check if the changes align with the stated PR purpose

### 4. Check for issues

**Correctness**
- Logic errors, off-by-one, nil/null dereference
- Missing error handling or swallowed errors
- Race conditions in concurrent code
- Edge cases not handled

**Security**
- Injection (SQL, XSS, command, SSRF, path traversal)
- Hardcoded secrets or credentials
- Missing input validation at system boundaries
- Authentication/authorization gaps

**Breaking changes**
- API contract changes (request/response shapes, status codes)
- Database schema changes without migrations
- Config format changes without backwards compatibility
- Removed or renamed exports/public interfaces

**Code quality (anti-slop — terse checklist)**
LLM-assisted PRs commonly introduce code that *runs fine* but pollutes the codebase. Scan the diff for these high-signal patterns:

- New file in dumping-ground dirs (`utils/`, `helpers/`, `lib/common/`, `*manager.ts`) without a clear domain anchor
- Parallel reimplementation of a utility that already exists in the repo (grep for prior art)
- New abstraction (interface + factory + builder) with only one caller — premature
- New config flag for behavior that should be hardcoded
- Defensive paranoia — try/catch around code that cannot throw; null checks on typed-non-null params
- Catch-and-swallow — `catch (e) { console.log(e) }` or `catch { return null }`
- Over-comment — comments paraphrasing code (`// increment counter` next to `counter++`)
- One-line wrappers that add indirection with no value
- Re-implementing stdlib (`chunk`, `range`, `groupBy`) when language or existing dep covers it
- `any` widening, `@ts-ignore`, `// eslint-disable` introduced to silence (not fix) warnings
- Phantom test coverage — tests that exercise lines without meaningful assertions
- Unused imports / exports / parameters / variables introduced
- File grows past the project's size limit (commonly 200 lines) without splitting
- Diff size doesn't match scope ("fix typo" with +800/−60)
- Touches files unrelated to stated purpose
- Commit messages with generic LLM phrasing ("improve code quality and enhance maintainability")

**Load the full taxonomy** in `references/anti-ai-slop.md` when ANY of:
- diff adds >300 lines, OR
- ≥2 inline anti-slop flags above fire, OR
- PR creates >2 new files in `utils/`/`helpers/`/`lib/common/`, OR
- you cannot confidently judge whether a pattern is genuine YAGNI vs slop

The reference covers: structural slop, micro slop, process slop, how to phrase the finding without becoming an AI-witch-hunt, when NOT to flag, and stack-specific appendix (Go, React/TS, Tailwind).

**Project-specific compliance**
- Use the standards loaded or generated by the Project standards gate
- Check the diff against project conventions for: architecture patterns, ID scoping, SQL store rules, i18n catalogs, UI/CSS conventions, package manager, file-size limits
- See `references/project-rules-example.md` for a worked example of project-specific compliance rules (Go gateway, React/Tailwind UI)

**Testing**
- Are new code paths covered by tests?
- Do existing tests still pass with these changes?
- Are edge cases tested?
- Watch for phantom coverage (assertions that always pass)

### 5. Summarize findings

Present your review as:

**Summary**: 1-2 sentence overview of what the PR does.

**Risk level**: Low / Medium / High — based on scope, complexity, and breakage potential.

**Mandatory gates**:
- Duplicate / prior implementation: clear | overlap found | duplicate found
- Project standards: docs found | generated baseline | missing/conflicted
- Strategic necessity: clear value | questionable | not justified

**Findings**: List issues found, categorized by severity:
- **Critical**: Must fix before merge (bugs, security, data loss)
- **Important**: Should fix (logic issues, missing validation, *structural* AI slop)
- **Suggestion**: Nice to have (style, minor improvements, *micro* AI slop)

> Anti-slop severity rule: **structural** slop (new dumping-ground file, parallel reimpl, abstraction with one caller, schema change without migration, large file growth) → **Important**. **Micro** slop (over-comments, defensive paranoia, one-line wrappers) → **Suggestion**. This keeps `--fix` from churning the diff with cosmetic rewrites the original author won't recognize.

**Verdict**: One of:
- **Approve** — No critical or important issues found
- **Request changes** — Critical or important issues need addressing
- **Comment** — Minor suggestions only, safe to merge as-is

## Fix loop mode (`--fix`)

If `$ARGUMENTS` contains `--fix`, complete the review and then run this convergence loop. Do not stop at "code review clean" while merge conflicts or failing/pending checks remain.

### 1. Build the blocking set

Collect every blocker before fixing:
- Mandatory gate blockers: duplicate/prior-work conflicts, missing or generated standards that affect the PR, and strategic-necessity findings marked **Important**.
- Code review findings from this skill: all **Critical** and **Important** findings, plus **Suggestion** findings that are concrete, low-risk, and tied to PR scope.
- Merge conflicts, stale branch state, or unknown mergeability from `gh pr view "$PR_REF" --json mergeStateStatus,baseRefName,headRefName,headRefOid`.
- CI failures, pending checks, and skipped required checks from `gh pr checks "$PR_REF"` and `statusCheckRollup`.

For failing checks, inspect the exact run/job with `gh run view <run-id> --json status,conclusion,jobs` and, when needed, `gh run view <run-id> --job <job-id> --log`. Copy the exact failing command/error into the fix prompt.

If there are no actionable findings, no merge blockers, and all required PR checks are green, stop and report **Approve**.

### 2. Check out and verify the PR head

Before making fixes, ensure the worktree is on the PR head branch:
- Prefer `gh pr checkout "$PR_REF"` when the current user has write access to the PR head.
- If the PR comes from a fork or checkout fails, use `gh pr view "$PR_REF" --json headRepositoryOwner,headRepository,headRefName,headRefOid` plus `git fetch` to check out the head SHA read-only.
- After checkout, verify `git rev-parse HEAD` matches the PR `headRefOid` before editing.
- If the PR head cannot be checked out with write access, record a fork/no-write external blocker instead of committing to the wrong branch.

Before each `ck:git cp`, re-check that `git rev-parse --abbrev-ref HEAD` and `git rev-parse HEAD` still match the PR head branch/SHA or the expected local fix commit descendant.

### 3. Fix code and config blockers

Activate `ck:fix --auto` with the full blocking set and PR context:

```
ck:fix --auto "Fix all blockers from review-pr <PR_REF>: <finding, conflict, and CI summary>"
```

Pass the exact evidence:
- PR reference, base branch, head branch, head SHA, merge state
- changed files and affected owners/modules
- each mandatory gate result and review finding: severity, file path/PR link when available, expected behavior, actual behavior, why it matters
- each failing check: workflow, run id, job id, failing step, command, and exact error
- conflict files if merge/rebase reports conflicts
- constraints: preserve PR scope, avoid unrelated refactors, keep public contracts backward compatible unless the finding requires a contract change

`ck:fix` performs its own scout, diagnose, implementation, verification, and prevention flow. Do not bypass its hard gates. If a blocker is external state such as missing credentials, service outage, unavailable approval, or a secret value not present anywhere accessible, record it as an external blocker instead of weakening tests or hiding the failure.

### 4. Resolve conflicts

If the PR is not mergeable because the branch is stale or conflicted:
- `git fetch origin`
- inspect base/head from PR metadata
- merge or rebase the PR head against `origin/<baseRefName>` according to repository convention
- resolve every conflict in real files, run relevant tests, then commit

Never mark the loop complete while `mergeStateStatus` still indicates conflicts.

### 5. Commit, push, and watch CI

After fixes verify locally, activate:

```
ck:git cp
```

This stages, commits, and pushes the fixes to the PR head branch. Do not run `ck:git cp` if verification failed, secrets are detected, or the working tree contains unrelated user changes.

Then watch all PR checks:
- Start with `gh pr checks "$PR_REF"`.
- If any check is pending, watch or poll until every check is terminal, bounded by the repository's normal CI duration. If there is no known duration, use a 30-minute ceiling for the same head SHA.
- If any check fails, inspect logs, add the failure to the blocking set, and loop back to Step 1.
- If rerunning is appropriate for a clearly transient infrastructure failure, use `gh run rerun <run-id> --failed`, then watch the rerun. Do not rerun to hide deterministic failures.
- If required checks remain queued, pending, or skipped at the timeout without new log evidence, classify them as external CI blockers with run/job links and stop the loop.

All required CI must be green before an **Approve** verdict in `--fix` mode.

### 6. Re-review

After a push and green checks, activate `review-pr <PR_REF> --fix` again (carrying `--reply` if it was originally set) and repeat the loop.

Stop successfully only when all of these are true:
- no actionable review findings remain
- no merge conflicts remain
- all required PR checks are green

Stop blocked only when one of these is true:
- an external blocker remains that cannot be solved from the repo or available credentials
- the same blocker survives 3 consecutive fix attempts, which means the approach is not converging

If `--reply` is present, post only the final re-review when the loop stops. Include iterations, commits pushed, final verdict, CI state, conflicts state, remaining findings, and unresolved blockers/questions.

Final output for `--fix` mode:
- number of review/fix/CI iterations
- final verdict
- commits pushed
- current PR head SHA
- merge/conflict state
- CI state with failed run/job links if any
- remaining findings, if any
- blockers or unresolved questions at the end

## Reply mode (`--reply`)

If `$ARGUMENTS` contains `--reply`, post the review back to GitHub as a formal review after the review (review-only) or after the fix loop converges (`--fix`).

### 1. Pre-flight checks

Run these checks. On any failure, **fall back to printing the review locally** and warn the user — never fail the whole skill:

```bash
command -v gh >/dev/null 2>&1 || { echo "gh CLI not installed — printing review locally"; exit 0; }
gh auth status >/dev/null 2>&1 || { echo "gh not authenticated — printing review locally"; exit 0; }
```

### 2. Build the review body

Construct the full markdown body containing the summary, mandatory gate results, risk level, findings (by severity), and verdict. Append a single-line footer for traceability:

```
*Posted by /ck:review-pr at <ISO-8601 UTC timestamp>*
```

Use `date -u +"%Y-%m-%dT%H:%M:%SZ"` for the timestamp.

**Length cap**: GitHub limits comment bodies to ~65,536 chars. If the body exceeds 60,000 chars, truncate the *Findings* section and append `[truncated — N findings omitted; see local output]` so the reviewer knows to consult the full chat output.

### 3. Map verdict to gh flag

| Verdict | gh command |
|---|---|
| Approve | `gh pr review "$PR_REF" --approve --body-file -` |
| Request changes | `gh pr review "$PR_REF" --request-changes --body-file -` |
| Comment | `gh pr review "$PR_REF" --comment --body-file -` |

Pipe the body via stdin to avoid shell-quoting issues with backticks and code blocks.

### 4. Self-PR fallback

GitHub blocks approving your own PR. If `gh pr review --approve` exits non-zero with a self-review error (HTTP 422, message matching "Can not approve your own pull request"), retry as a neutral formal review:

```bash
gh pr review "$PR_REF" --comment --body-file -
```

The review still lands in the timeline; the verdict text inside the body still reads "Approve". Note the downgrade in the chat output.

### 5. Composition with `--fix`

In `--fix --reply` mode, post **only the final re-review** when the loop converges. Iteration history lives in the commit log; the PR conversation stays clean.

If the loop terminates due to a blocker (non-converging, `ck:fix` blocked, CI unresolvable), still post the final review — but the verdict will reflect remaining findings (likely **Request changes** or **Comment**), and the body should include the blocker so the human reviewer knows where to take over.

### 6. Idempotency

V1 does not dedupe. Re-running `review-pr 123 --reply` posts a fresh review each time. The traceability footer (step 2) is the seed for future dedup work but is not consumed here.

## Final output

After all modes complete, report to the chat:

- Verdict (Approve / Request changes / Comment)
- Duplicate/prior implementation result
- Project standards result
- Strategic necessity result
- Iteration count if `--fix` ran
- Commits pushed if `--fix` ran
- Whether `--reply` succeeded, fell back, or printed-locally
- Remaining findings or blockers
- Unresolved questions, if any
