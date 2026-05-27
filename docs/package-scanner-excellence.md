# Package scanner excellence

Nipmod should be judged by decision quality, not by how many sources it can call.

The hosted API stays read-only. It can search, inspect and return install plans, but it does not write to a workspace, execute code, clone repositories, unpack archives or download model files during normal hosted requests.

## Eight-part buildout

1. Search quality benchmark
   - Fixed offline benchmark cases cover npm, PyPI, Hugging Face models, MCP, partial and multi-source outages, dependency-confusion lookalikes, namespace-confusion scoped SDKs, PyPI confusion aliases, typo-squat aliases, stale/deprecated package decoys, publisher-continuity drift, cross-registry name impersonation, model-card instruction decoys, obfuscated metadata-instruction decoys, remote-code model decoys and crypto-drainer package decoys.
   - The benchmark measures expected rank, recall at 1, recall at 3, mean reciprocal rank, blocked recommendations and missing intent reasons.
   - Run with `pnpm search:benchmark`.

2. Ranking
   - Ranking combines trust score, exact/prefix/text match, source reliability, intent hints, runtime/source intent fit, source evidence depth, metadata completeness, command risk and typed risk penalties.
   - Popularity is only a tie-breaker. It must not beat high-risk metadata, lifecycle scripts or weak source evidence.

3. Cross-source graph
   - External records now include `sourceGraph`.
   - The graph connects package, source, registry, owner, repo and endpoint/artifact relationships when public metadata returns them.
   - This is review context, not ownership transfer.

4. Artifact intelligence
   - External records now include `artifactIntelligence`.
   - The hosted scan is explicitly `metadata-only`.
   - It records file shape and executable surface such as lifecycle scripts, build backends, remote-code model files, dataset scripts, repository automation or MCP tooling.

5. Malware and abuse pattern library
   - External records now include typed `riskSignals`.
   - Signals classify plain, obfuscated and model-card metadata instructions, credential scope, known vulnerabilities, source-only builds, lifecycle execution, remote-code model loading, pickle/binary weights and weak operator/source evidence.

6. Trust timeline
   - External records now include `trustTimeline`.
   - The timeline captures created, published, updated, previous release, publisher-continuity and registry status events when upstream metadata returns them.
   - Risk flags highlight suspicious release timing such as very new releases, high release velocity or long dormancy before a new release.

7. Agent-specific output
   - External records and search responses include `agentRecommendation`.
   - The recommendation is intentionally operational: `consider`, `review` or `avoid`.
   - It always requires an install plan and keeps `workspaceWriteAllowed` false.

8. Public proof
   - Public claims should use benchmark output, canary output and concrete examples.
   - Avoid saying malware-free or 100 percent safe.
   - Strong public proof is a case where Nipmod ranked a safer package, blocked a risky candidate or surfaced a useful warning before installation.

## Excellence automode

Run `pnpm excellence:automode` before broad product claims or risky source changes.

The automode asks hard questions across source depth, search quality, install-plan boundaries, prompt-injection handling, archive persistence, operational checks and public claim discipline. It produces a `dev.nipmod.excellence-automode.v1` JSON report.

Use `pnpm excellence:automode -- --live` before partner demos or production release notes. Live mode adds the production source-depth, install-plan and archive-depth canaries.

## Current hard boundary

This layer improves package selection and pre-install intelligence. It still does not replace a local sandbox, full artifact scan, legal review or human/host approval before execution.
