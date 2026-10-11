import type { SecurityStore } from "./securityStore.service.js";
import type { ChallengeState, TrustSecurityClient } from "./securitySignalSink.service.js";
import { isAdminPath } from "./accessProbeClassifier.service.js";

export const humanVerificationPath = "/api/v1/security/human-verification";
export const sessionPassSeconds = 12 * 3600;
export const actionPassSeconds = 300;
const likeBurstLimitPerMinute = 10;

const mutatingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const sensitiveActionPatterns: readonly RegExp[] = [
  /^\/api\/v1\/posts\/?$/, /^\/api\/v1\/posts\/[^/]+\/(comments|replies|quotes|reposts)$/, /^\/api\/v1\/comments\/[^/]+\/replies$/,
  /^\/api\/v1\/clips\/?$/, /^\/api\/v1\/stories\/?$/, /^\/api\/v1\/users\/[^/]+\/follow$/,
  /^\/api\/v1\/conversations(\/.*)?$/, /^\/api\/v1\/messages\/.+$/, /^\/api\/v1\/chat\/.+$/,
  /^\/api\/v1\/orders(\/.*)?$/, /^\/api\/v1\/cart\/checkout.*$/, /^\/api\/v1\/payments\/.+$/,
  /^\/api\/v1\/wallets\/.+$/, /^\/api\/v1\/coins\/(transfers|withdrawals|purchases).*$/, /^\/api\/v1\/gifts(\/.*)?$/,
  /^\/api\/v1\/creators\/earnings\/convert$/, /^\/api\/v1\/banks(\/.*)?$/,
];

const likePattern = /\/(like|likes|reactions|reaction)$/;

export type SensitivityClass = "none" | "mutation" | "sensitive" | "like";

export function classifyRequestSensitivity(method: string, path: string): SensitivityClass {
  const verb = method.toUpperCase();
  if (!mutatingMethods.has(verb) || isAdminPath(path) || path.startsWith("/api/v1/auth/") || path === humanVerificationPath) return "none";
  if (likePattern.test(path)) return "like";
  return sensitiveActionPatterns.some((pattern) => pattern.test(path)) ? "sensitive" : "mutation";
}

export class CachedChallengeStateSource {
  private readonly cache = new Map<string, { readonly state: ChallengeState; readonly expiresAt: number }>();

  public constructor(private readonly trust: TrustSecurityClient, private readonly ttlMs = 15_000, private readonly now: () => number = Date.now) {}

  public async read(accountId: string): Promise<ChallengeState> {
    const cached = this.cache.get(accountId);
    if (cached !== undefined && cached.expiresAt > this.now()) return cached.state;
    let state: ChallengeState;
    try {
      state = await this.trust.readChallengeState(accountId);
    } catch (error) {
      if (cached !== undefined && cached.state.requirement !== "none") return cached.state;
      throw error;
    }
    this.cache.delete(accountId);
    if (this.cache.size >= 50_000) this.cache.delete(this.cache.keys().next().value as string);
    this.cache.set(accountId, { state, expiresAt: this.now() + this.ttlMs });
    return state;
  }

  public forget(accountId: string): void {
    this.cache.delete(accountId);
  }
}

export interface GateInput {
  readonly method: string;
  readonly path: string;
  readonly accountId: string;
  readonly sessionId: string;
}

export interface GateDecision {
  readonly challenge: boolean;
  readonly reason?: string;
}

export class HumanVerificationGate {
  public constructor(private readonly states: CachedChallengeStateSource, private readonly store: SecurityStore) {}

  public async evaluate(input: GateInput): Promise<GateDecision> {
    let sensitivity = classifyRequestSensitivity(input.method, input.path);
    if (sensitivity === "none") return { challenge: false };
    if (sensitivity === "like") {
      const likes = await this.store.recordInWindow(`sec:likes:${input.accountId}`, `${Date.now()}:${Math.random()}`, 60);
      sensitivity = likes > likeBurstLimitPerMinute ? "sensitive" : "mutation";
    }
    const state = await this.states.read(input.accountId);
    if (state.requirement === "once") return sensitivity === "sensitive" ? { challenge: true, reason: state.reason ?? "access_probing" } : { challenge: false };
    if (state.requirement !== "everyAction") return { challenge: false };
    if (!(await this.store.has(sessionPassKey(input.sessionId)))) return { challenge: true, reason: state.reason ?? "suspected_bot" };
    if (sensitivity === "sensitive" && !(await this.store.take(actionPassKey(input.sessionId)))) return { challenge: true, reason: state.reason ?? "suspected_bot" };
    return { challenge: false };
  }

  public async grantPasses(sessionId: string): Promise<void> {
    await this.store.put(sessionPassKey(sessionId), sessionPassSeconds);
    await this.store.put(actionPassKey(sessionId), actionPassSeconds);
  }
}

export function sessionPassKey(sessionId: string): string {
  return `sec:hv:session:${sessionId}`;
}

export function actionPassKey(sessionId: string): string {
  return `sec:hv:action:${sessionId}`;
}

export const humanVerificationRequiredBody = (reason: string, provider: string) => ({
  message: "Confirm you're a person to continue.",
  code: "HUMAN_VERIFICATION_REQUIRED",
  reason,
  provider,
  verifyPath: humanVerificationPath,
});
