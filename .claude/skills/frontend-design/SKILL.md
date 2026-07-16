---
name: ck:frontend-design
description: Create polished frontend interfaces from designs/screenshots/videos. Use for web components, 3D experiences, replicating UI designs, quick prototypes, immersive interfaces, avoiding AI slop.
user-invocable: true
when_to_use: "Invoke when visual fidelity and polished UI are primary."
category: frontend
keywords: [ui, design, screenshots, prototyping]
license: Complete terms in LICENSE.txt
metadata:
  author: claudekit
  version: "1.0.0"
---

This skill guides creation of distinctive, production-grade frontend interfaces that avoid generic "AI slop" aesthetics. Implement real working code with exceptional attention to aesthetic details and creative choices.

**IMPORTANT**: MUST follow Design Thinking, Frontend Aesthetics Guidelines, Asset & Analysis References, and Anti-Patterns (AI Slop) sections below. DO NOT skip these rules.

This skill handles visual direction, UI implementation, screenshot/video replication, frontend polish, and design critique. Does NOT handle backend architecture, product strategy, or deployment except where frontend delivery requires it.

## Security

- Never include secrets, private tokens, customer data, or hidden environment values in frontend assets, screenshots, fixtures, or demo copy.
- Treat uploaded screenshots/videos as user-provided private context. Do not publish, link, or reuse them outside the current task unless the user explicitly asks.
- If a brief asks to clone a third-party product, replicate layout and interaction patterns without copying protected logos, trademarked assets, private data, or proprietary text.

## Workflow Selection

Choose workflow based on input type:

| Input | Workflow | Reference |
|-------|----------|-----------|
| Screenshot | Replicate exactly | `./references/workflow-screenshot.md` |
| Video | Replicate with animations | `./references/workflow-video.md` |
| Screenshot/Video (describe only) | Document for devs | `./references/workflow-describe.md` |
| 3D/WebGL request | Three.js immersive | `./references/workflow-3d.md` |
| Quick task | Rapid implementation | `./references/workflow-quick.md` |
| Complex/award-quality | Full immersive | `./references/workflow-immersive.md` |
| Existing project upgrade | Redesign Audit | `./references/redesign-audit-checklist.md` |
| From scratch | Design Thinking below | - |

**All workflows**: Activate `ck:ui-ux-pro-max` skill FIRST for design intelligence.

**Precedence:** When anti-slop rules (below) conflict with `ck:ui-ux-pro-max` recommendations (e.g., Inter font, AI Purple palette, Lucide-only icons), substitute with alternatives from `./references/anti-slop-rules.md` unless the user explicitly requested the conflicting choice.

## Design Lead Protocol

Approach each UI as a design lead hired to create a specific visual identity, not a reusable template.

1. Ground the concept in the subject. If the brief is vague, choose one concrete subject, audience, and page or app job before designing. Use memory and project context as hints, but make the subject explicit.
2. Pull from the subject's world: materials, instruments, artifacts, vocabulary, constraints, and rituals. Distinctive design starts there, not from generic SaaS patterns.
3. Take one justified aesthetic risk: a layout move, type treatment, interaction, image system, or signature component that belongs to this brief.
4. Spend boldness in one place. Let the signature element carry the risk; keep supporting UI disciplined.

## Screenshot/Video Replication (Quick Reference)

1. **Analyze** with `ck:ai-multimodal` skill - extract colors, fonts, spacing, effects
2. **Plan** with `ui-ux-designer` subagent - create phased implementation
3. **Implement** - match source precisely
4. **Verify** - compare to original
5. **Document** - update `./docs/design-guidelines.md` if approved

See specific workflow files for detailed steps.

## Design Dials

Three configurable parameters that drive design decisions. Set defaults at session start or let user override via chat:

| Dial | Default | Range | Low (1-3) | High (8-10) |
|------|---------|-------|-----------|-------------|
| `DESIGN_VARIANCE` | 8 | 1-10 | Perfect symmetry, centered layouts, equal grids | Asymmetric, masonry, massive empty zones, fractional CSS Grid |
| `MOTION_INTENSITY` | 6 | 1-10 | CSS hover/active states only | Framer Motion scroll reveals, spring physics, perpetual micro-animations |
| `VISUAL_DENSITY` | 4 | 1-10 | Art gallery — huge whitespace, expensive/clean | Cockpit — tiny paddings, 1px dividers, monospace numbers everywhere |

