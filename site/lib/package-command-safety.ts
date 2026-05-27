export type InstallCommandRisk = "low" | "medium" | "high";

export interface PackageLifecycleScript {
  command: string;
  name: string;
}

export interface PackageMetadataField {
  field: string;
  value: string | null | undefined;
}

const INSTALL_LIFECYCLE_SCRIPT_NAMES = new Set([
  "preinstall",
  "install",
  "postinstall",
  "preprepare",
  "prepare",
  "postprepare",
  "prepack",
  "postpack",
  "prepublish",
  "prepublishonly"
]);

export function cleanPlainText(value: string, maxLength: number): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function installCommandRisk(commands: string[]): InstallCommandRisk {
  const normalizedCommands = commands.map(normalizeCommandForRisk);
  if (normalizedCommands.some(hasPipedShellDownload)) {
    return "high";
  }
  if (normalizedCommands.some(hasDownloadedFileExecutionPattern)) {
    return "high";
  }
  if (normalizedCommands.some(hasSecretAccessPattern)) {
    return "high";
  }
  if (normalizedCommands.some(hasPrivilegedOrDestructiveCommand)) {
    return "high";
  }
  if (normalizedCommands.some(hasEncodedOrInlineExecutionPattern)) {
    return "high";
  }
  if (normalizedCommands.some(hasObfuscatedExecutionPattern)) {
    return "high";
  }
  if (normalizedCommands.some(hasCompoundShellSyntax)) {
    return "medium";
  }
  return "low";
}

