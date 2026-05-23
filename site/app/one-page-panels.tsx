"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

export type OnePagePanelRow = {
  code?: string;
  label: string;
  text: string;
  title?: string;
};

export type OnePagePanel = {
  eyebrow: string;
  id: string;
  rows: OnePagePanelRow[];
  summary: string;
  title: string;
};

export function OnePagePanelDeck({ panels }: { panels: OnePagePanel[] }) {
  const [activePanel, setActivePanel] = useState<OnePagePanel | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!activePanel) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActivePanel(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activePanel]);

  const overlay = activePanel ? (
    <div
      className="one-page-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          setActivePanel(null);
        }
      }}
      role="presentation"
    >
      <section aria-labelledby={titleId} aria-modal="true" className="one-page-modal" role="dialog">
        <div className="one-page-modal-head">
          <div>
            <p className="eyebrow">{activePanel.eyebrow}</p>
            <h2 id={titleId}>{activePanel.title}</h2>
            <p>{activePanel.summary}</p>
          </div>
          <button aria-label="Close panel" onClick={() => setActivePanel(null)} type="button">
            Close
          </button>
        </div>

        <div className="one-page-modal-body">
          {activePanel.rows.map((row) => (
            <article className="one-page-modal-row" key={`${activePanel.id}-${row.label}-${row.title ?? row.code ?? row.text}`}>
              <span>{row.label}</span>
              <div>
                {row.title ? <h3>{row.title}</h3> : null}
                <p>{row.text}</p>
                {row.code ? (
                  <pre>
                    <code>{row.code}</code>
                  </pre>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  ) : null;

  return (
    <>
      <div className="one-page-card-grid">
        {panels.map((panel) => (
          <button className="one-page-card" key={panel.id} onClick={() => setActivePanel(panel)} type="button">
            <span>{panel.eyebrow}</span>
            <h2>{panel.title}</h2>
            <p>{panel.summary}</p>
            <strong>Open</strong>
          </button>
        ))}
      </div>

      {overlay ? createPortal(overlay, document.body) : null}
    </>
  );
}
