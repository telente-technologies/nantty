import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

const keptBackupsPerFile = 5;

export function readEnvValues(path) {
  if (!existsSync(path)) return {};
  const values = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (match === null) continue;
    values[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
  }
  return values;
}

function formatLine(key, value) {
  return /[\s#"'$\\]/.test(value) ? `${key}="${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\$/g, "\\$").replace(/\n/g, "\\n").replace(/\r/g, "\\r")}"` : `${key}=${value}`;
}

function backUp(path, backupRoot, label) {
  const directory = join(backupRoot, label);
  mkdirSync(directory, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const prefix = basename(path).replace(/^\./, "");
  const target = join(directory, `${prefix}.${stamp}`);
  copyFileSync(path, target);
  const backups = readdirSync(directory).filter((name) => name.startsWith(`${prefix}.`)).sort();
  for (const old of backups.slice(0, Math.max(0, backups.length - keptBackupsPerFile))) rmSync(join(directory, old));
  return target;
}

// Rewrites only the given keys in place (or appends them) and keeps every other line, comment and secret untouched.
export function mergeEnvValues(path, updates, { backupRoot, label, header }) {
  const exists = existsSync(path);
  const original = exists ? readFileSync(path, "utf8") : "";
  const lines = original === "" ? [] : original.replace(/\n$/, "").split("\n");
  const wanted = new Map(Object.entries(updates));
  const seen = new Set();
  const merged = lines.map((line) => {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
    if (match === null || !wanted.has(match[1])) return line;
    seen.add(match[1]);
    return formatLine(match[1], wanted.get(match[1]));
  });
  const missing = [...wanted].filter(([key]) => !seen.has(key));
  if (missing.length > 0) {
    if (!exists) merged.push(header);
    for (const [key, value] of missing) merged.push(formatLine(key, value));
  }
  const next = `${merged.join("\n")}\n`;
  if (next === original) return { changed: false, backup: null };
  const backup = exists ? backUp(path, backupRoot, label) : null;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, next, { mode: 0o600 });
  return { changed: true, backup };
}
