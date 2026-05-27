# Agent Package Intelligence Benchmark

This benchmark is for one question:

What does an AI agent know before it installs, pulls or reuses external code?

It is not a malware-free claim and not a generic company ranking. OSV, deps.dev, Socket, Snyk, OpenSSF Scorecard and native registries solve different parts of the supply-chain problem. Nipmod is measured at the agent decision point: search, inspect, trust evidence and install-plan review before a workspace write.

Run:

```bash
pnpm benchmark:competitive
```

Run without the live Nipmod production track:

```bash
pnpm benchmark:competitive -- --no-live
```

## Tracks

The report separates the systems by dimension instead of forcing a fake universal winner.

| Track | Measures |
| --- | --- |
| Nipmod | Search, inspect, source evidence, warnings, install plan, read-only boundary and agent JSON. |
| Native registries | Source-of-truth metadata from npm, PyPI, GitHub, Hugging Face and MCP. |
| OSV | Vulnerability lookup for package/version pairs. |
| deps.dev | Package metadata, licenses, advisories and provenance links where available. |
| Socket | Authenticated PURL package lookup and alert surface when a token is configured. |
| Snyk | Authenticated Snyk API availability and package endpoint depth when the token/plan allows it. |
| OpenSSF Scorecard | GitHub repository security posture. |
| Surplus Intelligence | Agent marketplace/model catalog and cost-market context, not package safety. |
| Raw agent | Baseline for direct install/pull behavior without a package intelligence layer. |

## Scoring Boundary

The score is `agent package-decision depth`, not total security quality.

Weighted dimensions include:

- identity
- version
- metadata
- advisory
- provenance
- repository posture
- package behavior
- prompt boundary
- install plan
- read-only boundary
- machine-readable output
- agent JSON
- multi-source coverage
- cost-market context

This favors systems that help an agent make a pre-install decision. That is intentional. It does not say a vulnerability database, registry, marketplace or repository scanner is bad because it does not return an install plan.

## Publishing Rules

Public claims must follow the report.

Do not publish:

- "Nipmod is safer than every competitor."
- "Nipmod guarantees package safety."
- "Nipmod replaces OSV, deps.dev, Socket, Snyk, OpenSSF or native registries."

Acceptable framing:

- "Nipmod is built for the moment before an agent installs or reuses external code."
- "The benchmark separates vulnerability data, registry metadata, repository posture and agent install-plan readiness."
- "Nipmod's strongest tested dimension is agent preflight: search, inspect, warnings and read-only install-plan output in one API flow."

## Credential Boundary

Optional credentials are read from local files under `~/.config/nipmod/` or from environment variables.

For repeated live Nipmod runs, use a reusable internal benchmark key through `NIPMOD_BENCHMARK_API_KEY`. The benchmark can fall back to self-service beta key issuing, but that endpoint is intentionally rate limited and should not be part of a serious repeated comparison run.

The benchmark must not print raw API keys, wallet secrets, private keys, seed phrases, Supabase service-role keys or provider tokens. It also does not run package installs, clone repositories, unpack artifacts, execute model files or make paid inference calls.

## Article Use

The generated `articleDraft` field is a draft only. Before publishing, rerun the live benchmark, review the observations, remove internal-only limitations and make sure every number in the article appears in the current JSON report.
