# Codex Next.js Auth Fixture

Use this tiny fixture to demo Nipmod inside Codex without touching a real app.

```bash
cd examples/codex-nextjs-auth
codex
```

Prompt:

```text
Find the best auth package for this Next.js repo and show the Nipmod install boundary before changing anything.
```

Expected behavior:

- Codex reads `package.json` as safe local context.
- Codex calls `nipmod.codex_preflight`.
- Nipmod returns a compact decision card plus `approvalGate`, `approvalPacket`, `actionPlan` and `agentHandoff`.
- `package.json` and lockfiles remain unchanged.
- Any install command is shown only as after-approval review data.

