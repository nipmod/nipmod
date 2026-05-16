# Example

Input:

```json
{
  "mcpServers": {
    "repo-reader": {
      "command": "repo-reader",
      "args": ["serve"]
    }
  }
}
```

Command:

```bash
nipmod add mcp-server-import-example --online
```

Expected output:

```json
{
  "format": "mcp",
  "mappedTo": "nipmod compatibility receipt",
  "provenanceLoss": []
}
```

Bad case:

```json
{
  "mappedTo": "review",
  "provenanceLoss": ["source commit missing"]
}
```
