// The `xss` package's CJS module assigns `module.exports = filterXSS` (a
// callable function with `.filterXSS`/`.FilterXSS` properties attached to
// it), rather than a plain object of named exports. Under the bundler used
// by vitest-pool-workers/wrangler, named imports (`import { filterXSS }`)
// fail to resolve because the CJS-to-ESM interop only recognizes a `default`
// export for a function-shaped `module.exports`. Importing the default and
// calling it directly (it *is* the `filterXSS` function) sidesteps that.
import filterXSS from 'xss'

// Allowlist for rich-text article bodies authored via the Tiptap editor in
// ArticleManagementView. This is the authoritative sanitization step: it runs
// on every article create/update so stored content can never contain script
// tags, event handlers, or other unexpected markup — regardless of whether a
// request came from the editor UI or a direct API call.
const ARTICLE_BODY_XSS_OPTIONS = {
  whiteList: {
    p: [],
    br: [],
    strong: [],
    em: [],
    u: [],
    s: [],
    h2: [],
    h3: [],
    ul: [],
    ol: [],
    li: [],
    blockquote: [],
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height'],
  },
  // Unwrap any tag not in the allowlist but keep its text content (friendlier
  // for pasted content), EXCEPT for script/style tags, whose body is dropped
  // along with the tag itself since their "text content" is code, not prose.
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style'],
  css: false,
}

/** Sanitizes an article body's HTML before it is persisted to D1. */
export function sanitizeArticleBody(html: string): string {
  return filterXSS(html, ARTICLE_BODY_XSS_OPTIONS)
}
