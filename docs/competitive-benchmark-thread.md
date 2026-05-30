# Competitive Benchmark Thread Draft

Use this only after rerunning `pnpm benchmark:competitive` and checking that `/benchmark.json` matches the public page.

## Thread

1/ We ran a public benchmark for the part of package security that matters most for agents:

what an agent knows before it installs a package, pulls a model, reuses a repo or connects an MCP server.

The report is live here:
https://nipmod.com/benchmark

2/ This is not a generic “who is the best security company” chart.

That would be lazy and unfair.

OSV, deps.dev, Socket, Snyk, OpenSSF Scorecard and native registries all solve different parts of the software supply chain problem.

We measured one narrower question: who helps an agent make a better preflight decision before execution.

3/ The comparison set:

- native registries for upstream source metadata
- OSV for known vulnerability lookup
- deps.dev for package metadata, dependency and advisory context
- OpenSSF Scorecard for GitHub repository posture
- Socket through authenticated PURL package lookup
- Snyk through authenticated REST package API access
- a raw agent baseline without an independent package intelligence layer

4/ For context, this is not a small or soft comparison set.

Snyk was reported at a $7.4B valuation after its 2022 Series G.

Socket announced a $60M Series C at a $1B valuation in May 2026.

Google backed infrastructure like OSV and deps.dev is already part of how serious teams reason about open source.

5/ The score does not reward branding, company size or how broad the full platform is.

It scores the hosted API surface available at the agent preflight boundary:

- source resolution
- security evidence
- execution preflight
- agent readiness
- one fixed case for each Nipmod source surface

Machine-readable summary JSON is public at:
https://nipmod.com/benchmark.json

6/ Current public run:

- Nipmod: 95/100
- Native registries: 23/100
- Socket: 16/100
- deps.dev: 14/100
- OSV: 9/100
- Raw agent: 3/100
- OpenSSF Scorecard: 1/100
- Snyk API: 1/100

Nipmod also completed 8/8 live source checks and returned 8/8 read only install plan results.

7/ The most important category is execution preflight.

An agent does not only need to know that a package exists, or that a CVE is listed somewhere.

It needs to know what it is about to do, what source it resolved, what warnings exist, and where the install boundary is before a workspace write happens.

That is where Nipmod scored 100/100 in this run.

8/ The report is strict about what we did not test.

We did not test Snyk’s full platform, Socket Firewall, local CLIs, SCM integrations, install interception, sandbox execution or paid enterprise workflows.

We did not install packages, clone repos, unpack artifacts, execute model files or write to a workspace.

9/ That matters because the claim is narrow.

Nipmod is not saying “we replace OSV, deps.dev, Socket, Snyk or native registries.”

The opposite is true.

Nipmod uses source intelligence from the ecosystem and turns it into an agent ready decision layer before execution.

10/ The honest read:

the big tools are strong evidence sources.

Nipmod is stronger at the agent boundary we are building for: search, inspect, trust signals, warnings and a reviewable install plan in one API flow.

That is the layer agents need before they start touching code.

11/ We are publishing this early because we want the standard to get harder.

Send us the ugly cases.

Malicious packages, confusing names, weak metadata, suspicious install behavior, model reuse risks, MCP server ambiguity.

If an agent might touch it, Nipmod should learn how to inspect it better.

12/ Full benchmark:
https://nipmod.com/benchmark

Machine-readable summary JSON:
https://nipmod.com/benchmark.json

GitHub:
https://github.com/nipmod/nipmod

Nipmod is the package intelligence layer for AI agents. The work now is to keep proving it against real agent workflows.
