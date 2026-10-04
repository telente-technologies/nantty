export interface AccessViolationEvidence {
  readonly violationId: string;
  readonly accountId: string;
  readonly sessionId: string;
  readonly deviceId: string;
  readonly ipPrefix: string;
  readonly kind: string;
  readonly routeTemplate: string;
  readonly resourceType: string;
  readonly windowCount: number;
  readonly windowSeconds: number;
  readonly distinctResources: number;
  readonly threshold: number;
  readonly source: "gateway";
  readonly detectedAt: string;
}

export interface ChallengeOutcomeReport {
  readonly attemptId: string;
  readonly accountId: string;
  readonly sessionId: string;
  readonly deviceId: string;
  readonly ipPrefix: string;
  readonly passed: boolean;
  readonly provider: string;
  readonly errorCodes: readonly string[];
}

export interface ChallengeState {
  readonly requirement: "none" | "once" | "everyAction";
  readonly reason?: string;
  readonly suspectedBot?: boolean;
  readonly clearedUntil?: string | null;
  readonly suspended?: boolean;
  readonly failuresInWindow?: number;
  readonly failuresAllowed?: number;
}

export interface TrustSecurityClient {
  reportAccessViolation(evidence: AccessViolationEvidence): Promise<void>;
  reportChallengeOutcome(report: ChallengeOutcomeReport): Promise<ChallengeState>;
  readChallengeState(accountId: string): Promise<ChallengeState>;
}

export class HttpTrustSecurityClient implements TrustSecurityClient {
  public constructor(private readonly trustBaseUrl: string, private readonly internalToken: string, private readonly timeoutMs = 2_000) {}

  public async reportAccessViolation(evidence: AccessViolationEvidence): Promise<void> {
    await this.send("POST", "/api/v1/internal/security/access-violations", evidence);
  }

  public async reportChallengeOutcome(report: ChallengeOutcomeReport): Promise<ChallengeState> {
    return (await this.send("POST", "/api/v1/internal/security/challenges", report)) as ChallengeState;
  }

  public async readChallengeState(accountId: string): Promise<ChallengeState> {
    return (await this.send("GET", `/api/v1/internal/security/accounts/${encodeURIComponent(accountId)}/challenge-state`)) as ChallengeState;
  }

  private async send(method: string, path: string, body?: unknown): Promise<unknown> {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const response = await fetch(new URL(path, this.trustBaseUrl), {
      method,
      headers: { "x-internal-token": this.internalToken, ...(payload === undefined ? {} : { "content-type": "application/json" }) },
      ...(payload === undefined ? {} : { body: payload }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) throw new Error(`trust security answered ${response.status}`);
    return response.json();
  }
}
