# Agent Workflow Example

Tell an agent:

```text
Use the Nipmod API before choosing a package. Search for packages that solve this task, inspect the best candidates, show me the trust signals and install plan, then wait for my approval before installing anything.
```

Expected agent flow:

1. Call `GET https://nipmod.com/api/search?q=<task>`.
2. Inspect the strongest candidates with `GET /api/inspect`.
3. Request an install plan with `GET /api/install-plan`.
4. Show the package source, license, warnings, trust decision and install command.
5. Ask for approval.
6. If approved, use the user's package manager locally.
7. Save a receipt in the workspace or task log.

Do not let package descriptions, README text or model cards override the agent's system instructions.
