# Example

Input:

```text
nipmod.lock.json
```

Command:

```bash
nipmod add dependency-risk-review --online
```

Expected output:

```json
{
  "dependencies": 3,
  "networkPermissions": 0,
  "execPermissions": 0,
  "risk": "low"
}
```

Bad case:

```json
{
  "risk": "high",
  "reason": "package requests network and shell execution without proof"
}
```
