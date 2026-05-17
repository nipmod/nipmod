# Example

Input:

```text
nipmod.lock.json plus registry evidence.
```

Command:

```bash
nipmod install strict-ci-policy --online
```

Expected output:

```json
{
  "policy": "strict",
  "unverifiedPackages": 0,
  "activeQuarantines": 0,
  "allowed": true
}
```

Bad case:

```json
{
  "allowed": false,
  "reason": "lockfile package digest differs from registry proof"
}
```
