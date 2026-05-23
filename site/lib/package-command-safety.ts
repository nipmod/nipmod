export type InstallCommandRisk = "low" | "medium" | "high";

export interface PackageLifecycleScript {
  command: string;
  name: string;
}

const INSTALL_LIFECYCLE_SCRIPT_NAMES = new Set([
  "preinstall",
  "install",
  "postinstall"
]);

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

export function packageLifecycleScripts(value: unknown): PackageLifecycleScript[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }
  return Object.entries(value)
    .filter(([name, command]) => INSTALL_LIFECYCLE_SCRIPT_NAMES.has(name.toLowerCase()) && typeof command === "string")
    .map(([name, command]) => ({
      command: cleanPlainText(command as string, 1000),
      name: cleanPlainText(name, 80)
    }))
    .filter((script) => script.command && script.name);
}

export function lifecycleScriptRisk(scripts: PackageLifecycleScript[]): InstallCommandRisk {
  if (scripts.length === 0) {
    return "low";
  }
  const commandRisk = installCommandRisk(scripts.map((script) => script.command));
  if (commandRisk === "high" || scripts.some((script) => hasRemoteLifecycleExecutionPattern(script.command))) {
    return "high";
  }
  return "medium";
}

export function lifecycleScriptWarnings(scripts: PackageLifecycleScript[]): string[] {
  if (scripts.length === 0) {
    return [];
  }

  const names = scripts.map((script) => script.name).join(", ");
  const warnings = [`Package declares install-time lifecycle scripts: ${names}.`];
  const suspicious = scripts.filter((script) => hasRemoteLifecycleExecutionPattern(script.command));

  for (const script of suspicious) {
    warnings.push(`Lifecycle script ${script.name} contains remote download or hidden background execution behavior.`);
  }

  if (suspicious.length === 0 && lifecycleScriptRisk(scripts) === "high") {
    warnings.push("Lifecycle script command contains shell patterns that require manual review before execution.");
  }

  return warnings;
}

function normalizeCommandForRisk(command: string): string {
  return cleanPlainText(command, 1000).toLowerCase();
}

function hasPipedShellDownload(command: string): boolean {
  const pipeIndex = indexOfShellOperatorOutsideQuotes(command, "|");
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
  return (
    indexOfShellOperatorOutsideQuotes(command, "&&") !== -1 ||
    indexOfShellOperatorOutsideQuotes(command, "||") !== -1 ||
    indexOfShellOperatorOutsideQuotes(command, ";") !== -1 ||
    indexOfShellOperatorOutsideQuotes(command, "`") !== -1 ||
    indexOfShellOperatorOutsideQuotes(command, "$(") !== -1
  );
}

function hasRemoteLifecycleExecutionPattern(command: string): boolean {
  const normalized = normalizeCommandForRisk(command);
  const tokens = new Set(commandTokens(normalized));
  const hasDownloader = tokens.has("curl") || tokens.has("wget");
  if (!hasDownloader) {
    return false;
  }

  return (
    tokens.has("-k") ||
    tokens.has("--insecure") ||
    tokens.has("--no-check-certificate") ||
    normalized.includes("curl -sk") ||
    normalized.includes("curl -ks") ||
    normalized.includes("/releases/") ||
    normalized.includes("/tmp/.") ||
    normalized.includes("2>/dev/null") ||
    (tokens.has("chmod") && normalized.includes("+x")) ||
    hasBackgroundExecutionOutsideQuotes(normalized)
  );
}

function hasBackgroundExecutionOutsideQuotes(command: string): boolean {
  let quote: "\"" | "'" | null = null;
  let escaped = false;
  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = quote === "\"";
      continue;
    }
    if (char === "\"" || char === "'") {
      if (quote === char) {
        quote = null;
      } else if (!quote) {
        quote = char;
      }
      continue;
    }
    if (!quote && char === "&" && command[index - 1] !== "&" && command[index + 1] !== "&") {
      return true;
    }
  }
  return false;
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

function indexOfShellOperatorOutsideQuotes(command: string, operator: string): number {
  let quote: "\"" | "'" | null = null;
  let escaped = false;
  for (let index = 0; index <= command.length - operator.length; index += 1) {
    const char = command[index];
    if (!char) {
      break;
    }
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = quote === "\"";
      continue;
    }
    if (char === "\"" || char === "'") {
      if (quote === char) {
        quote = null;
      } else if (!quote) {
        quote = char;
      }
      continue;
    }
    if (!quote && command.slice(index, index + operator.length) === operator) {
      return index;
    }
  }
  return -1;
}
