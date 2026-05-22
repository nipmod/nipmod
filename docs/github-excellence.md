# GitHub Excellence Plan

This is the operating standard for making the Nipmod GitHub presence look and behave like a serious open source product company.

## Target State

Nipmod should be easy to evaluate in five minutes and credible under deep technical review.

The public repository should answer:

- what the product is
- what is live
- what is not live
- how the API works
- how agents use it
- how source ownership is handled
- how security reports are handled
- how maintainers make decisions
- how contributors can help
- how releases are verified

## Public Repository Standard

| Area | Standard |
| --- | --- |
| README | Clear product position, status table, API examples, verification path and links. |
| Docs | Versioned architecture, API, trust, archive and source policy docs. |
| Issues | Structured templates for bugs, source requests, package risk and feature proposals. |
| Pull requests | Checks for tests, safety, API compatibility and docs impact. |
| Security | Security policy, supply chain policy, advisories and private reporting path. |
| Releases | Changelog entries, verification notes and compatibility notes. |
| Governance | Maintainer rules, decision records and release rules. |
| Maintainer commits | Commits authored by maintainers are signed and GitHub-verifiable. |
| Examples | Minimal working examples for direct API and agent usage. |
| CI | Tests, typecheck, build, supply chain checks, public readiness and code scanning. |
| Metadata | Topics, description, homepage, license, citation and community files. |

## World Class Gap List

| Gap | Current Direction |
| --- | --- |
| Org profile | Add a `.github` org profile repo with a concise public profile. |
| API spec | Keep `docs/specs/public-api.md` and generated `/api/openapi` aligned. |
| SDKs | Add TypeScript and Python SDKs once the API stabilizes. |
| Examples | Keep minimal examples in-repo, split later only when they become substantial. |
| Security depth | Add CodeQL, OpenSSF Scorecard and supply-chain docs. |
| Release discipline | Keep changelog, release process and signed release checks current. |
| Contributor funnel | Use issue templates, labels, milestones and discussions. |
| Source policy | Keep source terms, ownership and archive boundaries explicit. |
| Decision trail | Publish decision records for major product architecture changes. |
| Public proof | Keep status, monitors, examples and docs tied to real shipped behavior. |

## Repository Split Policy

Do not create empty satellite repositories for optics.

Split a new repository only when it has a real owner and real content:

- `sdk-js` after the TypeScript SDK has a stable package boundary
- `sdk-python` after the Python SDK has tests and examples
- `examples` after examples grow beyond this repository
- `docs` only if the docs become a standalone site
- `.github` for the org profile and default community files

Until then, keep the product concentrated in this repository.

## Non Negotiables

- No fake partnership claims.
- No private keys, tokens, local state or assistant handoff files in git.
- No unexplained generated blobs.
- No vague commit subjects.
- No unsigned maintainer-led repository changes.
- No public API behavior without tests.
- No source integration claim without a resolver, docs and monitor coverage.
- No payment or token claims that imply guaranteed return.

## Execution Checklist

- [x] Clean repository history.
- [x] TypeScript-only source and tooling.
- [x] CI, production monitor and public readiness checks.
- [x] Governance, maintainers, roadmap and release process docs.
- [x] API, source, trust and archive specs.
- [x] Structured issue and pull request intake.
- [x] Code scanning and Scorecard workflows.
- [x] Verified maintainer commit signing.
- [ ] Public org profile repo.
- [ ] SDK packages.
- [ ] Public examples expanded into integration tests.
- [ ] Third-party independent security review.
