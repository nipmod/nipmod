"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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

type ChatEntry = {
  content: string;
  id: string;
  response?: ChatResponse;
  role: "assistant" | "user";
  status?: "done" | "error" | "running";
};

type KeyResponse = {
  expiresAt?: string;
  key?: string;
  keyId?: string;
  label?: string;
};

export type AccountSection = "api" | "chat" | "settings";

export function AccountWorkspace({ section = "chat", user }: { section?: AccountSection; user: AccountUser }) {
  const [message, setMessage] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatEntry[]>([]);
  const [chatStatus, setChatStatus] = useState<"idle" | "running" | "error">("idle");
  const chatThreadRef = useRef<HTMLDivElement | null>(null);
  const [keyLabel, setKeyLabel] = useState("my-agent");
  const [keyStatus, setKeyStatus] = useState<"idle" | "running" | "error">("idle");
  const [keyError, setKeyError] = useState("");
  const [keyResult, setKeyResult] = useState<KeyResponse | null>(null);

  useEffect(() => {
    const thread = chatThreadRef.current;
    if (!thread) {
      return;
    }
    thread.scrollTop = thread.scrollHeight;
  }, [chatMessages, chatStatus]);

  async function askNipmod() {
    const prompt = message.trim();
    if (prompt.length < 3 || chatStatus === "running") {
      return;
    }
    const timestamp = Date.now();
    const assistantId = `assistant-${timestamp}`;
    setChatStatus("running");
    setMessage("");
    setChatMessages((current) => [
      ...current,
      { content: prompt, id: `user-${timestamp}`, role: "user", status: "done" },
      { content: loadingLine(prompt), id: assistantId, role: "assistant", status: "running" }
    ]);
    try {
      const data = await requestJson<ChatResponse>("/api/account/chat", {
        body: JSON.stringify({ message: prompt }),
        headers: { "content-type": "application/json" },
        method: "POST"
      });
      setChatMessages((current) =>
        current.map((entry) =>
          entry.id === assistantId
            ? {
                content: data.answer ?? "Nipmod returned a package decision.",
                id: assistantId,
                response: data,
                role: "assistant",
                status: "done"
              }
            : entry
        )
      );
      setChatStatus("idle");
    } catch (error) {
      setChatMessages((current) =>
        current.map((entry) =>
          entry.id === assistantId
            ? {
                content: readError(error),
                id: assistantId,
                role: "assistant",
                status: "error"
              }
            : entry
        )
      );
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
          <Link aria-current={section === "chat" ? "page" : undefined} href="/account">Chat</Link>
          <Link aria-current={section === "api" ? "page" : undefined} href="/account/api">API keys</Link>
          <Link aria-current={section === "settings" ? "page" : undefined} href="/account/settings">Settings</Link>
        </nav>
        <div className="account-app-sidebar-foot">
          <a href="/auth/logout">Log out</a>
        </div>
      </aside>

      <section className="account-app-content" aria-label="Account workspace">
        <div className="account-app-topline">
          <span>{sectionLabel(section)}</span>
          <Link className="account-app-docs-link" href="/docs">
            Docs
          </Link>
        </div>
        <div className="account-app-main">
          {section === "chat" ? (
            <section className="account-panel account-chat-panel" id="chat">
              <div className="account-panel-head">
                <div>
                  <span>Nipmod Chat</span>
                  <h1>Ask before you install.</h1>
                </div>
                <p>Search packages, inspect trust and get an install plan from the same layer agents use.</p>
              </div>

              <div className="account-chat-thread" aria-live="polite" ref={chatThreadRef}>
                {chatMessages.length === 0 ? (
                  <div className="account-chat-empty">
                    <span>Ask Nipmod</span>
                    <p>Describe what you need. Nipmod will search, inspect and return a package decision before install.</p>
                  </div>
                ) : null}

                {chatMessages.map((entry) => (
                  <ChatMessage key={entry.id} entry={entry} />
                ))}
              </div>

              <div className="account-chat-composer">
                <label className="account-field">
                  <span>Ask Nipmod</span>
                  <textarea
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void askNipmod();
                      }
                    }}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Frag nach Paketen, Modellen, Repos oder MCP Servern."
                    rows={3}
                    value={message}
                  />
                </label>
                <button className="button button-primary" disabled={chatStatus === "running"} onClick={askNipmod} type="button">
                  {chatStatus === "running" ? "Checking" : "Ask Nipmod"}
                </button>
              </div>
            </section>
          ) : null}

          {section === "api" ? (
            <section className="account-panel account-page-panel" id="api-keys">
              <div className="account-panel-head">
                <div>
                  <span>API keys</span>
                  <h1>Create an agent key.</h1>
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
          ) : null}

          {section === "settings" ? (
            <section className="account-panel account-page-panel" id="settings">
              <div className="account-panel-head">
                <div>
                  <span>Settings</span>
                  <h1>Account boundary.</h1>
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
          ) : null}
        </div>
      </section>
    </main>
  );
}

