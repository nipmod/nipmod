# nipmod Gitlawb Contract Probe Report

Stand: 2026-05-15

Probe-Ziel: beweisen, ob Gitlawb als Package-Origin fuer nipmod technisch traegt.

## Result

**Go fuer Gitlawb als decentralized source/ref transport.**

**No-go fuer Gitlawb als alleinige immutable package registry.** Gitlawb laesst bestehende `refs/nipmod/*` bewegen. nipmod braucht deshalb zwingend eigene Release-Events, Publisher-Signaturen, CID/digest-pinning, Lockfiles und Transparency-Log/Equivocation-Detection.

## Environment

- Workspace: `/Users/hazar/Documents/Codex/2026-05-15/analysierr-gitlawb-komplett-durhc-mit-mehrere`
- Gitlawb checkout: `gitlawb-node` at `f312955`
- Docker daemon was initially down.
- Docker Desktop app was not installed.
- Colima was installed and started successfully.
- Local Rust/Cargo was not installed, so all builds ran in Docker.
- `docker compose` / `docker-compose` was not available, so services were run with plain Docker.

## Local Setup

Started:

- `nipmod-gitlawb-postgres`: `postgres:16-alpine`
- `nipmod-gitlawb-node`: `nipmod-gitlawb-node-probe:local`
- Ports: `7545` HTTP/git smart-HTTP, `7546` libp2p

Node health:

```json
{"status":"ok"}
```

Node metadata:

```json
{
  "auth": "http-signature-rfc9421",
  "did": "did:key:z6MkuWaKiCytRkuPAKrz77LuxUi9gqKQTxWZH5FqtPXZJAS9",
  "identity": "ed25519",
  "network": "alpha",
  "protocols": ["git-smart-http", "mcp", "libp2p"],
  "version": "0.3.8"
}
```

P2P:

```json
{
  "enabled": true,
  "topics": ["gitlawb/ref-updates/v1"]
}
```

## Build Finding

The local Docker build failed first:

```text
couldn't read crates/gitlawb-node/src/../../../bootstrap-peers.json
```

Root cause: `Dockerfile` copied `crates/` but not `bootstrap-peers.json`, while `bootstrap.rs` uses `include_str!("../../../bootstrap-peers.json")`.

Local fix applied:

```dockerfile
COPY bootstrap-peers.json bootstrap-peers.json
```

This is a real upstream build bug or missing Dockerfile copy rule.

## Identity and Registration

Created probe DID:

```text
did:key:z6MkphujGszupPBsvtLxaQ5ZwtCy8K4Ns3TNN4LuG5kzgu1K
```

Registered against local node:

- advertised capabilities: `git:push`, `git:fetch`, `issue:create`, `pr:open`
- trust score after pushes: `0.2`
- push count: `3`
- level: `contributor`

UCAN note:

- `gl register` saved `ucan.json`.
- `gl ucan show --dir /workspace/home` failed with `invalid UCAN: missing field payload`.
- Extracting `.ucan` from the wrapper JSON and running `gl ucan verify <token>` worked.
- Verified bootstrap token only contained `gitlawb://alpha -> network/join`, not the advertised publish/issue capabilities.

Decision: **do not rely on UCAN for nipmod v1 permission enforcement.** Treat it as future/advisory metadata until chain validation, revocation and saved-token UX are stable.

## Repo Probe

Created repo:

```text
gitlawb://did:key:z6MkphujGszupPBsvtLxaQ5ZwtCy8K4Ns3TNN4LuG5kzgu1K/nipmod-probe
```

Pushed `main` with:

- `README.md`
- `nipmod.json`
- `release-event.json`

Push worked via `git-remote-gitlawb` and HTTP Signature auth. Ref certificate recorded the publisher DID.

Commit:

```text
1e61ace6cdcf370e914477859ace9c0976ca376b
```

## Custom Ref Probe

Pushed:

```text
refs/nipmod/packages/z6MkphujGszupPBsvtLxaQ5ZwtCy8K4Ns3TNN4LuG5kzgu1K/nipmod-contract/versions/0.0.1
refs/nipmod/log/sth/probe
```

Result:

- Custom `refs/nipmod/*` push works.
- `git ls-remote` exposes custom refs.
- Explicit `git fetch origin refs/nipmod/...` works.
- A clean clone can fetch the nipmod ref into a local tracking ref.

This validates Gitlawb as package ref transport.

## REST API Probe

Working REST APIs:

