#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createWriteStream, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(packageRoot, "../../..");
const lockFile = process.env.E2E_HEAVY_LOCK ?? "/tmp/claude-1000/-home-oyinlola-Desktop-zudomart/2de9a368-cb79-4f3f-8721-930271160239/scratchpad/heavy.lock";

if (process.env.E2E_LOCK_HELD !== "1" && process.env.E2E_NO_LOCK !== "1") {
  mkdirSync(dirname(lockFile), { recursive: true });
  const relaunched = spawnSync("flock", [lockFile, process.execPath, fileURLToPath(import.meta.url), ...process.argv.slice(2)], { stdio: "inherit", env: { ...process.env, E2E_LOCK_HELD: "1" } });
  process.exit(relaunched.status ?? 1);
}

const order = ["webapp", "web", "studio", "seller", "ads", "admin"];
const ports = { web: 3100, seller: 3200, ads: 3300, admin: 3400, webapp: 3500, studio: 3600 };
const gateway = process.env.SMOKE_GATEWAY_URL ?? "http://127.0.0.1:8080";
const mediaOrigin = process.env.E2E_MEDIA_ORIGIN ?? "http://localhost:18333";

const separator = process.argv.indexOf("--");
const ownArgs = separator === -1 ? process.argv.slice(2) : process.argv.slice(2, separator);
const playwrightArgs = separator === -1 ? [] : process.argv.slice(separator + 1);
const mode = ownArgs.find((arg) => arg.startsWith("--mode="))?.slice(7) ?? "dev";
const requested = ownArgs.filter((arg) => !arg.startsWith("--"));
const apps = requested.length === 0 || requested.includes("all") ? order : requested;
for (const app of apps) if (!order.includes(app)) throw new Error(`unknown app ${app}; pick from ${order.join(", ")}`);

function secret() {
  return randomBytes(32).toString("hex");
}

function environmentFor(app) {
  const origin = `http://localhost:${ports[app]}`;
  const shared = { NEXT_PUBLIC_SITE_URL: origin, NEXT_PUBLIC_MAIL_DOMAIN: "nantty.com", NEXT_TELEMETRY_DISABLED: "1", PORT: String(ports[app]) };
  const urls = { NEXT_PUBLIC_MARKETING_SITE_URL: "http://localhost:3100", NEXT_PUBLIC_SELLER_WEB_URL: "http://localhost:3200", NEXT_PUBLIC_ADS_MANAGER_URL: "http://localhost:3300", NEXT_PUBLIC_WEBAPP_URL: "http://localhost:3500", NEXT_PUBLIC_DASHBOARD_URL: "http://localhost:3200" };
  switch (app) {
    case "webapp":
      return { ...shared, ...urls, WEBAPP_ORIGIN: origin, WEBAPP_API_URL: gateway, WEBAPP_MEDIA_URL: mediaOrigin, WEBAPP_USE_MOCKS: "false", WEBAPP_REAL_API_PREFIXES: "", WEBAPP_SESSION_SECRET: secret(), NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.E2E_TURNSTILE_SITE_KEY ?? "1x00000000000000000000AA" };
    case "studio":
      return { ...shared, STUDIO_ORIGIN: origin, STUDIO_API_URL: gateway, STUDIO_MEDIA_URL: mediaOrigin, STUDIO_USE_MOCKS: "false", STUDIO_REAL_API_PREFIXES: "", STUDIO_SESSION_SECRET: secret(), RTMP_INGEST_URL: "rtmp://localhost:1935/live", HLS_PLAYBACK_URL: "http://localhost:8888/hls" };
    case "seller":
      return { ...shared, ...urls, DASHBOARD_ORIGIN: origin, SELLER_API_URL: gateway, SELLER_MEDIA_URL: mediaOrigin, SELLER_UPLOAD_ORIGINS: mediaOrigin, SELLER_USE_MOCKS: "false", SELLER_REAL_API_PREFIXES: "", SELLER_SESSION_SECRET: secret(), SELLER_REALTIME_URL: process.env.E2E_REALTIME_URL ?? "ws://127.0.0.1:4000/ws" };
    case "ads":
      return { ...shared, ADS_ORIGIN: origin, ADS_API_URL: gateway, ADS_MEDIA_URL: mediaOrigin, ADS_UPLOAD_URL: mediaOrigin, ADS_USE_MOCKS: "false", ADS_REAL_API_PREFIXES: "", ADS_SESSION_SECRET: secret(), ADS_CHECKOUT_HOSTS: "checkout.flutterwave.com,checkout-testing.flutterwave.com", NEXT_PUBLIC_ADS_CHECKOUT_HOSTS: "checkout.flutterwave.com,checkout-testing.flutterwave.com" };
    case "admin":
      return { ...shared, ADMIN_ORIGIN: origin, ADMIN_API_URL: gateway, ADMIN_MEDIA_URL: mediaOrigin, ADMIN_USE_MOCKS: "false", ADMIN_REAL_API_PREFIXES: "", ADMIN_SESSION_SECRET: secret(), ADMIN_ENVIRONMENT: "development", ADMIN_IP_ALLOWLIST: "" };
    case "web":
      return { ...shared, ...urls, NEXT_PUBLIC_API_URL: gateway };
  }
}

