# Nipmod Owner Package Claim

Owner Package Claim is the proof that a Gitlawb repo owner accepts a Nipmod package identity for their own repo.

Nipmod no longer runs a public candidate or auto draft flow for other people's repos. Package creation is owner led:

```text
owner repo -> local package files -> owner claim -> publish dry run -> verified package
```

The boundary is strict:

- Nipmod does not claim, publish or prepare another person's repo.
- Nipmod does not infer endorsement from a public repo.
- Agents should only help with package preparation when the repo owner explicitly asks.
- Remote Gitlawb writes stay under the owner operator's control.

## Owner Flow

### 1. Check the repo

```bash
nipmod package doctor gitlawb://did:key:.../your-repo --json
```

Doctor checks whether the repo has enough package metadata, examples, permissions and claim proof to become installable by agents.

### 2. Prepare local package files

```bash
nipmod package pr gitlawb://did:key:.../your-repo --dir your-repo-pr
```

This writes local files only:

- `nipmod.json`
- `README.nipmod.md`
- optional `.nipmod/package-claim.json` when the matching owner identity is supplied

The owner reviews the files before anything is committed or pushed.

### 3. Sign the owner claim

```bash
nipmod claim gitlawb://did:key:.../your-repo --dir . --identity .nipmod/identity.json
```

The claim proof is accepted only when:

- the proof schema is valid
- the Ed25519 signature verifies
- `signature.keyId` equals `ownerDid`
- `ownerDid` equals the Gitlawb repo owner DID
- `repoName`, `repo` and `package` match the exact repo being checked

Machines can verify the proof directly:

```bash
nipmod claim verify gitlawb://did:key:.../your-repo --json
```

Exit code `0` means verified. Exit code `7` means missing, invalid or mismatched proof.

### 4. Publish dry run

```bash
nipmod publish your-repo-pr --dry-run --json
```

A repo becomes a verified package only after the owner DID matches, the claim proof verifies, `nipmod.json` validates, the package packs cleanly, the release artifact is signed and registry trust checks pass.

## Website Surfaces

- `/package` is the self service owner path.
- `/gitlawb/[owner]` shows published packages for that owner DID.
- `/gitlawb/[owner]/[repo]` resolves only to a published package.
- `/candidates` redirects to `/package`.
- `/scout/*` returns a retired endpoint response.
