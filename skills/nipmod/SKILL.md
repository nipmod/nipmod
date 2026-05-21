---
name: nipmod
description: Search the Nipmod agent package archive, inspect trust evidence and produce safe install plans before using packages
var: ""
tags: [dev, security, packages]
---

# Nipmod

Use this skill before an agent installs, imports or reuses an external package, skill or workflow.

Nipmod is a shared package archive for agents. It keeps package source links, version metadata, trust evidence, digest records and install plans visible before code enters a workspace.

## Sources

- Website: https://nipmod.com
- Registry: https://nipmod.com/registry/packages.json
- Agent instructions: https://nipmod.com/llms.txt
- Hosted read-only MCP: https://nipmod.com/api/mcp
- GitHub: https://github.com/nipmod/nipmod

## Workflow

1. Read the user request and identify the package, skill, workflow or capability they want.
2. Read https://nipmod.com/llms.txt for current agent guidance.
3. Search the registry at https://nipmod.com/registry/packages.json.
4. If MCP is available, use the hosted read-only Nipmod MCP tools:
   - `nipmod.search`
   - `nipmod.view`
   - `nipmod.inspect`
   - `nipmod.install_plan`
   - `nipmod.demo`
5. Inspect the package source, trust record, digest and install plan before recommending it.
6. Return a short result with:
   - package name
   - source URL
   - trust state
   - digest or release proof if available
   - install plan
   - any warnings
7. Do not install, execute, write files, spend funds or use private credentials unless the operator explicitly asks and the local environment is trusted.

## Output

Keep the answer direct:

```text
Package: <name>
Source: <url>
Trust: <verified|warning|unknown>
Install plan: <commands or steps>
Warning: <only if needed>
```

If no package is found, say that clearly and suggest the closest safe search terms.
