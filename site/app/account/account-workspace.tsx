"use client";

import { useMemo, useState } from "react";
import type { AccountUser } from "../../lib/account-auth";

type ChatResponse = {
  answer?: string;
  installPlan?: {
    plan?: {
      commands?: string[];
    };
    safety?: {
      blocked?: boolean;
      warnings?: string[];
    };
  };
  records?: Array<{
    displayName?: string;
    id: string;
    source: string;
    trust?: {
      decision?: string;
      risk?: string;
      score?: number;
    };
  }>;
  selected?: {
    displayName?: string;
    id: string;
    originalUrl?: string;
    source: string;
    trust?: {
      decision?: string;
      risk?: string;
      score?: number;
      warnings?: string[];
    };
  };
};

type ChatTrust = NonNullable<ChatResponse["selected"]>["trust"];

type KeyResponse = {
  expiresAt?: string;
  key?: string;
  keyId?: string;
  label?: string;
};

export function AccountWorkspace({ user }: { user: AccountUser }) {
  const [message, setMessage] = useState("I need a lightweight React chart library");
  const [chatStatus, setChatStatus] = useState<"idle" | "running" | "error">("idle");
  const [chatError, setChatError] = useState("");
  const [chat, setChat] = useState<ChatResponse | null>(null);
  const [keyLabel, setKeyLabel] = useState("my-agent");
  const [keyStatus, setKeyStatus] = useState<"idle" | "running" | "error">("idle");
  const [keyError, setKeyError] = useState("");
  const [keyResult, setKeyResult] = useState<KeyResponse | null>(null);

  const installCommand = useMemo(() => chat?.installPlan?.plan?.commands?.at(0) ?? "", [chat]);
  const warnings = useMemo(() => chat?.selected?.trust?.warnings ?? chat?.installPlan?.safety?.warnings ?? [], [chat]);

  async function askNipmod() {
    if (message.trim().length < 3) {
      return;
    }
    setChatStatus("running");
    setChatError("");
    try {
      const data = await requestJson<ChatResponse>("/api/account/chat", {
        body: JSON.stringify({ message }),
        headers: { "content-type": "application/json" },
        method: "POST"
      });
      setChat(data);
      setChatStatus("idle");
    } catch (error) {
      setChatError(readError(error));
      setChatStatus("error");
    }
  }

  async function createKey() {
    setKeyStatus("running");
    setKeyError("");
    try {
      const data = await requestJson<KeyResponse>("/api/account/keys", {
        body: JSON.stringify({ label: keyLabel }),
        headers: { "content-type": "application/json" },
        method: "POST"
      });
      setKeyResult(data);
      setKeyStatus("idle");
    } catch (error) {
      setKeyError(readError(error));
      setKeyStatus("error");
    }
  }

  async function copyKey() {
    if (!keyResult?.key) {
      return;
    }
    await navigator.clipboard.writeText(keyResult.key);
  }

  return (
    <main className="account-app-shell" id="main">
      <aside className="account-app-sidebar" aria-label="Account navigation">
        <div className="account-app-identity">
          <span>Nipmod</span>
          <strong>{user.name ?? user.email ?? "Account"}</strong>
          <small>{user.email ?? user.provider ?? user.id}</small>
        </div>
        <nav className="account-app-nav">
          <a href="#chat">Chat</a>
          <a href="#api-keys">API keys</a>
          <a href="#settings">Settings</a>
        </nav>
        <div className="account-app-sidebar-foot">
          <a href="/auth/logout">Log out</a>
        </div>
      </aside>

      <div className="account-app-main">
        <section className="account-panel account-chat-panel" id="chat">
          <div className="account-panel-head">
            <div>
              <span>Nipmod Chat</span>
              <h1>Ask before you install.</h1>
            </div>
            <p>Search packages, inspect trust and get an install plan from the same layer agents use.</p>
          </div>
          <label className="account-field">
            <span>Question</span>
            <textarea
              onChange={(event) => setMessage(event.target.value)}
              rows={5}
              value={message}
            />
          </label>
          <div className="account-action-row">
            <button className="button button-primary" disabled={chatStatus === "running"} onClick={askNipmod} type="button">
              {chatStatus === "running" ? "Checking" : "Ask Nipmod"}
            </button>
            {chatError ? <p>{chatError}</p> : null}
          </div>
          {chat ? (
            <div className="account-chat-result">
              <p>{chat.answer}</p>
              {chat.selected ? (
                <dl>
                  <div><dt>Selected</dt><dd>{chat.selected.displayName ?? chat.selected.id}</dd></div>
                  <div><dt>Source</dt><dd>{chat.selected.source}</dd></div>
                  <div><dt>Trust</dt><dd>{trustLine(chat.selected.trust)}</dd></div>
                  {installCommand ? <div><dt>Install plan</dt><dd><code>{installCommand}</code></dd></div> : null}
                  {warnings.length ? <div><dt>Warnings</dt><dd>{warnings.slice(0, 3).join("; ")}</dd></div> : null}
                </dl>
              ) : null}
            </div>
          ) : null}
        </section>

        <div className="account-app-grid">
          <section className="account-panel" id="api-keys">
            <div className="account-panel-head">
              <div>
                <span>API keys</span>
                <h2>Create an agent key.</h2>
              </div>
              <p>Keys are for agents and integrations. The raw key is shown once.</p>
            </div>
            <label className="account-field">
              <span>Key label</span>
              <input onChange={(event) => setKeyLabel(event.target.value)} value={keyLabel} />
            </label>
            <div className="account-action-row">
              <button className="button button-secondary button-small" disabled={keyStatus === "running"} onClick={createKey} type="button">
                {keyStatus === "running" ? "Creating" : "Create API key"}
              </button>
              {keyError ? <p>{keyError}</p> : null}
            </div>
            {keyResult?.key ? (
              <div className="account-key-box">
                <span>{keyResult.keyId}</span>
                <code>{keyResult.key}</code>
                <button className="button button-secondary button-small" onClick={copyKey} type="button">Copy key</button>
                <p>Save it now. Nipmod stores only the keyed hash, not the raw key.</p>
              </div>
            ) : null}
          </section>

          <section className="account-panel" id="settings">
            <div className="account-panel-head">
              <div>
                <span>Settings</span>
                <h2>Account boundary.</h2>
              </div>
              <p>Your account can create agent keys. Hosted Nipmod still does not write to workspaces.</p>
            </div>
            <div className="account-user-line">
              <strong>{user.name ?? user.email ?? "Signed in"}</strong>
              <span>{user.email ?? user.provider ?? user.id}</span>
            </div>
            <dl className="account-settings-list">
              <div><dt>Hosted writes</dt><dd>0</dd></div>
              <div><dt>Raw API key storage</dt><dd>shown once only</dd></div>
              <div><dt>Execution</dt><dd>outside hosted API</dd></div>
            </dl>
            <a className="button button-secondary button-small account-logout-button" href="/auth/logout">Log out</a>
          </section>
        </div>
      </div>
    </main>
  );
}

async function requestJson<T>(input: string, init: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!response.ok) {
    throw new Error(readApiError(data) ?? `Request failed with ${response.status}`);
  }
  return data as T;
}

function trustLine(trust: ChatTrust): string {
  if (!trust) {
    return "not returned";
  }
  const parts = [trust.score, trust.decision, trust.risk].filter((item) => item !== undefined && item !== null && item !== "");
  return parts.join(" / ");
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
