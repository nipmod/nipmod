#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const errors = [];
const warnings = [];

const namePattern = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;
const marketplaceNamePattern = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

function fail(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function readJson(target, label) {
  try {
    return JSON.parse(await fs.readFile(target, "utf8"));
  } catch (error) {
    fail(`${label} is missing or invalid JSON: ${target} (${error.message})`);
    return null;
  }
}

function safeRelative(value) {
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }
  if (value.startsWith("https://") || value.startsWith("http://")) {
    return true;
  }
  if (path.isAbsolute(value)) {
    return false;
  }
  const normalized = path.posix.normalize(value.replace(/\\/g, "/"));
  return normalized !== ".." && !normalized.startsWith("../");
}

async function ensurePath(pluginDir, pluginName, fieldName, value) {
  if (value === undefined) {
    return;
  }
  const values = Array.isArray(value) ? value : [value];
  for (const entry of values) {
    if (typeof entry === "object" && entry !== null) {
      continue;
    }
    if (typeof entry !== "string" || !safeRelative(entry)) {
      fail(`${pluginName}: ${fieldName} must be a safe relative path or URL.`);
      continue;
    }
    if (entry.startsWith("https://") || entry.startsWith("http://")) {
      continue;
    }
    if (entry.includes("*")) {
      const base = entry.slice(0, entry.indexOf("*"));
      const folder = path.resolve(pluginDir, path.dirname(base));
      if (!(await exists(folder))) {
        fail(`${pluginName}: ${fieldName} glob points at missing folder ${entry}.`);
      }
      continue;
    }
    if (!(await exists(path.resolve(pluginDir, entry)))) {
      fail(`${pluginName}: ${fieldName} references missing path ${entry}.`);
    }
  }
}

async function walk(target) {
  const files = [];
  if (!(await exists(target))) {
    return files;
  }
  const stack = [target];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile()) {
        files.push(full);
      }
    }
  }
  return files;
}

function hasFrontmatter(content, required) {
  if (!content.startsWith("---\n")) {
    return false;
  }
  const end = content.indexOf("\n---\n", 4);
  if (end === -1) {
    return false;
  }
  const block = content.slice(4, end);
  return required.every((key) => new RegExp(`^${key}:\\s*\\S`, "m").test(block));
}

async function validateFrontmatter(pluginDir, pluginName) {
  const checks = [
    { dir: "skills", file: "SKILL.md", keys: ["name", "description"], label: "skill" },
    { dir: "rules", extensions: [".md", ".mdc", ".markdown"], keys: ["description"], label: "rule" },
    { dir: "agents", extensions: [".md", ".mdc", ".markdown"], keys: ["name", "description"], label: "agent" },
    { dir: "commands", extensions: [".md", ".mdc", ".markdown", ".txt"], keys: ["name", "description"], label: "command" }
  ];

  for (const check of checks) {
    const files = await walk(path.join(pluginDir, check.dir));
    for (const file of files) {
      if (check.file && path.basename(file) !== check.file) {
        continue;
      }
      if (check.extensions && !check.extensions.includes(path.extname(file))) {
        continue;
      }
      const content = await fs.readFile(file, "utf8");
      if (!hasFrontmatter(content, check.keys)) {
        fail(`${pluginName}: ${check.label} file missing frontmatter keys ${check.keys.join(", ")}: ${path.relative(root, file)}`);
      }
    }
  }
}

async function main() {
  const marketplacePath = path.join(root, ".cursor-plugin", "marketplace.json");
  const marketplace = await readJson(marketplacePath, "Cursor marketplace manifest");
  if (!marketplace) {
    return;
  }

  if (!marketplaceNamePattern.test(marketplace.name || "")) {
    fail('Marketplace "name" must be lowercase kebab-case.');
  }
  if (!Array.isArray(marketplace.plugins) || marketplace.plugins.length === 0) {
    fail('Marketplace "plugins" must be a non-empty array.');
    return;
  }

  const seen = new Set();
  for (const [index, entry] of marketplace.plugins.entries()) {
    if (!entry || typeof entry !== "object") {
      fail(`plugins[${index}] must be an object.`);
      continue;
    }
    if (!namePattern.test(entry.name || "")) {
      fail(`plugins[${index}].name must be lowercase and path safe.`);
      continue;
    }
    if (seen.has(entry.name)) {
      fail(`Duplicate plugin name ${entry.name}.`);
    }
    seen.add(entry.name);
    if (!safeRelative(entry.source || "")) {
      fail(`${entry.name}: source must be a safe relative path.`);
      continue;
    }

    const pluginDir = path.resolve(root, entry.source);
    if (!(await exists(pluginDir))) {
      fail(`${entry.name}: plugin source folder missing: ${entry.source}`);
      continue;
    }

    const manifestPath = path.join(pluginDir, ".cursor-plugin", "plugin.json");
    const manifest = await readJson(manifestPath, `${entry.name} plugin manifest`);
    if (!manifest) {
      continue;
    }
    if (manifest.name !== entry.name) {
      fail(`${entry.name}: marketplace name does not match plugin.json name.`);
    }
    if (!namePattern.test(manifest.name || "")) {
      fail(`${entry.name}: plugin.json name must be lowercase and path safe.`);
    }
    for (const required of ["displayName", "version", "description"]) {
      if (typeof manifest[required] !== "string" || manifest[required].length === 0) {
        fail(`${entry.name}: plugin.json missing ${required}.`);
      }
    }

    await ensurePath(pluginDir, entry.name, "logo", manifest.logo);
    await ensurePath(pluginDir, entry.name, "skills", manifest.skills);
    await ensurePath(pluginDir, entry.name, "rules", manifest.rules);
    await ensurePath(pluginDir, entry.name, "agents", manifest.agents);
    await ensurePath(pluginDir, entry.name, "commands", manifest.commands);
    await ensurePath(pluginDir, entry.name, "hooks", manifest.hooks);
    await ensurePath(pluginDir, entry.name, "mcpServers", manifest.mcpServers);
    await validateFrontmatter(pluginDir, entry.name);

    if (!(await exists(path.join(pluginDir, "mcp.json")))) {
      warn(`${entry.name}: no mcp.json found.`);
    }
  }
}

await main();

for (const warning of warnings) {
  console.warn(`Warning: ${warning}`);
}

if (errors.length > 0) {
  console.error("Cursor plugin validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Cursor plugin validation passed.");
