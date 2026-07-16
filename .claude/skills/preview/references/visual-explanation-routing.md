# Visual Explanation Routing

Use this file when a workflow asks for a visual explanation, diagram, slide deck,
diff review, or recap. Load `../SKILL.md` first for command syntax, then use this
file to choose the mode.

## Mode Selection

| Need | Preview mode |
|---|---|
| View an existing Markdown file or directory | `/ck:preview <path>` |
| Explain a concept or code path | `/ck:preview --explain <topic>` |
| Generate a focused architecture/data-flow diagram | `/ck:preview --diagram <topic>` |
| Terminal-friendly diagram only | `/ck:preview --ascii <topic>` |
| Self-contained HTML explanation | `/ck:preview --html --explain <topic>` |
| Slide deck | `/ck:preview --html --slides <topic>` |
| Visual diff review for a branch, PR, or commit | `/ck:preview --html --diff [ref]` |
| Compare an implementation plan to code | `/ck:preview --html --plan-review <plan>` |
| Recap recent project context | `/ck:preview --html --recap [timeframe]` |

## Specialist Handoffs

- Mermaid syntax: load `/ck:mermaidjs-v11`.
- Publish-grade SVG/PNG architecture diagrams: use `/ck:tech-graph`.
- Generated images or multimodal analysis: use `/ck:ai-multimodal`.
- UI/UX style selection for slides or high-polish HTML: use
  `/ck:ui-ux-pro-max`.
- Documentation update after a durable visual: use `/ck:docs update` and
  `../../docs/references/documentation-management.md`.

## Output Rules

- Prefer the active plan's `visuals/` folder when a plan exists.
- If no plan exists, save under `plans/visuals/`.
- For HTML output, always include the theme toggle required by
  `html-css-patterns.md`.
- For diagrams, render and inspect the output; syntax validity alone is not
  enough.