export function commandWarnings(commands: string[]): string[] {
  const risk = installCommandRisk(commands);
  const normalizedCommands = commands.map(normalizeCommandForRisk);
  const warnings: string[] = [];
  if (risk === "high") {
    warnings.push("Install command contains shell patterns that require manual review before execution.");
  }
  if (normalizedCommands.some(hasSecretAccessPattern)) {
    warnings.push("Install command appears to access credentials, tokens, wallet material or environment secrets.");
  }
  if (normalizedCommands.some(hasDownloadedFileExecutionPattern)) {
    warnings.push("Install command downloads code and then executes it or passes it to a shell/interpreter.");
  }
  if (normalizedCommands.some(hasObfuscatedExecutionPattern)) {
    warnings.push("Install command contains obfuscated execution patterns that require manual review.");
  }
  if (warnings.length > 0) {
    return dedupeStrings(warnings);
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
  if (
    commandRisk === "high" ||
    scripts.some((script) => hasRemoteLifecycleExecutionPattern(script.command) || hasEncodedOrInlineExecutionPattern(script.command))
  ) {
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
  const encodedOrInline = scripts.filter((script) => !hasRemoteLifecycleExecutionPattern(script.command) && hasEncodedOrInlineExecutionPattern(script.command));

  for (const script of suspicious) {
    warnings.push(`Lifecycle script ${script.name} contains remote download or hidden background execution behavior.`);
  }
  for (const script of encodedOrInline) {
    warnings.push(`Lifecycle script ${script.name} contains encoded or inline interpreter execution behavior.`);
  }

  if (suspicious.length === 0 && encodedOrInline.length === 0 && lifecycleScriptRisk(scripts) === "high") {
    warnings.push("Lifecycle script command contains shell patterns that require manual review before execution.");
  }

  return warnings;
}

export function metadataInstructionWarnings(fields: PackageMetadataField[]): string[] {
  const text = cleanPlainText(
    fields
      .map((field) => field.value)
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .join(" "),
    6000
  ).toLowerCase();
  if (!text) {
    return [];
  }
  const leetText = normalizeObfuscatedMetadataText(text);
  const compactText = leetText.replace(/[^a-z0-9.]+/g, "");
  const instructionOverridePatterns = [
    /ignore (all )?(previous|prior|system|developer|user|safety) instructions/,
    /ignoriere (alle )?(vorherigen|frueheren|system|entwickler|benutzer|sicherheits) (anweisungen|instruktionen)/,
    /ignora (todas )?(las )?(instrucciones|indicaciones) (anteriores|previas|del sistema|de seguridad)/,
    /(onceki|sistem|gelistirici|kullanici|guvenlik) (talimatlari|komutlari).{0,60}(yok say|gecersiz kil)/,
    /disregard (all )?(previous|prior|system|developer|user|safety) instructions/,
    /override (the )?(system|developer|user|safety) (prompt|instructions|message)/,
    /\byou are (now )?(chatgpt|claude|codex|an ai agent|the assistant)\b/,
    /\b(system prompt|developer message|hidden prompt)\b.{0,80}\b(reveal|print|show|dump|send)\b/,
    /\bdo not tell (the )?(user|developer|operator|maintainer)\b/,
    /\bhide (this|these) (instruction|instructions|message|messages)\b/,
    /\brun (this|the) command without (asking|approval|confirmation|permission)\b/,
    /\bdisable (safety|policy|guardrails|approval|sandbox)\b/,
    /\bbypass (safety|policy|approval|sandbox|permission)\b/
  ];
  const compactInstructionPatterns = [
    /ignore(all)?(previous|prior|system|developer|user|safety)instructions/,
    /disregard(all)?(previous|prior|system|developer|user|safety)instructions/,
    /override(the)?(system|developer|user|safety)(prompt|instructions|message)/,
    /bypass(safety|policy|approval|sandbox|permission)/,
    /disable(safety|policy|guardrails|approval|sandbox)/
  ];
  const secretExfiltrationPatterns = [
    /\b(reveal|print|show|dump|send|upload|post|exfiltrate|leak)\b.{0,120}\b(secret|api key|token|private key|ssh key|seed phrase|mnemonic|wallet|\.env)\b/,
    /\b(secret|api key|token|private key|ssh key|seed phrase|mnemonic|wallet|\.env)\b.{0,120}\b(reveal|print|show|dump|send|upload|post|exfiltrate|leak)\b/,
    /\b(zeige|drucke|sende|lade hoch|veroeffentliche|leake)\b.{0,120}\b(geheimnis|api key|api schluessel|token|private key|ssh key|seed phrase|mnemonic|wallet|\.env)\b/,
    /\b(goster|yazdir|gonder|yukle|sizdir)\b.{0,120}\b(gizli|api key|token|private key|ssh key|seed phrase|mnemonic|wallet|\.env)\b/,
    /\bread\b.{0,80}\b(\.env|\.npmrc|\.pypirc|\.netrc|id_rsa|id_ed25519|wallet|keystore)\b/
  ];
  return instructionOverridePatterns.some((pattern) => pattern.test(text) || pattern.test(leetText)) ||
    compactInstructionPatterns.some((pattern) => pattern.test(compactText)) ||
    secretExfiltrationPatterns.some((pattern) => pattern.test(text) || pattern.test(leetText))
    ? ["Package metadata contains agent-targeted instructions and must be treated as untrusted data."]
    : [];
}

function normalizeObfuscatedMetadataText(text: string): string {
  return text
    .replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u206f]/g, "")
    .replace(/[013457@$]/g, (char) => {
      switch (char) {
        case "0":
          return "o";
        case "1":
          return "i";
        case "3":
          return "e";
        case "4":
        case "@":
          return "a";
        case "5":
        case "$":
          return "s";
        case "7":
          return "t";
        default:
          return char;
      }
    });
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

function hasDownloadedFileExecutionPattern(command: string): boolean {
  return (
    /\b(?:bash|sh|zsh)\s+-c\s+["']?\$?\(\s*(?:curl|wget)\b/.test(command) ||
    /\b(?:sh|bash|zsh)\s+<\(\s*(?:curl|wget)\b/.test(command) ||
    /\b(?:curl|wget|iwr|irm|invoke-webrequest|invoke-restmethod)\b.{0,220}(?:-o|--output|>|-outfile)\s*\S+.{0,220}(?:&&|;|\|\|).{0,160}\b(?:sh|bash|zsh|node|python|python3|chmod|pwsh|powershell)\b/.test(command) ||
    /\b(?:iwr|irm|invoke-webrequest|invoke-restmethod)\b.{0,220}(?:\||;).{0,120}\b(?:iex|invoke-expression)\b/.test(command) ||
    /\b(?:curl|wget)\b.{0,220}(?:\||;|&&).{0,120}\b(?:eval|exec|iex|invoke-expression)\b/.test(command)
  );
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

function hasEncodedOrInlineExecutionPattern(command: string): boolean {
  const normalized = normalizeCommandForRisk(command);
  const tokens = new Set(commandTokens(normalized));
  const hasInlineInterpreter =
    (tokens.has("node") && (tokens.has("-e") || tokens.has("--eval"))) ||
    (tokens.has("python") && tokens.has("-c")) ||
    (tokens.has("python3") && tokens.has("-c")) ||
    (tokens.has("perl") && tokens.has("-e")) ||
    (tokens.has("ruby") && tokens.has("-e")) ||
    (tokens.has("php") && tokens.has("-r")) ||
    tokens.has("powershell") ||
    tokens.has("pwsh");
  const hasEncodedPayload =
    tokens.has("base64") ||
    tokens.has("-enc") ||
    tokens.has("-encodedcommand") ||
    normalized.includes("buffer.from") ||
    normalized.includes("atob(") ||
    normalized.includes("frombase64");
  const hasDynamicEval =
    tokens.has("eval") ||
    tokens.has("exec") ||
    tokens.has("iex") ||
    normalized.includes("invoke-expression") ||
    normalized.includes("child_process") ||
    normalized.includes("subprocess") ||
    normalized.includes("os.system") ||
    normalized.includes("process.spawn") ||
    normalized.includes("spawn(") ||
    normalized.includes("exec(");
  const hasNetworkFetch =
    normalized.includes("http://") ||
    normalized.includes("https://") ||
    normalized.includes("urllib.request") ||
    normalized.includes("requests.get") ||
    normalized.includes("fetch(") ||
    normalized.includes("http.get") ||
    normalized.includes("https.get") ||
    tokens.has("curl") ||
    tokens.has("wget") ||
    tokens.has("iwr") ||
    normalized.includes("invoke-webrequest");

  return (hasInlineInterpreter && (hasEncodedPayload || hasDynamicEval || hasNetworkFetch)) || (hasEncodedPayload && hasDynamicEval);
}

function hasObfuscatedExecutionPattern(command: string): boolean {
  const normalized = normalizeCommandForRisk(command);
  const hasObfuscation =
    normalized.includes("${ifs}") ||
    /\$'\\x[0-9a-f]{2}/i.test(normalized) ||
    /\\x[0-9a-f]{2}\\x[0-9a-f]{2}/i.test(normalized) ||
    /\bc['"]u['"]rl\b/i.test(normalized) ||
    normalized.includes("string.fromcharcode") ||
    normalized.includes("buffer.from([") ||
    normalized.includes("marshal.loads") ||
    normalized.includes("zlib.decompress") ||
    normalized.includes("base64.b64decode") ||
    normalized.includes("fromcharcode");
  if (!hasObfuscation) {
    return false;
  }
  const tokens = new Set(commandTokens(normalized));
  const hasExecution =
    tokens.has("eval") ||
    tokens.has("exec") ||
    normalized.includes("invoke-expression") ||
    normalized.includes("child_process") ||
    normalized.includes("subprocess") ||
    normalized.includes("os.system") ||
    normalized.includes("new function") ||
    normalized.includes("function(") ||
    tokens.has("node") ||
    tokens.has("python") ||
    tokens.has("python3") ||
    tokens.has("sh") ||
    tokens.has("bash") ||
    normalized.includes("http://") ||
    normalized.includes("https://") ||
    tokens.has("curl") ||
    tokens.has("wget");
  return hasExecution;
}

function hasSecretAccessPattern(command: string): boolean {
  const normalized = normalizeCommandForRisk(command);
  return (
    /(^|[\s@~/'"])(\.npmrc|\.pypirc|\.netrc|\.env|\.git-credentials|\.gitconfig|\.bash_history|\.zsh_history|id_rsa|id_dsa|id_ecdsa|id_ed25519|id_ed25519_sk|private[_-]?key|ssh[_-]?key|mnemonic|seed phrase|wallet|keystore|credentials\.json|service[_-]?account)\b/i.test(
      normalized
    ) ||
    /(^|[\s@~/'"])(\.ssh|\.gnupg|\.aws|\.azure|\.docker|\.kube|\.config\/solana|\.config\/gh|\.config\/gcloud|\.config\/huggingface|\.aptos|\.sui|\.ethereum|\.foundry|\.brownie|\.cargo\/credentials)\b/i.test(
      normalized
    ) ||
    /\b(solana|aptos|sui|ethereum|evm|wallet)\b.{0,120}\b(id\.json|keypair|private[_-]?key|seed|mnemonic|keystore|client\.yaml|config\.yaml)\b/i.test(normalized) ||
    /\b(id\.json|keypair|private[_-]?key|seed|mnemonic|keystore|client\.yaml|config\.yaml)\b.{0,120}\b(solana|aptos|sui|ethereum|evm|wallet)\b/i.test(normalized) ||
    /\b(github_token|npm_token|pypi_token|hf_token|huggingface_hub_token|openai_api_key|anthropic_api_key|coinbase_api_key|base_private_key|wallet_private_key|privy_app_secret|vercel_token|supabase_service_role_key|aws_secret_access_key|aws_session_token|google_application_credentials|ssh_auth_sock)\b/i.test(normalized) ||
    /\b(process\.env|os\.environ|getenv|\/proc\/self\/environ)\b/i.test(normalized) ||
    /\b(169\.254\.169\.254|metadata\.google\.internal)\b/i.test(normalized) ||
    hasEnvironmentDumpExfiltrationPattern(normalized)
  );
}

function hasEnvironmentDumpExfiltrationPattern(command: string): boolean {
  return (
    /\b(?:env|printenv|set)\b.{0,160}\|.{0,160}\b(?:curl|wget|nc|netcat|socat|openssl)\b/i.test(command) ||
    /\b(?:curl|wget)\b.{0,220}(?:--data|--data-binary|-d|-f|--form)\s+@-(?:\s|$).{0,160}\b(?:env|printenv|set)\b/i.test(command) ||
    /\b(?:env|printenv|set)\b.{0,160}\|.{0,160}\b(?:python|python3|node|ruby|perl|php)\b.{0,220}\b(?:requests\.post|fetch\(|http\.post|https\.request|urllib\.request)\b/i.test(
      command
    )
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

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values)];
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
