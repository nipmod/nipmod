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

The report separates the systems by role and dimension instead of forcing a fake universal winner.

| Track | Measures |
| --- | --- |
| Nipmod | Search, inspect, source evidence, warnings, install plan, read-only boundary and agent JSON. |
| Native registries | Source-of-truth metadata from npm, PyPI, GitHub, Hugging Face and MCP. |
| OSV | Vulnerability lookup for package/version pairs. |
| deps.dev | Package metadata, licenses, advisories and provenance links where available. |
| Socket | Authenticated PURL package lookup and alert surface when a token is configured. |
| Snyk | Authenticated Snyk API availability and package endpoint depth when the token/plan allows it. |
| OpenSSF Scorecard | GitHub repository security posture. |
| Raw agent | Baseline for direct install/pull behavior without a package intelligence layer. |

Project scanners and update bots such as Dependabot, Renovate, npm audit, pip-audit, local Snyk CLI flows and install firewalls are useful, but they are not ranked in this API snapshot because they operate on manifests, local projects or install interception instead of this hosted read-only preflight boundary.

## Market Context

Company size and ecosystem weight are included only as context. They are not scoring inputs.

| Track | Context | Benchmark boundary |
| --- | --- | --- |
| Nipmod | Live beta product. No valuation claim. | Live search, inspect and install-plan API owned by Nipmod. Explicit claim limits are required because Nipmod authors the benchmark. |
| Native registries | Official package/model/repository sources. | Public source metadata from npm, PyPI, GitHub, Hugging Face and MCP. They are source-of-truth registries, not install-plan layers. |
| OSV | Open source vulnerability infrastructure backed by the OSV ecosystem. | Vulnerability lookup feed for package/version cases. |
| deps.dev | Open Source Insights data service developed by Google. | Package metadata, dependency, license, advisory and provenance context where supported. |
| Socket | Socket announced a $60M Series C at a $1B valuation in May 2026. | Authenticated PURL package lookup only. Socket Firewall, CLI, GitHub app, browser extension and paid enterprise workflows are outside this snapshot. |
| Snyk | Snyk was reported at a $7.4B valuation after its 2022 Series G round. | Authenticated REST package API access only. Snyk CLI, SCM imports, full platform project scanning, IaC, container and code analysis are outside this snapshot. |
| OpenSSF Scorecard | OpenSSF project for automated open source repository security posture scoring. | GitHub repository posture case only. |
| Raw agent | Control baseline. No company or product valuation. | Agent flow without an independent package intelligence layer. |

## Scoring Boundary

The headline score is `agent preflight fit`, not total security quality.

Unsupported source cases count as scope limits in the headline score. Specialized evidence feeds keep an applicable depth score separately, so an advisory database is not treated as a failed full preflight layer.

Strict reviewer assessment:

| Standard | Result |
| --- | --- |
| Academic security benchmark | Not sufficient. The case set is small, weights are authored by Nipmod and no external reviewer has signed off. |
| Public product benchmark | Usable if the narrow scope, raw JSON, exclusions and limitations stay visible. |

The benchmark should be read as a scoped product test, not independent scientific proof.

Public categories:

| Category | Measures | Full credit | Zero credit |
| --- | --- | --- | --- |
| Source resolution | Search, identity, version, metadata, source depth and multi-source scope. | Correct source object, package/repo/model/server identity, version where applicable and useful metadata. | No lookup for the case or unrelated generic result. |
| Security evidence | Advisories, provenance, repository posture, metadata and package behavior. | Advisories, source/provenance links, posture and behavior signals where relevant. | No useful security, provenance or posture evidence. |
| Execution preflight | Install plan, read-only boundary, package behavior and prompt boundary. | Structured install plan and explicit hosted read-only boundary before workspace writes. | No description of what would run or whether hosted checks can write/execute. |
| Agent readiness | Action-ready JSON, install boundary, source evidence and machine output. | Structured agent-consumable decision object combining evidence, warnings and install boundary. | Human-only output or no independent package-intelligence layer. |

