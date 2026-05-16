# External Evidence Ledger

This ledger tracks external adoption and review receipts without secrets.

## Current Count

- first user receipts: `0`
- package author dry run receipts: `0`
- external packages accepted: `0`
- signed independent reviews: `0`

## Receipt Rules

- redact secrets, tokens, local private paths and unrelated data
- keep OS, tool versions, command names and package names
- include whether the user allowed anonymous quotes
- never count page views as adoption

## Receipt Template

```text
Receipt id:
Date:
Persona:
Package:
Commands completed:
Result:
Blocker:
Anonymous quote allowed:
Redacted evidence:
```
