# prompt-injection-scan

Scan package docs, prompts and examples for instruction smuggling before agents reuse them.

## What it does

- Finds text that tries to override system, developer or user instructions.
- Flags hidden exfiltration requests, tool-use pressure and false authority claims.
- Produces a risk report an agent can quote without executing the content.

## Permissions

This skill package requests no runtime permissions. It contains instructions only. Any file, network, MCP tool, secret or shell access must be supplied by the host agent after user approval and outside the package itself.

## Install

```bash
nipmod install pkg:did:key:z6MkhS4uoDPQXWM6Be3p1nryphmQ1GDQrGVqyHuyqaSs2XWv/prompt-injection-scan@0.1.0 --online
```

## Trust report

```bash
nipmod inspect pkg:did:key:z6MkhS4uoDPQXWM6Be3p1nryphmQ1GDQrGVqyHuyqaSs2XWv/prompt-injection-scan@0.1.0 --online
```

## Smoke test

See `SMOKE.md`.
