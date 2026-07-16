---
name: ghpm
description: "GitHub project management for humans and AI agents. Use for issue/task planning, Projects boards, handoff status, gh/API automation, and CI-driven work tracking."
user-invocable: true
when_to_use: "Invoke when managing project work through GitHub Issues, Projects, PRs, labels, Actions, handoffs, agent coordination, or status reporting."
category: utilities
keywords: [github, project-management, issues, projects, tasks, handoff, handover, gh, actions, agents]
license: MIT
metadata:
  author: claudekit
  version: "1.0.0"
---

# GHPM

Use GitHub as the single source of truth (SSOT) for project work shared by humans and AI agents.
This skill handles task intake, triage, issue/project schemas, status updates, handoff logs, and GitHub automation through `gh`, `git`, GraphQL, REST, and Actions.
Does NOT replace product judgment, private planning, secrets management, or code review.

## Security

- Never paste secrets into issues, project fields, PR bodies, workflow logs, or comments.
- Treat public repos as public evidence ledgers; redact customer data and credentials.
- Use least-privilege tokens. For Projects, verify `project` scope before edits: `gh auth status`.
- Prefer `GH_TOKEN` in Actions; do not write PATs to workflow files.
- If a task needs private data, store only a pointer: owner, system, access request, and redacted summary.

## Use When

- User asks to manage tasks, status, roadmap, project boards, issue labels, GitHub Projects, or handoff/handover.
- Work spans humans + AI agents and needs durable context between sessions.
- Need convert chat/plans/TODOs into GitHub Issues with evidence, owners, dependencies, status.
- Need chain skills into execution pipelines and report progress from GitHub state.
- Need automate triage/status/comments with GitHub Actions or `gh api`.

## Core Model

Use GitHub primitives deliberately:

| Primitive | Role |
| --- | --- |
| Issue | Atomic task, bug, decision, or milestone slice |
| Issue body | Contract: context, acceptance criteria, handoff log |
| Labels | Stable routing: type, priority, area, risk, agent/human lane |
| Project | Live board: status, iteration, owner, estimate, target |
| PR | Execution evidence linked to issues |
| Actions | Automation worker for triage, reminders, stale checks, reports |
| Comments | Append-only handoff log and decision trail |
| Branch | Work-in-progress pointer linked to issue/PR |

Prefer Projects `Status` for live state. Use labels for taxonomy and search. If no Project exists, use `status:*` labels as a lightweight fallback.

## Workflow

1. Orient repo and auth:
   ```bash
   git remote -v
   gh repo view --json nameWithOwner,defaultBranchRef,owner
   gh auth status
   gh project list --owner OWNER
   gh issue list --state open --limit 50 --json number,title,labels,assignees,updatedAt
   ```

2. Choose operating mode:
   - **Bootstrap**: create labels, project fields, templates, automation.
   - **Intake**: turn request/plan/chat into GitHub issues.
   - **Execute**: link branch/PR/checks to issues, update status.
   - **Handoff**: write current state, blockers, commands, next owner.
   - **Audit**: compare GitHub state against local repo/plans/CI.

3. Load only needed references:
   - `references/schema-and-taxonomy.md` for labels, fields, issue body contract.
   - `references/command-cookbook.md` for `gh`, GraphQL, REST, and Actions snippets.
   - `references/skill-pipelines.md` for chained workflows with other skills.

4. Update GitHub first, then local artifacts:
   - If a task changes, update issue/project/comment.
   - If code changes, link PR/branch/checks back to the issue.
   - If docs/plans change, put the canonical task state in GitHub and link local files.

5. Report from evidence:
   - Cite issue/PR/project URLs, check names, branch names, timestamps.
   - End with unresolved questions only if GitHub/current repo cannot answer them.

## Task Contract

Every task issue should contain:

```markdown
## Outcome
What done means.

## Context
Relevant repo, branch, files, links, constraints.

## Acceptance Criteria
- [ ] Verifiable condition

## Handoff Log
- YYYY-MM-DD HH:mm TZ - actor: state, evidence, next step.

## Skill Chain
Suggested skills and order, e.g. ck:scout -> ck:plan -> ck:cook -> ck:test -> ck:git -> ck:ship.
```

Keep the issue body as the contract. Use comments for chronological updates.

## Operating Rules

- Use `gh` first for normal operations; use `gh api graphql` when Projects fields need precise reads/writes.
- Never silently create broad label taxonomies; inspect existing labels and extend minimally.
- Keep statuses mutually exclusive: one live status only.
- Record blockers as both field/label and comment with owner + unblock condition.
- Prefer issue dependencies/sub-issues when available; otherwise cross-link with `Blocked by #N` and `Blocks #M`.
- For AI handoff, include exact commands already run, tests/checks result, touched files, and next safe command.
- For humans, summarize current decision, risk, and what needs approval.

## Quick Commands

```bash
# Create task
gh issue create --title "feat: add billing webhook retry" \
  --label "type:feature,priority:p1,status:ready,agent:ai-ok" \
  --body-file /tmp/task.md

# Update state
gh issue edit 123 --remove-label status:ready --add-label status:in-progress
gh issue comment 123 --body-file /tmp/handoff.md

# Link branch
gh issue develop 123 --checkout

# Trigger automation
gh workflow run project-triage.yml --ref main -f issue=123
```

## Output Format

When using this skill, return concise evidence-based status:

```markdown
**GHPM Status**
- Repo: OWNER/REPO
- Project: URL or none
- Issues: #N title [status, owner, priority]
- Actions: workflow/check result
- Handoff: last comment URL, next owner/action

Unresolved questions:
- None
```
