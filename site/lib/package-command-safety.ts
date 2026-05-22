export type InstallCommandRisk = "low" | "medium" | "high";

export function cleanPlainText(value: string, maxLength: number): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function installCommandRisk(commands: string[]): InstallCommandRisk {
  const normalizedCommands = commands.map(normalizeCommandForRisk);
  if (normalizedCommands.some(hasPipedShellDownload)) {
    return "high";
  }
  if (normalizedCommands.some(hasPrivilegedOrDestructiveCommand)) {
    return "high";
  }
  if (normalizedCommands.some(hasCompoundShellSyntax)) {
    return "medium";
  }
  return "low";
}

export function commandWarnings(commands: string[]): string[] {
  const risk = installCommandRisk(commands);
  if (risk === "high") {
    return ["Install command contains shell patterns that require manual review before execution."];
  }
  if (risk === "medium") {
    return ["Install command contains compound shell syntax. Review the command before execution."];
  }
  return [];
}

function normalizeCommandForRisk(command: string): string {
  return cleanPlainText(command, 1000).toLowerCase();
}

function hasPipedShellDownload(command: string): boolean {
  const pipeIndex = command.indexOf("|");
  if (pipeIndex === -1) {
    return false;
  }
  const beforePipe = command.slice(0, pipeIndex);
  const afterPipe = command.slice(pipeIndex + 1);
  return containsAnyToken(beforePipe, ["curl", "wget"]) && containsAnyToken(afterPipe, ["bash", "sh"]);
}

function hasPrivilegedOrDestructiveCommand(command: string): boolean {
  return containsAnyToken(command, ["sudo", "chmod", "chown"]) || containsRecursiveForcedRemove(command);
}

function hasCompoundShellSyntax(command: string): boolean {
  return command.includes("&&") || command.includes("||") || command.includes(";") || command.includes("`") || command.includes("$(");
}

function containsRecursiveForcedRemove(command: string): boolean {
  const tokens = commandTokens(command);
  const removeIndex = tokens.indexOf("rm");
  if (removeIndex === -1) {
    return false;
  }
  const flags = new Set(tokens.slice(removeIndex + 1).filter((token) => token.startsWith("-")));
  return flags.has("-rf") || flags.has("-fr") || (flags.has("-r") && flags.has("-f"));
}

function containsAnyToken(value: string, tokens: string[]): boolean {
  const found = new Set(commandTokens(value));
  return tokens.some((token) => found.has(token));
}

function commandTokens(value: string): string[] {
  const tokens: string[] = [];
  let current = "";
  for (const char of value) {
    if (isCommandTokenChar(char)) {
      current += char;
      continue;
    }
    if (current) {
      tokens.push(current);
      current = "";
    }
  }
  if (current) {
    tokens.push(current);
  }
  return tokens;
}

function isCommandTokenChar(char: string): boolean {
  const code = char.charCodeAt(0);
  return (
    (code >= 48 && code <= 57) ||
    (code >= 97 && code <= 122) ||
    char === "-" ||
    char === "_" ||
    char === "."
  );
}
