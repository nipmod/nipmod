# Adoption

nipmod adoption is measured by real install, inspect, add, audit and publish dry run evidence. Do not claim adoption from page views alone.

## First 100 User Loop

Ask each user to run:

```bash
curl -fL https://nipmod.com/install.sh -o install.sh
curl -fL https://nipmod.com/install.sh.sha256 -o install.sh.sha256
shasum -a 256 -c install.sh.sha256
bash install.sh
nipmod doctor
nipmod search gitlawb --online
nipmod inspect gitlawb-release-review --online
nipmod add gitlawb-release-review --online
nipmod audit --online
```

Ask package authors to run:

```bash
nipmod package gitlawb://did:key:z6Mk.../repo --dir repo
nipmod manifest validate --dir repo
nipmod publish repo --dry-run --json
```

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
