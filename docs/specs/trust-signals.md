# Trust Signals Spec

Status: implemented baseline, expanding

Nipmod trust signals are designed for agents that need to decide whether a package is worth showing to a user before install.

Trust signals are not a guarantee that a package is safe.

## Current Output

Every external package record includes:

```json
{
  "trust": {
    "checkedAt": "2026-05-22T00:00:00.000Z",
    "decision": "recommended",
    "risk": "low",
    "score": 82,
    "signals": [],
    "warnings": []
  }
}
```

## Decision Values

| Value | Meaning |
| --- | --- |
| `recommended` | Strong enough metadata to recommend review and install planning. |
| `usable_with_warning` | The package may be useful but has missing metadata or weaker signals. |
| `avoid` | Source metadata indicates known insecurity or vulnerabilities. |
| `unknown` | Not enough signal to recommend. |

## Risk Values

| Value | Meaning |
| --- | --- |
| `low` | Good public metadata and no known source warnings. |
| `medium` | Usable but weaker metadata or missing signals. |
| `high` | Source reports vulnerability or insecurity. |
| `unknown` | Not enough signal. |

## Signal Classes

Current baseline:

- source record exists
- license metadata exists
- source repository exists
- vulnerability records from sources that expose them
- popularity metrics when available
- recency when available

Planned enrichment:

- maintainer continuity
- release cadence
- provenance or trusted publishing signals
- known malware advisories
- dependency risk
- abandoned package detection
- typosquat similarity
- install script risk
- binary artifact risk
- model/dataset card quality

## Agent Rule

Agents must not treat a `recommended` decision as permission to execute code.

The correct flow is:

1. Search.
2. Inspect.
3. Show trust signals.
4. Show install plan.
5. Ask user approval.
6. Execute only through the chosen local package manager or controlled local tool.
7. Save a receipt.
