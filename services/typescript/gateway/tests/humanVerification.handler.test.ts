import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import type { Logger } from "@nantty/fastify-platform";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createGatewayServer } from "../src/app.js";
import type { GatewayConfig } from "../src/configs/gateway.config.js";
import type { AccessTokenVerifier, VerifiedPrincipal } from "../src/services/accessTokenVerifier.service.js";
import { defaultProbeThresholds } from "../src/services/security/accessProbeDetector.service.js";
import { classifyRequestSensitivity } from "../src/services/security/humanVerificationGate.service.js";
import type { HumanVerificationProvider } from "../src/services/security/humanVerificationProvider.service.js";
import type { AccessViolationEvidence, ChallengeOutcomeReport, ChallengeState, TrustSecurityClient } from "../src/services/security/securitySignalSink.service.js";
import { buildSecurityServices } from "../src/services/security/securityServices.service.js";

const turnstileAlwaysPassToken = "XXXX.DUMMY.TOKEN.XXXX";
const principals: Record<string, VerifiedPrincipal> = {
  "token-flagged": { accountId: "acct-flagged", sessionId: "s-flagged", roles: [] },
  "token-bot": { accountId: "acct-bot", sessionId: "s-bot", roles: [] },
  "token-clean": { accountId: "acct-clean", sessionId: "s-clean", roles: [] },
  "token-failing": { accountId: "acct-failing", sessionId: "s-failing", roles: [] },
};

class FakeTrust implements TrustSecurityClient {
  public readonly states = new Map<string, ChallengeState>();
  public readonly outcomes: ChallengeOutcomeReport[] = [];
  public readonly violations: AccessViolationEvidence[] = [];
  public async reportAccessViolation(evidence: AccessViolationEvidence): Promise<void> { this.violations.push(evidence); }
  public async readChallengeState(accountId: string): Promise<ChallengeState> { return this.states.get(accountId) ?? { requirement: "none" }; }
  public async reportChallengeOutcome(report: ChallengeOutcomeReport): Promise<ChallengeState> {
    this.outcomes.push(report);
    const current = await this.readChallengeState(report.accountId);
    const failures = this.outcomes.filter((outcome) => outcome.accountId === report.accountId && !outcome.passed).length;
    if (!report.passed) return { ...current, failuresInWindow: failures, failuresAllowed: 5, suspended: failures >= 5 };
    if (current.requirement === "once") this.states.set(report.accountId, { requirement: "none", clearedUntil: "2026-10-05T00:00:00Z" });
    return this.readChallengeState(report.accountId);
  }
}

class UnavailableTrust extends FakeTrust {
  public override async readChallengeState(_accountId: string): Promise<ChallengeState> { throw new Error("trust service unavailable"); }
}

const provider: HumanVerificationProvider = { name: "turnstile", verifyChallengeToken: async (token) => ({ success: token === turnstileAlwaysPassToken, errorCodes: token === turnstileAlwaysPassToken ? [] : ["invalid-input-response"] }) };
const logged: string[] = [];
const logger = { info: (...args: unknown[]) => logged.push(JSON.stringify(args)), warn: (...args: unknown[]) => logged.push(JSON.stringify(args)), error: (...args: unknown[]) => logged.push(JSON.stringify(args)), debug: () => undefined, child: () => logger } as unknown as Logger;
const verifier = { verifyAccessTokenWithJwks: async (token: string) => principals[token], verifyStaffAccessToken: async (token: string) => (token === "staff-token" ? { accountId: "staff-1", sessionId: "s-staff", roles: [] } : undefined) } as unknown as AccessTokenVerifier;

const trust = new FakeTrust();
let upstream: Server;
let gateway: ReturnType<typeof createGatewayServer>;
let base: string;
let configForTest: GatewayConfig;
let upstreamStatus = 200;

