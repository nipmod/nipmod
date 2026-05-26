import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export type BuildLogChange = {
  files: string[];
  message: string;
};

export type BuildLogDraft = {
  changeCount: number;
  generatedAt: string;
  notableAreas: string[];
  post: string | null;
  skipped: boolean;
  summary: string;
  type: "dev.nipmod.daily-build-log.v1";
};

type Area = {
  label: string;
  priority: number;
  test: (file: string) => boolean;
  update: string;
};

const AREAS: Area[] = [
  {
    label: "api",
    priority: 100,
    test: (file) => file.startsWith("site/app/api/") || file.startsWith("site/lib/api-") || file.includes("external-packages"),
    update: "API behavior, source resolution and agent-facing response contracts"
  },
  {
    label: "ops",
    priority: 92,
    test: (file) => file.includes("rate-limit") || file.includes("api-usage") || file.includes("admin") || file.startsWith("supabase/"),
    update: "Usage, rate-limit and operator visibility"
  },
  {
    label: "trust",
    priority: 88,
    test: (file) => file.includes("trust") || file.includes("install-plan") || file.includes("source-depth") || file.includes("archive-depth"),
    update: "Trust signals, install-plan checks and source-depth verification"
  },
  {
    label: "site",
    priority: 72,
    test: (file) => file.startsWith("site/app/") || file.startsWith("site/public/"),
    update: "Website structure, docs surface and responsive product polish"
  },
  {
    label: "docs",
    priority: 58,
    test: (file) => file.startsWith("docs/") || ["README.md", "ARCHITECTURE.md", "ROADMAP.md", "CHANGELOG.md"].includes(file),
    update: "Public docs, architecture notes and launch material"
  },
  {
    label: "tests",
    priority: 52,
    test: (file) => file.includes(".test.") || file.includes("/test/") || file.includes("/e2e/"),
    update: "Test coverage and release checks"
  },
  {
    label: "tools",
    priority: 46,
    test: (file) => file.startsWith("tools/") || file.startsWith("scripts/"),
    update: "Internal tooling and release workflow"
  }
];

const LOW_SIGNAL_PATTERNS = [/pnpm-lock\.yaml$/, /^site\/next-env\.d\.ts$/, /\.(sig|sha256)$/];

export function createDailyBuildLogDraft(
  changes: BuildLogChange[],
  options: { generatedAt?: Date; maxItems?: number } = {}
): BuildLogDraft {
  const generatedAt = options.generatedAt ?? new Date();
  const meaningful = changes.filter((change) => change.files.some((file) => !LOW_SIGNAL_PATTERNS.some((pattern) => pattern.test(file))));
  const scores = new Map<string, { area: Area; count: number; messages: string[] }>();

  for (const change of meaningful) {
    for (const area of AREAS) {
      if (!change.files.some(area.test)) {
        continue;
      }
      const current = scores.get(area.label) ?? { area, count: 0, messages: [] };
      current.count += 1;
      if (change.message && !current.messages.includes(change.message)) {
        current.messages.push(change.message);
      }
      scores.set(area.label, current);
    }
  }

  const ranked = [...scores.values()]
    .sort((left, right) => right.area.priority + right.count * 4 - (left.area.priority + left.count * 4))
    .slice(0, options.maxItems ?? 3);

  if (ranked.length === 0) {
    return {
      changeCount: changes.length,
      generatedAt: generatedAt.toISOString(),
      notableAreas: [],
      post: null,
      skipped: true,
      summary: "No meaningful public dev update found in the selected range.",
      type: "dev.nipmod.daily-build-log.v1"
    };
  }

  const bullets = ranked.map((entry, index) => `${index + 1}. ${entry.area.update}.`);
  const focus = focusLine(ranked.map((entry) => entry.area.label));
  const post = [
    "Nipmod dev update.",
    "",
    "Today we improved:",
    ...bullets,
    "",
    `Focus: ${focus}.`
  ].join("\n");

  return {
    changeCount: changes.length,
    generatedAt: generatedAt.toISOString(),
    notableAreas: ranked.map((entry) => entry.area.label),
    post,
    skipped: false,
    summary: `Drafted ${ranked.length} public update item${ranked.length === 1 ? "" : "s"} from ${meaningful.length} meaningful change${meaningful.length === 1 ? "" : "s"}.`,
    type: "dev.nipmod.daily-build-log.v1"
  };
}

export function collectGitChanges({ includeDirty = true, since = "24 hours ago" }: { includeDirty?: boolean; since?: string } = {}): BuildLogChange[] {
  const commits = git(["log", `--since=${since}`, "--pretty=format:%H%x1f%s"]).split("\n").filter(Boolean);
  const changes: BuildLogChange[] = commits.map((line) => {
    const [hash, message = ""] = line.split("\x1f");
    return {
      files: git(["diff-tree", "--no-commit-id", "--name-only", "-r", hash]).split("\n").filter(Boolean),
      message: cleanMessage(message)
    };
  });

  if (!includeDirty) {
    return changes;
  }

  const dirtyFiles = git(["status", "--porcelain"])
    .split("\n")
    .map((line) => line.slice(3).trim())
    .filter(Boolean)
    .map((file) => file.replace(/^"|"$/g, ""));
  if (dirtyFiles.length > 0) {
    changes.unshift({
      files: dirtyFiles,
      message: "Working tree changes"
    });
  }
  return changes;
}

function focusLine(labels: string[]): string {
  if (labels.includes("api") || labels.includes("trust")) {
    return "making the key-required beta more useful for agents before they touch a workspace";
  }
  if (labels.includes("ops")) {
    return "keeping the beta measurable and operationally clear";
  }
  if (labels.includes("site") || labels.includes("docs")) {
    return "making the agent-facing surface clearer and easier to read";
  }
  return "turning real engineering changes into a cleaner package intelligence layer";
}

function cleanMessage(message: string): string {
  return message.replace(/^Merge pull request #[0-9]+ from \S+\s*/i, "").trim();
}

function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function optionValue(name: string): string | undefined {
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length);
  }
  const index = process.argv.indexOf(name);
  if (index !== -1) {
    return process.argv[index + 1];
  }
  return undefined;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const since = optionValue("--since") ?? "24 hours ago";
  const format = optionValue("--format") ?? "text";
  const includeDirty = !process.argv.includes("--no-dirty");
  const draft = createDailyBuildLogDraft(collectGitChanges({ includeDirty, since }));

  if (format === "json") {
    console.log(JSON.stringify(draft, null, 2));
  } else if (draft.post) {
    console.log(draft.post);
  } else {
    console.log(draft.summary);
  }
}
