# HTTP API Example

This example shows the API-first Nipmod flow an agent can use from any host that can make HTTPS requests.

```bash
node --experimental-strip-types examples/http-api/search.ts "http client"
```

For the fuller agent-style output with inspect data, source degradation, trust factors, install-plan safety and archive preview:

```bash
node --experimental-strip-types examples/http-api/agent-flow.ts "http client"
```

The same flow using only the Python standard library:

```bash
python3 examples/http-api/agent_flow.py "http client"
```

Flow:

1. Search packages.
2. Read `selection.recommendedId` and candidate gates.
3. Inspect the exact package.
4. Request an install plan.
5. Prepare an archive preview after useful discovery.
6. Show trust factors, rank reasons and safety warnings before approval.

The examples print plans only. They do not install anything, they do not read the caller workspace and they do not persist archive records.

Environment:

```bash
NIPMOD_API_BASE_URL=https://nipmod.com
```

Known exact records used by production canaries:

```bash
curl 'https://nipmod.com/api/inspect?source=npm&name=undici'
curl 'https://nipmod.com/api/inspect?source=pypi&name=requests'
curl 'https://nipmod.com/api/inspect?source=github&name=vercel/next.js'
curl 'https://nipmod.com/api/inspect?source=huggingface-model&name=google-bert/bert-base-uncased'
curl 'https://nipmod.com/api/inspect?source=huggingface-dataset&name=rajpurkar/squad'
curl 'https://nipmod.com/api/inspect?source=mcp&name=ac.tandem/docs-mcp'
```
