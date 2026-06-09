# Nipmod Codex Plugin

Nipmod makes Codex use a package decision layer before it installs software.

## What this plugin does

- Adds a Codex skill for package, model, container, repository and MCP-server selection.
- Connects Codex to the hosted read-only Nipmod MCP endpoint.
- Formats recommendations as compact decision cards in the Codex chat.
- Keeps package manager writes behind explicit approval.

## Required environment

Add the repo marketplace in Codex, install the Nipmod plugin, then set a key:

```bash
codex plugin marketplace add nipmod/nipmod --ref main
```

Set a Nipmod API key before using the remote MCP server:

```bash
export NIPMOD_API_KEY=<key>
```

The plugin sends it as `x-nipmod-api-key` to `https://nipmod.com/api/mcp`.

## Example prompts

```text
@nipmod find the best package for auth in a Next.js app.
```

```text
Use Nipmod before installing anything. I need a safe PDF parser for a Python backend.
```

```text
Use Nipmod to compare MCP servers for documentation search and show the install boundary.
```

## Boundaries

The hosted MCP server is read-only. It can search, resolve, inspect and return install plans. It does not install packages, edit files, run package managers, or write to the workspace.
