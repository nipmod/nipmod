"use client";

import { useMemo, useState } from "react";

type DemoStatus = "idle" | "running" | "done" | "error";

type ExternalRecord = {
  description?: string;
  displayName?: string;
  id: string;
  name: string;
  originalUrl?: string;
  source: string;
  trust?: {
    decision?: string;
    risk?: string;
    score?: number;
    warnings?: string[];
  };
  version?: string;
};

type SearchResponse = {
  records?: ExternalRecord[];
  selection?: {
    recommendedId?: string | null;
  };
};

type InstallPlanResponse = {
  package?: {
    id?: string;
    name?: string;
    source?: string;
    trust?: {
      decision?: string;
      risk?: string;
      score?: number;
    };
  };
  plan?: {
    commands?: string[];
    requiresApprovalBeforeWrite?: boolean;
  };
  safety?: {
    blocked?: boolean;
    commandRisk?: string;
    warnings?: string[];
  };
  type?: string;
};

const sourceOptions = [
  { id: "npm", label: "npm" },
  { id: "pypi", label: "PyPI" },
  { id: "github", label: "GitHub" },
  { id: "huggingface-model", label: "HF models" },
  { id: "huggingface-dataset", label: "HF data" },
  { id: "mcp", label: "MCP" }
] as const;

const initialSources = sourceOptions.map((source) => source.id);