**Usage:** These values drive specific rules. At `DESIGN_VARIANCE > 4`, centered heroes are overused — force split-screen or left-aligned layouts. At `MOTION_INTENSITY > 5`, embed perpetual micro-animations. At `VISUAL_DENSITY > 7`, remove generic cards and use spacing/dividers.

See `./references/bento-motion-engine.md` for dial-driven SaaS dashboard implementation.

## Two-Pass Design Process

Before coding from scratch or reshaping an existing UI:

1. **Brainstorm a compact design plan**
   - Subject: concrete subject, target audience, and the screen's single job.
   - Color: 4-6 named hex tokens with roles, not a decorative palette dump.
   - Type: at least two roles, usually display + body; add utility/data face when needed.
   - Layout: compare one or two layout concepts with short prose or ASCII wireframes.
   - Signature: the memorable element that embodies the brief.
   - Motion: one intentional role for animation, or an explicit decision to stay still.
   - Copy voice: how labels, actions, empty states, and errors should sound.
2. **Critique the plan before building**
   - Ask whether any part would appear unchanged for a different client in the same category.
   - If yes, revise the palette, type, structure, copy, or signature until the choice belongs to this subject.
   - Only then implement code, deriving colors, typography, spacing, and motion from the revised plan.

Keep this planning mostly in analysis unless the user asks to see options.

## Design Thinking

Before coding, commit to a BOLD aesthetic direction:
- **Purpose**: What problem does this interface solve? Who uses it?
- **Tone**: Pick an extreme: brutally minimal, maximalist chaos, retro-futuristic, organic/natural, luxury/refined, playful/toy-like, editorial/magazine, brutalist/raw, art deco/geometric, soft/pastel, industrial/utilitarian, etc. There are so many flavors to choose from. Use these for inspiration but design one that is true to the aesthetic direction.
- **Constraints**: Technical requirements (framework, performance, accessibility).
- **Differentiation**: What makes this UNFORGETTABLE? What's the one thing someone will remember?

**CRITICAL**: Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work - the key is intentionality, not intensity.

Then implement working code (HTML/CSS/JS, React, Vue, etc.) that is:
- Production-grade and functional
- Visually striking and memorable
- Cohesive with a clear aesthetic point-of-view
- Meticulously refined in every detail

## Frontend Aesthetics Guidelines

Focus on:
- **Hero as Thesis**: For web pages, the hero must express the core subject. Open with the most characteristic thing in that world: image, live demo, animation, strong headline, interactive moment, or product state. Avoid default metric/stat hero blocks unless the brief makes them truly central.
- **Typography**: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics; unexpected, characterful font choices. Pair a distinctive display font with a refined body font.
- **Color & Theme**: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes.
- **Structure as Information**: Use numbering, dividers, labels, eyebrows, and section mechanics only when they encode real hierarchy, sequence, status, or comparison. Do not add `01 / 02 / 03` markers unless order matters.
- **Motion**: Use animations for effects and micro-interactions. Prioritize CSS-only solutions for HTML. Use Motion library for React when available. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions. Use scroll-triggering and hover states that surprise.
- **Spatial Composition**: Unexpected layouts. Asymmetry. Overlap. Diagonal flow. Grid-breaking elements. Generous negative space OR controlled density.
- **Backgrounds & Visual Details**: Create atmosphere and depth rather than defaulting to solid colors. Add contextual effects and textures that match the overall aesthetic. Apply creative forms like gradient meshes, noise textures, geometric patterns, layered transparencies, dramatic shadows, decorative borders, custom cursors, and grain overlays.
- **Interface Writing**: Treat words as design material. Use plain active verbs, consistent action names, specific labels, directional empty states, and errors that explain what happened plus how to recover.

NEVER use generic AI-generated aesthetics like overused font families (Inter, Roboto, Arial, system fonts), cliched color schemes (particularly purple gradients on white backgrounds), predictable layouts and component patterns, and cookie-cutter design that lacks context-specific character.

