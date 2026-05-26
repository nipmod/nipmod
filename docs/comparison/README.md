# Comparison

Nipmod is not trying to replace package registries.

It operates above them as an agent-readable package intelligence layer.

## Category

| Product Type | Primary Job | Nipmod Relationship |
| --- | --- | --- |
| npm, PyPI | Host and distribute packages. | Source ecosystems. Nipmod reads metadata and returns agent plans. |
| Hugging Face | Host models and datasets. | Source ecosystem. Nipmod reads metadata and flags model/data risk. |
| GitHub | Host source repositories and project metadata. | Source and public review surface. |
| MCP registries | List MCP servers and tool metadata. | Source ecosystem for agent tool discovery. |
| SCA tools | Vulnerability, license and dependency risk management. | Adjacent. Nipmod should consume available signals, not pretend to replace mature SCA. |
| Agent IDEs | Execute tasks in workspaces. | Consumers. Agents can call Nipmod before selecting packages. |

## Difference

Nipmod focuses on the pre-install decision an agent needs:

- search across sources
- inspect exact package records
- expose trust factors
- separate popularity from security
- generate safe install plans
- preserve approval boundary
- store confirmed package intelligence after useful discovery

## Limitations

Nipmod is a free key-required beta.

Current limitations:

- source APIs can be degraded or rate limited
- trust scores are review context, not safety guarantees
- malware detection is signal-based, not complete
- external package ownership remains with upstream sources
- durable archive writes are gated and not open to public spam
- private package sources are not part of the beta

## Standard Claim

Use this sentence when comparing Nipmod to registries:

> Nipmod does not replace package registries. Nipmod makes existing package ecosystems readable and safer for AI agents.
