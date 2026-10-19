#!/usr/bin/env node
// pnpm check:no-mocks [app...] [--require-build] [--mobile-export <dir>]
// Fails when a production `next build` output (.next/server, .next/static) contains mock-backend code, or when an EAS
// production/preview profile can switch the mobile app into mock mode. Run it after `next build` in CI.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const nextApps = ["webapp", "seller", "studio", "ads", "admin"];
const args = process.argv.slice(2).filter((argument) => argument !== "--");
const requireBuild = args.includes("--require-build");
const exportFlag = args.indexOf("--mobile-export");
const mobileExportDirectory = exportFlag === -1 ? null : resolve(args[exportFlag + 1] ?? "");
const requested = args.filter((argument, index) => !argument.startsWith("--") && (exportFlag === -1 || index !== exportFlag + 1));
const fixedMarkers = ["zudomart-mock-backend-bundled", "The demo backend hit an error."];
const problems = [];

function listFiles(directory, accept, skip = () => false) {
  if (!existsSync(directory)) return [];
  const files = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (skip(path)) continue;
    if (statSync(path).isDirectory()) files.push(...listFiles(path, accept, skip));
    else if (accept(path)) files.push(path);
  }
  return files;
}

// Seed ids such as "store_ife_lifestyle" only exist in src/mocks; finding one in the build means mock data shipped.
function seedMarkersFor(appDirectory) {
  const source = join(appDirectory, "src");
  const isMock = (path) => path.includes(`${join(source, "mocks")}`);
  const isTest = (path) => /\.(test|spec)\.tsx?$/.test(path) || path.includes("__tests__") || path.includes(join(source, "contracts"));
  const sources = listFiles(source, (path) => /\.tsx?$/.test(path));
  const literals = new Set();
  for (const path of sources.filter(isMock)) {
    for (const match of readFileSync(path, "utf8").matchAll(/"([a-z][a-z0-9]*_[a-z0-9_]{4,60})"/g)) literals.add(match[1]);
  }
  const elsewhere = sources.filter((path) => !isMock(path) && !isTest(path)).map((path) => readFileSync(path, "utf8")).join("\n");
  return [...literals].filter((literal) => !elsewhere.includes(literal) && /\d|_(demo|mock|seed)|^(usr|user|store|prd|prod|post|clip|live|ord|order|camp|adm|staff|acct|chat|conv)_/.test(literal));
}

function checkNextApp(app) {
  const appDirectory = resolve(repositoryRoot, "apps", app);
  const buildDirectory = join(appDirectory, ".next");
  if (!existsSync(join(buildDirectory, "BUILD_ID"))) {
    if (requireBuild) problems.push(`${app}: no production build found (.next/BUILD_ID); run next build first`);
    else console.log(`skip   ${app}: no production build in .next`);
    return;
  }
  const markers = [...fixedMarkers, ...seedMarkersFor(appDirectory)];
  const pattern = new RegExp(markers.map((marker) => marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g");
  const skip = (path) => /[\\/]\.next[\\/](cache|dev|trace)/.test(path);
  const files = [join(buildDirectory, "server"), join(buildDirectory, "static")].flatMap((directory) => listFiles(directory, (path) => /\.(js|mjs|cjs|json|html|rsc|body)$/.test(path), skip));
  const hits = new Map();
  for (const path of files) {
    for (const match of readFileSync(path, "utf8").matchAll(pattern)) {
      const where = hits.get(match[0]) ?? new Set();
      where.add(relative(appDirectory, path));
      hits.set(match[0], where);
    }
  }
  if (hits.size === 0) {
    console.log(`ok     ${app}: ${files.length} build files, ${markers.length} mock markers, none found`);
    return;
  }
  for (const [marker, where] of hits) problems.push(`${app}: mock marker "${marker}" in ${[...where].slice(0, 3).join(", ")}${where.size > 3 ? ` and ${where.size - 3} more` : ""}`);
}

// An `npx expo export` output (JS or Hermes bytecode keeps string literals readable) built with mocks off.
function checkMobileExport(directory) {
  const markers = seedMarkersFor(resolve(repositoryRoot, "apps/mobile"));
  const pattern = new RegExp(markers.map((marker) => marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g");
  const files = listFiles(directory, (path) => /\.(js|hbc|bundle)$/.test(path));
  if (files.length === 0) {
    problems.push(`mobile: no bundle found in ${directory}`);
    return;
  }
  const hits = new Set();
  for (const path of files) for (const match of readFileSync(path, "latin1").matchAll(pattern)) hits.add(match[0]);
  if (hits.size === 0) console.log(`ok     mobile export: ${files.length} bundle file(s), ${markers.length} mock markers, none found`);
  else problems.push(`mobile export: ${hits.size} mock marker(s) bundled, e.g. ${[...hits].slice(0, 5).join(", ")}`);
}

function checkMobile() {
  const before = problems.length;
  const eas = JSON.parse(readFileSync(resolve(repositoryRoot, "apps/mobile/eas.json"), "utf8"));
  for (const [profile, settings] of Object.entries(eas.build ?? {})) {
    if (profile === "base" || profile === "demo") continue;
    const value = settings.env?.EXPO_PUBLIC_USE_MOCKS;
    if (value !== "false") problems.push(`mobile: EAS profile "${profile}" must set EXPO_PUBLIC_USE_MOCKS to "false" (found ${JSON.stringify(value)}); only "demo" may use mocks`);
  }
  const apiConfig = readFileSync(resolve(repositoryRoot, "apps/mobile/src/config/api.config.ts"), "utf8");
  if (/extra\.useMocks \?\? true/.test(apiConfig)) problems.push("mobile: api.config.ts defaults to mocks when EXPO_PUBLIC_USE_MOCKS is unset; default to __DEV__");
  const appJson = JSON.parse(readFileSync(resolve(repositoryRoot, "apps/mobile/app.json"), "utf8"));
  if (appJson.expo?.extra?.useMocks === true) problems.push("mobile: app.json extra.useMocks is true, which turns mocks on in every build");
  if (problems.length === before) console.log("ok     mobile: EAS profiles + api config + app.json checked (demo is the only mock profile)");
}

const targets = requested.length === 0 ? [...nextApps, "mobile"] : requested;
for (const target of targets) {
  if (target === "mobile") {
    checkMobile();
    if (mobileExportDirectory !== null) checkMobileExport(mobileExportDirectory);
  }
  else if (nextApps.includes(target)) checkNextApp(target);
  else if (target !== "web") problems.push(`unknown app ${target}`);
}
if (problems.length > 0) {
  for (const problem of problems) console.error(`FAIL   ${problem}`);
  process.exit(1);
}
console.log("no mock code in the checked production builds");
