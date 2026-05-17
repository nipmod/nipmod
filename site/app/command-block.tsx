"use client";

import { useState } from "react";

type CommandBlockProps = {
  command: string;
  label?: string;
};

export function CommandBlock({ command, label = "Copy command" }: CommandBlockProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  async function copyCommand() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(command);
      } else {
        fallbackCopy(command);
      }
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
    window.setTimeout(() => setStatus("idle"), 1600);
  }

  const buttonText = status === "copied" ? "Copied" : status === "failed" ? "Failed" : "Copy";
  const statusText = status === "copied" ? "Copied" : status === "failed" ? "Copy failed" : "";

  return (
    <div className="command-block">
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
