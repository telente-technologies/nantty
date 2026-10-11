#!/usr/bin/env node
// pnpm mode:backend | mode:mock | mode:status  [--app <name>] [--api-url <url>] [--mobile-api-url <url>] [--media-url <url>]
import { resolve } from "node:path";
import { parseArgs } from "node:util";

import { appTargets, backendValuesFor, defaultGatewayUrl, defaultMediaOrigin, findTarget, mockValuesFor } from "./appTargets.mjs";
import { mergeEnvValues, readEnvValues } from "./envFile.mjs";
import { detectLanAddress } from "./lanAddress.mjs";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const backupRoot = resolve(repositoryRoot, ".data/modeBackups");
const command = process.argv[2];
const { values: options } = parseArgs({
  args: process.argv.slice(3).filter((argument) => argument !== "--"),
  options: { app: { type: "string", multiple: true }, "api-url": { type: "string" }, "mobile-api-url": { type: "string" }, "media-url": { type: "string" }, help: { type: "boolean" } },
});

if (options.help || !["backend", "mock", "status"].includes(command)) {
  console.log("usage: pnpm mode:backend|mode:mock|mode:status [--app <name>]... [--api-url <url>] [--mobile-api-url <url>] [--media-url <url>]");
  console.log(`apps: ${appTargets.map((target) => target.name).join(", ")}`);
  process.exit(command === undefined || command === "--help" || options.help ? 0 : 1);
}

const targets = (options.app ?? []).length === 0 ? appTargets : options.app.flatMap((name) => name.split(",")).map(findTarget);
const envPathFor = (target) => resolve(repositoryRoot, target.directory, target.envFile);
const isLocalUrl = (url) => /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?/.test(url);

function mobileApiUrl(apiUrl) {
  if (options["mobile-api-url"]) return options["mobile-api-url"];
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(apiUrl)) return apiUrl;
  const lanAddress = detectLanAddress();
  if (lanAddress === null) {
    console.warn("warning: no LAN address found; mobile keeps localhost, which only works in a simulator or with adb reverse.");
    return apiUrl;
  }
  return apiUrl.replace(/\/\/(localhost|127\.0\.0\.1)/, `//${lanAddress}`);
}

function describeMode(target, values) {
  if (target.mockKey === null) return "real (no mocks)";
  const flag = values[target.mockKey];
  if (flag === "false") return "backend";
  const prefixes = (values[target.prefixKey] ?? "").trim();
  const mode = prefixes === "" ? "mock" : "hybrid";
  return flag === "true" ? mode : `${mode} (default)`;
}

function printTable(rows, columns) {
  const widths = columns.map((column) => Math.max(column.length, ...rows.map((row) => String(row[column] ?? "").length)));
  const line = (cells) => cells.map((cell, index) => String(cell ?? "").padEnd(widths[index])).join("  ");
  console.log(line(columns));
  console.log(line(widths.map((width) => "-".repeat(width))));
  for (const row of rows) console.log(line(columns.map((column) => row[column])));
}

async function probe(url) {
  try {
    const response = await fetch(`${url.replace(/\/+$/, "")}/healthz`, { signal: AbortSignal.timeout(2500) });
    return response.ok ? "reachable" : `answers ${response.status}`;
  } catch {
    return "not reachable";
  }
}

function switchMode() {
  const apiUrl = (options["api-url"] ?? defaultGatewayUrl).replace(/\/+$/, "");
  const mediaOrigin = options["media-url"] ?? (isLocalUrl(apiUrl) ? defaultMediaOrigin : null);
  const rows = [];
  for (const target of targets) {
    let updates;
    if (command === "backend") {
      const targetApiUrl = target.kind === "expo" ? mobileApiUrl(apiUrl) : apiUrl;
      updates = backendValuesFor(target, { apiUrl: targetApiUrl, mediaOrigin: mediaOrigin ?? "" });
      if (mediaOrigin === null) {
        const current = readEnvValues(envPathFor(target));
        for (const key of target.mediaKeys) {
          if (current[key] === defaultMediaOrigin) updates[key] = "";
          else delete updates[key];
        }
      }
    } else {
      updates = mockValuesFor(target);
      if (Object.keys(updates).length === 0) {
        rows.push({ app: target.name, mode: "real (no mocks)", "api url": readEnvValues(envPathFor(target))[target.apiKey] ?? "(default)", "env file": `${target.directory}/${target.envFile}`, result: "unchanged" });
        continue;
      }
    }
    const header = `# Written by pnpm mode:${command} (scripts/localMode). Only the mode keys are managed; add your own keys freely.`;
    const result = mergeEnvValues(envPathFor(target), updates, { backupRoot, label: target.name, header });
    const values = readEnvValues(envPathFor(target));
    rows.push({ app: target.name, mode: describeMode(target, values), "api url": values[target.apiKey] ?? "(default)", "env file": `${target.directory}/${target.envFile}`, result: result.changed ? (result.backup ? "updated (backup in .data/modeBackups)" : "created") : "unchanged" });
  }
  printTable(rows, ["app", "mode", "api url", "env file", "result"]);
  console.log("");
  console.log("Restart running dev servers so they pick up the change (Next reads env at start; Expo: `pnpm --filter @zudomart/mobile exec expo start -c`).");
  if (command === "backend") {
    console.log("Backend not running? `pnpm backend:up` (add `-- --lan` so a phone on the same Wi-Fi can reach the gateway). Check it with `pnpm mode:status`.");
  }
}

async function showStatus() {
  const rows = targets.map((target) => {
    const values = readEnvValues(envPathFor(target));
    return { app: target.name, mode: describeMode(target, values), "api url": values[target.apiKey] ?? "(app default)", "env file": `${target.directory}/${target.envFile}` };
  });
  const urls = [...new Set(rows.map((row) => row["api url"]).filter((url) => /^https?:\/\//.test(url)))];
  if (!urls.includes(defaultGatewayUrl)) urls.push(defaultGatewayUrl);
  const reachability = Object.fromEntries(await Promise.all(urls.map(async (url) => [url, await probe(url)])));
  for (const row of rows) row.backend = row.mode === "mock" || row.mode === "mock (default)" ? "not needed" : (reachability[row["api url"]] ?? reachability[defaultGatewayUrl]);
  printTable(rows, ["app", "mode", "api url", "backend", "env file"]);
  console.log("");
  for (const url of urls) console.log(`gateway ${url}: ${reachability[url]}`);
}

if (command === "status") await showStatus();
else switchMode();
