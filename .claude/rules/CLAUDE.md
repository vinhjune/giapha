# ClaudeKit Engineer Context

This file is the always-loaded contract for ClaudeKit Engineer. Keep it short. Load the linked rule files only when the current task needs them.

## Core Rules

- Optimize for the user's workflow: clear prompts, useful errors, real implementation, no performative ceremony — but always show the analysis behind any decision you ask the user to make.
- Before asking the user to choose between approaches (`AskUserQuestion` or otherwise), present the options and your reasoning in visible response text first. Never ask about analysis the user has not seen; write every option so it stands alone. Internal reasoning is invisible to the user — externalize it before any decision point.
- Before implementation, read `README.md` plus relevant project docs in `docs/` when they exist.
- Work in the current project. Do not edit `~/.claude/skills` unless the user explicitly asks for global skill changes.
- Preserve secrets and private files. Never work around privacy hooks or commit credentials.
- Use the repo's existing patterns, commands, and public contracts before inventing new ones.
- Prefer small, focused changes. Add abstractions only when they remove real complexity.

## On-Demand References

- Implementation and verification: `./.claude/rules/development-rules.md`
- Feature/debug workflow shape: `./.claude/rules/primary-workflow.md`
- Subagents or teams: `./.claude/rules/orchestration-protocol.md`
- Plans and docs: `./.claude/rules/documentation-management.md`
- Review, audit, or scope cuts: `./.claude/rules/review-audit-self-decision.md`

Skill routing lives with the owning skills:

- Ambiguous domain choice: `./.claude/skills/find-skills/references/domain-routing.md`
- Multi-step workflow sequence: `./.claude/skills/cook/references/workflow-routing.md`
- Visual explanations or diagrams: `./.claude/skills/preview/references/visual-explanation-routing.md`
- Documentation update decisions: `./.claude/skills/docs/references/documentation-management.md`

Use skill names and descriptions first. Open these references only when routing is ambiguous or the current workflow needs the detail.

## Hook Responses

If the privacy-block hook emits a marker between `@@PRIVACY_PROMPT_START@@` and `@@PRIVACY_PROMPT_END@@`, parse the JSON and ask the user for approval with `AskUserQuestion`. If access is denied, continue without that file.

## Skill Scripts

When running Python scripts from `.claude/skills/`, use the skill venv:

- macOS/Linux: `.claude/skills/.venv/bin/python3`
- Windows: `.claude\skills\.venv\Scripts\python.exe`

If a skill script fails and the task depends on it, debug the local skill copy in this project rather than bypassing the failure.
