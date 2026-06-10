# Nipmod Codex Plugin

Nipmod makes Codex use a pre-install package decision and safety layer before it chooses or changes software dependencies.

## What this plugin does

- Adds a Codex skill for package, SDK, CLI, model, dataset, container, repository, extension and MCP-server selection.
- Connects Codex to the hosted read-only Nipmod MCP endpoint.
- Exposes Codex-specific tools: `nipmod.codex_preflight` and `nipmod.install_guard`.
- Formats package decisions as compact Codex decision cards while keeping full structured evidence available.
- Uses local repo context in Codex first, then sends only a short stack/risk summary to hosted Nipmod.
- Keeps package-manager writes behind explicit approval.

## Required environment

Add the repo marketplace in Codex and install the Nipmod plugin:

```bash
codex plugin marketplace add nipmod/nipmod --ref main
codex plugin add nipmod@nipmod
codex mcp get nipmod --json
```

Start a new Codex session after installing so the MCP tools are loaded.

The hosted MCP server works read-only without a key. The Codex plugin defaults to zero-key MCP so first-run setup does not fail when `NIPMOD_API_KEY` is missing. For higher limits or account-scoped usage, get a Nipmod API key:

```bash
export NIPMOD_API_KEY="$(curl -fsS -X POST https://nipmod.com/api/keys/beta | python3 -c 'import json,sys; print(json.load(sys.stdin)["key"])')"
```

Use that key for direct HTTP API calls or for a manually configured MCP server in an environment where the key is definitely set. Do not add `bearer_token_env_var` to the default Codex plugin config unless `NIPMOD_API_KEY` exists in the environment Codex inherits; Codex treats a missing bearer env var as MCP startup failure. A key is not required for hosted read-only decisions.

## Make Nipmod the Codex default

The plugin makes Nipmod available to Codex and gives Codex a skill that should
trigger before package, SDK, CLI, model, dataset, container, repository,
extension and MCP-server decisions. For stricter repo guidance, copy the public
Codex rule example and agent workflow notes:

```bash
mkdir -p .codex/rules
cp examples/codex-rules/default.rules ./.codex/rules/default.rules
```

Then add the policy text from `examples/agent-workflow/codex.md` to the target
repo's `AGENTS.md` or team instructions.

Important boundary: installing a plugin does not silently force every future
Codex session to use it. A fresh session can choose installed tools based on the
task, and `@nipmod` can invoke it explicitly. Repo/team rules are the stricter
path when a team wants Nipmod as the default dependency decision rule.

## Example prompts

```text
Find the best auth package for this Next.js repo and show the Nipmod install boundary before changing anything.
```

```text
Before installing anything, use Nipmod to choose a safe PDF parser for this Python backend.
```

```text
Use Nipmod to compare MCP servers for documentation search and show the exact approval packet.
```

## Codex behavior

When installed, Codex should invoke Nipmod for package and dependency decisions even when the user does not type `@nipmod`.

The intended flow is:

1. Codex reads safe local manifest context, such as `package.json`, lockfiles, `pyproject.toml`, `go.mod`, `Dockerfile` or `.mcp.json`.
2. Codex calls `nipmod.codex_preflight` with the task, stack, runtime, package manager and risk surface.
3. Nipmod returns the best candidate, trust score, risk level, source evidence, alternatives, approval gate, approval packet, install boundary and receipt.
4. Codex shows the compact decision card first.
5. Codex waits for explicit approval before dependency writes.

## Install guard

If the user asks Codex to run a command such as `pnpm add`, `npm install`, `pip install`, `uv add`, `go get`, `cargo add`, `docker pull`, `git clone` or MCP enablement, Codex should call `nipmod.install_guard` first and show the exact command that would run after approval.

The approval packet should include the command, cwd, package manager, package/version, files expected to change, lifecycle/native/container/MCP risk and whether scripts or sandbox audit should be used before execution.

## Boundaries

The hosted MCP server is read-only. It can search, resolve, inspect and return install plans. It does not install packages, edit files, run package managers, or write to the workspace.

Codex still owns local execution. Nipmod returns the decision and approval
packet; Codex, the user and the host policy decide whether a local write is
allowed.

## Release operations

Plugin versioning, local install/uninstall checks, light/dark icon review and
release-gate commands are maintained in `RELEASE.md`.
