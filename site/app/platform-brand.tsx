type PlatformMarkProps = {
  id: string;
  name: string;
};

const IMAGE_MARKS: Record<string, { className?: string; src: string }> = {
  bankr: { src: "/bankr-logo.svg" },
  "claude-code": { src: "https://cdn.simpleicons.org/claude/D97757" },
  cursor: { src: "https://cdn.simpleicons.org/cursor/FFFFFF" },
  github: { className: "platform-mark-github", src: "/github-logo.svg" },
  gitlawb: { src: "/gitlawb-logo.png" },
  hermes: { src: "https://hermes-agent.nousresearch.com/docs/img/logo.png" },
  mcp: { src: "https://cdn.simpleicons.org/modelcontextprotocol/FFFFFF" },
  opencode: { className: "platform-mark-opencode", src: "https://opencode.ai/_build/assets/preview-opencode-logo-light-B5i-Y4z2.png" }
};

const TEXT_MARKS: Record<string, string> = {
  aeon: "ae",
  codex: "Cx"
};

export function PlatformMark({ id, name }: PlatformMarkProps) {
  const image = IMAGE_MARKS[id];

  if (image) {
    return (
      <span className="platform-mark" aria-hidden="true">
        <img alt="" className={image.className} src={image.src} />
      </span>
    );
  }

  return (
    <span className={`platform-mark platform-mark-text platform-mark-${id}`} aria-hidden="true">
      {TEXT_MARKS[id] ?? name.slice(0, 2)}
    </span>
  );
}

export function platformStatusClass(status: string): string {
  if (status === "Live") {
    return "platform-status-live";
  }

  if (status === "Under review") {
    return "platform-status-review";
  }

  if (status === "MCP ready") {
    return "platform-status-mcp";
  }

  if (status === "Candidate") {
    return "platform-status-candidate";
  }

  return "platform-status-planned";
}