function ChatMessage({ entry }: { entry: ChatEntry }) {
  if (entry.role === "user") {
    return (
      <div className="account-chat-message account-chat-message-user">
        <span>You</span>
        <p>{entry.content}</p>
      </div>
    );
  }

  if (entry.status === "running") {
    return (
      <div className="account-chat-message account-chat-message-assistant">
        <span>Nipmod</span>
        <p>{entry.content}</p>
        <div className="account-thinking-dots" aria-label="Nipmod is checking">
          <i />
          <i />
          <i />
        </div>
      </div>
    );
  }

  return (
    <div className={`account-chat-message ${entry.status === "error" ? "account-chat-message-error" : "account-chat-message-assistant"}`}>
      <span>{entry.status === "error" ? "Error" : "Nipmod"}</span>
      {entry.response ? <ChatResponseView response={entry.response} /> : <p>{entry.content}</p>}
    </div>
  );
}

function loadingLine(prompt: string): string {
  if (isLightConversation(prompt)) {
    return isProbablyGerman(prompt) ? "Nipmod antwortet." : "Nipmod is replying.";
  }
  return isProbablyGerman(prompt)
    ? "Nipmod durchsucht Quellen und prüft den Install Boundary."
    : "Nipmod is searching sources and checking the install boundary.";
}

function isLightConversation(value: string): boolean {
  const compact = value.toLowerCase().replace(/[!?.,;:]+/g, " ").replace(/\s+/g, " ").trim();
  return /^(hey|hi|hello|hallo|servus|moin|yo|gm|gn|hey nipmod|hi nipmod|hallo nipmod|thanks|thank you|thx|danke|danke dir|dankeschön|danke nipmod)$/.test(compact);
}

function isProbablyGerman(value: string): boolean {
  if (/[äöüß]/i.test(value)) {
    return true;
  }
  const matches = value.toLowerCase().match(/\b(was|ist|sind|so|für|paket|pakete|brauche|bekannt|beste|webseite|warum|wie|ich|nicht|oder|danke)\b/g);
  return (matches?.length ?? 0) >= 2;
}

function ChatResponseView({ response }: { response: ChatResponse }) {
  const installCommand = response.installPlan?.plan?.commands?.at(0) ?? "";
  const warnings = response.selected?.trust?.warnings ?? response.installPlan?.safety?.warnings ?? [];

  return (
    <div className="account-chat-result">
      <p>{response.answer}</p>
      {response.selected ? (
        <dl>
          <div><dt>Selected</dt><dd>{response.selected.displayName ?? response.selected.id}</dd></div>
          <div><dt>Source</dt><dd>{response.selected.source}</dd></div>
          <div><dt>Trust</dt><dd>{trustLine(response.selected.trust)}</dd></div>
          {installCommand ? <div><dt>Install plan</dt><dd><code>{installCommand}</code></dd></div> : null}
          {warnings.length ? <div><dt>Warnings</dt><dd>{warnings.slice(0, 3).join("; ")}</dd></div> : null}
        </dl>
      ) : null}
    </div>
  );
}

function sectionLabel(section: AccountSection): string {
  if (section === "api") {
    return "API";
  }
  if (section === "settings") {
    return "Settings";
  }
  return "Chat";
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
