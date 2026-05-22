# Product Direction

This folder documents Nipmod's public product direction.

The direction is:

> Nipmod is the package intelligence API for agents.

Nipmod should help agents find, evaluate and plan package usage across the existing software ecosystem. It should not present itself as a Gitlawb add-on, a generic package mirror, an agent IDE integration collection or a token-first story.

## Product Principles

1. API first.
   The public product is one package intelligence API for agents. CLI and MCP are support surfaces.

2. Multi-source by default.
   npm, PyPI, GitHub, Hugging Face, MCP and future sources remain source owners. Nipmod normalizes, ranks, explains and records package intelligence.

3. Trust is the product.
   Search alone is weak. The durable value is source context, risk signals, fit ranking, install planning, confirmations, receipts and archive memory.

4. GitHub is the public credibility surface.
   GitHub is the primary public repo, review surface, CI surface and developer trust surface.

5. Gitlawb is a supported source, not the foundation.
   Gitlawb-specific workflows can exist, but the company story must not depend on Gitlawb activity or direction.

6. Do not overclaim integrations.
   Say "usable by agents through HTTPS or MCP" unless a platform owner has reviewed, listed or endorsed a native integration.

7. Archive quality beats archive volume.
   Do not fill the archive with unconfirmed junk. Store records only after confirmation, clear qualification or owner claim.

8. Token story follows product usage.
   $NPM can remain part of the ecosystem, but developer-facing product surfaces should lead with utility, trust and API usage.

## Decision Standard

Every major decision must pass this checklist:

- Does this make Nipmod more independent, not more dependent on a single platform?
- Does this improve agent package decisions, not just add more content?
- Does this create durable data or trust advantage?
- Does this reduce friction for agents and developers?
- Does this avoid unproven public claims?
- Does this preserve a clean path to monetization?
- Does this protect current users and production stability?

If a decision fails two or more checks, it needs a stronger argument before shipping.

## Files

- [Product decisions](decisions.md)
- [Market context](market-context.md)
- [Roadmap](roadmap.md)
- [Research notes](research-notes.md)
