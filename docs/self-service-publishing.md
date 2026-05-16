# Self Service Publishing

nipmod publishing is decentralized. Gitlawb stores the package repo and artifact; nipmod verifies and indexes evidence.

## Author Flow

```bash
nipmod init --name my-agent-package --dir my-agent-package
nipmod manifest validate --dir my-agent-package
nipmod publish my-agent-package --dry-run --json
nipmod publish my-agent-package
```

For an existing Gitlawb repo:

```bash
nipmod package gitlawb://did:key:z6Mk.../repo --dir repo
nipmod manifest validate --dir repo
nipmod publish repo --dry-run --json
```

## Registry Candidate

The dry run returns `dev.nipmod.registry-candidate.v1`. That object is the self service review packet for indexing.

It must include:

- package id
- version
- artifact digest
- manifest digest
- publisher DID
- Gitlawb source repo
- source tag
- source commit when available
- resolved bundle URL

## Public Indexing Policy

nipmod does not decide who can publish on Gitlawb. The public registry indexes packages only when the package passes digest, signature, release event, source provenance, transparency and witness checks.

Failed candidates can still exist on Gitlawb, but they should not appear as `verified/100`.