beforeAll(async () => {
  upstream = createServer((_request, response) => { response.writeHead(upstreamStatus, { "content-type": "application/json" }); response.end("{}"); });
  await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;
  configForTest = {
    host: "127.0.0.1", port: 0, corsOrigins: [], rateLimitMaxPerMinute: 0, upstreamTimeoutMs: 2_000, policyGate: null, guestRateLimits: { perMinute: 1000, sensitivePerMinute: 1000 },
    accessToken: { jwksUrl: "http://unused.invalid/jwks.json", issuer: "https://auth.nantty.test", audience: "nantty-api" },
    upstreams: { identity: url, live: url, money: url, notifications: url, social: url, trust: url, commerce: url, media: url, search: url, ads: url, support: url },
    security: { trustInternalToken: "t".repeat(32), humanVerification: { provider: "turnstile", secretKey: "1x0000000000000000000000000000000AA", siteKey: "1x00000000000000000000AA", expectedHostnames: [], attemptsPerMinute: 10 }, probeThresholds: defaultProbeThresholds },
  };
  gateway = createGatewayServer({ config: configForTest, verifier, logger, security: { trust, provider } });
  await gateway.start();
  base = `http://127.0.0.1:${gateway.address?.port}`;
});

afterAll(async () => {
  await gateway.stop();
  await new Promise<void>((resolve) => upstream.close(() => resolve()));
});

beforeEach(() => { upstreamStatus = 200; });

