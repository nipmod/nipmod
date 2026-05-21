"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { NipmodMark } from "./editorial-mark";

export type TerminalLine = {
  kind?: "default" | "muted" | "ok" | "warn" | "header" | "blank" | "logo" | "input";
  text?: string;
  pause?: number;
  prompt?: string;
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
      { kind: "default", text: "Installing nipmod 1.2.5", pause: 380 },
      { kind: "default", text: "  Package:   https://nipmod.com/releases/nipmod-1.2.5.tgz", pause: 60 },
      { kind: "default", text: "  Signature: https://nipmod.com/releases/nipmod-1.2.5.tgz.sig", pause: 60 },
      { kind: "default", text: "  Prefix:    ~/.nipmod", pause: 60 },
      { kind: "default", text: "  Binary:    ~/.local/bin/nipmod", pause: 360 },
      { kind: "blank" },
      { kind: "muted", text: "up to date, audited 2 packages in 579ms", pause: 260 },
      { kind: "muted", text: "found 0 vulnerabilities", pause: 280 },
      { kind: "blank" },
      { kind: "default", text: "Setting up Gitlawb publish helper", pause: 240 },
      { kind: "muted", text: "git-remote-gitlawb already installed at ~/.local/bin/git-remote-gitlawb", pause: 360 },
      { kind: "blank" },
      { kind: "ok", text: "Installed nipmod", pause: 180 },
      { kind: "muted", text: "Next:", pause: 80 },
      { kind: "muted", text: "  nipmod doctor --online", pause: 60 },
      { kind: "muted", text: "  nipmod search gitlawb --online", pause: 980 }
    ]
  },
  {
    command: "nipmod search gitlawb --online",
    output: [
      { kind: "header", text: "NAME                       VERSION   TRUST     PUBLISHER", pause: 50 },
      { kind: "default", text: "gitlawb-repo-reader        0.1.0     verified  did:key:z6Mkq...", pause: 34 },
      { kind: "default", text: "prompt-injection-scan      0.1.0     verified  did:key:z6Mkf...", pause: 34 },
      { kind: "default", text: "agent-permission-review    0.1.0     verified  did:key:z6Mkn...", pause: 90 },
      { kind: "blank" },
      { kind: "muted", text: "3 results in 142ms", pause: 760 }
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
      { kind: "default", text: "Witness      2 of 3 threshold met", pause: 720 }
    ]
  },
  {
    command: "nipmod install gitlawb-repo-reader",
    output: [
      { kind: "muted", text: "Resolving dependency graph...", pause: 420 },
      { kind: "default", text: "  + gitlawb-repo-reader      0.1.0", pause: 80 },
      { kind: "default", text: "  + verified-source-fetch    0.1.6", pause: 180 },
      { kind: "blank" },
      { kind: "warn", text: "? Approve install [Y/n] y", pause: 620 },
      { kind: "default", text: "  verifying digests          ok", pause: 280 },
      { kind: "default", text: "  writing lockfile           ok", pause: 220 },
      { kind: "blank" },
      { kind: "logo", pause: 180 },
      { kind: "ok", text: "installed 2 packages in 832ms", pause: 1200 }
    ]
  }
];

export function AnimatedTerminal({
  height = 520,
  script = defaultScript,
  title = "~ -- nipmod -- 80x24"
}: AnimatedTerminalProps) {
  const stableScript = useMemo(() => script, [script]);
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [typing, setTyping] = useState("");
  const [stepIndex, setStepIndex] = useState(0);
  const [phase, setPhase] = useState<"typing" | "output" | "done">("typing");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
    setLines([]);
    setTyping("");
    setStepIndex(0);
    setPhase("typing");
  }, [stableScript]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines, typing]);

  useEffect(() => {
    let cancelled = false;
    const step = stableScript[stepIndex];

    if (!step) {
      setPhase("done");
      return;
    }

    const schedule = (ms: number, fn: () => void) => {
      const id = window.setTimeout(() => {
        if (!cancelled) {
          fn();
        }
      }, ms);
      timersRef.current.push(id);
    };

    const streamOutput = (output: TerminalLine[], outputIndex: number) => {
      if (cancelled) {
        return;
      }

      if (outputIndex >= output.length) {
        schedule(980, () => {
          if (cancelled) {
            return;
          }
          if (stepIndex + 1 < stableScript.length) {
            setStepIndex((current) => current + 1);
          } else {
            setPhase("done");
          }
        });
        return;
      }

      const line = output[outputIndex];
      if (!line) {
        setPhase("done");
        return;
      }
      setLines((current) => [...current, line]);
      schedule(line.pause ?? 220, () => streamOutput(output, outputIndex + 1));
    };

    setTyping("");
    setPhase("typing");

    const command = step.command;
    let commandIndex = 0;

    const typeNext = () => {
      if (cancelled) {
        return;
      }

      if (commandIndex > command.length) {
        schedule(340, () => {
          setLines((current) => [
            ...current,
            { kind: "input", text: command, prompt: step.prompt ?? "~ $" }
          ]);
          setTyping("");
          setPhase("output");
          streamOutput(step.output, 0);
        });
        return;
      }

      setTyping(command.slice(0, commandIndex));
      const previousChar = command[commandIndex - 1] ?? "";
      commandIndex += 1;
      const delay = 18 + Math.random() * 44 + (previousChar === " " ? 34 : 0);
      schedule(delay, typeNext);
    };

    schedule(260, typeNext);

    return () => {
      cancelled = true;
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current = [];
    };
  }, [stableScript, stepIndex]);

  const currentPrompt = stableScript[stepIndex]?.prompt ?? "~ $";

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
      <div className="animated-terminal" ref={scrollRef}>
        {lines.map((line, index) => (
          <TerminalLineView key={`${line.kind}-${line.text ?? ""}-${index}`} line={line} />
        ))}
        {phase === "typing" ? (
          <code className="terminal-typing">
            <span className="terminal-prompt">{currentPrompt}</span>
            <span>
              {typing}
              <span className="terminal-caret" aria-hidden="true" />
            </span>
          </code>
        ) : null}
        {phase === "done" ? (
          <code className="terminal-typing">
            <span className="terminal-prompt">{currentPrompt}</span>
            <span className="terminal-caret" aria-hidden="true" />
          </code>
        ) : null}
      </div>
    </div>
  );
}

function TerminalLineView({ line }: { line: TerminalLine }) {
  if (line.kind === "blank") {
    return <code className="terminal-blank" aria-hidden="true" />;
  }
  if (line.kind === "logo") {
    return (
      <code className="terminal-logo">
        <NipmodMark size={22} />
        <span>nipmod - agent package layer</span>
      </code>
    );
  }
  if (line.kind === "input") {
    return (
      <code className="terminal-input">
        <span className="terminal-prompt">{line.prompt ?? "~ $"}</span>
        <span>{line.text}</span>
      </code>
    );
  }
  return <code className={`terminal-${line.kind ?? "default"}`}>{line.text}</code>;
}
