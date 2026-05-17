# Community

Nipmod is for agents and humans building on Gitlawb.

## Who should try it

- Gitlawb repo owners who want their repo to become an installable agent package.
- Agent developers who need verified skills, MCP servers, workflow packs or policy packs.
- Security reviewers who want digest, signature, transparency and witness evidence before install.

## Package expectations

Public packages should include a clear README, a valid `nipmod.json`, quiet permissions, immutable source provenance, a signed release event and a smoke test or proof transcript.

Use:

```sh
nipmod init --name gitlawb-demo-package --dir gitlawb-demo-package
cd gitlawb-demo-package
nipmod manifest validate --dir .
nipmod publish . --dry-run --json
```

The dry run output includes a registry candidate. That is the review object for indexing or founder feedback.

For an existing Gitlawb repo, first create a claim preview:

```sh
nipmod package gitlawb://did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader --dir gitlawb-repo-reader-draft
nipmod manifest validate --dir gitlawb-repo-reader-draft
```

Publishing that draft requires the matching repo owner DID identity.

## Feedback

Website: https://nipmod.com

X: https://x.com/Nipmod

Gitlawb source: https://gitlawb.com/node/repos/z6Mkwbud/nipmod

First user evidence:

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

Send only redacted output. Do not include tokens, private keys, local secret paths or unrelated data.

## Founder review kit

Primary public post:

```text
Gitlawb gives agents decentralized source.

Nipmod adds the package layer: signed bundles, DID publisher identity, digest-pinned installs, release evidence, transparency proof, witness proof and advisory-aware audit.

Independent project asking for Gitlawb review, not claiming endorsement.

Run the demo and send the strongest objection.
Public demo: https://nipmod.com/launch
https://gitlawb.com/node/repos/z6Mkwbud/nipmod
```

Short public post:

```text
Nipmod is a verifiable package layer for Gitlawb agents.

Gitlawb stores repos. Nipmod turns them into signed, verifiable agent packages with digest, DID signature, transparency and witness proof.

Code: https://gitlawb.com/node/repos/z6Mkwbud/nipmod
Site: https://nipmod.com
```

Direct message:

```text
We built Nipmod as an independent package layer for Gitlawb agents. It keeps Gitlawb as decentralized source and adds verification around install: signed bundles, DID publisher identity, digest-pinned lockfiles, release evidence, transparency proof, witness proof and advisory-aware audit.

Independent project asking for Gitlawb review, not claiming endorsement.

Could you sanity check whether this should be a Gitlawb maintained package path, an independent verification layer, or something Gitlawb should expose directly?
```

Review asks:

- Is the package model aligned with Gitlawb DID ownership?
- Should registry candidates live as Gitlawb repo metadata, separate package repos or both?
- Is `gitlawb://did:key/.../repo` the right canonical source path for agents?
- Should Gitlawb expose a first class package index later, or should Nipmod remain a rating and verification layer?
- Which Gitlawb invariants must Nipmod never abstract away?

Follow up matrix:

- If Gitlawb says yes, publish the first reviewed package list and ask for ecosystem repos to convert.
- If Gitlawb wants protocol changes, capture them as `docs/gitlawb-feedback.md` before implementation.
- If Gitlawb wants Nipmod independent, keep Gitlawb as the default source but document multi source support.
- If no response after 48 hours, post the short public demo and keep the ask technical.

## Security and incidents

Nipmod does not delete Gitlawb content. It can publish signed advisories, quarantine registry records and block install surfaces. See `docs/incident-publication.md` for the operator path.

Security reports should include package id, version, digest, source repo, proof URL, witness URL and the command that reproduced the issue. X DM to https://x.com/Nipmod is the current public contact path until a dedicated security mailbox is published.
Use the public security policy at https://nipmod.com/security and the well known metadata at https://nipmod.com/.well-known/security.txt.
