# Package search excellence audit

This audit tracks failure modes and improvement work for Nipmod package search across humans and agents.

The hosted API remains read-only: it searches, inspects and returns install-plan context, but it does not write to a workspace, execute code, clone repositories, unpack archives or run model files during normal hosted requests.

## Critical failure modes

1. Unsafe package outranks a safer direct fit because popularity dominates trust.
2. Private-looking package queries are widened into public package hints.
3. Cross-registry impersonation wins when a user asks for a specific ecosystem.
4. Natural-language queries waste source budget on impossible exact names.
5. Source outages hide the fact that the answer is partial.
6. Blocked records are still recommended.
7. Lifecycle scripts are treated as metadata instead of execution risk.
8. Prompt-injection text in package metadata influences selection language.
9. Obfuscated metadata instructions avoid simple text checks.
10. Long-description instructions in PyPI records bypass npm-focused checks.
11. README instructions in GitHub records bypass package metadata checks.
12. Model-card instructions in Hugging Face records bypass package checks.
13. Dataset loader scripts are treated like ordinary dataset files.
14. Hugging Face model binary shape is not visible before reuse.
15. MCP servers with required secrets look harmless because they have names and descriptions.
16. MCP remote endpoints are not classified by transport and origin.
17. Missing repository or license is treated as neutral for trust.
18. Source repository mismatch is missed for package records.
19. Publisher continuity drift is hidden by current popularity.
20. Dormant package takeover is not surfaced as a timeline risk.
21. Deprecated packages remain recommended because downloads are high.
22. Known vulnerable versions are not tied to the resolved version.
23. Typosquat/confusion aliases are recommended over canonical names.
24. Scoped SDK confusion is missed for crypto ecosystems.
25. Multi-source search mixes package, model, repo and MCP intent without enough penalties.
26. Very narrow source limits cut off good fallback candidates.
27. Ranking reasons do not explain why a safer candidate won.
28. Agent output lacks a clear execution boundary.
29. Search quality is judged by anecdotes instead of fixed regression cases.
30. Benchmark fixtures do not cover normal daily package tasks.

## Optimizations

1. Broaden per-source candidate budget while keeping a hard max cap. Implemented.
2. Avoid exact-name lookups for natural-language PyPI queries. Implemented.
3. Avoid exact-name npm hints for natural-language queries. Implemented.
4. Keep private-looking queries from generic public hint expansion. Implemented.
5. Add token-level relevance so partial natural-language matches score. Implemented.
6. Preserve exact and prefix matches as strong signals. Implemented.
7. Add richer source-intent penalties for models, datasets, MCP and GitHub. Implemented.
8. Keep popularity as a tie-breaker, not the main safety signal. Existing guard.
9. Enrich only bounded npm search records to control latency. Existing guard.
10. Cache source fetches briefly and dedupe inflight requests. Existing guard.
11. Use circuit breakers for failing external sources. Existing guard.
12. Return partial source summaries when one source fails. Existing guard.
13. Prefer structured evidence IDs over fragile text checks. Existing guard.
14. Keep read-only install plans separate from execution. Existing guard.
15. Normalize source records before ranking. Existing guard.
16. Deduplicate records by stable source IDs. Existing guard.
17. Penalize missing metadata that matters to review. Existing guard.
18. Penalize high-risk command composition. Existing guard.
19. Surface high-severity warning counts in ranking. Existing guard.
20. Expose source evidence depth for agents and admin views. Existing guard.
21. Keep OSV lookups bounded and cached. Existing guard.
22. Keep large upstream responses capped by bytes. Existing guard.
23. Keep test fixtures deterministic for ranking regressions. Existing guard.
24. Add daily-task benchmark cases. Implemented.
25. Add auth/JWT package intent. Implemented.
26. Add payments package intent. Implemented.
27. Add Redis/cache package intent. Implemented.
28. Add queue/worker package intent. Implemented.
29. Add LLM, PDF, email and logging package intent. Implemented.
30. Add future live corpus replay with anonymized queries. Next.

## Search improvements

1. Rank `requests` correctly for Python HTTP client tasks. Implemented.
2. Rank `undici` correctly for Node HTTP client tasks. Existing guard.
3. Rank `zod` correctly for TypeScript schema validation. Existing guard.
4. Rank `pydantic` correctly for Python schema validation. Existing guard.
5. Rank `pillow` correctly for Python image tasks. Existing guard.
6. Rank `playwright` for browser automation while blocking lifecycle decoys. Existing guard.
7. Rank Hugging Face embedding models above unsafe model decoys. Existing guard.
8. Rank safe Hugging Face datasets above loader-script decoys. Existing guard.
9. Rank MCP docs servers while blocking secret-scope MCP servers. Existing guard.
10. Rank canonical PyPI aliases above confusion names. Existing guard.
11. Rank canonical npm scoped SDKs above lookalike helpers. Existing guard.
12. Keep deprecated npm packages below maintained alternatives. Existing guard.
13. Keep package takeover timelines from becoming recommendations. Existing guard.
14. Keep source-repository mismatches below matching packages. Existing guard.
15. Block metadata instruction decoys across npm, PyPI, GitHub and Hugging Face. Existing guard.
16. Rank `jose` for modern Node JWT/auth tasks. Implemented.
17. Rank `stripe` for Node payments tasks. Implemented.
18. Rank `bullmq` for Node background jobs. Implemented.
19. Rank `redis` for Python cache tasks. Implemented.
20. Rank `openai` for TypeScript LLM SDK tasks. Implemented.
21. Rank `pypdf` for Python PDF parsing tasks. Implemented.
22. Rank `nodemailer` for Node email delivery tasks. Implemented.
23. Rank `structlog` for Python structured logging tasks. Implemented.
24. Add stronger OpenAI/LangChain package hints across npm and PyPI. Implemented.
25. Add stronger auth/security package hints across npm and PyPI. Implemented.
26. Add stronger observability/logging hints across npm and PyPI. Implemented.
27. Add stronger document/PDF hints across npm and PyPI. Implemented.
28. Penalize dataset/model/MCP/GitHub source mismatches in all-source searches. Implemented.
29. Add token coverage scoring for long human prompts. Implemented.
30. Expand benchmark from 28 to 36 fixed cases. Implemented.

## Verification command

Run:

```sh
pnpm search:benchmark
```

Current expected result:

```text
36/36 pass
MRR 1.0
recall@1 1.0
recall@3 1.0
blocked recommendations 0
```
