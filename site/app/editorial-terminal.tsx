"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { NipmodMark } from "./editorial-mark";

export type TerminalLine = {
  kind?: "default" | "muted" | "ok" | "warn" | "header" | "blank" | "logo" | "input";
  text?: string;
  prompt?: string;
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
  const [activeOutputLine, setActiveOutputLine] = useState<TerminalLine | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [phase, setPhase] = useState<"typing" | "output" | "done">("typing");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
    setLines([]);
    setTyping("");
    setActiveOutputLine(null);
    setStepIndex(0);
    setPhase("typing");
  }, [stableScript]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeOutputLine, lines, typing]);

  useEffect(() => {
    let cancelled = false;
    const step = stableScript[stepIndex];

    if (!step) {
      setPhase("done");
      return;
    }

    const schedule = (ms: number, fn: () => void) => {
      const id = window.setTimeout(() => {
        if (cancelled) {
          return;
        }
        fn();
      }, ms);
      timersRef.current.push(id);
    };

    const outputDelayFor = (line: TerminalLine, nextIndex: number) => {
      const text = line.text ?? "";
      const char = text[nextIndex - 1] ?? "";
      const nextChar = text[nextIndex] ?? "";
      const base = line.kind === "muted" || line.kind === "header" ? 5 : 7;
      const punctuationPause = /[.:]/.test(char) ? 26 : 0;
      const columnPause = char === " " && nextChar !== " " ? 4 : 0;

      return base + punctuationPause + columnPause + Math.random() * 10;
    };

    const streamOutputLine = (line: TerminalLine, done: () => void) => {
      const text = line.text ?? "";

      if (!text || line.kind === "blank" || line.kind === "logo") {
        setActiveOutputLine(null);
        setLines((current) => [...current, line]);
        schedule(Math.min(line.pause ?? 180, 620), done);
        return;
      }

      let nextIndex = 0;
      setActiveOutputLine({ ...line, text: "" });

      const typeOutputNext = () => {
        if (cancelled) {
          return;
        }

        if (nextIndex >= text.length) {
          setLines((current) => [...current, { ...line, text }]);
          setActiveOutputLine(null);
          schedule(Math.min(line.pause ?? 150, 620), done);
          return;
        }

        nextIndex += 1;
        setActiveOutputLine({ ...line, text: text.slice(0, nextIndex) });
        schedule(outputDelayFor(line, nextIndex), typeOutputNext);
      };

      schedule(24, typeOutputNext);
    };

    const streamOutput = (output: TerminalLine[], outputIndex: number) => {
      if (cancelled) {
        return;
      }

      if (outputIndex >= output.length) {
        schedule(900, () => {
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
      streamOutputLine(line, () => streamOutput(output, outputIndex + 1));
    };

    setTyping("");
    setActiveOutputLine(null);
    setPhase("typing");

    const command = step.command;
    let commandIndex = 0;

    const typeNext = () => {
      if (cancelled) {
        return;
      }

      if (commandIndex > command.length) {
        schedule(260, () => {
          setLines((current) => [
            ...current,
            { kind: "input", text: command, prompt: step.prompt ?? "~ $" }
          ]);
          setTyping("");
          setPhase("output");
          setActiveOutputLine(null);
          streamOutput(step.output, 0);
        });
        return;
      }

      setTyping(command.slice(0, commandIndex));
      const previousChar = command[commandIndex - 1];
      commandIndex += 1;
      const delay = 16 + Math.random() * 38 + (previousChar === " " ? 28 : 0);
      schedule(delay, typeNext);
    };

    schedule(220, typeNext);

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
      <div className="landing-terminal animated-terminal" ref={scrollRef}>
        {lines.map((line, index) => (
          <TerminalCode key={`${line.kind}-${line.text ?? ""}-${index}`} line={line} />
        ))}
        {activeOutputLine ? <TerminalCode line={activeOutputLine} active /> : null}
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

function TerminalCode({ active = false, line }: { active?: boolean; line: TerminalLine }) {
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
  if (line.kind === "input") {
    return (
      <code className="terminal-input">
        <span className="terminal-prompt">{line.prompt ?? "~ $"}</span>
        <span>{line.text}</span>
      </code>
    );
  }
  return (
    <code className={`terminal-${line.kind ?? "default"}`}>
      {line.text}
      {active ? <span className="terminal-output-caret" aria-hidden="true" /> : null}
    </code>
  );
}
