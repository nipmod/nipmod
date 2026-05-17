# Release Posting

Nipmod posts public updates only when the update changes what users or agents can do.

## When to post

- Major releases, including `v1.0.0`.
- Minor releases with new package, registry, CLI, MCP, audit or trust capabilities.
- Security releases that affect install, audit, advisories, signatures or registry trust.

Patch releases do not need a public post unless they fix security, install reliability or production availability.

## `v1.2.0` Verified Claim Index post

```text
Nipmod v1.2.0 ships verified Package Claim.

Registry presence is no longer treated as ownership.

Nipmod now checks Gitlawb repos for signed claim proofs:

nipmod claim verify gitlawb://did:key:.../repo --json
nipmod claim index --node https://node.nipmod.com --json
nipmod package pr gitlawb://did:key:.../repo --dir repo-pr

Published means installable.
Claimed means the Gitlawb owner DID signed and pushed proof.
```

## `v1.1.0` Package Claim post

```text
Nipmod v1.1.0 ships Package Claim.

Turn a public Gitlawb repo into an installable agent package:

nipmod package scan
nipmod package doctor gitlawb://did:key:.../repo
nipmod claim gitlawb://did:key:.../repo

Gitlawb repos are source.
Nipmod makes them packages.
```

## First `v1.0.0` post

```text
Nipmod v1.0.0 is live.

Gitlawb gives agents decentralized source.
Nipmod gives them packages they can verify.

Search, inspect, install and audit signed agent packages from Gitlawb.

https://nipmod.com
Source: https://gitlawb.com/node/repos/z6Mkwbud/nipmod
```

## First reply

```text
For agents:

curl -fsSLO https://nipmod.com/install.sh && bash install.sh
nipmod search gitlawb --online
nipmod inspect <package>
nipmod install <package>
nipmod audit --online
```
