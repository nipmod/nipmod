type PlatformMarkProps = {
  id: string;
  name: string;
};

const IMAGE_MARKS: Record<string, { className?: string; src: string }> = {
  api: { src: "/nipmod-logo-transparent.png?v=20260522-orange-cube" },
  archive: { src: "/nipmod-logo-transparent.png?v=20260522-orange-cube" },
  "claude-code": { src: "/claude-logo.png" },
  cursor: { src: "/agents/cursor.png" },
  github: { className: "platform-mark-github", src: "/github-logo.svg" },
  gitlawb: { src: "/gitlawb-logo.png" },
  hermes: { src: "/hermes-logo.png" },
  mcp: { src: "https://cdn.simpleicons.org/modelcontextprotocol/FFFFFF" },
  opencode: { className: "platform-mark-opencode", src: "https://opencode.ai/_build/assets/preview-opencode-logo-light-B5i-Y4z2.png" }
};

const TEXT_MARKS: Record<string, string> = {
  codex: "Cx",
  sources: "src"
};

export function PlatformMark({ id, name }: PlatformMarkProps) {
  if (id === "codex") {
    return (
      <span className="platform-mark" aria-hidden="true">
        <img alt="" src="/codex-logo.png" />
      </span>
    );
  }

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

  if (status === "Under review" || status === "Safe mode") {
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
