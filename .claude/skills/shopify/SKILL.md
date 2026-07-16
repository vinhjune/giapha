---
name: ck:shopify
description: Build Shopify apps, extensions, and themes with Shopify CLI, GraphQL Admin API, Polaris UI, Liquid, webhooks, billing, and app configuration workflows.
user-invocable: true
when_to_use: "Invoke for Shopify apps, themes, extensions, or billing."
category: frameworks
keywords: [shopify, polaris, liquid, checkout]
argument-hint: "[extension-type] [feature]"
metadata:
  author: claudekit
  version: "1.1.0"
---

# Shopify Development

Build Shopify apps, extensions, themes, and API integrations with current Shopify CLI workflows and GraphQL-first Admin API guidance.

## Platform Overview

**Core Components:**
- **Shopify CLI** - Official app, extension, and theme workflow tool
- **GraphQL Admin API** - Default API for new app data operations
- **REST Admin API** - Legacy/migration-only for new development
- **Polaris UI** - Merchant-facing design system
- **Liquid** - Theme template language

New public apps created after 2025-04-01 must use the GraphQL Admin API. Use REST only for legacy maintenance or migration work.

**Extension Points:**
- Checkout UI - Customize checkout and thank-you surfaces
- Admin UI - Extend admin resource pages
- POS UI - Point of Sale customization
- Customer Account - Account and order status pages
- Theme App Extensions - Embedded storefront functionality
- Shopify Functions - Discount, delivery, payment, and validation logic

## Quick Start

### Prerequisites

```bash
npm install -g @shopify/cli@latest
shopify version
```

### App Workflow

```bash
# Create an app from official Shopify templates
shopify app init
cd my-app

# Link/select the app configuration used by this checkout
shopify app config link
shopify app config use

# Start local development against the selected config/store
shopify app dev

# Generate an extension (interactive picker selects the type)
shopify app generate extension

# Release Shopify-managed app config and extensions
shopify app deploy
```

`shopify app deploy` deploys Shopify-managed app configuration and extensions. Deploy your hosted web app/server separately on your hosting platform.

### Theme Workflow

```bash
shopify theme init
shopify theme dev
shopify theme pull --live
shopify theme push --development
```

## Development Workflow

### 1. App Development

Configure scopes in `shopify.app.toml`:

```toml
[access_scopes]
scopes = "read_products,write_products,read_orders"
```

Use `shopify app dev` for local development. Use `shopify app deploy` when production/global app configuration or Shopify-managed extensions must be released.

### 2. Extension Development

Common extension types (select via the interactive picker; UI extensions use Preact + web components):
- Checkout UI
- Admin Action / Admin Block
- POS UI
- Customer Account UI
- Function

```bash
shopify app generate extension
shopify app dev
shopify app deploy
```

### 3. Theme Development

```bash
shopify theme init
shopify theme dev
shopify theme push --development
shopify theme publish --theme=123
```

## When to Build What

### Build an App When
- Integrating external services
- Managing store data programmatically
- Building merchant-facing admin tools
- Implementing complex backend logic
- Charging for functionality

### Build an Extension When
- Customizing checkout, admin, POS, or customer-account surfaces
- Adding theme app blocks/snippets to storefronts
- Implementing Shopify Functions for discounts, delivery, payment, or validation

### Build a Theme When
- Creating or customizing storefront presentation
- Building product, collection, cart, or content page layouts
- Implementing brand-specific Liquid sections and snippets

## Essential Patterns

### GraphQL Product Query

```graphql
query GetProducts($first: Int!, $after: String) {
  products(first: $first, after: $after) {
    edges {
      cursor
      node {
        id
        title
        handle
        status
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}
```

### Liquid Product Display

```liquid
{% for product in collection.products %}
  <div class="product-card">
    {{ product.featured_image | image_url: width: 450 | image_tag: alt: product.title }}
    <h3>{{ product.title }}</h3>
    <p>{{ product.price | money }}</p>
    <a href="{{ product.url }}">View Details</a>
  </div>
{% endfor %}
```

## Troubleshooting

**GraphQL throttling:** inspect `extensions.cost.throttleStatus` for `currentlyAvailable`, `maximumAvailable`, and `restoreRate`. Retry only after enough cost budget is restored; reduce requested fields and page sizes when possible.

**API versions:** reusable snippets should use `{api_version}` unless showing a concrete tested config. Latest stable as of 2026-06-12 is `2026-04`; review Shopify API versions quarterly. Check `X-Shopify-API-Version` in responses to detect fall-forward behavior.

**Deploy confusion:** `shopify app deploy` does not publish your hosted app code. Run your hosting provider deploy separately.

## Official Docs

- Apps: https://shopify.dev/docs/apps
- GraphQL Admin API: https://shopify.dev/docs/api/admin-graphql
- Shopify CLI: https://shopify.dev/docs/api/shopify-cli
- Polaris (web components): https://shopify.dev/docs/api/app-home/polaris-web-components
- Themes & Liquid: https://shopify.dev/docs/themes · https://shopify.dev/docs/api/liquid
- Functions: https://shopify.dev/docs/apps/build/functions

## References

- `references/app-development.md` - GraphQL Admin API, webhooks, billing, metafields, rate limits
- `references/embedded-apps.md` - Embedded app auth: managed install, App Bridge v4, session tokens, token exchange, official libraries
- `references/extensions.md` - UI extensions (Preact + web components) and Shopify Functions
- `references/themes.md` - Liquid theme development
- `scripts/shopify_init.py` - Thin wrapper around official Shopify CLI commands
