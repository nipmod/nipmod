# Aeon x Nipmod review packet

Status: Under review

This packet drafts both directions discussed with the Aeon owner:

1. Aeon skills inside Nipmod
2. Nipmod inside Aeon

Nothing here claims official Aeon support, Aeon endorsement or live Aeon package publication. This is a review packet.

## Direction 1: Aeon skills inside Nipmod

Nipmod drafted a first 10 skill Aeon collection:

- repo-scanner
- pr-review
- code-health
- security-digest
- competitor-launch-radar
- product-hunt-launch
- fork-first-run-alert
- fork-skill-gap
- skill-security-scan
- github-monitor

Draft collection:

https://nipmod.com/integrations/aeon/aeon.collection.json

The intended package model:

- source links back to `aaronjmars/aeon`
- versioned metadata
- Aeon attribution
- owner review gate
- trust records
- agent readable install plans

Aeon keeps full ownership of the source and naming.

## Direction 2: Nipmod inside Aeon

Nipmod added an Aeon-compatible skill at:

https://github.com/nipmod/nipmod/blob/main/skills/nipmod/SKILL.md

Aeon can review this as a skill that lets agents search Nipmod, inspect packages, check trust records and produce safe install plans before using anything.

Expected Aeon install path after review:

```sh
./add-skill nipmod/nipmod nipmod
```

Aeon review PR:

https://github.com/aaronjmars/aeon/pull/199

## Review asks

Please review:

- whether the first 10 skills are the right first collection
- preferred naming and attribution
- whether Aeon wants each skill listed separately or grouped as a collection
- whether Aeon wants to merge, link or simply document the Nipmod skill
- whether any skill should be excluded before publication

## Safe public wording

Accurate:

> Aeon and Nipmod are drafting a two-way package and skill bridge for review.

Not accurate yet:

> Aeon officially supports Nipmod.

> Aeon skills are live Nipmod packages.

> Nipmod owns or republishes Aeon source code.
