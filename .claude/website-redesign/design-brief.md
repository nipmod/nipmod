# Design Brief

## Target Feel

Nipmod should feel like agent infrastructure: calm, technical, sharp and useful. It should not feel like a generic AI landing page.

Good direction:

- Dense but comfortable.
- Clear status and proof surfaces.
- Strong archive browsing.
- Fast route-to-action: search, inspect, setup, MCP, status.
- Subtle motion only where it helps orientation.
- Strong logo presence, but not oversized everywhere.

Avoid:

- Huge generic hero sections.
- Long marketing copy.
- One-color purple/blue gradient themes.
- Decorative blobs or fake depth.
- Cards inside cards.
- Buttons that look important but do not do useful work.
- Claims that sound bigger than the proof.

## Homepage Priorities

A first-time visitor should understand quickly:

1. Nipmod is a package archive/layer for agents.
2. There is a live package archive.
3. Agents can search, inspect and plan safely.
4. Local MCP gives controlled workspace tools.
5. Hosted MCP gives read-only archive access.
6. Gitlawb is the first source network.

Keep the homepage practical. It should feel more like a product console than a pitch deck.

## Package Archive Priorities

The package archive must be pleasant to scan.

Each package surface should make these obvious:

- Name
- Description
- Type
- Trust level
- Quorum/proof status
- Install or inspect command
- Source link

Do not hide proof data behind decorative UI. Make it readable.

## Setup and MCP Priorities

Setup must work for non-technical users:

- Install command is obvious.
- Agent setup choices are clear.
- Remote read-only MCP is clearly separate from local write-capable MCP.
- No wallet, token or payment wording in core package setup.

## Copy Style

Use short sentences.

Allowed tone:

```text
Search the archive.
Inspect trust.
Plan before install.
Write only after approval.
```

Avoid:

```text
the next step is simple
idea is simple
this is exactly where it fits
unlock the future
revolutionary
game changing
```

## Visual QA

Check at least:

- Desktop width around 1440.
- Tablet width around 900.
- Mobile width 390.
- Header overflow.
- Package cards and package list density.
- Long package names.
- Command blocks.
- Buttons and links.
- Live status and platform status chips.

Run Playwright after changes.