async function isUp(url, requireHealthy = false) {
  try {
    const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(60_000) });
    if (requireHealthy && response.status >= 500) console.error(`[e2e] ${url} answers ${response.status}; running specs anyway so they record it`);
    return response.status > 0;
  } catch {
    return false;
  }
}

async function waitUntilUp(url, child, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`app exited early with code ${child.exitCode}`);
    if (await isUp(url, true)) return;
    await new Promise((done) => setTimeout(done, 2000));
  }
  throw new Error(`${url} did not come up within ${timeoutMs / 1000}s`);
}

function stop(child) {
  return new Promise((done) => {
    if (child.exitCode !== null) return done();
    const timer = setTimeout(() => {
      try { process.kill(-child.pid, "SIGKILL"); } catch {}
    }, 15_000);
    child.once("exit", () => { clearTimeout(timer); done(); });
    try { process.kill(-child.pid, "SIGTERM"); } catch { done(); }
  });
}

function runCommand(command, args, options) {
  return new Promise((done) => {
    const child = spawn(command, args, { stdio: "inherit", ...options });
    child.once("exit", (code) => done(code ?? 1));
  });
}

const logDirectory = resolve(packageRoot, "reports/appLogs");
mkdirSync(logDirectory, { recursive: true });
const results = {};

for (const app of apps) {
  const url = `http://localhost:${ports[app]}`;
  if (await isUp(url)) {
    console.error(`[e2e] ${url} is already serving; stop it first so only one app runs at a time.`);
    results[app] = "skipped: port busy";
    continue;
  }
  const appDirectory = resolve(repositoryRoot, "apps", app);
  const env = { ...process.env, ...environmentFor(app), NODE_ENV: mode === "start" ? "production" : "development" };
  const log = createWriteStream(resolve(logDirectory, `${app}.log`));
  if (mode === "start") {
    console.log(`[e2e] building ${app}`);
    const built = await runCommand("pnpm", ["exec", "next", "build"], { cwd: appDirectory, env });
    if (built !== 0) { results[app] = `build failed (${built})`; continue; }
  }
  console.log(`[e2e] starting ${app} (${mode}) on ${url}`);
  const server = spawn("pnpm", ["exec", "next", mode, "--port", String(ports[app])], { cwd: appDirectory, env, detached: true, stdio: ["ignore", "pipe", "pipe"] });
  server.stdout.pipe(log);
  server.stderr.pipe(log);
  try {
    await waitUntilUp(url, server, 300_000);
    console.log(`[e2e] ${app} is up; running specs`);
    const code = await runCommand("pnpm", ["exec", "playwright", "test", `--project=${app}`, ...playwrightArgs], { cwd: packageRoot, env: { ...process.env, E2E_APP: app } });
    results[app] = code === 0 ? "passed" : `failed (${code})`;
  } catch (error) {
    results[app] = `harness error: ${error.message}`;
  } finally {
    await stop(server);
    log.end();
  }
}

console.log("[e2e] results", JSON.stringify(results, null, 2));
process.exit(Object.values(results).every((result) => result === "passed") ? 0 : 1);
