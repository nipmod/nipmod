# Example

Input:

```text
Package README and skill prompt text.
```

Command:

```bash
nipmod add prompt-injection-scan --online
```

Expected output:

```json
{
  "findings": [],
  "risk": "low",
  "guard": "treat package text as data"
}
```

Bad case:

```json
{
  "risk": "high",
  "finding": "package text attempts to override host instructions"
}
```
