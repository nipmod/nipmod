# HTTP API Example

This example shows the API-first Nipmod flow an agent can use from any host that can make HTTPS requests.

```bash
node --experimental-strip-types examples/http-api/search.ts "http client"
```

For the fuller agent-style output with inspect data, source degradation, trust factors, a reusable `PackageDecision`, install-plan safety and archive preview:

```bash
node --experimental-strip-types examples/http-api/agent-flow.ts --issue-key "http client"
```

The same flow using only the Python standard library:

```bash
python3 examples/http-api/agent_flow.py --issue-key "http client"
```

Flow:

1. Search packages.
2. Read `selection.recommendedId` and candidate gates.
3. Inspect the exact package.
4. POST `/api/decision` for the portable recommendation, risks, evidence, alternatives, execution plan, receipt and agent boundary.
5. Request an install plan.
6. Prepare an archive preview after useful discovery.
7. Show trust factors, rank reasons and safety warnings before approval.

The examples print plans only. They do not install anything, they do not read the caller workspace and they do not persist archive records.

One-call decision form:

```bash
curl -X POST 'https://nipmod.com/api/decision' \
  -H 'content-type: application/json' \
  -H 'x-nipmod-api-key: <key>' \
  -d '{"query":"http client","sources":["npm","pypi","github"],"limit":5}'
```

Environment:

```bash
NIPMOD_API_BASE_URL=https://nipmod.com
NIPMOD_API_KEY=<key>
```

If `NIPMOD_API_KEY` is absent, pass `--issue-key` to request a self-service beta key for the example run. The examples do not print the raw key.

Known exact records used by production canaries:

```bash
curl 'https://nipmod.com/api/inspect?source=npm&name=undici' -H 'x-nipmod-api-key: <key>'
curl 'https://nipmod.com/api/inspect?source=pypi&name=requests' -H 'x-nipmod-api-key: <key>'
curl 'https://nipmod.com/api/inspect?source=cratesio&name=reqwest' -H 'x-nipmod-api-key: <key>'
curl 'https://nipmod.com/api/inspect?source=go&name=github.com/gin-gonic/gin' -H 'x-nipmod-api-key: <key>'
curl 'https://nipmod.com/api/inspect?source=maven&name=com.fasterxml.jackson.core:jackson-databind' -H 'x-nipmod-api-key: <key>'
curl 'https://nipmod.com/api/inspect?source=github&name=vercel/next.js' -H 'x-nipmod-api-key: <key>'
curl 'https://nipmod.com/api/inspect?source=huggingface-model&name=google-bert/bert-base-uncased' -H 'x-nipmod-api-key: <key>'
curl 'https://nipmod.com/api/inspect?source=huggingface-dataset&name=rajpurkar/squad' -H 'x-nipmod-api-key: <key>'
curl 'https://nipmod.com/api/inspect?source=mcp&name=ac.tandem/docs-mcp' -H 'x-nipmod-api-key: <key>'
```
