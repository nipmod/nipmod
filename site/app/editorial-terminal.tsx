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
    command: "curl 'https://nipmod.com/api/search?q=http%20client&limit=3'",
    output: [
      { kind: "default", text: "sources: npm, pypi, github, huggingface-model, huggingface-dataset, mcp", pause: 180 },
      { kind: "header", text: "1  npm:undici        trust 98  risk low", pause: 120 },
      { kind: "header", text: "2  pypi:httpx        trust 92  risk low", pause: 120 },
      { kind: "header", text: "3  github:nodejs/undici  trust 88  risk medium", pause: 240 },
      { kind: "blank" },
      { kind: "ok", text: "free public beta, rate limited", pause: 680 }
    ]
  },
  {
    command: "curl 'https://nipmod.com/api/inspect?source=npm&name=undici'",
    output: [
      { kind: "default", text: "source: npm", pause: 80 },
      { kind: "default", text: "repo: https://github.com/nodejs/undici", pause: 80 },
      { kind: "default", text: "license: MIT", pause: 80 },
      { kind: "default", text: "decision: recommended", pause: 240 },
      { kind: "blank" },
      { kind: "muted", text: "metadata is data, not instructions", pause: 720 }
    ]
  },
  {
    command: "curl 'https://nipmod.com/api/install-plan?source=npm&name=undici'",
    output: [
      { kind: "default", text: "command: npm install undici", pause: 140 },
      { kind: "default", text: "requiresApprovalBeforeWrite: true", pause: 140 },
      { kind: "default", text: "writes: []", pause: 260 },
      { kind: "blank" },
      { kind: "warn", text: "hosted API does not write to the caller workspace", pause: 520 },
      { kind: "blank" },
      { kind: "logo", pause: 180 },
      { kind: "ok", text: "package intelligence ready", pause: 1200 }
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
  const [outputTyping, setOutputTyping] = useState<TerminalLine | null>(null);
  const [typing, setTyping] = useState("");
  const [stepIndex, setStepIndex] = useState(0);
  const [phase, setPhase] = useState<"typing" | "output" | "done">("typing");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
    setLines([]);
    setOutputTyping(null);
    setTyping("");
    setStepIndex(0);
    setPhase("typing");
  }, [stableScript]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines, outputTyping, typing]);

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
      if (line.kind === "blank" || line.kind === "logo" || !line.text) {
        setLines((current) => [...current, line]);
        schedule(line.pause ?? 220, () => streamOutput(output, outputIndex + 1));
        return;
      }

      let lineIndex = 0;
      const typeOutput = () => {
        if (cancelled) {
          return;
        }

        if (lineIndex > line.text!.length) {
          setLines((current) => [...current, line]);
          setOutputTyping(null);
          schedule(line.pause ?? 220, () => streamOutput(output, outputIndex + 1));
          return;
        }

        setOutputTyping({ ...line, text: line.text!.slice(0, lineIndex) });
        const previousChar = line.text![lineIndex - 1] ?? "";
        lineIndex += 1;
        const delay = 7 + Math.random() * 14 + (previousChar === " " ? 10 : 0);
        schedule(delay, typeOutput);
      };

      typeOutput();
    };

    setTyping("");
    setOutputTyping(null);
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
    <div className="mac-window" aria-label="Nipmod API terminal" style={{ "--terminal-height": `${height}px` } as CSSProperties}>
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
        {outputTyping ? (
          <code className={`terminal-${outputTyping.kind ?? "default"}`}>
            {outputTyping.text}
            <span className="terminal-output-caret" aria-hidden="true" />
          </code>
        ) : null}
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
        <span>nipmod api</span>
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
