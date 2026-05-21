# Website Redesign Handoff

Goal: redesign the entire Nipmod website so it feels modern, compact, useful and credible for humans and agents.

This is not a blank marketing site. It is a public product surface, package archive, proof dashboard and agent entrypoint. Preserve the working system and improve the experience.

## Start Here

1. Read `CLAUDE.md`.
2. Read `site/CLAUDE.md`.
3. Read this folder:
   - `site-map.md`
   - `design-brief.md`
4. Inspect the current app:
   - `site/app/page.tsx`
   - `site/app/globals.css`
   - `site/app/content.ts`
   - `site/app/site-header.tsx`
   - `site/app/packages/page.tsx`
   - `site/app/mcp/page.tsx`
   - `site/app/setup/page.tsx`
   - `site/app/platforms/page.tsx`

## What Must Stay True

- Nipmod is live.
- The public registry currently has 28 packages.
- Gitlawb is the first canonical source network.
- GitHub is the public review and mirror surface.
- Codex, Claude Code, OpenCode and Hermes are MCP ready, not official native partnerships.
- Bankr is under review, not native accepted.
- Aeon is candidate only.
- Hosted read-only MCP is live at `https://nipmod.com/api/mcp`.
- The token and Bankr coin links must not be invented into price or revenue promises.

## What Can Change

- Layout, visual hierarchy, card structure, spacing, typography and interaction feel.
- Navigation organization, as long as core links remain reachable.
- Homepage structure and package browsing presentation.
- Page copy, if it remains truthful, short and clear.
- Component structure, if tests remain green.

## What Should Not Change Without Explicit Reason

- Registry JSON schema.
- Readiness JSON schema.
- `.well-known/nipmod.json` schema.
- `llms.txt` core agent instructions.
- Package canonical IDs, digests, proof URLs or trust fields.
- CLI command semantics.
- MCP write boundaries.

## Recommended Redesign Order

1. Update global typography, spacing, color and component primitives in `site/app/globals.css`.
2. Redesign the header and homepage.
3. Redesign `/packages` and package cards/details.
4. Redesign `/setup`, `/mcp`, `/platforms` and `/status`.
5. Clean secondary pages only after the main product flows are stable.
6. Run the full verification list from `CLAUDE.md`.

## New Logo Assets

Use:

```text
site/public/nipmod-logo.png
site/public/nipmod-logo-transparent.png
site/app/icon.png
```

The transparent logo is for favicon and compact UI. The black-background logo is safer for social previews.
