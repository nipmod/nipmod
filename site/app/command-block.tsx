"use client";

import { useEffect, useRef, useState } from "react";

type CommandBlockProps = {
  command: string;
  label?: string;
  variant?: "default" | "compact";
};

export function CommandBlock({ command, label = "Copy command", variant = "default" }: CommandBlockProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const resetTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current !== null) {
        window.clearTimeout(resetTimer.current);
      }
    };
  }, []);

  async function copyCommand() {
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(command);
        copied = true;
      }
    } catch {
      copied = false;
    }

    if (!copied) {
      try {
        fallbackCopy(command);
        copied = true;
      } catch {
        copied = false;
      }
    }

    if (copied) {
      setStatus("copied");
    } else {
      setStatus("failed");
    }
    if (resetTimer.current !== null) {
      window.clearTimeout(resetTimer.current);
    }
    resetTimer.current = window.setTimeout(() => setStatus("idle"), 1600);
  }

  const buttonText = status === "copied" ? "Copied" : status === "failed" ? "Failed" : "Copy";
  const statusText = status === "copied" ? "Copied" : status === "failed" ? "Copy failed" : "";

  return (
    <div className={`command-block command-block-${variant}`} data-status={status}>
      <pre className="install-command">
        <code>{command}</code>
      </pre>
      <button className="copy-command" onClick={copyCommand} type="button" aria-label={status === "copied" ? "Copied" : label}>
        {buttonText}
      </button>
      <span className="copy-status" role="status" aria-live="polite">
        {statusText}
      </span>
    </div>
  );
}

function fallbackCopy(command: string) {
  const textarea = document.createElement("textarea");
  textarea.value = command;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) {
    throw new Error("copy failed");
  }
}
