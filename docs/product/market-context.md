# Market Context

Nipmod sits between package sources, agent hosts and security tooling.

## Source Ecosystems

| Ecosystem | What it owns | Nipmod posture |
|---|---|---|
| npm | JavaScript package registry and install metadata | Resolve, inspect, score and plan. Do not mirror by default. |
| PyPI | Python package registry and release metadata | Resolve, inspect, score and plan. Do not mirror by default. |
| GitHub | Source repos, public review, stars, issues and CI signals | Treat as source and credibility metadata. Keep Nipmod's own public repo here. |
| Hugging Face | Models, datasets and Spaces | Resolve model and dataset records, then score for agent usability and risk. |
| MCP Registry | Public MCP server metadata | Resolve tool servers, but add security and install context that registries do not fully provide. |
| Gitlawb | Decentralized source network | Supported source only. Not the company foundation. |

## Competitive Categories

### Package registries

npm, PyPI, GitHub, Hugging Face and MCP registries are not direct enemies. They are source networks. Nipmod should make them more useful to agents through one normalized decision layer.

Risk:
Native registries can add their own agent metadata and safety signals.

Counter:
Nipmod must stay multi-source and agent-facing. No single registry can be neutral across all sources.

### Supply-chain security platforms

Socket, Snyk and Sonatype are closer to adjacent competitors. They focus on dependency risk, malware, vulnerabilities, license issues and policy enforcement.

Risk:
They already have mature security intelligence and enterprise trust.

Counter:
Nipmod's wedge is not "SCA for humans". It is package choice and install planning for agents before workspace changes. Security is one pillar, not the whole product.

### Agent platforms and IDEs

Codex, Claude Code, Cursor, Hermes, OpenCode and other agent hosts can expose package search or MCP tools directly.

Risk:
Agent hosts can build simple package lookup inside the product.

Counter:
Nipmod should be a neutral external package decision API with cross-source memory. Host-native lookup will usually be limited to that host's UX and current context.

### MCP directories

MCP directories help users discover MCP servers.

Risk:
They can become default discovery points for agent tools.

Counter:
Nipmod should support MCP as one source type, but its broader value is package intelligence across packages, repos, models, datasets, tools and workflows.

## Product White Space

The strongest market position is:

> one agent-facing API that searches package sources, ranks candidates, explains trust, creates safe install plans and remembers useful confirmed records.

This is different from:

- a normal package registry
- a source host
- a security scanner only
- an MCP directory only
- an agent IDE plugin only

## Reference Sources

- npm registry docs: https://docs.npmjs.com/cli/v11/using-npm/registry
- PyPI stats: https://pypi.org/stats/
- Hugging Face Hub docs: https://huggingface.co/docs/hub/main/en/index
- MCP Registry: https://modelcontextprotocol.io/registry/about
- Socket package scoring and firewall docs: https://docs.socket.dev/
- Snyk Open Source docs: https://docs.snyk.io/scan-with-snyk/snyk-open-source
- Sonatype Repository Firewall: https://www.sonatype.com/products/sonatype-repository-firewall
