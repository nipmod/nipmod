# Community

nipmod is for agents and humans building on Gitlawb.

## Who should try it

- Gitlawb repo owners who want their repo to become an installable agent package.
- Agent developers who need verified skills, MCP servers, workflow packs or policy packs.
- Security reviewers who want digest, signature, transparency and witness evidence before install.

## Package expectations

Public packages should include a clear README, a valid `nipmod.json`, quiet permissions, immutable source provenance, a signed release event and a smoke test or proof transcript.

Use:

```sh
nipmod package gitlawb://did:key:z6Mk.../repo --dir repo
nipmod manifest validate --dir repo
nipmod publish repo --dry-run --json
```

The dry run output includes a registry candidate. That is the review object for indexing or founder feedback.

## Feedback

Website: https://nipmod.com

X: https://x.com/Nipmod

Gitlawb source: https://gitlawb.com/z6MkwbuduCUUwy8fp78CZ2pnhLyRSibkSjcCGexT355xNw5R/nipmod

## Founder review kit

Primary public post:

```text
We built nipmod, decentralized npm for Gitlawb agents.

It turns Gitlawb repos into signed agent packages, verifies digest, DID signature, release event, transparency and witness evidence, and lets agents search, inspect, plan installs and publish dry runs without central publish control.

Code and proof are public:
https://gitlawb.com/z6MkwbuduCUUwy8fp78CZ2pnhLyRSibkSjcCGexT355xNw5R/nipmod
https://nipmod.com

Could you sanity check whether this fits Gitlawb's intended package layer?
```

Short public post:

```text
nipmod is decentralized npm for Gitlawb agents.

Gitlawb stores repos. nipmod turns them into signed, verifiable agent packages with digest, DID signature, transparency and witness proof.

Code: https://gitlawb.com/z6MkwbuduCUUwy8fp78CZ2pnhLyRSibkSjcCGexT355xNw5R/nipmod
Site: https://nipmod.com
```

Direct message:

```text
We built nipmod as a package layer for Gitlawb agents. It does not control who can publish on Gitlawb. It gives agents verified package search, install planning, audit and publish dry runs over signed Gitlawb content.

Could you sanity check the architecture and tell us whether this matches Gitlawb's direction?
```

Review asks:

- Is the package model aligned with Gitlawb DID ownership?
- Should registry candidates live as Gitlawb repo metadata, separate package repos or both?
- Is `gitlawb://did:key/.../repo` the right canonical source path for agents?
- Should Gitlawb expose a first class package index later, or should nipmod remain a rating and verification layer?
- Which Gitlawb invariants must nipmod never abstract away?

Follow up matrix:

- If Gitlawb says yes, publish the first reviewed package list and ask for ecosystem repos to convert.
- If Gitlawb wants protocol changes, capture them as `docs/gitlawb-feedback.md` before implementation.
- If Gitlawb wants nipmod independent, keep Gitlawb as the default source but document multi source support.
- If no response after 48 hours, post the short public demo and keep the ask technical.

## Security and incidents

nipmod does not delete Gitlawb content. It can publish signed advisories, quarantine registry records and block install surfaces. See `docs/incident-publication.md` for the operator path.

Security reports should include package id, version, digest, source repo, proof URL, witness URL and the command that reproduced the issue. Send the first report path through X DM to https://x.com/Nipmod until a dedicated security mailbox is published.
Use the public security policy at https://nipmod.com/security and the well known metadata at https://nipmod.com/.well-known/security.txt. X is the fallback contact, not the only disclosure path.
