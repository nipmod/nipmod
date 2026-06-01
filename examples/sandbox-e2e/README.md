# Sandbox Audit E2E

This example shows the local approval path for an agent host:

```text
Decision -> local sandbox audit -> saved receipt -> rechecked approval gate -> user approval
```

The hosted Nipmod API stays read-only. Package bytes, source snapshots and runtime checks stay in the local host.

## 1. Create a decision request

```bash
printf '%s\n' '{"query":"package for parsing PDFs in Node","sources":["npm","pypi"],"limit":5}' > decision-request.json
```

## 2. Fetch the package decision

```bash
curl -X POST 'https://nipmod.com/api/decision' \
  -H 'content-type: application/json' \
  -H "x-nipmod-api-key: $NIPMOD_API_KEY" \
  --data-binary @decision-request.json \
  > decision.json
```

Check these fields before going further:

- `recommended.id`
- `integrity.decisionSha256`
- `sandboxPlan.analysisCache.policyKey`
- `approvalGate.status`

## 3. Audit the exact local target

Run this against the artifact or source snapshot the agent would use locally:

```bash
nipmod sandbox-audit <artifact-or-source-path> \
  --decision decision.json \
  --target-confirmed \
  --json \
  > sandbox-receipt.json
```

The audit result should include a content hash, policy hash, cache key, decision binding result, sandbox verdict and execution gate status.

## 4. Store the receipt summary

Create the receipt-store request:

```bash
node examples/sandbox-e2e/build-receipt-request.mjs decision.json sandbox-receipt.json receipt-request.json
```

Send it with an account-created API key:

```bash
curl -X POST 'https://nipmod.com/api/sandbox-audit-receipts' \
  -H 'content-type: application/json' \
  -H "x-nipmod-api-key: $NIPMOD_API_KEY" \
  --data-binary @receipt-request.json
```

Nipmod stores receipt hashes, validation checks, target hashes, verdict and approval state. It does not store local paths, raw package bytes or raw API keys.

## 5. Recheck the decision

```bash
curl -X POST 'https://nipmod.com/api/decision' \
  -H 'content-type: application/json' \
  -H "x-nipmod-api-key: $NIPMOD_API_KEY" \
  --data-binary @decision-request.json
```

The response can now show:

- `sandboxApproval.status: saved`
- `sandboxApproval.approvalAllowed: true`
- `approvalGate.canAskUserForApproval: true`

That still is not automatic execution. It means the host can ask the user or local policy for explicit approval.

## Runtime observation

Runtime checks are separate from static audit:

```bash
nipmod sandbox-runtime <artifact-or-source-path> \
  --decision decision.json \
  --target-confirmed \
  --confirm-runtime \
  -- <command>
```

Use runtime observation only after a passing static receipt and explicit approval. Keep network deny-by-default and secrets unavailable unless a host policy deliberately changes that.

