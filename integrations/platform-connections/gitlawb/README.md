# Gitlawb Connection Kit

Status: Live

Gitlawb is the first canonical source anchor for Nipmod packages. Owner Package Claims are verified as a separate proof layer, and missing claim proofs must stay visible until the matching repo owner DID signs them.

Use this wording:

> Gitlawb is the first source anchor for Nipmod packages.

Do not claim:

> Gitlawb officially endorses Nipmod.

Public path:

https://gitlawb.com/node/repos/z6Mkwbud/nipmod

Smoke:

```sh
git ls-remote https://node.nipmod.com/z6Mkwbud/nipmod.git refs/heads/main
```

Agent instruction:

Use Gitlawb source metadata for package provenance. Use Nipmod for package install, lock, audit and proof.

Owner claim rule:

Only claim a package as owner verified when `.nipmod/package-claim.json` exists in the Gitlawb repo and `nipmod claim verify gitlawb://did:key:.../repo --json` returns verified.

Submission note:

No outside submission is required for the current Nipmod owned Gitlawb path.
