# Threat Model

Nipmod assumes package ecosystems contain malicious, compromised, stale and misleading metadata.

The hosted API is designed to help agents make safer package decisions before local execution. It is not a sandbox and it is not a vulnerability scanner replacement.

## Protected Assets

- user workspaces
- source repository integrity
- API keys and archive writer tokens
- package intelligence archive quality
- trust scoring correctness
- install-plan boundaries
- public reputation of source owners

## Main Threats

| Threat | Risk | Control |
| --- | --- | --- |
| Malicious package metadata | README, model card or MCP description tells an agent to ignore instructions. | Treat metadata as untrusted data and scan for agent-targeted instruction text. |
| npm or GitHub lifecycle scripts | Install-time hooks such as `preinstall`, `postinstall`, `prepare`, `prepack` or `prepublishOnly` download and execute payloads. | Detect lifecycle scripts, warn on install-time hooks, block suspicious remote execution behavior. |
| PyPI vulnerable or source-only release | A package exposes known vulnerability records, yanked files, weak digest data or source-only build execution risk. | Treat vulnerability records, yanked files, source-only installs and weak release evidence as negative trust evidence. |
| Hugging Face unsafe model load | Pickle or binary weights, custom Python files, dataset scripts, `trust_remote_code`, gated/private state or missing safetensors increases risk. | Surface file and config warnings; block or warn when source signals are unsafe. |
| Remote shell install command | Install command pipes a remote script into shell. | Mark command high risk and block hosted install plan execution. |
| Secret exfiltration during install | Package scripts read `.env`, `.npmrc`, SSH keys, wallet material, cloud metadata or token environment variables. | Mark the command or local deep-scan finding high risk before any workspace write. |
| Obfuscated execution | Package scripts hide payloads through base64, PowerShell encoded commands, hex escapes, dynamic eval or generated commands. | Mark obfuscated execution patterns high risk and require manual review. |
| Popular compromised package | Downloads, stars or likes make a compromised package look attractive. | Popularity affects ranking only, never install permission. |
| Archive spam | Public callers try to persist junk records. | Durable writes require server-side store configuration and archive writer token. |
| Forged trust in posted records | Caller submits a record with fake score, decision, warnings or install command. | Server reinspects original source before install-plan POST, archive prepare or archive confirm. |
| Sensitive request logging | Raw queries, IPs, user agents or keys leak through usage events. | Store hashed or structured fields only. |

## Non Goals

- Nipmod does not execute untrusted package code.
- Nipmod does not guarantee a package is safe.
- Nipmod does not replace SCA, malware research, sandboxing or enterprise policy engines.
- Nipmod does not delete upstream packages.

## Source-Specific Review

### npm and PyPI

Nipmod checks source metadata, package release information, license, repository link, integrity or digest metadata, dependency and release signals, lifecycle scripts where available and vulnerability signals when returned by the source.

For PyPI, SHA-256 and BLAKE2 release digests count as strong digest evidence. Legacy MD5-only release data is treated as weak evidence.

### Hugging Face

Nipmod checks repository type, owner, license, file list, gated status, safetensors presence for models, binary or pickle weight risk and source metadata that may require review before use.

### GitHub and MCP

Nipmod checks source URL, owner/repo signals, install command risk, package manifests, security files and metadata provenance. MCP descriptions and GitHub README-like content are untrusted input.

## Approval Boundary

Install plans are plans. They do not install.

The hosted API returns:

- command
- source
- package and version
- risk
- warnings
- trust factors
- approval boundary
- whether a workspace write would happen if approved locally

Only the user, host policy, local CLI or local MCP server can execute after approval.
