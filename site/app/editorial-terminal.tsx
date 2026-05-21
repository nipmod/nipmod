"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { NipmodMark } from "./editorial-mark";

export type TerminalLine = {
  kind?: "default" | "muted" | "ok" | "warn" | "header" | "blank" | "logo" | "input";
  text?: string;
  pause?: number;
};

export type TerminalStep = {
  command: string;
  output: TerminalLine[];
  prompt?: string;
};

type AnimatedTerminalProps = {
  height?: number;
  script?: TerminalStep[];
  title?: string;
};

const defaultScript: TerminalStep[] = [
  {
    command: "curl https://nipmod.com/i|bash",
    output: [
      { kind: "default", text: "Installing nipmod 1.2.5", pause: 320 },
      { kind: "default", text: "Package:   https://nipmod.com/releases/nipmod-1.2.5.tgz", pause: 70 },
      { kind: "default", text: "Signature: https://nipmod.com/releases/nipmod-1.2.5.tgz.sig", pause: 70 },
      { kind: "default", text: "Prefix:    ~/.nipmod", pause: 70 },
      { kind: "default", text: "Binary:    ~/.local/bin/nipmod", pause: 240 },
      { kind: "blank" },
      { kind: "muted", text: "up to date, audited 2 packages in 579ms", pause: 170 },
      { kind: "muted", text: "found 0 vulnerabilities", pause: 180 },
      { kind: "default", text: "Setting up Gitlawb publish helper", pause: 200 },
      { kind: "muted", text: "git-remote-gitlawb already installed at ~/.local/bin/git-remote-gitlawb", pause: 220 },
      { kind: "ok", text: "Installed nipmod", pause: 220 },
      { kind: "muted", text: "Next:", pause: 70 },
      { kind: "muted", text: "  nipmod doctor --online", pause: 70 },
      { kind: "muted", text: "  nipmod search gitlawb --online", pause: 900 }
    ]
  },
  {
    command: "nipmod search gitlawb --online",
    output: [
      { kind: "header", text: "NAME                       VERSION   TRUST     PUBLISHER", pause: 50 },
      { kind: "default", text: "gitlawb-repo-reader        0.1.0     verified  did:key:z6Mkq...", pause: 40 },
      { kind: "default", text: "prompt-injection-scan      0.1.0     verified  did:key:z6Mkf...", pause: 40 },
      { kind: "default", text: "agent-permission-review    0.1.0     verified  did:key:z6Mkn...", pause: 90 },
      { kind: "muted", text: "3 results in 142ms", pause: 900 }
    ]
  },
  {
    command: "nipmod inspect gitlawb-repo-reader",
    output: [
      { kind: "default", text: "Package      gitlawb-repo-reader@0.1.0", pause: 50 },
      { kind: "default", text: "Publisher    did:key:z6MkqDAk...VQ4fbD", pause: 50 },
      { kind: "default", text: "Source       gitlawb://repos/z6Mkq.../gitlawb-repo-reader", pause: 50 },
      { kind: "default", text: "Digest       sha256:7c2a9f...e801", pause: 50 },
      { kind: "default", text: "Signature    valid", pause: 50 },
      { kind: "default", text: "Witness      2 of 3 threshold met", pause: 700 }
    ]
  }
];

export function AnimatedTerminal({ height = 520, script = defaultScript, title = "~ -- nipmod -- 80x24" }: AnimatedTerminalProps) {
  const stableScript = useMemo(() => script, [script]);
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [activeLine, setActiveLine] = useState<TerminalLine | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollFrame = useRef<number | null>(null);

  useEffect(() => {
    setLines([]);
    setActiveLine(null);
  }, [stableScript]);

  useEffect(() => {
    if (scrollFrame.current !== null) {
      window.cancelAnimationFrame(scrollFrame.current);
    }
    scrollFrame.current = window.requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
      scrollFrame.current = null;
    });

    return () => {
      if (scrollFrame.current !== null) {
        window.cancelAnimationFrame(scrollFrame.current);
        scrollFrame.current = null;
      }
    };
  }, [lines, activeLine]);

  useEffect(() => {
    let cancelled = false;

    const frame = () =>
      new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, ms);
      });

    const typeTerminalLine = async (line: TerminalLine, mode: "command" | "output") => {
      const text = line.text ?? "";
      if (text.length === 0) {
        return;
      }

      const duration =
        mode === "command"
          ? Math.max(380, Math.min(860, text.length * 16))
          : Math.max(160, Math.min(560, text.length * 7));
      const start = window.performance.now();
      let renderedChars = -1;

      while (!cancelled) {
        const elapsed = window.performance.now() - start;
        const progress = Math.min(1, elapsed / duration);
        const nextChars = Math.min(text.length, Math.ceil(progress * text.length));

        if (nextChars !== renderedChars) {
          renderedChars = nextChars;
          setActiveLine({ ...line, text: text.slice(0, nextChars) });
        }

        if (progress >= 1) {
          return;
        }

        await frame();
      }
    };

    const run = async () => {
      setLines([]);
      setActiveLine(null);

      for (const step of stableScript) {
        if (cancelled) {
          return;
        }

        const prompt = step.prompt ?? "~ $";
        const commandLine = `${prompt} ${step.command}`;
        await typeTerminalLine({ kind: "input", text: commandLine }, "command");

        if (cancelled) {
          return;
        }

        setLines((current) => [...current, { kind: "input", text: commandLine }]);
        setActiveLine(null);
        await wait(90);

        for (const line of step.output) {
          if (cancelled) {
            return;
          }

          await wait(Math.min(line.pause ?? 72, 240));
          if (line.kind === "blank") {
            setLines((current) => [...current, line]);
            await wait(90);
            continue;
          }

          await typeTerminalLine(line, "output");
          if (!cancelled) {
            setLines((current) => [...current, line]);
            setActiveLine(null);
            await wait(28);
          }
        }

        await wait(460);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [stableScript]);

  return (
    <div className="mac-window" aria-label="Nipmod install terminal" style={{ "--terminal-height": `${height}px` } as CSSProperties}>
      <div className="mac-titlebar">
        <span className="mac-controls" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span>{title}</span>
      </div>
      <div className="landing-terminal animated-terminal" ref={scrollRef}>
        {lines.map((line, index) => (
          <TerminalCode key={`${line.kind}-${line.text ?? ""}-${index}`} line={line} />
        ))}
        {activeLine ? (
          <code className={`terminal-${activeLine.kind ?? "default"} terminal-typing`}>
            {activeLine.text}
            <span className="terminal-caret" aria-hidden="true" />
          </code>
        ) : null}
      </div>
    </div>
  );
}

function TerminalCode({ line }: { line: TerminalLine }) {
  if (line.kind === "blank") {
    return <code className="terminal-blank" aria-hidden="true" />;
  }
  if (line.kind === "logo") {
    return (
      <code className="terminal-logo">
        <NipmodMark size={22} />
        <span>verified package archive for agents</span>
      </code>
    );
  }
  return <code className={`terminal-${line.kind ?? "default"}`}>{line.text}</code>;
}
