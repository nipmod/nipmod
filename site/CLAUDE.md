# Nipmod Website Guide

The website is a Next.js app using the app router.

Main folder:

```text
site/app
```

Global styles:

```text
site/app/globals.css
```

Layout and navigation:

```text
site/app/layout.tsx
site/app/site-header.tsx
site/app/content.ts
```

Registry data and package helpers:

```text
site/app/registry-data.json
site/lib/registry.ts
site/app/packages/content.ts
site/app/packages/page.tsx
site/app/packages/[packageName]/page.tsx
```

Platform logos and status cards:

```text
site/app/platform-brand.tsx
site/app/platforms/page.tsx
site/public/compatibility/platform-connections.json
site/public/compatibility/platform-readiness.json
```

Machine-readable agent surfaces:

```text
site/public/.well-known/nipmod.json
site/public/llms.txt
site/public/agent-prompts.json
site/app/api/mcp/route.ts
```

Do not redesign these as marketing pages. They are product and proof surfaces. It is fine to make them cleaner, more compact and easier to scan, but preserve the exact facts and workflow boundaries.

## Important Pages

- `/`: main product, live count, platform paths, registry preview.
- `/packages`: full package archive.
- `/packages/[packageName]`: package detail pages with trust/proof/install.
- `/setup`: non-technical agent onboarding.
- `/mcp`: local MCP plus hosted read-only MCP.
- `/platforms`: current platform connection matrix.
- `/status`: public readiness/proof dashboard.
- `/trust`: registry, quorum, transparency and advisory roots.
- `/security`: disclosure and safety policy.
- `/bankr`: prepared Bankr skill path; under review, not native accepted.
- `/package`: self-service package preparation flow for repo owners.

## Design Constraints

- Make the site feel like serious infrastructure, not a landing-page template.
- Keep sections compact and readable.
- Package catalogs should be easy to scan. Cards are okay when dense; row layouts are okay when comparison matters.
- Use the new Nipmod logo assets from `site/public`.
- Avoid decorative gradient blobs, oversized hero text, nested cards and long marketing explanations.
- Keep buttons useful and predictable. No fake CTAs.
- If a button points to setup/docs/packages/source, the destination must exist and be checked by E2E.

## Data Boundaries

Public registry package count and proof data come from:

```text
site/public/registry/packages.json
site/app/registry-data.json
```

The two must stay aligned. Do not hand-edit one without understanding the registry pipeline and running the tests.

The hosted MCP endpoint is live:

```text
https://nipmod.com/api/mcp
```

Remote tools are intentionally limited to:

```text
nipmod.search
nipmod.view
nipmod.inspect
nipmod.install_plan
nipmod.demo
```

Do not expose remote workspace-write tools.
