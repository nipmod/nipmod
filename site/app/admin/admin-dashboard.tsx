"use client";

import { FormEvent, type CSSProperties, type ReactNode, useEffect, useMemo, useState } from "react";

type AdminSummary = Record<string, any>;
type KeyManagementAction = "cleanup-stale-beta" | "pause" | "resume" | "revoke" | "update-label";

const SESSION_KEY = "nipmod.admin.key";

export function AdminDashboard() {
  const [adminKey, setAdminKey] = useState("");
  const [hours, setHours] = useState("24");
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [keyActionLoading, setKeyActionLoading] = useState<string | null>(null);
  const [labelDrafts, setLabelDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setAdminKey(sessionStorage.getItem(SESSION_KEY) ?? "");
  }, []);

  const usage = summary?.usage ?? {};
  const totals = usage?.totals ?? {};
  const traffic = usage?.trafficSummary ?? {};
  const archive = summary?.archive ?? {};
  const keys = summary?.keys ?? {};
  const keyActivity = summary?.keyActivity ?? {};
  const sourceQuality = summary?.sourceQuality ?? {};
  const generatedAt = useMemo(() => formatDate(summary?.generatedAt), [summary?.generatedAt]);
  const signedIn = Boolean(summary);

  useEffect(() => {
    const recentKeys = Array.isArray(keys.recentKeys) ? keys.recentKeys : [];
    const staleKeys = Array.isArray(keys.staleKeys) ? keys.staleKeys : [];
    setLabelDrafts((current) => {
      const next = { ...current };
      for (const key of [...recentKeys, ...staleKeys]) {
        if (typeof key?.id === "string" && typeof key?.label === "string") {
          next[key.id] = key.label;
        }
      }
      return next;
    });
  }, [keys.recentKeys, keys.staleKeys]);

  async function loadDashboard(event?: FormEvent) {
    event?.preventDefault();
    if (!adminKey.trim()) {
      setError("Admin password required.");
      return;
    }
    setLoading(true);
    setError(null);
    sessionStorage.setItem(SESSION_KEY, adminKey.trim());
    try {
      const response = await fetch(`/api/admin/summary?hours=${encodeURIComponent(hours)}&limit=12`, {
        headers: {
          authorization: `Bearer ${adminKey.trim()}`
        }
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error ?? `Request failed with ${response.status}`);
      }
      setSummary(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Dashboard request failed.");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    setAdminKey("");
    setNotice(null);
    setSummary(null);
    setLabelDrafts({});
  }

  async function manageKey(action: KeyManagementAction, keyId?: string, label?: string) {
    if (!adminKey.trim()) {
      setError("Admin password required.");
      return;
    }
    if (action !== "update-label") {
      const confirmed = window.confirm(
        action === "cleanup-stale-beta"
          ? "Revoke active self-serve beta keys older than 30 days?"
          : `${action === "pause" ? "Pause" : action === "resume" ? "Resume" : "Revoke"} ${keyId}?`
      );
      if (!confirmed) {
        return;
      }
    }
    if (action === "update-label" && !label?.trim()) {
      setError("Key label required.");
      return;
    }
    const loadingKey = `${action}:${keyId ?? "all"}`;
    setKeyActionLoading(loadingKey);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/keys", {
        body: JSON.stringify(
          action === "cleanup-stale-beta"
            ? { action, olderThanHours: 720 }
            : action === "update-label"
              ? { action, keyId, label: label?.trim() }
              : { action, keyId }
        ),
        headers: {
          authorization: `Bearer ${adminKey.trim()}`,
          "content-type": "application/json"
        },
        method: "POST"
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error ?? `Request failed with ${response.status}`);
      }
      setNotice(`${body.affectedCount ?? 0} key${body.affectedCount === 1 ? "" : "s"} updated by ${body.action ?? action}.`);
      await loadDashboard();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Key management request failed.");
    } finally {
      setKeyActionLoading(null);
    }
  }

  return (
    <main className="admin-shell">
      <section className="admin-hero">
        <p className="admin-eyebrow">Private Ops</p>
        <h1>Nipmod admin dashboard.</h1>
        <p>API usage, archive growth, beta key activity and safety signals for internal launch monitoring.</p>
        <form className="admin-controls" onSubmit={loadDashboard}>
          <label>
            <span>Admin login</span>
            <input
              autoComplete="off"
              onChange={(event) => setAdminKey(event.target.value)}
              placeholder="Enter admin password"
              type="password"
              value={adminKey}
            />
          </label>
          <label>
            <span>Window</span>
            <select onChange={(event) => setHours(event.target.value)} value={hours}>
              <option value="1">1 hour</option>
              <option value="24">24 hours</option>
              <option value="72">72 hours</option>
              <option value="168">7 days</option>
            </select>
          </label>
          <div className="admin-actions">
            <button className="button button-primary button-small" disabled={loading} type="submit">
              {loading ? (signedIn ? "Refreshing" : "Signing in") : signedIn ? "Refresh" : "Login"}
            </button>
            <button className="button button-ghost button-small" onClick={logout} type="button">
              {signedIn ? "Logout" : "Reset"}
            </button>
          </div>
        </form>
        {signedIn ? (
          <p className="admin-session">Logged in. The credential stays in this browser session only.</p>
        ) : (
          <p className="admin-login-help">Enter the admin password to open the internal dashboard.</p>
        )}
        {error ? <p className="admin-error">{error}</p> : null}
        {notice ? <p className="admin-notice">{notice}</p> : null}
        {generatedAt ? <p className="admin-generated">Generated {generatedAt}</p> : null}
      </section>

      {summary ? (
        <div className="admin-content">
          <section className="admin-stat-grid" aria-label="Usage summary">
            <Metric label="Requests" value={totals.requestCount} />
            <Metric label="External requests" value={traffic.externalRequestCount} />
            <Metric label="Internal checks" value={traffic.internalRequestCount} />
            <Metric label="Errors" value={totals.errorCount} />
            <Metric label="Clients" value={totals.clientCount} />
            <Metric label="Keyed callers" value={totals.keyCount} />
            <Metric label="Avg duration" suffix="ms" value={totals.avgDurationMs} />
            <Metric label="Legacy unknown" value={traffic.unknownLegacyRequestCount} />
            <Metric label="Archive records" value={archive.totalRecords} />
            <Metric label="Active keys" value={keys.activeCount} />
            <Metric label="Self serve beta keys" value={keys.selfServeBetaCount} />
            <Metric label="Stale beta keys" value={keys.staleBetaCount} />
            <Metric label="External active keys" value={keyActivity.externalKeyCount} />
          </section>

          <section className="admin-analytics-grid" aria-label="Visual analysis">
            <Panel
              description="HTTP requests received by Nipmod API routes in the selected window. This is the closest count to agent or client calls into Nipmod."
              title="Traffic mix"
            >
              <SplitBar
                segments={[
                  { label: "External", value: traffic.externalRequestCount },
                  { label: "Internal", value: traffic.internalRequestCount },
                  { label: "Legacy", value: traffic.unknownLegacyRequestCount }
                ]}
              />
              <RatioGrid
                rows={[
                  ["External share", percentLabel(traffic.externalRequestCount, totals.requestCount)],
                  ["Error rate", percentLabel(totals.errorCount, totals.requestCount)],
                  ["Keyed share", percentLabel(traffic.authenticatedRequestCount, traffic.externalRequestCount)],
                  ["Avg response", `${formatNumber(totals.avgDurationMs)}ms`]
                ]}
              />
            </Panel>
            <Panel description="Top API routes by received request count. One /api/search call is one route request." title="Route volume">
              <BarList labelKey="route" rows={usage.routes} valueKey="requestCount" />
            </Panel>
            <Panel
              description="Source touches are source-tagged API events, not unique users. One search can touch npm, PyPI, GitHub and more in the same request."
              title="Source touches"
            >
              <BarList labelKey="source" rows={usage.sources} valueKey="requestCount" valueLabel="touches" />
            </Panel>
            <Panel
              description="Static resolver depth by source. This shows where Nipmod has strong metadata and where agents still need extra review."
              title="Source quality"
            >
              <RatioGrid
                rows={[
                  ["Sources", sourceQuality.summary?.total],
                  ["Strong", sourceQuality.summary?.strong],
                  ["Moderate or better", sourceQuality.summary?.moderateOrBetter]
                ]}
              />
              <DataTable
                columns={[
                  ["source", "Source"],
                  ["coverage", "Coverage"],
                  ["resolverVersion", "Resolver"],
                  ["authConfigured", "Auth"]
                ]}
                rows={sourceQuality.profiles}
              />
            </Panel>
            <Panel description="Install-plan and archive outcomes from events that emitted those safety signals." title="Safety outcomes">
              <OutcomeBars
                rows={[
                  ["Install allowed", usage.installPlans?.allowedCount],
                  ["Install blocked", usage.installPlans?.blockedCount],
                  ["Archive stored", usage.archiveWrites?.storedCount],
                  ["Archive preview", usage.archiveWrites?.previewCount]
                ]}
              />
            </Panel>
            <Panel description="Trust decisions and risk bands emitted by inspect/search/install-plan flows." title="Trust signal mix">
              <BarList labelKey="decision" rows={usage.trustDecisions} valueKey="requestCount" />
              <BarList labelKey="risk" rows={usage.trustRisks} valueKey="requestCount" />
            </Panel>
            <Panel description="Operational key state. Stale beta means active self-serve beta key older than 30 days." title="Key health">
              <RatioGrid
                rows={[
                  ["Active keys", keys.activeCount],
                  ["Self serve beta", keys.selfServeBetaCount],
                  ["Stale beta", keys.staleBetaCount],
                  ["External active", keyActivity.externalKeyCount]
                ]}
              />
            </Panel>
            <Panel title="How to read these numbers">
              <DefinitionRows
                rows={[
                  ["Request", "One HTTP call to a Nipmod API route, for example /api/search or /api/install-plan."],
                  ["External request", "A public, beta or partner call. Admin, monitors and canaries are separated."],
                  ["Source touch", "A request tagged with a source. One request can count against several sources."],
                  ["Keyed caller", "Distinct key ids seen in usage events, not raw keys and not guaranteed unique humans."],
                  ["Client", "Privacy-limited client hash count. Raw IPs and user agents are not returned."]
                ]}
              />
            </Panel>
          </section>

          <section className="admin-grid">
            <Panel title="Routes">
              <DataTable rows={usage.routes} columns={[["route", "Route"], ["requestCount", "Requests"], ["errorCount", "Errors"], ["avgDurationMs", "Avg ms"]]} />
            </Panel>
            <Panel description="Counted as source touches. This can be higher than total requests because multi-source searches touch multiple sources." title="Sources">
              <DataTable rows={usage.sources} columns={[["source", "Source"], ["requestCount", "Touches"]]} />
            </Panel>
            <Panel title="Traffic origin">
              <DataTable rows={usage.trafficOrigins} columns={[["origin", "Origin"], ["requestCount", "Requests"]]} />
            </Panel>
            <Panel title="Traffic summary">
              <KeyValueRows
                rows={[
                  ["External", traffic.externalRequestCount],
                  ["Public", traffic.publicRequestCount],
                  ["Authenticated", traffic.authenticatedRequestCount],
                  ["Internal", traffic.internalRequestCount],
                  ["Legacy unknown", traffic.unknownLegacyRequestCount]
                ]}
              />
            </Panel>
            <Panel title="Trust decisions">
              <DataTable rows={usage.trustDecisions} columns={[["decision", "Decision"], ["requestCount", "Requests"]]} />
            </Panel>
            <Panel title="Trust risk">
              <DataTable rows={usage.trustRisks} columns={[["risk", "Risk"], ["requestCount", "Requests"]]} />
            </Panel>
            <Panel title="Install plans">
              <KeyValueRows
                rows={[
                  ["Observed", usage.installPlans?.observedCount],
                  ["Allowed", usage.installPlans?.allowedCount],
                  ["Blocked", usage.installPlans?.blockedCount]
                ]}
              />
            </Panel>
            <Panel title="Archive writes">
              <KeyValueRows
                rows={[
                  ["Observed", usage.archiveWrites?.observedCount],
                  ["Stored", usage.archiveWrites?.storedCount],
                  ["Previewed", usage.archiveWrites?.previewCount]
                ]}
              />
            </Panel>
            <Panel title="Archive sources">
              <DataTable rows={archive.sources} columns={[["source", "Source"], ["count", "Records"]]} />
            </Panel>
            <Panel title="Archive status">
              <DataTable rows={archive.statuses} columns={[["status", "Status"], ["count", "Records"]]} />
            </Panel>
            <Panel title="Archive trust bands">
              <DataTable rows={archive.trustBands} columns={[["label", "Score"], ["count", "Records"]]} />
            </Panel>
            <Panel title="Access tiers">
              <DataTable rows={usage.accessTiers} columns={[["tier", "Tier"], ["requestCount", "Requests"]]} />
            </Panel>
            <Panel title="API keys">
              <DataTable rows={keys.tiers} columns={[["tier", "Tier"], ["count", "Keys"]]} />
            </Panel>
            <Panel title="Errors">
              <DataTable rows={usage.errors} columns={[["code", "Code"], ["requestCount", "Requests"]]} />
            </Panel>
            <Panel title="External key activity">
              <KeyValueRows
                rows={[
                  ["Active external keys", keyActivity.externalKeyCount],
                  ["Admin key requests excluded", keyActivity.excludedAdminKeyRequestCount],
                  ["Stale beta keys", keys.staleBetaCount]
                ]}
              />
            </Panel>
            <Panel title="Source quality detail">
              <DataTable
                rows={sourceQuality.profiles}
                columns={[
                  ["source", "Source"],
                  ["coverage", "Coverage"],
                  ["searchDepth", "Search"],
                  ["inspectDepth", "Inspect"],
                  ["strengths", "Strengths"],
                  ["limitations", "Limits"]
                ]}
              />
            </Panel>
          </section>

          <section className="admin-wide">
            <Panel title="External key activity">
              <DataTable
                rows={keyActivity.rows}
                columns={[
                  ["keyId", "Key"],
                  ["label", "Label"],
                  ["tier", "Tier"],
                  ["status", "Status"],
                  ["requestCount", "Requests"],
                  ["successCount", "OK"],
                  ["errorCount", "Errors"],
                  ["lastSeenAt", "Last seen"],
                  ["routeSummary", "Routes"],
                  ["sourceSummary", "Sources"]
                ]}
              />
            </Panel>
            <Panel title="Recent archive records">
              <DataTable
                rows={archive.recentRecords}
                columns={[
                  ["source", "Source"],
                  ["displayName", "Package"],
                  ["status", "Status"],
                  ["trustScore", "Trust"],
                  ["updatedAt", "Updated"]
                ]}
              />
            </Panel>
            <Panel title="Recent keys">
              <div className="admin-panel-toolbar">
                <button
                  className="button button-ghost button-small"
                  disabled={keyActionLoading !== null}
                  onClick={() => manageKey("cleanup-stale-beta")}
                  type="button"
                >
                  {keyActionLoading === "cleanup-stale-beta:all" ? "Cleaning" : "Cleanup beta 30d"}
                </button>
              </div>
              <KeyManagementTable
                actionLoading={keyActionLoading}
                labelDrafts={labelDrafts}
                onLabelChange={(keyId, label) => setLabelDrafts((current) => ({ ...current, [keyId]: label }))}
                onAction={manageKey}
                rows={keys.recentKeys}
              />
            </Panel>
            <Panel title="Stale beta keys">
              <KeyManagementTable
                actionLoading={keyActionLoading}
                labelDrafts={labelDrafts}
                onLabelChange={(keyId, label) => setLabelDrafts((current) => ({ ...current, [keyId]: label }))}
                onAction={manageKey}
                rows={keys.staleKeys}
              />
            </Panel>
          </section>

          <section className="admin-notes">
            {(summary.notes ?? []).map((note: string) => (
              <p key={note}>{note}</p>
            ))}
          </section>
        </div>
      ) : null}
    </main>
  );
}

