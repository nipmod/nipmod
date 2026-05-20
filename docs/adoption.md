# Adoption

Nipmod adoption is measured by real setup, inspect, package install, restore, audit and publish dry run evidence. Do not claim adoption from page views alone.

## First 100 User Loop

Ask each user to run:

```bash
curl -fsSLO https://nipmod.com/install.sh && bash install.sh
nipmod doctor --online
nipmod search gitlawb
nipmod inspect pkg:did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader@0.1.0
mkdir -p nipmod-demo
cd nipmod-demo
nipmod install gitlawb-repo-reader
nipmod install
nipmod audit --online
nipmod ci --online
```

Ask package authors to run:

```bash
nipmod init --name gitlawb-demo-package --dir gitlawb-demo-package
cd gitlawb-demo-package
nipmod manifest validate --dir .
nipmod publish . --dry-run --json
```

Ask Gitlawb repo owners to run the package patch preview separately. The final dry run needs their matching DID identity.

```bash
nipmod package pr gitlawb://did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader --dir gitlawb-repo-reader-pr
nipmod claim verify gitlawb://did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader --json
```

For founder review, send `docs/public-launch-packet.md` plus the live `/launch` page instead of a vague product description.

## Evidence To Collect

- terminal output with secrets removed
- OS, Node.js, pnpm and Git versions
- whether `nipmod doctor` passed
- package inspected or added
- dry run registry candidate for authors
- failure message if anything blocked
- permission to quote the result anonymously
- which persona ran it: user, package author, reviewer or Gitlawb maintainer

## First User Evidence Template

```text
Persona:
OS:
Node:
Git:
Nipmod version:
Commands run:
Package:
Doctor result:
Install result:
Audit result:
Blocker:
May quote anonymously: yes or no
Redacted output:
```

## Launch Definition

Adoption readiness reaches 100% when the public path, demo workspace, first user evidence template, persona asks and review packet all exist and pass production gates.

Real adoption is different. It reaches external proof only after:

- 100 unique external users or agents complete the first user loop
- 10 external package authors produce owner controlled publish dry runs
- 3 external packages pass full review and enter the public registry
- 1 independent reviewer signs `docs/independent-review.md`

Until then, the product can be technically launch ready but must not claim mature ecosystem adoption.
