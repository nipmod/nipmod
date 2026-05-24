"use client";

import { FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";

type AdminSummary = Record<string, any>;

const SESSION_KEY = "nipmod.admin.key";

export function AdminDashboard() {
  const [adminKey, setAdminKey] = useState("");
  const [hours, setHours] = useState("24");
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setAdminKey(sessionStorage.getItem(SESSION_KEY) ?? "");
  }, []);

  const usage = summary?.usage ?? {};
  const totals = usage?.totals ?? {};
  const traffic = usage?.trafficSummary ?? {};
  const archive = summary?.archive ?? {};
  const keys = summary?.keys ?? {};
  const generatedAt = useMemo(() => formatDate(summary?.generatedAt), [summary?.generatedAt]);

  async function loadDashboard(event?: FormEvent) {
    event?.preventDefault();
    if (!adminKey.trim()) {
      setError("Admin key required.");
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

  function clearKey() {
    sessionStorage.removeItem(SESSION_KEY);
    setAdminKey("");
    setSummary(null);
  }

  return (
    <main className="admin-shell">
      <section className="admin-hero">
        <p className="admin-eyebrow">Private Ops</p>
        <h1>Nipmod admin dashboard.</h1>
        <p>API usage, archive growth, beta key activity and safety signals for internal launch monitoring.</p>
        <form className="admin-controls" onSubmit={loadDashboard}>
          <label>
            <span>Admin key</span>
            <input
              autoComplete="off"
              onChange={(event) => setAdminKey(event.target.value)}
              placeholder="nka_live_admin..."
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
              {loading ? "Loading" : "Refresh"}
            </button>
            <button className="button button-ghost button-small" onClick={clearKey} type="button">
              Clear
            </button>
          </div>
        </form>
        {error ? <p className="admin-error">{error}</p> : null}
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
          </section>

          <section className="admin-grid">
            <Panel title="Routes">
              <DataTable rows={usage.routes} columns={[["route", "Route"], ["requestCount", "Requests"], ["errorCount", "Errors"], ["avgDurationMs", "Avg ms"]]} />
            </Panel>
            <Panel title="Sources">
              <DataTable rows={usage.sources} columns={[["source", "Source"], ["requestCount", "Requests"]]} />
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
          </section>

          <section className="admin-wide">
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
              <DataTable
                rows={keys.recentKeys}
                columns={[
                  ["id", "Key ID"],
                  ["label", "Label"],
                  ["tier", "Tier"],
                  ["status", "Status"],
                  ["createdAt", "Created"]
                ]}
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

function Metric({ label, suffix, value }: { label: string; suffix?: string; value: unknown }) {
  return (
    <div className="admin-metric">
      <span>{label}</span>
      <strong>{formatNumber(value)}</strong>
      {suffix && value !== null && value !== undefined ? <em>{suffix}</em> : null}
    </div>
  );
}

function Panel({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="admin-panel">
      <h2>{title}</h2>
      {children}
    </section>
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
