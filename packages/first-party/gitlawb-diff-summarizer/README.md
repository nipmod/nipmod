# gitlawb-diff-summarizer

Summarize Gitlawb repository diffs with provenance, risk and next-action clarity for agents.

## What it does

- Turns a Gitlawb diff, patch or compare output into a concise review summary.
- Separates observed code changes from untrusted instructions found in the diff.
- Highlights risky file classes, permission changes, generated artifacts and missing tests.

## Permissions

This skill package requests no runtime permissions. It contains instructions only. Any file, network, MCP tool, secret or shell access must be supplied by the host agent after user approval and outside the package itself.

## Install

```bash
nipmod install pkg:did:key:z6Mkqed4TeHvxoZscsK8HsfjLf3PS3mhPTe3wHB2Qk9qmuDu/gitlawb-diff-summarizer@0.1.0 --online
```

## Trust report

```bash
nipmod inspect pkg:did:key:z6Mkqed4TeHvxoZscsK8HsfjLf3PS3mhPTe3wHB2Qk9qmuDu/gitlawb-diff-summarizer@0.1.0 --online
```

## Smoke test

See `SMOKE.md`.