export function DemoRunner() {
  const [apiKey, setApiKey] = useState("");
  const [keyId, setKeyId] = useState("");
  const [query, setQuery] = useState("http client for node fetch");
  const [sources, setSources] = useState<string[]>(initialSources);
  const [selectedRecord, setSelectedRecord] = useState<ExternalRecord | null>(null);
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);
  const [inspectResponse, setInspectResponse] = useState<unknown>(null);
  const [installPlan, setInstallPlan] = useState<InstallPlanResponse | null>(null);
  const [approved, setApproved] = useState(false);
  const [status, setStatus] = useState<Record<string, DemoStatus>>({
    approval: "idle",
    inspect: "idle",
    key: "idle",
    plan: "idle",
    search: "idle"
  });
  const [message, setMessage] = useState("Ready. Use a non-private package task.");
  const [latestResponse, setLatestResponse] = useState<unknown>(null);

  const canSearch = apiKey.length > 0 && query.trim().length > 0 && sources.length > 0;
  const canInspect = apiKey.length > 0 && selectedRecord !== null;
  const canPlan = canInspect;
  const commands = useMemo(() => installPlan?.plan?.commands ?? [], [installPlan]);
  const planWarnings = useMemo(() => installPlan?.safety?.warnings ?? [], [installPlan]);

  async function issueKey() {
    setStatusValue("key", "running");
    setMessage("Issuing a free beta key.");
    try {
      const data = await requestJson<{ key?: string; keyId?: string; type?: string }>("/api/keys/beta", {
        body: JSON.stringify({ label: "public-demo" }),
        headers: { "content-type": "application/json" },
        method: "POST"
      });
      if (!data.key || !data.keyId) {
        throw new Error("Beta key response did not include a key.");
      }
      setApiKey(data.key);
      setKeyId(data.keyId);
      setLatestResponse({
        keyId: data.keyId,
        storage: "raw key returned once; demo keeps it in browser memory only",
        type: data.type
      });
      setStatusValue("key", "done");
      setMessage("Beta key issued. Search can run now.");
    } catch (error) {
      setStatusValue("key", "error");
      setMessage(readError(error));
    }
  }

  async function search() {
    if (!canSearch) {
      return;
    }
    setApproved(false);
    setInstallPlan(null);
    setInspectResponse(null);
    setSelectedRecord(null);
    setStatusValue("search", "running");
    setMessage("Searching public sources.");
    try {
      const params = new URLSearchParams({
        limit: "5",
        q: query.trim(),
        sources: sources.join(",")
      });
      const data = await requestJson<SearchResponse>(`/api/search?${params.toString()}`, {
        headers: keyHeaders(apiKey)
      });
      const records = Array.isArray(data.records) ? data.records.filter(isExternalRecord) : [];
      const recommended = records.find((record) => record.id === data.selection?.recommendedId) ?? records[0] ?? null;
      setSearchResponse(data);
      setSelectedRecord(recommended);
      setLatestResponse(data);
      setStatusValue("search", "done");
      setStatusValue("inspect", "idle");
      setStatusValue("plan", "idle");
      setStatusValue("approval", "idle");
      setMessage(recommended ? `Selected ${recommended.id} for inspection.` : "Search returned no candidate.");
    } catch (error) {
      setStatusValue("search", "error");
      setMessage(readError(error));
    }
  }

  async function inspect() {
    if (!canInspect || !selectedRecord) {
      return;
    }
    setApproved(false);
    setStatusValue("inspect", "running");
    setMessage(`Inspecting ${selectedRecord.id}.`);
    try {
      const params = new URLSearchParams({
        name: selectedRecord.name,
        source: selectedRecord.source
      });
      const data = await requestJson<{ record?: ExternalRecord }>(`/api/inspect?${params.toString()}`, {
        headers: keyHeaders(apiKey)
      });
      setInspectResponse(data);
      if (isExternalRecord(data.record)) {
        setSelectedRecord(data.record);
      }
      setLatestResponse(data);
      setStatusValue("inspect", "done");
      setMessage("Inspect complete. Request the install plan next.");
    } catch (error) {
      setStatusValue("inspect", "error");
      setMessage(readError(error));
    }
  }

  async function plan() {
    if (!canPlan || !selectedRecord) {
      return;
    }
    setApproved(false);
    setStatusValue("plan", "running");
    setMessage("Requesting install plan as review data.");
    try {
      const params = new URLSearchParams({
        name: selectedRecord.name,
        source: selectedRecord.source
      });
      const data = await requestJson<InstallPlanResponse>(`/api/install-plan?${params.toString()}`, {
        headers: keyHeaders(apiKey)
      });
      setInstallPlan(data);
      setLatestResponse(data);
      setStatusValue("plan", "done");
      setStatusValue("approval", "idle");
      setMessage(data.safety?.blocked ? "Plan returned blocked. Do not run this locally." : "Plan ready. Execution is still local approval only.");
    } catch (error) {
      setStatusValue("plan", "error");
      setMessage(readError(error));
    }
  }

  function markApproved() {
    if (!installPlan) {
      return;
    }
    setApproved(true);
    setStatusValue("approval", "done");
    setMessage("Approval marked in the demo only. Nipmod still did not execute anything.");
  }

  function toggleSource(source: string) {
    setSources((current) => {
      if (current.includes(source)) {
        return current.length === 1 ? current : current.filter((item) => item !== source);
      }
      return [...current, source];
    });
  }

  function setStatusValue(step: string, value: DemoStatus) {
    setStatus((current) => ({ ...current, [step]: value }));
  }

  return (
    <div className="demo-runner">
      <div className="demo-runner-panel">
        <div className="demo-input-grid">
          <label className="demo-field">
            <span>Package task</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="http client, vector database, image model"
            />
          </label>
          <div className="demo-field">
            <span>Sources</span>
            <div className="demo-source-list">
              {sourceOptions.map((source) => (
                <label key={source.id}>
                  <input checked={sources.includes(source.id)} onChange={() => toggleSource(source.id)} type="checkbox" />
                  <span>{source.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="demo-action-row">
          <button onClick={issueKey} type="button">1. Issue beta key</button>
          <button disabled={!canSearch} onClick={search} type="button">2. Search</button>
          <button disabled={!canInspect} onClick={inspect} type="button">3. Inspect</button>
          <button disabled={!canPlan} onClick={plan} type="button">4. Install plan</button>
          <button disabled={!installPlan || approved} onClick={markApproved} type="button">5. Mark approval</button>
        </div>

        <div className="demo-step-strip" aria-label="Demo progress">
          {[
            ["Key", status.key],
            ["Search", status.search],
            ["Inspect", status.inspect],
            ["Plan", status.plan],
            ["Approval", status.approval]
          ].map(([label, value]) => (
            <span className={`demo-step-state demo-step-state-${value}`} key={label}>
              {label}: {value}
            </span>
          ))}
        </div>
        <p className="demo-message">{message}</p>
        {keyId ? <p className="demo-note">Active demo key: {keyId}. Raw key is held only in this browser session.</p> : null}
      </div>

      <div className="demo-result-grid">
        <section>
          <h3>Selected record</h3>
          {selectedRecord ? (
            <dl className="demo-result-list">
              <div><dt>ID</dt><dd>{selectedRecord.id}</dd></div>
              <div><dt>Source</dt><dd>{selectedRecord.source}</dd></div>
              <div><dt>Name</dt><dd>{selectedRecord.name}</dd></div>
              <div><dt>Trust</dt><dd>{trustLine(selectedRecord)}</dd></div>
              {selectedRecord.originalUrl ? <div><dt>URL</dt><dd><a href={selectedRecord.originalUrl} rel="noreferrer" target="_blank">{selectedRecord.originalUrl}</a></dd></div> : null}
            </dl>
          ) : (
            <p>No record selected yet.</p>
          )}
        </section>

        <section>
          <h3>Install boundary</h3>
          {installPlan ? (
            <div className="demo-plan">
              <p>{installPlan.safety?.blocked ? "Blocked plan. Do not run locally." : "Review plan. Local approval still required."}</p>
              {commands.length ? (
                <pre><code>{commands.join("\n")}</code></pre>
              ) : null}
              {planWarnings.length ? <p>Warnings: {planWarnings.join("; ")}</p> : null}
              <p>Hosted API executes: no. Workspace writes: no.</p>
            </div>
          ) : (
            <p>No install plan requested yet.</p>
          )}
        </section>
      </div>

      <details className="demo-json-panel">
        <summary>Latest response</summary>
        <pre><code>{latestResponse ? JSON.stringify(latestResponse, null, 2) : "No response yet."}</code></pre>
      </details>
    </div>
  );
}

function keyHeaders(key: string) {
  return {
    "x-nipmod-api-key": key
  };
}

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!response.ok) {
    throw new Error(readApiError(data) ?? `Request failed with ${response.status}`);
  }
  return data as T;
}

function isExternalRecord(value: unknown): value is ExternalRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Partial<ExternalRecord>;
  return typeof record.id === "string" && typeof record.source === "string" && typeof record.name === "string";
}

function trustLine(record: ExternalRecord): string {
  const trust = record.trust;
  if (!trust) {
    return "not returned";
  }
  return [trust.score, trust.decision, trust.risk].filter((item) => item !== undefined && item !== null && item !== "").join(" / ");
}

function readError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function readApiError(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  return typeof record.error === "string" ? record.error : typeof record.message === "string" ? record.message : null;
}