- `/`
- `/health`
- `/api/v1/stats`
- `/api/v1/p2p/info`
- `/api/v1/repos`
- `/api/v1/repos/{owner}/{repo}`
- `/api/v1/repos/{owner}/{repo}/commits`
- `/api/v1/repos/{owner}/{repo}/tree`
- `/api/v1/repos/{owner}/{repo}/blob/{path}`
- `/api/v1/repos/{owner}/{repo}/certs`
- `/api/v1/repos/{owner}/{repo}/events`
- `/api/v1/repos/{owner}/{repo}/issues`
- `/api/v1/agents`
- `/api/v1/agents/{did}/trust`

Important REST limitations:

- `/api/v1/repos/{owner}/{repo}/refs` returned `{ "count": 0, "refs": [] }`.
- That endpoint is not a general Git refs endpoint. It only reports branch-to-CID rows when Pinata/IPFS pinning records them.
- `/tree` and `/blob` ignore arbitrary `ref` query parameters and read only default branch.
- Custom `refs/nipmod/*` are visible via git smart-HTTP, not via general REST tree/blob APIs.

Decision: **nipmod should use Git smart-HTTP / `git ls-remote` / explicit fetch for custom package refs.** Do not depend on REST `/refs` for package index truth.

## Ref Certificates and Events

Certificates are emitted for:

- `refs/heads/main`
- `refs/nipmod/packages/.../versions/0.0.1`
- `refs/nipmod/log/sth/probe`
- later mutation of the version ref

Certificate shape includes:

- 40-char Git SHA old/new values
- pusher DID
- node DID
- node signature
- timestamp

Repo events endpoint returns local cert events.

Global `/api/v1/events/ref-updates` returned empty in this local single-node setup. It appears to list received gossip/ref-update records, not local certificates.

Decision: **use repo cert endpoint as local proof source; build nipmod's own transparency log rather than treating global ref-update API as canonical.**

## Issue Ref Probe

Created issue:

```text
nipmod advisory probe
```

Result:

- Issue API works.
- Issue includes `signed_payload`.
- Git smart-HTTP exposes:

```text
refs/gitlawb/issues/0e875f2e-6199-4ba3-bc92-d7611a4f9eea
```

Decision: Gitlawb issue refs are usable as inspiration or optional carrier for advisories, but nipmod should define its own signed advisory event schema.

## Artifact / CID Probe

`/api/v1/ipfs/pins` returned empty.

Reason:

- Local node has no Pinata/IPFS config.
- `list_refs` only gets branch CIDs if pinning is configured and pinning succeeds.
- Arweave anchors also empty because no Irys/Arweave config.

Decision:

- v1 cannot assume Gitlawb gives artifact availability or CIDs by default.
- nipmod needs its own deterministic artifact digest and local/hosted CAS fallback.
- IPFS/Arweave/Filecoin can be optional persistence layers once configured.

## Immutability Probe

Initial version ref:

```text
refs/nipmod/packages/.../versions/0.0.1 -> 1e61ace6cdcf370e914477859ace9c0976ca376b
```

Mutation test:

- Added `MUTATION.txt`.
- New commit: `2445ca814a27221623078ad0bebc26202614c702`
- Moved the same version ref to the new commit.

Gitlawb accepted it:

```text
1e61ace..2445ca8 refs/nipmod/packages/.../versions/0.0.1 -> refs/nipmod/packages/.../versions/0.0.1
```

Certificate recorded:

```json
{
  "old_sha": "1e61ace6cdcf370e914477859ace9c0976ca376b",
  "new_sha": "2445ca814a27221623078ad0bebc26202614c702",
  "ref_name": "refs/nipmod/packages/.../versions/0.0.1"
}
```

Decision:

- Gitlawb refs are transport, not immutable registry state.
- nipmod must reject version-ref movement unless it is represented as an append-only revocation/supersession event.
- Lockfiles must pin commit/CID/digest.
- Transparency log is not optional.

## Architecture Decision

Proceed with this model:

```text
Gitlawb repo/ref       source + transport
nipmod release event  canonical package version truth
publisher signature   authority
artifact digest/CID   immutability
nipmod lockfile       install truth
transparency log      anti-rewrite / equivocation detection
policy engine         consumer-side control
hosted/CAS mirror     availability
```

Do not proceed with:

```text
Gitlawb ref alone = package version truth
Gitlawb REST /refs = registry index
Gitlawb IPFS pins = guaranteed artifact storage
Gitlawb UCAN = v1 permission enforcement
```

## Next Build Step

Start Epic B with a local-first protocol core:

1. `packages/protocol`: schemas for `nipmod.json`, lockfile and release event.
2. `packages/verifier`: canonical JSON, digesting, DID signature verification.
3. `packages/cli`: `nipmod init`, `pack`, `verify`, `install file:`.
4. Test fixtures:
   - valid package,
   - tampered manifest,
   - moved version ref,
   - missing permission manifest,
   - postinstall attempt.

Only after local verifier is solid should Gitlawb adapter become Epic D.