function KeyManagementTable({
  actionLoading,
  labelDrafts,
  onAction,
  onLabelChange,
  rows
}: {
  actionLoading: string | null;
  labelDrafts: Record<string, string>;
  onAction: (action: KeyManagementAction, keyId?: string, label?: string) => void;
  onLabelChange: (keyId: string, label: string) => void;
  rows: any[] | undefined;
}) {
  const safeRows = Array.isArray(rows) ? rows : [];
  if (safeRows.length === 0) {
    return <p className="admin-empty">No data yet.</p>;
  }
  return (
    <div className="admin-table-wrap">
      <table className="admin-table admin-key-table">
        <thead>
          <tr>
            <th>Key ID</th>
            <th>Label</th>
            <th>Tier</th>
            <th>Status</th>
            <th>Age</th>
            <th>Stale</th>
            <th>Created</th>
            <th>Manage</th>
          </tr>
        </thead>
        <tbody>
          {safeRows.map((row, index) => {
            const id = typeof row.id === "string" ? row.id : "";
            const active = row.status === "active";
            const paused = row.status === "paused";
            const labelDraft = id ? (labelDrafts[id] ?? row.label ?? "") : "";
            const labelChanged = id && typeof row.label === "string" && labelDraft !== row.label;
            return (
              <tr className={row.stale ? "admin-key-stale-row" : undefined} key={id || index}>
                <td>{formatCell(row.id)}</td>
                <td>
                  <input
                    aria-label={`Label for ${id || "key"}`}
                    className="admin-key-label-input"
                    disabled={!id || actionLoading !== null}
                    onChange={(event) => onLabelChange(id, event.target.value)}
                    value={labelDraft}
                  />
                </td>
                <td>{formatCell(row.tier)}</td>
                <td>{formatCell(row.status)}</td>
                <td>{row.ageDays === null || row.ageDays === undefined ? "0" : `${formatNumber(row.ageDays)}d`}</td>
                <td>{row.stale ? "yes" : ""}</td>
                <td>{formatCell(row.createdAt)}</td>
                <td>
                  <div className="admin-key-actions">
                    <button
                      className="button button-ghost button-small"
                      disabled={!labelChanged || actionLoading !== null || !id}
                      onClick={() => onAction("update-label", id, labelDraft)}
                      type="button"
                    >
                      {actionLoading === `update-label:${id}` ? "Saving" : "Save"}
                    </button>
                    <button
                      className="button button-ghost button-small"
                      disabled={!active || actionLoading !== null || !id}
                      onClick={() => onAction("pause", id)}
                      type="button"
                    >
                      {actionLoading === `pause:${id}` ? "Pausing" : "Pause"}
                    </button>
                    <button
                      className="button button-ghost button-small"
                      disabled={!paused || actionLoading !== null || !id}
                      onClick={() => onAction("resume", id)}
                      type="button"
                    >
                      {actionLoading === `resume:${id}` ? "Resuming" : "Resume"}
                    </button>
                    <button
                      className="button button-ghost button-small"
                      disabled={row.status === "revoked" || actionLoading !== null || !id}
                      onClick={() => onAction("revoke", id)}
                      type="button"
                    >
                      {actionLoading === `revoke:${id}` ? "Revoking" : "Revoke"}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Metric({ label, suffix, value }: { label: string; suffix?: string; value: unknown }) {
  return (
    <div className="admin-metric">
      <span>{label}</span>
      <strong>{formatNumber(value)}</strong>
      {suffix && value !== null && value !== undefined ? <em>{suffix}</em> : null}
    </div>
  );
}

function Panel({ children, description, title }: { children: ReactNode; description?: string; title: string }) {
  return (
    <section className="admin-panel">
      <h2>{title}</h2>
      {description ? <p className="admin-panel-description">{description}</p> : null}
      {children}
    </section>
  );
}

function BarList({
  labelKey,
  rows,
  valueKey,
  valueLabel = "requests"
}: {
  labelKey: string;
  rows: any[] | undefined;
  valueKey: string;
  valueLabel?: string;
}) {
  const safeRows = Array.isArray(rows) ? rows.slice(0, 8) : [];
  const max = Math.max(...safeRows.map((row) => asNumber(row?.[valueKey])), 0);
  if (safeRows.length === 0 || max === 0) {
    return <p className="admin-empty">No data yet.</p>;
  }
  return (
    <div className="admin-bar-list">
      {safeRows.map((row, index) => {
        const label = formatCell(row?.[labelKey]);
        const value = asNumber(row?.[valueKey]);
        return (
          <div className="admin-bar-row" key={`${label}-${index}`}>
            <div className="admin-bar-row-head">
              <span>{label}</span>
              <strong>
                {formatNumber(value)} {valueLabel}
              </strong>
            </div>
            <div className="admin-bar-track" aria-hidden="true">
              <span style={{ "--bar-width": `${Math.max(4, Math.round((value / max) * 100))}%` } as CSSProperties} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SplitBar({ segments }: { segments: Array<{ label: string; value: unknown }> }) {
  const safeSegments = segments.map((segment) => ({ ...segment, value: asNumber(segment.value) })).filter((segment) => segment.value > 0);
  const total = safeSegments.reduce((sum, segment) => sum + segment.value, 0);
  if (total === 0) {
    return <p className="admin-empty">No data yet.</p>;
  }
  return (
    <div className="admin-split-chart">
      <div className="admin-split-bar" aria-hidden="true">
        {safeSegments.map((segment, index) => (
          <span
            className={`admin-split-segment admin-split-segment-${index % 4}`}
            key={segment.label}
            style={{ "--segment-width": `${(segment.value / total) * 100}%` } as CSSProperties}
          />
        ))}
      </div>
      <div className="admin-split-legend">
        {safeSegments.map((segment, index) => (
          <div key={segment.label}>
            <span className={`admin-split-dot admin-split-segment-${index % 4}`} />
            <strong>{segment.label}</strong>
            <em>
              {formatNumber(segment.value)} · {percentLabel(segment.value, total)}
            </em>
          </div>
        ))}
      </div>
    </div>
  );
}

function OutcomeBars({ rows }: { rows: Array<[string, unknown]> }) {
  const max = Math.max(...rows.map(([, value]) => asNumber(value)), 0);
  if (max === 0) {
    return <p className="admin-empty">No data yet.</p>;
  }
  return (
    <div className="admin-outcome-bars">
      {rows.map(([label, value]) => {
        const number = asNumber(value);
        return (
          <div className="admin-outcome-row" key={label}>
            <span>{label}</span>
            <div className="admin-outcome-track" aria-hidden="true">
              <span style={{ "--bar-width": `${Math.max(4, Math.round((number / max) * 100))}%` } as CSSProperties} />
            </div>
            <strong>{formatNumber(number)}</strong>
          </div>
        );
      })}
    </div>
  );
}

function RatioGrid({ rows }: { rows: Array<[string, unknown]> }) {
  return (
    <dl className="admin-ratio-grid">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{formatNumber(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function DefinitionRows({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="admin-definition-list">
      {rows.map(([term, definition]) => (
        <div key={term}>
          <dt>{term}</dt>
          <dd>{definition}</dd>
        </div>
      ))}
    </dl>
  );
}

function DataTable({ columns, rows }: { columns: Array<[string, string]>; rows: any[] | undefined }) {
  const safeRows = Array.isArray(rows) ? rows : [];
  if (safeRows.length === 0) {
    return <p className="admin-empty">No data yet.</p>;
  }
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {columns.map(([, label]) => (
              <th key={label}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {safeRows.map((row, index) => (
            <tr key={row.id ?? row.label ?? row.route ?? row.source ?? row.origin ?? row.tier ?? index}>
              {columns.map(([key]) => (
                <td key={key}>{formatCell(row[key])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KeyValueRows({ rows }: { rows: Array<[string, unknown]> }) {
  return (
    <dl className="admin-kv">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{formatNumber(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function formatCell(value: unknown): string {
  if (typeof value === "string" && value.includes("T") && Number.isFinite(Date.parse(value))) {
    return formatDate(value);
  }
  return formatNumber(value);
}

function formatDate(value: unknown): string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    return "";
  }
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function percentLabel(part: unknown, total: unknown): string {
  const denominator = asNumber(total);
  if (denominator <= 0) {
    return "0%";
  }
  return `${Math.round((asNumber(part) / denominator) * 100)}%`;
}

function formatNumber(value: unknown): string {
  if (typeof value === "number") {
    return new Intl.NumberFormat("en").format(value);
  }
  if (typeof value === "string") {
    return value;
  }
  if (value === null || value === undefined) {
    return "0";
  }
  return String(value);
}
