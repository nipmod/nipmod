# Example

Input:

```text
pkg:did:key:z6Mk.../agent-tool@0.1.0
```

Command:

```bash
nipmod install gitlawb-release-review --online
```

Expected output:

```json
{
  "release": "0.1.0",
  "tagImmutable": true,
  "releaseEventSigned": true,
  "sourceCommitPinned": true,
  "registryReady": true
}
```

Bad case:

```json
{
  "registryReady": false,
  "reason": "release event does not bind the source commit"
}
```
