# Gitlawb package layer completion spec

Status: active build plan
Date: 2026-05-18

## Goal

Nipmod should be the package layer for Gitlawb sourced agent code: a repo on Gitlawb can become an installable, verifiable, claimable package without giving Nipmod control over the source network.

The product has to work for two users at the same time:

- Humans need a simple page, short commands, clear ownership and a clean claim path.
- Agents need stable JSON, exact package IDs, install plans, lockfiles, provenance, policy checks and failure reasons.

## External baseline

The baseline is common package manager behavior, not brand imitation. Public copy must never imply affiliation with npm, GitHub, Microsoft or Gitlawb unless there is an explicit endorsement.

Reference surfaces:

- npm package metadata: https://docs.npmjs.com/cli/v11/configuring-npm/package-json
- npm install behavior: https://docs.npmjs.com/cli/v11/commands/npm-install
- npm publish behavior: https://docs.npmjs.com/cli/v11/commands/npm-publish
- npm provenance: https://docs.npmjs.com/generating-provenance-statements
- Gitlawb app: https://gitlawb.com
- Gitlawb node source: https://github.com/gitlawb/node

## Non negotiable boundaries

- Gitlawb is the source layer. Nipmod indexes, verifies, packages, rates, warns and helps install.
- Nipmod must not take ownership of Gitlawb repos.
- Nipmod must not require a Nipmod account for public package discovery or install.
- Public packages must be referenced by DID based canonical IDs.
- Destructive unpublish is not part of the public model. Use signed deprecation, yank or quarantine events.
- No arbitrary postinstall execution.
- No hidden registry write authority.
- No misleading brand language, logos or wordmarks from other ecosystems.
- Agent docs must be machine readable enough that an agent can follow the workflow from `https://nipmod.com`.

## Definition of complete for Gitlawb

Nipmod is complete for Gitlawb when these flows work end to end:

1. A human can paste a public Gitlawb repo and get a package draft, manifest checks and publish dry run commands.
2. An owner can claim the draft with the matching DID and publish without handing control to Nipmod.
3. A package page shows install, versions, trust, dependencies, advisories, provenance, audit and source.
4. A Gitlawb repo page shows whether that repo is already a package or has a claimable draft.
5. Agents can discover install, registry, package, claim, scout, MCP and audit URLs from `.well-known/nipmod.json`.
6. `nipmod install`, `nipmod add`, `nipmod ci`, `nipmod audit`, `nipmod sbom`, `nipmod explain`, `nipmod inspect`, `nipmod update` and `nipmod search` fail closed when trust is missing.
7. Dependency graph installs verify every node before mutating the workspace.
8. Scout continuously scans configured Gitlawb nodes, prepares drafts and exposes health and candidate JSON.
9. Package abuse is handled through visible advisories, warnings, quarantine and yanks.
10. Public pages and CLI copy stay legally clean and do not imply third party affiliation.

## Product layers

### 1. Package UX

Have:

- `/packages` browse with search, stats, trending, new packages and type filters.
- `/packages/[packageName]` detail pages with install variants, versions, dependencies, trust, advisories, provenance and agent use.
- `/package` repo to package form.
- `/candidates` claimable draft index.
- short installer command plus manual verification path.

Missing before this spec:

- canonical Gitlawb repo status pages.
- package badges for repos.
- direct published package or draft status from a Gitlawb repo URL.
- a stable share URL that owners can put in a Gitlawb repo README.

Build now:

- `/gitlawb/[owner]/[repo]` resolves to a published package or a claimable draft.
- `/badge/[owner]/[repo]` returns a small SVG badge.
- package and candidate cards link to the Gitlawb package surface.
- discovery manifest advertises the route templates.

### 2. Agent safety

Have:

- trust score and evidence model.
- transparency log and witness references.
- advisory feed and signature.
- audit pages.
- CI/audit commands.
- policy oriented install plan commands.

Still required:

- stronger malware and prompt injection fixtures.
- abuse report intake to advisory draft workflow.
- install receipt format that records exact policy decisions.
- runtime activation adapters with no default exec.
- compatibility matrix per agent host.

