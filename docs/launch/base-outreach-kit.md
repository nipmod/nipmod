# Base outreach kit

Use these as starting points. Keep the wording honest until Base confirms a listing or partnership.

## Base ecosystem DM

Hey, saw the Base MCP launch and wanted to share what we are building around it.

Nipmod is a read-only package preflight for agents. Before an agent installs or enables a Base SDK, CLI, MCP server, package or repo, it can use Nipmod to search sources, inspect trust signals and get a safe install plan.

The fit I see is simple: Base MCP helps agents act onchain, Nipmod helps agents decide which tools to trust before they act.

We published the Base agent preflight path here:
https://nipmod.com/base-agents

And the machine-readable spec here:
https://nipmod.com/base-agent-preflight.json

No big ask yet. If this is relevant for your side, I would be happy to send a short integration outline.

## Partner with SDK or MCP surface

Hey, quick one.

I think there is a clean agent-discovery angle between your tooling and Nipmod.

If your SDK, CLI, MCP server or package is meant to be used by agents, Nipmod can make it easier for agents to find it, inspect the source context and understand the install boundary before touching a workspace.

We can prepare the first read-only listing/integration outline on our side, link everything back to your official docs and repo, then you tell us what naming or structure you prefer.

Base agent preflight:
https://nipmod.com/base-agents

GitHub:
https://github.com/nipmod/nipmod

## Reply when someone asks if this is official Base

Not yet. We are not claiming an official Base listing.

We built the Base agent preflight path because Base MCP makes the need very clear: agents can act onchain, so they also need a clean way to inspect external tooling before they install or enable it.

That is the layer Nipmod is working on.
