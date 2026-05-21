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
  const [typing, setTyping] = useState("");
  const [stepIndex, setStepIndex] = useState(0);
  const timers = useRef<number[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    setLines([]);
    setTyping("");
    setStepIndex(0);
  }, [stableScript]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines, typing]);

  useEffect(() => {
    const step = stableScript[stepIndex];
    if (!step) {
      return;
    }

    let cancelled = false;
    const pushTimer = (delay: number, fn: () => void) => {
      const timer = window.setTimeout(() => {
        if (!cancelled) {
          fn();
        }
      }, delay);
      timers.current.push(timer);
    };

    const prompt = step.prompt ?? "~ $";
    const commandLine = `${prompt} ${step.command}`;
    let char = 0;

    const typeNext = () => {
      if (char <= commandLine.length) {
        setTyping(commandLine.slice(0, char));
        char += 1;
        pushTimer(char < commandLine.length ? 18 : 220, typeNext);
        return;
      }

      setLines((current) => [...current, { kind: "input", text: commandLine }]);
      setTyping("");
      let delay = 120;
      for (const line of step.output) {
        delay += line.pause ?? 70;
        pushTimer(delay, () => setLines((current) => [...current, line]));
      }
      pushTimer(delay + 760, () => {
        if (stepIndex < stableScript.length - 1) {
          setStepIndex((index) => index + 1);
        }
      });
    };

    typeNext();

    return () => {
      cancelled = true;
      timers.current.forEach(window.clearTimeout);
      timers.current = [];
    };
  }, [stableScript, stepIndex]);

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
        {typing ? (
          <code className="terminal-input terminal-typing">
            {typing}
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
