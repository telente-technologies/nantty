export interface PolicyGateDecision {
  readonly acceptanceRequired: boolean;
  readonly documentKeys: readonly string[];
}

export interface PolicyGateSource {
  readGate(accountId: string): Promise<PolicyGateDecision>;
}

export const policyGateExemptPrefixes: readonly string[] = [
  "/api/v1/auth/",
  "/api/v1/legal/",
  "/api/v1/policies/",
  "/api/v1/consents",
  "/api/v1/users/me/consents",
  "/api/v1/users/me/policy-acceptances",
  "/api/v1/users/me/terms-acceptances",
  "/api/v1/users/me/data-exports",
  "/api/v1/users/me/deletion-request",
  "/api/v1/admin/",
  "/api/v1/internal/",
];

const readOnlyMethods = new Set(["GET", "HEAD", "OPTIONS"]);

export function doesRequestNeedPolicyGate(method: string, path: string): boolean {
  if (readOnlyMethods.has(method.toUpperCase())) return false;
  return !policyGateExemptPrefixes.some((prefix) => path === prefix.replace(/\/$/, "") || path.startsWith(prefix));
}

export class IdentityPolicyGateSource implements PolicyGateSource {
  private readonly cache = new Map<string, { readonly decision: PolicyGateDecision; readonly expiresAt: number }>();

  public constructor(private readonly baseUrl: string, private readonly internalToken: string, private readonly ttlMs = 60_000, private readonly now: () => number = Date.now) {}

  public async readGate(accountId: string): Promise<PolicyGateDecision> {
    const cached = this.cache.get(accountId);
    if (cached !== undefined && cached.expiresAt > this.now()) return cached.decision;
    const response = await fetch(new URL(`/api/v1/internal/accounts/${encodeURIComponent(accountId)}/policy-gate`, this.baseUrl), {
      headers: { "x-internal-token": this.internalToken },
      signal: AbortSignal.timeout(2_000),
    });
    if (!response.ok) throw new Error(`policy gate lookup answered ${response.status}`);
    const decision = (await response.json()) as PolicyGateDecision;
    if (this.cache.size > 50_000) this.cache.clear();
    this.cache.set(accountId, { decision, expiresAt: this.now() + (decision.acceptanceRequired ? Math.min(this.ttlMs, 10_000) : this.ttlMs) });
    return decision;
  }
}
