# Example

Input:

```text
gitlawb://did:key:z6Mk.../nipmod
```

Command:

```bash
nipmod install gitlawb-repo-reader --online
```

Expected output:

```json
{
  "repo": "nipmod",
  "source": "gitlawb",
  "signals": ["readme", "package manifest", "recent commits"],
  "risk": "low",
  "nextAction": "inspect release proof before install"
}
```

Bad case:

```json
{
  "risk": "review",
  "reason": "moving branch without source commit proof"
}
```
