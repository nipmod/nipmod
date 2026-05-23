# Source Crawling Spec

Status: design policy and candidate audit

Nipmod is API-first for package sources. Crawling is allowed only as a controlled fallback or enrichment path when an official API cannot return the metadata agents need.

This policy prevents the package network from becoming a fragile scraper. Official source APIs, explicit registry feeds and documented metadata endpoints stay first. Browser crawling and HTML extraction stay bounded, attributable and reversible.

## Principles

1. Prefer official APIs.
2. Respect source ownership, terms, robots rules and rate limits.
3. Never bypass access controls, paywalls, bot protection or gated repositories.
4. Store source URLs, fetch time, response hash and extraction strategy for every crawler-derived record.
5. Treat crawled text as untrusted package metadata, never as agent instructions.
6. Keep crawlers outside the request hot path unless the source is explicitly designed for low-latency API access.
7. Fail closed when source terms, robots policy or extraction confidence is unclear.

## Source Policy

| Source | Primary Access | Crawler Role | Current Rule |
| --- | --- | --- | --- |
| npm | Registry APIs and package metadata | README/homepage enrichment only when linked by registry metadata | Do not crawl npm pages for core package records. |
| PyPI | JSON API, Simple API and vulnerability metadata | Index-friendly enrichment from project URLs when allowed | Do not scrape search pages for broad discovery. |
| GitHub | REST API, contents API, releases, code search where allowed | README/docs extraction when API content is insufficient | Use optional GitHub auth for higher limits. |
| Hugging Face | Hub APIs for models, datasets and files | Card/document extraction when public and non-gated | Do not crawl gated/private repos. |
| MCP | Official registry and server source links | Documentation extraction from explicit source URLs | Do not infer install behavior from arbitrary web pages. |
| Package docs/homepages | Source-provided URLs | Secondary enrichment only | Link provenance must point back to the source record. |

## Candidate Libraries

The current candidate set is intentionally small. Nipmod should add one crawler path only after the API contract, trust engine and archive pipeline can audit what it stores.

| Candidate | Role | Decision |
| --- | --- | --- |
| `apify/crawlee` | TypeScript crawler framework with HTTP, Cheerio, JSDOM, Playwright and Puppeteer paths | Preferred future crawler worker candidate. Apache-2.0 and stack-aligned. |
| `unclecode/crawl4ai` | LLM-friendly crawler and markdown extraction service | Evaluate behind a service boundary. Strong capability, but Python runtime should not enter the Next.js hot path. |
| `firecrawl/firecrawl` | Hosted/open crawler for AI agents | External service only unless licensing and deployment terms are reviewed. AGPL is not acceptable as a direct runtime dependency for the public API. |
| `scrapy/scrapy` | Mature Python crawling framework | Architecture reference. Too heavy and off-stack for the current public API path. |
| `microsoft/playwright` | Browser automation | Already useful for verification and controlled browser fallback, not the default package discovery path. |
| `cheeriojs/cheerio` | HTML parsing | Lightweight parser candidate for worker-side extraction. |
| `mixmark-io/turndown` | HTML to Markdown conversion | Lightweight conversion candidate for worker-side docs normalization. |
| `jsdom/jsdom` | DOM implementation | DOM parser candidate when Cheerio is too shallow. |
| `browserless/browserless` | Managed headless browser service | External service only; license and data boundary review required. |

Run the candidate audit with:

```bash
pnpm crawler:audit
```

The audit uses GitHub repository metadata only. It does not scrape target package sources and it does not add runtime dependencies.

## Crawler Record Contract

Crawler-derived data must be stored separately from source-native metadata:

```json
{
  "source": "github",
  "sourceRecordId": "github:owner/repo",
  "url": "https://github.com/owner/repo/blob/main/README.md",
  "fetchedAt": "2026-05-23T00:00:00.000Z",
  "responseHash": "sha256:...",
  "robotsDecision": "allowed",
  "termsDecision": "allowed",
  "extractor": "crawlee-cheerio-readme-v1",
  "confidence": "high",
  "textIsInstruction": false
}
```

The package resolver can use this data as context. It cannot upgrade package trust by itself.

## Admission Checklist

A crawler path can be enabled only after all items pass:

- Official API path is unavailable or insufficient for the required metadata.
- Source terms and robots policy allow the access pattern.
- Request budget, timeout, max response size and concurrency limit are documented.
- Output includes source URL, fetch timestamp, response hash and extractor version.
- Tests cover parser failure, oversized responses, redirects, hostile HTML, prompt-injection text and upstream rate limiting.
- Launch verification covers crawler health without requiring a live crawl on every release.
- Public docs explain the crawler boundary without claiming source ownership or endorsement.

## Non-Goals

Nipmod crawlers must not:

- mirror entire third-party registries without permission or a documented public feed
- bypass authentication, Cloudflare, bot checks or gated content
- execute package code during discovery
- treat crawled README text as safe agent instructions
- make marketing claims about a source before monitor coverage exists