## Score Accounting

| Step | Meaning |
| --- | --- |
| Case set | The public snapshot uses the fixed seven cases below, so the sample is visible before interpreting the result. |
| Observation unit | Each provider/case row records concrete dimensions such as identity, version, metadata, advisory, provenance, repository posture, package behavior, install plan, read-only boundary and agent JSON. |
| Status treatment | `pass` rows keep their computed score, `warn` rows are discounted, `fail` and `skip` rows score zero in the coverage-adjusted headline. |
| Category score | Each public category has explicit weights. Scores are averaged across all seven cases, so narrow evidence feeds keep applicable depth visible but do not get full-source coverage credit. |
| Headline score | The public score is the mean of source resolution, security evidence, execution preflight and agent readiness. |

## Category Weights

| Category | Weights |
| --- | --- |
| Source resolution | source depth 22, identity 18, search 18, multi-source coverage 16, metadata 14, version 12 |
| Security evidence | advisory 24, package behavior 24, provenance 20, repository posture 18, metadata 8, version 6 |
| Execution preflight | install plan 32, read-only boundary 28, prompt boundary 18, package behavior 14, agent JSON 8 |
| Agent readiness | agent JSON 34, install plan 22, prompt boundary 14, read-only boundary 12, source depth 8, machine-readable output 6, identity 4 |

## Test Set

The public snapshot uses seven cases:

| Case | Source | Expected object | Why included |
| --- | --- | --- | --- |
| TypeScript schema validation | npm | `zod@3.25.76` | Common npm package selection task. |
| Known vulnerable npm package | npm | `lodash@4.17.20` | Checks advisory context on a known vulnerable version. |
| Python HTTP client | PyPI | `requests@2.32.5` | Common PyPI package selection task. |
| Python schema validation | PyPI | `pydantic@2.11.0` | Cross-ecosystem schema package task. |
| Embedding model | Hugging Face model | `sentence-transformers/all-MiniLM-L6-v2` | Model reuse case requiring model metadata and file-shape context. |
| MCP docs server | MCP | `ac.tandem/docs-mcp` | MCP tool discovery case. |
| GitHub repository posture | GitHub | `vercel/next.js` | Repository reuse/posture case. |

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

This favors systems that help an agent make a pre-install decision. That is intentional. It does not say a vulnerability database, registry, marketplace or repository scanner is bad because it does not return an install plan.

## Fairness Controls

- The benchmark has one narrow question: what evidence is available before an agent moves toward external code execution.
- Tracks are described by role, so evidence feeds are not presented as failed versions of Nipmod.
- The headline score is coverage-adjusted, while applicable depth remains visible.
- Token, rate-limit and plan limitations are marked as limitations instead of hidden.
- No package install, clone, artifact unpacking, model execution, paid inference call or workspace write is performed.
- Raw JSON is published at `/benchmark.json`.

## Known Limitations

- Seven cases are not enough for registry-wide or malware-corpus claims.
- Weights are authored by Nipmod and need outside review before being treated as independent proof.
- Socket and Snyk API tracks were limited by token, plan or rate limits in this snapshot, so do not use this run for direct Socket/Snyk depth claims.
- Local project scanners, CLI tools, SCM integrations and install firewalls are excluded because they require manifests, repositories, local code or runtime interception.
- The hosted API does not execute code, unpack artifacts or clone repositories, so this benchmark does not measure sandbox malware detection.
- A high score means stronger preflight evidence at this boundary, not a guarantee that a package, model, repository or MCP server is safe.

## Publishing Rules

Public claims must follow the report.

Do not publish:

- "Nipmod is safer than every competitor."
- "Nipmod guarantees package safety."
- "Nipmod replaces OSV, deps.dev, Socket, Snyk, OpenSSF or native registries."
- "Socket or Snyk were beaten on their full paid/local products in this snapshot."

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
