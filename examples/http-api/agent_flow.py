#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import sys
import urllib.parse
import urllib.request


BASE_URL = os.environ.get("NIPMOD_API_BASE_URL", "https://nipmod.com").rstrip("/")
SOURCES = "npm,pypi,github,huggingface-model,huggingface-dataset,mcp"


def main() -> None:
    task = " ".join(sys.argv[1:]).strip() or "http client"
    search = read_json("/api/search", {"q": task, "sources": SOURCES, "limit": "5"})
    selected = first_record(search)

    if selected is None:
        print(json.dumps({"task": task, "result": "no package records returned"}, indent=2))
        return

    inspect = read_json("/api/inspect", {"source": selected["source"], "name": selected["name"]})
    record = inspect.get("record") or selected
    plan = read_json("/api/install-plan", {"source": record["source"], "name": record["name"]})
    archive = read_json("/api/archive/prepare", {"source": record["source"], "name": record["name"]})

    output = {
        "task": task,
        "agentInstruction": "Search Nipmod, inspect the selected package and show the install plan before any workspace write.",
        "sourceHealth": {
            "partial": search.get("partial"),
            "summary": search.get("sourceSummary"),
            "degraded": degraded_sources(search),
        },
        "selection": {
            "policy": search.get("selection", {}).get("policy"),
            "recommendedId": search.get("selection", {}).get("recommendedId"),
            "candidates": search.get("selection", {}).get("candidates", [])[:3],
        },
        "selected": {
            "id": record.get("id"),
            "name": record.get("name"),
            "source": record.get("source"),
            "originalUrl": record.get("originalUrl"),
            "trust": {
                "decision": record.get("trust", {}).get("decision"),
                "score": record.get("trust", {}).get("score"),
                "dimensions": record.get("trust", {}).get("dimensions"),
                "warnings": record.get("trust", {}).get("warnings"),
            },
        },
        "installPlan": plan.get("plan"),
        "safety": plan.get("safety"),
        "approvalBoundary": {
            "hostedApiExecutesCommands": False,
            "hostedApiWritesCallerWorkspace": False,
            "localHostMustApproveBeforeWrite": plan.get("plan", {}).get("requiresApprovalBeforeWrite") is True,
        },
        "archivePreview": {
            "status": (archive.get("record") or {}).get("status") or (archive.get("receipt") or {}).get("archiveStatus"),
            "stored": (archive.get("receipt") or {}).get("stored", False),
            "receiptType": (archive.get("receipt") or {}).get("type"),
            "writeBoundary": "prepare-only; durable confirm requires x-nipmod-archive-token",
        },
    }
    print(json.dumps(output, indent=2))


def read_json(path: str, params: dict[str, str]) -> dict:
    query = urllib.parse.urlencode(params)
    request = urllib.request.Request(
        f"{BASE_URL}{path}?{query}",
        headers={
            "accept": "application/json",
            "user-agent": "nipmod-python-agent-flow-example/1.0",
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{path} failed with {error.code}: {body}") from error


def first_record(search: dict) -> dict | None:
    records = search.get("records")
    if not isinstance(records, list) or not records:
        return None
    recommended_id = search.get("selection", {}).get("recommendedId")
    for record in records:
        if isinstance(record, dict) and record.get("id") == recommended_id:
            return record
    return records[0] if isinstance(records[0], dict) else None


def degraded_sources(search: dict) -> list[dict]:
    reports = search.get("sourceReports")
    if not isinstance(reports, list):
        return []
    degraded = []
    for report in reports:
        if not isinstance(report, dict) or report.get("status") != "failed":
            continue
        error = report.get("error") if isinstance(report.get("error"), dict) else {}
        recovery = report.get("recovery") if isinstance(report.get("recovery"), dict) else {}
        degraded.append(
            {
                "source": report.get("source"),
                "code": error.get("code"),
                "retryable": recovery.get("retryable"),
                "suggestedAction": recovery.get("suggestedAction"),
            }
        )
    return degraded


if __name__ == "__main__":
    main()
