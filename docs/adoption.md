# Adoption

nipmod adoption is measured by real install, inspect, add, audit and publish dry run evidence. Do not claim adoption from page views alone.

## First 100 User Loop

Ask each user to run:

```bash
curl -fL https://nipmod.com/install.sh -o install.sh
curl -fL https://nipmod.com/install.sh.sha256 -o install.sh.sha256
shasum -a 256 -c install.sh.sha256
bash install.sh
nipmod doctor --online
nipmod search gitlawb --online
nipmod inspect pkg:did:key:z6MkfAZP5ayqPdX9biypAAZAjtDM1AbztFTmUFNGVqjpn41N/gitlawb-release-review@0.1.0 --online
nipmod add gitlawb-release-review --online
nipmod audit --online
```

Ask package authors to run:

```bash
nipmod init --name gitlawb-demo-package --dir gitlawb-demo-package
cd gitlawb-demo-package
nipmod manifest validate --dir .
nipmod publish . --dry-run --json
```

Ask Gitlawb repo owners to run the claim preview separately. The final dry run needs their matching DID identity.

```bash
nipmod package gitlawb://did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader --dir gitlawb-repo-reader-draft
nipmod manifest validate --dir gitlawb-repo-reader-draft
```

For founder review, send `docs/public-launch-packet.md` plus the live `/launch` page instead of a vague product description.

## Evidence To Collect

- terminal output with secrets removed
- OS, Node.js, pnpm and Git versions
- whether `nipmod doctor` passed
- package inspected or added
- dry run registry candidate for authors
- failure message if anything blocked

## Launch Definition

Real adoption reaches 100% only after:

- 100 unique external users or agents complete the first user loop
- 10 external package authors produce publish dry run candidates
- 3 external packages pass full review and enter the public registry
- 1 independent reviewer signs `docs/independent-review.md`

Until then, the product can be technically launch ready but must not claim mature ecosystem adoption.
