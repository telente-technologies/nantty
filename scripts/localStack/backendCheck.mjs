#!/usr/bin/env node
// pnpm backend:check [-- --api-url <url>]: hits key endpoints through the gateway as the demo buyer and prints pass/fail.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const urlFlag = process.argv.indexOf("--api-url");
const gateway = (urlFlag === -1 ? process.env.SMOKE_GATEWAY_URL ?? "http://127.0.0.1:8080" : process.argv[urlFlag + 1]).replace(/\/+$/, "");
const accountsSource = readFileSync(resolve(repositoryRoot, "scripts/localStack/demoAccounts.mts"), "utf8");
const demoPassword = /demoPassword = "([^"]+)"/.exec(accountsSource)?.[1];
const buyerEmail = /"(demo\.buyer@[^"]+)"/.exec(accountsSource)?.[1];
const realtimeUrl = (process.env.REALTIME_URL ?? "http://127.0.0.1:4000").replace(/\/+$/, "");
const results = [];
let token = null;

async function call(method, path, body) {
  const headers = { accept: "application/json", "x-device-id": "backend-check" };
  if (token !== null) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(`${gateway}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15_000) });
  const text = await response.text();
  let json = null;
  try { json = text === "" ? null : JSON.parse(text); } catch {}
  return { status: response.status, json, text };
}

const itemsOf = (json) => (Array.isArray(json?.data) ? json.data : Array.isArray(json?.items) ? json.items : Array.isArray(json) ? json : null);

async function check(name, run) {
  try {
    const reason = await run();
    results.push({ name, pass: true, reason });
  } catch (error) {
    results.push({ name, pass: false, reason: error instanceof Error ? error.message : String(error) });
  }
}

function expectStatus(response, ...allowed) {
  if (!allowed.includes(response.status)) throw new Error(`HTTP ${response.status} ${(response.text ?? "").slice(0, 160)}`);
}

await check("gateway /healthz", async () => {
  const response = await call("GET", "/healthz");
  expectStatus(response, 200);
  return "up";
});
await check(`login as ${buyerEmail}`, async () => {
  const response = await call("POST", "/api/v1/auth/login", { identifier: buyerEmail, password: demoPassword });
  expectStatus(response, 200);
  if (typeof response.json?.accessToken !== "string") throw new Error("no accessToken in the response");
  token = response.json.accessToken;
  return "token issued";
});
await check("profile /users/me", async () => {
  const response = await call("GET", "/api/v1/users/me");
  expectStatus(response, 200);
  return `@${response.json?.username ?? "?"}`;
});
for (const [name, path] of [["feed /feeds/for-you", "/api/v1/feeds/for-you"], ["feed /feeds/following", "/api/v1/feeds/following"], ["clips /clips", "/api/v1/clips?tab=forYou"], ["products /products", "/api/v1/products"]]) {
  await check(name, async () => {
    const response = await call("GET", path);
    expectStatus(response, 200);
    const items = itemsOf(response.json);
    if (items === null) throw new Error("not a list envelope");
    if (items.length === 0) throw new Error("empty (run pnpm backend:seed)");
    return `${items.length} item(s)`;
  });
}
await check("lives /lives", async () => {
  const response = await call("GET", "/api/v1/lives");
  expectStatus(response, 200);
  return `${itemsOf(response.json)?.length ?? "?"} live(s)`;
});
await check("realtime :4000/healthz", async () => {
  const response = await fetch(`${realtimeUrl}/healthz`, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return "up";
});
await check("realtime socket auth", async () => {
  const issued = await call("POST", "/api/v1/auth/realtime-token", {});
  expectStatus(issued, 200, 201);
  if (typeof issued.json?.realtimeToken !== "string") throw new Error("no realtimeToken in the response");
  const socket = new WebSocket(`${realtimeUrl.replace(/^http/, "ws")}/ws`);
  const reply = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("no auth reply within 10s")), 10_000);
    socket.addEventListener("open", () => socket.send(JSON.stringify({ type: "auth", accessToken: issued.json.realtimeToken })));
    socket.addEventListener("message", (event) => { clearTimeout(timer); resolve(JSON.parse(String(event.data))); });
    socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error("socket error")); });
  }).finally(() => socket.close());
  if (reply.type !== "auth.ok") throw new Error(`socket replied ${JSON.stringify(reply)}`);
  return "auth.ok";
});
await check("wallet /wallets/me", async () => {
  const response = await call("GET", "/api/v1/wallets/me");
  expectStatus(response, 200);
  return "summary returned";
});

const width = Math.max(...results.map((result) => result.name.length));
for (const result of results) console.log(`${result.pass ? "PASS" : "FAIL"}  ${result.name.padEnd(width)}  ${result.reason}`);
const failed = results.filter((result) => !result.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed against ${gateway}`);
process.exit(failed === 0 ? 0 : 1);
