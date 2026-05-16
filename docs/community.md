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

Founder review ask:

```text
We built nipmod, decentralized npm for Gitlawb agents.

It turns Gitlawb repos into signed agent packages, verifies digest, DID signature, release event, transparency and witness evidence, and lets agents search, inspect, plan installs and publish dry runs without central publish control.

Code and proof are public:
https://gitlawb.com/z6MkwbuduCUUwy8fp78CZ2pnhLyRSibkSjcCGexT355xNw5R/nipmod
https://nipmod.com

Could you sanity check whether this fits Gitlawb's intended package layer?
```

## Security and incidents

nipmod does not delete Gitlawb content. It can publish signed advisories, quarantine registry records and block install surfaces. See `docs/incident-publication.md` for the operator path.
