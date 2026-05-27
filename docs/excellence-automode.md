# Nipmod Excellence Automode

The automode is a repeatable pressure test for the package intelligence layer.

It does not claim perfect safety. It asks whether Nipmod is still doing the hard things that make the layer useful for agents before any workspace write.

Run:

```bash
pnpm excellence:automode
```

Run against production:

```bash
pnpm excellence:automode -- --live
```

## What It Asks

1. Can Nipmod explain source depth across every supported ecosystem?
2. Does every source return structured evidence instead of broad labels?
3. Do relevant safe candidates beat popularity and malicious-looking decoys?
4. Are public source-quality claims tied to the current benchmark?
5. Would a risky install command or executable artifact surface be stopped before execution?
6. Can package metadata turn into agent instructions?
7. Can hosted Nipmod accidentally become an installer?
8. Does the archive store only confirmed useful package intelligence records?
9. Will regressions be caught before they become public claims?
10. Are public claims honest enough to survive serious technical review?

## Current Control Sources

- npm provenance, registry signatures and trusted publishing.
- PyPI attestations, yanked files, release file digests and trusted publisher identity.
- OSV vulnerability lookup for package/version context.
- Hugging Face file-shape, pickle and remote-code boundaries.
- GitHub dependency review, repository security files and OpenSSF Scorecard.
- Nipmod source-depth, install-plan, archive-depth, usage and search-quality canaries.

## Hard Boundary

Hosted Nipmod remains read-only.

It searches, inspects, scores, warns and returns install plans. It does not clone repositories, unpack packages, execute model files, run package code or write to the user workspace.

The next real frontier is isolated artifact scanning, larger adversarial corpora, provenance drift history and telemetry from serious agent hosts.
