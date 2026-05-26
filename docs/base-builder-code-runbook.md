# Base Builder Code runbook

Status: operator checklist, not a claim of Base approval

## Current position

Nipmod is a read-only package intelligence API. It does not send transactions, hold wallet keys, sign messages, create approval links or append Builder Codes from hosted package intelligence calls.

The Base Builder Code is registered for future attribution, but attribution becomes active only when Nipmod directly participates in onchain actions, paid x402 flows or a partner flow that can attribute transactions to a builder.

## Registered code

```text
Builder Code: bc_vu9r71xi
ERC-8021 data suffix: 0x62635f76753972373178690b0080218021802180218021802180218021
```

## Checklist

1. Keep the homepage verification meta tag live.
2. Confirm the Base app verification flow in the Base dashboard before public claims.
3. Keep the registered Builder Code visible in the operator runbook and Base preflight spec.
4. Do not present the Builder Code as live transaction attribution while Nipmod remains read-only.
5. Do not modify API responses to suggest onchain attribution while the hosted API is read-only.
6. If Nipmod later adds an onchain or x402 action path, add Builder Code attribution only at the transaction-building layer.
7. After attribution exists, verify counts through Base dashboard and a block explorer before posting metrics.

## Public wording

Safe:

> Nipmod is ready as a read-only package preflight for Base agents.

> Nipmod is building toward Base ecosystem compatibility and has a public Base agent preflight path.

> Nipmod has registered a Base Builder Code for future attribution. The current hosted API remains read-only and does not append transaction data.

Avoid until confirmed:

> Official Base partner.

> Listed by Base.

> Base-approved safety layer.

> Builder Code attribution is live on transactions.

## Why this matters

Base MCP gives agents an onchain action surface. Nipmod belongs before the action, where an agent decides whether an SDK, CLI, package, MCP server or repo is worth trusting before it enters the workspace.