const call = (method: string, path: string, token: string, body?: unknown) => fetch(`${base}${path}`, { method, headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "x-device-id": "device-1" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const verify = (token: string, challengeToken: string) => call("POST", "/api/v1/security/human-verification", token, { token: challengeToken });

describe("human verification challenge", () => {
  it("classifies posting, following, messaging, checkout and payouts as sensitive but not reads or admin tools", () => {
    expect(classifyRequestSensitivity("POST", "/api/v1/posts")).toBe("sensitive");
    expect(classifyRequestSensitivity("POST", "/api/v1/users/abc/follow")).toBe("sensitive");
    expect(classifyRequestSensitivity("POST", "/api/v1/stores/abc/follow")).toBe("sensitive");
    expect(classifyRequestSensitivity("DELETE", "/api/v1/stores/abc/follow")).toBe("sensitive");
    expect(classifyRequestSensitivity("GET", "/api/v1/stores/abc/follow-status")).toBe("none");
    expect(classifyRequestSensitivity("POST", "/api/v1/conversations/abc/messages")).toBe("sensitive");
    expect(classifyRequestSensitivity("POST", "/api/v1/orders/checkout")).toBe("sensitive");
    expect(classifyRequestSensitivity("POST", "/api/v1/wallets/me/withdrawals")).toBe("sensitive");
    expect(classifyRequestSensitivity("POST", "/api/v1/posts/abc/like")).toBe("like");
    expect(classifyRequestSensitivity("GET", "/api/v1/orders")).toBe("none");
    expect(classifyRequestSensitivity("POST", "/api/v1/admin/users/abc/suspend")).toBe("none");
  });

  it("requires a challenge after probing, then clears the flag once passed", async () => {
    trust.states.set("acct-flagged", { requirement: "once", reason: "access_probing" });
    const blocked = await call("POST", "/api/v1/posts", "token-flagged", { text: "hi" });
    expect(blocked.status).toBe(428);
    expect(await blocked.json()).toMatchObject({ code: "HUMAN_VERIFICATION_REQUIRED", reason: "access_probing", provider: "turnstile" });
    expect((await call("PUT", "/api/v1/users/me/profile", "token-flagged", {})).status).toBe(200);
    const passed = await verify("token-flagged", turnstileAlwaysPassToken);
    expect(passed.status).toBe(200);
    expect(await passed.json()).toMatchObject({ verified: true, requirement: "none" });
    expect((await call("POST", "/api/v1/posts", "token-flagged", { text: "hi" })).status).toBe(200);
  });

  it("refuses sensitive writes when challenge state cannot be checked", async () => {
    const unavailableTrust = new UnavailableTrust();
    const security = buildSecurityServices(configForTest.security, configForTest.upstreams.trust, logger, undefined, { trust: unavailableTrust, provider });
    const guardedGateway = createGatewayServer({ config: { ...configForTest, port: 0 }, verifier, logger, security });
    await guardedGateway.start();
    try {
      const response = await fetch(`http://127.0.0.1:${guardedGateway.address?.port}/api/v1/posts`, {
        method: "POST",
        headers: { authorization: "Bearer token-clean", "content-type": "application/json" },
        body: JSON.stringify({ text: "must not pass without a security decision" }),
      });
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ code: "SECURITY_CHECK_UNAVAILABLE" });
    } finally {
      await guardedGateway.stop();
    }
  });

  it("challenges a suspected bot on every sensitive action, even after a pass", async () => {
    trust.states.set("acct-bot", { requirement: "everyAction", reason: "suspected_bot", suspectedBot: true });
    expect((await call("PUT", "/api/v1/users/me/profile", "token-bot", {})).status).toBe(428);
    expect((await verify("token-bot", turnstileAlwaysPassToken)).status).toBe(200);
    expect((await call("POST", "/api/v1/users/someone/follow", "token-bot")).status).toBe(200);
    expect((await call("POST", "/api/v1/users/someone-else/follow", "token-bot")).status).toBe(428);
    expect((await call("PUT", "/api/v1/users/me/profile", "token-bot", {})).status).toBe(200);
    expect((await verify("token-bot", turnstileAlwaysPassToken)).status).toBe(200);
    expect((await call("POST", "/api/v1/posts", "token-bot", {})).status).toBe(200);
    expect((await call("POST", "/api/v1/posts", "token-bot", {})).status).toBe(428);
  });

  it("reports failures, never logs the token, and turns the fifth failure into a suspension answer", async () => {
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 5; attempt += 1) statuses.push((await verify("token-failing", `bad-token-${attempt}-secret`)).status);
    expect(statuses).toEqual([400, 400, 400, 400, 403]);
    expect(trust.outcomes.filter((outcome) => outcome.accountId === "acct-failing").every((outcome) => !outcome.passed)).toBe(true);
    expect(logged.join("\n")).not.toContain("secret");
    expect(JSON.stringify(trust.outcomes)).not.toContain("bad-token");
  });

  it("steps up repeated guest rate-limit violations with Turnstile and permits one verified retry", async () => {
    const limitedGateway = createGatewayServer({
      config: { ...configForTest, port: 0, guestRateLimits: { perMinute: 1, sensitivePerMinute: 1 } },
      verifier,
      logger,
      security: { trust: new FakeTrust(), provider },
    });
    await limitedGateway.start();
    const limitedBase = `http://127.0.0.1:${limitedGateway.address?.port}`;
    const feedUrl = `${limitedBase}/api/v1/feeds/popular`;
    try {
      expect((await fetch(feedUrl)).status).toBe(200);
      expect((await fetch(feedUrl)).status).toBe(429);
      expect((await fetch(feedUrl)).status).toBe(429);
      const challenge = await fetch(feedUrl);
      expect(challenge.status).toBe(428);
      expect(await challenge.json()).toMatchObject({ code: "HUMAN_VERIFICATION_REQUIRED", reason: "rate_limit_abuse", provider: "turnstile" });

      const verified = await fetch(`${limitedBase}/api/v1/security/human-verification`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: turnstileAlwaysPassToken }),
      });
      expect(verified.status).toBe(200);
      expect((await fetch(feedUrl)).status).toBe(200);
    } finally {
      await limitedGateway.stop();
    }
  });

  it("requires an active challenge before accepting a guest verification and rate-limits attempts", async () => {
    expect((await fetch(`${base}/api/v1/security/human-verification`, { method: "POST", body: "{}" })).status).toBe(400);
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 11; attempt += 1) statuses.push((await verify("token-clean", turnstileAlwaysPassToken)).status);
    expect(statuses.slice(0, 10).every((status) => status === 200)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  it("does not challenge staff on admin tools and reports internal-path probing", async () => {
    trust.states.set("acct-flagged", { requirement: "once", reason: "access_probing" });
    expect((await call("POST", "/api/v1/admin/users/abc/suspend", "staff-token", {})).status).toBe(200);
    for (let attempt = 0; attempt < 3; attempt += 1) expect((await call("GET", "/api/v1/internal/users/summaries", "token-clean")).status).toBe(404);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(trust.violations.some((violation) => violation.kind === "internalPath" && violation.routeTemplate === "/api/v1/internal/users/summaries")).toBe(true);
  });
});
