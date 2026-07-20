---
name: ak:journal
description: "Write chronological technical journals for session reflection and change analysis. Journals preserve work history; they do not replace current docs or ADRs."
user-invocable: true
when_to_use: "Invoke for technical session reflection or chronological work records."
category: utilities
keywords: [journal, reflection, changes, session]
argument-hint: "[topic or reflection]"
metadata:
  author: agentkit
  version: "1.0.0"
---

# Journal

Use the `journal-writer` subagent to explore the memories and recent code changes, and write some journal entries.
Journal entries should be concise and focused on the most important events, key changes, impacts, and decisions.
Keep journal entries in the `./plans/journals/` directory.
Treat them as work history, not current product or decision authority. Record
durable decisions in the project's ADR or current documentation owner.
After the local entry is created, have `journal-writer` publish/share it through AgentWiki CLI or MCP when available; otherwise report that AgentWiki publishing was skipped.

**IMPORTANT:** Invoke "the engineer project-organization skill" skill to organize the outputs.

## Workflow Position

**Typically follows:** `the engineer ship skill` (journal after shipping), `/ak:cook` (journal after implementation), `/ak:fix` (journal after bug fix)
**Terminal skill** — no typical successor.
