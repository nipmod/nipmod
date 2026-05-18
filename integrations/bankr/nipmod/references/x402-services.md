# Nipmod x402 Services For Bankr

Nipmod x402 endpoints make package workflows callable by Bankr agents.

The default config is deploy ready with USDC on Base:

```text
integrations/bankr/bankr.x402.json
```

The `$NPM` custom asset blueprint is separate:

```text
integrations/bankr/bankr.x402.npm-asset.example.json
```

The `$NPM` asset is:

```text
0x5155Eaa3B5784B829DeAD78189Eb4Bf69359dbA3
```

Use the USDC config unless Bankr confirms custom asset support for the deployment target.

## Services

### package-search

Search the Nipmod package index from Bankr.

Input:

```json
{ "q": "gitlawb", "limit": 10 }
```

Output:

```json
{ "query": "gitlawb", "count": 3, "packages": [] }
```

### package-audit

Return install safety metadata for one package without executing package code.

Input:

```json
{ "package": "gitlawb-repo-reader" }
```

Output:

```json
{ "package": "gitlawb-repo-reader", "trustScore": 100, "permissions": {}, "commands": {} }
```

### repo-package-draft

Return the Scout draft for a Gitlawb repo so a Bankr agent can prepare a package PR plan.

Input:

```json
{ "repo": "gitlawb://did:key:.../repo" }
```

Output:

```json
{ "repo": "gitlawb://did:key:.../repo", "draft": {}, "claimUrl": "https://nipmod.com/package?repo=..." }
```

## Deploy

From `integrations/bankr` after Bankr login:

```bash
bankr x402 deploy
```

Then verify:

```bash
bankr x402 schema https://x402.bankr.bot/<wallet>/package-search
bankr x402 call "https://x402.bankr.bot/<wallet>/package-search?q=gitlawb"
```