Interpret creatively and make unexpected choices that feel genuinely designed for the context. No design should be the same. Vary between light and dark themes, different fonts, different aesthetics. NEVER converge on common choices (Space Grotesk, for example) across generations.

**IMPORTANT**: Match implementation complexity to the aesthetic vision. Maximalist designs need elaborate code with extensive animations and effects. Minimalist or refined designs need restraint, precision, and careful attention to spacing, typography, and subtle details. Elegance comes from executing the vision well.

**Restraint Check**: After the first build pass, remove one decorative element that does not support the brief. Boldness without editing reads as generated clutter.

**Implementation Check**: Watch CSS specificity and selector overlap. Avoid generic class names that cancel each other out across sections, especially around padding, margin, and CTA styles.

**Remember:** Claude is capable of extraordinary creative work. Don't hold back, show what can truly be created when thinking outside the box and committing fully to a distinctive vision.

**Assets**: Generate images with `ck:ai-multimodal`, process with `ck:media-processing`

## Writing For Interfaces

When the brief lacks real copy, write only what helps the user understand and act.

- Name controls by what people recognize and control, not implementation internals.
- Prefer specific active labels: "Save changes", "Publish", "Invite reviewer".
- Keep action vocabulary consistent across buttons, toasts, dialogs, and docs.
- Error text must state what happened and how to fix it; do not apologize or stay vague.
- Empty states should invite the next useful action.
- Let each element do one job: label labels, hint explains, example demonstrates.

## Asset & Analysis References

| Task | Reference |
|------|-----------|
| Generate assets | `./references/asset-generation.md` |
| Analyze quality | `./references/visual-analysis-overview.md` |
| Extract guidelines | `./references/design-extraction-overview.md` |
| Optimization | `./references/technical-overview.md` |
| Animations | `./references/animejs.md` |
| Magic UI (80+ components) | `./references/magicui-components.md` |
| Anti-slop forbidden patterns | `./references/anti-slop-rules.md` |
| Redesign audit checklist | `./references/redesign-audit-checklist.md` |
| Premium design patterns | `./references/premium-design-patterns.md` |
| Performance guardrails | `./references/performance-guardrails.md` |
| Bento motion engine (SaaS) | `./references/bento-motion-engine.md` |

Quick start: `./references/ai-multimodal-overview.md`

## Anti-Patterns (AI Slop)

Strongly prefer alternatives to these LLM defaults. Full rules: `./references/anti-slop-rules.md`

**Typography** — Avoid Inter/Roboto/Arial. Prefer: Trending Google Fonts that supports Vietnamese characters, `Geist`, `Outfit`, `Cabinet Grotesk`, `Satoshi` (search for best matches)

**Font size** — ALWAYS use font size larger than 16px for input fields to avoid zoom on mobile devices.

**Color** — Avoid AI purple/blue gradient aesthetic, pure `#000000`, oversaturated accents. Use neutral bases with a single considered accent.

**Layout** — Avoid 3-column equal card feature rows, centered heroes at high variance, `h-screen`. Use asymmetric grids, split-screen, `min-h-[100dvh]`. Mobile-first approach is a must.

**Content** — Avoid "John Doe", "Acme Corp", round numbers, AI copy clichés ("Elevate", "Seamless", "Unleash"). Use realistic names, organic data, plain specific language.

**Effects** — Avoid neon/outer glows, custom cursors, gradient text on headers (unless you're asked to do so). Use tinted inner shadows, spring physics.

**Components** — Avoid default unstyled shadcn, Lucide-only icons, generic card-border-shadow pattern at high density. Always customize, try Phosphor/Heroicons, use spacing over cards.

**Quick check:** See the "AI Tells" checklist in `./references/anti-slop-rules.md` before delivering any design.

**Default-look calibration:** Current generic AI design often clusters around warm cream + serif + terracotta, near-black + acid accent, or broadsheet hairline editorial layouts. Use those looks only when the brief specifically earns them; otherwise spend free creative range elsewhere.

**Performance:** Animation and blur rules in `./references/performance-guardrails.md`

Remember: Claude is capable of extraordinary creative work. Commit fully to distinctive visions.