### 3. Gitlawb integration

Have:

- Gitlawb DID package IDs.
- Gitlawb source links and clone URLs.
- Scout node scan across configured nodes.
- Gitlawb helper detection in `doctor`.
- publish path through Gitlawb artifacts.

Still required:

- Gitlawb profile polish that depends on Gitlawb profile feature support.
- duplicate mirror repo cleanup only if Gitlawb exposes a safe non destructive API.
- Gitlawb issue or PR notification adapter when their protocol exposes safe writes.
- owner dashboard grouped by DID.
- multi maintainer and key rotation proof.

### 4. Ecosystem trust

Have:

- public review packet.
- independent review docs.
- audit readiness docs.
- external evidence ledger.
- public launch packet.

Still required:

- external human audit result.
- Gitlawb endorsement or official integration status.
- real owner claims.
- real third party package submissions.
- published incident response exercise.

## Workstreams and acceptance gates

### A. Canonical Gitlawb package surface

Files:

- `site/lib/registry.ts`
- `site/lib/candidates.ts`
- `site/app/gitlawb/[owner]/[repo]/page.tsx`
- `site/app/badge/[owner]/[repo]/route.ts`
- `site/app/packages/page.tsx`
- `site/app/candidates/page.tsx`
- `site/public/.well-known/nipmod.json`
- `site/test/*`
- `site/e2e/readiness.spec.ts`

Acceptance:

- published package resolves from `/gitlawb/z.../repo`.
- draft candidate resolves from `/gitlawb/z.../repo`.
- invalid owner or repo returns 404.
- badge route returns valid SVG with verified or draft state.
- cards link to the status surface.
- discovery manifest exposes `gitlawbPackagePageTemplate` and `badgeTemplate`.

### B. Owner claim v2

Acceptance:

- `/gitlawb/[owner]` shows every published package and claimable draft for that DID.
- `/candidates` groups by owner DID.
- owner can copy claim, verify and dry run commands.
- claim pages show exact source, DID, draft status and package ID.
- machine JSON has no HTML dependency.
- candidate, package and repo status pages link back to the owner surface.

### C. Agent install certainty

Acceptance:

- install plan includes graph, trust, advisories, permissions and final mutation summary.
- failed trust, yanked package or high quarantine blocks install.
- `nipmod ci --online` is the recommended automated gate.
- `nipmod explain` can answer why a package is installed.

### D. Scout operational maturity

Acceptance:

- health exposes scan interval, source nodes, last success and last error.
- stale status flips when scans fail.
- drafts are deterministic from the same repo input.
- no notification write happens without an explicit safe Gitlawb API.

### E. Public trust and legal readiness

Acceptance:

- no page uses third party logos or wordmarks in a way that implies affiliation.
- legal boundary copy is explicit but not defensive.
- security contact, advisory signature, transparency and review packet are public.
- external audit status is honest.

## Current progress

| Area | Status | Blocker |
| --- | --- | --- |
| CLI install/search/inspect/install/audit | strong | host activation still limited |
| Registry JSON and package pages | strong | repo status surface missing |
| Scout scan and candidates | strong | zero real owner claims yet |
| Claim flow | usable | adoption and owner dashboard missing |
| Gitlawb integration | good | profile customization and safe notification writes depend on Gitlawb support |
| Trust/advisory/transparency | good | external audit and incident drill still needed |
| Legal branding | cleaned | keep future copy strict |

## Implementation order

1. Canonical Gitlawb package surface and badge.
2. Owner claim v2 pages and machine JSON.
3. Install receipt and policy decision records.
4. Runtime adapter compatibility matrix.
5. Scout notification adapter only after safe Gitlawb write support exists.
6. External audit packet refresh.
7. Real owner adoption loop.

## First build slice

Build slice one now:

- Add resolver helpers for Gitlawb owner and repo paths.
- Add repo status page.
- Add repo badge SVG route.
- Link package and candidate cards to the repo status page.
- Add discovery manifest templates.
- Add unit and E2E coverage.
- Run tests, typecheck, build and secret scan.
- Deploy only after gates pass.
