# API Beta Post

Use after live canaries, production monitor and GitHub checks are green.

```text
Nipmod API beta update

The public API is now centered on the agent package flow:

- search package sources
- inspect exact records
- read trust signals
- request install plans
- confirm useful discoveries into the package intelligence archive when authorized

The hosted API does not install packages, execute commands or write into user workspaces. It gives agents the package context they should show before anything local happens.

Current sources:
npm, PyPI, GitHub, Hugging Face and MCP.

Public beta access is free and rate limited. No key is required for the core API calls.

GitHub:
https://github.com/nipmod/nipmod

API:
https://nipmod.com/api-access
```

Short version:

```text
Nipmod API beta update

Agents can now use one public API to search npm, PyPI, GitHub, Hugging Face and MCP, inspect trust signals and request install plans before touching a workspace.

Hosted API calls never install or write locally.

Free public beta, rate limited.

https://nipmod.com/api-access
https://github.com/nipmod/nipmod
```
