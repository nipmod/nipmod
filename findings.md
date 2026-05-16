# nipmod Findings

## Brand / Launch

- Canonical public domain: `nipmod.com`.
- X handle: `@nipmod`.
- DNS provider: Cloudflare.
- Vercel CLI is logged in as `aficial`.
- Cloudflare token validated for `nipmod.com`.
- Cloudflare token has confirmed `DNS:Edit`.
- Current Cloudflare token has confirmed edit rights for DNS, Workers Scripts, Workers Routes, KV, D1 and R2 through temporary create/delete probes.
- Temporary Cloudflare probe resources were deleted; follow-up check found 0 leftover probe resources.
- Production site: `https://nipmod.com`.
- Alternate domain: `https://www.nipmod.com`.
- Vercel project: `kompiut/nipmod`.
- Vercel production deployment: `dpl_Gcd2K5XQH4LAFuJREhQCCsSMLfbp`.
- Cloudflare DNS: apex and `www` point to Vercel `76.76.21.21` as DNS only records.
- Public installer path: `https://nipmod.com/install.sh`.
- Current static CLI artifact path: `https://nipmod.com/releases/nipmod-0.0.0.tgz`.
- Current static CLI artifact sha256: `b40a324a353b7e831210e3be5a504a985c502f39a0390f69b25315b4d0f464be`.

## Gitlawb Probe

- Gitlawb v0.3.8 works as Git/ref transport.
- Custom `refs/nipmod/*` can be pushed and fetched through Git smart-HTTP.
- Gitlawb does not enforce immutable version refs.
- nipmod publish enforces version immutability at the CLI layer: existing `releases/<version>` is accepted only when the existing bundle digest exactly matches the new bundle.
- `/api/v1/repos/{owner}/{repo}/refs` is not a general Git refs endpoint.
- IPFS pins are empty without external Pinata/IPFS config.
- UCAN is not stable enough for nipmod v1 enforcement.

## Gitlawb Canonical

- Local canonical DID: `did:key:z6Mkt3WFxMRZ5d4t5HZ4U4BrLrt5CSTZT6Aijmvkgu6QeRYG`.
- Local canonical repo: `gitlawb://did:key:z6Mkt3WFxMRZ5d4t5HZ4U4BrLrt5CSTZT6Aijmvkgu6QeRYG/nipmod`.
- Local HTTP repo: `http://localhost:7545/z6Mkt3WFxMRZ5d4t5HZ4U4BrLrt5CSTZT6Aijmvkgu6QeRYG/nipmod.git`.
- Initial canonical commit: `8cb91153b3a31b55d60dec21e63b57556c13e7f9`.
- Canonical private key backup: `probe-work/canonical-home/identity.pem` with mode `600`.
- This is local-node canonical. Public Gitlawb canonical still requires choosing the final public Gitlawb node/endpoint.

## Public Gitlawb Node

- Public node URL: `https://node.nipmod.com`.
- Fly app: `nipmod-gitlawb-node`.
- Fly machine: `68397e0b126d98`.
- Fly region: `fra`.
- Node DID: `did:key:z6Mkw3zyzNA5n3H36APDwBaaDq224xUHsAM1CwD2HJMGmzMS`.
- P2P peer ID: `12D3KooWD4T9CPnzkX7U75Sw2BhxaY1MPUQ8X3K3wfPXhZ6nv2ER`.
- Managed Postgres cluster: `nipmod-gitlawb-db` / `kzpwm0j6qm2r4nv3`.
- Node volume: `gitlawb_data` / `vol_vxmm1eqe7m3p58j4`.
- Runtime limits: 1 shared CPU, 1024 MB RAM, 10GB node volume, 10GB Managed Postgres disk.
- `GITLAWB_MAX_PACK_BYTES` is capped at 100MB to avoid large Git pack memory spikes on the first small machine.
- On-chain PoS is disabled because staking contract and operator private key are not configured.
- P2P starts and `/api/v1/p2p/info` returns enabled, but logs show Kademlia `put_record` quorum warning because current seed list has no P2P multiaddr.
- nipmod package storage now lives inside public Gitlawb repos, not in a separate nipmod database.
- Published package layout: `releases/<version>/bundle.nipmod`, `releases/<version>/release.json` and root `index.json`.
- Gitlawb blob URLs read the current default branch and are content-mutable; nipmod trust must come from digest/signature/baseline checks, not URL immutability.
- `GET /api/v1/repos` has no pagination and currently returns all visible repos; crawler must tolerate missing blobs returning `500 {"error":"git_error"}`.
- Publish requires a local `git-remote-gitlawb` helper because Gitlawb writes files through Git Smart HTTP, not a JSON upload endpoint.
- nipmod now discovers `git-remote-gitlawb` automatically from `NIPMOD_GITLAWB_HELPER`, packaged `bin/` candidates or `PATH`.
- Project-local helper binaries inside the package being published are intentionally not trusted as auto-discovery candidates.
- If the helper or `git` is missing, publish fails before creating a Gitlawb repo, so setup failures do not leave empty remote repos.
- Install does not require the helper; it reads the public Gitlawb blob API and verifies integrity plus Ed25519 bundle signature.
- Installer no longer auto-runs the Gitlawb helper installer. Optional helper install requires `NIPMOD_INSTALL_GITLAWB=1` and `GITLAWB_INSTALL_SHA256`.
- Current Gitlawb repo name limit blocks dots in package slugs. nipmod rejects those for public Gitlawb publish/install until Gitlawb supports dotted repo names or we add a reversible mapping.

## Epic B Decisions

- Build local-first core before Gitlawb adapter.
- Use deterministic JSON bundle for first implementation.
- Lockfile must pin artifact digest, manifest digest and publisher DID.
- Install must require both an external `sha256-...` integrity pin and a valid Ed25519 signature over the bundle payload.
- Remote install must also assert that the fetched bundle canonical package and version match the requested `pkg:<did>/<name>@<version>` spec.
- CLI-generated packages now get a real local Ed25519 did:key identity; the private key is written to `.nipmod/identity.json` and excluded by generated `.gitignore`.
- Cloudflare setup is local-only via `nipmod setup-cloudflare`; it writes secrets to `.env.local`, which is ignored.
- Local self-hosted Gitlawb development can use loopback HTTP (`localhost`, `127.0.0.1`, `::1`) in lockfiles. Public remote package URLs must be HTTPS.
- The installer is bootstrap infrastructure, not package source of truth. It installs the nipmod CLI from `nipmod.com`; packages themselves still publish to and install from Gitlawb.
- The release tarball is bundled as a standalone Node CLI, so install does not fetch nipmod runtime dependencies from npm.
- Release events are currently metadata-only, not cryptographically signed. The registry therefore marks current packages as `review`, not `verified`.
- `verified` requires artifact digest verification, bundle signature verification, canonical publisher match, immutable snapshot match and a cryptographically verified signed release event.
- The registry index fails closed if a previously indexed `canonical@version` digest changes.

## Website Decisions

- The website is intentionally lean: one dark landing page, no alpha label, no registry simulation, no long explanation.
- Public usage shown now: `Terminal`, `Website`, `Codex`.
- Terminal means initialize, pack, verify and install packages through the CLI.
- Website means find packages and inspect trust.
- Codex means run nipmod commands inside a workspace.
- X link is `https://x.com/nipmod`.
- Website now has real registry discovery: server-rendered search, package cards, trust warnings, permission highlights and pinned `nipmod install ... --integrity sha256-...` commands.
- Public registry JSON path: `https://nipmod.com/registry/packages.json`.
