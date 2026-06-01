# Agent Package Intelligence Benchmark

This benchmark asks one narrow question:

What does an AI agent know before it installs, pulls or reuses external software?

It is not a malware-free guarantee and not a generic company ranking. Vulnerability feeds, package registries and repository scanners solve different parts of the supply-chain problem. Nipmod is measured at the agent decision point: search, inspect, trust evidence, install-plan review, sandbox-audit receipt binding and approval boundary before a workspace write.

## Public Boundary

Nipmod's public benchmark is scoped to hosted, read-only preflight behavior.

The hosted API does not install packages, clone repositories, unpack artifacts, execute code, run models or write to caller workspaces.

Local sandbox audit and runtime receipts are separate host-controlled steps. They are used to bind a local audit to the exact package decision, content hash and sandbox policy.

## Tracks

| Track | Measures |
| --- | --- |
| Nipmod | Search, inspect, warnings, source evidence, install plan, package-decision readiness, sandbox receipt contract and agent JSON. |
| Native registries | Source-owned metadata from package registries, GitHub, Hugging Face and MCP sources. |
| OSV | Vulnerability lookup for package/version pairs. |
| deps.dev | Package metadata, licenses, advisories and provenance links where supported. |
| Socket | Authenticated package lookup and alert surface when configured. |
| Snyk | Authenticated package API availability and package endpoint depth when configured. |
| OpenSSF Scorecard | GitHub repository security posture. |
| Raw agent | Baseline for direct install or pull behavior without a package intelligence layer. |

Project scanners, update bots and install firewalls can be useful, but they operate on manifests, local projects or install interception. They are not the same boundary as a hosted pre-install decision API.

## Categories

| Category | Measures |
| --- | --- |
| Source resolution | Search, identity, version, metadata, source depth and multi-source scope. |
| Security evidence | Advisories, provenance, repository posture, metadata and package behavior. |
| Execution preflight | Install plan, read-only boundary, sandbox receipt contract, package behavior and prompt boundary. |
| Agent readiness | Structured decision JSON, risks, alternatives, install boundary, receipt fields and approval state. |

## Case Set

The current benchmark uses public package, repository, model, dataset and MCP examples so the sample is visible before interpreting the score.

| Case | Source | Example object |
| --- | --- | --- |
| TypeScript schema validation | npm | `zod` |
| Known vulnerable npm package | npm | `lodash` |
| Python HTTP client | PyPI | `requests` |
| Python schema validation | PyPI | `pydantic` |
| Embedding model | Hugging Face model | `sentence-transformers/all-MiniLM-L6-v2` |
| Question answering dataset | Hugging Face dataset | `rajpurkar/squad` |
| MCP docs server | MCP | `ac.tandem/docs-mcp` |
| GitHub repository posture | GitHub | `vercel/next.js` |

## Claim Limits

Do not claim:

- Nipmod guarantees package safety.
- Nipmod replaces OSV, deps.dev, Socket, Snyk, OpenSSF or native registries.
- A hosted preflight score proves runtime behavior.
- A public benchmark authored by Nipmod is independent scientific proof.

Acceptable framing:

- Nipmod is built for the moment before an agent installs or reuses external code.
- The benchmark separates vulnerability data, registry metadata, repository posture and agent install-plan readiness.
- Nipmod's tested strength is agent preflight: search, inspect, warnings and read-only install-plan output in one API flow.

## Machine Report

The current machine-readable report is published at:

```text
https://nipmod.com/benchmark.json
```

