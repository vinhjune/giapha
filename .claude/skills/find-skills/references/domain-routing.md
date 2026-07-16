# ClaudeKit Domain Routing

Use this file only when choosing between installed ClaudeKit skills. If the user
asks to discover or install external skills, return to `../SKILL.md` and use the
Skills CLI flow.

## Routing Rules

- If the user names a skill, use that skill.
- Pick one primary skill per distinct intent. Mention secondary skills only as
  follow-up helpers.
- If the task needs a multi-step sequence, read
  `../../cook/references/workflow-routing.md` after choosing the primary skill.
- If two skills overlap, prefer the more specific domain skill over a generic
  workflow skill.

## Frontend and UI

| User intent | Primary skill |
|---|---|
| Replicate a mockup, screenshot, or video | `/ck:frontend-design` |
| Build React or TypeScript components | `/ck:frontend-development` |
| Style with Tailwind or shadcn/ui | `/ck:ui-styling` |
| Choose color, typography, layout, or design system | `/ck:ui-ux-pro-max` |
| Audit UI accessibility or UX | `/ck:web-design-guidelines` |
| Apply React or Next.js performance patterns | `/ck:react-best-practices` |
| Generate UI designs with Stitch | `/ck:stitch` |
| Build 3D, WebGL, or Three.js scenes | `/ck:threejs` |
| Write shaders or procedural graphics | `/ck:shader` |

## Codebase Understanding

| User intent | Primary skill |
|---|---|
| Locate files or understand code quickly | `/ck:scout` |
| Pack a repository for LLM use | `/ck:repomix` |
| Semantic go-to-definition or find-usages | `/ck:gkg` |
| Build a queryable knowledge graph | `/ck:graphify` |

## Backend, Data, and Auth

| User intent | Primary skill |
|---|---|
| Build REST, GraphQL, or backend services | `/ck:backend-development` |
| Add auth, OAuth, sessions, or passkeys | `/ck:better-auth` |
| Design schemas or write SQL/NoSQL queries | `/ck:databases` |
| Integrate Stripe, Polar, Paddle, or SePay | `/ck:payment-integration` |

## Infrastructure and Security

| User intent | Primary skill |
|---|---|
| Deploy to hosted platforms | `/ck:deploy` |
| Docker, Kubernetes, CI/CD, or cloud ops | `/ck:devops` |
| STRIDE/OWASP audit with remediation | `/ck:security` |
| Secret, dependency, or vulnerability scan | `/ck:security-scan` |
| OSINT or cyber threat intelligence | `/ck:cti-expert` |

## AI, MCP, and Browser Automation

| User intent | Primary skill |
|---|---|
| Context, memory, or agent architecture | `/ck:context-engineering` |
| Generate `llms.txt` | `/ck:llms` |
| Build Google ADK agents | `/ck:google-adk-python` |
| Build MCP servers | `/ck:mcp-builder` |
| Convert code into CLI/MCP surface | `/ck:agentize` |
| Discover or execute MCP tools | `/ck:use-mcp` |
| Test generic browser workflows | `/ck:agent-browser` |
| Use the user's real Chrome profile | `/ck:chrome-profile` |

## Testing, Docs, and Media

| User intent | Primary skill |
|---|---|
| Run tests, coverage, or TDD gates | `/ck:test` |
| Playwright, Vitest, k6, visual or a11y tests | `/ck:web-testing` |
| Project docs init/update/summarize | `/ck:docs` |
| Library/framework docs lookup | `/ck:docs-seeker` |
| Visual explanation, preview, slides, or diagrams | `/ck:preview` |
| Mermaid syntax | `/ck:mermaidjs-v11` |
| Publish-grade technical diagrams | `/ck:tech-graph` |
| Video/audio/image processing | `/ck:media-processing` |
| HTML-template video rendering | `/ck:html-video` |

## Frameworks and Platforms

| User intent | Primary skill |
|---|---|
| Next.js, App Router, RSC, Turborepo | `/ck:web-frameworks` |
| TanStack Start/Form/AI | `/ck:tanstack` |
| React Native, Flutter, SwiftUI, Kotlin | `/ck:mobile-development` |
| Shopify apps, extensions, or themes | `/ck:shopify` |
